# Flickctx

Mark anything on your screen. Ask anything. Get a direct answer.

**Landing page (Next.js):** [`site/`](./site/) → deploy on Vercel as **flickctx** (`flickctx.vercel.app`)  
**Static mirror (GitHub Pages):** https://pegusus.github.io/flickctx/ · [`website/`](./website/) / [`docs/`](./docs/)

**screenshot + your question → vision agent reasons → answer**  
(+ optional local repos, web search tools, multi-turn chat)

No question-specific prompt hacks. Pricing, diagrams, websites, Datadog, AWS consoles, code snippets — same path.

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## Quick start

```bash
git clone https://github.com/Pegusus/flickctx.git
cd flickctx
npm install
export ANTHROPIC_API_KEY=sk-ant-...
npx flickctx config --model claude-sonnet-4-5
npx flickctx config --search-roots "$HOME/code,$HOME/Projects,$HOME/Developer"
npm start
```

1. Click **Mark** (or ⌘⇧F / Ctrl+Shift+F)
2. Draw freehand around something
3. Type any question → **Send**
4. Keep chatting about the same mark

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
