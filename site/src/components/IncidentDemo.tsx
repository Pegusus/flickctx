"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./IncidentDemo.module.css";

type Step = {
  id: string;
  caption: string;
  ms: number;
  dim: boolean;
  hint: boolean;
  draw: boolean;
  drawn: boolean;
  markBar: boolean;
  chat: boolean;
  preview: boolean;
  typed: boolean;
  answer: boolean;
};

const STEPS: Step[] = [
  {
    id: "console",
    caption: "AWS RDS · Monitoring — ACU limit on payments-db.",
    ms: 2200,
    dim: false,
    hint: false,
    draw: false,
    drawn: false,
    markBar: false,
    chat: false,
    preview: false,
    typed: false,
    answer: false,
  },
  {
    id: "hint",
    caption: "Draw freehand around the spike — Esc to cancel.",
    ms: 900,
    dim: true,
    hint: true,
    draw: false,
    drawn: false,
    markBar: false,
    chat: false,
    preview: false,
    typed: false,
    answer: false,
  },
  {
    id: "draw",
    caption: "Freehand mark becomes the focus.",
    ms: 1900,
    dim: true,
    hint: true,
    draw: true,
    drawn: false,
    markBar: false,
    chat: false,
    preview: false,
    typed: false,
    answer: false,
  },
  {
    id: "drawn",
    caption: "Crop locked — full display stays as context.",
    ms: 1400,
    dim: true,
    hint: false,
    draw: false,
    drawn: true,
    markBar: true,
    chat: false,
    preview: false,
    typed: false,
    answer: false,
  },
  {
    id: "chat",
    caption: "Flickctx · OpenCode session payments-incident.",
    ms: 1800,
    dim: false,
    hint: false,
    draw: false,
    drawn: true,
    markBar: true,
    chat: true,
    preview: true,
    typed: false,
    answer: false,
  },
  {
    id: "ask",
    caption: "Ask about the marked region — Send.",
    ms: 2200,
    dim: false,
    hint: false,
    draw: false,
    drawn: true,
    markBar: true,
    chat: true,
    preview: true,
    typed: true,
    answer: false,
  },
  {
    id: "answer",
    caption: "Answer streams in the session you already had open.",
    ms: 4200,
    dim: false,
    hint: false,
    draw: false,
    drawn: true,
    markBar: true,
    chat: true,
    preview: true,
    typed: true,
    answer: true,
  },
];

const LASSO =
  "M 318 118 C 368 95, 488 98, 548 128 C 592 158, 598 248, 538 298 C 468 348, 328 338, 288 278 C 258 232, 268 152, 318 118 Z";

