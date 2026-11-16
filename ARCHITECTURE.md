# Flickctx architecture

Flickctx is a desktop companion that captures a freehand-marked region of your screen, pairs it with your question, and lets a vision agent answer — with optional local repo context and web tools.

## Flow

| Step | What happens |
|------|----------------|
| Mark | Per-display Electron overlay; freehand stroke → bounding box |
| Capture | Screenshot of that display, crop to the mark; keep full display as secondary context |
| Environment | Frontmost app (+ browser URL when available) snapped before overlay steals focus |
| Ask | Raw user question (no special-case prompts) |
| Vision prep | Resize long edge (~1600) + JPEG compress for the API |
| Agent | Claude Messages API: primary crop + optional full-display + hint + question + tools |
| Chat | Multi-turn history keeps the same mark attached |

## Request shape

```
system: generic companion instructions (vision-first)
messages: [
  ...history...,
  user: [
    primary crop (JPEG),
    optional full-display context (JPEG),
    optional frontmost app/URL hint,
    raw question,
    optional ambient local context
  ]
]
tools: [ web_search, fetch_url, list_local_repos, read_local_file, grep_local, repo_details, list_skills, read_skill ]
```

The model decides whether to search the web, open a docs URL, inspect a local repo, or load a **product skill**. Bundled skills (`skills/*.md`) stay out of the prompt body — ambient context only lists skill ids; `read_skill` loads at most ~3.5k chars when the mark matches. The marked screenshot is still the primary subject.

## Optional proxy

`worker/` is a small Cloudflare Worker that forwards `/chat` to Anthropic’s Messages API. Set `FLICKCTX_PROXY_URL` so machines never store the API key.

## Key files

- `src/explain.js` — agent loop (generic prompt + tools + thinking)
- `src/tools.js` — web + local + skills tools
- `src/skills.js` — on-demand skill catalog / reader
- `skills/` — bundled AWS/Datadog/GCP/… references (thin)
- `src/repos.js` / `src/context.js` — ambient local context
- `electron/` — mark overlay + chat UI
- `worker/` — Anthropic proxy
