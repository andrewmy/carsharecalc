export function normalizeData(raw) {
  const providers = raw.providers.map((p) => ({
    provider_id: p.provider_id,
    provider_name: p.provider_name || p.provider_id,
    night_start: p.night_start || '22:00',
    night_end: p.night_end || '06:00',
  }));

  const vehiclesById = new Map();
  for (const v of raw.vehicles) {
    const snowboardOk = String(v.snowboard_ok || '').trim().toUpperCase() === 'TRUE';
    vehiclesById.set(v.vehicle_id, {
      provider_id: v.provider_id,
      vehicle_id: v.vehicle_id,
      vehicle_name: v.vehicle_name || v.vehicle_id,
      vehicle_class: v.vehicle_class || '',
      snowboard_ok: snowboardOk,
      snowboard_source_url: v.snowboard_source_url || '',
    });
  }

  const options = raw.options.filter((o) => (o.provider_id || '').trim() && (o.vehicle_id || '').trim());

  return { providers, vehiclesById, options };
}
