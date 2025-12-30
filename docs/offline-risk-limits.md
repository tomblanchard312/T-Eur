# Offline Risk Limits

Purpose

- Define the offline caps, per-device limits, and velocity controls used to bound risk for disconnected payments.

Parameters

- `offline_cap_per_device` (cents)
- `offline_daily_velocity_per_wallet` (cents)
- `offline_reconciliation_window_seconds`

Enforcement

- Gateways must enforce device caps at reconciliation time and reject submissions that exceed configured windows.
- Alerts trigger when reconciliation backlog grows beyond thresholds.

Monitoring signals

- `teur_offline_recon_backlog_total`
- `teur_offline_disputed_transactions_total`

Acceptance criteria

- Reconciliation resolves 99.9% of offline transactions within the configured window without manual intervention.

TODO

- Tune default numeric values and include sample test vectors.
