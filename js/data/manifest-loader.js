export async function loadManifest() {
  const response = await fetch("./data/manifest.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Manifest request failed (${response.status}).`);
  const manifest = await response.json();
  if (!manifest || !Array.isArray(manifest.datasets)) throw new Error("CivicHorizon manifest is invalid.");
  return manifest;
}
