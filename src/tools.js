const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  discoverRepos,
  deepenRepo,
  formatRepoCatalog,
  rankRepos,
} = require("./repos");
const {
  listSkills,
  formatSkillsCatalog,
  readSkill,
} = require("./skills");
const { resolveWithinRoots } = require("./paths");
const { assertPublicHttpUrl } = require("./net");

function allowedRoots(env = {}) {
  return [...(env.searchRoots || []), env.projectPath].filter(Boolean);
}

function run(cmd, args, cwd) {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf8",
      timeout: 12000,
      maxBuffer: 2_000_000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function safeRead(filePath, maxBytes = 40_000) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size > 2_000_000) return null;
    return fs.readFileSync(filePath).toString("utf8").slice(0, maxBytes);
  } catch {
    return null;
  }
}

async function webSearch(query, maxResults = 5) {
  const q = String(query || "").trim();
  if (!q) return { results: [], note: "empty query" };

  // 1) DuckDuckGo instant answers / related topics
  try {
    const url =
      "https://api.duckduckgo.com/?format=json&no_html=1&skip_disambig=1&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, {
      headers: { "user-agent": "Flickctx/0.1" },
    });
    if (res.ok) {
      const data = await res.json();
      const results = [];
      if (data.AbstractText) {
        results.push({
          title: data.Heading || q,
          url: data.AbstractURL || "",
          snippet: data.AbstractText,
        });
      }
      for (const t of data.RelatedTopics || []) {
        if (t.Text && t.FirstURL) {
          results.push({
            title: t.Text.slice(0, 80),
            url: t.FirstURL,
            snippet: t.Text,
          });
        } else if (Array.isArray(t.Topics)) {
          for (const x of t.Topics.slice(0, 3)) {
            if (x.Text && x.FirstURL) {
              results.push({
                title: x.Text.slice(0, 80),
                url: x.FirstURL,
                snippet: x.Text,
              });
            }
          }
        }
        if (results.length >= maxResults) break;
      }
      if (results.length) return { results: results.slice(0, maxResults), source: "duckduckgo" };
    }
  } catch {
    /* fall through */
  }

  // 2) HTML search fallback
  try {
    const url =
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q);
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; Flickctx/0.1; +https://localhost)",
      },
    });
    const html = await res.text();
    const results = [];
    const re =
      /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) && results.length < maxResults) {
      results.push({
        url: m[1],
        title: m[2].replace(/<[^>]+>/g, "").trim(),
        snippet: m[3].replace(/<[^>]+>/g, "").trim(),
      });
    }
    // simpler alternate parse
    if (!results.length) {
      const re2 =
        /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>/gi;
      while ((m = re2.exec(html)) && results.length < maxResults) {
        results.push({
          url: m[1],
          title: m[2].replace(/<[^>]+>/g, "").trim(),
          snippet: "",
        });
      }
    }
    return { results, source: "duckduckgo-html" };
  } catch (err) {
    return { results: [], error: err.message || String(err) };
  }
}

async function fetchUrl(url, maxChars = 12000) {
  const check = assertPublicHttpUrl(url);
  if (!check.ok) return { url, error: check.error };

  try {
    // manual redirect so each hop is re-validated (SSRF)
    let current = check.url;
    let res;
    for (let hop = 0; hop < 5; hop++) {
      res = await fetch(current, {
        headers: { "user-agent": "Flickctx/0.2" },
        redirect: "manual",
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        const next = new URL(loc, current).toString();
        const again = assertPublicHttpUrl(next);
        if (!again.ok) return { url: next, error: again.error };
        current = again.url;
        continue;
      }
      break;
    }
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!ctype.includes("html") && !ctype.includes("text") && !ctype.includes("json")) {
      return { url: current, note: `non-text content-type: ${ctype}`, text: text.slice(0, 500) };
    }
    const cleaned = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { url: current, status: res.status, text: cleaned.slice(0, maxChars) };
  } catch (err) {
    return { url, error: err.message || String(err) };
  }
}

