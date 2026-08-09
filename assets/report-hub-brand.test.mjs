import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("public brand uses a large Toss Blue text wordmark and one floating menu", () => {
  const svg = fs.readFileSync(path.join(root, "assets", "favicon.svg"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "report-hub-brand.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");

  assert.match(svg, />RH<\/text>/);
  assert.doesNotMatch(svg, />RM<\/text>/);
  assert.match(css, /--rh-primary:\s*#3182F6/);
  assert.match(css, /\.report-hub-floating-menu\s*{[^}]*position:\s*fixed/s);
  assert.match(css, /\.report-home-button/);
  assert.match(css, /\.report-hub-wordmark\s*{[^}]*font-size:\s*24px/s);
  assert.doesNotMatch(css, /gradient|glow/i);
  assert.match(script, /https:\/\/aireport\.ai-hub-os\.com\//);
  assert.match(script, /if \(!home && !archiveBrand\)/);
  assert.match(script, /report-hub-floating-menu/);
  assert.match(script, /function installTitleLinks/);
  assert.match(script, /function normalizeReportHubLinks/);
  assert.match(script, /window\.scrollTo/);
  assert.doesNotMatch(script, /<img class="report-hub-logo"/);
  assert.match(archive, /<title>Report Hub \| AI 리서치 라이브러리<\/title>/);
  assert.match(archive, /<h1 id="archive-title">Report Hub<\/h1>/);
  assert.match(archive, /class="archive-brand report-hub-brand-link"[^>]*>[\s\S]*class="report-hub-wordmark">Report Hub/);
  assert.doesNotMatch(archive, /class="archive-brand[^>]*>[\s\S]{0,180}report-hub-logo/);
  assert.doesNotMatch(archive, /class="archive-avatar"/);
  assert.doesNotMatch(archive, /Jeremy's AI Report|>RM<|>R<\/span>/);
});
