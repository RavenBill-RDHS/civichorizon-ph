const PHILIPPINES = [121.7740, 12.8797];
let map = null;
let marker = null;
let housingMarkers = [];
let ready = false;
let currentRecords = [];
let currentFilters = { living: true, business: true, other: true };

export async function initMap(containerId = 'map') {
  if (!window.maplibregl) return null;
  map = new maplibregl.Map({
    container: containerId,
    style: { version: 8, sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>' } }, layers: [{ id:'osm', type:'raster', source:'osm' }] },
    center: PHILIPPINES, zoom: 5.3, minZoom: 4, maxZoom: 18
  });
  await new Promise(resolve => map.once('load', resolve));
  ready = true;
  return map;
}

export async function focusLocation(location, resolver) {
  if (!map || !location) return;
  const query = buildGeocodeQuery(location, resolver);
  try {
    const result = await geocode(query);
    if (!result) throw new Error('Location not found');
    map.flyTo({ center:[result.lng,result.lat], zoom: location.type === 'barangay' ? 14 : 11, essential:true });
    if (marker) marker.remove();
    const el = document.createElement('div');
    el.className = 'location-focus-dot';
    marker = new maplibregl.Marker({element:el}).setLngLat([result.lng,result.lat]).addTo(map);
  } catch (error) {
    console.warn('CivicHorizon geocoding fallback:', error.message);
    map.flyTo({ center: PHILIPPINES, zoom: 5.3, essential:true });
  }
}

export async function showHousingListings(records, resolver, filters = currentFilters) {
  currentRecords = Array.isArray(records) ? records : [];
  currentFilters = {...currentFilters, ...filters};
  clearHousingListings();
  if (!map || !currentRecords.length) return;
  for (const record of currentRecords) {
    if (!currentFilters[classifyPlace(record)]) continue;
    try {
      const result = Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude))
        ? {lat:Number(record.latitude),lng:Number(record.longitude)}
        : await geocode(record.geocode_query || `${record.name}, Philippines`);
      if (!result) continue;
      const type = classifyPlace(record);
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `place-dot ${type}`;
      dot.title = `${record.name || 'Place'} · ${record.place_type || 'Place'}`;
      dot.setAttribute('aria-label', `Open ${record.name || 'place'}`);
      const details = [
        record.address,
        record.contact ? `Contact: ${record.contact}` : '',
        record.price != null ? `Price: ₱${Number(record.price).toLocaleString('en-PH')}${record.price_period ? ` / ${record.price_period}` : ''}` : '',
        record.description
      ].filter(Boolean).map(esc).join('<br>');
      const popup = new maplibregl.Popup({ offset: 12, closeButton: true }).setHTML(
        `<div class="map-popup"><strong>${esc(record.name || 'Place')}</strong><span class="popup-type ${type}">${esc(record.place_type || 'Place')}</span>${details ? `<div class="popup-details">${details}</div>` : ''}<div class="popup-note">${record.verification_status === 'verified' ? 'CivicHorizon verified' : 'Public/community information'}</div></div>`
      );
      const m = new maplibregl.Marker({element:dot, anchor:'center'}).setLngLat([result.lng,result.lat]).setPopup(popup).addTo(map);
      housingMarkers.push(m);
    } catch (e) { console.warn('Place skipped:', record.name, e.message); }
  }
}

export function setHousingMapFilters(filters) {
  currentFilters = {...currentFilters, ...filters};
  return showHousingListings(currentRecords, null, currentFilters);
}
export function getHousingMapFilters(){ return {...currentFilters}; }
export function classifyPlace(record) {
  const t = String(record?.place_type || record?.category || record?.business_type || '').toLowerCase();
  if (/boarding|apartment|room for rent|homestay|hotel|hostel|dorm|residential|subdivision|lodging|accommodation|house|condo|rent/.test(t)) return 'living';
  if (/sari|restaurant|retail|store|shop|service|business|laundry|market|canteen|salon|clinic|pharmacy|school|office|bank/.test(t)) return 'business';
  return 'other';
}
export function clearHousingListings() { housingMarkers.forEach(m => m.remove()); housingMarkers = []; }

async function geocode(query) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ph&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: controller.signal, headers: { 'Accept':'application/json' } });
    if (!response.ok) throw new Error(`Geocoder ${response.status}`);
    const results = await response.json();
    if (!results.length) return null;
    return {lng:Number(results[0].lon),lat:Number(results[0].lat)};
  } finally { clearTimeout(timeout); }
}

function buildGeocodeQuery(location, resolver) { return [location.name,...resolver.ancestorsOf(location).filter(p=>p.type==='region'||p.type==='province').map(p=>p.name),'Philippines'].join(', '); }
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
export function mapReady() { return ready; }
