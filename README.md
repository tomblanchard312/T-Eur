# Tokenized Euro (tEUR)

Sovereign EU financial infrastructure for the Tokenized Euro.

## Overview

tEUR is a digital euro settlement system designed for:
- Sovereign EU deployment
- Multi-zone resilience
- Regulatory compliance
- Vendor independence

## Token Specification

| Property | Value |
|----------|-------|
| Name | Tokenized Euro |
| Symbol | `tEUR` |
| Decimals | 2 |
| Backing | 1:1 EUR reserves |

## Architecture

### Trust Zones

| Zone Type | Prefix | Description |
|-----------|--------|-------------|
| ECB Core | `ecb-core` | Central settlement authority |
| National Central Bank | `ncb-<country>` | National node (e.g., `ncb-de`) |
| Commercial Bank | `bank-<country>` | Commercial participant |
| PSP | `psp-<region>` | Payment service provider |

### DNS Realms

- **CSP (Closed Settlement Plane)**: `<service>.<zone>.csp.eu.int`
- **PAP (Public Access Plane)**: `<service>.teuro.eu`

## Project Structure

```
├── docs/                    # Documentation
├── modules/                 # Terraform modules
│   ├── dns-authoritative/   # Authoritative DNS
│   ├── dns-resolver/        # Recursive resolver
│   ├── ledger-node/         # Besu validator node
│   ├── routing-gateway/     # Inter-zone routing
│   ├── pki-root/            # Root CA
│   └── pki-intermediate/    # Intermediate CA
├── envs/                    # Environment configurations
│   ├── lab/                 # Local development
│   ├── int/                 # Integration
│   ├── stg/                 # Staging
│   └── prd/                 # Production
├── k8s/                     # Kubernetes manifests
│   └── base/                # Base configurations
├── contracts/               # Smart contracts
└── scripts/                 # Utility scripts
```

## Environments

| Environment | Name | Purpose |
|-------------|------|---------|
| Local Lab | `lab` | Single or multi-node development |
| Integration | `int` | Controlled shared testing |
| Staging | `stg` | Pre-production validation |
| Production | `prd` | Sovereign production |

## Getting Started

### Prerequisites

- Terraform >= 1.5
- Kubernetes >= 1.28
- Helm >= 3.12

### Local Development

```bash
cd envs/lab/ecb-core
terraform init
terraform plan
terraform apply
```

## Naming Conventions

All names must be:
- Lowercase
- Hyphen-separated
- ASCII only
- Function-based (not implementation-based)

See [Canonical Naming Conventions](docs/canonical-naming-and-copilot-instructions.md) for complete rules.

## Security

- All internal communication uses mTLS
- Keys never appear in plaintext
- Secrets are mounted, not embedded
- Full auditability required

## License

Proprietary - EU Sovereign Infrastructure
