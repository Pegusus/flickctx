#!/usr/bin/env node
/**
 * Upload an MP4 to the Vercel Blob store and print the public URL.
 *
 * Prerequisites:
 *   1. In Vercel → Blob store → Connect Project (injects BLOB_READ_WRITE_TOKEN)
 *   2. Locally: `vercel link` then `vercel env pull`  (or export the token)
 *   3. npm i  (installs @vercel/blob)
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... node scripts/upload-pitch.mjs ./pitch.mp4
 *   npm run upload:pitch -- ./pitch.mp4
 *
 * Then set NEXT_PUBLIC_HOW_VIDEO_URL to the printed URL and rebuild/redeploy.
 */
import { readFileSync, existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { put } from "@vercel/blob";

const fileArg = process.argv[2];
if (!fileArg) {
  console.error("Usage: npm run upload:pitch -- <path-to.mp4>");
  process.exit(1);
}

const filePath = resolve(fileArg);
if (!existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "Missing BLOB_READ_WRITE_TOKEN.\n" +
      "Connect the Blob store to your Vercel project, then run:\n" +
      "  npx vercel link && npx vercel env pull\n" +
      "Or export the token from the Blob store Settings page."
  );
  process.exit(1);
}

const name = basename(filePath).replace(/[^\w.\-]+/g, "-");
const pathname = `pitch/how-it-works-${Date.now()}-${name}`;
const body = readFileSync(filePath);

console.log(`Uploading ${filePath} → ${pathname} …`);

const blob = await put(pathname, body, {
  access: "public",
  contentType: "video/mp4",
  multipart: body.byteLength > 4 * 1024 * 1024,
});

console.log("\nPublic URL:");
console.log(blob.url);
console.log(
  "\nAdd to Vercel project env (Production + Preview) and rebuild:"
);
console.log(`  NEXT_PUBLIC_HOW_VIDEO_URL=${blob.url}`);
console.log("\nOr for a local build:");
console.log(`  NEXT_PUBLIC_HOW_VIDEO_URL='${blob.url}' npm run build`);
