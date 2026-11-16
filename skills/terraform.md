---
id: terraform
name: Terraform
description: Plan/apply output, state errors, provider auth failures
triggers: terraform, tf plan, tf apply, state lock, provider
---

# Terraform (screen companion)

## Patterns
- **State lock** → who holds the lock; don’t force-unlock casually.
- **Provider auth** (AWS/GCP/Azure) → credentials/assume-role, not resource syntax.
- **Destroy/replace** in plan → call out destructive replaces explicitly.
- Quote resource addresses from the marked plan when answering.
