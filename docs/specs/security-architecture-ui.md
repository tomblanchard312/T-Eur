# Security Architecture: ECB Operator Interface

## 1. Executive Summary

The Tokenized Euro (tEUR) ECB Operator Interface is designed as a **stateless, authority-less presentation layer**. It serves as a secure gateway for human-in-the-loop operations but possesses no intrinsic power to modify the ledger or bypass the monetary policy constraints defined in the settlement core. All security enforcement is performed server-side within the Closed Settlement Plane (CSP).

## 2. Core Security Principles

### 2.1 Authority-less Frontend

The frontend application (React/Vite) does not store private keys, administrative credentials, or sensitive configuration. It functions solely by presenting data retrieved from authorized API endpoints and formatting user-initiated requests for backend validation.

### 2.2 Server-Side Role Enforcement (RBAC)

While the UI dynamically hides or shows elements based on the user's role (e.g., `ECB_OPERATOR` vs. `AUDITOR`), this is a usability feature, not a security boundary.

- **Enforcement**: Every API request is validated against the user's JWT (JSON Web Token) claims on the backend.
- **Failure Mode**: If a user attempts to manually craft a request to an unauthorized endpoint (e.g., `/api/v1/monetary/mint`), the backend returns a `403 Forbidden` response, which the UI handles by displaying a security alert.

### 2.3 Mandatory Justification & Audit Binding

The system enforces a "Justification-Before-Action" protocol for all sovereign operations.

- **UI Constraint**: The `ConfirmationModal` component prevents the "Confirm" button from being activated until a justification string is provided.
- **Backend Constraint**: The backend API schema (Zod/JSON Schema) marks the `justification` field as **required**. Requests missing this field are rejected at the gateway level.
- **Audit Integrity**: The justification is bound to the transaction in the immutable audit log, ensuring that every monetary action is linked to a specific Council Decision or operational requirement.

## 3. Threat Model & Mitigations

| Threat                  | Mitigation Strategy                                            | Enforcement Point                                                                                                  |
| :---------------------- | :------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------- |
| **UI Bypass**           | User attempts to call API directly via `curl` or Postman.      | **Backend Middleware**: Validates JWT and Role permissions for every call.                                         |
| **Credential Theft**    | Attacker gains access to an operator's browser session.        | **Short-lived JWTs & HSM**: Tokens expire quickly. High-value actions require HSM-backed multi-sig approval.       |
| **Parameter Tampering** | User modifies the `amount` or `target` in the browser console. | **Server-Side Validation**: Backend re-validates all parameters against business logic and limits.                 |
| **Logic Injection**     | Attacker attempts to bypass the confirmation modal.            | **Statelessness**: The backend does not "know" if a modal was shown; it only cares if the signed request is valid. |

## 4. Evidence of Enforcement

### 4.1 Code-Level Proof (Frontend)

The frontend uses a centralized API client ([api/client.ts](../api/src/api/client.ts)) that enforces security headers and handles authorization failures:

```typescript
// Example: Global 401/403 Handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403) {
      toast.error("Security Violation: Unauthorized Action");
    }
    return Promise.reject(error);
  }
);
```

### 4.2 Code-Level Proof (Backend)

The settlement core enforces the justification requirement before interacting with the smart contracts:

```javascript
// Example: Backend Enforcement
router.post(
  "/mint",
  authorize("ECB_OPERATOR"),
  validate(MintSchema),
  async (req, res) => {
    const { amount, justification } = req.body;
    await auditLogger.logAction("MINT", {
      amount,
      justification,
      operator: req.user.id,
    });
    await blockchainService.mint(amount);
  }
);
```

## 5. Conclusion

The tEUR Operator UI is a transparent window into the system's state. It provides the necessary tools for ECB officials to execute their mandate while ensuring that **no single point of failure** exists within the browser environment. Auditors can verify the integrity of the system by inspecting the backend logs, which remain the single source of truth for all sovereign actions.
