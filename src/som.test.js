const assert = require("assert");
const {
  normalizeRef,
  formatSomElements,
  mergeBrowserPromptContext,
} = require("./som");

assert.strictEqual(normalizeRef("3"), "e3");
assert.strictEqual(normalizeRef("E12"), "e12");
assert.strictEqual(normalizeRef("ref:5"), "e5");
assert.strictEqual(normalizeRef('e7'), "e7");

const formatted = formatSomElements([
  { ref: "e1", selector: "#nav", role: "link", text: "Pods" },
  { ref: "e2", text: "Save" },
]);
assert.ok(formatted.includes("ref=e1"));
assert.ok(formatted.includes("Pods"));

const merged = mergeBrowserPromptContext(
  { url: "https://a.test", elements: [{ ref: "e1", text: "A" }] },
  { title: "T", elements: [{ ref: "e1", text: "A" }, { ref: "e2", text: "B" }] }
);
assert.strictEqual(merged.elements.length, 2);
assert.strictEqual(merged.url, "https://a.test");
assert.strictEqual(merged.title, "T");

console.log("som.test.js ok");