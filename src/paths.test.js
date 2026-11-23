const assert = require("assert");
const os = require("os");
const path = require("path");
const { isPathInside, resolveWithinRoots } = require("./paths");

const home = os.homedir();
const code = path.join(home, "code");

assert.strictEqual(isPathInside(code, path.join(code, "app", "a.js")), true);
assert.strictEqual(isPathInside(code, code), true);
assert.strictEqual(isPathInside(code, path.join(home, "secrets")), false);
assert.strictEqual(isPathInside(code, "/etc/passwd"), false);

const ok = resolveWithinRoots(path.join(code, "x"), [code]);
assert.strictEqual(ok.ok, true);

const bad = resolveWithinRoots("/etc/passwd", [code]);
assert.strictEqual(bad.ok, false);

const tilde = resolveWithinRoots("~/code/y", ["~/code"]);
assert.strictEqual(tilde.ok, true);

console.log("paths.test.js ok");
