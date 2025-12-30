# Reconciliation Reference

Minimal, lab-only reconciliation reference implementation.

Usage:

```bash
cd tools/reconciliation-ref
node index.js
```

Endpoints:

- POST /ingest — accepts a JSON body matching `docs/json-schemas/reconciliation.schema.json`.

Behavior:

- Validates presence of required fields.
- Deduplicates by `(device_id, wallet_id, sequence_number)` and persists processed IDs in `tools/reconciliation-ref/data/processed.json`.

This is a minimal reference for integration testing and demonstration only; it is NOT production-grade.
