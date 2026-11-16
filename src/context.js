const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function safeRead(filePath, maxBytes = 200_000) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return null;
    const buf = fs.readFileSync(filePath);
    return buf.slice(0, maxBytes).toString("utf8");
  } catch {
    return null;
  }
}

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout: 8000,
      maxBuffer: 2_000_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function encodeClaudeProjectDir(absPath) {
  const resolved = path.resolve(absPath);
  return resolved.replace(/[^a-zA-Z0-9]/g, "-");
}

function claudeConfigDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
}

function findProjectDocs(projectPath) {
  const names = [
    "CLAUDE.md",
    "AGENTS.md",
    "OPENCODE.md",
    "README.md",
    ".cursorrules",
  ];
  const found = [];
  for (const name of names) {
    const full = path.join(projectPath, name);
    const text = safeRead(full, 12_000);
    if (text) found.push({ name, text: text.slice(0, 4000) });
  }
  return found;
}

function gatherGitContext(projectPath, maxDiffChars) {
  const inside = run("git", ["rev-parse", "--is-inside-work-tree"], projectPath);
  if (inside !== "true") {
    return { isGit: false, status: "", diff: "", recentLog: "" };
  }
  const status = run("git", ["status", "--short", "--branch"], projectPath);
  const hasHead = Boolean(run("git", ["rev-parse", "--verify", "HEAD"], projectPath));
  const diff = hasHead
    ? [
        run("git", ["diff", "--stat", "HEAD"], projectPath),
        run("git", ["diff", "HEAD"], projectPath),
      ]
        .filter(Boolean)
        .join("\n\n")
    : run("git", ["diff", "--stat"], projectPath) ||
      "(no commits yet — untracked/working tree only)";
  const recentLog = hasHead
    ? run("git", ["log", "-5", "--oneline", "--decorate"], projectPath)
    : "";
  return {
    isGit: true,
    status: status || "(clean)",
    diff: String(diff).slice(0, maxDiffChars),
    recentLog,
  };
}

function extractTextFromClaudeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const type = record.type;
  if (type !== "user" && type !== "assistant") return null;

  const message = record.message;
  if (!message) return null;

  let body = "";
  if (typeof message.content === "string") {
    body = message.content;
  } else if (Array.isArray(message.content)) {
    body = message.content
      .map((part) => {
        if (!part) return "";
        if (typeof part === "string") return part;
        if (part.type === "text") return part.text || "";
        if (part.type === "tool_use") {
          return `[tool_use ${part.name || "unknown"}]`;
        }
        if (part.type === "tool_result") {
          const content =
            typeof part.content === "string"
              ? part.content
              : JSON.stringify(part.content || "").slice(0, 400);
          return `[tool_result] ${content}`;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  body = (body || "").trim();
  if (!body) return null;
  return { role: type, text: body.slice(0, 1200), cwd: record.cwd || null };
}

function gatherClaudeCodeContext(projectPath, maxChars) {
  const root = path.join(claudeConfigDir(), "projects");
  if (!fs.existsSync(root)) {
    return { available: false, summary: "No ~/.claude/projects found." };
  }

  const encoded = encodeClaudeProjectDir(projectPath);
  const exactDir = path.join(root, encoded);

  let projectDirs = [];
  if (fs.existsSync(exactDir)) {
    projectDirs = [exactDir];
  } else {
    // Fuzzy: directory name contains distinctive path segments
    const needle = path.basename(projectPath).toLowerCase();
    try {
      projectDirs = fs
        .readdirSync(root)
        .map((name) => path.join(root, name))
        .filter((dir) => {
          try {
            return (
              fs.statSync(dir).isDirectory() &&
              path.basename(dir).toLowerCase().includes(needle)
            );
          } catch {
            return false;
          }
        });
    } catch {
      projectDirs = [];
    }
  }

  if (!projectDirs.length) {
    return {
      available: false,
      summary: `No Claude Code transcript matched ${projectPath}`,
    };
  }

  const jsonlFiles = [];
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
        jsonlFiles.push({ full, mtime: stat.mtimeMs });
      } catch {
        /* ignore */
      }
    }
  }

  jsonlFiles.sort((a, b) => b.mtime - a.mtime);
  if (!jsonlFiles.length) {
    return { available: false, summary: "Claude Code project dir has no sessions." };
  }

  const latest = jsonlFiles[0].full;
  const raw = safeRead(latest, 1_500_000) || "";
  const lines = raw.split("\n").filter(Boolean);
  const turns = [];
  for (let i = lines.length - 1; i >= 0 && turns.length < 16; i--) {
    try {
      const record = JSON.parse(lines[i]);
      const turn = extractTextFromClaudeRecord(record);
      if (turn) turns.push(turn);
    } catch {
      /* ignore bad line */
    }
  }
  turns.reverse();

  let summary = turns
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n\n");
  if (summary.length > maxChars) {
    summary = summary.slice(summary.length - maxChars);
  }

  // Auto memory if present
  const memoryPath = path.join(path.dirname(latest), "memory", "MEMORY.md");
  const memory = safeRead(memoryPath, 3000);

  return {
    available: true,
    sessionFile: latest,
    summary: summary || "(empty recent transcript)",
    memory: memory || "",
  };
}

