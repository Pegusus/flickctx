const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-config-"));
const CONFIG_DIR = path.join(TMP, ".config", "flickctx");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");
const CLAUDE_DIR = path.join(TMP, ".claude");

process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
process.env.CLAUDE_CONFIG_DIR = CLAUDE_DIR;
delete process.env.FLICKCTX_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_AUTH_TOKEN;
delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
delete process.env.FLICKCTX_PROJECT;

delete require.cache[require.resolve("./claudeAuth")];
delete require.cache[require.resolve("./config")];
delete require.cache[require.resolve("./repos")];
const {
  loadConfig,
  saveConfig,
  resolveApiKey,
  CONFIG_PATH: resolvedPath,
} = require("./config");

assert.strictEqual(resolvedPath, CONFIG_PATH);

function clearEnv() {
  delete process.env.FLICKCTX_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
}

function writeFileKey(key) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ apiKey: key, model: "claude-sonnet-4-5" }, null, 2) + "\n"
  );
}

function writeClaudeLogin(accessToken = "sk-ant-oat01-testtoken") {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(CLAUDE_DIR, ".credentials.json"),
    JSON.stringify(
      {
        claudeAiOauth: {
          accessToken,
          refreshToken: "sk-ant-ort01-refresh",
          expiresAt: Date.now() + 60 * 60 * 1000,
          subscriptionType: "pro",
        },
      },
      null,
      2
    ) + "\n"
  );
}

function clearClaudeLogin() {
  const p = path.join(CLAUDE_DIR, ".credentials.json");
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

{
  clearEnv();
  clearClaudeLogin();
  assert.deepStrictEqual(resolveApiKey(""), {
    apiKey: "",
    apiKeySource: "none",
    authMode: "none",
  });

  process.env.ANTHROPIC_API_KEY = "sk-anthro";
  assert.deepStrictEqual(resolveApiKey(""), {
    apiKey: "sk-anthro",
    apiKeySource: "ANTHROPIC_API_KEY",
    authMode: "api_key",
  });

  assert.deepStrictEqual(resolveApiKey("sk-file"), {
    apiKey: "sk-file",
    apiKeySource: "config",
    authMode: "api_key",
  });

  process.env.FLICKCTX_API_KEY = "sk-flick";
  assert.deepStrictEqual(resolveApiKey("sk-file"), {
    apiKey: "sk-flick",
    apiKeySource: "FLICKCTX_API_KEY",
    authMode: "api_key",
  });
}

{
  clearEnv();
  clearClaudeLogin();
  writeFileKey("sk-from-config");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-from-config");
  assert.strictEqual(cfg.apiKeySource, "config");
  assert.strictEqual(cfg.authMode, "api_key");
}

{
  clearEnv();
  writeFileKey("");
  // empty string in file — treat as missing for resolve via loadConfig path
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ model: "claude-sonnet-4-5" }, null, 2) + "\n"
  );
  writeClaudeLogin("sk-ant-oat01-from-claude");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-ant-oat01-from-claude");
  assert.strictEqual(cfg.apiKeySource, "claude_code_credentials");
  assert.strictEqual(cfg.authMode, "oauth");
  assert.strictEqual(cfg.subscriptionType, "pro");
}

{
  clearEnv();
  clearClaudeLogin();
  writeFileKey("sk-from-config");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  process.env.FLICKCTX_API_KEY = "sk-explicit";
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-explicit");
  assert.strictEqual(cfg.apiKeySource, "FLICKCTX_API_KEY");
}

{
  clearEnv();
  writeFileKey("sk-keep-me");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  saveConfig({ model: "claude-haiku-4-5-20251001" });
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  assert.strictEqual(raw.apiKey, "sk-keep-me");
  assert.strictEqual(raw.model, "claude-haiku-4-5-20251001");
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-keep-me");
  assert.strictEqual(cfg.apiKeySource, "config");
}

console.log("config.test.js: ok");
