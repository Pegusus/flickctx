import { HOW_VIDEO_URL } from "@/lib/media";
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
            Claude Code session that already has your configs and context.
          </p>
        </Reveal>

        {HOW_VIDEO_URL ? (
          <Reveal>
            <figure className={styles.pitch}>
              <video
                className={styles.pitchVideo}
                src={HOW_VIDEO_URL}
                controls
                playsInline
                preload="metadata"
                title="Flickctx product pitch"
              >
                Your browser does not support embedded video.
              </video>
              <figcaption className={styles.pitchCap}>
                Mark a region → route into your session → keep chatting.
              </figcaption>
            </figure>
          </Reveal>
        ) : null}

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
                Claude Code or OpenCode. Pick a saved session or + New.
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

export function UseCasesSection() {
  return (
    <section className="section" id="use-cases">
      <div className="container">
        <Reveal>
          <p className="kicker">Use cases</p>
          <h2 className="sec-title">When a screenshot needs your real session.</h2>
          <p className="sec-lead">
            Flickctx is built for the moments you are already inside Claude Code
            or OpenCode and need to point at live UI — not start a separate chat.
          </p>
        </Reveal>
        <Reveal cascade>
          <ul className={styles.useGrid}>
            <li>
              <h3>Incident triage</h3>
              <p>
                Mark a spike in CloudWatch, an error row in Datadog, or a
                latency chart in GCP. Route into the session debugging that
                service.
              </p>
            </li>
            <li>
              <h3>Code review context</h3>
              <p>
                Circle a diff or stack trace in the IDE. Continue in the Claude
                Code conversation that already knows the repo.
              </p>
            </li>
            <li>
              <h3>Dashboard walkthrough</h3>
              <p>
                Highlight a panel on any web UI. Ask follow-ups in OpenCode with
                the same model and MCP tools you configured there.
              </p>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export function ArchitectureSection() {
  return (
    <section className="section" id="architecture">
      <div className={`container ${styles.archWide}`}>
        <Reveal>
          <p className="kicker">Architecture</p>
          <h2 className="sec-title">How Flickctx works under the hood.</h2>
          <p className="sec-lead">
            An Electron main process owns floating windows over IPC. A local
            capture pipeline hands the mark to a session CLI bridge — Claude
            Code or OpenCode — and streams the reply back into the same chat
            window.
          </p>
          <ArchDiagram />
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
          <p className="kicker">Sessions</p>
          <h2 className="sec-title">Use the session you already opened.</h2>
          <p className="sec-lead">
            Pick the OpenCode or Claude Code session you already opened.
            Flickctx marks the screen and streams into that chat.
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
          <h2 className="sec-title">Clone and run from source.</h2>
          <p className="sec-lead">
            Have <code>opencode</code> or <code>claude</code> on PATH with
            sessions you want to route into, then start the Electron app.
          </p>
          <pre className={styles.installPre}>{`git clone https://github.com/Pegusus/flickctx.git
cd flickctx
npm install
npm start`}</pre>
          <p className={styles.installHint}>
            Route → Claude Code / OpenCode → session, then Mark.{" "}
            <kbd>⌘⇧F</kbd> / <kbd>Ctrl+Shift+F</kbd>.
          </p>
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