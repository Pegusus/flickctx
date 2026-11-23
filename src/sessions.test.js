const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

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

const sessions = listClaudeSessions(10);
assert.ok(sessions.length >= 1);
assert.strictEqual(sessions[0].provider, "claude");
assert.strictEqual(sessions[0].id, "abc123def");
assert.match(sessions[0].title, /payments/i);

const prompt = buildMarkPrompt("what is this?", "/tmp/mark.png");
assert.match(prompt, /\/tmp\/mark\.png/);

const listed = listAgentSessions({ limit: 10 });
assert.ok(listed.sessions.some((s) => s.id === "abc123def"));

console.log("sessions.test.js: ok");
