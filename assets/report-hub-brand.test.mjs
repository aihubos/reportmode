import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

test("public brand uses the supplied Report Hub image logo and one floating menu", () => {
  const svg = fs.readFileSync(path.join(root, "assets", "favicon.svg"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "report-hub-brand.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");
  const archiveCss = fs.readFileSync(path.join(root, "src", "styles", "magazine.css"), "utf8");

  assert.match(svg, />RH<\/text>/);
  assert.doesNotMatch(svg, />RM<\/text>/);
  assert.match(svg, /fill="#3182F6"/);
  assert.match(svg, /fill="#FFFFFF"/);
  assert.match(css, /--rh-primary:\s*#3182F6/);
  assert.match(css, /\.report-hub-floating-menu\s*{[^}]*position:\s*fixed/s);
  assert.match(css, /\.report-hub-floating-menu\s*{[^}]*left:\s*50%[^}]*transform:\s*translateX\(-50%\)/s);
  assert.match(css, /--rh-report-menu-content-gap:\s*24px/);
  assert.match(css, /\.report-home-button/);
  assert.match(css, /\.report-hub-logo-image\s*{[^}]*width:\s*var\(--rh-logo-width\)[^}]*object-fit:\s*contain/s);
  assert.match(css, /--rh-logo-width:\s*196px/);
  assert.match(css, /--rh-logo-width-compact:\s*158px/);
  assert.match(css, /--rh-clock-date-size:\s*13px/);
  assert.match(css, /--rh-clock-time-size:\s*22px/);
  assert.match(css, /--rh-clock-date-size-compact:\s*11px/);
  assert.match(css, /--rh-clock-time-size-compact:\s*18px/);
  assert.match(css, /\.report-hub-brand-copy\s*{[^}]*display:\s*inline-flex[^}]*align-items:\s*center/s);
  assert.match(css, /\.report-hub-logo-mark-shimmer\s*{[^}]*pointer-events:\s*none[^}]*mask-image:\s*url\("\.\/report-hub-logo-mark\.png"\)/s);
  assert.match(css, /@keyframes report-hub-logo-mark-shimmer[\s\S]*transform:[\s\S]*opacity:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.report-hub-logo-mark-shimmer::before[\s\S]*?animation:\s*none/s);
  assert.match(css, /\.report-hub-clock\s*{[^}]*display:\s*flex[^}]*align-items:\s*baseline/s);
  assert.doesNotMatch(css, /\.report-hub-byline\s*{/);
  assert.match(css, /\.report-hub-clock-time\s*{[^}]*font-variant-numeric:\s*tabular-nums/s);
  assert.doesNotMatch(css, /glow/i);
  assert.match(script, /https:\/\/aireport\.ai-hub-os\.com\//);
  assert.match(script, /if \(!home && !archiveBrand\)/);
  assert.match(script, /report-hub-floating-menu/);
  assert.match(script, /function installTitleLinks/);
  assert.match(script, /Report Hub 메인으로 이동/);
  assert.match(script, /function normalizeReportHubLinks/);
  assert.match(script, /function removeLegacyTopMenus/);
  assert.match(script, /function removeLegacyViewModes/);
  assert.match(script, /document\.body\.dataset\.reportView = "detail"/);
  assert.match(script, /\.report-view-buttons, \.simple-report/);
  assert.match(script, /function ensureTopClearance/);
  assert.match(script, /report-hub-top-spacer/);
  assert.match(script, /--rh-report-menu-content-gap/);
  assert.match(script, /menu\.getBoundingClientRect\(\)\.bottom \+ gap;/);
  assert.doesNotMatch(script, /gap - content\.getBoundingClientRect\(\)\.top/);
  assert.match(script, /\.nav-wrap/);
  assert.match(script, /\.floating-menu:not\(\.report-hub-floating-menu\)/);
  assert.match(script, /nav\.nav:not\(\.report-hub-floating-menu\)/);
  assert.match(script, /\.report-view-switcher \.report-utility-controls/);
  assert.match(script, /window\.scrollTo/);
  assert.match(script, /report-hub-logo\.png/);
  assert.match(script, /report-hub-logo-mark-shimmer/);
  assert.match(script, /<img class="report-hub-logo-image"/);
  assert.match(archive, /<title>Report Hub \| AI 리서치 라이브러리<\/title>/);
  assert.doesNotMatch(archive, /class="archive-profile"|<h1 id="archive-title">/);
  assert.match(archive, /class="archive-brand report-hub-brand-link"[^>]*>[\s\S]*class="report-hub-logo-image"[^>]*alt="Report Hub"/);
  assert.doesNotMatch(archive, /data-archive-brand-name=/);
  assert.doesNotMatch(archive, /report-hub-byline|by Jeremy/);
  assert.match(archive, /class="report-hub-clock"/);
  assert.match(archive, /class="archive-blog-card"/);
  assert.match(archive, /src="\.\.\/assets\/report-hub-logo\.png\?v=20260812-report-hub-logo2"/);
  assert.doesNotMatch(archive, /class="archive-avatar"/);
  assert.doesNotMatch(archive, /Jeremy's AI Report|>RM<|>R<\/span>/);
  assert.match(archiveCss, /\.archive-topbar-inner\s*{[^}]*width:\s*min\(var\(--archive-shell-max\),\s*calc\(100% - \(var\(--archive-shell-edge\) \* 2\)\)\)[^}]*margin:\s*0 auto/s);
  assert.match(archiveCss, /\.archive-community-board-card\s*{[^}]*width:\s*142px[^}]*min-height:\s*var\(--rh-space-12\)[^}]*justify-content:\s*center/s);
  assert.match(archiveCss, /\.archive-blog-card\s*{[^}]*width:\s*142px[^}]*min-height:\s*var\(--rh-space-12\)[^}]*justify-content:\s*center/s);
  assert.doesNotMatch(archiveCss, /\.archive-guidebook-card/);
  assert.match(archive, /class="archive-post-link" href="\.\.\/reports\/260813-hermes-llm-wiki-install-guidebook\.html"/);
  assert.match(archive, /<h2>\[가이드북\] Hermes, LLM Wiki 설치<\/h2>/);
  assert.equal(archive.match(/class="archive-guidebook-card"/g)?.length ?? 0, 0);
});

test("public brand formats the Seoul weekday and second clock", () => {
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const context = { document: { body: null, currentScript: null } };
  vm.runInNewContext(script, context);

  const output = context.ReportHubBrand.formatClock(new Date("2026-08-09T08:25:08.000Z"));
  assert.equal(output.date, "8월 9일 일요일");
  assert.equal(output.time, "17:25:08");
});

test("mobile top bars hide after leaving the top and return only at the top", () => {
  const css = fs.readFileSync(path.join(root, "assets", "report-hub-brand.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");

  assert.match(css, /--rh-mobile-top-threshold:\s*8px/);
  assert.match(css, /\.report-hub-floating-menu\.is-mobile-scroll-hidden,[\s\S]*?\.archive-topbar\.is-mobile-scroll-hidden\s*{[^}]*transform:\s*translateY\(calc\(-100% - var\(--rh-space-3\)\)\)[^}]*opacity:\s*0[^}]*pointer-events:\s*none/s);
  assert.match(script, /function installMobileTopBarBehavior\(/);
  assert.match(script, /--rh-mobile-top-threshold/);
  assert.match(script, /root\.scrollY/);
  assert.match(script, /classList\.toggle\("is-mobile-scroll-hidden", hidden\)/);
  assert.match(script, /root\.addEventListener\("scroll", scheduleMobileTopBar, \{ passive: true \}\)/);
});
