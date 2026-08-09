import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

class ReportViewPrepared {
  args: unknown[] = [];
  constructor(public db: ReportViewD1, public sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
}

class ReportViewD1 {
  visitors = new Set<string>();
  counts = new Map<string, number>([["legacy-report", 15]]);

  prepare(sql: string) { return new ReportViewPrepared(this, sql); }

  async run(sql: string, args: unknown[]) {
    if (!/INSERT OR IGNORE INTO report_view_daily_visitors/i.test(sql)) {
      throw new Error(`Unhandled run SQL: ${sql}`);
    }
    const [reportId, visitorId, day] = args.map(String);
    const key = `${reportId}:${visitorId}:${day}`;
    const existed = this.visitors.has(key);
    if (!existed) {
      this.visitors.add(key);
      this.counts.set(reportId, (this.counts.get(reportId) || 0) + 1);
    }
    return { success: true, meta: { changes: existed ? 0 : 1 }, results: [] };
  }

  async all(sql: string, args: unknown[]) {
    if (/WHERE report_id = \?/i.test(sql)) {
      const reportId = String(args[0]);
      const count = this.counts.get(reportId);
      return { results: count === undefined ? [] : [{ report_id: reportId, view_count: count }] };
    }
    if (/FROM report_view_counts/i.test(sql)) {
      return { results: Array.from(this.counts, ([report_id, view_count]) => ({ report_id, view_count })) };
    }
    throw new Error(`Unhandled all SQL: ${sql}`);
  }

  async first(sql: string, args: unknown[]) {
    const result = await this.all(sql, args);
    return result.results[0] || null;
  }

  async batch(statements: ReportViewPrepared[]) {
    const results = [];
    for (const statement of statements) {
      if (/INSERT OR IGNORE INTO report_view_daily_visitors/i.test(statement.sql)) {
        results.push(await this.run(statement.sql, statement.args));
      } else {
        const result = await this.all(statement.sql, statement.args);
        results.push({ success: true, meta: { changes: 0 }, ...result });
      }
    }
    return results;
  }
}

async function call(db: ReportViewD1, method: "GET" | "POST", body?: unknown) {
  const response = await worker.fetch(new Request("https://views.test/report-views", {
    method,
    headers: body ? { "Content-Type": "application/json", Origin: "https://aihubos.github.io" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db } as any);
  return { response, json: await response.json() as any };
}

test("report views persist and deduplicate one browser per Seoul day", async () => {
  const db = new ReportViewD1();
  const visitorOne = "11111111-1111-4111-8111-111111111111";
  const visitorTwo = "22222222-2222-4222-8222-222222222222";

  const first = await call(db, "POST", { reportId: "sample-report", visitorId: visitorOne });
  assert.equal(first.response.status, 200);
  assert.equal(first.json.counted, true);
  assert.equal(first.json.count, 1);

  const duplicate = await call(db, "POST", { reportId: "sample-report", visitorId: visitorOne });
  assert.equal(duplicate.json.counted, false);
  assert.equal(duplicate.json.count, 1);

  const second = await call(db, "POST", { reportId: "sample-report", visitorId: visitorTwo });
  assert.equal(second.json.counted, true);
  assert.equal(second.json.count, 2);

  const list = await call(db, "GET");
  assert.equal(list.json.counts["sample-report"], 2);
  assert.equal(list.json.counts["legacy-report"], 15);
});

test("report views reject invalid public identifiers", async () => {
  const db = new ReportViewD1();
  const invalid = await call(db, "POST", { reportId: "../private", visitorId: "not-a-uuid" });
  assert.equal(invalid.response.status, 400);
  assert.equal(invalid.json.error, "invalid_report_view");
});
