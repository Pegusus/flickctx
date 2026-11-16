/**
 * On-demand product skills for Flickctx.
 * Ambient chat only gets a thin catalog line; full skill text loads via tools.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const BUNDLED_DIR = path.join(__dirname, "..", "skills");
const USER_DIR = path.join(
  process.env.FLICKCTX_CONFIG_DIR ||
    path.join(os.homedir(), ".config", "flickctx"),
  "skills"
);

const MAX_SKILL_CHARS = 3500; // hard cap per read_skill — never dump encyclopedias

function parseFrontmatter(raw) {
  const text = String(raw || "");
  if (!text.startsWith("---")) {
    return { meta: {}, body: text.trim() };
  }
  const end = text.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: text.trim() };
  const fm = text.slice(3, end).trim();
  const body = text.slice(end + 4).trim();
  const meta = {};
  for (const line of fm.split("\n")) {
    const m = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key === "triggers" || key === "keywords") {
      meta[key] = val
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      meta[key] = val;
    }
  }
  return { meta, body };
}

function skillIdFromFile(filePath) {
  return path.basename(filePath, path.extname(filePath)).toLowerCase();
}

function listSkillFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .map((f) => path.join(dir, f));
}

/**
 * Merge bundled + user skills (user wins on same id).
 * @returns {Array<{id, name, description, triggers, path, source}>}
 */
function listSkills() {
  const byId = new Map();
  for (const file of listSkillFiles(BUNDLED_DIR)) {
    const raw = fs.readFileSync(file, "utf8");
    const { meta } = parseFrontmatter(raw);
    const id = (meta.id || skillIdFromFile(file)).toLowerCase();
    byId.set(id, {
      id,
      name: meta.name || id,
      description: meta.description || "",
      triggers: meta.triggers || meta.keywords || [],
      path: file,
      source: "bundled",
    });
  }
  for (const file of listSkillFiles(USER_DIR)) {
    const raw = fs.readFileSync(file, "utf8");
    const { meta } = parseFrontmatter(raw);
    const id = (meta.id || skillIdFromFile(file)).toLowerCase();
    byId.set(id, {
      id,
      name: meta.name || id,
      description: meta.description || "",
      triggers: meta.triggers || meta.keywords || [],
      path: file,
      source: "user",
    });
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** One-line ambient hint — safe to include in every turn without bloat. */
function formatSkillsCatalogLine(skills = listSkills()) {
  if (!skills.length) return "";
  const ids = skills.map((s) => s.id).join(", ");
  return `On-demand skills (do NOT load unless the mark matches): ${ids}. Use list_skills / read_skill — never paste all skill bodies.`;
}

/** Thin catalog for the list_skills tool. */
function formatSkillsCatalog(skills = listSkills()) {
  return {
    count: skills.length,
    note: "Load at most 1–2 skills with read_skill when the screenshot clearly matches. Do not preload.",
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      triggers: s.triggers,
      source: s.source,
    })),
  };
}

function readSkill(id, maxChars = MAX_SKILL_CHARS) {
  const want = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/\.md$/, "");
  if (!want) return { error: "skill id required" };
  const skills = listSkills();
  const hit = skills.find((s) => s.id === want);
  if (!hit) {
    return {
      error: `unknown skill: ${want}`,
      available: skills.map((s) => s.id),
    };
  }
  const raw = fs.readFileSync(hit.path, "utf8");
  const { meta, body } = parseFrontmatter(raw);
  const cap = Math.min(MAX_SKILL_CHARS, Math.max(500, Number(maxChars) || MAX_SKILL_CHARS));
  const truncated = body.length > cap;
  return {
    id: hit.id,
    name: meta.name || hit.name,
    description: meta.description || hit.description,
    triggers: meta.triggers || hit.triggers,
    source: hit.source,
    chars: Math.min(body.length, cap),
    truncated,
    body: truncated ? body.slice(0, cap) + "\n…(truncated)" : body,
  };
}

/** Suggest skill ids from free text (question / frontmost app) — for ranking only. */
function suggestSkills(text, limit = 3) {
  const q = String(text || "").toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const s of listSkills()) {
    let score = 0;
    if (q.includes(s.id)) score += 10;
    for (const t of s.triggers || []) {
      if (t && q.includes(String(t).toLowerCase())) score += 4;
    }
    const words = (s.description || "").toLowerCase().split(/\W+/);
    for (const w of words) {
      if (w.length > 4 && q.includes(w)) score += 1;
    }
    if (score > 0) scored.push({ id: s.id, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

module.exports = {
  listSkills,
  formatSkillsCatalog,
  formatSkillsCatalogLine,
  readSkill,
  suggestSkills,
  BUNDLED_DIR,
  USER_DIR,
  MAX_SKILL_CHARS,
};
