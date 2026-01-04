# Tabletop Exercise 05: Emergency Key Compromise Response

## Exercise Overview

### Objective

Test the ECB's response to the compromise of a sovereign or participant key, focusing on revocation, isolation, and recovery.

### Scope

Revocation of a compromised `PARTICIPANT` key, suspension of the affected bank, and issuance of a replacement key.

### Participants and Roles

- **Facilitator**: Manages the security incident flow.
- **Security Officer**: Detects and confirms the compromise.
- **ECB Admin**: Executes the revocation and re-keying.
- **Participant Liaison**: Coordinates with the affected bank's CISO.

### Duration

90 minutes.

### Assumptions

- The `ROOT` or `ISSUING` key is secure.
- The compromise is limited to a single participant's operational environment.

## Scenario Timeline

### T0: Initial Conditions

- Participant: Bank X.
- Active Key: `bank-x-p-1`.
- Status: `ACTIVE`.

### T+10: Inject 1 - Compromise Alert

**Inject**: An intelligence report confirms that the private key for `bank-x-p-1` has been posted on a dark web forum.

**Expected Participant Actions**:

- Security Officer verifies the key ID.
- ECB Admin prepares the Revocation UI.

### T+20: Inject 2 - Unauthorized Activity

**Inject**: The ledger shows a series of unusual high-value transfers originating from Bank X's operational wallet using the compromised key.

**Expected Participant Actions**:

- ECB Admin executes the `REVOKE` command for `bank-x-p-1` immediately.
- Participant Liaison notifies Bank X to shut down their gateway.

**Expected System Responses**:

- `GovernanceService` rejects all further requests from `bank-x-p-1`.
- Audit log records `KEY_REVOKED`.

### T+50: Inject 3 - Recovery and Re-keying

**Inject**: Bank X confirms their environment is now secure and requests a new key to resume operations.

**Expected Participant Actions**:

- ECB Admin generates and registers `bank-x-p-2`.
- Security Officer verifies the new key's metadata.

## Decision Points

### Decision 1: Immediate Revocation vs. Observation

- **Question**: Should the key be revoked immediately or monitored to identify the attacker?
- **Allowed Options**: Immediate revocation.
- **Disallowed Options**: Monitoring (forbidden in emergency key compromise protocols).
- **Consequences**: Delaying revocation allows the attacker to drain funds or disrupt the network.

### Decision 2: Participant Suspension

- **Question**: Should Bank X be suspended entirely or just the compromised key?
- **Allowed Options**: Suspend the participant until a full security audit is completed.
- **Consequences**: Only revoking the key may leave other vulnerabilities (e.g., secondary keys) exposed.

## Evaluation Criteria

- **Technical Correctness**: Successful revocation of the correct key ID.
- **Procedural Adherence**: Immediate action taken upon confirmation of compromise.
- **Audit Completeness**: `KEY_REVOKED` and `KEY_REGISTERED` events logged.
- **Communication Clarity**: Clear instructions provided to the affected participant.

## Debrief Checklist

- [ ] Was the correct `keyId` revoked?
- [ ] Did the `GovernanceService` successfully block the unauthorized transfers?
- [ ] Was the replacement key issued following the standard registration process?
- [ ] **Evidence Collected**: Revocation logs, New key registration receipt.
- [ ] **Follow-up Actions**: Review the physical security of participant HSMs.
