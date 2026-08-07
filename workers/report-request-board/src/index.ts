interface Env {
  DB: D1Database;
}

type RequestRow = {
  id: string;
  topic: string;
  context: string;
  created_at: string;
};

type CommentRow = {
  id: string;
  report_id: string;
  author: string;
  content: string;
  created_at: string;
  password_salt?: string;
  password_hash?: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://aihubos.github.io",
  "http://127.0.0.1:8799",
  "http://localhost:8799",
]);

function cors(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)
    ? origin
    : "https://aihubos.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

function encode(value: string) { return new TextEncoder().encode(value); }

async function hashPassword(password: string, salt: string) {
  const digest = await crypto.subtle.digest("SHA-256", encode(salt + ":" + password));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === "/comments" && request.method === "GET") {
      const reportId = clean(url.searchParams.get("report"), 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      const rows = await env.DB.prepare(
        "SELECT id, report_id, author, content, created_at FROM report_comments WHERE report_id = ? ORDER BY created_at DESC LIMIT 50"
      ).bind(reportId).all<CommentRow>();
      return json(request, { comments: rows.results || [] });
    }

    if (url.pathname === "/comments" && request.method === "POST") {
      let payload: { reportId?: unknown; author?: unknown; content?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const reportId = clean(payload.reportId, 120);
      const author = clean(payload.author, 24) || "익명";
      const content = clean(payload.content, 500);
      const password = typeof payload.password === "string" ? payload.password : "";
      if (!reportId || content.length < 2 || password.length < 4) return json(request, { error: "invalid_comment" }, 400);
      const salt = crypto.randomUUID();
      const row: CommentRow = { id: crypto.randomUUID(), report_id: reportId, author, content, created_at: new Date().toISOString() };
      const passwordHash = await hashPassword(password, salt);
      await env.DB.prepare(
        "INSERT INTO report_comments (id, report_id, author, content, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(row.id, row.report_id, row.author, row.content, salt, passwordHash, row.created_at).run();
      return json(request, { comment: row }, 201);
    }

    var commentId = url.pathname.match(/^\/comments\/([0-9a-f-]{36})$/i)?.[1];
    if (commentId && request.method === "DELETE") {
      let payload: { password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const password = typeof payload.password === "string" ? payload.password : "";
      const comment = await env.DB.prepare(
        "SELECT id, password_salt, password_hash FROM report_comments WHERE id = ?"
      ).bind(commentId).first<CommentRow>();
      if (!comment || !comment.password_salt || !comment.password_hash) return json(request, { error: "not_found" }, 404);
      if (await hashPassword(password, comment.password_salt) !== comment.password_hash) return json(request, { error: "wrong_password" }, 403);
      await env.DB.prepare("DELETE FROM report_comments WHERE id = ?").bind(commentId).run();
      return json(request, { ok: true });
    }

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
      const topic = clean(payload.topic, 240);
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
