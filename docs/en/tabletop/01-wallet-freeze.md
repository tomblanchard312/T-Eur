# Tabletop Exercise 01: Emergency Wallet Freeze

## Exercise Overview

### Objective

Validate the ECB's ability to execute an emergency wallet freeze in response to a high-priority legal order, ensuring procedural adherence and audit integrity.

### Scope

This exercise covers the end-to-end process from receipt of a legal order to verification of the frozen state on the tEUR ledger.

### Participants and Roles

- **Facilitator**: Manages the exercise timeline and injects.
- **ECB Operator**: Executes the technical freeze command.
- **Compliance Officer**: Validates the legal basis and justification.
- **Security Officer**: Monitors for unauthorized access or key misuse.
- **Observer/Auditor**: Records actions for the debrief.

### Duration

60 minutes.

### Assumptions

- The Closed Settlement Plane (CSP) is operational.
- The ECB Operator has a valid `ISSUING` key.
- The target wallet is currently active on the ledger.

## Scenario Timeline

### T0: Initial Conditions

- System Status: `ACTIVE`.
- Target Wallet: `0x71C7656EC7ab88b098defB751B7401B5f6d8976F`.
- Balance: €1,250.00.

### T+05: Inject 1 - Legal Order Receipt

**Inject**: An urgent email from the European Court of Justice (ECJ) arrives, ordering the immediate freezing of wallet `0x71C...76F` due to suspected terrorist financing (Case ID: 2026-001).

**Expected Participant Actions**:

- Compliance Officer verifies the authenticity of the order.
- ECB Operator prepares the Sovereign Control Portal.

### T+15: Inject 2 - High-Value Alert (Optional)

**Inject**: A monitoring alert indicates the target wallet is attempting to move €1,000,000.00 to an external exchange.

**Expected Participant Actions**:

- ECB Operator initiates the freeze command immediately.
- Compliance Officer provides the mandatory justification string.

**Expected System Responses**:

- API returns `200 OK` with transaction hash.
- Ledger state updates to `frozen: true`.

### T+30: Inject 3 - Verification Request

**Inject**: The ECJ requests proof that the funds are secured.

**Expected Participant Actions**:

- ECB Operator performs an on-chain query to verify the status.
- Security Officer retrieves the audit log entry.

## Decision Points

### Decision 1: Authorization Level

- **Question**: Does this freeze require the Four-Eyes Principle (dual-authorization)?
- **Allowed Options**:
  - No, if the balance is below €1,000,000.
  - Yes, if the balance or transaction attempt exceeds €1,000,000.
- **Consequences**: Proceeding without dual-authorization for high-value accounts results in a procedural audit failure.

### Decision 2: Justification String

- **Question**: What information must be included in the justification field?
- **Allowed Options**: Case ID, Legal Basis, and Timestamp.
- **Disallowed Options**: Informal notes or empty fields.
- **Consequences**: Incomplete justification renders the audit trail non-compliant with DORA requirements.

## Evaluation Criteria

- **Technical Correctness**: Was the correct wallet address targeted and successfully frozen?
- **Procedural Adherence**: Were the roles followed correctly (e.g., Compliance validating before Operator executing)?
- **Audit Completeness**: Does the audit log contain the Case ID and the signature of the `ISSUING` key?
- **Communication Clarity**: Were the status updates clear and concise between participants?

## Debrief Checklist

- [ ] Did the operator use copy-paste for the address?
- [ ] Was the justification string entered correctly?
- [ ] Did the system respond within the expected latency?
- [ ] **Evidence Collected**: API logs, Blockchain events, Portal screenshots.
- [ ] **Follow-up Actions**: Update runbook if any step was ambiguous.
