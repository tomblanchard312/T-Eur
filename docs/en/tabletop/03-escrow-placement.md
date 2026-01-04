# Tabletop Exercise 03: Emergency Escrow Placement

## Exercise Overview

### Objective

Validate the procedure for isolating disputed funds using the tEUR escrow mechanism, ensuring funds are restricted without a full account freeze.

### Scope

Placement of specific funds into escrow, management of expiry timestamps, and verification of restricted balances.

### Participants and Roles

- **Facilitator**: Manages injects.
- **NCB Operator**: Initiates the escrow request.
- **ECB Compliance**: Approves the escrow parameters.
- **Commercial Bank Liaison**: Communicates with the reporting bank.

### Duration

45 minutes.

### Assumptions

- The target account has sufficient balance.
- The `OPERATIONAL` key is available for the NCB Operator.

## Scenario Timeline

### T0: Initial Conditions

- Target Account: `0xABC...123`.
- Balance: €10,000.00.
- Status: `ACTIVE`.

### T+05: Inject 1 - Fraud Report

**Inject**: A commercial bank reports that a €5,000.00 transfer to `0xABC...123` was unauthorized. They request the funds be held for 48 hours.

**Expected Participant Actions**:

- Commercial Bank Liaison confirms the transaction details.
- NCB Operator prepares the Escrow UI.

### T+15: Inject 2 - Parameter Conflict

**Inject**: The reporting bank requests an indefinite hold, but the tEUR rulebook limits emergency escrows to 72 hours without a court order.

**Expected Participant Actions**:

- ECB Compliance enforces the 72-hour limit.
- NCB Operator sets `expiresAt` to T+48 hours.

### T+25: Inject 3 - Execution and Verification

**Inject**: The escrow is executed. The account holder attempts to spend the full €10,000.00.

**Expected Participant Actions**:

- NCB Operator verifies the transaction failure for the restricted amount.
- ECB Compliance checks the `FUNDS_ESCROWED` audit log.

## Decision Points

### Decision 1: Escrow vs. Freeze

- **Question**: Why use escrow instead of a full freeze?
- **Allowed Options**: To allow the account holder to continue using non-disputed funds (€5,000.00).
- **Disallowed Options**: Freezing the entire account for a partial dispute.
- **Consequences**: Unnecessary freezing of the entire account may lead to legal liability for the ECB.

### Decision 2: Expiry Management

- **Question**: What happens if the 48 hours expire without a resolution?
- **Allowed Options**: Funds are automatically released unless a manual extension or freeze is applied.
- **Consequences**: Failure to monitor the expiry may result in the loss of disputed funds.

## Evaluation Criteria

- **Technical Correctness**: Correct amount and expiry set in the escrow command.
- **Procedural Adherence**: Adherence to the 72-hour rulebook limit.
- **Audit Completeness**: Verification of the `escrowId` and blockchain event.
- **Communication Clarity**: Clear explanation to the reporting bank regarding the hold duration.

## Debrief Checklist

- [ ] Was the amount entered in cents (500000)?
- [ ] Was the `expiresAt` timestamp calculated correctly?
- [ ] Did the account holder's partial transfer succeed as expected?
- [ ] **Evidence Collected**: `FundsEscrowed` event, API response.
- [ ] **Follow-up Actions**: Review the automated notification system for expiring escrows.
