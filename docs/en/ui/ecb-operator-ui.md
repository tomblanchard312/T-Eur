# ECB Operator Interface - Mockups (English)

This document provides ASCII mockups of the ECB Sovereign Control Interface for the tEUR system.

## 1. ECB Dashboard

**Purpose**: High-level overview of system health and reserve status.

```text
+------------------------------------------------------------------------------+
| [ ECB Sovereign Control ]          User: ecb-admin-01 | Role: OPERATIONAL    |
+------------------------------------------------------------------------------+
| [ Dashboard ] [ Sanctions ] [ Escrow ] [ Monetary Ops ] [ Security ] [ Audit ] |
+------------------------------------------------------------------------------+
|                                                                              |
|  SYSTEM HEALTH: [ OK ]  |  NETWORK: [ ACTIVE ]  |  MINTING: [ ENABLED ]      |
|                                                                              |
|  RESERVE STATUS                                                              |
|  +----------------------------+  +----------------------------+              |
|  | Total Supply (tEUR)        |  | Reserve Balance (EUR)      |              |
|  | 1,250,000,000.00           |  | 1,250,000,000.00           |              |
|  +----------------------------+  +----------------------------+              |
|                                                                              |
|  ACTIVE ALERTS                                                               |
|  - [WARN] High-value transfer detected: 5,000,000.00 tEUR (Bank A -> Bank B) |
|  - [INFO] Key rotation scheduled for 2026-01-15                              |
|                                                                              |
+------------------------------------------------------------------------------+
```

## 2. Sanctions Management

**Purpose**: Immediate freezing of wallets based on regulatory requirements.

```text
+------------------------------------------------------------------------------+
| SANCTIONS MANAGEMENT                                                         |
+------------------------------------------------------------------------------+
| Wallet Address: [ 0x1234...abcd ] [ Search ]                                 |
|                                                                              |
| Status: ACTIVE                                                               |
|                                                                              |
| [ ACTION: FREEZE ENTITY ] [ ACTION: UNFREEZE ENTITY ]             |
| Reason: [ Select Reason...          |v]                                      |
| Justification: [ AML/CFT Match - Case #882                      ]            |
| Legal Basis: [ EU Regulation 2024/123 ]                                      |
|                                                                              |
| [ CONFIRM ACTION ] <-- Requires mTLS + HSM Signature                         |
|                                                                              |
| RECENT ACTIONS                                                               |
| 2026-01-03 | 0x9876... | FROZEN   | Sanction List v2.1 | Admin: ecb-02       |
| 2026-01-02 | 0x4455... | UNFROZEN | Legal Review Clear  | Admin: ecb-01       |
+------------------------------------------------------------------------------+
```

## 3. Escrow Management

**Purpose**: Legal seizure and holding of funds.

```text
+------------------------------------------------------------------------------+
| ESCROW MANAGEMENT                                                            |
+------------------------------------------------------------------------------+
| Wallet: [ 0xabcd...1234 ] | Current Balance: 50,000.00 tEUR                  |
|                                                                              |
| [ PLACE INTO ESCROW ]                                                        |
| Amount: [ 25,000.00 ] tEUR                                                   |
| Legal Basis: [ Court Order 2026-XYZ ]                                        |
| Expiry: [ 2026-06-01 ] (Optional)                                            |
|                                                                              |
| [ EXECUTE ESCROW ]                                                           |
|                                                                              |
| ACTIVE ESCROWS                                                               |
| ID: ESC-99 | 0xabcd... | 25,000.00 | [ RELEASE ] [ BURN ]                    |
+------------------------------------------------------------------------------+
```

## 4. Monetary Operations

**Purpose**: Minting, burning, and global suspension.

```text
+------------------------------------------------------------------------------+
| MONETARY OPERATIONS                                                          |
+------------------------------------------------------------------------------+
| [ MINT tEUR ]                                                                |
| To: [ Reserve Account ]                                                      |
| Amount: [ 10,000,000.00 ]                                                    |
| Justification: [ Reserve Expansion ]                                         |
| [ CONFIRM MINT ]                                                             |
|                                                                              |
| [ BURN tEUR ]                                                                |
| From: [ Reserve Account ]                                                    |
| Amount: [ 5,000,000.00 ]                                                     |
| [ CONFIRM BURN ]                                                             |
|                                                                              |
| EMERGENCY CONTROLS                                                           |
| [ SUSPEND ALL MINTING ] <-- GLOBAL KILL SWITCH                               |
| Status: [ ACTIVE ]                                                           |
+------------------------------------------------------------------------------+
```

## 5. Security and Keys

**Purpose**: Sovereign key lifecycle management.

```text
+------------------------------------------------------------------------------+
| SECURITY & KEYS                                                              |
+------------------------------------------------------------------------------+
| ACTIVE KEYS                                                                  |
| ID: ecb-root-01 | Role: ROOT    | Status: ACTIVE | [ ROTATE ]                |
| ID: ecb-iss-01  | Role: ISSUING | Status: ACTIVE | [ ROTATE ]                |
| ID: bank-a-p-01 | Role: PARTICIP. | Status: ACTIVE | [ REVOKE ]              |
|                                                                              |
| [ REVOKE KEY ] [ ISOLATE PARTICIPANT ]                                       |
| Target ID: [ bank-a-p-01 ]                                                   |
| Reason: [ Compromise Suspected ]                                             |
| [ CONFIRM ACTION ]                                                           |
|                                                                              |
| * ISOLATE PARTICIPANT: Revokes all keys and blocks gateway access in CSP.    |
+------------------------------------------------------------------------------+
```

## 6. Audit View

**Purpose**: Immutable event timeline for auditors.

```text
+------------------------------------------------------------------------------+
| AUDIT LOG                                                                    |
+------------------------------------------------------------------------------+
| Filter: [ All Actions |v] [ Date Range |v] [ Search... ]                     |
|                                                                              |
| TIMESTAMP           | ACTOR      | ACTION         | DETAILS                  |
| 2026-01-03 10:00:01 | ecb-admin  | MINT           | 10M tEUR to Reserve      |
| 2026-01-03 10:15:22 | ecb-admin  | FREEZE_ACCOUNT | 0x1234... (Sanctions)    |
| 2026-01-03 10:45:10 | system     | KEY_ROTATED    | ecb-iss-01 -> ecb-iss-02 |
|                                                                              |
| [ EXPORT EVIDENCE (PDF/JSON) ]                                               |
+------------------------------------------------------------------------------+
```
