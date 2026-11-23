"use client";

import { useCallback, useEffect, useState } from "react";
import { IncidentDemo } from "./IncidentDemo";
import styles from "./Hero.module.css";

export function Hero() {
  const [caption, setCaption] = useState("");
  const [captionVisible, setCaptionVisible] = useState(true);

  const onCaption = useCallback((text: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCaption(text);
      setCaptionVisible(true);
      return;
    }
    setCaptionVisible(false);
    window.setTimeout(() => {
      setCaption(text);
      setCaptionVisible(true);
    }, 160);
  }, []);

  useEffect(() => {
    // ensure first caption paints visible
    setCaptionVisible(true);
  }, []);

  return (
    <section className={styles.hero} aria-label="Flickctx overview">
      <div className={styles.rail}>
        <p className={styles.brand}>
          Flick<span>ctx</span>
        </p>
        <p className={styles.line}>
          Mark anything on your screen. Continue in the OpenCode or Claude Code
          session you already have open.
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
        <p
          className={`${styles.caption} ${
            captionVisible ? "" : styles.captionFade
          }`}
        >
          {caption}
        </p>
      </div>
    </section>
  );
}
