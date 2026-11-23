const { execFile, execFileSync, spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { claudeConfigDir } = require("./context");

const DEFAULT_LIMIT = 40;

const EXTRA_PATH_DIRS = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  path.join(os.homedir(), ".local", "bin"),
  path.join(os.homedir(), "bin"),
  path.join(os.homedir(), ".opencode", "bin"),
  path.join(os.homedir(), ".claude", "bin"),
];

function expandedEnv(base = process.env) {
  const parts = String(base.PATH || "")
    .split(path.delimiter)
    .filter(Boolean);
  for (const dir of EXTRA_PATH_DIRS) {
    try {
      if (fs.existsSync(dir) && !parts.includes(dir)) parts.unshift(dir);
    } catch {
      /* ignore */
    }
  }
  return { ...base, PATH: parts.join(path.delimiter) };
}

function which(cmd) {
  const env = expandedEnv();
  try {
    return execFileSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
        env,
      }
    )
      .trim()
      .split(/\r?\n/)[0];
  } catch {
    /* fall through */
  }
  for (const dir of EXTRA_PATH_DIRS) {
    const full =
      process.platform === "win32"
        ? path.join(dir, `${cmd}.exe`)
        : path.join(dir, cmd);
    try {
      if (fs.existsSync(full)) return full;
    } catch {
      /* ignore */
    }
  }
  return "";
}

function safeRead(filePath, maxBytes = 200_000) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath).slice(0, maxBytes).toString("utf8");
  } catch {
    return null;
  }
}

function cleanTitle(value) {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  // Skip command-wrapper noise that is not a real session name
  if (text.startsWith("<local-command-caveat>")) return "";
  if (text.startsWith("<command-")) return "";
  return text.slice(0, 120);
}

function extractMessageText(message) {
  if (!message) return "";
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (p && p.type === "text" ? p.text : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function summarizeClaudeTranscript(filePath) {
  const raw = safeRead(filePath, 800_000) || "";
  const lines = raw.split("\n").filter(Boolean);
  // Prefer the same labels Claude Code’s own picker uses:
  // custom-title (user /rename) > ai-title (generated) > agent-name > summary.
  let customTitle = "";
  let aiTitle = "";
  let agentName = "";
  let summaryTitle = "";
  let firstUserTitle = "";
  let cwd = "";
  let preview = "";
  let sessionId = path.basename(filePath, ".jsonl");

  for (const line of lines) {
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.sessionId) sessionId = record.sessionId;
    if (record.cwd && !cwd) cwd = record.cwd;

    const type = String(record.type || "");
    if (type === "custom-title") {
      const t = cleanTitle(record.customTitle || record.title);
      if (t) customTitle = t; // latest wins
    } else if (type === "ai-title") {
      const t = cleanTitle(record.aiTitle || record.title);
      if (t) aiTitle = t;
    } else if (type === "agent-name") {
      const t = cleanTitle(record.agentName || record.title);
      if (t) agentName = t;
    } else if (type === "summary" && record.summary) {
      const t = cleanTitle(record.summary);
      if (t) summaryTitle = t;
    }

    if (
      (type === "user" || type === "assistant") &&
      record.message
    ) {
      const text = cleanTitle(extractMessageText(record.message));
      if (!text) continue;
      if (!preview) preview = text.slice(0, 140);
      if (!firstUserTitle && type === "user") firstUserTitle = text.slice(0, 80);
    }
  }

  const title =
    customTitle ||
    aiTitle ||
    agentName ||
    summaryTitle ||
    firstUserTitle ||
    `Claude session ${sessionId.slice(0, 8)}`;

  let mtime = 0;
  let size = 0;
  try {
    const st = fs.statSync(filePath);
    mtime = st.mtimeMs;
    size = st.size;
  } catch {
    /* ignore */
  }

  if (size < 20 && !preview && title.startsWith("Claude session ")) return null;

  return {
    provider: "claude",
    id: sessionId,
    title,
    directory: cwd || "",
    preview: preview || "",
    mtime,
    sessionFile: filePath,
  };
}

function collectJsonlFiles(root, depth = 0, out = []) {
  if (depth > 4) return out;
  let entries = [];
  try {
    entries = fs.readdirSync(root);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = path.join(root, name);
    let stat;
    try {
      stat = fs.statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) collectJsonlFiles(full, depth + 1, out);
    else if (name.endsWith(".jsonl")) {
      out.push({ full, mtime: stat.mtimeMs });
    }
  }
  return out;
}

function listClaudeSessions(limit = DEFAULT_LIMIT) {
  const root = path.join(claudeConfigDir(), "projects");
  if (!fs.existsSync(root)) return [];

  const files = collectJsonlFiles(root);
  files.sort((a, b) => b.mtime - a.mtime);

  const sessions = [];
  const seen = new Set();
  for (const f of files) {
    if (sessions.length >= limit) break;
    const summary = summarizeClaudeTranscript(f.full);
    if (!summary || !summary.id || seen.has(summary.id)) continue;
    seen.add(summary.id);
    sessions.push(summary);
  }
  return sessions;
}

function opencodeDataDir() {
  if (process.env.XDG_DATA_HOME) {
    return path.join(process.env.XDG_DATA_HOME, "opencode");
  }
  if (process.platform === "darwin") {
    // Prefer XDG-style path OpenCode documents; also check Application Support.
    const xdg = path.join(os.homedir(), ".local", "share", "opencode");
    if (fs.existsSync(xdg)) return xdg;
    const appSupport = path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "opencode"
    );
    if (fs.existsSync(appSupport)) return appSupport;
    return xdg;
  }
  if (process.platform === "win32") {
    const base =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(base, "opencode");
  }
  return path.join(os.homedir(), ".local", "share", "opencode");
}

