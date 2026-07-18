# Security Remediation Plan

## Objective

Reduce the highest-risk failure modes identified during the static review while preserving the repository's role as a research and reference implementation.

## Phase 1: configuration and identity hardening

Status: implemented.

- Fail closed in staging and production when blockchain endpoints, contract addresses, operator keys, or JWT settings are missing.
- Permit local placeholder values only in development and test.
- Disable demo identities by default and reject them outside development and test.
- Reject wildcard CORS outside development and test.
- Validate JWT issuer, audience, algorithm, identity, permissions, and governance key identifier.
- Sign API-key requests with HMAC-SHA256, timestamp, nonce, method, path, and body digest.

## Phase 2: API exposure and runtime hardening

Status: implemented in PR #53, except institutional mTLS tracked by issue #59.

- Deployment-specific proxy trust.
- Explicit API documentation enablement.
- Reduced operational CSP allowances when documentation is disabled.
- Sanitized provider errors and rulebook logging.
- Bounded graceful HTTP shutdown.
- Request-signature replay protection.
- Institutional mTLS requires deployment PKI and certificate identity decisions before implementation.

## Phase 3: contract accounting and governance

Status: accounting hardening in PR #54; governed permissioning in PR #55; versioned protocol migrations tracked by issues #57 and #58.

- Prevent active escrow records from being overwritten.
- Keep escrow records and totals synchronized.
- Add zero-value, zero-address, and expiry validation.
- Add a dual-control governed permissioning replacement with expiring proposals.
- Unique escrow cases, explicit lifecycle states, opaque case references, scoped idempotency, and contract decomposition require a versioned protocol deployment.

## Phase 4: dependency, test, and release assurance

Status: implemented in PR #56, subject to CI and review.

- Add Foundry format, build, unit, fuzz, and invariant validation.
- Add supply and escrow conservation invariants.
- Add API tests proving staging and production fail closed.
- Remove broad API transitive dependency overrides.
- Scope package workflows to relevant paths.
- Document reproducible release evidence and the current file-level licensing distinction.

## Open protocol migrations

- Issue #57: unique escrow cases and explicit lifecycle.
- Issue #58: decompose token accounting and control modules, including scoped idempotency.
- Issue #59: institutional mTLS identity for privileged API routes.

## Release criteria

A release may be described as production-ready only after all required controls are merged, deployment-specific migrations are completed, tests pass, threat-model and deployment reviews are complete, licensing is approved, and an independent security assessment has been performed.
