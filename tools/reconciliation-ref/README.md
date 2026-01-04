# tEUR Reconciliation Service

Production-grade reconciliation service for processing offline tEUR transaction batches. This service ensures deterministic deduplication, auditability, and compliance with DORA and ECB digital euro principles.

## Environment Configuration

The service must be configured with the `TEUR_ENV` environment variable:

```bash
export TEUR_ENV=lab     # Development and testing
export TEUR_ENV=test    # Automated testing with seeded data
export TEUR_ENV=pilot   # Pre-production with file rotation
export TEUR_ENV=prod    # Production with durable storage
```

If `TEUR_ENV` is missing or invalid, the service fails fast at startup.

## Environment Behaviors

### Lab Environment (`TEUR_ENV=lab`)

- **Purpose**: Development and manual testing
- **Storage**: Local JSON file with integrity checks
- **Limits**: Max 100 transactions per batch, 1MB request size
- **Retention**: 30 days
- **Use Case**: Local development and integration testing

### Test Environment (`TEUR_ENV=test`)

- **Purpose**: Automated testing
- **Storage**: In-memory with deterministic seeding
- **Limits**: Max 50 transactions per batch, 500KB request size
- **Retention**: 1 day (ephemeral)
- **Use Case**: CI/CD pipelines and automated test suites

### Pilot Environment (`TEUR_ENV=pilot`)

- **Purpose**: Pre-production validation
- **Storage**: Rotating append-only files with integrity
- **Limits**: Max 1000 transactions per batch, 5MB request size
- **Retention**: 90 days with 24-hour rotation
- **Use Case**: Production-like testing before full deployment

### Production Environment (`TEUR_ENV=prod`)

- **Purpose**: Live transaction processing
- **Storage**: Pluggable durable store (requires configuration)
- **Limits**: Max 5000 transactions per batch, 10MB request size
- **Retention**: 7 years (ECB compliance)
- **Use Case**: Production reconciliation processing

## API Endpoints

### POST /ingest

Process a reconciliation batch.

**Request Body**: JSON conforming to `docs/json-schemas/reconciliation.schema.json`

**Response**:

```json
{
  "accepted": [1, 2, 3],
  "rejected": [
    {
      "sequence_number": 4,
      "reason": "duplicate_sequence_number"
    }
  ],
  "correlation_id": "rec-1640995200000-abc123def"
}
```

### GET /health

Service health check.

**Response**:

```json
{
  "status": "healthy",
  "environment": "lab",
  "timestamp": "2026-01-03T12:00:00.000Z",
  "storage": {
    "totalKeys": 5,
    "totalSequences": 150
  }
}
```

### GET /metrics

Operational metrics (counts only).

**Response**:

```json
{
  "ingests_accepted": 42,
  "ingests_rejected": 3,
  "duplicates_detected": 7,
  "integrity_violations": 0,
  "timestamp": "2026-01-03T12:00:00.000Z"
}
```

## Installation and Setup

1. Install dependencies:

```bash
npm install
```

2. Set environment:

```bash
export TEUR_ENV=lab
export PORT=8081  # Optional, defaults to 8081
```

3. Start service:

```bash
npm start
```

## Data Persistence

The service maintains idempotency by tracking processed `(device_id, wallet_id, sequence_number)` tuples:

- **Deduplication**: Rejects duplicate sequence numbers with explicit error
- **Atomicity**: All-or-nothing batch processing
- **Integrity**: SHA-256 checksums for data validation
- **Replay Protection**: Processed transactions survive restarts

## Audit and Compliance

All operations emit structured JSON audit events:

```json
{
  "timestamp": "2026-01-03T12:00:00.000Z",
  "severity": "INFO",
  "component": "reconciliation-ref",
  "event_type": "ingest_accepted",
  "correlation_id": "rec-1640995200000-abc123def",
  "device_id": "device123",
  "wallet_id": "wallet456",
  "accepted_count": 5,
  "rejected_count": 0
}
```

## Security and Resilience

- **No Silent Failures**: All errors are logged and returned to client
- **Input Validation**: Strict JSON schema enforcement
- **Resource Limits**: Configurable batch sizes and request limits
- **Graceful Shutdown**: SIGTERM/SIGINT handling with data persistence
- **No External Dependencies**: Self-contained operation

## Upgrade Path

### From Lab to Pilot

1. Change `TEUR_ENV=pilot`
2. Configure file rotation directory permissions
3. Test with larger batch sizes
4. Validate log rotation and retention

### From Pilot to Production

1. Implement durable storage backend
2. Configure production storage connection
3. Set `TEUR_ENV=prod`
4. Enable monitoring and alerting
5. Perform load testing with production limits

## Schema Reference

See `docs/json-schemas/reconciliation.schema.json` for complete batch format specification.

## Important Notes

- **Non-Production Warning**: `lab` and `test` environments are not suitable for production use
- **Data Retention**: Production environment retains data for 7 years per regulatory requirements
- **Monitoring**: Implement external monitoring of `/health` and `/metrics` endpoints
- **Backup**: Regular backups of storage data are recommended for all environments
