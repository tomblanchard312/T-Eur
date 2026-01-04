# Training Scenario 04: Emergency Mint Suspension

## Scenario Title

Global Suspension of Monetary Operations.

## Learning Objectives

- Execute a global system pause.
- Understand the impact on settlement and participants.
- Perform the unpause procedure safely.

## Preconditions

- Operator has `ECB_ADMIN` role.
- Valid `ISSUING` key.

## Initial System State

- System status is `ACTIVE`.
- Total supply is €1,250,000,000.00.

## Triggering Event

Detection of a critical smart contract vulnerability that allows unauthorized minting. Immediate suspension is required to protect monetary sovereignty.

## Step-by-Step Actions

1. **Emergency Pause**: Navigate to the System Admin UI and click "GLOBAL PAUSE".
2. **Justification**: Enter "Critical Vulnerability Mitigation - Incident #2026-04".
3. **Verification**: Confirm `isPaused() == true` via the dashboard.
4. **Participant Notification**: Verify that the `SYSTEM_PAUSED` alert has been broadcast.
5. **Recovery (Simulated)**: After the "patch" is applied, execute the "GLOBAL UNPAUSE" command.

## Expected System Responses

- All new transfer and mint requests are rejected with `SYSTEM_PAUSED`.
- Blockchain state `paused` is set to `true`.
- Audit log records `SYSTEM_PAUSED`.

## Common Mistakes to Avoid

- Hesitating to pause while waiting for secondary confirmation (Emergency protocols prioritize containment).
- Failing to verify the pause on the blockchain.
- Unpausing before a full reconciliation integrity check is complete.

## Audit Artifacts Produced

- `SYSTEM_PAUSED` log event.
- Blockchain `Paused` event.
- Signed authorization blob in the Audit Service.

## Completion Criteria

The system is successfully paused, all monetary operations are halted, and the system is safely resumed after the simulated fix.
