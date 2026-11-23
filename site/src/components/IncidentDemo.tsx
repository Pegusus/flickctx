"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./IncidentDemo.module.css";

type Panel = "aws" | "dd" | "gcp" | "route";

type Step = {
  id: string;
  panel: Panel;
  caption: string;
  ms: number;
  mark: boolean;
  draw: boolean;
  box: boolean;
};

const STEPS: Step[] = [
  {
    id: "aws-show",
    panel: "aws",
    caption: "AWS Console · CloudWatch — mark the ACU spike.",
    ms: 1600,
    mark: false,
    draw: false,
    box: false,
  },
  {
    id: "aws-mark",
    panel: "aws",
    caption: "Mark AWS. Crop is the vision focus.",
    ms: 1800,
    mark: true,
    draw: true,
    box: true,
  },
  {
    id: "dd-show",
    panel: "dd",
    caption: "Datadog · Log Explorer — mark the error lines.",
    ms: 1600,
    mark: false,
    draw: false,
    box: false,
  },
  {
    id: "dd-mark",
    panel: "dd",
    caption: "Mark Datadog. Same hotkey, any UI.",
    ms: 1800,
    mark: true,
    draw: true,
    box: true,
  },
  {
    id: "gcp-show",
    panel: "gcp",
    caption: "Google Cloud · Monitoring — mark the latency chart.",
    ms: 1600,
    mark: false,
    draw: false,
    box: false,
  },
  {
    id: "gcp-mark",
    panel: "gcp",
    caption: "Mark GCP. Then route into a session you already have.",
    ms: 1800,
    mark: true,
    draw: true,
    box: true,
  },
  {
    id: "route",
    panel: "route",
    caption: "Route → OpenCode or Claude Code → session. No Flickctx API key.",
    ms: 3200,
    mark: false,
    draw: false,
    box: false,
  },
];

const DD_LOGS = [
  { lvl: "info", text: "checkout.session started request_id=8f2a", err: false },
  { lvl: "error", text: "failed to get response in time host=payments-db", err: true },
  { lvl: "error", text: "db timeout after 5000ms · FOR UPDATE", err: true },
  { lvl: "error", text: "ACU limit exceeded · aurora capacity", err: true },
  { lvl: "warn", text: "retrying payment authorize attempt=2", err: false },
];

function IconAws({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FF9900"
        d="M6.8 16.4c2.2 1.6 5.4 2.5 8.2 2.5 2.5 0 4.7-.6 6.4-1.9.3-.2.1-.5-.2-.4-2.5 1.1-5.7 1.7-8.4 1.7-3.4 0-6.9-.9-9.4-2.5-.4-.2-.7.2-.3.6.1 0 .1 0 .2 0z"
      />
      <path
        fill="#FF9900"
        d="M18.9 14.9c.3-.4-.2-.7-.6-.5-1.5.7-4.9.9-7.1.5-.8-.2-1.5-.4-2-.7-.3-.1-.6.2-.3.5 1.3 1.8 5.1 2.3 8.1 1.4.6-.2 1.3-.6 1.9-1.2z"
      />
      <path
        fill="#252F3E"
        d="M13.2 4.2 8.1 5.6c-.3.1-.4.3-.4.5v8.1c0 .2.2.4.5.3l1.4-.4c.2-.1.4-.3.4-.5V7.3l3.1-.8v7.5c0 .2.2.4.5.3l1.4-.4c.2-.1.4-.3.4-.5V4.7c0-.3-.3-.5-.7-.5z"
      />
    </svg>
  );
}

function IconDd({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <rect width="24" height="24" rx="5" fill="#632CA6" />
      <path
        fill="#fff"
        d="M7.2 7.1h2.2v9.8H7.2V7.1zm3.6 0h2.3c2.6 0 4.3 1.5 4.3 3.8 0 2.4-1.8 3.9-4.4 3.9h-2.2V7.1zm2.2 5.8c1.3 0 2.1-.8 2.1-2s-.8-1.9-2.1-1.9h-.1v3.9h.1z"
      />
    </svg>
  );
}

function IconGcp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12.2 3.2 6.6 6.4v3.2l5.6-3.2 5.5 3.2V6.4L12.2 3.2z"
      />
      <path
        fill="#4285F4"
        d="M17.7 9.6v4.8l-5.5 3.2v3.2l5.5-3.2 2.8-1.6V11.2l-2.8-1.6z"
      />
      <path
        fill="#FBBC04"
        d="M6.6 14.4v-4.8l-2.8 1.6v6.4l2.8 1.6 5.5 3.2v-3.2L6.6 14.4z"
      />
      <path fill="#34A853" d="M6.6 9.6 12.2 6.4l5.5 3.2-5.5 3.2-5.6-3.2z" />
    </svg>
  );
}

