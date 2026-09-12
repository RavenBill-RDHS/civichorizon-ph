export function renderAdminSummary(state) {
  const validation = state.validation;
  const join = state.join;
  const cards = [
    ["Source records", validation?.stats?.sourceRecordCount ?? 0],
    ["Valid records", validation?.stats?.validRecordCount ?? 0],
    ["Invalid records", validation?.stats?.invalidRecordCount ?? 0],
    ["Missing geography", validation?.stats?.missingLocationCount ?? 0],
    ["Duplicates", validation?.stats?.duplicateKeyCount ?? 0],
    ["Geographic match", join ? `${(join.matchRate * 100).toFixed(1)}%` : "—"]
  ];
  return `<div class="qa-grid">${cards.map(([label,value]) => `<div class="qa-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div>`;
}

export function renderMessages(validation, join) {
  const errors = validation?.errors || [];
  const warnings = [...(validation?.warnings || [])];
  if (join?.unresolvedCount) warnings.push(`${join.unresolvedCount} record(s) could not be joined to the PSA/GADM geography.`);
  const block = (title, items, className) => items.length ? `<div class="qa-message ${className}"><strong>${title}</strong><ul>${items.slice(0,20).map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul></div>` : "";
  return block("Errors", errors, "qa-error") + block("Warnings", warnings, "qa-warning");
}

export function renderTable(records, limit = 20) {
  const rows = records.slice(0, limit);
  if (!rows.length) return `<p class="sub">No records to display.</p>`;
  const headers = [...new Set(rows.flatMap(r => Object.keys(r || {})))].slice(0, 12);
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${headers.map(h => `<td>${escapeHtml(r?.[h])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

export function downloadText(filename, text, mime = "application/json") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function prettyJSON(value) { return JSON.stringify(value, null, 2); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char])); }