function resolveOpenCodeDbPath() {
  if (process.env.OPENCODE_DB && process.env.OPENCODE_DB !== ":memory:") {
    const override = process.env.OPENCODE_DB;
    return path.isAbsolute(override)
      ? override
      : path.join(opencodeDataDir(), override);
  }

  const bin = which("opencode");
  if (bin) {
    for (const args of [["debug", "paths", "db"], ["db", "path"]]) {
      try {
        const out = execFileSync(bin, args, {
          encoding: "utf8",
          timeout: 5000,
          stdio: ["ignore", "pipe", "ignore"],
          env: expandedEnv(),
        })
          .trim()
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean)
          .pop();
        if (out && out !== ":memory:" && fs.existsSync(out)) return out;
      } catch {
        /* try next */
      }
    }
  }

  const base = opencodeDataDir();
  for (const name of [
    "opencode.db",
    "opencode-dev.db",
    "opencode-beta.db",
    "opencode-prod.db",
  ]) {
    const candidate = path.join(base, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join(base, "opencode.db");
}

function openCodeDisplayTitle(row) {
  // Prefer the title OpenCode itself shows; slug is a secondary label.
  return (
    cleanTitle(row.title) ||
    cleanTitle(row.name) ||
    cleanTitle(row.slug) ||
    String(row.id || row.sessionID || "OpenCode session").slice(0, 40)
  );
}

function mapOpenCodeRows(rows) {
  return (rows || [])
    .map((row) => ({
      provider: "opencode",
      id: String(row.id || row.sessionID || ""),
      title: openCodeDisplayTitle(row),
      directory: String(row.directory || row.path || row.cwd || ""),
      preview: cleanTitle(row.preview || row.summary || "").slice(0, 140),
      mtime: Number(
        row.time_updated || row.updatedAt || row.updated || row.mtime || 0
      ),
    }))
    .filter((s) => s.id);
}

function queryOpenCodeDbWithNodeSqlite(dbPath, limit) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return null;
  }
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('session_v2','session')"
        )
        .all()
        .map((r) => r.name);
      const table = tables.includes("session_v2")
        ? "session_v2"
        : tables.includes("session")
          ? "session"
          : "";
      if (!table) return [];
      const hasParent = db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === "parent_id");
      const parentClause = hasParent
        ? "AND (parent_id IS NULL OR parent_id = '')"
        : "";
      const cols = new Set(
        db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
      );
      const selectCols = ["id", "title", "directory", "time_updated"]
        .concat(cols.has("slug") ? ["slug"] : [])
        .join(", ");
      const sql = `SELECT ${selectCols}
        FROM ${table}
        WHERE (time_archived IS NULL OR time_archived = 0)
        ${parentClause}
        ORDER BY time_updated DESC
        LIMIT ?`;
      return mapOpenCodeRows(db.prepare(sql).all(Number(limit) || DEFAULT_LIMIT));
    } finally {
      try {
        db.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return null;
  }
}

