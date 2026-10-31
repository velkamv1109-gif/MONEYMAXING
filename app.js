
(()=>{
'use strict';

const ITERATIONS = 310000;
const CATEGORIES = [
  ['comida', 'Comida & Despensa'],
  ['vivienda', 'Vivienda & Servicios'],
  ['transporte', 'Transporte & Movilidad'],
  ['salud', 'Salud & Gastos Médicos'],
  ['ocio', 'Ocio & Calidad de Vida'],
  ['negocio', 'Gastos Operativos / Negocio'],
  ['inmobiliario', 'Bienes Raíces & Inversiones'],
  ['impuestos', 'Impuestos & SAT'],
  ['seguros', 'Seguros & Protección'],
  ['ahorro', 'Inversión & Retiro'],
  ['otros', 'Otros Flujos']
];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const modalOpeners = new Map();
function openModal(selector) { modalOpeners.set(selector,document.activeElement); $(selector).classList.remove('hidden'); }
function closeModal(selector) { $(selector).classList.add('hidden'); const opener=modalOpeners.get(selector); if(opener?.getClientRects().length) opener.focus(); }

let key = null;
let data = null;
let vaultSalt = null;
let vaultRevision = 0;
let lockTimer = null;
let toastTimer = null;
let failedAttempts = 0;
let lockoutCountdown = null;
let wizardSelectedRole = 'master';
let audioCtx = null;
let committedData = null;
let saving = false;
let gateBusy = false;
let activeIterations = ITERATIONS;
let editingTxId = null;
let editingClientId = null;
let editingPropertyId = null;
let initialWizard = false;
let proposalClient = null;

// Sonido háptico
function playHaptic(type = 'click') {
  if (data?.globalSettings?.soundEnabled === false) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';

    if (type === 'unlock') {
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } else if (type === 'save') {
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(1174.66, audioCtx.currentTime + 0.15); // D6
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } else {
      osc.frequency.setValueAtTime(950, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    }
  } catch {}
}

function money(amount, currency = null) {
  const cur = currency || (data?.globalSettings?.currency) || 'MXN';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthId() {
  return localToday().slice(0, 7);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Bóveda por defecto
function defaultVaultData() {
  const initialId = 'prof_' + crypto.randomUUID().slice(0, 8);
  return {
    version: 2,
    activeProfileId: initialId,
    globalSettings: {
      theme: 'obsidian',
      accent: 'emerald',
      paneAnim: 'smooth',
      currency: 'MXN',
      autoLockMinutes: 5,
      soundEnabled: false,
      businessName: '',
      advisorName: '',
      advisorPhone: '',
      advisorEmail: ''
    },
    profiles: [
      {
        id: initialId,
        name: 'Principal',
        role: 'master',
        currency: 'MXN',
        initialBalance: 0,
        transactions: [],
        budgets: Object.fromEntries(CATEGORIES.map(([id]) => [id, 0])),
        savingsGoals: [],
        realEstateProperties: [],
        insuranceClients: [],
        receivables: [],
        payables: []
      }
    ]
  };
}

function migrateLegacyData(loaded) {
  if (!loaded || typeof loaded !== 'object' || (loaded.version && ![1,2].includes(loaded.version))) throw new Error('Versión de bóveda no compatible.');
  if (loaded.version >= 2 && Array.isArray(loaded.profiles)) {
    loaded.globalSettings = loaded.globalSettings || {};
    loaded.globalSettings.theme = loaded.globalSettings.theme || 'obsidian';
    loaded.globalSettings.accent = loaded.globalSettings.accent || 'emerald';
    loaded.globalSettings.paneAnim = loaded.globalSettings.paneAnim || 'smooth';
    loaded.globalSettings.soundEnabled = loaded.globalSettings.soundEnabled !== false;
    loaded.profiles.forEach(p => {
      for (const field of ['transactions','realEstateProperties','insuranceClients','savingsGoals','receivables','payables']) p[field] = p[field] || [];
    });
    return loaded;
  }
  const id = 'prof_legacy';
  const legacyTransactions = (loaded.transactions || []).map(t => ({
    ...t,
    taxKind: 'none',
    taxAmount: 0
  }));
  const legacyBudgets = loaded.budgets || Object.fromEntries(CATEGORIES.map(([c]) => [c, 0]));

  return {
    version: 2,
    activeProfileId: id,
    globalSettings: {
      theme: 'obsidian',
      accent: 'emerald',
      paneAnim: 'smooth',
      currency: loaded.currency || 'MXN',
      autoLockMinutes: 5,
      soundEnabled: true,
      businessName: 'MONEYMAXING Wealth Advisory',
      advisorName: '',
      advisorPhone: '',
      advisorEmail: ''
    },
    profiles: [
      {
        id: id,
        name: 'Principal',
        role: 'master',
        currency: loaded.currency || 'MXN',
        initialBalance: loaded.initialBalance || 0,
        transactions: legacyTransactions,
        budgets: legacyBudgets,
        savingsGoals: [],
        realEstateProperties: [],
        insuranceClients: [],
        receivables: [],
        payables: []
      }
    ]
  };
}

function getActiveProfile() {
  if (!data || !data.profiles) return null;
  let p = data.profiles.find(x => x.id === data.activeProfileId);
  if (!p && data.profiles.length > 0) {
    p = data.profiles[0];
    data.activeProfileId = p.id;
  }
  return p;
}

// Criptografía
function bytesToB64(bytes) { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); }
function b64ToBytes(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)); }

async function derive(password, salt, iterations = activeIterations) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function loadVault() {
  const res = await fetch('/api/vault', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('No se pudo conectar a la bóveda.');
  return res.json();
}

async function storeVault({ create = false } = {}) {
  if (saving) throw new Error('Espera a que termine el guardado.');
  if (!key || !data || !vaultSalt) throw new Error('Bóveda bloqueada.');
  saving = true;
  document.body.setAttribute('aria-busy', 'true');
  $('#save-status').textContent = 'Guardando…';
  const controls = [...document.querySelectorAll('button,input,select,textarea')].filter(el => !el.disabled);
  controls.forEach(el => el.disabled = true);
  try {
    Finance.validate(data);
    const snapshot = JSON.stringify(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, new TextEncoder().encode(snapshot));
    const record = {version:1, iterations:activeIterations, salt:bytesToB64(vaultSalt), iv:bytesToB64(iv), ciphertext:bytesToB64(new Uint8Array(encrypted))};
    const headers = {'Content-Type':'application/json'};
    if (!create) headers['If-Match'] = String(vaultRevision);
    let result;
    try {
      const res = await fetch('/api/vault', {method:create ? 'POST':'PUT',headers,body:JSON.stringify(record),signal:AbortSignal.timeout(15000)});
      result = await res.json();
      if (!res.ok) throw new Error(res.status === 409 ? 'Otro dispositivo modificó la bóveda. Bloquea y vuelve a abrir antes de reintentar.' : 'No se pudo guardar. Revisa la conexión y reintenta.');
    } catch (error) {
      // A response can be lost after a successful write. Reconcile before allowing a retry.
      const current = await loadVault().catch(() => null);
      if (current?.vault?.ciphertext === record.ciphertext) result = current;
      else throw new Error(error.name === 'TypeError' || error.name === 'TimeoutError' ? 'No se pudo guardar. Revisa la conexión y reintenta.' : error.message);
    }
    vaultRevision = result.revision;
    committedData = JSON.parse(snapshot);
    $('#save-status').textContent = 'Guardado';
  } catch (error) {
    if (committedData) data = structuredClone(committedData);
    $('#save-status').textContent = 'No guardado · reintenta';
    toast(error.message || 'No se pudo guardar. Revisa la conexión y reintenta.');
    if (data) render();
    throw error;
  } finally {
    saving = false;
    document.body.removeAttribute('aria-busy');
    controls.forEach(el => el.disabled = false);
    resetLockTimer();
  }
}

// Puerta de Acceso
async function gateMode() {
  try {
    const stored = await loadVault();
    vaultRevision = stored.revision;
    const exists = Boolean(stored.vault);
    $('#gate-title').innerHTML = exists ? 'Bienvenido<br>de vuelta.' : 'Tus finanzas,<br>en orden.';
    $('#gate-copy').textContent = exists
      ? 'Desbloquea tu bóveda personal, inmobiliaria y patrimonial.'
      : 'Crea tu bóveda con cifrado local.';
    $('#password-label').textContent = exists ? 'Contraseña maestra' : 'Crea tu contraseña maestra';
    $('#confirm-field').classList.toggle('hidden', exists);
    $('#gate-confirm').required = !exists;
    $('#gate-submit').textContent = exists ? 'Desbloquear Bóveda' : 'Crear Bóveda Cifrada';
    $('#gate-submit').disabled = false;
    $('#gate-error').textContent = '';
  } catch {
    $('#gate-title').innerHTML = 'Conecta tu<br>PC principal.';
    $('#gate-copy').textContent = 'El servidor local de MONEYMAXING no responde.';
    $('#confirm-field').classList.add('hidden');
    $('#gate-submit').disabled = true;
    $('#gate-error').textContent = 'Servicio no disponible.';
  }
}

function handleBruteForceFailure() {
  failedAttempts++;
  if (failedAttempts >= 3) {
    const delay = failedAttempts === 3 ? 5 : failedAttempts === 4 ? 12 : 30;
    triggerLockout(delay);
  }
}

function triggerLockout(seconds) {
  let remaining = seconds;
  $('#gate-lockout').classList.remove('hidden');
  $('#gate-submit').disabled = true;
  $('#gate-password').disabled = true;
  $('#lockout-seconds').textContent = remaining;

  clearInterval(lockoutCountdown);
  lockoutCountdown = setInterval(() => {
    remaining--;
    $('#lockout-seconds').textContent = remaining;
    if (remaining <= 0) {
      clearInterval(lockoutCountdown);
      $('#gate-lockout').classList.add('hidden');
      $('#gate-submit').disabled = false;
      $('#gate-password').disabled = false;
      $('#gate-password').focus();
    }
  }, 1000);
}

function lock() {
  if (saving) { toast('Espera a que termine el guardado.'); return; }
  QuotationUI.clear();
  proposalClient = null;
  committedData = null;
  $$('.modal-backdrop').forEach(el => el.classList.add('hidden'));
  clearTimeout(lockTimer);
  key = null;
  data = null;
  vaultSalt = null;
  vaultRevision = 0;
  $('#app').classList.add('hidden');
  $('#gate').classList.remove('hidden');
  $('#gate-form').reset();
  $('#gate-error').textContent = '';
  gateMode();
  $('#gate-password').focus();
}

function resetLockTimer() {
  clearTimeout(lockTimer);
  const minutes = Number(data?.globalSettings?.autoLockMinutes) || 5;
  if (key) lockTimer = setTimeout(lock, minutes * 60 * 1000);
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function applyAppearance() {
  const theme = data?.globalSettings?.theme || 'obsidian';
  const accent = data?.globalSettings?.accent || 'emerald';
  const paneAnim = data?.globalSettings?.paneAnim || 'smooth';

  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-accent', accent);
  document.documentElement.setAttribute('data-pane-anim', paneAnim);

  $$('.theme-picker-btn').forEach(b => b.classList.toggle('crystal-btn-primary', b.dataset.themeVal === theme));
  $$('.swatch-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.accentVal === accent)));
}

// ==========================================
// RENDERIZADO GENERAL & LIQUID EXPERIENCE
// ==========================================
function render() {
  const profile = getActiveProfile();
  if (!profile) return;

  applyAppearance();

  $('#sidebar-profile-name').textContent = profile.name;
  $('#sidebar-role-badge').textContent = ({master:'General',personal:'Personal',realestate:'Inmuebles',insurance:'Seguros',accounting:'Negocio'})[profile.role] || 'Perfil';
  $('#header-today').textContent = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date()).toUpperCase();
  $('#header-month').textContent = new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(new Date()).toUpperCase();

  const txs = [...profile.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const currentMonth = monthId();
  const monthlyTxs = txs.filter(t => t.date.slice(0, 7) === currentMonth);

  const totalIncomes = txs.filter(t => t.kind === 'income').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;
  const totalExpenses = txs.filter(t => t.kind === 'expense').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;
  const balance = (Finance.cents(profile.initialBalance || 0) + Finance.cents(totalIncomes) - Finance.cents(totalExpenses)) / 100;

  const monthIncomes = monthlyTxs.filter(t => t.kind === 'income').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;
  const monthExpenses = monthlyTxs.filter(t => t.kind === 'expense').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;

  $('#dash-balance').textContent = money(balance, profile.currency);
  $('#dash-income').textContent = money(monthIncomes, profile.currency);
  $('#dash-expense').textContent = money(monthExpenses, profile.currency);

  calculateHealthScore(balance, monthIncomes, monthExpenses, profile);
  renderTrendAreaChart(txs, balance, profile.currency);
  renderDonutChart(monthlyTxs, profile.currency);
  renderTxList($('#home-tx-list'), txs.slice(0, 5), profile.currency);
  renderFullTransactions();
  renderRealEstateModule();
  renderAccounting();
  renderBreakEvenCalculator();
  renderBudgetsAndGoals();
  renderClients();
  renderRetirementSimulation();
  renderProfilesList();
}

function calculateHealthScore(balance, monthIncomes, monthExpenses, profile) {
  if (!profile.transactions.length) { $('#score-number').textContent='—'; $('#score-badge').textContent='SIN DATOS'; return; }
  let score = 55;
  const burn = monthExpenses || 1;
  const runway = balance / burn;
  if (runway >= 6) score += 20;
  else if (runway >= 3) score += 10;
  else if (runway < 1) score -= 15;

  if (monthIncomes > 0) {
    const rate = (monthIncomes - monthExpenses) / monthIncomes;
    if (rate >= 0.25) score += 15;
    else if (rate >= 0.10) score += 8;
  }

  score = Math.max(10, Math.min(100, Math.round(score)));
  $('#score-number').textContent = score;
  const ring = $('#score-ring');
  const offset = 251.2 - (251.2 * score) / 100;
  ring.style.strokeDashoffset = offset;

  const badge = $('#score-badge');
  if (score >= 85) { badge.textContent = 'ALTO'; badge.style.color = 'var(--accent-base)'; ring.style.stroke = 'var(--accent-base)'; }
  else if (score >= 65) { badge.textContent = 'ESTABLE'; badge.style.color = '#38bdf8'; ring.style.stroke = '#38bdf8'; }
  else if (score >= 45) { badge.textContent = 'ESTABLE'; badge.style.color = '#eab308'; ring.style.stroke = '#eab308'; }
  else { badge.textContent = 'VULNERABLE'; badge.style.color = '#ef4444'; ring.style.stroke = '#ef4444'; }
}

function renderTrendAreaChart(txs, currentBalance, currency) {
  const svg = $('#trend-svg');
  const tooltip = $('#trend-tooltip');
  if (!svg) return;

  const width = 800, height = 180;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

  if (txs.length < 2) {
    svg.innerHTML = `<text x="${width/2}" y="${height/2}" fill="var(--muted)" font-size="12" text-anchor="middle">Registra al menos 2 movimientos para ver la curva patrimonial.</text>`;
    return;
  }

  const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-15);
  let running = Finance.cents(currentBalance) - recent.reduce((s,t)=>s+(t.kind==='income'?1:-1)*Finance.cents(t.amount),0);
  const dataPoints = recent.map(t => {
    running += (t.kind === 'income' ? 1 : -1) * Finance.cents(t.amount);
    return { date: t.date, val: running / 100, note: t.note };
  });

  const minVal = Math.min(...dataPoints.map(p => p.val));
  const maxVal = Math.max(...dataPoints.map(p => p.val));
  const range = (maxVal - minVal) || 1;

  const paddingX = 40, paddingY = 25;
  const chartW = width - paddingX * 2, chartH = height - paddingY * 2;

  const coords = dataPoints.map((p, idx) => {
    const x = paddingX + (idx / (dataPoints.length - 1)) * chartW;
    const y = height - paddingY - ((p.val - minVal) / range) * chartH;
    return { x, y, data: p };
  });

  let pathD = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const cpX = (coords[i].x + coords[i + 1].x) / 2;
    pathD += ` C ${cpX} ${coords[i].y}, ${cpX} ${coords[i + 1].y}, ${coords[i + 1].x} ${coords[i + 1].y}`;
  }

  const areaD = `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

  svg.innerHTML = `
    <defs>
      <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent-base)" stop-opacity="0.35" />
        <stop offset="100%" stop-color="var(--accent-base)" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    <path d="${areaD}" fill="url(#areaGrad)" />
    <path d="${pathD}" fill="none" stroke="var(--accent-base)" stroke-width="3" stroke-linecap="round" />
    <line id="scrub-line" x1="0" y1="0" x2="0" y2="${height}" stroke="var(--line-crystal)" stroke-width="1" stroke-dasharray="3,3" opacity="0" />
    <circle id="scrub-dot" cx="0" cy="0" r="5" fill="var(--accent-base)" stroke="#ffffff" stroke-width="2" opacity="0" />
  `;

  const scrubLine = svg.querySelector('#scrub-line');
  const scrubDot = svg.querySelector('#scrub-dot');
  const box = $('#trend-chart-box');

  box.onmousemove = e => {
    const rect = box.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * (width / rect.width);

    let closest = coords[0];
    let minDist = Infinity;
    coords.forEach(pt => {
      const dist = Math.abs(pt.x - mouseX);
      if (dist < minDist) { minDist = dist; closest = pt; }
    });

    scrubLine.setAttribute('x1', closest.x);
    scrubLine.setAttribute('x2', closest.x);
    scrubLine.setAttribute('opacity', '1');
    scrubDot.setAttribute('cx', closest.x);
    scrubDot.setAttribute('cy', closest.y);
    scrubDot.setAttribute('opacity', '1');

    tooltip.innerHTML = `<strong>${money(closest.data.val, currency)}</strong><br><span style="color:var(--muted);">${closest.data.date} · ${escapeHtml(closest.data.note)}</span>`;
    tooltip.classList.add('show');
    tooltip.style.left = `${(closest.x / width) * 100}%`;
    tooltip.style.top = `${closest.y - 45}px`;
    tooltip.style.transform = 'translate(-50%, 0)';

    $('#chart-scrubber-readout').textContent = `${closest.data.date}: ${money(closest.data.val, currency)}`;
  };

  box.onmouseleave = () => {
    scrubLine.setAttribute('opacity', '0');
    scrubDot.setAttribute('opacity', '0');
    tooltip.classList.remove('show');
    $('#chart-scrubber-readout').textContent = 'Interactivo';
  };
}

function renderDonutChart(monthlyTxs, currency) {
  const svg = $('#donut-svg');
  const legend = $('#donut-legend');
  if (!svg || !legend) return;

  const expenses = monthlyTxs.filter(t => t.kind === 'expense');
  const total = expenses.reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;

  if (total === 0) {
    svg.innerHTML = '<circle cx="60" cy="60" r="45" fill="transparent" stroke="var(--line)" stroke-width="16"></circle>';
    $('#donut-center-pct').textContent = '0%';
    $('#donut-center-cat').textContent = 'Sin gastos';
    legend.innerHTML = '<div style="color:var(--muted);">Sin gastos registrados en el mes actual.</div>';
    return;
  }

  const catSums = {};
  $('#donut-center-pct').textContent = '100%';
  $('#donut-center-cat').textContent = 'Total de gastos';
  expenses.forEach(t => catSums[t.category] = (catSums[t.category] || 0) + t.amount);

  const colors = ['#10b981', '#38bdf8', '#f59e0b', '#a855f7', '#f43f5e', '#06b6d4', '#84cc16', '#fb923c', '#94a3b8'];
  const circumference = 2 * Math.PI * 45;

  let accumulatedAngle = 0;
  let paths = '';
  let legendHtml = '';
  let colorIdx = 0;

  for (const [catId, name] of CATEGORIES) {
    const val = catSums[catId] || 0;
    if (val > 0) {
      const pct = val / total;
      const strokeLen = pct * circumference;
      const rot = (accumulatedAngle / circumference) * 360 - 90;
      const col = colors[colorIdx % colors.length];

      paths += `
        <circle cx="60" cy="60" r="45" fill="transparent"
          stroke="${col}" stroke-width="16"
          stroke-dasharray="${strokeLen} ${circumference - strokeLen}"
          transform="rotate(${rot} 60 60)"
          data-cat="${name}" data-pct="${Math.round(pct * 100)}%"
          style="cursor:pointer;transition:all 0.25s var(--ease-spring);transform-origin:60px 60px;"
          class="donut-segment"
        ></circle>
      `;

      legendHtml += `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="display:flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${col};"></span>
            ${escapeHtml(name)}
          </span>
          <strong>${money(val, currency)} (${Math.round(pct * 100)}%)</strong>
        </div>
      `;

      accumulatedAngle += strokeLen;
      colorIdx++;
    }
  }

  svg.innerHTML = paths;
  legend.innerHTML = legendHtml;

  svg.querySelectorAll('.donut-segment').forEach(seg => {
    seg.onmouseenter = () => {
      seg.setAttribute('stroke-width', '22');
      playHaptic('click');
      $('#donut-center-pct').textContent = seg.dataset.pct;
      $('#donut-center-cat').textContent = seg.dataset.cat;
    };
    seg.onmouseleave = () => {
      seg.setAttribute('stroke-width', '16');
      $('#donut-center-pct').textContent = '100%';
      $('#donut-center-cat').textContent = 'Total Gastos';
    };
  });
}

function renderTxList(container, list, currency) {
  if (!list.length) {
    container.innerHTML = '<div style="padding:22px;text-align:center;color:var(--muted);font-size:12px;">Sin movimientos registrados.</div>';
    return;
  }
  container.innerHTML = list.map(t => {
    const isInc = t.kind === 'income';
    const catName = CATEGORIES.find(([id]) => id === t.category)?.[1] || (isInc ? 'Ingreso' : 'Gasto');
    const dStr = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${t.date}T12:00:00`));
    return `
      <div class="tx-item">
        <div class="crystal-gem ${isInc ? 'accent' : ''}">${isInc ? '↑' : '↓'}</div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(t.note)}</div>
          <div style="font-size:11px;color:var(--muted);">${escapeHtml(catName)} · ${dStr} ${t.taxKind && t.taxKind !== 'none' ? '· 🏛️ Fiscal' : ''}</div>
        </div>
        <div style="font-weight:800;font-size:14px;white-space:nowrap;color:${isInc ? 'var(--accent-base)' : '#f97316'};">${isInc ? '+' : '−'}${money(t.amount, currency)}</div>
        <button class="crystal-btn edit-tx-btn" data-id="${escapeHtml(t.id)}" title="Editar movimiento">Editar</button>
        <button class="crystal-btn delete-tx-btn" data-id="${escapeHtml(t.id)}" style="padding:4px 8px;font-size:11px;color:var(--muted);" title="Eliminar">✕</button>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.edit-tx-btn').forEach(btn => btn.onclick = () => {
    const t = getActiveProfile().transactions.find(t => t.id === btn.dataset.id);
    $('#quick-add-btn').click(); editingTxId = t.id;
    for (const [name,value] of Object.entries({amount:t.amount,kind:t.kind,note:t.note,date:t.date,category:t.category,tax:t.taxKind || 'none'})) $('#modal-tx-'+name).value = value;
  });
  container.querySelectorAll('.delete-tx-btn').forEach(btn => {
    btn.onclick = async () => {
      const p = getActiveProfile();
      p.transactions = p.transactions.filter(t => t.id !== btn.dataset.id);
      await storeVault();
      render();
      playHaptic('click');
      toast('Movimiento eliminado.');
    };
  });
}

function renderFullTransactions() {
  const profile = getActiveProfile();
  if (!profile) return;
  const search = $('#filter-search').value.toLowerCase().trim();
  const kind = $('#filter-kind').value;
  const cat = $('#filter-category').value;

  let filtered = [...profile.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  if (kind !== 'all') filtered = filtered.filter(t => t.kind === kind);
  if (cat !== 'all') filtered = filtered.filter(t => t.category === cat);
  if (search) filtered = filtered.filter(t => t.note.toLowerCase().includes(search));

  renderTxList($('#full-tx-list'), filtered, profile.currency);
}

// ==========================================
// MÓDULO INMOBILIARIO & BIENES RAÍCES (NUEVO)
// ==========================================
function renderRealEstateModule() {
  const price = Number($('#input-re-price').value);
  const downPct = Number($('#input-re-down').value);
  const termYears = Number($('#input-re-term').value);
  const annualRate = Number($('#input-re-rate').value) / 100;
  const extraPmt = Number($('#input-re-extra').value);

  const downAmount = price * (downPct / 100);
  const loanAmount = Math.max(0, price - downAmount);
  const months = termYears * 12;
  const monthlyRate = annualRate / 12;

  $('#label-re-price').textContent = money(price);
  $('#label-re-down').textContent = `${downPct}% (${money(downAmount)})`;
  $('#label-re-term').textContent = `${termYears} años (${months} meses)`;
  $('#label-re-rate').textContent = `${(annualRate * 100).toFixed(2)}%`;
  $('#label-re-extra').textContent = money(extraPmt);

  // Fórmula de Mensualidad Hipotecaria Francesa
  const basePmt = Finance.loanPayment(loanAmount, annualRate, months);

  // Simulación de amortización con y sin aportaciones a capital
  let balanceNormal = loanAmount;
  let totalInterestNormal = 0;
  for (let m = 0; m < months; m++) {
    const intPmt = balanceNormal * monthlyRate;
    const princPmt = basePmt - intPmt;
    totalInterestNormal += intPmt;
    balanceNormal -= princPmt;
    if (balanceNormal <= 0) break;
  }

  let balanceWithExtra = loanAmount;
  let totalInterestExtra = 0;
  let monthsWithExtra = 0;
  while (balanceWithExtra > 0 && monthsWithExtra < months) {
    monthsWithExtra++;
    const intPmt = balanceWithExtra * monthlyRate;
    const princPmt = (basePmt - intPmt) + extraPmt;
    totalInterestExtra += intPmt;
    balanceWithExtra -= princPmt;
  }

  const interestSaved = Math.max(0, totalInterestNormal - totalInterestExtra);
  const yearsReduced = ((months - monthsWithExtra) / 12).toFixed(1);

  $('#re-monthly-payment').textContent = money(basePmt);
  $('#re-loan-amount').textContent = money(loanAmount);
  $('#re-total-interest').textContent = money(totalInterestNormal);
  $('#re-interest-saved').textContent = money(interestSaved);
  $('#re-time-reduced').textContent = `${yearsReduced} años menos (${months - monthsWithExtra} meses)`;

  // Calculadora de Rentabilidad (Cap Rate & Yield)
  renderCapRateCalculation();
  renderPropertiesList();
}

function renderCapRateCalculation() {
  const buyPrice = Number($('#roi-price').value) || 1;
  const rent = Number($('#roi-rent').value) || 0;
  const closing = Number($('#roi-closing').value) || 0;
  const expenses = Number($('#roi-expenses').value) || 0;

  const totalInvested = buyPrice + closing;
  const grossAnnualRent = rent * 12;
  const netOperatingIncome = Math.max(0, grossAnnualRent - expenses);

  const capRate = ((netOperatingIncome / totalInvested) * 100).toFixed(2);
  $('#roi-caprate-res').textContent = `${capRate}%`;
  $('#roi-net-cash').textContent = money(netOperatingIncome);
}

function renderPropertiesList() {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.realEstateProperties = profile.realEstateProperties || [];

  const list = $('#re-properties-list');
  $('#re-properties-count').textContent = `${profile.realEstateProperties.length} propiedades`;

  if (!profile.realEstateProperties.length) {
    list.innerHTML = '<div style="padding:18px;color:var(--muted);font-size:12px;text-align:center;">Sin inmuebles en cartera. Usa “+ Nueva Propiedad”.</div>';
    return;
  }

  list.innerHTML = profile.realEstateProperties.map((p, i) => {
    const commAmount = (p.price * (p.commissionPct || 5)) / 100;
    return `
      <div class="tx-item">
        <div class="crystal-gem accent">🏠</div>
        <div style="min-width:0;">
          <div style="font-weight:750;font-size:13px;">${escapeHtml(p.title)}</div>
          <div style="font-size:11px;color:var(--muted);">${p.opType} · ${escapeHtml(p.client || 'Cliente')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-weight:800;color:var(--ink);">${money(p.price, profile.currency)}</div>
          <div style="font-size:10px;color:var(--accent-base);">Comisión: ${money(commAmount, profile.currency)} (${p.commissionPct}%)</div>
        </div>
        <button class="crystal-btn delete-prop-btn" data-index="${i}" style="padding:4px 8px;font-size:11px;color:#ef4444;">✕</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.delete-prop-btn').forEach(btn => {
    btn.onclick = async () => {
      profile.realEstateProperties.splice(Number(btn.dataset.index), 1);
      await storeVault();
      render();
      playHaptic('click');
      toast('Propiedad eliminada.');
    };
  });
}

