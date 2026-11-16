/**
 * Detect the frontmost application (and browser URL when possible)
 * so the vision agent knows what product/UI the mark came from.
 */

const { execFileSync } = require("child_process");

function run(cmd, args, timeout = 2500) {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      timeout,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function detectMac() {
  const appName = run("osascript", [
    "-e",
    'tell application "System Events" to get name of first application process whose frontmost is true',
  ]);
  if (!appName) return { appName: null, url: null, windowTitle: null };

  const browsers = {
    Safari: `
tell application "Safari"
  if (count of windows) > 0 then
    return (name of front window) & "|||" & (URL of current tab of front window)
  end if
end tell`,
    "Google Chrome": `
tell application "Google Chrome"
  if (count of windows) > 0 then
    return (title of active tab of front window) & "|||" & (URL of active tab of front window)
  end if
end tell`,
    Chromium: `
tell application "Chromium"
  if (count of windows) > 0 then
    return (title of active tab of front window) & "|||" & (URL of active tab of front window)
  end if
end tell`,
    "Microsoft Edge": `
tell application "Microsoft Edge"
  if (count of windows) > 0 then
    return (title of active tab of front window) & "|||" & (URL of active tab of front window)
  end if
end tell`,
    Arc: `
tell application "Arc"
  if (count of windows) > 0 then
    return (title of active tab of front window) & "|||" & (URL of active tab of front window)
  end if
end tell`,
    Brave: `
tell application "Brave Browser"
  if (count of windows) > 0 then
    return (title of active tab of front window) & "|||" & (URL of active tab of front window)
  end if
end tell`,
  };

  let url = null;
  let windowTitle = null;
  const script = browsers[appName];
  if (script) {
    const raw = run("osascript", ["-e", script]);
    if (raw.includes("|||")) {
      const [title, u] = raw.split("|||");
      windowTitle = title || null;
      url = u || null;
    }
  } else {
    windowTitle =
      run("osascript", [
        "-e",
        'tell application "System Events" to get name of front window of first application process whose frontmost is true',
      ]) || null;
  }

  return { appName, url, windowTitle };
}

function detectLinux() {
  const wid = run("xdotool", ["getactivewindow"]);
  if (!wid) return { appName: null, url: null, windowTitle: null };
  const windowTitle = run("xdotool", ["getwindowname", wid]) || null;
  const appName =
    run("xdotool", ["getwindowclassname", wid]) ||
    run("xdotool", ["getwindowpid", wid]) ||
    null;
  return { appName, url: null, windowTitle };
}

/**
 * @returns {{ appName: string|null, url: string|null, windowTitle: string|null, platform: string }}
 */
function detectFrontmost() {
  const platform = process.platform;
  if (platform === "darwin") {
    return { ...detectMac(), platform };
  }
  if (platform === "linux") {
    return { ...detectLinux(), platform };
  }
  return { appName: null, url: null, windowTitle: null, platform };
}

function formatFrontmostHint(info) {
  if (!info) return "";
  const bits = [];
  if (info.appName) bits.push(`frontmost app: ${info.appName}`);
  if (info.windowTitle) bits.push(`window title: ${info.windowTitle}`);
  if (info.url) bits.push(`URL: ${info.url}`);
  if (!bits.length) return "";
  return (
    "Environment hint (from OS, may help identify the UI — still trust the marked image first):\n" +
    bits.map((b) => `- ${b}`).join("\n")
  );
}

module.exports = {
  detectFrontmost,
  formatFrontmostHint,
};
