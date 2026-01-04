# Training Scenario 02: Emergency Sanctions Escalation

## Scenario Title

Rapid Propagation of Network-Wide Sanctions.

## Learning Objectives

- Execute batch freeze operations for multiple entities.
- Synchronize the internal sanctions mirror.
- Verify manifest propagation to participants.

## Preconditions

- Operator has `ECB_ADMIN` role.
- Access to the ECB Core Management Interface.
- Valid `ISSUING` key.

## Initial System State

- Multiple target entities are active across different participant banks.
- System manifest version is `v1.0.42`.

## Triggering Event

European Council update to the consolidated sanctions list requiring the immediate blocking of 50+ associated wallet addresses.

## Step-by-Step Actions

1. **Batch Preparation**: Load the provided `sanctions-list-2026-01-03.json` into the batch processing utility.
2. **Execution**: Run the batch freeze script within the CSP.
3. **Mirror Sync**: Trigger the synchronization of the internal `ecb-mirror` service.
4. **Manifest Broadcast**: Confirm the generation of the new `ecb-manifest.json`.
5. **Verification**: Check that at least three Participant nodes have acknowledged the new manifest version.

## Expected System Responses

- Batch script reports 100% success rate for all addresses.
- `ecb-manifest` hash is updated and signed.
- Participant nodes report `MANIFEST_UPDATED` in the monitoring dashboard.

## Common Mistakes to Avoid

- Running the batch script against the wrong environment (e.g., Lab instead of Production).
- Failing to trigger the mirror sync, leading to edge-case transaction approvals.
- Ignoring manifest propagation delays.

## Audit Artifacts Produced

- `SANCTIONS_ESCALATION` log event.
- Signed `ecb-manifest.json` version `v1.0.43`.
- Batch execution report stored in the Audit Service.

## Completion Criteria

All addresses in the list are frozen on-chain, and the updated manifest is successfully broadcast to the network.
