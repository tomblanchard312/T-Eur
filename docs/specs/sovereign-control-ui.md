# Sovereign Control Portal: UI/UX Specification

## 1. UI Architecture

The Sovereign Control Portal (SCP) is a high-security administrative interface designed exclusively for ECB and National Central Bank (NCB) operators. It is physically and logically separated from the Public Access Plane (PAP).

### 1.1 Security Principles

- **Zero Trust Access**: Access is restricted to the Closed Settlement Plane (CSP) via mTLS and hardware-backed authentication (e.g., FIDO2/WebAuthn).
- **Server-Side Authority**: The UI is a stateless consumer of the `GovernanceService` and `BlockchainService`. No business logic or authorization decisions are made in the browser.
- **Four-Eyes Principle (2FA/Multi-Sig)**: Destructive or high-value actions (Minting > Threshold, Key Revocation) require dual-operator approval within the UI.
- **Audit-First Design**: Every UI interaction (including failed attempts and page views) generates a signed audit event.

### 1.2 Component Stack

- **Frontend**: React with TypeScript (Strict Mode).
- **State Management**: React Query (for real-time blockchain/governance state).
- **Styling**: Tailwind CSS with a "High-Contrast/No-Distraction" theme.
- **Security**: Content Security Policy (CSP) prohibiting all external scripts/styles.

---

## 2. API Interaction Flows

### 2.1 Authenticated Action Flow

1. **Operator Login**: mTLS handshake + OIDC/JWT with `ECB_ADMIN` role.
2. **Action Initiation**: Operator selects "Mint" and enters amount + justification.
3. **Impact Preview**: UI calls `/api/v1/admin/preview` to show projected total supply and gas costs.
4. **Confirmation**: Operator confirms. UI sends POST to `/api/v1/transfers/mint` with `X-Idempotency-Key`.
5. **Server Validation**: API checks `GovernanceService` for `ISSUING` key role and `ECB_ADMIN` RBAC.
6. **Audit Logging**: `TOKENS_MINTED` event is emitted.
7. **UI Update**: Real-time update via WebSocket/Polling for transaction confirmation.

### 2.2 Emergency Revocation Flow

1. **Detection**: Security Officer identifies compromised key in "Key Management" view.
2. **Revoke Trigger**: Clicks "Revoke" on the specific `keyId`.
3. **Mandatory Justification**: Modal appears requiring Incident ID and detailed reason.
4. **Execution**: API calls `governanceService.revokeKey()`.
5. **Propagation**: UI immediately updates to show `REVOKED` status and disables all associated actions.

---

## 3. Screen Layouts (Wireframes)

### 3.1 Global Navigation & Header

```text
+--------------------------------------------------------------------------+
| [tEUR] SOVEREIGN CONTROL PORTAL | Role: ECB_ADMIN | Operator: 0x123... | [LOGOUT] |
+--------------------------------------------------------------------------+
| [DASHBOARD] | [MONETARY OPS] | [SANCTIONS & ESCROW] | [SECURITY] | [AUDIT] |
+--------------------------------------------------------------------------+
```

### 3.2 Monetary Operations (Mint/Burn)

**Objective**: Precise control over token supply.

```text
+--------------------------------------------------------------------------+
| MONETARY OPERATIONS                                                      |
+--------------------------------------------------------------------------+
| RESERVE OVERVIEW                                                         |
| Total Supply: €1,250,000,000.00 | Reserve Ratio: 100% | Status: ACTIVE   |
+--------------------------------------------------------------------------+
| ACTION: MINT TOKENS                                                      |
| Target Address: [ 0xNCB_DE_VAULT... ]                                    |
| Amount (EUR):   [ 50,000,000.00     ]                                    |
| Justification:  [ Quarterly Liquidity Provision - Ref: ECB-2026-Q1 ]     |
|                                                                          |
| [ PREVIEW IMPACT ] -> Projected Supply: €1,300,000,000.00                |
|                                                                          |
| [ EXECUTE MINT ] (Requires Confirmation Modal)                           |
+--------------------------------------------------------------------------+
```

