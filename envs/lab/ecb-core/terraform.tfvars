# Lab Environment - ECB Core Zone
# Default variable values for local development

# Kubernetes Configuration
kubeconfig_path    = "~/.kube/config"
kubeconfig_context = null # Use current context

# Resource Scaling (minimal for lab)
dns_replicas    = 1
validator_count = 4

# Storage
storage_class = "standard"
