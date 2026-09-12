import { loadLocations } from "./data/loader.js";
import { loadManifest } from "./data/manifest-loader.js";
import { createLocationResolver } from "./data/resolver.js";
import { validateManifest, validateDatasetPayload, DEFAULT_LOCATION_FIELDS } from "./data/contract.js";
import { readIntakeFile, suggestMappings, mapRecords, inspectJoins, buildManifestDefinition, CANONICAL_FIELDS, repairRecords } from "./data/intake.js";
import { renderAdminSummary, renderMessages, renderTable, downloadText, prettyJSON } from "./ui/admin.js";
import { CIVICHORIZON_CONFIG } from "./config.js";
import { getCommunityRecords, setCommunityRecords, connectCommunityFile, writeCommunityRecords, downloadCommunityPayload, getConnectedFileName, restoreCommunityFile } from "./data/community-store.js";

const $ = id => document.getElementById(id);
let sourceRecords = [], repairedRecords = [], headers = [], resolver, locations = [], currentState = {};
const locationFieldDefaults = ["psgc_code", "location_id", "correspondence_code"];
const LISTING_STORAGE = "civichorizon.communityListings.v1";

try {
  [locations] = await Promise.all([loadLocations()]);
  const manifest = await loadManifest();
  resolver = createLocationResolver(locations);
  const manifestCheck = validateManifest(manifest);
  if (!manifestCheck.valid) console.warn("Manifest validation:", manifestCheck.errors);
  setupSubmissionForm();
  setupListingTool();
  const restored = await restoreCommunityFile();
  if (restored) { updateCommunityFileStatus(); }
  $('fileInput').addEventListener('change', handleFile);
  $('runQA').addEventListener('click', runQA);
  $('applyRepair').addEventListener('click', () => useRecords(repairedRecords));
  $('useOriginal').addEventListener('click', () => useRecords(sourceRecords));
  $('downloadJson').addEventListener('click', () => downloadJSON());
  $('downloadManifest').addEventListener('click', () => downloadManifest());
} catch (error) { $('fileStatus').textContent = `Could not initialize workspace: ${error.message}`; $('fileStatus').className = 'error'; }

