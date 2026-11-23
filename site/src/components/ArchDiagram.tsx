import styles from "./ArchDiagram.module.css";

export function ArchDiagram() {
  return (
    <figure className={styles.figure} aria-label="Flickctx technical architecture">
      <svg
        className={styles.svg}
        viewBox="0 0 720 420"
        role="img"
        aria-labelledby="arch-title arch-desc"
      >
        <title id="arch-title">Flickctx architecture</title>
        <desc id="arch-desc">
          Mark bar and hotkey capture a crop, route to Claude Code, OpenCode, or
          Flickctx built-in, then stream answers into the chat panel.
        </desc>

        {/* connectors */}
        <g className={styles.wire} fill="none" strokeWidth="1.25">
          <path d="M360 58 V88" />
          <path d="M360 148 V178" />
          <path d="M200 238 V268" />
          <path d="M520 238 V268" />
          <path d="M200 328 H360 V348" />
          <path d="M520 328 H360" />
          {/* branch split */}
          <path d="M360 208 V218" />
          <path d="M200 218 H520" />
          <path d="M200 218 V238" />
          <path d="M520 218 V238" />
        </g>

        {/* nodes */}
        <g className={styles.node}>
          <rect x="250" y="16" width="220" height="42" rx="4" />
          <text x="360" y="35" className={styles.label}>
            Mark bar · tray · ⌘⇧F
          </text>
          <text x="360" y="50" className={styles.sub}>
            electron/launcher · overlay
          </text>
        </g>

        <g className={styles.node}>
          <rect x="220" y="88" width="280" height="60" rx="4" />
          <text x="360" y="112" className={styles.label}>
            Capture
          </text>
          <text x="360" y="130" className={styles.sub}>
            crop JPEG · full-display context · frontmost hint
          </text>
        </g>

        <g className={styles.node}>
          <rect x="220" y="178" width="280" height="40" rx="4" />
          <text x="360" y="203" className={styles.label}>
            Route · Claude · OpenCode · Flickctx
          </text>
        </g>

        <g className={styles.node}>
          <rect x="40" y="238" width="320" height="90" rx="4" />
          <text x="200" y="266" className={styles.label}>
            Session path
          </text>
          <text x="200" y="286" className={styles.sub}>
            src/sessions.js → sendToAgentSession
          </text>
          <text x="200" y="304" className={styles.code}>
            claude -p --resume · stream-json
          </text>
          <text x="200" y="318" className={styles.code}>
            opencode run --session · --thinking
          </text>
        </g>

        <g className={styles.node}>
          <rect x="360" y="238" width="320" height="90" rx="4" />
          <text x="520" y="266" className={styles.label}>
            Built-in path
          </text>
          <text x="520" y="286" className={styles.sub}>
            src/explain.js · Messages API
          </text>
          <text x="520" y="304" className={styles.code}>
            crop + context + tools + skills
          </text>
          <text x="520" y="318" className={styles.code}>
            key · Claude login · or Worker proxy
          </text>
        </g>

        <g className={styles.nodeAccent}>
          <rect x="220" y="348" width="280" height="52" rx="4" />
          <text x="360" y="372" className={styles.label}>
            Chat UI
          </text>
          <text x="360" y="388" className={styles.sub}>
            electron/result.html · stream thinking + answer
          </text>
        </g>
      </svg>
      <figcaption className={styles.cap}>
        Primary path uses the session’s own auth. Built-in is optional.
      </figcaption>
    </figure>
  );
}
