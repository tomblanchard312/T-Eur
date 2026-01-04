# ECB Operator UI to Backend Flows

## 1. Overview

This document describes the end-to-end interaction flows between the **ECB Operator Dashboard** (Frontend) and the **Closed Settlement Plane (CSP) Control Plane** (Backend).

### Trust Boundary

The **UI is non-authoritative**. All security enforcement, role validation (RBAC), and policy checks are performed by the backend. The UI serves as a secure presentation layer for human-in-the-loop sovereign actions.

---

## 2. Flow 1: Operator Discovery & Capability Mapping

**Goal**: Ensure the operator only sees actions they are authorized to perform.

### Sequence

1. **UI** -> `GET /v1/operator/me` (Authenticated via mTLS)
2. **Backend** validates client certificate and role.
3. **Backend** returns identity, role, and capability toggles.
4. **UI** renders sidebar and action buttons based on `capabilities`.

### Example

**Request**:

```http
GET /v1/operator/me
X-Correlation-Id: 550e8400-e29b-41d4-a716-446655440000
```

**Response (200 OK)**:

```json
{
  "identity": {
    "id": "OP-01",
    "role": "ECB_OPERATOR",
    "cn": "OP-01:ECB_OPERATOR:JohnDoe"
  },
  "capabilities": {
    "canMint": true,
    "canAudit": true,
    "canManageKeys": false
  }
}
```

---

## 3. Flow 2: Mint tEUR (Sovereign Issuance)

**Goal**: Issue new tEUR tokens into the scheme.

### Sequence

1. **Operator** enters amount and justification in UI.
2. **UI** displays **Confirmation Modal** (Mandatory).
3. **UI** -> `POST /v1/ecb/mint` (Includes `X-Request-Id` for idempotency).
4. **Backend** validates:
   - Role is `ECB_OPERATOR`.
   - Justification is present and valid.
   - Minting is not globally suspended.
5. **Backend** emits `action_requested` and `action_executed` audit events.
6. **UI** displays success toast and audit reference.

### Example

**Request**:

```json
{
  "amount": "100000000",
  "targetAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "justification": "Quarterly liquidity adjustment per Council Decision 2025/88"
}
```

**Audit Events**:

- `MINT_REQUESTED`: Logged immediately upon receipt.
- `MINT_EXECUTED`: Logged after successful blockchain confirmation.

---

## 4. Flow 3: Burn tEUR (Sovereign Redemption)

**Goal**: Remove tEUR tokens from circulation.

### Sequence

1. **Operator** enters amount and justification.
2. **UI** displays **Irreversible Action Warning**.
3. **UI** -> `POST /v1/ecb/burn`.
4. **Backend** validates role and justification.
5. **Backend** executes burn and emits audit events.

---

## 5. Flow 4: Freeze Entity (Sanctions Enforcement)

**Goal**: Block a specific wallet address from performing transfers.

### Sequence

1. **Operator** searches for address in UI.
2. **Operator** enters **Legal Basis** and justification.
3. **UI** -> `POST /v1/ecb/sanctions/freeze`.
4. **Backend** updates the Sanctions Registry on-chain.
5. **Backend** emits `SANCTION_FREEZE` audit event.

---

## 6. Flow 5: Escrow Placement

**Goal**: Lock funds for legal or compliance reasons.

### Sequence

1. **Operator** enters address, amount, and expiry rules.
2. **UI** -> `POST /v1/ecb/escrow/place`.
3. **Backend** returns `escrow_id`.
4. **UI** renders the escrow in the "Active Escrows" table.

---

## 7. Flow 6: Key Rotation

**Goal**: Rotate HSM-backed sovereign keys.

### Sequence

1. **Operator** (System Admin) selects key in UI.
2. **UI** -> `POST /v1/ecb/keys/rotate`.
3. **Backend** triggers HSM rotation and returns new key version.
4. **UI** shows "Rotation Successful" with timestamp.

---

## 8. Flow 7: Evidence Export

**Goal**: Generate a signed bundle of audit events for regulators.

### Sequence

1. **Auditor** applies filters (Date, Actor, Action) in UI.
2. **UI** -> `POST /v1/ecb/audit/export`.
3. **Backend** generates a ZIP bundle containing JSON events and a SHA-256 manifest.
4. **Backend** returns a download reference.
5. **UI** triggers browser download.

---

## 9. Failure Cases & Error Responses

| Scenario                  | Error Code          | HTTP Status | UI Behavior                             |
| :------------------------ | :------------------ | :---------- | :-------------------------------------- |
| **Invalid Certificate**   | `MTLS_REQUIRED`     | 401         | Redirect to "Access Denied" page.       |
| **Insufficient Role**     | `FORBIDDEN`         | 403         | Show "Unauthorized Action" alert.       |
| **Missing Justification** | `VALIDATION_FAILED` | 400         | Highlight justification field in red.   |
| **Duplicate Request**     | `IDEMPOTENCY_HIT`   | 200         | Show previous result (no double-mint).  |
| **System Suspended**      | `MINTING_SUSPENDED` | 400         | Show "Global Suspension Active" banner. |
