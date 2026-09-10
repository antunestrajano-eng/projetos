#!/usr/bin/env python3
"""Create Meta Ads custom audiences from the Confiance Energy spreadsheet.

Reads META_ACCESS_TOKEN from the environment. Never hard-code tokens.

Usage:
  export META_ACCESS_TOKEN='EAAB...'
  python3 meta-ads/create_audiences.py [--dry-run]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_VERSION = "v22.0"
AD_ACCOUNT_ID = "1606863163348279"
PIXEL_ID = "1343641547568409"
GRAPH = f"https://graph.facebook.com/{API_VERSION}"
SLEEP_S = 0.35
MAX_RETRIES = 4

HERE = Path(__file__).resolve().parent
XLSX_CANDIDATES = [
    Path("/tmp/publicos_meta.xlsx"),
    HERE / "Públicos do Meta Ads - [CONFIANCE ENERGY].xlsx",
]


def load_sheet_rows() -> list[dict]:
    try:
        import openpyxl
    except ImportError:
        sys.exit("Instale openpyxl: pip install openpyxl")
    xlsx = next((p for p in XLSX_CANDIDATES if p.exists()), None)
    if xlsx is None:
        sys.exit("Planilha xlsx não encontrada. Coloque-a em meta-ads/ ou /tmp/publicos_meta.xlsx")
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    rows: list[dict] = []
    for sheet in wb.sheetnames:
        ws = wb[sheet]
        section = None
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row, max_col=20, values_only=True):
            b = row[1] if len(row) > 1 else None
            d = row[3] if len(row) > 3 else None
            i = row[8] if len(row) > 8 else None
            m = row[12] if len(row) > 12 else None
            if b and not isinstance(b, bool) and not d:
                section = str(b).strip()
            if isinstance(d, str) and d.strip() not in ("Nomenclatura do Público",):
                rows.append(
                    {
                        "sheet": sheet,
                        "section": section,
                        "already_created": bool(b is True or (isinstance(m, str) and "Criado" in m)),
                        "name": d.strip(),
                        "description": (str(i).strip() if i else ""),
                        "status": (str(m).strip() if m else ""),
                    }
                )
    return rows


def days_from(name: str, desc: str) -> int | None:
    m = re.search(r"(\d+)D\s*$", name)
    if m:
        return int(m.group(1))
    m = re.search(r"últimos\s+(\d+)\s+dias", desc or "", re.I)
    if m:
        return int(m.group(1))
    return None


def lookalike_spec(name: str) -> tuple[float, str] | None:
    m = re.search(r"\((?:BR),?\s*(\d+)%\)", name, re.I)
    if not m:
        return None
    return int(m.group(1)) / 100.0, name


def seed_hint_from_lookalike(name: str) -> str:
    rest = re.sub(r"^(?:Semelhante|Lookalike)\s*\([^)]+\)\s*-\s*", "", name, flags=re.I).strip()
    rest = rest.replace("Envolvimento", "ENVOLVIMENTO")
    replacements = [
        (r"^FB\s*-\s*ENVOLVIMENTO\s*", "[FB] [ENVOLVIMENTO] "),
        (r"^IG\s*-\s*ENVOLVIMENTO\s*", "[IG] [ENVOLVIMENTO] "),
        (r"^\[IG\]\s*\[ENV\]\s*", "[IG] [ENVOLVIMENTO] "),
        (r"^View Site\s*", "View Site - "),
        (r"^EI\s*", "EI - "),
        (r"^Formulário\s*", "Formulário - "),
    ]
    for pat, repl in replacements:
        rest = re.sub(pat, repl, rest)
    rest = re.sub(r"\s*-\s*", " - ", rest)
    rest = re.sub(r"\s+", " ", rest).strip()
    return rest


def graph_request(token: str, method: str, path: str, params: dict | None = None, data: dict | None = None):
    params = dict(params or {})
    params["access_token"] = token
    url = f"{GRAPH}{path}"
    if method == "GET":
        url += "?" + urllib.parse.urlencode(params, doseq=True)
        req = urllib.request.Request(url, method="GET")
    else:
        body = urllib.parse.urlencode({**(data or {}), **params}).encode()
        req = urllib.request.Request(url, data=body, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        try:
            return json.loads(payload)
        except json.JSONDecodeError:
            return {"error": {"message": payload, "code": exc.code}}


def graph_get_all(token: str, path: str, fields: str) -> list[dict]:
    items: list[dict] = []
    params: dict = {"fields": fields, "limit": 200}
    while True:
        res = graph_request(token, "GET", path, params)
        if res.get("error"):
            raise RuntimeError(res["error"])
        items.extend(res.get("data") or [])
        nxt = (res.get("paging") or {}).get("next")
        if not nxt:
            break
        parsed = urllib.parse.urlparse(nxt)
        params = dict(urllib.parse.parse_qsl(parsed.query))
        time.sleep(SLEEP_S)
    return items


def discover_assets(token: str) -> dict:
    act = f"/act_{AD_ACCOUNT_ID}"
    info = graph_request(token, "GET", act, {"fields": "id,name,account_status,tos_accepted"})
    if info.get("error"):
        raise RuntimeError(info["error"])

    pixels = graph_request(token, "GET", f"{act}/adspixels", {"fields": "id,name", "limit": 50})
    pages = graph_request(
        token,
        "GET",
        f"{act}/promote_pages",
        {"fields": "id,name,instagram_business_account{id,username}", "limit": 50},
    )
    if pages.get("error"):
        pages = graph_request(
            token,
            "GET",
            "/me/accounts",
            {"fields": "id,name,access_token,instagram_business_account{id,username}", "limit": 50},
        )

    page = None
    ig_id = os.environ.get("META_IG_PROFILE_ID")
    page_id = os.environ.get("META_PAGE_ID")
    for p in pages.get("data") or []:
        if page_id and str(p.get("id")) == str(page_id):
            page = p
            break
        if not page:
            page = p
    if page:
        page_id = str(page.get("id"))
        ig = page.get("instagram_business_account") or {}
        if ig.get("id"):
            ig_id = str(ig["id"])
        # Instagram profile ID used by engagement audiences can differ from IBA id
        ig_accounts = graph_request(token, "GET", f"/{page_id}/instagram_accounts", {"fields": "id,username"})
        ig_list = ig_accounts.get("data") or []
        if ig_list:
            ig_id = str(ig_list[0]["id"])

    pixel_id = PIXEL_ID
    for px in pixels.get("data") or []:
        if str(px.get("id")) == PIXEL_ID:
            pixel_id = PIXEL_ID
            break
        if not pixel_id:
            pixel_id = str(px.get("id"))

    lead_forms: list[str] = []
    canvases: list[str] = []
    if page_id:
        forms = graph_request(token, "GET", f"/{page_id}/leadgen_forms", {"fields": "id,name,status", "limit": 200})
        lead_forms = [str(f["id"]) for f in forms.get("data") or [] if f.get("id")]
        cvs = graph_request(token, "GET", f"/{page_id}/canvases", {"fields": "id,name", "limit": 200})
        canvases = [str(c["id"]) for c in cvs.get("data") or [] if c.get("id")]

    existing = {}
    try:
        for aud in graph_get_all(token, f"{act}/customaudiences", "id,name,subtype,approximate_count"):
            existing[aud["name"]] = aud
    except RuntimeError:
        listed = graph_request(token, "GET", f"{act}/customaudiences", {"fields": "id,name,subtype", "limit": 500})
        for aud in listed.get("data") or []:
            existing[aud["name"]] = aud

    return {
        "account": info,
        "page_id": page_id,
        "ig_id": ig_id,
        "pixel_id": pixel_id,
        "lead_forms": lead_forms,
        "canvases": canvases,
        "existing": existing,
    }


def engagement_rule(source_id: str, source_type: str, event: str, days: int | None) -> dict:
    rule_item: dict = {
        "event_sources": [{"id": str(source_id), "type": source_type}],
        "filter": {
            "operator": "and",
            "filters": [{"field": "event", "operator": "eq", "value": event}],
        },
    }
    if days and event not in {"page_liked"}:
        rule_item["retention_seconds"] = int(days) * 86400
    elif event == "page_liked":
        rule_item["retention_seconds"] = 1
    else:
        rule_item["retention_seconds"] = 365 * 86400
    return {"inclusions": {"operator": "or", "rules": [rule_item]}}


def multi_source_rule(ids: list[str], source_type: str, event: str, days: int) -> dict:
    rules = []
    for sid in ids:
        rules.append(
            {
                "event_sources": [{"id": str(sid), "type": source_type}],
                "retention_seconds": int(days) * 86400,
                "filter": {
                    "operator": "and",
                    "filters": [{"field": "event", "operator": "eq", "value": event}],
                },
            }
        )
    return {"inclusions": {"operator": "or", "rules": rules}}


def website_rule(pixel_id: str, days: int, url_contains: list[str] | None = None) -> dict:
    filters = [{"field": "event", "operator": "eq", "value": "PageView"}]
    for fragment in url_contains or []:
        filters.append({"field": "url", "operator": "i_contains", "value": fragment})
    return {
        "inclusions": {
            "operator": "or",
            "rules": [
                {
                    "event_sources": [{"id": str(pixel_id), "type": "pixel"}],
                    "retention_seconds": max(1, int(days)) * 86400,
                    "filter": {"operator": "and", "filters": filters},
                }
            ],
        }
    }


def url_fragments_for_site(name: str) -> list[str] | None:
    mapping = [
        ("CAPTURA LANÇAMENTO", ["captura"]),
        ("OBRIGADO LANÇAMENTO", ["obrigado"]),
        ("[LANÇAMENTO]", ["lancamento"]),
        ("PV PRODUTO", ["vendas"]),
        ("CHECKOUT", ["checkout"]),
        ("[COMPRA]", ["compra"]),
        ("[BLOG]", ["blog.confianceenergy.com"]),
        ("CAPTURA LIVE", ["live"]),
        ("OBRIGADO LIVE", ["live"]),
        ("CAPTURA EBOOK", ["ebook"]),
        ("OBRIGADO EBOOK", ["ebook"]),
        ("CAPTURA PLANILHA", ["planilha"]),
        ("OBRIGADO PLANILHA", ["planilha"]),
        ("Visitantes do Site - 25%", ["*TIME_SPENT_25*"]),
    ]
    for key, frags in mapping:
        if key in name:
            return frags
    if re.search(r"View Site - \d+D$", name) or name.startswith("[SITE] Visitantes do Site - ") and "25%" not in name:
        return []
    return []


def classify(row: dict) -> dict:
    sheet, name, desc = row["sheet"], row["name"], row["description"]
    days = days_from(name, desc)
    spec = {**row, "days": days}

    if row["already_created"]:
        return {**spec, "kind": "skip", "reason": "já marcado como Público Criado na planilha"}

    if sheet == "Envolvimento IG":
        event = None
        if "[TODOS]" in name:
            event = "ig_business_profile_all"
        elif "[VISITOU]" in name:
            event = "ig_business_profile_visit"
        elif "[ENVOLVEU]" in name:
            event = "ig_business_profile_engaged"
        elif "[MENSAGEM]" in name:
            event = "ig_user_messaged_business"
        elif "[SALVOU]" in name:
            event = "ig_business_profile_ad_saved"
        elif "SEGUI" in name:
            return {**spec, "kind": "skip", "reason": "seguir a conta atualmente não tem evento público na Marketing API"}
        if event:
            return {**spec, "kind": "ig", "event": event, "days": days or 365}

    if sheet == "Envolvimento FB":
        event = None
        if "[TODOS]" in name:
            event = "page_engaged"
        elif "[VISITOU]" in name:
            event = "page_visited"
        elif "[ENVOLVEU]" in name:
            event = "page_post_interaction"
        elif "[CLICOU]" in name:
            event = "page_cta_clicked"
        elif "[MENSAGEM]" in name:
            event = "page_messaged"
        elif "[SALVOU]" in name:
            event = "page_or_post_save"
        elif "CURTIU" in name:
            event = "page_liked"
            days = None
        if event:
            return {**spec, "kind": "fb", "event": event, "days": days or 365}

    if sheet == "Lista":
        return {**spec, "kind": "list"}

    if sheet == "Lookalike":
        parsed = lookalike_spec(name)
        if not parsed:
            return {**spec, "kind": "skip", "reason": "não deu para ler o % do lookalike"}
        return {**spec, "kind": "lookalike", "ratio": parsed[0], "seed_hint": seed_hint_from_lookalike(name)}

    if sheet == "Formulário":
        if "[NÃO ENVIOU]" in name:
            return {**spec, "kind": "lead", "event": "lead_generation_dropoff", "days": days or 30}
        if "[ENVIOU]" in name:
            return {**spec, "kind": "lead", "event": "lead_generation_submitted", "days": days or 30}
        if "[ABRIU]" in name:
            return {**spec, "kind": "lead", "event": "lead_generation_opened", "days": days or 30}

    if sheet == "View Site":
        frags = url_fragments_for_site(name)
        if frags == ["*TIME_SPENT_25*"]:
            return {**spec, "kind": "website_time", "days": days or 30}
        return {**spec, "kind": "website", "url_contains": frags, "days": days or 30}

    if sheet == "View Vídeo FBIG":
        return {**spec, "kind": "skip", "reason": "precisa dos IDs dos vídeos RAIZ / NUTELLA / Q&A / ANÚNCIO"}

    if sheet == "EI":
        event = "instant_shopping_element_click" if "[CLICOU]" in name else "instant_shopping_document_open"
        return {**spec, "kind": "canvas", "event": event, "days": days or 30}

    return {**spec, "kind": "skip", "reason": "não classificado"}


def create_audience(token: str, payload: dict, dry_run: bool) -> dict:
    if dry_run:
        return {"dry_run": True, "payload_keys": sorted(payload.keys()), "name": payload.get("name")}
    act = f"/act_{AD_ACCOUNT_ID}/customaudiences"
    last = None
    for attempt in range(MAX_RETRIES):
        last = graph_request(token, "POST", act, data=payload)
        err = last.get("error") if isinstance(last, dict) else None
        if not err:
            return last
        code = err.get("code")
        sub = err.get("error_subcode")
        msg = (err.get("message") or "").lower()
        if code == 17 or code == 613 or "too many" in msg or "rate" in msg:
            time.sleep(2 ** attempt + 1)
            continue
        if code == 200 and "blocked" in msg:
            return last
        if sub or code:
            return last
        time.sleep(1)
    return last or {"error": {"message": "falha desconhecida"}}


def find_seed(existing: dict, created: dict, hint: str, lookalike_name: str) -> dict | None:
    candidates = {**existing, **{n: {"id": i, "name": n} for n, i in created.items()}}
    if hint in candidates:
        return candidates[hint]
    # fuzzy: all tokens of hint appear in an existing name
    hint_norm = re.sub(r"[^\w%]+", " ", hint.upper())
    tokens = [t for t in hint_norm.split() if t not in {"M"}]
    best = None
    best_score = 0
    for name, aud in candidates.items():
        name_norm = re.sub(r"[^\w%]+", " ", name.upper())
        score = sum(1 for t in tokens if t in name_norm)
        if score > best_score:
            best_score = score
            best = aud
    if best and best_score >= max(3, len(tokens) - 1):
        return best
    # last resort: strip lookalike prefix leftovers already handled
    for name, aud in candidates.items():
        if name.replace(" ", "") in lookalike_name.replace(" ", "") or lookalike_name.endswith(name):
            return aud
    return None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    token = os.environ.get("META_ACCESS_TOKEN", "").strip()
    if not token:
        print("Defina META_ACCESS_TOKEN no ambiente.", file=sys.stderr)
        return 2

    rows = load_sheet_rows()
    classified = [classify(r) for r in rows]
    print(f"Planilha: {len(rows)} públicos")
    kinds = {}
    for c in classified:
        kinds[c["kind"]] = kinds.get(c["kind"], 0) + 1
    print("Classificação:", kinds)

    try:
        assets = discover_assets(token)
    except RuntimeError as exc:
        err = exc.args[0] if exc.args else {"message": str(exc)}
        print("Falha ao falar com a Graph API:", json.dumps(err, ensure_ascii=False))
        print("O token está bloqueado ou inválido. Gere um token de System User no Business Manager.")
        report = {"error": err, "classified_counts": kinds, "sample": classified[:8]}
        (HERE / "last_run_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2))
        return 1

    print("Conta:", assets["account"])
    print("Página:", assets["page_id"], "IG:", assets["ig_id"], "Pixel:", assets["pixel_id"])
    print("Formulários:", len(assets["lead_forms"]), "Canvas:", len(assets["canvases"]))
    print("Públicos já existentes:", len(assets["existing"]))

    created_ids: dict[str, str] = {n: a["id"] for n, a in assets["existing"].items()}
    results = []

    order = ["ig", "fb", "website", "website_time", "lead", "canvas", "list", "lookalike"]
    by_kind = {k: [c for c in classified if c["kind"] == k] for k in order}
    skipped = [c for c in classified if c["kind"] == "skip"]

    def post_engagement(item, source_id, source_type):
        if not source_id:
            return {"skipped": True, "reason": f"sem {source_type} id", **item}
        if item["name"] in created_ids:
            return {"skipped": True, "reason": "já existe", "id": created_ids[item["name"]], **item}
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "prefill": "1",
            "rule": json.dumps(engagement_rule(source_id, source_type, item["event"], item.get("days"))),
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        return {"result": res, **item}

    for item in by_kind["ig"]:
        results.append(post_engagement(item, assets["ig_id"], "ig_business"))
    for item in by_kind["fb"]:
        results.append(post_engagement(item, assets["page_id"], "page"))

    for item in by_kind["website"]:
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", "id": created_ids[item["name"]], **item})
            continue
        days = item.get("days") or 30
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "prefill": "1",
            "rule": json.dumps(website_rule(assets["pixel_id"], days, item.get("url_contains") or None)),
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item})

    for item in by_kind["website_time"]:
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", **item})
            continue
        days = item.get("days") or 30
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "prefill": "1",
            "rule": json.dumps(website_rule(assets["pixel_id"], days)),
            "rule_aggregation": json.dumps(
                {"type": "multi_unique_percent", "method": "time_spent", "operator": "in_range", "from": 75, "to": 100}
            ),
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item})

    for item in by_kind["lead"]:
        if not assets["lead_forms"]:
            results.append({"skipped": True, "reason": "nenhum formulário de cadastro na Página", **item})
            continue
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", **item})
            continue
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "prefill": "1",
            "rule": json.dumps(multi_source_rule(assets["lead_forms"], "lead", item["event"], item.get("days") or 30)),
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item})

    for item in by_kind["canvas"]:
        if not assets["canvases"]:
            results.append({"skipped": True, "reason": "nenhuma Experiência Instantânea encontrada", **item})
            continue
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", **item})
            continue
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "prefill": "1",
            "rule": json.dumps(multi_source_rule(assets["canvases"], "canvas", item["event"], item.get("days") or 30)),
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item})

    for item in by_kind["list"]:
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", **item})
            continue
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "subtype": "CUSTOM",
            "customer_file_source": "USER_PROVIDED_ONLY",
        }
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item})

    for item in by_kind["lookalike"]:
        if item["name"] in created_ids:
            results.append({"skipped": True, "reason": "já existe", **item})
            continue
        seed = find_seed(assets["existing"], created_ids, item["seed_hint"], item["name"])
        if not seed:
            results.append({"skipped": True, "reason": f"semente não encontrada ({item['seed_hint']})", **item})
            continue
        payload = {
            "name": item["name"],
            "description": item["description"][:1000],
            "subtype": "LOOKALIKE",
            "origin_audience_id": seed["id"] if isinstance(seed, dict) and "id" in seed else seed,
            "lookalike_spec": json.dumps({"ratio": item["ratio"], "country": "BR"}),
        }
        if isinstance(seed, dict) and seed.get("id") and item["name"] not in (seed.get("name"),):
            payload["origin_audience_id"] = seed["id"]
        elif item["seed_hint"] in created_ids:
            payload["origin_audience_id"] = created_ids[item["seed_hint"]]
        res = create_audience(token, payload, args.dry_run)
        if res.get("id"):
            created_ids[item["name"]] = res["id"]
        time.sleep(SLEEP_S)
        results.append({"result": res, **item, "seed": seed})

    ok = sum(1 for r in results if (r.get("result") or {}).get("id") or r.get("dry_run"))
    skipped_n = sum(1 for r in results if r.get("skipped")) + len(skipped)
    failed = sum(1 for r in results if (r.get("result") or {}).get("error"))
    report = {
        "ok": ok,
        "skipped": skipped_n,
        "failed": failed,
        "assets": {k: assets[k] for k in ("page_id", "ig_id", "pixel_id") if k in assets},
        "skipped_reasons": skipped,
        "results": [
            {
                "name": r.get("name"),
                "kind": r.get("kind"),
                "skipped": r.get("skipped"),
                "reason": r.get("reason"),
                "id": (r.get("result") or {}).get("id") or r.get("id"),
                "error": (r.get("result") or {}).get("error"),
            }
            for r in results
        ],
    }
    out = HERE / "last_run_report.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"Criados/ok: {ok}  pulados: {skipped_n}  falhas: {failed}")
    print("Relatório:", out)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
