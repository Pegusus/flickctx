const {
  extractHighlightsBlock,
  toScreenHighlights,
} = require("./highlights");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assert failed");
}

const sample = `Click the gear in the top-right.

\`\`\`flickctx-highlights
{"space":"primary","highlights":[{"x":0.82,"y":0.08,"w":0.1,"h":0.09,"label":"Settings"}]}
\`\`\`
`;

const { cleanText, payload } = extractHighlightsBlock(sample);
assert(cleanText.includes("gear"), "keeps prose");
assert(!cleanText.includes("flickctx-highlights"), "strips fence");
assert(payload.space === "primary", "space");
assert(payload.highlights.length === 1, "one highlight");
assert(payload.highlights[0].label === "Settings", "label");

const screen = toScreenHighlights(payload, {
  screenRect: { x: 100, y: 50, width: 400, height: 300 },
  displayBounds: { x: 0, y: 0, width: 1440, height: 900 },
});
assert(screen.length === 1, "mapped");
assert(Math.abs(screen[0].x - (100 + 0.82 * 400)) < 0.01, "x map");
assert(screen[0].label === "Settings", "label preserved");

const none = extractHighlightsBlock("Just a normal answer.");
assert(none.payload === null, "no block");
assert(none.cleanText === "Just a normal answer.", "passthrough");

console.log("highlights.test.js ok");
