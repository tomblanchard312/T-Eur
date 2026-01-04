# Tabletop Exercise 04: Emergency Mint Suspension

## Exercise Overview

### Objective

Exercise the global "Kill Switch" capability to suspend all monetary operations (minting and transfers) in response to a systemic threat.

### Scope

Activation of the global pause, communication with the Eurosystem, and the controlled resumption of operations.

### Participants and Roles

- **Facilitator**: Directs the crisis scenario.
- **ECB Executive**: Authorizes the global pause.
- **ECB Admin**: Executes the technical pause command.
- **Communications Lead**: Manages the broadcast to all participants.
- **Technical Lead**: Coordinates the vulnerability assessment.

### Duration

120 minutes.

### Assumptions

- A critical vulnerability has been identified.
- The `ISSUING` key is secured and available.

## Scenario Timeline

### T0: Initial Conditions

- System Status: `ACTIVE`.
- Network Load: High.

### T+10: Inject 1 - Vulnerability Detection

**Inject**: The Security Operations Center (SOC) detects an exploit in the `mint` function that allows bypassing the ECB reference data check. Unauthorized tEUR is being generated.

**Expected Participant Actions**:

- Technical Lead confirms the exploit.
- ECB Executive convenes the Crisis Management Team.

### T+20: Inject 2 - Pause Execution

**Inject**: The ECB Executive authorizes a global pause.

**Expected Participant Actions**:

- ECB Admin executes the `GLOBAL PAUSE` command.
- Communications Lead broadcasts the `SYSTEM_PAUSED` alert.

**Expected System Responses**:

- All pending transactions are rejected.
- `isPaused()` returns `true`.

### T+60: Inject 3 - Pressure for Resumption

**Inject**: Major commercial banks report that the pause is disrupting critical settlement flows. They demand a timeline for resumption.

**Expected Participant Actions**:

- ECB Executive balances monetary security against settlement stability.
- Technical Lead provides a status update on the "patch".

## Decision Points

### Decision 1: Threshold for Global Pause

- **Question**: Is the unauthorized minting significant enough to justify a global pause?
- **Allowed Options**: Yes, any unauthorized minting threatens the integrity of the Euro.
- **Disallowed Options**: Waiting for a specific Euro threshold before acting.
- **Consequences**: Delaying the pause results in unbacked currency entering the economy.

### Decision 2: Resumption Criteria

- **Question**: What must be verified before unpausing?
- **Allowed Options**: Full reconciliation of total supply and a verified patch.
- **Disallowed Options**: Unpausing based on time elapsed or participant pressure.
- **Consequences**: Premature resumption may allow the exploit to continue.

## Evaluation Criteria

- **Technical Correctness**: Successful execution of the pause and unpause commands.
- **Procedural Adherence**: Executive authorization obtained before technical execution.
- **Audit Completeness**: `SYSTEM_PAUSED` and `SYSTEM_RESUMED` events recorded.
- **Communication Clarity**: Timely and accurate alerts to the participant network.

## Debrief Checklist

- [ ] How long did it take from detection to pause?
- [ ] Was the justification string "Critical Vulnerability Mitigation" used?
- [ ] Did all participant nodes receive the pause alert?
- [ ] **Evidence Collected**: Blockchain `Paused` event, Signed authorization blob.
- [ ] **Follow-up Actions**: Review the "Emergency Unpause" safety protocols.
