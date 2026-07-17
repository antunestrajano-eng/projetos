/* ══════════════════════════════════════════════════════════════
   CONFIANCE ENERGY — Dashboard de Projetos
   Main Application Logic
══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  // ── Authentication ──
  const CORRECT_PASS = '10203040';
  const overlay = document.getElementById('login-overlay');
  const passInput = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  if (localStorage.getItem('dashboard_auth') === 'true') {
    overlay.classList.add('hidden');
  } else {
    const tryLogin = () => {
      if (passInput.value === CORRECT_PASS) {
        localStorage.setItem('dashboard_auth', 'true');
        overlay.classList.add('hidden');
        loginError.style.display = 'none';
      } else {
        loginError.style.display = 'block';
        passInput.value = '';
      }
    };
    loginBtn.addEventListener('click', tryLogin);
    passInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') tryLogin();
    });
  }

  // ── Sidebar Navigation ──
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('page-title');

  const tabTitles = {
    'tab-overview': 'Visão Geral',
    'tab-pipeline': 'Pipeline',
    'tab-stalled': 'Projetos Parados',
    'tab-approved': 'Aprovados & Vistorias',
    'tab-comments': 'Comentários',
    'tab-insights': 'Alertas & Insights',
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));
      item.classList.add('active');
      const target = document.getElementById(item.dataset.tab);
      if (target) target.classList.add('active');
      if (pageTitle) pageTitle.textContent = tabTitles[item.dataset.tab] || '';
      // Close mobile sidebar
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('show');
    });
  });

  // ── Mobile toggle ──
  const mobileToggle = document.getElementById('mobile-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('show');
    });
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      sidebarOverlay.classList.remove('show');
    });
  }

  // ── Configuração da Fonte de Dados ──
  // Caso use Cloudflare Worker, cole a URL dele aqui (ex: 'https://seu-worker.workers.dev')
  // Deixe vazio para ler o arquivo local data/tasks.json (alimentado via GitHub Actions ou mock)
  const WORKER_URL = 'https://dashboard-projetos.antunestrajano.workers.dev/'; 
  const DATA_SOURCE = WORKER_URL || 'data/tasks.json';

  // ── Fallback Mock Data para visualização local (evita bloqueio CORS) ──
  const FALLBACK_MOCK_DATA = {
    "last_updated": "2026-07-16T15:00:00-03:00",
    "tasks": [
      {"id": 101, "title": "Residencial Silva - 8.5kWp", "status": "Concluída", "responsible": "João Alves", "created_at": "2026-02-10T10:00:00-03:00", "updated_at": "2026-04-15T17:00:00-03:00", "deadline": "2026-04-20T00:00:00-03:00", "approved_at": "2026-04-10T09:30:00-03:00", "comments": [
        {"author": "João Alves", "text": "Medidor bidirecional instalado. Projeto finalizado com sucesso.", "date": "2026-04-15T17:00:00-03:00"},
        {"author": "Maria Souza", "text": "Vistoria aprovada pela Cosern.", "date": "2026-04-10T09:30:00-03:00"}
      ]},
      {"id": 102, "title": "Condomínio Parque das Águas - 120kWp", "status": "Solicitar vistoria", "responsible": "Carlos Rocha", "created_at": "2026-03-10T14:30:00-03:00", "updated_at": "2026-07-15T11:20:00-03:00", "deadline": "2026-07-30T00:00:00-03:00", "approved_at": "2026-07-15T11:20:00-03:00", "comments": [
        {"author": "Carlos Rocha", "text": "Projeto aprovado na concessionária, solicitando vistoria hoje.", "date": "2026-07-15T11:20:00-03:00"}
      ]},
      {"id": 103, "title": "Mercadinho São José - 15kWp", "status": "Vistoria reprovada", "responsible": "Ana Paula", "created_at": "2026-04-20T09:15:00-03:00", "updated_at": "2026-07-12T16:40:00-03:00", "deadline": "2026-07-20T00:00:00-03:00", "approved_at": "2026-07-11T10:00:00-03:00", "comments": [
        {"author": "Ana Paula", "text": "Fiscal alegou padrão fora da norma ABNT. Precisamos refazer aterramento.", "date": "2026-07-12T16:40:00-03:00"}
      ]},
      {"id": 104, "title": "Escola Caminho do Saber - 45kWp", "status": "Projeto enviado", "responsible": "João Alves", "created_at": "2026-05-15T11:00:00-03:00", "updated_at": "2026-07-02T14:00:00-03:00", "deadline": "2026-08-01T00:00:00-03:00", "comments": []},
      {"id": 105, "title": "Clínica Med Center - 25kWp", "status": "Consultar Carga/ Aumento de carga", "responsible": "Carlos Rocha", "created_at": "2026-07-01T08:00:00-03:00", "updated_at": "2026-07-02T08:00:00-03:00", "deadline": "2026-08-15T00:00:00-03:00", "comments": []},
      {"id": 106, "title": "Residência Maria Rita - 5kWp", "status": "Reunir dados", "responsible": "Ana Paula", "created_at": "2026-07-10T09:00:00-03:00", "updated_at": "2026-07-10T10:00:00-03:00", "deadline": "2026-08-20T00:00:00-03:00", "comments": []},
      {"id": 107, "title": "Padaria Pão Quente - 10kWp", "status": "Concluída", "responsible": "João Alves", "created_at": "2026-01-15T08:00:00-03:00", "updated_at": "2026-03-30T17:00:00-03:00", "deadline": "2026-04-01T00:00:00-03:00", "approved_at": "2026-03-20T17:00:00-03:00", "comments": []},
      {"id": 108, "title": "Igreja Central - 20kWp", "status": "Clientes com débito", "responsible": "Carlos Rocha", "created_at": "2026-04-25T14:00:00-03:00", "updated_at": "2026-06-10T10:00:00-03:00", "deadline": "2026-07-15T00:00:00-03:00", "comments": []},
      {"id": 109, "title": "Fazenda Boa Vista - 75kWp", "status": "Realizando Vistoria", "responsible": "Ana Paula", "created_at": "2026-05-25T09:00:00-03:00", "updated_at": "2026-07-16T08:00:00-03:00", "deadline": "2026-07-25T00:00:00-03:00", "approved_at": "2026-07-10T08:00:00-03:00", "comments": []},
      {"id": 111, "title": "Posto São Jorge - 50kWp", "status": "Concluída", "responsible": "Carlos Rocha", "created_at": "2026-01-05T10:00:00-03:00", "updated_at": "2026-04-20T16:00:00-03:00", "deadline": "2026-04-25T00:00:00-03:00", "approved_at": "2026-04-05T16:00:00-03:00", "comments": []},
      {"id": 115, "title": "Residencial Mar Azul - 6kWp", "status": "Concluída", "responsible": "Ana Paula", "created_at": "2026-03-01T14:00:00-03:00", "updated_at": "2026-05-10T16:30:00-03:00", "deadline": "2026-05-15T00:00:00-03:00", "approved_at": "2026-04-28T16:30:00-03:00", "comments": []},
      {"id": 121, "title": "Academia Power Fit - 22kWp", "status": "Solicitar vistoria", "responsible": "João Alves", "created_at": "2026-04-10T08:00:00-03:00", "updated_at": "2026-07-10T16:00:00-03:00", "deadline": "2026-07-28T00:00:00-03:00", "approved_at": "2026-07-10T16:00:00-03:00", "comments": []}
    ]
  };

  // ── Load Data ──
  fetch(DATA_SOURCE)
    .then(r => r.json())
    .then(data => initDashboard(data))
    .catch(err => {
      console.warn('Aviso: Carregando dados locais mockados devido a restrições de CORS/rede no ambiente local:', err);
      initDashboard(FALLBACK_MOCK_DATA);
    });
});

/* ══════════════════════════════════════════════════════════════
   STATUS CONFIGURATION
══════════════════════════════════════════════════════════════ */
const STAGES_ORDER = [
  'Reunir dados',
  'Consultar Carga/ Aumento de carga',
  'Troca de Titularidade',
  'Sem cadastro/outros',
  'Clientes com débito',
  'Pagou débito/Emitir TRT',
  'Elaborar/Enviar projeto',
  'Projeto enviado',
  'Solicitar vistoria',
  'Realizando vistoria',
  'Vistoria reprovada',
  'Concluída',
];