function toolSchemas() {
  return [
    {
      name: "web_search",
      description:
        "Search the public web ONLY when the screenshot cannot answer (docs links, pricing tables, changelogs). Do not use this to invent a generic answer that ignores the marked UI.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
        },
        required: ["query"],
      },
    },
    {
      name: "fetch_url",
      description:
        "Fetch a web page and return extracted text (for official docs/pricing pages).",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string" },
          max_chars: { type: "number" },
        },
        required: ["url"],
      },
    },
    {
      name: "list_local_repos",
      description: "List local git repositories available on this machine.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional filter text to rank/filter repos",
          },
        },
      },
    },
    {
      name: "read_local_file",
      description: "Read a local file from disk (project/docs/code).",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
          max_chars: { type: "number" },
        },
        required: ["path"],
      },
    },
    {
      name: "grep_local",
      description: "Search text across a local directory with ripgrep/grep.",
      input_schema: {
        type: "object",
        properties: {
          root: { type: "string" },
          pattern: { type: "string" },
          glob: { type: "string" },
        },
        required: ["root", "pattern"],
      },
    },
    {
      name: "repo_details",
      description: "Get git status, recent commits, and key docs for a local repo.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
    },
    {
      name: "list_skills",
      description:
        "List bundled/user product skills (aws, datadog, gcp, …). Returns ONLY ids + one-line descriptions. Use when the screenshot looks like a known console; then read_skill for at most 1–2 matches. Do not call this every turn.",
      input_schema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Optional filter (e.g. aws, kafka, datadog)",
          },
        },
      },
    },
    {
      name: "read_skill",
      description:
        "Load ONE skill body (capped length) for interpreting a matching screenshot. Prefer after list_skills. Never read more than 2 skills per answer.",
      input_schema: {
        type: "object",
        properties: {
          id: {
            type: "string",
            description: "Skill id, e.g. aws, datadog, gcp, kubernetes",
          },
          max_chars: {
            type: "number",
            description: "Optional cap (max 3500)",
          },
        },
        required: ["id"],
      },
    },
  ];
}

async function runTool(name, input, env) {
  const searchRoots = env.searchRoots || [];
  const maxRepos = env.maxRepos || 80;

  if (name === "web_search") {
    return webSearch(input.query, 6);
  }
  if (name === "fetch_url") {
    return fetchUrl(input.url, input.max_chars || 12000);
  }
  if (name === "list_local_repos") {
    const { roots, repos } = discoverRepos({
      roots: searchRoots,
      maxRepos,
    });
    const ranked = input.query
      ? rankRepos(repos, input.query, 20).map((x) => x.repo)
      : repos;
    return {
      roots,
      count: ranked.length,
      repos: ranked.slice(0, 40).map((r) => ({
        name: r.name,
        path: r.path,
        remote: r.remote,
        markers: r.markers,
        title: r.title,
        blurb: r.blurb,
      })),
      catalog: formatRepoCatalog(ranked, 40),
    };
  }
  if (name === "read_local_file") {
    const gated = resolveWithinRoots(input.path, allowedRoots(env), {
      mustExist: true,
    });
    if (!gated.ok) return { path: input.path, error: gated.error };
    const text = safeRead(gated.path, input.max_chars || 40_000);
    if (text == null) return { path: gated.path, error: "unreadable or missing" };
    return { path: gated.path, text };
  }
  if (name === "grep_local") {
    const gated = resolveWithinRoots(input.root, allowedRoots(env));
    if (!gated.ok) return { root: input.root, error: gated.error };
    const pattern = String(input.pattern || "");
    if (!pattern) return { error: "pattern required" };
    let out = "";
    if (run("which", ["rg"])) {
      const args = [
        "-n",
        "--no-heading",
        "--max-count",
        "40",
        pattern,
        gated.path,
      ];
      if (input.glob) args.unshift("--glob", input.glob);
      out = run("rg", args);
    } else {
      const args = ["-R", "-n", "-I", pattern, gated.path];
      out = run("grep", args);
    }
    return {
      root: gated.path,
      pattern,
      matches: (out || "(no matches)").slice(0, 12000),
    };
  }
  if (name === "repo_details") {
    const gated = resolveWithinRoots(input.path, allowedRoots(env));
    if (!gated.ok) return { path: input.path, error: gated.error };
    return deepenRepo(gated.path);
  }
  if (name === "list_skills") {
    const all = formatSkillsCatalog(listSkills());
    const q = String(input.query || "")
      .trim()
      .toLowerCase();
    if (!q) return all;
    const skills = all.skills.filter(
      (s) =>
        s.id.includes(q) ||
        (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.triggers || []).some((t) => String(t).toLowerCase().includes(q))
    );
    return { ...all, count: skills.length, skills };
  }
  if (name === "read_skill") {
    return readSkill(input.id, input.max_chars);
  }
  return { error: `unknown tool: ${name}` };
}

module.exports = {
  toolSchemas,
  runTool,
};
