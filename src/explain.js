const fs = require("fs");
const path = require("path");
const { gatherContext } = require("./context");
const { toolSchemas, runTool } = require("./tools");

/**
 * Flickctx brain — generic vision agent + visible reasoning.
 */

const SYSTEM = `you're flickctx. the user marked a region on their screen. the image attached to the message IS that mark — you can see it.

rules (in order):
1. GROUND IN THE IMAGE. before answering, notice what is actually visible (product name, UI labels, charts, code, urls, logos, colors). your answer must be about THAT mark, not a generic web FAQ on the topic words alone.
2. ANSWER THE ASK using the screenshot as primary evidence. quote visible labels when useful.
3. TOOLS ARE SECONDARY. use web_search / fetch_url only when the image cannot answer (missing docs, need a link, confirm pricing). never replace the screenshot with a generic "how to get X" guide that ignores what was marked.
4. LOCAL CONTEXT is optional background. use list_local_repos / grep only if the mark looks related. never force an unrelated local project.
5. if the crop is blank/unreadable, say so clearly instead of inventing.
6. be concrete. short markdown ok. no filler about missing git/claude sessions.
7. don't invent file paths or repos that aren't in tool results or provided context.`;

function buildUserPrompt(question) {
  const q = (question || "").trim();
  if (q) {
    return (
      "User question about the marked screenshot above:\n" +
      q +
      "\n\nRespond about what is visible in the image. Do not ignore the screenshot."
    );
  }
  return "Look at the marked screenshot above and explain what it is showing.";
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
        media_type: mediaType || "image/png",
        data: imageBase64,
      },
    },
    {
      type: "text",
      text:
        "↑ This image is the user's freehand-marked screen region. Treat it as the subject of the question.",
    },
  ];

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
  question,
  maxTranscriptChars,
  maxDiffChars,
  searchRoots,
  maxRepos,
  scanLocalRepos,
  conversationHistory,
  thinking,
  thinkingBudgetTokens,
}) {
  if (!apiKey && !proxyBase()) {
    throw new Error(
      "Missing API key. Set ANTHROPIC_API_KEY or run: flickctx config --api-key sk-ant-... (or set FLICKCTX_PROXY_URL for the optional worker proxy)"
    );
  }

  let b64 = imageBase64;
  let type = mediaType || "image/png";
  let imageBytes = 0;
  if (!b64) {
    if (!imagePath || !fs.existsSync(imagePath)) {
      throw new Error("No screenshot provided.");
    }
    const buf = fs.readFileSync(imagePath);
    imageBytes = buf.length;
    if (imageBytes < 200) {
      throw new Error(
        `Captured crop looks empty (${imageBytes} bytes). Try marking again — check Screen Recording permission if on macOS.`
      );
    }
    b64 = buf.toString("base64");
    type = mediaTypeFor(imagePath);
  } else {
    imageBytes = Math.floor((b64.length * 3) / 4);
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
    imageBase64: b64,
    mediaType: type,
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
    contextMeta: ctx.meta,
    projectPath: ctx.projectPath,
    contextPreview: ctx.text.slice(0, 1500),
    imagePath: imagePath || null,
    imageBytes,
    imageBase64Len: b64.length,
    question: question || "",
  };
}

module.exports = {
  explainSelection,
  runAgent,
  SYSTEM,
  buildUserPrompt,
};