const STAGE_COLORS = {
  'Reunir dados':                      '#94a3b8',
  'Consultar Carga/ Aumento de carga':  '#60a5fa',
  'Troca de Titularidade':             '#818cf8',
  'Sem cadastro/outros':               '#a78bfa',
  'Clientes com débito':               '#f87171',
  'Pagou débito/Emitir TRT':           '#fb923c',
  'Elaborar/Enviar projeto':           '#fbbf24',
  'Projeto enviado':                   '#34d399',
  'Solicitar vistoria':                '#2dd4bf',
  'Realizando vistoria':               '#22d3ee',
  'Vistoria reprovada':                '#ef4444',
  'Concluída':                         '#10b981',
  'Lixeira':                           '#cbd5e1',
  'Antigos':                           '#cbd5e1',
};

const PROBLEM_STATUSES = ['Clientes com débito', 'Vistoria reprovada', 'Sem cadastro/outros'];
const FINAL_STATUSES = ['Projeto enviado', 'Solicitar vistoria', 'Realizando vistoria', 'Vistoria reprovada'];

function getStatusBadge(status) {
  const s = status.toLowerCase();
  if (s.includes('conclu')) return 'badge-green';
  if (s.includes('reprov') || s.includes('débit') || s.includes('sem cadast')) return 'badge-red';
  if (s.includes('vistoria') || s.includes('enviad')) return 'badge-cyan';
  if (s.includes('elaborar') || s.includes('pagou')) return 'badge-orange';
  if (s.includes('reunir')) return 'badge-gray';
  return 'badge-blue';
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function daysBetween(d1, d2) {
  return Math.ceil(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
}

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('pt-BR');
}

function formatDateTime(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

/* ══════════════════════════════════════════════════════════════
   ANIMATED VALUE
══════════════════════════════════════════════════════════════ */
function animateVal(el, end, suffix = '') {
  if (!el) return;
  const duration = 800;
  let start = null;
  const step = ts => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
    el.textContent = Math.floor(eased * end) + suffix;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ══════════════════════════════════════════════════════════════
   INIT DASHBOARD
══════════════════════════════════════════════════════════════ */
function initDashboard(data) {
  const now = new Date();
  const tasks = data.tasks;

  // ── Meta ──
  const upd = new Date(data.last_updated);
  document.getElementById('last-updated').textContent = `Atualizado: ${upd.toLocaleString('pt-BR')}`;

  // ── Filter tasks ──
  const active = tasks.filter(t => t.status !== 'Lixeira' && t.status !== 'Concluída' && !t.status.toLowerCase().includes('antigo'));
  const done = tasks.filter(t => t.status === 'Concluída');
  const lixeira = tasks.filter(t => t.status === 'Lixeira');
  const allValid = tasks.filter(t => t.status !== 'Lixeira' && !t.status.toLowerCase().includes('antigo'));
  const problems = active.filter(t => PROBLEM_STATUSES.includes(t.status));

  // ── Cycle time for completed ──
  const cycleTimes = done.map(t => daysBetween(new Date(t.created_at), new Date(t.updated_at)));
  const avgCycle = cycleTimes.length ? Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) : 0;

  // ── Overdue ──
  const overdue = active.filter(t => t.deadline && new Date(t.deadline) < now);

  // ── Inspection pass rate ──
  const inspectionDone = tasks.filter(t => ['Concluída', 'Realizando vistoria'].includes(t.status));
  const inspectionFailed = tasks.filter(t => t.status === 'Vistoria reprovada');
  const totalInspections = inspectionDone.length + inspectionFailed.length;
  const inspRate = totalInspections > 0 ? Math.round((inspectionDone.length / totalInspections) * 100) : 0;

  // ── Hero ──
  animateVal(document.getElementById('hero-active'), active.length);
  animateVal(document.getElementById('hero-done'), done.length);
  animateVal(document.getElementById('hero-rate'), allValid.length ? Math.round((done.length / allValid.length) * 100) : 0, '%');
  animateVal(document.getElementById('hero-avg-days'), avgCycle, 'd');

  // ── KPIs ──
  animateVal(document.getElementById('kpi-total'), allValid.length);
  document.getElementById('kpi-total-sub').textContent = `${lixeira.length} na lixeira`;

  animateVal(document.getElementById('kpi-done'), done.length);
  document.getElementById('kpi-done-sub').textContent = `ciclo médio: ${avgCycle} dias`;

  animateVal(document.getElementById('kpi-progress'), active.length);
  document.getElementById('kpi-progress-sub').textContent = `em ${new Set(active.map(t => t.status)).size} etapas`;

  animateVal(document.getElementById('kpi-alert'), problems.length);
  document.getElementById('kpi-alert-sub').textContent = `débito, reprovada, etc.`;

  animateVal(document.getElementById('kpi-overdue'), overdue.length);
  document.getElementById('kpi-overdue-sub').textContent = overdue.length ? `prazo excedido` : 'todos em dia';

  animateVal(document.getElementById('kpi-inspect-rate'), inspRate, '%');
  document.getElementById('kpi-inspect-sub').textContent = `${totalInspections} vistoria(s)`;

  // ── Charts ──
  renderStatusChart(allValid);
  renderResponsibleChart(active);
  renderPipeline(active);
  renderStageTimeChart(active, now);
  renderBottleneckChart(active);


  // ── Tables ──
  populateResponsibleFilters(tasks);
  renderStalledTable(active, now);
  
  // Set default month and year in approved tab selects
  document.getElementById('filter-approved-month').value = now.getMonth() + 1;
  document.getElementById('filter-approved-year').value = now.getFullYear();
  
  renderApprovedTab(tasks, now);
  renderComments(tasks);

  renderInsights(tasks, active, done, problems, overdue, now, avgCycle, inspRate);

  // ── Filter listeners ──
  document.getElementById('filter-stalled-days').addEventListener('change', () => renderStalledTable(active, now));
  document.getElementById('filter-stalled-responsible').addEventListener('change', () => renderStalledTable(active, now));
  document.getElementById('filter-comment-search').addEventListener('input', () => renderComments(tasks));
  document.getElementById('filter-approved-month').addEventListener('change', () => renderApprovedTab(tasks, now));
  document.getElementById('filter-approved-year').addEventListener('change', () => renderApprovedTab(tasks, now));

  // ── Chart Toggles ──
  const btnInactive = document.getElementById('btn-time-inactive');
  const btnReal = document.getElementById('btn-time-real');
  if (btnInactive && btnReal) {
    btnInactive.addEventListener('click', () => {
      btnInactive.classList.add('active');
      btnInactive.style.background = 'var(--bg-card)';
      btnInactive.style.color = 'var(--text)';
      btnInactive.style.boxShadow = 'var(--shadow-sm)';
      
      btnReal.classList.remove('active');
      btnReal.style.background = 'transparent';
      btnReal.style.color = 'var(--text-muted)';
      btnReal.style.boxShadow = 'none';
      
      renderStageTimeChart(active, now, 'inactive');
    });
    
    btnReal.addEventListener('click', () => {
      btnReal.classList.add('active');
      btnReal.style.background = 'var(--bg-card)';
      btnReal.style.color = 'var(--text)';
      btnReal.style.boxShadow = 'var(--shadow-sm)';
      
      btnInactive.classList.remove('active');
      btnInactive.style.background = 'transparent';
      btnInactive.style.color = 'var(--text-muted)';
      btnInactive.style.boxShadow = 'none';
      
      renderStageTimeChart(active, now, 'real');
    });
  }

  // ── Global Search ──
  initGlobalSearch(tasks);
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL SEARCH
══════════════════════════════════════════════════════════════ */
function initGlobalSearch(tasks) {
  const searchInput = document.getElementById('global-search');
  const resultsContainer = document.getElementById('global-search-results');
  
  if (!searchInput || !resultsContainer) return;

  function performSearch() {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      resultsContainer.classList.remove('active');
      return;
    }

    const matched = tasks.filter(t => 
      (t.title && t.title.toLowerCase().includes(query)) ||
      (t.responsible && t.responsible.toLowerCase().includes(query))
    ).slice(0, 8); // limit to top 8 results

    if (matched.length === 0) {
      resultsContainer.innerHTML = '<div class="search-result-empty">Nenhum projeto encontrado.</div>';
    } else {
      resultsContainer.innerHTML = matched.map(t => {
        const bdg = getStatusBadge(t.status);
        return `
          <div class="search-result-item" onclick="alert('Projeto: ${t.title}\\nStatus: ${t.status}\\nResponsável: ${t.responsible}')">
            <div class="search-result-title">${t.title}</div>
            <div class="search-result-meta">
              <span class="badge ${bdg}">${t.status}</span>
              <span>👤 ${t.responsible}</span>
              <span>📅 Criado em ${formatDate(t.created_at)}</span>
            </div>
          </div>
        `;
      }).join('');
    }
    
    resultsContainer.classList.add('active');
  }

  // Event Listeners
  searchInput.addEventListener('input', performSearch);
  
  // Close results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#global-search-wrap')) {
      resultsContainer.classList.remove('active');
    }
  });

  // Focus input when pressing '/'
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput && !document.activeElement.matches('input, textarea')) {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

/* ══════════════════════════════════════════════════════════════
   CHARTS
══════════════════════════════════════════════════════════════ */
function renderStatusChart(tasks) {
  const counts = {};
  tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  
  const labels = Object.keys(counts);
  const data = Object.values(counts);
  const colors = labels.map(l => STAGE_COLORS[l] || '#94a3b8');

  new Chart(document.getElementById('chart-status'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      cutout: '70%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, padding: 10, font: { size: 11, family: "'DM Sans'" } } }
      }
    }
  });
}

