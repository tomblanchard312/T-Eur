**ECB Reference Data Ingestion**

- **Purpose:** Periodically ingest a fixed, whitelist of ECB SDMX series, normalize into a canonical internal timeseries schema, and store the normalized output in a controlled storage location for downstream consumers.
- **Constraints:** ECB APIs are informational only. The ingestion service is pull-based (CronJob) and must never be a runtime dependency for settlement, authorization, or on-chain logic.

Design:

- Separation of concerns

  - Ingestion: `api/bin/ecb-ingest.js` — pulls data from ECB SDMX REST endpoints and normalizes outputs.
  - Storage: normalized JSONL files written to `OUTPUT_DIR` (recommended: PVC-backed volume `ecb-reference-data-pvc`). The ingestion component owns writes; downstream consumers must read from storage only.
  - Consumption: downstream services (analytics, reconciler) should treat this data as advisory and must not rely on it for enforcement or settlement.

- Pull model and scheduling

  - A Kubernetes CronJob (`k8s/cronjobs/ecb-reference-data-cronjob.yaml`) executes the ingestion image on a schedule (default: every 6 hours). No webhooks are used.

- Canonical schema

  - See `api/schemas/ecb-timeseries.schema.json` — each ingestion run emits one JSONL line per series with `seriesId`, `retrievedAt`, `observations[]`, and `metadata`.

- Failure behavior

  - If an ECB endpoint is unavailable or returns an error for a whitelisted series, the ingestion run exits non-zero. This causes the CronJob's Job to be marked failed and retries to occur per Kubernetes backoff policy.
  - The service logs clear failure reasons; operators should monitor job failures and alert on persistent failures.

- Sovereign cloud considerations

  - The CronJob and Pods should be deployed in the sovereign cloud cluster with explicit egress rules to the restricted list of ECB endpoints.
  - Minimize outbound endpoints: use a network policy / NAT gateway that allows only the SDMX endpoint host.

- Storage recommendations

  - Production: write normalized records to secure, persistent storage (S3-compatible private blob store or cluster Postgres). The provided implementation writes JSONL files to `OUTPUT_DIR` (PVC). Replace or extend `writeCanonical` to push to chosen storage.

- Notes
  - Do not call ECB APIs from anywhere else in the system; all consumers should read from the normalized storage location.
  - The ingestion image is intentionally minimal and self-contained to simplify security review.
