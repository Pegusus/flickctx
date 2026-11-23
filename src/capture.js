const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function which(cmd) {
  try {
    return execFileSync("which", [cmd], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function tmpPng(prefix = "flickctx") {
  return path.join(
    os.tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`
  );
}

/**
 * Interactive region capture using OS tools when Electron overlay is unavailable.
 * macOS: screencapture -i
 * Wayland: grim + slurp
 * X11: scrot / maim
 */
function captureRegionCli() {
  const out = tmpPng();

  if (process.platform === "darwin") {
    execFileSync("screencapture", ["-i", "-x", out], { stdio: "ignore" });
    if (!fs.existsSync(out) || fs.statSync(out).size === 0) {
      throw new Error("Capture cancelled.");
    }
    return out;
  }

  if (process.platform === "linux") {
    if (which("grim") && which("slurp")) {
      const geom = execFileSync("slurp", [], { encoding: "utf8" }).trim();
      if (!geom) throw new Error("Capture cancelled.");
      execFileSync("grim", ["-g", geom, out], { stdio: "ignore" });
      return out;
    }
    if (which("maim")) {
      execFileSync("maim", ["-s", out], { stdio: "ignore" });
      return out;
    }
    if (which("scrot")) {
      execFileSync("scrot", ["-s", out], { stdio: "ignore" });
      return out;
    }
    throw new Error(
      "No region capture tool found. Install grim+slurp (Wayland) or maim/scrot (X11)."
    );
  }

  if (process.platform === "win32") {
    throw new Error(
      "CLI region capture on Windows is not supported yet. Use: npm start (Electron overlay)."
    );
  }

  throw new Error(`Unsupported platform: ${process.platform}`);
}

async function captureFullScreenPng() {
  // Lazy require so CLI works without electron native deps at import time
  const screenshot = require("screenshot-desktop");
  const img = await screenshot({ format: "png" });
  const out = tmpPng("flickctx-full");
  fs.writeFileSync(out, img);
  return out;
}

module.exports = {
  captureRegionCli,
  captureFullScreenPng,
  tmpPng,
};
