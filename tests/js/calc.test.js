import test from 'node:test';
import assert from 'node:assert/strict';

import {
  toNumberMaybe,
  createBaseContext,
  computeOptionPrice,
  computeAll,
} from '../../web/lib/calc.js';
import { parseTsv } from '../../web/lib/tsv.js';
import { normalizeData } from '../../web/lib/data.js';

test('toNumberMaybe parses EU-style numbers', () => {
  assert.equal(toNumberMaybe('1.041'), 1041);
  assert.equal(toNumberMaybe('1 041,50'), 1041.5);
  assert.equal(toNumberMaybe('0.280'), 0.28);
  assert.equal(toNumberMaybe('955.84'), 955.84);
  assert.equal(toNumberMaybe('€ 2,55'), 2.55);
});

test('Bolt PAYG caps time-only (not time+km)', () => {
  const option = {
    provider_id: 'bolt',
    option_id: 'bolt_yaris_cross_payg',
    option_type: 'PAYG',
    trip_fee_eur: '0',
    min_total_eur: '2.55',
    cap_24h_eur: '20.90',
    drive_day_min_rate_eur: '0.13',
    park_day_min_rate_eur: '0.13',
    km_rate_eur: '0.29',
    included_km: '0',
    fuel_included: 'TRUE',
  };

  // 6h30m total, 2h30m parking, 140km
  const base = createBaseContext({
    start: new Date('2026-01-24T12:00:00'),
    totalMin: 390,
    parkingMin: 150,
    distKm: 140,
    airport: false,
    fuelPrice: 1.5,
    consumption: 9,
  });

  const ctx = {
    ...base,
    driveDayMin: 240,
    driveNightMin: 0,
    parkDayMin: 150,
    parkNightMin: 0,
  };

  const priced = computeOptionPrice(ctx, option);
  assert.equal(priced.ok, true);

  // Time raw: 390 * 0.13 = 50.70 capped to 20.90, km: 140*0.29 = 40.60
  assert.equal(priced.breakdown.time_eur, 20.9);
  assert.equal(priced.breakdown.km_eur, 40.6);
  assert.equal(priced.total_eur, 61.5);
  assert.equal(priced.breakdown.labels.time, 'Time (capped)');
});

test('Bolt package charges overage minutes and km at PAYG rates', () => {
  const option = {
    provider_id: 'bolt',
    option_id: 'bolt_pkg_1h_5km',
    option_type: 'PACKAGE',
    package_price_eur: '6.99',
    included_min: '60',
    included_km: '5',
    drive_day_min_rate_eur: '0.13',
    park_day_min_rate_eur: '0.13',
    km_rate_eur: '0.29',
    fuel_included: 'TRUE',
  };

  const base = createBaseContext({
    start: new Date('2026-01-24T12:00:00'),
    totalMin: 61,
    parkingMin: 0,
    distKm: 6,
    airport: false,
    fuelPrice: 0,
    consumption: 0,
  });
  const ctx = { ...base, driveDayMin: 61, driveNightMin: 0, parkDayMin: 0, parkNightMin: 0 };

  const priced = computeOptionPrice(ctx, option);
  assert.equal(priced.ok, true);
  // Over: 1 min at 0.13 + 1 km at 0.29 + package price 6.99
  assert.equal(priced.breakdown.plan_eur, 6.99);
  assert.equal(priced.breakdown.time_eur, 0.13);
  assert.equal(priced.breakdown.km_eur, 0.29);
  assert.equal(priced.total_eur, 7.41);
});

test('CarGuru PAYG/PACKAGE applies default service fee when fixed_fee_eur is missing/0', () => {
  const option = {
    provider_id: 'carguru',
    option_id: 'carguru_foo_main_basic_payg',
    option_type: 'PAYG',
    fixed_fee_eur: '0',
    drive_day_min_rate_eur: '0.13',
    park_day_min_rate_eur: '0.13',
    km_rate_eur: '0.27',
    included_km: '0',
    fuel_included: 'TRUE',
  };
  const base = createBaseContext({
    start: new Date('2026-01-24T12:00:00'),
    totalMin: 1,
    parkingMin: 0,
    distKm: 0,
    airport: false,
    fuelPrice: 0,
    consumption: 0,
  });
  const ctx = { ...base, driveDayMin: 1, driveNightMin: 0, parkDayMin: 0, parkNightMin: 0 };
  const priced = computeOptionPrice(ctx, option);
  assert.equal(priced.ok, true);
  assert.equal(priced.breakdown.fees_eur, 0.99);
  assert.match(priced.breakdown.tooltips.fees, /Service fee: €\s*0\.99/);
});

test('TSV parsing + normalizeData produce expected structures', () => {
  const providersTsv = [
    'provider_id\tprovider_name\tnight_start\tnight_end',
    'bolt\tBolt Drive\t22:00\t06:00',
  ].join('\n');
  const vehiclesTsv = [
    'provider_id\tvehicle_id\tvehicle_name\tvehicle_class',
    'bolt\tbolt_yaris\tToyota Yaris Cross\tB',
  ].join('\n');
  const optionsTsv = [
    'provider_id\tvehicle_id\toption_id\toption_name\toption_type\tdrive_day_min_rate_eur\tkm_rate_eur\tfuel_included',
    'bolt\tbolt_yaris\tbolt_payg\tPAYG\tPAYG\t0.13\t0.29\tTRUE',
  ].join('\n');

  const raw = {
    providers: parseTsv(providersTsv).data,
    vehicles: parseTsv(vehiclesTsv).data,
    options: parseTsv(optionsTsv).data,
  };
  const data = normalizeData(raw);
  assert.equal(data.providers[0].provider_name, 'Bolt Drive');
  assert.ok(data.vehiclesById.get('bolt_yaris'));
  assert.equal(data.options.length, 1);
});

test('computeAll ranks options by total_eur', () => {
  const data = {
    providers: [{ provider_id: 'bolt', provider_name: 'Bolt', night_start: '22:00', night_end: '06:00' }],
    vehiclesById: new Map([['bolt_yaris', { vehicle_name: 'Yaris', provider_id: 'bolt' }]]),
    options: [
      { provider_id: 'bolt', vehicle_id: 'bolt_yaris', option_id: 'a', option_name: 'A', option_type: 'PAYG', drive_day_min_rate_eur: '1', km_rate_eur: '0', fuel_included: 'TRUE' },
      { provider_id: 'bolt', vehicle_id: 'bolt_yaris', option_id: 'b', option_name: 'B', option_type: 'PAYG', drive_day_min_rate_eur: '0', km_rate_eur: '0', fuel_included: 'TRUE' },
    ],
  };
  const base = createBaseContext({
    start: new Date('2026-01-24T12:00:00'),
    totalMin: 10,
    parkingMin: 0,
    distKm: 0,
    airport: false,
    fuelPrice: 0,
    consumption: 0,
  });

  const { results, errors } = computeAll(data, base, '');
  assert.equal(errors.length, 0);
  assert.equal(results[0].option_id, 'b');
  assert.equal(results[1].option_id, 'a');
});