export function IncidentDemo({
  onCaption,
}: {
  onCaption: (text: string) => void;
}) {
  const [step, setStep] = useState<Step>(STEPS[0]);
  const reduceRef = useRef(false);
  const idxRef = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceRef.current = reduce.matches;
  }, []);

  useEffect(() => {
    onCaption(step.caption);
  }, [step, onCaption]);

  useEffect(() => {
    if (reduceRef.current) {
      setStep(STEPS[STEPS.length - 1]);
      return;
    }
    let cancelled = false;
    let timer = 0;
    const tick = () => {
      if (cancelled) return;
      const next = STEPS[idxRef.current];
      setStep(next);
      idxRef.current = (idxRef.current + 1) % STEPS.length;
      timer = window.setTimeout(tick, next.ms);
    };
    tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const demoClass = [
    styles.demo,
    step.draw ? styles.drawing : "",
    step.mark ? styles.drawn : "",
    step.box ? styles.boxed : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={demoClass}>
      <div className={styles.tabs} role="tablist" aria-label="Example screens">
        <div
          className={`${styles.tab} ${step.panel === "aws" ? styles.tabOn : ""}`}
        >
          <IconAws className={styles.icon} />
          <span className={styles.tabFull}>AWS Console</span>
          <span className={styles.tabShort}>AWS</span>
        </div>
        <div
          className={`${styles.tab} ${step.panel === "dd" ? styles.tabOn : ""}`}
        >
          <IconDd className={styles.icon} />
          <span className={styles.tabFull}>Datadog</span>
          <span className={styles.tabShort}>DD</span>
        </div>
        <div
          className={`${styles.tab} ${step.panel === "gcp" ? styles.tabOn : ""}`}
        >
          <IconGcp className={styles.icon} />
          <span className={styles.tabFull}>Google Cloud</span>
          <span className={styles.tabShort}>GCP</span>
        </div>
        <div
          className={`${styles.tab} ${
            step.panel === "route" ? styles.tabOn : ""
          }`}
        >
          <i className={styles.flickDot} />
          Flickctx
        </div>
      </div>

      <div className={styles.viewport}>
        <div className={styles.stagePane}>
          {/* AWS CloudWatch */}
          <div
            className={`${styles.scene} ${styles.awsScene} ${
              step.panel === "aws" ? styles.sceneOn : styles.sceneOff
            }`}
          >
            <aside className={styles.awsNav}>
              <div className={styles.awsBrand}>
                <IconAws className={styles.iconSm} />
                <span>console</span>
              </div>
              <p>CloudWatch</p>
              <p>RDS</p>
              <p className={styles.awsNavOn}>Metrics</p>
              <p>Alarms</p>
            </aside>
            <div className={styles.awsMain}>
              <header className={styles.awsTop}>
                <strong>ACUUtilization</strong>
                <span>payments-db · us-east-1 · 15m</span>
              </header>
              <div className={styles.awsGrid}>
                <div className={styles.awsCard}>
                  <div className={styles.awsLbl}>ACU utilization</div>
                  <div className={styles.awsVal}>97%</div>
                  <div className={styles.awsSpark} aria-hidden>
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </div>
                </div>
                <div className={styles.awsSide}>
                  <div className={styles.awsCard}>
                    <div className={styles.awsLbl}>CPU</div>
                    <div className={styles.awsValSm}>91%</div>
                  </div>
                  <div className={styles.awsCard}>
                    <div className={styles.awsLbl}>Connections</div>
                    <div className={styles.awsValSm}>186 / 200</div>
                  </div>
                  <div className={styles.awsCard}>
                    <div className={styles.awsLbl}>Status</div>
                    <div className={`${styles.awsValSm} ${styles.awsBad}`}>
                      ACU limit
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Datadog Log Explorer */}
          <div
            className={`${styles.scene} ${styles.ddScene} ${
              step.panel === "dd" ? styles.sceneOn : styles.sceneOff
            }`}
          >
            <header className={styles.ddTop}>
              <IconDd className={styles.iconSm} />
              <strong>Log Explorer</strong>
              <span className={styles.ddPill}>Logs</span>
              <span className={styles.ddFilter}>service:payments-api</span>
              <span className={styles.ddFilter}>status:error</span>
            </header>
            <div className={styles.ddLogs}>
              {DD_LOGS.map((log, i) => (
                <div
                  key={i}
                  className={`${styles.ddRow} ${log.err ? styles.ddErr : ""} ${
                    step.mark && log.err ? styles.ddHl : ""
                  }`}
                >
                  <span className={styles.ddTs}>14:12:0{i}</span>
                  <span className={styles.ddLvl}>{log.lvl}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GCP Monitoring */}
          <div
            className={`${styles.scene} ${styles.gcpScene} ${
              step.panel === "gcp" ? styles.sceneOn : styles.sceneOff
            }`}
          >
            <aside className={styles.gcpNav}>
              <div className={styles.gcpBrand}>
                <IconGcp className={styles.iconSm} />
                <span>Google Cloud</span>
              </div>
              <p>APIs & Services</p>
              <p className={styles.gcpNavOn}>Monitoring</p>
              <p>Logging</p>
              <p>Trace</p>
            </aside>
            <div className={styles.gcpMain}>
              <header className={styles.gcpTop}>
                <strong>Request latency</strong>
                <span>payments-api · us-central1 · 1h</span>
              </header>
              <div className={styles.gcpChart} aria-hidden>
                <svg viewBox="0 0 400 120" preserveAspectRatio="none">
                  <polyline
                    fill="none"
                    stroke="#1a73e8"
                    strokeWidth="2.5"
                    points="0,90 40,85 80,88 120,70 160,72 200,40 240,28 280,22 320,18 360,20 400,16"
                  />
                  <polyline
                    fill="rgba(26,115,232,0.12)"
                    stroke="none"
                    points="0,120 0,90 40,85 80,88 120,70 160,72 200,40 240,28 280,22 320,18 360,20 400,16 400,120"
                  />
                </svg>
                <div className={styles.gcpStat}>
                  <span>p99</span>
                  <strong>4.8s</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Route panel */}
          <div
            className={`${styles.scene} ${styles.routeScene} ${
              step.panel === "route" ? styles.sceneOn : styles.sceneOff
            }`}
          >
            <p className={styles.routeKicker}>Route</p>
            <h3 className={styles.routeTitle}>Continue in a session</h3>
            <ul className={styles.routeList}>
              <li className={styles.routeOn}>
                <span>OpenCode</span>
                <em>payments-incident · ses_8f2a</em>
              </li>
              <li>
                <span>Claude Code</span>
                <em>checkout-debug</em>
              </li>
              <li>
                <span>Flickctx built-in</span>
                <em>vision chat</em>
              </li>
            </ul>
            <p className={styles.routeHint}>
              Uses that session’s keys, models, and context.
            </p>
          </div>

          <div className={styles.marks}>
            <svg viewBox="0 0 800 480" preserveAspectRatio="none">
              <path
                className={`${styles.stroke} ${
                  step.panel === "aws" && step.mark ? styles.strokeActive : ""
                }`}
                pathLength={1}
                d="M 300 150 C 360 120, 520 125, 560 170 C 590 210, 575 300, 520 330 C 430 370, 310 355, 275 290 C 250 245, 255 185, 300 150 Z"
              />
              <rect
                className={`${styles.bbox} ${
                  step.panel === "aws" && step.box ? styles.bboxActive : ""
                }`}
                x="260"
                y="115"
                width="340"
                height="240"
              />
              <path
                className={`${styles.stroke} ${
                  step.panel === "dd" && step.mark ? styles.strokeActive : ""
                }`}
                pathLength={1}
                d="M 90 130 C 140 105, 650 100, 710 135 C 735 170, 720 250, 660 270 C 400 300, 160 285, 100 245 C 75 215, 65 160, 90 130 Z"
              />
              <rect
                className={`${styles.bbox} ${
                  step.panel === "dd" && step.box ? styles.bboxActive : ""
                }`}
                x="70"
                y="100"
                width="660"
                height="185"
              />
              <path
                className={`${styles.stroke} ${
                  step.panel === "gcp" && step.mark ? styles.strokeActive : ""
                }`}
                pathLength={1}
                d="M 250 160 C 320 130, 560 125, 620 165 C 650 205, 640 290, 560 310 C 400 340, 270 325, 230 270 C 205 230, 210 185, 250 160 Z"
              />
              <rect
                className={`${styles.bbox} ${
                  step.panel === "gcp" && step.box ? styles.bboxActive : ""
                }`}
                x="210"
                y="120"
                width="440"
                height="210"
              />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
