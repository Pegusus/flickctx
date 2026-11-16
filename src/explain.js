const fs = require("fs");
const path = require("path");
const { gatherContext } = require("./context");
const { toolSchemas, runTool } = require("./tools");

/**
 * Flickctx brain — generic vision agent + visible reasoning.
 */

const SYSTEM = `you're flickctx. the user marked a region on their screen. images in the message show that mark (primary) and sometimes the full display for context.

rules (in order):
1. GROUND IN THE MARKED IMAGE FIRST. notice what is actually visible (product, UI labels, charts, code, urls, logos, numbers). your answer must be about THAT mark, not a generic web FAQ on the topic words alone.
2. Use the optional full-display image only to resolve surrounding chrome (app name, nav, which page). Never let it override the marked region as the subject.
3. If an environment hint (frontmost app / URL) is provided, use it as a weak prior — the pixels still win if they disagree.
4. ANSWER THE ASK using the screenshot as primary evidence. quote visible labels when useful.
5. TOOLS ARE SECONDARY. try to answer from the images first. use web_search / fetch_url only when the image cannot answer (missing docs, need a link, confirm live pricing). never replace the screenshot with a generic guide that ignores what was marked.
6. PRODUCT SKILLS are on-demand. if the mark is clearly AWS/Datadog/GCP/k8s/etc, call list_skills then read_skill for at most 1–2 ids. never preload all skills; never paste skill catalogs into the answer.
7. LOCAL CONTEXT is optional. use list_local_repos / grep only if the mark looks related. never force an unrelated local project.
8. if the crop is blank/unreadable, say so clearly instead of inventing.
9. be concrete. short markdown ok. no filler about missing git/claude sessions.
10. don't invent file paths or repos that aren't in tool results or provided context.`;

function buildUserPrompt(question) {
  const q = (question || "").trim();
  if (q) {
    return (
      "User question about the marked screenshot (primary image) above:\n" +
      q +
      "\n\nRespond about what is visible in the marked region. Do not ignore the screenshot."
    );
  }
  return "Look at the marked screenshot (primary image) above and explain what it is showing.";
}

function extractText(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("\n")
    .trim();
}

