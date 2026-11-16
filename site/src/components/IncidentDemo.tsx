"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./IncidentDemo.module.css";

type Step = {
  id: string;
  tab: "aws" | "dd";
  caption: string;
  ms: number;
  spike: boolean;
  mark: "aws" | "dd" | null;
  draw: boolean;
  drawn: boolean;
  box: boolean;
  chat: boolean;
  hl: number[];
  flickTab?: boolean;
};

const STEPS: Step[] = [
  {
    id: "aws-calm",
    tab: "aws",
    caption: "AWS RDS · payments-db ACU looks normal…",
    ms: 1400,
    spike: false,
    mark: null,
    draw: false,
    drawn: false,
    box: false,
    chat: false,
    hl: [],
  },
  {
    id: "aws-spike",
    tab: "aws",
    caption: "Spike — ACU / CPU saturating under load.",
    ms: 1600,
    spike: true,
    mark: "aws",
    draw: true,
    drawn: false,
    box: false,
    chat: false,
    hl: [],
  },
  {
    id: "aws-box",
    tab: "aws",
    caption: "Mark the spike. Crop becomes primary vision focus.",
    ms: 1400,
    spike: true,
    mark: "aws",
    draw: false,
    drawn: true,
    box: true,
    chat: false,
    hl: [],
  },
  {
    id: "dd-open",
    tab: "dd",
    caption: "Same window · Datadog Logs for payments-api.",
    ms: 1500,
    spike: false,
    mark: null,
    draw: false,
    drawn: false,
    box: false,
    chat: false,
    hl: [],
  },
  {
    id: "dd-mark",
    tab: "dd",
    caption: "failed to get response in time · db timeout · ACU limit exceeded.",
    ms: 2000,
    spike: false,
    mark: "dd",
    draw: true,
    drawn: false,
    box: true,
    chat: false,
    hl: [1, 2, 3],
  },
  {
    id: "answer",
    tab: "dd",
    caption: "Ask once — Flickctx connects the AWS spike to the Datadog errors.",
    ms: 3800,
    spike: false,
    mark: "dd",
    draw: false,
    drawn: true,
    box: true,
    chat: true,
    hl: [1, 2, 3],
    flickTab: true,
  },
];

const LOGS = [
  {
    i: 0,
    ts: "14:12:01",
    lvl: "info",
    text: "checkout.session started request_id=8f2a",
    err: false,
  },
  {
    i: 1,
    ts: "14:12:08",
    lvl: "error",
    text: "failed to get response in time from db host=payments-db",
    err: true,
  },
  {
    i: 2,
    ts: "14:12:08",
    lvl: "error",
    text: "db timeout after 5000ms query=SELECT … FOR UPDATE",
    err: true,
  },
  {
    i: 3,
    ts: "14:12:09",
    lvl: "error",
    text: "ACU limit exceeded · throttled connections on aurora capacity",
    err: true,
  },
  {
    i: 4,
    ts: "14:12:10",
    lvl: "warn",
    text: "retrying payment authorize attempt=2",
    err: false,
  },
];