### 3.3 Sanctions & Escrow Management

**Objective**: Legal enforcement and fund isolation.

```text
+--------------------------------------------------------------------------+
| SANCTIONS & ESCROW                                                       |
+--------------------------------------------------------------------------+
| SEARCH ENTITY: [ 0xTargetAddress... ] [ SEARCH ]                         |
+--------------------------------------------------------------------------+
| ENTITY STATUS: ACTIVE                                                    |
| Balance: €450,000.00 | Escrowed: €0.00                                   |
+--------------------------------------------------------------------------+
| ACTIONS:                                                                 |
| [ FREEZE ACCOUNT ] -> Requires Legal Basis (e.g. EU-REG-2026-01)         |
| [ PLACE IN ESCROW ] -> Amount: [_______] Reason: [_______]               |
+--------------------------------------------------------------------------+
| ACTIVE ESCROWS                                                           |
| ID: ESC-99 | Amount: €50,000 | Reason: Disputed | [RELEASE] | [BURN]     |
+--------------------------------------------------------------------------+
```

### 3.4 Security & Key Management

**Objective**: Hierarchy maintenance and emergency response.

```text
+--------------------------------------------------------------------------+
| SECURITY & KEY MANAGEMENT                                                |
+--------------------------------------------------------------------------+
| SOVEREIGN KEY HIERARCHY                                                  |
| ID          | Role         | Owner        | Status   | Action            |
|-------------|--------------|--------------|----------|-------------------|
| ecb-iss-01  | ISSUING      | ECB_CORE     | ACTIVE   | [ROTATE] [REVOKE] |
| ncb-de-op-1 | OPERATIONAL  | BUNDESBANK   | ACTIVE   | [ROTATE] [REVOKE] |
| bank-x-p-1  | PARTICIPANT  | DEUTSCHE_BK  | COMPROMISED | [REVOKE NOW]   |
+--------------------------------------------------------------------------+
| [ DISABLE PARTICIPANT ] -> Select: [ Bank X ] Reason: [ Security Breach ]|
+--------------------------------------------------------------------------+
```

### 3.5 Audit & Observability

**Objective**: Real-time transparency and evidence preservation.

```text
+--------------------------------------------------------------------------+
| AUDIT EVENT LOG                                                          |
+--------------------------------------------------------------------------+
| FILTER: [ All Actions ] [ All Entities ] [ Last 24h ] [ SEARCH ]         |
+--------------------------------------------------------------------------+
| TIMESTAMP | ACTOR      | ACTION         | RESOURCE   | RESULT  | DETAILS |
|-----------|------------|----------------|------------|---------|---------|
| 10:45:01  | 0xECB_1    | TOKENS_MINTED  | 0xNCB_DE   | SUCCESS | €50M    |
| 10:42:15  | 0xECB_2    | KEY_REVOKED    | bank-x-p-1 | SUCCESS | Breach  |
| 10:30:00  | 0xNCB_DE   | ACCOUNT_FROZEN | 0xTarget   | SUCCESS | Sanction|
+--------------------------------------------------------------------------+
| [ EXPORT AUDIT PACKAGE (SIGNED JSONL) ] [ EXPORT FOR REGULATOR (PDF) ]   |
+--------------------------------------------------------------------------+
```

---

## 4. Safety Controls & Confirmation Logic

### 4.1 Destructive Action Modal

Before any `REVOKE`, `BURN`, or `FREEZE` action, the UI displays a mandatory confirmation modal:

1. **Summary**: "You are about to REVOKE the key for Deutsche Bank AG."
2. **Impact**: "This will immediately halt all settlement operations for this participant."
3. **Justification**: Text area (min 20 chars).
4. **Verification**: Operator must type the word `CONFIRM_REVOCATION` to enable the button.

### 4.2 Time-Stamped Execution Logs

The UI maintains a local session log of all actions taken, including the `correlationId` returned by the API, allowing the operator to cross-reference with the blockchain explorer or audit log immediately.
