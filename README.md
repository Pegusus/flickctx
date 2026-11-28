# Flickctx

Mark anything on your screen. Ask anything. Get a direct answer.

**Landing:** https://flickctx.vercel.app · Next.js in [`site/`](./site/)  
**Design:** [ARCHITECTURE.md](./ARCHITECTURE.md)

**Mark → Route (OpenCode / Claude Code / built-in) → Chat**  
Screenshot + question continue in the session you pick (or Flickctx built-in vision).

## Quick start

```bash
git clone https://github.com/Pegusus/flickctx.git
cd flickctx
npm install
# Have `opencode` or `claude` on PATH with existing sessions, then:
npm start
```

OpenCode routes use **your** OpenCode settings (`~/.config/opencode/opencode.json` or project `opencode.json`) — e.g. `"model": "github-copilot/gpt-4.1"`. Flickctx passes that as `--model` so headless runs don’t fall back to OpenCode Go free quota.


1. Use the **Mark bar** (all Spaces) or menu-bar **Flickctx**:
   - **Mark** (freehand region): ⌘⇧F / Ctrl+Shift+F
   - **Shot** (full display under cursor): ⌘⇧S / Ctrl+Shift+S
2. **Route** → Claude Code / OpenCode → session or **+ New**, then **Mark** / **Shot** / **Chat**.
3. Draw freehand. Thinking + answer stream into the chat panel.
4. Follow-ups stay on the same mark and route.

### macOS Screen Recording

`npm start` shows as **Electron** in  
System Settings → Privacy & Security → Screen Recording. Enable it, then restart.

## CLI

```bash
npx flickctx doctor
npx flickctx repos
npx flickctx context
npx flickctx mark
```

## Browser bridge (optional)

For richer Guide / highlights on web UIs, load the Chrome extension:

1. `npm start` (bridge on `127.0.0.1:19234`)
2. Chrome → Extensions → Developer mode → **Load unpacked** → `extension/`
3. Popup should say **Connected**

Mark a region on a tab → Flickctx silently inspects DOM under the mark (no SoM badges).

**Guide** on a tab turns on Set-of-Marks badges (`e1`, `e2`, …) and prefers `ref` in `flickctx-guide` for in-page highlight/click. Normal ask/mark keeps badges off (intent-gated).

Non-browser marks can include a lightweight desktop accessibility tree (`src/desktopA11y.js`).

## Stack

| Piece | Role |
|-------|------|
| **Electron** + **Node.js** | Desktop shell, IPC, capture, session bridge |
| **screenshot-desktop** | Display capture |
| **Claude Code / OpenCode** | Session CLIs Flickctx routes into |
| **Chrome extension** | Optional DOM inspect / in-page highlight + click |
| **Next.js** | Marketing site (`site/`) |

## License

MIT
