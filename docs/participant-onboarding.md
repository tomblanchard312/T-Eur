# Participant Onboarding

Purpose

- Describe the role-based onboarding flow for scheme participants (NCBs, banks, PSPs, merchants).

Scope

- Admission criteria, KYC/KYB artifacts, role assignment, multisig keys, permissioning handoff.

Flow (high level)

1. Applicant submits governance request with legal docs and technical contact.
2. Governance review and provisional approval (timeboxed).
3. Technical onboarding: allocate zone identifiers, issue certificates (PKI), configure DNS (CSP vs PAP), and deploy gateway manifests.
4. Assign roles in `Permissioning` contract (see `contracts/Permissioning.sol`).
5. Audit event published to central ledger and governance log.

Required artifacts

- Legal entity data
- PKI CSR for node certificates
- Contact/operational runbook
- Test vectors for connectivity and transaction signing

Security & constraints

- Never hard-code country lists in onboarding code.
- All key material provisioned via PKI modules in `modules/pki-root` and `modules/pki-intermediate`.

Acceptance criteria

- Participant is reachable on CSP namespace and can submit test transactions.
- Audit logs for admission exist.

TODO

- Add example API calls and scripts for automated onboarding.