// Calculadora de Punto de Equilibrio (Break-Even)
function renderBreakEvenCalculator() {
  const fixed = Number($('#be-fixed').value) || 0;
  const price = Number($('#be-price').value) || 1;
  const cost = Number($('#be-cost').value) || 0;

  if (price <= cost || price <= 0 || fixed < 0 || cost < 0) { $('#be-units-res').textContent = 'Sin punto de equilibrio'; $('#be-revenue-res').textContent = 'El precio debe superar el costo variable.'; return; }
  const marginPerUnit = price - cost;
  const unitsNeeded = Math.ceil(fixed / marginPerUnit);
  const revenueNeeded = unitsNeeded * price;

  $('#be-units-res').textContent = `${unitsNeeded} unidades / ventas`;
  $('#be-revenue-res').textContent = money(revenueNeeded);
}

// Contabilidad & P&L
function renderAccounting() {
  const profile = getActiveProfile();
  if (!profile) return;

  const currentMonth = monthId();
  const monthlyTxs = profile.transactions.filter(t => t.date.slice(0, 7) === currentMonth);

  const grossIncomes = monthlyTxs.filter(t => t.kind === 'income').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;
  const deductibleExpenses = monthlyTxs.filter(t => t.kind === 'expense').reduce((s, t) => s + Finance.cents(t.amount), 0) / 100;

  let taxEstimated = 0;
  monthlyTxs.forEach(t => {
    if (t.taxKind === 'vat16') taxEstimated += (t.amount * 0.16) / 1.16;
    if (t.taxKind === 'retention') taxEstimated += t.amount * 0.10;
  });

  const netProfit = grossIncomes - deductibleExpenses;

  $('#pnl-gross-income').textContent = money(grossIncomes, profile.currency);
  $('#pnl-deductible-expenses').textContent = money(deductibleExpenses, profile.currency);
  $('#pnl-tax-estimated').textContent = money(taxEstimated, profile.currency);
  $('#pnl-net-profit').textContent = money(netProfit, profile.currency);

  const tbody = $('#pnl-table-body');
  const catSpend = {};
  monthlyTxs.filter(t => t.kind === 'expense').forEach(t => catSpend[t.category] = (catSpend[t.category] || 0) + t.amount);

  let rowsHtml = `
    <tr style="border-bottom:1px solid var(--line);">
      <td style="padding:10px 12px;"><strong>(+) Ingresos Brutos Totales</strong></td>
      <td style="padding:10px 12px;"><strong>${money(grossIncomes, profile.currency)}</strong></td>
      <td style="padding:10px 12px;">100.0%</td>
      <td style="padding:10px 12px;color:var(--accent-base);">Ingresos registrados</td>
    </tr>
  `;

  for (const [id, name] of CATEGORIES) {
    const val = catSpend[id] || 0;
    if (val > 0) {
      const pct = grossIncomes > 0 ? ((val / grossIncomes) * 100).toFixed(1) : '0.0';
      rowsHtml += `
        <tr style="border-bottom:1px solid var(--line);">
          <td style="padding:10px 12px;">(-) ${escapeHtml(name)}</td>
          <td style="padding:10px 12px;">${money(val, profile.currency)}</td>
          <td style="padding:10px 12px;">${pct}%</td>
          <td style="padding:10px 12px;color:var(--muted);">Gasto registrado</td>
        </tr>
      `;
    }
  }

  rowsHtml += `
    <tr style="font-weight:800;background:var(--bg-card-hover);">
      <td style="padding:12px;">(=) RESULTADO DE MOVIMIENTOS</td>
      <td style="padding:12px;color:${netProfit >= 0 ? 'var(--accent-base)' : '#f97316'};">${money(netProfit, profile.currency)}</td>
      <td style="padding:12px;">${grossIncomes > 0 ? ((netProfit / grossIncomes) * 100).toFixed(1) : '0.0'}%</td>
      <td style="padding:12px;color:var(--accent-base);">Resultado Neto</td>
    </tr>
  `;
  tbody.innerHTML = rowsHtml;

  renderDebtsLists();
}

