# CivicHorizon PH — Extensible Data Engine MVP

## Architecture

**Dataset → Adapter → Canonical Entity → Geographic Resolver → Intelligence → Presentation**

PSGC/GADM remain the geographic foundation. Future government datasets are independent JSON resources described in `data/manifest.json`.

## Add a new JSON dataset

1. Put the JSON file in `data/datasets/`.
2. Add a dataset definition to `data/manifest.json`.
3. Set `enabled: true`.
4. Configure `entity_type`, `concept`, and `location_fields`.
5. The generic adapter normalizes records and the intelligence layer exposes the dataset as a location capability.

Example:

```json
{
  "dataset_id": "deped_schools_2026",
  "name": "Schools",
  "provider": "DepEd",
  "reference_date": "2026-06-30",
  "status": "active",
  "enabled": true,
  "path": "./data/datasets/schools.json",
  "format": "json",
  "entity_type": "school",
  "concept": "schools",
  "location_fields": ["psgc_code", "psgcCode", "location_id"]
}
```

JSON may be either an array of records or `{ "records": [] }`.

## Engineering rules

- The UI must not depend on government source column names.
- Source differences belong in adapters/configuration.
- Stable CivicHorizon concepts belong in the registry/intelligence layer.
- Join datasets using stable geographic identifiers such as PSGC codes whenever possible; names are not primary keys.
- Optional datasets fail independently and cannot break the PSGC/GADM core experience.

## Planned dataset families

Schools, hospitals/health facilities, roads, transport, flood hazards, businesses, housing, rental prices, development, land use, infrastructure, demographics, and other compatible JSON datasets.

## Run

Use `START-CIVICHORIZON.bat` on Windows and open the displayed localhost address. Do not double-click `index.html` directly.

## Geographic Join Engine — Phase 2

CivicHorizon now has a deterministic geographic join layer for external datasets.

### Join priority

1. `psgc_code` / equivalent PSGC field
2. `location_id`
3. `correspondence_code`
4. optional name + parent matching only when `allow_name_matching: true`

### Descendant expansion

When a user selects a municipality or city, records attached to its child barangays are automatically included. This is important for datasets such as schools, hospitals, businesses, and facilities that may be published at barangay level.

### Diagnostics

Every capability now exposes:

- source record count
- matched record count
- unresolved record count
- match methods
- join confidence

A dataset with unresolved records does not break the application. Unmatched records remain outside the selected geographic result and can be audited through the dataset diagnostics.

### Adding a new dataset

Add a definition to `data/manifest.json`:

```json
{
  "dataset_id": "example_dataset_2026",
  "name": "Example Dataset",
  "provider": "Government Agency",
  "reference_date": "2026-06-30",
  "status": "active",
  "enabled": true,
  "path": "./data/datasets/example.json",
  "format": "json",
  "entity_type": "example",
  "concept": "example",
  "location_fields": ["psgc_code", "location_id"]
}
```

The core geographic resolver and intelligence pipeline do not need to be rewritten.

## Phase 3 — Data Contract & Validation Engine

Every external JSON dataset is validated before entering the intelligence pipeline.

The validator checks:

- JSON shape (`[]` or `{ records: [] }`)
- required dataset metadata
- supported format
- required record fields when configured
- geographic identity field coverage
- duplicate values when `unique_field` is configured
- invalid records
- missing geographic identity

Validation failures are isolated to the optional dataset. The PSGC/GADM foundation remains available.

### Dataset contract fields

Optional definitions can add:

```json
{
  "required_fields": ["name", "school_type"],
  "unique_field": "school_id",
  "location_fields": ["psgc_code", "barangay_psgc"]
}
```

Use `node tools/validate-dataset.mjs <file>` for local QA.

## Phase 4 — Dynamic Dataset Capabilities

The presentation layer does not hardcode individual government datasets. A valid enabled dataset with a `concept` becomes a capability automatically after geographic joining.

For example, enabling `concept: "schools"` causes the location snapshot to expose a Schools capability with count, provider, reference date, and provenance.

This pattern is intentionally generic: future datasets such as hospitals, roads, transport, flood hazards, businesses, housing, rental prices, development, land use, infrastructure, and demographics can use the same pipeline.

**Important:** dataset ingestion and UI capability generation remain separate from intelligence calculations. A future dataset can first be displayed as source data, then receive a dedicated intelligence module when its analytical rules are defined.

## Phase 5 — Dataset Intake & QA (MVP completion)

Phase 5 consolidates the remaining dataset-management features into one local workspace so CivicHorizon can move from architecture work into real government-data collection.

Open `admin.html` through the same local server as the main app.

### What Phase 5 does

- Load government **CSV** or **JSON** files locally.
- Accept **PDF** files for intake tracking, while keeping PDF table extraction outside the dependency-free MVP.
- Auto-suggest mappings from source columns to CivicHorizon canonical fields.
- Configure dataset metadata: provider, reference date, concept, entity type, unique field, and output filename.
- Configure geographic identity fields.
- Validate records against the CivicHorizon dataset contract.
- Detect invalid records, missing geography, and configured duplicate keys.
- Run deterministic joins against the PSA/GADM geography resolver.
- Report geographic match rate and unresolved-record samples.
- Preview records before export.
- Download a clean JSON dataset.
- Download a manifest definition snippet ready to merge into `data/manifest.json`.

### Recommended government-data workflow

1. Collect the original government PDF/CSV/XLSX and keep the original source unchanged.
2. If the source is a PDF, extract the relevant table into CSV/JSON and manually verify it.
3. Open `admin.html`.
4. Load the CSV/JSON.
5. Map the columns, especially PSGC/location identifiers.
6. Run **Validate & Inspect Dataset**.
7. Fix unresolved or invalid records before publication.
8. Download the clean JSON.
9. Copy the JSON into `data/datasets/`.
10. Add the generated manifest definition to `data/manifest.json` and set the dataset to `enabled: true`.
11. Reload CivicHorizon and test several locations at region/province/municipality/barangay levels.

