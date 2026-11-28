const assert = require("assert");
const { formatDesktopA11y } = require("./desktopA11y");

const empty = formatDesktopA11y(null);
assert.strictEqual(empty, "");

const block = formatDesktopA11y({
  appName: "Finder",
  windowTitle: "Desktop",
  elements: [{ ref: "d1", role: "button", text: "OK" }],
});
assert.ok(block.includes("Desktop accessibility"));
assert.ok(block.includes("ref=d1"));

console.log("desktopA11y.test.js ok");