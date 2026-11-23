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
# Session route (no Flickctx API key): have `opencode` or `claude` on PATH.
# Built-in: Claude Code login, Console key, or FLICKCTX_PROXY_URL + secret.
npm start
```

1. Use the **Mark bar** (all Spaces) or menu-bar **Flickctx**, or press ⌘⇧F / Ctrl+Shift+F.
2. **Route** → Claude Code / OpenCode → session or **+ New**, then **Mark** / **Chat**.
3. Draw freehand. Thinking + answer stream into the chat panel.
4. Follow-ups stay on the same mark and route.

### macOS Screen Recording

`npm start` shows as **Electron** in  
System Settings → Privacy & Security → Screen Recording. Enable it, then restart.

## Optional: Cloudflare proxy

```bash
cd worker
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put FLICKCTX_PROXY_SECRET
npx wrangler deploy
export FLICKCTX_PROXY_URL=https://your-worker.workers.dev
export FLICKCTX_PROXY_SECRET=same-shared-secret
```

## CLI

```bash
npx flickctx doctor
npx flickctx repos
npx flickctx context
npx flickctx explain -i shot.png
npx flickctx mark
```

## Stack

| Piece | Role |
|-------|------|
| **Electron** + **Node.js** | Desktop shell, IPC, capture, agents |
| **screenshot-desktop** | Display capture |
| **DuckDuckGo HTML** | `web_search` without an API key |
| **ripgrep** (optional) | Fast `grep_local` |
| **Cloudflare Workers** | Optional Anthropic proxy (`worker/`) |
| **Next.js** | Marketing site (`site/`) |

## Security notes

- Local tools (`read_local_file`, `grep_local`, `repo_details`) are sandboxed to configured search roots / project path.
- `fetch_url` only allows public `http(s)` and blocks private / metadata hosts (redirects re-checked).
- Renderer IPC cannot set `apiKey`.
- The Worker requires `FLICKCTX_PROXY_SECRET` — never deploy an open proxy.

## License

MIT
