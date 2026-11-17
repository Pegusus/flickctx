const fs = require("fs");
const os = require("os");
const path = require("path");
const { defaultSearchRoots, expandHome } = require("./repos");

const CONFIG_DIR = path.join(os.homedir(), ".config", "flickctx");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

const DEFAULTS = {
  apiKey: "",
  model: "claude-sonnet-4-5",
  projectPath: "",
  hotkey: process.platform === "darwin" ? "Command+Shift+F" : "Control+Shift+F",
  maxTranscriptChars: 6000,
  maxDiffChars: 4000,
  searchRoots: [],
  maxRepos: 80,
  scanLocalRepos: true,
  thinking: true,
  thinkingBudgetTokens: 8000,
};

function ensureConfigDir() {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

function readConfigFile() {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

/**
 * Resolve API key with Flickctx-first priority so ambient corporate
 * ANTHROPIC_API_KEY (e.g. LiteLLM gateway keys) cannot shadow a key the
 * user saved via `flickctx config --api-key`.
 *
 * Priority: FLICKCTX_API_KEY → config.json apiKey → ANTHROPIC_API_KEY
 */
function resolveApiKey(fileApiKey = "") {
  const flickctxEnv = process.env.FLICKCTX_API_KEY || "";
  if (flickctxEnv) {
    return { apiKey: flickctxEnv, apiKeySource: "FLICKCTX_API_KEY" };
  }
  if (fileApiKey) {
    return { apiKey: fileApiKey, apiKeySource: "config" };
  }
  const anthropicEnv = process.env.ANTHROPIC_API_KEY || "";
  if (anthropicEnv) {
    return { apiKey: anthropicEnv, apiKeySource: "ANTHROPIC_API_KEY" };
  }
  return { apiKey: "", apiKeySource: "none" };
}

function loadConfig() {
  ensureConfigDir();
  const file = readConfigFile();
  const { apiKey, apiKeySource } = resolveApiKey(file.apiKey || "");

  const projectPath =
    process.env.FLICKCTX_PROJECT || file.projectPath || process.cwd();

  const searchRoots = (
    file.searchRoots && file.searchRoots.length
      ? file.searchRoots
      : defaultSearchRoots()
  ).map(expandHome);

  return {
    ...DEFAULTS,
    ...file,
    apiKey,
    apiKeySource,
    projectPath: path.resolve(projectPath),
    searchRoots,
    maxRepos: Number(file.maxRepos || DEFAULTS.maxRepos),
    scanLocalRepos:
      file.scanLocalRepos === undefined ? true : Boolean(file.scanLocalRepos),
    configPath: CONFIG_PATH,
    configDir: CONFIG_DIR,
  };
}

function saveConfig(partial) {
  ensureConfigDir();
  const file = readConfigFile();
  const current = loadConfig();
  // Persist only the file-stored key — never write an env-resolved key back.
  const next = {
    apiKey:
      partial.apiKey !== undefined && partial.apiKey !== null
        ? partial.apiKey
        : file.apiKey || "",
    model: partial.model ?? current.model,
    projectPath: partial.projectPath ?? current.projectPath,
    hotkey: partial.hotkey ?? current.hotkey,
    maxTranscriptChars:
      partial.maxTranscriptChars ?? current.maxTranscriptChars,
    maxDiffChars: partial.maxDiffChars ?? current.maxDiffChars,
    searchRoots: partial.searchRoots ?? current.searchRoots,
    maxRepos: partial.maxRepos ?? current.maxRepos,
    scanLocalRepos:
      partial.scanLocalRepos ?? current.scanLocalRepos,
    thinking: partial.thinking ?? current.thinking,
    thinkingBudgetTokens:
      partial.thinkingBudgetTokens ?? current.thinkingBudgetTokens,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n");
  return loadConfig();
}

module.exports = {
  CONFIG_DIR,
  CONFIG_PATH,
  DEFAULTS,
  loadConfig,
  saveConfig,
  resolveApiKey,
  readConfigFile,
};
