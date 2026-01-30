const STRINGS = {
  lv: {
    // Global
    title: 'CarShareCalc — Rīga',
    subtitle: 'Rīga · CarGuru · CityBee · Bolt Drive',
    lang_label: 'Valoda',

    // Top actions
    advanced: 'Paplašināti',
    advanced_title: 'Paplašināti: rediģēt cenu tabulas',
    advanced_aria: 'Atvērt paplašinātos iestatījumus',
    reset: 'Atiestatīt',
    reset_title: 'Atiestatīt ievadi',
    reset_aria: 'Atiestatīt ievadi',

    // Inputs
    estimate_title: 'Aprēķināt braucienu',
    estimate_hint: 'Pieņemts vienvirziena brauciens. Ja plānojat atgriezties, pieskaitiet atpakaļceļa laiku/attālumu.',
    estimate_hint2: 'Nakts tarifi atkarīgi no vietējā laika (izmanto ierīces laika joslu).',

    // Discounts
    discounts_header: 'Atlaides',
    discounts_hint: 'Ievadiet savas atlaides (piem., 15 = 15%, 10 = 10 minūtes).',
    discount_carguru: 'CarGuru % atlaide',
    discount_citybee_percent: 'CityBee % atlaide',
    discount_citybee_minutes: 'CityBee minūšu atlaide',
    discount_bolt: 'Bolt Drive % atlaide',
    discount_breakdown: 'Atlaides',

    start_label: 'Sākuma laiks (jūsu ierīcē)',
    start_hint: 'Braucieniem Rīgā iestatiet ierīces laika joslu uz Europe/Riga, lai nakts tarifi būtu precīzi.',

    total_time_label: 'Kopējais laiks (HH:MM)',
    total_time_hint: 'Atbalsta >24h (piem., 36:00)',

    standstill_label: 'Stāvēšana (noparkots, bet tiek rēķināts) (HH:MM)',
    standstill_hint: '≤ kopējais laiks · dažiem stāvēšana ir citā tarifā',

    distance_label: 'Attālums (km)',
    distance_hint: 'Noapaļo uz augšu līdz nākamajam km',

    airport_label: 'Lidostas zona (paņemšana vai nodošana)',
    airport_hint: 'Dažiem atšķiras paņemšana vs nodošana (nākotnē)',

    fuel_price_e95_label: 'E95 cena (€/L)',
    fuel_price_diesel_label: 'Dīzeļa cena (€/L)',
    consumption_override_label: 'Patēriņš (L/100km)',
    consumption_override_enable: 'Pārrakstīt auto novērtējumu',
    consumption_auto_hint: 'Auto novērtējums no publiskiem avotiem; sliktākā (lielākā patēriņa) vērtība ar Rīgas korekciju (×1.15), lai nenovērtētu izmaksas par zemu.',
    fuel_hint: 'Degvielas izmaksas pieskaita tikai, ja degviela nav iekļauta.',

    // Results
    results_title: 'Rezultāti',
    legend: 'Leģenda:',
    tap_to_filter: 'pieskarieties, lai filtrētu',
    payg_desc: 'maksa par minūtēm + km',
    package_desc: 'iekļauts laiks + km (pārsniegums tiek rēķināts)',
    daily_desc: 'dienas noma',

    filter_placeholder: 'Meklēt (kompānija / auto / tarifs)...',
    filter_snowboard: 'Snovborda soma (163 cm)',
    all_providers: 'Visas kompānijas',
    top_50: 'Top 50',
    top_100: 'Top 100',
    all: 'Visi',
    limit_title: 'Rādīt top rezultātus',
    github_title: 'Atvērt GitHub repozitoriju',
    github_aria: 'Atvērt GitHub',

    th_index: '#',
    th_provider: 'Kompānija',
    th_vehicle: 'Auto',
    th_plan: 'Tarifs',
    th_total: 'Kopā (€)',

    breakdown: 'Sīkāk',

    // Summary
    summary: ({ shown, matched, km, minutes, days }) =>
      `${shown} rādīti (${matched} atbilst) · ${km} km · ${minutes} min · rēķins: ${days} × 24h (limiti/paketes uz katrām 24h)`,
    summary_all: ({ shown, km, minutes, days }) =>
      `${shown} rādīti · ${km} km · ${minutes} min · rēķins: ${days} × 24h (limiti/paketes uz katrām 24h)`,

    // Breakdown tiles / labels
    label_package: 'Pakete',
    label_daily: 'Dienas noma',
    label_trip_fee: 'Brauciena maksa',
    label_time: 'Laiks',
    label_time_capped: 'Laiks (ar limitu)',
    label_km: 'Km',
    label_fees: 'Maksas',
    label_airport: 'Lidosta',
    label_fuel: 'Degviela',
    label_min_added: 'Min. piemaksa',
    label_time_cap_saved: 'Ietaupīts (laika limits)',
    label_discount: 'Atlaide',

    // Row hint
    hint_package: 'Pakete',
    hint_daily: 'Dienas noma',
    hint_time: 'Laiks',
    hint_time_capped: 'Laiks (ar limitu)',
    hint_km: 'Km',
    hint_fees: 'Maksas',
    hint_airport: 'Lidosta',
    hint_fuel: 'Degviela',
    hint_minimum: 'Minimums',
    hint_applied: '(piemērots)',

    // Calc line
    calc_package: ({ eur, incMin, incKm }) => `Pakete: €${eur} (iekļauts ${incMin} min, ${incKm} km)`,
    calc_time_overage: ({ overMin, rate, eur }) => `Laika pārsniegums: ${overMin} min × €${rate}/min = €${eur}`,
    calc_km_overage: ({ km, rate, eur }) => `Km pārsniegums: ${km} km × €${rate}/km = €${eur}`,
    calc_time: ({ expr, eur }) => `Laiks: ${expr} = €${eur}`,
    calc_km: ({ expr, eur }) => `Km: ${expr} = €${eur}`,
    calc_capped: ({ eur, cap, days }) => ` → ierobežots līdz €${eur} (${days}×€${cap}/dienā)`,
    calc_fees: ({ eur }) => `Maksas: €${eur}`,
    calc_fuel: ({ src, expr, eur }) => `Degviela${src}: ${expr} = €${eur}`,
    calc_min_applied: ({ add, min }) => `Minimums: piemērots (+€${add} līdz €${min})`,
    calc_min_not_applied: ({ min }) => `Minimums: €${min} (nav piemērots)`,
    fuel_src_override: '(pārrakstīts)',
    fuel_src_vehicle: '(auto)',
    fuel_src_fallback: '(noklusēti 8)',

    // PAYG bucket labels (used in breakdown calc lines)
    drive_day: 'Braukšana (diena):',
    drive_night: 'Braukšana (nakts):',
    park_day: 'Stāvēšana (diena):',
    park_night: 'Stāvēšana (nakts):',

    // Tooltips
    tt_filter_provider: 'Filtrēt pēc kompānijas',
    tt_snowboard_fit_1: 'Snovborda soma (163 cm): der, bet šauri (pasažierim var būt neērti)',
    tt_snowboard_fit_2: 'Snovborda soma (163 cm): der labi (priekšējam pasažierim OK)',
    tt_snowboard_fit_label: 'Snovborda somas piemērotība',

    // Errors
    err_start_required: 'Nepieciešams sākuma laiks.',
    err_start_invalid: 'Nederīgs sākuma laiks.',
    err_parking_le_total: 'Stāvēšanas laikam jābūt ≤ kopējam laikam.',
    err_duration_invalid: 'Nederīgs laika formāts. Izmantojiet HH:MM (piem., 1:30).',

    // Advanced dialog
    adv_title: 'Paplašināti (cenu dati)',
    adv_subtitle: 'Rediģējiet cenu tabulas TSV formātā. Saglabājas lokāli šajā pārlūkā (localStorage).',
    adv_close: 'Aizvērt',
    adv_callout:
      'Izmantojiet, ja cenas mainās vai vēlaties pievienot auto. Lai pievienotu auto: pievienojiet rindu sadaļā “Vehicles”, pēc tam pievienojiet vienu vai vairākas rindas sadaļā “Options” ar to pašu vehicle_id.',
    tab_providers: 'Kompānijas',
    tab_vehicles: 'Auto',
    tab_options: 'Tarifi',
    cols_providers: 'Kolonnas: provider_id, provider_name, night_start, night_end',
    cols_vehicles: 'Kolonnas: provider_id, vehicle_id, vehicle_name, vehicle_class, snowboard_fit, snowboard_source_url',
    cols_options: 'Kolonnām jāatbilst web/data/options.tsv virsrakstam.',
    adv_load_defaults: 'Ielādēt noklusējumus',
    adv_reset_saved: 'Dzēst saglabātos datus',
    adv_save: 'Saglabāt un pārrēķināt',

    // Errors banner
    pricing_errors: ({ n, first }) => `Dažām opcijām nevar aprēķināt cenu (${n}). Pirmā: ${first}`,
  },

  en: {
    title: 'CarShareCalc — Riga',
    subtitle: 'Riga · CarGuru · CityBee · Bolt Drive',
    lang_label: 'Language',

    advanced: 'Advanced',
    advanced_title: 'Advanced: edit pricing tables',
    advanced_aria: 'Open advanced settings',
    reset: 'Reset',
    reset_title: 'Reset inputs',
    reset_aria: 'Reset inputs',

    estimate_title: 'Estimate a trip',
    estimate_hint: 'One-way assumed. If you plan to return, add return time/distance to the inputs.',
    estimate_hint2: 'Night pricing depends on local time (uses your device timezone).',

    // Discounts
    discounts_header: 'Discounts',
    discounts_hint: 'Enter values (e.g., 15 for 15% off, 10 for 10 minutes off).',
    discount_carguru: 'CarGuru % discount',
    discount_citybee_percent: 'CityBee % discount',
    discount_citybee_minutes: 'CityBee minutes off',
    discount_bolt: 'Bolt Drive % discount',
    discount_breakdown: 'Discount',

    start_label: 'Start time (your device)',
    start_hint: 'For Riga trips, set your device timezone to Europe/Riga for accurate night rates.',

    total_time_label: 'Total time (HH:MM)',
    total_time_hint: 'Supports 24h+ (e.g., 36:00)',

    standstill_label: 'Standstill (parked but billed) (HH:MM)',
    standstill_hint: '≤ total time · some providers price parking differently',

    distance_label: 'Distance (km)',
    distance_hint: 'Rounded up to next km',

    airport_label: 'Airport zone (either pickup or dropoff)',
    airport_hint: 'Some providers differ by pickup vs dropoff (future)',

    fuel_price_e95_label: 'E95 price (€/L)',
    fuel_price_diesel_label: 'Diesel price (€/L)',
    consumption_override_label: 'Consumption override (L/100km)',
    consumption_override_enable: 'Override auto estimate',
    consumption_auto_hint: 'Auto estimate from public sources; worst-case (least efficient) value with Riga adjustment (×1.15) to avoid underestimating cost.',
    fuel_hint: 'Fuel cost is added only when fuel is not included.',

    results_title: 'Results',
    legend: 'Legend:',
    tap_to_filter: 'tap to filter',
    payg_desc: 'pay per minute + km',
    package_desc: 'includes time + km (overage applies)',
    daily_desc: 'daily rental',

    filter_placeholder: 'Filter (provider / car / option)...',
    filter_snowboard: 'Snowboard bag (163 cm)',
    all_providers: 'All providers',
    top_50: 'Top 50',
    top_100: 'Top 100',
    all: 'All',
    limit_title: 'Show top results',
    github_title: 'Open GitHub repository',
    github_aria: 'Open GitHub',

    th_index: '#',
    th_provider: 'Provider',
    th_vehicle: 'Vehicle',
    th_plan: 'Plan',
    th_total: 'Total (€)',

    breakdown: 'Breakdown',

    summary: ({ shown, matched, km, minutes, days }) =>
      `${shown} shown (${matched} match) · ${km} km · ${minutes} min · billing: ${days} × 24h (caps/packages apply per 24h)`,
    summary_all: ({ shown, km, minutes, days }) =>
      `${shown} shown · ${km} km · ${minutes} min · billing: ${days} × 24h (caps/packages apply per 24h)`,

    label_package: 'Package',
    label_daily: 'Daily',
    label_trip_fee: 'Trip fee',
    label_time: 'Time',
    label_time_capped: 'Time (capped)',
    label_km: 'Km',
    label_fees: 'Fees',
    label_airport: 'Airport',
    label_fuel: 'Fuel',
    label_min_added: 'Min added',
    label_time_cap_saved: 'Time cap saved',
    label_discount: 'Discount',

    hint_package: 'Package',
    hint_daily: 'Daily',
    hint_time: 'Time',
    hint_time_capped: 'Time (capped)',
    hint_km: 'Km',
    hint_fees: 'Fees',
    hint_airport: 'Airport',
    hint_fuel: 'Fuel',
    hint_minimum: 'Minimum',
    hint_applied: '(applied)',

    calc_package: ({ eur, incMin, incKm }) => `Package: €${eur} (includes ${incMin} min, ${incKm} km)`,
    calc_time_overage: ({ overMin, rate, eur }) => `Time overage: ${overMin} min × €${rate}/min = €${eur}`,
    calc_km_overage: ({ km, rate, eur }) => `Km overage: ${km} km × €${rate}/km = €${eur}`,
    calc_time: ({ expr, eur }) => `Time: ${expr} = €${eur}`,
    calc_km: ({ expr, eur }) => `Km: ${expr} = €${eur}`,
    calc_capped: ({ eur, cap, days }) => ` → capped to €${eur} (${days}×€${cap}/day)`,
    calc_fees: ({ eur }) => `Fees: €${eur}`,
    calc_fuel: ({ src, expr, eur }) => `Fuel${src}: ${expr} = €${eur}`,
    calc_min_applied: ({ add, min }) => `Minimum: applied (+€${add} to reach €${min})`,
    calc_min_not_applied: ({ min }) => `Minimum: €${min} (not applied)`,
    fuel_src_override: '(override)',
    fuel_src_vehicle: '(vehicle)',
    fuel_src_fallback: '(fallback 8)',

    drive_day: 'Drive (day):',
    drive_night: 'Drive (night):',
    park_day: 'Park (day):',
    park_night: 'Park (night):',

    tt_filter_provider: 'Filter by provider',
    tt_snowboard_fit_1: 'Snowboard bag (163 cm): fits but tight (front passenger may be compromised)',
    tt_snowboard_fit_2: 'Snowboard bag (163 cm): fits well (front passenger OK)',
    tt_snowboard_fit_label: 'Snowboard fit details',

    err_start_required: 'Start datetime is required.',
    err_start_invalid: 'Invalid start datetime.',
    err_parking_le_total: 'Standstill must be <= total time.',
    err_duration_invalid: 'Invalid time format. Use HH:MM (e.g., 1:30).',

    adv_title: 'Advanced (pricing data)',
    adv_subtitle: 'Edit pricing tables in TSV format. Saved locally in this browser (localStorage).',
    adv_close: 'Close',
    adv_callout:
      'Use this if you spot a pricing change or want to add a car. To add a car: append a row in “Vehicles”, then add one or more matching rows in “Options” using the same vehicle_id.',
    tab_providers: 'Providers',
    tab_vehicles: 'Vehicles',
    tab_options: 'Options',
    cols_providers: 'Columns: provider_id, provider_name, night_start, night_end',
    cols_vehicles: 'Columns: provider_id, vehicle_id, vehicle_name, vehicle_class, snowboard_fit, snowboard_source_url',
    cols_options: 'Columns must match web/data/options.tsv header.',
    adv_load_defaults: 'Load defaults',
    adv_reset_saved: 'Reset saved data',
    adv_save: 'Save & Recalculate',

    pricing_errors: ({ n, first }) => `Some options could not be priced (${n}). First: ${first}`,
  },
};

