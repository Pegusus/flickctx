const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  ".turbo",
  ".cache",
  "vendor",
  "Library",
  "Applications",
  ".Trash",
  "Movies",
  "Music",
  "Pictures",
  "Public",
  "Downloads",
]);

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout: 5000,
      maxBuffer: 1_000_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function expandHome(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return path.resolve(p);
}

function defaultSearchRoots() {
  const home = os.homedir();
  const candidates = [
    path.join(home, "Developer"),
    path.join(home, "Development"),
    path.join(home, "Projects"),
    path.join(home, "project"),
    path.join(home, "projects"),
    path.join(home, "code"),
    path.join(home, "src"),
    path.join(home, "work"),
    path.join(home, "repos"),
    path.join(home, "git"),
    path.join(home, "dev"),
    path.join(home, "studio"),
    path.join(home, "Documents"),
    // Cloud agent / common
    "/agent",
  ];
  return candidates.filter((p) => {
    try {
      return fs.existsSync(p) && fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
}

function detectMarkers(repoPath) {
  const markers = [];
  const checks = [
    ["datadog", ["datadog", "datadog-monitor", ".datadog", "monitor.tf"]],
    ["terraform", ["terraform", "*.tf", "terragrunt"]],
    ["aws", ["serverless.yml", "template.yaml", "cdk.json", "samconfig.toml", "cloudformation"]],
    ["k8s", ["k8s", "kubernetes", "helm", "Chart.yaml"]],
    ["docker", ["Dockerfile", "docker-compose.yml", "compose.yaml"]],
    ["next", ["next.config.js", "next.config.mjs", "next.config.ts"]],
    ["node", ["package.json"]],
    ["python", ["pyproject.toml", "requirements.txt"]],
    ["go", ["go.mod"]],
  ];
  for (const [label, names] of checks) {
    for (const name of names) {
      if (name.includes("*")) continue;
      const full = path.join(repoPath, name);
      if (fs.existsSync(full)) {
        markers.push(label);
        break;
      }
      // one-level child dir
      try {
        const entries = fs.readdirSync(repoPath);
        if (entries.some((e) => e.toLowerCase() === name.toLowerCase())) {
          markers.push(label);
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return [...new Set(markers)];
}

function readDescription(repoPath) {
  for (const name of ["README.md", "readme.md", "CLAUDE.md", "AGENTS.md"]) {
    const full = path.join(repoPath, name);
    try {
      if (!fs.existsSync(full)) continue;
      const text = fs.readFileSync(full, "utf8").slice(0, 1500);
      const line = text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith("#") && !l.startsWith("<!--"));
      const title = text
        .split("\n")
        .map((l) => l.trim())
        .find((l) => l.startsWith("# "));
      return {
        title: title ? title.replace(/^#\s+/, "").slice(0, 80) : "",
        blurb: (line || "").slice(0, 160),
      };
    } catch {
      /* ignore */
    }
  }
  return { title: "", blurb: "" };
}

function inspectRepo(repoPath) {
  const name = path.basename(repoPath);
  const remote = run("git", ["remote", "get-url", "origin"], repoPath);
  const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], repoPath);
  const desc = readDescription(repoPath);
  const markers = detectMarkers(repoPath);
  return {
    name,
    path: repoPath,
    remote: remote || "",
    branch: branch || "",
    title: desc.title,
    blurb: desc.blurb,
    markers,
  };
}

function discoverRepos({ roots, maxDepth = 3, maxRepos = 80 } = {}) {
  const searchRoots = (roots && roots.length ? roots : defaultSearchRoots()).map(
    expandHome
  );
  const found = [];
  const seen = new Set();

  function walk(dir, depth) {
    if (found.length >= maxRepos) return;
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    // If this dir is a git repo, record and don't descend into nested worktrees deeply
    if (fs.existsSync(path.join(dir, ".git"))) {
      const resolved = path.resolve(dir);
      if (!seen.has(resolved)) {
        seen.add(resolved);
        found.push(inspectRepo(resolved));
      }
      // still allow one level of nested packages? skip for speed
      return;
    }

    for (const ent of entries) {
      if (found.length >= maxRepos) return;
      if (!ent.isDirectory()) continue;
      if (ent.name.startsWith(".") && ent.name !== ".github") continue;
      if (SKIP_DIRS.has(ent.name)) continue;
      walk(path.join(dir, ent.name), depth + 1);
    }
  }

  for (const root of searchRoots) {
    if (!fs.existsSync(root)) continue;
    // Root itself may be a repo
    walk(root, 0);
  }

  return { roots: searchRoots, repos: found };
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9_./-]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function scoreRepo(repo, tokens) {
  if (!tokens.length) return 0;
  const hay = [
    repo.name,
    repo.title,
    repo.blurb,
    repo.remote,
    repo.path,
    ...(repo.markers || []),
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const t of tokens) {
    if (repo.name.toLowerCase() === t) score += 12;
    else if (repo.name.toLowerCase().includes(t)) score += 8;
    if (hay.includes(t)) score += 2;
    // service-like tokens from AWS/Datadog UIs
    if (t.includes("-") && repo.name.toLowerCase().includes(t.split("-")[0])) {
      score += 3;
    }
  }
  for (const m of repo.markers || []) {
    if (tokens.includes(m)) score += 4;
  }
  return score;
}

function rankRepos(repos, queryText, limit = 5) {
  const tokens = tokenize(queryText);
  return repos
    .map((r) => ({ repo: r, score: scoreRepo(r, tokens) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function deepenRepo(repoPath, maxDiffChars = 2500) {
  const status = run("git", ["status", "--short", "--branch"], repoPath);
  const log = run("git", ["log", "-5", "--oneline", "--decorate"], repoPath);
  const docs = [];
  for (const name of ["CLAUDE.md", "AGENTS.md", "README.md"]) {
    const full = path.join(repoPath, name);
    try {
      if (fs.existsSync(full)) {
        docs.push(`--- ${name} ---\n` + fs.readFileSync(full, "utf8").slice(0, 2500));
      }
    } catch {
      /* ignore */
    }
  }
  // Common ops files
  for (const rel of [
    "datadog/README.md",
    "terraform/README.md",
    "infra/README.md",
    "ops/README.md",
  ]) {
    const full = path.join(repoPath, rel);
    try {
      if (fs.existsSync(full)) {
        docs.push(`--- ${rel} ---\n` + fs.readFileSync(full, "utf8").slice(0, 1500));
      }
    } catch {
      /* ignore */
    }
  }
  return {
    path: repoPath,
    status: status || "",
    log: log || "",
    docs: docs.join("\n\n").slice(0, maxDiffChars + 2000),
  };
}

function formatRepoCatalog(repos, limit = 60) {
  return repos
    .slice(0, limit)
    .map((r) => {
      const bits = [
        r.name,
        r.path,
        r.remote ? `remote=${r.remote}` : null,
        r.markers?.length ? `markers=${r.markers.join(",")}` : null,
        r.title || r.blurb || null,
      ].filter(Boolean);
      return `- ${bits.join(" | ")}`;
    })
    .join("\n");
}

module.exports = {
  defaultSearchRoots,
  discoverRepos,
  rankRepos,
  deepenRepo,
  formatRepoCatalog,
  expandHome,
  tokenize,
};