function renderResponsibleChart(active) {
  const counts = {};
  active.forEach(t => { counts[t.responsible] = (counts[t.responsible] || 0) + 1; });

  new Chart(document.getElementById('chart-responsible'), {
    type: 'bar',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        label: 'Projetos Ativos',
        data: Object.values(counts),
        backgroundColor: '#002966',
        borderRadius: 6,
        barThickness: 32,
      }]
    },
    options: {
      responsive: true,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
        y: { grid: { display: false }, ticks: { font: { size: 12, family: "'DM Sans'", weight: '600' } } }
      }
    }
  });
}

let stageTimeChartInstance = null;

function renderStageTimeChart(active, now, mode = 'inactive') {
  const stageDays = {};
  const stageCounts = {};
  
  active.forEach(t => {
    // Determine which date to use based on mode
    let targetDate = t.updated_at;
    if (mode === 'real' && t.stage_entered_at) {
      targetDate = t.stage_entered_at;
    }
    
    const days = daysBetween(new Date(targetDate), now);
    stageDays[t.status] = (stageDays[t.status] || 0) + days;
    stageCounts[t.status] = (stageCounts[t.status] || 0) + 1;
  });

  const labels = STAGES_ORDER.filter(s => stageCounts[s]);
  const data = labels.map(s => Math.round(stageDays[s] / stageCounts[s]));
  const colors = labels.map(s => STAGE_COLORS[s]);

  const ctx = document.getElementById('chart-stage-time');
  
  if (stageTimeChartInstance) {
    stageTimeChartInstance.data.labels = labels.map(l => l.length > 20 ? l.slice(0, 18) + '…' : l);
    stageTimeChartInstance.data.datasets[0].data = data;
    stageTimeChartInstance.data.datasets[0].backgroundColor = colors;
    stageTimeChartInstance.data.datasets[0].label = mode === 'real' ? 'Permanência Real' : 'Tempo Inativo';
    stageTimeChartInstance.update();
  } else {
    stageTimeChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(l => l.length > 20 ? l.slice(0, 18) + '…' : l),
        datasets: [{
          label: mode === 'real' ? 'Permanência Real' : 'Tempo Inativo',
          data,
          backgroundColor: colors,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        plugins: { 
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw} dias (${ctx.dataset.label})`
            }
          }
        },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
          x: { ticks: { maxRotation: 45, font: { size: 10 } }, grid: { display: false } }
        }
      }
    });
  }
}

function renderBottleneckChart(active) {
  const counts = {};
  STAGES_ORDER.forEach(s => { counts[s] = 0; });
  active.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  const labels = STAGES_ORDER;
  const data = labels.map(s => counts[s]);
  const max = Math.max(...data);
  const colors = data.map(d => d === max && d > 0 ? '#ef4444' : '#002966');

  new Chart(document.getElementById('chart-bottleneck'), {
    type: 'bar',
    data: {
      labels: labels.map(l => l.length > 18 ? l.slice(0, 16) + '…' : l),
      datasets: [{
        label: 'Projetos',
        data,
        backgroundColor: colors,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f1f5f9' } },
        x: { ticks: { maxRotation: 45, font: { size: 10 } }, grid: { display: false } }
      }
    }
  });
}



/* ══════════════════════════════════════════════════════════════
   PIPELINE BAR
══════════════════════════════════════════════════════════════ */
function renderPipeline(active) {
  const counts = {};
  STAGES_ORDER.forEach(s => { counts[s] = 0; });
  active.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });

  const total = active.length || 1;
  const bar = document.getElementById('pipeline-bar');
  const legend = document.getElementById('pipeline-legend');

  bar.innerHTML = STAGES_ORDER.map(s => {
    const pct = (counts[s] / total) * 100;
    if (pct === 0) return '';
    return `<div class="pipeline-segment" style="flex:${pct};background:${STAGE_COLORS[s]}" title="${s}: ${counts[s]}">${counts[s] > 0 ? counts[s] : ''}</div>`;
  }).join('');

  legend.innerHTML = STAGES_ORDER.filter(s => counts[s] > 0).map(s =>
    `<div class="pipeline-legend-item">
      <div class="legend-dot" style="background:${STAGE_COLORS[s]}"></div>
      ${s} <span class="legend-count">(${counts[s]})</span>
    </div>`
  ).join('');
}

/* ══════════════════════════════════════════════════════════════
   STALLED TABLE
══════════════════════════════════════════════════════════════ */
function populateResponsibleFilters(tasks) {
  const people = [...new Set(tasks.map(t => t.responsible))];
  const sel = document.getElementById('filter-stalled-responsible');
  people.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

function renderStalledTable(active, now) {
  const minDays = parseInt(document.getElementById('filter-stalled-days').value, 10);
  const filterResp = document.getElementById('filter-stalled-responsible').value;

  let stalled = active.map(t => ({
    ...t,
    daysStopped: daysBetween(new Date(t.updated_at), now)
  })).filter(t => t.daysStopped >= minDays);

  if (filterResp) stalled = stalled.filter(t => t.responsible === filterResp);
  stalled.sort((a, b) => b.daysStopped - a.daysStopped);

  // Badge count
  const totalStalled10 = active.filter(t => daysBetween(new Date(t.updated_at), now) >= 10).length;
  document.getElementById('stalled-count-badge').textContent = totalStalled10;

  const tbody = document.getElementById('stalled-tbody');
  if (stalled.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><p>Nenhum projeto parado há ≥ ${minDays} dias 🎉</p></td></tr>`;
    return;
  }

  tbody.innerHTML = stalled.map(t => {
    let daysClass = 'ok';
    let urgencyColor = '#10b981';
    let urgencyWidth = 20;
    if (t.daysStopped >= 20) { daysClass = 'critical'; urgencyColor = '#ef4444'; urgencyWidth = 100; }
    else if (t.daysStopped >= 10) { daysClass = 'warning'; urgencyColor = '#f59e0b'; urgencyWidth = 60; }

    const deadlineHtml = getDeadlineHtml(t.deadline, now);

    return `<tr>
      <td><span class="task-id">#${t.id}</span></td>
      <td class="task-title-cell">${t.title}</td>
      <td><div class="responsible-cell"><span class="avatar-sm">${initials(t.responsible)}</span>${t.responsible}</div></td>
      <td><span class="badge ${getStatusBadge(t.status)}">${t.status}</span></td>
      <td>
        <div class="days-pill ${daysClass}">${t.daysStopped} dias</div>
        <div class="urgency-bar"><div class="urgency-fill" style="width:${urgencyWidth}%;background:${urgencyColor}"></div></div>
      </td>
      <td>${deadlineHtml}</td>
      <td>${formatDate(t.updated_at)}</td>
    </tr>`;
  }).join('');
}

function getDeadlineHtml(deadline, now) {
  if (!deadline) return '<span class="deadline-badge ok">—</span>';
  const d = new Date(deadline);
  const diff = daysBetween(now, d);
  if (d < now) return `<span class="deadline-badge overdue">⚠ ${diff}d atrás</span>`;
  if (diff <= 7) return `<span class="deadline-badge soon">⏰ ${diff}d</span>`;
  return `<span class="deadline-badge ok">${formatDate(deadline)}</span>`;
}

function renderApprovedTab(tasks, now) {
  const selectedMonth = parseInt(document.getElementById('filter-approved-month').value, 10);
  const selectedYear = parseInt(document.getElementById('filter-approved-year').value, 10);

  // 1. Filtrar projetos que foram aprovados (entraram em 'Solicitar vistoria') no mês selecionado
  const monthlyApproved = tasks.filter(t => {
    if (!t.approved_at) return false;
    const appDate = new Date(t.approved_at);
    // getMonth() retorna 0-11, então somamos 1
    return (appDate.getMonth() + 1) === selectedMonth && appDate.getFullYear() === selectedYear;
  });

  // Atualiza o KPI de Aprovados no Mês
  animateVal(document.getElementById('approved-month-total'), monthlyApproved.length);

  // 2. Outros KPIs mostram o BACKLOG ATUAL nas etapas finais do pipeline (não filtrado por mês)
  animateVal(document.getElementById('approved-enviados'), tasks.filter(t => t.status === 'Projeto enviado').length);
  animateVal(document.getElementById('approved-solicitar'), tasks.filter(t => t.status === 'Solicitar vistoria').length);
  animateVal(document.getElementById('approved-realizando'), tasks.filter(t => t.status === 'Realizando vistoria').length);
  animateVal(document.getElementById('approved-reprovada'), tasks.filter(t => t.status === 'Vistoria reprovada').length);

  const tbody = document.getElementById('approved-tbody');
  if (monthlyApproved.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state"><p>Nenhum projeto aprovado no período de ${selectedMonth}/${selectedYear} 🗓️</p></td></tr>`;
    return;
  }

  // Ordena por data de aprovação decrescente
  monthlyApproved.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));

  tbody.innerHTML = monthlyApproved.map(t => `<tr>
    <td><span class="task-id">#${t.id}</span></td>
    <td class="task-title-cell">${t.title}</td>
    <td><div class="responsible-cell"><span class="avatar-sm">${initials(t.responsible)}</span>${t.responsible}</div></td>
    <td><span class="badge ${getStatusBadge(t.status)}">${t.status}</span></td>
    <td><strong>${formatDate(t.approved_at)}</strong></td>
    <td>${getDeadlineHtml(t.deadline, now)}</td>
  </tr>`).join('');
}

