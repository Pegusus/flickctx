# Flickctx architecture

Flickctx is a local Electron companion: mark a region on screen, then continue in an **OpenCode** or **Claude Code** session — that session’s auth, models, and context.

## Technical design

```
Electron main process
  ├─ Launcher / Tray / Overlay×N / Chat / Highlights   (IPC)
  └─ Capture pipeline
       screen → crop JPEG → frontmost + context frame
            └─ Session bridge  →  claude / opencode CLI (stream)
                    └─ stream → Chat window (result:stream)
```

## Current flow

| Step | What happens |
|------|----------------|
| Discover | Mark bar (all Spaces) + menu-bar **Flickctx** + hotkey `⌘⇧F` / `Ctrl+Shift+F` |
| Route | Pick **Claude Code** or **OpenCode**, then a saved session or **+ New**. Remembered until you change it |
| Mark | Per-display overlay; freehand stroke → bounding box |
| Capture | Screenshot of that display, crop to the mark; keep full display as secondary context |
| Environment | Frontmost app (+ browser URL when available) snapped before overlay steals focus |
| Ask | Raw user question |
| Deliver | Write the crop to a temp image and stream into `claude` / `opencode` (`--resume` / `--session`; thinking + answer into the chat UI) |
| Chat | Follow-ups stay on the same mark and the same route |

## Session routing

```
Mark bar / hotkey
  → Route: Claude Code | OpenCode
  → session list (or + New)
  → freehand mark + question
  → src/sessions.js sendToAgentSession
       Claude  → claude -p --resume … (stream-json)
       OpenCode → opencode run --session … (--format json --thinking)
  → electron/result.html streams thinking + answer
```

Those CLIs use whatever auth and models that session already has.

## Open-source / platform stack

| Piece | Where |
|-------|--------|
| Electron | `electron/` multi-window shell |
| Node.js | `src/` capture, sessions, bridge |
| screenshot-desktop | display capture |
| Claude Code / OpenCode | host CLIs |
| Next.js | `site/` landing |

## Key files

- `electron/main.js` — Mark bar, tray, Route menu, overlays, Spaces pinning
- `electron/launcher.html` — Mark / Route / Chat / Quit chip
- `electron/result.html` — chat UI, streaming, Markdown (incl. tables)
- `src/sessions.js` — discover Claude / OpenCode sessions; stream marks into them
- `src/capture.js` / `src/image.js` / `src/frontmost.js` — capture pipeline
- `site/` — marketing landing (Vercel)
