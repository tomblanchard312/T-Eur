# Runbook 06: Communication and Evidence

## Objective

To standardize the collection, preservation, and reporting of evidence during and after an emergency monetary operation, ensuring legal defensibility and regulatory transparency.

## Evidence Collected Automatically

### 1. API Audit Logs

The `AuditService` captures every request to the `/api/v1` namespace, including:

- `X-Request-Id` (Correlation).
- `X-API-KEY` (Actor identification - masked).
- Request payload and response status.
- Timestamp (UTC).

### 2. Governance Logs

The `GovernanceService` records:

- Key role validation results.
- Revocation reasons.
- Hierarchy traversal paths.

### 3. Blockchain State

The Besu network provides an immutable record of:

- Transaction hashes.
- Emitted events (`Transfer`, `AccountFrozen`, `Paused`).
- Block headers and timestamps.

## Evidence That Must Be Preserved Manually

### 1. Authorization Documents

- Signed PDF or physical documents from the ECB Governing Council authorizing the emergency action.
- Emails or secure messages initiating the incident response.

### 2. External Intelligence

- Screenshots or exports from external sanctions providers (e.g., UN, OFAC).
- Fraud reports from commercial banks.

### 3. Incident Timeline

- A manual log of all verbal decisions and non-system actions taken during the "Golden Hour" of the incident.

## Artifacts Retained for Audit

All artifacts must be retained for a minimum of 10 years as per DORA/ISO 27001 requirements:

- **JSONL Logs**: Daily exports of the `AuditService` logs.
- **Manifest Snapshots**: The `ecb-manifest.json` at the time of the incident.
- **Database Backups**: Encrypted snapshots of the API Gateway's internal state.

## Communication Protocol

1. **Internal**: Immediate notification to the ECB CISO and Head of Market Infrastructure.
2. **Participants**: Broadcast via the `SYSTEM_PAUSED` or `SECURITY_ALERT` event types.
3. **Regulators**: Formal report submitted via the Secure Regulatory Portal within 24 hours.
4. **Public**: (If required) Official statement via the ECB website. No technical details (keys, addresses) are to be shared publicly.

## Validation Checks

- Confirm that the `logAuditEvent` for the emergency action contains a valid `correlationId`.
- Verify that the evidence package is cryptographically hashed and the hash is recorded in the `AuditService`.

## Audit Artifacts Generated

- `SECURITY_ALERT` log event.
- `MANIFEST_DIAGNOSTICS_WRITTEN` (if integrity issues were detected).
- Final Incident Summary Report.
