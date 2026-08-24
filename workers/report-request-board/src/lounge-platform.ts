import { createRemoteJWKSet, jwtVerify } from "jose";
import type { PrivateReportBucket } from "./private-reports.js";

export interface LoungeEnv {
  DB: D1Database;
  PRIVATE_REPORTS?: PrivateReportBucket;
  GOOGLE_CLIENT_ID?: string;
  LOUNGE_CONFIG_KEY?: string;
  ADMIN_EMAILS?: string;
}

export type LoungeIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  role: "member" | "admin";
  isAdmin: boolean;
  balance: number;
};

type ToolSetting = {
  tool_id: string;
  display_name: string;
  enabled: number;
  build_cost: number;
  provider: string;
  endpoint_url: string;
  model: string;
  system_prompt: string;
  api_key_ciphertext: string;
  api_key_iv: string;
  updated_by: string;
  updated_at: string;
};

type LoungeUserRow = {
  google_sub: string;
  email: string;
  display_name: string;
  avatar_url: string;
  role: "member" | "admin";
  build_balance: number;
  created_at: string;
  updated_at: string;
  last_login_at: string;
};

type ShortsJobRow = {
  job_id: string;
  request_id: string;
  user_sub: string;
  topic: string;
  settings_json: string;
  detailed_prompt: string;
  scenes_json: string;
  reservation_status: "reserved" | "confirmed" | "released";
  media_key: string;
  media_type: string;
  media_size: number;
  published_post_id: string;
  publish_request_id: string;
  rights_notice_version: string;
  rights_confirmed_at: string;
  build_cost: number;
  tool_status: string;
  created_at: string;
  updated_at: string;
};

class LoungeError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message = code) {
    super(message);
    this.name = "LoungeError";
    this.code = code;
    this.status = status;
  }
}

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const TOOL_IDS = new Set(["meeting", "shorts", "webtoon", "masterpiece"]);
const PROVIDERS = new Set(["openai", "openrouter", "moonshot", "gemini", "gemini-image", "anthropic", "webhook"]);
const DEFAULT_ADMIN_EMAIL = "jeremylee0213@gmail.com";
const MAX_REQUEST_TEXT = 120_000;
const MAX_SHORTS_BYTES = 25 * 1024 * 1024;
const SHORTS_RIGHTS_VERSION = "shorts-rights-v1";

const ALLOWED_ORIGINS = new Set([
  "https://aihubos.github.io",
  "https://aireport.ai-hub-os.com",
  "https://builderslab.ai-hub-os.com",
  "http://127.0.0.1:8799",
  "http://localhost:8799",
]);

function loungeCors(request: Request) {
  const origin = request.headers.get("Origin") || "";
  const allowed = ALLOWED_ORIGINS.has(origin) || /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)
    ? origin
    : "https://aihubos.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id, X-File-Size",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

export function loungeJson(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...loungeCors(request) },
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

async function readJson(request: Request, maxBytes = 180_000): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new LoungeError("request_too_large", 413);
  try {
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof LoungeError) throw error;
    throw new LoungeError("invalid_json", 400);
  }
}

function bearerToken(request: Request) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  return match?.[1] || "";
}

function configuredAdminEmails(env: LoungeEnv) {
  return new Set(
    [DEFAULT_ADMIN_EMAIL, ...(env.ADMIN_EMAILS || "").split(",")]
      .map((value) => value.trim().toLocaleLowerCase("en-US"))
      .filter(Boolean),
  );
}

async function isAdminEmail(env: LoungeEnv, email: string) {
  const normalized = email.toLocaleLowerCase("en-US");
  if (configuredAdminEmails(env).has(normalized)) return true;
  const row = await env.DB.prepare(
    "SELECT active FROM lounge_admins WHERE email = ? COLLATE NOCASE",
  ).bind(normalized).first<{ active: number }>();
  return Number(row?.active || 0) === 1;
}

function publicIdentity(identity: LoungeIdentity) {
  return {
    email: identity.email,
    name: identity.name,
    picture: identity.picture,
    role: identity.role,
    isAdmin: identity.isAdmin,
    balance: identity.balance,
  };
}

