export function parseDurationToMinutes(text) {
  const s = String(text || '').trim();
  if (!s) return 0;
  const m = s.match(/^(\d+):([0-5]\d)$/);
  if (!m) throw new Error(`Invalid duration: ${s} (use HH:MM, minutes 00-59)`);
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export function ceilInt(n) {
  return Math.ceil(n);
}

export function roundToCents(x) {
  const v = Number(x) || 0;
  return Math.round((v + 1e-9) * 100) / 100;
}

export function toNumberMaybe(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  let cleaned = s.replace(/\u00a0/g, ' ').replace(/€/g, '').replace(/EUR/gi, '').trim();

  // Support common European formatting:
  // - "1 010" (space thousands)
  // - "1.010" (dot thousands)
  // - "1,50" (comma decimal)
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/[ .]/g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(/\s+/g, '');
    // Only treat dot-grouping as thousands if the integer part isn't 0
    // (avoids mis-parsing values like 0.280).
    if (/^-?\d{1,3}(?:\.\d{3})+$/.test(cleaned) && !/^-?0\.\d{3}$/.test(cleaned)) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }

  const m = cleaned.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

export function computeNightMinutes(start, end, nightStartStr, nightEndStr) {
  const parseHHMM = (s) => {
    const m = String(s || '').trim().match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  };

  const ns = parseHHMM(nightStartStr);
  const ne = parseHHMM(nightEndStr);
  if (ns == null || ne == null) return 0;
  if (!(end > start)) return 0;

  const crosses = ne <= ns;
  let total = 0;

  // Iterate local dates spanning the interval; include previous day for cross-midnight windows.
  let d = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1, 0, 0, 0, 0);
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1, 0, 0, 0, 0);

  while (d <= endDay) {
    const segStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    segStart.setMinutes(segStart.getMinutes() + ns);
    const segEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    segEnd.setMinutes(segEnd.getMinutes() + (crosses ? (1440 + ne) : ne));

    const overlapMs = Math.max(0, Math.min(end.getTime(), segEnd.getTime()) - Math.max(start.getTime(), segStart.getTime()));
    total += overlapMs / 60000;

    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  }

  return Math.max(0, Math.round(total)); // minutes
}

export function allocateParkingNight(totalMin, parkingMin, nightMin) {
  if (totalMin <= 0) return { parkNight: 0, parkDay: 0, driveNight: 0, driveDay: 0, dayMin: 0 };
  const dayMin = Math.max(0, totalMin - nightMin);
  const raw = (parkingMin * nightMin) / totalMin;
  const parkNight = Math.min(parkingMin, Math.min(nightMin, Math.ceil(raw)));
  const parkDay = parkingMin - parkNight;
  const driveNight = nightMin - parkNight;
  const driveDay = dayMin - parkDay;
  return { parkNight, parkDay, driveNight, driveDay, dayMin };
}

