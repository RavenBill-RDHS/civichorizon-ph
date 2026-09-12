/** Dependency-free CSV parser for CivicHorizon offline ingestion. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field === "") quoted = true;
    else if (char === ',') { row.push(field); field = ""; }
    else if (char === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (!rows.length) return [];
  const headers = dedupeHeaders(rows.shift().map((h, i) => normalizeHeader(h) || `column_${i + 1}`));
  return rows.filter(r => r.some(v => String(v ?? "").trim() !== "")).map(r => {
    const record = {};
    headers.forEach((h, i) => { record[h] = String(r[i] ?? "").trim(); });
    return record;
  });
}

export function stringifyCSV(records) {
  if (!records.length) return "";
  const headers = [...new Set(records.flatMap(r => Object.keys(r || {})))];
  const escape = value => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.map(escape).join(","), ...records.map(r => headers.map(h => escape(r?.[h])).join(","))].join("\n");
}

export function normalizeHeader(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
}

function dedupeHeaders(headers) {
  const counts = new Map();
  return headers.map(header => {
    const count = (counts.get(header) || 0) + 1;
    counts.set(header, count);
    return count === 1 ? header : `${header}_${count}`;
  });
}