export async function getLoungeIdentity(request: Request, env: LoungeEnv): Promise<LoungeIdentity | null> {
  const token = bearerToken(request);
  if (!token) return null;
  if (!env.GOOGLE_CLIENT_ID) throw new LoungeError("google_login_not_configured", 503);
  if (token.length > 8_000) throw new LoungeError("invalid_google_token", 401);

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, GOOGLE_JWKS, {
      audience: env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      algorithms: ["RS256"],
    });
    payload = verified.payload as Record<string, unknown>;
  } catch {
    throw new LoungeError("invalid_google_token", 401);
  }

  const sub = clean(payload.sub, 128);
  const email = clean(payload.email, 254).toLocaleLowerCase("en-US");
  const name = clean(payload.name, 80) || email.split("@")[0] || "빌더";
  const picture = clean(payload.picture, 1_000);
  if (!sub || !email || payload.email_verified !== true) throw new LoungeError("unverified_google_account", 403);

  const admin = await isAdminEmail(env, email);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO lounge_users
      (google_sub, email, display_name, avatar_url, role, build_balance, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)
     ON CONFLICT(google_sub) DO UPDATE SET
       email = excluded.email,
       display_name = excluded.display_name,
       avatar_url = excluded.avatar_url,
       role = CASE WHEN excluded.role = 'admin' THEN 'admin' ELSE lounge_users.role END,
       updated_at = excluded.updated_at,
       last_login_at = excluded.last_login_at`,
  ).bind(sub, email, name, picture, admin ? "admin" : "member", now, now, now).run();

  const row = await env.DB.prepare(
    `SELECT google_sub, email, display_name, avatar_url, role, build_balance,
            created_at, updated_at, last_login_at
       FROM lounge_users WHERE google_sub = ?`,
  ).bind(sub).first<LoungeUserRow>();
  if (!row) throw new LoungeError("user_record_failed", 500);

  return {
    sub: row.google_sub,
    email: row.email,
    name: row.display_name,
    picture: row.avatar_url,
    role: row.role,
    isAdmin: row.role === "admin",
    balance: Number(row.build_balance || 0),
  };
}

export async function loungeBoardAuth(request: Request, env: LoungeEnv) {
  try {
    return { identity: await getLoungeIdentity(request, env), response: null as Response | null };
  } catch (error) {
    return { identity: null, response: loungeErrorResponse(request, error) };
  }
}

function requireIdentity(identity: LoungeIdentity | null) {
  if (!identity) throw new LoungeError("login_required", 401);
  return identity;
}

function requireAdmin(identity: LoungeIdentity | null) {
  const user = requireIdentity(identity);
  if (!user.isAdmin) throw new LoungeError("admin_required", 403);
  return user;
}

function loungeErrorResponse(request: Request, error: unknown) {
  if (error instanceof LoungeError) return loungeJson(request, { error: error.code }, error.status);
  console.error("Builders Lounge API error", error instanceof Error ? error.message : String(error));
  return loungeJson(request, { error: "server_error" }, 500);
}

function openRouterCompatible(setting: ToolSetting | null | undefined) {
  return Boolean(setting && (setting.provider === "openrouter" || setting.endpoint_url.includes("openrouter.ai")));
}

function inheritedCredential(setting: ToolSetting, settings: ToolSetting[] = []) {
  if (setting.api_key_ciphertext && setting.api_key_iv) {
    return { configured: true, source: "tool" as const, credential: setting };
  }
  const meeting = setting.tool_id === "shorts"
    ? settings.find((candidate) => candidate.tool_id === "meeting")
    : null;
  if (openRouterCompatible(meeting) && meeting?.api_key_ciphertext && meeting.api_key_iv) {
    return { configured: true, source: "server-shared" as const, credential: meeting };
  }
  return { configured: false, source: "none" as const, credential: null };
}

function toolPublic(setting: ToolSetting, settings: ToolSetting[] = []) {
  const credential = inheritedCredential(setting, settings);
  return {
    id: setting.tool_id,
    name: setting.display_name,
    enabled: Number(setting.enabled || 0) === 1,
    cost: Math.max(0, Number(setting.build_cost || 0)),
    provider: setting.provider,
    model: setting.model,
    apiKeyConfigured: credential.configured,
    credentialSource: credential.source,
    updatedAt: setting.updated_at,
  };
}

async function toolSettings(env: LoungeEnv) {
  const rows = await env.DB.prepare(
    `SELECT tool_id, display_name, enabled, build_cost, provider, endpoint_url, model,
            system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at
       FROM lounge_tool_settings ORDER BY CASE tool_id
         WHEN 'meeting' THEN 1 WHEN 'shorts' THEN 2 WHEN 'webtoon' THEN 3 ELSE 4 END`,
  ).all<ToolSetting>();
  return rows.results || [];
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function configurationCryptoKey(env: LoungeEnv) {
  if (!env.LOUNGE_CONFIG_KEY) throw new LoungeError("config_encryption_not_ready", 503);
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(env.LOUNGE_CONFIG_KEY.trim());
  } catch {
    bytes = new Uint8Array();
  }
  if (bytes.byteLength !== 32) {
    bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(env.LOUNGE_CONFIG_KEY)));
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(env: LoungeEnv, value: string) {
  const key = await configurationCryptoKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

async function decryptApiKey(env: LoungeEnv, ciphertext: string, iv: string) {
  if (!ciphertext || !iv) return "";
  try {
    const key = await configurationCryptoKey(env);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(iv) },
      key,
      base64ToBytes(ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new LoungeError("api_key_decryption_failed", 503);
  }
}

function privateHostname(hostname: string) {
  const normalized = hostname.toLocaleLowerCase("en-US").replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1" || normalized.endsWith(".local")) return true;
  if (/^(0|10|127|169\.254|192\.168)\./.test(normalized)) return true;
  const match = normalized.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function endpointValue(value: unknown) {
  const raw = clean(value, 700);
  if (!raw) return "";
  let url: URL;
  try { url = new URL(raw); } catch { throw new LoungeError("invalid_endpoint", 400); }
  if (url.protocol !== "https:" || url.username || url.password || privateHostname(url.hostname)) {
    throw new LoungeError("invalid_endpoint", 400);
  }
  return url.toString();
}

function replaceModel(endpoint: string, model: string) {
  return endpoint.replaceAll("{model}", encodeURIComponent(model));
}

async function parseProviderResponse(response: Response) {
  const text = await response.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!response.ok) {
    const message = clean(
      body?.error?.message || body?.error?.metadata?.raw || body?.message || body?.error || text || `provider_${response.status}`,
      400,
    );
    throw new LoungeError("provider_request_failed", 502, message);
  }
  return { body, text };
}

function openaiCompatibleHeaders(provider: string, apiKey: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };
  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://aihubos.github.io/builders-lounge/";
    headers["X-Title"] = "Builders Lounge";
  }
  return headers;
}

function openaiCompatiblePayload(setting: ToolSetting, prompt: string) {
  return {
    model: setting.model,
    messages: [
      { role: "system", content: setting.system_prompt },
      { role: "user", content: prompt },
    ],
  };
}

function firstOpenAIText(body: any) {
  const choice = body?.choices?.[0];
  const message = choice?.message;
  if (typeof message?.content === "string") return message.content;
  if (Array.isArray(message?.content)) {
    return message.content.map((part: any) => {
      if (typeof part === "string") return part;
      if (typeof part?.text === "string") return part.text;
      return "";
    }).join("\n");
  }
  return body?.output_text || "";
}

function firstOpenAIImage(body: any) {
  const choice = body?.choices?.[0];
  const message = choice?.message;
  const bags = [message?.images, message?.content, body?.data];
  for (const bag of bags) {
    if (!Array.isArray(bag)) continue;
    for (const item of bag) {
      const url = item?.image_url?.url || item?.url || item?.b64_json || item?.image_base64 || "";
      if (typeof url === "string" && url.startsWith("data:image/")) return url.slice(0, 8_000_000);
      if (typeof item?.b64_json === "string" && item.b64_json) return `data:image/png;base64,${item.b64_json}`;
    }
  }
  const content = typeof message?.content === "string" ? message.content : "";
  const match = content.match(/data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+/i);
  return match ? match[0].slice(0, 8_000_000) : "";
}

function geminiText(body: any) {
  const parts = body?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts)
    ? parts.map((part: any) => typeof part?.text === "string" ? part.text : "").filter(Boolean).join("\n").trim()
    : "";
}

function geminiImage(body: any) {
  const candidates = Array.isArray(body?.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) return `data:${clean(inline.mimeType, 100) || "image/png"};base64,${String(inline.data)}`;
    }
  }
  return "";
}

async function callConfiguredProvider(setting: ToolSetting, apiKey: string, input: Record<string, unknown>, identity: LoungeIdentity) {
  const prompt = cleanMultiline(input.prompt ?? input.text ?? input.transcript, MAX_REQUEST_TEXT);
  if (!prompt) throw new LoungeError("prompt_required", 400);
  let provider = setting.endpoint_url.includes("openrouter.ai") ? "openrouter"
    : setting.endpoint_url.includes("moonshot.ai") || setting.endpoint_url.includes("moonshot.cn") ? "moonshot"
    : setting.provider;
  let endpointUrl = setting.endpoint_url;
  if ((setting.tool_id === "webtoon" || setting.tool_id === "masterpiece") && (provider === "openai" || provider === "openrouter")) {
    provider = "openrouter";
    endpointUrl = endpointUrl.includes("openrouter.ai") ? endpointUrl : "https://openrouter.ai/api/v1/chat/completions";
  }
  let model = setting.model;
  if (provider === "openrouter" && model && !model.includes("/")) {
    model = model.startsWith("kimi") || model.startsWith("moonshot") ? `moonshotai/${model}` : `openai/${model}`;
  }
  const endpoint = replaceModel(endpointUrl, model);
  if (!endpoint) throw new LoungeError("tool_not_configured", 503);

  let response: Response;

  if (provider === "openai" || provider === "openrouter" || provider === "moonshot") {
    const wantsImage = setting.tool_id === "masterpiece";
    const payload = openaiCompatiblePayload({ ...setting, model, provider, endpoint_url: endpointUrl }, prompt);
    if (wantsImage && provider === "openrouter") {
      (payload as Record<string, unknown>).modalities = ["image", "text"];
    }
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: openaiCompatibleHeaders(provider, apiKey),
        body: JSON.stringify(payload),
      });
    } catch (error) {
      throw new LoungeError("provider_request_failed", 504, "AI 서비스 응답이 지연되었습니다. 모델 이름과 OpenRouter 설정을 확인해 주세요.");
    }
    const { body } = await parseProviderResponse(response);
    if (wantsImage) {
      const imageDataUrl = firstOpenAIImage(body);
      if (!imageDataUrl) throw new LoungeError("empty_provider_response", 502);
      return { imageDataUrl, text: cleanMultiline(firstOpenAIText(body), 160_000), providerRef: clean(body?.id, 200) };
    }
    const text = cleanMultiline(firstOpenAIText(body), 160_000);
    if (!text) throw new LoungeError("empty_provider_response", 502);
    return { text, providerRef: clean(body?.id, 200) };
  }

  if (setting.provider === "anthropic") {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: setting.model,
        max_tokens: 4096,
        system: setting.system_prompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const { body } = await parseProviderResponse(response);
    const text = cleanMultiline(
      Array.isArray(body?.content) ? body.content.map((part: any) => part?.text || "").join("\n") : "",
      160_000,
    );
    if (!text) throw new LoungeError("empty_provider_response", 502);
    return { text, providerRef: clean(body?.id, 200) };
  }

  if (setting.provider === "gemini" || setting.provider === "gemini-image") {
    const parts = [{ text: [setting.system_prompt, prompt].filter(Boolean).join("\n\n") }];
    const generationConfig = setting.provider === "gemini-image"
      ? { responseModalities: ["IMAGE", "TEXT"] }
      : undefined;
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ role: "user", parts }], ...(generationConfig ? { generationConfig } : {}) }),
    });
    const { body } = await parseProviderResponse(response);
    if (setting.provider === "gemini-image") {
      const imageDataUrl = geminiImage(body);
      if (!imageDataUrl) throw new LoungeError("empty_provider_response", 502);
      return { imageDataUrl, text: geminiText(body), providerRef: setting.model };
    }
    const text = cleanMultiline(geminiText(body), 160_000);
    if (!text) throw new LoungeError("empty_provider_response", 502);
    return { text, providerRef: setting.model };
  }

  response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      toolId: setting.tool_id,
      model: setting.model,
      input,
      user: { id: identity.sub, email: identity.email, name: identity.name },
    }),
  });
  const { body, text } = await parseProviderResponse(response);
  const result = body && typeof body === "object" ? body : { text: cleanMultiline(text, 160_000) };
  const safeResult = {
    text: cleanMultiline(result.text ?? result.result ?? result.output, 160_000),
    imageDataUrl: typeof result.imageDataUrl === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(result.imageDataUrl)
      ? result.imageDataUrl.slice(0, 8_000_000)
      : "",
    jobUrl: (() => {
      try {
        const url = new URL(String(result.jobUrl || result.resultUrl || ""));
        return url.protocol === "https:" ? url.toString() : "";
      } catch { return ""; }
    })(),
    providerRef: clean(result.id ?? result.jobId, 200),
  };
  if (!safeResult.text && !safeResult.imageDataUrl && !safeResult.jobUrl) throw new LoungeError("empty_provider_response", 502);
  return safeResult;
}

async function reserveBuilds(env: LoungeEnv, identity: LoungeIdentity, setting: ToolSetting, requestId: string) {
  const existing = await env.DB.prepare(
    "SELECT id, status FROM lounge_tool_jobs WHERE user_sub = ? AND request_id = ?",
  ).bind(identity.sub, requestId).first<{ id: string; status: string }>();
  if (existing) throw new LoungeError("request_already_used", 409);

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO lounge_tool_jobs
      (id, request_id, user_sub, tool_id, build_cost, status, provider_ref, error_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'reserving', '', '', ?, ?)`,
  ).bind(jobId, requestId, identity.sub, setting.tool_id, setting.build_cost, now, now).run();
  if (Number(inserted.meta?.changes || 0) !== 1) throw new LoungeError("request_already_used", 409);

  const charged = await env.DB.prepare(
    `UPDATE lounge_users
        SET build_balance = build_balance - ?, updated_at = ?
      WHERE google_sub = ? AND build_balance >= ?`,
  ).bind(setting.build_cost, now, identity.sub, setting.build_cost).run();
  if (Number(charged.meta?.changes || 0) !== 1) {
    await env.DB.prepare(
      "UPDATE lounge_tool_jobs SET status = 'failed', error_code = 'insufficient_builds', updated_at = ? WHERE id = ?",
    ).bind(now, jobId).run();
    throw new LoungeError("insufficient_builds", 402);
  }

  const balance = await env.DB.prepare(
    "SELECT build_balance FROM lounge_users WHERE google_sub = ?",
  ).bind(identity.sub).first<{ build_balance: number }>();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO lounge_build_ledger
        (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
       VALUES (?, ?, ?, ?, 'tool_job', ?, ?, ?)`,
    ).bind(crypto.randomUUID(), identity.sub, -setting.build_cost, `${setting.display_name} 사용`, jobId, Number(balance?.build_balance || 0), now),
    env.DB.prepare(
      "UPDATE lounge_tool_jobs SET status = 'processing', updated_at = ? WHERE id = ?",
    ).bind(now, jobId),
  ]);
  return jobId;
}

async function refundBuilds(env: LoungeEnv, identity: LoungeIdentity, setting: ToolSetting, jobId: string, errorCode: string) {
  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO lounge_build_ledger
      (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
     SELECT ?, ?, ?, ?, 'tool_refund', ?, build_balance + ?, ?
       FROM lounge_users WHERE google_sub = ?`,
  ).bind(
    crypto.randomUUID(), identity.sub, setting.build_cost, `${setting.display_name} 실패 환불`,
    jobId, setting.build_cost, now, identity.sub,
  ).run();
  if (Number(inserted.meta?.changes || 0) === 1) {
    await env.DB.prepare(
      "UPDATE lounge_users SET build_balance = build_balance + ?, updated_at = ? WHERE google_sub = ?",
    ).bind(setting.build_cost, now, identity.sub).run();
  }
  await env.DB.prepare(
    "UPDATE lounge_tool_jobs SET status = 'refunded', error_code = ?, updated_at = ? WHERE id = ?",
  ).bind(clean(errorCode, 80), now, jobId).run();
}