### MVP boundary

CivicHorizon does **not** pretend that arbitrary government PDFs can be reliably converted into structured data automatically. PDF extraction is a separate data-preparation step because tables, merged cells, scanned pages, footnotes, and repeated headers require source-specific verification. Once the result is CSV or JSON, Phase 5 provides the repeatable validation and geographic QA pipeline.

### Phase 5 is the MVP data-ingestion finish line

No additional architecture phase is required before beginning real dataset collection. Future work should be **dataset-specific adapters/intelligence only when a real source requires them**, rather than adding another generic platform layer first.


## Phase 6–8 — Map, Housing, and Location Context

The MVP is now map-first. The main screen includes a MapLibre map, local geographic search, and location selection. Selecting a place focuses the map through an on-demand OpenStreetMap/Nominatim geocoder and then opens the existing CivicHorizon intelligence snapshot.

### Phase 7 housing dataset

CivicHorizon now includes one real public-source housing dataset: the Philippine Statistics Authority's **2020 Census of Population and Housing — Housing Characteristics**, represented at regional level. The source reports total housing units, occupied housing units, and occupancy rate by region. The 2020 CPH recorded 28,503,757 housing units nationally and an 88.4% national occupancy rate.

The MVP intentionally does **not** label unoccupied units as available rentals. They are census housing-stock statistics, not live property listings.

### Phase 8 location context

When a user selects a city, municipality, or barangay, CivicHorizon resolves its parent region and displays the corresponding regional housing profile as context. The UI explicitly labels this as regional context so the system does not imply city-level rental availability.

### Current product flow

Map/search → choose place → map focus → location snapshot → regional housing context → source-aware interpretation.

### Current limitation

The map uses OpenStreetMap raster tiles and Nominatim geocoding for the prototype. Production deployment should use an appropriate tile/geocoding provider, usage policy, caching strategy, and attribution arrangement.

## Phase 9 — Community listings and repair workspace

CivicHorizon now supports a manual-first contribution loop while remaining offline-first:

1. Publish a Google Form for the public "List your place" request.
2. Review submissions manually.
3. Open `admin.html` and add approved places to the local queue.
4. Export `community_listings.json`.
5. Replace `data/datasets/community_listings.json` with the exported file.
6. Keep the manifest entry enabled so the app displays the listings on the map.

The Admin Workspace also includes a Repair & Normalize stage for messy CSV/JSON sources. It detects common field aliases, nested record containers, BOM/spacing problems, numeric text, duplicate IDs, PSGC normalization, and some location-name inference before contract validation.

### OSM note
OpenStreetMap data is available under ODbL. CivicHorizon must keep the required attribution and respect ODbL share-alike rules where a derivative database is publicly used. Do not scrape Google Maps or copy proprietary listing databases.


## Business Listing Monetization — simple MVP

Only **business listings** are monetized.

- Basic business listing: **Free** — business name + location.
- Enhanced business listing: **Premium** — may include contact information, opening hours, description, photos, price/other approved details.
- Living listings, community places, housing context, hazards, and CivicHorizon location intelligence remain free.
- Payment is intentionally manual for the MVP: use the public Google Form to choose Basic or Enhanced, then collect a GCash payment/reference number only for Enhanced submissions.
- CivicHorizon manually verifies payment and approves the enhanced listing before publishing it.
- Do not collect GCash PINs, OTPs, passwords, or other credentials.


## MVP Analytics & Feedback

CivicHorizon includes optional first-party instrumentation for product learning.

### Google Analytics 4

GA4 is the recommended primary analytics system. It is free for normal web analytics use and supports custom events and event parameters.

Set the Measurement ID in `js/config.js`:

```js
analytics: {
  enabled: true,
  ga4MeasurementId: "G-XXXXXXXXXX",
  clarityProjectId: ""
}
```

Tracked CivicHorizon events include:

- `location_explore` — a geographic location was opened
- `listing_details_view` — a place/listing detail was opened
- `listing_search` — a listing search was performed
- `map_filter` — Living / Business / Other map filter changed
- `report_language_change` — report language changed
- `listing_submission_click` — public listing form opened
- `feedback_useful` — user selected Yes / Not yet
- `back_to_map` — user returned to the map

The application also sends the selected location name/level for the location exploration event. Do not send names, phone numbers, emails, addresses, or free-form user-submitted content as analytics parameters.

### Microsoft Clarity (optional)

Clarity can be enabled by adding a Clarity Project ID. It provides heatmaps and session recordings and is currently offered free by Microsoft. Use it as a UX-debugging companion rather than as the authoritative business metric.

### Feedback

Set `feedbackFormUrl` in `js/config.js` to a Google Form that asks for:

1. Was CivicHorizon useful?
2. What were you trying to find?
3. What should we add or improve?
4. Optional additional suggestion.

The Yes / Not yet buttons are recorded as analytics events. The separate suggestion link sends users to the configured form.

### Recommended measurement model

Use GA4 for:
- visitors
- sessions
- location exploration
- search/use frequency
- most explored locations
- listing interactions
- feedback usefulness

Use Clarity for:
- where users click
- scrolling behavior
- UX friction
- rage/dead clicks
- seeing where users abandon the interface

Use the actual feedback form for:
- qualitative suggestions
- requested datasets
- missing information
- user-reported errors

This gives CivicHorizon a simple free MVP measurement stack without creating a custom analytics backend.
