/**
 * Flickctx extension service worker — polls the local Electron bridge.
 */
const BRIDGE = "http://127.0.0.1:19234";
const POLL_MS = 700;

let pollTimer = null;

async function bridge(path, opts = {}) {
  const res = await fetch(`${BRIDGE}${path}`, {
    method: opts.method || "GET",
    headers: {
      "content-type": "application/json",
      "x-flickctx-bridge": "extension",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`bridge ${path} → ${res.status}`);
  if (res.status === 204) return {};
  return res.json();
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tabs[0] || null;
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script may not be injected yet (e.g. fresh navigation)
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });
      return await chrome.tabs.sendMessage(tabId, message);
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
  }
}

async function pushContext() {
  const tab = await activeTab();
  if (!tab?.id) return;
  const snap = await sendToTab(tab.id, { type: "snapshot" });
  await bridge("/v1/context", {
    method: "POST",
    body: {
      tabId: tab.id,
      url: snap?.url || tab.url || "",
      title: snap?.title || tab.title || "",
      favIconUrl: tab.favIconUrl || "",
      userAgent: self.navigator?.userAgent || "flickctx-extension",
    },
  });
}

async function handleCommand(cmd) {
  const tab = await activeTab();
  if (!tab?.id) {
    await bridge("/v1/result", {
      method: "POST",
      body: { id: cmd.id, ok: false, error: "no active tab" },
    });
    return;
  }

  let result = { ok: false, error: "unknown" };
  if (cmd.type === "inspect") {
    result = await sendToTab(tab.id, {
      type: "inspect",
      screenRect: cmd.payload?.screenRect,
    });
  } else if (cmd.type === "highlight") {
    result = await sendToTab(tab.id, {
      type: "highlight",
      targets: cmd.payload?.targets || [],
    });
  } else if (cmd.type === "som") {
    result = await sendToTab(tab.id, {
      type: "som",
      screenRect: cmd.payload?.screenRect,
      showBadges: cmd.payload?.showBadges === true,
    });
  } else if (cmd.type === "click") {
    result = await sendToTab(tab.id, {
      type: "click",
      ref: cmd.payload?.ref,
      selector: cmd.payload?.selector,
    });
  } else if (cmd.type === "clear") {
    result = await sendToTab(tab.id, { type: "clear" });
  }

  await bridge("/v1/result", {
    method: "POST",
    body: { id: cmd.id, ...(result || {}) },
  });
}

async function tick() {
  try {
    await bridge("/v1/hello", {
      method: "POST",
      body: { userAgent: self.navigator?.userAgent || "flickctx-extension" },
    });
    await pushContext();
    const poll = await bridge("/v1/poll");
    for (const cmd of poll.commands || []) {
      await handleCommand(cmd);
    }
    await chrome.action.setBadgeText({ text: "on" });
    await chrome.action.setBadgeBackgroundColor({ color: "#0f766e" });
  } catch {
    try {
      await chrome.action.setBadgeText({ text: "off" });
      await chrome.action.setBadgeBackgroundColor({ color: "#666" });
    } catch {
      /* ignore */
    }
  }
}

function startPolling() {
  if (pollTimer) return;
  tick();
  pollTimer = setInterval(tick, POLL_MS);
}

chrome.runtime.onInstalled.addListener(startPolling);
chrome.runtime.onStartup.addListener(startPolling);
startPolling();

chrome.tabs.onActivated.addListener(() => {
  pushContext().catch(() => {});
});
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.status === "complete" || change.url) {
    pushContext().catch(() => {});
  }
});
