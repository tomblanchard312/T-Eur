# Runbook 03: Emergency Escrow Placement

## Objective

To isolate disputed or suspicious funds by moving them into a system-controlled escrow account. This is used when a full account freeze is deemed disproportionate or when funds must be held pending legal adjudication.

## When Escrow is Used Instead of Freeze

- **Disputed Transactions**: When a transfer is flagged as potentially fraudulent but the account owner is not yet verified as a bad actor.
- **Clawback Operations**: Temporary holding of funds during a reversal process.
- **Court Orders**: Specific requirements to set aside a fixed amount while allowing the account to remain operational for other funds.

## Execution Steps

### 1. Calculate Escrow Amount

Determine the exact amount in euro cents (2 decimals) to be moved.

### 2. Execute Escrow via API

```bash
curl -X POST "https://[internal-gateway]/api/v1/transfers/escrow" \
     -H "X-API-KEY: [OPERATIONAL_KEY]" \
     -d '{
       "from": "0xSourceAddress...",
       "amount": 500000,
       "reason": "Pending Fraud Investigation - Case #998",
       "expiresAt": 1735948800
     }'
```

### 3. Verify Movement

Confirm the source balance has decreased and the `Escrow` contract balance for that `escrowId` has increased.

## Blocked Operations

- **Source Account**: Cannot transfer the escrowed portion of the balance.
- **Escrowed Funds**: Cannot be burned, transferred, or used for payments by any party except the ECB/NCB.

## Expiry Handling

- If `expiresAt` is reached without manual intervention, the funds remain in escrow but trigger a `MANUAL_REVIEW_REQUIRED` alert in the `AuditService`.
- Automatic release is FORBIDDEN for emergency escrows.

## Manual Review Requirements

- Weekly audit of all active escrows by the Compliance Officer.
- Justification for extension must be recorded in the `AuditService`.

## Validation Checks

- Check `getEscrowBalance(escrowId)` on-chain.
- Verify `FUNDS_ESCROWED` event in API logs.

## Audit Artifacts Generated

- `FUNDS_ESCROWED` log event.
- Blockchain `Transfer` event to the Escrow contract address.
- Entry in the `GovernanceService` audit trail linking the action to the `OPERATIONAL` key.
