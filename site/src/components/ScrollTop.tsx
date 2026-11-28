"use client";

import { useEffect } from "react";

/**
 * Prevent refresh from restoring a mid-page or bottom scroll.
 * Keep hash deep-links working; enable smooth scroll after first paint.
 * Adds `js` on <html> so reveal animations hide content until `.in`.
 */
export function ScrollTop() {
  useEffect(() => {
    document.documentElement.classList.add("js");

    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }

    const hash = window.location.hash;
    if (hash && hash.length > 1) {
      const id = decodeURIComponent(hash.slice(1));
      const go = () => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ block: "start" });
      };
      requestAnimationFrame(() => requestAnimationFrame(go));
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    const ready = window.setTimeout(() => {
      document.documentElement.classList.add("is-ready");
    }, 50);

    return () => {
      window.clearTimeout(ready);
      document.documentElement.classList.remove("is-ready");
      document.documentElement.classList.remove("js");
    };
  }, []);

  return null;
}