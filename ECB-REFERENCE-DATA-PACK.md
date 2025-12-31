# ECB Reference Data Integration Pack (tEUR)

This pack provides four deliverables, in order:

1) Reference data ingestion service design  
2) `reference-data-policy.md` draft  
3) Safe internal mirroring plan for ECB data  
4) Dataset mapping for a Digital Euro style project

All guidance treats ECB data APIs as authoritative reference feeds but never a runtime dependency for settlement.

---

## 1) Reference data ingestion service design

### 1.1 ECB data interface

The ECB Data Portal exposes a SDMX 2.1 RESTful web service for programmatic access to statistical data and metadata. citeturn0search0turn0search2  
The service entry point is documented as `data-api.ecb.europa.eu/service/` and the data retrieval resource is `data` with a `flowRef` and series key. citeturn0search1

Key capability needed for this project:
- Data retrieval mode for known series (example: exchange rates, interest rates) citeturn0search2
- Discovery mode to locate and validate series, dimensions, codes citeturn0search0turn0search2

### 1.2 High level architecture

Keep the data path strictly out of settlement and consensus.

**Components**
- `reference-data-ingestor`  
  Scheduled puller that reads ECB SDMX endpoints and writes to a versioned store.
- `reference-data-store`  
  Append-only storage with immutable history, plus curated “latest snapshot” views.
- `reference-data-api`  
  Internal read-only API for other services (reporting, dashboards, governance tooling).
- `reference-data-audit`  
  Hashing, provenance, and retention enforcement.

**Data flow**
1. Ingestor calls ECB SDMX API to retrieve a specific series or a small set of series.
2. Ingestor normalizes the response into a canonical internal schema.
3. Ingestor writes:
   - Raw payload
   - Normalized records
   - Provenance and hashes
4. Consumers read only from internal API or store. Consumers never call ECB directly.

### 1.3 Canonical internal schema

Use a single model for any time series.

`series_id`
- Example: `EXR.D.USD.EUR.SP00.A` (an exchange rate series key is visible in the EXR dataset examples). citeturn0search6

`observation_time`
- ISO date or date time depending on frequency

`value`
- Decimal

`unit`
- Example: `EUR`, `INDEX`, or `RATE`

`source`
- `ecb-data-portal`

`source_flow`
- Example: `EXR` (exchange rates dataset). citeturn0search5turn0search6

`retrieved_at_utc`
- When your system fetched it

`payload_hash`
- SHA-256 hash of raw response bytes

`normalization_version`
- To support format evolution safely

### 1.4 Caching and availability goals

Rules:
- No synchronous calls from transaction routing to ECB endpoints.
- All ECB data must be available from internal cache.
- If ECB is unreachable, the system continues using last known values.
- Consumers must treat data as “stale allowed” with explicit staleness windows.

A practical approach:
- Hourly pulls for frequently changing series
- Daily pulls for reference series that update once per working day, such as ECB FX reference rates, which are published for information purposes only and updated around 16:00 CET on working days. citeturn0search3

### 1.5 Kubernetes deployment sketch

Namespaces:
- `reference-data` (ingestor, API)
- `obs-global` (metrics, logging)

Objects:
- `CronJob` for ingestion schedules
- `Deployment` for API
- `NetworkPolicy` to restrict egress:
  - Allow egress only to ECB API endpoints for the ingestor
  - No egress required for internal API

### 1.6 Failure behavior

If ECB API fails:
- Ingestor records failure and emits metric `teur_refdata_ingest_failures_total`
- Internal API continues serving cached values
- Governance tooling can mark a dataset as “temporarily frozen” so policy does not shift unexpectedly

---

## 2) Draft: reference-data-policy.md

### 2.1 Purpose

Define what reference data may influence and what it must never influence.

### 2.2 Policy rules

