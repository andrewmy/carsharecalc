export function normalizeData(raw) {
  const providers = raw.providers.map((p) => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name || p.provider_id,
    night_start: p.night_start || '22:00',
    night_end: p.night_end || '06:00',
  }));

  const normalizeFuelType = (vehicle) => {
    const raw = String(vehicle.fuel_type ?? '').trim().toLowerCase();
    if (raw === 'petrol' || raw === 'diesel' || raw === 'ev') return raw;

    const name = String(vehicle.vehicle_name ?? '').trim().toLowerCase();
    const id = String(vehicle.vehicle_id ?? '').trim().toLowerCase();
    const hay = `${name} ${id}`;

    if (hay.includes('diesel')) return 'diesel';
    // Treat hybrids as petrol (no special handling yet).
    if (hay.includes('hybrid') || hay.includes('e-power') || hay.includes('epower') || hay.includes('phev')) return 'petrol';
    if (hay.includes('tesla') || hay.includes('electric') || hay.includes(' ev') || hay.endsWith(' ev')) return 'ev';

    return 'petrol';
  };

  const parseConsumptionDefault = (vehicle) => {
    const raw = String(vehicle.consumption_l_per_100km_default ?? '').trim();
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  const vehiclesById = new Map();
  for (const v of raw.vehicles) {
    const snowboardFitRaw = String(v.snowboard_fit ?? '').trim();
    const snowboardFitNum = snowboardFitRaw === '' ? 0 : Number(snowboardFitRaw);
    const snowboardFit =
      Number.isFinite(snowboardFitNum) && snowboardFitNum >= 0 && snowboardFitNum <= 2
        ? Math.trunc(snowboardFitNum)
        : 0;
    vehiclesById.set(v.vehicle_id, {
      provider_id: v.provider_id,
      vehicle_id: v.vehicle_id,
      vehicle_name: v.vehicle_name || v.vehicle_id,
      vehicle_class: v.vehicle_class || '',
      snowboard_fit: snowboardFit,
      snowboard_source_url: v.snowboard_source_url || '',
      fuel_type: normalizeFuelType(v),
      consumption_l_per_100km_default: parseConsumptionDefault(v),
      consumption_source_url: v.consumption_source_url || '',
    });
  }

  const options = raw.options.filter((o) => (o.provider_id || '').trim() && (o.vehicle_id || '').trim());

  return { providers, vehiclesById, options };
}
