import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runRefresh } from "./report-refresh.mjs";

test("refresh run snapshots every route, enhances content pages only, and writes inventory metadata", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-refresh-test-"));
  fs.mkdirSync(path.join(root, "reports", "folder"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "reports", "folder", "index.html"),
    '<!doctype html><html><head><title>폴더 보고서</title></head><body><h1>폴더 보고서</h1></body></html>',
  );
  const redirect = '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=https://example.com/"><title>외부 링크</title></head><body></body></html>';
  fs.writeFileSync(path.join(root, "reports", "external.html"), redirect);
  fs.writeFileSync(
    path.join(root, "reports", "manifest.json"),
    JSON.stringify({ reports: [{ id: "folder", path: "reports/folder/", title: "폴더 보고서" }] }),
  );

  const result = runRefresh({ root, snapshotId: "2026-08-09-before-refresh" });

  assert.deepEqual(result.counts, { total: 2, content: 1, redirects: 1, listed: 1, unlisted: 1 });
  const current = fs.readFileSync(path.join(root, "reports", "folder", "index.html"), "utf8");
  assert.match(current, /data-report-layout="wide"/);
  assert.match(current, /report-history\.js/);
  assert.equal(fs.readFileSync(path.join(root, "reports", "external.html"), "utf8"), redirect);

  const previous = fs.readFileSync(
    path.join(root, "versions", "2026-08-09-before-refresh", "reports", "folder", "index.html"),
    "utf8",
  );
  assert.match(previous, /2026년 8월 9일 이전판/);
  assert.equal(
    fs.readFileSync(
      path.join(root, "versions", "2026-08-09-before-refresh", "reports", "external.html"),
      "utf8",
    ),
    redirect,
  );

  const versions = JSON.parse(fs.readFileSync(path.join(root, "versions", "manifest.json"), "utf8"));
  assert.equal(versions.reports.length, 1);
  assert.equal(versions.reports[0].id, "folder");
  assert.equal(versions.reports[0].currentVersion, "v1.1.0");
  assert.equal(versions.reports[0].previousVersion.version, "v1.0.0");

  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, "docs", "report-refresh", "2026-08-09-inventory.json"), "utf8"),
  );
  assert.equal(inventory.counts.total, 2);
  assert.equal(inventory.reports.find((item) => item.id === "folder").titleLocked, true);
});
