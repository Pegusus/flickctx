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
    setCaptionVisible(true);
  }, []);

  return (
    <section
      className={styles.hero}
      aria-label="Flickctx — mark screen, route to OpenCode or Claude Code"
    >
      <div className={styles.rail}>
        <p className={styles.brand}>
          Flick<span>ctx</span>
        </p>
        <h1 className={styles.headline}>
          Point at your screen. Route into the session you already have open.
        </h1>
        <p className={styles.line}>
          Circle charts, logs, or code on any display. Flickctx captures the
          mark and continues in your OpenCode or Claude Code session — with the
          models and project context already there.
        </p>

        <div className={styles.actions}>
          <a className="btn" href="#install">
            Install
          </a>
          <a
            className="btn quiet"
            href="https://github.com/Pegusus/flickctx"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <a className="btn quiet" href="#architecture">
            Architecture
          </a>
        </div>
      </div>

      <div
        className={styles.theater}
        aria-label="Demo: AWS RDS monitoring on a laptop, freehand mark, Flickctx chat with OpenCode"
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