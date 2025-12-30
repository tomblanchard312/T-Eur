# Lab Environment - ECB Core Zone Variables

variable "kubeconfig_path" {
  description = "Path to kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "kubeconfig_context" {
  description = "Kubernetes context to use"
  type        = string
  default     = null
}

variable "dns_replicas" {
  description = "Number of DNS server replicas"
  type        = number
  default     = 1 # Single replica for lab
}

variable "validator_count" {
  description = "Number of Besu validator nodes"
  type        = number
  default     = 4 # Minimum for QBFT consensus
}

variable "storage_class" {
  description = "Kubernetes storage class"
  type        = string
  default     = "standard"
}
