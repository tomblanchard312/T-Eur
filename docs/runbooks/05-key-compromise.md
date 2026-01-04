# Runbook 05: Emergency Key Compromise Response

## Objective

To detect, contain, and recover from the compromise of a cryptographic key within the Sovereign Key Hierarchy, preventing unauthorized monetary actions.

## Detection Triggers

- **Unauthorized Action**: A `TOKENS_MINTED` or `SYSTEM_PAUSED` event not linked to a valid internal change request.
- **Governance Alert**: `KEY_VALIDATION_FAILED` spikes in the logs.
- **Physical Breach**: Reported compromise of an HSM or secure enclave.

## Immediate Containment Actions

### 1. Revoke Compromised Key

Immediately revoke the key using the `ISSUING` or `ROOT` key:

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys/[COMPROMISED_KEY_ID]/revoke" \
     -H "X-API-KEY: [ROOT_OR_ISSUING_KEY]" \
     -d '{ "reason": "Confirmed Key Compromise - Incident #2026-05" }'
```

### 2. Global Pause (If Key was ISSUING/OPERATIONAL)

If the compromised key had minting or admin powers, execute Runbook 04 (Emergency Mint Suspension) immediately.

## Participant Isolation

- If a Participant (Bank) key is compromised, the ECB will revoke all keys associated with that `ownerId`.
- The Participant's gateway access is blocked at the firewall level in the CSP.

## System Recovery Steps

### 1. Rotate Keys

Generate new keys for the affected entity and register them using the `GovernanceService`.

```bash
curl -X POST "https://[internal-gateway]/api/v1/governance/keys" \
     -H "X-API-KEY: [ISSUING_KEY]" \
     -d '{
       "keyId": "new-bank-key-01",
       "publicKey": "0xNewPubKey...",
       "role": "PARTICIPANT",
       "ownerId": "bank-de-01"
     }'
```

### 2. Audit Trail Review

Review all transactions signed by the compromised key since the estimated time of compromise. Identify any "poisoned" transactions for reversal or escrow.

### 3. Restore Service

Once the environment is verified clean, unpause the system (if paused).

## Validation Checks

- Confirm the compromised `keyId` returns `status: 'REVOKED'` in the `GovernanceService`.
- Verify that any attempt to use the old key results in an immediate `403 Forbidden` with `KEY_REVOKED` log event.

## Audit Artifacts Generated

- `KEY_REVOKED` log event.
- `KEY_REGISTERED` log event for the replacement.
- Incident Report containing the timeline of detection and revocation.
