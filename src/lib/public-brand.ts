import path from "node:path";

export const REPORT_HUB_HOME = "https://aireport.ai-hub-os.com/";
export const REPORT_HUB_BRAND_VERSION = "20260809-rh1";

function isRedirectHtml(html: string): boolean {
  return /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?/i.test(html);
}

function relativePrefix(reportPath: string): string {
  return path.posix.relative(path.posix.dirname(reportPath), ".") || ".";
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
    .replace(/\s*<link\b[^>]*href=["'][^"']*report-hub-brand\.css(?:\?[^"']*)?["'][^>]*>/gi, "");
  const tags = [
    `<link rel="icon" type="image/svg+xml" sizes="any" href="${prefix}/assets/favicon.svg?v=${version}">`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${prefix}/assets/favicon-32x32.png?v=${version}">`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${prefix}/assets/apple-touch-icon.png?v=${version}">`,
    `<link rel="manifest" href="${prefix}/site.webmanifest?v=${version}">`,
    '<meta name="application-name" content="Report Hub">',
    '<meta property="og:site_name" content="Report Hub">',
    `<link rel="stylesheet" href="${prefix}/assets/report-hub-brand.css?v=${version}">`,
  ].join("\n  ");
  output = output.replace(/<\/head>/i, `  ${tags}\n</head>`);
  return output;
}

function homeButton(prefix: string): string {
  return `<a class="report-home-button" href="${REPORT_HUB_HOME}" aria-label="Report Hub 메인으로 이동"><img class="report-hub-logo" src="${prefix}/assets/favicon.svg?v=${REPORT_HUB_BRAND_VERSION}" alt=""><span class="report-hub-wordmark">Report Hub</span></a>`;
}

function replaceHomeButton(html: string, prefix: string): string {
  const button = homeButton(prefix);
  const expression = /<a\b[^>]*class=["'][^"']*\breport-home-button\b[^"']*["'][^>]*>[\s\S]*?<\/a>/i;
  if (expression.test(html)) return html.replace(expression, button);
  return html.replace(/<body\b[^>]*>/i, (body) => `${body}\n  ${button}`);
}

function replaceLegacyBrandLinks(html: string, prefix: string): string {
  return html.replace(/<a\b[^>]*class=["'][^"']*\bbrand\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, (link) => {
    const plain = link.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!/\b(?:RM|RH)\b|Report (?:Mode|Hub)/i.test(plain)) return link;
    return homeButton(prefix).replace('class="report-home-button"', 'class="brand report-hub-brand-link"');
  });
}

function upsertBrandScript(html: string, prefix: string): string {
  const tag = `<script src="${prefix}/assets/report-hub-brand.js?v=${REPORT_HUB_BRAND_VERSION}"></script>`;
  const expression = /<script\b[^>]*src=["'][^"']*report-hub-brand\.js(?:\?[^"']*)?["'][^>]*><\/script>/i;
  if (expression.test(html)) return html.replace(expression, tag);
  return html.replace(/<\/body>/i, `  ${tag}\n</body>`);
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
  output = replaceHomeButton(output, prefix);
  output = replaceLegacyBrandLinks(output, prefix);
  output = upsertBrandScript(output, prefix);
  return output;
}
