# HMAC request signing

State-changing API-key requests can be protected with HMAC-SHA256 request signatures.

## Configuration

Set the following environment variables:

- `REQUIRE_HMAC_SIGNATURES=true`
- `HMAC_SHARED_SECRET=<at least 32 random characters>`
- `HMAC_MAX_SKEW_SECONDS=300` (optional, maximum 900)

Signing is enabled by default in `staging` and `production`. It is disabled by default in `development` and `test` unless explicitly enabled.

The shared secret must be stored in a secret manager and must never be committed to source control. This implementation is a transitional control; production deployments should move to a separate secret per institution or API key.

## Required headers

Signed requests use:

- `X-API-Key` (or the configured API key header)
- `X-tEUR-Timestamp`: Unix time in milliseconds
- `X-tEUR-Nonce`: unique 16-128 character value
- `X-tEUR-Signature`: `v1=` followed by a hexadecimal HMAC-SHA256 digest

GET, HEAD, OPTIONS, and bearer-token requests are not HMAC-signed by this middleware.

## Canonical request

Join these fields with a newline character:

```text
v1
<api-key-id>
<timestamp>
<nonce>
<HTTP method in uppercase>
<original path including query string>
<SHA-256 hex digest of the exact request body bytes>
```

Compute:

```text
HMAC-SHA256(HMAC_SHARED_SECRET, canonical-request)
```

Send the hexadecimal digest as:

```text
X-tEUR-Signature: v1=<digest>
```

The server rejects stale timestamps, malformed signatures, invalid signatures, and reused nonces. Nonces are scoped to the API-key identifier and retained for the configured timestamp window.

## Key management recommendation

The current shared-secret mechanism improves integrity and replay resistance but should not be the final institutional design. The next iteration should store an independent signing secret or asymmetric public key for each participant and support controlled key rotation, revocation, and overlapping activation windows.
