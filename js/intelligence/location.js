import { officialPSA } from "./provenance.js";

export function buildLocationIdentity(l, resolver) {
  const ancestors = resolver ? resolver.ancestorsOf(l) : [];
  const typeOrder = { barangay: 1, city: 2, municipality: 2, province: 3, region: 4 };
  const orderedParents = [...ancestors].sort((a, b) => (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9));
  const addressParts = [
    l.name,
    ...orderedParents.map(x => x.name),
    "Philippines"
  ].filter(Boolean);

  return {
    id: l.location_id,
    psgcCode: l.psgc_code,
    correspondenceCode: l.correspondence_code,
    name: l.name,
    type: l.type,
    parentName: ancestors[0]?.name || null,
    address: addressParts.join(", "),
    addressParts,
    source: officialPSA("Geographic identity and classification from the PSA PSGC masterlist")
  };
}
