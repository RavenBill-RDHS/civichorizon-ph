export async function loadLocations() {
  const response = await fetch("./data/locations.json", { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Location data request failed (${response.status}).`);
  }

  const locations = await response.json();

  if (!Array.isArray(locations) || locations.length === 0) {
    throw new Error("Location data is empty or invalid.");
  }

  return locations;
}
