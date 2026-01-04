# DORA Third-Party ICT Risk Controls Mapping

## Overview

This document maps Verifone terminals and acquirer systems to DORA (Digital Operational Resilience Act) third-party ICT risk management requirements. As a regulated digital euro settlement network, tEUR must classify and manage ICT third-parties to ensure operational resilience.

## Third-Party Classification

### Verifone Terminals

- **Classification**: Critical ICT Third-Party Provider
- **Rationale**: Verifone provides hardware and software for transaction capture at the point of sale. Failure could disrupt payment acceptance across the ecosystem.
- **DORA Article**: Article 28 (Critical ICT third-party service providers)
- **Risk Level**: High - Direct impact on payment processing availability

### Acquirer Systems

- **Classification**: Important ICT Third-Party Provider
- **Rationale**: Acquirers provide transaction processing, tokenization, and settlement coordination. They are essential intermediaries but can be multi-sourced.
- **DORA Article**: Article 29 (Important ICT third-party service providers)
- **Risk Level**: Medium - Impact through service aggregation

### Supporting Services

- **Verifone Cloud Services**: Classified as Important, treated as external dependencies with contractual controls.
- **Payment Networks (e.g., Visa)**: Critical if integrated, but tEUR acts as parallel network.

## Concentration Risk Controls

### Risk Assessment

- **Single Point of Failure**: No single acquirer or terminal provider can cause >5% of transaction volume disruption.
- **Vendor Diversity**: Minimum 3 acquirer integrations required for production deployment.
- **Geographic Distribution**: Acquirers must span multiple EU jurisdictions to prevent regional failures.

### Mitigation Strategies

- **Multi-Acquirer Architecture**: tEUR APIs designed for plug-and-play acquirer integration.
- **Terminal Agnosticism**: Support multiple terminal providers beyond Verifone.
- **Capacity Planning**: Monitor and enforce acquirer capacity limits to prevent over-reliance.

### Monitoring

- **Concentration Metrics**: Daily reports on transaction distribution across acquirers.
- **Threshold Alerts**: Automatic alerts if concentration exceeds 10% for any single provider.
- **DORA Article**: Article 15 (Protection and prevention)

## Incident Notification Requirements

### Notification Triggers

- **Verifone Incidents**: Any hardware/software failure affecting >1% of terminals.
- **Acquirer Incidents**: Service disruptions >15 minutes or data breaches.
- **Severity Levels**:
  - Critical: Immediate notification (<1 hour)
  - Major: Within 4 hours
  - Minor: Within 24 hours

### Notification Process

1. **Detection**: Automated monitoring detects incidents via API health checks and transaction metrics.
2. **Internal Assessment**: tEUR security team evaluates impact within 30 minutes.
3. **Regulatory Notification**: Report to competent authorities (e.g., ECB, national supervisors) per DORA timelines.
4. **Stakeholder Communication**: Notify affected acquirers and merchants.

### Evidence Collection

- **Incident Logs**: Timestamped records of detection, assessment, and notification.
- **Impact Assessment**: Quantitative metrics (transactions affected, duration).
- **DORA Article**: Article 18 (Reporting of major incidents)

## Exit and Portability Strategy

### Verifone Exit Strategy

- **Contractual Clauses**: 90-day termination notice with data portability requirements.
- **Technical Portability**: Terminal configurations stored in acquirer systems, not tEUR.
- **Migration Path**: Acquirers responsible for terminal replacement; tEUR provides API compatibility.
- **Fallback Options**: Generic terminal support for non-Verifone devices.

### Acquirer Exit Strategy

- **Multi-Tenancy**: tEUR APIs support concurrent acquirer operations.
- **Data Export**: Standardized reconciliation data formats for easy migration.
- **Transition Period**: 30-day overlap for acquirer switching.
- **Contingency Contracts**: Pre-qualified backup acquirers for rapid replacement.