function queryOpenCodeDbWithSqlite3(dbPath, limit) {
  const sqlite3 = which("sqlite3");
  if (!sqlite3 || !fs.existsSync(dbPath)) return null;
  try {
    const tablesRaw = execFileSync(
      sqlite3,
      [dbPath, "SELECT name FROM sqlite_master WHERE type='table';"],
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
        env: expandedEnv(),
      }
    );
    const tables = new Set(
      tablesRaw
        .split(/\r?\n/)
        .map((t) => t.trim())
        .filter(Boolean)
    );
    const table = tables.has("session_v2")
      ? "session_v2"
      : tables.has("session")
        ? "session"
        : "";
    if (!table) return [];

    const colsRaw = execFileSync(
      sqlite3,
      [dbPath, `PRAGMA table_info(${table});`],
      {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
        env: expandedEnv(),
      }
    );
    const hasParent = /\bparent_id\b/.test(colsRaw);
    const parentClause = hasParent
      ? "AND (parent_id IS NULL OR parent_id = '')"
      : "";
    const selectCols = /\bslug\b/.test(colsRaw)
      ? "id, title, slug, directory, time_updated"
      : "id, title, directory, time_updated";
    const sql = `SELECT ${selectCols}
      FROM ${table}
      WHERE (time_archived IS NULL OR time_archived = 0)
      ${parentClause}
      ORDER BY time_updated DESC
      LIMIT ${Number(limit) || DEFAULT_LIMIT};`;
    const out = execFileSync(sqlite3, ["-json", dbPath, sql], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
      env: expandedEnv(),
    });
    return mapOpenCodeRows(JSON.parse(out || "[]"));
  } catch {
    return null;
  }
}

function listOpenCodeSessionsFromDb(limit = DEFAULT_LIMIT) {
  const dbPath = resolveOpenCodeDbPath();
  if (!fs.existsSync(dbPath)) return [];
  const viaNode = queryOpenCodeDbWithNodeSqlite(dbPath, limit);
  if (Array.isArray(viaNode)) return viaNode;
  const viaCli = queryOpenCodeDbWithSqlite3(dbPath, limit);
  if (Array.isArray(viaCli)) return viaCli;
  return [];
}

function listOpenCodeSessionsFromCli(limit = DEFAULT_LIMIT) {
  const bin = which("opencode");
  if (!bin) return null;
  // CLI list is often scoped to cwd/project — still useful as a supplement.
  try {
    const out = execFileSync(
      bin,
      ["session", "list", "--max-count", String(limit), "--format", "json"],
      {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 4_000_000,
        stdio: ["ignore", "pipe", "ignore"],
        env: expandedEnv(),
        cwd: os.homedir(),
      }
    );
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.sessions)
        ? parsed.sessions
        : Array.isArray(parsed?.data)
          ? parsed.data
          : [];
    return mapOpenCodeRows(rows);
  } catch {
    return null;
  }
}

