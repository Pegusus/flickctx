/**
 * Parse optional screen-highlight annotations from model text.
 *
 * Expected block (stripped from the user-visible answer):
 *
 * ```flickctx-highlights
 * {"space":"primary","highlights":[{"x":0.2,"y":0.3,"w":0.12,"h":0.08,"label":"Settings"}]}
 * ```
 *
 * Coordinates are normalized 0–1 within `space`:
 * - primary → the marked crop
 * - display → the full display capture
 */

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function normalizeHighlight(raw) {
  if (!raw || typeof raw !== "object") return null;
  const x = clamp01(raw.x);
  const y = clamp01(raw.y);
  if (x == null || y == null) return null;
  let w = clamp01(raw.w ?? raw.width ?? 0);
  let h = clamp01(raw.h ?? raw.height ?? 0);
  // Point-style: expand to a small ring
  if (!w || w < 0.02) w = 0.06;
  if (!h || h < 0.02) h = 0.06;
  // Keep box inside [0,1]
  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);
  const label = String(raw.label || raw.text || "").trim().slice(0, 48);
  return { x, y, w, h, label };
}

function extractHighlightsBlock(text) {
  const src = String(text || "");
  const fence =
    /```\s*flickctx-highlights\s*\n([\s\S]*?)```/i.exec(src) ||
    /```\s*json\s*\n(\{\s*"highlights"[\s\S]*?)\n```/i.exec(src);
  if (!fence) {
    return { cleanText: src.trim(), payload: null };
  }
  const cleanText = (src.slice(0, fence.index) + src.slice(fence.index + fence[0].length))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(fence[1].trim());
  } catch {
    return { cleanText: src.trim(), payload: null };
  }
  const space =
    parsed.space === "display" || parsed.space === "full" ? "display" : "primary";
  const list = Array.isArray(parsed.highlights)
    ? parsed.highlights
    : Array.isArray(parsed)
      ? parsed
      : [];
  const highlights = list
    .map(normalizeHighlight)
    .filter(Boolean)
    .slice(0, 5);
  if (!highlights.length) {
    return { cleanText, payload: null };
  }
  return { cleanText, payload: { space, highlights } };
}

/**
 * Map normalized highlights into screen-space rects.
 * @param {{ space: string, highlights: object[] }} payload
 * @param {{ screenRect: {x,y,width,height}, displayBounds: {x,y,width,height} }} markMeta
 */
function toScreenHighlights(payload, markMeta) {
  if (!payload?.highlights?.length || !markMeta) return [];
  const base =
    payload.space === "display" ? markMeta.displayBounds : markMeta.screenRect;
  if (!base || !base.width || !base.height) return [];
  return payload.highlights.map((h) => ({
    x: base.x + h.x * base.width,
    y: base.y + h.y * base.height,
    width: Math.max(24, h.w * base.width),
    height: Math.max(24, h.h * base.height),
    label: h.label || "",
  }));
}

module.exports = {
  extractHighlightsBlock,
  toScreenHighlights,
  normalizeHighlight,
};
