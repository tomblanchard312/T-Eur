# Central Bank Technical Annex: tEUR Acquirer API v1.1

## Document Information

**Version:** 1.1.0  
**Date:** January 3, 2026  
**Classification:** Official - Restricted  
**Prepared by:** tEUR Infrastructure Team  
**Reviewed by:** Eurosystem Oversight Committee

## Executive Summary

This technical annex provides a comprehensive overview of the tEUR (Tokenized Euro) Acquirer API v1.1, designed for integration with the Eurosystem's Digital Euro scheme. The API facilitates secure, compliant, and deterministic transaction processing within the Closed Settlement Plane (CSP), ensuring alignment with DORA (Digital Operational Resilience Act) requirements, ISO 20022 standards, and ECB regulatory frameworks.

The annex defines system actors, trust boundaries, settlement finality semantics, offline transaction models, evidence artifacts, onboarding procedures, and certification methodologies required for regulatory approval and operational deployment.

## System Overview

The tEUR network implements a tokenized euro system compliant with the Eurosystem's Digital Euro scheme. The Acquirer API v1.1 serves as the primary interface for authorized intermediaries (banks and Payment Service Providers) to submit transaction authorizations, captures, reversals, refunds, and offline advice within the Closed Settlement Plane.

### Key Principles

- **Sovereignty:** All settlement logic resides within the CSP with no third-party dependencies.
- **Determinism:** All API responses are deterministic and replayable for audit and reconciliation purposes.
- **Finality:** Settlement finality is achieved at batch close, with interbank clearing confirmation.
- **Compliance:** Full alignment with DORA third-party risk management and ISO 20022 messaging standards.

## Actors and Roles

### Primary Actors

1. **Eurosystem Access Gateway**

   - Central authority for tEUR issuance and redemption
   - Manages CSP infrastructure and validator nodes
   - Issues cryptographic keys and certificates for CSP access

2. **Intermediaries (Banks/PSPs)**

   - Authorized financial institutions participating in the tEUR scheme
   - Operate acquirer processors for merchant transaction processing
   - Maintain CSP connectivity via mTLS certificates

3. **Acquirers/Processors**

   - Technical systems operated by intermediaries
   - Submit transaction requests via the Acquirer API
   - Implement offline transaction processing with defined limits

4. **Merchants**

   - Commercial entities accepting tEUR payments
   - Utilize secure terminals (e.g., Verifone) for transaction initiation
   - Do not directly access CSP; all transactions flow through acquirers

5. **Payers**
   - End users holding tEUR wallets
   - Interact through Public Access Plane (PAP) applications
   - Wallets generate offline-capable tokens for secure transactions

### Supporting Roles

- **Validators:** Maintain distributed ledger for settlement finality
- **Auditors:** Independent verification of transaction logs and evidence
- **Regulators:** Oversight and compliance monitoring

## Trust Boundaries

### Closed Settlement Plane (CSP)

The CSP represents the secure, sovereign environment for all settlement operations:

- **Access Control:** Mutual TLS (mTLS) with Eurosystem-issued certificates
- **Cryptography:** Detached JWS signatures over canonical JSON payloads
- **Connectivity:** Private, monitored network connections only
- **Dependencies:** No external third-party services permitted
- **Logging:** Structured audit events with no sensitive data exposure

### Public Access Plane (PAP)

The PAP handles user-facing operations outside the CSP:

- **User Interfaces:** Wallet applications and merchant portals
- **Public APIs:** Non-settlement operations (balance queries, etc.)
- **Third-Party Integration:** Allowed for user experience enhancement
- **Offline Support:** Token generation for disconnected transactions

### Boundary Controls

- **Data Flow:** PAP data may inform CSP decisions but cannot influence settlement logic
- **Key Management:** CSP keys never exposed to PAP systems
- **Audit Separation:** Distinct logging and monitoring for each plane

## Technical Architecture

### API Endpoints (v1.1)

The Acquirer API v1.1 exposes the following endpoints within the CSP:

#### Transaction Processing

