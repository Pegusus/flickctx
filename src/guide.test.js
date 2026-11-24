const assert = require("assert");
const {
  isGuideIntent,
  extractGuideBlock,
  guideStepToHighlightPayload,
  buildGuideStartPrompt,
} = require("./guide");

assert.strictEqual(isGuideIntent("where are the pods?"), true);
assert.strictEqual(isGuideIntent("show me how to find clusters"), true);
assert.strictEqual(isGuideIntent("what is this error?"), false);
assert.strictEqual(isGuideIntent("hello", true), true);

const raw = `Click EKS next.

\`\`\`flickctx-guide
{"done":false,"step":1,"label":"Click EKS","action":"click","space":"display","x":0.1,"y":0.2,"w":0.08,"h":0.04}
\`\`\`
`;
const parsed = extractGuideBlock(raw);
assert.ok(parsed.step);
assert.strictEqual(parsed.step.done, false);
assert.strictEqual(parsed.step.label, "Click EKS");
assert.ok(parsed.cleanText.includes("Click EKS next"));
assert.ok(!parsed.cleanText.includes("flickctx-guide"));

const payload = guideStepToHighlightPayload(parsed.step);
assert.strictEqual(payload.space, "display");
assert.strictEqual(payload.highlights.length, 1);

const done = extractGuideBlock(
  '```flickctx-guide\n{"done":true,"label":"Pods list visible"}\n```'
);
assert.strictEqual(done.step.done, true);

assert.ok(buildGuideStartPrompt("find pods", "/tmp/a.png").includes("GUIDE MODE"));

console.log("guide.test.js ok");
