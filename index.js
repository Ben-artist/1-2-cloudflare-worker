
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/**
 * Handle POST to DeepSeek chat completions.
 * Body shape:
 * {
 *   messages?: Array<{ role: string; content: string }>,
 *   nextMessages?: Array<{ role: string; content: string }>,
 *   systemMessage?: { role: string; content: string },
 *   model?: string,
 *   stream?: boolean
 * }
 * Use secret: env.DEEPSEEK_API_KEY (set via `wrangler secret put DEEPSEEK_API_KEY`)
 */
async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      messages,
      nextMessages,
      systemMessage,
      model = "deepseek-chat",
      stream = true,
    } = body || {};

    const userMessages = Array.isArray(messages)
      ? messages
      : Array.isArray(nextMessages)
        ? nextMessages
        : [];

    const finalMessages = [
      systemMessage || { role: "system", content: "You are a helpful assistant." },
      ...userMessages.map(m => ({ role: m.role, content: m.content })),
    ];

    if (!env || !env.DEEPSEEK_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Missing env.DEEPSEEK_API_KEY" }),
        { status: 500, headers: { "content-type": "application/json", ...CORS_HEADERS } }
      );
    }

    const upstreamResp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({ model, messages: finalMessages, stream }),
    });

    const responseHeaders = new Headers(upstreamResp.headers);
    responseHeaders.set("Access-Control-Allow-Origin", CORS_HEADERS["Access-Control-Allow-Origin"]);
    responseHeaders.set("Access-Control-Allow-Methods", CORS_HEADERS["Access-Control-Allow-Methods"]);
    responseHeaders.set("Access-Control-Allow-Headers", CORS_HEADERS["Access-Control-Allow-Headers"]);

    return new Response(upstreamResp.body, {
      status: upstreamResp.status,
      statusText: upstreamResp.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ errors: [{ message: err?.message || String(err) }] }),
      { status: 400, headers: { "content-type": "application/json", ...CORS_HEADERS } }
    );
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      return onRequestPost({ request, env });
    }

    return new Response(
      JSON.stringify({ error: "Only POST is supported" }),
      { status: 405, headers: { "content-type": "application/json", ...CORS_HEADERS } }
    );
  },
};
