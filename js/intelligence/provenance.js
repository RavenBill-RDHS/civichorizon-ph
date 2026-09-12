// Standard provenance helpers for CivicHorizon intelligence values.
// Keeps source, date, geography, method, and confidence separate from display text.

export const SOURCES = {
  psa: {
    datasetId: "psa_psgc_2026_q2",
    name: "PSGC 2Q 2026",
    provider: "Philippine Statistics Authority",
    referenceDate: "2026-06-30"
  },
  gadm: {
    datasetId: "gadm_phl_raw",
    name: "GADM Philippines",
    provider: "GADM",
    referenceDate: null
  },
  civicDerived: {
    datasetId: "civichorizon_derived",
    name: "CivicHorizon Derived Intelligence",
    provider: "CivicHorizon",
    referenceDate: null
  }
};

export function officialPSA(method = "Directly reported by PSA") {
  return {
    ...SOURCES.psa,
    method,
    confidence: "official"
  };
}

export function gadmCalculated(method) {
  return {
    ...SOURCES.gadm,
    method,
    confidence: "calculated"
  };
}

export function civicDerived(method) {
  return {
    ...SOURCES.civicDerived,
    method,
    confidence: "derived"
  };
}
