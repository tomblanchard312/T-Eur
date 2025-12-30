# Merchant Acceptance

Purpose

- Define merchant onboarding, acceptance criteria, and how merchant roles interact with fees and limits.

Scope

- Merchant KYC, settlement routing preferences, revenue/cost model integration.

Acceptance rules

- Merchant must provide legal/business registration and a merchant account link to a supervised PSP or bank.
- Default merchant holding limit differs from individuals (see `docs/fees-and-limits.md`).
- Merchant may opt into instant settlement routes (subject to PSP rules).

Integration notes

- Merchant acceptance is enforced at gateway level; see `api/routes/wallets.ts` and `api/services/blockchain.ts` for registration patterns.

Monitoring

- Transactions flagged for merchant risk feed into observability (`prometheus` metrics and `logs/`).

TODO

- Add example merchant onboarding curl commands and test vectors.
