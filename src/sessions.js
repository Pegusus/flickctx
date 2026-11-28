const { execFile, execFileSync, spawn } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { claudeConfigDir } = require("./context");

function isNewAgentSession(session) {
  if (!session) return false;
  if (session.isNew) return true;
  const id = String(session.id || "");
  return !id || id === "new";
}

function newClaudeSessionId() {
  return crypto.randomUUID();
}

function newOpenCodeSessionId() {
  return "ses_" + crypto.randomBytes(12).toString("hex");
}

const DEFAULT_LIMIT = 40;
const HISTORY_LIMIT = 80;
const HISTORY_PAGE_DEFAULT = 12;
const HISTORY_SCAN_LIMIT = 300;

function pageSessionHistory(all, options = {}) {
  const total = Array.isArray(all) ? all.length : 0;
  if (!total) {
    return { messages: [], hasMore: false, nextBefore: 0, total: 0 };
  }
  const pageSize = Math.max(
    1,
    Number(options.limit) || HISTORY_PAGE_DEFAULT
  );
  let end = total;
  const before = options.before;
  if (before !== undefined && before !== null && before !== "") {
    const b = Number(before);
    if (Number.isFinite(b) && b > 0) end = Math.min(total, Math.floor(b));
  }
  const start = Math.max(0, end - pageSize);
  return {
    messages: all.slice(start, end),
    hasMore: start > 0,
    nextBefore: start,
    total,
  };
}

function isHistoryNoise(text) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (t.startsWith("<local-command")) return true;
  if (t.startsWith("<command-")) return true;
  return false;
}

function findClaudeSessionFile(sessionId) {
  const id = String(sessionId || "");
  if (!id) return "";
  const root = path.join(claudeConfigDir(), "projects");
  if (!fs.existsSync(root)) return "";
  const files = collectJsonlFiles(root);
  for (const f of files) {
    const base = path.basename(f.full, ".jsonl");
    if (base === id) return f.full;
    const summary = summarizeClaudeTranscript(f.full);
    if (summary?.id === id) return f.full;
  }
  return "";
}

function assistantTextFromClaudeMessage(message) {
  if (!message) return { text: "", reasoning: "" };
  const content = message.content;
  if (typeof content === "string") {
    return { text: content.trim(), reasoning: "" };
  }
  if (!Array.isArray(content)) return { text: "", reasoning: "" };
  const texts = [];
  const thinks = [];
  for (const block of content) {
    if (!block) continue;
    if (block.type === "text" && block.text) texts.push(block.text);
    if (block.type === "thinking" && block.thinking) thinks.push(block.thinking);
  }
  return {
    text: texts.join("\n\n").trim(),
    reasoning: thinks.join("\n\n").trim(),
  };
}

function loadClaudeSessionHistory(session, limit = HISTORY_SCAN_LIMIT) {
  if (isNewAgentSession(session)) return [];
  const filePath =
    session.sessionFile ||
    findClaudeSessionFile(session.id) ||
    "";
  if (!filePath || !fs.existsSync(filePath)) return [];
  const raw = safeRead(filePath, 2_500_000) || "";
  const out = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    const type = String(record.type || "");
    if (type !== "user" && type !== "assistant") continue;
    if (!record.message) continue;
    if (type === "user") {
      const text = cleanTitle(extractMessageText(record.message));
      if (isHistoryNoise(text)) continue;
      out.push({ role: "user", text });
      continue;
    }
    const { text, reasoning } = assistantTextFromClaudeMessage(record.message);
    if (isHistoryNoise(text) && !reasoning) continue;
    out.push({
      role: "assistant",
      text: text || "(empty)",
      reasoning: reasoning || "",
    });
  }
  return out.slice(-Math.max(1, Number(limit) || HISTORY_SCAN_LIMIT));
}

