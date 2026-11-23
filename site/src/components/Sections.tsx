import { ArchDiagram } from "./ArchDiagram";
import { Reveal } from "./Reveal";
import styles from "./Sections.module.css";

export function HowSection() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal>
          <p className="kicker">How it works</p>
          <h2 className="sec-title">Mark. Route. Chat.</h2>
          <p className="sec-lead">
            Circle what matters on any screen. Send it into the OpenCode or
            Claude Code session that already has your configs — or stay on
            Flickctx built-in.
          </p>
        </Reveal>
        <Reveal cascade>
          <ol className={styles.steps}>
            <li>
              <h3>Mark</h3>
              <p>
                <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> or the Mark bar. Draw
                freehand. Crop is the focus; the full display stays as context.
              </p>
            </li>
            <li>
              <h3>Route</h3>
              <p>
                Claude Code, OpenCode, or Flickctx. Pick a session or + New.
                Remembered until you change it.
              </p>
            </li>
            <li>
              <h3>Chat</h3>
              <p>
                Thinking and answers stream into the panel. Follow-ups stay on
                the same mark and route.
              </p>
            </li>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <section className="section" id="architecture">
      <div className="container">
        <Reveal>
          <p className="kicker">Architecture</p>
          <h2 className="sec-title">How the repo is wired.</h2>
          <p className="sec-lead">
            Four layers: Electron UI, Node core under <code>src/</code>, host
            CLIs / Anthropic, and local state. Session routing and built-in
            vision are separate deliver paths from the same capture pipeline.
          </p>
          <ArchDiagram />
          <p className={styles.archLink}>
            Full write-up in{" "}
            <a
              href="https://github.com/Pegusus/flickctx/blob/main/ARCHITECTURE.md"
              target="_blank"
              rel="noreferrer"
            >
              ARCHITECTURE.md
            </a>
            .
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function SessionsSection() {
  return (
    <section className="section" id="sessions">
      <div className="container">
        <Reveal>
          <p className="kicker">Session routing</p>
          <h2 className="sec-title">Use the session you already opened.</h2>
          <p className="sec-lead">
            No Flickctx API key for OpenCode or Claude Code routes — those
            sessions keep their own keys, models, and project context.
          </p>
        </Reveal>
        <Reveal cascade>
          <ul className={styles.splitList}>
            <li>
              <strong>OpenCode</strong>
              <span>
                <code>opencode run --session</code> with the marked image;
                thinking streams back into Flickctx
              </span>
            </li>
            <li>
              <strong>Claude Code</strong>
              <span>
                <code>claude -p --resume</code> into an existing conversation,
                or start + New
              </span>
            </li>
            <li>
              <strong>Flickctx built-in</strong>
              <span>
                Local vision chat with a Console key, Claude login, or proxy
              </span>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function DesktopSection() {
  return (
    <section className="section" id="desktop">
      <div className="container">
        <Reveal>
          <p className="kicker">Desktop</p>
          <h2 className="sec-title">Mark bar across Spaces. Menu bar. Quit.</h2>
          <p className="sec-lead">
            The Mark bar stays on every macOS Space. Route and Chat are one tap
            away. Grant Screen Recording to <strong>Electron</strong>, then
            restart.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

export function ConfigSection() {
  return (
    <section className="section" id="config">
      <div className="container">
        <Reveal>
          <p className="kicker">Built-in only</p>
          <h2 className="sec-title">Optional key and model.</h2>
          <p className="sec-lead">
            Session routes need nothing extra. For Flickctx built-in:
          </p>
          <ul className={styles.splitList}>
            <li>
              <strong>Key</strong>
              <span>
                <code>flickctx config --api-key</code> or{" "}
                <code>ANTHROPIC_API_KEY</code>
              </span>
            </li>
            <li>
              <strong>Model</strong>
              <span>
                <code>flickctx config --model claude-sonnet-4-5</code>
              </span>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function InstallSection() {
  return (
    <section className="section" id="install">
      <div className="container">
        <Reveal>
          <p className="kicker">Install</p>
          <h2 className="sec-title">Get running.</h2>
          <pre className={styles.installPre}>{`git clone https://github.com/Pegusus/flickctx.git
cd flickctx && npm install && npm start`}</pre>
          <p className={styles.hint}>
            Route → Claude Code / OpenCode → session, then Mark.{" "}
            <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd>.
          </p>
          <div className={styles.installActions}>
            <a
              className="btn"
              href="https://github.com/Pegusus/flickctx"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a
              className="btn quiet"
              href="https://github.com/Pegusus/flickctx/blob/main/ARCHITECTURE.md"
              target="_blank"
              rel="noreferrer"
            >
              Architecture
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.foot}>
      <span>MIT · Pegusus</span>
      <a
        href="https://github.com/Pegusus/flickctx"
        target="_blank"
        rel="noreferrer"
      >
        github.com/Pegusus/flickctx
      </a>
    </footer>
  );
}
