# Flickctx architecture

Flickctx is a desktop companion that captures a freehand-marked region of your screen, pairs it with your question, and lets a vision agent answer — with optional local repo context and web tools.

## Flow

| Step | What happens |
|------|----------------|
| Mark | Per-display Electron overlay; freehand stroke → bounding box |
| Capture | Screenshot of that display, crop to the mark |
| Ask | Raw user question (no special-case prompts) |
| Agent | Claude Messages API with image + question + tools |
| Chat | Multi-turn history keeps the same mark attached |

## Request shape

```
system: generic companion instructions (vision-first)
messages: [
  ...history...,
  user: [ image + labels, optional ambient local context, raw question ]
]
tools: [ web_search, fetch_url, list_local_repos, read_local_file, grep_local, repo_details ]
```

The model decides whether to search the web, open a docs URL, or inspect a local repo. We do **not** special-case “pricing” vs “diagram” vs “datadog” in prompts. The marked screenshot is the primary subject.

## Optional proxy

`worker/` is a small Cloudflare Worker that forwards `/chat` to Anthropic’s Messages API. Set `FLICKCTX_PROXY_URL` so machines never store the API key.

## Key files

- `src/explain.js` — agent loop (generic prompt + tools + thinking)
- `src/tools.js` — web + local tools
- `src/repos.js` / `src/context.js` — ambient local context
- `electron/` — mark overlay + chat UI
- `worker/` — Anthropic proxy