function renderDebtsLists() {
  const profile = getActiveProfile();
  if (!profile) return;

  const recList = $('#receivables-list');
  const recs = profile.receivables || [];
  recList.innerHTML = recs.length ? recs.map((r, i) => `
    <div class="tx-item">
      <div class="crystal-gem accent">📥</div>
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:13px;">${escapeHtml(r.entity)}</div>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(r.concept || 'Factura')} · Vence: ${escapeHtml(r.dueDate)}</div>
      </div>
      <div style="font-weight:800;color:var(--accent-base);">${money(r.amount, profile.currency)}</div>
      <button class="crystal-btn delete-rec-btn" data-index="${i}" style="padding:4px 8px;font-size:11px;">✕</button>
    </div>
  `).join('') : '<div style="padding:16px;color:var(--muted);font-size:12px;">Sin cuentas por cobrar.</div>';

  recList.querySelectorAll('.delete-rec-btn').forEach(btn => {
    btn.onclick = async () => {
      profile.receivables.splice(Number(btn.dataset.index), 1);
      await storeVault();
      render();
      toast('Cuenta eliminada. No se registró un cobro.');
    };
  });

  const payList = $('#payables-list');
  const pays = profile.payables || [];
  payList.innerHTML = pays.length ? pays.map((p, i) => `
    <div class="tx-item">
      <div class="crystal-gem">📤</div>
      <div style="min-width:0;">
        <div style="font-weight:700;font-size:13px;">${escapeHtml(p.entity)}</div>
        <div style="font-size:11px;color:var(--muted);">${escapeHtml(p.concept || 'Pasivo')} · Vence: ${escapeHtml(p.dueDate)}</div>
      </div>
      <div style="font-weight:800;color:#f97316;">${money(p.amount, profile.currency)}</div>
      <button class="crystal-btn delete-pay-btn" data-index="${i}" style="padding:4px 8px;font-size:11px;">✕</button>
    </div>
  `).join('') : '<div style="padding:16px;color:var(--muted);font-size:12px;">Sin cuentas por pagar.</div>';

  payList.querySelectorAll('.delete-pay-btn').forEach(btn => {
    btn.onclick = async () => {
      profile.payables.splice(Number(btn.dataset.index), 1);
      await storeVault();
      render();
      toast('Cuenta eliminada. No se registró un pago.');
    };
  });
}

