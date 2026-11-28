"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AwsMark, DatadogMark } from "./BrandMarks";
import styles from "./IncidentDemo.module.css";

type AppId = "aws" | "dd";

type Step = {
  id: string;
  app: AppId;
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

function flowFor(
  app: AppId,
  cfg: { consoleCaption: string; route: string }
): Step[] {
  const p = app;
  return [
    {
      id: `${p}-console`,
      app,
      caption: cfg.consoleCaption,
      ms: 2000,
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
      id: `${p}-hint`,
      app,
      caption: "Draw freehand around what you want — Esc to cancel.",
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
      id: `${p}-draw`,
      app,
      caption: "Freehand mark becomes the focus.",
      ms: 1800,
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
      id: `${p}-drawn`,
      app,
      caption: "Crop locked — camera pushes into the mark.",
      ms: 2200,
      dim: true,
      hint: false,
      draw: false,
      drawn: true,
      markBar: false,
      chat: false,
      preview: false,
      typed: false,
      answer: false,
    },
    {
      id: `${p}-chat`,
      app,
      caption: `Pull to Flickctx · ${cfg.route}.`,
      ms: 2200,
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
      id: `${p}-ask`,
      app,
      caption: "Ask about the marked region — Send.",
      ms: 1800,
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
      id: `${p}-answer`,
      app,
      caption: "Answer streams in the session you already had open.",
      ms: 3600,
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
}

const STEPS: Step[] = [
  ...flowFor("aws", {
    consoleCaption: "AWS RDS · Monitoring — ACU limit on payments-db.",
    route: "OpenCode · payments-incident",
  }),
  ...flowFor("dd", {
    consoleCaption: "Datadog · Log Explorer — payment timeouts.",
    route: "Claude Code · checkout-debug",
  }),
];

const AWS_ASK = "What caused the ACU spike on this cluster?";
const DD_ASK = "Why are payments-api errors spiking?";

const LASSO_AWS =
  "M 318 118 C 368 95, 488 98, 548 128 C 592 158, 598 248, 538 298 C 468 348, 328 338, 288 278 C 258 232, 268 152, 318 118 Z";
const LASSO_DD =
  "M 90 130 C 140 105, 520 100, 580 135 C 610 170, 600 250, 520 270 C 300 300, 140 285, 95 245 C 70 215, 60 160, 90 130 Z";

const DD_LOGS = [
  { lvl: "info", text: "checkout.session started request_id=8f2a", err: false },
  { lvl: "error", text: "failed to get response in time host=payments-db", err: true },
  { lvl: "error", text: "db timeout after 5000ms · FOR UPDATE", err: true },
  { lvl: "error", text: "ACU limit exceeded · aurora capacity", err: true },
  { lvl: "warn", text: "retrying payment authorize attempt=2", err: false },
];

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
      setStep(STEPS.find((s) => s.id === "aws-answer") || STEPS[STEPS.length - 1]);
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

  const isAws = step.app === "aws";
  const askText = isAws ? AWS_ASK : DD_ASK;
  const routeLabel = isAws
    ? "OpenCode · payments-incident"
    : "Claude Code · checkout-debug";
  const previewVal = isAws ? "97%" : "3×";

  const demoClass = [
    styles.demo,
    step.dim ? styles.dimmed : "",
    step.draw ? styles.drawing : "",
    step.drawn ? styles.drawn : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Wide → punch into mark (after crop) → pan to Flickctx. No zoom while drawing.
  const cameraClass = [
    styles.camera,
    step.chat
      ? styles.zoomFlick
      : step.drawn
        ? isAws
          ? styles.zoomMarkAws
          : styles.zoomMarkDd
        : styles.zoomWide,
  ].join(" ");

  return (
    <div className={demoClass}>
      {/* Outside .camera so it does not scale into a thick black strip during zoom */}
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
          {isAws ? "OpenCode" : "Claude"}
        </span>
        <span className={styles.markBtn}>Chat</span>
      </div>

      <div className={cameraClass}>
        <div className={styles.laptop}>
          <div className={styles.laptopBezel}>
            <div className={styles.cam} aria-hidden />
            <div className={styles.laptopScreen}>
              {/* App tabs */}
              <div className={styles.appTabs} aria-hidden>
                <div
                  className={`${styles.appTab} ${
                    isAws ? styles.appTabOn : ""
                  }`}
                >
                  <AwsMark className={styles.appTabMark} />
                  AWS
                </div>
                <div
                  className={`${styles.appTab} ${
                    !isAws ? styles.appTabOn : ""
                  }`}
                >
                  <DatadogMark className={styles.appTabMark} />
                  Datadog
                </div>
              </div>

              <div
                className={`${styles.awsConsole} ${
                  isAws ? styles.sceneOn : styles.sceneOff
                }`}
              >
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

              <div
                className={`${styles.ddConsole} ${
                  !isAws ? styles.sceneOn : styles.sceneOff
                }`}
              >
                <header className={styles.ddTop}>
                  <Image
                    src="/brands/datadog.svg"
                    alt=""
                    width={18}
                    height={20}
                    unoptimized
                    aria-hidden
                  />
                  <strong>Log Explorer</strong>
                  <span className={styles.ddPill}>Logs</span>
                  <span className={styles.ddFilter}>service:payments-api</span>
                  <span className={styles.ddFilter}>status:error</span>
                </header>
                <div className={styles.ddLogs}>
                  {DD_LOGS.map((log, i) => (
                    <div
                      key={i}
                      className={`${styles.ddRow} ${
                        log.err ? styles.ddErr : ""
                      } ${step.drawn && log.err ? styles.ddHl : ""}`}
                    >
                      <span className={styles.ddTs}>14:12:0{i}</span>
                      <span className={styles.ddLvl}>{log.lvl}</span>
                      <span>{log.text}</span>
                    </div>
                  ))}
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
                      isAws && (step.draw || step.drawn)
                        ? styles.strokeActive
                        : ""
                    }`}
                    pathLength={1}
                    d={LASSO_AWS}
                  />
                  <rect
                    className={`${styles.bbox} ${
                      isAws && step.drawn ? styles.bboxActive : ""
                    }`}
                    x="268"
                    y="92"
                    width="300"
                    height="240"
                  />
                  <path
                    className={`${styles.stroke} ${
                      !isAws && (step.draw || step.drawn)
                        ? styles.strokeActive
                        : ""
                    }`}
                    pathLength={1}
                    d={LASSO_DD}
                  />
                  <rect
                    className={`${styles.bbox} ${
                      !isAws && step.drawn ? styles.bboxActive : ""
                    }`}
                    x="70"
                    y="100"
                    width="540"
                    height="185"
                  />
                </svg>
              </div>
            </div>
          </div>
          <div className={styles.laptopBase} aria-hidden />
        </div>

        <aside
          className={`${styles.chatPanel} ${
            step.chat ? styles.chatPanelOn : ""
          }`}
          aria-hidden
        >
          <header className={styles.chatChrome}>
            <span className={styles.chatBrand}>
              Flick<span>ctx</span>
            </span>
            <span className={styles.chatRoute}>{routeLabel}</span>
          </header>
          <div
            className={`${styles.markPreview} ${
              step.preview ? styles.markPreviewOn : ""
            }`}
          >
            <p className={styles.previewLbl}>Marked region</p>
            <div className={styles.previewThumb}>
              <div className={styles.previewMock}>
                <span className={styles.previewVal}>{previewVal}</span>
                <div className={styles.previewSpark} />
              </div>
            </div>
          </div>
          <div className={styles.chatThread}>
            {step.typed ? (
              <div className={styles.msgUser}>
                <p className={styles.msgRole}>You</p>
                <p>{askText}</p>
              </div>
            ) : null}
            {step.answer ? (
              <div className={styles.msgBot}>
                <p className={styles.msgRole}>Assistant</p>
                {isAws ? (
                  <p>
                    Aurora hit the max ACU cap while connections held locks on{" "}
                    <code>payments-db</code>. Scale ACU or trim long
                    transactions in checkout.
                  </p>
                ) : (
                  <p>
                    Three timeouts correlate with the ACU limit on{" "}
                    <code>payments-db</code>. The FOR UPDATE path is blocking —
                    same incident as the RDS spike.
                  </p>
                )}
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
                <span className={styles.composerQ}>{askText}</span>
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
