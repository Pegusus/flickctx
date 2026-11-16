---
id: github-actions
name: GitHub Actions
description: Workflow runs, failed jobs, annotations, OIDC/cloud deploy steps
triggers: github actions, workflow, ci, actions, job failed
---

# GitHub Actions (screen companion)

## Patterns
- Failed step name + exit code from the log pane.
- Flaky tests vs deterministic compile errors.
- Secrets / OIDC assume-role failures when deploying to AWS/GCP.
- Cache miss → longer builds (not always a failure).
Point to the exact job/step visible in the mark.
