---
id: kafka
name: Kafka / MSK
description: Brokers, consumer lag, under-replicated partitions, MSK metrics
triggers: kafka, msk, consumer lag, under-replicated, partition, offset
---

# Kafka / MSK (screen companion)

## Read the mark first
Cluster, topic, consumer group, broker ID, lag chart time range.

## Patterns
- **Consumer lag rising** → slow consumers, rebalances, blocked downstream DB, insufficient partitions/consumers.
- **Under-replicated partitions** → broker disk/network/ISR issues.
- **Produce/fetch errors + timeouts** → often capacity or auth (IAM/SASL), not “Kafka is down”.
- MSK: check CloudWatch `CpuIdle`, `KafkaDataLogsDiskUsed`, `OfflinePartitionsCount` when those panels are visible.

Tie lag spikes to app services named in the mark when present.
