/**
 * Localhost bridge between Flickctx (Electron) and the Chrome extension.
 * Bind 127.0.0.1 only — not exposed on the LAN.
 *
 * Extension:
 *   POST /v1/hello
 *   POST /v1/context          — push active-tab snapshot
 *   GET  /v1/poll             — pull commands
 *   POST /v1/result           — command results
 *
 * Electron:
 *   getStatus / getLatestContext / inspectMark / highlight / click / clear
 */
const http = require("http");
const { EventEmitter } = require("events");

const DEFAULT_PORT = 19234;
const HOST = "127.0.0.1";

function now() {
  return Date.now();
}

function createBrowserBridge({ port = DEFAULT_PORT } = {}) {
  const bus = new EventEmitter();
  const state = {
    port,
    server: null,
    extension: {
      connected: false,
      lastSeen: 0,
      userAgent: "",
    },
    latestContext: null,
    commands: [],
    waiters: new Map(), // commandId → { resolve, reject, timer }
    seq: 0,
  };

  function json(res, status, body) {
    const data = JSON.stringify(body);
    res.writeHead(status, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, x-flickctx-bridge",
      "cache-control": "no-store",
    });
    res.end(data);
  }

  function readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        if (!raw) return resolve({});
        try {
          resolve(JSON.parse(raw));
        } catch (err) {
          reject(err);
        }
      });
      req.on("error", reject);
    });
  }

  function touchExtension(meta = {}) {
    state.extension.connected = true;
    state.extension.lastSeen = now();
    if (meta.userAgent) state.extension.userAgent = String(meta.userAgent);
  }

  function enqueue(type, payload = {}, { timeoutMs = 8000 } = {}) {
    const id = `cmd_${++state.seq}_${now()}`;
    const cmd = { id, type, payload, createdAt: now() };
    state.commands.push(cmd);
    // keep queue short
    if (state.commands.length > 20) state.commands.splice(0, state.commands.length - 20);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        state.waiters.delete(id);
        reject(new Error(`browser bridge timeout: ${type}`));
      }, timeoutMs);
      state.waiters.set(id, { resolve, reject, timer });
      bus.emit("command", cmd);
    });
  }

  function resolveCommand(id, result) {
    const waiter = state.waiters.get(id);
    if (!waiter) return false;
    clearTimeout(waiter.timer);
    state.waiters.delete(id);
    waiter.resolve(result || {});
    return true;
  }

  async function handle(req, res) {
    if (req.method === "OPTIONS") {
      return json(res, 204, {});
    }

    const url = new URL(req.url || "/", `http://${HOST}:${port}`);

    try {
      if (req.method === "GET" && url.pathname === "/v1/health") {
        return json(res, 200, {
          ok: true,
          extensionConnected: isExtensionFresh(),
          port: state.port,
        });
      }

      if (req.method === "POST" && url.pathname === "/v1/hello") {
        const body = await readBody(req);
        touchExtension(body);
        return json(res, 200, { ok: true, port: state.port });
      }

      if (req.method === "POST" && url.pathname === "/v1/context") {
        const body = await readBody(req);
        touchExtension(body);
        state.latestContext = {
          ...body,
          receivedAt: now(),
        };
        bus.emit("context", state.latestContext);
        return json(res, 200, { ok: true });
      }

      if (req.method === "GET" && url.pathname === "/v1/poll") {
        touchExtension();
        const cmds = state.commands.splice(0, state.commands.length);
        return json(res, 200, { commands: cmds });
      }

      if (req.method === "POST" && url.pathname === "/v1/result") {
        const body = await readBody(req);
        touchExtension();
        if (body?.id) resolveCommand(body.id, body);
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: "not found" });
    } catch (err) {
      return json(res, 400, { error: err.message || String(err) });
    }
  }

  function isExtensionFresh() {
    return (
      state.extension.connected && now() - state.extension.lastSeen < 15_000
    );
  }

  function start() {
    if (state.server) return Promise.resolve(state.port);
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        handle(req, res);
      });
      server.on("error", reject);
      server.listen(port, HOST, () => {
        state.server = server;
        state.port = port;
        resolve(port);
      });
    });
  }

  function stop() {
    for (const [, w] of state.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error("browser bridge stopped"));
    }
    state.waiters.clear();
    return new Promise((resolve) => {
      if (!state.server) return resolve();
      state.server.close(() => {
        state.server = null;
        resolve();
      });
    });
  }

  return {
    start,
    stop,
    port: () => state.port,
    isExtensionConnected: isExtensionFresh,
    getLatestContext: () => state.latestContext,
    getStatus: () => ({
      port: state.port,
      listening: Boolean(state.server),
      extensionConnected: isExtensionFresh(),
      lastSeen: state.extension.lastSeen || null,
      hasContext: Boolean(state.latestContext),
      url: state.latestContext?.url || null,
      title: state.latestContext?.title || null,
    }),
    inspectMark(screenRect) {
      if (!isExtensionFresh()) {
        return Promise.reject(new Error("Flickctx browser extension not connected"));
      }
      return enqueue("inspect", { screenRect }, { timeoutMs: 6000 });
    },
    highlight(targets) {
      if (!isExtensionFresh()) {
        return Promise.reject(new Error("Flickctx browser extension not connected"));
      }
      return enqueue("highlight", { targets: [].concat(targets || []) }, {
        timeoutMs: 5000,
      });
    },
    click(selector) {
      if (!isExtensionFresh()) {
        return Promise.reject(new Error("Flickctx browser extension not connected"));
      }
      return enqueue("click", { selector }, { timeoutMs: 5000 });
    },
    clearHighlights() {
      if (!isExtensionFresh()) return Promise.resolve({ ok: true, skipped: true });
      return enqueue("clear", {}, { timeoutMs: 3000 }).catch(() => ({ ok: false }));
    },
    on: bus.on.bind(bus),
  };
}

module.exports = {
  createBrowserBridge,
  DEFAULT_PORT,
  HOST,
};
