# tEUR API Gateway

REST API Gateway for the Tokenized Euro (tEUR) Digital Currency - enabling European banks to integrate with the Digital Euro infrastructure.

## Features

- **Wallet Management**: Register, activate/deactivate wallets with KYC compliance
- **Token Operations**: Mint, burn, transfer tEUR with holding limits enforcement
- **Waterfall/Reverse-Waterfall**: Automatic excess sweeping to linked bank accounts
- **Conditional Payments**: Escrow with delivery confirmation, time-locks, disputes
- **Role-Based Access Control**: ECB, NCB, Bank, PSP permission tiers
- **Audit Logging**: Full regulatory compliance audit trail
- **Rate Limiting**: Per-institution rate limiting
- **Idempotency**: Duplicate request handling for financial safety

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Running Besu node (or use Docker Compose)
- Deployed smart contracts

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your contract addresses and configuration
```

### Development

```bash
# Start in development mode with hot reload
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build and run with Docker Compose (includes Besu)
docker-compose up -d

# View logs
docker-compose logs -f api
```

## API Documentation

Interactive API documentation available at: `http://localhost:3000/api/docs`

## API Endpoints

### Health

- `GET /api/v1/health` - Full health check
- `GET /api/v1/health/ready` - Readiness probe
- `GET /api/v1/health/live` - Liveness probe

### Wallets

- `POST /api/v1/wallets` - Register new wallet
- `GET /api/v1/wallets/:address` - Get wallet info
- `GET /api/v1/wallets/:address/balance` - Get balance
- `POST /api/v1/wallets/:address/deactivate` - Deactivate wallet
- `POST /api/v1/wallets/:address/reactivate` - Reactivate wallet
- `PUT /api/v1/wallets/:address/linked-bank` - Update linked bank

### Transfers

- `POST /api/v1/transfers` - Transfer tEUR
- `POST /api/v1/transfers/mint` - Mint tEUR (NCB/ECB only)
- `POST /api/v1/transfers/burn` - Burn tEUR (NCB/ECB only)
- `POST /api/v1/transfers/waterfall` - Execute waterfall
- `POST /api/v1/transfers/reverse-waterfall` - Execute reverse waterfall
- `GET /api/v1/transfers/balance/:address` - Get balance
- `GET /api/v1/transfers/total-supply` - Get total supply

### Conditional Payments

- `POST /api/v1/payments` - Create conditional payment
- `GET /api/v1/payments/:paymentId` - Get payment details
- `POST /api/v1/payments/:paymentId/confirm-delivery` - Confirm delivery
- `POST /api/v1/payments/:paymentId/release` - Release payment
- `POST /api/v1/payments/:paymentId/cancel` - Cancel payment
- `POST /api/v1/payments/:paymentId/dispute` - Dispute payment
- `POST /api/v1/payments/:paymentId/resolve` - Resolve dispute

### Admin (ECB/NCB only)

- `GET /api/v1/admin/system/status` - System status
- `POST /api/v1/admin/system/pause` - Pause operations
- `POST /api/v1/admin/system/unpause` - Resume operations
- `POST /api/v1/admin/roles/grant` - Grant role
- `POST /api/v1/admin/roles/revoke` - Revoke role
- `GET /api/v1/admin/roles/check` - Check role
- `GET /api/v1/admin/roles/available` - List roles

## Authentication

### API Key (Recommended for Production)

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/0x..." \
  -H "X-API-Key: demo-bank-key"
```

### Bearer Token (JWT)

```bash
curl -X GET "http://localhost:3000/api/v1/wallets/0x..." \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

## Demo API Keys

For development, the following API keys are pre-configured:

| Key               | Institution         | Permissions                         |
| ----------------- | ------------------- | ----------------------------------- |
| `demo-ecb-key`    | ECB                 | Full access                         |
| `demo-ncb-de-key` | Deutsche Bundesbank | Mint, burn, waterfall, read         |
| `demo-bank-key`   | Deutsche Bank       | Transfer, waterfall, payments, read |
| `demo-psp-key`    | Payment Services    | Register wallet, read               |

## Environment Variables

| Variable                          | Description                          | Default               |
| --------------------------------- | ------------------------------------ | --------------------- |
| `PORT`                            | Server port                          | 3000                  |
| `NODE_ENV`                        | Environment                          | development           |
| `BLOCKCHAIN_RPC_URL`              | Besu RPC endpoint                    | http://localhost:8545 |
| `BLOCKCHAIN_CHAIN_ID`             | Chain ID                             | 31337                 |
| `BLOCKCHAIN_OPERATOR_PRIVATE_KEY` | Operator signing key                 | -                     |
| `CONTRACT_PERMISSIONING`          | Permissioning contract address       | -                     |
| `CONTRACT_WALLET_REGISTRY`        | WalletRegistry contract address      | -                     |
| `CONTRACT_TOKENIZED_EURO`         | TokenizedEuro contract address       | -                     |
| `CONTRACT_CONDITIONAL_PAYMENTS`   | ConditionalPayments contract address | -                     |
| `JWT_SECRET`                      | JWT signing secret                   | -                     |
| `RATE_LIMIT_WINDOW_MS`            | Rate limit window                    | 60000                 |
| `RATE_LIMIT_MAX`                  | Max requests per window              | 100                   |
| `CORS_ORIGIN`                     | Allowed CORS origins                 | \*                    |
| `LOG_LEVEL`                       | Logging level                        | info                  |

## Amounts

All amounts are in **euro cents** (integer). Examples:

- `100` = €1.00
- `300000` = €3,000.00 (individual holding limit)
- `3000000` = €30,000.00 (merchant holding limit)

## Idempotency

All write operations (POST/PUT/PATCH) support idempotency keys:

```json
{
  "to": "0x...",
  "amount": 100000,
  "idempotencyKey": "550e8400-e29b-41d4-a716-446655440000"
}
```

Duplicate requests with the same idempotency key return cached responses with header `X-Idempotency-Replayed: true`.

## Error Responses

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [...],
    "requestId": "abc-123"
  }
}
```

| Code                   | HTTP | Description                        |
| ---------------------- | ---- | ---------------------------------- |
| `VALIDATION_ERROR`     | 400  | Invalid request data               |
| `AUTHENTICATION_ERROR` | 401  | Missing/invalid credentials        |
| `AUTHORIZATION_ERROR`  | 403  | Insufficient permissions           |
| `NOT_FOUND`            | 404  | Resource not found                 |
| `CONFLICT`             | 409  | Duplicate or conflicting operation |
| `RATE_LIMIT_EXCEEDED`  | 429  | Too many requests                  |
| `BLOCKCHAIN_ERROR`     | 502  | Smart contract error               |
| `INTERNAL_ERROR`       | 500  | Unexpected server error            |

## Audit Logging

All operations are logged to `logs/audit.log` with:

- Actor (institution ID)
- Action
- Resource type/ID
- Timestamp
- Result (success/failure)
- Request details

## Security

- All endpoints require authentication (API key or JWT)
- Rate limiting per institution
- Request validation with Zod schemas
- Helmet.js security headers
- CORS configuration
- Non-root Docker user

## License

Proprietary - European Central Bank Digital Euro Initiative
