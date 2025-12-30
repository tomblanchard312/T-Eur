# tEUR — Copilot instructions (concise)

You are an AI code assistant working on the Tokenized Euro (tEUR) repository. Follow the project's safety and naming rules, then prefer concrete, minimal, and auditable changes.

Core rules

- Follow canonical naming: lowercase, hyphen-separated, ASCII-only. See [docs/canonical-naming-and-copilot-instructions.md](docs/canonical-naming-and-copilot-instructions.md).
- Assume partial network failure and design for deterministic behavior across zones.
- Do not introduce cloud-vendor or managed services as defaults for settlement (CSP). No public DNS dependence for CSP.
- All internal communication must use mTLS; never store keys in plaintext in repo.

Big picture (what to know quickly)

- Major components: `contracts/` (Solidity + Foundry), `api/` (TypeScript REST gateway), `dashboard/` (frontend), `modules/` (Terraform modules), `envs/` (per-environment terraform overlays), `k8s/` (manifests).
- Separation: CSP (closed settlement plane) vs PAP (public access plane). Refer to DNS conventions in [README.md](README.md) and canonical naming doc.

Concrete developer workflows (commands you can use/mention)

- Smart contracts (Foundry):
  - Install: `cd contracts && forge install` — see [contracts/README.md](contracts/README.md).
  - Build: `cd contracts && forge build`
  - Test: `cd contracts && forge test`
  - Local deploy (anvil): start `anvil` then `forge script script/DeployDigitalEuro.s.sol:DeployLabEnvironment --rpc-url http://localhost:8545 --broadcast`
- API service (Node/TS):
  - Dev: `cd api && npm install && npm run dev` (runs `tsx watch src/index.ts`)
  - Build: `cd api && npm run build`
  - Test: `cd api && npm run test` (Vitest)
  - Key env vars: `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_OPERATOR_PRIVATE_KEY`, `CONTRACT_*` (see `api/src/config/index.ts`).
- Infrastructure (Terraform):
  - Per-zone state: `cd envs/lab/ecb-core && terraform init && terraform plan && terraform apply` (one state per zone is required).

Project-specific conventions and patterns

- Token uses 2 decimals (cents) — `TokenizedEuro` in `contracts/src/TokenizedEuro.sol`.
- Wallet types, roles, and contract address wiring are configured via env vars consumed by `api/src/config/index.ts` and used by `api/src/services/blockchain.ts`.
- Services call minimal ABIs inside `api/src/services/blockchain.ts` — prefer editing ABI fragments there (not full ABIs) when adding supported RPC calls.
- Error handling: parse common revert reasons (see `blockchain.ts` executeTransaction() patterns) — preserve those user-facing error mappings.

Integration points and examples

- API <> blockchain: `api` reads `BLOCKCHAIN_RPC_URL` and `CONTRACT_*` env vars; it instantiates ethers `JsonRpcProvider` and Wallet in `api/src/services/blockchain.ts`.
- Example mint (from contracts docs):
  - `cast send $TEUR_ADDRESS "mint(address,uint256,bytes32)" $USER_ADDRESS 10000 $(cast keccak256 "unique-key-1")`

What to avoid changing

- Do not add silent defaults that change monetary behavior (limits, minting, freezes).
- Do not change DNS or terraform defaults that introduce public resolvers for CSP.

Helpful file references