function gatherOpenCodeContext(projectPath, maxChars) {
  const dataDir =
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
  const base = path.join(dataDir, "opencode");
  const dbPath = process.env.OPENCODE_DB || path.join(base, "opencode.db");
  const storageSession = path.join(base, "storage", "session");

  const bits = [];

  if (fs.existsSync(dbPath)) {
    bits.push(`OpenCode DB present at ${dbPath}`);
    // Best-effort: try sqlite3 CLI if available
    const sql = `SELECT id, title, directory, datetime(time_updated/1000, 'unixepoch') AS updated
      FROM session
      WHERE directory LIKE '%${path.basename(projectPath).replace(/'/g, "")}%'
      ORDER BY time_updated DESC LIMIT 3;`;
    const out = run("sqlite3", ["-header", "-separator", " | ", dbPath, sql]);
    if (out) bits.push("Recent sessions:\n" + out);
  }

  // Legacy / alternate JSON storage
  if (fs.existsSync(storageSession)) {
    const matches = [];
    const walk = (dir, depth = 0) => {
      if (depth > 3) return;
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
          const text = safeRead(full, 50_000);
          if (!text) continue;
          if (
            text.includes(projectPath) ||
            text.includes(path.basename(projectPath))
          ) {
            matches.push({ full, mtime: stat.mtimeMs, text });
          }
        }
      }
    };
    walk(storageSession);
    matches.sort((a, b) => b.mtime - a.mtime);
    for (const m of matches.slice(0, 2)) {
      try {
        const json = JSON.parse(m.text);
        const title = json.title || json.id || path.basename(m.full);
        const directory = json.directory || json.path || "";
        bits.push(`Session ${title} (${directory})`);
      } catch {
        bits.push(`Session file ${m.full}`);
      }
    }
  }

  // Recent opencode log tail
  const logPath = path.join(base, "log", "opencode.log");
  const logTail = safeRead(logPath, 8000);
  if (logTail) {
    const lines = logTail.split("\n").slice(-40).join("\n");
    bits.push("Recent OpenCode log:\n" + lines);
  }

  if (!bits.length) {
    return { available: false, summary: "No OpenCode local data found." };
  }

  let summary = bits.join("\n\n");
  if (summary.length > maxChars) summary = summary.slice(-maxChars);
  return { available: true, summary };
}

