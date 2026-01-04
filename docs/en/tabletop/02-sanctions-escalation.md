# Tabletop Exercise 02: Emergency Sanctions Escalation

## Exercise Overview

### Objective

Test the rapid propagation of network-wide sanctions across the tEUR ecosystem, focusing on batch processing and manifest synchronization.

### Scope

Batch freezing of 50+ addresses and the subsequent broadcast of an updated system manifest to all participants.

### Participants and Roles

- **Facilitator**: Controls the scenario flow.
- **ECB Admin**: Executes batch scripts and manifest signing.
- **Network Operations**: Monitors participant node synchronization.
- **Compliance Lead**: Approves the consolidated sanctions list.

### Duration

90 minutes.

### Assumptions

- The batch processing utility is configured.
- The `ecb-mirror` service is active.
- All participant nodes are connected to the CSP.

## Scenario Timeline

### T0: Initial Conditions

- System Manifest: `v1.0.42`.
- Network Status: Stable.

### T+10: Inject 1 - Sanctions Update

**Inject**: The European Council publishes an emergency update to the consolidated sanctions list. 52 new wallet addresses must be blocked immediately.

**Expected Participant Actions**:

- Compliance Lead validates the list and formats it for the batch utility.
- ECB Admin loads `sanctions-list-2026-01-03.json`.

### T+25: Inject 2 - Batch Execution

**Inject**: The batch script is executed. 48 addresses are frozen successfully, but 4 addresses return `INVALID_ADDRESS`.

**Expected Participant Actions**:

- ECB Admin investigates the 4 failures.
- Compliance Lead confirms if the addresses were mistyped in the source list.

### T+45: Inject 3 - Manifest Propagation

**Inject**: The new manifest `v1.0.43` is signed and broadcast. One participant bank (Bank Y) fails to acknowledge the update.

**Expected Participant Actions**:

- Network Operations contacts Bank Y's technical team.
- ECB Admin verifies the manifest hash on the secondary validator.

## Decision Points

### Decision 1: Handling Batch Failures

- **Question**: Should the manifest be updated if 4 addresses failed to freeze?
- **Allowed Options**:
  - Yes, update for the 48 successful ones, then re-run for the remaining 4.
  - No, wait until all 52 are resolved.
- **Consequences**: Delaying the manifest update leaves 48 sanctioned entities active on the network.

### Decision 2: Participant Non-Compliance

- **Question**: What action is taken if Bank Y remains on the old manifest?
- **Allowed Options**: Suspend Bank Y's participant key until synchronized.
- **Disallowed Options**: Ignore the discrepancy.
- **Consequences**: Allowing a participant to operate on an old manifest creates a sanctions bypass risk.

## Evaluation Criteria

- **Technical Correctness**: Successful execution of the batch script and manifest signing.
- **Procedural Adherence**: Validation of the sanctions list before execution.
- **Audit Completeness**: Generation of the `SANCTIONS_ESCALATION` log and signed manifest.
- **Communication Clarity**: Coordination between ECB and participant banks.

## Debrief Checklist

- [ ] Was the batch file format correct?
- [ ] How long did manifest propagation take across the network?
- [ ] Were the 4 failed addresses resolved?
- [ ] **Evidence Collected**: Signed `ecb-manifest.json`, Batch execution logs.
- [ ] **Follow-up Actions**: Review participant node connectivity requirements.