/* ══════════════════════════════════════════════════════════════
   COMMENTS
══════════════════════════════════════════════════════════════ */
function renderComments(tasks) {
  const searchVal = (document.getElementById('filter-comment-search').value || '').toLowerCase();
  
  let allComments = [];
  tasks.forEach(t => {
    if (t.comments) {
      t.comments.forEach(c => {
        allComments.push({ ...c, taskId: t.id, taskTitle: t.title });
      });
    }
  });

  allComments.sort((a, b) => new Date(b.date) - new Date(a.date));

  if (searchVal) {
    allComments = allComments.filter(c =>
      c.taskTitle.toLowerCase().includes(searchVal) ||
      c.author.toLowerCase().includes(searchVal) ||
      c.text.toLowerCase().includes(searchVal)
    );
  }

  const feed = document.getElementById('comments-feed');
  if (allComments.length === 0) {
    feed.innerHTML = '<div class="empty-state"><p>Nenhum comentário encontrado.</p></div>';
    return;
  }

  feed.innerHTML = allComments.slice(0, 20).map(c => {
    const avatarColors = ['#002966', '#2563eb', '#7c3aed', '#0891b2', '#059669'];
    const colorIdx = c.author.length % avatarColors.length;
    return `<div class="comment-card">
      <div class="comment-avatar" style="background:${avatarColors[colorIdx]}">${initials(c.author)}</div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-author">${c.author}</span>
          <span class="comment-date">${formatDateTime(c.date)}</span>
        </div>
        <div class="comment-text">${c.text}</div>
        <span class="comment-task-tag">#${c.taskId} — ${c.taskTitle}</span>
      </div>
    </div>`;
  }).join('');
}



