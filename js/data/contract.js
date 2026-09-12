/** CivicHorizon Data Contract v1.
 * Validation is intentionally deterministic and dependency-free so it can run offline.
 */

const SUPPORTED_FORMATS = new Set(["json"]);
const VALID_STATUSES = new Set(["planned", "active", "deprecated"]);

export function validateManifest(manifest) {
  const errors = [], warnings = [];
  if (!manifest || typeof manifest !== "object") errors.push("Manifest must be an object.");
  if (!Array.isArray(manifest?.datasets)) errors.push("Manifest.datasets must be an array.");
  if (!manifest?.dataset_contract_version) warnings.push("dataset_contract_version is missing.");

  const ids = new Set();
  for (const [i, d] of (manifest?.datasets || []).entries()) {
    const result = validateDatasetDefinition(d);
    result.errors.forEach(e => errors.push(`datasets[${i}]: ${e}`));
    result.warnings.forEach(w => warnings.push(`datasets[${i}]: ${w}`));
    if (d?.dataset_id) {
      if (ids.has(d.dataset_id)) errors.push(`datasets[${i}]: duplicate dataset_id '${d.dataset_id}'.`);
      ids.add(d.dataset_id);
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateDatasetDefinition(definition) {
  const errors = [], warnings = [];
  if (!definition || typeof definition !== "object") return { valid: false, errors: ["Definition must be an object."], warnings };
  if (!nonEmpty(definition.dataset_id)) errors.push("dataset_id is required.");
  if (!nonEmpty(definition.name)) errors.push("name is required.");
  if (!nonEmpty(definition.provider)) errors.push("provider is required.");
  if (!SUPPORTED_FORMATS.has(definition.format || "json")) errors.push(`unsupported format '${definition.format}'.`);
  if (definition.status && !VALID_STATUSES.has(definition.status)) errors.push(`invalid status '${definition.status}'.`);
  if (definition.enabled === true && !nonEmpty(definition.path)) errors.push("enabled dataset requires path.");
  if (definition.location_fields && !Array.isArray(definition.location_fields)) errors.push("location_fields must be an array.");
  if (definition.required_fields && !Array.isArray(definition.required_fields)) errors.push("required_fields must be an array.");
  if (!definition.entity_type && definition.role !== "foundation") warnings.push("entity_type is missing; records will use 'unknown'.");
  if (!definition.concept && definition.role !== "foundation") warnings.push("concept is missing; UI capability may be omitted.");
  if (definition.allow_name_matching === true) warnings.push("Name matching is enabled; stable identifiers remain preferred.");
  return { valid: errors.length === 0, errors, warnings };
}

export function validateDatasetPayload(definition, payload) {
  const errors = [], warnings = [], stats = {
    sourceRecordCount: 0, validRecordCount: 0, invalidRecordCount: 0,
    missingLocationCount: 0, duplicateKeyCount: 0, detectedFields: [],
    fieldCoverage: {}
  };

  const definitionCheck = validateDatasetDefinition(definition);
  errors.push(...definitionCheck.errors);
  warnings.push(...definitionCheck.warnings);

  const records = Array.isArray(payload) ? payload : payload?.records;
  if (!Array.isArray(records)) {
    errors.push("Payload must be a JSON array or an object containing records[].");
    return { valid: false, errors, warnings, stats, records: [] };
  }

  stats.sourceRecordCount = records.length;
  const sample = records.find(r => r && typeof r === "object") || {};
  stats.detectedFields = Object.keys(sample);

  const locationFields = definition.location_fields || DEFAULT_LOCATION_FIELDS;
  for (const field of locationFields) {
    stats.fieldCoverage[field] = records.length ? records.filter(r => hasValue(r?.[field])).length / records.length : 0;
  }

  const requiredFields = definition.required_fields || [];
  const seenKeys = new Set();
  for (const record of records) {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      stats.invalidRecordCount++;
      continue;
    }
    const missingRequired = requiredFields.filter(field => !hasValue(record[field]));
    if (missingRequired.length) stats.invalidRecordCount++;
    else stats.validRecordCount++;

    const locationValue = locationFields.map(f => record[f]).find(hasValue);
    if (!hasValue(locationValue)) stats.missingLocationCount++;

    const uniqueField = definition.unique_field;
    if (uniqueField && hasValue(record[uniqueField])) {
      const key = String(record[uniqueField]).trim();
      if (seenKeys.has(key)) stats.duplicateKeyCount++;
      seenKeys.add(key);
    }
  }

  if (records.length && stats.missingLocationCount === records.length) errors.push("No record contains a configured geographic identity field.");
  if (stats.invalidRecordCount) warnings.push(`${stats.invalidRecordCount} record(s) fail required-field validation.`);
  if (stats.duplicateKeyCount) warnings.push(`${stats.duplicateKeyCount} duplicate unique_field value(s) detected.`);
  if (stats.missingLocationCount) warnings.push(`${stats.missingLocationCount} record(s) have no configured geographic identity field.`);

  return { valid: errors.length === 0, errors, warnings, stats, records };
}

export function buildDatasetDiagnostics(definition, validation, join = null) {
  return {
    datasetId: definition.dataset_id,
    name: definition.name,
    provider: definition.provider,
    contractVersion: definition.contract_version || "1.0.0",
    valid: validation.valid,
    errors: validation.errors,
    warnings: validation.warnings,
    stats: validation.stats,
    join: join ? {
      matchedRecordCount: join.matchedRecordCount ?? 0,
      unresolvedCount: join.unresolvedCount ?? 0,
      matchRate: join.sourceRecordCount ? join.matchedRecordCount / join.sourceRecordCount : 0,
      methods: join.methods || {}
    } : null,
    validatedAt: new Date().toISOString()
  };
}

export const DEFAULT_LOCATION_FIELDS = [
  "psgc_code", "psgcCode", "PSGC", "location_id", "locationId",
  "correspondence_code", "correspondenceCode"
];

function hasValue(value) { return value !== undefined && value !== null && String(value).trim() !== ""; }
function nonEmpty(value) { return typeof value === "string" && value.trim().length > 0; }