function extractThinking(content) {
  if (!Array.isArray(content)) return "";
  return content
    .filter((p) => p.type === "thinking" || p.type === "redacted_thinking")
    .map((p) => p.thinking || p.data || "")
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function proxyBase() {
  return (
    process.env.FLICKCTX_PROXY_URL ||
    ""
  ).replace(/\/$/, "");
}

async function postMessages({ apiKey, body }) {
  const base = proxyBase();
  const url = base ? `${base}/chat` : "https://api.anthropic.com/v1/messages";
  const headers = {
    "content-type": "application/json",
  };
  if (!base) {
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`API returned non-JSON (${res.status}): ${raw.slice(0, 400)}`);
  }
  if (!res.ok) {
    const msg = data?.error?.message || raw.slice(0, 400);
    const err = new Error(`API error ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function supportsThinking(model) {
  const m = String(model || "").toLowerCase();
  // Prefer Sonnet/Opus for extended thinking; Haiku may vary by version
  if (m.includes("haiku") && !m.includes("5.5") && !m.includes("5-5")) return false;
  return true;
}

async function runAgent({
  apiKey,
  model,
  imageBase64,
  mediaType,
  contextImageBase64,
  contextMediaType,
  frontmostHint,
  question,
  ambientContext,
  conversationHistory = [],
  toolEnv = {},
  maxTurns = 6,
  thinking = true,
  thinkingBudgetTokens = 8000,
}) {
  const tools = toolSchemas().map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  if (!imageBase64 || imageBase64.length < 64) {
    throw new Error(
      "Screenshot payload is empty — mark again. Screen capture may have failed."
    );
  }

  const contentBlocks = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType || "image/jpeg",
        data: imageBase64,
      },
    },
    {
      type: "text",
      text:
        "↑ PRIMARY FOCUS — user's freehand-marked screen region. This is the subject of the question.",
    },
  ];

  if (contextImageBase64 && contextImageBase64.length > 64) {
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: contextMediaType || "image/jpeg",
        data: contextImageBase64,
      },
    });
    contentBlocks.push({
      type: "text",
      text:
        "↑ FULL DISPLAY CONTEXT (secondary) — surrounding UI only. Do not treat this as the subject unless the mark is unreadable.",
    });
  }

  if (frontmostHint) {
    contentBlocks.push({
      type: "text",
      text: frontmostHint,
    });
  }

  contentBlocks.push({
    type: "text",
    text: buildUserPrompt(question),
  });

  if (ambientContext) {
    contentBlocks.push({
      type: "text",
      text:
        "optional background only — ignore unless it helps answer the ask above:\n\n" +
        ambientContext,
    });
  }

  const messages = [];
  for (const turn of conversationHistory.slice(-10)) {
    messages.push({ role: "user", content: turn.user });
    messages.push({ role: "assistant", content: turn.assistant });
  }
  messages.push({ role: "user", content: contentBlocks });

  let usageTotal = null;
  let finalText = "";
  const reasoningParts = [];
  const toolTrail = [];
  let useThinking = Boolean(thinking) && supportsThinking(model);
  const budget = Math.max(1024, Number(thinkingBudgetTokens) || 8000);

  for (let turn = 0; turn < maxTurns; turn++) {
    const body = {
      model,
      max_tokens: useThinking ? Math.max(budget + 4000, 12000) : 4000,
      system: SYSTEM,
      tools,
      messages,
    };
    if (useThinking) {
      body.thinking = {
        type: "enabled",
        budget_tokens: budget,
      };
    }

    let data;
    try {
      data = await postMessages({ apiKey, body });
    } catch (err) {
      // If thinking isn't supported for this model/account, retry without it
      const msg = String(err.message || err);
      if (
        useThinking &&
        (msg.includes("thinking") ||
          msg.includes("400") ||
          msg.includes("invalid"))
      ) {
        useThinking = false;
        turn -= 1;
        continue;
      }
      throw err;
    }

    if (data.usage) {
      usageTotal = usageTotal
        ? {
            input_tokens:
              (usageTotal.input_tokens || 0) + (data.usage.input_tokens || 0),
            output_tokens:
              (usageTotal.output_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : data.usage;
    }

    const content = data.content || [];
    const thinkingText = extractThinking(content);
    if (thinkingText) {
      reasoningParts.push(thinkingText);
    }

    const toolUses = content.filter((b) => b.type === "tool_use");
    for (const call of toolUses) {
      const inputPreview = JSON.stringify(call.input || {}).slice(0, 200);
      toolTrail.push(`→ ${call.name}(${inputPreview})`);
    }

    const text = extractText(content);
    if (text) finalText = text;

    if (!toolUses.length || data.stop_reason === "end_turn") {
      break;
    }

    messages.push({ role: "assistant", content });
    const toolResults = [];
    for (const call of toolUses) {
      let result;
      try {
        result = await runTool(call.name, call.input || {}, toolEnv);
        const summary =
          typeof result === "object"
            ? JSON.stringify(result).slice(0, 300)
            : String(result).slice(0, 300);
        toolTrail.push(`← ${call.name}: ${summary}`);
      } catch (err) {
        result = { error: err.message || String(err) };
        toolTrail.push(`← ${call.name} error: ${result.error}`);
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: call.id,
        content: JSON.stringify(result).slice(0, 40000),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const reasoning = [
    reasoningParts.length ? reasoningParts.join("\n\n---\n\n") : "",
    toolTrail.length
      ? "## Tool steps\n\n" + toolTrail.map((l) => `- ${l}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    text: finalText || "(no response)",
    reasoning,
    usage: usageTotal,
    model,
    thinkingEnabled: useThinking,
  };
}

function mediaTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/png";
}

