import path from "node:path";

export const REPORT_HUB_HOME = "https://aireport.ai-hub-os.com/";
export const REPORT_HUB_BRAND_VERSION = "20260812-report-hub-logo2";
export const REPORT_HISTORY_VERSION = "20260809-history2";
export const REPORT_COMMENTS_VERSION = "20260810-comments2";
export const REPORT_COUNTER_VERSION = "20260810-counter-d1-1";
export const REPORT_ENTRY_VERSION = "20260811-entry1";

function isRedirectHtml(html: string): boolean {
  return /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?/i.test(html);
}

function relativePrefix(reportPath: string): string {
  return path.posix.relative(path.posix.dirname(reportPath), ".") || ".";
}

export function reportIdFromPath(reportPath: string): string {
  const normalized = reportPath.replaceAll("\\", "/");
  if (normalized.endsWith("/index.html")) return path.posix.basename(path.posix.dirname(normalized));
  return path.posix.basename(normalized, ".html");
}

function replaceBodyDefaults(html: string): string {
  return html.replace(/<body\b[^>]*>/i, (body) => {
    let output = body;
    const upsert = (name: string, value: string) => {
      const expression = new RegExp(`\\s${name}=(['"])[^'"]*\\1`, "i");
      if (expression.test(output)) output = output.replace(expression, ` ${name}="${value}"`);
      else output = output.replace(/>$/, ` ${name}="${value}">`);
    };
    upsert("data-report-view", "detail");
    upsert("data-report-layout", "wide");
    return output;
  });
}

function replaceTitle(html: string): string {
  return html.replace(/<title\b[^>]*>([\s\S]*?)<\/title>/i, (_whole, current: string) => {
    let title = current
      .replaceAll("Jeremy's AI Report", "Report Hub")
      .replaceAll("Report Mode", "Report Hub")
      .replace(/\s+[—–·]\s+Report Hub\s*$/, " | Report Hub")
      .trim();
    if (!/Report Hub/i.test(title)) title += " | Report Hub";
    return `<title>${title}</title>`;
  });
}

