---
id: datadog
name: Datadog
description: APM, Logs, Monitors, Metrics, RUM, Infrastructure hosts
triggers: datadog, apm, trace, monitor, facet, @service, rum, watchdog
---

# Datadog (screen companion)

## Read the mark first
Identify product surface: **Logs**, **APM Trace**, **Monitor**, **Metrics**, **Infra**, **RUM**. Copy service, env, status, and timestamp from the UI.

## Logs
- Prefer `service`, `status:error`, `resource_name`, `@http.status_code`, DB/timeout strings.
- Common incident phrases: `timeout`, `connection refused`, `too many connections`, `ACU limit`, `deadline exceeded`, `5xx`.
- Correlate with **same time window** as CloudWatch/GCP metrics when the user marked both.

## APM
- Flame graph / span errors: note slow span service, not just the entry service.
- p99 latency spikes with healthy infra → lock contention, downstream, cold start, or N+1.

## Monitors
- Alert vs Warn; query thresholds; evaluation window; “no data” ≠ healthy by default.

## Answer pattern
Quote the failing log/span → name owning service → likely dependency → what to check next in AWS/GCP/k8s if relevant.
