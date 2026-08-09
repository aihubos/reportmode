import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.js";

class Prepared {
  args: unknown[] = [];
  constructor(private db: DraftDb, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  all<T>() { return this.db.all(this.sql) as Promise<{ results: T[] }>; }
}

class DraftDb {
  rows = new Map<string, string>();
  prepare(sql: string) { return new Prepared(this, sql); }
  async all(sql: string) {
    if (!/report_draft_promotions/i.test(sql)) throw new Error(`Unhandled SQL: ${sql}`);
    return { results: Array.from(this.rows, ([report_id, promoted_at]) => ({ report_id, promoted_at })) };
  }
  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO report_draft_promotions/i.test(sql)) this.rows.set(String(args[0]), String(args[1]));
    else if (/DELETE FROM report_draft_promotions/i.test(sql)) this.rows.delete(String(args[0]));
    else throw new Error(`Unhandled SQL: ${sql}`);
    return { success: true };
  }
}

async function call(db: DraftDb, path: string, method = "GET", body?: unknown) {
  const response = await worker.fetch(new Request(`https://draft.test${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, ADMIN_PASSWORD: "admin-test-password" } as any);
  return { response, json: await response.json() as any };
}

test("administrator can promote and remove a Draft report from main", async () => {
  const db = new DraftDb();
  const promoted = await call(db, "/draft-promotions", "POST", { reportId: "draft-one", adminPassword: "admin-test-password" });
  assert.equal(promoted.response.status, 201);
  assert.deepEqual(promoted.json.reportIds, ["draft-one"]);
  assert.deepEqual((await call(db, "/draft-promotions")).json.reportIds, ["draft-one"]);
  const removed = await call(db, "/draft-promotions/draft-one", "DELETE", { adminPassword: "admin-test-password" });
  assert.equal(removed.response.status, 200);
  assert.deepEqual(removed.json.reportIds, []);
});

test("Draft promotion rejects a wrong administrator password", async () => {
  const result = await call(new DraftDb(), "/draft-promotions", "POST", { reportId: "draft-one", adminPassword: "wrong" });
  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, "wrong_admin_password");
});
