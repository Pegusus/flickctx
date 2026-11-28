/**
 * Flickctx content script — inspect DOM under a screen mark, Set-of-Marks snapshot,
 * highlight by ref or CSS selector, optional click.
 */
(function () {
  const STYLE_ID = "flickctx-bridge-style";
  const LAYER_ID = "flickctx-bridge-layer";
  const BADGE_LAYER_ID = "flickctx-som-badges";
  const REF_ATTR = "data-flickctx-ref";

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = `
      #${LAYER_ID} { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
      #${BADGE_LAYER_ID} { position: fixed; inset: 0; pointer-events: none; z-index: 2147483645; }
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
      .flickctx-som-badge {
        position: fixed; min-width: 22px; height: 22px; padding: 0 5px;
        border-radius: 6px; font: 700 11px/22px system-ui,sans-serif;
        text-align: center; color: #0a0c0e;
        background: #2ec4a8; border: 1px solid rgba(0,0,0,.35);
        box-shadow: 0 2px 8px rgba(0,0,0,.35); pointer-events: none;
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

  function clearBadges() {
    const layer = document.getElementById(BADGE_LAYER_ID);
    if (layer) layer.innerHTML = "";
    document.querySelectorAll(`[${REF_ATTR}]`).forEach((el) => {
      el.removeAttribute(REF_ATTR);
    });
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
    const sx = window.screenX ?? window.screenLeft ?? 0;
    const sy = window.screenY ?? window.screenTop ?? 0;
    const chromeH = Math.max(0, (window.outerHeight || 0) - (window.innerHeight || 0));
    const dpr = window.devicePixelRatio || 1;
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

    const ignore = new Set([LAYER_ID, STYLE_ID, BADGE_LAYER_ID]);
    for (const el of stack) {
      if (!el || ignore.has(el.id)) continue;
      if (el.closest && el.closest(`#${LAYER_ID},#${BADGE_LAYER_ID}`)) continue;
      if (el === document.documentElement || el === document.body) continue;
      return el;
    }
    return stack[0] || null;
  }

  function describe(el, ref) {
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
    const out = {
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
    if (ref) out.ref = ref;
    return out;
  }

  function isInteractive(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName.toLowerCase();
    if (["a", "button", "input", "select", "textarea", "summary"].includes(tag)) return true;
    const role = (el.getAttribute("role") || "").toLowerCase();
    if (["button", "link", "menuitem", "tab", "checkbox", "radio"].includes(role)) return true;
    if (el.hasAttribute("onclick") || el.hasAttribute("href")) return true;
    return false;
  }

  function collectSomCandidates(limit = 24) {
    const seen = new Set();
    const out = [];
    const nodes = document.querySelectorAll(
      "a,button,input,select,textarea,[role='button'],[role='link'],[role='menuitem'],[role='tab'],[onclick]"
    );
    for (const el of nodes) {
      if (!el || seen.has(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      seen.add(el);
      out.push(el);
      if (out.length >= limit) break;
    }
    return out;
  }

  function paintBadges(entries) {
    ensureStyle();
    let layer = document.getElementById(BADGE_LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = BADGE_LAYER_ID;
      document.documentElement.appendChild(layer);
    }
    layer.innerHTML = "";
    for (const { el, ref } of entries) {
      const r = el.getBoundingClientRect();
      const badge = document.createElement("div");
      badge.className = "flickctx-som-badge";
      badge.textContent = ref.replace(/^e/i, "");
      badge.style.left = `${Math.max(0, Math.round(r.left))}px`;
      badge.style.top = `${Math.max(0, Math.round(r.top - 24))}px`;
      layer.appendChild(badge);
    }
  }

  function snapshotSom({ showBadges = false, screenRect } = {}) {
    clearBadges();
    const client = screenRect ? screenToClient(screenRect) : null;
    const seeds = collectSomCandidates(32);
    const elements = [];
    const stamped = [];
    let idx = 0;
    for (const el of seeds) {
      if (client) {
        const r = el.getBoundingClientRect();
        const overlaps =
          r.right >= client.x &&
          r.left <= client.x + client.w &&
          r.bottom >= client.y &&
          r.top <= client.y + client.h;
        if (!overlaps && !isInteractive(el)) continue;
      }
      idx += 1;
      const ref = `e${idx}`;
      el.setAttribute(REF_ATTR, ref);
      stamped.push({ el, ref });
      const d = describe(el, ref);
      if (d) elements.push(d);
      if (elements.length >= 20) break;
    }
    if (showBadges === true) {
      paintBadges(stamped);
    }
    return {
      ok: true,
      url: location.href,
      title: document.title,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      clientRect: client,
      elements,
      som: true,
      showBadges: showBadges === true,
    };
  }

  function resolveTarget({ ref, selector } = {}) {
    let el = null;
    const r = String(ref || "").trim();
    if (r) {
      const key = /^e\d+$/i.test(r) ? r.toLowerCase() : r;
      el = document.querySelector(`[${REF_ATTR}="${CSS.escape(key)}"]`);
    }
    if (!el && selector) {
      try {
        el = document.querySelector(selector);
      } catch {
        el = null;
      }
    }
    return el;
  }

  function inspect(screenRect) {
    clearBadges();
    const client = screenToClient(screenRect || {});
    const el = elementFromRegion(client);
    const primary = describe(el);
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
      const el = resolveTarget(t);
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

  function clickTarget(payload) {
    const target =
      payload && typeof payload === "object"
        ? payload
        : { selector: payload };
    const el = resolveTarget(target);
    if (!el) return { ok: false, error: "element not found" };
    el.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const r = el.getBoundingClientRect();
    highlight([{ ...target, label: "Click" }]);
    try {
      el.focus?.();
      el.click?.();
    } catch (err) {
      return { ok: false, error: err.message || String(err) };
    }
    return {
      ok: true,
      ref: target.ref || "",
      selector: target.selector || cssPath(el),
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
      if (msg.type === "som") {
        sendResponse(
          snapshotSom({
            screenRect: msg.screenRect,
            showBadges: msg.showBadges === true,
          })
        );
        return;
      }
      if (msg.type === "highlight") {
        sendResponse(highlight(msg.targets));
        return;
      }
      if (msg.type === "click") {
        sendResponse(
          clickTarget({
            ref: msg.ref,
            selector: msg.selector || msg.payload?.selector,
          })
        );
        return;
      }
      if (msg.type === "clear") {
        clearHighlights();
        clearBadges();
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