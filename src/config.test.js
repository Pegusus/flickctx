const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-config-"));
const CONFIG_DIR = path.join(TMP, ".config", "flickctx");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

// Isolate config path before requiring the module under test.
process.env.HOME = TMP;
process.env.USERPROFILE = TMP;
delete process.env.FLICKCTX_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.FLICKCTX_PROJECT;

// Re-require with a clean module cache so CONFIG_PATH uses the temp HOME.
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
}

function writeFileKey(key) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ apiKey: key, model: "claude-sonnet-4-5" }, null, 2) + "\n"
  );
}

// resolveApiKey priority
{
  clearEnv();
  assert.deepStrictEqual(resolveApiKey(""), {
    apiKey: "",
    apiKeySource: "none",
  });

  process.env.ANTHROPIC_API_KEY = "sk-anthro";
  assert.deepStrictEqual(resolveApiKey(""), {
    apiKey: "sk-anthro",
    apiKeySource: "ANTHROPIC_API_KEY",
  });

  assert.deepStrictEqual(resolveApiKey("sk-file"), {
    apiKey: "sk-file",
    apiKeySource: "config",
  });

  process.env.FLICKCTX_API_KEY = "sk-flick";
  assert.deepStrictEqual(resolveApiKey("sk-file"), {
    apiKey: "sk-flick",
    apiKeySource: "FLICKCTX_API_KEY",
  });
}

// loadConfig prefers file over ambient ANTHROPIC_API_KEY
{
  clearEnv();
  writeFileKey("sk-from-config");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-from-config");
  assert.strictEqual(cfg.apiKeySource, "config");
}

// FLICKCTX_API_KEY wins over both
{
  clearEnv();
  writeFileKey("sk-from-config");
  process.env.ANTHROPIC_API_KEY = "sk-corporate-litellm";
  process.env.FLICKCTX_API_KEY = "sk-explicit";
  const cfg = loadConfig();
  assert.strictEqual(cfg.apiKey, "sk-explicit");
  assert.strictEqual(cfg.apiKeySource, "FLICKCTX_API_KEY");
}

// saveConfig without --api-key must not persist the env key into the file
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
