# tEUR Receipt Formatting Rules v1.1

## Overview

This document defines the standardized receipt formatting rules for tEUR (Tokenized Euro) transactions processed through the Acquirer API v1.1. Merchants must display receipts that comply with these rules to ensure customer transparency, regulatory compliance, and consistent user experience across the Digital Euro scheme.

All receipts must be generated immediately upon transaction completion and include all required fields. Receipts serve as the primary evidence of transaction for customers and must be retained for dispute resolution.

## Required Receipt Fields

### Core Transaction Information

Every receipt must include the following mandatory fields:

- **Merchant Name and ID**: Full legal business name and tEUR-assigned merchant identifier
- **Terminal ID**: Unique identifier of the payment terminal
- **Transaction Date/Time**: UTC timestamp in ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ)
- **Transaction Amount**: Value and currency (€) with decimal precision (e.g., €12.34)
- **Transaction Type**: AUTHORIZATION, CAPTURE, REVERSAL, REFUND, or OFFLINE_ADVICE
- **Authorization Code**: Unique transaction identifier (txn_xxx format)
- **Scheme Code**: tEUR response code (see Scheme Code Handling section)
- **Scheme Message**: Human-readable description corresponding to scheme code

### Customer Information

- **Payment Method**: "tEUR Digital Euro" or "tEUR Offline Token"
- **Wallet Reference**: Opaque wallet identifier (if available)
- **Transaction Status**: APPROVED, DECLINED, or SUBJECT_TO_VERIFICATION

### Regulatory Information

- **tEUR Scheme Reference**: "Digital Euro Scheme - Tokenized Euro"
- **Eurosystem Disclaimer**: "This transaction is processed under the Eurosystem Digital Euro scheme"
- **Dispute Reference**: Contact information for disputes (if applicable)

## Receipt Formatting Standards

### Layout Requirements

- **Header**: Merchant logo/name, terminal ID, transaction date/time
- **Body**: Transaction details, amount, authorization code
- **Footer**: Scheme information, regulatory notices, dispute contact
- **Minimum Width**: 40 characters for thermal printer compatibility
- **Font**: Monospace font (Courier New or equivalent) for alignment
- **Language**: Primary market language with English fallback

### Digital Receipts

For electronic receipts (email, SMS, app notifications):

- **Subject Line**: "tEUR Receipt - [Merchant Name] - €[Amount]"
- **Format**: Plain text with clear field separation
- **Retention**: Minimum 7 years for regulatory compliance
- **Security**: No sensitive payment data (PAN, PIN, or full tokens)

### Accessibility

- **Font Size**: Minimum 10pt for readability
- **Contrast**: High contrast colors for digital displays
- **Alt Text**: Descriptive text for images/logos
- **Screen Reader**: Compatible markup for accessibility tools

## Scheme Code Handling

### Success Codes

| Scheme Code | Display Message             | Receipt Action                         |
| ----------- | --------------------------- | -------------------------------------- |
| 00          | APPROVED                    | Print full receipt with all fields     |
| 08          | HONOUR WITH IDENTIFICATION  | Print receipt with "ID Verified" note  |
| 10          | APPROVED FOR PARTIAL AMOUNT | Print receipt with partial amount note |

### Decline Codes

| Scheme Code | Display Message                 | Receipt Action                                     |
| ----------- | ------------------------------- | -------------------------------------------------- |
| 05          | DO NOT HONOUR                   | Print decline receipt with reason                  |
| 12          | INVALID TRANSACTION             | Print decline receipt with "Invalid Request"       |
| 14          | INVALID CARD NUMBER             | Print decline receipt with "Invalid Token"         |
| 30          | FORMAT ERROR                    | Print decline receipt with "Format Error"          |
| 41          | LOST CARD                       | Print decline receipt with "Token Suspended"       |
| 43          | STOLEN CARD                     | Print decline receipt with "Token Suspended"       |
| 51          | INSUFFICIENT FUNDS              | Print decline receipt with "Insufficient Funds"    |
| 54          | EXPIRED CARD                    | Print decline receipt with "Token Expired"         |
| 61          | EXCEEDS WITHDRAWAL AMOUNT LIMIT | Print decline receipt with "Amount Limit Exceeded" |
| 96          | SYSTEM MALFUNCTION              | Print decline receipt with "System Error - Retry"  |

### Error Codes

| Scheme Code | Display Message             | Receipt Action                                 |
| ----------- | --------------------------- | ---------------------------------------------- |
| 06          | ERROR                       | Print error receipt with "Processing Error"    |
| 91          | ISSUER NOT AVAILABLE        | Print error receipt with "Network Unavailable" |
| 92          | UNABLE TO ROUTE TRANSACTION | Print error receipt with "Routing Error"       |

## Offline Transaction Indicators

### Subject to Later Verification

For offline transactions processed via advice batches:

- **Display Text**: "SUBJECT TO LATER VERIFICATION"
- **Position**: Prominently at the top of the receipt
- **Font**: Bold, uppercase, larger size
- **Additional Note**: "This transaction will be verified within 24 hours. Funds may be held pending confirmation."

### Offline-Specific Fields

- **Offline Transaction ID**: Unique identifier for the offline transaction
- **Advice Status**: ACCEPTED, REJECTED, or PENDING_VERIFICATION
- **Reconciliation Timestamp**: When the advice was processed (if available)
- **Limit Information**: "Within daily limits" or "Limit exceeded - subject to review"

### Verification Status Updates

