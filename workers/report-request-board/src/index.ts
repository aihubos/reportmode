import {
  handlePrivateReportRequest,
  type PrivateReportBucket,
} from "./private-reports.js";
import {
  aggregateSources,
  normalizeAnalyticsDays,
  normalizeEntryPayload,
  zeroFillDailySeries,
} from "./admin-analytics.js";
import { normalizeAdminAction } from "./admin-jobs.js";
import {
  handleLoungeRequest,
  loungeBoardAuth,
  type LoungeEnv,
  type LoungeIdentity,
} from "./lounge-platform.js";

interface Env extends LoungeEnv {
  ADMIN_PASSWORD?: string;
  PRIVATE_REPORTS?: PrivateReportBucket;
  PRIVATE_SESSION_SECRET?: string;
  GITHUB_REPORTMODE_TOKEN?: string;
  LIFECYCLE_WORKER_SECRET?: string;
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

type EntryDailyRow = {
  date: string;
  count: number;
};

type EntrySourceRow = {
  source_type: string;
  count: number;
};

type EntryRecentRow = {
  created_at: string;
  source_type: string;
  referrer_url: string;
  landing_path: string;
  report_id: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
};

type ReportOverrideRow = {
  report_id: string;
  title: string;
  summary: string;
  cover_image?: string | null;
  cover_alt?: string | null;
  updated_at: string;
};

type BoardPostRow = {
  id: string;
  category: string;
  title: string;
  content: string;
  author: string;
  is_admin: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string | null;
  password_salt?: string;
  password_hash?: string;
  user_sub?: string | null;
  reward_builds?: number;
  origin?: string;
  media_url?: string;
  media_type?: string;
  shorts_job_id?: string | null;
};

type BoardCommentRow = {
  id: string;
  post_id: string;
  author: string;
  content: string;
  is_admin: number;
  created_at: string;
  updated_at?: string | null;
  password_salt?: string;
  password_hash?: string;
  user_sub?: string | null;
  reward_builds?: number;
};

const BOARD_CATEGORIES = new Set([
  "report_opinion",
  "ai_question",
  "knowledge_share",
  "free_opinion",
]);

const BOARD_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
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

function cleanMultiline(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, limit)
    : "";
}

function boardCategory(value: unknown) {
  const category = clean(value, 32);
  return BOARD_CATEGORIES.has(category) ? category : "";
}

function boardId(value: string) {
  try {
    const id = decodeURIComponent(value).trim().slice(0, 64);
    return BOARD_UUID_PATTERN.test(id) ? id : "";
  } catch {
    return "";
  }
}

function boardSort(value: string) {
  return value === "comments" || value === "views" ? value : "latest";
}

function boardPage(value: string) {
  const page = Math.trunc(Number(value || 1));
  return Number.isFinite(page) ? Math.max(1, Math.min(page, 100000)) : 1;
}

function boardPageSize(value: string) {
  const size = Math.trunc(Number(value || 20));
  return Number.isFinite(size) ? Math.max(1, Math.min(size, 30)) : 20;
}

function boardPublicPost(row: BoardPostRow) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    content: row.content,
    author: row.author,
    is_admin: Number(row.is_admin || 0),
    view_count: Math.max(0, Number(row.view_count || 0)),
    comment_count: Math.max(0, Number(row.comment_count || 0)),
    created_at: row.created_at,
    updated_at: row.updated_at || null,
    origin: row.origin || "manual",
    mediaUrl: row.media_url || "",
    mediaType: row.media_type || "",
    shortsJobId: row.shorts_job_id || "",
  };
}

function boardPublicComment(row: BoardCommentRow) {
  return {
    id: row.id,
    post_id: row.post_id,
    author: row.author,
    content: row.content,
    is_admin: Number(row.is_admin || 0),
    created_at: row.created_at,
    updated_at: row.updated_at || null,
  };
}

async function boardPostForPassword(env: Env, id: string) {
  return env.DB.prepare(
    "SELECT id, password_salt, password_hash, user_sub, reward_builds, origin FROM board_posts WHERE id = ?"
  ).bind(id).first<BoardPostRow>();
}

async function boardCommentForPassword(env: Env, id: string) {
  return env.DB.prepare(
    "SELECT id, post_id, password_salt, password_hash, user_sub, reward_builds FROM board_comments WHERE id = ?"
  ).bind(id).first<BoardCommentRow>();
}

function boardIdentityAuthor(identity: LoungeIdentity) {
  return clean(identity.name, 24) || clean(identity.email.split("@")[0], 24) || "빌더";
}

function boardIdentityCanEdit(identity: LoungeIdentity | null, row: { user_sub?: string | null }) {
  return Boolean(identity && (identity.isAdmin || (row.user_sub && row.user_sub === identity.sub)));
}

