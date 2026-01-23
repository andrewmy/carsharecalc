/**
 * Compute how many minutes in [startTs, endTs) fall within a provider's nightly window.
 *
 * - startTs/endTs: Google Sheets datetimes
 * - nightStart/nightEnd: time-of-day values (e.g. TIME(22,0,0))
 * - If nightEnd < nightStart, the night window crosses midnight.
 *
 * Returns a number (minutes). Caller can ROUNDUP/ROUND as desired.
 */
function NIGHT_MINUTES(startTs, endTs, nightStart, nightEnd) {
  if (startTs == null || endTs == null || nightStart == null || nightEnd == null) return 0;

  var start = _toDate(startTs);
  var end = _toDate(endTs);
  if (!start || !end) return 0;

  var startMs = start.getTime();
  var endMs = end.getTime();
  if (!(endMs > startMs)) return 0;

  var nightStartFrac = _toNumber(nightStart);
  var nightEndFrac = _toNumber(nightEnd);
  if (isNaN(nightStartFrac) || isNaN(nightEndFrac)) return 0;

  // Convert "time of day" fraction to milliseconds.
  var dayMs = 24 * 60 * 60 * 1000;
  var nightStartOffsetMs = nightStartFrac * dayMs;
  var nightEndOffsetMs = nightEndFrac * dayMs;
  var crossesMidnight = nightEndFrac < nightStartFrac;

  // Iterate days from the day before start to the day of end (inclusive) to cover cross-midnight windows.
  var day0 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  day0 = new Date(day0.getTime() - dayMs);
  var dayN = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  var totalMinutes = 0;
  for (var d = day0; d.getTime() <= dayN.getTime(); d = new Date(d.getTime() + dayMs)) {
    var baseMs = d.getTime();
    var segStartMs = baseMs + nightStartOffsetMs;
    var segEndMs = baseMs + (crossesMidnight ? dayMs : 0) + nightEndOffsetMs;

    var overlapMs = Math.max(0, Math.min(endMs, segEndMs) - Math.max(startMs, segStartMs));
    if (overlapMs > 0) totalMinutes += overlapMs / 60000;
  }

  // Defensive rounding against floating point artifacts.
  return Math.max(0, Math.round(totalMinutes * 1000000) / 1000000);
}

function _toDate(v) {
  if (v instanceof Date) return v;
  // Sheets sometimes passes numbers (days since 1899-12-30).
  if (typeof v === 'number') return new Date((v - 25569) * 86400 * 1000);
  if (typeof v === 'string') {
    var d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function _toNumber(v) {
  if (typeof v === 'number') return v;
  if (v instanceof Date) {
    // If a time-only value arrives as Date, convert to fraction of day.
    var ms = v.getHours() * 3600000 + v.getMinutes() * 60000 + v.getSeconds() * 1000 + v.getMilliseconds();
    return ms / (24 * 3600000);
  }
  if (typeof v === 'string') {
    var n = Number(v);
    if (!isNaN(n)) return n;
  }
  return NaN;
}
