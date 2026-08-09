import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

class VisitPrepared {
  args: unknown[] = [];
  constructor(private db: VisitD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
}

class VisitD1 {
  rows = new Set<string>();
  prepare(sql: string) { return new VisitPrepared(this, sql); }
  async run(sql: string, args: unknown[]) {
    if (!/INSERT OR IGNORE INTO report_site_visits/i.test(sql)) throw new Error(`Unhandled run SQL: ${sql}`);
    const key = args.map(String).slice(0, 3).join(":");
    const existed = this.rows.has(key);
    this.rows.add(key);
    return { success: true, meta: { changes: existed ? 0 : 1 } };
  }
  async first(sql: string, args: unknown[]) {
    if (!/COUNT\(\*\)/i.test(sql)) throw new Error(`Unhandled first SQL: ${sql}`);
    const siteId = String(args[0]);
    const day = args.length > 1 ? String(args[1]) : null;
    const count = Array.from(this.rows).filter((key) => {
      const parts = key.split(":");
      return parts[0] === siteId && (!day || parts[2] === day);
    }).length;
    return { count };
  }
}

async function call(db: VisitD1, method: "GET" | "POST", body?: unknown) {
  const response = await worker.fetch(new Request("https://visits.test/visits?site=report-hub-main", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db } as any);
  return { response, json: await response.json() as any };
}

test("visits endpoint deduplicates the same anonymous browser for the Seoul day", async () => {
  const db = new VisitD1();
  const first = await call(db, "POST", { siteId: "report-hub-main", visitorId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(first.response.status, 200);
  assert.equal(first.json.counted, true);
  assert.equal(first.json.total, 1);
  assert.equal(first.json.today, 1);

  const duplicate = await call(db, "POST", { siteId: "report-hub-main", visitorId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.json.counted, false);
  assert.equal(duplicate.json.total, 1);

  const second = await call(db, "POST", { siteId: "report-hub-main", visitorId: "22222222-2222-4222-8222-222222222222" });
  assert.equal(second.json.total, 2);
  assert.equal(second.json.today, 2);

  const read = await call(db, "GET");
  assert.equal(read.json.total, 2);
  assert.equal(read.json.today, 2);
});
