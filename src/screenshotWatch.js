const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SCREENSHOT_NAME =
  /^(Screenshot|Screen Shot|Capture d.écran|Bildschirmfoto|Captura de pantalla).*\.(png|jpe?g|heic)$/i;

function isScreenshotFilename(name) {
  return SCREENSHOT_NAME.test(String(name || ""));
}

function readMacScreenshotLocation() {
  if (process.platform !== "darwin") return null;
  try {
    const raw = execFileSync(
      "defaults",
      ["read", "com.apple.screencapture", "location"],
      { encoding: "utf8" }
    ).trim();
    return raw || null;
  } catch {
    return null;
  }
}

function expandTilde(p) {
  if (!p || typeof p !== "string") return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function resolveScreenshotDir() {
  if (process.platform === "darwin") {
    const configured = readMacScreenshotLocation();
    if (configured) {
      const resolved = path.resolve(expandTilde(configured));
      if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
        return resolved;
      }
    }
  }
  return path.join(os.homedir(), "Desktop");
}

function statSize(filePath) {
  try {
    return fs.statSync(filePath).size;
  } catch {
    return null;
  }
}

/**
 * Poll until two consecutive reads report the same non-zero size (file finished writing).
 */
async function waitForStableFile(filePath, opts = {}) {
  const pollMs = opts.pollMs ?? 80;
  const needStable = opts.stableReads ?? 2;
  let lastSize = null;
  let stable = 0;

  while (stable < needStable) {
    await new Promise((r) => setTimeout(r, pollMs));
    const size = statSize(filePath);
    if (size == null || size === 0) {
      lastSize = null;
      stable = 0;
      continue;
    }
    if (size === lastSize) {
      stable += 1;
    } else {
      lastSize = size;
      stable = 1;
    }
  }
  return filePath;
}

/**
 * Watch `dir` for new macOS screenshot files. Existing files at start are ignored.
 * @param {string} dir
 * @param {(absPath: string) => void | Promise<void>} onNew
 * @param {{ debounceMs?: number }} [opts]
 * @returns {{ stop: () => void, dir: string }}
 */
function startScreenshotWatch(dir, onNew, opts = {}) {
  const debounceMs = opts.debounceMs ?? 250;
  const seen = new Set();

  try {
    for (const name of fs.readdirSync(dir)) {
      if (isScreenshotFilename(name)) {
        seen.add(path.join(dir, name));
      }
    }
  } catch {
    /* ignore unreadable dir */
  }

  let debounceTimer = null;
  let watcher = null;

  const ingest = async (fullPath) => {
    const base = path.basename(fullPath);
    if (!isScreenshotFilename(base)) return;
    if (seen.has(fullPath)) return;
    seen.add(fullPath);
    try {
      await waitForStableFile(fullPath);
      await onNew(fullPath);
    } catch (err) {
      console.warn("screenshot watch:", err.message || err);
    }
  };

  const schedule = (filename) => {
    if (!filename || typeof filename !== "string") return;
    if (filename === dir) return;
    const full = path.join(dir, filename);
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      ingest(full);
    }, debounceMs);
  };

  try {
    watcher = fs.watch(dir, { persistent: false }, (_event, filename) => {
      schedule(filename);
    });
  } catch (err) {
    console.warn("screenshot watch: could not watch", dir, err.message || err);
    return {
      dir,
      stop() {
        clearTimeout(debounceTimer);
      },
    };
  }

  return {
    dir,
    stop() {
      clearTimeout(debounceTimer);
      if (watcher) {
        try {
          watcher.close();
        } catch {
          /* ignore */
        }
        watcher = null;
      }
    },
  };
}

module.exports = {
  SCREENSHOT_NAME,
  isScreenshotFilename,
  resolveScreenshotDir,
  waitForStableFile,
  startScreenshotWatch,
  readMacScreenshotLocation,
};