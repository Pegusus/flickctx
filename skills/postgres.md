---
id: postgres
name: Postgres
description: Query latency, locks, connections, RDS/Cloud SQL Postgres panels
triggers: postgres, postgresql, pg_, vacuum, deadlock, max_connections
---

# Postgres (screen companion)

## Patterns visible in UIs
- Connection saturation vs `max_connections` / pool size.
- Lock waits / blocked queries → look for long transactions.
- Sudden spike in rollback/deadlock metrics.
- Autovacuum lag / bloat symptoms when disk + latency rise together.
- On managed Postgres: map to ACU/CPU/storage metrics if AWS/GCP panels are shown.
