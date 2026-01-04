# Verifone Integration Design for tEUR

## Assumptions

- **Verifone Terminals**: Secure capture terminals that communicate exclusively with acquirers. They handle card data entry and initial transaction processing but do not perform settlement.
- **tEUR Direct Communication**: tEUR never communicates directly with Verifone terminals or hardware. All interactions flow through acquirers.
- **Verifone Cloud Services**: Treated as DORA ICT third parties. Any cloud-based services from Verifone are considered external dependencies with appropriate risk assessments.
- **Connectivity**: No assumption of continuous connectivity. Transactions must support offline scenarios where possible, with reconciliation for settlement.
- **Data Handling**: tEUR never handles PAN, PIN, or cardholder data. All sensitive data remains within the acquirer/terminal domain.

## Responsibilities per Layer

### Verifone Terminal Layer

- **Secure Data Capture**: Collect cardholder data (PAN, PIN, expiry) using secure hardware.
- **Transaction Initiation**: Generate transaction requests with encrypted card data.
- **Offline Processing**: Support offline transaction storage and batch submission when connectivity is restored.
- **Device Security**: Maintain hardware security (tamper resistance, key management).
- **Acquirer Communication**: Send transaction data to acquirer over secure channels (e.g., IP, dial-up).

### Acquirer Layer

- **Transaction Processing**: Receive and validate transaction requests from terminals.
- **Tokenization**: Replace sensitive card data with tokens before forwarding to tEUR.
- **Authorization Requests**: Call tEUR REST API for transaction authorization.
- **Settlement Coordination**: Handle capture, reversal, and refund operations via tEUR API.
- **Reconciliation**: Perform end-of-day reconciliation with tEUR settlement data.
- **Risk Management**: Implement fraud detection and compliance checks.
- **Terminal Management**: Provision and manage Verifone terminals.

### tEUR Layer

- **Authorization Processing**: Validate and authorize transactions based on rules and balances.
- **Settlement Execution**: Process captures, reversals, and refunds deterministically.
- **Reconciliation Data**: Provide settlement data for acquirer reconciliation.
- **Audit Trail**: Maintain complete, auditable transaction logs.
- **Regulatory Compliance**: Ensure DORA compliance for all operations.
- **No Direct Terminal Interaction**: Never communicate with or control Verifone devices.

## Security Boundaries and Trust Zones

### Trust Zones

1. **Terminal Zone**: Verifone hardware and local processing. Highest trust for data capture.
2. **Acquirer Zone**: Acquirer systems, including tokenization and API calls to tEUR.
3. **tEUR Zone**: Core settlement network, isolated from external systems.
4. **External Zone**: Internet, third-party services (including Verifone cloud).

### Security Boundaries

- **Terminal ↔ Acquirer**: Secure channel (TLS/mTLS, VPN). Card data encrypted in transit.
- **Acquirer ↔ tEUR**: mTLS with client certificates. No card data transmitted.
- **tEUR Internal**: Isolated network, no external access except authorized APIs.
- **No Terminal ↔ tEUR Direct Path**: Enforced by architecture; all communication routed through acquirer.

### Key Security Principles

- **Zero Trust**: All requests validated, no implicit trust.
- **Data Minimization**: Only necessary data shared across boundaries.
- **Encryption**: End-to-end encryption for sensitive data.
- **Auditability**: All cross-boundary interactions logged and auditable.

## Payment Flow Sequence Diagrams

### Authorization Flow

```
sequenceDiagram
    participant C as Cardholder
    participant T as Verifone Terminal
    participant A as Acquirer
    participant TEUR as tEUR Network

    C->>T: Present card & enter PIN
    T->>T: Capture card data securely
    T->>A: Send transaction request (encrypted)
    A->>A: Validate & tokenize card data
    A->>TEUR: POST /authorize (tokenized data)
    TEUR->>TEUR: Validate transaction rules
    TEUR->>A: 200 OK (approved/declined)
    A->>T: Send authorization response
    T->>C: Display approval/decline
```

### Capture Flow

```
sequenceDiagram
    participant T as Verifone Terminal
    participant A as Acquirer
    participant TEUR as tEUR Network

    T->>A: Send capture request (batch/end-of-day)
    A->>A: Validate capture data
    A->>TEUR: POST /capture
    TEUR->>TEUR: Process settlement
    TEUR->>A: 200 OK (captured)
    A->>T: Send capture confirmation
```

### Reversal Flow

```
sequenceDiagram
    participant C as Cardholder
    participant T as Verifone Terminal
    participant A as Acquirer
    participant TEUR as tEUR Network

    C->>T: Request reversal
    T->>A: Send reversal request
    A->>TEUR: POST /reverse
    TEUR->>TEUR: Process reversal
    TEUR->>A: 200 OK (reversed)
    A->>T: Send reversal confirmation
    T->>C: Display confirmation
```

### Reconciliation Flow

```
sequenceDiagram
    participant A as Acquirer
    participant TEUR as tEUR Network

    A->>TEUR: GET /reconciliation?startDate=...&endDate=...
    TEUR->>TEUR: Generate reconciliation data
    TEUR->>A: 200 OK (transaction summary)
    A->>A: Process reconciliation
```

## What Verifone Does

- **Hardware Security**: Provides tamper-resistant terminals for secure card data capture.
- **Transaction Capture**: Collects and encrypts card data at the point of sale.
- **Offline Support**: Stores transactions when offline and submits when connectivity restored.
- **Acquirer Integration**: Communicates transaction data to acquirer systems.
- **Device Management**: Supports remote configuration and updates from acquirer.

## What the Acquirer Does

- **Terminal Management**: Provisions, configures, and monitors Verifone terminals.
- **Data Processing**: Receives encrypted transaction data, validates, and tokenizes.
- **tEUR Integration**: Acts as intermediary, calling tEUR APIs for authorization/settlement.
- **Settlement Coordination**: Manages the full transaction lifecycle (auth, capture, refund).
- **Reconciliation**: Performs financial reconciliation with tEUR settlement data.
- **Compliance**: Ensures PCI DSS and other regulatory compliance for card data handling.

## What tEUR Does

- **Authorization Logic**: Validates transactions against rules, balances, and sanctions.
- **Settlement Processing**: Executes deterministic settlement operations.
- **Audit Logging**: Maintains complete transaction audit trails.
- **Reconciliation Support**: Provides data for acquirer reconciliation processes.
- **Regulatory Compliance**: Operates as DORA-compliant settlement network.
- **API Provision**: Exposes REST APIs for acquirer integration.

## What is Out of Scope

- **Direct Terminal Control**: tEUR does not configure or manage Verifone devices.
- **Card Data Handling**: tEUR never processes PAN, PIN, or cardholder information.
- **Terminal Software Updates**: Managed by acquirer, not tEUR.
- **Offline Transaction Processing**: Terminals handle offline scenarios; tEUR assumes online processing.
- **Verifone Cloud Services**: Any cloud-based Verifone services are third-party and not integrated with tEUR.
- **Point-of-Sale UI**: tEUR does not influence terminal user interfaces.
- **Hardware Procurement**: Acquirer responsible for Verifone device acquisition and deployment.
- **Network Connectivity**: tEUR does not manage or guarantee connectivity between terminals and acquirers.
