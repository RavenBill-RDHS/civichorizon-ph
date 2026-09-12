import { parseCSV } from "./csv.js";
import { validateDatasetPayload, DEFAULT_LOCATION_FIELDS } from "./contract.js";
import { normalizeCode } from "./resolver.js";

export const CANONICAL_FIELDS = [
  "id", "name", "psgc_code", "location_id", "correspondence_code", "parent_psgc_code",
  "latitude", "longitude", "address", "status", "category", "value", "price", "price_period", "contact", "description"
];

export async function readIntakeFile(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "csv") return { format: "csv", records: parseCSV(await file.text()), sourceName: file.name };
  if (extension === "json") {
    const payload = JSON.parse(await file.text().replace(/^\uFEFF/, ""));
    const records = normalizeJsonContainer(payload);
    if (!Array.isArray(records)) throw new Error("JSON must be an array, contain records[], data[], items[], or a common nested record collection.");
    return { format: "json", records: records.map(flattenRecord), sourceName: file.name };
  }
  throw new Error("Unsupported file type. Use CSV or JSON.");
}

export function repairRecords(records, resolver = null) {
  const source = Array.isArray(records) ? records : [];
  const repaired = [];
  const log = [];
  const seen = new Set();
  let generatedIds = 0;
  let normalizedCodes = 0;
  let normalizedNumbers = 0;
  let inferredLocations = 0;

  for (let index = 0; index < source.length; index++) {
    const original = flattenRecord(source[index]);
    const output = {};
    const fieldMap = {};
    for (const [key, value] of Object.entries(original)) {
      const canonical = canonicalFromKey(key);
      if (!canonical) continue;
      if (!hasValue(output[canonical]) || canonical === key) {
        output[canonical] = cleanValue(value, canonical);
        fieldMap[key] = canonical;
      }
    }

    if (!hasValue(output.id) && hasValue(output.name)) {
      output.id = slug(`${output.name}-${output.psgc_code || index + 1}`);
      generatedIds++;
    }
    if (hasValue(output.psgc_code)) {
      const before = String(output.psgc_code);
      output.psgc_code = normalizePsgc(output.psgc_code);
      if (before !== output.psgc_code) normalizedCodes++;
    }
    for (const key of ["latitude", "longitude", "price", "value"]) {
      if (hasValue(output[key])) {
        const before = output[key];
        output[key] = numeric(before);
        if (before !== output[key]) normalizedNumbers++;
      }
    }

    if (!hasValue(output.psgc_code) && resolver) {
      const name = output.location_name || output.barangay_name || output.municipality_name || output.city_name || output.province_name;
      const parent = output.parent_psgc_code;
      if (name) {
        const match = resolver.resolveRecord({ name, parent_psgc_code: parent }, { allow_name_matching: true });
        if (match.location) {
          output.psgc_code = match.location.psgc_code;
          output.parent_psgc_code = match.location.parent_psgc_code || output.parent_psgc_code;
          inferredLocations++;
        }
      }
    }

    if (hasValue(output.id)) {
      let id = String(output.id).trim();
      const base = id;
      let suffix = 2;
      while (seen.has(id)) id = `${base}-${suffix++}`;
      if (id !== base) log.push(`Row ${index + 1}: duplicate id '${base}' renamed to '${id}'.`);
      output.id = id;
      seen.add(id);
    }

    repaired.push(output);
    if (index < 50) {
      const changed = Object.entries(fieldMap).filter(([from, to]) => from !== to);
      if (changed.length) log.push(`Row ${index + 1}: normalized ${changed.map(([a,b]) => `${a} → ${b}`).join(", ")}.`);
    }
  }

  if (generatedIds) log.unshift(`${generatedIds} record(s): generated stable ids from name + geographic identity.`);
  if (normalizedCodes) log.unshift(`${normalizedCodes} PSGC value(s): normalized whitespace/casing and removed unsafe decimal formatting.`);
  if (normalizedNumbers) log.unshift(`${normalizedNumbers} numeric value(s): converted numeric text to numbers where possible.`);
  if (inferredLocations) log.unshift(`${inferredLocations} record(s): inferred PSGC from a location name + parent when a stable code was missing.`);
  if (!log.length) log.push("No repairs were necessary; the source already looks compatible.");

  return { records: repaired, log, stats: { source: source.length, output: repaired.length, generatedIds, normalizedCodes, normalizedNumbers, inferredLocations } };
}

export function suggestMappings(headers) {
  const normalized = headers.map(h => [h, normalizeKey(h)]);
  const suggestions = {};
  for (const canonical of CANONICAL_FIELDS) {
    const aliases = FIELD_ALIASES[canonical] || [canonical];
    const match = normalized.find(([, key]) => aliases.some(alias => key === alias || key.includes(alias)));
    if (match) suggestions[canonical] = match[0];
  }
  if (!suggestions.psgc_code) {
    const stable = normalized.find(([h]) => DEFAULT_LOCATION_FIELDS.some(f => normalizeKey(f) === normalizeKey(h)));
    if (stable) suggestions.psgc_code = stable[0];
  }
  return suggestions;
}

