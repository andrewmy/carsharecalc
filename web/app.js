import { ceilInt, createBaseContext, parseDurationToMinutes, computeAll } from './lib/calc.js';
import { parseTsv } from './lib/tsv.js';
import { normalizeData } from './lib/data.js';
import { initI18n, setLang, getLang, t } from './lib/i18n.js';

const LS_KEY = 'carcalc.web.data.v1';
const LS_INPUTS_KEY = 'carcalc.web.inputs.v1';
const LS_LANG_KEY = 'carcalc.web.lang.v1';

function $(id) { return document.getElementById(id); }

function applyTranslations() {
  document.title = t('title');
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const key = el.dataset.i18n;
    if (!key) continue;
    el.textContent = t(key);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = el.dataset.i18nPlaceholder;
    if (!key) continue;
    el.setAttribute('placeholder', t(key));
  }
  for (const el of document.querySelectorAll('[data-i18n-title]')) {
    const key = el.dataset.i18nTitle;
    if (!key) continue;
    el.setAttribute('title', t(key));
  }
  // A11y-only attributes
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) {
    const key = el.dataset.i18nAriaLabel;
    if (!key) continue;
    el.setAttribute('aria-label', t(key));
  }
}

function loadSavedLang() {
  try {
    const raw = localStorage.getItem(LS_LANG_KEY);
    const s = String(raw || '').trim().toLowerCase();
    if (s === 'lv' || s === 'en') return s;
    return null;
  } catch {
    return null;
  }
}

function saveLang(lang) {
  try {
    localStorage.setItem(LS_LANG_KEY, String(lang || '').trim().toLowerCase());
  } catch {
    // ignore
  }
}

