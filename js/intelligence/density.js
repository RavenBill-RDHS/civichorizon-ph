import { civicDerived } from "./provenance.js";

export function buildDensity(l) {
  return {
    value: l.population_density_2024,
    year: 2024,
    available: Number.isFinite(l.population_density_2024),
    source: civicDerived("2024 population divided by mapped administrative area")
  };
}
