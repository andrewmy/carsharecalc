export function parseTsv(tsv) {
  const lines = String(tsv).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim().startsWith('#')) continue;
    rows.push(line.split('\t'));
  }
  if (rows.length === 0) return { header: [], data: [] };
  const header = rows[0].map((h) => h.trim());
  const data = [];
  for (const r of rows.slice(1)) {
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = (r[i] ?? '').trim();
    data.push(obj);
  }
  return { header, data };
}

