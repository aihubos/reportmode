import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const root = path.resolve(import.meta.dirname, "..");

test("public brand uses a large Toss Blue text wordmark and one floating menu", () => {
  const svg = fs.readFileSync(path.join(root, "assets", "favicon.svg"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "report-hub-brand.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");
  const archiveCss = fs.readFileSync(path.join(root, "src", "styles", "magazine.css"), "utf8");

  assert.match(svg, />RH<\/text>/);
  assert.doesNotMatch(svg, />RM<\/text>/);
  assert.match(css, /--rh-primary:\s*#3182F6/);
  assert.match(css, /\.report-hub-floating-menu\s*{[^}]*position:\s*fixed/s);
  assert.match(css, /\.report-home-button/);
  assert.match(css, /\.report-hub-wordmark\s*{[^}]*font-size:\s*var\(--rh-wordmark-size\)/s);
  assert.match(css, /--rh-wordmark-size:\s*36px/);
  assert.match(css, /--rh-wordmark-size-compact:\s*30px/);
  assert.match(css, /--rh-clock-date-size:\s*13px/);
  assert.match(css, /--rh-clock-time-size:\s*22px/);
  assert.match(css, /--rh-clock-date-size-compact:\s*11px/);
  assert.match(css, /--rh-clock-time-size-compact:\s*18px/);
  assert.match(css, /\.report-hub-brand-copy\s*{[^}]*align-items:\s*flex-start[^}]*text-align:\s*left/s);
  assert.match(css, /\.report-hub-clock\s*{[^}]*display:\s*flex[^}]*align-items:\s*baseline/s);
  assert.match(css, /\.report-hub-byline\s*{[^}]*color:\s*var\(--rh-muted\)/s);
  assert.match(css, /\.report-hub-clock-time\s*{[^}]*font-variant-numeric:\s*tabular-nums/s);
  assert.doesNotMatch(css, /gradient|glow/i);
  assert.match(script, /https:\/\/aireport\.ai-hub-os\.com\//);
  assert.match(script, /if \(!home && !archiveBrand\)/);
  assert.match(script, /report-hub-floating-menu/);
  assert.match(script, /function installTitleLinks/);
  assert.match(script, /function normalizeReportHubLinks/);
  assert.match(script, /window\.scrollTo/);
  assert.doesNotMatch(script, /<img class="report-hub-logo"/);
  assert.match(archive, /<title>Report Hub \| AI 리서치 라이브러리<\/title>/);
  assert.doesNotMatch(archive, /class="archive-profile"|<h1 id="archive-title">/);
  assert.match(archive, /class="archive-brand report-hub-brand-link"[^>]*>[\s\S]*class="report-hub-wordmark">Report Hub/);
  assert.match(archive, /class="report-hub-byline">by Jeremy/);
  assert.match(archive, /class="report-hub-clock"/);
  assert.match(archive, /class="archive-blog-card"/);
  assert.doesNotMatch(archive, /class="archive-brand[^>]*>[\s\S]{0,180}report-hub-logo/);
  assert.doesNotMatch(archive, /class="archive-avatar"/);
  assert.doesNotMatch(archive, /Jeremy's AI Report|>RM<|>R<\/span>/);
  assert.match(archiveCss, /\.archive-topbar-inner\s*{[^}]*width:\s*calc\(100% - 32px\)[^}]*margin:\s*0 16px/s);
});

test("public brand formats the Seoul weekday and second clock", () => {
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const context = { document: { body: null, currentScript: null } };
  vm.runInNewContext(script, context);

  const output = context.ReportHubBrand.formatClock(new Date("2026-08-09T08:25:08.000Z"));
  assert.equal(output.date, "8월 9일 일요일");
  assert.equal(output.time, "17:25:08");
});
