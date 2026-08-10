import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

type StoredComment = {
  id: string;
  report_id: string;
  author: string;
  content: string;
  password_salt: string;
  password_hash: string;
  created_at: string;
  updated_at: string | null;
  is_admin: number;
};

class FakePrepared {
  args: unknown[] = [];
  constructor(private db: FakeD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class FakeD1 {
  comments = new Map<string, StoredComment>();
  prepare(sql: string) { return new FakePrepared(this, sql); }

  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO report_comments/i.test(sql)) {
      const [id, reportId, author, content, salt, hash, createdAt, updatedAt = null, isAdmin = 0] = args;
      this.comments.set(String(id), {
        id: String(id), report_id: String(reportId), author: String(author), content: String(content),
        password_salt: String(salt), password_hash: String(hash), created_at: String(createdAt),
        updated_at: updatedAt ? String(updatedAt) : null, is_admin: Number(isAdmin || 0),
      });
      return { success: true };
    }
    if (/UPDATE report_comments SET author/i.test(sql)) {
      const [author, content, updatedAt, isAdmin, id] = args;
      const row = this.comments.get(String(id));
      if (row) Object.assign(row, { author: String(author), content: String(content), updated_at: String(updatedAt), is_admin: Number(isAdmin) });
      return { success: true };
    }
    if (/DELETE FROM report_comments/i.test(sql)) {
      this.comments.delete(String(args[0]));
      return { success: true };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }

  async first(sql: string, args: unknown[]) {
    if (/FROM report_comments WHERE id = \?/i.test(sql)) return this.comments.get(String(args[0])) || null;
    throw new Error(`Unhandled first SQL: ${sql}`);
  }

  async all(sql: string, args: unknown[]) {
    if (/FROM report_comments\s+ORDER BY COALESCE\(updated_at, created_at\) DESC/i.test(sql)) {
      const rows = Array.from(this.comments.values())
        .sort((left, right) => String(right.updated_at || right.created_at).localeCompare(String(left.updated_at || left.created_at)))
        .map(({ password_salt, password_hash, ...row }) => row);
      return { results: rows as T[] };
    }
    if (/FROM report_comments WHERE report_id = \?/i.test(sql)) {
      const rows = Array.from(this.comments.values())
        .filter((row) => row.report_id === String(args[0]))
        .map(({ password_salt, password_hash, ...row }) => row);
      return { results: rows as T[] };
    }
    throw new Error(`Unhandled all SQL: ${sql}`);
  }
}

function env() {
  return { DB: new FakeD1(), ADMIN_PASSWORD: "admin-test-password" } as any;
}

async function call(environment: any, path: string, method = "GET", body?: unknown) {
  const response = await worker.fetch(new Request(`https://comments.test${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json", Origin: "https://aihubos.github.io" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), environment);
  return { response, json: await response.json() as any };
}

test("comment creation requires a visible author name", async () => {
  const result = await call(env(), "/comments", "POST", {
    reportId: "sample-report", author: "", content: "내용입니다", password: "user-password",
  });
  assert.equal(result.response.status, 400);
  assert.equal(result.json.error, "author_required");
});

test("Jeremy and 제레미 are reserved for an authenticated administrator", async () => {
  const environment = env();
  const denied = await call(environment, "/comments", "POST", {
    reportId: "sample-report", author: "Jeremy", content: "관리자 사칭", password: "wrong-password",
  });
  assert.equal(denied.response.status, 403);
  assert.equal(denied.json.error, "reserved_admin_name");

  const allowed = await call(environment, "/comments", "POST", {
    reportId: "sample-report", author: "제레미", content: "관리자 댓글", password: "admin-test-password",
  });
  assert.equal(allowed.response.status, 201);
  assert.equal(allowed.json.comment.is_admin, 1);
});

test("recent comments span reports in latest activity order", async () => {
  const environment = env();
  environment.DB.comments.set("11111111-1111-4111-8111-111111111111", {
    id: "11111111-1111-4111-8111-111111111111",
    report_id: "older-report",
    author: "첫 방문자",
    content: "먼저 남긴 댓글",
    password_salt: "private-salt",
    password_hash: "private-hash",
    created_at: "2026-08-08T01:00:00.000Z",
    updated_at: null,
    is_admin: 0,
  });
  environment.DB.comments.set("22222222-2222-4222-8222-222222222222", {
    id: "22222222-2222-4222-8222-222222222222",
    report_id: "newer-report",
    author: "최근 방문자",
    content: "가장 최근에 수정한 댓글",
    password_salt: "private-salt",
    password_hash: "private-hash",
    created_at: "2026-08-08T02:00:00.000Z",
    updated_at: "2026-08-09T03:00:00.000Z",
    is_admin: 1,
  });

  const result = await call(environment, "/comments/recent");
  assert.equal(result.response.status, 200);
  assert.deepEqual(result.json.comments.map((comment: any) => comment.id), [
    "22222222-2222-4222-8222-222222222222",
    "11111111-1111-4111-8111-111111111111",
  ]);
  assert.equal(result.json.comments[0].report_id, "newer-report");
  assert.equal("password_hash" in result.json.comments[0], false);
  assert.equal("password_salt" in result.json.comments[0], false);
});

test("comment owner and administrator can persist edits and deletes", async () => {
  const environment = env();
  const created = await call(environment, "/comments", "POST", {
    reportId: "sample-report", author: "방문자", content: "처음 내용", password: "user-password",
  });
  assert.equal(created.response.status, 201);
  const id = created.json.comment.id;

  const denied = await call(environment, `/comments/${id}`, "PATCH", {
    author: "방문자", content: "바꾸려는 내용", password: "wrong-password",
  });
  assert.equal(denied.response.status, 403);

  const edited = await call(environment, `/comments/${id}`, "PATCH", {
    author: "방문자", content: "수정한 내용", password: "user-password",
  });
  assert.equal(edited.response.status, 200);
  assert.equal(edited.json.comment.content, "수정한 내용");
  assert.ok(edited.json.comment.updated_at);

  const reloaded = await call(environment, "/comments?report=sample-report");
  assert.equal(reloaded.json.comments[0].content, "수정한 내용");

  const adminEdited = await call(environment, `/comments/${id}`, "PATCH", {
    author: "Jeremy", content: "관리자가 정리한 내용", password: "admin-test-password",
  });
  assert.equal(adminEdited.response.status, 200);
  assert.equal(adminEdited.json.comment.is_admin, 1);

  const removed = await call(environment, `/comments/${id}`, "DELETE", { password: "admin-test-password" });
  assert.equal(removed.response.status, 200);
  const afterDelete = await call(environment, "/comments?report=sample-report");
  assert.equal(afterDelete.json.comments.length, 0);
});
