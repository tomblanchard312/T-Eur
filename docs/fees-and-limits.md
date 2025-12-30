# Fees and Limits

Purpose

- Document configurable fees and holding limits and how they're applied across participant types.

Scope

- Transfer fees, settlement fees, merchant fees, and default holding limits.

Defaults (examples)

- `holding_limit_individual`: €3,000.00 (300000 cents)
- `holding_limit_merchant`: €30,000.00 (3000000 cents)
- `fee_transfer_basis_points`: 5 (0.05%)

Where configured

- Parameters are defined in `docs/rulebook-parameters.md` and consumed by gateways (`api/src/config/index.ts`).
- On-chain enforcement points live in `contracts/WalletRegistry.sol` and `contracts/TokenizedEuro.sol` where applicable.

Change control

- Any change to fees or limits requires documented governance approval and an audit trail.
- Rolling changes should be applied with a governance `effective_at` timestamp to avoid silent changes.

TODO

- Add machine-readable parameter manifest and sample overrides per environment (`envs/*`).