async function generateWithTool(request: Request, env: LoungeEnv, identity: LoungeIdentity, toolId: string) {
  if (!TOOL_IDS.has(toolId)) throw new LoungeError("tool_not_found", 404);
  if (toolId === "shorts") throw new LoungeError("shorts_use_studio", 409);
  const setting = await env.DB.prepare(
    `SELECT tool_id, display_name, enabled, build_cost, provider, endpoint_url, model,
            system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at
       FROM lounge_tool_settings WHERE tool_id = ?`,
  ).bind(toolId).first<ToolSetting>();
  if (!setting) throw new LoungeError("tool_not_found", 404);
  if (Number(setting.enabled || 0) !== 1) throw new LoungeError("tool_disabled", 503);
  if (!setting.api_key_ciphertext || !setting.api_key_iv) throw new LoungeError("tool_not_configured", 503);

  const payload = await readJson(request);
  const requestId = clean(payload.requestId || request.headers.get("X-Request-Id"), 80);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(requestId)) throw new LoungeError("invalid_request_id", 400);
  const input = payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
    ? payload.input as Record<string, unknown>
    : payload;

  const jobId = await reserveBuilds(env, identity, setting, requestId);
  try {
    const apiKey = await decryptApiKey(env, setting.api_key_ciphertext, setting.api_key_iv);
    const result = await callConfiguredProvider(setting, apiKey, input, identity);
    const now = new Date().toISOString();
    await env.DB.prepare(
      "UPDATE lounge_tool_jobs SET status = 'completed', provider_ref = ?, updated_at = ? WHERE id = ?",
    ).bind(clean(result.providerRef, 200), now, jobId).run();
    const user = await env.DB.prepare(
      "SELECT build_balance FROM lounge_users WHERE google_sub = ?",
    ).bind(identity.sub).first<{ build_balance: number }>();
    return loungeJson(request, {
      ok: true,
      jobId,
      tool: toolPublic(setting),
      result,
      balance: Number(user?.build_balance || 0),
    });
  } catch (error) {
    await refundBuilds(env, identity, setting, jobId, error instanceof LoungeError ? error.code : "provider_request_failed");
    throw error;
  }
}

