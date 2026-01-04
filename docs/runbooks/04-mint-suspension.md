# Runbook 04: Emergency Mint Suspension

## Objective

To globally suspend the creation of new tEUR tokens to protect the system's monetary integrity during a major security breach, smart contract vulnerability discovery, or extreme market instability.

## Preconditions

1. Detection of unauthorized minting or total supply discrepancy.
2. Authorization from the ECB Governing Council (or delegated Emergency Committee).
3. Possession of the ECB `ISSUING` key.

## Execution Steps

### 1. Global Pause Execution

Call the system pause endpoint. This uses the `Pausable` pattern in the `TokenizedEuro` contract.

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/pause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

### 2. Verify Global State

Confirm that the `paused()` state on the blockchain is `true`.

```bash
teur-cli query is-paused
```

### 3. Notify Participants

The system automatically broadcasts a `SYSTEM_PAUSED` alert to all connected Banks and PSPs via the secure messaging layer.

## Impact on Settlement and Reconciliation

- **Settlement**: All new transfers will fail. Pending transactions in the mempool will be rejected.
- **Reconciliation**: The `ecb-ingest` service will continue to track the last known valid state. No new supply changes will be recorded.
- **Offline Payments**: Offline limits remain active but cannot be replenished until the system is unpaused.

## How to Resume Minting Safely

1. **Root Cause Analysis**: Confirm the vulnerability is patched or the threat is neutralized.
2. **State Integrity Check**: Run the `reconciliation-ref` tool to ensure on-chain supply matches the ECB ledger.
3. **Unpause**:

```bash
curl -X POST "https://[internal-gateway]/api/v1/admin/system/unpause" \
     -H "X-API-KEY: [ISSUING_KEY]"
```

## Failure Handling

- If the `ISSUING` key is compromised, use the `Root` key to revoke the `ISSUING` key first (See Runbook 05), then use a secondary `ISSUING` key to pause.

## Audit Artifacts Generated

- `SYSTEM_PAUSED` / `SYSTEM_UNPAUSED` log events.
- Blockchain `Paused` / `Unpaused` events.
- Signed authorization blob stored in the `AuditService`.