// Retiro Actuarial
function renderRetirementSimulation() {
  const currentAge = Number($('#input-age').value);
  const retireAge = Number($('#input-retire-age').value);
  const monthlyInv = Number($('#input-monthly-inv').value);
  const annualRate = Number($('#input-rate').value) / 100;
  const inflation = Number($('#input-inflation').value) / 100;

  $('#label-age').textContent = `${currentAge} años`;
  $('#label-retire-age').textContent = `${retireAge} años`;
  $('#label-monthly-inv').textContent = money(monthlyInv);
  $('#label-rate').textContent = `${(annualRate * 100).toFixed(1)}%`;
  $('#label-inflation').textContent = `${(inflation * 100).toFixed(1)}%`;
  $('#res-retire-age-text').textContent = retireAge;

  const years = Math.max(0, retireAge - currentAge);
  const totalMonths = years * 12;
  const monthlyRate = annualRate / 12;

  const totalProjected = Finance.futureValue(monthlyInv, annualRate, totalMonths);

  const totalCapitalInvested = monthlyInv * totalMonths;
  const interestEarned = Math.max(0, totalProjected - totalCapitalInvested);
  const estimatedMonthlyPension = totalProjected * 0.005;

  $('#res-total-projected').textContent = money(totalProjected);
  $('#res-capital-invested').textContent = money(totalCapitalInvested);
  $('#res-interest-earned').textContent = money(interestEarned);
  $('#res-monthly-pension').textContent = money(estimatedMonthlyPension);
  $('#res-tax-deduction').textContent = money(totalProjected / Math.pow(1 + inflation, years));

  const svg = $('#compound-svg');
  if (svg) {
    const w = 300, h = 90;
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    let investedPts = '', compoundPts = '';
    for (let y = 0; y <= years; y++) {
      const x = (y / (years || 1)) * w;
      const m = y * 12;
      const inv = monthlyInv * m;
      const comp = monthlyRate > 0 ? (monthlyInv * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)) : inv;
      const yInv = h - (inv / (totalProjected || 1)) * (h - 10);
      const yComp = h - (comp / (totalProjected || 1)) * (h - 10);
      investedPts += `${y === 0 ? 'M' : 'L'} ${x} ${yInv} `;
      compoundPts += `${y === 0 ? 'M' : 'L'} ${x} ${yComp} `;
    }
    svg.innerHTML = `
      <path d="${investedPts}" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="3,3" />
      <path d="${compoundPts}" fill="none" stroke="var(--accent-base)" stroke-width="3" stroke-linecap="round" />
    `;
  }
}

