const SESSION_TTL_MS = 30 * 60 * 1000;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_BLOCK_MS = 30 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const MAX_HTML_BYTES = 5 * 1024 * 1024;
const MAX_INTERNAL_HTML_BYTES = 25 * 1024 * 1024;
const MAX_COVER_BYTES = 1024 * 1024;

const PRIVATE_ORIGINS = new Set([
  "https://aihubos.github.io",
  "https://aireport.ai-hub-os.com",
  "http://127.0.0.1:8799",
  "http://localhost:8799",
]);

type PrivateReportRow = {
  id: string;
  title: string;
  summary: string;
  display_date: string;
  source_count: number;
  tags_json: string;
  html_key: string;
  cover_key?: string | null;
  cover_type?: string | null;
  created_at: string;
  updated_at: string;
  origin_report_id?: string;
  origin_public_url?: string;
  conversion_job_id?: string;
  converted_at?: string | null;
  recovery_key?: string | null;
};

type PrivateSessionRow = {
  token_hash: string;
  created_at: string;
  expires_at: string;
};

type PrivateAttemptRow = {
  fingerprint: string;
  window_started_at: string;
  failure_count: number;
  blocked_until?: string | null;
};

export interface PrivateReportObject {
  httpMetadata?: { contentType?: string };
  size?: number;
  body?: ReadableStream<Uint8Array>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text?(): Promise<string>;
}

export interface PrivateReportBucket {
  put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  get(key: string): Promise<PrivateReportObject | null>;
  delete(key: string): Promise<unknown>;
}

export interface PrivateReportEnv {
  DB: D1Database;
  PRIVATE_REPORTS?: PrivateReportBucket;
  ADMIN_PASSWORD?: string;
  PRIVATE_SESSION_SECRET?: string;
  LIFECYCLE_WORKER_SECRET?: string;
}

type ParsedPrivateForm = {
  id: string;
  title: string;
  summary: string;
  displayDate: string;
  sourceCount: number;
  tags: string[];
  html: File | null;
  cover: File | null;
  removeCover: boolean;
  originReportId: string;
  originPublicUrl: string;
  conversionJobId: string;
  recoveryKey: string;
};

function originAllowed(origin: string) {
  return !origin || PRIVATE_ORIGINS.has(origin) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
}

function privateCors(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigin = originAllowed(origin) && origin ? origin : "https://aihubos.github.io";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "private, no-store",
    "Vary": "Origin",
  };
}

function privateJson(request: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...privateCors(request),
      ...extraHeaders,
    },
  });
}

function privateResponse(request: Request, body: BodyInit | null, status: number, contentType: string) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType,
      ...privateCors(request),
    },
  });
}

function compact(value: unknown, limit: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
}

function reportId(value: string) {
  return /^[a-z0-9][a-z0-9-]{2,119}$/i.test(value) ? value : "";
}

function decodedReportId(value: string) {
  try {
    return reportId(decodeURIComponent(value));
  } catch {
    return "";
  }
}

function parseTags(value: string) {
  return Array.from(new Set(value.split(",").map((tag) => compact(tag, 40)).filter(Boolean))).slice(0, 12);
}

function safeTags(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((tag) => compact(tag, 40)).filter(Boolean).slice(0, 12) : [];
  } catch {
    return [];
  }
}

function publicReport(row: PrivateReportRow) {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    displayDate: row.display_date,
    sourceCount: Math.max(0, Number(row.source_count || 0)),
    tags: safeTags(row.tags_json),
    hasCover: Boolean(row.cover_key),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (part) => part.toString(16).padStart(2, "0")).join("");
}

function retrySeconds(until: string, now = Date.now()) {
  return Math.max(1, Math.ceil((Date.parse(until) - now) / 1000));
}

async function requestFingerprint(request: Request, env: PrivateReportEnv) {
  const address = request.headers.get("CF-Connecting-IP") || "local-development";
  return sha256(`${env.PRIVATE_SESSION_SECRET || ""}:${address}`);
}

