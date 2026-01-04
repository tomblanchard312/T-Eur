# Offline Payments Architecture

## Purpose

- Describe the offline payments model: secure-element based wallets, reconciliation protocol, and threat assumptions.
- Ensure offline transactions are limited, capped, and reconciled to maintain system integrity.
- Align with ECB Digital Euro principles: offline payments are supported but with strict controls to prevent abuse.

## Key Principles

- **Limited Offline Spend**: Offline transactions are capped per device and per transaction to minimize risk.
- **Cryptographic Security**: Offline tokens are signed by wallet secure elements (SE) using asymmetric cryptography.
- **Local Validation**: Terminals validate signatures locally without online connectivity.
- **No Online Checks**: Offline approvals do not perform balance or authorization checks.
- **Mandatory Reconciliation**: All offline transactions must be reconciled online for settlement.
- **Fail Closed**: Offline acceptance never fails open beyond configured limits; transactions are rejected if limits are exceeded.

## Components

- **Device Secure Element (SE)**: Hardware-backed security module in the wallet device that generates and signs offline tokens.
- **Local Wallet App**: Consumer app that requests offline tokens from the SE and presents them to merchants.
- **Merchant Terminal**: Validates offline tokens locally and stores approved transactions for later reconciliation.
- **Reconciliation Gateway**: Collects signed offline transactions from terminals and submits them to tEUR for on-chain settlement.
- **Reconciliation Ledger**: Maintains records of offline transactions for audit and dispute resolution.
- **Dispute Resolver**: Handles cases of invalid or disputed offline transactions.

## Assumptions

- Device clocks may drift; reconciliation uses monotonic counters and cryptographic proofs.
- Double-spend prevention requires device-level counters and reconciliation windows.
- Offline caps are configured per device during onboarding and can be adjusted via online updates.
- Connectivity may be intermittent; offline transactions are batched for reconciliation.

## Offline Token Structure

Offline tokens are JSON Web Tokens (JWT) signed by the device's secure element.

### Token Payload Structure

```json
{
  "iss": "teur-wallet-se", // Issuer: wallet secure element
  "sub": "device-uuid", // Subject: unique device identifier
  "aud": "teur-merchant-terminal", // Audience: merchant terminal
  "iat": 1640995200, // Issued at: Unix timestamp
  "exp": 1641081600, // Expiration: token validity period
  "jti": "txn-uuid", // JWT ID: unique transaction identifier
  "amount": 5000, // Amount in cents (e.g., 50.00 EUR)
  "currency": "EUR", // Currency code
  "merchantId": "merchant-123", // Merchant identifier
  "terminalId": "terminal-456", // Terminal identifier
  "counter": 42, // Monotonic counter for anti-replay
  "capRemaining": 95000, // Remaining offline cap in cents
  "signature": "..." // Detached signature (not in payload)
}
```

### Signature

- Algorithm: ECDSA with P-256 curve (or equivalent secure algorithm).
- Signed by device SE private key.
- Detached signature to allow payload inspection without key exposure.
- Public key certified during device onboarding.

## Validation Logic

Terminals validate offline tokens locally:

1. **Signature Verification**: Verify ECDSA signature using device's public key.
2. **Expiration Check**: Ensure `iat` < current time < `exp`.
3. **Audience Check**: Confirm `aud` matches terminal's identifier.
4. **Amount Limits**: Verify `amount` <= configured per-transaction limit.
5. **Cap Check**: Ensure `capRemaining` >= `amount` (fail closed if not).
6. **Counter Check**: Verify `counter` > last seen counter for this device (anti-replay).
7. **Merchant/Terminal Match**: Validate `merchantId` and `terminalId` against terminal config.

If all checks pass, approve the transaction and store for reconciliation. If any check fails, reject immediately.

## Anti-Replay Controls

- **Monotonic Counter**: Each device maintains a counter incremented per transaction. Terminals track the last valid counter per device.
- **Counter Window**: Accept counters within a reasonable window to handle out-of-order processing.
- **Timestamp Bounds**: Use `iat` and `exp` to limit token lifetime (e.g., 24 hours).
- **Device Blacklist**: Terminals can mark devices as compromised during reconciliation.

## Reconciliation Workflow

1. **Batch Collection**: Terminals batch approved offline transactions.
2. **Gateway Submission**: When online, terminals submit batches to reconciliation gateway.
3. **tEUR Validation**: Gateway forwards to tEUR for settlement validation:
   - Verify device is registered and not suspended.
   - Check offline cap against actual balance.
   - Process settlement if valid.
4. **Settlement**: Successful transactions are settled on-chain.
5. **Rejection Handling**: Invalid transactions are rejected with reasons.
6. **Cap Update**: Device offline caps are updated based on reconciled spending.

### Reconciliation Message Format

```json
{
  "batchId": "batch-uuid",
  "terminalId": "terminal-456",
  "transactions": [
    {
      "token": "...", // Full offline token
      "approvedAt": "2026-01-03T12:00:00Z",
      "status": "approved"
    }
  ]
}
```

## Rejection and Dispute Handling

### Rejection Reasons

- **Invalid Signature**: Cryptographic verification failed.
- **Expired Token**: Token outside validity window.
- **Cap Exceeded**: Remaining cap insufficient.
- **Counter Invalid**: Replay attempt detected.
- **Device Unknown**: Device not registered or suspended.

### Dispute Process

1. **Merchant Report**: Merchant reports suspicious offline transaction.
2. **tEUR Review**: Validate against reconciliation data.
3. **Chargeback**: If invalid, reverse settlement and notify wallet.
4. **Device Action**: Suspend device if fraud detected.
5. **Escalation**: Severe cases involve regulatory authorities.

## Security Controls

- **Offline Caps**: Per-device spending limits (e.g., 100 EUR/day).
- **Velocity Rules**: Rate limiting on transaction frequency.
- **Device Attestation**: PKI-based device certification during onboarding.
- **Audit Logging**: All offline validations and reconciliations logged.
- **Zero Trust**: No implicit trust; all tokens validated cryptographically.

## Threat Assumptions

- **Device Compromise**: Assume SE can be extracted; limit offline caps to minimize damage.
- **Network Attacks**: Offline mode prevents man-in-the-middle.
- **Replay Attacks**: Counters and timestamps prevent reuse.
- **Double Spending**: Reconciliation detects and prevents settlement of invalid transactions.

This architecture ensures offline payments are secure, limited, and fully reconciled, maintaining the integrity of the Digital Euro system.
