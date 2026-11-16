(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PHASES = [
    {
      id: "mark",
      label: "Mark",
      text: "Draw freehand around the region you care about.",
      duration: 2200,
    },
    {
      id: "box",
      label: "Capture",
      text: "Bounding box becomes a cropped vision payload, with full-screen context.",
      duration: 1800,
    },
    {
      id: "ask",
      label: "Ask",
      text: "Type a question about that exact snippet — not a generic FAQ.",
      duration: 1800,
    },
    {
      id: "answer",
      label: "Answer",
      text: "Vision-grounded reply streams in. Keep chatting on the same mark.",
      duration: 3200,
    },
  ];

  const ANSWER_TEXT =
    "This panel is MSK / Kafka consumer lag on `payments-events`. Spike started ~14:12 — check the consumer in `payments-worker`.";

  function buildDemo(root, { compact = false } = {}) {
    root.innerHTML = `
      <div class="demo-root">
        <div class="demo-chrome">
          <div class="demo-dots" aria-hidden="true"><i></i><i></i><i></i></div>
          <span>${compact ? "Flickctx demo" : "prod · us-east-1 · observability"}</span>
        </div>
        <div class="demo-body">
          <div class="fake-ui">
            <div class="fake-nav">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="fake-main">
              <div class="fake-bar"></div>
              <div class="fake-grid">
                <div class="fake-panel">
                  <div class="title">consumer_lag · payments-events</div>
                  <div class="chart"><b></b><b></b><b></b><b></b><b></b></div>
                </div>
                <div class="fake-panel">
                  <div class="title">recent errors</div>
                  <p class="err-line"><strong>OffsetCommit failed</strong><br/>group=payments-worker partition=6</p>
                </div>
              </div>
            </div>
          </div>
          <svg class="mark-svg" viewBox="0 0 640 420" preserveAspectRatio="xMidYMid slice">
            <path class="mark-path" pathLength="1" d="M 290 168 C 310 150, 360 148, 390 165 C 420 184, 430 220, 418 250 C 404 284, 360 298, 325 290 C 292 282, 275 250, 278 220 C 280 198, 278 180, 290 168 Z" />
            <rect class="mark-box" x="268" y="142" width="168" height="168" rx="8" />
          </svg>
          <div class="chat-panel">
            <div class="who">Flickctx</div>
            <div class="bubble" data-answer></div>
            <div class="ask">You · what owns this lag spike?</div>
          </div>
        </div>
      </div>
    `;
    return root.querySelector(".demo-root");
  }

  function setPhase(demoRoot, phaseId) {
    demoRoot.classList.remove("phase-mark", "phase-box", "phase-ask", "phase-answer");
    demoRoot.classList.add(`phase-${phaseId}`);
    const bubble = demoRoot.querySelector("[data-answer]");
    if (!bubble) return;
    if (phaseId === "answer") {
      typeText(bubble, ANSWER_TEXT);
    } else if (phaseId === "ask") {
      bubble.textContent = "";
    } else {
      bubble.textContent = "";
    }
  }

  let typeTimer = null;
  function typeText(el, text) {
    if (typeTimer) clearInterval(typeTimer);
    if (reduceMotion) {
      el.textContent = text;
      return;
    }
    el.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i += 2;
      el.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 28);
  }

  function runLoop(demoRoot, onPhase) {
    let index = 0;
    const tick = () => {
      const phase = PHASES[index];
      setPhase(demoRoot, phase.id);
      if (onPhase) onPhase(phase, index);
      index = (index + 1) % PHASES.length;
      return phase.duration;
    };

    if (reduceMotion) {
      setPhase(demoRoot, "answer");
      const bubble = demoRoot.querySelector("[data-answer]");
      if (bubble) bubble.textContent = ANSWER_TEXT;
      if (onPhase) onPhase(PHASES[3], 3);
      return;
    }

    let delay = tick();
    const loop = () => {
      setTimeout(() => {
        delay = tick();
        loop();
      }, delay);
    };
    loop();
  }

  const hero = document.getElementById("hero-demo");
  const walk = document.getElementById("walk-demo");
  const phaseLabel = document.getElementById("phase-label");
  const phaseText = document.getElementById("phase-text");
  const phaseDots = document.getElementById("phase-dots");

  if (hero) {
    const root = buildDemo(hero);
    runLoop(root);
  }

  if (walk) {
    const root = buildDemo(walk, { compact: true });
    runLoop(root, (phase, index) => {
      if (phaseLabel) phaseLabel.textContent = phase.label;
      if (phaseText) phaseText.textContent = phase.text;
      if (phaseDots) {
        [...phaseDots.children].forEach((li, i) => {
          li.classList.toggle("on", i === index);
        });
      }
    });
  }
})();