function listOpenCodeSessionsFromStorage(limit = DEFAULT_LIMIT) {
  const storageSession = path.join(opencodeDataDir(), "storage", "session");
  if (!fs.existsSync(storageSession)) return [];
  const matches = [];
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) walk(full, depth + 1);
      else if (name.endsWith(".json")) {
        const text = safeRead(full, 80_000);
        if (!text) continue;
        try {
          const json = JSON.parse(text);
          const id = String(json.id || json.sessionID || "");
          if (!id) continue;
          matches.push({
            provider: "opencode",
            id,
            title: openCodeDisplayTitle(json),
            directory: String(json.directory || json.path || ""),
            preview: "",
            mtime: Number(json.time_updated || json.updatedAt || stat.mtimeMs),
          });
        } catch {
          /* ignore */
        }
      }
    }
  };
  walk(storageSession);
  matches.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  const seen = new Set();
  const out = [];
  for (const s of matches) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

function mergeOpenCodeSessions(limit = DEFAULT_LIMIT) {
  const buckets = [
    listOpenCodeSessionsFromDb(limit),
    listOpenCodeSessionsFromCli(limit) || [],
    listOpenCodeSessionsFromStorage(limit),
  ];
  const seen = new Set();
  const merged = [];
  for (const list of buckets) {
    for (const s of list) {
      if (!s?.id || seen.has(s.id)) continue;
      seen.add(s.id);
      merged.push(s);
    }
  }
  merged.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
  return merged.slice(0, limit);
}

function listOpenCodeSessions(limit = DEFAULT_LIMIT) {
  return mergeOpenCodeSessions(limit);
}

function listAgentSessions(options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const claude = listClaudeSessions(limit);
  const opencode = listOpenCodeSessions(limit);
  // Keep per-provider lists intact — do not merge-then-slice or one tool
  // with many recent chats will hide the other.
  const sessions = [...claude, ...opencode].sort(
    (a, b) => (b.mtime || 0) - (a.mtime || 0)
  );
  return {
    sessions,
    byProvider: { claude, opencode },
    claudeAvailable: Boolean(which("claude")) || claude.length > 0,
    opencodeAvailable: Boolean(which("opencode")) || opencode.length > 0,
    counts: { claude: claude.length, opencode: opencode.length },
  };
}

function buildMarkPrompt(question, imagePath) {
  const q = (question || "").trim() || "Explain what I marked on screen.";
  return [
    "Flickctx attached a marked screen region for this follow-up.",
    `Screenshot path: ${imagePath}`,
    "Please look at that image (vision / Read the image file) and answer about what is visible in the mark.",
    "",
    `User question: ${q}`,
  ].join("\n");
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      {
        cwd: opts.cwd || process.cwd(),
        encoding: "utf8",
        timeout: opts.timeout || 180_000,
        maxBuffer: 8_000_000,
        env: expandedEnv({ ...process.env, ...(opts.env || {}) }),
      },
      (err, stdout, stderr) => {
        if (err) {
          const msg =
            (stderr || "").trim() ||
            (stdout || "").trim() ||
            err.message ||
            String(err);
          const wrapped = new Error(msg.slice(0, 1200));
          wrapped.code = err.code;
          wrapped.stdout = stdout;
          wrapped.stderr = stderr;
          reject(wrapped);
          return;
        }
        resolve({ stdout: stdout || "", stderr: stderr || "" });
      }
    );
  });
}

/**
 * Spawn a CLI and stream stdout line-by-line (NDJSON / stream-json).
 * onLine(line) is called for each complete line; onProgress is optional
 * and left to callers that parse events.
 */
