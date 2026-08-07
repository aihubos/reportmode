import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const reportsRoot = path.join(root, "reports");

function reportFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return reportFiles(target);
    return entry.isFile() && entry.name.endsWith(".html") ? [target] : [];
  });
}

function relativePrefix(file) {
  return path.relative(path.dirname(file), root).replaceAll(path.sep, "/") || ".";
}

function reportId(file) {
  const relative = path.relative(reportsRoot, file).replaceAll(path.sep, "/");
  return relative.endsWith("/index.html")
    ? relative.slice(0, -"/index.html".length)
    : relative.replace(/\.html$/, "");
}

function enhance(file) {
  let html = fs.readFileSync(file, "utf8");
  if (/http-equiv\s*=\s*["']refresh/i.test(html)) return false;

  const prefix = relativePrefix(file);
  const archiveHref = `${prefix}/archive/`;
  const bodyMatch = html.match(/<body\b[^>]*>/i);
  if (!bodyMatch) throw new Error(`Missing body tag: ${file}`);

  let bodyTag = bodyMatch[0];
  if (!/\bdata-report-view=/i.test(bodyTag)) {
    bodyTag = bodyTag.replace(/<body\b/i, '<body data-report-view="detail"');
  }
  if (!/\bdata-report-layout=/i.test(bodyTag)) {
    bodyTag = bodyTag.replace(/<body\b/i, '<body data-report-layout="a4"');
  }
  if (/\bclass=["']/i.test(bodyTag)) {
    bodyTag = bodyTag.replace(/\bclass=(["'])([^"']*)\1/i, (_, quote, classes) =>
      `class=${quote}${classes.includes("report-a4-mode") ? classes : `${classes} report-a4-mode`.trim()}${quote}`,
    );
  } else {
    bodyTag = bodyTag.replace(/<body\b/i, '<body class="report-a4-mode"');
  }
  html = html.replace(bodyMatch[0], bodyTag);

  if (!html.includes("report-page-layout.css")) {
    html = html.replace("</head>", `  <link rel="stylesheet" href="${prefix}/assets/report-page-layout.css">\n</head>`);
  }
  if (!html.includes("report-home-button")) {
    html = html.replace(bodyTag, `${bodyTag}\n  <a class="report-home-button" href="${archiveHref}" aria-label="보고서 도서관 메인으로 이동">🏠 메인</a>`);
  }
  const layoutScript = `${prefix}/assets/report-page-layout.js?v=20260807-comments`;
  if (!html.includes("report-page-layout.js")) {
    html = html.replace("</body>", `  <script src="${layoutScript}"></script>\n</body>`);
  } else {
    html = html.replace(/<script\s+src=["'][^"']*report-page-layout\.js(?:\?[^"']*)?["']><\/script>/i, `<script src="${layoutScript}"></script>`);
  }
  if (!html.includes("report-view-counter.js")) {
    html = html.replace("</body>", `  <script src="${prefix}/assets/report-view-counter.js" data-report-id="${reportId(file)}"></script>\n</body>`);
  }

  fs.writeFileSync(file, html);
  return true;
}

const updated = reportFiles(reportsRoot).filter(enhance);
console.log(JSON.stringify({ updated: updated.length, skipped: reportFiles(reportsRoot).length - updated.length }, null, 2));
