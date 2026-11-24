/**
 * Guide mode — seamless on-screen pointer steps via the session bridge.
 *
 * Model returns a fenced block (stripped from chat text):
 *
 * ```flickctx-guide
 * {"done":false,"step":1,"label":"Open EKS in the left nav","action":"click","space":"display","x":0.08,"y":0.42,"w":0.1,"h":0.04}
 * ```
 *
 * Coords are normalized 0–1 in `space` (display = full screen capture).
 */

function isGuideIntent(question, explicit = false) {
  if (explicit) return true;
  const q = String(question || "").trim();
  if (!q) return false;
  return /\b(show me|guide me|walk me|take me|where (is|are|to find|can i)|how (do i|to) (find|get to|open|reach|navigate)|point (me )?to|lead me)\b/i.test(
    q
  );
}

function buildGuideStartPrompt(goal, imagePath) {
  const g = String(goal || "").trim() || "Help me find what I need on this screen.";
  return [
    "Flickctx GUIDE MODE is on. You are a UI navigator for the attached screenshot.",
    `Screenshot path: ${imagePath}`,
    "Look at the image carefully (vision / Read the image file).",
    "",
    "Your job: point to the SINGLE next UI control the user should click or look at to progress toward their goal.",
    "Do NOT list a full multi-step plan. Only the immediate next target on THIS screen.",
    "",
    "Reply with a short human sentence (1–2 lines), then exactly one fenced block:",
    "```flickctx-guide",
    '{"done":false,"step":1,"label":"short action label","action":"click","space":"display","x":0.0,"y":0.0,"w":0.0,"h":0.0}',
    "```",
    "Rules:",
    "- space MUST be \"display\" (coords relative to the full screenshot).",
    "- x,y,w,h are normalized 0–1 floats for the target control.",
    "- label ≤ 48 chars, imperative (e.g. \"Click Clusters in the left nav\").",
    "- If the goal is already satisfied on this screen, set done:true and omit x/y (or set them to the confirming region).",
    "- If you cannot see a useful target, still return done:false with your best guess box, or done:true with label explaining why.",
    "",
    `User goal: ${g}`,
  ].join("\n");
}

function buildGuideAdvancePrompt(goal, stepNumber, imagePath) {
  const g = String(goal || "").trim();
  const n = Math.max(1, Number(stepNumber) || 1);
  return [
    "Flickctx GUIDE MODE — continue. The user followed the previous pointer.",
    `Fresh screenshot path: ${imagePath}`,
    "Look at this NEW screen (vision / Read the image file).",
    "",
    "Point to the SINGLE next UI control. Same format as before:",
    "```flickctx-guide",
    `{"done":false,"step":${n},"label":"…","action":"click","space":"display","x":0,"y":0,"w":0,"h":0}`,
    "```",
    "If the goal is reached, return done:true.",
    "",
    `Original goal: ${g}`,
    `This is guide step ${n}.`,
  ].join("\n");
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.min(1, Math.max(0, x));
}

function extractGuideBlock(text) {
  const src = String(text || "");
  const fence = /```\s*flickctx-guide\s*\n([\s\S]*?)```/i.exec(src);
  if (!fence) {
    return { cleanText: src.trim(), step: null };
  }
  const cleanText = (
    src.slice(0, fence.index) + src.slice(fence.index + fence[0].length)
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  let parsed;
  try {
    parsed = JSON.parse(fence[1].trim());
  } catch {
    return { cleanText: src.trim(), step: null };
  }
  if (!parsed || typeof parsed !== "object") {
    return { cleanText, step: null };
  }
  const done = Boolean(parsed.done);
  const label = String(parsed.label || parsed.text || "")
    .trim()
    .slice(0, 72);
  const action = String(parsed.action || "click").toLowerCase();
  const stepNum = Math.max(1, Number(parsed.step) || 1);
  const space =
    parsed.space === "primary" || parsed.space === "crop" ? "primary" : "display";

  if (done) {
    return {
      cleanText,
      step: { done: true, step: stepNum, label: label || "Done", action, space },
    };
  }

  const x = clamp01(parsed.x);
  const y = clamp01(parsed.y);
  if (x == null || y == null) {
    return { cleanText, step: null };
  }
  let w = clamp01(parsed.w ?? parsed.width ?? 0.06) || 0.06;
  let h = clamp01(parsed.h ?? parsed.height ?? 0.05) || 0.05;
  if (w < 0.02) w = 0.06;
  if (h < 0.02) h = 0.05;
  w = Math.min(w, 1 - x);
  h = Math.min(h, 1 - y);

  return {
    cleanText,
    step: {
      done: false,
      step: stepNum,
      label: label || "Next",
      action,
      space,
      x,
      y,
      w,
      h,
    },
  };
}

/** Map a guide step into the existing highlight payload shape. */
function guideStepToHighlightPayload(step) {
  if (!step || step.done) return null;
  return {
    space: step.space === "primary" ? "primary" : "display",
    highlights: [
      {
        x: step.x,
        y: step.y,
        w: step.w,
        h: step.h,
        label: step.label || "",
      },
    ],
  };
}

module.exports = {
  isGuideIntent,
  buildGuideStartPrompt,
  buildGuideAdvancePrompt,
  extractGuideBlock,
  guideStepToHighlightPayload,
};