export function IncidentDemo({
  onCaption,
}: {
  onCaption: (text: string) => void;
}) {
  const [step, setStep] = useState<Step>(STEPS[0]);
  const reduceRef = useRef(false);
  const idxRef = useRef(0);

  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
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
    step.dim ? styles.dimmed : "",
    step.draw ? styles.drawing : "",
    step.drawn ? styles.drawn : "",
  ]
    .filter(Boolean)
    .join(" ");

  const cameraClass = [
    styles.camera,
    step.chat
      ? styles.zoomFlick
      : step.draw || step.drawn
        ? styles.zoomMark
        : styles.zoomWide,
  ].join(" ");

  return (
    <div className={demoClass}>
      <div className={cameraClass}>
      <div
        className={`${styles.markBar} ${step.markBar ? styles.markBarOn : ""}`}
        aria-hidden
      >
        <div className={styles.markBrand}>
          Flick<span>ctx</span>
        </div>
        <span className={styles.markBtn}>Mark</span>
        <span className={styles.markBtn}>Shot</span>
        <span className={`${styles.markBtn} ${styles.markRouteOn}`}>
          OpenCode
        </span>
        <span className={styles.markBtn}>Chat</span>
      </div>

      <div className={styles.laptop}>
        <div className={styles.laptopBezel}>
          <div className={styles.cam} aria-hidden />
          <div className={styles.laptopScreen}>
            <div className={styles.awsConsole}>
              <header className={styles.awsHeader}>
                <Image
                  src="/brands/aws.svg"
                  alt=""
                  width={36}
                  height={22}
                  unoptimized
                  aria-hidden
                />
                <span>Amazon RDS</span>
                <span className={styles.awsCrumb}>›</span>
                <strong>Monitoring</strong>
                <span className={styles.awsRegion}>us-east-1</span>
              </header>
              <div className={styles.awsBody}>
                <aside className={styles.awsSideNav}>
                  <p className={styles.awsNavHead}>payments-db</p>
                  <p>Connectivity &amp; security</p>
                  <p className={styles.awsNavOn}>Monitoring</p>
                  <p>Logs &amp; events</p>
                  <p>Performance insights</p>
                </aside>
                <main className={styles.awsMain}>
                  <div className={styles.awsTitleRow}>
                    <h2 className={styles.awsTitle}>Database metrics</h2>
                    <span className={styles.awsRange}>Last 15 minutes</span>
                  </div>
                  <div className={styles.awsCharts}>
                    <div className={styles.awsChartCard}>
                      <div className={styles.awsChartLbl}>ACU utilization</div>
                      <div className={styles.awsChartVal}>97%</div>
                      <div className={styles.awsLineChart} aria-hidden>
                        <svg viewBox="0 0 200 64" preserveAspectRatio="none">
                          <polyline
                            fill="none"
                            stroke="#0972d3"
                            strokeWidth="2"
                            points="0,52 24,50 48,48 72,44 96,36 120,22 144,14 168,10 192,8"
                          />
                          <polyline
                            fill="rgba(9,114,211,0.12)"
                            stroke="none"
                            points="0,64 0,52 24,50 48,48 72,44 96,36 120,22 144,14 168,10 192,8 192,64"
                          />
                        </svg>
                      </div>
                    </div>
                    <div className={styles.awsChartRow}>
                      <div className={styles.awsMiniCard}>
                        <span>CPU</span>
                        <strong>91%</strong>
                      </div>
                      <div className={styles.awsMiniCard}>
                        <span>Connections</span>
                        <strong>186</strong>
                      </div>
                      <div
                        className={`${styles.awsMiniCard} ${styles.awsAlert}`}
                      >
                        <span>ACU limit</span>
                        <strong>Exceeded</strong>
                      </div>
                    </div>
                  </div>
                </main>
              </div>
            </div>

            <div className={styles.screenDim} aria-hidden />
            <div
              className={`${styles.hintPill} ${step.hint ? styles.hintOn : ""}`}
            >
              Draw freehand… <kbd>Esc</kbd>
            </div>

            <div className={styles.marks} aria-hidden>
              <svg viewBox="0 0 640 360" preserveAspectRatio="none">
                <path
                  className={`${styles.stroke} ${
                    step.draw || step.drawn ? styles.strokeActive : ""
                  }`}
                  pathLength={1}
                  d={LASSO}
                />
                <rect
                  className={`${styles.bbox} ${
                    step.drawn ? styles.bboxActive : ""
                  }`}
                  x="268"
                  y="92"
                  width="300"
                  height="240"
                />
              </svg>
            </div>
          </div>
        </div>
        <div className={styles.laptopBase} aria-hidden />
      </div>

      <aside
        className={`${styles.chatPanel} ${step.chat ? styles.chatPanelOn : ""}`}
        aria-hidden
      >
        <header className={styles.chatChrome}>
          <span className={styles.chatBrand}>
            Flick<span>ctx</span>
          </span>
          <span className={styles.chatRoute}>OpenCode · payments-incident</span>
        </header>
        <div
          className={`${styles.markPreview} ${
            step.preview ? styles.markPreviewOn : ""
          }`}
        >
          <p className={styles.previewLbl}>Marked region</p>
          <div className={styles.previewThumb}>
            <div className={styles.previewMock}>
              <span className={styles.previewVal}>97%</span>
              <div className={styles.previewSpark} />
            </div>
          </div>
        </div>
        <div className={styles.chatThread}>
          {step.typed ? (
            <div className={styles.msgUser}>
              <p className={styles.msgRole}>You</p>
              <p>What caused the ACU spike on this cluster?</p>
            </div>
          ) : null}
          {step.answer ? (
            <div className={styles.msgBot}>
              <p className={styles.msgRole}>Assistant</p>
              <p>
                Aurora hit the max ACU cap while connections held locks on{" "}
                <code>payments-db</code>. Scale ACU or trim long transactions in
                checkout.
              </p>
            </div>
          ) : null}
        </div>
        <footer className={styles.composer}>
          <div
            className={`${styles.composerField} ${
              step.typed && !step.answer ? styles.composerBusy : ""
            }`}
          >
            {step.typed ? (
              <span className={styles.composerQ}>
                What caused the ACU spike on this cluster?
              </span>
            ) : (
              <span className={styles.composerPh}>
                Ask about the marked region…
              </span>
            )}
          </div>
          <span
            className={`${styles.sendBtn} ${
              step.typed ? styles.sendBtnOn : ""
            }`}
          >
            Send
          </span>
        </footer>
      </aside>
      </div>
    </div>
  );
}