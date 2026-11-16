/**
 * Prepare screenshots for the vision API: resize long edge + JPEG encode.
 * Uses Electron nativeImage when available (desktop); falls back to raw PNG for CLI.
 */

const fs = require("fs");
const path = require("path");

const DEFAULT_MAX_EDGE = 1600;
const DEFAULT_JPEG_QUALITY = 80;

function tryNativeImage() {
  try {
    // Only works inside Electron (main/renderer). CLI `node` won't have this.
    return require("electron").nativeImage;
  } catch {
    return null;
  }
}

/**
 * @param {Buffer|string} input - PNG/JPEG buffer or file path
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {{ buffer: Buffer, mediaType: string, width: number, height: number, bytes: number }}
 */
function prepareVisionImage(input, opts = {}) {
  const maxEdge = Math.max(640, Number(opts.maxEdge) || DEFAULT_MAX_EDGE);
  const quality = Math.min(95, Math.max(40, Number(opts.quality) || DEFAULT_JPEG_QUALITY));

  let buf = Buffer.isBuffer(input)
    ? input
    : fs.readFileSync(path.resolve(String(input)));

  const nativeImage = tryNativeImage();
  if (!nativeImage) {
    const ext = Buffer.isBuffer(input)
      ? "png"
      : path.extname(String(input)).toLowerCase().replace(".", "") || "png";
    const mediaType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png";
    return {
      buffer: buf,
      mediaType,
      width: 0,
      height: 0,
      bytes: buf.length,
      compressed: false,
    };
  }

  let img = nativeImage.createFromBuffer(buf);
  if (img.isEmpty()) {
    throw new Error("Could not decode screenshot for vision prep.");
  }

  let { width, height } = img.getSize();
  const longEdge = Math.max(width, height);
  if (longEdge > maxEdge) {
    const scale = maxEdge / longEdge;
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    img = img.resize({ width: w, height: h, quality: "best" });
    ({ width, height } = img.getSize());
  }

  const jpeg = img.toJPEG(quality);
  return {
    buffer: jpeg,
    mediaType: "image/jpeg",
    width,
    height,
    bytes: jpeg.length,
    compressed: true,
  };
}

function toBase64Payload(prepared) {
  return {
    base64: prepared.buffer.toString("base64"),
    mediaType: prepared.mediaType,
    width: prepared.width,
    height: prepared.height,
    bytes: prepared.bytes,
  };
}

module.exports = {
  prepareVisionImage,
  toBase64Payload,
  DEFAULT_MAX_EDGE,
  DEFAULT_JPEG_QUALITY,
};