Merchants must provide mechanisms to update customers on offline transaction status:

- **Real-time Updates**: Via app notifications or SMS
- **Receipt Updates**: Ability to reprint receipts with updated status
- **Dispute Window**: Clear indication of when disputes can be raised

## Timestamp Requirements

### Transaction Timestamps

- **Request Timestamp**: Local transaction time from terminal (metadata.local_txn_time_utc)
- **Processing Timestamp**: Server processing time (processed_at)
- **Settlement Timestamp**: Batch settlement time (for captured transactions)
- **Format**: ISO 8601 (2026-01-03T13:45:12Z)
- **Timezone**: Always UTC with 'Z' suffix

### Display Rules

- **Primary Display**: Processing timestamp
- **Secondary Display**: Local request timestamp (if different)
- **Receipt Header**: "Date/Time: [Processing Timestamp]"
- **Digital Receipts**: Include both timestamps for audit trails

## Terminal and Merchant ID Display

### Terminal ID

- **Format**: "Terminal: [terminal_id]"
- **Position**: Receipt header
- **Validation**: Must match the terminal_id from transaction request

### Merchant ID

- **Format**: "MID: [merchant_id]"
- **Position**: Receipt header or footer
- **Additional Info**: Merchant category code (MCC) if space allows

## Amount Formatting

### Currency Display

- **Symbol**: € (Euro symbol)
- **Position**: Before amount (€12.34)
- **Decimal Places**: 2 digits always (even for whole euros: €10.00)
- **Separator**: Period (.) for decimal, comma (,) for thousands if needed

### Amount Breakdown

For transactions with fees or adjustments:

- **Base Amount**: Primary transaction amount
- **Fees**: Separately listed if applicable
- **Total**: Sum of all amounts
- **Format**: "Amount: €12.34" / "Fee: €0.12" / "Total: €12.46"

## Authorization Code Rules

### Code Generation

- **Source**: transaction_id from API response
- **Format**: txn*[type]*[sequence] (e.g., txn_auth_001)
- **Uniqueness**: Globally unique across all transactions
- **Length**: Maximum 50 characters

### Display Requirements

- **Label**: "Auth Code:" or "Transaction ID:"
- **Position**: Prominent location on receipt
- **Font**: Bold or emphasized
- **Usage**: Primary identifier for customer service and disputes

## Dispute Reference Rules

### When to Include

- **All Declines**: Include dispute contact information
- **Offline Transactions**: Include verification status contact
- **Partial Approvals**: Include explanation contact
- **System Errors**: Include support contact

### Contact Information

- **Primary Contact**: tEUR Customer Support
- **Reference Number**: Transaction ID for dispute correlation
- **Timeframe**: "Disputes must be raised within 60 days"
- **Contact Methods**: Phone, email, or app-based dispute portal

### Dispute Receipt Format

```
DISPUTE INFORMATION
Transaction ID: txn_auth_001
Dispute Window: 60 days from transaction date
Contact: support@t-eursystem.eu
Reference: DISPUTE-[Transaction ID]
```

## Reversal and Refund Note Rules

### Reversal Receipts

- **Transaction Type**: REVERSAL
- **Original Transaction**: Reference to original authorization
- **Reason**: Customer cancellation, merchant error, etc.
- **Amount**: Full or partial reversal amount
- **Note**: "Original transaction reversed. Amount credited to wallet."

### Refund Receipts

- **Transaction Type**: REFUND
- **Original Transaction**: Reference to captured transaction
- **Reason**: Customer return, merchant adjustment, etc.
- **Amount**: Refund amount (may be partial)
- **Note**: "Refund processed. Amount credited to original payment method."

### Formatting Standards

- **Clear Labeling**: "REVERSAL" or "REFUND" prominently displayed
- **Reason Display**: Human-readable reason code
- **Amount Clarity**: "Refund Amount: €10.00" vs "Reversed Amount: €10.00"
- **Timeline**: Include processing date/time
- **Confirmation**: "This transaction has been completed"

## Regulatory Compliance

### Data Retention

- **Physical Receipts**: Retain for 7 years minimum
- **Digital Receipts**: Store in tamper-evident logs
- **Audit Trail**: Link receipts to transaction records

### Privacy Requirements

- **No Sensitive Data**: Never display full tokens, keys, or PII
- **Anonymized IDs**: Use opaque identifiers only
- **Data Minimization**: Include only necessary fields

### Accessibility Standards

- **WCAG Compliance**: Level AA for digital receipts
- **Multi-language**: Support for EU official languages
- **Font Scaling**: Adjustable size for visual impairments

## Implementation Guidelines

### Receipt Generation

1. **Immediate Printing**: Generate receipt upon API response
2. **Field Validation**: Ensure all required fields are present
3. **Scheme Code Mapping**: Use standardized messages
4. **Offline Handling**: Add verification notices for offline transactions
5. **Error Handling**: Generate error receipts for failed transactions

### Testing Requirements

- **Scheme Code Coverage**: Test all decline codes
- **Offline Scenarios**: Verify verification indicators
- **Formatting Validation**: Ensure layout standards
- **Accessibility Testing**: Validate with screen readers

### Version Control

- **Version Identification**: Include "v1.1" in receipt footer
- **Update Mechanism**: Support for rule updates via configuration
- **Backward Compatibility**: Maintain support for previous versions

This document provides the complete specification for tEUR receipt formatting. Merchants must implement these rules to ensure compliance with the Digital Euro scheme requirements and provide customers with clear, accurate transaction records.
