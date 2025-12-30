# Digital Euro (tEUR) Smart Contract Architecture

## Contract Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PERMISSIONING                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Roles: ADMIN | MINTER | BURNER | EMERGENCY | VALIDATOR |           │    │
│  │         REGISTRAR | ORACLE | WATERFALL                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│    WALLET REGISTRY      │ │    TOKENIZED EURO       │ │  CONDITIONAL PAYMENTS   │
│                         │ │       (tEUR)            │ │                         │
│  • Wallet registration  │ │  • ERC-20 token         │ │  • Pay-on-delivery      │
│  • KYC hash storage     │◄│  • Holding limits       │►│  • Milestone payments   │
│  • Holding limits:      │ │  • Waterfall sweep      │ │  • Time-locked escrow   │
│    - Individual: €3,000 │ │  • Reverse waterfall    │ │  • Dispute resolution   │
│    - Merchant: €30,000  │ │  • Emergency pause      │ │  • Auto-refund expiry   │
│    - PSP/Bank: Unlimited│ │                         │ │                         │
│  • Linked bank accounts │ │                         │ │                         │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

## ECB Digital Euro Flow

### 1. Wallet Registration

```
User ──► PSP/Bank ──► WalletRegistry.registerWallet()
                              │
                              ├── walletType: INDIVIDUAL/MERCHANT/PSP/BANK
                              ├── linkedBankAccount: address
                              └── kycHash: bytes32 (off-chain KYC data)
```

### 2. Loading Digital Euro (Funding)

```
Bank Account ──► TokenizedEuro.mint() ──► User Wallet
                        │
                        └── Respects holding limit
                        └── Excess swept via waterfall
```

### 3. Payment Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      REGULAR PAYMENT                                   │
│  Payer ──► TokenizedEuro.transfer() ──► Payee                         │
│                     │                      │                           │
│                     └── Check balance      └── Execute waterfall      │
│                                               (if excess > limit)      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                   CONDITIONAL PAYMENT (Pay-on-Delivery)               │
│                                                                        │
│  1. Payer ──► ConditionalPayments.createConditionalPayment()          │
│                     │                                                  │
│                     └── tEUR transferred to escrow                    │
│                                                                        │
│  2. Delivery occurs ──► Oracle/Payer confirms                         │
│                     │                                                  │
│                     └── ConditionalPayments.confirmDelivery()         │
│                                                                        │
│  3. Automatic release ──► tEUR transferred to Payee                   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4. Waterfall Mechanism

```
┌─────────────────────────────────────────────────────────────────────┐
│  WATERFALL (Excess Sweep)                                            │
│                                                                       │
│  Incoming Payment                                                     │
│       │                                                               │
│       ▼                                                               │
│  ┌─────────┐    Balance > Limit?    ┌──────────────────────────┐    │
│  │  Wallet │ ───────YES────────────►│ Sweep excess to linked   │    │
│  │ (€3,000 │                        │ bank account             │    │
│  │  limit) │ ◄──────NO──────────────┤                          │    │
│  └─────────┘    Keep in wallet      └──────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  REVERSE WATERFALL (Top-up)                                          │
│                                                                       │
│  Payment Request > Wallet Balance                                     │
│       │                                                               │
│       ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Auto-transfer from linked bank account to wallet            │    │
│  │  (up to holding limit)                                       │    │
│  └─────────────────────────────────────────────────────────────┘    │
│       │                                                               │
│       ▼                                                               │
│  Payment executed                                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Conditional Payment Types

| Type        | Trigger                        | Use Case                   |
| ----------- | ------------------------------ | -------------------------- |
| `DELIVERY`  | Oracle/Payer confirms delivery | E-commerce, food delivery  |
| `MILESTONE` | All milestones marked complete | Construction, freelance    |
| `TIME_LOCK` | Timestamp reached              | Scheduled payments, escrow |
| `MULTI_SIG` | Multiple parties confirm       | High-value transactions    |
| `ORACLE`    | External data feed             | Pay-per-use, IoT           |

## Important: NOT Programmable Money

The Digital Euro implemented here is **NOT** programmable money:

- ✅ Funds remain fully fungible tEUR at all times
- ✅ No restrictions on where/when/with whom to use
- ✅ Conditional payments only gate **release timing**, not spending capability
- ✅ After release, tEUR can be used anywhere like regular transfers
- ❌ No vouchers, expiry dates, or usage restrictions

## Deployment Order

1. `Permissioning` - Deploy first, set initial admin
2. `WalletRegistry` - Deploy with Permissioning address
3. `TokenizedEuro` - Deploy with Permissioning address
4. `ConditionalPayments` - Deploy with TokenizedEuro and Permissioning
5. Configure:
   - Call `TokenizedEuro.setWalletRegistry()`
   - Call `TokenizedEuro.setWaterfallEnabled(true)`
   - Grant roles via `Permissioning.grantRole()`

## Role Assignments

| Entity         | Roles                |
| -------------- | -------------------- |
| ECB            | ADMIN, EMERGENCY     |
| NCB            | MINTER, BURNER       |
| PSP/Bank       | REGISTRAR, WATERFALL |
| Oracle Service | ORACLE               |
| Validators     | VALIDATOR            |
