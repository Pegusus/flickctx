const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-oc-model-"));
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;

delete require.cache[require.resolve("./sessions")];
const {
  resolveOpenCodeModel,
  normalizeOpenCodeModel,
  buildOpenCodeArgs,
} = require("./sessions");

assert.strictEqual(
  normalizeOpenCodeModel("github-copilot/gpt-4.1"),
  "github-copilot/gpt-4.1"
);
assert.strictEqual(
  normalizeOpenCodeModel({
    providerID: "github-copilot",
    model: "claude-sonnet-4",
  }),
  "github-copilot/claude-sonnet-4"
);

const globalDir = path.join(TMP, ".config", "opencode");
fs.mkdirSync(globalDir, { recursive: true });
fs.writeFileSync(
  path.join(globalDir, "opencode.json"),
  JSON.stringify({ model: "opencode/free-go-default" }, null, 2)
);

const project = path.join(TMP, "app");
fs.mkdirSync(project, { recursive: true });
fs.writeFileSync(
  path.join(project, "opencode.jsonc"),
  `{
  // prefer Copilot in this project
  "model": "github-copilot/gpt-4.1",
}
`
);

assert.strictEqual(
  resolveOpenCodeModel(project),
  "github-copilot/gpt-4.1",
  "project config should override global"
);

const args = buildOpenCodeArgs({
  sessionId: "ses_abc",
  imagePath: "/tmp/a.png",
  prompt: "hi",
  thinking: true,
  model: "github-copilot/gpt-4.1",
});
assert.ok(args.includes("--model"));
assert.strictEqual(args[args.indexOf("--model") + 1], "github-copilot/gpt-4.1");
assert.ok(args.includes("--session"));
assert.ok(args.includes("--thinking"));

const noModel = buildOpenCodeArgs({
  sessionId: "",
  imagePath: "/tmp/a.png",
  prompt: "hi",
  thinking: false,
  model: "",
});
assert.ok(!noModel.includes("--model"));

console.log("opencodeModel.test.js ok");
