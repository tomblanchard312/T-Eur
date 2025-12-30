# ECB Alignment Matrix for tEUR Reference Architecture

This document maps the current tEUR design to publicly described Digital Euro objectives and implementation themes, and captures the specific design changes we discussed so the repo stays compatible with an EU scheme style approach.

This is written for a developer audience and for audit readability.

## 1. Source anchors (public)

Key public references used to align terminology and requirements:

- ECB Digital Euro FAQs (two tier distribution via supervised PSPs)  
  https://www.ecb.europa.eu/euro/digital_euro/faqs/html/ecb.faq_digital_euro.en.html

- ECB Digital Euro Privacy by design  
  https://www.ecb.europa.eu/euro/digital_euro/features/privacy/html/index.en.html

- ECB Preparation Phase Closing Report (scheme rulebook)  
  https://www.ecb.europa.eu/euro/digital_euro/progress/html/ecb.deprp202510.en.html

- European Commission Digital Euro and legal tender FAQs (includes holding limit discussion)  
  https://finance.ec.europa.eu/digital-finance/digital-euro/frequently-asked-questions-digital-euro-and-legal-tender-cash_en

- Council negotiating position coverage (online and offline functionality, holding caps, timeline signal)  
  https://www.reuters.com/business/finance/eu-council-backs-digital-euro-with-both-online-offline-functionality-2025-12-19/

## 2. Terminology mapping

To stay maximally compatible with ECB language:

- Prefer “Digital Euro scheme” wording for policy and participation docs.
- Use “tEUR” as the internal token engineering label and prototype artifact label.
- Use “intermediaries” for banks and supervised PSPs.
- Use “Eurosystem access gateway” as the concept name for the closed settlement plane entrypoint.

## 3. Alignment matrix

Legend:
- Aligned: matches direction
- Partial: aligns but requires additional constraints
- Divergent: needs a change

| Topic | ECB Digital Euro direction | Current tEUR design | Alignment | Required changes |
|---|---|---|---|---|
| Distribution model | Supervised PSPs distribute and service users | Banks and PSPs operate gateways and wallets | Aligned | Use “scheme participant” and onboarding controls in docs and code comments |
| Scheme rulebook | Single set of rules, standards, procedures | Canonical conventions plus governance coded rules | Aligned | Add explicit “Rulebook parameters” module and keep it provider agnostic |
| Privacy | Privacy by design, strong legal framework | Split horizon, data minimization, tiering | Partial | Add explicit offline privacy model and legal reference anchoring |
| Offline payments | Offline capability is core resilience feature | Planned as separate subsystem | Partial | Treat offline as secure element plus reconciliation protocol, not “offline blockchain” |
| Holding limits | Limits to protect financial stability and reduce run risk | Discussed as governance controlled policy | Partial | Implement holding limits as explicit policy parameters enforced at gateway and optionally on chain |
| Resilience | Works under outages | Closed settlement plane plus quorum | Aligned | Add chaos tests and runbooks to prove degraded modes |
| Monetary sovereignty | Reduce dependence on non EU payment rails | Zero third party critical path goal | Aligned | Explicitly prohibit CDN and managed DNS for settlement plane |
| Legal tender and acceptance | Wide acceptance objectives | Not yet modeled | Divergent | Add merchant acceptance and fees as scheme policy workstream, do not hard code |
| Sanctions and freezes | Enforced under legal framework | Freeze registry and scoped controls | Aligned | Freeze only, preserve ownership, reversible, auditable |
| Confiscation | Court or statute based, exceptional | Escrow based model | Aligned | Require escrow with appeal window and higher governance threshold |

## 4. Changes we discussed that must be applied

### 4.1 Infrastructure and sovereignty changes

1) No third party critical dependencies  
- No Cloudflare DNS or edge services for settlement plane.  
- Public access plane may use public internet protections, but settlement plane must not.

2) Closed settlement plane plus public access plane separation  
- CSP: interbank settlement, validator connectivity, internal DNS.  
- PAP: consumer and merchant access, public APIs, portals.

3) Terraform first, open source infrastructure  
- All core infrastructure modules are open source and provider agnostic.  
- One Terraform state per zone.  
- No cloud vendor specific managed dependencies as defaults.

### 4.2 Governance and regulatory change changes

4) Encode process, not politics  
- No hard coded country lists.  
- Membership is role based and governance controlled.  
- Add and remove participants through governance actions with audit events.

5) Membership churn and union changes  
- Support new member states joining without redeploy.  
- Support member state exit with phased disengagement: notice, permission suspension, validator removal, unwind.

### 4.3 Sanctions and confiscation changes

6) Sanctions are freezes only  
- Freeze blocks transfer and redemption.  
- Freeze does not move balances.  
- Freeze is reversible and reviewable.

7) Confiscation is court ordered and escrow based  
- Requires explicit legal basis reference.  
- Requires higher governance threshold than freezing.  
- Funds move only to court controlled escrow, not to end beneficiaries directly.  
- Escrow supports appeal windows and auditable releases.

## 5. Implementation workstreams

### 5.1 Scheme and rulebook workstream

Deliverables:
- `docs/rulebook-parameters.md`
- `docs/participant-onboarding.md`
- `docs/merchant-acceptance.md`
- `docs/fees-and-limits.md`

Constraints:
- All parameters must be changeable by governance.  
- No redeploy required for policy updates.

### 5.2 Offline workstream

Deliverables:
- `docs/offline-payments-architecture.md`
- `docs/offline-risk-limits.md`
- `docs/reconciliation-protocol.md`

Key decisions:
- Secure element based offline wallet model
- Double spend controls via hardware plus reconciliation
- Offline caps and velocity controls as policy parameters

### 5.3 Ledger and contract workstream

Deliverables:
- `contracts/` canonical layout
- Governance controlled permissioning
- Sanctions registry and confiscation escrow

Constraints:
- Single responsibility contracts
- Explicit upgrade governance
- Immutable audit events for all sensitive actions

### 5.4 Resilience and testing workstream

Deliverables:
- `docs/degraded-modes.md`
- `docs/runbooks/` for zone isolation, quorum degradation, DNS failure
- `tests/chaos/` scripts to simulate partitions and recovery

Success criteria:
- Settlement continues with quorum despite one zone loss
- Authorization can operate in bounded degraded mode when settlement is delayed
- Reconciliation completes with idempotency and no double spend

## 6. Repository policy hooks

Recommended repo files:

- `.github/copilot-instructions.md`  
- `docs/canonical-naming-and-copilot-instructions.md`  
- `docs/ECB-ALIGNMENT.md` (this file)  
- `docs/INVARIANTS.md` (safety properties)  
- `CODEOWNERS` (governance, contracts, infra separated)  

## 7. Non negotiable invariants (summary)

- No silent balance changes  
- No unilateral minting  
- No unilateral freezing  
- No confiscation without court or statute reference  
- No direct redistribution without escrow  
- No public internet dependency for settlement plane  
- No hard coded country lists in contracts

## 8. Next actions

1) Implement explicit holding limit policy parameters and enforcement points.  
2) Draft the offline subsystem design documents and risk limits.  
3) Draft governance role registry and voting thresholds as code plus docs.  
4) Add chaos tests for DNS, link, and zone failures.

