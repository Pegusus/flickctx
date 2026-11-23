/**
 * Flickctx Proxy Worker — forwards /chat to Anthropic Messages API.
 *
 * Set FLICKCTX_PROXY_SECRET (wrangler secret) and send the same value as
 * header `x-flickctx-proxy-secret` from the app (env FLICKCTX_PROXY_SECRET).
 *
 * Routes:
 *   POST /chat  → Anthropic Messages API
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  FLICKCTX_PROXY_SECRET?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authError = requireProxySecret(request, env);
    if (authError) return withCors(authError);

    try {
      if (url.pathname === "/chat") {
        return withCors(await handleChat(request, env));
      }
    } catch (error) {
      console.error(`[${url.pathname}] Unhandled error:`, error);
      return withCors(
        new Response(JSON.stringify({ error: String(error) }), {
          status: 500,
          headers: { "content-type": "application/json" },
        })
      );
    }

    return new Response("Not found", { status: 404 });
  },
};

function requireProxySecret(request: Request, env: Env): Response | null {
  const expected = (env.FLICKCTX_PROXY_SECRET || "").trim();
  if (!expected) {
    // Misconfigured deploy — refuse rather than open-proxy the API key.
    return new Response(
      JSON.stringify({
        error:
          "Worker missing FLICKCTX_PROXY_SECRET. Set with: wrangler secret put FLICKCTX_PROXY_SECRET",
      }),
      { status: 503, headers: { "content-type": "application/json" } }
    );
  }
  const got = (request.headers.get("x-flickctx-proxy-secret") || "").trim();
  if (!got || got !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  return null;
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, x-flickctx-proxy-secret",
  };
}

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders())) headers.set(k, v);
  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = await request.text();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`[/chat] Anthropic API error ${response.status}: ${errorBody}`);
    return new Response(errorBody, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "application/json",
      "cache-control": "no-cache",
    },
  });
}
