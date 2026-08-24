import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { exportJWK, generateKeyPair, SignJWT } from "jose";

type SqlValue = string | number | bigint | null | Uint8Array;

class SqlitePrepared {
  private args: SqlValue[] = [];

  constructor(private database: DatabaseSync, private sql: string) {}

  bind(...args: unknown[]) {
    this.args = args.map((value) => {
      if (value === undefined) return null;
      if (typeof value === "boolean") return value ? 1 : 0;
      return value as SqlValue;
    });
    return this;
  }

  execute() {
    const result = this.database.prepare(this.sql).run(...this.args);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }

  async run() {
    return this.execute();
  }

  async first<T>() {
    return (this.database.prepare(this.sql).get(...this.args) as T | undefined) || null;
  }

  async all<T>() {
    return { results: this.database.prepare(this.sql).all(...this.args) as T[] };
  }
}

class SqliteD1 {
  readonly database = new DatabaseSync(":memory:");

  prepare(sql: string) {
    return new SqlitePrepared(this.database, sql);
  }

  async batch(statements: SqlitePrepared[]) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => statement.execute());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  exec(sql: string) {
    this.database.exec(sql);
  }

  value<T>(sql: string) {
    return this.database.prepare(sql).get() as T;
  }
}

type StoredObject = {
  bytes: Uint8Array;
  contentType: string;
};

class MemoryBucket {
  readonly objects = new Map<string, StoredObject>();

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ) {
    let buffer: ArrayBuffer;
    if (typeof value === "string") buffer = new TextEncoder().encode(value).buffer;
    else if (value instanceof ArrayBuffer) buffer = value.slice(0);
    else if (ArrayBuffer.isView(value)) {
      buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
    } else if (value instanceof Blob) buffer = await value.arrayBuffer();
    else buffer = await new Response(value as ReadableStream).arrayBuffer();
    this.objects.set(key, {
      bytes: new Uint8Array(buffer),
      contentType: options?.httpMetadata?.contentType || "application/octet-stream",
    });
  }

  async get(key: string) {
    const stored = this.objects.get(key);
    if (!stored) return null;
    const copy = stored.bytes.slice();
    return {
      size: copy.byteLength,
      httpMetadata: { contentType: stored.contentType },
      body: new Blob([copy]).stream(),
      arrayBuffer: async () => copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength),
    };
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

const GOOGLE_CLIENT_ID = "builders-lounge-test.apps.googleusercontent.com";
const CONFIG_KEY = "builders-lounge-shorts-integration-test";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const SERVER_API_KEY = "server-only-test-key";
const VALID_WEBM_BASE64 = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAHpEU2bdLpNu4tTq4QVSalmU6yBoU27i1OrhBZUrmtTrIHYTbuMU6uEElTDZ1OsggElTbuMU6uEHFO7a1OsggHT7AEAAAAAAABZAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAVSalmsirXsYMPQkBNgI1MYXZmNjIuMTIuMTAxV0GNTGF2ZjYyLjEyLjEwMUSJiECPQAAAAAAAFlSua8iuAQAAAAAAAD/XgQFzxYjGb5sj+r5DUpyBACK1nIN1bmSIgQCGhVZfVlA4g4EBI+ODhDuaygDgkLCBELqBEJqBAlWwhFW5gQESVMNn/HNzoGPAgGfImkWjh0VOQ09ERVJEh41MYXZmNjIuMTIuMTAxc3PWY8CLY8WIxm+bI/q+Q1JnyKFFo4dFTkNPREVSRIeUTGF2YzYyLjI4LjEwMSBsaWJ2cHhnyKFFo4hEVVJBVElPTkSHkzAwOjAwOjAxLjAwMDAwMDAwMAAfQ7Z1qOeBAKOjgQAAgBACAJ0BKhAAEAAARwiFhYiZhIgCAgAMDWAA/v+rUIAcU7trkbuPs4EAt4r3gQHxggGm8IED";
const nativeFetch = globalThis.fetch;
const { publicKey, privateKey } = await generateKeyPair("RS256");
const publicJwk = await exportJWK(publicKey);
publicJwk.kid = "builders-test-key";
publicJwk.alg = "RS256";
publicJwk.use = "sig";

globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  if (url === "https://www.googleapis.com/oauth2/v3/certs") {
    return new Response(JSON.stringify({ keys: [publicJwk] }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  }
  if (url === OPENROUTER_ENDPOINT) {
    assert.equal(new Headers(init?.headers).get("Authorization"), `Bearer ${SERVER_API_KEY}`);
    return new Response(JSON.stringify({
      id: "provider-test-response",
      choices: [{
        message: {
          content: JSON.stringify({
            detailedPrompt: "초보자가 회의 메모를 결정과 할 일 중심으로 정리하는 세로형 영상",
            scenes: [
              { title: "핵심부터 찾기", visual: "결정 문장을 강조한다", narration: "먼저 결정된 내용을 찾으세요.", subtitle: "결정부터 찾기", durationSeconds: 2 },
              { title: "담당자 연결", visual: "담당자와 기한을 카드로 보여 준다", narration: "다음으로 담당자와 기한을 연결하세요.", subtitle: "담당자와 기한 연결", durationSeconds: 2 },
            ],
          }),
        },
      }],
    }), { headers: { "Content-Type": "application/json" } });
  }
  return nativeFetch(input, init);
};

const { default: worker } = await import("./index.js");

test.after(() => {
  globalThis.fetch = nativeFetch;
});

async function idToken(sub: string, email: string, name: string) {
  return new SignJWT({ email, name, picture: "", email_verified: true })
    .setProtectedHeader({ alg: "RS256", kid: publicJwk.kid })
    .setIssuer("https://accounts.google.com")
    .setAudience(GOOGLE_CLIENT_ID)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(privateKey);
}

function base64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

async function encryptApiKey(value: string) {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(CONFIG_KEY));
  const key = await crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { ciphertext: base64(new Uint8Array(encrypted)), iv: base64(iv) };
}