async function recordFailedAttempt(request: Request, env: PrivateReportEnv, now: Date) {
  const fingerprint = await requestFingerprint(request, env);
  const previous = await env.DB.prepare(
    "SELECT fingerprint, window_started_at, failure_count, blocked_until FROM private_auth_attempts WHERE fingerprint = ?",
  ).bind(fingerprint).first<PrivateAttemptRow>();
  const previousWindow = previous ? Date.parse(previous.window_started_at) : 0;
  const withinWindow = previousWindow > 0 && now.getTime() - previousWindow < ATTEMPT_WINDOW_MS;
  const failureCount = withinWindow ? Number(previous?.failure_count || 0) + 1 : 1;
  const windowStartedAt = withinWindow ? String(previous?.window_started_at) : now.toISOString();
  const blockedUntil = failureCount >= MAX_FAILED_ATTEMPTS
    ? new Date(now.getTime() + ATTEMPT_BLOCK_MS).toISOString()
    : null;
  await env.DB.prepare(
    "INSERT INTO private_auth_attempts (fingerprint, window_started_at, failure_count, blocked_until) VALUES (?, ?, ?, ?) ON CONFLICT(fingerprint) DO UPDATE SET window_started_at = excluded.window_started_at, failure_count = excluded.failure_count, blocked_until = excluded.blocked_until",
  ).bind(fingerprint, windowStartedAt, failureCount, blockedUntil).run();
  return { failureCount, blockedUntil };
}

async function activeBlock(request: Request, env: PrivateReportEnv, now: Date) {
  const fingerprint = await requestFingerprint(request, env);
  const attempt = await env.DB.prepare(
    "SELECT fingerprint, window_started_at, failure_count, blocked_until FROM private_auth_attempts WHERE fingerprint = ?",
  ).bind(fingerprint).first<PrivateAttemptRow>();
  return attempt?.blocked_until && Date.parse(attempt.blocked_until) > now.getTime()
    ? attempt.blocked_until
    : "";
}

async function clearAttempts(request: Request, env: PrivateReportEnv) {
  const fingerprint = await requestFingerprint(request, env);
  await env.DB.prepare("DELETE FROM private_auth_attempts WHERE fingerprint = ?").bind(fingerprint).run();
}

async function createSession(request: Request, env: PrivateReportEnv) {
  if (!env.ADMIN_PASSWORD || !env.PRIVATE_SESSION_SECRET) {
    return privateJson(request, { error: "private_storage_not_configured" }, 503);
  }
  let payload: { adminPassword?: unknown };
  try {
    payload = await request.json();
  } catch {
    return privateJson(request, { error: "invalid_json" }, 400);
  }
  const now = new Date();
  const blockedUntil = await activeBlock(request, env, now);
  if (blockedUntil) {
    return privateJson(request, { error: "private_login_blocked" }, 429, { "Retry-After": String(retrySeconds(blockedUntil, now.getTime())) });
  }
  const password = typeof payload.adminPassword === "string" ? payload.adminPassword.slice(0, 80) : "";
  if (password !== env.ADMIN_PASSWORD) {
    const failed = await recordFailedAttempt(request, env, now);
    if (failed.blockedUntil) {
      return privateJson(request, { error: "private_login_blocked" }, 429, { "Retry-After": String(retrySeconds(failed.blockedUntil, now.getTime())) });
    }
    return privateJson(request, { error: "wrong_admin_password" }, 403);
  }

  await clearAttempts(request, env);
  await env.DB.prepare("DELETE FROM private_admin_sessions WHERE expires_at <= ?").bind(now.toISOString()).run();
  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = bytesToBase64Url(tokenBytes);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  await env.DB.prepare(
    "INSERT INTO private_admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)",
  ).bind(tokenHash, now.toISOString(), expiresAt).run();
  return privateJson(request, { token, expiresAt }, 201);
}

async function authenticatedSession(request: Request, env: PrivateReportEnv) {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer\s+([A-Za-z0-9_-]{43,128})$/)?.[1] || "";
  if (!token) return { response: privateJson(request, { error: "private_auth_required" }, 401) };
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    "SELECT token_hash, created_at, expires_at FROM private_admin_sessions WHERE token_hash = ?",
  ).bind(tokenHash).first<PrivateSessionRow>();
  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    if (row) await env.DB.prepare("DELETE FROM private_admin_sessions WHERE token_hash = ?").bind(tokenHash).run();
    return { response: privateJson(request, { error: "private_session_expired" }, 401) };
  }
  return { tokenHash, expiresAt: row.expires_at };
}

async function revokeSession(request: Request, env: PrivateReportEnv) {
  const session = await authenticatedSession(request, env);
  if ("response" in session) return session.response;
  await env.DB.prepare("DELETE FROM private_admin_sessions WHERE token_hash = ?").bind(session.tokenHash).run();
  return privateJson(request, { ok: true });
}

function optionalFile(form: FormData, key: string) {
  const value = form.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}

