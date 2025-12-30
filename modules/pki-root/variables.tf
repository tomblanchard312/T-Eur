# PKI Root Module Variables

variable "zone_name" {
  description = "Zone identifier (e.g., ecb-core, ncb-de)"
  type        = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]*$", var.zone_name))
    error_message = "Zone name must be lowercase, hyphen-separated, ASCII only."
  }
}

variable "environment" {
  description = "Environment name (lab, int, stg, prd)"
  type        = string

  validation {
    condition     = contains(["lab", "int", "stg", "prd"], var.environment)
    error_message = "Environment must be one of: lab, int, stg, prd."
  }
}

variable "organization" {
  description = "Organization name for certificate subject"
  type        = string
}

variable "validity_years" {
  description = "Certificate validity period in years"
  type        = number
  default     = 10

  validation {
    condition     = var.validity_years >= 1 && var.validity_years <= 20
    error_message = "Validity must be between 1 and 20 years."
  }
}