export function mapRecords(records, mappings) {
  return records.map(source => {
    const output = {};
    for (const [canonical, sourceField] of Object.entries(mappings)) {
      if (!sourceField) continue;
      const value = source?.[sourceField];
      if (value !== undefined && value !== null && String(value).trim() !== "") output[canonical] = cleanValue(value, canonical);
    }
    return output;
  });
}

export function inspectJoins(records, definition, resolver) {
  const methods = {}, unresolved = [], matched = [];
  for (const record of records) {
    const result = resolver.resolveRecord(record, definition);
    if (!result.location) unresolved.push(record);
    else {
      matched.push({ record, location: result.location, method: result.method, confidence: result.confidence });
      methods[result.method] = (methods[result.method] || 0) + 1;
    }
  }
  return { sourceRecordCount: records.length, matchedRecordCount: matched.length, unresolvedCount: unresolved.length, matchRate: records.length ? matched.length / records.length : 0, methods, unresolvedSample: unresolved.slice(0, 20).map(record => pickIdentity(record)) };
}

export function buildManifestDefinition(meta) {
  return {
    dataset_id: meta.dataset_id, name: meta.name, provider: meta.provider, reference_date: meta.reference_date || null,
    status: "active", enabled: true, path: `./data/datasets/${meta.file_name}`, format: "json", entity_type: meta.entity_type || "unknown",
    concept: meta.concept || "", unique_field: meta.unique_field || undefined,
    location_fields: meta.location_fields?.length ? meta.location_fields : ["psgc_code", "location_id", "correspondence_code"], allow_name_matching: false
  };
}

function normalizeJsonContainer(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return null;
  for (const key of ["records", "data", "items", "results", "features"]) {
    if (Array.isArray(payload[key])) {
      if (key === "features") return payload[key].map(feature => ({ ...(feature.properties || {}), ...(feature.geometry?.coordinates ? { longitude: feature.geometry.coordinates[0], latitude: feature.geometry.coordinates[1] } : {}) }));
      return payload[key];
    }
  }
  return null;
}

function flattenRecord(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return {};
  const output = {};
  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const joined = `${key}_${nestedKey}`;
        if (!hasValue(output[joined])) output[joined] = nestedValue;
      }
    } else output[key] = value;
  }
  return output;
}

function canonicalFromKey(key) {
  const normalized = normalizeKey(key);
  for (const [canonical, aliases] of Object.entries(FIELD_ALIASES)) if (aliases.some(alias => normalized === alias || normalized.includes(alias))) return canonical;
  const exact = CANONICAL_FIELDS.find(field => normalizeKey(field) === normalized);
  return exact || normalized;
}
function cleanValue(value, canonical) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    let s = value.replace(/^\uFEFF/, "").trim();
    if (!s) return null;
    if (["latitude", "longitude", "price", "value"].includes(canonical)) return numeric(s);
    if (["psgc_code", "location_id", "correspondence_code"].includes(canonical)) return normalizePsgc(s);
    return s;
  }
  return value;
}
function normalizePsgc(value) {
  const s = String(value ?? "").trim().replace(/\.0+$/, "");
  return s;
}
function numeric(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : value;
  const s = String(value).replace(/,/g, "").replace(/₱/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : value;
}
function hasValue(v) { return v !== undefined && v !== null && String(v).trim() !== ""; }
function slug(value) { return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100); }
function pickIdentity(record) { const keys = DEFAULT_LOCATION_FIELDS.filter(key => record?.[key] !== undefined); return Object.fromEntries(keys.map(key => [key, record[key]])); }
function normalizeKey(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }
const FIELD_ALIASES = {
  id: ["id", "code", "listing_id", "place_id", "business_id", "facility_id", "school_id", "establishment_id"],
  name: ["name", "title", "business_name", "place_name", "listing_name", "school_name", "facility_name", "establishment_name"],
  psgc_code: ["psgc", "psgc_code", "psgcid", "psgc_id", "psgc_code_"],
  location_id: ["location_id", "locationid"], correspondence_code: ["correspondence_code", "correspondencecode"], parent_psgc_code: ["parent_psgc_code", "parent_psgc", "parent_code"],
  latitude: ["latitude", "lat", "y"], longitude: ["longitude", "lon", "lng", "long", "x"], address: ["address", "street_address", "full_address"],
  status: ["status", "active", "availability", "available"], category: ["category", "type", "classification", "place_type", "business_type"], value: ["value", "count", "amount"],
  price: ["price", "rent", "monthly_rent", "monthly_price", "rate"], price_period: ["price_period", "period", "rental_period"], contact: ["contact", "phone", "telephone", "email", "contact_info"], description: ["description", "details", "about", "notes"]
};
