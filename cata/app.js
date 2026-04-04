const SHARED_KEY = 'aw139_companion_shared_context_v1';
const adcFrame = document.getElementById('adcFrame');
const watFrame = document.getElementById('watFrame');
const rtoFrame = document.getElementById('rtoFrame');
const frameMap = { adc: adcFrame, wat: watFrame, rto: rtoFrame };

const els = {
  base: document.getElementById('baseSelect'),
  departure: document.getElementById('departureEndSelect'),
  config: document.getElementById('configurationSelect'),
  pa: document.getElementById('pressureAltitude'),
  paNegativeBtn: document.getElementById('paNegativeBtn'),
  oat: document.getElementById('oat'),
  oatNegativeBtn: document.getElementById('oatNegativeBtn'),
  weight: document.getElementById('actualWeight'),
  wind: document.getElementById('headwind'),
  runBtn: document.getElementById('runBtn'),
  visualSelect: document.getElementById('visualSelect'),
  statusChip: document.getElementById('statusChip'),
  resultCard: document.getElementById('resultCard'),
  watMax: document.getElementById('watMaxMetric'),
  watBox: document.getElementById('watBox'),
  watSummary: document.getElementById('watSummary'),
  watMarginSummary: document.getElementById('watMarginSummary'),
  rtoBox: document.getElementById('rtoBox'),
  rtoMetric: document.getElementById('rtoMetric'),
  rtoSummary: document.getElementById('rtoSummary'),
  decisionBody: document.getElementById('decisionTableBody'),
  vizSubtitle: document.getElementById('vizSubtitle'),
  vizPlaceholder: document.getElementById('vizPlaceholder'),
  openWATBtn: document.getElementById('openWATBtn'),
  openRTOBtn: document.getElementById('openRTOBtn'),
  openADCBtn: document.getElementById('openADCBtn'),
  viewerPane: document.getElementById('viewerPane'),
  sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
};

