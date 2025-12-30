# Rulebook Parameters

Purpose

- Define the canonical, governance-controlled parameters that implement the scheme rulebook.

Scope

- Parameters that affect monetary behavior, AML/KYC gates, holding limits, offline caps, fees, and upgrade windows.

Key parameters (examples)

- `holding_limit_individual` (cents)
- `holding_limit_merchant` (cents)
- `offline_cap_per_device` (cents)
- `transfer_velocity_limit_window_seconds`
- `transfer_velocity_limit_max_amount` (cents)
- `fee_default_transfer_basis_points`
- `governance_change_delay_seconds`

Governance & change process

- All parameter changes must be recorded as governance proposals with an explicit approval window.
- Parameters are applied without redeploy when possible (feature flag + config overlay);
  otherwise require explicit migration steps documented in `envs/` overlays.

APIs and binding points

- Gateways and validators read parameters from a single trusted config store.
- Examples in repo: `api/src/config/index.ts` (env-driven), `contracts/` for on-chain limits.

Acceptance criteria

- Parameter updates are auditable with change metadata (who, when, reason).
- No silent parameter defaults that change monetary invariants.

TODO

- Add canonical names and types for all parameters.
- Wire examples into `api` and `contracts` test fixtures.
