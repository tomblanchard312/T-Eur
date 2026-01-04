// @ts-expect-error: No types available for iso8583 library
import { Iso8583 } from 'iso8583';

// Field mapping tables for deterministic and reversible mapping
// ISO 8583 field numbers to REST API field names

const authorizeRequestMapping: Record<number, string> = {
  4: 'amount',          // Transaction amount
  7: 'timestamp',        // Transmission date and time (MMDDHHMMSS)
  11: 'transactionId',   // System trace audit number (STAN)
  41: 'terminalId',      // Card acceptor terminal identification
  42: 'merchantId',      // Card acceptor identification code
  49: 'currency',        // Transaction currency code
};

const authorizeResponseMapping: Record<string, number> = {
  'authorizationId': 38,  // Authorization identification response
  'status': 39,           // Response code (00=approved, 05=declined)
  'amount': 4,
  'currency': 49,
  'transactionId': 11,
  'timestamp': 7,
};

const captureRequestMapping: Record<number, string> = {
  4: 'amount',
  7: 'timestamp',
  11: 'transactionId',
  37: 'authorizationId',  // Retrieval reference number (RRN) as auth ID
  41: 'terminalId',
  42: 'merchantId',
};

const captureResponseMapping: Record<string, number> = {
  'captureId': 37,        // RRN
  'status': 39,
  'amount': 4,
  'currency': 49,
  'transactionId': 11,
  'timestamp': 7,
};

const reverseRequestMapping: Record<number, string> = {
  4: 'amount',
  7: 'timestamp',
  11: 'transactionId',
  37: 'authorizationId',
  41: 'terminalId',
  42: 'merchantId',
  56: 'reason',          // Additional data (reason code)
};

const reverseResponseMapping: Record<string, number> = {
  'reversalId': 37,
  'status': 39,
  'amount': 4,
  'currency': 49,
  'transactionId': 11,
  'timestamp': 7,
};

// MTI to operation mapping
const mtiToOperation: Record<string, string> = {
  '0100': 'authorize',
  '0110': 'authorize_response',
  '0200': 'capture',
  '0210': 'capture_response',
  '0420': 'reverse',
  '0430': 'reverse_response',
  '0220': 'offline_advice',
};

// Operation to MTI mapping
const operationToMti: Record<string, string> = {
  'authorize': '0110',
  'capture': '0210',
  'reverse': '0430',
  'offline_advice': '0230',  // Assuming 0230 for advice response
};

// Error code mapping to ISO response codes
const errorToIsoResponseCode: Record<string, string> = {
  'INVALID_REQUEST': '12',      // Invalid transaction
  'UNAUTHORIZED': '01',         // Refer to card issuer
  'FORBIDDEN': '57',            // Transaction not permitted
  'AUTHORIZATION_NOT_FOUND': '33', // Expired card
  'CAPTURE_NOT_FOUND': '33',
  'INSUFFICIENT_FUNDS': '51',   // Insufficient funds
  'AMOUNT_MISMATCH': '13',      // Invalid amount
  'DUPLICATE_TRANSACTION': '94', // Duplicate transaction
  'INVALID_SIGNATURE': '88',    // Cryptographic failure
  'INVALID_IDEMPOTENCY_KEY': '12',
  'TIMEOUT': '68',              // Response received too late
  'SERVICE_UNAVAILABLE': '91',  // Issuer or switch inoperative
  'INTERNAL_ERROR': '06',       // Error
};

// Validation rules
const requiredFields: Record<string, number[]> = {
  'authorize': [4, 7, 11, 41, 42, 49],
  'capture': [4, 7, 11, 37, 41, 42],
  'reverse': [4, 7, 11, 37, 41, 42],
  'offline_advice': [4, 7, 11, 41, 42, 49],
};