async function environment({ matchingEndpoint = true } = {}) {
  const DB = new SqliteD1();
  for (const name of [
    "0013_create_community_board.sql",
    "0014_builders_lounge_platform.sql",
    "0015_openrouter_moonshot_build_rules.sql",
    "0016_lounge_shorts_media.sql",
  ]) {
    DB.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  const encrypted = await encryptApiKey(SERVER_API_KEY);
  DB.database.prepare(
    `UPDATE lounge_tool_settings
        SET enabled = 1, provider = 'openrouter', endpoint_url = ?, model = 'openai/gpt-4.1-mini',
            api_key_ciphertext = ?, api_key_iv = ?
      WHERE tool_id = 'meeting'`,
  ).run(OPENROUTER_ENDPOINT, encrypted.ciphertext, encrypted.iv);
  DB.database.prepare(
    `UPDATE lounge_tool_settings
        SET enabled = 1, build_cost = 5, provider = 'openrouter', endpoint_url = ?,
            model = 'openai/gpt-4.1-mini', api_key_ciphertext = '', api_key_iv = ''
      WHERE tool_id = 'shorts'`,
  ).run(matchingEndpoint ? OPENROUTER_ENDPOINT : "https://openrouter.ai/api/v1/responses");
  return {
    DB,
    PRIVATE_REPORTS: new MemoryBucket(),
    GOOGLE_CLIENT_ID,
    LOUNGE_CONFIG_KEY: CONFIG_KEY,
  } as any;
}

async function call(
  env: any,
  path: string,
  method = "GET",
  body?: unknown,
  token = "",
  extraHeaders: Record<string, string> = {},
) {
  const headers = new Headers({ Origin: "https://aihubos.github.io", ...extraHeaders });
  let requestBody: BodyInit | undefined;
  if (body instanceof Blob) requestBody = body;
  else if (body !== undefined) {
    headers.set("Content-Type", "application/json");
    requestBody = JSON.stringify(body);
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await worker.fetch(new Request(`https://board.test${path}`, {
    method,
    headers,
    body: requestBody,
  }), env);
  const type = response.headers.get("Content-Type") || "";
  return {
    response,
    json: type.includes("application/json") ? await response.json() as any : null,
  };
}

async function fundedUser(env: any, sub: string, email: string, name: string, builds = 20) {
  const token = await idToken(sub, email, name);
  const me = await call(env, "/lounge/me", "GET", undefined, token);
  assert.equal(me.response.status, 200);
  env.DB.database.prepare("UPDATE lounge_users SET build_balance = ? WHERE google_sub = ?").run(builds, sub);
  return token;
}

function uuid() {
  return crypto.randomUUID();
}

function validWebmBytes() {
  return new Uint8Array(Buffer.from(VALID_WEBM_BASE64, "base64"));
}

function validWebm() {
  return new Blob([validWebmBytes()], { type: "video/webm" });
}

function concatBytes(...parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function ebmlElement(id: number[], payload = new Uint8Array()) {
  assert.ok(payload.byteLength < 127, "test EBML payload must fit a one-byte size VINT");
  return concatBytes(Uint8Array.from(id), Uint8Array.of(0x80 | payload.byteLength), payload);
}

function minimalVideoWebm(clusterChild: Uint8Array, codecId = "V_VP8") {
  const header = ebmlElement([0x1a, 0x45, 0xdf, 0xa3],
    ebmlElement([0x42, 0x82], new TextEncoder().encode("webm")));
  const trackEntry = ebmlElement([0xae], concatBytes(
    ebmlElement([0xd7], Uint8Array.of(1)),
    ebmlElement([0x83], Uint8Array.of(1)),
    ebmlElement([0x86], new TextEncoder().encode(codecId)),
    ebmlElement([0xe0]),
  ));
  const tracks = ebmlElement([0x16, 0x54, 0xae, 0x6b], trackEntry);
  const cluster = ebmlElement([0x1f, 0x43, 0xb6, 0x75], clusterChild);
  return concatBytes(header, ebmlElement([0x18, 0x53, 0x80, 0x67], concatBytes(tracks, cluster)));
}

async function runScheduled(env: any) {
  const pending: Promise<unknown>[] = [];
  const handler = (worker as any).scheduled;
  assert.equal(typeof handler, "function");
  await handler(
    { scheduledTime: Date.now(), cron: "* * * * *", noRetry() {} },
    env,
    {
      waitUntil(value: Promise<unknown>) { pending.push(Promise.resolve(value)); },
      passThroughOnException() {},
    },
  );
  await Promise.all(pending);
}

function shortsLedgerEventCount(env: any, jobId: string, eventType: string) {
  return Number(env.DB.database.prepare(
    "SELECT COUNT(*) AS count FROM lounge_shorts_ledger_events WHERE job_id = ? AND event_type = ?",
  ).get(jobId, eventType).count || 0);
}

async function prepare(env: any, token: string, requestId = uuid()) {
  const result = await call(env, "/lounge/shorts/prepare", "POST", {
    requestId,
    topic: "회의 메모를 결정과 할 일 중심으로 정리하는 방법을 알려줘.",
    settings: { subtitles: true, subtitleStyle: "basic", voice: false, voiceId: "none" },
  }, token, { "X-Request-Id": requestId });
  assert.equal(result.response.status, 201);
  assert.equal(result.json.requestId, requestId);
  assert.equal(result.json.status, "processing");
  assert.equal(result.json.reservationStatus, "reserved");
  assert.ok(result.json.reservationEventId);
  return result.json;
}

test("shorts reserves once, confirms on R2 storage, and publishes only after an explicit idempotent request", async () => {
  const env = await environment();
  const owner = await fundedUser(env, "owner-one", "owner-one@example.com", "소유자");
  const outsider = await fundedUser(env, "owner-two", "owner-two@example.com", "다른 사용자");

  const config = await call(env, "/lounge/config");
  const configText = JSON.stringify(config.json);
  const shortsConfig = config.json.tools.find((tool: any) => tool.id === "shorts");
  assert.equal(shortsConfig.apiKeyConfigured, true);
  assert.equal(shortsConfig.credentialSource, "server-shared");
  assert.equal(configText.includes(SERVER_API_KEY), false);

  const planned = await prepare(env, owner);
  assert.equal(planned.balance, 15);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 0);

  const reused = await call(env, `/lounge/shorts?requestId=${planned.requestId}`, "GET", undefined, owner);
  assert.equal(reused.response.status, 200);
  assert.equal(reused.json.jobId, planned.jobId);
  assert.equal(reused.json.balance, 15);

  const otherStatus = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, outsider);
  assert.equal(otherStatus.response.status, 404);

  const video = validWebm();
  const uploaded = await call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", video, owner, {
    "Content-Type": "video/webm",
    "X-File-Size": String(video.size),
    "X-Request-Id": planned.requestId,
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.json.status, "completed");
  assert.equal(uploaded.json.reservationStatus, "confirmed");
  assert.ok(uploaded.json.confirmationEventId);
  assert.equal(uploaded.json.balance, 15);
  assert.match(uploaded.json.mediaUrl, /^https:\/\//);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 0);

  const privateMedia = await call(env, new URL(uploaded.json.mediaUrl).pathname, "GET", undefined, outsider);
  assert.equal(privateMedia.response.status, 403);

  const publishRequestId = uuid();
  const publishBody = {
    publishRequestId,
    title: "회의 메모 정리법",
    content: "결정사항과 담당자, 기한을 연결해 회의 메모를 정리하는 방법입니다.",
    rightsConfirmed: true,
  };
  const published = await call(env, `/lounge/shorts/${planned.jobId}/publish`, "POST", publishBody, owner, {
    "X-Request-Id": publishRequestId,
  });
  assert.equal(published.response.status, 201);
  assert.equal(published.json.publishRequestId, publishRequestId);
  assert.equal(published.json.jobId, planned.jobId);
  assert.equal(published.json.visibility, "public");
  assert.equal(published.json.category, "knowledge_share");
  assert.equal(published.json.rewardBuilds, 0);
  assert.equal(published.json.publishStatus, "active");
  assert.match(published.json.postUrl, /^https:\/\//);

  const repeated = await call(env, `/lounge/shorts/${planned.jobId}/publish`, "POST", publishBody, owner, {
    "X-Request-Id": publishRequestId,
  });
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.json.postId, published.json.postId);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 1);

  const publicMedia = await call(env, new URL(uploaded.json.mediaUrl).pathname);
  assert.equal(publicMedia.response.status, 200);
  assert.equal(publicMedia.response.headers.get("Content-Type"), "video/webm");

  const removed = await call(env, `/board/posts/${published.json.postId}`, "DELETE", {}, owner);
  assert.equal(removed.response.status, 200);
  assert.equal(removed.json.publishStatus, "deleted");
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 0);

  const blockedPublicMedia = await call(env, new URL(uploaded.json.mediaUrl).pathname);
  assert.equal(blockedPublicMedia.response.status, 401);
  const ownerMedia = await call(env, new URL(uploaded.json.mediaUrl).pathname, "GET", undefined, owner);
  assert.equal(ownerMedia.response.status, 200);

  const deletedRetry = await call(env, `/lounge/shorts/${planned.jobId}/publish`, "POST", publishBody, owner, {
    "X-Request-Id": publishRequestId,
  });
  assert.equal(deletedRetry.json.publishStatus, "deleted");
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 0);

  const republishRequestId = uuid();
  const republished = await call(env, `/lounge/shorts/${planned.jobId}/publish`, "POST", {
    ...publishBody,
    publishRequestId: republishRequestId,
  }, owner, { "X-Request-Id": republishRequestId });
  assert.equal(republished.response.status, 201);
  assert.notEqual(republished.json.postId, published.json.postId);
  assert.equal(republished.json.rewardBuilds, 0);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM board_posts").count, 1);
  assert.equal(env.DB.value<{ balance: number }>("SELECT build_balance AS balance FROM lounge_users WHERE google_sub = 'owner-one'").balance, 15);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM lounge_build_ledger WHERE user_sub = 'owner-one'").count, 1);
});

