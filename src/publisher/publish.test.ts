import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import * as publisher from "./publish.js";
import type { PreparedUpload } from "./store.js";

test("publisher preserves the uploaded source and adds comments to the public report", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "reportmode-publisher-comments-"));
  const writePreparedToClone = (
    publisher as typeof publisher & {
      writePreparedToClone?: (target: string, upload: PreparedUpload) => void;
    }
  ).writePreparedToClone;

  try {
    assert.equal(
      typeof writePreparedToClone,
      "function",
      "the publisher must expose its public-file preparation step",
    );

    const sourceHtml = "<!doctype html><html><head><title>댓글 자동 게시 검증</title></head><body><main><h1>댓글 자동 게시 검증</h1></main></body></html>";
    const id = "260809-comments-auto-publish";
    const prepared: PreparedUpload = {
      meta: {
        schemaVersion: "1",
        id,
        slug: "comments-auto-publish",
        title: "댓글 자동 게시 검증",
        category: "운영",
        tags: ["댓글"],
        summary: "업로드 공개본 댓글 자동 삽입 검증",
        createdAt: "2026-08-09T18:00:00+09:00",
        updatedAt: "2026-08-09T18:00:00+09:00",
        status: "published",
        sourceName: "comments-auto-publish.html",
        sourceCount: 0,
        entry: "index.html",
      },
      files: new Map([["index.html", Buffer.from(sourceHtml, "utf8")]]),
    };

    writePreparedToClone!(root, prepared);

    const storedSource = fs.readFileSync(
      path.join(root, "content", "uploads", id, "files", "index.html"),
      "utf8",
    );
    const publicHtml = fs.readFileSync(
      path.join(root, "reports", id, "index.html"),
      "utf8",
    );

    assert.equal(storedSource, sourceHtml);
    assert.match(publicHtml, /report-comments\.css\?v=/);
    assert.match(
      publicHtml,
      new RegExp(`report-comments\\.js[^>]+data-report-id="${id}"`),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("public verification accepts comments only for the published report id", () => {
  const hasPublishedReportComments = (
    publisher as typeof publisher & {
      hasPublishedReportComments?: (html: string, reportId: string) => boolean;
    }
  ).hasPublishedReportComments;

  assert.equal(
    typeof hasPublishedReportComments,
    "function",
    "the publisher must verify the deployed comments hook",
  );

  const id = "260809-comments-auto-publish";
  const correct = '<html><head><link rel="stylesheet" href="../../assets/report-comments.css?v=1"></head><body><script data-report-id="260809-comments-auto-publish" src="../../assets/report-comments.js?v=1"></script></body></html>';
  const wrongId = correct.replace(id, "260809-another-report");
  const missingScript = '<html><head><link rel="stylesheet" href="../../assets/report-comments.css?v=1"></head><body></body></html>';

  assert.equal(hasPublishedReportComments!(correct, id), true);
  assert.equal(hasPublishedReportComments!(wrongId, id), false);
  assert.equal(hasPublishedReportComments!(missingScript, id), false);
});
