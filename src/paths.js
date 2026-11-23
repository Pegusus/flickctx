/**
 * Path sandbox helpers — keep local tools inside configured roots.
 */
const fs = require("fs");
const path = require("path");
const { expandHome } = require("./repos");

/**
 * True when `candidate` is the same as `root` or a descendant of it.
 * Uses resolved real paths when possible to resist symlink escapes.
 */
function isPathInside(root, candidate) {
  const rootResolved = path.resolve(root);
  const candResolved = path.resolve(candidate);
  const rel = path.relative(rootResolved, candResolved);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function realOrResolved(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

/**
 * Resolve `inputPath` and require it to sit under at least one allowlisted root.
 * `extraRoots` typically includes projectPath + searchRoots.
 * Returns { ok, path } or { ok: false, error }.
 */
function resolveWithinRoots(inputPath, roots = [], { mustExist = false } = {}) {
  if (!inputPath || typeof inputPath !== "string") {
    return { ok: false, error: "path required" };
  }
  const expanded = expandHome(String(inputPath).trim());
  const resolved = path.resolve(expanded);
  const allow = (Array.isArray(roots) ? roots : [])
    .filter(Boolean)
    .map((r) => realOrResolved(expandHome(r)));

  if (!allow.length) {
    return { ok: false, error: "no allowed roots configured" };
  }

  const checkPath = mustExist && fs.existsSync(resolved) ? realOrResolved(resolved) : resolved;
  const allowed = allow.some((root) => isPathInside(root, checkPath));
  if (!allowed) {
    return {
      ok: false,
      error: `path outside allowed roots: ${resolved}`,
      path: resolved,
    };
  }
  return { ok: true, path: resolved };
}

module.exports = {
  isPathInside,
  resolveWithinRoots,
};
