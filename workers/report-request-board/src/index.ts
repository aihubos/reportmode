import {
  handlePrivateReportRequest,
  type PrivateReportBucket,
} from "./private-reports.js";

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  PRIVATE_REPORTS?: PrivateReportBucket;
  PRIVATE_SESSION_SECRET?: string;
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
  updated_at?: string | null;
  is_admin?: number;
  password_salt?: string;
  password_hash?: string;
};

type ReportViewRow = {
  report_id: string;
  view_count: number;
};

type DailyCountRow = {
  date: string;
  count: number;
};

type PopularReportRow = {
  report_id: string;
  view_count: number;
  updated_at: string;
};

type ReportOverrideRow = {
  report_id: string;
  title: string;
  summary: string;
  cover_image?: string | null;
  cover_alt?: string | null;
  updated_at: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://aihubos.github.io",
  "https://aireport.ai-hub-os.com",
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
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

function isReservedAdminName(author: string) {
  const normalized = author.replace(/\s+/g, "").toLocaleLowerCase("en-US");
  return normalized === "jeremy" || normalized === "제레미";
}

function isAdminPassword(env: Env, password: string) {
  return Boolean(env.ADMIN_PASSWORD) && password === env.ADMIN_PASSWORD;
}

function isPublicReportId(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/i.test(value);
}

function imageValue(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 825000) : "";
}

function publicImageUrl(value: unknown) {
  const candidate = imageValue(value);
  if (!candidate) return "";
  const inlineImage = candidate.match(/^data:image\/jpeg;base64,([a-z0-9+/]*={0,2})$/i);
  if (inlineImage) {
    const encoded = inlineImage[1];
    const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
    const byteLength = Math.floor((encoded.length * 3) / 4) - padding;
    if (encoded.length % 4 === 0 && byteLength > 0 && byteLength <= 600 * 1024) {
      return `data:image/jpeg;base64,${encoded}`;
    }
    return "";
  }
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function decodeReportId(value: string) {
  try {
    const reportId = decodeURIComponent(value).slice(0, 120);
    return isPublicReportId(reportId) ? reportId : "";
  } catch {
    return "";
  }
}

function isVisitorId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function seoulDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function visitCounts(env: Env, siteId: string, day: string) {
  const total = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM report_site_visits WHERE site_id = ?"
  ).bind(siteId).first<{ count: number }>();
  const today = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM report_site_visits WHERE site_id = ? AND visit_date = ?"
  ).bind(siteId, day).first<{ count: number }>();
  return { total: Number(total?.count || 0), today: Number(today?.count || 0) };
}

