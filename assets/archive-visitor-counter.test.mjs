import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("archive visitor counter records one anonymous browser visit per day", () => {
  const scriptUrl = new URL("./archive-visitor-counter.js", import.meta.url);
  assert.equal(fs.existsSync(scriptUrl), true, "archive-visitor-counter.js must exist");
  if (!fs.existsSync(scriptUrl)) return;
  const script = fs.readFileSync(scriptUrl, "utf8");
  assert.match(script, /reporthub:visitor-id/);
  assert.match(script, /method:\s*"POST"/);
  assert.match(script, /\/visits/);
  assert.match(script, /누적 방문/);
  assert.match(script, /오늘/);
  assert.doesNotMatch(script, /ip|fingerprint/i);
});
