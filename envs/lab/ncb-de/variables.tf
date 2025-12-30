# Lab Environment - NCB-DE Zone Variables

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

variable "storage_class" {
  description = "Kubernetes storage class"
  type        = string
  default     = "standard"
}
