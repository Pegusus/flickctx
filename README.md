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
   - **Shot** (full display under cursor) or **⌘⇧3** / **⌘⇧4** — macOS screenshots in your save folder auto-import into Flickctx while it runs
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

## Stack

| Piece | Role |
|-------|------|
| **Electron** + **Node.js** | Desktop shell, IPC, capture, session bridge |
| **screenshot-desktop** | Display capture |
| **Claude Code / OpenCode** | Session CLIs Flickctx routes into |
| **Next.js** | Marketing site (`site/`) |

## License

MIT
