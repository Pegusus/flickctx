"use client";

import { useEffect, useRef } from "react";
import styles from "./ArchDiagram.module.css";

export function ArchDiagram() {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add(styles.in);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(styles.in);
          io.unobserve(entry.target);
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure
      ref={ref}
      className={styles.figure}
      aria-label="Flickctx system architecture"
    >
      <div className={styles.stack}>
        {/* Layer: Electron UI */}
        <section className={`${styles.layer} ${styles.l1}`}>
          <header className={styles.layerHead}>
            <span className={styles.layerTag}>UI shell</span>
            <code>electron/</code>
          </header>
          <ul className={styles.mods}>
            <li>
              <code>main.js</code>
              <span>windows, tray, Spaces, Route state, IPC</span>
            </li>
            <li>
              <code>launcher.html</code>
              <span>Mark · Route · Chat · Quit bar</span>
            </li>
            <li>
              <code>overlay.html</code>
              <span>freehand mark overlay</span>
            </li>
            <li>
              <code>result.html</code>
              <span>chat, stream, Markdown</span>
            </li>
            <li>
              <code>preload.js</code>
              <span>safe bridge to Node</span>
            </li>
          </ul>
        </section>

        <div className={styles.arrow} aria-hidden>
          IPC · spawn · fs
        </div>

        {/* Layer: Core */}
        <section className={`${styles.layer} ${styles.l2}`}>
          <header className={styles.layerHead}>
            <span className={styles.layerTag}>Core</span>
            <code>src/</code>
          </header>
          <div className={styles.grid}>
            <div className={styles.card}>
              <h4>Capture</h4>
              <p>
                <code>capture.js</code> · <code>image.js</code> ·{" "}
                <code>frontmost.js</code>
              </p>
              <span>display shot → crop JPEG · context frame · app/URL hint</span>
            </div>
            <div className={styles.card}>
              <h4>Session router</h4>
              <p>
                <code>sessions.js</code>
              </p>
              <span>
                discover Claude / OpenCode sessions ·{" "}
                <code>sendToAgentSession</code> · stream JSON
              </span>
            </div>
            <div className={styles.card}>
              <h4>Built-in agent</h4>
              <p>
                <code>explain.js</code> · <code>tools.js</code> ·{" "}
                <code>skills.js</code>
              </p>
              <span>Messages API loop · vision · tools · on-demand skills</span>
            </div>
            <div className={styles.card}>
              <h4>Context</h4>
              <p>
                <code>context.js</code> · <code>repos.js</code> ·{" "}
                <code>config.js</code>
              </p>
              <span>ambient repos · Claude/OpenCode hints · ~/.config/flickctx</span>
            </div>
          </div>
        </section>

        <div className={styles.arrow} aria-hidden>
          process spawn · HTTPS
        </div>

        {/* Layer: Externals */}
        <section className={`${styles.layer} ${styles.l3}`}>
          <header className={styles.layerHead}>
            <span className={styles.layerTag}>Externals</span>
            <code>host machine · network</code>
          </header>
          <div className={styles.extRow}>
            <div className={styles.ext}>
              <strong>Claude Code CLI</strong>
              <code>claude -p --resume · stream-json</code>
              <span>uses that session’s auth / models</span>
            </div>
            <div className={styles.ext}>
              <strong>OpenCode CLI</strong>
              <code>opencode run --session · --thinking</code>
              <span>uses that session’s auth / models</span>
            </div>
            <div className={styles.ext}>
              <strong>Anthropic API</strong>
              <code>explain.js</code> or <code>worker/</code> proxy
              <span>built-in only · key / login / FLICKCTX_PROXY_URL</span>
            </div>
          </div>
        </section>

        {/* Layer: Data */}
        <section className={`${styles.layer} ${styles.l4}`}>
          <header className={styles.layerHead}>
            <span className={styles.layerTag}>On disk</span>
            <code>local state</code>
          </header>
          <ul className={styles.disk}>
            <li>
              <code>skills/*.md</code>
              <span>thin product refs (aws, datadog, gcp, …)</span>
            </li>
            <li>
              <code>~/.config/flickctx</code>
              <span>API key, model, roots, preferred route</span>
            </li>
            <li>
              <code>~/.claude</code> · <code>~/.opencode</code>
              <span>session catalogs read by sessions.js</span>
            </li>
            <li>
              <code>tmp crop JPEG</code>
              <span>passed into CLI / vision request</span>
            </li>
          </ul>
        </section>
      </div>

      <figcaption className={styles.cap}>
        Repo map of{" "}
        <a
          href="https://github.com/Pegusus/flickctx"
          target="_blank"
          rel="noreferrer"
        >
          Pegusus/flickctx
        </a>
        . Session routes never need a Flickctx key; built-in does.
      </figcaption>
    </figure>
  );
}
