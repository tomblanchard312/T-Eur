# Board-Level Summary of AI Governance
Project: tEUR Digital Euro Infrastructure

## Purpose
This summary explains how AI-assisted development is governed to reduce operational, security, and compliance risk under DORA and ISO 27001.

## Key statement
AI tooling is permitted only as a productivity aid. It cannot bypass security controls. Compliance is enforced by technical controls and continuous evidence.

## Governance model
1. Policy by construction
   - The repository contains a mandatory Copilot instruction file that defines non-negotiable security and resilience constraints.
   - AI-generated code must follow the same rules as human-written code.

2. Continuous enforcement
   - CI pipelines block deprecated dependencies, insecure licenses, and high-severity vulnerabilities.
   - CI pipelines enforce structured logging, corruption visibility, and determinism requirements.
   - A dedicated CI gate enforces the integrity of the Copilot instruction file itself.

3. Evidence-first compliance
   - Each build produces artifacts used for audit and regulatory evidence, including:
     - SBOMs (CycloneDX)
     - License inventory and allowlist enforcement results
     - OWASP Dependency-Check vulnerability reports
     - Test results proving corruption is never silent

4. Controlled change management
   - Changes to AI instructions are version-controlled and should be protected by branch protection and CODEOWNERS review.
   - Material changes require security review and re-validation via CI.

## Risk controls in plain language
- Dependency risk: Reduced via SBOM generation, vulnerability scanning, and deprecated package blocking.
- Silent failure risk: Reduced via corruption-injection tests and mandatory structured logging.
- Operational resilience: Improved via bounded retries, explicit failure thresholds, and deterministic manifests.
- Third-party reliance: Settlement and enforcement components do not depend on external third-party services.

## What the board should expect to see
- CI status must be green for merges to main.
- Quarterly reporting includes:
  - Vulnerability posture trends and remediation SLAs
  - SBOM retention and review confirmation
  - Evidence that AI instruction integrity gates are active and enforced
  - Results of resilience tests and incident drills

## Limits and disclaimers
No system can claim absolute security. The governance approach is designed to provide demonstrable, continuously enforced controls and objective evidence suitable for regulators and auditors.

## Decision request
Approve the policy that AI-assisted development is allowed only when:
- The Copilot instruction integrity gate is mandatory
- Dependency hygiene, SBOM, license, and vulnerability scanning are mandatory
- Corruption visibility testing is mandatory
- Security review is required for material changes

Recommended approval frequency: Annual, and upon material change.
