# Tasks — Location Evaluation

**Version:** 0.1
**Status:** In progress
**Last updated:** 2026-11-08
**Builds on:** the MVP in `01-mvp.md` (auth, onboarding, dashboard). Task IDs continue that file's numbering.

## 1. Goal

A user with completed onboarding enters a reference location, an exploration radius and, optionally, a monthly rent. The system reads INEGI DENUE, an AI agent proposes up to three alternative zones, the backend validates and scores them, and the user reviews results, a detail per zone, a comparison and a chat with the agent.

Development principles from `01-mvp.md` §1 still apply: one task at a time, TDD where practical, no scope beyond this file, automated tests only against the local stack, UI in both languages with the approved design system.

## 2. Audit summary (2026-11-08)

- **Exists and is reused:** Supabase auth, `guardPage` route protection, `profiles` and `businesses` with RLS, the onboarding industry (`lib/industries.ts`, 10 broad categories), next-intl messages (es/en), UI primitives (`TextField`, `SelectField`, `Button`, `FormAlert`, `PageIntro`, `StatusBadge`), `DashboardLayout`, Vitest/pgTAP/Playwright setup, secret scanner, CI.
- **Missing:** DENUE client, geocoding, map, AI integration, scoring, evaluation storage, all Location Evaluation screens.
- **DENUE facts that shape the design** (`inegi.org.mx/servicios/api_denue.html`):
  - `Buscar/todos/{lat},{lon}/{meters}/{token}` is the only method that searches by radius (max 5,000 m, no paging documented).
  - It returns the activity **name** (`Clase_actividad`), not the SCIAN code. The SCIAN class appears to be characters 6–11 of `CLEE`; TASK-024 verifies this with a real response.
  - `Estrato` is a text range ("0 a 5 personas" … "251 y más personas").
  - The API exposes no dataset edition or update date; the UI shows the query date and says the edition is not reported.
  - A free token is required.
- **Documented rules this feature must change (need approval):** `architecture.md` §6/§11 say the app needs no secrets; DENUE and the AI provider need a server-only DENUE token. The repository is public, so the secret scanner must learn the new key formats.

## 3. Tasks

### Phase 0 — Decisions and specification

#### TASK-022: Close blocking decisions

**Status:** Approved (2026-11-08). D6 changed to Claude Code; the rest as proposed.

**Scope:** approve or change decisions D1–D8 below. Each one changes results or behavior.

**D1 — Geocoding.** Nominatim (OpenStreetMap, open data) called from the server. The user types an address, colonia or place and presses Search; up to 5 results in Mexico; the user picks one. No search-as-you-type, because Nominatim's usage policy forbids autocomplete (1 request/s, identifying User-Agent). Alternatives: Photon (OSM, allows autocomplete, public instance is best-effort), Mapbox or Google (better results, paid keys, not open).

**D2 — Map.** Leaflet with OpenStreetMap tiles and attribution. No key needed.

**D3 — Activity classification.** "Same industry" and "related businesses" are SCIAN prefixes per onboarding category. The category is broad, so "same industry" covers the whole category. `other` has no mapping: competition and related businesses show as not available.

| Onboarding industry | Same industry (SCIAN) | Related businesses (SCIAN) |
|---|---|---|
| food_beverage | 722 Food and beverage preparation | 461 Grocery and food retail; 7139 Recreation; 721 Lodging |
| clothing_accessories | 463 Textiles, accessories and footwear retail | 462 Department and self-service stores; 465 Personal-use articles; 8121 Beauty salons |
| technology_electronics | 4662 Computer and phone retail; 8112 Electronic repair | 465 Stationery and personal-use articles; 462 Department stores |
| beauty_personal_care | 8121 Beauty salons and clinics | 463 Clothing and accessories; 464 Health-care articles (pharmacies) |
| health | 621 Outpatient medical services | 464 Pharmacies and health articles; 622 Hospitals |
| education | 611 Educational services | 465 Stationery; 722 Food and beverages |
| professional_services | 54 Professional, scientific and technical services | 52 Financial services; 53 Real estate; 56 Business support |
| construction_maintenance | 23 Construction; 811 Repair and maintenance | 467 Hardware stores; 4661 Furniture and household goods |
| retail | 46 Retail trade | 722 Food and beverages; 812 Personal services |
| other | — | — |

