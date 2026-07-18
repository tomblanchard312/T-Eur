# ADR-003: Institutional mTLS Identity

Status: Accepted

## Decision

Mutual TLS will terminate at a dedicated ingress proxy rather than inside the Node.js API process.

The reference deployment will use Envoy. A managed ingress with equivalent controls is acceptable when it can enforce the same certificate, header, and network requirements.

## Certificate identity

- Certificates are issued by the tEUR institutional private CA hierarchy.
- The authoritative institution identity is carried in a URI SAN:

```text
spiffe://teur.example/institution/{institutionId}
```

- Common Name is informational only and is never used for authorization.
- The API binds the URI SAN institution ID to the API key/JWT institution and rejects mismatches.
- The SHA-256 certificate fingerprint is included in audit metadata.

## Request flow

1. The ingress validates the client certificate chain, validity period, permitted key usage, and revocation status.
2. The ingress removes all externally supplied certificate identity headers.
3. The ingress injects verified identity headers containing institution ID, certificate fingerprint, issuer identifier, and verification status.
4. The ingress forwards traffic to the API over a private authenticated channel.
5. The API accepts identity headers only when the request originates from a configured trusted ingress address and includes an ingress-to-API authentication token.
6. Privileged requests must also pass the existing application credential controls, including HMAC signing for API-key clients.

mTLS is an additional factor. It does not replace HMAC, JWT validation, authorization, idempotency, or audit controls.

## Protected routes

mTLS is mandatory for:

- mint and burn
- escrow create, release, burn, cancel, and migration
- freeze and unfreeze
- governance proposals and approvals
- emergency pause and recovery
- audit export
- institutional role and key administration

Public health endpoints and explicitly public read-only metadata endpoints do not require a client certificate.

## Rotation and revocation

- Standard institutional certificates have a maximum validity of 90 days.
- Automated renewal begins 30 days before expiry.
- A 14-day overlap period is permitted during planned rotation.
- Revocation is enforced through short-lived certificates plus an ingress denylist refreshed at least every five minutes.
- Emergency revocation immediately blocks the fingerprint and institution ID at ingress.
- Certificate material is never stored in application logs.

## Trust boundary

- The API service is not publicly reachable except through the trusted ingress.
- Certificate headers from any other source are rejected.
- Trusted proxy addresses are explicit CIDRs, never a hop count alone.
- The ingress-to-API token is rotated independently from institutional certificates.

## Failure behavior

Privileged requests fail closed when:

- no client certificate is presented
- the certificate is expired, revoked, untrusted, or has invalid usage
- the URI SAN is absent or malformed
- the certificate institution does not match the application credential institution
- certificate headers are received from an untrusted source
- the ingress authentication token is missing or invalid

## Deployment decision

Development may use a local test CA and Envoy container. Staging must use two independently issued institutional certificates and exercise rotation and revocation before production approval.