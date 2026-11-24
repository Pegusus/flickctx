/**
 * Flickctx content script — inspect DOM under a screen mark,
 * highlight by CSS selector, optional click.
 */
(function () {
  const STYLE_ID = "flickctx-bridge-style";
  const LAYER_ID = "flickctx-bridge-layer";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${LAYER_ID} { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
      .flickctx-hl {
        position: fixed; border: 2px solid #2ec4a8; border-radius: 6px;
        box-shadow: 0 0 0 1px rgba(0,0,0,.35), 0 0 16px rgba(46,196,168,.45);
        background: rgba(46,196,168,.12); pointer-events: none;
      }
      .flickctx-hl-label {
        position: absolute; left: 0; top: -26px; max-width: 260px;
        padding: 3px 8px; border-radius: 6px; font: 500 12px/1.3 system-ui,sans-serif;
        background: rgba(16,18,20,.94); color: #e8f8f4;
        border: 1px solid rgba(46,196,168,.45); white-space: nowrap;
        overflow: hidden; text-overflow: ellipsis;
      }
    `;
    document.documentElement.appendChild(s);
  }

  function ensureLayer() {
    ensureStyle();
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      document.documentElement.appendChild(layer);
    }
    return layer;
  }

  function clearHighlights() {
    const layer = document.getElementById(LAYER_ID);
    if (layer) layer.innerHTML = "";
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    if (el.id && /^[a-zA-Z][\w-]*$/.test(el.id)) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let part = cur.tagName.toLowerCase();
      if (cur.id && /^[a-zA-Z][\w-]*$/.test(cur.id)) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const parent = cur.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          part += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }
      parts.unshift(part);
      cur = parent;
      if (cur && cur.tagName === "BODY") break;
    }
    return parts.join(" > ");
  }

  function screenToClient(screenRect) {
    // screenRect is in OS screen pixels (Electron). Approximate with window screen offset.
    const sx = window.screenX ?? window.screenLeft ?? 0;
    const sy = window.screenY ?? window.screenTop ?? 0;
    // Chrome UI chrome above the viewport (toolbar). Heuristic when unavailable.
    const chromeH = Math.max(0, (window.outerHeight || 0) - (window.innerHeight || 0));
    const dpr = window.devicePixelRatio || 1;
    // Electron often reports CSS-ish bounds already; try both CSS and device pixels.
    const left = Number(screenRect.x);
    const top = Number(screenRect.y);
    const width = Number(screenRect.width);
    const height = Number(screenRect.height);

    const asCss = {
      x: left - sx,
      y: top - sy - chromeH,
      w: width,
      h: height,
    };
    const asDevice = {
      x: left / dpr - sx,
      y: top / dpr - sy - chromeH,
      w: width / dpr,
      h: height / dpr,
    };
    // Prefer the rect that intersects the viewport more.
    function score(r) {
      const x1 = Math.max(0, r.x);
      const y1 = Math.max(0, r.y);
      const x2 = Math.min(window.innerWidth, r.x + r.w);
      const y2 = Math.min(window.innerHeight, r.y + r.h);
      return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    }
    return score(asCss) >= score(asDevice) ? asCss : asDevice;
  }

  function elementFromRegion(clientRect) {
    const cx = clientRect.x + clientRect.w / 2;
    const cy = clientRect.y + clientRect.h / 2;
    const stack =
      typeof document.elementsFromPoint === "function"
        ? document.elementsFromPoint(cx, cy)
        : [document.elementFromPoint(cx, cy)].filter(Boolean);

    const ignore = new Set([LAYER_ID, STYLE_ID]);
    for (const el of stack) {
      if (!el || ignore.has(el.id)) continue;
      if (el.closest && el.closest(`#${LAYER_ID}`)) continue;
      if (el === document.documentElement || el === document.body) continue;
      return el;
    }
    return stack[0] || null;
  }

  function describe(el) {
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 160);
    const aria = el.getAttribute("aria-label") || "";
    const role = el.getAttribute("role") || el.tagName.toLowerCase();
    const href = el.href || el.getAttribute("href") || "";
    const name =
      el.getAttribute("name") ||
      el.getAttribute("data-testid") ||
      el.getAttribute("data-test") ||
      "";
    return {
      selector: cssPath(el),
      tag: el.tagName.toLowerCase(),
      role,
      text,
      aria,
      href: String(href).slice(0, 300),
      name,
      rect: {
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
      },
    };
  }

  function inspect(screenRect) {
    const client = screenToClient(screenRect || {});
    const el = elementFromRegion(client);
    const primary = describe(el);
    // Also sample nearby clickable candidates inside the mark
    const candidates = [];
    if (el) {
      const clickable = el.closest
        ? el.closest("a,button,[role='button'],input,select,textarea,[onclick]")
        : null;
      if (clickable && clickable !== el) {
        const d = describe(clickable);
        if (d) candidates.push(d);
      }
    }
    if (primary) candidates.unshift(primary);
    // dedupe by selector
    const seen = new Set();
    const unique = [];
    for (const c of candidates) {
      if (!c?.selector || seen.has(c.selector)) continue;
      seen.add(c.selector);
      unique.push(c);
    }
    return {
      ok: true,
      url: location.href,
      title: document.title,
      clientRect: client,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      elements: unique.slice(0, 5),
    };
  }

  function highlight(targets) {
    clearHighlights();
    const layer = ensureLayer();
    const list = [].concat(targets || []);
    let count = 0;
    for (const t of list) {
      let el = null;
      if (t.selector) {
        try {
          el = document.querySelector(t.selector);
        } catch {
          el = null;
        }
      }
      if (!el) continue;
      const r = el.getBoundingClientRect();
      const box = document.createElement("div");
      box.className = "flickctx-hl";
      box.style.left = `${Math.round(r.left)}px`;
      box.style.top = `${Math.round(r.top)}px`;
      box.style.width = `${Math.max(8, Math.round(r.width))}px`;
      box.style.height = `${Math.max(8, Math.round(r.height))}px`;
      if (t.label) {
        const lab = document.createElement("div");
        lab.className = "flickctx-hl-label";
        lab.textContent = String(t.label).slice(0, 72);
        box.appendChild(lab);
      }
      layer.appendChild(box);
      count += 1;
    }
    return { ok: true, count };
  }

  function clickSelector(selector) {
    let el = null;
    try {
      el = document.querySelector(selector);
    } catch {
      return { ok: false, error: "invalid selector" };
    }
    if (!el) return { ok: false, error: "element not found" };
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    highlight([{ selector, label: "Click" }]);
    try {
      el.focus?.();
      el.click?.();
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    return {
      ok: true,
      selector,
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    };
  }

  function snapshot() {
    return {
      ok: true,
      url: location.href,
      title: document.title,
      viewport: { w: window.innerWidth, h: window.innerHeight },
    };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (!msg || !msg.type) {
        sendResponse({ ok: false, error: "bad message" });
        return;
      }
      if (msg.type === "inspect") {
        sendResponse(inspect(msg.screenRect));
        return;
      }
      if (msg.type === "highlight") {
        sendResponse(highlight(msg.targets));
        return;
      }
      if (msg.type === "click") {
        sendResponse(clickSelector(msg.selector));
        return;
      }
      if (msg.type === "clear") {
        clearHighlights();
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "snapshot") {
        sendResponse(snapshot());
        return;
      }
      sendResponse({ ok: false, error: "unknown type" });
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
    return true;
  });
})();