function spawnStreaming(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      env: expandedEnv({ ...process.env, ...(opts.env || {}) }),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let lineBuf = "";
    let settled = false;
    const timeoutMs = opts.timeout || 240_000;
    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }, timeoutMs);

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    child.stdout.on("data", (chunk) => {
      const s = chunk.toString("utf8");
      stdout += s;
      if (typeof opts.onChunk === "function") {
        try {
          opts.onChunk(s);
        } catch {
          /* ignore */
        }
      }
      if (typeof opts.onLine === "function") {
        lineBuf += s;
        const parts = lineBuf.split(/\r?\n/);
        lineBuf = parts.pop() || "";
        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            opts.onLine(line);
          } catch {
            /* ignore */
          }
        }
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      finish(reject, err);
    });
    child.on("close", (code, signal) => {
      if (lineBuf.trim() && typeof opts.onLine === "function") {
        try {
          opts.onLine(lineBuf);
        } catch {
          /* ignore */
        }
        lineBuf = "";
      }
      if (code && code !== 0) {
        const msg =
          (stderr || "").trim() ||
          (stdout || "").trim() ||
          `Command failed (${signal || code})`;
        const wrapped = new Error(msg.slice(0, 1200));
        wrapped.code = code;
        wrapped.stdout = stdout;
        wrapped.stderr = stderr;
        finish(reject, wrapped);
        return;
      }
      finish(resolve, { stdout, stderr, code: code || 0 });
    });
  });
}

function emitProgress(onProgress, payload) {
  if (typeof onProgress !== "function") return;
  try {
    onProgress(payload);
  } catch {
    /* ignore */
  }
}

