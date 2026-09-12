// Node-friendly contract validator for offline dataset QA.
// Usage: node tools/validate-dataset.mjs ./data/datasets/example.json
import fs from "node:fs";
import { validateDatasetPayload } from "../js/data/contract.js";

const path = process.argv[2];
if (!path) { console.error("Usage: node tools/validate-dataset.mjs <json-file>"); process.exit(2); }
const payload = JSON.parse(fs.readFileSync(path, "utf8"));
const definition = {
  dataset_id: path,
  name: path,
  provider: "Unknown",
  format: "json",
  location_fields: ["psgc_code", "psgcCode", "PSGC", "location_id", "locationId", "correspondence_code", "correspondenceCode"]
};
const result = validateDatasetPayload(definition, payload);
console.log(JSON.stringify(result, null, 2));
process.exit(result.valid ? 0 : 1);
