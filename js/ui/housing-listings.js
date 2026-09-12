export function renderHousingListings(h, state = {query:"", type:"all"}) {
  if (!h?.available) {
    return `<section class="card listing-card"><div class="eyebrow">PLACES & LOCAL BUSINESSES</div><h3>No places mapped yet</h3><p class="sub">There are no public or community place records attached to this location yet.</p></section>`;
  }

  const records = h.records || [];
  const types = [...new Set(records.map(r => classify(r)))];

  const filtered = records.filter(r => {
    const type = classify(r);
    const q = String(state.query || '').trim().toLowerCase();
    const haystack = [r.name, r.place_type, r.address, r.description, r.contact, r.hours, r.opening_hours]
      .filter(Boolean).join(' ').toLowerCase();

    return (state.type === "all" || type === state.type) &&
      (!q || haystack.includes(q));
  });

  const cards = filtered.map(r => {
    const type = classify(r);
    const isBusiness = type === "Business";
    const isEnhanced = isBusiness && String(r.listing_tier || r.tier || "").toLowerCase() === "enhanced";

    // Basic business listings intentionally expose only the basic public fields.
    const price = r.price != null
      ? `₱${Number(r.price).toLocaleString("en-PH")}${r.price_period ? ` / ${r.price_period}` : ""}`
      : "Price not reported";

    const verification = r.verification_status === "verified"
      ? "CivicHorizon verified"
      : r.verification_status === "owner_submitted"
        ? "Owner submitted"
        : "Public/community information";

    const detailData = encodeURIComponent(JSON.stringify(r));

    let summary = `<p>${esc(verification)}</p>`;
    if (!isBusiness || isEnhanced) {
      summary = `<p>${esc(price)} · ${esc(verification)}</p>`;
      if (r.address) summary += `<p class="listing-address">${esc(r.address)}</p>`;
      if (isEnhanced) summary += `<span class="listing-tier-badge">Enhanced</span>`;
    } else {
      summary = `<p>${esc(verification)}</p>`;
      summary += `<span class="listing-tier-badge basic">Basic</span>`;
    }

    return `<article class="listing-item">
      <div class="listing-main">
        <div class="listing-type"><i class="listing-dot ${type}"></i>${esc(r.place_type || r.category || "Place")}</div>
        <h4>${esc(r.name)}</h4>
        ${summary}
      </div>
      <div class="listing-actions">
        <button class="more-button" type="button" data-listing-details="${detailData}">View details</button>
      </div>
    </article>`;
  }).join("");

  return `<section class="card listing-card">
    <div class="eyebrow">PLACES & LOCAL BUSINESSES</div>
    <div class="listing-heading">
      <div><h3>Places in this area</h3><p class="sub">${h.count} mapped place${h.count === 1 ? "" : "s"}</p></div>
      <span class="listing-badge">${filtered.length} shown</span>
    </div>
    <div class="listing-toolbar">
      <input id="listingSearch" type="search" value="${escAttr(state.query)}" placeholder="Search places, businesses, contact or description…" aria-label="Search places">
      <select id="listingTypeFilter" aria-label="Filter places">
        <option value="all" ${state.type === "all" ? "selected" : ""}>All types</option>
        ${types.map(t => `<option value="${t}" ${state.type === t ? "selected" : ""}>${label(t)}</option>`).join("")}
      </select>
    </div>
    <div class="listing-list">${cards || `<div class="empty-filter">No places match this search or filter.</div>`}</div>
    <p class="context-note">Basic business listings show only basic public information. Enhanced business listings may show additional owner-submitted information after CivicHorizon review.</p>
    <div class="source">Sources: ${esc(h.source.provider)} · references ${esc(h.source.referenceDate || "varies by dataset")}</div>
  </section>`;
}

function classify(r) {
  const t = String(r?.place_type || r?.category || r?.business_type || "").toLowerCase();
  if (/boarding|apartment|room for rent|homestay|hotel|hostel|dorm|residential|subdivision|lodging|accommodation|house|condo|rent/.test(t)) return "Living";
  if (/sari|restaurant|retail|store|shop|service|business|laundry|market|canteen|salon|clinic|pharmacy|school|office|bank/.test(t)) return "Business";
  return "Other";
}

function label(t) {
  return t === "Living" ? "Living" : t === "Business" ? "Business" : "Other";
}

function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  })[c]);
}

function escAttr(v) {
  return esc(v).replace(/`/g, "&#96;");
}
