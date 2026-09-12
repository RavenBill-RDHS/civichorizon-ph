/**
 * Local community-listing store.
 * Uses the browser File System Access API when available so approved listings
 * can be written directly into data/datasets/community_listings.json.
 * Falls back to an explicit JSON export when the browser cannot write files.
 */
const STORE_KEY = "civichorizon.communityListings.v2";
let fileHandle = null;
const DB_NAME = "civichorizon-files";
const DB_STORE = "handles";
function openDb(){ return new Promise((resolve,reject)=>{ const req=indexedDB.open(DB_NAME,1); req.onupgradeneeded=()=>req.result.createObjectStore(DB_STORE); req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error); }); }
async function saveHandle(handle){ try{const db=await openDb(); await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readwrite"); tx.objectStore(DB_STORE).put(handle,"community"); tx.oncomplete=res; tx.onerror=()=>rej(tx.error);});}catch{} }
async function loadHandle(){ try{const db=await openDb(); return await new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,"readonly"); const req=tx.objectStore(DB_STORE).get("community"); req.onsuccess=()=>res(req.result||null); req.onerror=()=>rej(req.error);});}catch{return null;} }
export async function restoreCommunityFile(){ const h=await loadHandle(); if(!h)return null; try{ const permission=await h.queryPermission({mode:"readwrite"}); if(permission==="granted"){fileHandle=h; return h;} }catch{} return null; }

export function getCommunityRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}

export function setCommunityRecords(records) {
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

export function getConnectedFileName() {
  return fileHandle?.name || "";
}

export async function connectCommunityFile() {
  if (!window.showOpenFilePicker) throw new Error("Direct file writing is not supported by this browser. Use Chrome or Edge, or export the JSON manually.");
  const [handle] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: "CivicHorizon community dataset", accept: { "application/json": [".json"] } }],
    excludeAcceptAllOption: false
  });
  const file = await handle.getFile();
  const text = await file.text();
  const parsed = JSON.parse(text);
  const records = Array.isArray(parsed) ? parsed : parsed?.records;
  if (!Array.isArray(records)) throw new Error("The selected file is not a CivicHorizon community dataset. It must contain records[].");
  fileHandle = handle;
  await saveHandle(handle);
  setCommunityRecords(records);
  return { records, name: handle.name };
}

export async function writeCommunityRecords(records) {
  setCommunityRecords(records);
  if (!fileHandle) return { written: false };
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(buildPayload(records), null, 2));
  await writable.close();
  return { written: true, name: fileHandle.name };
}

export function buildPayload(records) {
  return {
    dataset_id: "civichorizon_community_listings",
    name: "CivicHorizon Community Listings",
    provider: "CivicHorizon",
    reference_date: null,
    status: "active",
    concept: "community_listings",
    entity_type: "place",
    location_fields: ["psgc_code"],
    required_fields: ["listing_id", "name", "psgc_code", "latitude", "longitude", "place_type"],
    unique_field: "listing_id",
    records
  };
}

export function downloadCommunityPayload(records) {
  const blob = new Blob([JSON.stringify(buildPayload(records), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "community_listings.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
