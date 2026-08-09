import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expectedReportBase, scanHtml } from "./report-integrity-qa.mjs";

test("integrity scan ignores data-report-id and finds real missing files and anchors", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-integrity-"));
  fs.mkdirSync(path.join(root, "reports"), { recursive: true });
  const reportPath = path.join(root, "reports", "sample.html");
  const html = '<!doctype html><html><head><title>제목</title></head><body data-report-id="sample"><h1 id="title">제목</h1><a href="#missing">이동</a><img src="assets/missing.png" alt="샘플"></body></html>';
  fs.writeFileSync(reportPath, html);

  const issues = scanHtml({ root, reportPath, html });

  assert.equal(issues.some((issue) => issue.type === "duplicate-id"), false);
  assert.equal(issues.some((issue) => issue.type === "missing-anchor"), true);
  assert.equal(issues.some((issue) => issue.type === "missing-local"), true);
});

test("snapshot base points to the original report location", () => {
  assert.equal(expectedReportBase("reports/sample.html"), "/reportmode/reports/");
  assert.equal(expectedReportBase("reports/sample/index.html"), "/reportmode/reports/sample/");
});

test("integrity scan flags duplicated shared report scripts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-integrity-script-"));
  const reportPath = path.join(root, "reports", "sample.html");
  const html = '<!doctype html><html><head><title>제목</title></head><body><h1>제목</h1><script src="../assets/report-view-counter.js"></script><script src="../assets/report-view-counter.js"></script></body></html>';

  const issues = scanHtml({ root, reportPath, html });

  assert.equal(issues.some((issue) => issue.type === "duplicate-shared-script" && issue.asset === "report-view-counter.js"), true);
});
