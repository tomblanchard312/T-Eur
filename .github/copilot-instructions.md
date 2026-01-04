# tEUR — Copilot Instructions

You are an AI coding agent for the Tokenized Euro (tEUR) project. Follow these rules to ensure regulatory compliance (DORA, ISO 27001) and architectural integrity.

## Core Principles

- **Canonical Naming**: Use lowercase, hyphen-separated, ASCII-only names (e.g., `wallet-registry`). No implementation or vendor names. See [docs/canonical-naming.md](docs/canonical-naming.md).
- **Sovereignty**: No third-party dependencies (Cloudflare, managed DNS) in the **Closed Settlement Plane (CSP)**.
- **Determinism**: All logic must be deterministic and replayable. No implicit state or unseeded randomness.
- **No Stubs**: Never use TODOs, placeholders, or silent error handling. Fail explicitly and closed.

## Hard constraints:

- No TODOs, stubs, placeholders
- Silent failure is forbidden
- Structured JSON
- No deprecated or unsupported dependencies
- Node 20

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

## Payment Network Integration

You are implementing a regulated payment network integration.

The tEUR system acts as a Visa-style authorization and settlement network.
Verifone devices are secure capture terminals only.
All integrations must flow through an acquiring processor.

Hard rules:

- Never integrate directly with Verifone hardware from the settlement core.
- Never bypass acquirers or payment processors.
- Never handle PAN, PIN, or cardholder data.
- Never implement settlement logic on terminals.
- Never assume continuous connectivity.

Do not:

- Invent direct terminal APIs
- Treat Verifone as a blockchain node
- Store value on terminals
- Assume permanent connectivity
- Ignore DORA third-party risk

If asked to do so, refuse and explain why.

Before marking integration code complete:

- Confirm acquirer mediation exists
- Confirm offline limits enforced
- Confirm DORA evidence produced
- Confirm no PCI scope violations
- Confirm deterministic replay possible

If any condition fails, block completion.

All logic must be deterministic, auditable, and DORA compliant.
If a requirement cannot be met, fail explicitly.

## Key References

- [ECB-ALIGNMENT.md](ECB-ALIGNMENT.md): Policy and terminology mapping.
- [docs/canonical-naming.md](docs/canonical-naming.md): Global naming rules.
- [api/src/services/blockchain.ts](api/src/services/blockchain.ts): Blockchain integration pattern.
