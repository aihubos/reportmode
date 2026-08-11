import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateSources,
  normalizeEntryPayload,
  normalizeAnalyticsDays,
  zeroFillDailySeries,
} from "./admin-analytics.js";
import { chunkReportIds, normalizeAdminAction } from "./admin-jobs.js";

test("entry payload removes tracking query values and classifies Naver safely", () => {
  const result = normalizeEntryPayload({
    entryId: "entry-001",
    visitorId: "visitor-001",
    landingPath: "/reportmode/reports/example/",
    reportId: "apple-care-098-v1.0.0",
    referrer: "https://blog.naver.com/example/post/1?user_email=private@example.com",
    utmSource: "naver",
    utmMedium: "blog",
    utmCampaign: "summer",
  });

  assert.equal(result.sourceType, "naver");
  assert.equal(result.referrerHost, "blog.naver.com");
  assert.equal(result.referrerPath, "/example/post/1");
  assert.equal(result.utmSource, "naver");
  assert.equal(result.referrerUrl, "https://blog.naver.com/example/post/1");
  assert.equal(result.reportId, "apple-care-098-v1.0.0");
  assert.equal(result.landingPath, "/reportmode/reports/example/");
});

test("entry payload classifies direct traffic and rejects invalid identifiers", () => {
  const result = normalizeEntryPayload({
    entryId: "bad value",
    visitorId: "bad value",
    landingPath: "not-a-path",
    referrer: "",
  });

  assert.equal(result.entryId, "");
  assert.equal(result.visitorId, "");
  assert.equal(result.landingPath, "/");
  assert.equal(result.sourceType, "direct");
  assert.equal(result.referrerHost, "");
});

test("daily analytics fills missing Seoul dates with zeroes in ascending order", () => {
  const result = zeroFillDailySeries("2026-08-09", 3, [
    { date: "2026-08-09", count: 4 },
    { date: "2026-08-07", count: 2 },
  ]);

  assert.deepEqual(result, [
    { date: "2026-08-07", count: 2 },
    { date: "2026-08-08", count: 0 },
    { date: "2026-08-09", count: 4 },
  ]);
});

test("analytics days are restricted to the supported 7, 30, and 90 day ranges", () => {
  assert.equal(normalizeAnalyticsDays(7), 7);
  assert.equal(normalizeAnalyticsDays(30), 30);
  assert.equal(normalizeAnalyticsDays(90), 90);
  assert.equal(normalizeAnalyticsDays(365), 30);
});

test("source aggregation returns sorted counts and percentages", () => {
  const result = aggregateSources([
    { source_type: "direct", count: 2 },
    { source_type: "naver", count: 5 },
    { source_type: "google", count: 3 },
  ]);

  assert.deepEqual(result, [
    { source: "naver", count: 5, share: 50 },
    { source: "google", count: 3, share: 30 },
    { source: "direct", count: 2, share: 20 },
  ]);
});

test("admin actions normalize unique IDs and split large selections into safe chunks", () => {
  assert.equal(normalizeAdminAction("hide"), "hide");
  assert.equal(normalizeAdminAction("make_private"), "make_private");
  assert.equal(normalizeAdminAction("unknown"), "");
  assert.deepEqual(chunkReportIds(["a", "a", "b", "c"], 2), [["a", "b"], ["c"]]);
});
