import { buildLocationIdentity } from "./location.js";
import { buildPopulation } from "./population.js";
import { buildGeography } from "./geography.js";
import { buildDensity } from "./density.js";
import { buildClassification } from "./classification.js";
import { buildDatasetCapabilities } from "./datasets.js";
import { buildHousingContext } from "./housing.js";
import { buildHousingListings } from "./housing-listings.js";
export function buildLocationIntelligence(l, r, intent, externalDatasets = []) {
  const datasets = buildDatasetCapabilities(l, externalDatasets, r);
  return { schemaVersion: "0.4.0", intent, identity: buildLocationIdentity(l, r), population: buildPopulation(l), geography: buildGeography(l), density: buildDensity(l), classification: buildClassification(l), datasets, housing: buildHousingContext(l, r, externalDatasets), housingListings: buildHousingListings(l, r, externalDatasets),
    availability: { population: Number.isFinite(l.population_2024), area: Number.isFinite(l.area_km2), density: Number.isFinite(l.population_density_2024), classification: Boolean(l.city_class || l.income_classification || l.urban_rural), ...Object.fromEntries(Object.entries(datasets).map(([k,v]) => [k,v.available])) } };
}
