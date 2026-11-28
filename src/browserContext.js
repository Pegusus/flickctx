/**
 * Format browser-bridge / SoM / desktop a11y for session / vision prompts.
 */

const { formatSomElements, mergeBrowserPromptContext } = require("./som");
const { formatDesktopA11y } = require("./desktopA11y");

function formatBrowserContext(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const lines = [
    "Browser DOM context (from Flickctx Chrome extension — prefer refs when acting):",
  ];
  if (ctx.url) lines.push(`- URL: ${ctx.url}`);
  if (ctx.title) lines.push(`- Title: ${ctx.title}`);
  const elements = Array.isArray(ctx.elements) ? ctx.elements : [];
  const somBlock = formatSomElements(elements);
  if (somBlock) {
    lines.push(somBlock);
  } else {
    lines.push("- No element resolved under the mark (vision still applies).");
  }
  lines.push(
    '- When returning flickctx-guide, prefer `"ref"` (e.g. "e3") and set `"selector"` only when needed.'
  );
  return lines.join("\n");
}

function formatGroundingContext({ browser, desktop } = {}) {
  const blocks = [];
  const browserBlock = formatBrowserContext(browser);
  if (browserBlock) blocks.push(browserBlock);
  const desktopBlock = formatDesktopA11y(desktop);
  if (desktopBlock) blocks.push(desktopBlock);
  return blocks.filter(Boolean).join("\n\n");
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
  formatGroundingContext,
  isBrowserApp,
  mergeBrowserPromptContext,
};