# DORA Article-by-Article AI Control Mapping
Project: tEUR Digital Euro Infrastructure
Scope: AI-assisted development governance for GitHub Copilot and similar coding assistants

This mapping explains how AI-assisted development is governed to support compliance with the EU Digital Operational Resilience Act (DORA).
It is written to be used as audit evidence alongside CI logs, SBOM artifacts, vulnerability scan reports, and policy documents.

## Evidence locations (typical)
- Copilot instructions: .github/copilot-instructions.md
- Copilot integrity workflow: .github/workflows/copilot-instructions-integrity.yml
- Dependency hygiene workflow: .github/workflows/dependency-hygiene.yml
- Supply chain compliance workflow: .github/workflows/supply-chain-and-compliance.yml
- Corruption visibility workflow: .github/workflows/corruption-visibility.yml
- SBOM artifacts: sbom.cdx.json, sbom.cdx.xml (CI artifacts)
- License report: licenses.json (CI artifacts)
- Dependency-Check reports: dependency-check-report/* (CI artifacts)

## Article 5: Governance and organisation
AI risk is governed by written instructions and enforced by CI. Copilot output is subject to the same review and CI controls as human code.
Controls:
- Version-controlled Copilot instruction file defining mandatory security and compliance constraints
- CI gate that fails builds if instructions are weakened or missing required anchors
Evidence:
- .github/copilot-instructions.md
- copilot-instructions-integrity.yml run results

## Article 6: ICT risk management framework
AI-assisted development is incorporated into the secure development lifecycle with technical controls that prevent non-compliant output from merging.
Controls:
- Secure SDLC requirements encoded in Copilot instructions
- Mandatory CI gates for dependencies, vulnerabilities, and auditability
Evidence:
- Copilot instructions
- Dependency hygiene, OWASP Dependency-Check, and corruption visibility CI logs

## Article 7: ICT systems, protocols, and tools
AI tooling is treated as an ICT tool that must not bypass security requirements.
Controls:
- Prohibition of deprecated dependencies and unsafe patterns
- Enforced Node runtime baseline
- Structured logging and explicit failure requirements
Evidence:
- dependency-hygiene.yml
- supply-chain-and-compliance.yml
- copilot-instructions-integrity.yml

## Article 8: Identification of ICT-related incidents and classification
AI-generated changes that introduce silent failures or audit gaps are prevented by policy and by corruption-injection tests.
Controls:
- Ban on silent catches and silent continues in validation flows
- Mandatory structured log events for rejected and corrupted inputs
- Batch summary event requirements
Evidence:
- corruption-visibility.yml
- corruption injection test results and artifacts

## Article 9: Protection and prevention
AI output is constrained to implement OWASP-aligned protections and safe operational defaults.
Controls:
- Input validation and unknown field rejection requirements
- Resource bounds requirements (no unbounded memory growth, bounded retries)
- Secure logging rules preventing data leakage
Evidence:
- Copilot instructions
- Static checks and unit tests
- npm audit and OWASP Dependency-Check reports

## Article 10: Detection
Detection is supported by structured, machine-parseable logs and mandatory summary events.
Controls:
- Structured JSON logging only
- Classification of rejections (WARN vs ERROR)
- Summary events per run
Evidence:
- Logging helper implementation
- CI tests verifying summary events and classification

## Article 11: Response and recovery
AI-generated code must support graceful degradation and controlled failure modes.
Controls:
- Threshold-based failure for integrity violations
- Explicit failure paths with documented errors
- No fail-open behavior
Evidence:
- Corruption injection tests (threshold breach scenarios)
- CI logs showing controlled failures

## Article 12: Backup and restoration
AI governance requires that backup and restore logic is not stubbed and is testable.
Controls:
- Prohibition of TODOs and stubs
- Requirement for deterministic artifacts (manifests) that support restoration verification
Evidence:
- Copilot instructions (no stubs)
- Manifest and provenance logic tests
Note:
- Operational backup execution is an infrastructure control; ensure separate runbooks and restore drills exist.

## Article 13: Learning and evolving
AI instructions and CI rules are updated through controlled change management, and regressions are prevented by tests.
Controls:
- Instruction integrity CI gate
- Regression tests for corruption visibility and dependency hygiene
Evidence:
- Git history for .github/copilot-instructions.md
- CI runs on PRs and main

## Article 14: Communication
AI-related development controls are documented for internal and external stakeholders.
Controls:
- Auditor explainer document for AI-assisted development
- Board-level governance summary
Evidence:
- docs/compliance/AI_Assisted_Development_Auditor_Explainer.md
- Board_Level_AI_Governance_Summary.md

## Article 15: ICT third-party risk management
AI tools and dependencies are treated as third-party risk. Dependencies are governed by SBOM, license allowlist, and vulnerability scanning.
Controls:
- SBOM generation and retention
- License allowlist enforcement
- OWASP Dependency-Check scanning
- Blocking deprecated packages
Evidence:
- supply-chain-and-compliance.yml artifacts
- dependency-hygiene.yml logs

## Article 16: Advanced third-party risk
Where third-party tools are used, operational reliance is limited and security monitoring is enforced.
Controls:
- No runtime dependency on third-party services for settlement or enforcement
- Strict boundaries between public and closed planes
Evidence:
- Architecture invariants documentation
- Network policies and infrastructure code

## Article 17: Information sharing arrangements
AI governance supports information sharing by producing standardized evidence artifacts.
Controls:
- SBOM and vulnerability scan artifacts
- Deterministic logs and manifests
Evidence:
- CI artifacts and retained reports

## Article 18: Testing of digital operational resilience
AI-generated code must include fault injection and corruption tests and must pass resilience CI pipelines.
Controls:
- Corruption injection test suite
- Threshold breach tests
- CI enforcement of non-silent corruption handling
Evidence:
- tests/corruption/*
- corruption-visibility.yml

## Article 19-23: ICT third-party oversight (where applicable)
AI tool use does not replace oversight requirements. Evidence artifacts support oversight and contractual controls.
Controls:
- SBOM and license reports support vendor and dependency assessment
- CI logs provide continuous evidence
Evidence:
- SBOM and license artifacts
- Dependency-Check reports

## Summary
AI-assisted development is governed by:
- Written, version-controlled constraints
- CI-enforced integrity of those constraints
- CI-enforced supply chain security
- CI-enforced corruption visibility and auditability
- Evidence artifacts suitable for regulators and auditors
