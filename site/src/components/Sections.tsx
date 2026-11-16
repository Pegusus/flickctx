import { Reveal } from "./Reveal";
import styles from "./Sections.module.css";

export function HowSection() {
  return (
    <section className="section" id="how">
      <div className="container">
        <Reveal>
          <p className="kicker">How it works</p>
          <h2 className="sec-title">Mark. Ask. Keep going.</h2>
          <p className="sec-lead">
            One hotkey. Freehand around what matters. Type any question —
            pricing, a diagram, a console, a stack trace. Same path every time.
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
                <h3>Ask</h3>
                <p>
                  Your question goes in verbatim. No per-question prompt tricks —
                  the model sees the pixels and reasons.
                </p>
              </div>
            </li>
            <li>
              <span className={styles.n}>03</span>
              <div>
                <h3>Chat</h3>
                <p>
                  Follow-ups stay on the same mark. Dig into the spike, compare
                  tabs, or pull the matching code from a local repo.
                </p>
              </div>
            </li>
          </ol>
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
          <p className="kicker light">Cross-tool incidents</p>
          <h2 className="sec-title">One incident. Two consoles. One answer.</h2>
          <p className="sec-lead light">
            CloudWatch says ACU is pegged. Datadog says payment timeouts.
            Flickctx is for the moment you need both marks in the same
            conversation — then a straight explanation of what connects them.
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

export function DesktopSection() {
  return (
    <section className="section quiet" id="macos">
      <div className="container">
        <Reveal>
          <div className={styles.narrow}>
            <p className="kicker">Desktop companion</p>
            <h2 className="sec-title">Electron overlay. Your API key. MIT.</h2>
            <p className="sec-lead">
              Runs locally. On macOS, grant Screen Recording to{" "}
              <strong>Electron</strong> in System Settings, then restart.
              Optional Cloudflare Worker proxy keeps the key off each laptop.
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
          <h2 className="sec-title">Install</h2>
          <pre className={styles.installPre}>{`git clone https://github.com/Pegusus/flickctx.git
cd flickctx && npm install
export ANTHROPIC_API_KEY=sk-ant-…
npx flickctx config --model claude-sonnet-4-5
npx flickctx config --search-roots "$HOME/code,$HOME/Projects"
npm start`}</pre>
          <p className={styles.hint}>
            Then <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd> — draw freehand, ask,
            keep chatting.
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
