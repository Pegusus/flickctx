/**
 * Public Vercel Blob URL for the How-it-works pitch video.
 * Set NEXT_PUBLIC_HOW_VIDEO_URL at build time after uploading with
 * `npm run upload:pitch -- path/to/video.mp4`.
 */
export const HOW_VIDEO_URL =
  process.env.NEXT_PUBLIC_HOW_VIDEO_URL?.trim() || "";
