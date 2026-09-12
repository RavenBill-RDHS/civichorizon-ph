import { createDatasetJoinIndex } from "../data/join-engine.js";

export function buildHousingListings(location, resolver, datasets = []) {
  const sources = datasets.filter(d => ["housing_listings", "community_listings"].includes(d.concept));
  if (!sources.length) return { available: false, records: [], count: 0 };
  const records = [];
  for (const dataset of sources) {
    dataset._joinIndex || (dataset._joinIndex = createDatasetJoinIndex(dataset, resolver));
    for (const record of dataset.records || []) {
      const resolved = resolver.getByPsgc(record.psgc_code);
      if (!resolved) continue;
      if (resolver.isDescendant(resolved, location)) records.push({ ...record, _dataset: dataset.dataset_id, _provider: dataset.provider, _concept: dataset.concept });
    }
  }
  return {
    available: records.length > 0, count: records.length, records,
    source: { provider: sources.map(s => s.provider).join(" · "), name: sources.map(s => s.name).join(" · "), referenceDate: sources.map(s => s.reference_date).filter(Boolean).join(" · "), datasetId: sources.map(s => s.dataset_id).join(" · "), license: "See individual source records" }
  };
}
