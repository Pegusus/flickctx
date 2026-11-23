# Flickctx

Mark anything on your screen. Ask anything. Get a direct answer.

**Landing page:** https://flickctx.vercel.app · Next.js source in [`site/`](./site/)  
**Static mirror (GitHub Pages):** https://pegusus.github.io/flickctx/ · [`website/`](./website/) / [`docs/`](./docs/)

**screenshot + your question → vision agent reasons → answer**  
(+ optional local repos, web search tools, multi-turn chat)

No question-specific prompt hacks. Pricing, diagrams, websites, Datadog, AWS consoles, code snippets — same path.

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick start

```bash
git clone https://github.com/Pegusus/flickctx.git
cd flickctx   # skip if your shell is already inside the repo
npm install
# Option A — route into an OpenCode / Claude Code session (uses THAT session’s configs; no Flickctx API key):
#   have `opencode` or `claude` on PATH with existing sessions, then just start.
# Option B — Claude Code login for Flickctx built-in:
#   already ran `claude` /login? start without a Console key.
# Option C — Console API key:
npx flickctx config --api-key sk-ant-... --model claude-sonnet-4-5
npx flickctx config --search-roots "$HOME/code,$HOME/Projects,$HOME/Developer"
npm start
```

**No API key?** After Mark, choose **Claude Code** or **OpenCode**, then a session — Flickctx sends the screenshot + question into that chat, so the session’s models/keys/context are used. Built-in Flickctx still needs a key or Claude login.

1. Click the **Flickctx icon in the macOS menu bar** (top-right status area) → **Mark region** or **Open chat** (or press ⌘⇧F / Ctrl+Shift+F).
2. Draw freehand around something — the **chat panel** stays on every Space so you can keep talking while switching tabs/desktops.
3. Pick Claude Code / OpenCode / Flickctx — **+ New session** or an existing one — then chat (streamed live). Remembered until you change **Route**
4. Type any question → **Send**
5. Ask “where is …” on Flickctx built-in for on-screen highlight rings

### macOS Screen Recording

`npm start` shows up as **Electron** in  
System Settings → Privacy & Security → Screen Recording. Enable it, then restart.

## Optional: Cloudflare proxy

Keep the API key off each machine by proxying Anthropic through a Worker:

```bash
cd worker
npm install
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler deploy
export FLICKCTX_PROXY_URL=https://your-worker.workers.dev
```

## CLI

```bash
npx flickctx doctor
npx flickctx repos
npx flickctx context
npx flickctx explain -i shot.png
npx flickctx mark
```

## What the agent can use

- The marked screenshot (primary), JPEG-resized for the API
- Full-display context image (secondary) for surrounding UI
- Frontmost app / browser URL hint (when detectable)
- Your question (verbatim)
- Short conversation history
- Ambient local repo catalog (when relevant)
- On-demand product skills (`skills/`: aws, datadog, gcp, …) via `list_skills` / `read_skill` — not preloaded into every chat
- Tools: `web_search`, `fetch_url`, `list_local_repos`, `read_local_file`, `grep_local`, `repo_details`, `list_skills`, `read_skill`

## License

MIT
