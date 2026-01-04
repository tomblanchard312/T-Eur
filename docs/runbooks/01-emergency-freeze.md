# Runbook 01: Emergency Freeze of Wallet/Account

## Objective

To immediately halt all outgoing transfer operations from a specific wallet address or entity account to prevent unauthorized movement of funds, ensure regulatory compliance, or respond to a security incident.

## Preconditions

1. The operator must possess an API key or JWT with the `ECB_ADMIN` role.
2. The key used must be registered in the Sovereign Key Hierarchy with the `ISSUING` role.
3. The target wallet address must be a valid Ethereum-compatible address (0x...).

## Authorization Requirements

- **Standard Freeze**: Requires single authorization from an ECB/NCB Operational Officer.
- **High-Value Freeze (> €1,000,000)**: Requires dual-authorization (Four-Eyes Principle) as per Rulebook Section 4.2.

## Execution Steps

### 1. Identify Target

Confirm the target address and the legal basis for the freeze (e.g., Sanctions List, Fraud Alert).

### 2. Execute Freeze via API

Submit a POST request to the Transfer Service:

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/freeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -H "Content-Type: application/json" \
     -d '{
       "account": "0xTargetAddress...",
       "reason": "Emergency Sanctions Compliance - Case ID: 2026-001"
     }'
```

### 3. Monitor Blockchain Confirmation

Wait for the transaction to be mined on the Besu network. Retrieve the transaction hash from the API response.

## Validation Checks

1. **On-Chain Verification**:
   Query the contract state to confirm the `frozen` flag is set to `true`:
   ```bash
   # Using internal CLI tool
   teur-cli query is-frozen 0xTargetAddress...
   ```
2. **Attempt Test Transfer**:
   Attempt a small transfer from the frozen account. The transaction MUST fail with the error `AccountIsFrozen`.

## Failure Handling

- **Transaction Reverted**: If the transaction fails, check the `GovernanceService` logs for `KEY_VALIDATION_FAILED`. Ensure the key has not been revoked.
- **Network Partition**: If the Besu node is unreachable, switch to the secondary validator node in the Closed Settlement Plane (CSP).

## Rollback / Unfreeze Procedure

1. Verify the legal resolution of the freeze.
2. Execute the unfreeze command:

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/unfreeze" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{ "account": "0xTargetAddress..." }'
```

## Audit Evidence Produced

- **API Logs**: `ACCOUNT_FROZEN` event in structured JSON format.
- **Blockchain Event**: `AccountFrozen(address indexed account)` emitted by the `TokenizedEuro` contract.
- **Governance Log**: Record of the `ISSUING` key used for the operation.
