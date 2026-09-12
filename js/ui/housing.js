export function renderHousing(h) {
  if (!h?.available) return '';
  return `<section class="card housing-card">
    <div class="eyebrow">HOUSING CONTEXT</div>
    <h3>Regional housing profile</h3>
    <p class="sub">${esc(h.region)} · 2020 Census of Population and Housing</p>
    <div class="snapshot-grid">
      <div class="metric"><div class="label">Housing Units</div><div class="value">${fmt(h.totalHousingUnits)}</div></div>
      <div class="metric"><div class="label">Occupied</div><div class="value">${fmt(h.occupiedHousingUnits)}</div></div>
      <div class="metric"><div class="label">Occupancy Rate</div><div class="value">${fmt(h.occupancyRate,1)}%</div></div>
      <div class="metric"><div class="label">Unoccupied</div><div class="value">${fmt(h.vacantHousingUnits)}</div></div>
    </div>
    <p class="context-note">This is <strong>regional context</strong>, not a count of available rentals or vacant properties in ${esc(h.region)}. It describes the housing stock recorded by PSA in 2020.</p>
    <div class="source">Source: ${esc(h.source.provider)} · ${esc(h.source.name)} · reference date ${esc(h.source.referenceDate)}</div>
  </section>`;
}
function fmt(v,d=0){return Number(v).toLocaleString('en-PH',{maximumFractionDigits:d,minimumFractionDigits:d});}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
