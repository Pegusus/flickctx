const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-sessions-"));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.CLAUDE_CONFIG_DIR = path.join(TMP, ".claude");
process.env.XDG_DATA_HOME = path.join(TMP, "share");

delete require.cache[require.resolve("./context")];
delete require.cache[require.resolve("./sessions")];
const {
  listClaudeSessions,
  buildMarkPrompt,
  listAgentSessions,
  listOpenCodeSessionsFromDb,
} = require("./sessions");

const projectDir = path.join(TMP, ".claude", "projects", "-Users-demo-app");
fs.mkdirSync(projectDir, { recursive: true });
const sessionFile = path.join(projectDir, "abc123def.jsonl");
fs.writeFileSync(
  sessionFile,
  [
    JSON.stringify({
      type: "summary",
      summary: "Fix payments timeout",
      sessionId: "abc123def",
    }),
    JSON.stringify({
      type: "user",
      sessionId: "abc123def",
      cwd: "/Users/demo/app",
      message: { content: "why are payments failing?" },
    }),
  ].join("\n") + "\n"
);

// Nested transcript (newer Claude layouts)
const nestedDir = path.join(projectDir, "sub");
fs.mkdirSync(nestedDir, { recursive: true });
fs.writeFileSync(
  path.join(nestedDir, "nested999.jsonl"),
  JSON.stringify({
    type: "user",
    sessionId: "nested999",
    cwd: "/Users/demo/nested",
    message: { content: "nested session question" },
  }) + "\n"
);

const sessions = listClaudeSessions(10);
assert.ok(sessions.length >= 2);
assert.ok(sessions.some((s) => s.id === "abc123def"));
assert.ok(sessions.some((s) => s.id === "nested999"));
assert.match(
  sessions.find((s) => s.id === "abc123def").title,
  /payments/i
);

const prompt = buildMarkPrompt("what is this?", "/tmp/mark.png");
assert.match(prompt, /\/tmp\/mark\.png/);

const listed = listAgentSessions({ limit: 10 });
assert.ok(listed.sessions.some((s) => s.id === "abc123def"));
assert.ok(listed.byProvider.claude.some((s) => s.id === "abc123def"));
assert.strictEqual(listed.counts.claude, listed.byProvider.claude.length);

// OpenCode v2 DB (session_v2) — use sqlite3 when available
const ocDir = path.join(TMP, "share", "opencode");
fs.mkdirSync(ocDir, { recursive: true });
const dbPath = path.join(ocDir, "opencode.db");
process.env.OPENCODE_DB = dbPath;

let sqlite3 = "";
try {
  sqlite3 = execFileSync("which", ["sqlite3"], { encoding: "utf8" }).trim();
} catch {
  sqlite3 = "";
}

if (sqlite3) {
  execFileSync(sqlite3, [
    dbPath,
    `CREATE TABLE session_v2 (
      id TEXT PRIMARY KEY,
      title TEXT,
      directory TEXT,
      parent_id TEXT,
      time_updated INTEGER,
      time_archived INTEGER
    );
    INSERT INTO session_v2 VALUES
      ('ses_old','Old chat','/Users/demo/old',NULL,1000,NULL),
      ('ses_new','New chat','/Users/demo/new',NULL,9000,NULL),
      ('ses_child','Child','/Users/demo/new','ses_new',8000,NULL),
      ('ses_arch','Archived','/Users/demo/x',NULL,9500,1);`,
  ]);

  delete require.cache[require.resolve("./sessions")];
  const { listOpenCodeSessionsFromDb: listOcDb, listAgentSessions: listAll } =
    require("./sessions");
  const oc = listOcDb(10);
  assert.ok(oc.some((s) => s.id === "ses_new"));
  assert.ok(oc.some((s) => s.id === "ses_old"));
  assert.ok(!oc.some((s) => s.id === "ses_child"), "child sessions excluded");
  assert.ok(!oc.some((s) => s.id === "ses_arch"), "archived excluded");
  assert.strictEqual(oc[0].id, "ses_new");

  // Many Claude sessions must not hide OpenCode in byProvider
  for (let i = 0; i < 25; i++) {
    fs.writeFileSync(
      path.join(projectDir, `extra${i}.jsonl`),
      JSON.stringify({
        type: "user",
        sessionId: `extra${i}`,
        cwd: "/Users/demo/app",
        message: { content: `extra ${i}` },
      }) + "\n"
    );
  }
  delete require.cache[require.resolve("./sessions")];
  const listed2 = require("./sessions").listAgentSessions({ limit: 10 });
  assert.ok(
    listed2.byProvider.opencode.some((s) => s.id === "ses_new"),
    "OpenCode sessions stay visible beside many Claude chats"
  );
  assert.ok(listed2.counts.opencode >= 1);
} else {
  console.log("sessions.test.js: sqlite3 missing — skipped OpenCode DB checks");
}

console.log("sessions.test.js: ok");
