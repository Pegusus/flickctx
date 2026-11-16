---
id: grafana
name: Grafana
description: Dashboards, panels, Prometheus/Loki datasources, alerts
triggers: grafana, prometheus, loki, panel, datasource
---

# Grafana (screen companion)

## Patterns
- Read panel title, unit, time range, legend names before interpreting.
- Rate vs raw counters; null gaps ≠ zero.
- Alerting: pending vs firing; threshold vs anomaly.
If Prometheus query is visible, reason from that expression, not guesses.
