const {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  clipboard,
  ipcMain,
  screen,
  shell,
  desktopCapturer,
  systemPreferences,
  dialog,
} = require("electron");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadConfig, saveConfig } = require("../src/config");
const { explainSelection } = require("../src/explain");
const { captureFullScreenPng, tmpPng } = require("../src/capture");
const { detectFrontmost } = require("../src/frontmost");
const { toScreenHighlights } = require("../src/highlights");
const { listAgentSessions, sendToAgentSession } = require("../src/sessions");

// So dialogs / menus say Flickctx (Screen Recording list still shows “Electron” for npm start)
app.setName("Flickctx");

let tray = null;
let overlayWindows = []; // one per display — required for multi-monitor + macOS Spaces
let resultWindow = null;
let launcherWindow = null; // optional legacy; primary UI is menu-bar tray
let trayMenuWindow = null;
let highlightWindow = null;
let busy = false;
let lastImagePath = null;
let lastContextImagePath = null;
let lastFrontmost = null;
let pendingFrontmost = null;
let permissionPrompted = false;
/** { displayId, screenRect, displayBounds } for the active mark */
let lastMarkMeta = null;
/** Last model highlight payload for reshow */
let lastHighlightPayload = null;
/** Short conversation memory for the current mark: [{ user, assistant }] */
let conversationHistory = [];
/** Bound chat route for the current mark: null | {provider:'flickctx'} | session */
let activeRoute = null;
let highlightEscRegistered = false;
let highlightGen = 0;

function resolveInitialRoute(config) {
  if (
    config.rememberSessionRoute &&
    config.preferredSession &&
    config.preferredSession.provider &&
    config.preferredSession.provider !== "ask"
  ) {
    if (config.preferredSession.provider === "flickctx") {
      return {
        provider: "flickctx",
        id: "flickctx",
        title: "Flickctx built-in",
      };
    }
    return { ...config.preferredSession };
  }
  return null;
}

function ensureMacScreenPermission({ forcePrompt = false } = {}) {
  if (process.platform !== "darwin") return true;
  let status = "unknown";
  try {
    status = systemPreferences.getMediaAccessStatus("screen");
  } catch {
    status = "unknown";
  }
  if (status === "granted") return true;

  // Hitting desktopCapturer makes macOS add "Electron" to the Screen Recording list
  desktopCapturer
    .getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 1, height: 1 },
    })
    .catch(() => {});

  if (!permissionPrompted || forcePrompt) {
    permissionPrompted = true;
    dialog
      .showMessageBox({
        type: "info",
        title: "Enable Screen Recording",
        message: "Flickctx needs Screen Recording to mark any app or tab",
        detail:
          "In System Settings → Privacy & Security → Screen Recording:\n\n" +
          "1. Look for “Electron” (npm start does NOT show as Flickctx yet)\n" +
          "2. Turn it ON\n" +
          "3. Quit Flickctx completely and run npm start again\n\n" +
          "If Electron is missing from the list, click Mark once first, then reopen this settings page.",
        buttons: ["Open Screen Recording settings", "OK"],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          shell.openExternal(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
          );
        }
      });
  }
  return false;
}

function trayIcon() {
  // Prefer on-disk assets (git-tracked under assets/). Use a teal ring so the
  // status item is visible on both light and dark menu bars. The earlier
  // embedded PNG was effectively empty, so the menu-bar icon never appeared.
  const fromFile = [
    path.join(__dirname, "..", "assets", "trayIcon.png"),
    path.join(__dirname, "trayIcon.png"),
  ];
  for (const file of fromFile) {
    try {
      if (fs.existsSync(file)) {
        const img = nativeImage.createFromPath(file);
        if (!img.isEmpty()) {
          return img.resize({ width: 18, height: 18 });
        }
      }
    } catch {
      /* try next */
    }
  }

  // Teal 32×32 ring fallback (embedded).
  const png32 = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABNklEQVR42s2XLQ6EMBCFSaqxHAGBRqMRXIE1HKPBovEkOC6B5wZcAbOKG+wOySMhQEv52e2IzzSdvtfp9M95vXvHJneCBeEC8Q8Dk0hIpIQkSqICJdpS9BFPGpgGi4mCaImB+CgY0KdAjLhrIMDMOo2oig6xwVUDEdI7XhCfGTFGdNbAFNDcEF7TqEyo0l49KD5T7S3HXsHJg7Qf1Y1uOeS6MNfB8UHBmW5ZXWHGKgMC2+eu+JGJYpmFZUCIPfyEuM5EC62NgVRxyKgG9wgfeCdMDNDaGJAnZj+JJkQGErSZZkGuDQic5yYGPAjmRA1ytHmGBsq5DuZOrmbv780+g3AParT5hgYqaPIxYH0JrBchi21o/SCyfhRbv4xYXMfWHyQsnmQsHqUsnuUsPiYsvmZsPqc/4Qup0/d0IRpshQAAAABJRU5ErkJggg==",
    "base64"
  );
  const img = nativeImage.createFromBuffer(png32);
  return img.isEmpty() ? img : img.resize({ width: 18, height: 18 });
}

