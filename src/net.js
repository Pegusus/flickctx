/**
 * Network safety for tool fetches — block private / metadata targets.
 */

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInt(ip) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isPrivateIpv4(ip) {
  const n = ipv4ToInt(ip);
  if (n == null) return false;
  // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16, 172.16.0.0/12, 192.168.0.0/16
  if (n >= 0x0a000000 && n <= 0x0affffff) return true;
  if (n >= 0x7f000000 && n <= 0x7fffffff) return true;
  if (n >= 0xa9fe0000 && n <= 0xa9feffff) return true;
  if (n >= 0xac100000 && n <= 0xac1fffff) return true;
  if (n >= 0xc0a80000 && n <= 0xc0a8ffff) return true;
  // 0.0.0.0/8
  if (n >= 0x00000000 && n <= 0x00ffffff) return true;
  return false;
}

function isPrivateHostname(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  if (host.includes(":")) {
    // IPv6 — block loopback / link-local / ULA roughly
    if (
      host === "::1" ||
      host === "::" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80")
    ) {
      return true;
    }
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && isPrivateIpv4(host)) return true;
  return false;
}

/**
 * Validate a URL for public HTTP(S) fetch. Throws or returns { ok, url, error }.
 */
function assertPublicHttpUrl(urlString) {
  let parsed;
  try {
    parsed = new URL(String(urlString || "").trim());
  } catch {
    return { ok: false, error: "invalid url" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "only http(s) urls allowed" };
  }
  if (isPrivateHostname(parsed.hostname)) {
    return { ok: false, error: "private or local hosts are blocked" };
  }
  return { ok: true, url: parsed.toString() };
}

module.exports = {
  assertPublicHttpUrl,
  isPrivateHostname,
  isPrivateIpv4,
};
