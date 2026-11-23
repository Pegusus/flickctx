import { Reveal } from "./Reveal";
import styles from "./Sections.module.css";

export function HowSection() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal>
          <p className="kicker">How it works</p>
          <h2 className="sec-title">Mark. Route. Keep going.</h2>
          <p className="sec-lead">
            One hotkey. Freehand around what matters. Then continue in the
            OpenCode or Claude Code session that already has your configs — or
            stay on Flickctx built-in.
          </p>
          <ol className={styles.steps}>
            <li>
              <span className={styles.n}>01</span>
              <div>
                <h3>Mark</h3>
                <p>
                  <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> — draw freehand. The
                  crop becomes the primary vision focus; the full display stays
                  as context.
                </p>
              </div>
            </li>
            <li>
              <span className={styles.n}>02</span>
              <div>
                <h3>Route</h3>
                <p>
                  Choose Claude Code or OpenCode, then a session (uses that
                  tool’s keys/models), or Flickctx built-in. Remembered until
                  you change Route.
                </p>
              </div>
            </li>
            <li>
              <span className={styles.n}>03</span>
              <div>
                <h3>Chat</h3>
                <p>
                  Follow-ups stay on the same mark and the same agent session —
                  project context is already there.
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
        <Reveal>
          <div className={styles.split}>
            <div className={styles.copy}>
              <p className="kicker">Session routing</p>
              <h2 className="sec-title">
                No Flickctx API key? Use the OpenCode session you already opened.
              </h2>
              <p className="sec-lead">
                After a mark, pick Claude Code or OpenCode first, then a recent
                session. The screenshot + question continue there — with that
                session’s provider config and context.
              </p>
            </div>
            <ul className={styles.splitList}>
              <li>
                <strong>OpenCode</strong>
                <span>
                  <code>opencode run --session</code> + the marked image file —
                  your OpenCode auth/models apply
                </span>
              </li>
              <li>
                <strong>Claude Code</strong>
                <span>
                  <code>claude -p --resume</code> into an existing conversation
                </span>
              </li>
              <li>
                <strong>Flickctx built-in</strong>
                <span>
                  Overlay vision agent when you want a quick answer without an
                  IDE session (needs key or Claude login)
                </span>
              </li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function VisionSection() {
  return (
    <section className="section" id="vision">
      <div className="container">
        <Reveal>
          <div className={styles.split}>
            <div className={styles.copy}>
              <p className="kicker">Vision grounding</p>
              <h2 className="sec-title">
                It looks at what you marked — not a guess from the FAQ.
              </h2>
              <p className="sec-lead">
                Flickctx sends a JPEG crop of your mark, a wider context frame,
                and whatever frontmost-app hint it can detect. Answers stay tied
                to the pixels on screen.
              </p>
            </div>
            <ul className={styles.splitList}>
              <li>
                <strong>Primary crop</strong>
                <span>
                  Freehand → bounding box → resized JPEG for the vision API
                </span>
              </li>
              <li>
                <strong>Context frame</strong>
                <span>
                  Full display so the model sees surrounding UI and tabs
                </span>
              </li>
              <li>
                <strong>Frontmost hint</strong>
                <span>App name / browser URL when the OS can provide it</span>
              </li>
              <li>
                <strong>Multi-monitor</strong>
                <span>Overlay tracks the display you marked on</span>
              </li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function CrossSection() {
  return (
    <section className="section ink" id="cross">
      <div className="container">
        <Reveal>
          <p className="kicker light">Example walkthrough</p>
          <h2 className="sec-title">One mark can follow you across tabs.</h2>
          <p className="sec-lead light">
            The hero animation is just one story — AWS spike, Datadog timeouts,
            same chat. Flickctx itself is generic: whatever you circle becomes
            the question.
          </p>
          <div className={styles.flow} aria-hidden>
            <div className={`${styles.flowNode} ${styles.aws}`}>
              AWS · ACU spike
            </div>
            <div className={styles.flowJoin} />
            <div className={`${styles.flowNode} ${styles.dd}`}>
              Datadog · timeouts
            </div>
            <div className={styles.flowJoin} />
            <div className={`${styles.flowNode} ${styles.flick}`}>
              Flickctx · same incident
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SkillsSection() {
  return (
    <section className="section" id="skills">
      <div className="container">
        <Reveal>
          <div className={`${styles.split} ${styles.splitReverse}`}>
            <div className={styles.copy}>
              <p className="kicker">On-demand skills</p>
              <h2 className="sec-title">
                Product knowledge when it needs it — not in every chat.
              </h2>
              <p className="sec-lead">
                Lean skill files for AWS, Datadog, GCP, and more. The agent lists
                and reads them only when useful, so ambient context stays thin.
              </p>
            </div>
            <ul className={styles.skillRail} aria-label="Example skills">
              <li>aws</li>
              <li>datadog</li>
              <li>gcp</li>
              <li>kubernetes</li>
              <li>postgres</li>
              <li>github</li>
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function ToolsSection() {
  return (
    <section className="section" id="tools">
      <div className="container">
        <Reveal>
          <p className="kicker">Local + web tools</p>
          <h2 className="sec-title">From the mark to your repos and the web.</h2>
          <p className="sec-lead">
            When the screenshot isn’t enough, Flickctx can search the web, fetch
            a URL, or dig through the repos you configured — without leaving the
            chat on that mark.
          </p>
          <ul className={styles.toolGrid}>
            <li>
              <code>web_search</code>
              <span>Look up docs, status pages, release notes</span>
            </li>
            <li>
              <code>fetch_url</code>
              <span>Pull a specific page into the turn</span>
            </li>
            <li>
              <code>list_local_repos</code>
              <span>Ambient catalog of your search roots</span>
            </li>
            <li>
              <code>grep_local</code> / <code>read_local_file</code>
              <span>Find the handler that matches the error</span>
            </li>
            <li>
              <code>list_skills</code> / <code>read_skill</code>
              <span>Load product playbooks only when needed</span>
            </li>
            <li>
              <code>repo_details</code>
              <span>Orient on a checkout before diving in</span>
            </li>
          </ul>
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
          <div className={styles.split}>
            <div className={styles.copy}>
              <p className="kicker">Easily configurable</p>
              <h2 className="sec-title">
                Your key. Your model. Your coding agents.
              </h2>
              <p className="sec-lead">
                Point Flickctx at an API key and model in one CLI command. It
                also picks up Claude Code and OpenCode context from your machine
                when those sessions are around — no separate wiring.
              </p>
            </div>
            <ul className={styles.splitList}>
              <li>
                <strong>Any API key</strong>
                <span>
                  <code>ANTHROPIC_API_KEY</code>,{" "}
                  <code>flickctx config --api-key</code>, or a Cloudflare proxy
                  URL
                </span>
              </li>
              <li>
                <strong>Any model</strong>
                <span>
                  <code>flickctx config --model claude-sonnet-4-5</code> (or
                  whatever vision-capable model you use)
                </span>
              </li>
              <li>
                <strong>Claude Code</strong>
                <span>
                  Reads recent project / transcript context from{" "}
                  <code>~/.claude</code> when available
                </span>
              </li>
              <li>
                <strong>OpenCode</strong>
                <span>
                  Pulls OpenCode session / log context automatically when it
                  finds a local install
                </span>
              </li>
              <li>
                <strong>Repos & hotkey</strong>
                <span>
                  Set search roots, project path, and{" "}
                  <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> in config — edit JSON
                  under <code>~/.config/flickctx</code> anytime
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
    <section className="section" id="macos">
      <div className="container">
        <Reveal>
          <div className={styles.narrow}>
            <p className="kicker">Desktop companion</p>
            <h2 className="sec-title">Electron overlay. Runs on your machine. MIT.</h2>
            <p className="sec-lead">
              Local-first. On macOS, grant Screen Recording to{" "}
              <strong>Electron</strong> in System Settings, then restart. Keep
              keys on-box or route them through the optional Worker proxy.
            </p>
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
          <h2 className="sec-title">Install & configure</h2>
          <pre className={styles.installPre}>{`git clone https://github.com/Pegusus/flickctx.git
cd flickctx && npm install
# logged into Claude Code? skip the api-key line
npx flickctx config --api-key sk-ant-… --model claude-sonnet-4-5
npx flickctx config --search-roots "$HOME/code,$HOME/Projects"
npm start`}</pre>
          <p className={styles.hint}>
            Uses your Claude Code login automatically when no Console key is
            set. Or pass <code>--api-key</code> / <code>ANTHROPIC_API_KEY</code>.
            Local Claude Code / OpenCode context is detected too. Then{" "}
            <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> — draw, ask, keep chatting.
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