function extractClaudePrintText(stdout) {
  const raw = String(stdout || "").trim();
  if (!raw) return "";
  try {
    const data = JSON.parse(raw);
    if (typeof data.result === "string") return data.result;
    if (typeof data.text === "string") return data.text;
    if (Array.isArray(data.content)) {
      return data.content
        .map((p) => (p?.type === "text" ? p.text : ""))
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  } catch {
    /* plain text */
  }
  return raw;
}

function extractOpenCodeText(stdout) {
  const raw = String(stdout || "").trim();
  if (!raw) return "";
  const lines = raw.split("\n").filter(Boolean);
  const texts = [];
  for (const line of lines) {
    try {
      const ev = JSON.parse(line);
      if (typeof ev.text === "string") texts.push(ev.text);
      if (ev.type === "text" && typeof ev.part?.text === "string") {
        texts.push(ev.part.text);
      }
      if (ev.type === "message" && Array.isArray(ev.parts)) {
        for (const p of ev.parts) {
          if (p?.type === "text" && p.text) texts.push(p.text);
        }
      }
      if (typeof ev.result === "string") texts.push(ev.result);
    } catch {
      /* ignore */
    }
  }
  if (texts.length) return texts.join("\n\n").trim();
  return raw;
}

function consumeClaudeStreamLine(line, state, onProgress) {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  const type = ev.type;

  if (type === "stream_event") {
    const event = ev.event || {};
    if (event.type === "content_block_delta") {
      const delta = event.delta || {};
      if (delta.type === "text_delta" && delta.text) {
        state.text += delta.text;
        state.sawStreamText = true;
        emitProgress(onProgress, {
          kind: "text",
          text: state.text,
          reasoning: state.reasoning,
          status: "",
        });
      } else if (delta.type === "thinking_delta" && delta.thinking) {
        state.reasoning += delta.thinking;
        emitProgress(onProgress, {
          kind: "reasoning",
          text: state.text,
          reasoning: state.reasoning,
          status: "Thinking…",
        });
      }
    } else if (event.type === "content_block_start") {
      const block = event.content_block || {};
      if (block.type === "tool_use" && block.name) {
        emitProgress(onProgress, {
          kind: "tool",
          text: state.text,
          reasoning: state.reasoning,
          status: `Using ${block.name}…`,
        });
      } else if (block.type === "thinking") {
        emitProgress(onProgress, {
          kind: "status",
          text: state.text,
          reasoning: state.reasoning,
          status: "Thinking…",
        });
      }
    }
    return;
  }

  if (type === "assistant" && ev.message?.content) {
    const texts = [];
    const thinks = [];
    for (const block of ev.message.content) {
      if (block?.type === "text" && block.text) texts.push(block.text);
      if (block?.type === "thinking" && block.thinking) {
        thinks.push(block.thinking);
      }
      if (block?.type === "tool_use" && block.name) {
        emitProgress(onProgress, {
          kind: "tool",
          text: state.text,
          reasoning: state.reasoning,
          status: `Using ${block.name}…`,
        });
      }
    }
    if (thinks.length) {
      state.reasoning = thinks.join("\n\n");
    }
    if (texts.length && !state.sawStreamText) {
      state.text = texts.join("\n\n");
      emitProgress(onProgress, {
        kind: "text",
        text: state.text,
        reasoning: state.reasoning,
        status: "",
      });
    }
    return;
  }

  if (type === "result") {
    if (typeof ev.result === "string" && ev.result.trim()) {
      state.finalText = ev.result.trim();
    }
    if (ev.is_error && ev.result) {
      state.error = String(ev.result);
    }
  }
}

async function sendToClaudeSession({ session, question, imagePath, onProgress }) {
  const bin = which("claude");
  if (!bin) {
    throw new Error(
      "Claude Code CLI not found on PATH. Install `claude`, or pick OpenCode / Flickctx built-in."
    );
  }
  if (!session?.id) throw new Error("Missing Claude session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  const state = {
    text: "",
    reasoning: "",
    finalText: "",
    sawStreamText: false,
    error: "",
  };
  emitProgress(onProgress, {
    kind: "status",
    text: "",
    reasoning: "",
    status: "Claude Code · starting…",
  });

  const streamArgs = [
    "-p",
    "--resume",
    session.id,
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read",
    "--allowedTools",
    "Glob",
    "--allowedTools",
    "Grep",
    prompt,
  ];

  let stdout = "";
  try {
    const result = await spawnStreaming(bin, streamArgs, {
      cwd,
      timeout: 240_000,
      onLine: (line) => consumeClaudeStreamLine(line, state, onProgress),
    });
    stdout = result.stdout || "";
  } catch (err) {
    // Older CLIs may not support stream-json — fall back to one-shot JSON.
    const fallback = await runCommand(
      bin,
      [
        "-p",
        "--resume",
        session.id,
        "--output-format",
        "json",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Read",
        "--allowedTools",
        "Glob",
        "--allowedTools",
        "Grep",
        prompt,
      ],
      { cwd, timeout: 240_000 }
    );
    stdout = fallback.stdout || "";
    state.text = extractClaudePrintText(stdout);
  }

  const text =
    state.finalText || state.text || extractClaudePrintText(stdout) || "";
  if (!text) {
    throw new Error(
      state.error || "Claude Code returned an empty response."
    );
  }
  return {
    explanation: text,
    reasoning: state.reasoning || "",
    model: "claude-code-session",
    route: {
      provider: "claude",
      id: session.id,
      title: session.title || session.id,
      directory: cwd,
    },
    followUpPrompt: text,
    usage: null,
    thinkingEnabled: Boolean(state.reasoning),
    highlights: null,
  };
}

function consumeOpenCodeStreamLine(line, state, onProgress) {
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    return;
  }
  const type = String(ev.type || "");

  if (type === "reasoning") {
    const chunk = ev.part?.text || ev.text || "";
    if (chunk) {
      state.reasoningParts.push(String(chunk));
      state.reasoning = state.reasoningParts.join("\n\n");
      emitProgress(onProgress, {
        kind: "reasoning",
        text: state.text,
        reasoning: state.reasoning,
        status: "Thinking…",
      });
    }
    return;
  }

  if (type === "text") {
    const chunk = ev.part?.text || ev.text || "";
    if (chunk) {
      state.textParts.push(String(chunk));
      state.text = state.textParts.join("\n\n").trim();
      emitProgress(onProgress, {
        kind: "text",
        text: state.text,
        reasoning: state.reasoning,
        status: "",
      });
    }
    return;
  }

  if (type === "tool_use") {
    const tool = ev.part?.tool || ev.tool || "tool";
    const title =
      ev.part?.state?.title ||
      ev.part?.state?.input?.description ||
      tool;
    emitProgress(onProgress, {
      kind: "tool",
      text: state.text,
      reasoning: state.reasoning,
      status: `${tool}: ${String(title).slice(0, 80)}`,
    });
    return;
  }

  if (type === "step_start") {
    emitProgress(onProgress, {
      kind: "status",
      text: state.text,
      reasoning: state.reasoning,
      status: "Working…",
    });
    return;
  }

  if (type === "error") {
    const msg =
      ev.error?.data?.message ||
      ev.error?.message ||
      ev.error?.name ||
      ev.message ||
      "OpenCode error";
    state.error = String(msg);
  }
}

