# Central Bank Pilot Onboarding Plan for tEUR

## Overview

This phased pilot plan outlines the structured onboarding of tEUR (Tokenized Euro) for a central bank, ensuring regulatory compliance, operational resilience, and incremental risk mitigation. The plan follows a waterfall approach with regulator review at each phase, aligning with DORA (Digital Operational Resilience Act) requirements for financial ICT systems.

## General Principles

- **Regulatory Oversight**: Central bank regulator reviews all artifacts and provides go/no-go decisions at phase gates.
- **Incremental Scaling**: Each phase builds on the previous, with controlled expansion of scope and participants.
- **DORA Compliance**: All phases generate evidence of ICT resilience, third-party risk management, and operational continuity.
- **Fail-Safe Design**: No-go decisions halt progression; exit criteria must be fully met before advancement.
- **Documentation**: Comprehensive artifacts maintained for audit and regulatory reporting.

## Phase 1: Governance and Scope Definition

### Description

Establish governance structures, define pilot scope, and set baseline requirements. Focus on organizational alignment and regulatory framework setup.

### Required Artifacts

- **Pilot Charter**: Signed document defining objectives, scope, timelines, and responsibilities.
- **Risk Assessment Report**: Initial DORA-compliant ICT risk analysis.
- **Governance Framework**: Roles, responsibilities, and decision-making processes.
- **Scope Definition Document**: Technical and operational boundaries of the pilot.
- **Regulatory Engagement Plan**: Schedule for regulator interactions and reviews.

### DORA Evidence Expectations

- **ICT Risk Management Framework**: Documented policies for third-party management and incident response.
- **Contractual Arrangements**: Draft agreements with ICT providers (e.g., acquirers, cloud services).
- **Audit Trail Design**: Plans for immutable logging and evidence collection.

### Exit Criteria

- Governance committee formed and approved by regulator.
- All artifacts reviewed and accepted by central bank stakeholders.
- Baseline security assessments completed with no critical findings.

### Go/No-Go Checkpoints

- **Checkpoint 1.1**: Governance framework approval (Week 4).
- **Checkpoint 1.2**: Scope definition sign-off (Week 6).
- **Regulator Review**: Formal approval to proceed (Week 8).

## Phase 2: Lab Pilot

### Description

Conduct controlled testing in a laboratory environment. Validate core tEUR functionality, security controls, and integration points without real-world transactions.

### Required Artifacts

- **Lab Environment Setup Report**: Infrastructure configuration and security hardening.
- **Test Case Suite**: Comprehensive test plans for authorization, settlement, and reconciliation.
- **Security Assessment Report**: Penetration testing and vulnerability scans.
- **Performance Benchmark Report**: Throughput and latency measurements.
- **Incident Response Drill Report**: Simulated incident handling exercises.

### DORA Evidence Expectations

- **Protection and Prevention Controls**: Evidence of implemented safeguards (Article 15).
- **ICT Business Continuity Plans**: Tested backup and recovery procedures.
- **Third-Party Oversight**: Monitoring and audit evidence for lab ICT providers.

### Exit Criteria

- 100% test case pass rate in lab environment.
- No security vulnerabilities above medium severity.
- Successful incident response simulation with <15-minute detection.

### Go/No-Go Checkpoints

- **Checkpoint 2.1**: Lab setup completion (Week 12).
- **Checkpoint 2.2**: Test suite execution (Week 14).
- **Regulator Review**: Approval based on lab results (Week 16).

## Phase 3: Limited Field Pilot

### Description

Expand to limited real-world deployment with small-scale merchants and consumers. Test end-to-end transactions, offline capabilities, and acquirer integrations.

### Required Artifacts

- **Pilot Participant Agreements**: Contracts with selected merchants and consumers.
- **Transaction Monitoring Dashboard**: Real-time metrics and alerting.
- **Reconciliation Reports**: Daily settlement and dispute resolution logs.
- **User Feedback Reports**: Surveys and usability assessments.
- **Incident Logs**: Any production incidents with root cause analysis.

