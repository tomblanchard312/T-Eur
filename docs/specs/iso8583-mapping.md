# ISO 8583 Mapping Guidance for tEUR

## 1. Objective

This document provides a deterministic mapping between the Tokenized Euro (tEUR) system states and the ISO 8583 standard. It enables financial institutions, acquirers, and PSPs to integrate tEUR into existing payment rails while preserving regulatory requirements for sanctions, escrow, and auditability.

## 2. Core Mapping Table

| tEUR error.code        | scheme_code               | ISO 8583 DE 39            | Recommended Merchant Message |
| :--------------------- | :------------------------ | :------------------------ | :--------------------------- |
| `ACCOUNT_FROZEN`       | `TEUR_SANCTION_BLOCK`     | `62` (Restricted Card)    | Restricted Account           |
| `INSUFFICIENT_BALANCE` | `TEUR_INSUFFICIENT_FUNDS` | `51` (Insufficient Funds) | Insufficient Funds           |
| `ESCROW_LOCKED`        | `TEUR_ESCROW_HOLD`        | `51` (Insufficient Funds) | Insufficient Funds           |
| `LIMIT_EXCEEDED`       | `TEUR_LIMIT_EXCEEDED`     | `61` (Exceeds Limit)      | Limit Exceeded               |
| `INVALID_WALLET`       | `TEUR_INVALID_ACCOUNT`    | `14` (Invalid Card)       | Invalid Account              |
| `SYSTEM_PAUSED`        | `TEUR_SYSTEM_UNAVAILABLE` | `91` (Issuer Inoperative) | System Unavailable           |
| `INTERNAL_ERROR`       | `TEUR_SYSTEM_ERROR`       | `96` (System Malfunction) | System Error                 |

## 3. Sanctions and Freeze Handling

### 3.1 Authorization Request (MTI 0100/0200)

When a transaction involves a sanctioned or frozen wallet, the Eurosystem Access Gateway (or the Participant Gateway) MUST reject the transaction.

### 3.2 Authorization Response (MTI 0110/0210)

- **Response Code (DE 39)**: `62`
- **Additional Response Data (DE 44)**: `TEUR_SANCTION_BLOCK`
- **Private Data (DE 48)**: Should include the legal reference if permitted by privacy policy.

### 3.3 Advice and Reversal (MTI 0400/0420)

- Reversals for frozen accounts are permitted to ensure funds return to the frozen state rather than being "lost" in flight.
- Advices (MTI 0120) for frozen accounts MUST be rejected with code `62`.

### 3.4 Merchant Receipt Implications

Merchants MUST display "Restricted Account" or "Contact Bank". They MUST NOT display "Sanctioned" or specific legal reasons to prevent tipping off, as per AML/CTF regulations.

## 4. Escrowed Funds Handling

### 4.1 Authorization Behavior

The available balance for authorization is calculated as:
`Available = TotalBalance - EscrowedAmount - PendingAuthorizations`

- If `TransactionAmount <= Available`: Approve (`00`).
- If `TransactionAmount > Available`: Decline (`51`).

### 4.2 Partial Balance Availability

If a transaction is declined due to escrowed funds, the response MUST NOT reveal the escrowed amount. It is treated as a standard insufficient funds case.

### 4.3 Settlement Finality

Funds moved to escrow are considered "Settled but Restricted". They are removed from the liquid supply but remain on the participant's balance sheet under a restricted category.

## 5. Offline Transactions and Post-Facto Sanctions

### 5.1 Authorization Assumptions

Offline transactions (MTI 0120/0220 with offline flag) assume validity based on the secure element's state at the time of tap.

### 5.2 Later Sanction Detection

If a transaction is uploaded and the account is found to be sanctioned _after_ the offline authorization:

1. **Clearing Rejection**: The transaction is rejected during clearing.
2. **Response Code**: `62`.
3. **Recovery**: The Participant (Bank) must follow Runbook 02 (Sanctions Escalation) to handle the discrepancy. The merchant is typically guaranteed payment by the acquirer for valid offline taps, and the risk is borne by the scheme or the issuer.

## 6. Required ISO Fields

| Field     | Name             | Usage in tEUR                                                              |
| :-------- | :--------------- | :------------------------------------------------------------------------- |
| **DE 39** | Response Code    | Primary status (e.g., `00`, `51`, `62`).                                   |
| **DE 44** | Addl. Resp. Data | Contains the `scheme_code` (e.g., `TEUR_SANCTION_BLOCK`).                  |
| **DE 48** | Private Data     | Subfield 01: `correlation_id` (UUID). Subfield 02: `legal_ref` (Optional). |
| **DE 63** | Network Data     | tEUR Version and Environment ID (e.g., `TEUR1.0\|LAB`).                    |

## 7. Examples

### Example 1: Approved Transaction

- **MTI**: `0110`
- **DE 39**: `00`
- **DE 44**: `TEUR_SUCCESS`
- **Result**: Transaction proceeds to clearing.

### Example 2: Sanctioned Account

- **MTI**: `0110`
- **DE 39**: `62`
- **DE 44**: `TEUR_SANCTION_BLOCK`
- **DE 48**: `REF:EU-2026-001`
- **Result**: Merchant displays "Restricted Account".

### Example 3: Escrowed Funds (Insufficient Available)

- **MTI**: `0110`
- **DE 39**: `51`
- **DE 44**: `TEUR_ESCROW_HOLD`
- **Result**: Merchant displays "Insufficient Funds".
