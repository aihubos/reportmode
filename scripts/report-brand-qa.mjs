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
    [html.includes('class="report-hub-wordmark">Report Hub</span><span class="report-hub-byline">by Jeremy</span>'), "워드마크와 제작자 서명이 없음"],
    [!html.includes('class="report-hub-logo"'), "보고서 홈 버튼에 구형 RH 아이콘이 남아 있음"],
    [/<title>[\s\S]*Report Hub[\s\S]*<\/title>/i.test(html), "브라우저 제목에 Report Hub가 없음"],
    [occurrences(html, "report-hub-brand.css") === 1, "공통 브랜드 스타일이 정확히 1개가 아님"],
    [occurrences(html, "report-hub-brand.js") === 1, "공통 브랜드 스크립트가 정확히 1개가 아님"],
    [occurrences(html, "report-page-layout.css") === 1, "공통 레이아웃 스타일이 정확히 1개가 아님"],
    [occurrences(html, "report-page-layout.js") === 1, "공통 레이아웃 스크립트가 정확히 1개가 아님"],
    [occurrences(html, "report-comments.css") === 1, "공통 댓글 스타일이 정확히 1개가 아님"],
    [occurrences(html, "report-comments.js") === 1, "공통 댓글 스크립트가 정확히 1개가 아님"],
    [/report-comments\.js\?v=20260809-comments1[^>]*data-report-id=/i.test(html), "댓글 스크립트에 보고서 ID가 없음"],
    [occurrences(html, "report-view-counter.js") === 1, "공통 조회수 스크립트가 정확히 1개가 아님"],
    [/report-view-counter\.js\?v=20260810-counter-d1-1[^>]*data-report-id=/i.test(html), "조회수 스크립트에 보고서 ID가 없음"],
    [occurrences(html, "report-history.js") === 1, "공통 변경이력 스크립트가 정확히 1개가 아님"],
    [/report-history\.js\?v=20260809-history2/.test(html), "통합 변경이력 버전이 아님"],
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
  if (!/favicon\.svg\?v=20260810-mobile-scroll1/.test(html)) failures.push(`${relative}: 최신 RH 파비콘이 없음`);
}

const archive = fs.readFileSync(path.join(root, "archive/index.html"), "utf8");
if ((archive.match(/https:\/\/blog\.naver\.com\/jeremylee0213/g) || []).length !== 1) failures.push("archive/index.html: 네이버 블로그 링크가 1개가 아님");
if (!archive.includes('class="archive-blog-card"')) failures.push("archive/index.html: 초록색 네이버 블로그 카드가 없음");
if ((archive.match(/https:\/\/daangn\.com\/kr\/share\/community\/ref\/invite-group\/baRr2nojJVT\?utm_campaign=share_qr/g) || []).length !== 1) failures.push("archive/index.html: 당근모임 링크가 1개가 아님");
if (!archive.includes('class="archive-carrot-card"') || !archive.includes('src="../assets/daangn-meeting-qr.png"')) failures.push("archive/index.html: 당근모임 QR 카드가 없음");
if (/class="archive-profile"|읽고 판단하기 좋은/.test(archive)) failures.push("archive/index.html: 삭제 요청한 소개 카드가 남아 있음");
if (!/var DEFAULT_PAGE_SIZE = 30/.test(archive) || !/id="archivePageSize"/.test(archive)) failures.push("archive/index.html: 기본 30개 표시 선택기가 없음");
if (!/archive-visitor-counter\.js\?v=20260809-visits1/.test(archive)) failures.push("archive/index.html: 방문자 집계 스크립트가 없음");

for (const relative of ["archive/index.html", "archive/upload.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  const wordmark = "Report Hub";
  if (!html.includes(`href="${home}"`)) failures.push(`${relative}: 좌측 상단 로고 링크 주소가 다름`);
  if (!html.includes(`class="report-hub-wordmark">${wordmark}</span><span class="report-hub-byline">by Jeremy</span>`)) failures.push(`${relative}: 워드마크와 제작자 서명이 없음`);
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
