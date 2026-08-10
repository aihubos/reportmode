import test from "node:test";
import assert from "node:assert/strict";

import worker from "./index.js";

type OverrideRow = {
  report_id: string;
  title: string;
  summary: string;
  cover_image: string | null;
  cover_alt: string | null;
  updated_at: string;
};

class OverridePrepared {
  args: unknown[] = [];
  constructor(private db: OverrideD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class OverrideD1 {
  rows = new Map<string, OverrideRow>();
  prepare(sql: string) { return new OverridePrepared(this, sql); }

  async all(sql: string, _args: unknown[]) {
    if (!/FROM report_overrides/i.test(sql)) throw new Error(`Unhandled all SQL: ${sql}`);
    return { results: Array.from(this.rows.values()).sort((a, b) => b.updated_at.localeCompare(a.updated_at)) };
  }

  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO report_overrides/i.test(sql)) {
      const [reportId, title, summary, coverImage, coverAlt, updatedAt] = args;
      this.rows.set(String(reportId), {
        report_id: String(reportId),
        title: String(title),
        summary: String(summary),
        cover_image: coverImage ? String(coverImage) : null,
        cover_alt: coverAlt ? String(coverAlt) : null,
        updated_at: String(updatedAt),
      });
      return { success: true };
    }
    if (/DELETE FROM report_overrides/i.test(sql)) {
      this.rows.delete(String(args[0]));
      return { success: true };
    }
    throw new Error(`Unhandled run SQL: ${sql}`);
  }
}

async function call(db: OverrideD1, path: string, method = "GET", body?: unknown) {
  const response = await worker.fetch(new Request(`https://overrides.test${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json", Origin: "https://aihubos.github.io" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, ADMIN_PASSWORD: "admin-test-password" } as any);
  return { response, json: await response.json() as any };
}

test("administrator can save, reload, and restore report card presentation", async () => {
  const db = new OverrideD1();
  const uploadedThumbnail = `data:image/jpeg;base64,${Buffer.from("thumbnail-image", "utf8").toString("base64")}`;
  const saved = await call(db, "/report-overrides/report-one", "PUT", {
    adminPassword: "admin-test-password",
    title: "새 제목",
    summary: "관리자가 수정한 상세 설명입니다.",
    coverImage: uploadedThumbnail,
    coverAlt: "새 대표 이미지 설명",
  });
  assert.equal(saved.response.status, 201);
  assert.deepEqual(saved.json.override, {
    reportId: "report-one",
    title: "새 제목",
    summary: "관리자가 수정한 상세 설명입니다.",
    coverImage: uploadedThumbnail,
    coverAlt: "새 대표 이미지 설명",
    updatedAt: saved.json.override.updatedAt,
  });

  const reloaded = await call(db, "/report-overrides");
  assert.equal(reloaded.json.overrides["report-one"].title, "새 제목");
  assert.equal(reloaded.json.overrides["report-one"].coverImage, uploadedThumbnail);

  const restored = await call(db, "/report-overrides/report-one", "DELETE", {
    adminPassword: "admin-test-password",
  });
  assert.equal(restored.response.status, 200);
  assert.deepEqual((await call(db, "/report-overrides")).json.overrides, {});
});

test("report card presentation rejects unsafe image URLs and a wrong administrator password", async () => {
  const db = new OverrideD1();
  const wrongPassword = await call(db, "/report-overrides/report-one", "PUT", {
    adminPassword: "wrong-password",
    title: "새 제목",
    summary: "관리자가 수정한 상세 설명입니다.",
  });
  assert.equal(wrongPassword.response.status, 403);
  assert.equal(wrongPassword.json.error, "wrong_admin_password");

  const unsafeImage = await call(db, "/report-overrides/report-one", "PUT", {
    adminPassword: "admin-test-password",
    title: "새 제목",
    summary: "관리자가 수정한 상세 설명입니다.",
    coverImage: "javascript:alert(1)",
  });
  assert.equal(unsafeImage.response.status, 400);
  assert.equal(unsafeImage.json.error, "invalid_cover_url");

  const unsupportedImage = await call(db, "/report-overrides/report-one", "PUT", {
    adminPassword: "admin-test-password",
    title: "새 제목",
    summary: "관리자가 수정한 상세 설명입니다.",
    coverImage: "data:image/png;base64,aW1hZ2U=",
  });
  assert.equal(unsupportedImage.response.status, 400);
  assert.equal(unsupportedImage.json.error, "invalid_cover_url");
});
