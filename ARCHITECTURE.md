# Flickctx architecture

Flickctx is a local Electron companion: mark a region on screen, then continue in an **OpenCode** or **Claude Code** session (that session’s keys, models, and context — no Flickctx API key), or use the **Flickctx built-in** vision chat.

## Current flow

| Step | What happens |
|------|----------------|
| Discover | Mark bar (all Spaces) + menu-bar **Flickctx** + hotkey `⌘⇧F` / `Ctrl+Shift+F` |
| Route | Pick **Claude Code** or **OpenCode**, then a saved session or **+ New** — or **Flickctx built-in**. Route is remembered until you change it |
| Mark | Per-display overlay; freehand stroke → bounding box |
| Capture | Screenshot of that display, crop to the mark; keep full display as secondary context |
| Environment | Frontmost app (+ browser URL when available) snapped before overlay steals focus |
| Ask | Raw user question (no special-case prompts) |
| Deliver | **Session route:** write the crop to a temp image and stream into `claude` / `opencode` (`--resume` / `--session`, thinking + answer streamed into the chat UI). **Built-in:** Claude Messages API with crop + context + tools |
| Chat | Follow-ups stay on the same mark and the same route |

## Session routing (primary path)

```
Mark bar / hotkey
  → Route: Claude Code | OpenCode | Flickctx
  → session list (or + New)
  → freehand mark + question
  → src/sessions.js sendToAgentSession
       Claude  → claude -p --resume … (stream-json)
       OpenCode → opencode run --session … (--format json --thinking)
  → electron/result.html streams thinking + answer
```

No Flickctx API key is required for Claude Code / OpenCode routes — those CLIs use whatever auth and models that session already has.

## Built-in vision path

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
tools: [ web_search, fetch_url, list_local_repos, read_local_file, grep_local,
         repo_details, list_skills, read_skill ]
```

Used when Route = Flickctx (needs Console key, Claude login, or `FLICKCTX_PROXY_URL`).

## Optional proxy

`worker/` is a small Cloudflare Worker that forwards `/chat` to Anthropic’s Messages API. Set `FLICKCTX_PROXY_URL` so machines never store the API key.

## Key files

- `electron/main.js` — Mark bar, tray, Route menu, overlays, Spaces pinning
- `electron/launcher.html` — Mark / Route / Chat / Quit chip
- `electron/result.html` — chat UI, streaming, Markdown (incl. tables)
- `src/sessions.js` — discover Claude / OpenCode sessions; stream marks into them
- `src/explain.js` — built-in agent loop (vision + tools + thinking)
- `src/tools.js` / `src/skills.js` — web + local + on-demand product skills
- `src/repos.js` / `src/context.js` — ambient local context
- `skills/` — thin AWS / Datadog / GCP / … references (loaded only when useful)
- `site/` — marketing landing (Vercel; Root Directory should be `site`)
- `worker/` — Anthropic proxy
