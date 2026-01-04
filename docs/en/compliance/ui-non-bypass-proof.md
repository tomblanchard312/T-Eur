# Audit Proof: UI Non-Bypass & Backend Authority

## 1. Introduction

This document provides verifiable evidence that the **tEUR ECB Operator Interface** is a non-authoritative presentation layer. All sovereign authority, security enforcement, and policy validation reside exclusively within the **Closed Settlement Plane (CSP)** backend.

## 2. Proof 1: RBAC Enforcement (Backend Authority)

**Control**: The backend validates the role bound to the mTLS certificate for every request, regardless of the UI state.

### Test Case: Unauthorized Endpoint Access

- **Actor**: Auditor (Role: `AUDITOR`)
- **Action**: Direct API call to `/v1/ecb/mint` (Bypassing UI)
- **Command**:
  ```bash
  curl -X POST https://csp.teur.internal/v1/ecb/mint \
    --cert auditor.crt --key auditor.key \
    -H "Content-Type: application/json" \
    -d '{"amount": "1000", "justification": "Unauthorized attempt"}'
  ```
- **Expected Result**:
  - **HTTP Status**: `403 Forbidden`
  - **Error Code**: `RBAC_FAILURE`
  - **Audit Event**: `action_rejected` emitted with actor `AUD001` and reason `Insufficient permissions`.

---

## 3. Proof 2: mTLS Role Binding Integrity

**Control**: The backend rejects requests where the certificate identity does not match the required role for the requested action.

### Test Case: Role Mismatch

- **Scenario**: A valid certificate for a `PARTICIPANT` is used to call an `ECB_OPERATOR` endpoint.
- **Expected Result**:
  - **HTTP Status**: `403 Forbidden`
  - **Error Code**: `UNAUTHORIZED_ROLE`
  - **Evidence**: Backend logs show: `Role PARTICIPANT is not recognized in CSP for path /v1/ecb/mint`.

---

## 4. Proof 3: Mandatory Justification & Policy

**Control**: The backend enforces the presence of a justification string for all sovereign actions.

### Test Case: Missing Justification

- **Action**: ECB Operator calls `/v1/ecb/mint` without the `justification` field.
- **Expected Result**:
  - **HTTP Status**: `400 Bad Request`
  - **Error Code**: `VALIDATION_FAILED`
  - **Details**: `path: justification, message: Required`
  - **Audit Event**: No `action_executed` event is emitted; the transaction is never sent to the blockchain.

---

## 5. Proof 4: Non-Authoritative UI Rendering

**Control**: The UI renders actions based on the `/v1/operator/me` response, but the backend remains the final validator.

### Evidence Collection

1. **Step**: Modify the browser DOM to unhide the "Mint" button for an Auditor.
2. **Step**: Click the button and submit a request.
3. **Result**: The backend returns `403 Forbidden`.
4. **Conclusion**: UI visibility is a usability feature; backend enforcement is the security boundary.

---

## 6. Proof 5: Audit Event Completeness & Correlation

**Control**: Every sovereign action is linked across the system via a unique Correlation ID.

### Evidence Artifact

| Artifact           | Location       | Value                                           |
| :----------------- | :------------- | :---------------------------------------------- |
| **Request Header** | UI Outgoing    | `X-Correlation-Id: 550e...`                     |
| **Backend Log**    | CSP Service    | `Processing MINT for Correlation-Id: 550e...`   |
| **Audit Store**    | Audit Database | `Event: MINT_EXECUTED, Correlation-Id: 550e...` |

---

## 7. Proof 6: Evidence Bundle Integrity

**Control**: Exported evidence bundles are protected by a cryptographic manifest.

### Validation Steps

1. **Export**: Generate bundle via `POST /v1/ecb/audit/export`.
2. **Inspect**: Open `evidence_20260103.zip`.
3. **Verify**:
   - `manifest.json` contains SHA-256 hashes of all included audit logs.
   - `signature.asc` provides proof of origin from the CSP Security Module.
4. **Command**:
   ```bash
   sha256sum -c manifest.json
   ```
   **Expected Output**: `audit_log_01.json: OK`

---

## 8. Conclusion

These proofs demonstrate that the tEUR system follows the **Principle of Least Privilege** and **Defense in Depth**. The UI cannot be used to bypass the rigorous monetary and security controls enforced by the ECB within the Closed Settlement Plane.
