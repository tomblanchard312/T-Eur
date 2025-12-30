# Chaos Test Skeletons

This folder contains skeleton scripts to help simulate failure modes for resilience testing. They are templates and require adaptation to your lab environment.

Files:

- `simulate_dns_partition.sh` — approaches to simulate DNS failures / split-horizon issues.
- `simulate_zone_loss.sh` — approaches to simulate an entire zone going offline (scale down, cordon, or network isolation).

Usage notes:

- Run these scripts only in controlled lab environments.
- Ensure you have backups and a recovery plan before executing any disruption.