function loadCtx() { try { return JSON.parse(localStorage.getItem(SHARED_KEY) || '{}'); } catch { return {}; } }
function saveCtx(patch) { localStorage.setItem(SHARED_KEY, JSON.stringify({ ...loadCtx(), ...patch, updatedAt: new Date().toISOString(), lastModule: 'cata' })); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function setField(doc, id, value) {
  const el = doc.getElementById(id);
  if (!el) return false;
  el.value = value ?? '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
function clickField(doc, id) { const el = doc.getElementById(id); if (!el) return false; el.click(); return true; }
function text(doc, id) { return (doc.getElementById(id)?.textContent || '').trim(); }
function numberFromText(value) {
  const m = String(value || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}
function mapRtoConfig(config) {
  return ({ standard: 'standard', eaps_off: 'eapsOff', eaps_on: 'eapsOn', ibf: 'ibfInstalled' })[config] || 'standard';
}
function mapVizLabel(v) { return ({ adc: 'Carta ADC', wat: 'Carta WAT', rto: 'Carta RTO', '': 'Em branco' })[v] || 'Em branco'; }

function sanitizeDigitsInput(el, maxLen = null) {
  const allowNegative = el === els.pa || el === els.oat;
  let raw = String(el.value ?? '').trim();
  let negative = '';
  if (allowNegative && raw.startsWith('-')) negative = '-';
  const digits = raw.replace(/[^0-9]/g, '');
  el.value = negative + (maxLen ? digits.slice(0, maxLen) : digits);
}

function toggleSignedInput(el, maxLen = null) {
  const raw = String(el.value ?? '').trim();
  const wantsNegative = !raw.startsWith('-');
  const digits = raw.replace(/[^0-9]/g, '');
  el.value = `${wantsNegative ? '-' : ''}${maxLen ? digits.slice(0, maxLen) : digits}`;
  el.focus();
  const caret = el.value.length;
  try { el.setSelectionRange(caret, caret); } catch {}
}

function digitsOnlyLength(el) {
  return String(el.value ?? '').replace(/[^0-9]/g, '').length;
}

function focusNext(target) {
  if (!target) return;
  if (target === els.runBtn) { els.runBtn.focus(); return; }
  target.focus();
  target.select?.();
}


async function waitForIframe(frame, ids = []) {
  for (let i = 0; i < 120; i++) {
    try {
      const doc = frame.contentWindow?.document;
      if (doc && (!ids.length || ids.every(id => doc.getElementById(id)))) return doc;
    } catch {}
    await sleep(120);
  }
  throw new Error('iframe não ficou pronto: ' + frame.id);
}

async function waitForTruthy(readFn, timeoutMs = 5000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = readFn();
    if (value) return value;
    await sleep(120);
  }
  return null;
}

async function populateBaseOptions() {
  const doc = await waitForIframe(adcFrame, ['baseSelect', 'departureEndSelect']);
  const baseSelect = doc.getElementById('baseSelect');
  const depSelect = doc.getElementById('departureEndSelect');
  els.base.innerHTML = baseSelect.innerHTML;
  els.departure.innerHTML = depSelect.innerHTML;
  if (!els.base.value) els.base.value = baseSelect.value;
  if (!els.departure.value) els.departure.value = depSelect.value;
}

function collectInputs() {
  return {
    base: els.base.value,
    departureEnd: els.departure.value,
    configuration: els.config.value,
    pressureAltitudeFt: Number(els.pa.value || 0),
    oatC: Number(els.oat.value || 0),
    weightKg: Number(els.weight.value || 0),
    headwindKt: Number(els.wind.value || 0)
  };
}

function pushSharedContext(input, patch = {}) {
  const merged = {
    pressureAltitudeFt: input.pressureAltitudeFt,
    oatC: input.oatC,
    weightKg: input.weightKg,
    headwindKt: input.headwindKt,
    adcBase: input.base,
    adcDepartureEnd: input.departureEnd,
    cataConfiguration: input.configuration,
    cataProcedure: 'clear',
    ...patch
  };
  saveCtx(merged);
}

async function runWAT(input) {
  const doc = await waitForIframe(watFrame, ['procedure', 'configuration', 'pressureAltitude', 'oat', 'actualWeight', 'headwind', 'runBtn', 'maxWeight', 'margin']);
  setField(doc, 'procedure', 'clear');
  setField(doc, 'configuration', input.configuration);
  await sleep(250);
  setField(doc, 'pressureAltitude', input.pressureAltitudeFt);
  setField(doc, 'oat', input.oatC);
  setField(doc, 'actualWeight', input.weightKg);
  setField(doc, 'headwind', input.headwindKt);
  clickField(doc, 'runBtn');

  const maxText = await waitForTruthy(() => {
    const t = text(doc, 'maxWeight');
    return t && t !== '—' ? t : null;
  }, 5000);
  const marginText = text(doc, 'margin');
  const summary = text(doc, 'statusText');
  const result = {
    maxText: maxText || text(doc, 'maxWeight'),
    marginText,
    maxWeightKg: numberFromText(maxText || text(doc, 'maxWeight')),
    marginKg: numberFromText(marginText),
    summary
  };
  pushSharedContext(input, { watMaxWeightKg: result.maxWeightKg, watMarginKg: result.marginKg });
  return result;
}

async function runRTO(input) {
  const doc = await waitForIframe(rtoFrame, ['configuration', 'pressureAltitude', 'oat', 'actualWeight', 'headwind', 'runBtn', 'finalMetric']);
  setField(doc, 'configuration', mapRtoConfig(input.configuration));
  await sleep(900);
  setField(doc, 'pressureAltitude', input.pressureAltitudeFt);
  setField(doc, 'oat', input.oatC);
  setField(doc, 'actualWeight', input.weightKg);
  setField(doc, 'headwind', input.headwindKt);
  clickField(doc, 'runBtn');

  const metricText = await waitForTruthy(() => {
    const t = text(doc, 'finalMetric');
    return /\d/.test(t) && t !== '—' ? t : null;
  }, 6000);
  const summary = text(doc, 'statusDetail') || text(doc, 'statusText');
  const result = {
    metricText: metricText || text(doc, 'finalMetric'),
    rtoMeters: numberFromText(metricText || text(doc, 'finalMetric')),
    summary
  };
  pushSharedContext(input, { rtoMeters: result.rtoMeters });
  return result;
}

async function runADC(input, rtoResult) {
  const doc = await waitForIframe(adcFrame, ['baseSelect', 'departureEndSelect', 'rtoInput', 'analyzeBtn', 'decisionTable']);
  setField(doc, 'baseSelect', input.base);
  await sleep(120);
  setField(doc, 'departureEndSelect', input.departureEnd);
  if (rtoResult?.rtoMeters != null) setField(doc, 'rtoInput', rtoResult.rtoMeters);
  clickField(doc, 'analyzeBtn');
  await waitForTruthy(() => doc.querySelectorAll('#decisionTable tr').length > 0, 4000);

  const rows = [...doc.querySelectorAll('#decisionTable tr')].map(tr => {
    const tds = tr.querySelectorAll('td');
    return tds.length >= 4 ? {
      point: tds[0].textContent.trim(),
      rtoOk: tds[2].textContent.trim(),
      decision: tds[3].textContent.trim(),
      go: /PODE|GO/i.test(tds[3].textContent) && !/NO/i.test(tds[3].textContent)
    } : null;
  }).filter(Boolean);

  return {
    gateText: text(doc, 'gateMetric'),
    fullText: text(doc, 'fullLengthMetric'),
    rows
  };
}

function renderResults(wat, rto, adc) {
  const decisionRows = adc?.rows || [];
  const watOk = wat?.marginKg != null ? wat.marginKg >= 0 : false;
  const badPoints = decisionRows.filter(row => !row.go).map(row => row.point);
  const runwayOk = decisionRows.length ? badPoints.length === 0 : false;
  const overallOk = watOk && runwayOk;

  els.watMax.textContent = wat?.maxText || '—';
  els.rtoMetric.textContent = rto?.metricText || '—';

  if (wat?.marginKg == null) {
    els.watSummary.textContent = wat?.summary || 'Sem cálculo ainda.';
    els.watMarginSummary.textContent = '—';
  } else if (watOk) {
    els.watSummary.textContent = 'GO — peso dentro do limite WAT.';
    els.watMarginSummary.textContent = `+${Math.round(wat.marginKg)} kg de margem`;
  } else {
    els.watSummary.textContent = 'NO GO — item negativo: WAT abaixo do peso requerido.';
    els.watMarginSummary.textContent = `${Math.abs(Math.round(wat.marginKg))} kg acima do limite`;
  }

  if (!decisionRows.length) {
    els.rtoSummary.textContent = rto?.summary || 'Sem cálculo ainda.';
  } else if (runwayOk) {
    els.rtoSummary.textContent = 'GO — todos os pontos da pista estão OK.';
  } else {
    els.rtoSummary.textContent = `NO GO — item negativo: ${badPoints.join(', ')}.`;
  }

  els.watBox.classList.remove('ok', 'bad');
  els.rtoBox.classList.remove('ok', 'bad');
  if (wat?.marginKg != null) els.watBox.classList.add(watOk ? 'ok' : 'bad');
  if (decisionRows.length) els.rtoBox.classList.add(runwayOk ? 'ok' : 'bad');

  els.statusChip.textContent = overallOk ? 'OK para decolagem' : 'NO GO / revisar limites';
  els.statusChip.className = 'status-chip ' + (overallOk ? 'ok' : 'bad');
  els.resultCard.classList.remove('result-ok', 'result-bad', 'pending');
  els.resultCard.classList.add(overallOk ? 'result-ok' : 'result-bad');

  if (!decisionRows.length) {
    els.decisionBody.innerHTML = '<tr><td colspan="2" class="muted-cell">Sem análise ainda.</td></tr>';
    return;
  }
  els.decisionBody.innerHTML = decisionRows.map(row => `
    <tr>
      <td>${row.point}</td>
      <td class="${row.go ? 'td-ok' : 'td-bad'}">${row.go ? 'OK' : 'NO'}</td>
    </tr>
  `).join('');
}

function toggleVizFullscreen(force = null) {
  const on = force == null ? !els.viewerPane.classList.contains('viz-fullscreen') : !!force;
  els.viewerPane.classList.toggle('viz-fullscreen', on);
  document.body.classList.toggle('fullscreen-body', on);
}
window.toggleCataVizFullscreen = toggleVizFullscreen;

function setSidebarCollapsed(force = null) {
  const on = force == null ? !document.body.classList.contains('sidebar-collapsed') : !!force;
  document.body.classList.toggle('sidebar-collapsed', on);
}

function addFullscreenClick(doc, selector) {
  const target = doc.querySelector(selector);
  if (!target || target.dataset.cataFullscreenBound === '1') return;
  target.dataset.cataFullscreenBound = '1';
  target.addEventListener('click', () => parent.toggleCataVizFullscreen?.(), { passive: true });
}

function applyUnifiedChartView(doc, mode) {
  if (doc.getElementById('cataEmbedStyleUnified')) return;

  if (mode === 'wat') {
    doc.getElementById('chartPanel')?.classList.remove('hidden');
    const main = doc.querySelector('main.app-shell');
    const section = doc.getElementById('chartPanel')?.closest('section');
    if (!main || !section) return;
    [...main.children].forEach(el => { el.style.display = el === section ? '' : 'none'; });
    section.style.padding = '0';
    section.style.margin = '0';
    section.style.border = '0';
    section.style.borderRadius = '0';
    section.style.background = '#000';
    const style = doc.createElement('style');
    style.id = 'cataEmbedStyleUnified';
    style.textContent = `
      html,body{height:100%;margin:0;background:#000!important}
      body{overflow:hidden}
      main.app-shell{padding:0!important;display:block!important}
      #chartPanel{display:block!important;padding:0!important;margin:0!important}
      .card-title-row,.toolbar-row,.legend,#chartHint,#chartReference,.hero,.form-card,.status,.interp-box,#interpSection,.top-embed-bar,.back-chip,.home-chip{display:none!important}
      .chart-stage{margin:0!important;height:100vh!important;display:flex;align-items:flex-start;justify-content:flex-start;overflow:auto;background:#000!important;border-radius:0!important;padding:0!important}
      #chartBaseImage,#chartCanvas{max-width:100%;height:auto;flex:0 0 auto;display:block}
    `;
    doc.head.appendChild(style);
    addFullscreenClick(doc, '.chart-stage');
    return;
  }

  if (mode === 'rto') {
    doc.getElementById('chartPanel')?.classList.remove('hidden');
    const main = doc.querySelector('main.app-shell');
    const section = doc.getElementById('chartPanel')?.closest('section');
    if (!main || !section) return;
    [...main.children].forEach(el => { el.style.display = el === section || el.id === 'chartFullscreen' ? '' : 'none'; });
    section.style.padding = '0';
    section.style.margin = '0';
    section.style.border = '0';
    section.style.borderRadius = '0';
    section.style.background = '#000';
    const style = doc.createElement('style');
    style.id = 'cataEmbedStyleUnified';
    style.textContent = `
      html,body{height:100%;margin:0;background:#000!important}
      body{overflow:hidden}
      main.app-shell{padding:0!important;display:block!important}
      #chartPanel{display:block!important;padding:0!important;margin:0!important}
      .card-title-row,.toolbar-row,.legend,#chartHint,#chartReference,.hero,.form-card,.status,.compact,#interpSection,.pill,.top-embed-bar,.back-chip,.home-chip{display:none!important}
      .chart-stage{margin:0!important;height:100vh!important;display:flex;align-items:flex-start;justify-content:flex-start;overflow:auto;background:#000!important;border-radius:0!important;cursor:zoom-in;padding:0!important}
      #chartCanvas{max-width:100%;height:auto;flex:0 0 auto;display:block}
    `;
    doc.head.appendChild(style);
    addFullscreenClick(doc, '.chart-stage');
    return;
  }

  if (mode === 'adc') {
    const style = doc.createElement('style');
    style.id = 'cataEmbedStyleUnified';
    style.textContent = `
      html,body{height:100%;margin:0;background:#000!important}
      body{overflow:hidden}
      .shell{padding:0!important;gap:0!important;grid-template-columns:1fr!important;min-height:100%!important}
      .left{display:none!important}
      .right{border:0!important;border-radius:0!important;box-shadow:none!important;min-height:100%!important;background:#000!important}
      .viz-head,.legend,.capture-banner,.top-embed-bar,.back-chip,.home-chip{display:none!important}
      .viz-wrap{min-height:100vh!important;height:100vh!important;background:#000!important;cursor:zoom-in;display:flex;align-items:flex-start;justify-content:flex-start;overflow:auto}
      #vizCanvas{width:auto!important;height:auto!important;max-width:100%!important;max-height:none!important;background:#000!important;flex:0 0 auto;display:block}
      .chart-close{display:none!important}
    `;
    doc.head.appendChild(style);
    addFullscreenClick(doc, '#vizWrap');
  }
}

async function prepareEmbeddedView(mode) {
  try {
    const doc = await waitForIframe(frameMap[mode]);
    applyUnifiedChartView(doc, mode);
  } catch (error) {
    console.warn('Falha ao preparar visualização', mode, error);
  }
}

function clearVisualization() {
  Object.values(frameMap).forEach(frame => frame.classList.remove('active'));
  document.querySelectorAll('.viewer-tab').forEach(btn => btn.classList.remove('active'));
  els.viewerPane.classList.add('is-empty');
  els.vizPlaceholder.hidden = false;
  els.vizSubtitle.textContent = mapVizLabel('');
  els.visualSelect.value = '';
}

function setVisualization(mode, forceShow = true) {
  if (!mode) {
    clearVisualization();
    return;
  }
  if (forceShow) {
    els.viewerPane.classList.remove('is-empty');
    els.vizPlaceholder.hidden = true;
  }
  Object.entries(frameMap).forEach(([key, frame]) => frame.classList.toggle('active', key === mode));
  document.querySelectorAll('.viewer-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.viz === mode));
  els.visualSelect.value = mode;
  els.vizSubtitle.textContent = mapVizLabel(mode);
  prepareEmbeddedView(mode);
}

function setupAutoAdvance() {
  const rules = [
    { el: els.base, next: els.departure },
    { el: els.departure, next: els.config },
    { el: els.config, next: els.visualSelect },
    { el: els.visualSelect, next: els.pa },
    { el: els.pa, next: els.oat, minDigits: 3, maxDigits: 5 },
    { el: els.oat, next: els.weight, minDigits: 2, maxDigits: 2 },
    { el: els.weight, next: els.wind, minDigits: 4, maxDigits: 4 },
    { el: els.wind, next: els.runBtn, minDigits: 1, maxDigits: 2 },
  ];

  rules.forEach((rule) => {
    if (!rule.el) return;
    if (rule.el.tagName === 'SELECT') {
      rule.el.addEventListener('change', () => focusNext(rule.next));
      return;
    }

    rule.el.addEventListener('input', () => {
      sanitizeDigitsInput(rule.el, rule.maxDigits);
      const digits = digitsOnlyLength(rule.el);
      if (rule.el === els.oat ? digits === rule.minDigits : digits >= rule.minDigits) {
        focusNext(rule.next);
      }
    });

    rule.el.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      if (rule.next === els.runBtn) els.runBtn.click();
      else focusNext(rule.next);
    });
  });

  els.paNegativeBtn?.addEventListener('click', () => toggleSignedInput(els.pa, 5));
  els.oatNegativeBtn?.addEventListener('click', () => toggleSignedInput(els.oat, 2));
}

async function runFlow() {
  const input = collectInputs();
  pushSharedContext(input);
  els.statusChip.textContent = 'Calculando…';
  els.statusChip.className = 'status-chip warn';
  els.resultCard.classList.remove('result-ok', 'result-bad');
  try {
    const wat = await runWAT(input);
    const rto = await runRTO(input);
    const adc = await runADC(input, rto);
    renderResults(wat, rto, adc);
    setVisualization(els.visualSelect.value || 'adc');
  } catch (error) {
    console.error(error);
    els.statusChip.textContent = 'Erro na integração';
    els.statusChip.className = 'status-chip bad';
    els.resultCard.classList.remove('result-ok');
    els.resultCard.classList.add('result-bad');
  }
}

function saveCurrentInputsForModuleOpen() {
  const input = collectInputs();
  pushSharedContext(input);
  return input;
}

function bindEvents() {
  els.runBtn.addEventListener('click', runFlow);
  els.visualSelect.addEventListener('change', e => setVisualization(e.target.value, !!e.target.value));
  document.querySelectorAll('.viewer-tab').forEach(btn => btn.addEventListener('click', () => setVisualization(btn.dataset.viz, true)));
  els.openWATBtn.addEventListener('click', () => {
    saveCurrentInputsForModuleOpen();
    location.href = '../wat/?back=1&return=' + encodeURIComponent('../cata/');
  });
  els.openRTOBtn.addEventListener('click', () => {
    saveCurrentInputsForModuleOpen();
    location.href = '../rto/?back=1&return=' + encodeURIComponent('../cata/');
  });
  els.openADCBtn.addEventListener('click', () => {
    saveCurrentInputsForModuleOpen();
    location.href = '../adc/?back=1&return=' + encodeURIComponent('../cata/');
  });
  els.sidebarToggleBtn.addEventListener('click', () => setSidebarCollapsed());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && els.viewerPane.classList.contains('viz-fullscreen')) toggleVizFullscreen(false);
  });
}

window.addEventListener('load', async () => {
  bindEvents();
  setupAutoAdvance();
  clearVisualization();
  try {
    await Promise.all([
      waitForIframe(adcFrame, ['baseSelect', 'departureEndSelect']),
      waitForIframe(watFrame, ['procedure', 'configuration', 'runBtn']),
      waitForIframe(rtoFrame, ['configuration', 'runBtn'])
    ]);
    await populateBaseOptions();
    await Promise.all([prepareEmbeddedView('adc'), prepareEmbeddedView('wat'), prepareEmbeddedView('rto')]);
  } catch (error) {
    console.error('Falha ao inicializar integração', error);
  }
});
