import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

test("entry tracker sends landing path, report id, referrer, and UTM fields", async () => {
  const source = await fs.readFile(new URL("./report-entry-tracker.js", import.meta.url), "utf8");
  assert.match(source, /landingPath: window\.location\.pathname/);
  assert.match(source, /reportId: currentReportId/);
  assert.match(source, /referrer: document\.referrer/);
  assert.match(source, /utmCampaign/);
  assert.match(source, /sessionStorage/);
  assert.match(source, /data-entry-redirect/);
  assert.match(source, /keepalive: true/);
  assert.ok(source.includes("http://127.0.0.1:8787"));
});