async function parsePrivateFormData(request: Request, form: FormData, requiredId: string, requireHtml: boolean, internal = false): Promise<ParsedPrivateForm | Response> {
  const id = requiredId || reportId(compact(form.get("id"), 120));
  const title = compact(form.get("title"), 140);
  const summary = compact(form.get("summary"), 480);
  const displayDate = compact(form.get("displayDate"), 20);
  const sourceCount = Number.parseInt(compact(form.get("sourceCount"), 8) || "0", 10);
  const tags = parseTags(compact(form.get("tags"), 600));
  const html = optionalFile(form, "html");
  const cover = optionalFile(form, "cover");
  const removeCover = compact(form.get("removeCover"), 10) === "true";

  if (!id) return privateJson(request, { error: "invalid_private_report_id" }, 400);
  if (title.length < 2) return privateJson(request, { error: "title_too_short" }, 400);
  if (summary.length < 4) return privateJson(request, { error: "summary_too_short" }, 400);
  if (!/^\d{6}$|^\d{4}-\d{2}-\d{2}$/.test(displayDate)) return privateJson(request, { error: "invalid_display_date" }, 400);
  if (!Number.isInteger(sourceCount) || sourceCount < 0 || sourceCount > 999) {
    return privateJson(request, { error: "invalid_source_count" }, 400);
  }
  if (requireHtml && !html) return privateJson(request, { error: "html_required" }, 400);
  if (html && !/^text\/html(?:$|;)/i.test(html.type || "text/html")) return privateJson(request, { error: "invalid_html_type" }, 400);
  if (html && html.size > (internal ? MAX_INTERNAL_HTML_BYTES : MAX_HTML_BYTES)) return privateJson(request, { error: "html_too_large" }, 413);
  if (cover && !/^image\/(jpeg|png|webp)$/i.test(cover.type)) return privateJson(request, { error: "invalid_cover_type" }, 400);
  if (cover && cover.size > MAX_COVER_BYTES) return privateJson(request, { error: "cover_too_large" }, 413);
  return {
    id,
    title,
    summary,
    displayDate,
    sourceCount,
    tags,
    html,
    cover,
    removeCover,
    originReportId: compact(form.get("originReportId"), 120),
    originPublicUrl: compact(form.get("originPublicUrl"), 420),
    conversionJobId: compact(form.get("conversionJobId"), 80),
    recoveryKey: compact(form.get("recoveryKey"), 240),
  };
}

async function parsePrivateForm(request: Request, requiredId: string, requireHtml: boolean, internal = false): Promise<ParsedPrivateForm | Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return privateJson(request, { error: "invalid_form" }, 400);
  }
  return parsePrivateFormData(request, form, requiredId, requireHtml, internal);
}

