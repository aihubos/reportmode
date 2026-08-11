import assert from "node:assert/strict";
import test from "node:test";

globalThis.window = globalThis;
await import("./archive-admin-charts.js?test=20260811");

test("admin chart merges three daily series in ascending date order", () => {
  const rows = globalThis.ReportHubAdminCharts.seriesFor({
    site: { daily: [{ date: "2026-08-11", count: 3 }, { date: "2026-08-10", count: 1 }] },
    reports: { daily: [{ date: "2026-08-10", count: 4 }] },
    entries: { daily: [{ date: "2026-08-11", count: 2 }] },
  });
  assert.deepEqual(rows, [
    { date: "2026-08-10", visitors: 1, views: 4, entries: 0 },
    { date: "2026-08-11", visitors: 3, views: 0, entries: 2 },
  ]);
});

test("admin chart source contains accessible table and tooltip markers", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile(new URL("./archive-admin-charts.js", import.meta.url), "utf8"));
  assert.match(source, /<title>/);
  assert.match(source, /archive-admin-console-chart-summary-item/);
  assert.match(await import("node:fs/promises").then((fs) => fs.readFile(new URL("../archive/admin/index.html", import.meta.url), "utf8")), /archive-admin-console-chart-details/);
});
