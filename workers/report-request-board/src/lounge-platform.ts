import { createRemoteJWKSet, jwtVerify } from "jose";

export interface LoungeEnv {
  DB: D1Database;
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
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-Id",
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

function toolPublic(setting: ToolSetting) {
  return {
    id: setting.tool_id,
    name: setting.display_name,
    enabled: Number(setting.enabled || 0) === 1,
    cost: Math.max(0, Number(setting.build_cost || 0)),
    provider: setting.provider,
    model: setting.model,
    apiKeyConfigured: Boolean(setting.api_key_ciphertext && setting.api_key_iv),
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
  const endpoint = replaceModel(setting.endpoint_url, setting.model);
  if (!endpoint) throw new LoungeError("tool_not_configured", 503);

  let response: Response;
  const provider = setting.endpoint_url.includes("openrouter.ai") ? "openrouter"
    : setting.endpoint_url.includes("moonshot.ai") || setting.endpoint_url.includes("moonshot.cn") ? "moonshot"
    : setting.provider;
  if (provider === "openai" || provider === "openrouter" || provider === "moonshot") {
    const wantsImage = setting.tool_id === "masterpiece";
    const payload = openaiCompatiblePayload(setting, prompt);
    if (wantsImage && provider === "openrouter") {
      (payload as Record<string, unknown>).modalities = ["image", "text"];
    }
    response = await fetch(endpoint, {
      method: "POST",
      headers: openaiCompatibleHeaders(provider, apiKey),
      body: JSON.stringify(payload),
    });
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
  return loungeJson(request, { tool: updated ? { ...toolPublic(updated), endpointUrl: updated.endpoint_url, systemPrompt: updated.system_prompt, updatedBy: updated.updated_by } : null });
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
        tools: tools.map(toolPublic),
      });
    }

    const identity = await getLoungeIdentity(request, env);
    if (url.pathname === "/lounge/me" && request.method === "GET") {
      const user = requireIdentity(identity);
      const tools = await toolSettings(env);
      return loungeJson(request, { user: publicIdentity(user), tools: tools.map(toolPublic) });
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
          ...toolPublic(tool),
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
