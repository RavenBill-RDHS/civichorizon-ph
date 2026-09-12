import { validateDatasetPayload } from "./contract.js";

export async function loadDataset(definition) {
  if (!definition?.dataset_id || !definition?.path) throw new Error("Dataset definition requires dataset_id and path.");
  const response = await fetch(definition.path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Dataset '${definition.dataset_id}' failed to load (${response.status}).`);
  const payload = await response.json();
  const validation = validateDatasetPayload(definition, payload);
  if (!validation.valid) {
    const detail = validation.errors.join(" ");
    throw new Error(`Dataset '${definition.dataset_id}' failed contract validation. ${detail}`);
  }
  return { ...definition, records: validation.records, recordCount: validation.records.length, validation };
}

export async function loadOptionalDatasets(manifest) {
  const definitions = (manifest?.datasets || []).filter(d => d.enabled !== false && d.path && d.role !== "foundation");
  const loaded = [], errors = [];
  for (const definition of definitions) {
    try { loaded.push(await loadDataset(definition)); }
    catch (error) { errors.push({ datasetId: definition.dataset_id, message: error.message }); }
  }
  return { loaded, errors };
}
