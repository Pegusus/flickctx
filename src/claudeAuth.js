const { createHash } = require("crypto");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/** Claude Code OAuth client id (public; same as the CLI). */
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const OAUTH_TOKEN_URLS = [
  "https://platform.claude.com/v1/oauth/token",
  "https://console.anthropic.com/v1/oauth/token",
];
const OAUTH_TOKEN_USER_AGENT = "axios/1.7.9";

const CLAUDE_CODE_KEYCHAIN_SERVICE = "Claude Code-credentials";
const CLAUDE_CODE_IDENTITY_PROMPT =
  "You are Claude Code, Anthropic's official CLI for Claude.";
const CLAUDE_CODE_OAUTH_BETAS = [
  "claude-code-20250219",
  "oauth-2025-04-20",
];
const CLAUDE_CODE_USER_AGENT = "claude-cli/2.1.285 (external, flickctx)";
const CLAUDE_CODE_X_APP = "cli";

const EXPIRY_SKEW_MS = 60_000;

function claudeConfigDir() {
  const override = (process.env.CLAUDE_CONFIG_DIR || "").trim();
  return override ? override : path.join(os.homedir(), ".claude");
}

function credentialsPath() {
  return path.join(claudeConfigDir(), ".credentials.json");
}

function keychainService() {
  const override = (process.env.CLAUDE_CONFIG_DIR || "").trim();
  if (!override) return CLAUDE_CODE_KEYCHAIN_SERVICE;
  const suffix = createHash("sha256").update(override).digest("hex").slice(0, 8);
  return `${CLAUDE_CODE_KEYCHAIN_SERVICE}-${suffix}`;
}

/**
 * Console API keys use x-api-key. OAuth / setup tokens use Bearer + oauth beta.
 * Unknown sk-ant-* prefixes default to OAuth so newer oat-style tokens keep working.
 */
function isOAuthToken(token) {
  if (!token || typeof token !== "string") return false;
  if (
    token.startsWith("sk-ant-api") ||
    token.startsWith("sk-ant-usr") ||
    token.startsWith("sk-ant-svc") ||
    token.startsWith("sk-ant-admin")
  ) {
    return false;
  }
  return (
    token.startsWith("sk-ant-oat") ||
    token.startsWith("sk-ant-ort") ||
    token.startsWith("sk-ant-") ||
    token.startsWith("eyJ") ||
    token.startsWith("cc-")
  );
}

function authModeForToken(token) {
  if (!token) return "none";
  return isOAuthToken(token) ? "oauth" : "api_key";
}

function parseClaudeAiOauth(raw) {
  if (!raw || typeof raw !== "object") return null;
  const oauth = raw.claudeAiOauth;
  if (!oauth || typeof oauth !== "object") return null;
  const accessToken = oauth.accessToken;
  if (typeof accessToken !== "string" || !accessToken) return null;
  return {
    accessToken,
    refreshToken:
      typeof oauth.refreshToken === "string" ? oauth.refreshToken : "",
    expiresAt:
      typeof oauth.expiresAt === "number" && Number.isFinite(oauth.expiresAt)
        ? oauth.expiresAt
        : 0,
    subscriptionType:
      typeof oauth.subscriptionType === "string"
        ? oauth.subscriptionType
        : "",
    raw,
  };
}

function readKeychainPayload() {
  if (process.platform !== "darwin") return null;
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", keychainService(), "-w"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 5000,
      }
    );
    const trimmed = String(out || "").trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function readFilePayload() {
  const filePath = credentialsPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isAccessValid(creds) {
  if (!creds?.accessToken) return false;
  if (!creds.expiresAt) return true;
  return Date.now() < creds.expiresAt - EXPIRY_SKEW_MS;
}

function pickFresher(a, b) {
  if (!a) return b;
  if (!b) return a;
  const aOk = isAccessValid(a);
  const bOk = isAccessValid(b);
  if (aOk !== bOk) return aOk ? a : b;
  return (a.expiresAt || 0) >= (b.expiresAt || 0) ? a : b;
}

function readStoredCredentials() {
  const fromKeychain = parseClaudeAiOauth(readKeychainPayload());
  const fromFile = parseClaudeAiOauth(readFilePayload());
  const picked = pickFresher(
    fromKeychain
      ? { ...fromKeychain, source: "claude_code_keychain" }
      : null,
    fromFile ? { ...fromFile, source: "claude_code_credentials" } : null
  );
  return picked;
}

async function refreshOAuthToken(refreshToken) {
  if (!refreshToken) {
    throw new Error("Claude Code refresh token missing — run `claude /login`");
  }
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: OAUTH_CLIENT_ID,
  }).toString();

  let lastErr;
  for (const url of OAUTH_TOKEN_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": OAUTH_TOKEN_USER_AGENT,
        },
        body,
      });
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        data = {};
      }
      if (!res.ok || !data.access_token) {
        lastErr = new Error(
          `Claude Code token refresh failed (${res.status}): ${
            data.error_description || data.error || raw.slice(0, 200)
          }`
        );
        if (res.status === 400 || res.status === 401) break;
        continue;
      }
      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt:
          Date.now() + Number(data.expires_in || 3600) * 1000,
      };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error("Claude Code token refresh failed");
}

