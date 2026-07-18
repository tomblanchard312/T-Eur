# Security Remediation Plan

## Objective

Reduce the highest-risk failure modes identified during the static review while preserving the repository's role as a research and reference implementation.

## Phase 1: configuration and identity hardening

Status: implemented in this branch.

- Fail closed in staging and production when blockchain endpoints, contract addresses, operator keys, or JWT settings are missing.
- Permit local placeholder values only in development and test.
- Disable demo identities by default. Tests may enable them automatically, and local development requires an explicit opt-in.
- Reject demo identities outside development and test.
- Reject wildcard CORS outside development and test.
- Add explicit JWT issuer, audience, and algorithm validation.
- Preserve the governance key identifier in JWT-authenticated requests when provided.
- Remove unused authentication imports and stop silently swallowing demo governance-registration failures.

## Phase 2: API exposure and runtime hardening

Status: planned next.

- Make proxy trust deployment-specific.
- Disable API documentation outside explicitly enabled environments.
- remove inline script allowances or isolate Swagger UI from the operational API.
- Log only rulebook version and hash outside local development.
- Sanitize provider errors.
- Implement bounded graceful shutdown for HTTP, audit, and blockchain resources.
- Add mTLS identity enforcement for privileged routes.

## Phase 3: contract accounting and governance

Status: requires protocol-level review before implementation.

- Replace the single escrow record per account with uniquely identified escrow cases.
- Define explicit escrow lifecycle states and expiry disposition.
- Add zero-value and zero-address validation consistently.
- Scope idempotency keys to operation type, actor, target, and amount.
- Replace unilateral role mutation with proposals, quorum, dual control, and role-specific grant authority.
- Store opaque case references and document hashes on-chain rather than legal or sanctions text.
- Separate token accounting, sanctions, escrow, holding policy, and emergency governance into narrower contracts.

## Phase 4: dependency, test, and release assurance

Status: planned.

- Consolidate JavaScript tooling under a single workspace-compatible toolchain.
- Remove broad transitive dependency overrides unless compatibility is demonstrated.
- Reconcile repository, package, and Solidity license declarations.
- Add Foundry invariant tests and fuzzing for supply, escrow, waterfall, freeze, and role invariants.
- Add API tests proving staging and production fail closed.
- Add security scanning and release evidence instead of source-code production-readiness claims.

## Release criteria

A release may be described as production-ready only after all required controls are implemented and supported by reproducible evidence, including passing tests, threat-model review, deployment validation, dependency scanning, and an independent security assessment.