function gatherRecentFiles(projectPath) {
  const out = run(
    "git",
    ["ls-files", "--modified", "--others", "--exclude-standard"],
    projectPath
  );
  if (out) return out.split("\n").filter(Boolean).slice(0, 30);

  // Fallback: top-level listing
  try {
    return fs
      .readdirSync(projectPath)
      .filter((n) => !n.startsWith(".") && n !== "node_modules")
      .slice(0, 30);
  } catch {
    return [];
  }
}

function gatherContext(options = {}) {
  const projectPath = path.resolve(options.projectPath || process.cwd());
  const maxTranscriptChars = options.maxTranscriptChars || 6000;
  const maxDiffChars = options.maxDiffChars || 4000;
  const question = options.question || "";
  const scanLocalRepos = options.scanLocalRepos !== false;
  const searchRoots = options.searchRoots || [];
  const maxRepos = options.maxRepos || 80;
  // Keep ambient context thin. Tools deepen on demand.
  const light = options.light !== false;

  const {
    discoverRepos,
    rankRepos,
    deepenRepo,
    formatRepoCatalog,
  } = require("./repos");

  const sections = [];
  sections.push(`Machine: ${process.platform} | ${new Date().toISOString()}`);
  sections.push(
    `Note: local paths below are optional background. Answer the user's ask about the screenshot. Do not treat an unrelated local app folder as the subject.`
  );

  let repoMeta = { scanned: false, count: 0, matched: [], roots: searchRoots };
  let git = { isGit: false };
  let claude = { available: false };
  let opencode = { available: false };
  let docs = [];

  if (scanLocalRepos) {
    const { roots, repos } = discoverRepos({
      roots: searchRoots,
      maxRepos,
      maxDepth: 3,
    });
    repoMeta = { scanned: true, count: repos.length, matched: [], roots };
    sections.push(
      `Local git repos (${repos.length}) under ${roots.join(", ") || "(none)"}:\n` +
        formatRepoCatalog(repos)
    );

    // Only deepen repos that match the QUESTION (not the flickctx install path)
    const ranked = rankRepos(repos, question, 5);
    for (const { repo, score } of ranked) {
      if (score < 8) continue;
      if (repoMeta.matched.length >= 2) break;
      const deep = deepenRepo(repo.path, Math.floor(maxDiffChars / 2));
      repoMeta.matched.push(repo.path);
      sections.push(
        `Likely related repo: ${repo.name} (${repo.path})\n` +
          `markers=${(repo.markers || []).join(",") || "–"} remote=${repo.remote || "–"}\n` +
          `git status:\n${deep.status || "(n/a)"}\n` +
          (deep.docs ? `\n${deep.docs.slice(0, 2000)}` : "")
      );
    }
  }

  if (!light) {
    git = gatherGitContext(projectPath, maxDiffChars);
    claude = gatherClaudeCodeContext(projectPath, maxTranscriptChars);
    opencode = gatherOpenCodeContext(
      projectPath,
      Math.floor(maxTranscriptChars / 2)
    );
    docs = findProjectDocs(projectPath);
    if (docs.length) {
      sections.push(
        "Configured project docs:\n" +
          docs.map((d) => `--- ${d.name} ---\n${d.text}`).join("\n\n")
      );
    }
    if (git.isGit) {
      sections.push(`Configured project git:\n${git.status}`);
    }
    if (claude.available) {
      sections.push(`Claude Code:\n${claude.summary}`);
    }
    if (opencode.available) {
      sections.push(`OpenCode:\n${opencode.summary}`);
    }
  }

  return {
    projectPath,
    text: sections.join("\n\n"),
    meta: {
      git: Boolean(git.isGit),
      claude: Boolean(claude.available),
      opencode: Boolean(opencode.available),
      docs: docs.map((d) => d.name),
      localRepos: repoMeta.count,
      matchedRepos: repoMeta.matched,
      searchRoots: repoMeta.roots || searchRoots,
    },
  };
}

module.exports = {
  gatherContext,
  encodeClaudeProjectDir,
  claudeConfigDir,
};
