# ISO 20022 Adapter for tEUR

Bridges traditional banking systems (SEPA, TARGET2) with tEUR Digital Euro using ISO 20022 messaging standards.

## Features

- ✅ **ISO 20022 pain.001** - Customer Credit Transfer Initiation (SEPA → tEUR)
- ✅ **ISO 20022 pain.002** - Payment Status Report
- ✅ **ISO 20022 camt.053** - Bank to Customer Statement (tEUR → SEPA)
- ✅ **Bidirectional mapping** - IBAN ↔ tEUR wallet addresses
- ✅ **Idempotency** - Uses end-to-end ID from SEPA messages
- ✅ **Real-time processing** - Instant settlement via tEUR blockchain

## Installation

```bash
npm install
cp .env.example .env
```

## Configuration

Edit `.env`:

```
TEUR_API_URL=http://localhost:3000/api/v1
TEUR_API_KEY=your-bank-api-key
BIC_CODE=YOURBANK00XXX
INSTITUTION_ID=bank-xx-01
INSTITUTION_NAME=Your Bank Name
```

## Running

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### POST /iso20022/pain.001

Accepts SEPA Credit Transfer Initiation (XML) and executes tEUR transfer.

**Request:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-2024-001</MsgId>
      <CreDtTm>2024-01-15T10:30:00</CreDtTm>
    </GrpHdr>
    <PmtInf>
      <DbtrAcct>
        <Id><IBAN>DE89370400440532013000</IBAN></Id>
      </DbtrAcct>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>E2E-2024-001</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">100.00</InstdAmt>
        </Amt>
        <CdtrAcct>
          <Id><IBAN>FR1420041010050500013M02606</IBAN></Id>
        </CdtrAcct>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>
```

**Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.002.001.03">
  <CstmrPmtStsRpt>
    <GrpHdr>
      <MsgId>STS-2024-001</MsgId>
      <CreDtTm>2024-01-15T10:30:01</CreDtTm>
    </GrpHdr>
    <OrgnlGrpInfAndSts>
      <OrgnlMsgId>MSG-2024-001</OrgnlMsgId>
      <GrpSts>ACCP</GrpSts>
    </OrgnlGrpInfAndSts>
    <OrgnlPmtInfAndSts>
      <TxInfAndSts>
        <OrgnlEndToEndId>E2E-2024-001</OrgnlEndToEndId>
        <TxSts>ACCP</TxSts>
        <OrgnlTxRef>
          <RmtInf>
            <Ustrd>tEUR TxHash: 0x1234...</Ustrd>
          </RmtInf>
        </OrgnlTxRef>
      </TxInfAndSts>
    </OrgnlPmtInfAndSts>
  </CstmrPmtStsRpt>
</Document>
```

### GET /payments/:txId/status

Returns ISO 20022 camt.053 statement for a tEUR transaction.

**Response:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Id>E2E-2024-001</Id>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">900.00</Amt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">100.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <NtryDtls>
          <TxDtls>
            <Refs>
              <TxId>0x1234...</TxId>
            </Refs>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>
```

## IBAN to Wallet Mapping

The adapter maintains a registry mapping IBANs to tEUR wallet addresses:

```typescript
// Production implementation should use database or registry
IBAN: DE89370400440532013000 → Wallet: 0x1234...
IBAN: FR1420041010050500013M02606 → Wallet: 0x5678...
```

## Message Flow

### SEPA → tEUR

1. Bank sends ISO 20022 pain.001 (SEPA Credit Transfer)
2. Adapter maps IBAN to tEUR wallet address
3. Adapter calls tEUR API `/transfers`
4. tEUR executes on-chain transfer
5. Adapter returns pain.002 (Status Report)

### tEUR → SEPA

1. Query tEUR transaction via API
2. Adapter generates camt.053 statement
3. Statement delivered to bank's back-office system

## Status Codes

- **ACCP** - Accepted (transaction successful)
- **RJCT** - Rejected (transaction failed)
- **PART** - Partially accepted (batch with some failures)

## Security

- TLS 1.3 encryption required
- API key authentication
- Message signing (production)
- End-to-end encryption (production)

## Compliance

- ISO 20022 pain.001.001.03
- ISO 20022 pain.002.001.03
- ISO 20022 camt.053.001.02
- SEPA Credit Transfer Scheme
- ECB Digital Euro requirements

## License

MIT