test("invalid WebM releases the reservation once and preserves the balance on repeated recovery", async () => {
  const env = await environment();
  const token = await fundedUser(env, "invalid-webm-user", "invalid@example.com", "잘못된 영상 사용자");
  const planned = await prepare(env, token);
  const invalid = new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], { type: "video/webm" });
  const uploaded = await call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", invalid, token, {
    "Content-Type": "video/webm",
    "X-File-Size": String(invalid.size),
  });
  assert.equal(uploaded.response.status, 415);
  assert.equal(uploaded.json.error, "shorts_webm_signature_invalid");

  const first = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, token);
  const second = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, token);
  assert.equal(first.json.status, "released");
  assert.equal(first.json.reservationStatus, "released");
  assert.ok(first.json.releaseEventId);
  assert.equal(second.json.releaseEventId, first.json.releaseEventId);
  assert.equal(second.json.balance, 20);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM lounge_shorts_ledger_events WHERE event_type = 'release'").count, 1);
  assert.equal(env.PRIVATE_REPORTS.objects.size, 0);
});

test("browser upload preflight allows every required header before the WebM POST", async () => {
  const env = await environment();
  const token = await fundedUser(env, "cors-user", "cors@example.com", "브라우저 업로드 사용자");
  const planned = await prepare(env, token);
  const response = await worker.fetch(new Request(`https://board.test/lounge/shorts/${planned.jobId}/upload`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://aihubos.github.io",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, content-type, x-file-size, x-request-id",
    },
  }), env);
  assert.equal(response.status, 204);
  const allowed = new Set((response.headers.get("Access-Control-Allow-Headers") || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean));
  for (const header of ["authorization", "content-type", "x-file-size", "x-request-id"]) {
    assert.ok(allowed.has(header), `preflight header missing: ${header}`);
  }

  const video = validWebm();
  const uploaded = await call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", video, token, {
    "Content-Type": "video/webm",
    "X-File-Size": String(video.size),
    "X-Request-Id": planned.requestId,
  });
  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.json.status, "completed");
});

