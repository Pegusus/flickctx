/**
 * Desktop accessibility snapshot (non-browser apps) for grounding prompts.
 * Prefers `agent-desktop` when on PATH; falls back to macOS System Events heuristics.
 */

const { execFileSync, spawnSync } = require("child_process");

function commandOnPath(name) {
  try {
    const cmd =
      process.platform === "win32"
        ? `where ${name}`
        : `command -v ${name} 2>/dev/null`;
    execFileSync(cmd, { shell: true, stdio: ["ignore", "pipe", "ignore"] });
    return true;
  } catch {
    return false;
  }
}

function run(cmd, args, timeout = 4000) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 2 * 1024 * 1024,
    }).trim();
  } catch {
    return "";
  }
}

function captureViaAgentDesktop(screenRect) {
  if (!commandOnPath("agent-desktop")) return null;
  const args = ["snapshot", "--json"];
  if (screenRect && Number.isFinite(screenRect.x)) {
    args.push(
      "--rect",
      `${screenRect.x},${screenRect.y},${screenRect.width || screenRect.w},${screenRect.height || screenRect.h}`
    );
  }
  const proc = spawnSync("agent-desktop", args, {
    encoding: "utf8",
    timeout: 5000,
  });
  if (proc.status !== 0 || !proc.stdout) return null;
  try {
    const parsed = JSON.parse(proc.stdout);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function captureMacSystemEvents(frontmost) {
  if (process.platform !== "darwin") return null;
  const appName = String(frontmost?.appName || "").trim();
  if (!appName) return null;
  const script = `
tell application "System Events"
  set fp to first application process whose frontmost is true
  set win to missing value
  try
    set win to front window of fp
  end try
  set out to name of fp & "|" & (name of win as text)
  set elList to {}
  if win is not missing value then
    try
      repeat with el in entire contents of win
        try
          if (role of el) in {button, radio button, pop up button, text field, static text, image, menu item, check box, link, group, tab group} then
            set end of elList to (name of el as text) & tab & (role of el as text)
          end if
        end try
      end repeat
    end try
  end if
  return out & linefeed & (elList as text)
end tell`;
  const raw = run("osascript", ["-e", script], 6000);
  if (!raw) return null;
  const [header, ...rest] = raw.split("\n");
  const [app, windowTitle = ""] = (header || "").split("|");
  const controls = [];
  for (const line of rest.join("\n").split(/[\r\n,]+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, role] = trimmed.split(/\t/);
    if (!name && !role) continue;
    controls.push({
      ref: `d${controls.length + 1}`,
      role: (role || "element").toLowerCase(),
      text: String(name || "").slice(0, 120),
    });
    if (controls.length >= 24) break;
  }
  return {
    source: "macos-system-events",
    appName: app || appName,
    windowTitle: windowTitle || frontmost?.windowTitle || "",
    elements: controls,
  };
}

function captureDesktopA11y({ screenRect, frontmost } = {}) {
  const agent = captureViaAgentDesktop(screenRect);
  if (agent) {
    const elements = Array.isArray(agent.elements)
      ? agent.elements
      : Array.isArray(agent.controls)
        ? agent.controls
        : [];
    return {
      source: "agent-desktop",
      appName: agent.appName || frontmost?.appName || "",
      windowTitle: agent.windowTitle || frontmost?.windowTitle || "",
      elements: elements.slice(0, 24),
    };
  }
  const mac = captureMacSystemEvents(frontmost);
  if (mac) return mac;
  if (!frontmost?.appName) return null;
  return {
    source: "frontmost-only",
    appName: frontmost.appName,
    windowTitle: frontmost.windowTitle || "",
    elements: [],
  };
}

function formatDesktopA11y(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  const lines = [
    "Desktop accessibility (non-browser — prefer `ref` when returned in flickctx-guide):",
  ];
  if (snapshot.appName) lines.push(`- App: ${snapshot.appName}`);
  if (snapshot.windowTitle) lines.push(`- Window: ${String(snapshot.windowTitle).slice(0, 120)}`);
  const elements = Array.isArray(snapshot.elements) ? snapshot.elements : [];
  if (!elements.length) {
    lines.push("- No structured a11y tree (vision + mark still apply).");
    return lines.join("\n");
  }
  lines.push("- Interactive elements:");
  for (const el of elements.slice(0, 16)) {
    const bits = [];
    if (el.ref) bits.push(`ref=${el.ref}`);
    if (el.role) bits.push(`role=${el.role}`);
    if (el.text) bits.push(`text="${String(el.text).slice(0, 72)}"`);
    lines.push(`  • ${bits.join(" · ")}`);
  }
  return lines.join("\n");
}

module.exports = {
  captureDesktopA11y,
  formatDesktopA11y,
};