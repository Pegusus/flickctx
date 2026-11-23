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
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure
      ref={ref}
      className={styles.figure}
      aria-label="Flickctx technical design"
    >
      <svg
        className={styles.svg}
        viewBox="0 0 880 640"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Flickctx technical design</title>
        <desc id="arch-desc">
          Electron main process orchestrates floating windows over IPC, runs a
          capture pipeline, then delivers either through a session CLI bridge or
          a built-in vision agent with local tools.
        </desc>

        {/* Wires */}
        <g className={styles.wire} fill="none" strokeWidth="1.2">
          {/* main → windows */}
          <path d="M110 118 V148" pathLength={1} />
          <path d="M290 118 V148" pathLength={1} />
          <path d="M470 118 V148" pathLength={1} />
          <path d="M690 118 V148" pathLength={1} />
          <path d="M110 118 H690" pathLength={1} />
          {/* windows → capture */}
          <path d="M290 212 V240" pathLength={1} />
          <path d="M440 280 V308" pathLength={1} />
          {/* capture → fork */}
          <path d="M220 380 V408" pathLength={1} />
          <path d="M660 380 V408" pathLength={1} />
          <path d="M220 394 H660" pathLength={1} />
          {/* engines → externals */}
          <path d="M220 508 V536" pathLength={1} />
          <path d="M660 508 V536" pathLength={1} />
          {/* stream back to result */}
          <path
            d="M470 212 V228 H820 V470 H780"
            pathLength={1}
            className={styles.stream}
          />
        </g>

        {/* Labels on wires */}
        <g className={styles.annot}>
          <text x="440" y="136" textAnchor="middle">
            IPC
          </text>
          <text
            x="830"
            y="300"
            textAnchor="middle"
            transform="rotate(90 830 300)"
          >
            result:stream
          </text>
        </g>

        {/* Main process */}
        <g className={`${styles.box} ${styles.n1}`}>
          <rect x="40" y="24" width="800" height="94" rx="6" />
          <text x="60" y="52" className={styles.h}>
            Electron main process
          </text>
          <text x="60" y="74" className={styles.p}>
            Window manager · Route state · Mark orchestration · Conversation memory
          </text>
          <text x="60" y="94" className={styles.p}>
            Hotkey ⌘⇧F · Menu-bar tray · Spaces pinning · Screen permission
          </text>
        </g>

        {/* Renderer windows */}
        <g className={`${styles.box} ${styles.n2}`}>
          <rect x="40" y="148" width="140" height="64" rx="5" />
          <text x="110" y="174" textAnchor="middle" className={styles.h}>
            Launcher
          </text>
          <text x="110" y="194" textAnchor="middle" className={styles.p}>
            Mark · Route · Chat
          </text>
        </g>
        <g className={`${styles.box} ${styles.n2}`}>
          <rect x="200" y="148" width="180" height="64" rx="5" />
          <text x="290" y="174" textAnchor="middle" className={styles.h}>
            Overlay × displays
          </text>
          <text x="290" y="194" textAnchor="middle" className={styles.p}>
            freehand → bounding box
          </text>
        </g>
        <g className={`${styles.boxAccent} ${styles.n2}`}>
          <rect x="400" y="148" width="140" height="64" rx="5" />
          <text x="470" y="174" textAnchor="middle" className={styles.h}>
            Chat window
          </text>
          <text x="470" y="194" textAnchor="middle" className={styles.p}>
            think · answer · MD
          </text>
        </g>
        <g className={`${styles.box} ${styles.n2}`}>
          <rect x="560" y="148" width="140" height="64" rx="5" />
          <text x="630" y="174" textAnchor="middle" className={styles.h}>
            Highlights
          </text>
          <text x="630" y="194" textAnchor="middle" className={styles.p}>
            click-through rings
          </text>
        </g>
        <g className={`${styles.box} ${styles.n2}`}>
          <rect x="720" y="148" width="120" height="64" rx="5" />
          <text x="780" y="174" textAnchor="middle" className={styles.h}>
            Tray
          </text>
          <text x="780" y="194" textAnchor="middle" className={styles.p}>
            menu bar
          </text>
        </g>

        {/* Capture pipeline */}
        <g className={`${styles.box} ${styles.n3}`}>
          <rect x="40" y="240" width="800" height="140" rx="6" />
          <text x="60" y="268" className={styles.h}>
            Capture pipeline
          </text>
          <text x="60" y="288" className={styles.p}>
            Always local. Same crop feeds both deliver engines.
          </text>

          <g className={styles.step}>
            <rect x="60" y="308" width="160" height="48" rx="4" />
            <text x="140" y="328" textAnchor="middle" className={styles.h}>
              1 · Screen
            </text>
            <text x="140" y="344" textAnchor="middle" className={styles.p}>
              full display PNG
            </text>
          </g>
          <g className={styles.step}>
            <rect x="250" y="308" width="160" height="48" rx="4" />
            <text x="330" y="328" textAnchor="middle" className={styles.h}>
              2 · Crop
            </text>
            <text x="330" y="344" textAnchor="middle" className={styles.p}>
              mark → JPEG ≤1600px
            </text>
          </g>
          <g className={styles.step}>
            <rect x="440" y="308" width="180" height="48" rx="4" />
            <text x="530" y="328" textAnchor="middle" className={styles.h}>
              3 · Environment
            </text>
            <text x="530" y="344" textAnchor="middle" className={styles.p}>
              frontmost app + URL
            </text>
          </g>
          <g className={styles.step}>
            <rect x="650" y="308" width="170" height="48" rx="4" />
            <text x="735" y="328" textAnchor="middle" className={styles.h}>
              4 · Context frame
            </text>
            <text x="735" y="344" textAnchor="middle" className={styles.p}>
              full display secondary
            </text>
          </g>
        </g>

        {/* Deliver engines */}
        <g className={`${styles.box} ${styles.n4}`}>
          <rect x="40" y="408" width="360" height="100" rx="6" />
          <text x="60" y="436" className={styles.h}>
            Session bridge
          </text>
          <text x="60" y="456" className={styles.p}>
            Discover Claude / OpenCode sessions
          </text>
          <text x="60" y="474" className={styles.p}>
            Spawn CLI · stream-json / --thinking
          </text>
          <text x="60" y="492" className={styles.p}>
            Uses that session’s keys &amp; models
          </text>
        </g>
        <g className={`${styles.box} ${styles.n4}`}>
          <rect x="480" y="408" width="360" height="100" rx="6" />
          <text x="500" y="436" className={styles.h}>
            Built-in vision agent
          </text>
          <text x="500" y="456" className={styles.p}>
            Messages API loop · crop + context
          </text>
          <text x="500" y="474" className={styles.p}>
            Tools: search · fetch · repos · grep · skills
          </text>
          <text x="500" y="492" className={styles.p}>
            Key · Claude login · or Worker proxy
          </text>
        </g>

        {/* Externals */}
        <g className={`${styles.boxMuted} ${styles.n5}`}>
          <rect x="40" y="536" width="360" height="72" rx="6" />
          <text x="60" y="566" className={styles.h}>
            Host CLIs
          </text>
          <text x="60" y="586" className={styles.p}>
            claude -p --resume · opencode run --session
          </text>
        </g>
        <g className={`${styles.boxMuted} ${styles.n5}`}>
          <rect x="480" y="536" width="360" height="72" rx="6" />
          <text x="500" y="566" className={styles.h}>
            Model endpoint
          </text>
          <text x="500" y="586" className={styles.p}>
            Anthropic API · optional Cloudflare Worker
          </text>
        </g>
      </svg>

      <figcaption className={styles.cap}>
        One capture pipeline, two deliver engines. Chat always streams back
        into the same result window over IPC.
      </figcaption>
    </figure>
  );
}
