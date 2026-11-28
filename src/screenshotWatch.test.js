const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  isScreenshotFilename,
  resolveScreenshotDir,
  waitForStableFile,
  startScreenshotWatch,
  SCREENSHOT_NAME,
} = require("./screenshotWatch");

assert.ok(SCREENSHOT_NAME.test("Screenshot 2026-01-01 at 10.00.00.png"));
assert.ok(SCREENSHOT_NAME.test("Screen Shot 2026-01-01 at 10.00.00 AM.png"));
assert.ok(SCREENSHOT_NAME.test("Capture d'écran 2026-01-01.png"));
assert.ok(!isScreenshotFilename("notes.txt"));
assert.ok(isScreenshotFilename("Screenshot-foo.jpeg"));
assert.ok(isScreenshotFilename("Bildschirmfoto 2026-01-01.heic"));

const desktop = path.join(os.homedir(), "Desktop");
const resolved = resolveScreenshotDir();
if (process.platform === "darwin") {
  assert.ok(fs.existsSync(resolved) && fs.statSync(resolved).isDirectory());
} else {
  assert.strictEqual(resolved, desktop);
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flickctx-shot-watch-"));
  const target = path.join(dir, "Screenshot test.png");

  const stablePromise = waitForStableFile(target, { pollMs: 30, stableReads: 2 });
  fs.writeFileSync(target, Buffer.alloc(100));
  setTimeout(() => {
    fs.writeFileSync(target, Buffer.alloc(400));
  }, 40);
  await stablePromise;
  assert.strictEqual(fs.statSync(target).size, 400);

  const seen = [];
  const handle = startScreenshotWatch(dir, (p) => {
    seen.push(p);
  });

  const preExisting = path.join(dir, "Screenshot old.png");
  fs.writeFileSync(preExisting, Buffer.alloc(50));

  const fresh = path.join(dir, "Screenshot new file.png");
  await new Promise((r) => setTimeout(r, 50));
  fs.writeFileSync(fresh, Buffer.alloc(120));

  let attempts = 0;
  while (seen.length < 1 && attempts < 40) {
    await new Promise((r) => setTimeout(r, 100));
    attempts += 1;
  }
  handle.stop();
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0], fresh);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log("screenshotWatch.test.js: ok");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});