function normalizeLangTag(tag) {
  const s = String(tag || '').trim().toLowerCase();
  if (!s) return null;
  const base = s.split('-')[0];
  if (base === 'lv') return 'lv';
  if (base === 'en') return 'en';
  return null;
}

export function detectLanguage(env) {
  const candidates = [];
  const e = env && typeof env === 'object' ? env : null;
  try {
    const langs = e?.languages ?? navigator.languages;
    const lang = e?.language ?? navigator.language;
    if (Array.isArray(langs) && langs.length) candidates.push(...langs);
    if (lang) candidates.push(lang);
  } catch {
    // ignore (non-browser)
  }
  for (const c of candidates) {
    const n = normalizeLangTag(c);
    if (n) return n;
  }
  // First fallback choice when browser has no preference: Latvian.
  return 'lv';
}

let CURRENT_LANG = 'lv';

export function getLang() {
  return CURRENT_LANG;
}

export function setLang(lang) {
  const n = normalizeLangTag(lang) || 'lv';
  CURRENT_LANG = n;
  try {
    document.documentElement.lang = n;
  } catch {
    // ignore
  }
  return n;
}

export function initI18n() {
  return setLang(detectLanguage());
}

export function t(key, params) {
  const dict = STRINGS[CURRENT_LANG] || STRINGS.lv;
  const fallback = STRINGS.lv;
  const v = dict[key] ?? fallback[key];
  if (typeof v === 'function') return v(params || {});
  if (v == null) return key;
  return String(v);
}
