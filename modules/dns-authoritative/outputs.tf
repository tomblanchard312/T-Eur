# DNS Authoritative Module Outputs

output "namespace" {
  description = "Kubernetes namespace for DNS"
  value       = kubernetes_namespace.dns.metadata[0].name
}

output "service_name" {
  description = "Kubernetes service name"
  value       = kubernetes_service.dns_authoritative.metadata[0].name
}

output "cluster_ip" {
  description = "Cluster IP address of the DNS service"
  value       = kubernetes_service.dns_authoritative.spec[0].cluster_ip
}

output "service_fqdn" {
  description = "Fully qualified service name within the cluster"
  value       = "${kubernetes_service.dns_authoritative.metadata[0].name}.${kubernetes_namespace.dns.metadata[0].name}.svc.cluster.local"
}