function objectKey(id: string, kind: "report" | "cover", extension: string) {
  return `reports/${id}/${kind}-${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

function coverExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function putFile(bucket: PrivateReportBucket, key: string, file: File, contentType: string) {
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType } });
}

async function cleanupObjects(bucket: PrivateReportBucket, keys: Array<string | null | undefined>) {
  await Promise.all(keys.filter((key): key is string => Boolean(key)).map((key) => bucket.delete(key).catch(() => undefined)));
}

async function selectReport(env: PrivateReportEnv, id: string) {
  return env.DB.prepare(
    "SELECT id, title, summary, display_date, source_count, tags_json, html_key, cover_key, cover_type, created_at, updated_at, origin_report_id, origin_public_url, conversion_job_id, converted_at, recovery_key FROM private_reports WHERE id = ?",
  ).bind(id).first<PrivateReportRow>();
}

async function listReports(request: Request, env: PrivateReportEnv) {
  const rows = await env.DB.prepare(
    "SELECT id, title, summary, display_date, source_count, tags_json, html_key, cover_key, cover_type, created_at, updated_at, origin_report_id, origin_public_url, conversion_job_id, converted_at, recovery_key FROM private_reports ORDER BY created_at DESC LIMIT 500",
  ).all<PrivateReportRow>();
  return privateJson(request, { reports: (rows.results || []).map(publicReport) });
}

async function createReport(request: Request, env: PrivateReportEnv, bucket: PrivateReportBucket) {
  const internal = Boolean(env.LIFECYCLE_WORKER_SECRET) && request.headers.get("X-Report-Lifecycle-Secret") === env.LIFECYCLE_WORKER_SECRET;
  const parsed = await parsePrivateForm(request, "", true, internal);
  if (parsed instanceof Response) return parsed;
  const existing = await selectReport(env, parsed.id);
  if (existing) {
    if (internal && parsed.conversionJobId && existing.conversion_job_id === parsed.conversionJobId) {
      return privateJson(request, { report: publicReport(existing) });
    }
    return privateJson(request, { error: "private_report_exists" }, 409);
  }
  const htmlKey = objectKey(parsed.id, "report", "html");
  const coverKey = parsed.cover ? objectKey(parsed.id, "cover", coverExtension(parsed.cover.type)) : null;
  try {
    await putFile(bucket, htmlKey, parsed.html as File, "text/html; charset=utf-8");
    if (parsed.cover && coverKey) await putFile(bucket, coverKey, parsed.cover, parsed.cover.type);
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO private_reports
        (id, title, summary, display_date, source_count, tags_json, html_key, cover_key, cover_type,
         created_at, updated_at, origin_report_id, origin_public_url, conversion_job_id, converted_at, recovery_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      parsed.id, parsed.title, parsed.summary, parsed.displayDate, parsed.sourceCount,
      JSON.stringify(parsed.tags), htmlKey, coverKey, parsed.cover?.type || null, now, now,
      parsed.originReportId, parsed.originPublicUrl, parsed.conversionJobId, parsed.conversionJobId ? now : null, parsed.recoveryKey || null,
    ).run();
    const row = await selectReport(env, parsed.id);
    return privateJson(request, { report: publicReport(row as PrivateReportRow) }, 201);
  } catch {
    await cleanupObjects(bucket, [htmlKey, coverKey]);
    return privateJson(request, { error: "private_report_write_failed" }, 500);
  }
}

async function updateReport(request: Request, env: PrivateReportEnv, bucket: PrivateReportBucket, id: string) {
  const existing = await selectReport(env, id);
  if (!existing) return privateJson(request, { error: "private_report_not_found" }, 404);
  const previousHtmlKey = existing.html_key;
  const previousCoverKey = existing.cover_key || null;
  const parsed = await parsePrivateForm(request, id, false);
  if (parsed instanceof Response) return parsed;
  const newHtmlKey = parsed.html ? objectKey(id, "report", "html") : existing.html_key;
  const newCoverKey = parsed.cover
    ? objectKey(id, "cover", coverExtension(parsed.cover.type))
    : parsed.removeCover
      ? null
      : existing.cover_key || null;
  const newCoverType = parsed.cover?.type || (parsed.removeCover ? null : existing.cover_type || null);
  const uploadedKeys: string[] = [];
  try {
    if (parsed.html) {
      await putFile(bucket, newHtmlKey, parsed.html, "text/html; charset=utf-8");
      uploadedKeys.push(newHtmlKey);
    }
    if (parsed.cover && newCoverKey) {
      await putFile(bucket, newCoverKey, parsed.cover, parsed.cover.type);
      uploadedKeys.push(newCoverKey);
    }
    await env.DB.prepare(
      "UPDATE private_reports SET title = ?, summary = ?, display_date = ?, source_count = ?, tags_json = ?, html_key = ?, cover_key = ?, cover_type = ?, updated_at = ? WHERE id = ?",
    ).bind(
      parsed.title, parsed.summary, parsed.displayDate, parsed.sourceCount, JSON.stringify(parsed.tags),
      newHtmlKey, newCoverKey, newCoverType, new Date().toISOString(), id,
    ).run();
  } catch {
    await cleanupObjects(bucket, uploadedKeys);
    return privateJson(request, { error: "private_report_write_failed" }, 500);
  }
  const staleKeys = [
    parsed.html && previousHtmlKey !== newHtmlKey ? previousHtmlKey : null,
    (parsed.cover || parsed.removeCover) && previousCoverKey !== newCoverKey ? previousCoverKey : null,
  ];
  await cleanupObjects(bucket, staleKeys);
  const updated = await selectReport(env, id);
  return privateJson(request, { report: publicReport(updated as PrivateReportRow) });
}

async function deleteReport(request: Request, env: PrivateReportEnv, bucket: PrivateReportBucket, id: string) {
  const existing = await selectReport(env, id);
  if (!existing) return privateJson(request, { error: "private_report_not_found" }, 404);
  await env.DB.prepare("DELETE FROM private_reports WHERE id = ?").bind(id).run();
  await cleanupObjects(bucket, [existing.html_key, existing.cover_key]);
  return privateJson(request, { ok: true, reportId: id });
}

async function storeRecoveryObject(request: Request, env: PrivateReportEnv, bucket: PrivateReportBucket) {
  let form: FormData;
  try { form = await request.formData(); } catch { return privateJson(request, { error: "invalid_form" }, 400); }
  const requestedKey = compact(form.get("key"), 240).replaceAll("\\", "/").replace(/^\/+/, "");
  const file = optionalFile(form, "file");
  if (!requestedKey || requestedKey.includes("..") || !file) return privateJson(request, { error: "invalid_recovery_object" }, 400);
  if (file.size > MAX_INTERNAL_HTML_BYTES) return privateJson(request, { error: "recovery_object_too_large" }, 413);
  const key = `trash/${requestedKey}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type || "application/octet-stream" } });
  return privateJson(request, { ok: true, key });
}

