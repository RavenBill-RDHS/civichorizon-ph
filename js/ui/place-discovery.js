export function initPlaceDiscovery(locations, resolver, onSelect) {
  const input = document.querySelector('#placeSearch');
  const results = document.querySelector('#placeResults');
  if (!input || !results) return;
  const searchable = locations.filter(x => ['region','province','city','municipality','barangay'].includes(x.type));
  input.addEventListener('input', () => render(input.value));
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.value=''; render(''); input.blur(); } });

  function render(term) {
    const q = String(term || '').trim().toLowerCase();
    if (!q) { results.innerHTML = '<div class="search-hint">Search any Philippine province, city, municipality, or barangay.</div>'; return; }
    const matches = searchable.filter(x => x.name.toLowerCase().includes(q)).slice(0,8);
    if (!matches.length) { results.innerHTML = '<div class="search-hint">No matching place found in the geographic dataset.</div>'; return; }
    results.innerHTML = matches.map(x => {
      const ancestors = resolver.ancestorsOf(x);
      const breadcrumb = resolver.fullAddress(x);
      return `<button class="search-result" data-code="${esc(x.psgc_code)}"><span><strong>${esc(x.name)}</strong><small>${esc(x.type)} · ${esc(breadcrumb)}</small></span><span>→</span></button>`;
    }).join('');
    results.querySelectorAll('.search-result').forEach(btn => btn.onclick = () => {
      const loc = resolver.getByPsgc(btn.dataset.code);
      if (loc) { onSelect(loc); input.value = loc.name; results.innerHTML=''; }
    });
  }
  render('');
}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
