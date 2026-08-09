import path from "node:path";

const SITE_PREFIX = "/reportmode/";
const LAYOUT_VERSION = "20260809-rh5";
const HISTORY_VERSION = "20260809-history2";
const COUNTER_VERSION = "20260809-counter-fallback2";
const COMMENTS_VERSION = "20260809-comments1";

export function isRedirectHtml(html) {
  return /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?/i.test(html);
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function relativePrefix(reportPath) {
  return path.posix.relative(path.posix.dirname(reportPath), ".") || ".";
}

function canonicalPath(reportPath) {
  return reportPath.endsWith("/index.html")
    ? reportPath.slice(0, -"index.html".length)
    : reportPath;
}

export function reportIdFromPath(reportPath) {
  const relative = reportPath.replace(/^reports\//, "");
  return relative.endsWith("/index.html")
    ? relative.slice(0, -"/index.html".length)
    : relative.replace(/\.html$/i, "");
}

function textContent(fragment) {
  return String(fragment)
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractReportTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1 && textContent(h1[1])) return textContent(h1[1]);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return title ? textContent(title[1]) : "";
}

export function deriveReportVersion(html, reportPath) {
  const metadataVersion = html.match(/["']version["']\s*:\s*["']v?(\d+\.\d+\.\d+)["']/i);
  if (metadataVersion) return `v${metadataVersion[1]}`;
  const pathVersion = reportPath.match(/(?:^|[-/])v(\d+)-(\d+)-(\d+)(?:[./-]|$)/i);
  if (pathVersion) return `v${pathVersion[1]}.${pathVersion[2]}.${pathVersion[3]}`;
  return "v1.0.0";
}

export function nextMinorVersion(version) {
  const match = String(version).match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) throw new Error(`올바르지 않은 버전입니다: ${version}`);
  return `v${match[1]}.${Number(match[2]) + 1}.0`;
}

function sitePath(reportPath) {
  return `${SITE_PREFIX}${canonicalPath(reportPath)}`;
}

function snapshotPath(reportPath, snapshotId) {
  return `${SITE_PREFIX}versions/${snapshotId}/${canonicalPath(reportPath)}`;
}

function replaceBodyTag(html) {
  const match = html.match(/<body\b[^>]*>/i);
  if (!match) throw new Error("보고서에 <body> 태그가 없습니다.");

  let body = match[0];
  const upsert = (name, value) => {
    const expression = new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i");
    if (expression.test(body)) body = body.replace(expression, ` ${name}="${value}"`);
    else body = body.replace(/>$/, ` ${name}="${value}">`);
  };
  upsert("data-report-view", "detail");
  upsert("data-report-layout", "wide");
  return { html: html.replace(match[0], body), body };
}

function upsertStylesheet(html, prefix) {
  const href = `${prefix}/assets/report-page-layout.css?v=${LAYOUT_VERSION}`;
  const expression = /<link\b[^>]*href=["'][^"']*report-page-layout\.css(?:\?[^"']*)?["'][^>]*>/i;
  if (expression.test(html)) return html.replace(expression, `<link rel="stylesheet" href="${href}">`);
  return html.replace(/<\/head>/i, `  <link rel="stylesheet" href="${href}">\n</head>`);
}

function upsertCommentsStylesheet(html, prefix) {
  const href = `${prefix}/assets/report-comments.css?v=${COMMENTS_VERSION}`;
  const expression = /<link\b[^>]*href=["'][^"']*report-comments\.css(?:\?[^"']*)?["'][^>]*>/i;
  if (expression.test(html)) return html.replace(expression, `<link rel="stylesheet" href="${href}">`);
  return html.replace(/<\/head>/i, `  <link rel="stylesheet" href="${href}">\n</head>`);
}

function upsertFavicon(html) {
  if (/<link\b[^>]*rel=["'][^"']*\bicon\b[^"']*["'][^>]*>/i.test(html)) return html;
  return html.replace(/<\/head>/i, '  <link rel="icon" href="data:,">\n</head>');
}

function upsertHomeButton(html, body, archiveHref) {
  const expression = /<a\b([^>]*\bclass=["'][^"']*\breport-home-button\b[^"']*["'][^>]*)>/i;
  if (expression.test(html)) {
    return html.replace(expression, (whole) => {
      if (/\bhref=["'][^"']*["']/i.test(whole)) {
        return whole.replace(/\bhref=["'][^"']*["']/i, `href="${archiveHref}"`);
      }
      return whole.replace(/>$/, ` href="${archiveHref}">`);
    });
  }
  const button = `<a class="report-home-button" href="${archiveHref}" aria-label="Report Hub 메인으로 이동"><span class="report-hub-brand-copy"><span class="report-hub-wordmark">Report Hub</span><span class="report-hub-byline">by Jeremy</span></span></a>`;
  return html.replace(body, `${body}\n  ${button}`);
}

function upsertScript(html, matcher, tag) {
  if (matcher.test(html)) return html.replace(matcher, tag);
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
}

export function enhanceCurrentReport(html, options) {
  if (isRedirectHtml(html)) return html;

  const { reportPath, reportId, snapshotId } = options;
  const prefix = relativePrefix(reportPath);
  const archiveHref = "https://aireport.ai-hub-os.com/";
  const bodyResult = replaceBodyTag(html);
  let output = bodyResult.html;
  output = upsertFavicon(output);
  output = upsertStylesheet(output, prefix);
  output = upsertCommentsStylesheet(output, prefix);
  output = upsertHomeButton(output, bodyResult.body, archiveHref);
  output = upsertScript(
    output,
    /<script\b[^>]*src=["'][^"']*report-page-layout\.js(?:\?[^"']*)?["'][^>]*><\/script>/i,
    `<script src="${prefix}/assets/report-page-layout.js?v=${LAYOUT_VERSION}"></script>`,
  );
  output = upsertScript(
    output,
    /<script\b[^>]*src=["'][^"']*report-comments\.js(?:\?[^"']*)?["'][^>]*><\/script>/i,
    `<script src="${prefix}/assets/report-comments.js?v=${COMMENTS_VERSION}" data-report-id="${escapeAttribute(reportId)}"></script>`,
  );
  output = upsertScript(
    output,
    /<script\b[^>]*src=["'][^"']*report-history\.js(?:\?[^"']*)?["'][^>]*><\/script>/i,
    `<script src="${prefix}/assets/report-history.js?v=${HISTORY_VERSION}" data-report-id="${escapeAttribute(reportId)}" data-snapshot-id="${escapeAttribute(snapshotId)}" data-has-previous="true"></script>`,
  );
  output = upsertScript(
    output,
    /<script\b[^>]*src=["'][^"']*report-view-counter\.js(?:\?[^"']*)?["'][^>]*><\/script>/i,
    `<script src="${prefix}/assets/report-view-counter.js?v=${COUNTER_VERSION}" data-report-id="${escapeAttribute(reportId)}"></script>`,
  );
  return output;
}

function snapshotDate(snapshotId) {
  const match = String(snapshotId).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) throw new Error(`스냅샷 날짜를 확인할 수 없습니다: ${snapshotId}`);
  return { iso: `${match[1]}-${match[2]}-${match[3]}`, label: `${Number(match[1])}년 ${Number(match[2])}월 ${Number(match[3])}일` };
}

export function createSnapshotHtml(html, options) {
  const { reportPath, snapshotId } = options;
  if (isRedirectHtml(html)) return html;
  if (!/<head\b[^>]*>/i.test(html) || !/<body\b[^>]*>/i.test(html)) {
    throw new Error(`스냅샷 대상 HTML 구조가 올바르지 않습니다: ${reportPath}`);
  }

  const canonical = canonicalPath(reportPath);
  const canonicalDirectory = reportPath.endsWith("/index.html")
    ? canonical.replace(/\/$/, "")
    : path.posix.dirname(canonical);
  const baseHref = `${SITE_PREFIX}${canonicalDirectory === "." ? "" : `${canonicalDirectory}/`}`;
  const currentHref = sitePath(reportPath);
  const date = snapshotDate(snapshotId);
  let output = html;
  if (!/<base\b/i.test(output)) {
    output = output.replace(/<head\b[^>]*>/i, (head) => `${head}\n  <base href="${baseHref}">`);
  }
  const banner = `<aside class="report-version-banner" role="note" style="position:relative;z-index:9999;padding:12px 18px;border-bottom:1px solid #f1d48a;color:#4f3a00;background:#fff8dc;font:700 13px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center">${date.label} 이전판입니다. 현재 정보와 다를 수 있습니다. <a href="${currentHref}" style="color:#1b64da">최신 보고서 보기 →</a></aside>`;
  output = output.replace(/<body\b[^>]*>/i, (body) => `${body}\n  ${banner}`);
  return output;
}

export function buildVersionRecord(options) {
  const { reportId, reportPath, title, snapshotId, version } = options;
  const date = snapshotDate(snapshotId);
  return {
    id: reportId,
    title,
    canonicalPath: canonicalPath(reportPath),
    currentUrl: sitePath(reportPath),
    previousVersion: {
      version,
      date: date.iso,
      label: "내용 최신화 전 기준판",
      url: snapshotPath(reportPath, snapshotId),
    },
  };
}

export const REPORT_REFRESH_CONSTANTS = {
  COUNTER_VERSION,
  HISTORY_VERSION,
  LAYOUT_VERSION,
  SITE_PREFIX,
};
