# DNS Authoritative Module Variables

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

variable "replicas" {
  description = "Number of DNS server replicas"
  type        = number
  default     = 2

  validation {
    condition     = var.replicas >= 1
    error_message = "At least one replica is required."
  }
}

variable "zones" {
  description = "DNS zone configurations"
  type = map(object({
    records = list(object({
      name  = string
      type  = string
      ttl   = number
      value = string
    }))
  }))
}

variable "coredns_image" {
  description = "CoreDNS container image"
  type        = string
  default     = "coredns/coredns:1.11.1"
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
      cpu    = "100m"
      memory = "128Mi"
    }
    limits = {
      cpu    = "500m"
      memory = "256Mi"
    }
  }
}