**D4 — How the agent proposes zones and how they are validated.**
1. The backend fetches DENUE once, for the exploration radius plus 300 m.
2. It splits the exploration circle into 300 m cells. Each cell with at least 10 establishments becomes a candidate: center = average position of its establishments, zone = 300 m circle around that center, metrics computed on that circle.
3. The agent receives the candidates' metrics (counts by category, staff ranges, top activities, most common colonia and street), never scores, and returns up to three candidate IDs, each with opportunities, considerations and a conclusion. The output must match a JSON schema.
4. The backend accepts a zone only if the ID exists, its center is inside the exploration radius and it is at least 400 m from an already accepted zone. Every number in the agent's text must equal a metric of that zone; otherwise the zone is dropped. One retry if the response breaks the schema.
5. The zone's name is built from data (most common colonia and street), not written by the agent.
6. Fewer valid zones than three → show fewer. Zero → "not enough valid alternatives" with the reason.

Alternative: let the agent pick free coordinates plus supporting DENUE IDs. It needs establishment-level data in the prompt (thousands of rows: slow and costly), so it is not recommended.

**D5 — Scoring (0–100), computed only by the backend.** Each factor compares the zone with the whole exploration area, so it is explainable as "N times the area's average".

| Factor | Measures | Value | Weight |
|---|---|---|---|
| Commercial activity | Establishment density | min(zone density ÷ area density ÷ 2, 1) | 30 |
| Direct competition | Same-industry density (lower is better) | 1 − min(zone ÷ area ratio ÷ 2, 1); 1 when the area has none | 30 |
| Related businesses | Related-business density | min(zone ÷ area ratio ÷ 2, 1); 0 when the area has none | 25 |
| Staff size | Minimum people employed (sum of each `Estrato`'s lower bound) | min(zone ÷ area ratio ÷ 2, 1) | 15 |

Score = round(100 × Σ weight × value ÷ Σ weight of available factors). A factor without data shows as "not available" and its weight is left out. Same data and parameters → same score. Rent is shown but never scored.

**D6 — AI provider (approved 2026-11-08: Claude Code, no API key).** `@anthropic-ai/claude-agent-sdk` runs Claude through the Claude Code login on the machine that runs `next dev`. Verified 2026-11-08: no API key used, structured output works, about 3 s per call. Server only, model `claude-opus-5-5`. The agent is isolated: no tools (`tools: []`), no settings, CLAUDE.md or MCP servers (`settingSources: []`, `strictMcpConfig`), an empty working directory and sessions not persisted. One structured-output call for the proposal; one call per chat message, with the stored evaluation as context. This works only because the app runs locally for its owner; it cannot serve other users with that login.

**D7 — Storage.** New table `location_evaluations` (`user_id`, input, result as `jsonb`, `created_at`) with RLS limited to the owner. It gives detail and comparison pages a URL and lets the chat load trusted context from the database. No history screen. Chat messages are not stored.

**D8 — Secrets.** `DENUE_TOKEN` lives in `.env.local`, server only, never `NEXT_PUBLIC_`; `.env.example` lists it without a value. Claude needs no key in the project. Tests never call DENUE or Claude.

**Known limitation to accept:** the zone scores are reproducible, but the agent may pick different zones if the same evaluation is run again. A stored evaluation always shows the same result.

**Done when:** D1–D8 are approved or replaced.

---

#### TASK-023: Specify Location Evaluation

**Status:** Done (2026-11-08). `requirements.md` FR-14–FR-19, NFR-08, AR-06–AR-08; `specification.md` §12; `architecture.md` §15; `database.md` §13.

**Dependencies:** TASK-022.

**Scope:** add the approved decisions to the existing documents, concisely:
- `requirements.md`: FR and NFR entries for Location Evaluation, out-of-scope list.
- `specification.md`: SPEC-LOC entries (form, results, detail, comparison, chat, errors) with acceptance criteria.
- `architecture.md`: flow, frontend–backend–agent contracts, DENUE and geocoding integration, scoring, secrets.
- `database.md`: `location_evaluations`.

**Done when:** the four documents agree with D1–D8.

---

### Phase 1 — Data and scoring (backend, unit-tested)

#### TASK-024: DENUE client

**Status:** In progress. Client and parser done (`lib/location/denue.ts`), tested with a fixture in the documented format. Pending: a valid token, then replace the fixture with a real response and confirm the `CLEE` SCIAN position and the response size in a dense area.

**Dependencies:** TASK-023. Needs a DENUE token.

**Scope:** `Buscar` call with timeout; parse each record into an establishment (DENUE ID, name, activity name, SCIAN class from `CLEE`, address, coordinates, staff range); errors for network failure, invalid token and malformed data. Save one real response as a test fixture, without personal contact fields.

**Tests:** parsing of the fixture, bad coordinates skipped, unknown `Estrato`, HTTP error mapping.

#### TASK-025: Classification, distances and candidate zones

**Status:** Done (2026-11-08). `classification.ts`, `zones.ts`.

**Dependencies:** TASK-024.

**Scope:** industry → SCIAN prefixes (D3), haversine distance, 300 m cells, candidate centers and zone metrics (D4 steps 1–2), "insufficient data" detection.

**Tests:** classification per category, distances, candidate generation on a small hand-made dataset.

#### TASK-026: Scoring engine

**Status:** Done (2026-11-08). `scoring.ts`; contributions add up to the score.

**Dependencies:** TASK-025.

**Scope:** the four factors, weights and missing-factor rule (D5), with the data used and the contribution of each factor.

**Tests:** each factor's edge cases, missing factors, determinism.

### Phase 2 — Storage

#### TASK-027: `location_evaluations` table

**Status:** Done locally (2026-11-08). Migration `20261108215505_create_location_evaluations.sql`, pgTAP `070`, `060` updated; only `input` and `result` are insertable. Pending: the user runs `db push`.

**Dependencies:** TASK-023.

**Scope:** migration with RLS (owner reads and inserts), pgTAP tests, regenerated types. The user applies it to the Supabase project with `db push`.

**Tests:** pgTAP: a user cannot read or write another user's evaluation.

### Phase 3 — Agent and pipeline

#### TASK-028: Agent zone proposal

**Status:** Done (2026-11-08). `agent.ts` (prompt, schema, validation, one retry) and `claude.ts` (Agent SDK, isolated). Smoke test with Claude Code: 14 s; the number check dropped a zone that quoted another zone's figure.

**Dependencies:** TASK-026.

**Scope:** system prompt, JSON schema, Agent SDK call (D6), validation and retry (D4 steps 3–6).

**Tests (mocked model):** schema violation, unknown candidate ID, zone outside the radius, zones too close, unsupported number in the text, fewer than three valid zones.

#### TASK-029: Evaluation pipeline

**Status:** Done (2026-11-08). `evaluate.ts`, `input.ts` and the `runEvaluation` server action. To measure with real DENUE data: prompt size with a 3 km radius in a dense area.

**Dependencies:** TASK-027, TASK-028.

**Scope:** server action: geocoded input → DENUE → candidates → agent → validation → scoring → save → redirect to results. Errors: DENUE failure, insufficient data, analysis failure; the form keeps its values for a retry.

**Tests:** pipeline with DENUE and the model mocked: success, DENUE error, insufficient data, no valid zones.

### Phase 4 — Screens

Each UI task starts with a short design proposal for approval (UX direction).

#### TASK-030: Evaluation form

**Dependencies:** TASK-029.

**Scope:** dashboard entry point; address search with result list (D1); radius (default 1 km); optional rent; the industry comes from onboarding. Errors: address not found, DENUE failure, analysis failure with retry.

#### TASK-031: Results screen

**Dependencies:** TASK-030.

**Scope:** reference location, radius, map with reference and numbered zone markers, up to three cards sorted by score (name, location, score, short explanation, detail and compare actions), source and query date.

#### TASK-032: Zone detail

**Dependencies:** TASK-031.

**Scope:** sections A–I of the brief: identification, score, factor breakdown, map with nearby establishments (same industry vs other) and marker details, agent explanation, establishment summary and list, source and limitations, rent as entered or "not provided", back / compare / ask agent / view establishments.

#### TASK-033: Comparison

**Dependencies:** TASK-031.

**Scope:** table of the evaluation's zones with score, factor breakdown, activity, competition, related businesses and staff size. No charts.

#### TASK-034: Agent chat

**Dependencies:** TASK-031.

**Scope:** right-side panel on desktop, separate sheet on mobile. The server loads the evaluation from the database as context; the agent answers only from it and says when data is not available.

**Tests:** the chat refuses an evaluation that belongs to another user.

### Phase 5 — Validation

#### TASK-035: End-to-end validation

**Dependencies:** TASK-032, TASK-033, TASK-034.

**Scope:** Playwright journey with DENUE, geocoding and the model mocked at the server boundary: form → results → detail → comparison → chat. Manual smoke test with real DENUE and Claude Code. README: new variables and how to run.

## 4. Dependency summary

TASK-022 → TASK-023 → TASK-024 → TASK-025 → TASK-026 → TASK-028 → TASK-029 → TASK-030 → TASK-031 → {TASK-032, TASK-033, TASK-034} → TASK-035. TASK-027 runs any time after TASK-023 and before TASK-029.
