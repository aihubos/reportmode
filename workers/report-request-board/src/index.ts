interface Env {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
}

type RequestRow = {
  id: string;
  topic: string;
  context: string;
  author: string;
  created_at: string;
  updated_at?: string | null;
  password_salt?: string;
  password_hash?: string;
  admin_reply?: string | null;
  admin_replied_at?: string | null;
  editable?: number;
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
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
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

function passwordValue(value: unknown) {
  return typeof value === "string" ? value.slice(0, 80) : "";
}

async function requestForPassword(env: Env, id: string) {
  return env.DB.prepare(
    "SELECT id, password_salt, password_hash FROM report_requests WHERE id = ? AND status = 'pending'"
  ).bind(id).first<RequestRow>();
}

async function verifyRequestPassword(env: Env, id: string, password: string) {
  const row = await requestForPassword(env, id);
  if (!row) return { error: "not_found" as const, status: 404 };
  if (!row.password_salt || !row.password_hash) return { error: "read_only_request" as const, status: 409 };
  if (await hashPassword(password, row.password_salt) !== row.password_hash) {
    return { error: "wrong_password" as const, status: 403 };
  }
  return { row };
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
      let payload: { password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      const isAdmin = Boolean(env.ADMIN_PASSWORD) && (adminPassword === env.ADMIN_PASSWORD || password === env.ADMIN_PASSWORD);
      const comment = await env.DB.prepare(
        "SELECT id, password_salt, password_hash FROM report_comments WHERE id = ?"
      ).bind(commentId).first<CommentRow>();
      if (!comment) return json(request, { error: "not_found" }, 404);
      if (!isAdmin) {
        if (!comment.password_salt || !comment.password_hash) return json(request, { error: "not_found" }, 404);
        if (!password || await hashPassword(password, comment.password_salt) !== comment.password_hash) {
          return json(request, { error: "wrong_password" }, 403);
        }
      }
      await env.DB.prepare("DELETE FROM report_comments WHERE id = ?").bind(commentId).run();
      return json(request, { ok: true });
    }

    if (url.pathname === "/requests" && request.method === "GET") {
      const rows = await env.DB.prepare(
        `SELECT r.id, r.topic, r.context, r.author, r.created_at, r.updated_at,
                CASE WHEN length(r.password_hash) > 0 THEN 1 ELSE 0 END AS editable,
                rr.content AS admin_reply, rr.created_at AS admin_replied_at
           FROM report_requests r
           LEFT JOIN report_request_replies rr ON rr.request_id = r.id
          WHERE r.status = 'pending'
          ORDER BY r.created_at DESC
          LIMIT 20`
      ).all<RequestRow>();
      return json(request, { requests: rows.results || [] });
    }

    if (url.pathname === "/requests" && request.method === "POST") {
      let payload: { topic?: unknown; context?: unknown; author?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const topic = clean(payload.topic, 240);
      const context = clean(payload.context, 300);
      const author = clean(payload.author, 24);
      const password = passwordValue(payload.password);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (topic.length < 4) return json(request, { error: "topic_too_short" }, 400);
      if (password.length < 4) return json(request, { error: "password_too_short" }, 400);

      const row: RequestRow = {
        id: crypto.randomUUID(),
        topic,
        context,
        author,
        created_at: new Date().toISOString(),
      };
      const salt = crypto.randomUUID();
      const passwordHash = await hashPassword(password, salt);
      await env.DB.prepare(
        "INSERT INTO report_requests (id, topic, context, author, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(row.id, row.topic, row.context, row.author, salt, passwordHash, row.created_at).run();
      return json(request, { request: row }, 201);
    }

    const replyRequestId = url.pathname.match(/^\/requests\/([0-9a-f-]{36})\/reply$/i)?.[1];
    if (replyRequestId && request.method === "POST") {
      let payload: { reply?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const reply = clean(payload.reply, 600);
      const adminPassword = passwordValue(payload.adminPassword);
      if (reply.length < 2) return json(request, { error: "reply_too_short" }, 400);
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (adminPassword !== env.ADMIN_PASSWORD) return json(request, { error: "wrong_admin_password" }, 403);
      const existing = await env.DB.prepare(
        "SELECT id FROM report_requests WHERE id = ? AND status = 'pending'"
      ).bind(replyRequestId).first<{ id: string }>();
      if (!existing) return json(request, { error: "not_found" }, 404);
      const repliedAt = new Date().toISOString();
      const replyId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO report_request_replies (id, request_id, content, created_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(request_id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at`
      ).bind(replyId, replyRequestId, reply, repliedAt).run();
      return json(request, { reply: { request_id: replyRequestId, content: reply, created_at: repliedAt } });
    }

    const requestId = url.pathname.match(/^\/requests\/([0-9a-f-]{36})$/i)?.[1];
    if (requestId && request.method === "PATCH") {
      let payload: { topic?: unknown; author?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const topic = clean(payload.topic, 240);
      const author = clean(payload.author, 24);
      const password = passwordValue(payload.password);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (topic.length < 4) return json(request, { error: "topic_too_short" }, 400);
      if (password.length < 4) return json(request, { error: "password_too_short" }, 400);
      const verified = await verifyRequestPassword(env, requestId, password);
      if ("error" in verified) return json(request, { error: verified.error }, verified.status);
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE report_requests SET author = ?, topic = ?, updated_at = ? WHERE id = ?"
      ).bind(author, topic, updatedAt, requestId).run();
      return json(request, { request: { id: requestId, author, topic, updated_at: updatedAt } });
    }

    if (requestId && request.method === "DELETE") {
      let payload: { password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      const isAdmin = Boolean(env.ADMIN_PASSWORD) && (adminPassword === env.ADMIN_PASSWORD || password === env.ADMIN_PASSWORD);
      if (!isAdmin) {
        const verified = await verifyRequestPassword(env, requestId, password);
        if ("error" in verified) return json(request, { error: verified.error }, verified.status);
      } else {
        const existing = await env.DB.prepare(
          "SELECT id FROM report_requests WHERE id = ? AND status = 'pending'"
        ).bind(requestId).first<{ id: string }>();
        if (!existing) return json(request, { error: "not_found" }, 404);
      }
      await env.DB.batch([
        env.DB.prepare("DELETE FROM report_request_replies WHERE request_id = ?").bind(requestId),
        env.DB.prepare("DELETE FROM report_requests WHERE id = ?").bind(requestId),
      ]);
      return json(request, { ok: true });
    }

    if (url.pathname === "/requests" || requestId || replyRequestId) {
      return json(request, { error: "method_not_allowed" }, 405);
    }
    return json(request, { error: "not_found" }, 404);
  },
};
