# tEUR Acquirer API v1.1 Certification Test Vectors

This directory contains structured test vectors for certifying implementations of the tEUR Acquirer API v1.1.

## Structure

- `online/*.json`: Test vectors for online transaction flows
- `offline/*.json`: Test vectors for offline transaction flows

## Test Vector Format

Each JSON file contains:

- `description`: Human-readable test description
- `request`: HTTP request details (headers, body)
- `expected_response`: Expected HTTP response (status, headers, body)
- `expected_scheme_code`: Expected scheme-level reason code
- `expected_audit_events`: Array of expected audit events

## Online Test Vectors

### approve.json

Tests successful authorization approval.

### decline_insufficient_funds.json

Tests decline due to insufficient funds.

### invalid_signature.json

Tests rejection of invalid JWS signature.

### idempotency_replay.json

Tests idempotent replay of identical request.

### idempotency_conflict.json

Tests conflict on idempotency key with different body.

### clock_skew_exceeded.json

Tests rejection due to excessive clock skew.

### reversal_after_approve.json

Tests reversal of approved authorization.

### refund_after_capture.json

Tests refund of captured transaction.

## Offline Test Vectors

### offline_token_accepted_then_advice_accepted.json

Tests offline token acceptance and subsequent advice acceptance.

### offline_token_replay_rejected.json

Tests rejection of replayed offline token.

### offline_limit_exceeded_rejected.json

Tests rejection when offline limit is exceeded.

### unknown_wallet_key_rejected.json

Tests rejection of unknown wallet key.

### batch_threshold_breach_controlled_failure.json

Tests controlled failure when batch size exceeds threshold.

## Execution Instructions

1. **Setup**: Ensure mTLS certificates are configured and API is accessible
2. **Run Vectors**: For each JSON file:
   - Send the `request` to the API endpoint
   - Verify `expected_response` matches exactly
   - Check `expected_scheme_code` in response body or error
   - Query audit logs for `expected_audit_events` within 5 seconds
3. **Prerequisites**:
   - Valid acquirer credentials (X-Acquirer-Id)
   - Clock synchronized within 5 minutes
   - No prior transactions for idempotency tests
4. **Validation**:
   - All timestamps in requests must be current (within test execution time)
   - Idempotency keys must be unique across tests
   - Audit events must match exactly (including correlation_id)
5. **Failure Handling**: Any mismatch fails certification
6. **Offline Tests**: Require pre-configured offline tokens and limits

## Notes

- All vectors assume valid mTLS authentication unless testing auth failures.
- Timestamps must be adjusted for current time during execution.
- Audit events are emitted asynchronously; poll audit endpoint if needed.
- Offline vectors require coordination with wallet simulation.
