# ISO 8583 Mapping for tEUR Acquirer API v1.1

This document provides the mapping between tEUR Acquirer API endpoints and ISO 8583 message types, along with field-level mappings.

## Endpoint to Message Type Mapping

| Endpoint                                | ISO Message Type                                                     | Description                                    |
| --------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| `/v1/transactions/authorize`            | 0100 (Authorization Request) / 0110 (Authorization Response)         | Request/response for transaction authorization |
| `/v1/transactions/{txn_id}/capture`     | 0220 (Transaction Advice) / 0230 (Transaction Advice Response)       | Advice of a captured transaction               |
| `/v1/transactions/{txn_id}/reverse`     | 0420 (Reversal Advice) / 0430 (Reversal Advice Response)             | Reversal of an authorization                   |
| `/v1/transactions/{txn_id}/refund`      | 0220 (Transaction Advice with reversal indicator) / 0230             | Refund transaction                             |
| `/v1/reconciliation/batches/{batch_id}` | 0820 (Reconciliation Advice) / 0830 (Reconciliation Advice Response) | Reconciliation batch query                     |
| `/v1/offline/advice`                    | 0220 (Transaction Advice) batch / 0230 batch                         | Batch of offline transactions                  |
| `/v1/disputes/notify`                   | 0800 (Network Management) / 0810                                     | Dispute notification                           |
| `/v1/disputes/{dispute_id}/status`      | 0800 (Network Management) / 0810                                     | Dispute status query                           |

## Field-Level Mapping Guidance

### Common Fields Across All Messages

- **Message Type Indicator (MTI)**: As specified in table above
- **Primary Account Number (PAN, 2)**: Not applicable; set to "0000000000000000" or special tEUR identifier
- **Processing Code (3)**:
  - "000000" for authorization
  - "000000" for capture
  - "200000" for reversal/refund
  - "920000" for reconciliation
  - "980000" for network management (disputes)
- **Amount, Transaction (4)**: Transaction amount in cents (e.g., 123400 for 1234.00 EUR)
- **Amount, Settlement (5)**: Not used
- **Amount, Cardholder Billing (6)**: Not used
- **Transmission Date and Time (7)**: UTC timestamp in YYMMDDHHMMSS format from metadata.local_txn_time_utc
- **Amount, Cardholder Billing Fee (8)**: Not used
- **Conversion Rate, Settlement (9)**: Not used
- **Conversion Rate, Cardholder Billing (10)**: Not used
- **Systems Trace Audit Number (STAN, 11)**: Sequential number per terminal/session
- **Time, Local Transaction (12)**: HHMMSS from local_txn_time_utc
- **Date, Local Transaction (13)**: MMDD from local_txn_time_utc
- **Date, Expiration (14)**: Not applicable
- **Date, Settlement (15)**: Not used
- **Date, Conversion (16)**: Not used
- **Date, Capture (17)**: Not used
- **Merchant's Type (18)**: From merchant.category_code (4 digits)
- **Acquiring Institution Country Code (19)**: "000" (not applicable)
- **PAN Extended, Country Code (20)**: Not used
- **Forwarding Institution. Country Code (21)**: Not used
- **Point of Service Entry Mode Code (22)**:
  - "071" for NFC
  - "051" for CHIP
  - "001" for MAGSTRIPE
  - "901" for OFFLINE
- **Application PAN Sequence Number (23)**: Not used
- **Function Code (24)**: Not used
- **Point of Service Condition Code (25)**: "00" (normal)
- **Point of Service Capture Code (26)**: Not used
- **Authorizing Identification Response Length (27)**: Not used
- **Amount, Transaction Fee (28)**: Not used
- **Amount, Settlement Fee (29)**: Not used
- **Amount, Transaction Processing Fee (30)**: Not used
- **Amount, Settlement Processing Fee (31)**: Not used
- **Acquiring Institution Identification Code (32)**: From X-Acquirer-Id
- **Forwarding Institution Identification Code (33)**: Not used
- **Primary Account Number, Extended (34)**: Not used
- **Track 2 Data (35)**: Not applicable
- **Track 3 Data (36)**: Not applicable
- **Retrieval Reference Number (37)**: txn_id or generated reference
- **Authorization Identification Response (38)**: auth_code from response
- **Response Code (39)**: Mapped from API decision/scheme_code (see below)
- **Service Restriction Code (40)**: Not used
- **Card Acceptor Terminal Identification (41)**: From terminal.terminal_id
- **Card Acceptor Identification Code (42)**: From merchant.merchant_id
- **Card Acceptor Name/Location (43)**: Merchant name and location (up to 40 chars)
- **Additional Response Data (44)**: Not used
- **Track 1 Data (45)**: Not applicable
- **Additional Data - ISO (46)**: Not used
- **Additional Data - National (47)**: Not used
- **Additional Data - Private (48)**: JSON-encoded metadata including:
  - correlation_id: From X-Request-Id
  - txn_id: From response
  - wallet_token: From request
  - risk data: offline_eligible, device_attestation
  - batch_id: For captures/refunds
  - sequence: For offline