- API gateway entry: [api/src/index.ts](api/src/index.ts#L1)
- Blockchain service: [api/src/services/blockchain.ts](api/src/services/blockchain.ts#L1)
- Config schema (env names): [api/src/config/index.ts](api/src/config/index.ts#L1)
- Contracts README and scripts: [contracts/README.md](contracts/README.md)
- Canonical naming & copilot rules: [docs/canonical-naming-and-copilot-instructions.md](docs/canonical-naming-and-copilot-instructions.md)
- Architecture alignment: [ECB-ALIGNMENT.md](ECB-ALIGNMENT.md)

Foundry / forge-std

- The contracts depend on `foundry-rs/forge-std`. The repo includes a vendored copy at `contracts/lib/forge-std`.
- Preferred upstream tag/branch used in tooling: `v1.12.0` (foundry-rs/forge-std@v1.12.0). When updating, pin the tag in `lib` or use `forge install foundry-rs/forge-std@v1.12.0 --no-commit` to avoid drifting.

If uncertain, ask a precise question: cite the file and line range you examined, propose one small patch, and request review from the repository maintainers.

End of concise guidance.

**ECB Alignment**

This repository follows the `ECB-ALIGNMENT.md` policy. Include these rules in any code or infra changes and reference the file for full details: [ECB-ALIGNMENT.md](ECB-ALIGNMENT.md).

1. Source anchors (public)

- Refer to the ECB Digital Euro FAQs, Privacy by Design page, Preparation Phase Closing Report, and European Commission FAQs when making policy decisions. (Links in `ECB-ALIGNMENT.md`.)

2. Terminology mapping

- Use "Digital Euro scheme" for policy, `tEUR` for the token, "intermediaries" for banks/PSPs, and "Eurosystem access gateway" for CSP entrypoints.

3. Key alignment constraints (apply these strictly)

- Distribution: Supervised PSPs and banks are scheme participants — don't hardcode country lists.
- Privacy: Preserve split-horizon and data minimization; add offline privacy anchoring when implementing offline features.
- Offline payments: Treat offline as secure-element plus reconciliation; do not model as "offline blockchain".
- Holding limits: Implement as explicit, governance-controlled policy parameters enforced at gateways (and optionally on-chain).
- Resilience: Design for quorum-based settlement; include chaos tests and runbooks for degraded modes.
- Sovereignty: Prohibit CDNs and managed public DNS for CSP; PAP can use public protections.
- Sanctions/Confiscation: Sanctions = freezes only; confiscation requires court/escrow and higher governance thresholds.

4. Changes to apply (infrastructure & governance)

- No third-party critical dependencies for CSP (no Cloudflare/managed DNS for settlement plane).
- Enforce CSP vs PAP separation in infra, DNS, and deployment manifests.
- Terraform-first, provider-agnostic modules under `modules/`; one Terraform state per zone.
- Membership and governance: role-based onboarding, governance-controlled parameter updates, and audit events for changes.

5. Sanctions & confiscation rules (implementation hints)

- Freeze: block transfer/redemption, reversible, auditable; do not move balances.
- Confiscation: court ordered, escrow-based, requires appeal window and audit trail.

6. Implementation workstreams (deliverables you may be asked to modify)

- Scheme & rulebook: `docs/rulebook-parameters.md`, `docs/participant-onboarding.md`, `docs/merchant-acceptance.md`, `docs/fees-and-limits.md`.
- Offline: `docs/offline-payments-architecture.md`, `docs/offline-risk-limits.md`, `docs/reconciliation-protocol.md`.
- Ledger & contracts: governance-permissioning, sanctions registry, confiscation escrow in `contracts/`.
- Resilience & testing: `docs/degraded-modes.md`, `docs/runbooks/`, and `tests/chaos/`.

7. Repository policy hooks (required files)

- Ensure these exist and stay updated: `.github/copilot-instructions.md`, `docs/canonical-naming-and-copilot-instructions.md`, `docs/ECB-ALIGNMENT.md`, `docs/INVARIANTS.md`, `CODEOWNERS`.

8. Non-negotiable invariants (always enforce)

- No silent balance changes, no unilateral minting/freezing, no confiscation without court/statute, no public internet dependency for CSP, no hard-coded country lists in contracts.

9. Next actions (short-term priorities)

- Implement holding limit policy parameters and enforcement points.
- Draft offline subsystem design and risk limits.
- Draft governance role registry and voting thresholds as code + docs.
- Add chaos tests for DNS/link/zone failures.

Refer to `ECB-ALIGNMENT.md` for precise wording and legal references when implementing policy or security controls.
