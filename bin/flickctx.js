#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { loadConfig, saveConfig } = require("../src/config");
const { gatherContext } = require("../src/context");
const { explainSelection } = require("../src/explain");
const { captureRegionCli } = require("../src/capture");

function printHelp() {
  console.log(`Flickctx — mark screen regions, explain with local agent + repo context

Usage:
  flickctx                 Start Electron overlay app (global hotkey)
  flickctx mark            Interactive region capture + explain (CLI)
  flickctx explain -i IMG  Explain an existing image
  flickctx context         Print gathered local context
  flickctx repos           List local git repos Flickctx can see
  flickctx config          Show config
  flickctx config --api-key KEY --project PATH --model MODEL
  flickctx config --clear-api-key
  flickctx config --search-roots ~/code,~/Projects
  flickctx doctor          Check API key, project, local repos
  flickctx sessions        List recent Claude Code / OpenCode sessions

Env / auth priority:
  FLICKCTX_API_KEY
  → config.json apiKey
  → CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_AUTH_TOKEN
  → Claude Code login (~/.claude or macOS Keychain)
  → ANTHROPIC_API_KEY

  FLICKCTX_PROJECT
  FLICKCTX_PROXY_URL   (optional Anthropic-compatible /chat proxy)

Config file:
  ~/.config/flickctx/config.json

If you're logged into Claude Code (\`claude\`), Flickctx can use that
subscription OAuth — no Console API key required. A corporate
ANTHROPIC_API_KEY (e.g. LiteLLM) will not override a Flickctx config key
or an attached Claude Code login.
`);
}

function parseArgs(argv) {
  const args = {
    _: [],
    image: null,
    project: null,
    apiKey: null,
    clearApiKey: false,
    model: null,
    searchRoots: null,
    json: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--image" || a === "-i") args.image = argv[++i];
    else if (a === "--project" || a === "-p") args.project = argv[++i];
    else if (a === "--api-key") {
      args.apiKey = argv[++i] ?? "";
      args.hasApiKeyFlag = true;
    } else if (a === "--clear-api-key") {
      args.clearApiKey = true;
      args.hasApiKeyFlag = true;
      args.apiKey = "";
    } else if (a === "--model") args.model = argv[++i];
    else if (a === "--search-roots") args.searchRoots = argv[++i];
    else if (a === "--json") args.json = true;
    else if (a === "-h" || a === "--help") args.help = true;
    else args._.push(a);
  }
  return args;
}

async function cmdDoctor(config) {
  const ctx = gatherContext({
    projectPath: config.projectPath,
    searchRoots: config.searchRoots,
    maxRepos: config.maxRepos,
    scanLocalRepos: config.scanLocalRepos,
  });
  console.log("Flickctx doctor");
  console.log(`  config:     ${config.configPath}`);
  console.log(`  project:    ${config.projectPath}`);
  console.log(`  model:      ${config.model}`);
  console.log(`  thinking:   ${config.thinking === false ? "off" : "on"}`);
  if (config.apiKey) {
    const mode = config.authMode === "oauth" ? "oauth" : "api-key";
    console.log(
      `  auth:       ${mode} via ${config.apiKeySource} (${config.apiKey.slice(0, 8)}…)`
    );
    if (config.subscriptionType) {
      console.log(`  plan:       ${config.subscriptionType}`);
    }
    if (
      config.apiKeySource !== "ANTHROPIC_API_KEY" &&
      process.env.ANTHROPIC_API_KEY
    ) {
      console.log(
        `  note:       ANTHROPIC_API_KEY is set in the environment but ignored (Flickctx prefers ${config.apiKeySource})`
      );
    }
  } else {
    console.log("  auth:       MISSING (run `claude` login, or flickctx config --api-key)");
  }
  if (process.env.FLICKCTX_PROXY_URL) {
    console.log(`  proxy:      ${process.env.FLICKCTX_PROXY_URL}`);
  }
  console.log(`  git:        ${ctx.meta.git ? "yes" : "no"}`);
  console.log(`  claude:     ${ctx.meta.claude ? "yes" : "no"}`);
  console.log(`  opencode:   ${ctx.meta.opencode ? "yes" : "no"}`);
  console.log(`  docs:       ${ctx.meta.docs.join(", ") || "(none)"}`);
  console.log(`  localRepos: ${ctx.meta.localRepos ?? 0}`);
  console.log(`  search:     ${(ctx.meta.searchRoots || []).join(", ") || "(none)"}`);
}

async function cmdRepos(config) {
  const { discoverRepos, formatRepoCatalog } = require("../src/repos");
  const { roots, repos } = discoverRepos({
    roots: config.searchRoots,
    maxRepos: config.maxRepos,
  });
  console.log(`Search roots:\n  ${roots.join("\n  ") || "(none)"}`);
  console.log(`\nFound ${repos.length} repos:\n`);
  console.log(formatRepoCatalog(repos) || "(none)");
}

