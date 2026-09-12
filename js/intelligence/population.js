import { officialPSA } from "./provenance.js";

export function buildPopulation(l) {
  return {
    value: l.population_2024,
    year: 2024,
    available: Number.isFinite(l.population_2024),
    source: officialPSA("2024 POPCEN population value published with the PSGC record")
  };
}
