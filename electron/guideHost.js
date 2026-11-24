/**
 * Guide overlay host — pointer + Next/Exit chrome.
 * Main process owns the guide state machine; this module owns the window.
 */
const path = require("path");
const { BrowserWindow } = require("electron");

function createGuideHost() {
  let win = null;
  let gen = 0;

  function destroy() {
    gen += 1;
    if (win && !win.isDestroyed()) {
      try {
        win.webContents.send("guide:clear");
      } catch {
        /* ignore */
      }
      win.destroy();
    }
    win = null;
  }

  async function ensure(displayBounds) {
    if (win && !win.isDestroyed()) {
      const b = win.getBounds();
      if (
        b.x === displayBounds.x &&
        b.y === displayBounds.y &&
        b.width === displayBounds.width &&
        b.height === displayBounds.height
      ) {
        return win;
      }
      destroy();
    }
    const next = new BrowserWindow({
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
    next.setAlwaysOnTop(true, "screen-saver");
    next.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    next.setIgnoreMouseEvents(true, { forward: true });
    if (process.platform === "darwin") {
      try {
        next.setWindowButtonVisibility(false);
      } catch {
        /* ignore */
      }
    }
    next.loadFile(path.join(__dirname, "guide.html"));
    win = next;
    await new Promise((resolve) => {
      if (next.webContents.isLoading()) {
        next.webContents.once("did-finish-load", resolve);
      } else {
        resolve();
      }
    });
    await new Promise((r) => setTimeout(r, 40));
    return next;
  }

  async function show(payload) {
    const bounds = payload.displayBounds;
    const myGen = ++gen;
    const w = await ensure(bounds);
    if (myGen !== gen || !w || w.isDestroyed()) return;
    w.showInactive();
    w.setIgnoreMouseEvents(true, { forward: true });
    w.webContents.send("guide:show", {
      items: payload.items || [],
      origin: { x: bounds.x, y: bounds.y },
      step: payload.step || {},
      busy: Boolean(payload.busy),
    });
  }

  function setBusy(busy) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("guide:busy", Boolean(busy));
    }
  }

  function setIgnoreMouse(ignore) {
    if (win && !win.isDestroyed()) {
      win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
    }
  }

  function isOpen() {
    return Boolean(win && !win.isDestroyed() && win.isVisible());
  }

  return {
    show,
    setBusy,
    setIgnoreMouse,
    destroy,
    isOpen,
  };
}

module.exports = { createGuideHost };