async function analyticsSnapshot(env: Env, day: string) {
  const siteId = "report-hub-main";
  const [site, allViews, todayViews, siteDaily, reportDaily, popularReports] = await Promise.all([
    visitCounts(env, siteId, day),
    env.DB.prepare(
      "SELECT COALESCE(SUM(view_count), 0) AS count FROM report_view_counts"
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM report_view_daily_visitors WHERE view_date = ?"
    ).bind(day).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT visit_date AS date, COUNT(*) AS count FROM report_site_visits WHERE site_id = ? GROUP BY visit_date ORDER BY visit_date DESC LIMIT 31"
    ).bind(siteId).all<DailyCountRow>(),
    env.DB.prepare(
      "SELECT view_date AS date, COUNT(*) AS count FROM report_view_daily_visitors GROUP BY view_date ORDER BY view_date DESC LIMIT 31"
    ).all<DailyCountRow>(),
    env.DB.prepare(
      "SELECT report_id, view_count, updated_at FROM report_view_counts ORDER BY view_count DESC, report_id ASC LIMIT 100"
    ).all<PopularReportRow>(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    site: {
      siteId,
      ...site,
      daily: (siteDaily.results || []).map((row) => ({
        date: row.date,
        count: Math.max(0, Number(row.count || 0)),
      })),
    },
    reports: {
      totalViews: Math.max(0, Number(allViews?.count || 0)),
      todayViews: Math.max(0, Number(todayViews?.count || 0)),
      daily: (reportDaily.results || []).map((row) => ({
        date: row.date,
        count: Math.max(0, Number(row.count || 0)),
      })),
      top: (popularReports.results || []).map((row) => ({
        reportId: row.report_id,
        views: Math.max(0, Number(row.view_count || 0)),
        updatedAt: row.updated_at,
      })),
    },
  };
}

async function featuredReportIds(env: Env) {
  const rows = await env.DB.prepare(
    "SELECT report_id, selected_at FROM report_featured ORDER BY selected_at DESC LIMIT 3"
  ).all<{ report_id: string; selected_at: string }>();
  return (rows.results || []).map((row) => row.report_id);
}

async function draftPromotionIds(env: Env) {
  const rows = await env.DB.prepare(
    "SELECT report_id FROM report_draft_promotions ORDER BY promoted_at DESC LIMIT 500"
  ).all<{ report_id: string }>();
  return (rows.results || []).map((row) => row.report_id);
}

function publicOverride(row: ReportOverrideRow) {
  return {
    reportId: row.report_id,
    title: row.title,
    summary: row.summary,
    coverImage: row.cover_image || null,
    coverAlt: row.cover_alt || null,
    updatedAt: row.updated_at,
  };
}

async function reportOverrides(env: Env) {
  const rows = await env.DB.prepare(
    "SELECT report_id, title, summary, cover_image, cover_alt, updated_at FROM report_overrides ORDER BY updated_at DESC LIMIT 500"
  ).all<ReportOverrideRow>();
  return Object.fromEntries((rows.results || []).map((row) => [row.report_id, publicOverride(row)]));
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
    const privateResponse = await handlePrivateReportRequest(request, env);
    if (privateResponse) return privateResponse;
    if (url.pathname === "/visits" && request.method === "GET") {
      const siteId = clean(url.searchParams.get("site"), 64);
      if (!siteId || !/^[a-z0-9-]+$/i.test(siteId)) return json(request, { error: "invalid_site" }, 400);
      const day = seoulDate();
      return json(request, { siteId, day, ...await visitCounts(env, siteId, day) });
    }

    if (url.pathname === "/visits" && request.method === "POST") {
      let payload: { siteId?: unknown; visitorId?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const siteId = clean(payload.siteId, 64);
      const visitorId = clean(payload.visitorId, 64);
      if (!siteId || !/^[a-z0-9-]+$/i.test(siteId)) return json(request, { error: "invalid_site" }, 400);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitorId)) {
        return json(request, { error: "invalid_visitor" }, 400);
      }
      const day = seoulDate();
      const createdAt = new Date().toISOString();
      const inserted = await env.DB.prepare(
        "INSERT OR IGNORE INTO report_site_visits (site_id, visitor_id, visit_date, created_at) VALUES (?, ?, ?, ?)"
      ).bind(siteId, visitorId, day, createdAt).run();
      const counts = await visitCounts(env, siteId, day);
      return json(request, { siteId, day, counted: Number(inserted.meta?.changes || 0) > 0, ...counts });
    }

    if (url.pathname === "/report-views" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT report_id, view_count FROM report_view_counts ORDER BY view_count DESC, report_id ASC LIMIT 1000"
      ).all<ReportViewRow>();
      const counts = Object.fromEntries(
        (rows.results || []).map((row) => [row.report_id, Math.max(0, Number(row.view_count || 0))])
      );
      return json(request, { counts, checkedAt: new Date().toISOString() });
    }

    if (url.pathname === "/report-views" && request.method === "POST") {
      let payload: { reportId?: unknown; visitorId?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const reportId = clean(payload.reportId, 120);
      const visitorId = clean(payload.visitorId, 64);
      if (!isPublicReportId(reportId) || !isVisitorId(visitorId)) {
        return json(request, { error: "invalid_report_view" }, 400);
      }
      const day = seoulDate();
      const createdAt = new Date().toISOString();
      const [inserted, selected] = await env.DB.batch([
        env.DB.prepare(
          "INSERT OR IGNORE INTO report_view_daily_visitors (report_id, visitor_id, view_date, created_at) VALUES (?, ?, ?, ?)"
        ).bind(reportId, visitorId, day, createdAt),
        env.DB.prepare(
          "SELECT report_id, view_count FROM report_view_counts WHERE report_id = ?"
        ).bind(reportId),
      ]);
      const row = (selected.results || [])[0] as ReportViewRow | undefined;
      return json(request, {
        reportId,
        day,
        counted: Number(inserted.meta?.changes || 0) > 0,
        count: Math.max(0, Number(row?.view_count || 0)),
      });
    }

    if (url.pathname === "/comments" && request.method === "GET") {
      const reportId = clean(url.searchParams.get("report"), 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      const rows = await env.DB.prepare(
        "SELECT id, report_id, author, content, created_at, updated_at, is_admin FROM report_comments WHERE report_id = ? ORDER BY created_at DESC LIMIT 50"
      ).bind(reportId).all<CommentRow>();
      return json(request, { comments: rows.results || [] });
    }

    if (url.pathname === "/comments/recent" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT id, report_id, author, content, created_at, updated_at, is_admin FROM report_comments ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1000"
      ).all<CommentRow>();
      return json(request, { comments: rows.results || [] });
    }

    if (url.pathname === "/comments" && request.method === "POST") {
      let payload: { reportId?: unknown; author?: unknown; content?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const reportId = clean(payload.reportId, 120);
      const author = clean(payload.author, 24);
      const content = clean(payload.content, 500);
      const password = passwordValue(payload.password);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (password.length < 4) return json(request, { error: "password_too_short" }, 400);
      if (!reportId || content.length < 2) return json(request, { error: "invalid_comment" }, 400);
      const reservedName = isReservedAdminName(author);
      if (reservedName && !isAdminPassword(env, password)) return json(request, { error: "reserved_admin_name" }, 403);
      const salt = crypto.randomUUID();
      const row: CommentRow = {
        id: crypto.randomUUID(),
        report_id: reportId,
        author,
        content,
        created_at: new Date().toISOString(),
        updated_at: null,
        is_admin: reservedName ? 1 : 0,
      };
      const passwordHash = await hashPassword(password, salt);
      await env.DB.prepare(
        "INSERT INTO report_comments (id, report_id, author, content, password_salt, password_hash, created_at, updated_at, is_admin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(row.id, row.report_id, row.author, row.content, salt, passwordHash, row.created_at, row.updated_at, row.is_admin).run();
      return json(request, { comment: row }, 201);
    }

    var commentId = url.pathname.match(/^\/comments\/([0-9a-f-]{36})$/i)?.[1];
    if (commentId && request.method === "PATCH") {
      let payload: { author?: unknown; content?: unknown; password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const author = clean(payload.author, 24);
      const content = clean(payload.content, 500);
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (content.length < 2) return json(request, { error: "invalid_comment" }, 400);
      if (password.length < 4 && adminPassword.length < 4) return json(request, { error: "password_too_short" }, 400);
      const comment = await env.DB.prepare(
        "SELECT id, report_id, author, content, created_at, updated_at, is_admin, password_salt, password_hash FROM report_comments WHERE id = ?"
      ).bind(commentId).first<CommentRow>();
      if (!comment) return json(request, { error: "not_found" }, 404);
      const admin = isAdminPassword(env, adminPassword) || isAdminPassword(env, password);
      if (!admin) {
        if (!comment.password_salt || !comment.password_hash || await hashPassword(password, comment.password_salt) !== comment.password_hash) {
          return json(request, { error: "wrong_password" }, 403);
        }
      }
      const reservedName = isReservedAdminName(author);
      if (reservedName && !admin) return json(request, { error: "reserved_admin_name" }, 403);
      const updatedAt = new Date().toISOString();
      const isAdmin = reservedName ? 1 : 0;
      await env.DB.prepare(
        "UPDATE report_comments SET author = ?, content = ?, updated_at = ?, is_admin = ? WHERE id = ?"
      ).bind(author, content, updatedAt, isAdmin, commentId).run();
      return json(request, {
        comment: {
          id: commentId,
          report_id: comment.report_id,
          author,
          content,
          created_at: comment.created_at,
          updated_at: updatedAt,
          is_admin: isAdmin,
        },
      });
    }

    if (commentId && request.method === "DELETE") {
      let payload: { password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      const isAdmin = isAdminPassword(env, adminPassword) || isAdminPassword(env, password);
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

    if (url.pathname === "/admin/verify" && request.method === "POST") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      return json(request, { ok: true });
    }

    if (url.pathname === "/admin/analytics" && request.method === "POST") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      return json(request, await analyticsSnapshot(env, seoulDate()));
    }

    if (url.pathname === "/report-overrides" && request.method === "GET") {
      return json(request, { overrides: await reportOverrides(env) });
    }

    const reportOverrideId = url.pathname.match(/^\/report-overrides\/([^/]+)$/i)?.[1];
    if (reportOverrideId && request.method === "PUT") {
      let payload: { title?: unknown; summary?: unknown; coverImage?: unknown; coverAlt?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = decodeReportId(reportOverrideId);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      const title = clean(payload.title, 140);
      const summary = clean(payload.summary, 480);
      const requestedCover = imageValue(payload.coverImage);
      const coverImage = publicImageUrl(requestedCover);
      const coverAlt = coverImage ? clean(payload.coverAlt, 160) : "";
      if (title.length < 2) return json(request, { error: "title_too_short" }, 400);
      if (summary.length < 4) return json(request, { error: "summary_too_short" }, 400);
      if (requestedCover && !coverImage) return json(request, { error: "invalid_cover_url" }, 400);
      const updatedAt = new Date().toISOString();
      const row: ReportOverrideRow = {
        report_id: reportId,
        title,
        summary,
        cover_image: coverImage || null,
        cover_alt: coverAlt || null,
        updated_at: updatedAt,
      };
      await env.DB.prepare(
        `INSERT INTO report_overrides (report_id, title, summary, cover_image, cover_alt, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(report_id) DO UPDATE SET
           title = excluded.title,
           summary = excluded.summary,
           cover_image = excluded.cover_image,
           cover_alt = excluded.cover_alt,
           updated_at = excluded.updated_at`
      ).bind(row.report_id, row.title, row.summary, row.cover_image, row.cover_alt, row.updated_at).run();
      return json(request, { override: publicOverride(row) }, 201);
    }

    if (reportOverrideId && request.method === "DELETE") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = decodeReportId(reportOverrideId);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      await env.DB.prepare("DELETE FROM report_overrides WHERE report_id = ?").bind(reportId).run();
      return json(request, { ok: true, reportId });
    }

    if (url.pathname === "/hidden-reports" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "SELECT report_id FROM report_hidden ORDER BY hidden_at DESC LIMIT 500"
      ).all<{ report_id: string }>();
      return json(request, { reportIds: (rows.results || []).map((row) => row.report_id) });
    }

    if (url.pathname === "/featured-reports" && request.method === "GET") {
      return json(request, { reportIds: await featuredReportIds(env) });
    }

    if (url.pathname === "/draft-promotions" && request.method === "GET") {
      return json(request, { reportIds: await draftPromotionIds(env) });
    }

    if (url.pathname === "/draft-promotions" && request.method === "POST") {
      let payload: { reportId?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = clean(payload.reportId, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      await env.DB.prepare(
        `INSERT INTO report_draft_promotions (report_id, promoted_at) VALUES (?, ?)
         ON CONFLICT(report_id) DO UPDATE SET promoted_at = excluded.promoted_at`
      ).bind(reportId, new Date().toISOString()).run();
      return json(request, { ok: true, reportIds: await draftPromotionIds(env) }, 201);
    }

    const draftPromotionId = url.pathname.match(/^\/draft-promotions\/([^/]+)$/i)?.[1];
    if (draftPromotionId && request.method === "DELETE") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = decodeURIComponent(draftPromotionId).slice(0, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      await env.DB.prepare("DELETE FROM report_draft_promotions WHERE report_id = ?").bind(reportId).run();
      return json(request, { ok: true, reportIds: await draftPromotionIds(env) });
    }

    if (url.pathname === "/featured-reports" && request.method === "POST") {
      let payload: { reportId?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = clean(payload.reportId, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM report_featured").first<{ count: number }>();
      if (Number(count?.count || 0) >= 3) return json(request, { error: "featured_limit_reached" }, 409);
      await env.DB.prepare(
        "INSERT INTO report_featured (report_id, selected_at) VALUES (?, ?)"
      ).bind(reportId, new Date().toISOString()).run();
      return json(request, { ok: true, reportIds: await featuredReportIds(env) }, 201);
    }

    const featuredId = url.pathname.match(/^\/featured-reports\/([^/]+)$/i)?.[1];
    if (featuredId && request.method === "DELETE") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = decodeURIComponent(featuredId).slice(0, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      await env.DB.prepare("DELETE FROM report_featured WHERE report_id = ?").bind(reportId).run();
      return json(request, { ok: true, reportIds: await featuredReportIds(env) });
    }

    if (url.pathname === "/hidden-reports" && request.method === "POST") {
      let payload: { reportId?: unknown; adminPassword?: unknown; note?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = clean(payload.reportId, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      const note = clean(payload.note, 120);
      const hiddenAt = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO report_hidden (report_id, hidden_at, note)
         VALUES (?, ?, ?)
         ON CONFLICT(report_id) DO UPDATE SET hidden_at = excluded.hidden_at, note = excluded.note`
      ).bind(reportId, hiddenAt, note).run();
      return json(request, { ok: true, reportId, hidden_at: hiddenAt });
    }

    const hiddenId = url.pathname.match(/^\/hidden-reports\/([^/]+)$/i)?.[1];
    if (hiddenId && request.method === "DELETE") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const reportId = decodeURIComponent(hiddenId).slice(0, 120);
      if (!reportId) return json(request, { error: "missing_report" }, 400);
      await env.DB.prepare("DELETE FROM report_hidden WHERE report_id = ?").bind(reportId).run();
      return json(request, { ok: true, reportId });
    }

    if (url.pathname === "/comments" || url.pathname === "/comments/recent" || commentId || url.pathname === "/visits" || url.pathname === "/report-views" || url.pathname === "/requests" || requestId || replyRequestId || url.pathname.startsWith("/hidden-reports") || url.pathname.startsWith("/featured-reports") || url.pathname.startsWith("/draft-promotions") || url.pathname.startsWith("/report-overrides") || url.pathname === "/admin/verify" || url.pathname === "/admin/analytics") {
      return json(request, { error: "method_not_allowed" }, 405);
    }
    return json(request, { error: "not_found" }, 404);
  },
};