- **Currency Code, Transaction (49)**: "978" (EUR)
- **Currency Code, Settlement (50)**: Not used
- **Currency Code, Cardholder Billing (51)**: Not used
- **Personal Identification Number Data (52)**: Not used
- **Security Related Control Information (53)**: Not used
- **Additional Amounts (54)**: For offline limits (remaining spend)
- **Reserved for ISO use (55)**: ICC/chip data if applicable
- **Reserved for ISO use (56)**: Not used
- **Reserved for National use (57)**: Not used
- **Reserved for National use (58)**: Not used
- **Transport Data (59)**: Offline tokens in advice batches
- **Reserved for Private use (60)**: Not used
- **Reserved for Private use (61)**: Not used
- **Reserved for Private use (62)**: Not used
- **Reserved for Private use (63)**: Not used
- **Message Authentication Code (MAC, 64)**: Calculated over message
- **Bitmap, Secondary (65-128)**: As required for extended fields

### Authorization-Specific Fields (0100/0110)

- **Additional Data - Private (48)**: Includes wallet_token, offline_eligible, device_attestation
- **Response Code (39)**: "00" for APPROVED, mapped scheme_code for DECLINED
- **Additional Amounts (54)**: offline_spend_remaining for PARTIAL_OFFLINE_APPROVED

### Capture/Refund-Specific Fields (0220/0230)

- **Processing Code (3)**: "000000" for capture, "200000" for refund
- **Additional Data - Private (48)**: Includes batch_id, capture_amount
- **Response Code (39)**: "00" for success

### Reversal-Specific Fields (0420/0430)

- **Processing Code (3)**: "200000"
- **Additional Data - Private (48)**: Includes reason_code
- **Response Code (39)**: "00" for success

### Offline Advice Batch Fields (0220 batch)

- **Transport Data (59)**: Array of offline_token JSON objects
- **Additional Data - Private (48)**: batch_id, submitted_at_utc, item count
- **Response Code (39)**: Per item in batch response

### Reconciliation Fields (0820/0830)

- **Processing Code (3)**: "920000"
- **Additional Data - Private (48)**: batch_id, query parameters
- **Response Code (39)**: "00" for success

### Dispute Fields (0800/0810)

- **Processing Code (3)**: "980000"
- **Function Code (24)**: "200" for notify, "201" for status
- **Additional Data - Private (48)**: dispute_id, reason_code, evidence, status
- **Response Code (39)**: "00" for success

## Scheme Code to ISO Response Code Mapping

| Scheme Code | ISO Response Code | Description                                  |
| ----------- | ----------------- | -------------------------------------------- |
| 01          | 01                | Refer to card issuer                         |
| 03          | 03                | Invalid merchant                             |
| 04          | 04                | Pick-up card                                 |
| 05          | 05                | Do not honor                                 |
| 12          | 12                | Invalid transaction                          |
| 13          | 13                | Invalid amount                               |
| 14          | 14                | Invalid card number                          |
| 15          | 15                | No such issuer                               |
| 30          | 30                | Format error                                 |
| 41          | 41                | Lost card                                    |
| 43          | 43                | Stolen card                                  |
| 51          | 51                | Insufficient funds                           |
| 54          | 54                | Expired card                                 |
| 55          | 55                | Incorrect PIN                                |
| 57          | 57                | Transaction not permitted                    |
| 58          | 58                | Transaction not permitted to terminal        |
| 61          | 61                | Exceeds withdrawal amount limit              |
| 62          | 62                | Restricted card                              |
| 65          | 65                | Exceeds withdrawal frequency limit           |
| 91          | 91                | Issuer or switch inoperative                 |
| 96          | 96                | System malfunction (for CLOCK_SKEW_EXCEEDED) |

## Correlation ID Propagation Rules

- **Source**: X-Request-Id header from API request
- **Format**: UUID string
- **Propagation**: Included in ISO field 48 as JSON key "correlation_id"
- **Usage**: Propagated through all request/response pairs and batch processing
- **Tracing**: Enables end-to-end correlation across API and ISO 8583 layers
- **Retention**: Maintained in audit logs and settlement records
