import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("public brand assets and archive use RH and Report Hub consistently", () => {
  const svg = fs.readFileSync(path.join(root, "assets", "favicon.svg"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "report-hub-brand.css"), "utf8");
  const script = fs.readFileSync(path.join(root, "assets", "report-hub-brand.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");

  assert.match(svg, />RH<\/text>/);
  assert.doesNotMatch(svg, />RM<\/text>/);
  assert.match(css, /\.report-home-button/);
  assert.doesNotMatch(css, /gradient|glow/i);
  assert.match(script, /https:\/\/aireport\.ai-hub-os\.com\//);
  assert.match(script, /if \(!home && !archiveBrand\)/);
  assert.match(archive, /<title>Report Hub \| AI 리서치 라이브러리<\/title>/);
  assert.match(archive, /<h1 id="archive-title">Report Hub<\/h1>/);
  assert.match(archive, /class="archive-avatar"[^>]*>[\s\S]*favicon\.svg/);
  assert.doesNotMatch(archive, /Jeremy's AI Report|>RM<|>R<\/span>/);
});
