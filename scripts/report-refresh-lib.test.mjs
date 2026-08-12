import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVersionRecord,
  createSnapshotHtml,
  deriveReportVersion,
  enhanceCurrentReport,
  extractReportTitle,
  isRedirectHtml,
  reportIdFromPath,
} from "./report-refresh-lib.mjs";

const basicReport = `<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><title>고정 제목</title></head>
<body><main><h1>고정 제목</h1><p>본문</p></main></body>
</html>`;

test("current report enhancement preserves title while adding the shared wide/detail shell", () => {
  const output = enhanceCurrentReport(basicReport, {
    reportPath: "reports/sample-report/index.html",
    reportId: "sample-report",
    snapshotId: "2026-08-09-before-refresh",
  });

  assert.match(output, /<title>고정 제목<\/title>/);
  assert.match(output, /<h1>고정 제목<\/h1>/);
  assert.match(output, /<body[^>]*data-report-view="detail"/);
  assert.match(output, /<body[^>]*data-report-layout="wide"/);
  assert.match(output, /href="https:\/\/aireport\.ai-hub-os\.com\/"/);
  assert.match(output, /class="report-hub-logo-image" src="\.\.\/\.\.\/assets\/report-hub-logo\.png\?v=20260812-report-hub-logo1" alt="Report Hub"/);
  assert.doesNotMatch(output, /report-hub-wordmark|report-hub-byline|by Jeremy/);
  assert.match(output, /report-page-layout\.css\?v=20260810-mobile-scroll1/);
  assert.match(output, /report-page-layout\.js\?v=20260810-mobile-scroll1/);
  assert.match(output, /report-comments\.css\?v=20260810-comments2/);
  assert.match(output, /report-comments\.js\?v=20260810-comments2/);
  assert.match(output, /report-history\.js\?v=20260809-history2/);
  assert.match(output, /data-report-id="sample-report"/);
  assert.match(output, /data-has-previous="true"/);
});

test("redirect-only pages remain byte-for-byte unchanged", () => {
  const redirect = `<!doctype html><html><head><meta http-equiv="refresh" content="0; url=https://example.com/"><title>링크</title></head><body><a href="https://example.com/">이동</a></body></html>`;
  assert.equal(isRedirectHtml(redirect), true);
  assert.equal(
    enhanceCurrentReport(redirect, {
      reportPath: "reports/external.html",
      reportId: "external",
      snapshotId: "2026-08-09-before-refresh",
    }),
    redirect,
  );
});

test("snapshot page keeps the title and points back to the current canonical report", () => {
  const output = createSnapshotHtml(basicReport, {
    reportPath: "reports/sample-report.html",
    snapshotId: "2026-08-09-before-refresh",
  });

  assert.match(output, /<title>고정 제목<\/title>/);
  assert.match(output, /<base href="\/reportmode\/reports\/">/);
  assert.match(output, /class="report-version-banner"/);
  assert.match(output, /href="\/reportmode\/reports\/sample-report\.html"/);
  assert.match(output, /2026년 8월 9일 이전판/);
});

test("folder snapshot keeps the original folder as its base URL", () => {
  const output = createSnapshotHtml(basicReport, {
    reportPath: "reports/sample-report/index.html",
    snapshotId: "2026-08-09-before-refresh",
  });

  assert.match(output, /<base href="\/reportmode\/reports\/sample-report\/">/);
  assert.match(output, /href="\/reportmode\/reports\/sample-report\/"/);
});

test("version record exposes a direct previous-report URL without changing the canonical URL", () => {
  assert.deepEqual(
    buildVersionRecord({
      reportId: "sample-report",
      reportPath: "reports/sample-report/index.html",
      title: "고정 제목",
      snapshotId: "2026-08-09-before-refresh",
      version: "v1.0.0",
    }),
    {
      id: "sample-report",
      title: "고정 제목",
      canonicalPath: "reports/sample-report/",
      currentUrl: "/reportmode/reports/sample-report/",
      previousVersion: {
        version: "v1.0.0",
        date: "2026-08-09",
        label: "내용 최신화 전 기준판",
        url: "/reportmode/versions/2026-08-09-before-refresh/reports/sample-report/",
      },
    },
  );
});

test("report identity extraction handles single files, folders, and embedded version metadata", () => {
  assert.equal(reportIdFromPath("reports/alpha.html"), "alpha");
  assert.equal(reportIdFromPath("reports/bravo/index.html"), "bravo");
  assert.equal(extractReportTitle(basicReport), "고정 제목");
  assert.equal(
    deriveReportVersion('<script id="report-metadata" type="application/json">{"version":"2.3.0"}</script>', "reports/sample.html"),
    "v2.3.0",
  );
  assert.equal(deriveReportVersion(basicReport, "reports/guide-v1-0-1/index.html"), "v1.0.1");
  assert.equal(deriveReportVersion(basicReport, "reports/unversioned.html"), "v1.0.0");
});