async function handleFile(event) {
  const file = event.target.files?.[0]; if (!file) return;
  try {
    const intake = await readIntakeFile(file);
    sourceRecords = intake.records;
    const repaired = repairRecords(sourceRecords, resolver);
    repairedRecords = repaired.records;
    $('fileStatus').textContent = `${file.name}: ${sourceRecords.length.toLocaleString()} source records loaded.`;
    $('fileStatus').className = 'sub';
    $('repairSection').classList.remove('hidden');
    $('repairSummary').innerHTML = `<div class="qa-grid"><div class="qa-metric"><span>Source records</span><strong>${repaired.stats.source.toLocaleString()}</strong></div><div class="qa-metric"><span>Repaired output</span><strong>${repaired.stats.output.toLocaleString()}</strong></div><div class="qa-metric"><span>Generated IDs</span><strong>${repaired.stats.generatedIds.toLocaleString()}</strong></div><div class="qa-metric"><span>PSGC normalized</span><strong>${repaired.stats.normalizedCodes.toLocaleString()}</strong></div><div class="qa-metric"><span>Numeric fixes</span><strong>${repaired.stats.normalizedNumbers.toLocaleString()}</strong></div><div class="qa-metric"><span>Location inference</span><strong>${repaired.stats.inferredLocations.toLocaleString()}</strong></div></div>`;
    $('repairLog').innerHTML = `<div class="qa-message qa-warning"><strong>Repair log</strong><ul>${repaired.log.slice(0,50).map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
    $('repairPreview').innerHTML = renderTable(repaired.records, 8);
    useRecords(repairedRecords, true);
  } catch (error) { $('fileStatus').textContent = error.message; $('fileStatus').className = 'error'; }
}

function useRecords(records, silent = false) {
  if (!Array.isArray(records)) return;
  headers = [...new Set(records.flatMap(r => Object.keys(r || {})))];
  $('workspace').classList.remove('hidden');
  const currentFile = $('fileInput').files?.[0]?.name || 'dataset';
  $('outputFile').value = currentFile.replace(/\.[^.]+$/, '') + '.json';
  populateDefinition(headers);
  if (!silent) $('workspace').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function populateDefinition(sourceHeaders) {
  const suggestions = suggestMappings(sourceHeaders);
  const unique = $('uniqueField'); unique.innerHTML = '<option value="">None</option>' + sourceHeaders.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join('');
  const likelyUnique = sourceHeaders.find(h => /^(id|.*_id|.*id)$/i.test(h.trim())) || sourceHeaders.find(h => /^id$/i.test(h.trim())); if (likelyUnique) unique.value = likelyUnique;
  $('locationFields').innerHTML = locationFieldDefaults.map(field => `<label class="check"><input type="checkbox" value="${field}" ${suggestions[field] ? 'checked' : ''}> ${field}</label>`).join('');
  $('mappingGrid').innerHTML = CANONICAL_FIELDS.map(field => `<label>${field}<select data-canonical="${field}"><option value="">— not mapped —</option>${sourceHeaders.map(h => `<option value="${esc(h)}" ${suggestions[field] === h ? 'selected' : ''}>${esc(h)}</option>`).join('')}</select></label>`).join('');
}

function runQA() {
  const mappings = Object.fromEntries([...document.querySelectorAll('[data-canonical]')].map(select => [select.dataset.canonical, select.value]).filter(([,v]) => v));
  const records = mapRecords(repairedRecords.length ? repairedRecords : sourceRecords, mappings);
  const locationFields = [...document.querySelectorAll('#locationFields input:checked')].map(x => x.value);
  const definition = {
    dataset_id: $('datasetId').value.trim(), name: $('datasetName').value.trim(), provider: $('provider').value.trim(), reference_date: $('referenceDate').value || null,
    entity_type: $('entityType').value.trim(), concept: $('concept').value.trim(), format: 'json', enabled: true,
    path: `./data/datasets/${$('outputFile').value.trim() || 'dataset.json'}`, location_fields: locationFields.length ? locationFields : DEFAULT_LOCATION_FIELDS,
    unique_field: $('uniqueField').value || undefined, allow_name_matching: false
  };
  const validation = validateDatasetPayload(definition, records);
  const join = inspectJoins(records, definition, resolver);
  currentState = { definition, records, validation, join };
  $('qaSection').classList.remove('hidden'); $('qaSummary').innerHTML = renderAdminSummary(currentState); $('qaMessages').innerHTML = renderMessages(validation, join); $('unmatched').innerHTML = renderTable(join.unresolvedSample); $('preview').innerHTML = renderTable(records); $('qaSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadJSON() {
  if (!currentState.records) return;
  if (!currentState.validation?.valid) { alert('Fix contract errors before exporting JSON.'); return; }
  const filename = $('outputFile').value.trim() || 'dataset.json'; downloadText(filename, prettyJSON(currentState.records));
}
function downloadManifest() {
  if (!currentState.definition) return;
  const definition = buildManifestDefinition({ ...currentState.definition, file_name: $('outputFile').value.trim() || 'dataset.json' });
  Object.keys(definition).forEach(key => definition[key] === undefined && delete definition[key]); downloadText('manifest-dataset-snippet.json', prettyJSON(definition));
}

function setupSubmissionForm() {
  const saved = localStorage.getItem('civichorizon.submissionFormUrl') || CIVICHORIZON_CONFIG.listingSubmissionFormUrl || '';
  $('submissionFormUrl').value = saved;
  updateFormStatus(saved);
  $('saveFormConfig').onclick = () => { const url = $('submissionFormUrl').value.trim(); localStorage.setItem('civichorizon.submissionFormUrl', url); updateFormStatus(url); };
  $('openSubmissionForm').onclick = () => { const url = $('submissionFormUrl').value.trim(); if (!url) return alert('Add your Google Form URL first.'); window.open(url, '_blank', 'noopener'); };
}
function updateFormStatus(url) { $('submissionFormStatus').value = url ? 'ready' : 'draft'; $('formConfigStatus').textContent = url ? 'Public submission form is configured on this browser.' : 'Create a Google Form, paste its public link here, and save it.'; }

function setupListingTool() {
  fillListingTopLevel();
  $('listingProvince').onchange = () => fillListingPlaces();
  $('listingPlace').onchange = () => fillListingBarangays();
  $('addListing').onclick = addListing;
  $('exportListings').onclick = exportCommunityListings;
  $('connectCommunityFile').onclick = connectCommunityDataset;
  renderListingQueue();
  updateCommunityFileStatus();
}
function fillListingTopLevel() {
  const provinces = locations.filter(x => x.type === 'province').sort(byName);
  const regions = locations.filter(x => x.type === 'region').sort(byName);
  const items = [...provinces, ...regions];
  $('listingProvince').innerHTML = '<option value="">Select province / region</option>' + items.map(x => `<option value="${esc(x.psgc_code)}">${esc(x.name)}</option>`).join('');
}
function fillListingPlaces() {
  const parent = resolver.getByPsgc($('listingProvince').value); const children = parent ? resolver.childrenOf(parent.psgc_code).filter(x => ['city','municipality'].includes(x.type)).sort(byName) : [];
  $('listingPlace').innerHTML = '<option value="">Select city / municipality</option>' + children.map(x => `<option value="${esc(x.psgc_code)}">${esc(x.name)}</option>`).join(''); $('listingPlace').disabled = !children.length; fillListingBarangays();
}
function fillListingBarangays() {
  const parent = resolver.getByPsgc($('listingPlace').value); const children = parent ? resolver.childrenOf(parent.psgc_code).filter(x => x.type === 'barangay').sort(byName) : [];
  $('listingBarangay').innerHTML = '<option value="">Select barangay (optional)</option>' + children.map(x => `<option value="${esc(x.psgc_code)}">${esc(x.name)}</option>`).join(''); $('listingBarangay').disabled = !children.length;
}
async function addListing() {
  const name = $('listingName').value.trim();
  const place = resolver.getByPsgc($('listingBarangay').value || $('listingPlace').value || $('listingProvince').value);
  const lat = Number($('listingLat').value), lng = Number($('listingLng').value);
  if (!name || !place || !Number.isFinite(lat) || !Number.isFinite(lng)) return alert('Listing name, location, latitude and longitude are required.');

  const listing = {
    listing_id: `CH-${Date.now()}`,
    name,
    psgc_code: place.psgc_code,
    latitude: lat,
    longitude: lng,
    place_type: $('listingType').value,
    listing_tier: $('listingTier').value,
    price: $('listingPrice').value ? Number($('listingPrice').value) : null,
    price_period: $('listingPrice').value ? 'month' : null,
    contact: $('listingContact').value.trim() || null,
    hours: $('listingHours').value.trim() || null,
    verification_status: $('listingVerification').value,
    description: $('listingDescription').value.trim() || null,
    photos: $('listingPhotos').value.split(/\\r?\\n/).map(x => x.trim()).filter(Boolean).slice(0, 6),
    address: resolver.fullAddress(place),
    source_url: null,
    created_at: new Date().toISOString()
  };

  const queue = getQueue();
  queue.push(listing);
  saveQueue(queue);

  // The queue remains the review record, while the connected dataset is updated
  // immediately so the main map can use the same source file without repeated exports.
  const records = [...getCommunityRecords(), listing];
  try {
    const result = await writeCommunityRecords(records);
    if (result.written) {
      setQueue([]);
      alert(`Added to ${result.name}. Refresh CivicHorizon to see the new place on the map.`);
    } else {
      setCommunityRecords(records);
      alert('Listing queued locally. Connect your existing community_listings.json once to enable automatic writing.');
    }
  } catch (error) {
    alert(`The listing was saved to the local queue, but the dataset could not be updated: ${error.message}`);
  }
  clearListingForm();
  renderListingQueue();
  updateCommunityFileStatus();
}

async function connectCommunityDataset() {
  try {
    const result = await connectCommunityFile();
    $('communityFileStatus').textContent = `Connected: ${result.name} · ${result.records.length} listing(s) loaded.`;
    $('communityFileStatus').className = 'sub success';
    renderListingQueue();
  } catch (error) {
    $('communityFileStatus').textContent = error.message;
    $('communityFileStatus').className = 'sub error';
  }
}

function updateCommunityFileStatus() {
  const name = getConnectedFileName();
  if ($('communityFileStatus')) $('communityFileStatus').textContent = name ? `Connected: ${name}. New approved listings will be written directly to this file.` : 'Not connected. Connect the existing community_listings.json once; after that, new listings are written directly to it.';
}

function getQueue() { try { return JSON.parse(localStorage.getItem(LISTING_STORAGE) || '[]'); } catch { return []; } }
function saveQueue(queue) { localStorage.setItem(LISTING_STORAGE, JSON.stringify(queue)); }
function clearListingForm() { ['listingName','listingPrice','listingContact','listingHours','listingLat','listingLng','listingDescription','listingPhotos'].forEach(id => { $(id).value = ''; }); }
function renderListingQueue() {
  const queue = getQueue();
  $('listingQueue').innerHTML = queue.length ? `<div class="queue-header"><strong>Review queue</strong><span>${queue.length} pending local item${queue.length===1?'':'s'}</span></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Type</th><th>Location</th><th>Status</th><th></th></tr></thead><tbody>${queue.map((r,i)=>`<tr><td>${esc(r.name)}</td><td>${esc(r.place_type)}</td><td>${esc(r.address)}</td><td>${esc(r.verification_status)}</td><td><button class="mini-button" data-remove-listing="${i}">Remove</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">No unsaved local queue items.</p>';
  document.querySelectorAll('[data-remove-listing]').forEach(btn => btn.onclick = () => { const q=getQueue(); q.splice(Number(btn.dataset.removeListing),1); saveQueue(q); renderListingQueue(); });
}
function exportCommunityListings() {
  const records = getCommunityRecords();
  downloadCommunityPayload(records);
}

function byName(a,b){return a.name.localeCompare(b.name)}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
