const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { claudeConfigDir } = require("./context");

const DEFAULT_LIMIT = 24;

function which(cmd) {
  try {
    return execFileSync(
      process.platform === "win32" ? "where" : "which",
      [cmd],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 3000,
      }
    )
      .trim()
      .split(/\r?\n/)[0];
  } catch {
    return "";
  }
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
      if (text) {
        preview = text.slice(0, 140);
        if (!title && record.type === "user") title = preview.slice(0, 80);
      }
    }
  }

  let mtime = 0;
  try {
    mtime = fs.statSync(filePath).mtimeMs;
  } catch {
    /* ignore */
  }

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

function listClaudeSessions(limit = DEFAULT_LIMIT) {
  const root = path.join(claudeConfigDir(), "projects");
  if (!fs.existsSync(root)) return [];

  const files = [];
  let projectDirs = [];
  try {
    projectDirs = fs
      .readdirSync(root)
      .map((name) => path.join(root, name))
      .filter((dir) => {
        try {
          return fs.statSync(dir).isDirectory();
        } catch {
          return false;
        }
      });
  } catch {
    return [];
  }

  for (const dir of projectDirs) {
    let entries = [];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const full = path.join(dir, name);
      try {
        const stat = fs.statSync(full);
        files.push({ full, mtime: stat.mtimeMs });
      } catch {
        /* ignore */
      }
    }
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.slice(0, limit).map((f) => summarizeClaudeTranscript(f.full));
}

function opencodeDataDir() {
  const dataDir =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  return path.join(dataDir, "opencode");
}

function listOpenCodeSessionsFromCli(limit = DEFAULT_LIMIT) {
  if (!which("opencode")) return null;
  try {
    const out = execFileSync(
      "opencode",
      ["session", "list", "--max-count", String(limit), "--format", "json"],
      {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 4_000_000,
        stdio: ["ignore", "pipe", "ignore"],
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
    return rows
      .map((row) => ({
        provider: "opencode",
        id: String(row.id || row.sessionID || ""),
        title: String(row.title || row.name || row.id || "OpenCode session"),
        directory: String(row.directory || row.path || row.cwd || ""),
        preview: String(row.preview || row.summary || "").slice(0, 140),
        mtime: Number(row.time_updated || row.updatedAt || row.mtime || 0),
      }))
      .filter((s) => s.id);
  } catch {
    return null;
  }
}

function listOpenCodeSessionsFromDb(limit = DEFAULT_LIMIT) {
  const dbPath =
    process.env.OPENCODE_DB || path.join(opencodeDataDir(), "opencode.db");
  if (!fs.existsSync(dbPath) || !which("sqlite3")) return [];
  try {
    const sql = `SELECT id, title, directory, time_updated
      FROM session
      ORDER BY time_updated DESC
      LIMIT ${Number(limit) || DEFAULT_LIMIT};`;
    const out = execFileSync("sqlite3", ["-json", dbPath, sql], {
      encoding: "utf8",
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const rows = JSON.parse(out || "[]");
    return rows
      .map((row) => ({
        provider: "opencode",
        id: String(row.id || ""),
        title: String(row.title || row.id || "OpenCode session"),
        directory: String(row.directory || ""),
        preview: "",
        mtime: Number(row.time_updated || 0),
      }))
      .filter((s) => s.id);
  } catch {
    return [];
  }
}

function listOpenCodeSessions(limit = DEFAULT_LIMIT) {
  return (
    listOpenCodeSessionsFromCli(limit) ||
    listOpenCodeSessionsFromDb(limit) ||
    []
  );
}

function listAgentSessions(options = {}) {
  const limit = options.limit || DEFAULT_LIMIT;
  const claude = listClaudeSessions(limit);
  const opencode = listOpenCodeSessions(limit);
  const all = [...claude, ...opencode].sort(
    (a, b) => (b.mtime || 0) - (a.mtime || 0)
  );
  return {
    sessions: all.slice(0, limit),
    claudeAvailable: Boolean(which("claude")),
    opencodeAvailable: Boolean(which("opencode")),
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
        env: { ...process.env, ...(opts.env || {}) },
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
  if (!which("claude")) {
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
  const { stdout } = await runCommand("claude", args, {
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
  if (!which("opencode")) {
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
  const { stdout } = await runCommand("opencode", args, {
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
  sendToAgentSession,
  buildMarkPrompt,
  which,
};
