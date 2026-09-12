export const datasetRegistry = [
  { datasetId: "psa_psgc_2026_q2", name: "PSGC 2Q 2026", provider: "Philippine Statistics Authority", status: "active", role: "foundation" },
  { datasetId: "gadm_phl_raw", name: "GADM Philippines", provider: "GADM", status: "active", role: "foundation" }
];

export const conceptRegistry = {
  location_identity: "Location Identity", population: "Population", area: "Geographic Area", population_density: "Population Density", classification: "Administrative / Statistical Classification",
  schools: "Schools", hospitals: "Hospitals", roads: "Roads", transport: "Transport", flood_hazards: "Flood Hazards", businesses: "Businesses", housing: "Housing", rental_prices: "Rental Prices", development: "Development", land_use: "Land Use", infrastructure: "Infrastructure", demographics: "Demographics"
};

export function getConceptLabel(concept) {
  return conceptRegistry[concept] || titleCase(concept || "Dataset");
}

export function registerManifestDatasets(manifest) {
  return (manifest?.datasets || []).map(d => ({
    datasetId: d.dataset_id,
    name: d.name,
    provider: d.provider,
    status: d.status || "planned",
    role: d.role || "external",
    concept: d.concept || d.entity_type || "unknown",
    enabled: d.enabled !== false
  }));
}

function titleCase(value) {
  return String(value).replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
