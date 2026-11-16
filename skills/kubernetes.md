---
id: kubernetes
name: Kubernetes
description: Workloads, pods, events, HPA, nodes — kubectl/Lens/EKS/GKE UIs
triggers: kubernetes, k8s, kubectl, pod, crashloop, oomkilled, hpa, kube
---

# Kubernetes (screen companion)

## Read the mark first
Kind (Pod/Deployment/Node/HPA), namespace, name, Ready/Restarts, Events message.

## Patterns
- **CrashLoopBackOff** + rising restarts → container command/config/deps; check previous logs.
- **OOMKilled** → raise limits or fix leak; requests vs limits mismatch.
- **Pending** → Insufficient CPU/memory, PVC unbound, affinity, taints.
- **ImagePullBackOff** → registry auth/tag.
- **HPA flapping** → wrong metric / too-small window / noisy saturation.

Keep answers tied to the visible object; don’t invent cluster names.