export function computeOptionPrice(ctx, option, vehicle) {
  const n = (k) => toNumberMaybe(option[k]);
  const z = (k) => n(k) ?? 0;

  const optionType = String(option.option_type || '').trim().toUpperCase();

  const RIGA_CONSUMPTION_FACTOR = 1.15;

  const vehicleFuelType = (() => {
    const raw = String(vehicle?.fuel_type ?? '').trim().toLowerCase();
    if (raw === 'petrol' || raw === 'diesel' || raw === 'ev') return raw;
    return 'petrol';
  })();

  const unlock = z('unlock_fee_eur');
  const reservation = z('reservation_fee_eur');
  const fixedRaw = n('fixed_fee_eur');
  let fixed = fixedRaw ?? 0;
  const tripFee = z('trip_fee_eur');
  let minTotal = n('min_total_eur');
  const cap24h = n('cap_24h_eur');
  const airportFee = z('airport_fee_eur');

  const driveDayRate = z('drive_day_min_rate_eur');
  const driveNightRate = z('drive_night_min_rate_eur') || driveDayRate;
  const parkDayRate = (n('park_day_min_rate_eur') ?? driveDayRate);
  const parkNightRate = (n('park_night_min_rate_eur') ?? driveNightRate);

  const kmRate = z('km_rate_eur');
  const includedKm = z('included_km');
  const overKmRate = (n('over_km_rate_eur') ?? kmRate);

  const fuelIncluded = String(option.fuel_included || 'TRUE').toUpperCase() === 'TRUE';

  // CarGuru in-app has a per-trip service fee; the public API we import sometimes omits it.
  const providerId = String(option.provider_id || '').trim().toLowerCase();
  if (providerId === 'carguru') {
    // Be liberal in what we accept: if the option doesn't carry fixed_fee_eur,
    // assume a default service fee for all non-daily options.
    if ((fixedRaw == null || fixedRaw === 0) && optionType !== 'DAILY') {
      fixed = 0.99;
    }
    if (optionType === 'PAYG' && (minTotal == null || minTotal <= 0)) minTotal = 2.0;
  }

  const feesEur = unlock + reservation + fixed;

  const paygTimeEur =
    ctx.driveDayMin * driveDayRate +
    ctx.driveNightMin * driveNightRate +
    ctx.parkDayMin * parkDayRate +
    ctx.parkNightMin * parkNightRate;

  const chargedKm = Math.max(0, ctx.distKm - includedKm);
  const paygKmEur = chargedKm * overKmRate;

  const fuelFallbackConsumption = 8;
  const resolveFuelPrice = (fuelType) => {
    if (fuelType === 'diesel') return Number(ctx.fuelPriceDiesel || 0);
    if (fuelType === 'petrol') return Number(ctx.fuelPriceE95 || 0);
    return 0;
  };
  const resolveConsumption = () => {
    if (vehicleFuelType === 'ev') return { value: 0, source: 'ev' };
    const overrideEnabled = !!ctx.consumptionOverrideEnabled;
    const overrideVal = Number(ctx.consumptionOverride || 0);
    if (overrideEnabled && overrideVal > 0) return { value: overrideVal, source: 'override' };
    const vehicleDefault = Number(vehicle?.consumption_l_per_100km_default || 0);
    if (vehicleDefault > 0) return { value: vehicleDefault, source: 'vehicle' };
    return { value: fuelFallbackConsumption, source: 'fallback' };
  };

  const fuelCtx = resolveConsumption();
  const fuelConsumptionBase = Number(fuelCtx.value || 0);
  const fuelConsumptionUsed = vehicleFuelType === 'ev' ? 0 : (fuelConsumptionBase * RIGA_CONSUMPTION_FACTOR);
  const fuelPriceUsed = resolveFuelPrice(vehicleFuelType);
  const fuelEur =
    fuelIncluded || vehicleFuelType === 'ev'
      ? 0
      : (ctx.distKm * (fuelConsumptionUsed / 100) * fuelPriceUsed);
  const airportEur = ctx.airport ? airportFee : 0;

  let planEur = 0; // package/daily price (excludes time/km)
  let timeEur = 0;
  let kmEur = 0;
  let capSavedEur = 0;
  let minAddedEur = 0;

  let includedMin = null;
  let overMin = 0;
  let blendedRate = 0;
  let timeRawEur = 0;
  let planLabel = '';
  let capApplied = false;
  let capValue = null;

  if (optionType === 'PAYG') {
    timeRawEur = paygTimeEur;
    timeEur = timeRawEur;
    if (cap24h != null) {
      const cap = ctx.days * cap24h;
      const capped = Math.min(timeRawEur, cap);
      capSavedEur = Math.max(0, timeRawEur - capped);
      timeEur = capped;
      capApplied = capped !== timeRawEur;
      capValue = cap;
    }
    kmEur = paygKmEur;
    planEur = 0;
    planLabel = '';
  } else if (optionType === 'PACKAGE') {
    const packagePrice = z('package_price_eur');
    includedMin = z('included_min');
    overMin = Math.max(0, ctx.totalMin - includedMin);

    // Overage minute rate: blended (MVP approach).
    blendedRate = ctx.totalMin > 0 ? (paygTimeEur / ctx.totalMin) : 0;
    timeRawEur = overMin * blendedRate;
    timeEur = timeRawEur;
    if (cap24h != null) {
      const cap = ctx.days * cap24h;
      const capped = Math.min(timeRawEur, cap);
      capSavedEur = Math.max(0, timeRawEur - capped);
      timeEur = capped;
      capApplied = capped !== timeRawEur;
      capValue = cap;
    }

    kmEur = Math.max(0, ctx.distKm - includedKm) * overKmRate;
    planEur = packagePrice;
    planLabel = 'Package';
  } else if (optionType === 'DAILY') {
    const dailyPrice = z('daily_price_eur');
    const unlimited = String(option.daily_unlimited_km || '').toUpperCase() === 'TRUE';
    const dailyIncludedKm = z('daily_included_km');
    const dailyOverKmRate = (n('daily_over_km_rate_eur') ?? kmRate);

    const kmAllowance = unlimited ? Infinity : (dailyIncludedKm * ctx.days);
    kmEur = unlimited ? 0 : (Math.max(0, ctx.distKm - kmAllowance) * dailyOverKmRate);
    planEur = (ctx.days * dailyPrice);
    planLabel = `Daily (${ctx.days}×)`;
  } else {
    return { ok: false, reason: `Unknown option_type: ${option.option_type}` };
  }

  const subtotalBeforeMin = tripFee + planEur + timeEur + kmEur;
  if (minTotal != null && subtotalBeforeMin < minTotal) minAddedEur = minTotal - subtotalBeforeMin;

  const tripC = roundToCents(tripFee);
  const planC = roundToCents(planEur);
  const timeC = roundToCents(timeEur);
  const kmC = roundToCents(kmEur);
  const minAddedC = roundToCents(minAddedEur);
  const feesC = roundToCents(feesEur);
  const airportC = roundToCents(airportEur);
  const fuelC = roundToCents(fuelEur);

  const totalEur = roundToCents(tripC + planC + timeC + kmC + minAddedC + feesC + airportC + fuelC);

  const timeTooltip = (() => {
    const lines = [];
    if (optionType === 'PAYG') {
      lines.push(`Drive day: ${ctx.driveDayMin} min × €${driveDayRate.toFixed(2)} = €${(ctx.driveDayMin * driveDayRate).toFixed(2)}`);
      lines.push(`Drive night: ${ctx.driveNightMin} min × €${driveNightRate.toFixed(2)} = €${(ctx.driveNightMin * driveNightRate).toFixed(2)}`);
      lines.push(`Park day: ${ctx.parkDayMin} min × €${parkDayRate.toFixed(2)} = €${(ctx.parkDayMin * parkDayRate).toFixed(2)}`);
      lines.push(`Park night: ${ctx.parkNightMin} min × €${parkNightRate.toFixed(2)} = €${(ctx.parkNightMin * parkNightRate).toFixed(2)}`);
      lines.push(`Time subtotal: €${timeRawEur.toFixed(2)}`);
      if (cap24h != null) lines.push(`Time cap: min(€${timeRawEur.toFixed(2)}, ${ctx.days}×€${cap24h.toFixed(2)}) = €${timeEur.toFixed(2)}`);
      return lines.join('\n');
    }
    if (optionType === 'PACKAGE') {
      lines.push(`Included: ${includedMin ?? 0} min`);
      lines.push(`Overage: max(0, ${ctx.totalMin} - ${includedMin ?? 0}) = ${overMin} min`);
      lines.push(`Blended minute rate: €${paygTimeEur.toFixed(2)} / ${ctx.totalMin} min = €${blendedRate.toFixed(4)}/min`);
      lines.push(`Time overage: ${overMin} × €${blendedRate.toFixed(4)} = €${timeRawEur.toFixed(2)}`);
      if (cap24h != null) lines.push(`Time cap: min(€${timeRawEur.toFixed(2)}, ${ctx.days}×€${cap24h.toFixed(2)}) = €${timeEur.toFixed(2)}`);
      return lines.join('\n');
    }
    return `Time: €${timeEur.toFixed(2)}`;
  })();

  const kmTooltip = `Km charged: max(0, ${ctx.distKm} - ${includedKm}) = ${chargedKm} km\nRate: €${overKmRate.toFixed(2)}/km\nKm cost: ${chargedKm} × €${overKmRate.toFixed(2)} = €${(chargedKm * overKmRate).toFixed(2)}`;

  const planTooltip = optionType === 'PACKAGE'
    ? `Package price: €${planEur.toFixed(2)}`
    : optionType === 'DAILY'
      ? `Daily price: ${ctx.days} × €${(planEur / Math.max(1, ctx.days)).toFixed(2)} = €${planEur.toFixed(2)}`
      : '';

  const tripTooltip = `Trip fee: €${tripFee.toFixed(2)}`;

  const feesTooltip = [
    `Unlock: €${unlock.toFixed(2)}`,
    `Reservation: €${reservation.toFixed(2)}`,
    `${providerId === 'carguru' ? 'Service fee' : 'Service/fixed'}: €${fixed.toFixed(2)}`,
    `Fees total: €${feesEur.toFixed(2)}`,
  ].join('\n');

  const timeLabel = capSavedEur > 0 ? 'Time (capped)' : 'Time';

  return {
    ok: true,
    total_eur: totalEur,
    breakdown: {
      trip_eur: tripC,
      plan_eur: planC,
      time_eur: timeC,
      km_eur: kmC,
      min_added_eur: minAddedC,
      fees_eur: feesC,
      airport_eur: airportC,
      fuel_eur: fuelC,
      cap_saved_eur: roundToCents(capSavedEur),
      total_eur: totalEur,
      labels: {
        trip: 'Trip fee',
        plan: planLabel,
        time: timeLabel,
        km: 'Km',
        fees: 'Fees',
      },
      meta: {
        option_type: optionType,
        total_min: ctx.totalMin,
        total_km: ctx.distKm,
        days: ctx.days,
        fuel_included: fuelIncluded,
        fuel_type: vehicleFuelType,
        fuel_price_eur_per_l: fuelPriceUsed,
        fuel_consumption_l_per_100km_base: fuelConsumptionBase,
        fuel_consumption_riga_factor: vehicleFuelType === 'ev' ? 0 : RIGA_CONSUMPTION_FACTOR,
        fuel_consumption_l_per_100km_used: fuelConsumptionUsed,
        fuel_consumption_source: fuelCtx.source,
        drive_day_min: ctx.driveDayMin,
        drive_night_min: ctx.driveNightMin,
        park_day_min: ctx.parkDayMin,
        park_night_min: ctx.parkNightMin,
        drive_day_rate: driveDayRate,
        drive_night_rate: driveNightRate,
        park_day_rate: parkDayRate,
        park_night_rate: parkNightRate,
        time_raw_eur: roundToCents(timeRawEur),
        cap_applied: capApplied,
        cap_value_eur: capValue != null ? roundToCents(capValue) : null,
        included_min: includedMin,
        over_min: overMin,
        blended_rate_eur_per_min: blendedRate,
        included_km: includedKm,
        charged_km: chargedKm,
        km_rate_eur: overKmRate,
        km_raw_eur: roundToCents(paygKmEur),
        trip_fee_eur: tripFee,
        min_total_eur: minTotal != null ? roundToCents(minTotal) : null,
        plan_label: planLabel,
        plan_eur: planEur,
        fees_unlock_eur: unlock,
        fees_reservation_eur: reservation,
        fees_fixed_eur: fixed,
        fees_fallback_applied: false,
      },
      tooltips: {
        trip: tripTooltip,
        plan: planTooltip,
        time: timeTooltip,
        km: kmTooltip,
        fees: feesTooltip,
      },
    },
  };
}

