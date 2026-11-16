(() => {
  const mount = document.getElementById("demo");
  const captionEl = document.getElementById("caption");
  if (!mount) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const narrow = window.matchMedia("(max-width: 900px)").matches;
  const ANSWER = narrow
    ? "<em>payments-db</em> ACU limit (AWS) → timeouts in <em>payments-api</em> (Datadog). Scale ACU or shed load."
    : "Same incident: <em>payments-db</em> hit ACU limit (AWS) → Datadog shows timeouts in <em>payments-api</em>. Scale ACU or shed writer load.";

  const STEPS = [
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
      caption:
        "failed to get response in time · db timeout · ACU limit exceeded.",
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

  mount.innerHTML = `
    <div class="demo" id="demo-root">
      <div class="tabs">
        <div class="tab aws" data-tab="aws"><i class="dot"></i>AWS · RDS CloudWatch</div>
        <div class="tab dd" data-tab="dd"><i class="dot"></i>Datadog · Logs</div>
        <div class="tab flick" data-tab="flick"><i class="dot"></i>Flickctx</div>
      </div>
      <div class="viewport">
        <div class="stage-pane">
          <div class="scene aws on" data-scene="aws">
            <div class="aws-head">
              <strong>RDS · payments-db · ACUUtilization</strong>
              <span>us-east-1 · 15m</span>
            </div>
            <div class="metrics">
              <div class="card">
                <div class="lbl">ACU utilization</div>
                <div class="val" id="acu">42%</div>
                <div class="spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
              </div>
              <div class="side">
                <div class="card"><div class="lbl">CPU</div><div class="val" id="cpu">38%</div></div>
                <div class="card"><div class="lbl">Connections</div><div class="val">186 / 200</div></div>
                <div class="card"><div class="lbl">Status</div><div class="val" id="status">Healthy</div></div>
              </div>
            </div>
          </div>

          <div class="scene dd" data-scene="dd">
            <div class="dd-bar">
              <span class="on">Logs</span>
              <span>service:payments-api</span>
              <span>status:error</span>
            </div>
            <div class="logs">
              <div class="log" data-i="0"><span class="ts">14:12:01</span><span class="lvl">info</span><span>checkout.session started request_id=8f2a</span></div>
              <div class="log err" data-i="1"><span class="ts">14:12:08</span><span class="lvl">error</span><span>failed to get response in time from db host=payments-db</span></div>
              <div class="log err" data-i="2"><span class="ts">14:12:08</span><span class="lvl">error</span><span>db timeout after 5000ms query=SELECT … FOR UPDATE</span></div>
              <div class="log err" data-i="3"><span class="ts">14:12:09</span><span class="lvl">error</span><span>ACU limit exceeded · throttled connections on aurora capacity</span></div>
              <div class="log" data-i="4"><span class="ts">14:12:10</span><span class="lvl">warn</span><span>retrying payment authorize attempt=2</span></div>
            </div>
          </div>

          <div class="marks">
            <svg viewBox="0 0 800 480" preserveAspectRatio="none">
              <path class="stroke" data-mark="aws" pathLength="1" d="M 205 205 C 250 155, 365 148, 435 188 C 500 228, 508 305, 455 348 C 390 395, 275 385, 225 330 C 180 285, 168 248, 205 205 Z"></path>
              <rect class="bbox" data-mark="aws" x="185" y="140" width="340" height="255"></rect>
              <path class="stroke" data-mark="dd" pathLength="1" d="M 115 140 C 160 122, 630 118, 690 145 C 715 175, 705 255, 655 275 C 390 300, 175 290, 125 250 C 100 220, 90 165, 115 140 Z"></path>
              <rect class="bbox" data-mark="dd" x="95" y="112" width="640" height="180"></rect>
            </svg>
          </div>
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
  const acu = document.getElementById("acu");
  const cpu = document.getElementById("cpu");
  const status = document.getElementById("status");
  const answer = document.getElementById("answer");
  const awsScene = mount.querySelector('[data-scene="aws"]');
  let typeTimer = null;

  function setTab(name, flickOn) {
    mount.querySelectorAll(".tab").forEach((t) => {
      const id = t.dataset.tab;
      t.classList.toggle("on", id === name || (flickOn && id === "flick"));
    });
    mount.querySelectorAll(".scene").forEach((s) => {
      s.classList.toggle("on", s.dataset.scene === name);
    });
  }

  function setMark(which) {
    mount.querySelectorAll(".stroke, .bbox").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.mark === which);
    });
  }

  function typeAnswer(html) {
    if (typeTimer) clearInterval(typeTimer);
    if (reduce) {
      answer.innerHTML = html;
      return;
    }
    const plain = html.replace(/<[^>]+>/g, "");
    answer.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      i += 3;
      answer.textContent = plain.slice(0, i);
      if (i >= plain.length) {
        clearInterval(typeTimer);
        answer.innerHTML = html;
      }
    }, 24);
  }

  function apply(step) {
    setTab(step.tab, Boolean(step.flickTab));
    setMark(step.mark);

    // Animation classes — drawn keeps stroke visible without replaying
    demo.classList.remove("drawing", "drawn", "boxed", "chat-on");
    void demo.offsetWidth;
    if (step.draw) demo.classList.add("drawing");
    if (step.drawn) demo.classList.add("drawn");
    if (step.box) demo.classList.add("boxed");
    if (step.chat) demo.classList.add("chat-on");

    awsScene.classList.toggle("spike", Boolean(step.spike));
    if (step.spike) {
      acu.textContent = "97%";
      acu.classList.add("warn");
      cpu.textContent = "91%";
      status.textContent = "ACU limit";
      status.classList.add("bad");
    } else if (step.tab === "aws") {
      acu.textContent = "42%";
      acu.classList.remove("warn");
      cpu.textContent = "38%";
      status.textContent = "Healthy";
      status.classList.remove("bad");
    }

    mount.querySelectorAll(".log").forEach((el) => el.classList.remove("hl"));
    (step.hl || []).forEach((i) => {
      mount.querySelector(`.log[data-i="${i}"]`)?.classList.add("hl");
    });

    if (captionEl) captionEl.textContent = step.caption;

    if (step.chat) typeAnswer(ANSWER);
    else answer.textContent = "";
  }

  function run() {
    if (reduce) {
      apply(STEPS[STEPS.length - 1]);
      return;
    }
    let i = 0;
    const tick = () => {
      apply(STEPS[i]);
      const wait = STEPS[i].ms;
      i = (i + 1) % STEPS.length;
      setTimeout(tick, wait);
    };
    tick();
  }

  run();
})();