1. ECB Data Portal APIs are informational inputs only. citeturn0search0turn0search2  
2. Settlement, consensus, and on-chain execution must never depend on live ECB API availability.  
3. All external data must be cached and versioned internally before use.  
4. Any value used to set an on-chain parameter must be:
   - explicitly proposed
   - explicitly approved by governance
   - recorded with provenance and hash  
5. Data freshness must be explicit:
   - store `retrieved_at_utc`
   - expose `staleness_seconds` in API responses  
6. Changes in ECB series structure, codes, or formats must trigger a safe halt of ingestion for that series until reviewed.

### 2.3 Enforcement

- Egress policy blocks all pods except the ingestor from contacting external endpoints.
- CI checks reject code that adds direct ECB API calls outside the ingestor module.
- Audit logs must be immutable and retained.

---

## 3) Safe internal mirroring plan

### 3.1 Why mirror

- Removes external runtime dependency
- Provides deterministic “what data did we use” answers for audits
- Supports sovereign cloud operations with restricted outbound internet

### 3.2 Mirroring method

1. Identify a finite set of “approved series” (whitelist).
2. For each series:
   - define the series key and the required query window
3. Pull using ECB SDMX retrieval mode, via the documented entry point and data query syntax. citeturn0search1turn0search2
4. Store:
   - raw payload
   - normalized records
   - hash and provenance
5. Publish two internal views:
   - Append-only history
   - Latest snapshot

### 3.3 Integrity controls

- Hash raw payload bytes (SHA-256)
- Sign a daily manifest using your platform signing key (HSM-backed in production)
- Store manifest in immutable object storage and optionally anchor its hash on-chain

### 3.4 Staleness and cutover rules

- Define per-series maximum staleness.
- If staleness exceeded:
  - mark series “stale”
  - block any automated policy changes based on that series
  - allow reporting to continue with “stale” flag

### 3.5 Format evolution handling

ECB notes that the SDW web services API is repointed to the ECB Data Portal API while request syntax remains unchanged, but you still must defend against format or structure changes at the payload level. citeturn0search15  
Mitigation:
- contract tests for expected dimensions and attributes
- strict parsing with explicit schema versioning
- automated alerting on any dimension set change

---

## 4) Dataset mapping: what is useful for a Digital Euro style project

The Digital Euro core does not need external statistical data to settle transactions. Reference data is useful for reporting, analytics, and controlled governance inputs.

### 4.1 High value datasets to consider

**Exchange rates (EXR)**  
Use cases:
- reporting of cross-currency exposures for intermediaries
- analytics and reconciliation reports
ECB provides the EXR dataset and shows series key patterns such as `EXR.D.CHF.EUR.SP00.A` and similar. citeturn0search6turn0search5  
Important note: ECB reference rates are published for information purposes and discourages using them for transaction purposes. citeturn0search3  
So do not use EXR to price or settle tEUR transfers.

**Interest rate and money market reference series**  
Use cases:
- reporting
- policy dashboards
- stress testing parameters (never automatic enforcement)

**TARGET calendar and operating day references**  
Use cases:
- scheduling reporting cutoffs
- operational dashboards
Do not block settlement on this data.

### 4.2 Medium value datasets

- Monetary aggregates and macro indicators (policy dashboards)
- Securities statistics (analytics and research)

### 4.3 Low value for core build

- Datasets that are primarily academic or very long horizon unless you have a specific reporting requirement

### 4.4 Recommendation: approved series whitelist

Create a whitelist file in your repo, for example:
- `reference-data/approved-series.yml`

Fields:
- `series_id`
- `purpose`
- `max_staleness_seconds`
- `refresh_schedule`
- `owners`
- `change_control_required`

---

## Appendix: practical notes for developers

- ECB SDMX supports discovery mode and retrieval mode. Use discovery first to validate codes and dimensions, then lock down series keys. citeturn0search0turn0search2  
- Keep all endpoint strings in a single configuration module to simplify future sovereign deployment hardening.