### Portability Mechanisms

- **API Standardization**: REST APIs with OpenAPI specs for easy integration.
- **Data Formats**: JSON schemas for all transaction and reconciliation data.
- **Testing Environments**: Sandbox environments for acquirer onboarding/testing.
- **DORA Article**: Article 30 (Contractual arrangements on ICT services)

## Oversight and Audit Evidence

### Oversight Mechanisms

- **Continuous Monitoring**: API performance, error rates, and transaction volumes.
- **Quarterly Reviews**: Formal assessment of third-party performance and risks.
- **Annual Audits**: Independent audits of third-party controls and compliance.
- **Penetration Testing**: Regular security assessments of integrated systems.

### Audit Evidence Requirements

- **Contract Reviews**: Evidence of DORA-compliant clauses in all third-party agreements.
- **Performance Metrics**: SLA compliance reports and incident response times.
- **Security Assessments**: Penetration test reports and vulnerability scans.
- **Incident Response Drills**: Evidence of tabletop exercises and live simulations.

## DORA Article Mapping

| DORA Article | Requirement                      | tEUR Implementation                                      |
| ------------ | -------------------------------- | -------------------------------------------------------- |
| Article 15   | Protection and prevention        | Concentration risk controls, multi-acquirer architecture |
| Article 16   | ICT and security risk management | Third-party classification and risk assessments          |
| Article 17   | ICT business continuity          | Exit strategies and portability mechanisms               |
| Article 18   | Reporting of major incidents     | Automated incident detection and notification workflows  |
| Article 28   | Critical ICT third-parties       | Verifone classification with enhanced oversight          |
| Article 29   | Important ICT third-parties      | Acquirer classification with standard controls           |
| Article 30   | Contractual arrangements         | Standardized contracts with exit clauses                 |
| Article 31   | Subcontracting                   | Audit rights for Verifone subcontractors                 |

## Architectural Enforcement Points

### API Layer

- **Authentication**: mTLS with certificate validation for acquirer identity.
- **Rate Limiting**: Per-acquirer limits to prevent abuse and enable capacity management.
- **Audit Logging**: All API calls logged with acquirer identification.

### Reconciliation Layer

- **Data Validation**: Strict schema validation for reconciliation data.
- **Anomaly Detection**: ML-based monitoring for unusual transaction patterns.
- **Immutable Ledger**: Blockchain-based audit trail for all settlements.

### Monitoring Layer

- **Health Checks**: Automated probes for acquirer and terminal connectivity.
- **Metrics Collection**: Prometheus-style metrics for performance and reliability.
- **Alerting**: PagerDuty integration for incident response.

### Security Layer

- **Network Segmentation**: Acquirer traffic isolated from core tEUR systems.
- **Encryption**: End-to-end encryption for all data in transit.
- **Access Control**: Role-based access with principle of least privilege.

## Evidence Artifacts Generated by CI and Operations

### CI/CD Artifacts

- **Contract Validation**: Automated checks for DORA clauses in pull requests.
- **Security Scans**: SAST/DAST reports for third-party integrations.
- **Compliance Tests**: Unit tests validating DORA requirements (e.g., notification workflows).
- **Artifact Signing**: Cryptographically signed binaries and configs.

### Operational Artifacts

- **Audit Logs**: Structured JSON logs of all third-party interactions.
- **Performance Reports**: Daily/weekly metrics on acquirer performance.
- **Incident Reports**: Detailed incident timelines with evidence chains.
- **Compliance Dashboards**: Real-time views of risk metrics and control status.

### Evidence Storage

- **Immutable Storage**: All artifacts stored in tamper-proof ledgers.
- **Retention Policies**: 7-year retention for regulatory evidence.
- **Chain of Custody**: Cryptographic proofs for evidence integrity.

This mapping ensures tEUR's third-party ICT relationships are DORA-compliant, with robust controls for risk management, incident response, and operational resilience.
