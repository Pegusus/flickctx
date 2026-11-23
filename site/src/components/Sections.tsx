import { Reveal } from "./Reveal";
import styles from "./Sections.module.css";

export function HowSection() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal stagger>
          <p className="kicker">How it works</p>
          <h2 className="sec-title">Mark. Route. Chat.</h2>
          <p className="sec-lead">
            Freehand around anything on screen — AWS, Datadog, GCP, your IDE —
            then continue in the OpenCode or Claude Code session that already
            has your configs.
          </p>
          <ol className={styles.steps}>
            <li>
              <span className={styles.n}>01</span>
              <div>
                <h3>Mark</h3>
                <p>
                  <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> or the Mark bar.
                  Draw freehand. The crop is the vision focus; the full display
                  stays as context.
                </p>
              </div>
            </li>
            <li>
              <span className={styles.n}>02</span>
              <div>
                <h3>Route</h3>
                <p>
                  Choose Claude Code or OpenCode, then a session (or + New), or
                  Flickctx built-in. Remembered until you change it.
                </p>
              </div>
            </li>
            <li>
              <span className={styles.n}>03</span>
              <div>
                <h3>Chat</h3>
                <p>
                  The mark + question stream into that session — thinking and
                  answers live in the Flickctx chat panel. Follow-ups stay on
                  the same mark and route.
                </p>
              </div>
            </li>
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export function SessionsSection() {
  return (
    <section className="section" id="sessions">
      <div className="container">
        <Reveal stagger>
          <div className={styles.split}>
            <div className={styles.copy}>
              <p className="kicker">Session routing</p>
              <h2 className="sec-title">
                No Flickctx API key. Use the session you already opened.
              </h2>
              <p className="sec-lead">
                After Mark, pick the tool first, then a recent session. The
                screenshot and question continue there — with that session’s
                provider, models, and project context.
              </p>
            </div>
            <ul className={styles.splitList}>
              <li>
                <strong>OpenCode</strong>
                <span>
                  <code>opencode run --session</code> + the marked image —
                  streams thinking and the answer back into Flickctx
                </span>
              </li>
              <li>
                <strong>Claude Code</strong>
                <span>
                  <code>claude -p --resume</code> into an existing conversation
                  (or + New session)
                </span>
              </li>
              <li>
                <strong>Flickctx built-in</strong>
                <span>
                  Local vision chat when you want a quick answer without an IDE
                  session (key, Claude login, or proxy)
                </span>
              </li>
            </ul>
          </div>
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
          <div className={styles.narrow}>
            <p className="kicker">Always findable</p>
            <h2 className="sec-title">
              Mark bar across Spaces. Menu bar. Dock. Quit.
            </h2>
            <p className="sec-lead">
              The floating Mark bar stays on every macOS Space. Route and Chat
              are one tap away. A titled Flickctx menu-bar item and Dock icon
              keep the app reachable — Quit from the bar when you’re done. On
              macOS, grant Screen Recording to <strong>Electron</strong>, then
              restart.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ConfigSection() {
  return (
    <section className="section" id="config">
      <div className="container">
        <Reveal stagger>
          <div className={styles.split}>
            <div className={styles.copy}>
              <p className="kicker">Optional built-in setup</p>
              <h2 className="sec-title">
                Session routes need no key. Built-in can use yours.
              </h2>
              <p className="sec-lead">
                OpenCode and Claude Code routes use whatever those tools already
                authenticate with. Flickctx built-in can use a Console key,
                Claude login, or a Worker proxy.
              </p>
            </div>
            <ul className={styles.splitList}>
              <li>
                <strong>API key</strong>
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
              <li>
                <strong>Repos & hotkey</strong>
                <span>
                  Search roots and <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> under{" "}
                  <code>~/.config/flickctx</code>
                </span>
              </li>
            </ul>
          </div>
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
          <p className="kicker">Get it running</p>
          <h2 className="sec-title">Install</h2>
          <pre className={styles.installPre}>{`git clone https://github.com/Pegusus/flickctx.git
cd flickctx && npm install
# OpenCode / Claude Code on PATH? skip the api-key line
npm start
# optional built-in:
# npx flickctx config --api-key sk-ant-… --model claude-sonnet-4-5`}</pre>
          <p className={styles.hint}>
            Tap <strong>Route</strong> → Claude Code / OpenCode → session, then
            Mark. Or use Flickctx built-in with a key / Claude login.{" "}
            <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> anytime.
          </p>
          <div className={styles.installActions}>
            <a
              className="btn"
              href="https://github.com/Pegusus/flickctx"
              target="_blank"
              rel="noreferrer"
            >
              Open on GitHub
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