// Clientes CRM
function renderClients() {
  const profile = getActiveProfile();
  if (!profile) return;
  const query = $('#client-search').value.toLowerCase().trim();
  const clients = profile.insuranceClients || [];

  const filtered = query ? clients.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.plan.toLowerCase().includes(query) ||
    (c.phone && c.phone.includes(query))
  ) : clients;

  const tbody = $('#clients-table-body');
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--muted);">Sin clientes registrados en este perfil. Usa “+ Nuevo Cliente”.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((c, i) => `
    <tr style="border-bottom:1px solid var(--line);">
      <td style="padding:12px 14px;"><strong>${escapeHtml(c.name)}</strong></td>
      <td style="padding:12px 14px;">${escapeHtml(c.phone || c.email || '—')}</td>
      <td style="padding:12px 14px;color:#38bdf8;">${escapeHtml(c.plan)}</td>
      <td style="padding:12px 14px;">${c.sumInsured ? money(c.sumInsured, profile.currency) : '—'}</td>
      <td style="padding:12px 14px;font-weight:800;color:var(--accent-base);">${c.premium ? money(c.premium, profile.currency) : '—'}</td>
      <td style="padding:12px 14px;"><span class="crystal-btn" style="font-size:10px;padding:2px 8px;">${escapeHtml(c.status || 'Prospecto')}</span></td>
      <td style="padding:12px 14px;">
        <button class="crystal-btn edit-client-btn" data-index="${i}" title="Editar cliente">Editar</button>
        <button class="crystal-btn print-client-prop-btn" data-index="${i}" title="Generar propuesta formal" style="padding:4px 8px;font-size:11px;">📄</button>
        <button class="crystal-btn delete-client-btn" data-index="${i}" title="Eliminar" style="padding:4px 8px;font-size:11px;color:#ef4444;">✕</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-client-btn').forEach(btn => btn.onclick = () => {
    const client = filtered[Number(btn.dataset.index)]; $('#new-client-btn').click(); editingClientId = client.id;
    for (const [field,value] of Object.entries({name:client.name,phone:client.phone,email:client.email,plan:client.plan,status:client.status,'sum-insured':client.sumInsured,premium:client.premium})) $('#client-'+field).value = value ?? '';
  });
  tbody.querySelectorAll('.delete-client-btn').forEach(btn => {
    btn.onclick = async () => {
      const target = filtered[Number(btn.dataset.index)];
      profile.insuranceClients = profile.insuranceClients.filter(c => c.id !== target.id);
      await storeVault();
      render();
      toast('Cliente eliminado.');
    };
  });

  tbody.querySelectorAll('.print-client-prop-btn').forEach(btn => {
    btn.onclick = () => {
      const c = filtered[Number(btn.dataset.index)];
      if (c) showClientProposal(c);
    };
  });
}

function showClientProposal(c) {
  proposalClient = {...c};
  showPage('insurance');
  const profile = getActiveProfile();
  const brand = data.globalSettings.businessName || 'MONEYMAXING WEALTH ADVISORY';
  const adv = data.globalSettings.advisorName || 'Titular por configurar';

  $('#prop-advisor-brand').textContent = brand.toUpperCase();
  $('#prop-advisor-contact').textContent = `${adv} · ${data.globalSettings.advisorPhone || ''} ${data.globalSettings.advisorEmail ? '· ' + data.globalSettings.advisorEmail : ''}`;
  $('#prop-date').textContent = new Intl.DateTimeFormat('es-MX', { dateStyle: 'full' }).format(new Date());

  $('#prop-client-name').textContent = c.name;
  $('#prop-plan-name').textContent = c.plan;
  $('#prop-insured-capital').textContent = c.sumInsured ? money(c.sumInsured, profile.currency) : 'Según Cobertura';
  $('#prop-monthly-premium').textContent = c.premium ? money(c.premium / 12, profile.currency) : '$0.00';
  $('#prop-projected-capital').textContent = 'Sin rendimiento garantizado';

  $('#client-proposal-preview').classList.remove('hidden');
  $('#client-proposal-preview').scrollIntoView({ behavior: 'smooth' });
}

// Presupuestos y metas
function renderBudgetsAndGoals() {
  const profile = getActiveProfile();
  if (!profile) return;

  const currentMonth = monthId();
  const monthlyTxs = profile.transactions.filter(t => t.date.slice(0, 7) === currentMonth && t.kind === 'expense');
  const spentByCat = {};
  monthlyTxs.forEach(t => spentByCat[t.category] = (spentByCat[t.category] || 0) + t.amount);

  const bContainer = $('#budgets-container');
  bContainer.innerHTML = CATEGORIES.map(([id, name]) => {
    const limit = Number(profile.budgets?.[id]) || 0;
    const spent = spentByCat[id] || 0;
    const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
    const col = pct > 90 ? '#ef4444' : pct > 75 ? '#f97316' : 'var(--accent-base)';

    return `
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:4px;">
          <span><strong>${name}</strong> (Gastado: ${money(spent, profile.currency)})</span>
          <div style="display:flex;align-items:center;gap:4px;">
            <span>Límite: $</span>
            <input type="number" data-cat-budget="${id}" value="${limit}" style="width:100px;padding:4px 6px;text-align:right;border-radius:6px;border:1px solid var(--line);background:var(--bg-glass-card);color:var(--ink);">
          </div>
        </div>
        <div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${col};transition:width 0.4s var(--ease-spring);"></div>
        </div>
      </div>
    `;
  }).join('');

  const gContainer = $('#savings-goals-container');
  const goals = profile.savingsGoals || [];
  gContainer.innerHTML = goals.length ? goals.map((g, i) => {
    const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
    return `
      <div class="plain-surface" style="padding:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <strong style="font-size:13px;">${escapeHtml(g.name)}</strong>
          <span style="font-weight:800;color:var(--accent-base);font-size:12px;">${pct}%</span>
        </div>
        <div style="height:6px;background:var(--line);border-radius:3px;overflow:hidden;margin-bottom:8px;">
          <div style="height:100%;width:${pct}%;background:var(--accent-base);transition:width 0.4s var(--ease-spring);"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--ink-secondary);">
          <span>${money(g.current, profile.currency)} de ${money(g.target, profile.currency)}</span>
          <button class="crystal-btn edit-goal-btn" data-index="${i}" style="padding:2px 6px;">Editar</button><button class="crystal-btn delete-goal-btn" data-index="${i}" style="padding:2px 6px;font-size:10px;">✕</button>
        </div>
      </div>
    `;
  }).join('') : '<div style="padding:16px;color:var(--muted);font-size:12px;">Sin metas de ahorro registradas.</div>';

  gContainer.querySelectorAll('.edit-goal-btn').forEach(btn => btn.onclick = () => editGoal(goals[Number(btn.dataset.index)].id));
  gContainer.querySelectorAll('.delete-goal-btn').forEach(btn => {
    btn.onclick = async () => {
      profile.savingsGoals.splice(Number(btn.dataset.index), 1);
      await storeVault();
      render();
      toast('Meta eliminada.');
    };
  });
}

function renderProfilesList() {
  const container = $('#profiles-list-container');
  if (!data?.profiles || !container) return;

  container.innerHTML = data.profiles.map(p => {
    const isCurrent = p.id === data.activeProfileId;
    return `
      <div class="tx-item" style="${isCurrent ? 'border-left:3px solid var(--accent-base);' : ''}">
        <div class="crystal-gem accent">${p.role === 'realestate' ? '🏢' : p.role === 'insurance' ? '🛡️' : p.role === 'accounting' ? '📊' : p.role === 'personal' ? '👤' : '⭐'}</div>
        <div style="min-width:0;">
          <div style="font-weight:700;font-size:13px;">${escapeHtml(p.name)} ${isCurrent ? '<span style="color:var(--accent-base);font-size:10px;">(ACTIVO)</span>' : ''}</div>
          <div style="font-size:11px;color:var(--muted);">Rol: ${escapeHtml(p.role.toUpperCase())} · ${escapeHtml(p.currency)} · ${p.transactions.length} movimientos</div>
        </div>
        <div style="display:flex;gap:6px;">
          ${!isCurrent ? `<button class="crystal-btn switch-profile-btn" data-id="${escapeHtml(p.id)}" style="padding:4px 10px;font-size:11px;">Activar</button>` : ''}
          ${data.profiles.length > 1 ? `<button class="crystal-btn crystal-btn-danger delete-profile-btn" data-id="${escapeHtml(p.id)}" style="padding:4px 8px;font-size:11px;">✕</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.switch-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      data.activeProfileId = btn.dataset.id;
      await storeVault();
      render();
      playHaptic('unlock');
      toast('Perfil activado.');
    };
  });

  container.querySelectorAll('.delete-profile-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('¿Deseas eliminar este perfil y todos sus datos?')) return;
      data.profiles = data.profiles.filter(p => p.id !== btn.dataset.id);
      data.activeProfileId = data.profiles[0].id;
      await storeVault();
      render();
      toast('Perfil eliminado.');
    };
  });

  $('#setting-currency').value = data.globalSettings.currency || 'MXN';
  $('#setting-autolock').value = String(data.globalSettings.autoLockMinutes || 5);
  $('#setting-pane-anim').value = data.globalSettings.paneAnim || 'smooth';
  $('#setting-sound').checked = data.globalSettings.soundEnabled !== false;
  $('#setting-business-name').value = data.globalSettings.businessName || '';
  $('#setting-advisor-name').value = data.globalSettings.advisorName || '';
  $('#setting-advisor-phone').value = data.globalSettings.advisorPhone || '';
  $('#setting-advisor-email').value = data.globalSettings.advisorEmail || '';
}

