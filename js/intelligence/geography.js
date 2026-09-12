import { gadmCalculated } from "./provenance.js";

export function buildGeography(l) {
  return {
    areaKm2: l.area_km2,
    available: Number.isFinite(l.area_km2) && l.area_km2 > 0,
    source: gadmCalculated("Area calculated from GADM administrative geometry using an equal-area projection")
  };
}