function parseJsonMaybe(value) {
  if (value == null) return null;
  if (typeof value === "object") return value;
  const s = String(value).trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function textFromOpenCodePartData(data) {
  const d = parseJsonMaybe(data);
  if (!d) return "";
  const type = String(d.type || "");
  if (type === "text") {
    return String(d.text || d.part?.text || "").trim();
  }
  return "";
}

function reasoningFromOpenCodePartData(data) {
  const d = parseJsonMaybe(data);
  if (!d) return "";
  const type = String(d.type || "");
  if (type === "reasoning") {
    return String(d.text || d.part?.text || "").trim();
  }
  return "";
}

function openCodeMessageRole(data) {
  const d = parseJsonMaybe(data);
  if (!d) return "";
  if (d.role) return String(d.role).toLowerCase();
  if (d.type === "user" || d.type === "assistant") return d.type;
  return "";
}

function loadOpenCodeHistoryFromDb(sessionId, limit = HISTORY_SCAN_LIMIT) {
  const dbPath = resolveOpenCodeDbPath();
  if (!fs.existsSync(dbPath)) return null;
  const sid = String(sessionId || "");
  if (!sid) return [];

  let rows = null;
  const viaNode = queryOpenCodeHistoryWithNodeSqlite(dbPath, sid, limit);
  if (Array.isArray(viaNode)) rows = viaNode;
  else {
    const viaCli = queryOpenCodeHistoryWithSqlite3(dbPath, sid, limit);
    if (Array.isArray(viaCli)) rows = viaCli;
  }
  return rows;
}

function mapOpenCodeHistoryRows(messageRows, partsByMessage) {
  const out = [];
  for (const row of messageRows || []) {
    const role = openCodeMessageRole(row.data);
    if (role !== "user" && role !== "assistant") continue;
    const parts = partsByMessage.get(row.id) || [];
    const textChunks = [];
    const reasoningChunks = [];
    for (const p of parts) {
      const t = textFromOpenCodePartData(p);
      if (t) textChunks.push(t);
      const r = reasoningFromOpenCodePartData(p);
      if (r) reasoningChunks.push(r);
    }
    const d = parseJsonMaybe(row.data);
    if (!textChunks.length && d?.summary?.body) {
      textChunks.push(String(d.summary.body).trim());
    }
    const text = textChunks.join("\n\n").trim();
    const reasoning = reasoningChunks.join("\n\n").trim();
    if (role === "user") {
      if (isHistoryNoise(text)) continue;
      out.push({ role: "user", text });
    } else {
      if (isHistoryNoise(text) && !reasoning) continue;
      out.push({
        role: "assistant",
        text: text || "(empty)",
        reasoning,
      });
    }
  }
  return out;
}

function queryOpenCodeHistoryWithNodeSqlite(dbPath, sessionId, limit) {
  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return null;
  }
  try {
    const db = new DatabaseSync(dbPath, { readOnly: true });
    try {
      const tables = new Set(
        db
          .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('message','part','session_message')"
          )
          .all()
          .map((r) => r.name)
      );
      if (tables.has("message")) {
        const scan = Number(limit) || HISTORY_SCAN_LIMIT;
        const messages = db
          .prepare(
            `SELECT id, data, time_created FROM message
             WHERE session_id = ?
             ORDER BY time_created DESC, id DESC
             LIMIT ?`
          )
          .all(sessionId, scan)
          .reverse();
        const partsByMessage = new Map();
        if (tables.has("part")) {
          for (const m of messages) {
            const parts = db
              .prepare(
                `SELECT data FROM part
                 WHERE message_id = ?
                 ORDER BY id ASC`
              )
              .all(m.id);
            partsByMessage.set(m.id, parts.map((p) => p.data));
          }
        }
        return mapOpenCodeHistoryRows(messages, partsByMessage);
      }
      if (tables.has("session_message")) {
        const scan = Number(limit) || HISTORY_SCAN_LIMIT;
        const events = db
          .prepare(
            `SELECT data, type FROM session_message
             WHERE session_id = ?
             ORDER BY seq DESC
             LIMIT ?`
          )
          .all(sessionId, scan)
          .reverse();
        const out = [];
        for (const ev of events) {
          const d = parseJsonMaybe(ev.data);
          if (!d) continue;
          const role = String(d.role || ev.type || "").toLowerCase();
          if (role === "user") {
            const text = cleanTitle(
              d.summary?.body || d.text || d.content || ""
            );
            if (!isHistoryNoise(text)) out.push({ role: "user", text });
          } else if (role === "assistant") {
            const text = cleanTitle(d.text || d.content || "");
            const reasoning = cleanTitle(d.reasoning || "");
            if (!isHistoryNoise(text) || reasoning) {
              out.push({
                role: "assistant",
                text: text || "(empty)",
                reasoning,
              });
            }
          }
        }
        return out;
      }
      return [];
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

function queryOpenCodeHistoryWithSqlite3(dbPath, sessionId, limit) {
  const sqlite3 = which("sqlite3");
  if (!sqlite3) return null;
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
    if (!tables.has("message")) {
      if (tables.has("session_message")) {
        const scan = Number(limit) || HISTORY_SCAN_LIMIT;
        const sql = `SELECT data, type FROM session_message WHERE session_id = '${sessionId.replace(/'/g, "''")}' ORDER BY seq DESC LIMIT ${scan};`;
        const out = execFileSync(sqlite3, ["-json", dbPath, sql], {
          encoding: "utf8",
          timeout: 8000,
          stdio: ["ignore", "pipe", "ignore"],
          env: expandedEnv(),
        });
        const events = JSON.parse(out || "[]");
        const mapped = [];
        for (const ev of events) {
          const d = parseJsonMaybe(ev.data);
          if (!d) continue;
          const role = String(d.role || ev.type || "").toLowerCase();
          if (role === "user") {
            const text = cleanTitle(
              d.summary?.body || d.text || d.content || ""
            );
            if (!isHistoryNoise(text)) mapped.push({ role: "user", text });
          } else if (role === "assistant") {
            const text = cleanTitle(d.text || d.content || "");
            const reasoning = cleanTitle(d.reasoning || "");
            if (!isHistoryNoise(text) || reasoning) {
              mapped.push({
                role: "assistant",
                text: text || "(empty)",
                reasoning,
              });
            }
          }
        }
        return mapped.slice().reverse();
      }
      return [];
    }
    const scan = Number(limit) || HISTORY_SCAN_LIMIT;
    const msgSql = `SELECT id, data, time_created FROM message WHERE session_id = '${sessionId.replace(/'/g, "''")}' ORDER BY time_created DESC, id DESC LIMIT ${scan};`;
    const messages = JSON.parse(
      execFileSync(sqlite3, ["-json", dbPath, msgSql], {
        encoding: "utf8",
        timeout: 8000,
        stdio: ["ignore", "pipe", "ignore"],
        env: expandedEnv(),
      }) || "[]"
    ).reverse();
    const partsByMessage = new Map();
    if (tables.has("part")) {
      for (const m of messages) {
        const partSql = `SELECT data FROM part WHERE message_id = '${String(m.id).replace(/'/g, "''")}' ORDER BY id ASC;`;
        const parts = JSON.parse(
          execFileSync(sqlite3, ["-json", dbPath, partSql], {
            encoding: "utf8",
            timeout: 8000,
            stdio: ["ignore", "pipe", "ignore"],
            env: expandedEnv(),
          }) || "[]"
        );
        partsByMessage.set(m.id, parts.map((p) => p.data));
      }
    }
    return mapOpenCodeHistoryRows(messages, partsByMessage);
  } catch {
    return null;
  }
}

function loadOpenCodeHistoryFromStorage(sessionId, limit = HISTORY_SCAN_LIMIT) {
  const root = path.join(opencodeDataDir(), "storage", "message");
  if (!fs.existsSync(root)) return [];
  const sid = String(sessionId || "");
  const matches = [];
  const walk = (dir, depth = 0) => {
    if (depth > 5) return;
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
        const json = parseJsonMaybe(safeRead(full, 120_000));
        if (!json) continue;
        const id = String(json.sessionID || json.session_id || json.sessionId || "");
        if (id !== sid) continue;
        matches.push({ json, mtime: stat.mtimeMs, file: full });
      }
    }
  };
  walk(root);
  matches.sort((a, b) => (a.mtime || 0) - (b.mtime || 0));
  const out = [];
  for (const { json } of matches) {
    const role = String(json.role || json.type || "").toLowerCase();
    if (role === "user" || role === "assistant") {
      const text = cleanTitle(
        json.summary?.body ||
          json.text ||
          json.content ||
          (Array.isArray(json.parts)
            ? json.parts
                .map((p) => (p?.type === "text" ? p.text : ""))
                .filter(Boolean)
                .join("\n\n")
            : "")
      );
      const reasoning = cleanTitle(json.reasoning || "");
      if (role === "user") {
        if (!isHistoryNoise(text)) out.push({ role: "user", text });
      } else if (!isHistoryNoise(text) || reasoning) {
        out.push({
          role: "assistant",
          text: text || "(empty)",
          reasoning,
        });
      }
      continue;
    }
    if (Array.isArray(json.parts)) {
      const text = json.parts
        .map((p) => (p?.type === "text" ? p.text : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();
      const reasoning = json.parts
        .map((p) => (p?.type === "reasoning" ? p.text : ""))
        .filter(Boolean)
        .join("\n\n")
        .trim();
      const guessRole = String(json.role || "assistant").toLowerCase();
      if (guessRole === "user" && !isHistoryNoise(text)) {
        out.push({ role: "user", text });
      } else if (!isHistoryNoise(text) || reasoning) {
        out.push({
          role: "assistant",
          text: text || "(empty)",
          reasoning,
        });
      }
    }
  }
  return out.slice(-Math.max(1, Number(limit) || HISTORY_SCAN_LIMIT));
}

function loadOpenCodeSessionHistory(session, limit = HISTORY_SCAN_LIMIT) {
  if (isNewAgentSession(session)) return [];
  const sid = String(session.id || "");
  if (!sid) return [];
  const scan = Math.max(1, Number(limit) || HISTORY_SCAN_LIMIT);
  const fromDb = loadOpenCodeHistoryFromDb(sid, scan);
  if (Array.isArray(fromDb) && fromDb.length) return fromDb;
  const fromStorage = loadOpenCodeHistoryFromStorage(sid, scan);
  if (fromStorage.length) return fromStorage;
  return Array.isArray(fromDb) ? fromDb : [];
}

/**
 * Load prior chat turns for an existing Claude / OpenCode session.
 * @returns {{ messages: Array<{role:'user'|'assistant',text:string,reasoning?:string}>, hasMore: boolean, nextBefore: number, total: number }}
 */
function loadSessionHistory(session, options = {}) {
  const empty = { messages: [], hasMore: false, nextBefore: 0, total: 0 };
  if (!session || session.provider === "flickctx") {
    return empty;
  }
  if (isNewAgentSession(session)) {
    return empty;
  }
  let all = [];
  if (session.provider === "claude") {
    all = loadClaudeSessionHistory(session, HISTORY_SCAN_LIMIT);
  } else if (session.provider === "opencode") {
    all = loadOpenCodeSessionHistory(session, HISTORY_SCAN_LIMIT);
  } else {
    return empty;
  }
  return pageSessionHistory(all, options);
}

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
  const sid =
    ev.session_id ||
    ev.sessionId ||
    ev.data?.session_id ||
    (type === "system" ? ev.session_id : "");
  if (sid) state.sessionId = String(sid);

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

function buildClaudeArgs({ resumeId, sessionId, prompt, stream }) {
  const args = ["-p"];
  if (resumeId) {
    args.push("--resume", resumeId);
  } else if (sessionId) {
    args.push("--session-id", sessionId);
  }
  if (stream) {
    args.push(
      "--output-format",
      "stream-json",
      "--verbose",
      "--include-partial-messages"
    );
  } else {
    args.push("--output-format", "json");
  }
  args.push(
    "--permission-mode",
    "acceptEdits",
    "--allowedTools",
    "Read",
    "--allowedTools",
    "Glob",
    "--allowedTools",
    "Grep",
    prompt
  );
  return args;
}

async function sendToClaudeSession({ session, question, imagePath, onProgress }) {
  const bin = which("claude");
  if (!bin) {
    throw new Error(
      "Claude Code CLI not found on PATH. Install `claude`, or pick OpenCode / Flickctx built-in."
    );
  }
  const creating = isNewAgentSession(session);
  if (!creating && !session?.id) throw new Error("Missing Claude session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  const createdId = creating ? newClaudeSessionId() : "";
  const state = {
    text: "",
    reasoning: "",
    finalText: "",
    sawStreamText: false,
    error: "",
    sessionId: creating ? createdId : session.id,
  };
  emitProgress(onProgress, {
    kind: "status",
    text: "",
    reasoning: "",
    status: creating
      ? "Claude Code · creating session…"
      : "Claude Code · starting…",
  });

  const streamArgs = buildClaudeArgs({
    resumeId: creating ? "" : session.id,
    sessionId: creating ? createdId : "",
    prompt,
    stream: true,
  });

  let stdout = "";
  try {
    const result = await spawnStreaming(bin, streamArgs, {
      cwd,
      timeout: 240_000,
      onLine: (line) => consumeClaudeStreamLine(line, state, onProgress),
    });
    stdout = result.stdout || "";
  } catch (err) {
    // Older CLIs may not support stream-json / --session-id — fall back.
    const fallbackArgs = buildClaudeArgs({
      resumeId: creating ? "" : session.id,
      sessionId: "",
      prompt,
      stream: false,
    });
    try {
      const fallback = await runCommand(bin, fallbackArgs, {
        cwd,
        timeout: 240_000,
      });
      stdout = fallback.stdout || "";
      state.text = extractClaudePrintText(stdout);
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.session_id) state.sessionId = String(parsed.session_id);
      } catch {
        /* ignore */
      }
    } catch (fallbackErr) {
      throw err.message ? err : fallbackErr;
    }
  }

  const text =
    state.finalText || state.text || extractClaudePrintText(stdout) || "";
  if (!text) {
    throw new Error(
      state.error || "Claude Code returned an empty response."
    );
  }
  const routeId = state.sessionId || createdId || session.id;
  return {
    explanation: text,
    reasoning: state.reasoning || "",
    model: "claude-code-session",
    route: {
      provider: "claude",
      id: routeId,
      title:
        creating && (!session.title || session.title.startsWith("New "))
          ? `Claude · ${String(routeId).slice(0, 8)}`
          : session.title || routeId,
      directory: cwd,
      isNew: false,
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
  const sid = ev.sessionID || ev.sessionId || ev.session_id || ev.part?.sessionID;
  if (sid) state.sessionId = String(sid);

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

/**
 * Strip JSONC comments / trailing commas enough for OpenCode config files.
 */
function parseJsonc(text) {
  const stripped = String(text || "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,\s*([}\]])/g, "$1");
  return JSON.parse(stripped);
}

function normalizeOpenCodeModel(model) {
  if (!model) return "";
  if (typeof model === "string") return model.trim();
  if (typeof model === "object") {
    const provider = String(model.providerID || model.provider || "").trim();
    const id = String(model.model || model.modelID || "").trim();
    if (provider && id) return `${provider}/${id}`;
    if (id.includes("/")) return id;
  }
  return "";
}

function openCodeConfigFilenames(dir) {
  return [
    path.join(dir, "opencode.json"),
    path.join(dir, "opencode.jsonc"),
  ];
}

function readOpenCodeModelFromFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    const raw = fs.readFileSync(filePath, "utf8");
    const data = parseJsonc(raw);
    return normalizeOpenCodeModel(data?.model);
  } catch {
    return "";
  }
}

/**
 * Resolve the default model OpenCode would use from its config files.
 * Later paths override earlier ones (project beats global).
 * Does NOT invent OpenCode Go — if unset, returns "" and CLI uses its own default.
 */
function resolveOpenCodeModel(startDir = process.cwd()) {
  const candidates = [];
  const globalDir = path.join(os.homedir(), ".config", "opencode");
  candidates.push(...openCodeConfigFilenames(globalDir));

  const chain = [];
  let dir = path.resolve(startDir || process.cwd());
  while (true) {
    chain.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // farthest → closest so project overrides global/repo root
  for (const d of chain.slice().reverse()) {
    candidates.push(...openCodeConfigFilenames(d));
    candidates.push(...openCodeConfigFilenames(path.join(d, ".opencode")));
  }

  let model = "";
  for (const file of candidates) {
    const m = readOpenCodeModelFromFile(file);
    if (m) model = m;
  }
  return model;
}

function buildOpenCodeArgs({ sessionId, imagePath, prompt, thinking, model }) {
  const args = ["run"];
  if (sessionId) args.push("--session", sessionId);
  // Always prefer the user's configured OpenCode model (e.g. github-copilot/…)
  // so headless `run` does not fall back to OpenCode Go free quota.
  if (model) args.push("--model", model);
  args.push("--format", "json");
  if (thinking) args.push("--thinking");
  args.push("--file", imagePath, prompt);
  return args;
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
  const creating = isNewAgentSession(session);
  if (!creating && !session?.id) throw new Error("Missing OpenCode session id.");
  const prompt = buildMarkPrompt(question, imagePath);
  const cwd =
    (session.directory && fs.existsSync(session.directory)
      ? session.directory
      : "") || process.cwd();
  // Prefer an explicit new id (create-if-missing on OpenCode 2.1.4+).
  // If that fails, retry with no --session so the CLI allocates one.
  const createdId = creating ? newOpenCodeSessionId() : "";
  const configuredModel =
    normalizeOpenCodeModel(session?.model) || resolveOpenCodeModel(cwd);
  const state = {
    text: "",
    textParts: [],
    reasoning: "",
    reasoningParts: [],
    error: "",
    sessionId: creating ? createdId : session.id,
  };
  emitProgress(onProgress, {
    kind: "status",
    text: "",
    reasoning: "",
    status: creating
      ? configuredModel
        ? `OpenCode · creating · ${configuredModel}`
        : "OpenCode · creating session…"
      : configuredModel
        ? `OpenCode · ${configuredModel}`
        : "OpenCode · starting…",
  });

  async function runOnce(sessionId, thinking) {
    return spawnStreaming(
      bin,
      buildOpenCodeArgs({
        sessionId,
        imagePath,
        prompt,
        thinking,
        model: configuredModel,
      }),
      {
        cwd,
        timeout: 240_000,
        onLine: (line) => consumeOpenCodeStreamLine(line, state, onProgress),
      }
    );
  }

  let stdout = "";
  try {
    const result = await runOnce(creating ? createdId : session.id, true);
    stdout = result.stdout || "";
  } catch (err) {
    const msg = String(err.message || err);
    if (creating && /not found|invalid|unknown session/i.test(msg)) {
      // Older OpenCode: omit --session to create.
      state.sessionId = "";
      const result = await runOnce("", /thinking|unknown|unexpected/i.test(msg) ? false : true);
      stdout = result.stdout || "";
    } else if (/thinking|unknown|unexpected/i.test(msg)) {
      const result = await runOnce(creating ? createdId : session.id, false);
      stdout = result.stdout || "";
    } else if (/quota|usage limit|429|opencode go/i.test(msg) && !configuredModel) {
      throw new Error(
        `${msg}\n\nFlickctx could not find a model in your OpenCode config. ` +
          `Set "model" in ~/.config/opencode/opencode.json (e.g. "github-copilot/gpt-4.1") ` +
          `or pick that model once in the OpenCode TUI with /models.`
      );
    } else if (/quota|usage limit|429|opencode go/i.test(msg) && configuredModel) {
      throw new Error(
        `${msg}\n\nFlickctx passed --model ${configuredModel} from your OpenCode settings. ` +
          `If this still hits OpenCode Go, check that provider is connected (/connect) and the model id is correct.`
      );
    } else {
      throw err;
    }
  }

  const text = state.text || extractOpenCodeText(stdout) || "";
  if (!text) {
    const emptyMsg = state.error || "OpenCode returned an empty response.";
    if (/quota|usage limit|429|opencode go/i.test(emptyMsg)) {
      throw new Error(
        configuredModel
          ? `${emptyMsg}\n\nFlickctx used --model ${configuredModel} from OpenCode settings.`
          : `${emptyMsg}\n\nSet "model" in ~/.config/opencode/opencode.json to your Copilot (or other) model so Flickctx does not fall back to OpenCode Go.`
      );
    }
    throw new Error(emptyMsg);
  }
  const routeId = state.sessionId || createdId || session.id;
  return {
    explanation: text,
    reasoning: state.reasoning || "",
    model: configuredModel || "opencode-session",
    route: {
      provider: "opencode",
      id: routeId,
      title:
        creating && (!session.title || session.title.startsWith("New "))
          ? `OpenCode · ${String(routeId).slice(0, 12)}`
          : session.title || routeId,
      directory: cwd,
      model: configuredModel || "",
      isNew: false,
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
  resolveOpenCodeModel,
  normalizeOpenCodeModel,
  buildOpenCodeArgs,
  sendToAgentSession,
  buildMarkPrompt,
  which,
  expandedEnv,
  consumeClaudeStreamLine,
  consumeOpenCodeStreamLine,
  isNewAgentSession,
  loadSessionHistory,
  pageSessionHistory,
  findClaudeSessionFile,
  loadClaudeSessionHistory,
  loadOpenCodeSessionHistory,
  HISTORY_PAGE_DEFAULT,
  HISTORY_SCAN_LIMIT,
};
