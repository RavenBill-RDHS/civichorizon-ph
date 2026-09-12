/**
 * Geographic identity resolver for CivicHorizon.
 *
 * The resolver is deliberately deterministic: stable identifiers are preferred
 * and name matching is only used when explicitly enabled by a dataset.
 */
export function createLocationResolver(locations) {
  const byPsgc = new Map();
  const byLocationId = new Map();
  const byCorrespondence = new Map();
  const byNameParent = new Map();
  const children = new Map();

  for (const location of locations) {
    if (location?.psgc_code) byPsgc.set(normalizeCode(location.psgc_code), location);
    if (location?.location_id) byLocationId.set(normalizeCode(location.location_id), location);
    if (location?.correspondence_code) byCorrespondence.set(normalizeCode(location.correspondence_code), location);

    const key = nameParentKey(location.name, location.parent_psgc_code);
    if (key) byNameParent.set(key, location);

    const parent = normalizeCode(location.parent_psgc_code);
    if (parent) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(location);
    }
  }

  function getByPsgc(code) {
    return byPsgc.get(normalizeCode(code)) || null;
  }

  function getByLocationId(id) {
    return byLocationId.get(normalizeCode(id)) || null;
  }

  function getByCorrespondence(code) {
    return byCorrespondence.get(normalizeCode(code)) || null;
  }

  function childrenOf(parentPsgc) {
    return children.get(normalizeCode(parentPsgc)) || [];
  }

  function ancestorsOf(location) {
    const result = [];
    let current = location;
    const seen = new Set();
    while (current?.parent_psgc_code && !seen.has(current.parent_psgc_code)) {
      seen.add(current.parent_psgc_code);
      const parent = getByPsgc(current.parent_psgc_code);
      if (!parent) break;
      result.push(parent);
      current = parent;
    }
    return result;
  }

  function isDescendant(location, ancestor) {
    if (!location || !ancestor) return false;
    if (location.psgc_code === ancestor.psgc_code) return true;
    return ancestorsOf(location).some(x => x.psgc_code === ancestor.psgc_code);
  }

  function locationsUnder(ancestor) {
    return locations.filter(location => isDescendant(location, ancestor));
  }

  /** Resolve an external dataset record to a canonical CivicHorizon location. */
  function resolveRecord(record, definition = {}) {
    const fields = definition.location_fields || [
      "psgc_code", "psgcCode", "PSGC", "location_id", "locationId",
      "correspondence_code", "correspondenceCode"
    ];

    for (const field of fields) {
      const value = record?.[field];
      if (value === undefined || value === null || value === "") continue;

      const normalized = normalizeCode(value);
      const match =
        (field.toLowerCase().includes("correspondence") && getByCorrespondence(normalized)) ||
        (field.toLowerCase().includes("location") && getByLocationId(normalized)) ||
        getByPsgc(normalized) ||
        getByCorrespondence(normalized) ||
        getByLocationId(normalized);

      if (match) {
        return { location: match, method: "stable-id", confidence: "exact" };
      }
    }

    if (definition.allow_name_matching === true) {
      const name = record?.name ?? record?.location_name ?? record?.municipality_name ?? record?.city_name;
      const parentCode = record?.parent_psgc_code ?? record?.parentPsgcCode;
      const nameMatch = byNameParent.get(nameParentKey(name, parentCode));
      if (nameMatch) return { location: nameMatch, method: "name-parent", confidence: "high" };
    }

    return { location: null, method: "unresolved", confidence: "none" };
  }

  function fullAddress(location) {
    if (!location) return "";
    const order = { barangay: 1, city: 2, municipality: 2, province: 3, region: 4 };
    const parents = ancestorsOf(location).sort((a,b)=>(order[a.type]||9)-(order[b.type]||9));
    return [location.name, ...parents.map(x => x.name), "Philippines"].filter(Boolean).join(", ");
  }

  return {
    getByPsgc,
    getByLocationId,
    getByCorrespondence,
    childrenOf,
    ancestorsOf,
    isDescendant,
    locationsUnder,
    resolveRecord,
    fullAddress,
    size: locations.length
  };
}

export function normalizeCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function nameParentKey(name, parentCode) {
  const normalizedName = String(name ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!normalizedName) return null;
  return `${normalizedName}|${normalizeCode(parentCode)}`;
}
