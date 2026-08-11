import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

class ActionPrepared {
  args: unknown[] = [];
  constructor(private db: ActionD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
}

class ActionD1 {
  entries = new Set<string>();
  hidden = new Set<string>();
  prepare(sql: string) { return new ActionPrepared(this, sql); }
  async run(sql: string, args: unknown[]) {
    if (/INSERT OR IGNORE INTO report_entry_sessions/i.test(sql)) {
      const id = String(args[0]);
      const previous = this.entries.has(id);
      this.entries.add(id);
      return { meta: { changes: previous ? 0 : 1 } };
    }
    if (/INSERT INTO report_hidden/i.test(sql)) {
      this.hidden.add(String(args[0]));
      return { meta: { changes: 1 } };
    }
    if (/DELETE FROM report_hidden/i.test(sql)) {
      this.hidden.delete(String(args[0]));
      return { meta: { changes: 1 } };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }
  async batch(statements: ActionPrepared[]) {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}

async function call(db: ActionD1, path: string, body: unknown) {
  const response = await worker.fetch(new Request(`https://actions.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://aireport.ai-hub-os.com" },
    body: JSON.stringify(body),
  }), { DB: db, ADMIN_PASSWORD: "admin-test-password" } as any);
  return { response, json: await response.json() as any };
}

test("entry sessions deduplicate the same browser session", async () => {
  const db = new ActionD1();
  const body = {
    siteId: "report-hub-main",
    entryId: "00000000-0000-4000-8000-000000000001",
    visitorId: "00000000-0000-4000-8000-000000000002",
    landingPath: "/reportmode/archive/",
    referrer: "https://blog.naver.com/example/post/1?secret=hidden",
  };
  const first = await call(db, "/entry-sessions", body);
  const second = await call(db, "/entry-sessions", body);
  assert.equal(first.response.status, 200);
  assert.equal(first.json.counted, true);
  assert.equal(first.json.sourceType, "naver");
  assert.equal(second.json.counted, false);
  assert.equal(db.entries.size, 1);
});

test("admin can hide and unhide a batch of reports", async () => {
  const db = new ActionD1();
  const hidden = await call(db, "/admin/report-actions", {
    action: "hide",
    reportIds: ["report-one", "report-two", "report-one"],
    adminPassword: "admin-test-password",
  });
  assert.equal(hidden.response.status, 200);
  assert.deepEqual(Array.from(db.hidden).sort(), ["report-one", "report-two"]);

  const visible = await call(db, "/admin/report-actions", {
    action: "unhide",
    reportIds: ["report-one", "report-two"],
    adminPassword: "admin-test-password",
  });
  assert.equal(visible.response.status, 200);
  assert.equal(db.hidden.size, 0);
});