async function verifyBoardPassword(env: Env, row: { password_salt?: string; password_hash?: string } | null, password: string) {
  if (!row) return false;
  return Boolean(row.password_salt && row.password_hash)
    && await hashPassword(password, row.password_salt!) === row.password_hash;
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
  return /^[a-z0-9][a-z0-9.-]{0,119}$/i.test(value);
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

function dateShift(date: string, offset: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

async function analyticsSnapshot(env: Env, day: string, requestedDays: unknown = 30) {
  const siteId = "report-hub-main";
  const days = normalizeAnalyticsDays(requestedDays);
  const startDate = dateShift(day, -(days - 1));
  const [site, allViews, todayViews, siteDaily, reportDaily, popularReports, entryDaily, entrySources, entryRecent] = await Promise.all([
    visitCounts(env, siteId, day),
    env.DB.prepare(
      "SELECT COALESCE(SUM(view_count), 0) AS count FROM report_view_counts"
    ).first<{ count: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) AS count FROM report_view_daily_visitors WHERE view_date = ?"
    ).bind(day).first<{ count: number }>(),
    env.DB.prepare(
      `SELECT visit_date AS date, COUNT(*) AS count FROM report_site_visits
       WHERE site_id = ? AND visit_date >= ? GROUP BY visit_date ORDER BY visit_date DESC LIMIT ${days}`
    ).bind(siteId, startDate).all<DailyCountRow>(),
    env.DB.prepare(
      `SELECT view_date AS date, COUNT(*) AS count FROM report_view_daily_visitors
       WHERE view_date >= ? GROUP BY view_date ORDER BY view_date DESC LIMIT ${days}`
    ).bind(startDate).all<DailyCountRow>(),
    env.DB.prepare(
      "SELECT report_id, view_count, updated_at FROM report_view_counts ORDER BY view_count DESC, report_id ASC LIMIT 100"
    ).all<PopularReportRow>(),
    env.DB.prepare(
      `SELECT entry_date AS date, COUNT(*) AS count FROM report_entry_sessions
       WHERE site_id = ? AND entry_date >= ? GROUP BY entry_date ORDER BY entry_date DESC LIMIT ${days}`
    ).bind(siteId, startDate).all<EntryDailyRow>(),
    env.DB.prepare(
      `SELECT source_type, COUNT(*) AS count FROM report_entry_sessions
       WHERE site_id = ? AND entry_date >= ? GROUP BY source_type ORDER BY count DESC`
    ).bind(siteId, startDate).all<EntrySourceRow>(),
    env.DB.prepare(
      `SELECT created_at, source_type, referrer_url, landing_path, report_id,
              utm_source, utm_medium, utm_campaign
       FROM report_entry_sessions WHERE site_id = ? AND entry_date >= ?
       ORDER BY created_at DESC LIMIT 100`
    ).bind(siteId, startDate).all<EntryRecentRow>(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    site: {
      siteId,
      ...site,
      daily: zeroFillDailySeries(day, days, (siteDaily.results || []).map((row) => ({
        date: row.date,
        count: Math.max(0, Number(row.count || 0)),
      }))),
    },
    reports: {
      totalViews: Math.max(0, Number(allViews?.count || 0)),
      todayViews: Math.max(0, Number(todayViews?.count || 0)),
      daily: zeroFillDailySeries(day, days, (reportDaily.results || []).map((row) => ({
        date: row.date,
        count: Math.max(0, Number(row.count || 0)),
      }))),
      top: (popularReports.results || []).map((row) => ({
        reportId: row.report_id,
        views: Math.max(0, Number(row.view_count || 0)),
        updatedAt: row.updated_at,
      })),
    },
    entries: {
      daily: zeroFillDailySeries(day, days, (entryDaily.results || []).map((row) => ({
        date: row.date,
        count: Math.max(0, Number(row.count || 0)),
      }))),
      sources: aggregateSources(entrySources.results || []),
      recent: (entryRecent.results || []).map((row) => ({
        createdAt: row.created_at,
        source: row.source_type,
        referrerUrl: row.referrer_url,
        landingPath: row.landing_path,
        reportId: row.report_id,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
      })),
    },
  };
}

function reportJobId() {
  return crypto.randomUUID();
}

function validReportIds(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().slice(0, 120))
    .filter((value) => isPublicReportId(value))));
}

async function createReportAdminJob(env: Env, action: string, reportIds: string[]) {
  const id = reportJobId();
  const now = new Date().toISOString();
  const statements = [
    env.DB.prepare(
      `INSERT INTO report_admin_jobs
        (id, action, status, requested_count, requested_at)
       VALUES (?, ?, 'queued', ?, ?)`
    ).bind(id, action, reportIds.length, now),
    ...reportIds.map((reportId) => env.DB.prepare(
      `INSERT INTO report_admin_job_items (job_id, report_id, status, updated_at)
       VALUES (?, ?, 'queued', ?)`
    ).bind(id, reportId, now)),
  ];
  await env.DB.batch(statements);
  return { id, action, status: "queued", requestedCount: reportIds.length, requestedAt: now };
}

