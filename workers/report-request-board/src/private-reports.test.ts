import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

type SessionRow = { token_hash: string; created_at: string; expires_at: string };
type AttemptRow = {
  fingerprint: string;
  window_started_at: string;
  failure_count: number;
  blocked_until: string | null;
};
type PrivateReportRow = {
  id: string;
  title: string;
  summary: string;
  display_date: string;
  source_count: number;
  tags_json: string;
  html_key: string;
  cover_key: string | null;
  cover_type: string | null;
  created_at: string;
  updated_at: string;
  origin_report_id?: string;
  origin_public_url?: string;
  conversion_job_id?: string;
  converted_at?: string | null;
  recovery_key?: string | null;
};

class FakePrepared {
  args: unknown[] = [];
  constructor(private db: FakePrivateD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class FakePrivateD1 {
  sessions = new Map<string, SessionRow>();
  attempts = new Map<string, AttemptRow>();
  reports = new Map<string, PrivateReportRow>();
  failNextReportWrite = false;

  prepare(sql: string) { return new FakePrepared(this, sql); }

  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO private_admin_sessions/i.test(sql)) {
      const [tokenHash, createdAt, expiresAt] = args.map(String);
      this.sessions.set(tokenHash, { token_hash: tokenHash, created_at: createdAt, expires_at: expiresAt });
      return { success: true, meta: { changes: 1 } };
    }
    if (/DELETE FROM private_admin_sessions WHERE token_hash/i.test(sql)) {
      const deleted = this.sessions.delete(String(args[0]));
      return { success: true, meta: { changes: deleted ? 1 : 0 } };
    }
    if (/DELETE FROM private_admin_sessions WHERE expires_at/i.test(sql)) {
      const cutoff = String(args[0]);
      let changes = 0;
      for (const [key, row] of this.sessions) {
        if (row.expires_at <= cutoff) { this.sessions.delete(key); changes += 1; }
      }
      return { success: true, meta: { changes } };
    }
    if (/INSERT INTO private_auth_attempts/i.test(sql)) {
      const [fingerprint, windowStartedAt, failureCount, blockedUntil] = args;
      this.attempts.set(String(fingerprint), {
        fingerprint: String(fingerprint),
        window_started_at: String(windowStartedAt),
        failure_count: Number(failureCount),
        blocked_until: blockedUntil ? String(blockedUntil) : null,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/DELETE FROM private_auth_attempts/i.test(sql)) {
      const deleted = this.attempts.delete(String(args[0]));
      return { success: true, meta: { changes: deleted ? 1 : 0 } };
    }
    if (/INSERT INTO private_reports/i.test(sql)) {
      if (this.failNextReportWrite) {
        this.failNextReportWrite = false;
        throw new Error("simulated_report_write_failure");
      }
      const [id, title, summary, displayDate, sourceCount, tagsJson, htmlKey, coverKey, coverType, createdAt, updatedAt, originReportId, originPublicUrl, conversionJobId, convertedAt, recoveryKey] = args;
      if (this.reports.has(String(id))) throw new Error("UNIQUE constraint failed: private_reports.id");
      this.reports.set(String(id), {
        id: String(id), title: String(title), summary: String(summary), display_date: String(displayDate),
        source_count: Number(sourceCount), tags_json: String(tagsJson), html_key: String(htmlKey),
        cover_key: coverKey ? String(coverKey) : null, cover_type: coverType ? String(coverType) : null,
        created_at: String(createdAt), updated_at: String(updatedAt),
        origin_report_id: String(originReportId || ""), origin_public_url: String(originPublicUrl || ""),
        conversion_job_id: String(conversionJobId || ""), converted_at: convertedAt ? String(convertedAt) : null,
        recovery_key: recoveryKey ? String(recoveryKey) : null,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE private_reports/i.test(sql)) {
      if (this.failNextReportWrite) {
        this.failNextReportWrite = false;
        throw new Error("simulated_report_write_failure");
      }
      const [title, summary, displayDate, sourceCount, tagsJson, htmlKey, coverKey, coverType, updatedAt, id] = args;
      const row = this.reports.get(String(id));
      if (!row) return { success: true, meta: { changes: 0 } };
      Object.assign(row, {
        title: String(title), summary: String(summary), display_date: String(displayDate),
        source_count: Number(sourceCount), tags_json: String(tagsJson), html_key: String(htmlKey),
        cover_key: coverKey ? String(coverKey) : null, cover_type: coverType ? String(coverType) : null,
        updated_at: String(updatedAt),
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/DELETE FROM private_reports/i.test(sql)) {
      const deleted = this.reports.delete(String(args[0]));
      return { success: true, meta: { changes: deleted ? 1 : 0 } };
    }
    throw new Error(`Unhandled private run SQL: ${sql}`);
  }

  async first(sql: string, args: unknown[]) {
    if (/FROM private_admin_sessions/i.test(sql)) return this.sessions.get(String(args[0])) || null;
    if (/FROM private_auth_attempts/i.test(sql)) return this.attempts.get(String(args[0])) || null;
    if (/FROM private_reports WHERE id/i.test(sql)) return this.reports.get(String(args[0])) || null;
    throw new Error(`Unhandled private first SQL: ${sql}`);
  }

  async all(sql: string, _args: unknown[]) {
    if (/FROM private_reports/i.test(sql)) {
      return {
        results: Array.from(this.reports.values())
          .sort((left, right) => right.created_at.localeCompare(left.created_at)),
      };
    }
    throw new Error(`Unhandled private all SQL: ${sql}`);
  }
}

class FakeR2Object {
  constructor(private bytes: Uint8Array, readonly httpMetadata?: { contentType?: string }) {}
  async arrayBuffer() {
    return this.bytes.buffer.slice(this.bytes.byteOffset, this.bytes.byteOffset + this.bytes.byteLength);
  }
  async text() { return new TextDecoder().decode(this.bytes); }
}

class FakeR2 {
  objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  async put(key: string, value: string | ArrayBuffer | ArrayBufferView | Blob, options?: { httpMetadata?: { contentType?: string } }) {
    let bytes: Uint8Array;
    if (typeof value === "string") bytes = new TextEncoder().encode(value);
    else if (value instanceof Blob) bytes = new Uint8Array(await value.arrayBuffer());
    else if (ArrayBuffer.isView(value)) bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    else bytes = new Uint8Array(value);
    this.objects.set(key, { bytes: new Uint8Array(bytes), contentType: options?.httpMetadata?.contentType || "application/octet-stream" });
    return {};
  }
  async get(key: string) {
    const stored = this.objects.get(key);
    return stored ? new FakeR2Object(stored.bytes, { contentType: stored.contentType }) : null;
  }
  async delete(key: string) { this.objects.delete(key); }
}

function environment() {
  return {
    DB: new FakePrivateD1(),
    PRIVATE_REPORTS: new FakeR2(),
    ADMIN_PASSWORD: "correct-admin-password",
    PRIVATE_SESSION_SECRET: "private-session-test-secret",
  } as any;
}

async function call(env: any, path: string, method = "GET", body?: BodyInit | object, token?: string, origin = "https://aihubos.github.io", lifecycleSecret?: string) {
  const headers = new Headers({ Origin: origin, "CF-Connecting-IP": "203.0.113.10" });
  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) requestBody = body;
  else if (body !== undefined && (typeof body === "string" || body instanceof Blob || body instanceof ArrayBuffer)) requestBody = body;
  else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (lifecycleSecret) headers.set("X-Report-Lifecycle-Secret", lifecycleSecret);
  const response = await worker.fetch(new Request(`https://private.test${path}`, { method, headers, body: requestBody }), env);
  const contentType = response.headers.get("Content-Type") || "";
  const value = contentType.includes("application/json") ? await response.json() : await response.text();
  return { response, value: value as any };
}

async function session(env: any) {
  const result = await call(env, "/private-session", "POST", { adminPassword: "correct-admin-password" });
  assert.equal(result.response.status, 201);
  return String(result.value.token);
}

function reportForm(id = "private-sample", title = "비공개 샘플") {
  const form = new FormData();
  form.set("id", id);
  form.set("title", title);
  form.set("summary", "관리자만 확인하는 샘플 보고서입니다.");
  form.set("displayDate", "260811");
  form.set("sourceCount", "3");
  form.set("tags", "비공개, 경영");
  form.set("html", new File(["<!doctype html><html><body><h1>보호된 본문</h1></body></html>"], "private.html", { type: "text/html" }));
  form.set("cover", new File([new Uint8Array([137, 80, 78, 71])], "cover.png", { type: "image/png" }));
  return form;
}

test("private report endpoints reject missing authentication", async () => {
  const env = environment();
  for (const [path, method] of [["/private-reports", "GET"], ["/private-reports/sample", "GET"], ["/private-reports/sample/content", "GET"]]) {
    const result = await call(env, path, method);
    assert.equal(result.response.status, 401);
    assert.equal(result.response.headers.get("Cache-Control"), "private, no-store");
  }
});

test("private session stores only a hash and expires after thirty minutes", async () => {
  const env = environment();
  const result = await call(env, "/private-session", "POST", { adminPassword: "correct-admin-password" });
  assert.equal(result.response.status, 201);
  assert.match(result.value.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(env.DB.sessions.has(result.value.token), false);
  assert.equal(env.DB.sessions.size, 1);
  const stored = Array.from(env.DB.sessions.values())[0] as SessionRow;
  assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
  const duration = Date.parse(stored.expires_at) - Date.parse(stored.created_at);
  assert.equal(duration, 30 * 60 * 1000);
});

test("private login blocks the sixth attempt after five wrong passwords", async () => {
  const env = environment();
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const denied = await call(env, "/private-session", "POST", { adminPassword: "wrong-password" });
    assert.equal(denied.response.status, attempt === 5 ? 429 : 403);
  }
  const blocked = await call(env, "/private-session", "POST", { adminPassword: "correct-admin-password" });
  assert.equal(blocked.response.status, 429);
  assert.ok(Number(blocked.response.headers.get("Retry-After")) > 0);
});

test("authenticated administrator can create, read, update and delete a private report", async () => {
  const env = environment();
  const token = await session(env);
  const created = await call(env, "/private-reports", "POST", reportForm(), token);
  assert.equal(created.response.status, 201);
  assert.equal(created.value.report.title, "비공개 샘플");

  const listed = await call(env, "/private-reports", "GET", undefined, token);
  assert.equal(listed.response.status, 200);
  assert.equal(listed.value.reports.length, 1);
  assert.equal(listed.value.reports[0].title, "비공개 샘플");
  assert.equal("htmlKey" in listed.value.reports[0], false);
  assert.equal("coverKey" in listed.value.reports[0], false);

  const content = await call(env, "/private-reports/private-sample/content", "GET", undefined, token);
  assert.equal(content.response.status, 200);
  assert.match(content.value, /보호된 본문/);
  const cover = await call(env, "/private-reports/private-sample/cover", "GET", undefined, token);
  assert.equal(cover.response.status, 200);
  assert.equal(cover.response.headers.get("Content-Type"), "image/png");

  const update = reportForm("private-sample", "수정된 비공개 샘플");
  update.set("html", new File(["<!doctype html><html><body><h1>교체된 본문</h1></body></html>"], "replacement.html", { type: "text/html" }));
  const updated = await call(env, "/private-reports/private-sample", "PUT", update, token);
  assert.equal(updated.response.status, 200);
  assert.equal(updated.value.report.title, "수정된 비공개 샘플");
  const replaced = await call(env, "/private-reports/private-sample/content", "GET", undefined, token);
  assert.match(replaced.value, /교체된 본문/);

  const deleted = await call(env, "/private-reports/private-sample", "DELETE", undefined, token);
  assert.equal(deleted.response.status, 200);
  const missing = await call(env, "/private-reports/private-sample/content", "GET", undefined, token);
  assert.equal(missing.response.status, 404);
  assert.equal(env.PRIVATE_REPORTS.objects.size, 0);
});

test("failed metadata write rolls back newly uploaded private objects", async () => {
  const env = environment();
  const token = await session(env);
  env.DB.failNextReportWrite = true;
  const result = await call(env, "/private-reports", "POST", reportForm("rollback-sample"), token);
  assert.equal(result.response.status, 500);
  assert.equal(env.DB.reports.size, 0);
  assert.equal(env.PRIVATE_REPORTS.objects.size, 0);
});

test("revoked and expired private sessions cannot read reports", async () => {
  const env = environment();
  const token = await session(env);
  const revoked = await call(env, "/private-session", "DELETE", undefined, token);
  assert.equal(revoked.response.status, 200);
  assert.equal((await call(env, "/private-reports", "GET", undefined, token)).response.status, 401);

  const expiringToken = await session(env);
  const row = Array.from(env.DB.sessions.values())[0] as SessionRow;
  row.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await call(env, "/private-reports", "GET", undefined, expiringToken)).response.status, 401);
});

test("private routes reject an untrusted browser origin", async () => {
  const env = environment();
  const result = await call(env, "/private-session", "POST", { adminPassword: "correct-admin-password" }, undefined, "https://attacker.example");
  assert.equal(result.response.status, 403);
});

test("internal lifecycle package requires the secret and is idempotent per conversion job", async () => {
  const env = environment();
  env.LIFECYCLE_WORKER_SECRET = "lifecycle-test-secret";
  const unauthorized = await call(env, "/internal/private-packages", "POST", reportForm("internal-sample"));
  assert.equal(unauthorized.response.status, 401);

  const form = reportForm("internal-sample", "자동 전환 비공개 샘플");
  form.set("originReportId", "public-report");
  form.set("originPublicUrl", "https://aihubos.github.io/reportmode/reports/public-report/");
  form.set("conversionJobId", "job-123");
  form.set("recoveryKey", "trash/job-123/public-report.html");
  const created = await call(env, "/internal/private-packages", "POST", form, undefined, "", "lifecycle-test-secret");
  assert.equal(created.response.status, 201);
  assert.equal(env.DB.reports.get("internal-sample")?.origin_report_id, "public-report");
  assert.equal(env.DB.reports.get("internal-sample")?.conversion_job_id, "job-123");

  const retry = await call(env, "/internal/private-packages", "POST", form, undefined, "", "lifecycle-test-secret");
  assert.equal(retry.response.status, 200);
  assert.equal(env.DB.reports.size, 1);
});

test("internal recovery upload stores the original HTML under a trash prefix", async () => {
  const env = environment();
  env.LIFECYCLE_WORKER_SECRET = "lifecycle-test-secret";
  const form = new FormData();
  form.set("key", "job-123/public-report.html");
  form.set("file", new File(["<html>원본</html>"], "public-report.html", { type: "text/html" }));
  const stored = await call(env, "/internal/recovery-objects", "POST", form, undefined, "", "lifecycle-test-secret");
  assert.equal(stored.response.status, 200);
  assert.equal(stored.value.key, "trash/job-123/public-report.html");
  const object = await env.PRIVATE_REPORTS.get("trash/job-123/public-report.html");
  assert.ok(object);
  assert.match(await object.text!(), /원본/);
});