// Helper function to validate ISO message
function validateIsoMessage(mti: string, fields: Record<number, any>): { valid: boolean; error?: string } {
  const operation = mtiToOperation[mti];
  if (!operation) {
    return { valid: false, error: 'Unsupported MTI' };
  }

  const required = requiredFields[operation] || [];
  for (const field of required) {
    if (!(field in fields)) {
      return { valid: false, error: `Missing required field ${field}` };
    }
  }

  // Additional validations can be added here
  return { valid: true };
}

// Convert ISO 8583 message to REST API request
export function isoToRestRequest(isoMessage: Buffer): { operation: string; request: any; correlationId: string | undefined } | { error: string } {
  try {
    const iso = new Iso8583();
    iso.setMessage(isoMessage);

    const mti = iso.getMti();
    const fields = iso.getFields();

    const validation = validateIsoMessage(mti, fields);
    if (!validation.valid) {
      return { error: validation.error! };
    }

    const operation = mtiToOperation[mti]!;
    const mapping = getRequestMapping(operation);

    const request: any = {};
    for (const [fieldNum, fieldName] of Object.entries(mapping)) {
      const value = fields[parseInt(fieldNum)];
      if (value !== undefined) {
        request[fieldName] = value;
      }
    }

    // Special handling for timestamp (ISO format)
    if (request.timestamp) {
      // Assume MMDDHHMMSS, convert to ISO string (simplified)
      // In real implementation, parse properly
      request.timestamp = new Date().toISOString(); // Placeholder
    }

    // Correlation ID from STAN (field 11)
    const correlationId = fields[11] || 'unknown';

    return { operation, request, correlationId };
  } catch (err) {
    return { error: 'Failed to parse ISO message' };
  }
}

// Convert REST API response to ISO 8583 message
export function restToIsoResponse(operation: string, response: any, correlationId: string): Buffer | { error: string } {
  try {
    const iso = new Iso8583();
    const mti = operationToMti[operation];
    if (!mti) {
      return { error: 'Unsupported operation' };
    }

    iso.setMti(mti);

    const mapping = getResponseMapping(operation);

    for (const [fieldName, fieldNum] of Object.entries(mapping)) {
      let value = response[fieldName];
      if (value !== undefined) {
        if (fieldName === 'status') {
          // Map status to response code
          if (value === 'approved' || value === 'captured' || value === 'reversed' || value === 'refunded') {
            value = '00'; // Approved
          } else if (value === 'declined') {
            value = '05'; // Do not honor
          } else if (response.errorCode) {
            value = errorToIsoResponseCode[response.errorCode] || '06';
          }
        }
        iso.setField(fieldNum, value);
      }
    }

    // Set correlation ID back to STAN
    if (correlationId) {
      iso.setField(11, correlationId);
    }

    return iso.getMessage();
  } catch (err) {
    return { error: 'Failed to build ISO message' };
  }
}

// Helper functions
function getRequestMapping(operation: string): Record<number, string> {
  switch (operation) {
    case 'authorize':
    case 'offline_advice':
      return authorizeRequestMapping;
    case 'capture':
      return captureRequestMapping;
    case 'reverse':
      return reverseRequestMapping;
    default:
      return {};
  }
}

function getResponseMapping(operation: string): Record<string, number> {
  switch (operation) {
    case 'authorize':
    case 'offline_advice':
      return authorizeResponseMapping;
    case 'capture':
      return captureResponseMapping;
    case 'reverse':
      return reverseResponseMapping;
    default:
      return {};
  }
}

// Rejection codes (for reference)
export const rejectionCodes: Record<string, string> = {
  '00': 'Approved',
  '01': 'Refer to card issuer',
  '05': 'Do not honor',
  '06': 'Error',
  '12': 'Invalid transaction',
  '13': 'Invalid amount',
  '33': 'Expired card',
  '51': 'Insufficient funds',
  '57': 'Transaction not permitted',
  '68': 'Response received too late',
  '88': 'Cryptographic failure',
  '91': 'Issuer or switch inoperative',
  '94': 'Duplicate transaction',
};