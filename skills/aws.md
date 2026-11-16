---
id: aws
name: AWS
description: CloudWatch, RDS/Aurora ACU, EKS, MSK, ALB/NLB, IAM consoles
triggers: aws, cloudwatch, rds, aurora, acu, eks, msk, elb, alb, s3, lambda, console.aws
---

# AWS (screen companion)

## Read the mark first
Name the service from the console chrome (RDS, EKS, MSK, EC2, Lambda, S3, ELB). Quote metric names and dimensions exactly.

## High-signal metrics
- **Aurora Serverless ACUUtilization / ACU**: near 100% → capacity throttle; pair with connection errors / statement timeouts in app logs.
- **CPUCreditBalance** (T-class): falling to 0 → throttle, not “needs more RAM” by default.
- **RDS DatabaseConnections** vs max_connections / instance class limits.
- **EKS**: Pending pods → resources/affinity; CrashLoopBackOff → container logs; Node NotReady → CNI/disk/kubelet.
- **MSK / Kafka**: under-replicated partitions, consumer lag, bursty produce failures → broker disk / ISR / client timeouts.
- **ALB 5XXs**: distinguish target 5xx vs ELB 5xx; check unhealthy host count + target response time.

## Answer pattern
1) What console + resource is shown  
2) What the metric/alarm is doing  
3) Likely blast radius (API, jobs, consumers)  
4) Next check (which log/metric) — use Datadog/GCP skills only if those UIs are also marked
