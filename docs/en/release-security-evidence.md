# Release Security Evidence

A release candidate must attach reproducible evidence rather than relying on source comments or informal readiness claims.

## Required automated evidence

- Commit SHA and source tree reference
- Node.js, npm, Solidity compiler, and Foundry versions
- API dependency installation, TypeScript build, and test results
- Dashboard, SDK, and adapter build/test results
- Solidity formatting and compilation results
- Unit, fuzz, and invariant test results
- Contract bytecode sizes
- Dependency review or vulnerability report, recorded separately from build success
- Hashes of generated contract artifacts and deployment manifests

## Required manual evidence

- Threat model review with identified trust boundaries
- Role and key-custody review
- Deployment configuration review
- State and reserve reconciliation procedure
- Incident response and emergency-control exercise
- Independent smart-contract and API security assessment
- Formal release approval by designated owners

## Licensing

The repository root license applies to files explicitly marked `MIT` or without a more specific file-level declaration. Solidity files currently marked `UNLICENSED` are not covered by the MIT grant. A public release must either change those SPDX declarations to `MIT` with owner approval or clearly distribute the contracts under a separate documented license. CI and release notes must not describe the repository as uniformly MIT-licensed until that decision is completed.

## Production-ready designation

Passing CI is necessary but not sufficient. A release may only be described as production-ready after all automated and manual evidence above is attached to the release and independently reviewed.