function shortsRequestId(value: unknown) {
  const requestId = clean(value, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(requestId)) {
    throw new LoungeError("invalid_request_id", 400);
  }
  return requestId;
}

function shortsSettings(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    subtitles: input.subtitles !== false,
    subtitleStyle: ["basic", "emphasis", "minimal"].includes(clean(input.subtitleStyle, 20))
      ? clean(input.subtitleStyle, 20)
      : "basic",
    voice: input.voice === true,
    voiceId: clean(input.voiceId, 80) || "none",
  };
}

function safeScenes(value: unknown, fallback: string) {
  const items = Array.isArray(value) ? value : [];
  const scenes = items.slice(0, 8).map((item, index) => {
    const row = item && typeof item === "object" && !Array.isArray(item)
      ? item as Record<string, unknown>
      : {};
    const narration = cleanMultiline(row.narration ?? row.script ?? row.text, 600);
    const subtitle = clean(row.subtitle ?? narration, 140);
    return {
      id: index + 1,
      title: clean(row.title, 80) || `장면 ${index + 1}`,
      visual: cleanMultiline(row.visual ?? row.screen, 400) || "핵심 내용을 읽기 쉬운 세로형 카드로 보여 줍니다.",
      narration: narration || subtitle,
      subtitle: subtitle || `장면 ${index + 1}`,
      durationSeconds: Math.min(8, Math.max(2, Math.trunc(Number(row.durationSeconds) || 4))),
      audioUrl: "",
    };
  }).filter((scene) => scene.narration || scene.subtitle);
  if (scenes.length) return scenes;
  const chunks = fallback.split(/\n{2,}|(?<=[.!?。！？])\s+/).map((part) => cleanMultiline(part, 500)).filter(Boolean).slice(0, 6);
  return (chunks.length ? chunks : [fallback]).map((part, index) => ({
    id: index + 1,
    title: `장면 ${index + 1}`,
    visual: "핵심 내용을 읽기 쉬운 세로형 카드로 보여 줍니다.",
    narration: part,
    subtitle: clean(part, 100),
    durationSeconds: 4,
    audioUrl: "",
  }));
}

function parseShortsPlan(text: string, topic: string) {
  const candidate = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const detailedPrompt = cleanMultiline(parsed.detailedPrompt ?? parsed.prompt ?? text, 30_000) || topic;
    return {
      detailedPrompt,
      scenes: safeScenes(parsed.scenes, detailedPrompt),
      // 음성 파일은 신뢰된 서버 렌더러가 발급해야 합니다. 모델이 작성한 URL은 사용하지 않습니다.
      narrationUrl: "",
    };
  } catch {
    const detailedPrompt = cleanMultiline(text, 30_000) || topic;
    return { detailedPrompt, scenes: safeScenes([], detailedPrompt), narrationUrl: "" };
  }
}

async function shortsToolContext(env: LoungeEnv) {
  const settings = await toolSettings(env);
  const shorts = settings.find((setting) => setting.tool_id === "shorts");
  if (!shorts) throw new LoungeError("tool_not_found", 404);
  if (Number(shorts.enabled || 0) !== 1) throw new LoungeError("tool_disabled", 503);
  if (Number(shorts.build_cost || 0) !== 5) throw new LoungeError("shorts_cost_misconfigured", 503);
  const inherited = inheritedCredential(shorts, settings);
  if (!inherited.configured || !inherited.credential) throw new LoungeError("tool_not_configured", 503);
  const credential = inherited.credential;
  const effective = inherited.source === "server-shared"
    ? { ...shorts, provider: credential.provider, endpoint_url: credential.endpoint_url }
    : shorts;
  const apiKey = await decryptApiKey(env, credential.api_key_ciphertext, credential.api_key_iv);
  return { shorts, effective, apiKey, credentialSource: inherited.source };
}

async function shortsJob(env: LoungeEnv, identity: LoungeIdentity, jobId: string) {
  const row = await env.DB.prepare(
    `SELECT s.*, j.build_cost, j.status AS tool_status
       FROM lounge_shorts_jobs s
       JOIN lounge_tool_jobs j ON j.id = s.job_id
      WHERE s.job_id = ? AND s.user_sub = ?`,
  ).bind(jobId, identity.sub).first<ShortsJobRow>();
  if (!row) throw new LoungeError("shorts_job_not_found", 404);
  return row;
}

async function shortsBalance(env: LoungeEnv, userSub: string) {
  const row = await env.DB.prepare(
    "SELECT build_balance FROM lounge_users WHERE google_sub = ?",
  ).bind(userSub).first<{ build_balance: number }>();
  return Number(row?.build_balance || 0);
}

async function shortsLedgerRefs(env: LoungeEnv, jobId: string) {
  const rows = await env.DB.prepare(
    "SELECT id, event_type FROM lounge_shorts_ledger_events WHERE job_id = ?",
  ).bind(jobId).all<{ id: string; event_type: "reservation" | "confirmation" | "release" }>();
  const refs = Object.fromEntries((rows.results || []).map((row) => [row.event_type, row.id]));
  return {
    reservationEventId: refs.reservation || "",
    confirmationEventId: refs.confirmation || "",
    releaseEventId: refs.release || "",
  };
}

function shortsMediaUrl(request: Request, jobId: string) {
  return `${new URL(request.url).origin}/lounge/shorts/${encodeURIComponent(jobId)}/media`;
}

