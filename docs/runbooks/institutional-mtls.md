# Institutional mTLS Operations Runbook

This runbook implements ADR-003 for privileged tEUR API operations.

## Trust boundary

The Node.js API must only be reachable from the dedicated ingress network. Envoy or an equivalent managed ingress validates institutional client certificates and forwards verified identity metadata over a private channel.

The API reads the TCP peer address from `request.socket.remoteAddress`; it does not use `X-Forwarded-For` to decide whether certificate headers are trusted.

## Required API configuration

Set the following values in staging and production:

- `MTLS_ENABLED=true`
- `MTLS_TRUSTED_INGRESS_CIDRS`: comma-separated ingress addresses or IPv4 CIDRs
- `MTLS_INGRESS_TOKEN`: independent randomly generated value of at least 32 characters
- `MTLS_REVOKED_FINGERPRINTS`: optional comma-separated SHA-256 fingerprints without colons

Staging and production configuration fails closed when mTLS is disabled, no trusted ingress range is configured, or the ingress authentication value is too short.

## Ingress-injected headers

The ingress must remove externally supplied copies of these headers before injecting its own values:

- `X-tEUR-mTLS-Verified: true`
- `X-tEUR-mTLS-Institution-Id`
- `X-tEUR-mTLS-Fingerprint`
- `X-tEUR-mTLS-Issuer`
- `X-tEUR-Ingress-Token`

The institution ID must come from the verified URI SAN:

```text
spiffe://teur.example/institution/{institutionId}
```

The fingerprint is the lowercase SHA-256 certificate fingerprint with separators removed. Certificate contents must never be forwarded or logged.

## Protected operations

The API requires mTLS plus the existing JWT or API-key authentication for:

- mint and burn
- freeze and unfreeze
- escrow create, release, and burn
- governance routes
- audit routes
- non-read-only administrative routes
- non-read-only conditional-payment routes

Ordinary wallet transfers and public health endpoints retain their existing authentication policy.

## Identity binding

The certificate institution ID must exactly match the institution ID from the JWT or API-key record. A valid certificate for one institution cannot be combined with an application credential belonging to another institution.

## Rotation

1. Issue the replacement certificate before the current certificate expires.
2. Permit both fingerprints at ingress during the approved overlap period.
3. Confirm successful requests using the replacement certificate.
4. Revoke or denylist the old fingerprint at ingress.
5. Add the old fingerprint to `MTLS_REVOKED_FINGERPRINTS` as defense in depth until all ingress instances have refreshed.
6. Restart or roll the API instances when configuration is environment-based.

## Emergency revocation

1. Block the certificate fingerprint and, when necessary, institution ID at ingress.
2. Add the fingerprint to the API denylist.
3. Revoke the corresponding application key or JWT sessions independently.
4. Record the incident reference in the audit system without storing certificate material.
5. Validate that the revoked certificate fails before restoring privileged operations.

## Validation scenarios

Staging approval requires tests for:

- two independently issued institutional certificates
- valid certificate and matching application credential
- absent certificate
- unverified certificate status
- untrusted ingress source
- invalid ingress authentication
- malformed or absent URI SAN-derived institution ID
- revoked fingerprint
- certificate/application institution mismatch
- spoofed forwarded headers from a direct client
- planned certificate overlap and removal
