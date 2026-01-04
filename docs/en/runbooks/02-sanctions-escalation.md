# Runbook 02: Emergency Sanctions Escalation

## Objective

To rapidly propagate sanctions-related restrictions across the entire tEUR network, ensuring that all participants (Banks, PSPs) immediately block transactions involving sanctioned entities.

## Preconditions

1. Official notification from the European Council or relevant legal authority.
2. Access to the ECB Core Management Interface within the Closed Settlement Plane (CSP).

## Scope Expansion Rules

- **Individual**: Freeze specific wallet addresses.
- **Entity**: Freeze all wallets associated with a Participant ID.
- **Jurisdictional**: (If applicable) Pause all operations for a specific zone.

## Execution Steps

### 1. Batch Freeze Execution

For multiple addresses, use the batch processing utility to minimize latency:

```bash
# Internal script for batch sanctions
node api/bin/batch-freeze.js --file sanctions-list-2026-01-03.json
```

### 2. Update Local Sanctions Mirror

Update the internal `ecb-mirror` service to ensure the API Gateway rejects transactions at the edge before they reach the blockchain:

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/sanctions/sync" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 3. Broadcast Sanctions Manifest

The system automatically generates a new `ecb-manifest` containing the updated frozen accounts. This manifest is pulled by all Participant nodes within 60 seconds.

## Propagation Guarantees

- **Blockchain State**: Once the `freeze` transaction is confirmed, the restriction is absolute and enforced by every node in the network.
- **Latency**: Maximum propagation delay is defined as `BlockTime (2s) + SyncTime (5s) = 7s`.

## Visibility Guarantees for Regulators

- Regulators have read-only access to the `TokenizedEuro` contract events.
- The `AuditService` provides a real-time stream of `ACCOUNT_FROZEN` events via the `/api/v1/audit/stream` endpoint.

## Legal Reference Recording

Every freeze operation MUST include a `reason` field containing:

- Legal Instrument Reference (e.g., EU Regulation 2024/XXX).
- Case ID.
- Timestamp of the legal order.

## Validation Checks

- Verify that the `ecb-manifest` hash has been updated and signed by the `ISSUING` key.
- Confirm that Participant nodes have acknowledged the manifest update.

## Audit Artifacts Generated

- Signed `ecb-manifest.json`.
- `logAuditEvent` entries with `action: 'SANCTIONS_ESCALATION'`.
- Blockchain transaction receipts for all frozen addresses.
