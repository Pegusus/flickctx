const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

async function main() {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-claude-auth-"));
  process.env.HOME = TMP;
  process.env.USERPROFILE = TMP;
  process.env.CLAUDE_CONFIG_DIR = path.join(TMP, ".claude");
  delete process.env.CLAUDE_CODE_OAUTH_TOKEN;
  delete process.env.ANTHROPIC_AUTH_TOKEN;

  delete require.cache[require.resolve("./claudeAuth")];
  const {
    authModeForToken,
    isOAuthToken,
    buildAuthHeaders,
    withClaudeCodeSystem,
    resolveClaudeCodeAuth,
    CLAUDE_CODE_IDENTITY_PROMPT,
    credentialsPath,
  } = require("./claudeAuth");

  assert.strictEqual(isOAuthToken("sk-ant-api03-abc"), false);
  assert.strictEqual(isOAuthToken("sk-ant-oat01-abc"), true);
  assert.strictEqual(authModeForToken("sk-ant-api03-abc"), "api_key");
  assert.strictEqual(authModeForToken("sk-ant-oat01-abc"), "oauth");

  {
    const headers = buildAuthHeaders({
      token: "sk-ant-api03-abc",
      authMode: "api_key",
    });
    assert.strictEqual(headers["x-api-key"], "sk-ant-api03-abc");
    assert.ok(!headers.Authorization);
  }

  {
    const headers = buildAuthHeaders({
      token: "sk-ant-oat01-abc",
      authMode: "oauth",
    });
    assert.strictEqual(headers.Authorization, "Bearer sk-ant-oat01-abc");
    assert.ok(headers["anthropic-beta"].includes("oauth-2025-04-20"));
    assert.ok(!headers["x-api-key"]);
  }

  {
    const system = withClaudeCodeSystem("you are flickctx", "oauth");
    assert.ok(Array.isArray(system));
    assert.strictEqual(system[0].text, CLAUDE_CODE_IDENTITY_PROMPT);
    assert.strictEqual(system[1].text, "you are flickctx");
    assert.strictEqual(withClaudeCodeSystem("plain", "api_key"), "plain");
  }

  fs.mkdirSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true });
  fs.writeFileSync(
    credentialsPath(),
    JSON.stringify({
      claudeAiOauth: {
        accessToken: "sk-ant-oat01-live",
        refreshToken: "sk-ant-ort01-x",
        expiresAt: Date.now() + 3_600_000,
        subscriptionType: "max",
      },
    })
  );
  const auth = await resolveClaudeCodeAuth();
  assert.ok(auth);
  assert.strictEqual(auth.token, "sk-ant-oat01-live");
  assert.strictEqual(auth.authMode, "oauth");
  assert.strictEqual(auth.apiKeySource, "claude_code_credentials");

  console.log("claudeAuth.test.js: ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
