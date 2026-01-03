# tEUR — Copilot Instructions

You are an AI coding agent for the Tokenized Euro (tEUR) project. Follow these rules to ensure regulatory compliance (DORA, ISO 27001) and architectural integrity.

## Core Principles

- **Canonical Naming**: Use lowercase, hyphen-separated, ASCII-only names (e.g., `wallet-registry`). No implementation or vendor names. See [docs/canonical-naming.md](docs/canonical-naming.md).
- **Sovereignty**: No third-party dependencies (Cloudflare, managed DNS) in the **Closed Settlement Plane (CSP)**.
- **Determinism**: All logic must be deterministic and replayable. No implicit state or unseeded randomness.
- **No Stubs**: Never use TODOs, placeholders, or silent error handling. Fail explicitly and closed.

## Architecture & Components

- **CSP vs PAP**: Separate the **Closed Settlement Plane** (interbank, validators) from the **Public Access Plane** (APIs, portals).
- **Components**:
  - `contracts/`: Solidity/Foundry (2 decimals/cents).
  - `api/`: Node.js/TS gateway.
  - `modules/`: Provider-agnostic Terraform.
  - `envs/`: Per-zone Terraform overlays (one state per zone).

## Critical Workflows

- **Smart Contracts**: `cd contracts && forge build` | `forge test`.
- **API Service**: `cd api && npm run dev` | `npm run test` (Vitest).
- **Data Ingestion**: `node api/bin/ecb-ingest.js` (Pulls ECB reference data).
- **Infra**: `terraform init && terraform apply` within `envs/lab/`.

## Implementation Patterns

- **Minimal ABIs**: In [api/src/services/blockchain.ts](api/src/services/blockchain.ts), use minimal string ABIs for contract interactions.
- **Structured Logging**: Use `logger.logAuditEvent` or `logger.info` with JSON objects. Never log PII, secrets, or raw payloads.
- **Error Handling**: Map blockchain reverts to user-facing errors in `blockchain.ts`.
- **ECB Data**: Treat as informational only. Never make settlement dependent on external ECB APIs. Use internal mirroring.

## ECB Alignment

- **Terminology**: Use "Digital Euro scheme", "tEUR", "intermediaries" (banks/PSPs), and "Eurosystem access gateway".
- **Sanctions**: Implement as **freezes only** (block transfers, preserve balances).
- **Confiscation**: Requires court order, escrow, and high governance threshold.

## Key References

- [ECB-ALIGNMENT.md](ECB-ALIGNMENT.md): Policy and terminology mapping.
- [docs/canonical-naming.md](docs/canonical-naming.md): Global naming rules.
- [api/src/services/blockchain.ts](api/src/services/blockchain.ts): Blockchain integration pattern.
