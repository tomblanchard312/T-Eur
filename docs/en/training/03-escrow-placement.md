# Training Scenario 03: Emergency Escrow Placement

## Scenario Title

Isolation of Disputed Funds via Escrow.

## Learning Objectives

- Differentiate between a full freeze and an escrow placement.
- Execute the escrow command for a specific amount.
- Verify the restricted balance on the target account.

## Preconditions

- Operator has `ECB_ADMIN` or `NCB_OPERATOR` role.
- Valid `OPERATIONAL` key.

## Initial System State

- Target account `0xABC...` has a balance of €10,000.00.
- No active escrows on the account.

## Triggering Event

A commercial bank reports a suspicious transaction of €5,000.00. The funds must be isolated pending a 48-hour investigation.

## Step-by-Step Actions

1. **Identification**: Locate the target account in the Escrow UI.
2. **Parameter Entry**: Enter the amount `500000` (euro cents) and the reason "Pending Fraud Investigation - Case #998".
3. **Expiry Setting**: Set the `expiresAt` timestamp to 48 hours from the current time.
4. **Execution**: Click "Place in Escrow" and confirm.
5. **Verification**: Check the account's available balance (should be €5,000.00) and the escrowed balance (should be €5,000.00).

## Expected System Responses

- API returns `201 Created` with an `escrowId`.
- Blockchain emits `FundsEscrowed` event.
- Available balance is immediately reduced.

## Common Mistakes to Avoid

- Entering the amount in Euros instead of cents (e.g., entering 5000 instead of 500000).
- Setting an automatic release expiry (forbidden for emergency escrows).
- Confusing the `from` address with the `payee` address.

## Audit Artifacts Produced

- `FUNDS_ESCROWED` log event.
- Blockchain transaction receipt.
- Entry in the manual review queue for the Compliance Officer.

## Completion Criteria

The specified amount is successfully moved to the escrow contract, and the account's available balance is correctly restricted.
