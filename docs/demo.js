(() => {
  const root = document.getElementById("demo");
  const caption = document.getElementById("caption");
  if (!root) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STEPS = [
    {
      id: "aws-idle",
      tab: "aws",
      caption: "Tab 1 — AWS RDS / CloudWatch · payments-db ACU looks calm…",
      ms: 1600,
      draw: false,
      box: false,
      chat: false,
      spike: false,
      hl: null,
    },
    {
      id: "aws-spike",
      tab: "aws",
      caption: "ACU / CPU spikes — database saturating under load.",
      ms: 2000,
      draw: true,
      box: false,
      chat: false,
      spike: true,
      mark: "aws",
      hl: null,
    },
    {
      id: "aws-box",
      tab: "aws",
      caption: "Mark the spike. Flickctx crops that region as primary focus.",
      ms: 1500,
      draw: true,
      box: true,
      chat: false,
      spike: true,
      mark: "aws",
      hl: null,
    },
    {
      id: "dd-switch",
      tab: "dd",
      caption: "Tab 2 — Datadog Logs · same window in time.",
      ms: 1700,
      draw: false,
      box: false,
      chat: false,
      spike: false,
      hl: null,
    },
    {
      id: "dd-mark",
      tab: "dd",
      caption:
        "Errors: failed to get response in time · db timeout · ACU limit exceeded.",
      ms: 2200,
      draw: true,
      box: true,
      chat: false,
      spike: false,
      mark: "dd",
      hl: [1, 2, 3],
    },
    {
      id: "answer",
      tab: "dd",
      caption:
        "Ask across what you marked — Flickctx ties the RDS spike to the Datadog timeouts.",
      ms: 4200,
      draw: true,
      box: true,
      chat: true,
      spike: false,
      mark: "dd",
      hl: [1, 2, 3],
    },
  ];

  const ANSWER =
    "Same incident: <em>payments-db</em> hit ACU limit (AWS spike) → Datadog shows client timeouts in <em>payments-api</em>. Scale ACU or shed load on the writer.";

  root.innerHTML = `
    <div class="demo" id="demo-root">
      <div class="tabs">
        <div class="tab aws" data-tab="aws"><i class="dot"></i>AWS · RDS CloudWatch</div>
        <div class="tab dd" data-tab="dd"><i class="dot"></i>Datadog · Logs</div>
        <div class="tab flick" data-tab="flick"><i class="dot"></i>Flickctx</div>
      </div>
      <div class="viewport">
        <div class="scene aws on" data-scene="aws">
          <div class="aws-head">
            <h3>RDS · payments-db · ACUUtilization</h3>
            <span>us-east-1 · last 15m</span>
          </div>
          <div class="metrics">
            <div class="metric-card">
              <div class="label">ACU utilization</div>
              <div class="value" id="acu-val">42%</div>
              <div class="spark" aria-hidden="true">
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
            </div>
            <div class="side-stats">
              <div class="stat">
                <div class="k">CPU</div>
                <div class="v" id="cpu-val">38%</div>
              </div>
              <div class="stat">
                <div class="k">Connections</div>
                <div class="v">186 / 200</div>
              </div>
              <div class="stat">
                <div class="k">Status</div>
                <div class="v" id="status-val">Healthy</div>
              </div>
            </div>
          </div>
        </div>

        <div class="scene dd" data-scene="dd">
          <div class="dd-toolbar">
            <span class="active">Logs</span>
            <span>service:payments-api</span>
            <span>status:error</span>
          </div>
          <div class="logs">
            <div class="log" data-log="0"><span class="ts">14:12:01</span><span class="lvl">info</span><span>checkout.session started request_id=8f2a</span></div>
            <div class="log error" data-log="1"><span class="ts">14:12:08</span><span class="lvl">error</span><span>failed to get response in time from db host=payments-db</span></div>
            <div class="log error" data-log="2"><span class="ts">14:12:08</span><span class="lvl">error</span><span>db timeout after 5000ms query=SELECT … FOR UPDATE</span></div>
            <div class="log error" data-log="3"><span class="ts">14:12:09</span><span class="lvl">error</span><span>ACU limit exceeded · throttled connections on aurora capacity</span></div>
            <div class="log" data-log="4"><span class="ts">14:12:10</span><span class="lvl">warn</span><span>retrying payment authorize attempt=2</span></div>
          </div>
        </div>

        <div class="mark-layer" id="marks">
          <svg viewBox="0 0 800 480" preserveAspectRatio="none">
            <path class="stroke aws-stroke" pathLength="1" d="M 210 210 C 250 160, 360 150, 430 190 C 490 230, 500 300, 450 340 C 390 385, 280 380, 230 330 C 185 285, 175 250, 210 210 Z"></path>
            <rect class="bbox aws-box" x="190" y="145" width="330" height="250"></rect>
            <path class="stroke dd-stroke" pathLength="1" d="M 120 145 C 160 130, 620 125, 680 150 C 700 175, 695 250, 660 270 C 400 295, 180 285, 130 250 C 105 220, 95 170, 120 145 Z"></path>
            <rect class="bbox dd-box" x="100" y="118" width="620" height="175"></rect>
          </svg>
        </div>

        <div class="chat">
          <div class="meta">Flickctx · vision + context</div>
          <div class="q">You · why are payments failing right now?</div>
          <div class="a" id="answer"></div>
        </div>
      </div>
    </div>
  `;

  const demo = document.getElementById("demo-root");
  const acuVal = document.getElementById("acu-val");
  const cpuVal = document.getElementById("cpu-val");
  const statusVal = document.getElementById("status-val");
  const answerEl = document.getElementById("answer");
  const awsScene = root.querySelector('.scene[data-scene="aws"]');

  let typeTimer = null;

  function setTab(name) {
    root.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("on", t.dataset.tab === name || (name === "flick" && t.dataset.tab === "flick"));
    });
    // Flickctx tab lights when chat is open; active content tab is aws/dd
    root.querySelectorAll(".tab").forEach((t) => {
      if (t.dataset.tab === "flick") return;
      t.classList.toggle("on", t.dataset.tab === name);
    });
    root.querySelectorAll(".scene").forEach((s) => {
      s.classList.toggle("on", s.dataset.scene === name);
    });
  }

  function setMarks(mark) {
    const awsStroke = root.querySelector(".aws-stroke");
    const ddStroke = root.querySelector(".dd-stroke");
    const awsBox = root.querySelector(".aws-box");
    const ddBox = root.querySelector(".dd-box");
    [awsStroke, ddStroke, awsBox, ddBox].forEach((el) => {
      if (!el) return;
      el.style.display = "none";
      el.style.opacity = "";
      el.style.strokeDashoffset = "";
    });
    if (mark === "aws") {
      awsStroke.style.display = "";
      awsBox.style.display = "";
    }
    if (mark === "dd") {
      ddStroke.style.display = "";
      ddBox.style.display = "";
    }
  }

  function typeAnswer(html) {
    if (typeTimer) clearInterval(typeTimer);
    if (reduce) {
      answerEl.innerHTML = html;
      return;
    }
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    const plain = tmp.textContent || "";
    answerEl.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i += 3;
      answerEl.textContent = plain.slice(0, i);
      if (i >= plain.length) {
        clearInterval(typeTimer);
        answerEl.innerHTML = html;
      }
    }, 26);
  }

  function applyStep(step) {
    setTab(step.tab === "flick" ? "dd" : step.tab);
    if (step.tab === "dd" && step.chat) {
      root.querySelector('.tab[data-tab="flick"]')?.classList.add("on");
    } else {
      root.querySelector('.tab[data-tab="flick"]')?.classList.remove("on");
    }

    demo.classList.toggle("drawing", Boolean(step.draw));
    demo.classList.toggle("boxed", Boolean(step.box));
    demo.classList.toggle("chat-on", Boolean(step.chat));
    awsScene.classList.toggle("spike", Boolean(step.spike));

    setMarks(step.mark || null);

    if (step.spike) {
      acuVal.textContent = "97%";
      acuVal.classList.add("warn");
      cpuVal.textContent = "91%";
      statusVal.textContent = "ACU limit";
      statusVal.classList.add("bad");
    } else if (step.tab === "aws") {
      acuVal.textContent = "42%";
      acuVal.classList.remove("warn");
      cpuVal.textContent = "38%";
      statusVal.textContent = "Healthy";
      statusVal.classList.remove("bad");
    }

    root.querySelectorAll(".log").forEach((el) => el.classList.remove("hl"));
    (step.hl || []).forEach((i) => {
      root.querySelector(`[data-log="${i}"]`)?.classList.add("hl");
    });

    if (caption) caption.textContent = step.caption;

    if (step.chat) typeAnswer(ANSWER);
    else answerEl.textContent = "";
  }

  function run() {
    if (reduce) {
      applyStep(STEPS[STEPS.length - 1]);
      return;
    }
    let i = 0;
    const tick = () => {
      const step = STEPS[i];
      // reset draw animation by toggling class
      demo.classList.remove("drawing", "boxed");
      void demo.offsetWidth;
      applyStep(step);
      i = (i + 1) % STEPS.length;
      setTimeout(tick, step.ms);
    };
    tick();
  }

  run();
})();
