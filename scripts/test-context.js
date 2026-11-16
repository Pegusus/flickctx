#!/usr/bin/env node
const path = require("path");
const { gatherContext, encodeClaudeProjectDir } = require("../src/context");
const { loadConfig } = require("../src/config");

const projectPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(__dirname, "..");

const config = loadConfig();
const ctx = gatherContext({
  projectPath,
  maxTranscriptChars: config.maxTranscriptChars,
  maxDiffChars: config.maxDiffChars,
});

console.log("encoded claude dir:", encodeClaudeProjectDir(projectPath));
console.log("meta:", ctx.meta);
console.log("---");
console.log(ctx.text.slice(0, 2500));
console.log(ctx.text.length > 2500 ? "\n…(truncated)…" : "");
