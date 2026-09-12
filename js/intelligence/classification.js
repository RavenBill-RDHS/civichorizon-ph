import { officialPSA } from "./provenance.js";

export function buildClassification(l) {
  const available = Boolean(
    l.city_class || l.income_classification || l.urban_rural
  );

  return {
    cityClass: l.city_class || null,
    incomeClassification: l.income_classification || null,
    urbanRural: l.urban_rural || null,
    available,
    source: officialPSA("Classification fields retained from the PSA PSGC record")
  };
}
