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

## Guide mode

Seamless pointer walkthrough (no per-step chat):

```
Tap Guide me OR ask with explicit walkthrough intent
  → same session bridge with a guide prompt
  → model returns ```flickctx-guide``` (prefer ref eN, else selector / display box)
  → guide overlay: ring + pointer + Next / Esc
  → Next (or ⌘⇧→) silently re-captures the display
  → advance prompt in the same session → next pointer
```

**Intent gating:** SoM numbered badges and the in-page guide cursor are **off** for normal Mark / Ask. They turn **on** only for Guide me or clear phrases (`guide me`, `walk me through`, `show me where`, `how do I find/open/…`, etc.) — not bare questions like “where are the pods?”.

Implemented in `src/guide.js`, `electron/guideHost.js`, `electron/guide.html`.

## Browser bridge + Set-of-Marks

Optional Chrome extension (`extension/`) talks to a localhost HTTP bridge in the desktop app (`src/browserBridge.js` on `127.0.0.1:19234`):

```
Mark on a browser tab (silent inspect — no badges)
  → extension inspects DOM under the mark (selector, text, href)
  → session prompt includes grounding context (SoM refs when available)

Guide on a browser tab (showBadges: true)
  → snapshotSom stamps data-flickctx-ref=eN and draws numbered badges
  → model returns ref in flickctx-guide → highlight / click by ref on Next
  → pixel overlay still works as fallback (any app)

Desktop (non-browser) marks
  → src/desktopA11y.js (agent-desktop or macOS System Events) augments prompts
```

Load unpacked: Chrome → Extensions → Developer mode → Load unpacked → `extension/`.

## Open-source / platform stack

| Piece | Where |
|-------|--------|
| Electron | `electron/` multi-window shell |
| Node.js | `src/` capture, sessions, bridge |
| screenshot-desktop | display capture |
| Claude Code / OpenCode | host CLIs |
| Chrome extension | `extension/` DOM inspect / highlight / click |
| Next.js | `site/` landing |

## Key files

- `electron/main.js` — Mark bar, tray, Route menu, overlays, Spaces pinning
- `electron/launcher.html` — Mark / Route / Chat / Quit chip
- `electron/result.html` — chat UI, streaming, Markdown (incl. tables)
- `src/sessions.js` — discover Claude / OpenCode sessions; stream marks into them
- `src/browserBridge.js` / `extension/` — optional browser channel + SoM
- `src/som.js` / `src/desktopA11y.js` — grounding formatters
- `src/guide.js` / `electron/guide.html` — Guide mode (intent-gated badges)
- `src/capture.js` / `src/image.js` / `src/frontmost.js` — capture pipeline
- `site/` — marketing landing (Vercel)