function showPage(pageId) {
  $$('.page').forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  $$('.nav-menu button').forEach(b => b.setAttribute('aria-current', b.dataset.page === pageId ? 'page' : 'false'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function populateCategorySelects() {
  const options = CATEGORIES.map(([id, name]) => `<option value="${id}">${name}</option>`).join('');
  $('#modal-tx-category').innerHTML = options;
  $('#filter-category').innerHTML = '<option value="all">Todas las categorías</option>' + options;
}

// ==========================================
// COMMAND PALETTE
// ==========================================
const COMMANDS = [
  { title: '+ Nuevo Movimiento', icon: '📝', action: () => $('#quick-add-btn').click() },
  { title: 'Ir a Resumen', icon: '⌂', action: () => showPage('home') },
  { title: 'Ir a Bienes Raíces & Hipotecas', icon: '🏢', action: () => showPage('realestate') },
  { title: 'Ir a Contabilidad', icon: '📊', action: () => showPage('accounting') },
  { title: 'Ir a Seguros y retiro', icon: '🛡️', action: () => showPage('insurance') },
  { title: 'Ir a Clientes (CRM)', icon: '👥', action: () => showPage('clients') },
  { title: 'Ir a Presupuestos y metas', icon: '↗', action: () => showPage('budgets') },
  { title: 'Preferencias & Temas', icon: '✨', action: () => showPage('studio') },
  { title: 'Exportar Movimientos a CSV', icon: '📥', action: () => $('#export-csv-btn').click() },
  { title: 'Descargar Respaldo Cifrado (.mmxvault)', icon: '📦', action: () => $('#download-backup-btn').click() },
  { title: 'Crear Nuevo Perfil', icon: '👤', action: () => { initialWizard = false; openWizard(); } },
  { title: '🔒 Bloquear Bóveda Inmediatamente', icon: '🔒', action: () => lock() }
];

function openCommandPalette() {
  $('#cmd-palette').classList.remove('hidden');
  $('#cmd-search-input').value = '';
  renderCommandResults('');
  $('#cmd-search-input').focus();
  playHaptic('click');
}

function closeCommandPalette() {
  $('#cmd-palette').classList.add('hidden');
}

function renderCommandResults(query) {
  const list = $('#cmd-results-list');
  const q = query.toLowerCase().trim();
  const filtered = q ? COMMANDS.filter(c => c.title.toLowerCase().includes(q)) : COMMANDS;

  list.innerHTML = filtered.map((c, i) => `
    <div class="cmd-item ${i === 0 ? 'active' : ''}" data-cmd-idx="${i}">
      <span style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:16px;">${c.icon}</span>
        ${escapeHtml(c.title)}
      </span>
      <span style="font-size:11px;color:var(--muted);font-family:var(--mono);">↵ Ejecutar</span>
    </div>
  `).join('');

  list.querySelectorAll('.cmd-item').forEach((item, idx) => {
    item.onclick = () => {
      closeCommandPalette();
      filtered[idx].action();
    };
  });
}

// ==========================================
// EVENT LISTENERS & INICIALIZACIÓN
// ==========================================
$('#gate-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('#gate-password').value;
  if (gateBusy) return;
  gateBusy = true;
  $('#gate-submit').disabled = true;
  $('#gate-error').textContent = '';

  try {
    if (!crypto?.subtle) throw new Error('Criptografía no soportada.');
    const stored = await loadVault();
    vaultRevision = stored.revision;

    if (stored.vault) {
      const record = stored.vault;
      vaultSalt = b64ToBytes(record.salt);
      activeIterations = record.iterations;
      const derived = await derive(password, vaultSalt);
      const plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(record.iv) },
        derived,
        b64ToBytes(record.ciphertext)
      );
      key = derived;
      failedAttempts = 0;
      data = Finance.validate(migrateLegacyData(JSON.parse(new TextDecoder().decode(plain))));
      committedData = structuredClone(data);
      $('#gate').classList.add('hidden');
      $('#app').classList.remove('hidden');
      populateCategorySelects();
      render();
      resetLockTimer();
      playHaptic('unlock');
      toast('Bóveda personal descifrada.');
    } else {
      if (password.length < 10) throw new Error('La contraseña debe tener mínimo 10 caracteres.');
      if (password !== $('#gate-confirm').value) throw new Error('Las contraseñas no coinciden.');
      activeIterations = ITERATIONS;
      vaultSalt = crypto.getRandomValues(new Uint8Array(16));
      key = await derive(password, vaultSalt);
      data = defaultVaultData();
      await storeVault({ create: true });
      $('#gate').classList.add('hidden');
      $('#app').classList.remove('hidden');
      populateCategorySelects();
      render();
      resetLockTimer();
      initialWizard = true;
      openWizard();
    }
  } catch (err) {
    key = null;
    data = null;
    if (err.name === 'OperationError') handleBruteForceFailure();
    $('#gate-error').textContent = err.name === 'OperationError' ? 'Contraseña incorrecta o respaldo dañado.' : (err.message || 'Error al abrir.');
  } finally { gateBusy = false; if ($('#gate-lockout').classList.contains('hidden')) $('#gate-submit').disabled = false; }
});

// Guardar Transacción
$('#tx-form').addEventListener('submit', async e => {
  e.preventDefault();
  const profile = getActiveProfile();
  if (!profile) return;

  let amount;
  try { amount = Finance.amount($('#modal-tx-amount').value, {positive:true}); } catch (error) { $('#modal-tx-error').textContent = error.message; return; }
  const kind = $('#modal-tx-kind').value;
  const note = $('#modal-tx-note').value.trim();
  const date = $('#modal-tx-date').value;
  const taxKind = $('#modal-tx-tax').value;
  const category = kind === 'expense' ? $('#modal-tx-category').value : 'ingreso';

  if (!Number.isFinite(amount) || amount <= 0) {
    $('#modal-tx-error').textContent = 'El monto debe ser mayor que 0.';
    return;
  }
  if (!Finance.validDate(date) || !note) {
    $('#modal-tx-error').textContent = 'Selecciona una fecha válida.';
    return;
  }

  const transaction = {
    id: editingTxId || crypto.randomUUID(),
    kind,
    amount: Math.round(amount * 100) / 100,
    note,
    date,
    category,
    taxKind,
    createdAt: Date.now()
  };
  if (editingTxId) profile.transactions = profile.transactions.map(t => t.id === editingTxId ? transaction : t);
  else profile.transactions.push(transaction);

  try {
    await storeVault();
    render();
    closeModal('#tx-modal');
    playHaptic('save');
    toast('Movimiento registrado en bóveda.');
  } catch (err) {
    $('#modal-tx-error').textContent = err.message || 'Error al guardar.';
  }
});

// Registrar Propiedad Inmobiliaria
$('#property-form').addEventListener('submit', async e => {
  e.preventDefault();
  const profile = getActiveProfile();
  if (!profile) return;

  profile.realEstateProperties = profile.realEstateProperties || [];
  profile.realEstateProperties.push({
    id: crypto.randomUUID(),
    title: $('#prop-title').value.trim(),
    opType: $('#prop-op-type').value,
    price: Number($('#prop-price').value) || 0,
    commissionPct: Number($('#prop-commission').value),
    status: $('#prop-status').value,
    client: $('#prop-client').value.trim(),
    createdAt: Date.now()
  });

  await storeVault();
  render();
  closeModal('#property-modal');
  playHaptic('save');
  toast('Propiedad guardada en cartera.');
});

// Sliders Inmobiliarios
['input-re-price', 'input-re-down', 'input-re-term', 'input-re-rate', 'input-re-extra'].forEach(id => {
  $(`#${id}`)?.addEventListener('input', renderRealEstateModule);
});

// Inputs de Cap Rate
['roi-price', 'roi-rent', 'roi-closing', 'roi-expenses'].forEach(id => {
  $(`#${id}`)?.addEventListener('input', renderCapRateCalculation);
});

// Inputs de Punto de Equilibrio
['be-fixed', 'be-price', 'be-cost'].forEach(id => {
  $(`#${id}`)?.addEventListener('input', renderBreakEvenCalculator);
});

$('#print-mortgage-proposal').onclick = () => QuotationUI.open('mortgage');

// Guardar Límites
$('#save-budgets-btn').addEventListener('click', async () => {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.budgets = profile.budgets || {};
  for (const [id] of CATEGORIES) {
    const input = $(`[data-cat-budget="${id}"]`);
    profile.budgets[id] = Math.max(0, Number(input?.value) || 0);
  }
  await storeVault();
  renderBudgetsAndGoals();
  playHaptic('save');
  toast('Límites actualizados.');
});

// Guardar Proyección en Cartera
$('#save-retirement-quote-btn').addEventListener('click', async () => {
  const profile = getActiveProfile();
  if (!profile) return;

  const currentAge = $('#input-age').value;
  const retireAge = $('#input-retire-age').value;
  const monthly = $('#input-monthly-inv').value;
  const clientName = $('#quote-client-name').value.trim() || `Prospecto Retiro (${currentAge} a ${retireAge} años)`;

  profile.insuranceClients = profile.insuranceClients || [];
  profile.insuranceClients.push({
    id: crypto.randomUUID(),
    name: clientName,
    phone: '',
    email: '',
    plan: `PPR Retiro (${currentAge} a ${retireAge} años)`,
    status: 'Propuesta Presentada',
    sumInsured: Number($('#res-total-projected').textContent.replace(/[^0-9.-]+/g, '')) || 0,
    premium: Number(monthly) * 12
  });

  await storeVault();
  render();
  playHaptic('save');
  toast('Proyección guardada en CRM.');
  showPage('clients');
});

// Cotización Rápida
$('#create-quote-btn').addEventListener('click', async () => {
  const profile = getActiveProfile();
  if (!profile) return;
  const name = $('#quote-client-name').value.trim();
  if (!name) { toast('Escribe el nombre del cliente.'); return; }

  const type = $('#quote-policy-type').value;
  const sum = Number($('#quote-sum-insured').value) || 0;
  const premium = Number($('#quote-premium-annual').value) || 0;

  profile.insuranceClients = profile.insuranceClients || [];
  profile.insuranceClients.push({
    id: crypto.randomUUID(),
    name,
    phone: '',
    email: '',
    plan: type,
    status: 'Propuesta Presentada',
    sumInsured: sum,
    premium
  });

  await storeVault();
  render();
  playHaptic('save');
  toast('Cotización registrada en Cartera.');
  showPage('clients');
});

