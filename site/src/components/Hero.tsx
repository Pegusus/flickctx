"use client";

import { useCallback, useState } from "react";
import { IncidentDemo } from "./IncidentDemo";
import styles from "./Hero.module.css";

export function Hero() {
  const [caption, setCaption] = useState("");
  const onCaption = useCallback((text: string) => setCaption(text), []);

  return (
    <section className={styles.hero} aria-label="Flickctx overview">
      <div className={styles.rail}>
        <p className={styles.brand}>
          Flick<span>ctx</span>
        </p>
        <p className={styles.line}>
          Mark anything on your screen — AWS, Datadog, GCP, anywhere. Route into
          an OpenCode or Claude Code session (no Flickctx API key), or use
          built-in vision chat.
        </p>
        <div className={styles.actions}>
          <a
            className="btn"
            href="https://github.com/Pegusus/flickctx"
            target="_blank"
            rel="noreferrer"
          >
            Clone the repo
          </a>
          <a className="btn quiet" href="#install">
            Install
          </a>
        </div>
      </div>

      <div
        className={styles.theater}
        aria-label="Demo: mark AWS, Datadog, or GCP, then route into a session"
      >
        <div className={styles.stage}>
          <IncidentDemo onCaption={onCaption} />
        </div>
        <p className={styles.caption}>{caption}</p>
      </div>
    </section>
  );
}