async function releaseShortsReservation(env: LoungeEnv, identity: LoungeIdentity, row: ShortsJobRow, reason: string) {
  if (row.reservation_status !== "reserved") return row.reservation_status;
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE lounge_users
          SET build_balance = build_balance + ?, updated_at = ?
        WHERE google_sub = ?
          AND EXISTS (SELECT 1 FROM lounge_shorts_jobs WHERE job_id = ? AND reservation_status = 'reserved')`,
    ).bind(row.build_cost, now, identity.sub, row.job_id),
    env.DB.prepare(
      `UPDATE lounge_shorts_jobs
          SET reservation_status = 'released', updated_at = ?
        WHERE job_id = ? AND user_sub = ? AND reservation_status = 'reserved'`,
    ).bind(now, row.job_id, identity.sub),
    env.DB.prepare(
      `UPDATE lounge_tool_jobs
          SET status = 'refunded', error_code = ?, updated_at = ?
        WHERE id = ? AND user_sub = ? AND status <> 'completed'`,
    ).bind(clean(reason, 80) || "released", now, row.job_id, identity.sub),
    env.DB.prepare(
      `INSERT OR IGNORE INTO lounge_shorts_ledger_events
        (id, job_id, user_sub, event_type, delta, balance_after, reason, created_at)
       SELECT ?, s.job_id, s.user_sub, 'release', 5, u.build_balance, ?, ?
         FROM lounge_shorts_jobs s
         JOIN lounge_users u ON u.google_sub = s.user_sub
        WHERE s.job_id = ? AND s.user_sub = ? AND s.reservation_status = 'released'`,
    ).bind(crypto.randomUUID(), clean(reason, 80) || "released", now, row.job_id, identity.sub),
  ]);
  return "released";
}

async function prepareShorts(request: Request, env: LoungeEnv, identity: LoungeIdentity) {
  const payload = await readJson(request, 24_000);
  const requestId = shortsRequestId(payload.requestId || request.headers.get("X-Request-Id"));
  const topic = cleanMultiline(payload.topic, 300);
  if (topic.length < 5) throw new LoungeError("shorts_topic_too_short", 400);
  const settings = shortsSettings(payload.settings);
  const context = await shortsToolContext(env);

  const existing = await env.DB.prepare(
    `SELECT s.*, j.build_cost, j.status AS tool_status
       FROM lounge_shorts_jobs s
       JOIN lounge_tool_jobs j ON j.id = s.job_id
      WHERE s.user_sub = ? AND s.request_id = ?`,
  ).bind(identity.sub, requestId).first<ShortsJobRow>();
  if (existing) {
    const ledgerRefs = await shortsLedgerRefs(env, existing.job_id);
    return loungeJson(request, {
      requestId,
      jobId: existing.job_id,
      status: existing.tool_status,
      detailedPrompt: existing.detailed_prompt,
      scenes: JSON.parse(existing.scenes_json || "[]"),
      narrationUrl: "",
      balance: await shortsBalance(env, identity.sub),
      credentialSource: context.credentialSource,
      ...ledgerRefs,
    }, existing.detailed_prompt ? 200 : 202);
  }

  const now = new Date().toISOString();
  const jobId = crypto.randomUUID();
  const [jobInsert, shortsInsert, balanceUpdate] = await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO lounge_tool_jobs
        (id, request_id, user_sub, tool_id, build_cost, status, provider_ref, error_code, created_at, updated_at)
       VALUES (?, ?, ?, 'shorts', ?, 'reserving', '', '', ?, ?)`,
    ).bind(jobId, requestId, identity.sub, context.shorts.build_cost, now, now),
    env.DB.prepare(
      `INSERT OR IGNORE INTO lounge_shorts_jobs
        (job_id, request_id, user_sub, topic, settings_json, reservation_status, created_at, updated_at)
       SELECT ?, ?, ?, ?, ?, 'reserved', ?, ?
        WHERE EXISTS (
          SELECT 1 FROM lounge_tool_jobs
           WHERE id = ? AND user_sub = ? AND request_id = ? AND tool_id = 'shorts'
        )`,
    ).bind(jobId, requestId, identity.sub, topic, JSON.stringify(settings), now, now,
      jobId, identity.sub, requestId),
    env.DB.prepare(
      `UPDATE lounge_users SET build_balance = build_balance - ?, updated_at = ?
        WHERE google_sub = ? AND build_balance >= ?
          AND EXISTS (
            SELECT 1 FROM lounge_shorts_jobs
             WHERE job_id = ? AND user_sub = ? AND request_id = ? AND reservation_status = 'reserved'
          )`,
    ).bind(context.shorts.build_cost, now, identity.sub, context.shorts.build_cost,
      jobId, identity.sub, requestId),
  ]);
  if (Number(jobInsert.meta?.changes || 0) !== 1 || Number(shortsInsert.meta?.changes || 0) !== 1) {
    throw new LoungeError("request_already_used", 409);
  }
  if (Number(balanceUpdate.meta?.changes || 0) !== 1) {
    await env.DB.batch([
      env.DB.prepare("UPDATE lounge_shorts_jobs SET reservation_status = 'released', updated_at = ? WHERE job_id = ?").bind(now, jobId),
      env.DB.prepare("UPDATE lounge_tool_jobs SET status = 'failed', error_code = 'insufficient_builds', updated_at = ? WHERE id = ?").bind(now, jobId),
    ]);
    throw new LoungeError("insufficient_builds", 402);
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO lounge_shorts_ledger_events
        (id, job_id, user_sub, event_type, delta, balance_after, reason, created_at)
       SELECT ?, ?, ?, 'reservation', -5, build_balance, 'video_generation', ?
         FROM lounge_users WHERE google_sub = ?`,
    ).bind(crypto.randomUUID(), jobId, identity.sub, now, identity.sub),
    env.DB.prepare(
      "UPDATE lounge_tool_jobs SET status = 'processing', updated_at = ? WHERE id = ? AND user_sub = ? AND status = 'reserving'",
    ).bind(now, jobId, identity.sub),
  ]);

  const prompt = `다음 한 문장을 한국어 세로형 쇼츠 제작안으로 확장하세요.\n\n주제: ${topic}\n자막 사용: ${settings.subtitles ? "예" : "아니오"}\n자막 스타일: ${settings.subtitleStyle}\n음성 사용: ${settings.voice ? "예" : "아니오"}\n\nJSON 객체 하나만 반환하세요. 필드: detailedPrompt 문자열, scenes 배열. 각 장면은 title, visual, narration, subtitle, durationSeconds(2~8)를 포함합니다. 입력에 없는 사실을 만들지 말고 총 3~6장면으로 구성하세요.`;
  try {
    const result = await callConfiguredProvider(context.effective, context.apiKey, { prompt }, identity);
    const plan = parseShortsPlan(result.text, topic);
    const updatedAt = new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE lounge_shorts_jobs SET detailed_prompt = ?, scenes_json = ?, updated_at = ? WHERE job_id = ? AND reservation_status = 'reserved'",
      ).bind(plan.detailedPrompt, JSON.stringify(plan.scenes), updatedAt, jobId),
      env.DB.prepare(
        "UPDATE lounge_tool_jobs SET provider_ref = ?, updated_at = ? WHERE id = ? AND status = 'processing'",
      ).bind(clean(result.providerRef, 200), updatedAt, jobId),
    ]);
    const ledgerRefs = await shortsLedgerRefs(env, jobId);
    return loungeJson(request, {
      requestId,
      jobId,
      status: "processing",
      detailedPrompt: plan.detailedPrompt,
      scenes: plan.scenes,
      narrationUrl: plan.narrationUrl,
      balance: await shortsBalance(env, identity.sub),
      credentialSource: context.credentialSource,
      ...ledgerRefs,
    }, 201);
  } catch (error) {
    const row = await shortsJob(env, identity, jobId);
    await releaseShortsReservation(env, identity, row, error instanceof LoungeError ? error.code : "provider_request_failed");
    throw error;
  }
}

async function uploadShorts(request: Request, env: LoungeEnv, identity: LoungeIdentity, jobId: string) {
  if (!env.PRIVATE_REPORTS) throw new LoungeError("shorts_storage_not_configured", 503);
  const row = await shortsJob(env, identity, jobId);
  if (row.reservation_status === "released") throw new LoungeError("shorts_reservation_released", 409);
  if (row.reservation_status === "confirmed" && row.media_key) {
    const ledgerRefs = await shortsLedgerRefs(env, jobId);
    return loungeJson(request, {
      requestId: row.request_id,
      jobId,
      status: "completed",
      mediaUrl: shortsMediaUrl(request, jobId),
      mediaType: row.media_type,
      balance: await shortsBalance(env, identity.sub),
      ...ledgerRefs,
    });
  }
  const contentType = clean(request.headers.get("Content-Type"), 100).toLocaleLowerCase("en-US");
  if (!contentType.startsWith("video/webm")) throw new LoungeError("shorts_webm_required", 415);
  const mediaSize = Math.trunc(Number(request.headers.get("X-File-Size") || request.headers.get("Content-Length") || 0));
  if (!Number.isFinite(mediaSize) || mediaSize <= 0 || mediaSize > MAX_SHORTS_BYTES) {
    throw new LoungeError("shorts_file_size_invalid", 413);
  }
  if (!request.body) throw new LoungeError("shorts_video_required", 400);
  const mediaKey = `lounge-shorts/${jobId}.webm`;
  await env.PRIVATE_REPORTS.put(mediaKey, request.body, { httpMetadata: { contentType: "video/webm" } });
  const stored = await env.PRIVATE_REPORTS.get(mediaKey);
  const storedSize = Number(stored?.size ?? mediaSize);
  if (!stored || !Number.isFinite(storedSize) || storedSize <= 0 || storedSize > MAX_SHORTS_BYTES || storedSize !== mediaSize) {
    await env.PRIVATE_REPORTS.delete(mediaKey).catch(() => undefined);
    throw new LoungeError("shorts_file_size_invalid", 413);
  }
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT OR IGNORE INTO lounge_build_ledger
          (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
         SELECT ?, ?, -j.build_cost, 'AI 쇼츠 스튜디오 사용', 'tool_job', j.id, u.build_balance, ?
           FROM lounge_tool_jobs j
           JOIN lounge_shorts_jobs s ON s.job_id = j.id
           JOIN lounge_users u ON u.google_sub = j.user_sub
          WHERE j.id = ? AND j.user_sub = ? AND s.reservation_status = 'reserved'`,
      ).bind(crypto.randomUUID(), identity.sub, now, jobId, identity.sub),
      env.DB.prepare(
        `UPDATE lounge_shorts_jobs
            SET reservation_status = 'confirmed', media_key = ?, media_type = 'video/webm', media_size = ?, updated_at = ?
          WHERE job_id = ? AND user_sub = ? AND reservation_status = 'reserved'`,
      ).bind(mediaKey, mediaSize, now, jobId, identity.sub),
      env.DB.prepare(
        "UPDATE lounge_tool_jobs SET status = 'completed', error_code = '', updated_at = ? WHERE id = ? AND user_sub = ? AND status = 'processing'",
      ).bind(now, jobId, identity.sub),
      env.DB.prepare(
        `INSERT OR IGNORE INTO lounge_shorts_ledger_events
          (id, job_id, user_sub, event_type, delta, balance_after, reason, created_at)
         SELECT ?, s.job_id, s.user_sub, 'confirmation', 0, u.build_balance, 'r2_video_stored', ?
           FROM lounge_shorts_jobs s
           JOIN lounge_tool_jobs j ON j.id = s.job_id
           JOIN lounge_users u ON u.google_sub = s.user_sub
          WHERE s.job_id = ? AND s.user_sub = ?
            AND s.reservation_status = 'confirmed' AND j.status = 'completed'`,
      ).bind(crypto.randomUUID(), now, jobId, identity.sub),
    ]);
  } catch {
    const current = await shortsJob(env, identity, jobId).catch(() => null);
    if (current?.reservation_status !== "confirmed" || current.tool_status !== "completed") {
      await env.PRIVATE_REPORTS.delete(mediaKey).catch(() => undefined);
      throw new LoungeError("shorts_upload_commit_failed", 500);
    }
  }
  const committed = await shortsJob(env, identity, jobId);
  if (committed.reservation_status !== "confirmed" || committed.tool_status !== "completed" || committed.media_key !== mediaKey) {
    await env.PRIVATE_REPORTS.delete(mediaKey).catch(() => undefined);
    throw new LoungeError("shorts_upload_commit_failed", 500);
  }
  const ledgerRefs = await shortsLedgerRefs(env, jobId);
  return loungeJson(request, {
    requestId: row.request_id,
    jobId,
    status: "completed",
    mediaUrl: shortsMediaUrl(request, jobId),
    mediaType: "video/webm",
    balance: await shortsBalance(env, identity.sub),
    ...ledgerRefs,
  });
}