function formatHotkeyLabel(accelerator) {
  const raw = String(accelerator || "CommandOrControl+Shift+F");
  if (process.platform === "darwin") {
    return raw
      .replace(/CommandOrControl|Command|Cmd/gi, "⌘")
      .replace(/Control|Ctrl/gi, "⌃")
      .replace(/Alt|Option/gi, "⌥")
      .replace(/Shift/gi, "⇧")
      .replace(/\+/g, "");
  }
  return raw.replace(/CommandOrControl/gi, "Ctrl");
}

function createOverlayForDisplay(display) {
  const { x, y, width, height } = display.bounds;
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    focusable: true,
    // panel helps the overlay sit above normal apps on macOS
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (process.platform === "darwin") {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* ignore */
    }
  }
  win.loadFile(path.join(__dirname, "overlay.html"));
  return win;
}

function destroyOverlays() {
  for (const win of overlayWindows) {
    if (win && !win.isDestroyed()) win.destroy();
  }
  overlayWindows = [];
}

function createOverlays() {
  destroyOverlays();
  overlayWindows = screen.getAllDisplays().map((d) => createOverlayForDisplay(d));
  return overlayWindows;
}

const LAUNCHER_EXPANDED = { width: 300, height: 44 };
const LAUNCHER_COLLAPSED = { width: 118, height: 36 };
let launcherExpanded = false;
/** Remember chat visibility across a Mark gesture so cancel can restore it. */
let resultOpenBeforeMark = false;

function primaryWorkArea() {
  return screen.getPrimaryDisplay().workArea;
}

/**
 * Keep floating UI on every macOS Space / virtual desktop.
 * Must be re-applied after show/focus — becoming the key window can drop
 * NSWindowCollectionBehaviorCanJoinAllSpaces on some Electron/macOS builds.
 */
function pinAcrossSpaces(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  } catch {
    /* ignore */
  }
}

function launcherBounds(expanded = launcherExpanded) {
  const area = primaryWorkArea();
  const size = expanded ? LAUNCHER_EXPANDED : LAUNCHER_COLLAPSED;
  return {
    width: size.width,
    height: size.height,
    x: area.x + area.width - size.width - 16,
    y: area.y + 12,
  };
}

function placeResultWindow(win) {
  if (!win || win.isDestroyed()) return;
  const area = primaryWorkArea();
  const width = Math.min(460, Math.max(360, win.getBounds().width || 460));
  const height = Math.min(620, Math.max(420, win.getBounds().height || 620));
  win.setBounds({
    width,
    height,
    x: area.x + area.width - width - 16,
    y: area.y + 16,
  });
}

function setLauncherExpanded(expanded) {
  launcherExpanded = Boolean(expanded);
  if (!launcherWindow || launcherWindow.isDestroyed()) return;
  launcherWindow.setBounds(launcherBounds(launcherExpanded));
  launcherWindow.showInactive();
  pinAcrossSpaces(launcherWindow);
  launcherWindow.webContents.send(
    "launcher:mode",
    launcherExpanded ? "expanded" : "collapsed"
  );
  if (resultWindow && !resultWindow.isDestroyed() && resultWindow.isVisible()) {
    placeResultWindow(resultWindow);
    pinAcrossSpaces(resultWindow);
  }
}

function showLauncherChip() {
  setLauncherExpanded(false);
}