async function sendToOpenCodeSession({
  session,
  question,
  imagePath,
  onProgress,
}) {
  const bin = which("opencode");
  if (!bin) {
    throw new Error(
      "OpenCode CLI not found on PATH. Install `opencode`, or pick Claude Code / Flickctx built-in."
    );
  }
  if (!session?.id) throw new Error("Missing OpenCode session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  const state = {
    text: "",
    textParts: [],
    reasoning: "",
    reasoningParts: [],
    error: "",
  };
  emitProgress(onProgress, {
    kind: "status",
    text: "",
    reasoning: "",
    status: "OpenCode · starting…",
  });

  // OpenCode uses its own provider auth/config — no Flickctx API key required.
  // --thinking emits reasoning events in the JSON stream.
  const args = [
    "run",
    "--session",
    session.id,
    "--format",
    "json",
    "--thinking",
    "--file",
    imagePath,
    prompt,
  ];

  let stdout = "";
  try {
    const result = await spawnStreaming(bin, args, {
      cwd,
      timeout: 240_000,
      onLine: (line) => consumeOpenCodeStreamLine(line, state, onProgress),
    });
    stdout = result.stdout || "";
  } catch (err) {
    // Older OpenCode without --thinking
    if (/thinking|unknown|unexpected/i.test(String(err.message || ""))) {
      const result = await spawnStreaming(
        bin,
        [
          "run",
          "--session",
          session.id,
          "--format",
          "json",
          "--file",
          imagePath,
          prompt,
        ],
        {
          cwd,
          timeout: 240_000,
          onLine: (line) => consumeOpenCodeStreamLine(line, state, onProgress),
        }
      );
      stdout = result.stdout || "";
    } else {
      throw err;
    }
  }

  const text = state.text || extractOpenCodeText(stdout) || "";
  if (!text) {
    throw new Error(state.error || "OpenCode returned an empty response.");
  }
  return {
    explanation: text,
    reasoning: state.reasoning || "",
    model: "opencode-session",
    route: {
      provider: "opencode",
      id: session.id,
      title: session.title || session.id,
      directory: cwd,
    },
    followUpPrompt: text,
    usage: null,
    thinkingEnabled: Boolean(state.reasoning),
    highlights: null,
  };
}

async function sendToAgentSession({
  session,
  question,
  imagePath,
  onProgress,
}) {
  if (!session || session.provider === "flickctx") {
    throw new Error("No agent session selected.");
  }
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error("Marked screenshot missing.");
  }
  if (session.provider === "claude") {
    return sendToClaudeSession({ session, question, imagePath, onProgress });
  }
  if (session.provider === "opencode") {
    return sendToOpenCodeSession({ session, question, imagePath, onProgress });
  }
  throw new Error(`Unknown session provider: ${session.provider}`);
}

module.exports = {
  listAgentSessions,
  listClaudeSessions,
  listOpenCodeSessions,
  listOpenCodeSessionsFromDb,
  resolveOpenCodeDbPath,
  sendToAgentSession,
  buildMarkPrompt,
  which,
  expandedEnv,
  consumeClaudeStreamLine,
  consumeOpenCodeStreamLine,
};
