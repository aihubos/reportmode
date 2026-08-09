import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

type FeaturedRow = { report_id: string; selected_at: string };

class FeaturedPrepared {
  args: unknown[] = [];
  constructor(private db: FeaturedD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class FeaturedD1 {
  rows = new Map<string, FeaturedRow>();
  prepare(sql: string) { return new FeaturedPrepared(this, sql); }
  async all(sql: string, _args: unknown[]) {
    if (!/FROM report_featured/i.test(sql)) throw new Error(`Unhandled all SQL: ${sql}`);
    return { results: Array.from(this.rows.values()).sort((a, b) => b.selected_at.localeCompare(a.selected_at)) };
  }
  async first(sql: string, _args: unknown[]) {
    if (!/COUNT\(\*\)/i.test(sql)) throw new Error(`Unhandled first SQL: ${sql}`);
    return { count: this.rows.size };
  }
  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO report_featured/i.test(sql)) {
      this.rows.set(String(args[0]), { report_id: String(args[0]), selected_at: String(args[1]) });
      return { success: true };
    }
    if (/DELETE FROM report_featured/i.test(sql)) {
      this.rows.delete(String(args[0]));
      return { success: true };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }
}

async function call(db: FeaturedD1, path: string, method = "GET", body?: unknown) {
  const response = await worker.fetch(new Request(`https://featured.test${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json", Origin: "https://aihubos.github.io" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, ADMIN_PASSWORD: "admin-test-password" } as any);
  return { response, json: await response.json() as any };
}

test("administrator can select and remove a featured report", async () => {
  const db = new FeaturedD1();
  const selected = await call(db, "/featured-reports", "POST", {
    reportId: "report-one",
    adminPassword: "admin-test-password",
  });
  assert.equal(selected.response.status, 201);
  assert.deepEqual(selected.json.reportIds, ["report-one"]);

  const reloaded = await call(db, "/featured-reports");
  assert.deepEqual(reloaded.json.reportIds, ["report-one"]);

  const removed = await call(db, "/featured-reports/report-one", "DELETE", {
    adminPassword: "admin-test-password",
  });
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.json.reportIds, []);
});

test("featured selection rejects a fourth report", async () => {
  const db = new FeaturedD1();
  for (const reportId of ["one", "two", "three"]) {
    const result = await call(db, "/featured-reports", "POST", { reportId, adminPassword: "admin-test-password" });
    assert.equal(result.response.status, 201);
  }
  const overflow = await call(db, "/featured-reports", "POST", {
    reportId: "four",
    adminPassword: "admin-test-password",
  });
  assert.equal(overflow.response.status, 409);
  assert.equal(overflow.json.error, "featured_limit_reached");
});