async function reportContent(request: Request, bucket: PrivateReportBucket, row: PrivateReportRow) {
  const object = await bucket.get(row.html_key);
  if (!object) return privateJson(request, { error: "private_report_content_missing" }, 404);
  return privateResponse(request, await object.arrayBuffer(), 200, "text/html; charset=utf-8");
}

async function reportCover(request: Request, bucket: PrivateReportBucket, row: PrivateReportRow) {
  if (!row.cover_key) return privateJson(request, { error: "private_report_cover_missing" }, 404);
  const object = await bucket.get(row.cover_key);
  if (!object) return privateJson(request, { error: "private_report_cover_missing" }, 404);
  return privateResponse(request, await object.arrayBuffer(), 200, row.cover_type || object.httpMetadata?.contentType || "application/octet-stream");
}

async function dispatchPrivateReportRequest(request: Request, env: PrivateReportEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname === "/internal/private-packages") {
    if (!env.LIFECYCLE_WORKER_SECRET || request.headers.get("X-Report-Lifecycle-Secret") !== env.LIFECYCLE_WORKER_SECRET) {
      return privateJson(request, { error: "internal_auth_required" }, 401);
    }
    const bucket = env.PRIVATE_REPORTS;
    if (!bucket) return privateJson(request, { error: "private_storage_not_configured" }, 503);
    if (request.method !== "POST") return privateJson(request, { error: "method_not_allowed" }, 405);
    return createReport(request, env, bucket);
  }
  if (url.pathname === "/internal/recovery-objects") {
    if (!env.LIFECYCLE_WORKER_SECRET || request.headers.get("X-Report-Lifecycle-Secret") !== env.LIFECYCLE_WORKER_SECRET) {
      return privateJson(request, { error: "internal_auth_required" }, 401);
    }
    const bucket = env.PRIVATE_REPORTS;
    if (!bucket) return privateJson(request, { error: "private_storage_not_configured" }, 503);
    if (request.method !== "POST") return privateJson(request, { error: "method_not_allowed" }, 405);
    return storeRecoveryObject(request, env, bucket);
  }
  const privatePath = url.pathname === "/private-session" || url.pathname === "/private-reports" || url.pathname.startsWith("/private-reports/");
  if (!privatePath) return null;
  if (!originAllowed(request.headers.get("Origin") || "")) {
    return privateJson(request, { error: "origin_not_allowed" }, 403);
  }
  if (url.pathname === "/private-session" && request.method === "POST") return createSession(request, env);
  if (url.pathname === "/private-session" && request.method === "DELETE") return revokeSession(request, env);

  const session = await authenticatedSession(request, env);
  if ("response" in session) return session.response;
  const bucket = env.PRIVATE_REPORTS;
  if (!bucket) return privateJson(request, { error: "private_storage_not_configured" }, 503);

  if (url.pathname === "/private-reports" && request.method === "GET") return listReports(request, env);
  if (url.pathname === "/private-reports" && request.method === "POST") return createReport(request, env, bucket);

  const match = url.pathname.match(/^\/private-reports\/([^/]+)(?:\/(content|cover))?$/i);
  if (!match) return privateJson(request, { error: "not_found" }, 404);
  const id = decodedReportId(match[1]);
  if (!id) return privateJson(request, { error: "invalid_private_report_id" }, 400);
  const resource = match[2] || "";
  const row = await selectReport(env, id);
  if (!row) return privateJson(request, { error: "private_report_not_found" }, 404);
  if (resource === "content" && request.method === "GET") return reportContent(request, bucket, row);
  if (resource === "cover" && request.method === "GET") return reportCover(request, bucket, row);
  if (!resource && request.method === "GET") return privateJson(request, { report: publicReport(row) });
  if (!resource && request.method === "PUT") return updateReport(request, env, bucket, id);
  if (!resource && request.method === "DELETE") return deleteReport(request, env, bucket, id);
  return privateJson(request, { error: "method_not_allowed" }, 405);
}

export async function handlePrivateReportRequest(request: Request, env: PrivateReportEnv): Promise<Response | null> {
  try {
    return await dispatchPrivateReportRequest(request, env);
  } catch {
    return privateJson(request, { error: "private_storage_error" }, 500);
  }
}
