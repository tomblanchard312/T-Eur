# tEUR Bank SDK

TypeScript/JavaScript SDK for European banks to integrate with the tEUR (Tokenized Euro) Digital Currency.

## Installation

```bash
npm install @teur/bank-sdk
```

## Quick Start

```typescript
import { TEurClient, WalletType } from '@teur/bank-sdk';

// Initialize client
const client = new TEurClient({
  apiUrl: 'https://teur-api.eu',
  apiKey: 'your-bank-api-key',
});

// Register a customer wallet
const wallet = await client.registerWallet({
  address: '0x1234...',
  type: WalletType.INDIVIDUAL,
  kycHash: '0xabcd...', // SHA256 hash of KYC data
});

// Transfer tEUR
const transfer = await client.transfer({
  from: '0x1234...',
  to: '0x5678...',
  amount: TEurClient.eurosToCents(100), // €100.00
});

console.log(`Transfer completed: ${transfer.txHash}`);
```

## Features

- ✅ **Full TypeScript support** with type definitions
- ✅ **Idempotency** built-in for all write operations
- ✅ **ECB compliance** - holding limits, waterfall, conditional payments
- ✅ **Error handling** with detailed error messages
- ✅ **Auto-retry** for network failures
- ✅ **Wallet management** - register, activate, deactivate
- ✅ **Transfers** - send tEUR with holding limit enforcement
- ✅ **Conditional payments** - escrow with delivery confirmation
- ✅ **Waterfall operations** - automatic excess sweeping

## API Reference

### Client Initialization

```typescript
const client = new TEurClient({
  apiUrl: 'https://teur-api.eu', // API endpoint
  apiKey: 'your-bank-api-key',   // Your institution's API key
  timeout: 30000,                 // Request timeout (optional)
});
```

### Wallet Operations

#### Register Wallet
```typescript
await client.registerWallet({
  address: '0x...',
  type: WalletType.INDIVIDUAL, // or MERCHANT, PSP, NCB, BANK
  linkedBankAccount: '0x...', // optional
  kycHash: '0x...', // SHA256 hash of KYC documents
});
```

#### Get Wallet Info
```typescript
const wallet = await client.getWallet('0x...');
console.log(wallet.balance); // balance in cents
console.log(wallet.balanceFormatted); // "€1,234.56"
```

### Transfer Operations

#### Transfer tEUR
```typescript
await client.transfer({
  from: '0x...',
  to: '0x...',
  amount: 10000, // €100.00 in cents
  idempotencyKey: 'optional-uuid', // auto-generated if not provided
});
```

#### Mint tEUR (NCB/ECB only)
```typescript
await client.mint({
  to: '0x...',
  amount: 100000, // €1,000.00
});
```

#### Execute Waterfall
```typescript
// Sweep excess balance to linked bank account
await client.executeWaterfall('0x...');
```

### Conditional Payments

#### Create Escrow Payment
```typescript
const payment = await client.createConditionalPayment({
  payee: '0x...',
  amount: 50000, // €500.00
  conditionType: ConditionType.DELIVERY,
  conditionData: '0x...', // delivery confirmation hash
  expiresAt: Math.floor(Date.now() / 1000) + 86400, // 24 hours
});

console.log(`Payment ID: ${payment.paymentId}`);
```

#### Release Payment
```typescript
await client.releasePayment(paymentId, proof);
```

### Utility Methods

```typescript
// Convert euros to cents
const cents = TEurClient.eurosToCents(123.45); // 12345

// Convert cents to euros
const euros = TEurClient.centsToEuros(12345); // 123.45

// Format as currency
const formatted = TEurClient.formatEuro(12345); // "€123.45"

// Generate idempotency key
const key = TEurClient.generateIdempotencyKey(); // UUID v4
```

## Error Handling

```typescript
try {
  await client.transfer({
    from: '0x...',
    to: '0x...',
    amount: 10000,
  });
} catch (error) {
  if (error.message.includes('BLOCKCHAIN_ERROR')) {
    // Handle blockchain errors
  } else if (error.message.includes('VALIDATION_ERROR')) {
    // Handle validation errors
  }
  console.error('Transfer failed:', error.message);
}
```

## Holding Limits

Per ECB Digital Euro requirements:
- **Individual wallets**: €3,000 maximum
- **Merchant wallets**: €30,000 maximum
- Excess automatically swept to linked bank account (waterfall)

## Security

- All API calls require authentication via API key
- Idempotency keys prevent duplicate transactions
- KYC data is hashed (never sent in plaintext)
- TLS 1.3 encryption for all communications

## License

MIT