function createResultWindow() {
  const width = 460;
  const height = 620;
  const area = primaryWorkArea();
  const win = new BrowserWindow({
    width,
    height,
    x: area.x + area.width - width - 16,
    y: area.y + 12 + LAUNCHER_COLLAPSED.height + 10,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    focusable: true,
    fullscreenable: false,
    backgroundColor: "#111318",
    // panel = join every macOS Space (same as the Mark chip)
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  pinAcrossSpaces(win);
  if (process.platform === "darwin") {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* ignore */
    }
  }
  // Re-pin when the window becomes key / shown — Spaces stickiness can drop.
  win.on("show", () => pinAcrossSpaces(win));
  win.on("focus", () => pinAcrossSpaces(win));
  win.loadFile(path.join(__dirname, "result.html"));
  return win;
}

function createLauncher() {
  const bounds = launcherBounds(false);
  const win = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    show: true,
    focusable: true,
    // panel = stay on all Spaces like a menu-bar widget
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  pinAcrossSpaces(win);
  if (process.platform === "darwin") {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* ignore */
    }
  }
  win.on("show", () => pinAcrossSpaces(win));
  win.on("focus", () => pinAcrossSpaces(win));
  win.loadFile(path.join(__dirname, "launcher.html"));
  win.webContents.on("did-finish-load", () => {
    win.webContents.send("launcher:mode", "collapsed");
  });
  return win;
}

function showOverlay() {
  if (busy) return;
  ensureMacScreenPermission();
  clearHighlights();
  // Snapshot frontmost app/URL *before* overlays steal focus
  try {
    pendingFrontmost = detectFrontmost();
  } catch {
    pendingFrontmost = null;
  }
  resultOpenBeforeMark = Boolean(
    resultWindow && !resultWindow.isDestroyed() && resultWindow.isVisible()
  );
  hideTrayMenu();
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    launcherWindow.hide();
  }
  if (resultWindow && !resultWindow.isDestroyed()) {
    resultWindow.hide();
  }
  // overlays cover the screen; chat restores after cancel if it was open
  // Recreate each time so newly plugged monitors / Spaces are covered
  const wins = createOverlays();
  for (const win of wins) {
    win.show();
    pinAcrossSpaces(win);
    win.webContents.send("overlay:reset");
  }
  // Focus the overlay on the cursor's display
  const pt = screen.getCursorScreenPoint();
  const targetDisplay = screen.getDisplayNearestPoint(pt);
  const focusWin =
    wins.find((w) => {
      const b = w.getBounds();
      return (
        b.x === targetDisplay.bounds.x &&
        b.y === targetDisplay.bounds.y &&
        b.width === targetDisplay.bounds.width &&
        b.height === targetDisplay.bounds.height
      );
    }) || wins[0];
  if (focusWin) focusWin.focus();
}

function hideOverlay() {
  destroyOverlays();
  if (resultOpenBeforeMark) {
    resultOpenBeforeMark = false;
    showResultWindow();
  }
}

async function captureDisplayPng(display) {
  // macOS: screencapture is the most reliable for any Space / display
  if (process.platform === "darwin") {
    const out = tmpPng("flickctx-display");
    const { x, y, width, height } = display.bounds;
    try {
      execFileSync(
        "screencapture",
        ["-x", "-R", `${x},${y},${width},${height}`, out],
        { stdio: "ignore" }
      );
      if (fs.existsSync(out) && fs.statSync(out).size > 0) return out;
    } catch (err) {
      console.warn("screencapture failed:", err.message || err);
    }
  }

  const targetW = Math.round(display.size.width * (display.scaleFactor || 1));
  const targetH = Math.round(display.size.height * (display.scaleFactor || 1));

  // Prefer Electron desktopCapturer (no ImageMagick / scrot dependency)
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: targetW, height: targetH },
    });
    if (!sources.length) throw new Error("No screen sources");

    const match =
      sources.find((s) => {
        const size = s.thumbnail.getSize();
        return (
          Math.abs(size.width - targetW) < 16 &&
          Math.abs(size.height - targetH) < 16
        );
      }) ||
      sources.find((s) => String(s.display_id) === String(display.id)) ||
      sources[0];

    const out = tmpPng("flickctx-display");
    fs.writeFileSync(out, match.thumbnail.toPNG());
    return out;
  } catch (err) {
    console.warn("desktopCapturer failed, falling back:", err.message || err);
  }

  try {
    const screenshot = require("screenshot-desktop");
    const list = await screenshot.listDisplays();
    const match =
      list.find(
        (d) =>
          Math.abs((d.width || 0) - display.size.width) < 8 &&
          Math.abs((d.height || 0) - display.size.height) < 8
      ) ||
      list[0];
    const img = await screenshot({
      format: "png",
      screen: match?.id,
    });
    const out = tmpPng("flickctx-display");
    fs.writeFileSync(out, img);
    return out;
  } catch (err) {
    console.warn("screenshot-desktop failed, trying scrot:", err.message || err);
  }

  // Last resort: scrot / import full screen
  // Use the module-level execFileSync — a local const here would TDZ-shadow
  // the earlier screencapture call in this same function.
  const out = tmpPng("flickctx-display");
  try {
    execFileSync("scrot", [out], { stdio: "ignore" });
    return out;
  } catch {
    execFileSync("import", ["-window", "root", out], { stdio: "ignore" });
    return out;
  }
}