test("scheduled sweep releases expired reservations once without a status request", async () => {
  const env = await environment();
  const token = await fundedUser(env, "scheduled-user", "scheduled@example.com", "자동 만료 사용자");
  const planned = await prepare(env, token);
  env.DB.database.prepare("UPDATE lounge_shorts_jobs SET expires_at = ? WHERE job_id = ?")
    .run("2000-01-01T00:00:00.000Z", planned.jobId);

  await runScheduled(env);
  await runScheduled(env);

  const job = env.DB.database.prepare(
    `SELECT s.reservation_status, j.error_code AS tool_error_code
       FROM lounge_shorts_jobs s
       JOIN lounge_tool_jobs j ON j.id = s.job_id
      WHERE s.job_id = ?`,
  ).get(planned.jobId) as { reservation_status: string; tool_error_code: string };
  assert.equal(job.reservation_status, "released");
  assert.equal(job.tool_error_code, "reservation_expired");
  assert.equal(env.DB.value<{ balance: number }>("SELECT build_balance AS balance FROM lounge_users WHERE google_sub = 'scheduled-user'").balance, 20);
  assert.equal(shortsLedgerEventCount(env, planned.jobId, "reservation"), 1);
  assert.equal(shortsLedgerEventCount(env, planned.jobId, "release"), 1);
});

test("recent recovery returns only the authenticated user's latest live reservation", async () => {
  const env = await environment();
  const owner = await fundedUser(env, "recent-owner", "recent-owner@example.com", "복구 사용자");
  const other = await fundedUser(env, "recent-other", "recent-other@example.com", "다른 복구 사용자");
  const planned = await prepare(env, owner);

  const ownerRecent = await call(env, "/lounge/shorts/recent", "GET", undefined, owner);
  assert.equal(ownerRecent.response.status, 200);
  assert.equal(ownerRecent.json.found, true);
  assert.equal(ownerRecent.json.jobId, planned.jobId);
  assert.equal(ownerRecent.json.requestId, planned.requestId);
  assert.equal(ownerRecent.json.topic, "회의 메모를 결정과 할 일 중심으로 정리하는 방법을 알려줘.");
  assert.deepEqual(ownerRecent.json.settings, {
    subtitles: true,
    subtitleStyle: "basic",
    voice: false,
    voiceId: "none",
  });
  assert.equal(ownerRecent.json.reservationStatus, "reserved");

  const otherRecent = await call(env, "/lounge/shorts/recent", "GET", undefined, other);
  assert.equal(otherRecent.response.status, 200);
  assert.deepEqual(otherRecent.json, { found: false });

  env.DB.database.prepare("UPDATE lounge_shorts_jobs SET expires_at = ? WHERE job_id = ?")
    .run("2000-01-01T00:00:00.000Z", planned.jobId);
  const expiredRecent = await call(env, "/lounge/shorts/recent", "GET", undefined, owner);
  assert.equal(expiredRecent.response.status, 200);
  assert.deepEqual(expiredRecent.json, { found: false });
  assert.equal(env.DB.value<{ balance: number }>("SELECT build_balance AS balance FROM lounge_users WHERE google_sub = 'recent-owner'").balance, 20);
  assert.equal(shortsLedgerEventCount(env, planned.jobId, "release"), 1);
});

