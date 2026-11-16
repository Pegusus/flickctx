# Flickctx skills

Short, on-demand references for interpreting screenshots (AWS, Datadog, GCP, …).

## Design rule: do not bloat chat context

- Ambient prompts only get a **one-line catalog** of skill ids.
- The model loads a skill with the `read_skill` tool when the mark clearly matches.
- Each skill body is capped (~3.5k chars). Prefer patterns over docs dumps.

## Bundled skills

| id | Use when the mark looks like… |
|----|-------------------------------|
| `aws` | CloudWatch, RDS/Aurora ACU, EKS, MSK, ALB |
| `datadog` | Logs, APM, Monitors |
| `gcp` | Cloud Monitoring, Cloud Run, GKE, Cloud SQL |
| `kubernetes` | Pods, events, HPA |
| `kafka` | Consumer lag, MSK, under-replicated |
| `postgres` | Connections, locks, managed Postgres |
| `terraform` | Plan/apply / state lock |
| `docker` | Build/run / compose |
| `github-actions` | Workflow failures |
| `grafana` | Dashboards / Prometheus panels |

## Add your own

Drop `*.md` files in `~/.config/flickctx/skills/` (same frontmatter shape). Same `id` overrides the bundled skill.

```md
---
id: my-tool
name: My Tool
description: One line for the catalog
triggers: keyword1, keyword2
---

# My Tool
Keep this short.
```
