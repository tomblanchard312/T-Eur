# Ledger Node Module Outputs

output "namespace" {
  description = "Kubernetes namespace for the ledger"
  value       = kubernetes_namespace.ledger.metadata[0].name
}

output "service_name" {
  description = "Headless service name for P2P discovery"
  value       = kubernetes_service.besu_headless.metadata[0].name
}

output "rpc_service_name" {
  description = "RPC service name"
  value       = kubernetes_service.besu_rpc.metadata[0].name
}

output "rpc_endpoint" {
  description = "Internal RPC endpoint URL"
  value       = "http://${kubernetes_service.besu_rpc.metadata[0].name}.${kubernetes_namespace.ledger.metadata[0].name}.svc.cluster.local:8545"
}

output "ws_endpoint" {
  description = "Internal WebSocket endpoint URL"
  value       = "ws://${kubernetes_service.besu_rpc.metadata[0].name}.${kubernetes_namespace.ledger.metadata[0].name}.svc.cluster.local:8546"
}

output "statefulset_name" {
  description = "StatefulSet name"
  value       = kubernetes_stateful_set.besu.metadata[0].name
}