test("invalid WebM containers and frame payloads release Build exactly once", async () => {
  const playable = validWebmBytes();
  const wrongDocType = playable.slice();
  const docTypeIndex = Buffer.from(wrongDocType).indexOf(Buffer.from("webm"));
  assert.ok(docTypeIndex >= 0);
  wrongDocType.set(new TextEncoder().encode("matr"), docTypeIndex);
  const vp8KeyFrameHeader = Uint8Array.of(0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, 0x10, 0x00, 0x10, 0x00);

  const cases = [
    ["magic-only", new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
    ["truncated", playable.slice(0, 300)],
    ["wrong-doctype", wrongDocType],
    ["empty-block-group", minimalVideoWebm(ebmlElement([0xa0]))],
    ["frame-less-simple-block", minimalVideoWebm(ebmlElement([0xa3], Uint8Array.of(0x81, 0x00, 0x00, 0x80)))],
    ["frame-less-block-group", minimalVideoWebm(ebmlElement([0xa0],
      ebmlElement([0xa1], Uint8Array.of(0x81, 0x00, 0x00, 0x00))))],
    ["one-byte-frame", minimalVideoWebm(ebmlElement([0xa3], Uint8Array.of(0x81, 0x00, 0x00, 0x80, 0x00)))],
    ["truncated-vp8-frame", minimalVideoWebm(ebmlElement([0xa3],
      concatBytes(Uint8Array.of(0x81, 0x00, 0x00, 0x80), vp8KeyFrameHeader)))],
    ["vp9-header-only", minimalVideoWebm(ebmlElement([0xa3], concatBytes(
      Uint8Array.of(0x81, 0x00, 0x00, 0x80),
      Uint8Array.of(0x82, 0x49, 0x83, 0x42, 0x00, 0x00, 0xf0, 0x00, 0xf6, 0x00),
    )), "V_VP9")],
    ["wrong-track-simple-block", minimalVideoWebm(ebmlElement([0xa3],
      concatBytes(Uint8Array.of(0x82, 0x00, 0x00, 0x80), vp8KeyFrameHeader)))],
    ["invalid-track-vint", minimalVideoWebm(ebmlElement([0xa3], Uint8Array.of(0x00, 0x00, 0x00, 0x80, 0x00)))],
  ] as const;
  for (const [label, bytes] of cases) {
    const env = await environment();
    const sub = `invalid-${label}`;
    const token = await fundedUser(env, sub, `${sub}@example.com`, label);
    const planned = await prepare(env, token);
    const video = new Blob([bytes], { type: "video/webm" });
    const uploaded = await call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", video, token, {
      "Content-Type": "video/webm",
      "X-File-Size": String(video.size),
      "X-Request-Id": planned.requestId,
    });
    assert.equal(uploaded.response.status, 415, label);
    assert.match(String(uploaded.json.error || ""), /^shorts_webm_/, label);

    const status = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, token);
    assert.equal(status.json.reservationStatus, "released", label);
    assert.equal(status.json.balance, 20, label);
    assert.equal(shortsLedgerEventCount(env, planned.jobId, "release"), 1, label);
    assert.equal(env.PRIVATE_REPORTS.objects.size, 0, label);
  }
});

test("BlockGroup accepts an internal Block only when it carries a complete video keyframe", async () => {
  const env = await environment();
  const token = await fundedUser(env, "valid-block-group", "valid-block-group@example.com", "BlockGroup");
  const planned = await prepare(env, token);
  const vp8KeyFrame = new Uint8Array(Buffer.from(
    "1002009d012a100010000047088585889984880202000c0d6000feffab5080",
    "hex",
  ));
  const block = ebmlElement([0xa1], concatBytes(
    Uint8Array.of(0x81, 0x00, 0x00, 0x00),
    vp8KeyFrame,
  ));
  const bytes = minimalVideoWebm(ebmlElement([0xa0], block));
  const video = new Blob([bytes], { type: "video/webm" });
  const uploaded = await call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", video, token, {
    "Content-Type": "video/webm",
    "X-File-Size": String(video.size),
    "X-Request-Id": planned.requestId,
  });

  assert.equal(uploaded.response.status, 200);
  assert.equal(uploaded.json.status, "completed");
  assert.equal(uploaded.json.reservationStatus, "confirmed");
  assert.equal(uploaded.json.balance, 15);
  assert.equal(shortsLedgerEventCount(env, planned.jobId, "confirmation"), 1);
  assert.equal(shortsLedgerEventCount(env, planned.jobId, "release"), 0);
  assert.equal(env.PRIVATE_REPORTS.objects.size, 1);
});

