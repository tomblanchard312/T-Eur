# Training Scenario 05: Emergency Key Compromise Response

## Scenario Title

Containment and Recovery from Key Compromise.

## Learning Objectives

- Revoke a compromised key in the Sovereign Hierarchy.
- Isolate an affected participant.
- Register a replacement key.

## Preconditions

- Operator has `ECB_ADMIN` role.
- Valid `ROOT` or `ISSUING` key.

## Initial System State

- Participant "Bank X" has an active `PARTICIPANT` key `bank-x-p-1`.
- System is `ACTIVE`.

## Triggering Event

Security intelligence confirms that the private key for `bank-x-p-1` has been exfiltrated.

## Step-by-Step Actions

1. **Revocation**: Locate `bank-x-p-1` in the Security UI and click "REVOKE".
2. **Justification**: Enter "Confirmed Key Compromise - Incident #2026-05".
3. **Isolation**: Disable the participant "Bank X" in the Participant Management UI.
4. **Replacement**: Generate and register a new key `bank-x-p-2` for the participant.
5. **Verification**: Attempt to use the old key and confirm it is rejected with `KEY_REVOKED`.

## Expected System Responses

- `GovernanceService` updates key status to `REVOKED`.
- All requests signed by the old key are immediately blocked.
- Audit log records `KEY_REVOKED`.

## Common Mistakes to Avoid

- Revoking the wrong key (verify the `keyId` twice).
- Failing to isolate the participant, allowing them to use secondary keys if they exist.
- Delaying revocation to "investigate" (Revocation must be immediate).

## Audit Artifacts Produced

- `KEY_REVOKED` log event.
- `KEY_REGISTERED` log event for the new key.
- Updated Governance Hierarchy snapshot.

## Completion Criteria

The compromised key is successfully revoked, the participant is isolated, and a new secure key is registered.