- `POST /v1/transactions/authorize` - Request payment authorization
- `POST /v1/transactions/{txn_id}/capture` - Finalize authorized transaction for settlement
- `POST /v1/transactions/{txn_id}/reverse` - Cancel authorization prior to capture
- `POST /v1/transactions/{txn_id}/refund` - Process refund against captured transaction

#### Reconciliation

- `GET /v1/reconciliation/batches/{batch_id}` - Query settlement batch status

#### Offline Processing

- `POST /v1/offline/advice` - Submit offline transaction advice for reconciliation

#### Dispute Management

- `POST /v1/disputes/notify` - Notify of transaction dispute
- `GET /v1/disputes/{dispute_id}/status` - Query dispute resolution status

### Security Architecture

- **Transport Security:** mTLS 1.3 with certificate-based authentication
- **Message Integrity:** Detached JWS with supported algorithms (ES256, ES384, ES512, PS256, PS384, PS512)
- **Idempotency:** 24-30 day retention with conflict detection
- **Rate Limiting:** Configurable per-acquirer limits
- **Clock Skew Protection:** 300-second tolerance with rejection on violation

## Offline Transaction Model

### Offline Capabilities

The tEUR system supports offline transactions to ensure availability during connectivity disruptions:

- **Token Generation:** Wallets generate offline-capable tokens with embedded limits
- **Transaction Limits:**
  - Per-wallet daily: €1,000
  - Per-merchant daily: €50,000
  - Per-terminal daily: €10,000
- **Reconciliation Window:** 24 hours for advice submission
- **Anti-Replay:** Cryptographic protection against duplicate processing

### Advice Processing

Offline transactions are submitted via advice batches:

- **Batch Submission:** `POST /v1/offline/advice` with transaction details
- **Validation:** Amount limits, key validity, replay detection
- **Settlement:** Successful advice included in next settlement batch
- **Rejection Handling:** Failed advice logged with specific error codes

### Risk Controls

- **Threshold Monitoring:** Breaches flagged for enhanced scrutiny
- **Fraud Detection:** Pattern analysis on offline transaction volumes
- **Reconciliation:** Mandatory 24-hour window for all offline processing

## Settlement and Finality

### Settlement Lifecycle

1. **Authorization:** Funds reserved, no finality achieved
2. **Capture:** Transaction finalized for batch inclusion
3. **Batch Close:** Settlement amount calculated and committed
4. **Interbank Clearing:** Finality achieved upon validator consensus
5. **Reversal Window:** Reversals permitted until batch cutoff

### Finality Semantics

- **Authorization:** Non-final, reversible
- **Capture:** Final at batch close, non-reversible post-cutoff
- **Batch Settlement:** Irrevocable upon validator confirmation
- **Refunds:** Processed as separate transactions with finality

### Batch Processing

- **Frequency:** Configurable (typically daily)
- **Cut-off:** Fixed time for batch closure
- **Clearing:** Distributed validator consensus
- **Evidence:** Batch manifests with cryptographic proofs

## Compliance and Alignment

### DORA Alignment

The tEUR Acquirer API v1.1 implements comprehensive DORA compliance:

- **Third-Party Risk Management:** No external dependencies in CSP
- **Operational Resilience:** Deterministic processing with replay capabilities
- **ICT Risk Management:** Structured logging and audit trails
- **Reporting:** Automated evidence generation for regulatory submission

### ISO 20022 Alignment

- **Message Standards:** API payloads aligned with ISO 20022 payment messages
- **Scheme Codes:** Standardized response codes for interoperability
- **Correlation IDs:** Unique identifiers for transaction traceability
- **Metadata Standards:** Structured data for regulatory reporting

### ECB Regulatory Framework

- **Digital Euro Scheme:** Full compliance with Eurosystem requirements
- **Sanctions Implementation:** Freeze-only approach with balance preservation
- **Confiscation Procedures:** Court-ordered escrow mechanisms
- **Participant Onboarding:** Multi-stage verification process

## Evidence Artifacts

### Audit Evidence

