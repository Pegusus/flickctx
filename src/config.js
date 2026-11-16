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

function loadConfig() {
  ensureConfigDir();
  let file = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      file = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {
      file = {};
    }
  }

  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.FLICKCTX_API_KEY ||
    file.apiKey ||
    "";

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
  const current = loadConfig();
  const next = {
    apiKey: partial.apiKey ?? current.apiKey,
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
};
