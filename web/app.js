import { ceilInt, createBaseContext, parseDurationToMinutes, computeAll } from './lib/calc.js';
import { parseTsv } from './lib/tsv.js';
import { normalizeData } from './lib/data.js';

const LS_KEY = 'carcalc.web.data.v1';
const LS_INPUTS_KEY = 'carcalc.web.inputs.v1';

function $(id) { return document.getElementById(id); }

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
  if (!startVal) throw new Error('Start datetime is required.');
  const start = new Date(startVal);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid start datetime.');

  const totalMin = Math.max(0, parseDurationToMinutes($('totalTime').value));
  const parkingMin = Math.max(0, parseDurationToMinutes($('parkingTime').value));
  if (parkingMin > totalMin) throw new Error('Parking time must be <= total time.');

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
  sel.innerHTML = '<option value="">All providers</option>';
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
  const filtered = computed.filter(r => {
    if (providerFilter && r.provider_id !== providerFilter) return false;
    if (!q) return true;
    const hay = `${r.provider_id} ${r.provider_name} ${r.vehicle_name} ${r.option_name} ${r.option_type}`.toLowerCase();
    return hay.includes(q);
  });

  $('summary').textContent = `${filtered.length} options ranked · distance ${ctx.distKm} km · total ${ctx.totalMin} min (${ctx.days} day block${ctx.days>1?'s':''})`;

  let i = 0;
  for (const row of filtered) {
    i++;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="muted">${i}</td>
      <td><span class="pill">${escapeHtml(row.provider_name)}</span></td>
      <td>${escapeHtml(row.vehicle_name)}</td>
      <td>
        <div class="rowTitle">
          <div>${escapeHtml(row.option_name)}</div>
          <span class="pill">${escapeHtml(row.option_type)}</span>
        </div>
        <details class="details">
          <summary>Breakdown</summary>
          <div class="detailsGrid">
            ${Number(row.breakdown.plan_eur || 0) > 0 ? kv(row.breakdown.labels?.plan || 'Package', row.breakdown.plan_eur, row.breakdown.tooltips?.plan) : ''}
            ${Number(row.breakdown.trip_eur || 0) > 0 ? kv(row.breakdown.labels?.trip || 'Trip fee', row.breakdown.trip_eur, row.breakdown.tooltips?.trip) : ''}
            ${kv(row.breakdown.labels?.time || 'Time', row.breakdown.time_eur, row.breakdown.tooltips?.time)}
            ${kv(row.breakdown.labels?.km || 'Km', row.breakdown.km_eur, row.breakdown.tooltips?.km)}
            ${kv(row.breakdown.labels?.fees || 'Fees', row.breakdown.fees_eur, row.breakdown.tooltips?.fees)}
            ${kv('Airport', row.breakdown.airport_eur)}
            ${kv('Fuel', row.breakdown.fuel_eur)}
            ${Number(row.breakdown.min_added_eur || 0) > 0 ? kv('Min added', Number(row.breakdown.min_added_eur || 0)) : ''}
            ${Number(row.breakdown.cap_saved_eur || 0) > 0 ? kv('Time cap saved', -Number(row.breakdown.cap_saved_eur || 0)) : ''}
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

function formatCalcLine(b) {
  const m = b.meta || {};
  const optType = String(m.option_type || '').trim().toUpperCase();

  const fmtRate = (x, digits = 2) => `€${Number(x || 0).toFixed(digits)}`;
  const fmtEur = (x) => `€${Number(x || 0).toFixed(2)}`;

  const lines = [];

  const kmEq = (() => {
    const charged = Number(m.charged_km ?? 0);
    const rate = Number(m.km_rate_eur ?? 0);
    const raw = fmtEur(b.km_eur);
    const inc = Number(m.included_km ?? 0);
    if (charged <= 0) return `Km: ${m.total_km ?? ''} km (included ${inc} km) = ${raw}`;
    return `Km: ${charged} km × ${fmtRate(rate)}/km = ${raw}`;
  })();

  const capSuffix = () => {
    if (!m.cap_applied || m.cap_value_eur == null) return '';
    return ` → capped to ${fmtEur(b.time_eur)} (${m.days ?? 1}×${fmtEur(m.cap_value_eur)}/day)`;
  };

  if (optType === 'PACKAGE') {
    const includedMin = Number(m.included_min ?? 0);
    const includedKm = Number(m.included_km ?? 0);
    lines.push(`Package: ${fmtEur(b.plan_eur)} (includes ${includedMin} min, ${includedKm} km)`);

    const overMin = Number(m.over_min || 0);
    const rate = Number(m.blended_rate_eur_per_min || 0);
    const timeRaw = fmtEur(m.time_raw_eur != null ? m.time_raw_eur : b.time_eur);
    lines.push(`Time overage: ${overMin} min × ${fmtRate(rate, 4)}/min = ${timeRaw}${capSuffix()}`);

    const charged = Number(m.charged_km ?? 0);
    if (charged > 0) lines.push(`Km overage: ${charged} km × ${fmtRate(m.km_rate_eur)}/km = ${fmtEur(b.km_eur)}`);
    else lines.push(kmEq);
  } else if (optType === 'DAILY') {
    // Daily rentals: show the plan, then km (time is typically "included").
    const days = Number(m.days ?? 1);
    const perDay = days > 0 ? (Number(b.plan_eur || 0) / days) : 0;
    lines.push(`Daily: ${days} × ${fmtEur(perDay)} = ${fmtEur(b.plan_eur)}`);
    lines.push(kmEq);
    if (Number(b.time_eur || 0) > 0) lines.push(`Time: ${fmtEur(b.time_eur)}${capSuffix()}`);
  } else {
    // PAYG (or unknown): show time buckets when possible.
    const segs = [];
    const pushSeg = (label, mins, rate) => {
      const mm = Number(mins || 0);
      if (mm <= 0) return;
      const rr = Number(rate || 0);
      segs.push(`${label} ${mm} min × ${fmtRate(rr)}/min = ${fmtEur(mm * rr)}`);
    };
    pushSeg('Drive(day):', m.drive_day_min, m.drive_day_rate);
    pushSeg('Drive(night):', m.drive_night_min, m.drive_night_rate);
    pushSeg('Park(day):', m.park_day_min, m.park_day_rate);
    pushSeg('Park(night):', m.park_night_min, m.park_night_rate);

    const timeRaw = fmtEur(m.time_raw_eur != null ? m.time_raw_eur : b.time_eur);
    if (segs.length) {
      const compact = segs.join(' + ');
      lines.push(`Time: ${compact} = ${timeRaw}${capSuffix()}`);
    } else {
      lines.push(`Time: ${fmtEur(b.time_eur)}${capSuffix()}`);
    }
    lines.push(kmEq);
  }

  const fees = Number(b.fees_eur || 0);
  if (fees > 0) lines.push(`Fees: ${fmtEur(fees)}`);

  const minTotal = Number(m.min_total_eur || 0);
  const minAdded = Number(b.min_added_eur || 0);
  if (minTotal > 0) {
    lines.push(minAdded > 0 ? `Minimum: applied (+${fmtEur(minAdded)} to reach ${fmtEur(minTotal)})` : `Minimum: ${fmtEur(minTotal)} (not applied)`);
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
  for (const id of ['start','totalTime','parkingTime','distanceKm','airport','fuelPrice','consumption','q','providerFilter']) {
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
  el.textContent = `Some options could not be priced (${lines.length}). First: ${lines[0]}`;
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
  const defaults = await loadDefaultData();
  restoreInputsOrDefaults();
  wireDataDialog(defaults);
  wireInputs(defaults);
  recalc(defaults);
}

main().catch(err => {
  console.error(err);
  alert(`Failed to start app: ${err.message || err}`);
});