async function releaseShorts(request: Request, env: LoungeEnv, identity: LoungeIdentity, jobId: string) {
  const payload = await readJson(request, 4_000);
  const row = await shortsJob(env, identity, jobId);
  if (row.reservation_status === "confirmed") throw new LoungeError("shorts_already_completed", 409);
  await releaseShortsReservation(env, identity, row, clean(payload.reason, 80) || "user_cancelled");
  if (row.media_key && env.PRIVATE_REPORTS) await env.PRIVATE_REPORTS.delete(row.media_key);
  const ledgerRefs = await shortsLedgerRefs(env, jobId);
  return loungeJson(request, {
    requestId: row.request_id,
    jobId,
    status: "released",
    balance: await shortsBalance(env, identity.sub),
    ...ledgerRefs,
  });
}

async function publishShorts(request: Request, env: LoungeEnv, identity: LoungeIdentity, jobId: string) {
  if (!env.PRIVATE_REPORTS) throw new LoungeError("shorts_storage_not_configured", 503);
  const payload = await readJson(request, 12_000);
  const publishRequestId = shortsRequestId(payload.publishRequestId || payload.requestId || request.headers.get("X-Request-Id"));
  const title = clean(payload.title, 100);
  const content = cleanMultiline(payload.content, 5_000);
  if (title.length < 4) throw new LoungeError("title_too_short", 400);
  if (content.length < 10) throw new LoungeError("content_too_short", 400);
  if (payload.rightsConfirmed !== true) throw new LoungeError("shorts_rights_confirmation_required", 400);
  const row = await shortsJob(env, identity, jobId);
  if (row.reservation_status !== "confirmed" || row.tool_status !== "completed" || !row.media_key) {
    throw new LoungeError("shorts_not_completed", 409);
  }
  const media = await env.PRIVATE_REPORTS.get(row.media_key);
  if (!media) throw new LoungeError("shorts_media_missing", 409);
  if (row.published_post_id) {
    return loungeJson(request, {
      publishRequestId: row.publish_request_id || publishRequestId,
      jobId,
      postId: row.published_post_id,
      postUrl: `https://aihubos.github.io/builders-lounge/?post=${encodeURIComponent(row.published_post_id)}#board`,
      category: "knowledge_share",
      visibility: "public",
      rewardBuilds: 0,
    });
  }

  const postId = crypto.randomUUID();
  const now = new Date().toISOString();
  const salt = crypto.randomUUID();
  const opaquePassword = crypto.randomUUID();
  const mediaUrl = shortsMediaUrl(request, jobId);
  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO board_posts
          (id, category, title, content, author, password_salt, password_hash, is_admin,
           view_count, comment_count, created_at, updated_at, user_sub, reward_builds,
           origin, media_url, media_type, shorts_job_id, rights_notice_version, rights_confirmed_at)
         VALUES (?, 'knowledge_share', ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, 0,
                 'shorts', ?, 'video/webm', ?, ?, ?)`,
      ).bind(postId, title, content, identity.name, salt, opaquePassword, identity.isAdmin ? 1 : 0, now,
        identity.sub, mediaUrl, jobId, SHORTS_RIGHTS_VERSION, now),
      env.DB.prepare(
        `UPDATE lounge_shorts_jobs
            SET published_post_id = ?, publish_request_id = ?, rights_notice_version = ?, rights_confirmed_at = ?, updated_at = ?
          WHERE job_id = ? AND user_sub = ? AND published_post_id = ''`,
      ).bind(postId, publishRequestId, SHORTS_RIGHTS_VERSION, now, now, jobId, identity.sub),
    ]);
  } catch {
    const existing = await env.DB.prepare(
      "SELECT published_post_id, publish_request_id FROM lounge_shorts_jobs WHERE job_id = ? AND user_sub = ?",
    ).bind(jobId, identity.sub).first<{ published_post_id: string; publish_request_id: string }>();
    if (!existing?.published_post_id) throw new LoungeError("shorts_publish_failed", 500);
    return loungeJson(request, {
      publishRequestId: existing.publish_request_id,
      jobId,
      postId: existing.published_post_id,
      postUrl: `https://aihubos.github.io/builders-lounge/?post=${encodeURIComponent(existing.published_post_id)}#board`,
      category: "knowledge_share",
      visibility: "public",
      rewardBuilds: 0,
    });
  }
  return loungeJson(request, {
    publishRequestId,
    jobId,
    postId,
    postUrl: `https://aihubos.github.io/builders-lounge/?post=${encodeURIComponent(postId)}#board`,
    category: "knowledge_share",
    visibility: "public",
    rewardBuilds: 0,
  }, 201);
}