The system generates comprehensive evidence for regulatory oversight:

- **Transaction Logs:** Structured JSON events with correlation IDs
- **Batch Manifests:** Cryptographically signed settlement records
- **Certificate Revocation Lists:** mTLS certificate status
- **Key Rotation Records:** Quarterly cryptographic key updates
- **Reconciliation Reports:** Daily offline transaction matching

### Evidence Formats

- **Structured Logging:** JSON objects with no PII or secrets
- **Cryptographic Proofs:** JWS signatures on all evidence artifacts
- **Timestamping:** UTC timestamps with skew validation
- **Retention:** Minimum 7-year retention for regulatory evidence

### Evidence Validation

- **Integrity Checks:** SHA-256 hashes of evidence bundles
- **Chain of Custody:** Signed evidence transfer protocols
- **Independent Verification:** Third-party auditor access mechanisms

## Onboarding Process

### Pre-Onboarding Requirements

1. **Regulatory Approval:** Eurosystem authorization as tEUR intermediary
2. **Technical Assessment:** Infrastructure capability evaluation
3. **Security Review:** CSP access control and key management procedures

### Technical Onboarding Steps

1. **Certificate Issuance:** mTLS certificate generation by Eurosystem PKI
2. **Environment Provisioning:** Dedicated CSP connectivity setup
3. **API Integration:** Implementation of required endpoints per conformance profile
4. **Testing:** Certification test vector execution
5. **Production Access:** Graduated rollout with monitoring

### Conformance Profiles

- **BASE_ONLINE:** Core transaction processing
- **ONLINE_PLUS_OFFLINE:** Full transaction lifecycle with offline support
- **REFUND_ONLY:** Limited refund processing
- **OFFLINE_ADVICE_ONLY:** Offline reconciliation only

### Go-Live Criteria

- **100% Test Pass Rate:** All certification vectors successful
- **Operational Readiness:** 24/7 monitoring and incident response
- **Evidence Generation:** Complete audit trail validation
- **Regulatory Sign-off:** Eurosystem approval for production access

## Certification Approach

### Certification Framework

The tEUR Acquirer API v1.1 requires formal certification for production deployment:

- **Test Vectors:** Comprehensive JSON test cases covering all scenarios
- **Execution Environment:** Isolated testing infrastructure
- **Validation Criteria:** Exact response matching and audit event generation
- **Evidence Submission:** Automated test reports for regulatory review

### Test Scenarios

#### Online Transactions

- Successful authorization and capture
- Decline scenarios (insufficient funds, etc.)
- Security validations (invalid signatures, clock skew)
- Idempotency handling (replay, conflict)
- Lifecycle operations (reversal, refund)

#### Offline Transactions

- Advice acceptance and processing
- Limit enforcement and breach detection
- Replay prevention and key validation
- Reconciliation window compliance

### Certification Process

1. **Self-Testing:** Acquirer executes test vectors against implementation
2. **Evidence Collection:** Automated capture of responses and audit events
3. **Independent Verification:** Third-party validation of test results
4. **Regulatory Review:** Eurosystem assessment of certification evidence
5. **Certificate Issuance:** Formal approval for production operations

### Ongoing Compliance

- **Quarterly Recertification:** Algorithm rotation and security updates
- **Annual Audits:** Comprehensive system and process review
- **Incident Reporting:** Immediate notification of security events
- **Evidence Archival:** Long-term retention of certification artifacts

## Conclusion

The tEUR Acquirer API v1.1 represents a robust, compliant implementation of the Eurosystem's Digital Euro scheme requirements. Through strict adherence to trust boundaries, deterministic processing, and comprehensive evidence generation, the API ensures operational resilience and regulatory compliance.

The certification framework, with its extensive test vectors and evidence artifacts, provides assurance of correct implementation and ongoing compliance monitoring. Intermediaries following the defined onboarding and certification processes can confidently integrate with the tEUR network, contributing to the secure and efficient operation of the Digital Euro ecosystem.

This annex serves as the authoritative technical reference for regulatory oversight and implementation guidance.