### DORA Evidence Expectations

- **Major Incident Reporting**: Logs of any incidents with notification compliance (Article 18).
- **ICT Service Monitoring**: Performance metrics and SLA compliance.
- **Subcontractor Oversight**: Evidence of controls over acquirer and terminal providers.

### Exit Criteria

- Successful processing of 10,000+ transactions with <0.1% error rate.
- All offline transactions reconciled within 24 hours.
- Positive user feedback from >80% of participants.

### Go/No-Go Checkpoints

- **Checkpoint 3.1**: Participant onboarding (Week 20).
- **Checkpoint 3.2**: Transaction milestone (Week 24).
- **Regulator Review**: Field pilot assessment (Week 26).

## Phase 4: Scale Readiness

### Description

Prepare for full-scale deployment. Optimize performance, validate high-volume operations, and conduct comprehensive regulatory testing.

### Required Artifacts

- **Scalability Test Reports**: Load testing up to 10x expected production volume.
- **Operational Readiness Review**: Checklist of production prerequisites.
- **Regulatory Compliance Audit**: Independent DORA compliance assessment.
- **Contingency Plans**: Detailed business continuity and disaster recovery procedures.
- **Training Materials**: Staff and participant education resources.

### DORA Evidence Expectations

- **Resilience Testing**: Evidence of stress testing and recovery capabilities.
- **Third-Party Exit Strategies**: Documented portability and transition plans (Article 30).
- **Audit Evidence**: Comprehensive logs and reports for regulatory inspection.

### Exit Criteria

- Sustained performance at production scale for 72 hours.
- Successful regulatory audit with no major findings.
- All contingency plans tested and validated.

### Go/No-Go Checkpoints

- **Checkpoint 4.1**: Scalability testing (Week 30).
- **Checkpoint 4.2**: Audit completion (Week 32).
- **Regulator Review**: Scale readiness approval (Week 34).

## Phase 5: Regulatory Sign-Off

### Description

Final regulatory review and approval for full deployment. Address any remaining concerns and obtain formal authorization.

### Required Artifacts

- **Final Risk Assessment**: Updated DORA risk analysis for production.
- **Deployment Plan**: Detailed rollout strategy with rollback procedures.
- **Ongoing Monitoring Framework**: Post-launch oversight and reporting.
- **Regulatory Approval Documentation**: Signed authorizations and conditions.
- **Knowledge Transfer Reports**: Documentation for operational handover.

### DORA Evidence Expectations

- **Full Compliance Certification**: Evidence of meeting all DORA articles.
- **Incident Response Framework**: Tested and approved notification procedures.
- **Third-Party Management**: Complete oversight and audit evidence.

### Exit Criteria

- Unconditional regulatory approval for production deployment.
- All pilot artifacts archived and accessible for audit.
- Operational team fully trained and ready.

### Go/No-Go Checkpoints

- **Checkpoint 5.1**: Final documentation (Week 36).
- **Regulator Review**: Production authorization (Week 38).

## Overall Timeline and Milestones

- **Total Duration**: 38 weeks (approximately 9 months)
- **Key Milestones**:
  - Phase 1 Complete: Week 8
  - Phase 2 Complete: Week 16
  - Phase 3 Complete: Week 26
  - Phase 4 Complete: Week 34
  - Phase 5 Complete: Week 38

## Risk Mitigation

- **Fallback Plans**: Ability to rollback to previous phase at any go/no-go checkpoint.
- **Contingency Funding**: Budget allocated for extended testing or remediation.
- **Stakeholder Communication**: Regular updates to participants and regulators.
- **Data Protection**: Strict controls on pilot data handling and privacy.

This phased approach ensures thorough validation, regulatory compliance, and controlled risk escalation for the tEUR central bank pilot.
