import { createDatasetJoinIndex } from "../data/join-engine.js";
import { getConceptLabel } from "../data/registry.js";

export function buildDatasetCapabilities(location, datasets, resolver) {
  const capabilities = {};
  for (const dataset of datasets) {
    const index = dataset._joinIndex || createDatasetJoinIndex(dataset, resolver);
    const records = collectLocationRecords(index, location, resolver);
    const concept = dataset.concept || dataset.entity_type || "unknown";
    capabilities[concept] = {
      available: records.length > 0,
      count: records.length,
      label: getConceptLabel(concept),
      entityType: dataset.entity_type || null,
      records,
      diagnostics: dataset.validation ? {
        contractValid: dataset.validation.valid,
        contractErrors: dataset.validation.errors,
        contractWarnings: dataset.validation.warnings,
        sourceRecordCount: dataset.validation.stats.sourceRecordCount,
        invalidRecordCount: dataset.validation.stats.invalidRecordCount,
        missingLocationCount: dataset.validation.stats.missingLocationCount,
        duplicateKeyCount: dataset.validation.stats.duplicateKeyCount
      } : null,
      join: {
        sourceRecordCount: dataset.records?.length || 0,
        unresolvedCount: index.unresolvedCount,
        matchedRecordCount: countIndexedRecords(index),
        methods: index.methods || {},
        method: "PSGC/location/correspondence stable identifiers; descendant expansion",
        confidence: records.length ? "exact" : "none"
      },
      source: {
        datasetId: dataset.dataset_id,
        name: dataset.name,
        provider: dataset.provider,
        referenceDate: dataset.reference_date || null,
        method: "Deterministic geographic identity join against the CivicHorizon PSGC foundation",
        confidence: records.length ? "source-matched" : "not-matched"
      }
    };
  }
  return capabilities;
}

function collectLocationRecords(index, location, resolver) {
  const locations = resolver.locationsUnder(location);
  const records = [], seen = new Set();
  for (const child of locations) {
    const bucket = index.byLocation.get(String(child.psgc_code).trim().toUpperCase()) || [];
    for (const record of bucket) {
      if (seen.has(record)) continue;
      seen.add(record); records.push(record);
    }
  }
  return records;
}

function countIndexedRecords(index) {
  let count = 0;
  for (const records of index.byLocation.values()) count += records.length;
  return count;
}
