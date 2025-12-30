# Tokenized Euro (tEUR) Canonical Naming Conventions and GitHub Copilot Instructions

This document defines **authoritative naming conventions** and **GitHub Copilot instruction rules** for the Tokenized Euro (tEUR) project.

These conventions are designed to:
- Support sovereign EU deployment
- Avoid vendor lock-in
- Enable clean migration from local lab to sovereign cloud
- Ensure regulatory readability
- Prevent architectural drift

---

## 1. Global Naming Principles

These rules apply everywhere.

1. Names must be:
   - Lowercase
   - Hyphen-separated
   - ASCII only

2. Names must encode **function**, not implementation.

3. Names must remain valid across:
   - Local lab
   - Private datacenter
   - EU sovereign cloud

4. No cloud vendor names in identifiers.

5. No personal names.

6. No region-specific shortcuts like `prod1`, `eu1`, `west` unless explicitly defined.

---

## 2. Environment Naming

| Environment | Name | Purpose |
|-----------|------|--------|
| Local Lab | `lab` | Single or multi-node development |
| Integration | `int` | Controlled shared testing |
| Staging | `stg` | Pre-production validation |
| Production | `prd` | Sovereign production |

Example:
```
env = "lab"
```

---

## 3. Zone and Domain Naming

Zones represent **failure domains**, not geography shortcuts.

| Zone Type | Canonical Prefix | Example |
|---------|-----------------|--------|
| ECB Core | `ecb-core` | `ecb-core-01` |
| National Central Bank | `ncb` | `ncb-de-01` |
| Commercial Bank | `bank` | `bank-fr-a` |
| PSP | `psp` | `psp-eu-01` |

Rules:
- Numeric suffixes represent redundancy
- Alphabetic suffixes represent peer roles

---

## 4. Kubernetes Naming Conventions

### 4.1 Namespaces

Namespaces map directly to trust boundaries.

```
<layer>-<zone>
```

Examples:
```
ledger-ecb-core
ledger-ncb-de
routing-bank-fr
identity-psp-eu
obs-global
```

### 4.2 Deployments

```
<service>-<role>
```

Examples:
```
besu-validator
routing-gateway
identity-bridge
dns-authoritative
dns-resolver
```

### 4.3 Pods

Pods inherit deployment names. Do not override.

---

## 5. DNS Naming

### 5.1 Split-Horizon Model

Two DNS realms exist.

| Realm | Purpose | Visibility |
|-----|-------|-----------|
| CSP | Settlement plane | Closed network only |
| PAP | Public access | Internet-facing |

### 5.2 CSP DNS Naming

```
<service>.<zone>.csp.eu.int
```

Examples:
```
ledger.ecb-core.csp.eu.int
ledger.ncb-de.csp.eu.int
gateway.bank-fr.csp.eu.int
```

Rules:
- `.csp.eu.int` never resolves on public DNS
- All CSP zones are DNSSEC signed

### 5.3 PAP DNS Naming

```
<service>.teuro.eu
```

Examples:
```
api.teuro.eu
status.teuro.eu
docs.teuro.eu
```

PAP outages must never affect CSP resolution.

---

## 6. Terraform Naming Conventions

### 6.1 Module Names

```
modules/<functional-area>
```

Examples:
```
modules/dns-authoritative
modules/dns-resolver
modules/ledger-node
modules/routing-gateway
modules/pki-root
modules/pki-intermediate
```

### 6.2 Environment Layout

```
envs/<env>/<zone>
```

Example:
```
envs/lab/ecb-core
envs/lab/ncb-de
envs/lab/bank-fr
```

### 6.3 Terraform State

- One state file per zone
- Never shared across zones
- Remote backends only in production

---

## 7. Ledger and Token Naming

### 7.1 Token Naming

| Item | Value |
|----|------|
| Token name | Tokenized Euro |
| Symbol | `tEUR` |
| Decimals | 2 |
| Backing | 1:1 EUR reserves |

### 7.2 Smart Contracts

```
<functionality>-contract
```

Examples:
```
issuance-contract
permissioning-contract
settlement-finality-contract
emergency-controls-contract
```

No business logic inside infrastructure modules.

---

## 8. Logging and Observability Naming

### 8.1 Log Streams

```
<service>.<zone>.<severity>
```

Examples:
```
ledger.ecb-core.info
ledger.ncb-de.error
dns.auth.warn
```

### 8.2 Metrics

Use Prometheus conventions.

```
teur_<subsystem>_<metric>
```

Example:
```
teur_ledger_finality_seconds
teur_dns_query_failures_total
teur_quorum_active_zones
```

---

## 9. GitHub Copilot Canonical Instructions

This section must be copied into `.github/copilot-instructions.md`.

### 9.1 System Role

You are GitHub Copilot operating inside a **sovereign EU financial infrastructure project**.

### 9.2 Absolute Rules

You must:
- Follow canonical naming exactly
- Assume partial network failure at all times
- Prefer deterministic behavior over convenience
- Avoid cloud vendor specific features
- Avoid managed services unless explicitly requested
- Produce code that runs locally and in sovereign cloud unchanged

You must not:
- Introduce Cloudflare, AWS-specific, Azure-specific, or GCP-specific dependencies
- Introduce public DNS dependencies for settlement components
- Collapse trust boundaries for convenience
- Add silent defaults that affect monetary behavior

### 9.3 Architecture Assumptions

Always assume:
- DNS may partially fail
- One zone may be offline
- One country may be partitioned
- Authorization may proceed while settlement is delayed

### 9.4 Code Generation Guidance

When generating code:
- Prefer explicit configuration over magic
- Include health checks
- Include idempotency keys for all transactions
- Use clear failure modes
- Separate authorization from settlement logic

### 9.5 Terraform Guidance

Terraform code must:
- Be provider-agnostic
- Use modules
- Avoid implicit dependencies
- Declare all variables explicitly
- Support multiple replicas and zones

### 9.6 Kubernetes Guidance

Kubernetes manifests must:
- Use anti-affinity rules
- Use PodDisruptionBudgets
- Avoid single-replica critical services
- Never assume managed load balancers

### 9.7 Security Guidance

- All internal communication uses mTLS
- Keys never appear in plaintext
- Secrets are mounted, not embedded
- Auditability is mandatory

### 9.8 Output Expectations

Generated output must:
- Be readable by regulators
- Be explainable without tribal knowledge
- Fail safely
- Prefer correctness over brevity

---

## 10. Change Control

Any change to these conventions requires:
- Explicit documentation update
- Architecture review
- Agreement across zones

Silent drift is not allowed.

---

## End of Document