// Registrar Cliente en CRM
$('#client-form').addEventListener('submit', async e => {
  e.preventDefault();
  const profile = getActiveProfile();
  if (!profile) return;

  profile.insuranceClients = profile.insuranceClients || [];
  const record = {
    id: editingClientId || crypto.randomUUID(),
    name: $('#client-name').value.trim(),
    phone: $('#client-phone').value.trim(),
    email: $('#client-email').value.trim(),
    plan: $('#client-plan').value.trim(),
    status: $('#client-status').value,
    sumInsured: Number($('#client-sum-insured').value) || 0,
    premium: Number($('#client-premium').value) || 0
  };
  if (editingClientId) profile.insuranceClients = profile.insuranceClients.map(c => c.id === editingClientId ? record : c); else profile.insuranceClients.push(record);

  await storeVault();
  render();
  closeModal('#client-modal');
  playHaptic('save');
  toast('Cliente guardado en cartera.');
});

// Cuentas por Cobrar / Pagar
$('#debt-form').addEventListener('submit', async e => {
  e.preventDefault();
  const profile = getActiveProfile();
  if (!profile) return;

  const kind = $('#debt-kind').value;
  const record = {
    id: crypto.randomUUID(),
    entity: $('#debt-entity').value.trim(),
    amount: Number($('#debt-amount').value),
    dueDate: $('#debt-due-date').value,
    concept: $('#debt-concept').value.trim(),
    createdAt: Date.now()
  };

  if (kind === 'receivable') {
    profile.receivables = profile.receivables || [];
    profile.receivables.push(record);
  } else {
    profile.payables = profile.payables || [];
    profile.payables.push(record);
  }

  await storeVault();
  render();
  closeModal('#debt-modal');
  playHaptic('save');
  toast('Cuenta registrada.');
});

// CSV Export
$('#export-csv-btn').addEventListener('click', () => {
  const profile = getActiveProfile();
  if (!profile || !profile.transactions.length) { toast('Sin movimientos.'); return; }
  const headers = ['Fecha','Tipo','Monto','Moneda','Categoría','Descripción','Impuestos'];
  const rows = profile.transactions.map(t => [t.date,t.kind,t.amount.toFixed(2),profile.currency,t.category,t.note,t.taxKind || 'none']);
  downloadFile('MONEYMAXING_'+localToday()+'.csv', '\ufeff'+[headers,...rows].map(row => row.map(Finance.csvCell).join(',')).join('\r\n'),'text/csv;charset=utf-8');
  toast('Archivo CSV generado.');
});

