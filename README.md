# Tokenized Euro (tEUR)

Sovereign EU financial infrastructure for the Tokenized Euro.

## Overview

tEUR is a digital euro settlement system designed for:

- Sovereign EU deployment
- Multi-zone resilience
- Regulatory compliance
- Vendor independence

## Documentation Translations

Select a language (flag indicates a representative country):

- 🇧🇬 Bulgarian: [README (BG)](docs/readmes/README.bg.md)
- 🇭🇷 Croatian: [README (HR)](docs/readmes/README.hr.md)
- 🇨🇿 Czech: [README (CS)](docs/readmes/README.cs.md)
- 🇩🇰 Danish: [README (DA)](docs/readmes/README.da.md)
- 🇳🇱 Dutch: [README (NL)](docs/readmes/README.nl.md)
- 🇪🇺 English: [README (EN)](docs/readmes/README.en.md)
- 🇪🇪 Estonian: [README (ET)](docs/readmes/README.et.md)
- 🇫🇮 Finnish: [README (FI)](docs/readmes/README.fi.md)
- 🇫🇷 French: [README (FR)](docs/readmes/README.fr.md)
- 🇩🇪 German: [README (DE)](docs/readmes/README.de.md)
- 🇬🇷 Greek: [README (EL)](docs/readmes/README.el.md)
- 🇭🇺 Hungarian: [README (HU)](docs/readmes/README.hu.md)
- 🇮🇪 Irish: [README (GA)](docs/readmes/README.ga.md)
- 🇮🇹 Italian: [README (IT)](docs/readmes/README.it.md)
- 🇱🇻 Latvian: [README (LV)](docs/readmes/README.lv.md)
- 🇱🇹 Lithuanian: [README (LT)](docs/readmes/README.lt.md)
- 🇲🇹 Maltese: [README (MT)](docs/readmes/README.mt.md)
- 🇵🇱 Polish: [README (PL)](docs/readmes/README.pl.md)
- 🇵🇹 Portuguese: [README (PT)](docs/readmes/README.pt.md)
- 🇷🇴 Romanian: [README (RO)](docs/readmes/README.ro.md)
- 🇸🇰 Slovak: [README (SK)](docs/readmes/README.sk.md)
- 🇸🇮 Slovenian: [README (SL)](docs/readmes/README.sl.md)
- 🇪🇸 Spanish: [README (ES)](docs/readmes/README.es.md)
- 🇸🇪 Swedish: [README (SV)](docs/readmes/README.sv.md)

## Token Specification

| Property | Value            |
| -------- | ---------------- |
| Name     | Tokenized Euro   |
| Symbol   | `tEUR`           |
| Decimals | 2                |
| Backing  | 1:1 EUR reserves |

## Architecture

### Trust Zones

| Zone Type             | Prefix           | Description                    |
| --------------------- | ---------------- | ------------------------------ |
| ECB Core              | `ecb-core`       | Central settlement authority   |
| National Central Bank | `ncb-<country>`  | National node (e.g., `ncb-de`) |
| Commercial Bank       | `bank-<country>` | Commercial participant         |
| PSP                   | `psp-<region>`   | Payment service provider       |

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

| Environment | Name  | Purpose                          |
| ----------- | ----- | -------------------------------- |
| Local Lab   | `lab` | Single or multi-node development |
| Integration | `int` | Controlled shared testing        |
| Staging     | `stg` | Pre-production validation        |
| Production  | `prd` | Sovereign production             |

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
