---
id: gcp
name: GCP
description: Cloud Monitoring, Cloud Run, GKE, Cloud SQL, Pub/Sub, Logging
triggers: gcp, google cloud, cloud run, gke, cloud sql, stackdriver, pub/sub, bigquery
---

# GCP (screen companion)

## Read the mark first
Name the product (Cloud Run, GKE, Cloud SQL, Pub/Sub, Logging, Monitoring). Quote metric + resource labels.

## High-signal
- **Cloud Run**: concurrency, cold starts, CPU/memory throttling, 429/503 from max instances.
- **Cloud SQL**: CPU, memory, connections, replication lag; disk utilization → write stalls.
- **GKE**: OOMKilled, CrashLoop, node pressure (memory/disk), HPA thrash.
- **Pub/Sub**: undelivered messages, ack deadline / oldest unacked age.
- **Logging**: severity ERROR/CRITICAL; pair `trace` / `httpRequest.status` with Monitoring charts.

## Answer pattern
Resource → metric anomaly → likely app effect → next log filter or console page.
