# Ledger Node Module Variables

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

variable "role" {
  description = "Node role (validator, bootnode)"
  type        = string

  validation {
    condition     = contains(["validator", "bootnode"], var.role)
    error_message = "Role must be one of: validator, bootnode."
  }
}

variable "replicas" {
  description = "Number of Besu nodes"
  type        = number
  default     = 4

  validation {
    condition     = var.replicas >= 1
    error_message = "At least one node is required."
  }
}

variable "genesis_config" {
  description = "Genesis configuration"
  type = object({
    chain_id     = number
    block_period = number
  })
  default = {
    chain_id     = 1337
    block_period = 2
  }
}

variable "besu_image" {
  description = "Hyperledger Besu container image"
  type        = string
  default     = "hyperledger/besu:24.1.0"
}

variable "storage_class" {
  description = "Kubernetes storage class for persistent volumes"
  type        = string
  default     = "standard"
}

variable "storage_size" {
  description = "Size of persistent volume for blockchain data"
  type        = string
  default     = "50Gi"
}

variable "resources" {
  description = "Container resource requests and limits"
  type = object({
    requests = object({
      cpu    = string
      memory = string
    })
    limits = object({
      cpu    = string
      memory = string
    })
  })
  default = {
    requests = {
      cpu    = "500m"
      memory = "2Gi"
    }
    limits = {
      cpu    = "2000m"
      memory = "4Gi"
    }
  }
}