/* ══════════════════════════════════════════════════════════════
   INSIGHTS / ALERTS
══════════════════════════════════════════════════════════════ */
function renderInsights(tasks, active, done, problems, overdue, now, avgCycle, inspRate) {
  const insights = [];

  // ── Bottleneck detection ──
  const stageCounts = {};
  active.forEach(t => { stageCounts[t.status] = (stageCounts[t.status] || 0) + 1; });
  const maxStage = Object.entries(stageCounts).sort((a, b) => b[1] - a[1])[0];
  if (maxStage && maxStage[1] >= 3) {
    insights.push({
      type: 'warning',
      icon: '⚠️',
      title: `Gargalo detectado: "${maxStage[0]}"`,
      desc: `${maxStage[1]} projetos acumulados nesta etapa. Considere priorizar a resolução desta fase.`
    });
  }

  // ── Overdue projects ──
  if (overdue.length > 0) {
    insights.push({
      type: 'danger',
      icon: '🔴',
      title: `${overdue.length} projeto(s) com prazo vencido`,
      desc: `Projetos: ${overdue.map(t => t.title).join(', ')}. Atenção urgente necessária.`
    });
  }

  // ── Stalled critical ──
  const criticalStalled = active.filter(t => daysBetween(new Date(t.updated_at), now) >= 20);
  if (criticalStalled.length > 0) {
    insights.push({
      type: 'danger',
      icon: '🚨',
      title: `${criticalStalled.length} projeto(s) parado(s) há mais de 20 dias`,
      desc: `${criticalStalled.map(t => `"${t.title}" (${daysBetween(new Date(t.updated_at), now)}d)`).join('; ')}.`
    });
  }

  // ── Client debt ──
  const debtProjects = active.filter(t => t.status === 'Clientes com débito');
  if (debtProjects.length > 0) {
    insights.push({
      type: 'warning',
      icon: '💰',
      title: `${debtProjects.length} projeto(s) bloqueado(s) por débito do cliente`,
      desc: `Pipeline travado até regularização financeira. Projetos: ${debtProjects.map(t => t.title).join(', ')}.`
    });
  }

  // ── Rejected inspections ──
  const rejected = tasks.filter(t => t.status === 'Vistoria reprovada');
  if (rejected.length > 0) {
    insights.push({
      type: 'danger',
      icon: '❌',
      title: `${rejected.length} vistoria(s) reprovada(s)`,
      desc: `Necessária correção e nova solicitação. Taxa de aprovação: ${inspRate}%.`
    });
  }

  // ── Good news ──
  if (done.length > 0) {
    insights.push({
      type: 'success',
      icon: '🎉',
      title: `${done.length} projetos concluídos com sucesso`,
      desc: `Ciclo médio de conclusão: ${avgCycle} dias. Continue o bom trabalho!`
    });
  }

  // ── Workload alert ──
  const respCounts = {};
  active.forEach(t => { respCounts[t.responsible] = (respCounts[t.responsible] || 0) + 1; });
  Object.entries(respCounts).forEach(([name, count]) => {
    if (count >= 6) {
      insights.push({
        type: 'warning',
        icon: '👤',
        title: `${name} está com ${count} projetos ativos`,
        desc: `Carga de trabalho acima da média. Considere redistribuir projetos.`
      });
    }
  });

  // ── Projects without comments ──
  const noComments = active.filter(t => !t.comments || t.comments.length === 0);
  if (noComments.length > 0) {
    insights.push({
      type: 'info',
      icon: '💬',
      title: `${noComments.length} projeto(s) ativo(s) sem nenhum comentário`,
      desc: `Projetos sem registro de atividade: ${noComments.map(t => t.title).join(', ')}.`
    });
  }

  // ── SLA ANEEL Vistoria ──
  const inInspection = active.filter(t => ['Solicitar vistoria', 'Realizando vistoria'].includes(t.status));
  inInspection.forEach(t => {
    const daysInStage = daysBetween(new Date(t.updated_at), now);
    if (daysInStage > 20) {
      insights.push({
        type: 'warning',
        icon: '⏰',
        title: `SLA ANEEL: "${t.title}" em vistoria há ${daysInStage} dias`,
        desc: `ANEEL determina prazo de 30 dias para vistoria e conexão (micro/minigeração). Restam ~${Math.max(0, 30 - daysInStage)} dias.`
      });
    }
  });

  // Badge count
  const alertCount = insights.filter(i => i.type === 'danger' || i.type === 'warning').length;
  document.getElementById('alerts-count-badge').textContent = alertCount;

  // Render
  const container = document.getElementById('insights-container');
  if (insights.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Nenhum alerta no momento. Tudo parece ok! 🎉</p></div>';
    return;
  }

  container.innerHTML = insights.map(i => `
    <div class="insight-card ${i.type}">
      <div class="insight-icon">${i.icon}</div>
      <div>
        <div class="insight-title">${i.title}</div>
        <div class="insight-desc">${i.desc}</div>
      </div>
    </div>
  `).join('');
}
