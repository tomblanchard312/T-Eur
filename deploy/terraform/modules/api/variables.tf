variable "root_ca_key" {
  type        = string
  description = "Root CA key for mTLS"
  sensitive   = true
}

variable "issuer_key" {
  type        = string
  description = "Issuer key"
  sensitive   = true
}

variable "acquirer_key" {
  type        = string
  description = "Acquirer key"
  sensitive   = true
}

variable "psp_key" {
  type        = string
  description = "PSP key"
  sensitive   = true
}