function replaceHeadAssets(html: string, prefix: string): string {
  const version = REPORT_HUB_BRAND_VERSION;
  let output = html
    .replace(/\s*<link\b[^>]*rel=["'][^"']*(?:icon|apple-touch-icon|manifest)[^"']*["'][^>]*>/gi, "")
    .replace(/\s*<meta\b[^>]*(?:name|property)=["'](?:application-name|og:site_name)["'][^>]*>/gi, "")
    .replace(/\s*<link\b[^>]*href=["'][^"']*report-(?:hub-brand|page-layout|comments)\.css(?:\?[^"']*)?["'][^>]*>/gi, "");
  const tags = [
    `<link rel="icon" type="image/svg+xml" sizes="any" href="${prefix}/assets/favicon.svg?v=${version}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${prefix}/assets/favicon-32x32.png?v=${version}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${prefix}/assets/apple-touch-icon.png?v=${version}">`,
    `<link rel="manifest" href="${prefix}/site.webmanifest?v=${version}">`,
    '<meta name="application-name" content="Report Hub">',
    '<meta property="og:site_name" content="Report Hub">',
    `<link rel="stylesheet" href="${prefix}/assets/report-page-layout.css?v=${version}">`,
    `<link rel="stylesheet" href="${prefix}/assets/report-hub-brand.css?v=${version}">`,
    `<link rel="stylesheet" href="${prefix}/assets/report-comments.css?v=${REPORT_COMMENTS_VERSION}">`,
  ].join("\n  ");
  output = output.replace(/<\/head>/i, `  ${tags}\n</head>`);
  return output;
}

function logoMarkup(prefix: string): string {
  return `<span class="report-hub-brand-copy"><span class="report-hub-logo-mark-shimmer" aria-hidden="true"></span><img class="report-hub-logo-image" src="${prefix}/assets/report-hub-logo.png?v=${REPORT_HUB_BRAND_VERSION}" alt="Report Hub"></span>`;
}

function homeButton(prefix: string): string {
  return `<a class="report-home-button" href="${REPORT_HUB_HOME}" aria-label="Report Hub 메인으로 이동">${logoMarkup(prefix)}</a>`;
}

function replaceHomeButton(html: string, prefix: string): string {
  const button = homeButton(prefix);
  const expression = /<a\b[^>]*class=["'][^"']*\breport-home-button\b[^"']*["'][^>]*>[\s\S]*?<\/a>/i;
  if (expression.test(html)) return html.replace(expression, button);
  return html.replace(/<body\b[^>]*>/i, (body) => `${body}\n  ${button}`);
}

function replaceLegacyBrandLinks(html: string, prefix: string): string {
  return html.replace(/<a\b([^>]*class=["'][^"']*\bbrand\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi, (link, attributes: string, content: string) => {
    const plain = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/\b(?:RM|RH)\b|Report (?:Mode|Hub)/i.test(plain) && !/\breport-hub-logo-image\b/i.test(content)) return link;
    let normalized = attributes;
    if (!/\breport-hub-brand-link\b/i.test(normalized)) normalized = normalized.replace(/\bclass=(['"])([^'"]*)\1/i, (_match, quote, classes) => `class=${quote}${classes} report-hub-brand-link${quote}`);
    if (/\bhref=["'][^"']*["']/i.test(normalized)) normalized = normalized.replace(/\bhref=["'][^"']*["']/i, `href="${REPORT_HUB_HOME}"`);
    else normalized += ` href="${REPORT_HUB_HOME}"`;
    if (/\baria-label=["'][^"']*["']/i.test(normalized)) normalized = normalized.replace(/\baria-label=["'][^"']*["']/i, 'aria-label="Report Hub 메인으로 이동"');
    else normalized += ' aria-label="Report Hub 메인으로 이동"';
    return `<a${normalized}>${logoMarkup(prefix)}</a>`;
  });
}

function upsertSharedScripts(html: string, prefix: string, reportPath: string): string {
  const historyExpression = /\s*<script\b[^>]*src=["'][^"']*report-history\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi;
  const existingHistory = html.match(historyExpression)?.[0] || "";
  const snapshotId = existingHistory.match(/\bdata-snapshot-id=["']([^"']+)["']/i)?.[1];
  const hasPrevious = /\bdata-has-previous=["']true["']/i.test(existingHistory);
  let output = html
    .replace(/\s*<script\b[^>]*src=["'][^"']*report-(?:hub-brand|page-layout|comments|view-counter|entry-tracker)\.js(?:\?[^"']*)?["'][^>]*><\/script>/gi, "")
    .replace(historyExpression, "");
  const historyAttributes = [
    `data-report-id="${reportIdFromPath(reportPath)}"`,
    snapshotId ? `data-snapshot-id="${snapshotId}"` : "",
    hasPrevious ? 'data-has-previous="true"' : "",
  ].filter(Boolean).join(" ");
  const tags = [
    `<script src="${prefix}/assets/report-page-layout.js?v=${REPORT_HUB_BRAND_VERSION}"></script>`,
    `<script src="${prefix}/assets/report-view-counter.js?v=${REPORT_COUNTER_VERSION}" data-report-id="${reportIdFromPath(reportPath)}"></script>`,
    `<script src="${prefix}/assets/report-comments.js?v=${REPORT_COMMENTS_VERSION}" data-report-id="${reportIdFromPath(reportPath)}"></script>`,
    `<script src="${prefix}/assets/report-history.js?v=${REPORT_HISTORY_VERSION}" ${historyAttributes}></script>`,
    `<script src="${prefix}/assets/report-entry-tracker.js?v=${REPORT_ENTRY_VERSION}" data-report-id="${reportIdFromPath(reportPath)}"></script>`,
    `<script src="${prefix}/assets/report-hub-brand.js?v=${REPORT_HUB_BRAND_VERSION}"></script>`,
  ].join("\n  ");
  return output.replace(/<\/body>/i, `  ${tags}\n</body>`);
}

export function applyReportHubBrand(html: string, reportPath: string): string {
  if (isRedirectHtml(html)) return html;
  const prefix = relativePrefix(reportPath);
  let output = html
    .replaceAll("RM · Report Mode", "RH · Report Hub")
    .replaceAll("AIHUBOS REPORTMODE", "REPORT HUB")
    .replaceAll("AIHUBOS ReportMode", "Report Hub")
    .replaceAll("RM 리포트 모드", "RH Report Hub")
    .replaceAll("리포트 모드", "Report Hub")
    .replaceAll("REPORT MODE", "REPORT HUB")
    .replaceAll("Report Mode", "Report Hub")
    .replaceAll("Jeremy's AI Report Library", "Report Hub")
    .replaceAll("Jeremy's AI Report", "Report Hub")
    .replaceAll("보고서 도서관 메인으로 이동", "Report Hub 메인으로 이동");
  output = replaceTitle(output);
  output = replaceHeadAssets(output, prefix);
  output = replaceBodyDefaults(output);
  output = replaceHomeButton(output, prefix);
  output = replaceLegacyBrandLinks(output, prefix);
  output = upsertSharedScripts(output, prefix, reportPath);
  return output;
}
