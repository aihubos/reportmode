interface Env {
  DB: D1Database;
}

type RequestRow = {
  id: string;
  topic: string;
  context: string;
  created_at: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://aihubos.github.io",
  "http://127.0.0.1:8799",
  "http://localhost:8799",
]);

function cors(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) ? origin : "https://aihubos.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(request) },
  });
}

function clean(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname !== "/requests") return json(request, { error: "not_found" }, 404);

    if (request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, topic, context, created_at FROM report_requests WHERE status = 'pending' ORDER BY created_at DESC LIMIT 12"
      ).all<RequestRow>();
      return json(request, { requests: rows.results || [] });
    }

    if (request.method === "POST") {
      let payload: { topic?: unknown; context?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const topic = clean(payload.topic, 80);
      const context = clean(payload.context, 300);
      if (topic.length < 4) return json(request, { error: "topic_too_short" }, 400);

      const row: RequestRow = {
        id: crypto.randomUUID(),
        topic,
        context,
        created_at: new Date().toISOString(),
      };
      await env.DB.prepare(
        "INSERT INTO report_requests (id, topic, context, created_at) VALUES (?, ?, ?, ?)"
      ).bind(row.id, row.topic, row.context, row.created_at).run();
      return json(request, { request: row }, 201);
    }

    return json(request, { error: "method_not_allowed" }, 405);
  },
};