async function shortsMedia(request: Request, env: LoungeEnv, identity: LoungeIdentity | null, jobId: string) {
  if (!env.PRIVATE_REPORTS) throw new LoungeError("shorts_storage_not_configured", 503);
  const row = await env.DB.prepare(
    "SELECT user_sub, media_key, media_type, published_post_id FROM lounge_shorts_jobs WHERE job_id = ?",
  ).bind(jobId).first<{ user_sub: string; media_key: string; media_type: string; published_post_id: string }>();
  if (!row?.media_key) throw new LoungeError("shorts_media_missing", 404);
  if (!row.published_post_id && identity?.sub !== row.user_sub) throw new LoungeError("not_owner", identity ? 403 : 401);
  const object = await env.PRIVATE_REPORTS.get(row.media_key);
  if (!object) throw new LoungeError("shorts_media_missing", 404);
  const headers = new Headers({
    "Content-Type": row.media_type || object.httpMetadata?.contentType || "video/webm",
    "Content-Disposition": `inline; filename="shorts-${jobId}.webm"`,
    ...loungeCors(request),
  });
  headers.set("Cache-Control", row.published_post_id ? "public, max-age=3600" : "private, no-store");
  return new Response(object.body || await object.arrayBuffer(), { status: 200, headers });
}

async function writeAudit(env: LoungeEnv, admin: LoungeIdentity, action: string, targetType: string, targetId: string, detail = "") {
  await env.DB.prepare(
    `INSERT INTO lounge_admin_audit
      (id, admin_sub, action, target_type, target_id, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), admin.sub, clean(action, 80), clean(targetType, 80), clean(targetId, 254), cleanMultiline(detail, 2_000), new Date().toISOString()).run();
}

async function updateTool(request: Request, env: LoungeEnv, admin: LoungeIdentity, toolId: string) {
  if (!TOOL_IDS.has(toolId)) throw new LoungeError("tool_not_found", 404);
  const current = await env.DB.prepare(
    `SELECT tool_id, display_name, enabled, build_cost, provider, endpoint_url, model,
            system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at
       FROM lounge_tool_settings WHERE tool_id = ?`,
  ).bind(toolId).first<ToolSetting>();
  if (!current) throw new LoungeError("tool_not_found", 404);
  const payload = await readJson(request, 40_000);
  const provider = clean(payload.provider ?? current.provider, 40);
  if (!PROVIDERS.has(provider)) throw new LoungeError("invalid_provider", 400);
  const buildCost = Math.trunc(Number(payload.buildCost ?? current.build_cost));
  if (!Number.isFinite(buildCost) || buildCost < 0 || buildCost > 10_000) throw new LoungeError("invalid_build_cost", 400);
  if (toolId === "shorts" && buildCost !== 5) throw new LoungeError("shorts_cost_misconfigured", 400);
  const displayName = clean(payload.displayName ?? current.display_name, 80);
  const endpointUrl = endpointValue(payload.endpointUrl ?? current.endpoint_url);
  const model = clean(payload.model ?? current.model, 120);
  const systemPrompt = cleanMultiline(payload.systemPrompt ?? current.system_prompt, 8_000);
  if (!displayName || !endpointUrl || !model) throw new LoungeError("tool_setting_required", 400);

  let ciphertext = current.api_key_ciphertext;
  let iv = current.api_key_iv;
  if (payload.clearApiKey === true) {
    ciphertext = "";
    iv = "";
  } else if (typeof payload.apiKey === "string" && payload.apiKey.trim()) {
    const apiKey = payload.apiKey.trim().slice(0, 10_000);
    const encrypted = await encryptApiKey(env, apiKey);
    ciphertext = encrypted.ciphertext;
    iv = encrypted.iv;
  }

  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE lounge_tool_settings
        SET display_name = ?, enabled = ?, build_cost = ?, provider = ?, endpoint_url = ?,
            model = ?, system_prompt = ?, api_key_ciphertext = ?, api_key_iv = ?,
            updated_by = ?, updated_at = ?
      WHERE tool_id = ?`,
  ).bind(
    displayName, payload.enabled === undefined ? current.enabled : payload.enabled === true ? 1 : 0,
    buildCost, provider, endpointUrl, model, systemPrompt, ciphertext, iv, admin.email, now, toolId,
  ).run();
  await writeAudit(env, admin, "tool.update", "tool", toolId, `provider=${provider}, cost=${buildCost}, enabled=${payload.enabled === undefined ? current.enabled : payload.enabled === true ? 1 : 0}`);
  const updated = await env.DB.prepare(
    `SELECT tool_id, display_name, enabled, build_cost, provider, endpoint_url, model,
            system_prompt, api_key_ciphertext, api_key_iv, updated_by, updated_at
       FROM lounge_tool_settings WHERE tool_id = ?`,
  ).bind(toolId).first<ToolSetting>();
  const settings = updated ? await toolSettings(env) : [];
  return loungeJson(request, { tool: updated ? { ...toolPublic(updated, settings), endpointUrl: updated.endpoint_url, systemPrompt: updated.system_prompt, updatedBy: updated.updated_by } : null });
}

async function adjustBuilds(request: Request, env: LoungeEnv, admin: LoungeIdentity, userSub: string) {
  const payload = await readJson(request, 8_000);
  const delta = Math.trunc(Number(payload.delta));
  const reason = clean(payload.reason, 200);
  if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 100_000) throw new LoungeError("invalid_build_delta", 400);
  if (reason.length < 2) throw new LoungeError("build_reason_required", 400);
  const user = await env.DB.prepare(
    "SELECT google_sub FROM lounge_users WHERE google_sub = ?",
  ).bind(userSub).first<{ google_sub: string }>();
  if (!user) throw new LoungeError("user_not_found", 404);
  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE lounge_users SET build_balance = build_balance + ?, updated_at = ? WHERE google_sub = ?",
  ).bind(delta, now, userSub).run();
  const balance = await env.DB.prepare(
    "SELECT build_balance FROM lounge_users WHERE google_sub = ?",
  ).bind(userSub).first<{ build_balance: number }>();
  await env.DB.prepare(
    `INSERT INTO lounge_build_ledger
      (id, user_sub, delta, reason, ref_type, ref_id, balance_after, created_at)
     VALUES (?, ?, ?, ?, 'admin_adjustment', ?, ?, ?)`,
  ).bind(crypto.randomUUID(), userSub, delta, reason, crypto.randomUUID(), Number(balance?.build_balance || 0), now).run();
  await writeAudit(env, admin, "build.adjust", "user", userSub, `delta=${delta}, reason=${reason}`);
  return loungeJson(request, { ok: true, balance: Number(balance?.build_balance || 0) });
}

