import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("retired CounterAPI stays disabled while reports read the archive fallback map", () => {
  const counterScript = fs.readFileSync(path.join(root, "assets", "report-view-counter.js"), "utf8");
  const archive = fs.readFileSync(path.join(root, "archive", "index.html"), "utf8");
  const report = fs.readFileSync(path.join(root, "reports", "260806-palantir-business-ai-analysis", "index.html"), "utf8");

  assert.match(counterScript, /var COUNTER_ENABLED = false;/);
  assert.match(counterScript, /new URL\("\.\.\/reports\/view-counts\.json", script\.src\)/);
  assert.match(counterScript, /fetch\(fallbackUrl/);
  assert.match(counterScript, /counts\[reportId\]/);
  assert.match(counterScript, /\[data-report-view-count\]/);
  assert.match(counterScript, /new URL\("favicon\.svg\?v=20260809-rh1", script\.src\)/);
  assert.match(counterScript, /favicon\.type = "image\/svg\+xml";/);
  assert.match(archive, /var COUNTER_ENABLED = false;/);
  assert.match(archive, /data-view-count-fallback="\d+">조회수 \d+</);
  assert.match(report, /report-view-counter\.js\?v=20260809-counter-fallback2/);
});