// Respaldo
$('#download-backup-btn').addEventListener('click', async () => {
  try {
    const stored = await loadVault();
    if (!stored?.vault) throw new Error('Bóveda no encontrada.');
    const blob = new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Boveda_MONEYMAXING_${localToday()}.mmxvault`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Respaldo cifrado descargado.');
  } catch (err) {
    toast('Error: ' + err.message);
  }
});

// Restaurar Respaldo
$('#restore-file-input').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 10*1024*1024) throw new Error('El respaldo supera 10 MB.');
    const parsed = JSON.parse(await file.text());
    const record = parsed.vault;
    if (!record || record.version !== 1 || !Number.isInteger(record.iterations) || record.iterations < 100000 || record.iterations > 1000000) throw new Error('Formato de respaldo inválido.');
    const answer = await editFields('Restaurar respaldo: sustituirá la bóveda actual', [['password','Contraseña del respaldo','password','']]);
    if (!answer) return;
    const backupKey = await derive(answer.password,b64ToBytes(record.salt),record.iterations);
    const plain = await crypto.subtle.decrypt({name:'AES-GCM',iv:b64ToBytes(record.iv)},backupKey,b64ToBytes(record.ciphertext));
    Finance.validate(migrateLegacyData(JSON.parse(new TextDecoder().decode(plain))));
    const current = await loadVault();
    if (!confirm('El respaldo se pudo abrir. ¿Sustituir los datos actuales? Se conservará una copia cifrada anterior en disco.')) return;
    saving = true;
    const res = await fetch('/api/vault', {method:current.vault ? 'PUT':'POST',headers:{'Content-Type':'application/json','If-Match':String(current.revision)},body:JSON.stringify(record),signal:AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error('No se restauró. Revisa la conexión o vuelve a abrir la bóveda si otro dispositivo la modificó.');
    saving = false; lock(); toast('Respaldo restaurado. Abre con su contraseña.');
  } catch (error) { toast(error.name === 'OperationError' ? 'Contraseña incorrecta o respaldo dañado. No se sustituyeron datos.' : error.message); }
  finally { saving = false; e.target.value = ''; }
});

// Temas y Acentos Preferencias
$$('.theme-picker-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    data.globalSettings.theme = btn.dataset.themeVal;
    applyAppearance();
    playHaptic('click');
    await storeVault();
  });
});

$$('.swatch-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    data.globalSettings.accent = btn.dataset.accentVal;
    applyAppearance();
    playHaptic('click');
    await storeVault();
  });
});

$('#setting-pane-anim').addEventListener('change', async e => {
  data.globalSettings.paneAnim = e.target.value;
  applyAppearance();
  playHaptic('click');
  await storeVault();
  toast('Velocidad de paneo actualizada.');
});

$('#save-studio-btn').addEventListener('click', async () => {
  const selectedCurrency = $('#setting-currency').value;
  const currentProfile = getActiveProfile();
  if (currentProfile.currency !== selectedCurrency && (currentProfile.transactions.length || currentProfile.initialBalance || currentProfile.realEstateProperties.length || currentProfile.insuranceClients.length || currentProfile.savingsGoals.length || currentProfile.receivables.length || currentProfile.payables.length)) { toast('Este perfil ya tiene importes. Crea otro perfil para usar otra moneda.'); return; }
  data.globalSettings.currency = selectedCurrency;
  data.globalSettings.autoLockMinutes = Number($('#setting-autolock').value) || 5;
  data.globalSettings.soundEnabled = $('#setting-sound').checked;
  data.globalSettings.businessName = $('#setting-business-name').value.trim();
  data.globalSettings.advisorName = $('#setting-advisor-name').value.trim();
  data.globalSettings.advisorPhone = $('#setting-advisor-phone').value.trim();
  data.globalSettings.advisorEmail = $('#setting-advisor-email').value.trim();

  const profile = getActiveProfile();
  if (profile) profile.currency = data.globalSettings.currency;

  await storeVault();
  render();
  playHaptic('save');
  toast('Preferencias del Preferencias guardadas.');
});

// WIZARD ONBOARDING
function openWizard() {
  openModal('#onboarding-modal');
  $('#wizard-content-1').classList.remove('hidden');
  $('#wizard-content-2').classList.add('hidden');
  $('#wizard-content-3').classList.add('hidden');
  $('#wstep-1').classList.add('crystal-btn-primary');
  $('#wstep-2').classList.remove('crystal-btn-primary');
  $('#wstep-3').classList.remove('crystal-btn-primary');
}

$$('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    $$('.role-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    wizardSelectedRole = card.dataset.role;
    playHaptic('click');
  });
});

$('#wizard-next-1').addEventListener('click', () => {
  $('#wizard-content-1').classList.add('hidden');
  $('#wizard-content-2').classList.remove('hidden');
  $('#wstep-1').classList.remove('crystal-btn-primary');
  $('#wstep-2').classList.add('crystal-btn-primary');
  $('#wiz-profile-name').focus();
});

$('#wizard-prev-2').addEventListener('click', () => {
  $('#wizard-content-2').classList.add('hidden');
  $('#wizard-content-1').classList.remove('hidden');
  $('#wstep-2').classList.remove('crystal-btn-primary');
  $('#wstep-1').classList.add('crystal-btn-primary');
});

$('#wizard-next-2').addEventListener('click', () => {
  const name = $('#wiz-profile-name').value.trim();
  if (!name) { toast('Escribe un nombre para este perfil.'); return; }
  $('#wizard-content-2').classList.add('hidden');
  $('#wizard-content-3').classList.remove('hidden');
  $('#wstep-2').classList.remove('crystal-btn-primary');
  $('#wstep-3').classList.add('crystal-btn-primary');
});

$('#wizard-prev-3').addEventListener('click', () => {
  $('#wizard-content-3').classList.add('hidden');
  $('#wizard-content-2').classList.remove('hidden');
  $('#wstep-3').classList.remove('crystal-btn-primary');
  $('#wstep-2').classList.add('crystal-btn-primary');
});

$('#wizard-finish').addEventListener('click', async () => {
  const name = $('#wiz-profile-name').value.trim() || 'Nuevo Perfil';
  const currency = $('#wiz-currency').value;
  const theme = $('#wiz-theme').value;
  const initBal = Number($('#wiz-initial-balance').value) || 0;
  const bName = $('#wiz-business-name').value.trim();

  const newProfile = {
    id: 'prof_' + crypto.randomUUID().slice(0, 8),
    name,
    role: wizardSelectedRole,
    currency,
    initialBalance: initBal,
    transactions: [],
    budgets: Object.fromEntries(CATEGORIES.map(([id]) => [id, 0])),
    savingsGoals: [],
    realEstateProperties: [],
    insuranceClients: [],
    receivables: [],
    payables: []
  };

  data.profiles = data.profiles || [];
  if (initialWizard) data.profiles[0] = newProfile; else data.profiles.push(newProfile);
  initialWizard = false;
  data.activeProfileId = newProfile.id;
  data.globalSettings.theme = theme;
  data.globalSettings.currency = currency;
  if (bName) data.globalSettings.businessName = bName;

  await storeVault();
  render();
  closeModal('#onboarding-modal');
  playHaptic('unlock');
  toast('¡Perfil configurado con éxito!');
});

// Modales rápidos
$('#quick-add-btn').onclick = () => {
  editingTxId = null;
  $('#tx-form').reset();
  $('#modal-tx-date').value = localToday();
  $('#modal-tx-error').textContent = '';
  openModal('#tx-modal');
  $('#modal-tx-amount').focus();
  playHaptic('click');
};
$('#add-tx-btn-page').onclick = () => $('#quick-add-btn').click();
$('#close-tx-modal-btn').onclick = () => closeModal('#tx-modal');
$('#cancel-tx-modal-btn').onclick = () => closeModal('#tx-modal');

$('#new-property-btn').onclick = () => {
  $('#property-form').reset();
  openModal('#property-modal');
  $('#prop-title').focus();
  playHaptic('click');
};
$('#close-property-modal-btn').onclick = () => closeModal('#property-modal');
$('#cancel-property-modal-btn').onclick = () => closeModal('#property-modal');

$('#profile-switcher-btn').onclick = () => showPage('studio');
$('#btn-add-profile-wizard').onclick = () => { initialWizard = false; openWizard(); };
$('#close-wizard-btn').onclick = () => closeModal('#onboarding-modal');

$('#new-client-btn').onclick = () => {
  editingClientId = null;
  $('#client-form').reset();
  openModal('#client-modal');
  $('#client-name').focus();
  playHaptic('click');
};
$('#close-client-modal-btn').onclick = () => closeModal('#client-modal');
$('#cancel-client-modal-btn').onclick = () => closeModal('#client-modal');

$('#add-receivable-btn').onclick = () => {
  $('#debt-form').reset();
  $('#debt-kind').value = 'receivable';
  $('#debt-modal-title').textContent = 'Añadir Cuenta por Cobrar';
  $('#debt-due-date').value = localToday();
  openModal('#debt-modal');
};
$('#add-payable-btn').onclick = () => {
  $('#debt-form').reset();
  $('#debt-kind').value = 'payable';
  $('#debt-modal-title').textContent = 'Añadir Cuenta por Pagar';
  $('#debt-due-date').value = localToday();
  openModal('#debt-modal');
};
$('#close-debt-modal-btn').onclick = () => closeModal('#debt-modal');
$('#cancel-debt-modal-btn').onclick = () => closeModal('#debt-modal');

$('#new-goal-btn').onclick = () => editGoal();
async function editGoal(id = null) {
  const profile = getActiveProfile();
  const existing = profile.savingsGoals.find(g => g.id === id);
  const values = await editFields('Meta de ahorro', [
    ['name','Nombre','text',existing?.name || ''],
    ['target','Objetivo ('+profile.currency+')','number',existing?.target || ''],
    ['current','Ahorrado ('+profile.currency+')','number',existing?.current || 0]
  ]);
  if (!values) return;
  const record = {id:id || crypto.randomUUID(),name:values.name.trim(),target:Finance.amount(values.target,{positive:true}),current:Finance.amount(values.current),deadline:existing?.deadline || localToday()};
  if (!record.name || record.current < 0) throw new Error('Revisa el nombre y el importe ahorrado.');
  if (id) profile.savingsGoals = profile.savingsGoals.map(g => g.id === id ? record : g); else profile.savingsGoals.push(record);
  await storeVault(); render(); toast('Meta guardada.');
}

$('#generate-proposal-btn').onclick = () => {
  const cName = $('#quote-client-name').value.trim() || 'Cliente Prospecto';
  const pType = $('#quote-policy-type').value;
  const sum = Number($('#quote-sum-insured').value) || 0;
  const prem = Number($('#quote-premium-annual').value) || 0;
  showClientProposal({ name: cName, plan: pType, sumInsured: sum, premium: prem });
  playHaptic('click');
};
$('#close-proposal-btn').onclick = () => $('#client-proposal-preview').classList.add('hidden');

$('#lock-btn').onclick = lock;

['input-age', 'input-retire-age', 'input-monthly-inv', 'input-rate', 'input-inflation'].forEach(id => {
  $(`#${id}`)?.addEventListener('input', renderRetirementSimulation);
});

$('#filter-search').addEventListener('input', renderFullTransactions);
$('#filter-kind').addEventListener('change', renderFullTransactions);
$('#filter-category').addEventListener('change', renderFullTransactions);
$('#client-search').addEventListener('input', renderClients);

$$('[data-go-tx]').forEach(b => b.onclick = () => showPage('transactions'));
$$('.nav-menu button').forEach(b => b.addEventListener('click', () => {
  playHaptic('click');
  showPage(b.dataset.page);
}));

$('#open-cmd-palette-btn').onclick = openCommandPalette;
$('#cmd-search-input').addEventListener('input', e => renderCommandResults(e.target.value));

document.addEventListener('keydown', e => {
  if ($('#quotation-dialog')?.open && (e.key === 'Escape' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k'))) {
    if (e.key !== 'Escape') e.preventDefault();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if ($('#cmd-palette').classList.contains('hidden')) openCommandPalette();
    else closeCommandPalette();
  }
  if (e.key === 'Escape') {
    if (!$('#cmd-palette').classList.contains('hidden')) { closeCommandPalette(); return; }
    if (!$('#tx-modal').classList.contains('hidden')) { closeModal('#tx-modal'); return; }
    if (!$('#property-modal').classList.contains('hidden')) { closeModal('#property-modal'); return; }
    if (!$('#onboarding-modal').classList.contains('hidden')) { closeModal('#onboarding-modal'); return; }
    if (!$('#client-modal').classList.contains('hidden')) { closeModal('#client-modal'); return; }
    if (!$('#debt-modal').classList.contains('hidden')) { closeModal('#debt-modal'); return; }
    if (key) lock();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    if (key) lock();
  }
});

$('#cmd-palette').addEventListener('click', e => {
  if (e.target === $('#cmd-palette')) closeCommandPalette();
});

['click', 'keydown', 'mousemove', 'touchstart'].forEach(evt => {
  document.addEventListener(evt, () => { if (key) resetLockTimer(); }, { passive: true });
});

function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content],{type}));
  const link = document.createElement('a'); link.href=url; link.download=name;
  document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function editFields(title, fields) {
  const dialog = $('#editor-dialog');
  $('#editor-title').textContent = title;
  $('#editor-fields').innerHTML = fields.map(([name,label,type,value]) => `<label for="edit-${name}">${escapeHtml(label)}</label><input id="edit-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" required ${type === 'number' ? 'step="0.01" min="0" max="1000000000000"' : 'maxlength="200"'}>`).join('');
  return new Promise(resolve => {
    const finish = value => { dialog.close(); resolve(value); };
    $('#editor-form').onsubmit = e => { e.preventDefault(); finish(Object.fromEntries(new FormData(e.target))); };
    $('#editor-cancel').onclick = () => finish(null);
    dialog.oncancel = e => { e.preventDefault(); finish(null); };
    dialog.showModal(); dialog.querySelector('input').focus();
  });
}
window.addEventListener('unhandledrejection', event => {
  event.preventDefault(); toast(event.reason?.message || 'No se completó la acción. Revisa los datos e inténtalo de nuevo.');
});
window.addEventListener('beforeunload', event => { if (saving) { event.preventDefault(); event.returnValue = ''; } });
['click','submit','change'].forEach(type => document.addEventListener(type,event => {
  if (saving) { event.preventDefault(); event.stopImmediatePropagation(); }
},true));
$$('[data-print]').forEach(button => button.onclick = () => window.print());
const gateActions = document.createElement('div'); gateActions.className = 'gate-actions';
gateActions.innerHTML = '<button type="button" class="crystal-btn" id="retry-service">Reintentar conexión</button><button type="button" class="crystal-btn" id="gate-restore">Restaurar respaldo</button>';
$('#gate-form').append(gateActions);
$('#retry-service').onclick = gateMode;
$('#gate-restore').onclick = () => $('#restore-file-input').click();
// Connect existing visual labels to their form controls.
$$('label:not([for])').forEach(label => {
  const control = label.parentElement.querySelector('input,select,textarea');
  if (control?.id) label.htmlFor = control.id;
});
$$('input[type=number]').forEach(control => { if (!control.max) control.max='1000000000000'; });
$$('input[type=text],textarea').forEach(control => { if (!control.maxLength || control.maxLength < 0) control.maxLength=200; });
$$('.role-card').forEach(card => { card.tabIndex=0; card.setAttribute('role','button'); card.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();card.click();}}; });
$$('.modal-backdrop').forEach(modal=>{ modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); const title=modal.querySelector('h2,h3'); if(title){title.id ||= modal.id+'-heading';modal.setAttribute('aria-labelledby',title.id);} });
document.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const modal = [...document.querySelectorAll('.modal-backdrop:not(.hidden)')].at(-1);
  if (!modal) return;
  const items = [...modal.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
  if (!items.length) return;
  if (event.shiftKey && document.activeElement===items[0]) {event.preventDefault();items.at(-1).focus();}
  else if (!event.shiftKey && document.activeElement===items.at(-1)) {event.preventDefault();items[0].focus();}
});

 QuotationUI.init({getContext:()=>key && data ? {settings:data.globalSettings,currency:getActiveProfile().currency} : null});
 $('#new-quotation-btn').onclick=()=>QuotationUI.open('services');
 $('#retirement-pdf-btn').onclick=()=>QuotationUI.open('retirement');
 $('#proposal-pdf-btn').onclick=()=>QuotationUI.open(/retiro|ppr/i.test(proposalClient?.plan||'')?'retirement':'insurance',proposalClient);
 gateMode();

})();