export function createBaseContext({
  start,
  totalMin,
  parkingMin,
  distKm,
  airport,
  fuelPriceE95,
  fuelPriceDiesel,
  consumptionOverride,
  consumptionOverrideEnabled,
}) {
  const end = new Date(start.getTime() + totalMin * 60000);
  const days = Math.max(1, Math.ceil(totalMin / 1440));
  return {
    start,
    end,
    totalMin,
    parkingMin,
    distKm,
    totalKm: distKm,
    airport: !!airport,
    fuelPriceE95: Number(fuelPriceE95 || 0),
    fuelPriceDiesel: Number(fuelPriceDiesel || 0),
    consumptionOverride: Number(consumptionOverride || 0),
    consumptionOverrideEnabled: !!consumptionOverrideEnabled,
    days,
  };
}

export function computeAll(data, ctx, providerFilter) {
  const providersById = new Map(data.providers.map((p) => [p.provider_id, p]));

  const results = [];
  const errors = [];

  for (const opt of data.options) {
    const providerId = (opt.provider_id || '').trim();
    if (!providerId) continue;
    if (providerFilter && providerId !== providerFilter) continue;

    const provider = providersById.get(providerId) || {
      provider_id: providerId,
      provider_name: providerId,
      night_start: '22:00',
      night_end: '06:00',
    };

    const veh = data.vehiclesById.get(opt.vehicle_id) || {
      vehicle_name: opt.vehicle_id,
      provider_id: providerId,
      snowboard_fit: 0,
      fuel_type: 'petrol',
      consumption_l_per_100km_default: null,
    };

    const nightMin = computeNightMinutes(ctx.start, ctx.end, provider.night_start, provider.night_end);
    const nightClamped = Math.min(ctx.totalMin, Math.max(0, nightMin));
    const alloc = allocateParkingNight(ctx.totalMin, ctx.parkingMin, nightClamped);

    const perCtx = {
      ...ctx,
      driveDayMin: alloc.driveDay,
      driveNightMin: alloc.driveNight,
      parkDayMin: alloc.parkDay,
      parkNightMin: alloc.parkNight,
    };

    const priced = computeOptionPrice(perCtx, opt, veh);
    if (!priced.ok) {
      errors.push(`${providerId}/${opt.vehicle_id}/${opt.option_id}: ${priced.reason}`);
      continue;
    }

    results.push({
      provider_id: providerId,
      provider_name: provider.provider_name || providerId,
      vehicle_id: opt.vehicle_id,
      vehicle_name: veh.vehicle_name || opt.vehicle_id,
      snowboard_fit: Number(veh.snowboard_fit || 0) || 0,
      option_id: opt.option_id,
      option_name: opt.option_name || opt.option_id,
      option_type: opt.option_type || '',
      total_eur: priced.total_eur,
      breakdown: priced.breakdown,
    });
  }

  results.sort((a, b) => a.total_eur - b.total_eur);
  return { results, errors };
}
