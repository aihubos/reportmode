import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const home = "https://aireport.ai-hub-os.com/";
const legacyBrand = /Jeremy's AI Report|AIHUBOS ReportMode|AIHUBOS REPORTMODE|Report Mode|RM 리포트 모드|리포트 모드/;

function htmlFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "assets") return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return htmlFiles(target);
    return entry.isFile() && entry.name.endsWith(".html") ? [target] : [];
  });
}

function occurrences(text, needle) {
  return text.split(needle).length - 1;
}

const failures = [];
let contentReports = 0;
let redirects = 0;

for (const file of htmlFiles(path.join(root, "reports"))) {
  const relative = path.relative(root, file);
  const html = fs.readFileSync(file, "utf8");
  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?/i.test(html)) {
    redirects += 1;
    continue;
  }
  contentReports += 1;
  const checks = [
    [occurrences(html, 'class="report-home-button"') === 1, "메인 로고 버튼이 정확히 1개가 아님"],
    [html.includes(`class="report-home-button" href="${home}"`), "메인 로고 링크 주소가 다름"],
    [html.includes("report-hub-logo"), "RH 로고가 없음"],
    [/<title>[\s\S]*Report Hub[\s\S]*<\/title>/i.test(html), "브라우저 제목에 Report Hub가 없음"],
    [occurrences(html, "report-hub-brand.css") === 1, "공통 브랜드 스타일이 정확히 1개가 아님"],
    [occurrences(html, "report-hub-brand.js") === 1, "공통 브랜드 스크립트가 정확히 1개가 아님"],
    [!legacyBrand.test(html), "구형 공개 브랜드 이름이 남아 있음"],
  ];
  for (const [passed, message] of checks) {
    if (!passed) failures.push(`${relative}: ${message}`);
  }
}

for (const relative of ["index.html", "archive/index.html", "archive/upload.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  if (!/Report Hub/.test(html)) failures.push(`${relative}: Report Hub 이름이 없음`);
  if (legacyBrand.test(html)) failures.push(`${relative}: 구형 공개 브랜드 이름이 남아 있음`);
  if (!/favicon\.svg\?v=20260809-rh1/.test(html)) failures.push(`${relative}: RH 파비콘이 없음`);
}

for (const relative of ["archive/index.html", "archive/upload.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  if (!html.includes(`href="${home}"`)) failures.push(`${relative}: 좌측 상단 로고 링크 주소가 다름`);
}

const favicon = fs.readFileSync(path.join(root, "assets/favicon.svg"), "utf8");
if (!/>RH<\/text>/.test(favicon) || />RM<\/text>/.test(favicon)) {
  failures.push("assets/favicon.svg: RH 문자가 정확하지 않음");
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`${JSON.stringify({ contentReports, redirects, status: "ok" }, null, 2)}\n`);
}
