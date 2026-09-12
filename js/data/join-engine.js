import { normalizeCode } from "./resolver.js";

/**
 * Deterministically joins an external dataset to the CivicHorizon geography.
 * Records attached to descendants are included when the selected location
 * is an administrative parent (e.g. municipality -> barangay-level schools).
 */
export function joinDatasetToLocation(dataset, selectedLocation, resolver) {
  const records = Array.isArray(dataset?.records) ? dataset.records : [];
  const definition = dataset || {};
  const matches = [];
  const unmatched = [];
  const methods = {};

  for (const record of records) {
    const resolved = resolver.resolveRecord(record, definition);
    if (!resolved.location) {
      unmatched.push({ record, reason: "unresolved-location" });
      continue;
    }

    const same = resolved.location.psgc_code === selectedLocation.psgc_code;
    const descendant = resolver.isDescendant(resolved.location, selectedLocation);

    if (same || descendant) {
      const method = same ? resolved.method : `${resolved.method}+descendant`;
      matches.push({
        ...record,
        _civic: {
          ...(record._civic || {}),
          datasetId: dataset.dataset_id,
          entityType: dataset.entity_type || dataset.type || "unknown",
          locationId: resolved.location.location_id,
          locationPsgc: resolved.location.psgc_code,
          locationName: resolved.location.name,
          joinMethod: method,
          joinConfidence: resolved.confidence
        }
      });
      methods[method] = (methods[method] || 0) + 1;
    }
  }

  return {
    datasetId: dataset.dataset_id,
    concept: dataset.concept || dataset.entity_type || "unknown",
    records: matches,
    unmatchedCount: unmatched.length,
    matchCount: matches.length,
    sourceRecordCount: records.length,
    matchRate: records.length ? matches.length / records.length : 0,
    methods
  };
}

/** Build an indexed lookup for repeated location queries. */
export function createDatasetJoinIndex(dataset, resolver) {
  const byLocation = new Map();
  const unresolved = [];
  const records = Array.isArray(dataset?.records) ? dataset.records : [];

  for (const record of records) {
    const resolved = resolver.resolveRecord(record, dataset);
    if (!resolved.location) {
      unresolved.push(record);
      continue;
    }
    const key = normalizeCode(resolved.location.psgc_code);
    if (!byLocation.has(key)) byLocation.set(key, []);
    byLocation.get(key).push({
      ...record,
      _civic: {
        ...(record._civic || {}),
        datasetId: dataset.dataset_id,
        entityType: dataset.entity_type || dataset.type || "unknown",
        locationId: resolved.location.location_id,
        locationPsgc: resolved.location.psgc_code,
        locationName: resolved.location.name,
        joinMethod: resolved.method,
        joinConfidence: resolved.confidence
      }
    });
  }

  const methods = {};
  for (const records of byLocation.values()) for (const record of records) {
    const method = record?._civic?.joinMethod || "unknown";
    methods[method] = (methods[method] || 0) + 1;
  }
  return { datasetId: dataset.dataset_id, byLocation, unresolvedCount: unresolved.length, matchedRecordCount: records.length - unresolved.length, methods };
}
