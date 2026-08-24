import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

function seoulDateOffset(offset: number) {
  const date = new Date(Date.now() + (9 * 60 * 60 * 1000));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const ANALYTICS_TODAY = seoulDateOffset(0);
const ANALYTICS_YESTERDAY = seoulDateOffset(-1);

class AnalyticsPrepared {
  args: unknown[] = [];
  constructor(private db: AnalyticsD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class AnalyticsD1 {
  prepare(sql: string) { return new AnalyticsPrepared(this, sql); }

  async first(sql: string, _args: unknown[]) {
    if (/FROM report_site_visits/i.test(sql)) {
      return /AND visit_date = \?/i.test(sql) ? { count: 3 } : { count: 12 };
    }
    if (/SUM\(view_count\)/i.test(sql)) return { count: 42 };
    if (/FROM report_view_daily_visitors/i.test(sql)) return { count: 4 };
    throw new Error(`Unhandled first SQL: ${sql}`);
  }

  async all(sql: string, _args: unknown[]) {
    if (/FROM report_site_visits/i.test(sql)) {
      return { results: [{ date: ANALYTICS_TODAY, count: 3 }, { date: ANALYTICS_YESTERDAY, count: 5 }] };
    }
    if (/FROM report_view_daily_visitors/i.test(sql)) {
      return { results: [{ date: ANALYTICS_TODAY, count: 4 }, { date: ANALYTICS_YESTERDAY, count: 7 }] };
    }
    if (/FROM report_view_counts/i.test(sql)) {
      return { results: [{ report_id: "report-one", view_count: 21, updated_at: "2026-08-10T00:00:00.000Z" }] };
    }
    if (/FROM report_entry_sessions/i.test(sql)) {
      if (/GROUP BY source_type/i.test(sql)) return { results: [{ source_type: "naver", count: 2 }] };
      if (/SELECT created_at/i.test(sql)) return { results: [] };
      return { results: [{ date: ANALYTICS_TODAY, count: 1 }] };
    }
    throw new Error(`Unhandled all SQL: ${sql}`);
  }
}

async function call(body: unknown) {
  const response = await worker.fetch(new Request("https://analytics.test/admin/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://aireport.ai-hub-os.com" },
    body: JSON.stringify(body),
  }), { DB: new AnalyticsD1(), ADMIN_PASSWORD: "admin-test-password" } as any);
  return { response, json: await response.json() as any };
}

test("administrator can read daily visitors and popular report analytics", async () => {
  const result = await call({ adminPassword: "admin-test-password", days: 7 });

  assert.equal(result.response.status, 200);
  assert.equal(result.json.site.siteId, "report-hub-main");
  assert.equal(result.json.site.total, 12);
  assert.equal(result.json.site.today, 3);
  assert.equal(result.json.site.daily.length, 7);
  assert.deepEqual(result.json.site.daily.find((row: { date: string }) => row.date === ANALYTICS_YESTERDAY), { date: ANALYTICS_YESTERDAY, count: 5 });
  assert.deepEqual(result.json.site.daily.find((row: { date: string }) => row.date === ANALYTICS_TODAY), { date: ANALYTICS_TODAY, count: 3 });
  assert.equal(result.json.reports.totalViews, 42);
  assert.equal(result.json.reports.todayViews, 4);
  assert.equal(result.json.reports.top[0].reportId, "report-one");
  assert.equal(result.json.reports.top[0].views, 21);
  assert.equal(result.json.entries.daily.length, 7);
  assert.equal(result.json.entries.sources[0].source, "naver");
});

test("daily analytics rejects a wrong administrator password", async () => {
  const result = await call({ adminPassword: "not-the-password" });

  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, "wrong_admin_password");
});
