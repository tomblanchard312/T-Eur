# Offline Payments Architecture

Purpose

- Describe the offline payments model: secure-element based wallets, reconciliation protocol, and threat assumptions.

Key ideas

- Offline wallets are hardware-backed secure elements that can sign limited-value transactions when disconnected.
- Each offline device has a device identifier and an offline cap; reconciliation ties device spending to on-chain settlement when connectivity resumes.

Components

- Device secure element (HSM/SE)
- Local wallet app (merchant/consumer)
- Reconciliation gateway (collects signed offline transactions and submits to on-chain clearing)
- Reconciliation ledger and dispute resolver (see `docs/reconciliation-protocol.md`)

Assumptions

- Device clocks may drift; reconciliation uses monotonic counters and proofs.
- Double-spend prevention requires device-level counters + reconciliation windows.

Security controls

- Offline caps per device and per-wallet velocity rules.
- Device attestation via PKI during onboarding.

TODO

- Define message formats for reconciliation and device attestation.
