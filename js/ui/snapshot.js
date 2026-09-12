export function renderSnapshot(i) {
  const metrics = [
    [
      "Population",
      i.population.available
        ? Number(i.population.value).toLocaleString("en-PH")
        : "Unavailable"
    ],
    [
      "Area",
      i.geography.available
        ? `${Number(i.geography.areaKm2).toLocaleString("en-PH", {
            maximumFractionDigits: 1
          })} km²`
        : "Unavailable"
    ],
    [
      "Population Density",
      i.density.available
        ? `${Number(i.density.value).toLocaleString("en-PH", {
            maximumFractionDigits: 1
          })}/km²`
        : "Unavailable"
    ],
    ["Classification", formatClassification(i.classification)]
  ];

  return `
    <div class="card">
      <div class="eyebrow">${esc(i.identity.type.toUpperCase())}</div>
      <h2>${esc(i.identity.name)}</h2>
      <p class="sub address-line">${esc(i.identity.address || i.identity.parentName || "")}</p>

      <div class="snapshot-grid">
        ${metrics
          .map(
            ([label, value]) => `
              <div class="metric">
                <div class="label">${esc(label)}</div>
                <div class="value">${esc(value)}</div>
              </div>
            `
          )
          .join("")}
      </div>

      <div class="source-list">
        <div class="source-heading">DATA PROVENANCE</div>
        ${renderSource("Population", i.population.source, i.population.available)}
        ${renderSource("Area", i.geography.source, i.geography.available)}
        ${renderSource("Density", i.density.source, i.density.available)}
        ${renderSource("Classification", i.classification.source, i.classification.available)}
      </div>
    </div>
  `;
}

function formatClassification(c) {
  const values = [c.cityClass, c.incomeClassification, c.urbanRural].filter(Boolean);
  return values.length ? values.join(" · ") : "Unavailable";
}

function renderSource(label, source, available) {
  if (!available || !source) return "";

  return `
    <div class="source-row">
      <span>${esc(label)}</span>
      <span>${esc(source.provider)} · ${esc(source.confidence)}</span>
    </div>
  `;
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[c]
  );
}
