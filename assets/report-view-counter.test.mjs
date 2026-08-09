import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("reports use the shared D1 counter while retaining the archive fallback map", () => {
  const counterScript = fs.readFileSync(path.join(root, "assets", "report-view-counter.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");
  const report = fs.readFileSync(path.join(root, "reports", "260806-palantir-business-ai-analysis", "index.html"), "utf8");
  const adsenseReport = fs.readFileSync(path.join(root, "reports", "260809-google-adsense-50-step-guide", "index.html"), "utf8");

  assert.match(counterScript, /reportmode-request-board\.report-request-board\.workers\.dev/);
  assert.match(counterScript, /\/report-views/);
  assert.match(counterScript, /method: "POST"/);
  assert.match(counterScript, /reporthub:visitor-id/);
  assert.match(counterScript, /new URL\("\.\.\/reports\/view-counts\.json", script\.src\)/);
  assert.match(counterScript, /fetch\(fallbackUrl/);
  assert.match(counterScript, /counts\[reportId\]/);
  assert.match(counterScript, /\[data-report-view-count\]/);
  assert.match(counterScript, /new URL\("favicon\.svg\?v=20260809-rh1", script\.src\)/);
  assert.match(counterScript, /favicon\.type = "image\/svg\+xml";/);
  assert.doesNotMatch(counterScript, /counterapi\.dev|COUNTER_ENABLED = false/);
  assert.match(archive, /reportmode-request-board\.report-request-board\.workers\.dev/);
  assert.match(archive, /fetch\(COUNTER_API \+ "\/report-views"/);
  assert.doesNotMatch(archive, /counterapi\.dev|COUNTER_ENABLED = false/);
  assert.match(archive, /data-view-count-fallback="\d+">조회수 \d+</);
  assert.match(report, /report-view-counter\.js\?v=20260810-counter-d1-1/);
  assert.match(adsenseReport, /data-report-id="260809-google-adsense-50-step-guide"/);
});
