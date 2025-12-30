# Digital Euro (tEUR) Smart Contracts

Solidity smart contracts for the Digital Euro settlement infrastructure, implementing ECB requirements.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (forge, cast, anvil)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

## Project Structure

```
contracts/
├── src/                    # Contract source files
│   ├── interfaces/         # Contract interfaces
│   │   ├── ITokenizedEuro.sol
│   │   ├── IWalletRegistry.sol
│   │   └── IConditionalPayments.sol
│   ├── Permissioning.sol   # Role-based access control
│   ├── WalletRegistry.sol  # Wallet registration & limits
│   ├── TokenizedEuro.sol   # ERC-20 tEUR token
│   └── ConditionalPayments.sol  # Escrow & conditions
├── script/                 # Deployment scripts
│   └── DeployDigitalEuro.s.sol
├── test/                   # Unit tests
├── foundry.toml           # Foundry configuration
├── .env.example           # Environment template
└── README.md              # This file
```

## Contracts

| Contract              | Description                                                        |
| --------------------- | ------------------------------------------------------------------ |
| `Permissioning`       | Role-based access control (ADMIN, MINTER, BURNER, REGISTRAR, etc.) |
| `WalletRegistry`      | Wallet registration, KYC hash storage, holding limits              |
| `TokenizedEuro`       | ERC-20 tEUR token with waterfall mechanism                         |
| `ConditionalPayments` | Escrow-based conditional payments (pay-on-delivery, milestones)    |

## Token Specification

- **Name**: Tokenized Euro
- **Symbol**: tEUR
- **Decimals**: 2 (€1.00 = 100 units)
- **Standard**: ERC-20 compatible
- **Features**: Holding limits, waterfall, conditional payments

## Quick Start

### 1. Install Dependencies

```bash
cd contracts
forge install foundry-rs/forge-std --no-commit
```

### 2. Build

```bash
forge build
```

### 3. Test

```bash
forge test
```

### 4. Deploy to Local Anvil

```bash
# Terminal 1: Start local node
anvil

# Terminal 2: Deploy
cp .env.example .env
source .env
forge script script/DeployDigitalEuro.s.sol:DeployLabEnvironment \
  --rpc-url http://localhost:8545 \
  --broadcast
```

### 5. Deploy to Lab (Besu in Kind)

```bash
# Port-forward to Besu RPC
kubectl port-forward svc/besu-validator-rpc -n ledger-ecb-core 8545:8545 &

# Deploy
forge script script/DeployDigitalEuro.s.sol:DeployLabEnvironment \
  --rpc-url http://localhost:8545 \
  --broadcast
```

## Holding Limits (ECB Digital Euro)

| Wallet Type | Default Limit | Description               |
| ----------- | ------------- | ------------------------- |
| Individual  | €3,000.00     | Natural persons           |
| Merchant    | €30,000.00    | Businesses                |
| PSP         | Unlimited     | Payment service providers |
| NCB         | Unlimited     | National central banks    |
| Bank        | Unlimited     | Commercial banks          |

## Interacting with Contracts

```bash
# Check tEUR balance
cast call $TEUR_ADDRESS "balanceOf(address)(uint256)" $USER_ADDRESS

# Register a wallet (as registrar)
cast send $WALLET_REGISTRY_ADDRESS \
  "registerWallet(address,uint8,address,bytes32)" \
  $USER_ADDRESS 1 $BANK_ADDRESS 0x1234...

# Mint tEUR (as minter) - €100.00 = 10000 cents
cast send $TEUR_ADDRESS \
  "mint(address,uint256,bytes32)" \
  $USER_ADDRESS 10000 $(cast keccak256 "unique-key-1")
```

## Security

- Never commit `.env` files
- Multi-sig required for production admin roles
- Contracts require security audit before mainnet

## License

UNLICENSED - ECB infrastructure
