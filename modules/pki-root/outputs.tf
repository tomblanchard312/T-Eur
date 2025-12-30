# PKI Root Module Outputs

output "namespace" {
  description = "PKI namespace"
  value       = kubernetes_namespace.pki.metadata[0].name
}

output "ca_cert" {
  description = "Root CA certificate in PEM format"
  value       = tls_self_signed_cert.root_ca.cert_pem
  sensitive   = false
}

output "ca_cert_secret_name" {
  description = "Kubernetes secret name containing CA certificate"
  value       = kubernetes_secret.root_ca_cert.metadata[0].name
}

output "ca_bundle_configmap_name" {
  description = "ConfigMap name containing CA bundle"
  value       = kubernetes_config_map.root_ca_bundle.metadata[0].name
}

output "ca_validity_end" {
  description = "CA certificate expiration timestamp"
  value       = tls_self_signed_cert.root_ca.validity_end_time
}
