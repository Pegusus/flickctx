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

1. Use the **Mark bar** (all Spaces) or menu-bar **Flickctx**, or press ⌘⇧F / Ctrl+Shift+F.
2. **Route** → Claude Code / OpenCode → session or **+ New**, then **Mark** / **Chat**.
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

Mark a region on a tab → Flickctx gets DOM selectors under the mark; Guide can highlight/click in-page.

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
