# Reconciliation Protocol

Purpose

- Define the protocol for submitting, validating, and settling offline-signed transactions and out-of-band reconciled items.

Message model

- `SignedOfflineTx`:
  - `device_id`
  - `wallet_id`
  - `sequence_number`
  - `amount`
  - `signature`
  - `timestamp`

High-level flow

1. Devices collect signed transactions while offline.
2. Device submits batched `SignedOfflineTx` to reconciliation gateway when online.
3. Gateway validates signatures, sequence numbers, and device caps.
4. Valid items are translated into on-chain mint/transfer operations or queued for manual review.
5. Disputes are escalated to the Dispute Resolver (arbiter role) and recorded in an auditable ledger.

Idempotency & ordering

- Batches contain monotonic `sequence_number` per device.
- Reconciliation service must dedupe by `(device_id, sequence_number)` and persist processing state.

API and wire formats

- Use JSON over TLS for gateway ingestion; signed payloads are canonicalized before signature verification.

Acceptance criteria

- Reconciliation is idempotent and auditable; all accepted transactions have on-chain evidence or an explicit manual disposition.

TODO

- Add example JSON schemas and a minimal reference implementation.