async function cmdExplain(config, imagePath, question = "") {
  process.stderr.write("Gathering local repos + context, calling Claude…\n");
  const result = await explainSelection({
    apiKey: config.apiKey,
    authMode: config.authMode,
    apiKeySource: config.apiKeySource,
    model: config.model,
    projectPath: config.projectPath,
    imagePath,
    question,
    maxTranscriptChars: config.maxTranscriptChars,
    maxDiffChars: config.maxDiffChars,
    searchRoots: config.searchRoots,
    maxRepos: config.maxRepos,
    scanLocalRepos: config.scanLocalRepos,
  });

  console.log("\n=== Flickctx ===\n");
  console.log(result.explanation);
  console.log("\n--- Follow-up prompt for Claude Code / OpenCode ---\n");
  console.log(result.followUpPrompt);
  console.log("\n--- meta ---");
  console.log(
    JSON.stringify(
      {
        projectPath: result.projectPath,
        model: result.model,
        usage: result.usage,
        context: result.contextMeta,
      },
      null,
      2
    )
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._[0] === "help") {
    printHelp();
    return;
  }

  let config = loadConfig();
  if (args.project) {
    config = { ...config, projectPath: path.resolve(args.project) };
  }
  if (args.apiKey) config = { ...config, apiKey: args.apiKey };
  if (args.model) config = { ...config, model: args.model };
  if (args.searchRoots) {
    config = {
      ...config,
      searchRoots: args.searchRoots.split(",").map((s) => s.trim()).filter(Boolean),
    };
  }

  const cmd = args._[0];

  if (!cmd) {
    // Launch Electron
    const electron = require("electron");
    // When required, electron is a path string to the binary
    const { spawn } = require("child_process");
    const appRoot = path.join(__dirname, "..");
    const child = spawn(electron, ["."], {
      cwd: appRoot,
      stdio: "inherit",
      env: process.env,
    });
    child.on("exit", (code) => process.exit(code || 0));
    return;
  }

  if (cmd === "config") {
    if (
      args.hasApiKeyFlag ||
      args.project ||
      args.model ||
      args.searchRoots
    ) {
      const saved = saveConfig({
        apiKey: args.hasApiKeyFlag ? args.apiKey : undefined,
        projectPath: args.project || undefined,
        model: args.model || undefined,
        searchRoots: args.searchRoots
          ? args.searchRoots.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      });
      console.log("Saved", saved.configPath);
      console.log(
        JSON.stringify(
          {
            projectPath: saved.projectPath,
            model: saved.model,
            hotkey: saved.hotkey,
            searchRoots: saved.searchRoots,
            auth: saved.apiKey
              ? `${saved.authMode} via ${saved.apiKeySource}`
              : "(missing)",
          },
          null,
          2
        )
      );
    } else {
      console.log(
        JSON.stringify(
          {
            configPath: config.configPath,
            projectPath: config.projectPath,
            model: config.model,
            hotkey: config.hotkey,
            searchRoots: config.searchRoots,
            maxRepos: config.maxRepos,
            auth: config.apiKey
              ? `${config.authMode} via ${config.apiKeySource}`
              : "(missing)",
          },
          null,
          2
        )
      );
    }
    return;
  }

  if (cmd === "doctor") {
    await cmdDoctor(config);
    return;
  }

  if (cmd === "sessions") {
    const { listAgentSessions } = require("../src/sessions");
    const listed = listAgentSessions({ limit: 20 });
    console.log(
      `Claude CLI: ${listed.claudeAvailable ? "yes" : "no"} · OpenCode CLI: ${
        listed.opencodeAvailable ? "yes" : "no"
      }`
    );
    console.log(`Found ${listed.sessions.length} sessions:\n`);
    for (const s of listed.sessions) {
      const when = s.mtime
        ? new Date(s.mtime).toISOString().replace("T", " ").slice(0, 16)
        : "";
      console.log(
        `- [${s.provider}] ${s.title || s.id}` +
          (when ? `  (${when})` : "") +
          (s.directory ? `\n    ${s.directory}` : "") +
          `\n    id=${s.id}`
      );
    }
    return;
  }

  if (cmd === "repos") {
    await cmdRepos(config);
    return;
  }

  if (cmd === "context") {
    const ctx = gatherContext({
      projectPath: config.projectPath,
      maxTranscriptChars: config.maxTranscriptChars,
      maxDiffChars: config.maxDiffChars,
      searchRoots: config.searchRoots,
      maxRepos: config.maxRepos,
      scanLocalRepos: config.scanLocalRepos,
    });
    if (args.json) {
      console.log(JSON.stringify(ctx, null, 2));
    } else {
      console.log(ctx.text);
    }
    return;
  }

  if (cmd === "mark") {
    process.stderr.write("Select a region on your screen…\n");
    const imagePath = captureRegionCli();
    await cmdExplain(config, imagePath);
    return;
  }

  if (cmd === "explain") {
    if (!args.image) {
      console.error("Usage: flickctx explain -i screenshot.png");
      process.exit(1);
    }
    const imagePath = path.resolve(args.image);
    if (!fs.existsSync(imagePath)) {
      console.error("Image not found:", imagePath);
      process.exit(1);
    }
    await cmdExplain(config, imagePath);
    return;
  }

  console.error("Unknown command:", cmd);
  printHelp();
  process.exit(1);
}

main().catch((err) => {
  console.error("\nError:", err.message || err);
  process.exit(1);
});