async function deleteUser(request: Request, env: LoungeEnv, admin: LoungeIdentity, userSub: string) {
  if (userSub === admin.sub) throw new LoungeError("cannot_delete_self", 400);
  const payload = await readJson(request, 4_000);
  const user = await env.DB.prepare(
    "SELECT email FROM lounge_users WHERE google_sub = ?",
  ).bind(userSub).first<{ email: string }>();
  if (!user) throw new LoungeError("user_not_found", 404);
  const statements = [] as any[];
  if (payload.deleteContent === true) {
    statements.push(
      env.DB.prepare("DELETE FROM board_comments WHERE user_sub = ?").bind(userSub),
      env.DB.prepare("DELETE FROM board_posts WHERE user_sub = ?").bind(userSub),
    );
  }
  statements.push(env.DB.prepare("DELETE FROM lounge_users WHERE google_sub = ?").bind(userSub));
  await env.DB.batch(statements);
  await writeAudit(env, admin, "user.delete", "user", userSub, `email=${user.email}, content=${payload.deleteContent === true}`);
  return loungeJson(request, { ok: true });
}

export async function handleLoungeRequest(request: Request, env: LoungeEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/lounge/")) return null;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: loungeCors(request) });

  try {
    if (url.pathname === "/lounge/config" && request.method === "GET") {
      const tools = await toolSettings(env);
      return loungeJson(request, {
        googleClientId: env.GOOGLE_CLIENT_ID || "",
        loginReady: Boolean(env.GOOGLE_CLIENT_ID),
        tools: tools.map((tool) => toolPublic(tool, tools)),
      });
    }

    const identity = await getLoungeIdentity(request, env);
    if (url.pathname === "/lounge/shorts/prepare" && request.method === "POST") {
      return prepareShorts(request, env, requireIdentity(identity));
    }
    const shortsAction = url.pathname.match(/^\/lounge\/shorts\/([0-9a-f-]{36})\/(upload|release|publish|media)$/i);
    if (shortsAction) {
      const jobId = shortsAction[1];
      const action = shortsAction[2];
      if (action === "media" && request.method === "GET") return shortsMedia(request, env, identity, jobId);
      if (action === "upload" && request.method === "POST") return uploadShorts(request, env, requireIdentity(identity), jobId);
      if (action === "release" && request.method === "POST") return releaseShorts(request, env, requireIdentity(identity), jobId);
      if (action === "publish" && request.method === "POST") return publishShorts(request, env, requireIdentity(identity), jobId);
      return loungeJson(request, { error: "method_not_allowed" }, 405);
    }
    if (url.pathname === "/lounge/me" && request.method === "GET") {
      const user = requireIdentity(identity);
      const tools = await toolSettings(env);
      return loungeJson(request, { user: publicIdentity(user), tools: tools.map((tool) => toolPublic(tool, tools)) });
    }

    if (url.pathname === "/lounge/me/ledger" && request.method === "GET") {
      const user = requireIdentity(identity);
      const rows = await env.DB.prepare(
        `SELECT id, delta, reason, ref_type, ref_id, balance_after, created_at
           FROM lounge_build_ledger WHERE user_sub = ? ORDER BY created_at DESC LIMIT 100`,
      ).bind(user.sub).all();
      return loungeJson(request, { ledger: rows.results || [], balance: user.balance });
    }

    const toolGenerate = url.pathname.match(/^\/lounge\/tools\/([a-z-]+)\/generate$/)?.[1];
    if (toolGenerate && request.method === "POST") {
      return generateWithTool(request, env, requireIdentity(identity), toolGenerate);
    }

    if (url.pathname === "/lounge/admin/settings" && request.method === "GET") {
      requireAdmin(identity);
      const tools = await toolSettings(env);
      const admins = await env.DB.prepare(
        "SELECT email, active, added_by, created_at FROM lounge_admins ORDER BY created_at ASC",
      ).all();
      return loungeJson(request, {
        loginReady: Boolean(env.GOOGLE_CLIENT_ID),
        encryptionReady: Boolean(env.LOUNGE_CONFIG_KEY),
        tools: tools.map((tool) => ({
          ...toolPublic(tool, tools),
          endpointUrl: tool.endpoint_url,
          systemPrompt: tool.system_prompt,
          updatedBy: tool.updated_by,
        })),
        admins: admins.results || [],
      });
    }

    const adminTool = url.pathname.match(/^\/lounge\/admin\/tools\/([a-z-]+)$/)?.[1];
    if (adminTool && request.method === "PUT") return updateTool(request, env, requireAdmin(identity), adminTool);

    if (url.pathname === "/lounge/admin/users" && request.method === "GET") {
      requireAdmin(identity);
      const rows = await env.DB.prepare(
        `SELECT google_sub, email, display_name, avatar_url, role, build_balance,
                created_at, updated_at, last_login_at
           FROM lounge_users ORDER BY updated_at DESC LIMIT 500`,
      ).all();
      return loungeJson(request, { users: rows.results || [] });
    }

    const buildAdjustment = url.pathname.match(/^\/lounge\/admin\/users\/([^/]+)\/builds$/)?.[1];
    if (buildAdjustment && request.method === "POST") {
      return adjustBuilds(request, env, requireAdmin(identity), decodeURIComponent(buildAdjustment).slice(0, 128));
    }

    const deleteUserMatch = url.pathname.match(/^\/lounge\/admin\/users\/([^/]+)$/)?.[1];
    if (deleteUserMatch && request.method === "DELETE") {
      return deleteUser(request, env, requireAdmin(identity), decodeURIComponent(deleteUserMatch).slice(0, 128));
    }

    if (url.pathname === "/lounge/admin/admins" && request.method === "POST") {
      const admin = requireAdmin(identity);
      const payload = await readJson(request, 4_000);
      const email = clean(payload.email, 254).toLocaleLowerCase("en-US");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new LoungeError("invalid_email", 400);
      const now = new Date().toISOString();
      await env.DB.prepare(
        `INSERT INTO lounge_admins (email, active, added_by, created_at) VALUES (?, 1, ?, ?)
         ON CONFLICT(email) DO UPDATE SET active = 1, added_by = excluded.added_by`,
      ).bind(email, admin.email, now).run();
      await writeAudit(env, admin, "admin.add", "email", email);
      return loungeJson(request, { ok: true, email }, 201);
    }

    const adminEmail = url.pathname.match(/^\/lounge\/admin\/admins\/(.+)$/)?.[1];
    if (adminEmail && request.method === "DELETE") {
      const admin = requireAdmin(identity);
      const email = decodeURIComponent(adminEmail).slice(0, 254).toLocaleLowerCase("en-US");
      if (email === DEFAULT_ADMIN_EMAIL || email === admin.email.toLocaleLowerCase("en-US")) {
        throw new LoungeError("protected_admin", 400);
      }
      await env.DB.prepare("UPDATE lounge_admins SET active = 0 WHERE email = ? COLLATE NOCASE").bind(email).run();
      await env.DB.prepare("UPDATE lounge_users SET role = 'member' WHERE email = ? COLLATE NOCASE").bind(email).run();
      await writeAudit(env, admin, "admin.remove", "email", email);
      return loungeJson(request, { ok: true });
    }

    if (url.pathname === "/lounge/admin/audit" && request.method === "GET") {
      requireAdmin(identity);
      const rows = await env.DB.prepare(
        `SELECT a.id, a.action, a.target_type, a.target_id, a.detail, a.created_at,
                u.email AS admin_email
           FROM lounge_admin_audit a
           LEFT JOIN lounge_users u ON u.google_sub = a.admin_sub
          ORDER BY a.created_at DESC LIMIT 200`,
      ).all();
      return loungeJson(request, { audit: rows.results || [] });
    }

    return loungeJson(request, { error: "method_not_allowed" }, 405);
  } catch (error) {
    return loungeErrorResponse(request, error);
  }
}
