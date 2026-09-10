# Públicos do Meta Ads — Confiance Energy

Script para criar na conta `act_1606863163348279` os públicos da planilha
`Públicos do Meta Ads - [CONFIANCE ENERGY].xlsx`.

## Como rodar

1. No Business Manager, gere um **token de System User** com `ads_management`,
   `ads_read`, `pages_read_engagement` e `business_management`.
2. Aceite os Termos de Públicos Personalizados no Gerenciador de Anúncios.
3. Rode:

```bash
export META_ACCESS_TOKEN='EAAB...'
python3 meta-ads/create_audiences.py
```

O token **não** deve ser commitado. Tokens do Graph API Explorer costumam
voltar `API access blocked`.

## O que o script cria

- Envolvimento Instagram e Facebook (exceto “segue a conta atualmente”)
- View Site (pixel `1343641547568409`) e blog `blog.confianceenergy.com`
- Formulários de cadastro, se existirem na Página
- Experiência Instantânea, se existirem canvases
- Listas vazias (você ainda precisa enviar os e-mails/telefones)
- Lookalikes 1–10% BR a partir das sementes criadas

## O que fica de fora até você enviar o dado

- Vídeos RAIZ / NUTELLA / Q&A / ANÚNCIO — faltam os IDs dos vídeos
- Lookalikes cuja semente ainda não tem ~100 pessoas
- Páginas de captura/obrigado/checkout que ainda não existem no site
