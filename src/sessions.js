const { execFile, execFileSync } = require("child_process");
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

function summarizeClaudeTranscript(filePath) {
  const raw = safeRead(filePath, 800_000) || "";
  const lines = raw.split("\n").filter(Boolean);
  let title = "";
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
    if (record.type === "summary" && record.summary && !title) {
      title = String(record.summary).slice(0, 120);
    }
    if (
      !preview &&
      (record.type === "user" || record.type === "assistant") &&
      record.message
    ) {
      const content = record.message.content;
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        text = content
          .map((p) => (p && p.type === "text" ? p.text : ""))
          .filter(Boolean)
          .join(" ");
      }
      text = String(text || "").replace(/\s+/g, " ").trim();
      // Skip local-command caveat noise as the only preview when possible
      if (text && !text.startsWith("<local-command-caveat>")) {
        preview = text.slice(0, 140);
        if (!title && record.type === "user") title = preview.slice(0, 80);
      } else if (text && !preview) {
        preview = text.slice(0, 140);
        if (!title && record.type === "user") title = preview.slice(0, 80);
      }
    }
  }

  let mtime = 0;
  let size = 0;
  try {
    const st = fs.statSync(filePath);
    mtime = st.mtimeMs;
    size = st.size;
  } catch {
    /* ignore */
  }

  if (size < 20 && !title && !preview) return null;

  return {
    provider: "claude",
    id: sessionId,
    title: title || `Claude session ${sessionId.slice(0, 8)}`,
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

function mapOpenCodeRows(rows) {
  return (rows || [])
    .map((row) => ({
      provider: "opencode",
      id: String(row.id || row.sessionID || ""),
      title: String(row.title || row.name || row.slug || row.id || "OpenCode session"),
      directory: String(row.directory || row.path || row.cwd || ""),
      preview: String(row.preview || row.summary || "").slice(0, 140),
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
      const sql = `SELECT id, title, directory, time_updated
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
    const sql = `SELECT id, title, directory, time_updated
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
            title: String(json.title || json.slug || id),
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

async function sendToClaudeSession({ session, question, imagePath }) {
  const bin = which("claude");
  if (!bin) {
    throw new Error(
      "Claude Code CLI not found on PATH. Install `claude`, or pick OpenCode / Flickctx built-in."
    );
  }
  if (!session?.id) throw new Error("Missing Claude session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const args = [
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
  ];
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  const { stdout } = await runCommand(bin, args, {
    cwd,
    timeout: 240_000,
  });
  const text = extractClaudePrintText(stdout);
  if (!text) throw new Error("Claude Code returned an empty response.");
  return {
    explanation: text,
    reasoning: "",
    model: "claude-code-session",
    route: {
      provider: "claude",
      id: session.id,
      title: session.title || session.id,
      directory: cwd,
    },
    followUpPrompt: text,
    usage: null,
    thinkingEnabled: false,
    highlights: null,
  };
}

async function sendToOpenCodeSession({ session, question, imagePath }) {
  const bin = which("opencode");
  if (!bin) {
    throw new Error(
      "OpenCode CLI not found on PATH. Install `opencode`, or pick Claude Code / Flickctx built-in."
    );
  }
  if (!session?.id) throw new Error("Missing OpenCode session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const args = [
    "run",
    "--session",
    session.id,
    "--format",
    "json",
    "--file",
    imagePath,
    prompt,
  ];
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  // OpenCode uses its own provider auth/config — no Flickctx API key required.
  const { stdout } = await runCommand(bin, args, {
    cwd,
    timeout: 240_000,
  });
  const text = extractOpenCodeText(stdout);
  if (!text) throw new Error("OpenCode returned an empty response.");
  return {
    explanation: text,
    reasoning: "",
    model: "opencode-session",
    route: {
      provider: "opencode",
      id: session.id,
      title: session.title || session.id,
      directory: cwd,
    },
    followUpPrompt: text,
    usage: null,
    thinkingEnabled: false,
    highlights: null,
  };
}

async function sendToAgentSession({ session, question, imagePath }) {
  if (!session || session.provider === "flickctx") {
    throw new Error("No agent session selected.");
  }
  if (!imagePath || !fs.existsSync(imagePath)) {
    throw new Error("Marked screenshot missing.");
  }
  if (session.provider === "claude") {
    return sendToClaudeSession({ session, question, imagePath });
  }
  if (session.provider === "opencode") {
    return sendToOpenCodeSession({ session, question, imagePath });
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
};