async function cropSelection(fullPath, rect, display) {
  const img = nativeImage.createFromPath(fullPath);
  const size = img.getSize();
  if (!size.width || !size.height) {
    throw new Error("Screen capture produced an empty image.");
  }

  // Map screen-space rect → pixels using actual capture size (handles Retina
  // better than assuming scaleFactor matches the PNG).
  const scaleX = size.width / Math.max(1, display.bounds.width);
  const scaleY = size.height / Math.max(1, display.bounds.height);

  const crop = {
    x: Math.max(0, Math.round((rect.x - display.bounds.x) * scaleX)),
    y: Math.max(0, Math.round((rect.y - display.bounds.y) * scaleY)),
    width: Math.max(1, Math.round(rect.width * scaleX)),
    height: Math.max(1, Math.round(rect.height * scaleY)),
  };

  crop.x = Math.min(crop.x, Math.max(0, size.width - 1));
  crop.y = Math.min(crop.y, Math.max(0, size.height - 1));
  crop.width = Math.min(crop.width, size.width - crop.x);
  crop.height = Math.min(crop.height, size.height - crop.y);

  if (crop.width < 8 || crop.height < 8) {
    throw new Error(
      `Crop too small (${crop.width}×${crop.height}). Draw a larger freehand mark.`
    );
  }

  const cropped = img.crop(crop);
  const out = tmpPng("flickctx-crop");
  const png = cropped.toPNG();
  if (!png || png.length < 200) {
    throw new Error("Cropped mark is empty — try marking again.");
  }
  fs.writeFileSync(out, png);
  return { path: out, width: crop.width, height: crop.height, bytes: png.length };
}

function imagePreviewDataUrl(imagePath, maxW = 640) {
  try {
    let img = nativeImage.createFromPath(imagePath);
    const size = img.getSize();
    if (size.width > maxW) {
      const h = Math.round((size.height * maxW) / size.width);
      img = img.resize({ width: maxW, height: h });
    }
    return img.toDataURL();
  } catch {
    return null;
  }
}

function ensureResultWindow() {
  if (!resultWindow || resultWindow.isDestroyed()) {
    resultWindow = createResultWindow();
  }
  placeResultWindow(resultWindow);
  pinAcrossSpaces(resultWindow);
  return resultWindow;
}

function showResultWindow() {
  const win = ensureResultWindow();
  hideTrayMenu();
  placeResultWindow(win);
  win.show();
  pinAcrossSpaces(win);
  win.focus();
  // Focus can clear “join all Spaces” — pin again after becoming key.
  pinAcrossSpaces(win);
  return win;
}

function hideResultWindow() {
  if (resultWindow && !resultWindow.isDestroyed()) resultWindow.hide();
}

