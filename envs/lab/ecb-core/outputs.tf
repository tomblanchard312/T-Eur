# Lab Environment - ECB Core Zone Outputs

output "zone_name" {
  description = "Zone name"
  value       = local.zone_name
}

output "environment" {
  description = "Environment name"
  value       = local.environment
}

# PKI Outputs
output "pki_namespace" {
  description = "PKI namespace"
  value       = module.pki_root.namespace
}

output "ca_cert_secret" {
  description = "CA certificate secret name"
  value       = module.pki_root.ca_cert_secret_name
}

# DNS Outputs
output "dns_namespace" {
  description = "DNS namespace"
  value       = module.dns_authoritative.namespace
}

output "dns_service" {
  description = "DNS service FQDN"
  value       = module.dns_authoritative.service_fqdn
}

# Ledger Outputs
output "ledger_namespace" {
  description = "Ledger namespace"
  value       = module.ledger_node.namespace
}

output "ledger_rpc_endpoint" {
  description = "Ledger RPC endpoint"
  value       = module.ledger_node.rpc_endpoint
}

output "ledger_ws_endpoint" {
  description = "Ledger WebSocket endpoint"
  value       = module.ledger_node.ws_endpoint
}