async function dispatchReportAdminJob(env: Env, jobId: string) {
  if (!env.GITHUB_REPORTMODE_TOKEN) {
    await env.DB.prepare(
      "UPDATE report_admin_jobs SET status = 'failed', failure_count = requested_count, completed_at = ?, error_message = ? WHERE id = ?"
    ).bind(new Date().toISOString(), "github_lifecycle_not_configured", jobId).run();
    return false;
  }
  let response: Response;
  try {
    response = await fetch("https://api.github.com/repos/aihubos/reportmode/dispatches", {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${env.GITHUB_REPORTMODE_TOKEN}`,
        "User-Agent": "reportmode-lifecycle",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "report-lifecycle",
        client_payload: { jobId },
      }),
    });
  } catch {
    await env.DB.prepare(
      "UPDATE report_admin_jobs SET status = 'failed', failure_count = requested_count, completed_at = ?, error_message = ? WHERE id = ?"
    ).bind(new Date().toISOString(), "github_dispatch_failed", jobId).run();
    return false;
  }
  if (response.ok) return true;
  const errorText = (await response.text()).slice(0, 240) || `github_dispatch_${response.status}`;
  await env.DB.prepare(
    "UPDATE report_admin_jobs SET status = 'failed', failure_count = requested_count, completed_at = ?, error_message = ? WHERE id = ?"
  ).bind(new Date().toISOString(), errorText, jobId).run();
  return false;
}

async function applyVisibilityAction(env: Env, action: "hide" | "unhide", reportIds: string[]) {
  const now = new Date().toISOString();
  if (action === "hide") {
    await env.DB.batch(reportIds.map((reportId) => env.DB.prepare(
      `INSERT INTO report_hidden (report_id, hidden_at, note)
       VALUES (?, ?, '관리자 일괄 숨김')
       ON CONFLICT(report_id) DO UPDATE SET hidden_at = excluded.hidden_at, note = excluded.note`
    ).bind(reportId, now)));
  } else {
    await env.DB.batch(reportIds.map((reportId) => env.DB.prepare(
      "DELETE FROM report_hidden WHERE report_id = ?"
    ).bind(reportId)));
  }
  return reportIds.map((reportId) => ({ reportId, status: "completed" }));
}

function lifecycleAuthorized(request: Request, env: Env) {
  return Boolean(env.LIFECYCLE_WORKER_SECRET)
    && request.headers.get("X-Report-Lifecycle-Secret") === env.LIFECYCLE_WORKER_SECRET;
}

async function lifecycleJob(request: Request, env: Env, jobId: string) {
  const job = await env.DB.prepare(
    `SELECT id, action, status, requested_count, success_count, failure_count,
            requested_at, started_at, completed_at, error_message, result_json
     FROM report_admin_jobs WHERE id = ?`
  ).bind(jobId).first<Record<string, unknown>>();
  if (!job) return json(request, { error: "admin_job_not_found" }, 404);
  const items = await env.DB.prepare(
    `SELECT report_id, status, private_report_id, error_message, updated_at
     FROM report_admin_job_items WHERE job_id = ? ORDER BY report_id ASC`
  ).bind(jobId).all<Record<string, unknown>>();
  return json(request, { job, items: items.results || [] });
}

async function lifecycleStart(request: Request, env: Env, jobId: string) {
  const existing = await env.DB.prepare("SELECT id FROM report_admin_jobs WHERE id = ?").bind(jobId).first<{ id: string }>();
  if (!existing) return json(request, { error: "admin_job_not_found" }, 404);
  await env.DB.prepare(
    "UPDATE report_admin_jobs SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?"
  ).bind(new Date().toISOString(), jobId).run();
  return lifecycleJob(request, env, jobId);
}

async function lifecycleItem(request: Request, env: Env, jobId: string, reportId: string) {
  let payload: { status?: unknown; privateReportId?: unknown; errorMessage?: unknown };
  try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
  const status = clean(payload.status, 20);
  if (!["running", "completed", "failed"].includes(status)) return json(request, { error: "invalid_job_status" }, 400);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE report_admin_job_items SET status = ?, private_report_id = ?, error_message = ?, updated_at = ?
     WHERE job_id = ? AND report_id = ?`
  ).bind(status, clean(payload.privateReportId, 120), clean(payload.errorMessage, 240), now, jobId, reportId).run();
  const counts = await env.DB.prepare(
    `SELECT
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS success_count,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
       COUNT(*) AS requested_count
     FROM report_admin_job_items WHERE job_id = ?`
  ).bind(jobId).first<{ success_count: number; failure_count: number; requested_count: number }>();
  await env.DB.prepare(
    `UPDATE report_admin_jobs SET success_count = ?, failure_count = ?
     WHERE id = ?`
  ).bind(Number(counts?.success_count || 0), Number(counts?.failure_count || 0), jobId).run();
  return lifecycleJob(request, env, jobId);
}

async function lifecycleComplete(request: Request, env: Env, jobId: string) {
  let payload: { status?: unknown; errorMessage?: unknown } = {};
  try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
  const requested = await env.DB.prepare("SELECT requested_count, success_count, failure_count FROM report_admin_jobs WHERE id = ?")
    .bind(jobId).first<{ requested_count: number; success_count: number; failure_count: number }>();
  if (!requested) return json(request, { error: "admin_job_not_found" }, 404);
  const status = ["completed", "partial", "failed"].includes(String(payload.status))
    ? String(payload.status)
    : Number(requested.success_count || 0) === Number(requested.requested_count || 0) ? "completed" : "partial";
  await env.DB.prepare(
    `UPDATE report_admin_jobs SET status = ?, completed_at = ?, error_message = COALESCE(?, error_message)
     WHERE id = ?`
  ).bind(status, new Date().toISOString(), clean(payload.errorMessage, 240) || null, jobId).run();
  return lifecycleJob(request, env, jobId);
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
    const loungeResponse = await handleLoungeRequest(request, env);
    if (loungeResponse) return loungeResponse;
    const privateResponse = await handlePrivateReportRequest(request, env);
    if (privateResponse) return privateResponse;
    if (url.pathname.startsWith("/internal/report-jobs/")) {
      if (!lifecycleAuthorized(request, env)) return json(request, { error: "internal_auth_required" }, 401);
      const startMatch = url.pathname.match(/^\/internal\/report-jobs\/([^/]+)\/start$/i);
      const itemMatch = url.pathname.match(/^\/internal\/report-jobs\/([^/]+)\/items\/([^/]+)$/i);
      const completeMatch = url.pathname.match(/^\/internal\/report-jobs\/([^/]+)\/complete$/i);
      const jobMatch = url.pathname.match(/^\/internal\/report-jobs\/([^/]+)$/i);
      if (startMatch && request.method === "POST") return lifecycleStart(request, env, decodeURIComponent(startMatch[1]));
      if (itemMatch && request.method === "POST") return lifecycleItem(request, env, decodeURIComponent(itemMatch[1]), decodeURIComponent(itemMatch[2]));
      if (completeMatch && request.method === "POST") return lifecycleComplete(request, env, decodeURIComponent(completeMatch[1]));
      if (jobMatch && request.method === "GET") return lifecycleJob(request, env, decodeURIComponent(jobMatch[1]));
      return json(request, { error: "method_not_allowed" }, 405);
    }
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

    if (url.pathname === "/entry-sessions" && request.method === "POST") {
      let payload: Record<string, unknown>;
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const normalized = normalizeEntryPayload(payload);
      const siteId = clean(payload.siteId, 64);
      if (!siteId || !/^[a-z0-9-]+$/i.test(siteId)) return json(request, { error: "invalid_site" }, 400);
      if (!normalized.entryId || !isVisitorId(normalized.visitorId)) {
        return json(request, { error: "invalid_entry_session" }, 400);
      }
      const day = seoulDate();
      const createdAt = new Date().toISOString();
      const inserted = await env.DB.prepare(
        `INSERT OR IGNORE INTO report_entry_sessions
          (entry_id, site_id, visitor_id, entry_date, landing_path, report_id,
           source_type, referrer_host, referrer_path, referrer_url,
           utm_source, utm_medium, utm_campaign, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        normalized.entryId,
        siteId,
        normalized.visitorId,
        day,
        normalized.landingPath,
        normalized.reportId,
        normalized.sourceType,
        normalized.referrerHost,
        normalized.referrerPath,
        normalized.referrerUrl,
        normalized.utmSource,
        normalized.utmMedium,
        normalized.utmCampaign,
        createdAt,
      ).run();
      return json(request, {
        ok: true,
        entryId: normalized.entryId,
        sourceType: normalized.sourceType,
        counted: Number(inserted.meta?.changes || 0) > 0,
      });
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

    if (url.pathname === "/board/posts" && request.method === "GET") {
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const page = boardPage(url.searchParams.get("page") || "1");
      const pageSize = boardPageSize(url.searchParams.get("pageSize") || "20");
      const category = url.searchParams.get("category") === "all"
        ? ""
        : boardCategory(url.searchParams.get("category"));
      const sort = boardSort(clean(url.searchParams.get("sort"), 16));
      const query = cleanMultiline(url.searchParams.get("q"), 120);
      const pattern = query ? "%" + query + "%" : "";
      const orderBy = sort === "comments"
        ? "comment_count DESC, created_at DESC"
        : sort === "views"
          ? "view_count DESC, created_at DESC"
          : "created_at DESC";
      const where = "WHERE (? = '' OR category = ?) " +
        "AND (? = '' OR LOWER(title || ' ' || content || ' ' || author) LIKE LOWER(?))";
      const total = await env.DB.prepare("SELECT COUNT(*) AS count FROM board_posts " + where)
        .bind(category, category, query, pattern)
        .first<{ count: number }>();
      const rows = await env.DB.prepare(
        "SELECT id, category, title, content, author, is_admin, view_count, comment_count, created_at, updated_at, user_sub, origin, media_url, media_type, shorts_job_id " +
        "FROM board_posts " + where +
        " ORDER BY " + orderBy + " LIMIT ? OFFSET ?"
      ).bind(category, category, query, pattern, pageSize, (page - 1) * pageSize).all<BoardPostRow>();
      return json(request, {
        posts: (rows.results || []).map((row) => ({
          ...boardPublicPost(row),
          content: row.content.slice(0, 220),
          can_edit: boardIdentityCanEdit(auth.identity, row),
        })),
        pagination: {
          page,
          pageSize,
          total: Math.max(0, Number(total?.count || 0)),
          totalPages: Math.max(1, Math.ceil(Number(total?.count || 0) / pageSize)),
        },
      });
    }

    if (url.pathname === "/board/posts" && request.method === "POST") {
      let payload: { category?: unknown; title?: unknown; content?: unknown; author?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const category = boardCategory(payload.category);
      const title = clean(payload.title, 100);
      const content = cleanMultiline(payload.content, 5000);
      const author = identity ? boardIdentityAuthor(identity) : clean(payload.author, 24);
      const password = passwordValue(payload.password);
      if (!category) return json(request, { error: "invalid_category" }, 400);
      if (title.length < 4) return json(request, { error: "title_too_short" }, 400);
      if (content.length < 10) return json(request, { error: "content_too_short" }, 400);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (!identity && password.length < 4) return json(request, { error: "password_too_short" }, 400);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password);
      if (isReservedAdminName(author) && !isAdmin) return json(request, { error: "reserved_admin_name" }, 403);
      const now = new Date().toISOString();
      const salt = crypto.randomUUID();
      const row: BoardPostRow = {
        id: crypto.randomUUID(), category, title, content, author,
        is_admin: isAdmin ? 1 : 0, view_count: 0, comment_count: 0,
        created_at: now, updated_at: null, user_sub: identity?.sub || null,
        reward_builds: identity ? 1 : 0,
      };
      const passwordHash = await hashPassword(identity ? crypto.randomUUID() : password, salt);
      const insertPost = env.DB.prepare(
        "INSERT INTO board_posts " +
        "(id, category, title, content, author, password_salt, password_hash, is_admin, view_count, comment_count, created_at, updated_at, user_sub, reward_builds) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, ?)"
      ).bind(row.id, row.category, row.title, row.content, row.author, salt, passwordHash, row.is_admin, row.created_at, row.user_sub, row.reward_builds);
      if (identity) {
        await env.DB.batch([
          insertPost,
          env.DB.prepare(
            "UPDATE lounge_users SET build_balance = build_balance + 1, updated_at = ? WHERE google_sub = ?"
          ).bind(now, identity.sub),
          env.DB.prepare(
            `INSERT INTO lounge_build_ledger
              (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
             SELECT ?, ?, 1, '게시글 작성', 'board_post', ?, build_balance, ?
               FROM lounge_users WHERE google_sub = ?`
          ).bind(crypto.randomUUID(), identity.sub, row.id, now, identity.sub),
        ]);
        const balance = await env.DB.prepare(
          "SELECT build_balance FROM lounge_users WHERE google_sub = ?"
        ).bind(identity.sub).first<{ build_balance: number }>();
        return json(request, { post: boardPublicPost(row), reward: 1, balance: Number(balance?.build_balance || 0) }, 201);
      }
      await insertPost.run();
      return json(request, { post: boardPublicPost(row), reward: 0 }, 201);
    }

    const boardPostId = url.pathname.match(/^\/board\/posts\/([0-9a-f-]{36})$/i)?.[1];
    if (boardPostId && request.method === "GET") {
      const id = boardId(boardPostId);
      if (!id) return json(request, { error: "not_found" }, 404);
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const row = await env.DB.prepare(
        "SELECT id, category, title, content, author, is_admin, view_count, comment_count, created_at, updated_at, user_sub, origin, media_url, media_type, shorts_job_id " +
        "FROM board_posts WHERE id = ?"
      ).bind(id).first<BoardPostRow>();
      if (!row) return json(request, { error: "not_found" }, 404);
      return json(request, { post: { ...boardPublicPost(row), can_edit: boardIdentityCanEdit(auth.identity, row) } });
    }

    if (boardPostId && request.method === "PATCH") {
      const id = boardId(boardPostId);
      if (!id) return json(request, { error: "not_found" }, 404);
      let payload: { category?: unknown; title?: unknown; content?: unknown; author?: unknown; password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const category = boardCategory(payload.category);
      const title = clean(payload.title, 100);
      const content = cleanMultiline(payload.content, 5000);
      const author = identity ? boardIdentityAuthor(identity) : clean(payload.author, 24);
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      if (!category) return json(request, { error: "invalid_category" }, 400);
      if (title.length < 4) return json(request, { error: "title_too_short" }, 400);
      if (content.length < 10) return json(request, { error: "content_too_short" }, 400);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (!identity && password.length < 4 && adminPassword.length < 4) return json(request, { error: "password_too_short" }, 400);
      const row = await boardPostForPassword(env, id);
      if (!row) return json(request, { error: "not_found" }, 404);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password) || isAdminPassword(env, adminPassword);
      const authorized = identity
        ? boardIdentityCanEdit(identity, row)
        : isAdmin || await verifyBoardPassword(env, row, password);
      if (!authorized) return json(request, { error: identity ? "not_owner" : "wrong_password" }, 403);
      if (isReservedAdminName(author) && !isAdmin) return json(request, { error: "reserved_admin_name" }, 403);
      const savedCategory = row.origin === "shorts" ? "knowledge_share" : category;
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE board_posts SET category = ?, title = ?, content = ?, author = ?, is_admin = ?, updated_at = ? WHERE id = ?"
      ).bind(savedCategory, title, content, author, isAdmin ? 1 : 0, updatedAt, id).run();
      const updated = await env.DB.prepare(
        "SELECT id, category, title, content, author, is_admin, view_count, comment_count, created_at, updated_at, user_sub, origin, media_url, media_type, shorts_job_id " +
        "FROM board_posts WHERE id = ?"
      ).bind(id).first<BoardPostRow>();
      return json(request, { post: updated ? boardPublicPost(updated) : null });
    }

    if (boardPostId && request.method === "DELETE") {
      const id = boardId(boardPostId);
      if (!id) return json(request, { error: "not_found" }, 404);
      let payload: { password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      if (!identity && password.length < 4 && adminPassword.length < 4) return json(request, { error: "password_too_short" }, 400);
      const row = await boardPostForPassword(env, id);
      if (!row) return json(request, { error: "not_found" }, 404);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password) || isAdminPassword(env, adminPassword);
      const authorized = identity
        ? boardIdentityCanEdit(identity, row)
        : isAdmin || await verifyBoardPassword(env, row, password);
      if (!authorized) return json(request, { error: identity ? "not_owner" : "wrong_password" }, 403);
      const statements = [] as any[];
      const reward = Math.max(0, Number(row.reward_builds || 0));
      if (row.user_sub && reward > 0) {
        const now = new Date().toISOString();
        statements.push(
          env.DB.prepare(
            "UPDATE lounge_users SET build_balance = build_balance - ?, updated_at = ? WHERE google_sub = ?"
          ).bind(reward, now, row.user_sub),
          env.DB.prepare(
            `INSERT OR IGNORE INTO lounge_build_ledger
              (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
             SELECT ?, ?, ?, '게시글 삭제로 적립 취소', 'board_post_delete', ?, build_balance, ?
               FROM lounge_users WHERE google_sub = ?`
          ).bind(crypto.randomUUID(), row.user_sub, -reward, id, now, row.user_sub),
        );
      }
      statements.push(
        env.DB.prepare("DELETE FROM board_comments WHERE post_id = ?").bind(id),
        env.DB.prepare("DELETE FROM board_post_daily_views WHERE post_id = ?").bind(id),
        env.DB.prepare("DELETE FROM board_posts WHERE id = ?").bind(id),
      );
      await env.DB.batch(statements);
      return json(request, { ok: true, postId: id });
    }

    const boardViewId = url.pathname.match(/^\/board\/posts\/([0-9a-f-]{36})\/views$/i)?.[1];
    if (boardViewId && request.method === "POST") {
      const id = boardId(boardViewId);
      if (!id) return json(request, { error: "not_found" }, 404);
      let payload: { visitorId?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const visitorId = clean(payload.visitorId, 64);
      if (!isVisitorId(visitorId)) return json(request, { error: "invalid_visitor" }, 400);
      const existing = await env.DB.prepare("SELECT id FROM board_posts WHERE id = ?").bind(id).first<{ id: string }>();
      if (!existing) return json(request, { error: "not_found" }, 404);
      const day = seoulDate();
      const inserted = await env.DB.prepare(
        "INSERT OR IGNORE INTO board_post_daily_views (post_id, visitor_id, view_date, created_at) VALUES (?, ?, ?, ?)"
      ).bind(id, visitorId, day, new Date().toISOString()).run();
      const row = await env.DB.prepare("SELECT view_count FROM board_posts WHERE id = ?").bind(id).first<{ view_count: number }>();
      return json(request, {
        postId: id,
        day,
        counted: Number(inserted.meta?.changes || 0) > 0,
        count: Math.max(0, Number(row?.view_count || 0)),
      });
    }

    const boardCommentsPostId = url.pathname.match(/^\/board\/posts\/([0-9a-f-]{36})\/comments$/i)?.[1];
    if (boardCommentsPostId && request.method === "GET") {
      const postId = boardId(boardCommentsPostId);
      if (!postId) return json(request, { error: "not_found" }, 404);
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const post = await env.DB.prepare("SELECT id FROM board_posts WHERE id = ?").bind(postId).first<{ id: string }>();
      if (!post) return json(request, { error: "not_found" }, 404);
      const rows = await env.DB.prepare(
        "SELECT id, post_id, author, content, is_admin, created_at, updated_at, user_sub " +
        "FROM board_comments WHERE post_id = ? ORDER BY created_at ASC LIMIT 100"
      ).bind(postId).all<BoardCommentRow>();
      return json(request, { comments: (rows.results || []).map((row) => ({ ...boardPublicComment(row), can_edit: boardIdentityCanEdit(auth.identity, row) })) });
    }

    if (boardCommentsPostId && request.method === "POST") {
      const postId = boardId(boardCommentsPostId);
      if (!postId) return json(request, { error: "not_found" }, 404);
      const post = await env.DB.prepare("SELECT id FROM board_posts WHERE id = ?").bind(postId).first<{ id: string }>();
      if (!post) return json(request, { error: "not_found" }, 404);
      let payload: { author?: unknown; content?: unknown; password?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const author = identity ? boardIdentityAuthor(identity) : clean(payload.author, 24);
      const content = cleanMultiline(payload.content, 1000);
      const password = passwordValue(payload.password);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (content.length < 2) return json(request, { error: "comment_too_short" }, 400);
      if (!identity && password.length < 4) return json(request, { error: "password_too_short" }, 400);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password);
      if (isReservedAdminName(author) && !isAdmin) return json(request, { error: "reserved_admin_name" }, 403);
      const now = new Date().toISOString();
      const salt = crypto.randomUUID();
      const row: BoardCommentRow = {
        id: crypto.randomUUID(), post_id: postId, author, content,
        is_admin: isAdmin ? 1 : 0, created_at: now, updated_at: null, user_sub: identity?.sub || null,
        reward_builds: identity ? 1 : 0,
      };
      const passwordHash = await hashPassword(identity ? crypto.randomUUID() : password, salt);
      const insertComment = env.DB.prepare(
        "INSERT INTO board_comments " +
        "(id, post_id, author, content, password_salt, password_hash, is_admin, created_at, updated_at, user_sub, reward_builds) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
      ).bind(row.id, row.post_id, row.author, row.content, salt, passwordHash, row.is_admin, row.created_at, row.user_sub, row.reward_builds);
      if (identity) {
        await env.DB.batch([
          insertComment,
          env.DB.prepare(
            "UPDATE lounge_users SET build_balance = build_balance + 1, updated_at = ? WHERE google_sub = ?"
          ).bind(now, identity.sub),
          env.DB.prepare(
            `INSERT INTO lounge_build_ledger
              (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
             SELECT ?, ?, 1, '댓글 작성', 'board_comment', ?, build_balance, ?
               FROM lounge_users WHERE google_sub = ?`
          ).bind(crypto.randomUUID(), identity.sub, row.id, now, identity.sub),
        ]);
        const balance = await env.DB.prepare(
          "SELECT build_balance FROM lounge_users WHERE google_sub = ?"
        ).bind(identity.sub).first<{ build_balance: number }>();
        return json(request, { comment: boardPublicComment(row), reward: 1, balance: Number(balance?.build_balance || 0) }, 201);
      }
      await insertComment.run();
      return json(request, { comment: boardPublicComment(row), reward: 0 }, 201);
    }

    const boardCommentId = url.pathname.match(/^\/board\/comments\/([0-9a-f-]{36})$/i)?.[1];
    if (boardCommentId && request.method === "PATCH") {
      const id = boardId(boardCommentId);
      if (!id) return json(request, { error: "not_found" }, 404);
      let payload: { author?: unknown; content?: unknown; password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const author = identity ? boardIdentityAuthor(identity) : clean(payload.author, 24);
      const content = cleanMultiline(payload.content, 1000);
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      if (!author) return json(request, { error: "author_required" }, 400);
      if (content.length < 2) return json(request, { error: "comment_too_short" }, 400);
      if (!identity && password.length < 4 && adminPassword.length < 4) return json(request, { error: "password_too_short" }, 400);
      const row = await boardCommentForPassword(env, id);
      if (!row) return json(request, { error: "not_found" }, 404);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password) || isAdminPassword(env, adminPassword);
      const authorized = identity
        ? boardIdentityCanEdit(identity, row)
        : isAdmin || await verifyBoardPassword(env, row, password);
      if (!authorized) return json(request, { error: identity ? "not_owner" : "wrong_password" }, 403);
      if (isReservedAdminName(author) && !isAdmin) return json(request, { error: "reserved_admin_name" }, 403);
      const updatedAt = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE board_comments SET author = ?, content = ?, is_admin = ?, updated_at = ? WHERE id = ?"
      ).bind(author, content, isAdmin ? 1 : 0, updatedAt, id).run();
      const updated = await env.DB.prepare(
        "SELECT id, post_id, author, content, is_admin, created_at, updated_at FROM board_comments WHERE id = ?"
      ).bind(id).first<BoardCommentRow>();
      return json(request, { comment: updated ? boardPublicComment(updated) : null });
    }

    if (boardCommentId && request.method === "DELETE") {
      const id = boardId(boardCommentId);
      if (!id) return json(request, { error: "not_found" }, 404);
      let payload: { password?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      const auth = await loungeBoardAuth(request, env);
      if (auth.response) return auth.response;
      const identity = auth.identity;
      const password = passwordValue(payload.password);
      const adminPassword = passwordValue(payload.adminPassword);
      if (!identity && password.length < 4 && adminPassword.length < 4) return json(request, { error: "password_too_short" }, 400);
      const row = await boardCommentForPassword(env, id);
      if (!row) return json(request, { error: "not_found" }, 404);
      const isAdmin = identity?.isAdmin || isAdminPassword(env, password) || isAdminPassword(env, adminPassword);
      const authorized = identity
        ? boardIdentityCanEdit(identity, row)
        : isAdmin || await verifyBoardPassword(env, row, password);
      if (!authorized) return json(request, { error: identity ? "not_owner" : "wrong_password" }, 403);
      const statements = [] as any[];
      const reward = Math.max(0, Number(row.reward_builds || 0));
      if (row.user_sub && reward > 0) {
        const now = new Date().toISOString();
        statements.push(
          env.DB.prepare(
            "UPDATE lounge_users SET build_balance = build_balance - ?, updated_at = ? WHERE google_sub = ?"
          ).bind(reward, now, row.user_sub),
          env.DB.prepare(
            `INSERT OR IGNORE INTO lounge_build_ledger
              (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
             SELECT ?, ?, ?, '댓글 삭제로 적립 취소', 'board_comment_delete', ?, build_balance, ?
               FROM lounge_users WHERE google_sub = ?`
          ).bind(crypto.randomUUID(), row.user_sub, -reward, id, now, row.user_sub),
        );
      }
      statements.push(env.DB.prepare("DELETE FROM board_comments WHERE id = ?").bind(id));
      await env.DB.batch(statements);
      return json(request, { ok: true, commentId: id });
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
      let payload: { adminPassword?: unknown; days?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!env.ADMIN_PASSWORD) return json(request, { error: "admin_not_configured" }, 503);
      if (passwordValue(payload.adminPassword) !== env.ADMIN_PASSWORD) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      return json(request, await analyticsSnapshot(env, seoulDate(), payload.days));
    }

    if (url.pathname === "/admin/report-actions" && request.method === "POST") {
      let payload: { action?: unknown; reportIds?: unknown; adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!isAdminPassword(env, passwordValue(payload.adminPassword))) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const action = normalizeAdminAction(payload.action);
      const reportIds = validReportIds(payload.reportIds);
      if (!action) return json(request, { error: "invalid_admin_action" }, 400);
      if (!reportIds.length) return json(request, { error: "missing_report_ids" }, 400);
      if (reportIds.length > 50) return json(request, { error: "too_many_report_ids" }, 413);
      if (action === "hide" || action === "unhide") {
        return json(request, {
          ok: true,
          action,
          results: await applyVisibilityAction(env, action, reportIds),
        });
      }
      const job = await createReportAdminJob(env, action, reportIds);
      const dispatched = await dispatchReportAdminJob(env, job.id);
      return json(request, {
        ok: dispatched,
        job: dispatched ? job : { ...job, status: "failed" },
      }, dispatched ? 202 : 503);
    }

    if (url.pathname === "/admin/report-jobs" && request.method === "POST") {
      let payload: { adminPassword?: unknown; limit?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!isAdminPassword(env, passwordValue(payload.adminPassword))) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const limit = Math.min(50, Math.max(1, Math.trunc(Number(payload.limit || 20))));
      const rows = await env.DB.prepare(
        `SELECT id, action, status, requested_count, success_count, failure_count,
                requested_at, started_at, completed_at, error_message, result_json
         FROM report_admin_jobs ORDER BY requested_at DESC LIMIT ${limit}`
      ).all<Record<string, unknown>>();
      const jobs = await Promise.all((rows.results || []).map(async (job) => {
        const items = await env.DB.prepare(
          "SELECT report_id, status, private_report_id, error_message, updated_at FROM report_admin_job_items WHERE job_id = ? ORDER BY report_id ASC"
        ).bind(String(job.id || "")).all<Record<string, unknown>>();
        return { ...job, items: items.results || [] };
      }));
      return json(request, { jobs });
    }

    const adminJobId = url.pathname.match(/^\/admin\/report-jobs\/([^/]+)$/i)?.[1];
    if (adminJobId && request.method === "POST") {
      let payload: { adminPassword?: unknown };
      try { payload = await request.json(); } catch { return json(request, { error: "invalid_json" }, 400); }
      if (!isAdminPassword(env, passwordValue(payload.adminPassword))) {
        return json(request, { error: "wrong_admin_password" }, 403);
      }
      const jobId = decodeURIComponent(adminJobId).slice(0, 80);
      const job = await env.DB.prepare(
        `SELECT id, action, status, requested_count, success_count, failure_count,
                requested_at, started_at, completed_at, error_message, result_json
         FROM report_admin_jobs WHERE id = ?`
      ).bind(jobId).first<Record<string, unknown>>();
      if (!job) return json(request, { error: "admin_job_not_found" }, 404);
      const items = await env.DB.prepare(
        `SELECT report_id, status, private_report_id, error_message, updated_at
         FROM report_admin_job_items WHERE job_id = ? ORDER BY report_id ASC`
      ).bind(jobId).all<Record<string, unknown>>();
      return json(request, { job, items: items.results || [] });
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

    if (url.pathname === "/comments" || url.pathname === "/comments/recent" || commentId || url.pathname === "/visits" || url.pathname === "/entry-sessions" || url.pathname === "/report-views" || url.pathname === "/requests" || requestId || replyRequestId || url.pathname === "/board/posts" || boardPostId || boardViewId || boardCommentsPostId || boardCommentId || url.pathname.startsWith("/hidden-reports") || url.pathname.startsWith("/featured-reports") || url.pathname.startsWith("/draft-promotions") || url.pathname.startsWith("/report-overrides") || url.pathname === "/admin/verify" || url.pathname === "/admin/analytics" || url.pathname.startsWith("/admin/report-actions") || url.pathname.startsWith("/admin/report-jobs")) {
      return json(request, { error: "method_not_allowed" }, 405);
    }
    return json(request, { error: "not_found" }, 404);
  },
};
