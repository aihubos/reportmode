import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { applyContentReviews } from "./report-content-review.mjs";

test("content review merge covers every content record and writes an audit document", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-content-review-"));
  fs.mkdirSync(path.join(root, "versions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "report-refresh"), { recursive: true });
  fs.writeFileSync(path.join(root, "versions", "manifest.json"), JSON.stringify({
    reports: [
      { id: "one", title: "첫 보고서", status: "content-refreshed", changeSummary: "기존" },
      { id: "old", title: "과거 보고서", status: "historical", changeSummary: "기존" },
    ],
  }));
  fs.writeFileSync(path.join(root, "docs", "report-refresh", "2026-08-09-content-review.json"), JSON.stringify({
    reviewedAt: "2026-08-09",
    reports: {
      one: { verdict: "corrected", label: "수정 완료", summary: "가격 수정", changes: ["계산 수정"], watchItems: [] },
      old: { verdict: "historical", label: "과거판", summary: "보존", changes: [], watchItems: ["최신판 참고"] },
    },
  }));

  const result = applyContentReviews({ root });
  assert.deepEqual(result.counts, { total: 2, corrected: 1, verified: 0, historical: 1 });
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "versions", "manifest.json"), "utf8"));
  assert.equal(manifest.reports[0].contentReview.summary, "가격 수정");
  assert.match(manifest.reports[0].changeSummary, /가격 수정/);
  const markdown = fs.readFileSync(path.join(root, "docs", "report-refresh", "2026-08-09-content-review.md"), "utf8");
  assert.match(markdown, /첫 보고서/);
  assert.match(markdown, /수정 완료/);
});

test("content review merge refuses incomplete coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-content-review-missing-"));
  fs.mkdirSync(path.join(root, "versions"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs", "report-refresh"), { recursive: true });
  fs.writeFileSync(path.join(root, "versions", "manifest.json"), JSON.stringify({ reports: [{ id: "missing", title: "누락" }] }));
  fs.writeFileSync(path.join(root, "docs", "report-refresh", "2026-08-09-content-review.json"), JSON.stringify({ reviewedAt: "2026-08-09", reports: {} }));
  assert.throws(() => applyContentReviews({ root }), /검토 기록 누락: missing/);
});
