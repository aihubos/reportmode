export type EntryPayloadInput = {
  entryId?: unknown;
  visitorId?: unknown;
  landingPath?: unknown;
  reportId?: unknown;
  referrer?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
};

export type NormalizedEntryPayload = {
  entryId: string;
  visitorId: string;
  landingPath: string;
  reportId: string;
  sourceType: string;
  referrerHost: string;
  referrerPath: string;
  referrerUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWN_HOSTS = new Set(["aihubos.github.io", "aireport.ai-hub-os.com"]);

function compact(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit)
    : "";
}

function safeId(value: unknown) {
  const result = compact(value, 120);
  return ID_PATTERN.test(result) ? result : "";
}

function safePath(value: unknown) {
  const result = compact(value, 240);
  return result.startsWith("/") && !result.startsWith("//") ? result : "/";
}

function sourceType(host: string, referrer: string) {
  if (!host) return "direct";
  if (OWN_HOSTS.has(host)) return "internal";
  if (host === "blog.naver.com" || host.endsWith(".naver.com") || host.includes("search.naver")) return "naver";
  if (host === "google.com" || host.endsWith(".google.com")) return "google";
  if (host === "daum.net" || host.endsWith(".daum.net") || host.endsWith(".kakao.com")) return "kakao";
  if (host.includes("daangn") || host.includes("karrot")) return "daangn";
  if (/instagram|facebook|youtube|tiktok|threads|x\.com|twitter/.test(host)) return "social";
  return referrer ? "external" : "direct";
}

export function normalizeEntryPayload(input: EntryPayloadInput): NormalizedEntryPayload {
  const referrerValue = compact(input.referrer, 1000);
  let referrerHost = "";
  let referrerPath = "";
  let referrerUrl = "";
  try {
    const url = new URL(referrerValue);
    if (url.protocol === "http:" || url.protocol === "https:") {
      referrerHost = url.hostname.toLowerCase().replace(/^www\./, "").slice(0, 160);
      referrerPath = url.pathname.slice(0, 240) || "/";
      referrerUrl = `${url.protocol}//${url.host}${referrerPath}`.slice(0, 420);
    }
  } catch {
    // Invalid referrers are treated as direct traffic.
  }

  return {
    entryId: UUID_PATTERN.test(compact(input.entryId, 64)) ? compact(input.entryId, 64) : "",
    visitorId: UUID_PATTERN.test(compact(input.visitorId, 64)) ? compact(input.visitorId, 64) : "",
    landingPath: safePath(input.landingPath),
    reportId: safeId(input.reportId),
    sourceType: sourceType(referrerHost, referrerUrl),
    referrerHost,
    referrerPath,
    referrerUrl,
    utmSource: compact(input.utmSource, 120),
    utmMedium: compact(input.utmMedium, 120),
    utmCampaign: compact(input.utmCampaign, 160),
  };
}

export type CountRow = { date: string; count: number };

function dateShift(date: string, offset: number) {
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + offset);
  return result.toISOString().slice(0, 10);
}

export function zeroFillDailySeries(endDate: string, days: number, rows: CountRow[]) {
  const safeDays = Math.max(1, Math.trunc(days));
  const values = new Map(rows.map((row) => [row.date, Math.max(0, Math.trunc(Number(row.count || 0)))]));
  const startOffset = -(safeDays - 1);
  return Array.from({ length: safeDays }, (_, index) => {
    const date = dateShift(endDate, startOffset + index);
    return { date, count: values.get(date) || 0 };
  });
}

export function normalizeAnalyticsDays(value: unknown) {
  const days = Number(value);
  return days === 7 || days === 30 || days === 90 ? days : 30;
}

export type SourceCountRow = { source_type: string; count: number };

export function aggregateSources(rows: SourceCountRow[]) {
  const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.count || 0)), 0);
  return rows
    .map((row) => {
      const count = Math.max(0, Math.trunc(Number(row.count || 0)));
      return {
        source: row.source_type || "external",
        count,
        share: total ? Math.round((count / total) * 100) : 0,
      };
    })
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source));
}
