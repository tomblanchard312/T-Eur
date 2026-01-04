const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const reconciliationSchema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Reconciliation Batch",
  "type": "object",
  "properties": {
    "device_id": { "type": "string", "minLength": 1, "maxLength": 100 },
    "wallet_id": { "type": "string", "minLength": 1, "maxLength": 100 },
    "transactions": {
      "type": "array",
      "minItems": 1,
      "maxItems": 1000,
      "items": {
        "type": "object",
        "properties": {
          "sequence_number": { "type": "integer", "minimum": 1, "maximum": 2147483647 },
          "amount": { "type": "integer", "minimum": -1000000, "maximum": 1000000 },
          "signature": { "type": "string", "minLength": 1, "maxLength": 1000 },
          "timestamp": { "type": "string", "format": "date-time" }
        },
        "required": ["sequence_number", "amount", "signature"],
        "additionalProperties": false
      }
    }
  },
  "required": ["device_id", "wallet_id", "transactions"],
  "additionalProperties": false
};

const ajv = new Ajv({
  strict: true,
  allErrors: true,
  removeAdditional: false,
  useDefaults: false,
  coerceTypes: false
});
addFormats(ajv);

const validateBatch = ajv.compile(reconciliationSchema);

function validateReconciliationBatch(batch, maxBatchSize) {
  // Size check
  if (batch.transactions && batch.transactions.length > maxBatchSize) {
    return {
      valid: false,
      error: `Batch size ${batch.transactions.length} exceeds maximum ${maxBatchSize}`
    };
  }

  // Schema validation
  const valid = validateBatch(batch);
  if (!valid) {
    return {
      valid: false,
      error: `Schema validation failed: ${ajv.errorsText(validateBatch.errors)}`
    };
  }

  // Additional business logic validation
  const sequenceNumbers = new Set();
  for (const transaction of batch.transactions) {
    // Check for duplicate sequence numbers in batch
    if (sequenceNumbers.has(transaction.sequence_number)) {
      return {
        valid: false,
        error: `Duplicate sequence number ${transaction.sequence_number} in batch`
      };
    }
    sequenceNumbers.add(transaction.sequence_number);

    // Validate sequence number is reasonable (not too far in future)
    if (transaction.sequence_number > Date.now() / 1000 + 86400) { // Allow up to 1 day in future
      return {
        valid: false,
        error: `Sequence number ${transaction.sequence_number} is unreasonably large`
      };
    }
  }

  return { valid: true };
}

module.exports = { validateReconciliationBatch };