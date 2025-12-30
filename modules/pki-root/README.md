# PKI Root Module

This module deploys a root Certificate Authority for tEUR mTLS infrastructure.

## Usage

```hcl
module "pki_root" {
  source = "../../modules/pki-root"

  zone_name    = "ecb-core"
  environment  = "lab"
  organization = "European Central Bank"
  
  validity_years = 10
}
```

## Security Notice

Root CA private keys must be protected with hardware security modules (HSM) in production environments.

## Inputs

| Name | Description | Type | Required |
|------|-------------|------|----------|
| zone_name | Zone identifier | string | yes |
| environment | Environment name | string | yes |
| organization | Certificate organization | string | yes |
| validity_years | Certificate validity period | number | no |

## Outputs

| Name | Description |
|------|-------------|
| ca_cert | Root CA certificate (PEM) |
| ca_cert_secret_name | Secret name containing CA cert |