test("expired reservations are released once and the same request never reserves Build again", async () => {
  const env = await environment();
  const token = await fundedUser(env, "expired-user", "expired@example.com", "만료 사용자");
  const planned = await prepare(env, token);
  env.DB.database.prepare("UPDATE lounge_shorts_jobs SET expires_at = ? WHERE job_id = ?")
    .run("2000-01-01T00:00:00.000Z", planned.jobId);

  const first = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, token);
  const second = await call(env, `/lounge/shorts?requestId=${planned.requestId}`, "GET", undefined, token);
  assert.equal(first.json.status, "expired");
  assert.equal(first.json.balance, 20);
  assert.equal(second.json.releaseEventId, first.json.releaseEventId);
  assert.equal(second.json.balance, 20);

  const reused = await call(env, "/lounge/shorts/prepare", "POST", {
    requestId: planned.requestId,
    topic: "같은 요청 번호는 새 예약을 만들면 안 됩니다.",
    settings: { voice: false },
  }, token, { "X-Request-Id": planned.requestId });
  assert.equal(reused.response.status, 200);
  assert.equal(reused.json.jobId, planned.jobId);
  assert.equal(reused.json.status, "expired");
  assert.equal(reused.json.balance, 20);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM lounge_shorts_ledger_events WHERE event_type = 'reservation'").count, 1);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM lounge_shorts_ledger_events WHERE event_type = 'release'").count, 1);
});

test("concurrent upload and release produce only one terminal ledger outcome", async () => {
  const env = await environment();
  const token = await fundedUser(env, "race-user", "race@example.com", "동시성 사용자");
  const planned = await prepare(env, token);
  const video = validWebm();

  await Promise.all([
    call(env, `/lounge/shorts/${planned.jobId}/upload`, "POST", video, token, {
      "Content-Type": "video/webm",
      "X-File-Size": String(video.size),
    }),
    call(env, `/lounge/shorts/${planned.jobId}/release`, "POST", { reason: "user_cancelled" }, token),
  ]);

  const events = env.DB.value<{ confirmations: number; releases: number }>(
    `SELECT
       SUM(CASE WHEN event_type = 'confirmation' THEN 1 ELSE 0 END) AS confirmations,
       SUM(CASE WHEN event_type = 'release' THEN 1 ELSE 0 END) AS releases
     FROM lounge_shorts_ledger_events`,
  );
  assert.equal(Number(events.confirmations) + Number(events.releases), 1);
  const status = await call(env, `/lounge/shorts/${planned.jobId}`, "GET", undefined, token);
  assert.ok(["completed", "released"].includes(status.json.status));
  assert.equal(status.json.balance, status.json.status === "completed" ? 15 : 20);
});

test("server-shared credentials stay closed when the shorts endpoint is not identical", async () => {
  const env = await environment({ matchingEndpoint: false });
  const token = await fundedUser(env, "mismatch-user", "mismatch@example.com", "설정 불일치 사용자");
  const config = await call(env, "/lounge/config");
  const shortsConfig = config.json.tools.find((tool: any) => tool.id === "shorts");
  assert.equal(shortsConfig.apiKeyConfigured, false);
  assert.equal(shortsConfig.credentialSource, "none");

  const requestId = uuid();
  const blocked = await call(env, "/lounge/shorts/prepare", "POST", {
    requestId,
    topic: "공급자 설정이 다르면 요청을 닫아야 합니다.",
    settings: { voice: false },
  }, token, { "X-Request-Id": requestId });
  assert.equal(blocked.response.status, 503);
  assert.equal(blocked.json.error, "tool_not_configured");
  assert.equal(env.DB.value<{ balance: number }>("SELECT build_balance AS balance FROM lounge_users WHERE google_sub = 'mismatch-user'").balance, 20);
  assert.equal(env.DB.value<{ count: number }>("SELECT COUNT(*) AS count FROM lounge_tool_jobs").count, 0);
});
