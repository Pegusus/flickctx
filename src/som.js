/**
 * Set-of-Marks (SoM) helpers — normalize refs and format browser grounding blocks.
 */

function normalizeRef(ref) {
  const s = String(ref ?? "").trim();
  if (!s) return "";
  const m =
    /^(?:ref[:=]\s*)?e?(\d+)$/i.exec(s) ||
    /^flickctx-?ref-?(\d+)$/i.exec(s) ||
    /^\[data-flickctx-ref=["']?e?(\d+)["']?\]$/i.exec(s);
  if (m) return `e${m[1]}`;
  if (/^e\d+$/i.test(s)) return s.toLowerCase();
  return s.slice(0, 48);
}

function formatSomElements(elements, { limit = 12 } = {}) {
  const list = Array.isArray(elements) ? elements : [];
  if (!list.length) return "";
  const lines = ["Set-of-Marks (prefer `ref` in flickctx-guide over raw selectors):"];
  for (const el of list.slice(0, limit)) {
    const ref = normalizeRef(el.ref);
    const bits = [];
    if (ref) bits.push(`ref=${ref}`);
    if (el.selector) bits.push(`selector=\`${String(el.selector).slice(0, 120)}\``);
    if (el.role) bits.push(`role=${el.role}`);
    if (el.text) bits.push(`text="${String(el.text).slice(0, 72)}"`);
    if (el.href) bits.push(`href=${String(el.href).slice(0, 80)}`);
    if (bits.length) lines.push(`  • ${bits.join(" · ")}`);
  }
  return lines.join("\n");
}

function mergeBrowserPromptContext(base, extra) {
  const a = base && typeof base === "object" ? { ...base } : {};
  const b = extra && typeof extra === "object" ? extra : {};
  const elements = [];
  const seen = new Set();
  for (const src of [a.elements, b.elements]) {
    if (!Array.isArray(src)) continue;
    for (const el of src) {
      if (!el || typeof el !== "object") continue;
      const key = normalizeRef(el.ref) || String(el.selector || "");
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      elements.push(el);
    }
  }
  return {
    ...a,
    ...b,
    url: b.url || a.url || "",
    title: b.title || a.title || "",
    elements,
    somElements: elements,
  };
}

module.exports = {
  normalizeRef,
  formatSomElements,
  mergeBrowserPromptContext,
};