async function explainSelection({
  apiKey,
  model,
  projectPath,
  imagePath,
  imageBase64,
  mediaType,
  contextImagePath,
  contextImageBase64,
  contextMediaType,
  frontmostHint,
  frontmost,
  question,
  maxTranscriptChars,
  maxDiffChars,
  searchRoots,
  maxRepos,
  scanLocalRepos,
  conversationHistory,
  thinking,
  thinkingBudgetTokens,
  maxImageEdge,
  jpegQuality,
}) {
  if (!apiKey && !proxyBase()) {
    throw new Error(
      "Missing API key. Set ANTHROPIC_API_KEY or run: flickctx config --api-key sk-ant-... (or set FLICKCTX_PROXY_URL for the optional worker proxy)"
    );
  }

  const { prepareVisionImage, toBase64Payload } = require("./image");
  const edge = maxImageEdge || 1600;
  const quality = jpegQuality || 80;

  let primary;
  if (imageBase64) {
    primary = {
      base64: imageBase64,
      mediaType: mediaType || "image/jpeg",
      width: 0,
      height: 0,
      bytes: Math.floor((imageBase64.length * 3) / 4),
    };
  } else {
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error("No screenshot provided.");
    }
    const prepared = prepareVisionImage(imagePath, {
      maxEdge: edge,
      quality,
    });
    if (prepared.bytes < 200) {
      throw new Error(
        `Captured crop looks empty (${prepared.bytes} bytes). Try marking again — check Screen Recording permission if on macOS.`
      );
    }
    primary = toBase64Payload(prepared);
  }

  let contextPayload = null;
  if (contextImageBase64) {
    contextPayload = {
      base64: contextImageBase64,
      mediaType: contextMediaType || "image/jpeg",
    };
  } else if (contextImagePath && fs.existsSync(contextImagePath)) {
    const preparedCtx = prepareVisionImage(contextImagePath, {
      maxEdge: Math.min(edge, 1280),
      quality: Math.min(quality, 75),
    });
    contextPayload = toBase64Payload(preparedCtx);
  }

  let hint = frontmostHint || "";
  if (!hint && frontmost) {
    const { formatFrontmostHint } = require("./frontmost");
    hint = formatFrontmostHint(frontmost);
  }

  const ctx = gatherContext({
    projectPath,
    question: question || "",
    maxTranscriptChars: Math.min(maxTranscriptChars || 4000, 4000),
    maxDiffChars: Math.min(maxDiffChars || 2000, 2000),
    searchRoots,
    maxRepos,
    scanLocalRepos,
    light: true,
  });

  const result = await runAgent({
    apiKey,
    model,
    imageBase64: primary.base64,
    mediaType: primary.mediaType,
    contextImageBase64: contextPayload?.base64 || null,
    contextMediaType: contextPayload?.mediaType || null,
    frontmostHint: hint || "",
    question: question || "",
    ambientContext: ctx.text.slice(0, 8000),
    conversationHistory: conversationHistory || [],
    toolEnv: {
      searchRoots: searchRoots || ctx.meta.searchRoots || [],
      maxRepos: maxRepos || 80,
    },
    thinking: thinking !== false,
    thinkingBudgetTokens: thinkingBudgetTokens || 8000,
  });

  const followUpPrompt = question
    ? `I marked something on my screen and asked: ${question}\n\nFlickctx said:\n\n${result.text}\n\nContinue from this.`
    : `I marked something on my screen. Flickctx said:\n\n${result.text}\n\nContinue from this.`;

  return {
    explanation: result.text,
    reasoning: result.reasoning || "",
    followUpPrompt,
    usage: result.usage,
    model: result.model,
    thinkingEnabled: result.thinkingEnabled,
    contextMeta: {
      ...ctx.meta,
      visionPrimary: {
        mediaType: primary.mediaType,
        width: primary.width,
        height: primary.height,
        bytes: primary.bytes,
      },
      visionContext: contextPayload
        ? {
            mediaType: contextPayload.mediaType,
            width: contextPayload.width,
            height: contextPayload.height,
            bytes: contextPayload.bytes,
          }
        : null,
      frontmost: frontmost || null,
    },
    projectPath: ctx.projectPath,
    contextPreview: ctx.text.slice(0, 1500),
    imagePath: imagePath || null,
    imageBytes: primary.bytes,
    imageBase64Len: primary.base64.length,
    question: question || "",
  };
}

module.exports = {
  explainSelection,
  runAgent,
  SYSTEM,
  buildUserPrompt,
};