export function IncidentDemo({
  onCaption,
}: {
  onCaption: (text: string) => void;
}) {
  const [step, setStep] = useState<Step>(STEPS[0]);
  const [answer, setAnswer] = useState("");
  const [narrow, setNarrow] = useState(false);
  const reduceRef = useRef(false);
  const idxRef = useRef(0);

  const answerHtml = useMemo(
    () =>
      narrow
        ? "<em>payments-db</em> ACU limit (AWS) → timeouts in <em>payments-api</em> (Datadog). Scale ACU or shed load."
        : "Same incident: <em>payments-db</em> hit ACU limit (AWS) → Datadog shows timeouts in <em>payments-api</em>. Scale ACU or shed writer load.",
    [narrow]
  );

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setNarrow(mq.matches);
    sync();
    reduceRef.current = reduce.matches;
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    onCaption(step.caption);
  }, [step, onCaption]);

  useEffect(() => {
    if (!step.chat) {
      setAnswer("");
      return;
    }
    if (reduceRef.current) {
      setAnswer(answerHtml);
      return;
    }
    const plain = answerHtml.replace(/<[^>]+>/g, "");
    let i = 0;
    setAnswer("");
    const timer = window.setInterval(() => {
      i += 3;
      if (i >= plain.length) {
        window.clearInterval(timer);
        setAnswer(answerHtml);
      } else {
        setAnswer(plain.slice(0, i));
      }
    }, 24);
    return () => window.clearInterval(timer);
  }, [step.chat, step.id, answerHtml]);

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

  const acu = step.spike ? "97%" : "42%";
  const cpu = step.spike ? "91%" : "38%";
  const status = step.spike ? "ACU limit" : "Healthy";
  const demoClass = [
    styles.demo,
    step.draw ? styles.drawing : "",
    step.drawn ? styles.drawn : "",
    step.box ? styles.boxed : "",
    step.chat ? styles.chatOn : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={demoClass}>
      <div className={styles.tabs}>
        <div
          className={`${styles.tab} ${
            step.tab === "aws" || step.flickTab ? "" : ""
          } ${step.tab === "aws" ? styles.tabOn : ""}`}
        >
          <i className={`${styles.dot} ${styles.dotAws}`} />
          <span className={styles.tabFull}>AWS · RDS CloudWatch</span>
          <span className={styles.tabShort}>AWS</span>
        </div>
        <div className={`${styles.tab} ${step.tab === "dd" ? styles.tabOn : ""}`}>
          <i className={`${styles.dot} ${styles.dotDd}`} />
          <span className={styles.tabFull}>Datadog · Logs</span>
          <span className={styles.tabShort}>Datadog</span>
        </div>
        <div
          className={`${styles.tab} ${step.flickTab ? styles.tabOn : ""}`}
        >
          <i className={`${styles.dot} ${styles.dotFlick}`} />
          Flickctx
        </div>
      </div>

      <div className={styles.viewport}>
        <div className={styles.stagePane}>
          <div
            className={`${styles.scene} ${
              step.tab === "aws" ? styles.sceneOn : styles.sceneOff
            } ${step.spike ? styles.spike : ""}`}
          >
            <div className={styles.awsHead}>
              <strong>RDS · payments-db · ACUUtilization</strong>
              <span>us-east-1 · 15m</span>
            </div>
            <div className={styles.metrics}>
              <div className={styles.card}>
                <div className={styles.lbl}>ACU utilization</div>
                <div className={`${styles.val} ${step.spike ? styles.warn : ""}`}>
                  {acu}
                </div>
                <div className={styles.spark} aria-hidden>
                  <i /><i /><i /><i /><i /><i /><i /><i />
                </div>
              </div>
              <div className={styles.side}>
                <div className={styles.card}>
                  <div className={styles.lbl}>CPU</div>
                  <div className={styles.val}>{cpu}</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.lbl}>Connections</div>
                  <div className={styles.val}>186 / 200</div>
                </div>
                <div className={styles.card}>
                  <div className={styles.lbl}>Status</div>
                  <div className={`${styles.val} ${step.spike ? styles.bad : ""}`}>
                    {status}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${styles.scene} ${
              step.tab === "dd" ? styles.sceneOn : styles.sceneOff
            }`}
          >
            <div className={styles.ddBar}>
              <span className={styles.ddOn}>Logs</span>
              <span>service:payments-api</span>
              <span>status:error</span>
            </div>
            <div className={styles.logs}>
              {LOGS.map((log) => (
                <div
                  key={log.i}
                  className={`${styles.log} ${log.err ? styles.err : ""} ${
                    step.hl.includes(log.i) ? styles.hl : ""
                  }`}
                >
                  <span className={styles.ts}>{log.ts}</span>
                  <span className={styles.lvl}>{log.lvl}</span>
                  <span>{log.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.marks}>
            <svg viewBox="0 0 800 480" preserveAspectRatio="none">
              <path
                className={`${styles.stroke} ${
                  step.mark === "aws" ? styles.strokeActive : ""
                }`}
                pathLength={1}
                d="M 205 205 C 250 155, 365 148, 435 188 C 500 228, 508 305, 455 348 C 390 395, 275 385, 225 330 C 180 285, 168 248, 205 205 Z"
              />
              <rect
                className={`${styles.bbox} ${
                  step.mark === "aws" ? styles.bboxActive : ""
                }`}
                x="185"
                y="140"
                width="340"
                height="255"
              />
              <path
                className={`${styles.stroke} ${
                  step.mark === "dd" ? styles.strokeActive : ""
                }`}
                pathLength={1}
                d="M 115 140 C 160 122, 630 118, 690 145 C 715 175, 705 255, 655 275 C 390 300, 175 290, 125 250 C 100 220, 90 165, 115 140 Z"
              />
              <rect
                className={`${styles.bbox} ${
                  step.mark === "dd" ? styles.bboxActive : ""
                }`}
                x="95"
                y="112"
                width="640"
                height="180"
              />
            </svg>
          </div>
        </div>

        <div className={styles.chat}>
          <div className={styles.meta}>Flickctx · vision + context</div>
          <div className={styles.q}>You · why are payments failing right now?</div>
          <div
            className={styles.a}
            dangerouslySetInnerHTML={{
              __html: answer.includes("<") ? answer : escapeHtml(answer),
            }}
          />
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
