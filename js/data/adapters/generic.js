export function createGenericAdapter(definition) {
  const locationFields = definition.location_fields || ["location_id", "psgc_code", "psgcCode", "correspondence_code", "correspondenceCode"];
  return {
    datasetId: definition.dataset_id,
    entityType: definition.entity_type || definition.type || "unknown",
    normalize(record) {
      const locationKey = locationFields.map(field => record?.[field]).find(v => v !== undefined && v !== null && v !== "");
      return { ...record, _civic: { datasetId: definition.dataset_id, entityType: definition.entity_type || definition.type || "unknown", locationKey: locationKey == null ? null : String(locationKey) } };
    },
    normalizeAll(records) { return records.map(record => this.normalize(record)); }
  };
}