function createTrayMenuWindow() {
  const win = new BrowserWindow({
    width: 232,
    height: 360,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    focusable: true,
    hasShadow: false,
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  pinAcrossSpaces(win);
  if (process.platform === "darwin") {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* ignore */
    }
  }
  win.loadFile(path.join(__dirname, "tray-menu.html"));
  win.on("blur", () => hideTrayMenu());
  return win;
}

function hideTrayMenu() {
  if (trayMenuWindow && !trayMenuWindow.isDestroyed() && trayMenuWindow.isVisible()) {
    trayMenuWindow.hide();
  }
}

function showTrayMenu() {
  if (!tray) return;
  if (!trayMenuWindow || trayMenuWindow.isDestroyed()) {
    trayMenuWindow = createTrayMenuWindow();
  }
  const width = 232;
  const height = 360;
  let x = 0;
  let y = 0;
  try {
    const b = tray.getBounds();
    x = Math.round(b.x + b.width / 2 - width / 2);
    y = Math.round(b.y + b.height + 6);
  } catch {
    const area = primaryWorkArea();
    x = area.x + area.width - width - 12;
    y = area.y + 8;
  }
  // Keep on-screen
  const area = primaryWorkArea();
  x = Math.min(Math.max(area.x + 8, x), area.x + area.width - width - 8);
  y = Math.min(Math.max(area.y + 4, y), area.y + area.height - height - 8);

  if (trayMenuWindow.isVisible()) {
    hideTrayMenu();
    return;
  }

  trayMenuWindow.setBounds({ x, y, width, height });
  trayMenuWindow.webContents.send("tray:meta", {
    hotkey: formatHotkeyLabel(loadConfig().hotkey),
  });
  trayMenuWindow.show();
  pinAcrossSpaces(trayMenuWindow);
  trayMenuWindow.focus();
  pinAcrossSpaces(trayMenuWindow);
}

function clearHighlights() {
  highlightGen += 1;
  if (highlightEscRegistered) {
    try {
      globalShortcut.unregister("Escape");
    } catch {
      /* ignore */
    }
    highlightEscRegistered = false;
    registerHotkey();
  }
  if (highlightWindow && !highlightWindow.isDestroyed()) {
    highlightWindow.webContents.send("highlight:clear");
    highlightWindow.hide();
  }
}

function createHighlightWindow(displayBounds) {
  if (highlightWindow && !highlightWindow.isDestroyed()) {
    highlightWindow.destroy();
  }
  const win = new BrowserWindow({
    x: displayBounds.x,
    y: displayBounds.y,
    width: displayBounds.width,
    height: displayBounds.height,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    show: false,
    focusable: true,
    type: process.platform === "darwin" ? "panel" : "toolbar",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  if (process.platform === "darwin") {
    try {
      win.setWindowButtonVisibility(false);
    } catch {
      /* ignore */
    }
  }
  win.loadFile(path.join(__dirname, "highlight.html"));
  highlightWindow = win;
  return win;
}

async function showHighlightsOnScreen(payload) {
  if (!payload?.highlights?.length || !lastMarkMeta) {
    clearHighlights();
    return [];
  }
  const items = toScreenHighlights(payload, lastMarkMeta);
  if (!items.length) {
    clearHighlights();
    return [];
  }
  lastHighlightPayload = payload;
  const gen = ++highlightGen;
  const bounds = lastMarkMeta.displayBounds;
  const win = createHighlightWindow(bounds);
  await new Promise((resolve) => {
    if (win.webContents.isLoading()) {
      win.webContents.once("did-finish-load", resolve);
    } else {
      resolve();
    }
  });
  await new Promise((r) => setTimeout(r, 50));
  if (gen !== highlightGen) return items;
  win.showInactive();
  win.webContents.send("highlight:show", {
    items,
    origin: { x: bounds.x, y: bounds.y },
  });
  if (!highlightEscRegistered) {
    const ok = globalShortcut.register("Escape", () => clearHighlights());
    highlightEscRegistered = Boolean(ok);
  }
  setTimeout(() => {
    if (gen === highlightGen) clearHighlights();
  }, 20000);
  return items;
}

async function runExplain(imagePath, question = "") {
  const config = loadConfig();
  const win = showResultWindow();
  const route = activeRoute;
  win.webContents.send("result:loading", {
    projectPath: config.projectPath,
    route: route
      ? { provider: route.provider, id: route.id, title: route.title }
      : null,
  });

  try {
    let result;
    if (route && route.provider && route.provider !== "flickctx") {
      // OpenCode / Claude Code use their own auth — stream thinking/answer through.
      result = await sendToAgentSession({
        session: route,
        question,
        imagePath,
        onProgress: (progress) => {
          if (!win.isDestroyed()) {
            win.webContents.send("result:stream", {
              ...progress,
              provider: route.provider,
            });
          }
        },
      });
    } else {
      result = await explainSelection({
        apiKey: config.apiKey,
        authMode: config.authMode,
        apiKeySource: config.apiKeySource,
        model: config.model,
        projectPath: config.projectPath,
        imagePath,
        contextImagePath: lastContextImagePath,
        frontmost: lastFrontmost,
        question,
        maxTranscriptChars: config.maxTranscriptChars,
        maxDiffChars: config.maxDiffChars,
        searchRoots: config.searchRoots,
        maxRepos: config.maxRepos,
        scanLocalRepos: config.scanLocalRepos,
        conversationHistory,
        thinking: config.thinking !== false,
        thinkingBudgetTokens: config.thinkingBudgetTokens || 8000,
        maxImageEdge: config.maxImageEdge || 1600,
        jpegQuality: config.jpegQuality || 80,
      });
    }
    conversationHistory.push({
      user: question || "look at what i marked and explain it.",
      assistant: result.explanation || "",
    });
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }
    // Bind newly created Claude/OpenCode session id for follow-ups.
    if (
      result.route &&
      (result.route.provider === "claude" ||
        result.route.provider === "opencode") &&
      result.route.id &&
      result.route.id !== "new"
    ) {
      activeRoute = {
        ...(activeRoute || {}),
        provider: result.route.provider,
        id: result.route.id,
        title: result.route.title || result.route.id,
        directory: result.route.directory || activeRoute?.directory || "",
        isNew: false,
      };
      const cfg = loadConfig();
      if (cfg.rememberSessionRoute !== false) {
        saveConfig({
          preferredSession: activeRoute,
          preferredRoute: activeRoute.provider,
          rememberSessionRoute: true,
        });
      }
    }
    let width = null;
    let height = null;
    try {
      const sz = nativeImage.createFromPath(imagePath).getSize();
      width = sz.width;
      height = sz.height;
    } catch {
      /* ignore */
    }
    const fm = lastFrontmost;
    const hintBits = [];
    if (fm?.appName) hintBits.push(fm.appName);
    if (fm?.url) {
      try {
        hintBits.push(new URL(fm.url).hostname);
      } catch {
        hintBits.push(fm.url.slice(0, 48));
      }
    }
    let highlightCount = 0;
    if (!result.route || result.route.provider === "flickctx") {
      try {
        const drawn = await showHighlightsOnScreen(result.highlights || null);
        highlightCount = drawn.length;
      } catch (err) {
        console.warn("highlight overlay failed:", err.message || err);
      }
    }
    win.webContents.send("result:done", {
      ...result,
      imagePath,
      previewDataUrl: imagePreviewDataUrl(imagePath),
      width,
      height,
      frontmostLabel: hintBits.join(" · ") || "",
      hasContextImage: Boolean(lastContextImagePath),
      highlightCount,
      route: route
        ? {
            provider: route.provider,
            id: route.id,
            title: route.title || route.id,
          }
        : { provider: "flickctx", id: "flickctx", title: "Flickctx built-in" },
    });
  } catch (err) {
    win.webContents.send("result:error", {
      message: err.message || String(err),
    });
  }
}

function registerIpc() {
  ipcMain.handle("config:get", () => {
    const c = loadConfig();
    return {
      projectPath: c.projectPath,
      model: c.model,
      hotkey: c.hotkey,
      hasApiKey: Boolean(c.apiKey),
      configPath: c.configPath,
      preferredRoute: c.preferredRoute,
      preferredSession: c.preferredSession,
      rememberSessionRoute: c.rememberSessionRoute !== false,
      activeRoute,
    };
  });

  ipcMain.handle("config:set", (_e, partial) => {
    const saved = saveConfig(partial || {});
    return {
      projectPath: saved.projectPath,
      model: saved.model,
      hotkey: saved.hotkey,
      hasApiKey: Boolean(saved.apiKey),
    };
  });

  function loadSessionCatalog() {
    try {
      return listAgentSessions({ limit: 40 });
    } catch (err) {
      console.warn("session list failed:", err.message || err);
      return {
        sessions: [],
        byProvider: { claude: [], opencode: [] },
        counts: { claude: 0, opencode: 0 },
        claudeAvailable: false,
        opencodeAvailable: false,
        error: err.message || String(err),
      };
    }
  }

  function sessionPickerPayload(catalog, config) {
    return {
      sessions: catalog.sessions || [],
      byProvider: catalog.byProvider || {
        claude: (catalog.sessions || []).filter((s) => s.provider === "claude"),
        opencode: (catalog.sessions || []).filter(
          (s) => s.provider === "opencode"
        ),
      },
      sessionMeta: {
        counts: catalog.counts || {},
        claudeAvailable: Boolean(catalog.claudeAvailable),
        opencodeAvailable: Boolean(catalog.opencodeAvailable),
        rememberSessionRoute:
          !config || config.rememberSessionRoute !== false,
        error: catalog.error || "",
      },
    };
  }

  ipcMain.handle("sessions:list", () => {
    return loadSessionCatalog();
  });

  ipcMain.handle("sessions:set-route", (_e, payload) => {
    const remember = payload?.remember !== false;
    if (!payload || payload.provider === "flickctx") {
      activeRoute = {
        provider: "flickctx",
        id: "flickctx",
        title: "Flickctx built-in",
      };
    } else if (
      payload.provider === "claude" ||
      payload.provider === "opencode"
    ) {
      const isNew = Boolean(payload.isNew) || payload.id === "new" || !payload.id;
      const config = loadConfig();
      activeRoute = {
        provider: payload.provider,
        id: isNew ? "new" : payload.id,
        title:
          payload.title ||
          (isNew
            ? payload.provider === "claude"
              ? "New Claude Code session"
              : "New OpenCode session"
            : payload.id),
        directory:
          payload.directory ||
          config.projectPath ||
          process.cwd(),
        sessionFile: payload.sessionFile || "",
        isNew,
      };
    } else {
      activeRoute = null;
    }
    if (remember && activeRoute) {
      saveConfig({
        preferredSession: activeRoute,
        preferredRoute: activeRoute.provider,
        rememberSessionRoute: true,
      });
    } else if (payload?.remember === false) {
      saveConfig({ rememberSessionRoute: false });
    }
    return { route: activeRoute };
  });

  ipcMain.on("app:mark", () => showOverlay());

  ipcMain.on("overlay:cancel", () => {
    hideOverlay();
  });

  ipcMain.on("overlay:complete", async (_e, rect) => {
    // Ignore duplicate completes from other display overlays
    if (busy) {
      resultOpenBeforeMark = false;
      hideOverlay();
      return;
    }
    if (!rect || rect.width < 4 || rect.height < 4) {
      hideOverlay();
      return;
    }
    busy = true;
    // New mark opens a fresh chat — don't restore the previous panel.
    resultOpenBeforeMark = false;
    hideOverlay();
    try {
      // Capture after overlay hides so the dimmer isn't in the shot
      await new Promise((r) => setTimeout(r, 120));
      const display = screen.getDisplayNearestPoint({
        x: Math.round(rect.x + rect.width / 2),
        y: Math.round(rect.y + rect.height / 2),
      });
      const full = await captureDisplayPng(display);
      const cropped = await cropSelection(full, rect, display);
      // Keep full-display PNG as secondary vision context (cleaned on next mark)
      if (lastContextImagePath && lastContextImagePath !== full) {
        try {
          fs.unlinkSync(lastContextImagePath);
        } catch {
          /* ignore */
        }
      }
      lastContextImagePath = full;
      lastImagePath = cropped.path;
      lastFrontmost = pendingFrontmost;
      pendingFrontmost = null;
      conversationHistory = []; // new mark = new chat thread
      clearHighlights();
      lastHighlightPayload = null;
      lastMarkMeta = {
        displayId: display.id,
        screenRect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        displayBounds: { ...display.bounds },
      };
      const config = loadConfig();
      activeRoute = resolveInitialRoute(config);
      const sessionCatalog = loadSessionCatalog();
      const picker = sessionPickerPayload(sessionCatalog, config);
      const win = showResultWindow();
      const fm = lastFrontmost;
      const hintBits = [];
      if (fm?.appName) hintBits.push(fm.appName);
      if (fm?.url) {
        try {
          hintBits.push(new URL(fm.url).hostname);
        } catch {
          hintBits.push(String(fm.url).slice(0, 48));
        }
      }
      win.webContents.send("result:ready-ask", {
        imagePath: cropped.path,
        previewDataUrl: imagePreviewDataUrl(cropped.path),
        width: cropped.width,
        height: cropped.height,
        bytes: cropped.bytes,
        projectPath: config.projectPath,
        frontmostLabel: hintBits.join(" · ") || "",
        hasContextImage: true,
        route: activeRoute,
        needsRoutePick: !activeRoute,
        sessions: picker.sessions,
        byProvider: picker.byProvider,
        sessionMeta: picker.sessionMeta,
      });
    } catch (err) {
      const win = showResultWindow();
      win.webContents.send("result:error", {
        message: err.message || String(err),
      });
    } finally {
      busy = false;
    }
  });

  ipcMain.on("launcher:set-expanded", (_e, expanded) => {
    setLauncherExpanded(Boolean(expanded));
  });

  ipcMain.on("tray:blur", () => {
    hideTrayMenu();
  });

  ipcMain.on("tray:action", (_e, action) => {
    hideTrayMenu();
    switch (action) {
      case "mark":
        showOverlay();
        break;
      case "chat":
        showResultWindow();
        break;
      case "hide-chat":
        hideResultWindow();
        break;
      case "new-claude":
      case "new-opencode": {
        const provider = action === "new-claude" ? "claude" : "opencode";
        const config = loadConfig();
        activeRoute = {
          provider,
          id: "new",
          isNew: true,
          title:
            provider === "claude"
              ? "New Claude Code session"
              : "New OpenCode session",
          directory: config.projectPath || process.cwd(),
        };
        if (config.rememberSessionRoute !== false) {
          saveConfig({
            preferredSession: activeRoute,
            preferredRoute: provider,
            rememberSessionRoute: true,
          });
        }
        const win = showResultWindow();
        win.webContents.send("result:route-set", { route: activeRoute });
        break;
      }
      case "config": {
        const c = loadConfig();
        fs.mkdirSync(c.configDir, { recursive: true });
        shell.showItemInFolder(c.configPath);
        break;
      }
      case "permission":
        ensureMacScreenPermission({ forcePrompt: true });
        break;
      case "quit":
        app.quit();
        break;
      default:
        break;
    }
  });

  ipcMain.on("result:ask", async (_e, payload) => {
    const imagePath = payload?.imagePath || lastImagePath;
    if (!imagePath) {
      const win = showResultWindow();
      win.webContents.send("result:error", {
        message: "No marked region yet. Click Mark and draw freehand around something first.",
      });
      return;
    }
    if (!activeRoute) {
      const win = showResultWindow();
      const picker = sessionPickerPayload(loadSessionCatalog(), loadConfig());
      win.webContents.send("result:pick-route", {
        imagePath,
        sessions: picker.sessions,
        byProvider: picker.byProvider,
        sessionMeta: picker.sessionMeta,
      });
      return;
    }
    if (busy) return;
    busy = true;
    try {
      await runExplain(imagePath, payload?.question || "");
    } finally {
      busy = false;
    }
  });

  ipcMain.on("result:close", () => {
    hideResultWindow();
  });

  ipcMain.on("result:clear-chat", () => {
    conversationHistory = [];
  });

  ipcMain.on("result:change-route", () => {
    activeRoute = null;
    const config = loadConfig();
    const picker = sessionPickerPayload(loadSessionCatalog(), config);
    const win = ensureResultWindow();
    win.webContents.send("result:pick-route", {
      imagePath: lastImagePath,
      sessions: picker.sessions,
      byProvider: picker.byProvider,
      sessionMeta: picker.sessionMeta,
    });
  });

  ipcMain.on("result:copy", (_e, text) => {
    clipboard.writeText(text || "");
  });

  ipcMain.on("result:open-config", () => {
    const c = loadConfig();
    shell.showItemInFolder(c.configPath);
  });

  ipcMain.on("highlight:dismiss", () => {
    clearHighlights();
  });

  ipcMain.on("highlight:reshow", async () => {
    if (lastHighlightPayload) {
      await showHighlightsOnScreen(lastHighlightPayload);
    }
  });
}

function buildTray() {
  const icon = trayIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Flickctx — click to Mark or open chat");
  if (process.platform === "darwin") {
    try {
      tray.setIgnoreDoubleClickEvents(true);
    } catch {
      /* ignore */
    }
    // Always show a short title so the status item is findable even if the
    // bitmap fails to paint (common with empty/broken tray PNGs).
    try {
      tray.setTitle(icon.isEmpty() ? "Flickctx" : " Fx");
    } catch {
      /* ignore */
    }
  }
  // Menu-bar status item: click opens our dropdown under the icon.
  // Do not setContextMenu on macOS — it swallows click events.
  tray.on("click", () => showTrayMenu());
  tray.on("right-click", () => showTrayMenu());
  tray.on("double-click", () => showOverlay());
  console.log(
    icon.isEmpty()
      ? "Flickctx tray: text-only status item (icon missing)"
      : "Flickctx tray: menu-bar status item ready"
  );
}

function registerHotkey() {
  const config = loadConfig();
  globalShortcut.unregisterAll();
  const ok = globalShortcut.register(config.hotkey, () => showOverlay());
  if (!ok) {
    console.error("Failed to register hotkey", config.hotkey);
  } else {
    console.log(`Flickctx ready — press ${config.hotkey} to mark a region`);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => showOverlay());

  app.whenReady().then(async () => {
    registerIpc();
    // Create the menu-bar icon *before* hiding the Dock — otherwise a failed
    // tray leaves the user with no way to reach the app.
    buildTray();
    if (process.platform === "darwin" && app.dock) {
      try {
        app.dock.hide();
      } catch {
        /* ignore */
      }
    }
    registerHotkey();
    trayMenuWindow = createTrayMenuWindow();
    resultWindow = createResultWindow();
    screen.on("display-metrics-changed", () => {
      if (resultWindow && !resultWindow.isDestroyed() && resultWindow.isVisible()) {
        placeResultWindow(resultWindow);
      }
    });
    // Trigger macOS to register this process in Screen Recording (shows as Electron)
    ensureMacScreenPermission({ forcePrompt: true });
    try {
      await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1, height: 1 },
      });
    } catch {
      /* permission may still be pending */
    }
    console.log(
      "Flickctx UI: menu-bar icon → Mark / Open chat. Chat stays on every Space. On macOS enable Screen Recording for “Electron”, then restart."
    );
  });

  app.on("will-quit", () => {
    globalShortcut.unregisterAll();
  });

  app.on("window-all-closed", (e) => {
    // Keep tray app alive
    e.preventDefault?.();
  });
}
