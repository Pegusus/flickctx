/**
 * Format browser-bridge inspect results for session / vision prompts.
 */

function formatBrowserContext(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const lines = [
    "Browser DOM context (from Flickctx Chrome extension — prefer selectors when acting):",
  ];
  if (ctx.url) lines.push(`- URL: ${ctx.url}`);
  if (ctx.title) lines.push(`- Title: ${ctx.title}`);
  const elements = Array.isArray(ctx.elements) ? ctx.elements : [];
  if (!elements.length) {
    lines.push("- No element resolved under the mark (vision still applies).");
    return lines.join("\n");
  }
  lines.push("- Elements under / near the mark:");
  for (const el of elements.slice(0, 5)) {
    const bits = [];
    if (el.selector) bits.push(`selector=\`${el.selector}\``);
    if (el.role) bits.push(`role=${el.role}`);
    if (el.text) bits.push(`text="${String(el.text).slice(0, 80)}"`);
    if (el.href) bits.push(`href=${el.href}`);
    if (el.aria) bits.push(`aria="${String(el.aria).slice(0, 60)}"`);
    lines.push(`  • ${bits.join(" · ")}`);
  }
  lines.push(
    "- When returning flickctx-guide, set \"selector\" to the best CSS selector when possible."
  );
  return lines.join("\n");
}

function isBrowserApp(frontmost) {
  const name = String(frontmost?.appName || "").toLowerCase();
  if (!name) return Boolean(frontmost?.url);
  return (
    name.includes("chrome") ||
    name.includes("chromium") ||
    name.includes("edge") ||
    name.includes("brave") ||
    name.includes("arc") ||
    name.includes("safari") ||
    name.includes("firefox") ||
    name.includes("opera") ||
    name.includes("vivaldi")
  );
}

module.exports = {
  formatBrowserContext,
  isBrowserApp,
};
