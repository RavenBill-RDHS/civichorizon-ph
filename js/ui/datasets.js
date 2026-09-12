export function renderDatasetCapabilities(capabilities) {
  const entries = Object.values(capabilities || {}).filter(c => c && c.available);
  if (!entries.length) return "";
  return `
    <div class="card dataset-card">
      <div class="eyebrow">ADDITIONAL DATA</div>
      <h3>Available datasets</h3>
      <div class="dataset-grid">
        ${entries.map(renderCapability).join("")}
      </div>
    </div>
  `;
}

function renderCapability(c) {
  const source = c.source || {};
  const date = source.referenceDate ? ` · ${esc(source.referenceDate)}` : "";
  return `
    <article class="dataset-item">
      <div class="dataset-label">${esc(c.label || "Dataset")}</div>
      <div class="dataset-count">${Number(c.count || 0).toLocaleString("en-PH")}</div>
      <div class="dataset-meta">${esc(source.provider || "Source unavailable")}${date}</div>
      <div class="dataset-meta">${esc(source.confidence || "unverified")}</div>
    </article>
  `;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#039;"}[c]));
}
