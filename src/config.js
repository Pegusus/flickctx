const fs = require("fs");
const os = require("os");
const path = require("path");
const { defaultSearchRoots, expandHome } = require("./repos");
const {
  authModeForToken,
  readStoredCredentials,
} = require("./claudeAuth");

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
  preferredRoute: "ask",
  preferredSession: null,
  rememberSessionRoute: true,
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

function fromToken(token, apiKeySource) {
  return {
    apiKey: token,
    apiKeySource,
    authMode: authModeForToken(token),
  };
}

/**
 * Resolve credentials with Flickctx-first priority.
 *
 * Priority:
 *   FLICKCTX_API_KEY
 *   → config.json apiKey
 *   → CLAUDE_CODE_OAUTH_TOKEN
 *   → ANTHROPIC_AUTH_TOKEN
 *   → Claude Code login (~/.claude / macOS Keychain)
 *   → ANTHROPIC_API_KEY
 *
 * Claude Code login ranks above ambient ANTHROPIC_API_KEY so a corporate
 * LiteLLM/gateway export cannot block a local `claude /login` session, and
 * so Flickctx can run on a Max/Pro subscription without a Console API key.
 */
function resolveApiKey(fileApiKey = "") {
  const flickctxEnv = (process.env.FLICKCTX_API_KEY || "").trim();
  if (flickctxEnv) return fromToken(flickctxEnv, "FLICKCTX_API_KEY");

  if (fileApiKey) return fromToken(fileApiKey, "config");

  const oauthSetup = (process.env.CLAUDE_CODE_OAUTH_TOKEN || "").trim();
  if (oauthSetup) return fromToken(oauthSetup, "CLAUDE_CODE_OAUTH_TOKEN");

  const authToken = (process.env.ANTHROPIC_AUTH_TOKEN || "").trim();
  if (authToken) return fromToken(authToken, "ANTHROPIC_AUTH_TOKEN");

  const stored = readStoredCredentials();
  if (stored?.accessToken) {
    return {
      apiKey: stored.accessToken,
      apiKeySource: stored.source || "claude_code",
      authMode: "oauth",
      subscriptionType: stored.subscriptionType || "",
    };
  }

  const anthropicEnv = (process.env.ANTHROPIC_API_KEY || "").trim();
  if (anthropicEnv) return fromToken(anthropicEnv, "ANTHROPIC_API_KEY");

  return { apiKey: "", apiKeySource: "none", authMode: "none" };
}

function loadConfig() {
  ensureConfigDir();
  const file = readConfigFile();
  const resolved = resolveApiKey(file.apiKey || "");

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
    apiKey: resolved.apiKey,
    apiKeySource: resolved.apiKeySource,
    authMode: resolved.authMode,
    subscriptionType: resolved.subscriptionType || "",
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
  // Persist only the file-stored key — never write an env/Claude-Code token back.
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
    preferredRoute:
      partial.preferredRoute !== undefined
        ? partial.preferredRoute
        : file.preferredRoute || DEFAULTS.preferredRoute,
    preferredSession:
      partial.preferredSession !== undefined
        ? partial.preferredSession
        : file.preferredSession || null,
    rememberSessionRoute:
      partial.rememberSessionRoute !== undefined
        ? Boolean(partial.rememberSessionRoute)
        : file.rememberSessionRoute === undefined
          ? DEFAULTS.rememberSessionRoute
          : Boolean(file.rememberSessionRoute),
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