function writeCredentialsFile(payload) {
  const filePath = credentialsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.flickctx-tmp`;
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2) + "\n", {
    mode: 0o600,
  });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    /* ignore */
  }
}

function writeKeychainPayload(payload) {
  if (process.platform !== "darwin") return false;
  try {
    const encoded = Buffer.from(
      JSON.stringify(payload),
      "utf8"
    ).toString("hex");
    const account = os.userInfo().username || "Claude Code";
    // -i reads commands from stdin; -X hex-encodes the secret so it never
    // sits on argv and avoids interactive confirm prompts from -w.
    execFileSync("security", ["-i"], {
      input: `add-generic-password -U -a ${JSON.stringify(
        account
      )} -s ${JSON.stringify(keychainService())} -X ${encoded}\n`,
      stdio: ["pipe", "ignore", "ignore"],
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function persistRefreshed(creds, next) {
  const base =
    creds.raw && typeof creds.raw === "object" ? { ...creds.raw } : {};
  const prevOauth =
    base.claudeAiOauth && typeof base.claudeAiOauth === "object"
      ? { ...base.claudeAiOauth }
      : {};
  base.claudeAiOauth = {
    ...prevOauth,
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    expiresAt: next.expiresAt,
  };

  if (creds.source === "claude_code_keychain") {
    writeKeychainPayload(base);
  }
  // Always mirror to the credentials file when present/writable so Linux
  // and Keychain-fallback macOS stay in sync with Claude Code.
  try {
    writeCredentialsFile(base);
  } catch {
    /* ignore — still return the in-memory token for this process */
  }

  return {
    ...creds,
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    expiresAt: next.expiresAt,
    raw: base,
  };
}

/**
 * Resolve a usable Claude Code OAuth access token.
 * Returns null when the user is not logged in via Claude Code.
 */
async function resolveClaudeCodeAuth() {
  const setup = (process.env.CLAUDE_CODE_OAUTH_TOKEN || "").trim();
  if (setup) {
    return {
      token: setup,
      authMode: "oauth",
      apiKeySource: "CLAUDE_CODE_OAUTH_TOKEN",
      subscriptionType: "",
    };
  }

  const bearer = (process.env.ANTHROPIC_AUTH_TOKEN || "").trim();
  if (bearer) {
    return {
      token: bearer,
      authMode: "oauth",
      apiKeySource: "ANTHROPIC_AUTH_TOKEN",
      subscriptionType: "",
    };
  }

  let creds = readStoredCredentials();
  if (!creds) return null;

  if (!isAccessValid(creds) && creds.refreshToken) {
    const next = await refreshOAuthToken(creds.refreshToken);
    creds = persistRefreshed(creds, next);
  }

  if (!creds.accessToken) return null;

  return {
    token: creds.accessToken,
    authMode: "oauth",
    apiKeySource: creds.source || "claude_code",
    subscriptionType: creds.subscriptionType || "",
  };
}

function buildAuthHeaders({ token, authMode }) {
  const headers = {
    "content-type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (authMode === "oauth") {
    headers.Authorization = `Bearer ${token}`;
    headers["anthropic-beta"] = CLAUDE_CODE_OAUTH_BETAS.join(",");
    headers["user-agent"] = CLAUDE_CODE_USER_AGENT;
    headers["x-app"] = CLAUDE_CODE_X_APP;
  } else if (token) {
    headers["x-api-key"] = token;
  }
  return headers;
}

function withClaudeCodeSystem(systemText, authMode) {
  if (authMode !== "oauth") return systemText;
  // OAuth Messages requests require this exact first system block.
  return [
    { type: "text", text: CLAUDE_CODE_IDENTITY_PROMPT },
    { type: "text", text: systemText },
  ];
}

module.exports = {
  OAUTH_CLIENT_ID,
  CLAUDE_CODE_IDENTITY_PROMPT,
  CLAUDE_CODE_OAUTH_BETAS,
  CLAUDE_CODE_USER_AGENT,
  authModeForToken,
  isOAuthToken,
  resolveClaudeCodeAuth,
  buildAuthHeaders,
  withClaudeCodeSystem,
  credentialsPath,
  readStoredCredentials,
  isAccessValid,
  refreshOAuthToken,
};