function loadSavedInputs() {
  try {
    const raw = localStorage.getItem(LS_INPUTS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveInputsToLocalStorage(snapshot) {
  try {
    localStorage.setItem(LS_INPUTS_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

function optionTypeButtons() {
  return Array.from(document.querySelectorAll('.pill--toggle[data-type]'));
}

function getSelectedOptionTypesFromDom() {
  const buttons = optionTypeButtons();
  if (buttons.length === 0) return ['PAYG', 'PACKAGE', 'DAILY'];
  return buttons
    .filter((b) => b.classList.contains('is-active'))
    .map((b) => String(b.dataset.type || '').trim().toUpperCase())
    .filter(Boolean);
}

function applySelectedOptionTypesToDom(optionTypes) {
  const normalized =
    Array.isArray(optionTypes)
      ? optionTypes
      : String(optionTypes || '').split(',');
  const set = new Set(normalized.map((x) => String(x).trim().toUpperCase()).filter(Boolean));

  const buttons = optionTypeButtons();
  if (buttons.length === 0) return;
  for (const b of buttons) {
    const t = String(b.dataset.type || '').trim().toUpperCase();
    const active = set.size === 0 ? true : set.has(t);
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', active ? 'true' : 'false');
  }
}

function wireOptionTypeToggles(defaults) {
  const buttons = optionTypeButtons();
  if (buttons.length === 0) return;
  for (const b of buttons) {
    b.addEventListener('click', () => {
      const next = !b.classList.contains('is-active');
      b.classList.toggle('is-active', next);
      b.setAttribute('aria-pressed', next ? 'true' : 'false');

      // Prevent an empty selection: if user turns off the last one, turn all back on.
      const selected = getSelectedOptionTypesFromDom();
      if (selected.length === 0) applySelectedOptionTypesToDom(['PAYG', 'PACKAGE', 'DAILY']);

      saveInputsToLocalStorage(snapshotInputsFromDom());
      recalc(defaults);
    });
  }
}

function snapshotInputsFromDom() {
  return {
    start: $('start').value,
    totalTime: $('totalTime').value,
    parkingTime: $('parkingTime').value,
    distanceKm: $('distanceKm').value,
    airport: $('airport').checked,
    fuelPrice: $('fuelPrice').value,
    consumption: $('consumption').value,
    q: $('q').value,
    providerFilter: $('providerFilter').value,
    snowboardFilter: $('snowboardFilter').checked,
    limit: $('limit').value,
    optionTypes: getSelectedOptionTypesFromDom(),
  };
}

function applyInputsToDom(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return;
  if (typeof snapshot.start === 'string' && snapshot.start.trim()) $('start').value = snapshot.start;
  if (typeof snapshot.totalTime === 'string') $('totalTime').value = snapshot.totalTime;
  if (typeof snapshot.parkingTime === 'string') $('parkingTime').value = snapshot.parkingTime;
  if (snapshot.distanceKm != null) $('distanceKm').value = String(snapshot.distanceKm);
  if (typeof snapshot.airport === 'boolean') $('airport').checked = snapshot.airport;
  if (snapshot.fuelPrice != null) $('fuelPrice').value = String(snapshot.fuelPrice);
  if (snapshot.consumption != null) $('consumption').value = String(snapshot.consumption);
  if (typeof snapshot.q === 'string') $('q').value = snapshot.q;
  if (typeof snapshot.providerFilter === 'string') $('providerFilter').value = snapshot.providerFilter;
  if (typeof snapshot.snowboardFilter === 'boolean') $('snowboardFilter').checked = snapshot.snowboardFilter;
  if (snapshot.limit != null) $('limit').value = String(snapshot.limit);
  if (snapshot.optionTypes != null) applySelectedOptionTypesToDom(snapshot.optionTypes);
}

function nowLocalDatetimeValue() {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
  return await res.text();
}

function buildContextFromInputs(data) {
  const startVal = $('start').value;
  if (!startVal) throw new Error(t('err_start_required'));
  const start = new Date(startVal);
  if (Number.isNaN(start.getTime())) throw new Error(t('err_start_invalid'));

  let totalMin = 0;
  let parkingMin = 0;
  try {
    totalMin = Math.max(0, parseDurationToMinutes($('totalTime').value));
    parkingMin = Math.max(0, parseDurationToMinutes($('parkingTime').value));
  } catch {
    throw new Error(t('err_duration_invalid'));
  }
  if (parkingMin > totalMin) throw new Error(t('err_parking_le_total'));

  const distKm = ceilInt(Number($('distanceKm').value || 0));
  const airport = $('airport').checked;
  const fuelPrice = Number($('fuelPrice').value || 0);
  const consumption = Number($('consumption').value || 0);

  return createBaseContext({ start, totalMin, parkingMin, distKm, airport, fuelPrice, consumption });
}

function buildProviderOptions(providerId, options) {
  return options.filter(o => (o.provider_id || '').toLowerCase() === providerId);
}

async function loadDefaultData() {
  const [providersTsv, vehiclesTsv, optionsTsv] = await Promise.all([
    fetchText('./data/providers.tsv'),
    fetchText('./data/vehicles.tsv'),
    fetchText('./data/options.tsv'),
  ]);
  const providers = parseTsv(providersTsv).data;
  const vehicles = parseTsv(vehiclesTsv).data;
  const options = parseTsv(optionsTsv).data;
  return { providers, vehicles, options, providersTsv, vehiclesTsv, optionsTsv };
}

function loadSavedData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveDataToLocalStorage(tsvBundle) {
  localStorage.setItem(LS_KEY, JSON.stringify(tsvBundle));
}

function clearSavedData() {
  localStorage.removeItem(LS_KEY);
}

function getEffectiveData(defaults) {
  const saved = loadSavedData();
  if (!saved) return defaults;
  return {
    providers: parseTsv(saved.providersTsv || defaults.providersTsv).data,
    vehicles: parseTsv(saved.vehiclesTsv || defaults.vehiclesTsv).data,
    options: parseTsv(saved.optionsTsv || defaults.optionsTsv).data,
    providersTsv: saved.providersTsv || defaults.providersTsv,
    vehiclesTsv: saved.vehiclesTsv || defaults.vehiclesTsv,
    optionsTsv: saved.optionsTsv || defaults.optionsTsv,
  };
}

function setProviderFilterOptions(providers) {
  const sel = $('providerFilter');
  const current = sel.value;
  sel.innerHTML = `<option value="">${escapeHtml(t('all_providers'))}</option>`;
  for (const p of providers) {
    const opt = document.createElement('option');
    opt.value = p.provider_id;
    opt.textContent = p.provider_name || p.provider_id;
    sel.appendChild(opt);
  }
  sel.value = current;
}

function renderResults({ data, ctx, computed, query, providerFilter }) {
  const tbody = $('resultsBody');
  tbody.innerHTML = '';

  const q = (query || '').trim().toLowerCase();
  const selectedTypes = new Set(getSelectedOptionTypesFromDom().map((t) => String(t).toUpperCase()));
  const snowboardOnly = $('snowboardFilter').checked;
  const matched = computed.filter(r => {
    if (providerFilter && r.provider_id !== providerFilter) return false;
    if (snowboardOnly && Number(r.snowboard_fit || 0) <= 0) return false;
    if (selectedTypes.size > 0 && !selectedTypes.has(String(r.option_type || '').toUpperCase())) return false;
    if (!q) return true;
    const hay = `${r.provider_id} ${r.provider_name} ${r.vehicle_name} ${r.option_name} ${r.option_type}`.toLowerCase();
    return hay.includes(q);
  });

  const limitRaw = Number($('limit').value || 0);
  const limit = Number.isFinite(limitRaw) ? Math.max(0, Math.trunc(limitRaw)) : 0;
  const filtered = limit > 0 ? matched.slice(0, limit) : matched;

  if (limit > 0) {
    $('summary').textContent = t('summary', {
      shown: filtered.length,
      matched: matched.length,
      km: ctx.distKm,
      minutes: ctx.totalMin,
      days: ctx.days,
    });
  } else {
    $('summary').textContent = t('summary_all', {
      shown: filtered.length,
      km: ctx.distKm,
      minutes: ctx.totalMin,
      days: ctx.days,
    });
  }

  let i = 0;
  for (const row of filtered) {
    i++;
    const optType = String(row.option_type || '').trim().toUpperCase();
    const m = row.breakdown?.meta || {};
    const sb = Number(row.snowboard_fit || 0) || 0;
    const sbIcon = sb >= 2 ? '🏂🏂' : sb >= 1 ? '🏂' : '';
    const sbTitle = sb >= 2 ? t('tt_snowboard_fit_2') : sb >= 1 ? t('tt_snowboard_fit_1') : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="muted">${i}</td>
      <td>
        <button class="pill pill--link" type="button" data-provider="${escapeHtml(row.provider_id)}" title="${escapeHtml(t('tt_filter_provider'))}">
          ${escapeHtml(row.provider_name)}
        </button>
      </td>
      <td>
        <div class="rowTitle">
          <div>${escapeHtml(row.vehicle_name)}</div>
          ${sbIcon ? `<span class="pill" title="${escapeHtml(sbTitle)}">${sbIcon}</span>` : ''}
        </div>
      </td>
      <td>
        <div class="rowTitle">
          <div>${escapeHtml(row.option_name)}</div>
          <span class="pill">${escapeHtml(row.option_type)}</span>
        </div>
        <div class="rowHint muted">${escapeHtml(formatWhyHint(row.breakdown))}</div>
        <details class="details">
          <summary>${escapeHtml(t('breakdown'))}</summary>
          <div class="detailsGrid">
            ${Number(row.breakdown.plan_eur || 0) > 0 ? kv(optType === 'DAILY' ? t('label_daily') : t('label_package'), row.breakdown.plan_eur) : ''}
            ${Number(row.breakdown.trip_eur || 0) > 0 ? kv(t('label_trip_fee'), row.breakdown.trip_eur) : ''}
            ${kv(m.cap_applied ? t('label_time_capped') : t('label_time'), row.breakdown.time_eur)}
            ${kv(t('label_km'), row.breakdown.km_eur)}
            ${kv(t('label_fees'), row.breakdown.fees_eur)}
            ${kv(t('label_airport'), row.breakdown.airport_eur)}
            ${kv(t('label_fuel'), row.breakdown.fuel_eur)}
            ${Number(row.breakdown.min_added_eur || 0) > 0 ? kv(t('label_min_added'), Number(row.breakdown.min_added_eur || 0)) : ''}
            ${Number(row.breakdown.cap_saved_eur || 0) > 0 ? kv(t('label_time_cap_saved'), -Number(row.breakdown.cap_saved_eur || 0)) : ''}
          </div>
          <div class="calcLine"><code>${escapeHtml(formatCalcLine(row.breakdown))}</code></div>
        </details>
      </td>
      <td class="num"><strong>${row.total_eur.toFixed(2)}</strong></td>
    `;
    tbody.appendChild(tr);
  }

  function kv(label, value, tooltip) {
    const v = Number(value) || 0;
    const sign = v < 0 ? '−' : '';
    const t = tooltip ? ` title="${escapeHtml(String(tooltip))}"` : '';
    return `
      <div class="kv"${t}>
        <div class="k">${escapeHtml(label)}</div>
        <div class="v">${sign}€ ${Math.abs(v).toFixed(2)}</div>
      </div>
    `;
  }
}

function formatWhyHint(b) {
  const m = b.meta || {};
  const optType = String(m.option_type || '').trim().toUpperCase();

  const parts = [];
  const add = (label, value, extra = '') => {
    const v = Number(value || 0);
    if (!(v > 0)) return;
    const suffix = extra ? ` ${extra}` : '';
    parts.push(`${label} €${v.toFixed(2)}${suffix}`);
  };

  if (optType === 'PACKAGE') add(t('hint_package'), b.plan_eur);
  else if (optType === 'DAILY') add(t('hint_daily'), b.plan_eur);

  const capped = String(b.labels?.time || '').toLowerCase().includes('capped') || !!m.cap_applied;
  add(capped ? t('hint_time_capped') : t('hint_time'), b.time_eur);
  add(t('hint_km'), b.km_eur);
  add(t('hint_fees'), b.fees_eur);
  add(t('hint_airport'), b.airport_eur);
  add(t('hint_fuel'), b.fuel_eur);
  if (Number(b.min_added_eur || 0) > 0) add(t('hint_minimum'), b.min_added_eur, t('hint_applied'));

  // Keep it scannable: show up to 4 parts, then summarize.
  const max = 4;
  if (parts.length <= max) return parts.join(' + ') || '—';
  const head = parts.slice(0, max).join(' + ');
  return `${head} + ${parts.length - max} more`;
}

function formatCalcLine(b) {
  const m = b.meta || {};
  const optType = String(m.option_type || '').trim().toUpperCase();

  const fmtRate = (x, digits = 2) => Number(x || 0).toFixed(digits);
  const fmtEur = (x) => Number(x || 0).toFixed(2);

  const lines = [];

  const kmEq = () => {
    const charged = Number(m.charged_km ?? 0);
    const rate = Number(m.km_rate_eur ?? 0);
    const raw = fmtEur(b.km_eur);
    const inc = Number(m.included_km ?? 0);
    if (charged <= 0) return t('calc_km', { expr: `${m.total_km ?? ''} km (included ${inc} km)`, eur: raw });
    return t('calc_km', { expr: `${charged} km × €${fmtRate(rate)}/km`, eur: raw });
  };

  const capSuffix = () => {
    if (!m.cap_applied || m.cap_value_eur == null) return '';
    return t('calc_capped', { eur: fmtEur(b.time_eur), cap: fmtEur(m.cap_value_eur), days: m.days ?? 1 });
  };

  if (optType === 'PACKAGE') {
    const includedMin = Number(m.included_min ?? 0);
    const includedKm = Number(m.included_km ?? 0);
    lines.push(t('calc_package', { eur: fmtEur(b.plan_eur), incMin: includedMin, incKm: includedKm }));

    const overMin = Number(m.over_min || 0);
    const rate = Number(m.blended_rate_eur_per_min || 0);
    const timeRaw = fmtEur(m.time_raw_eur != null ? m.time_raw_eur : b.time_eur);
    lines.push(`${t('calc_time_overage', { overMin, rate: fmtRate(rate, 4), eur: timeRaw })}${capSuffix()}`);

    const charged = Number(m.charged_km ?? 0);
    if (charged > 0) lines.push(t('calc_km_overage', { km: charged, rate: fmtRate(m.km_rate_eur), eur: fmtEur(b.km_eur) }));
    else lines.push(kmEq());
  } else if (optType === 'DAILY') {
    // Daily rentals: show the plan, then km (time is typically "included").
    const days = Number(m.days ?? 1);
    const perDay = days > 0 ? (Number(b.plan_eur || 0) / days) : 0;
    lines.push(`${t('label_daily')}: ${days} × €${fmtEur(perDay)} = €${fmtEur(b.plan_eur)}`);
    lines.push(kmEq());
    if (Number(b.time_eur || 0) > 0) lines.push(`${t('label_time')}: €${fmtEur(b.time_eur)}${capSuffix()}`);
  } else {
    // PAYG (or unknown): show time buckets when possible.
    const segs = [];
    const pushSeg = (label, mins, rate) => {
      const mm = Number(mins || 0);
      if (mm <= 0) return;
      const rr = Number(rate || 0);
      segs.push(`${label} ${mm} min × €${fmtRate(rr)}/min = €${fmtEur(mm * rr)}`);
    };
    pushSeg(t('drive_day'), m.drive_day_min, m.drive_day_rate);
    pushSeg(t('drive_night'), m.drive_night_min, m.drive_night_rate);
    pushSeg(t('park_day'), m.park_day_min, m.park_day_rate);
    pushSeg(t('park_night'), m.park_night_min, m.park_night_rate);

    const timeRaw = fmtEur(m.time_raw_eur != null ? m.time_raw_eur : b.time_eur);
    if (segs.length) {
      const compact = segs.join(' + ');
      lines.push(`${t('label_time')}: ${compact} = €${timeRaw}${capSuffix()}`);
    } else {
      lines.push(`${t('label_time')}: €${fmtEur(b.time_eur)}${capSuffix()}`);
    }
    lines.push(kmEq());
  }

  const fees = Number(b.fees_eur || 0);
  if (fees > 0) lines.push(t('calc_fees', { eur: fmtEur(fees) }));

  const minTotal = Number(m.min_total_eur || 0);
  const minAdded = Number(b.min_added_eur || 0);
  if (minTotal > 0) {
    lines.push(
      minAdded > 0
        ? t('calc_min_applied', { add: fmtEur(minAdded), min: fmtEur(minTotal) })
        : t('calc_min_not_applied', { min: fmtEur(minTotal) }),
    );
  }

  return lines.filter(Boolean).join('\n');
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('\r\n', '&#10;')
    .replaceAll('\n', '&#10;')
    .replaceAll('\r', '&#10;');
}

function wireClickableProviderPills(defaults) {
  const tbody = $('resultsBody');
  tbody.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest ? e.target.closest('button[data-provider]') : null;
    if (!btn) return;
    const providerId = String(btn.dataset.provider || '').trim().toLowerCase();
    if (!providerId) return;

    const current = ($('providerFilter').value || '').trim().toLowerCase();
    $('providerFilter').value = current === providerId ? '' : providerId;
    saveInputsToLocalStorage(snapshotInputsFromDom());
    recalc(defaults);
  });
}

function wireLanguageDropdown(defaults) {
  const sel = $('lang');
  if (!sel) return;

  // Set initial UI state
  sel.value = getLang();
  sel.setAttribute('data-i18n-aria-label', 'lang_label');
  sel.setAttribute('aria-label', t('lang_label'));

  sel.addEventListener('change', () => {
    const next = String(sel.value || '').trim().toLowerCase();
    const applied = setLang(next);
    sel.value = applied;
    saveLang(applied);
    applyTranslations();
    recalc(defaults);
  });
}

function wireDataDialog(defaults) {
  const dlg = $('dataDialog');
  const btnData = $('btn-data');
  const btnSave = $('btn-save-data');
  const btnLoadDefaults = $('btn-load-defaults');
  const btnResetData = $('btn-reset-data');

  const providersTA = $('providersTsv');
  const vehiclesTA = $('vehiclesTsv');
  const optionsTA = $('optionsTsv');

  const tabs = Array.from(dlg.querySelectorAll('.tab'));
  const panels = Array.from(dlg.querySelectorAll('.tabPanel'));

  function setTab(name) {
    for (const t of tabs) t.classList.toggle('is-active', t.dataset.tab === name);
    for (const p of panels) p.classList.toggle('is-active', p.dataset.panel === name);
  }
  for (const t of tabs) t.addEventListener('click', () => setTab(t.dataset.tab));

  btnData.addEventListener('click', () => {
    const eff = getEffectiveData(defaults);
    providersTA.value = eff.providersTsv;
    vehiclesTA.value = eff.vehiclesTsv;
    optionsTA.value = eff.optionsTsv;
    setTab('providers');
    dlg.showModal();
  });

  btnLoadDefaults.addEventListener('click', () => {
    providersTA.value = defaults.providersTsv;
    vehiclesTA.value = defaults.vehiclesTsv;
    optionsTA.value = defaults.optionsTsv;
  });

  btnResetData.addEventListener('click', () => {
    clearSavedData();
    providersTA.value = defaults.providersTsv;
    vehiclesTA.value = defaults.vehiclesTsv;
    optionsTA.value = defaults.optionsTsv;
  });

  btnSave.addEventListener('click', () => {
    saveDataToLocalStorage({
      providersTsv: providersTA.value,
      vehiclesTsv: vehiclesTA.value,
      optionsTsv: optionsTA.value,
    });
    dlg.close();
    recalc(defaults);
  });
}

function setDefaultInputs() {
  // Defaults (used when no saved state exists)
  $('start').value = nowLocalDatetimeValue();
  $('totalTime').value = '1:00';
  $('parkingTime').value = '0:00';
  $('distanceKm').value = '10';
  $('airport').checked = false;
  $('fuelPrice').value = '1.70';
  $('consumption').value = '7.5';
  $('q').value = '';
  $('providerFilter').value = '';
  $('snowboardFilter').checked = false;
  $('limit').value = '50';
  applySelectedOptionTypesToDom(['PAYG', 'PACKAGE', 'DAILY']);
}

function restoreInputsOrDefaults() {
  const saved = loadSavedInputs();
  if (!saved) {
    setDefaultInputs();
    return;
  }
  setDefaultInputs();
  applyInputsToDom(saved);
}

function wireInputs(defaults) {
  const onChange = () => {
    saveInputsToLocalStorage(snapshotInputsFromDom());
    recalc(defaults);
  };
  for (const id of ['start','totalTime','parkingTime','distanceKm','airport','fuelPrice','consumption','q','providerFilter','snowboardFilter','limit']) {
    $(id).addEventListener('input', onChange);
    $(id).addEventListener('change', onChange);
  }
  $('btn-reset').addEventListener('click', () => {
    setDefaultInputs();
    saveInputsToLocalStorage(snapshotInputsFromDom());
    recalc(defaults);
  });
}

function showErrors(lines) {
  const el = $('errors');
  if (!lines || lines.length === 0) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.classList.remove('hidden');
  el.textContent = t('pricing_errors', { n: lines.length, first: lines[0] });
}

function recalc(defaults) {
  const eff = getEffectiveData(defaults);
  const data = normalizeData(eff);

  setProviderFilterOptions(data.providers);

  try {
    const ctxBase = buildContextFromInputs(data);
    const providerFilter = ($('providerFilter').value || '').trim().toLowerCase() || '';
    const { results, errors } = computeAll(data, ctxBase, providerFilter);
    showErrors(errors);
    renderResults({
      data,
      ctx: ctxBase,
      computed: results,
      query: $('q').value,
      providerFilter,
    });
  } catch (e) {
    showErrors([e.message || String(e)]);
    $('resultsBody').innerHTML = '';
    $('summary').textContent = '';
  }
}

async function main() {
  const savedLang = loadSavedLang();
  if (savedLang) setLang(savedLang);
  else initI18n();
  applyTranslations();
  const defaults = await loadDefaultData();
  restoreInputsOrDefaults();
  wireDataDialog(defaults);
  wireOptionTypeToggles(defaults);
  wireClickableProviderPills(defaults);
  wireLanguageDropdown(defaults);
  wireInputs(defaults);
  recalc(defaults);
}

main().catch(err => {
  console.error(err);
  alert(`Failed to start app: ${err.message || err}`);
});
