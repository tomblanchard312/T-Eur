# Lab Environment - NCB-DE Zone Outputs

output "zone_name" {
  description = "Zone name"
  value       = local.zone_name
}

output "environment" {
  description = "Environment name"
  value       = local.environment
}

output "dns_namespace" {
  description = "DNS namespace"
  value       = module.dns_authoritative.namespace
}

output "dns_service" {
  description = "DNS service FQDN"
  value       = module.dns_authoritative.service_fqdn
}

output "ledger_namespace" {
  description = "Ledger namespace"
  value       = module.ledger_node.namespace
}

output "ledger_rpc_endpoint" {
  description = "Ledger RPC endpoint"
  value       = module.ledger_node.rpc_endpoint
}
