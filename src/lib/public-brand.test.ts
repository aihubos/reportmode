import assert from "node:assert/strict";
import test from "node:test";

import { applyReportHubBrand, REPORT_HUB_HOME } from "./public-brand.js";

test("applies the Report Hub brand without changing the report subject", () => {
  const source = `<!doctype html><html lang="ko"><head><title>샘플 기업 분석 — Report Mode</title><link rel="icon" href="data:,"></head><body><a class="report-home-button" href="../archive/">🏠 메인</a><nav><a class="brand" href="../archive/">RM · Report Mode</a></nav><h1>샘플 기업 분석</h1><footer>AIHUBOS ReportMode · RM 리포트 모드</footer></body></html>`;

  const output = applyReportHubBrand(source, "reports/260809-sample.html");

  assert.match(output, /<title>샘플 기업 분석 \| Report Hub<\/title>/);
  assert.match(output, new RegExp(`href="${REPORT_HUB_HOME}"`));
  assert.doesNotMatch(output, /class="report-hub-logo"/);
  assert.match(output, /class="report-hub-wordmark">Report Hub<\/span><span class="report-hub-byline">by Jeremy<\/span>/);
  assert.match(output, /report-hub-brand\.css\?v=20260809-rh4/);
  assert.match(output, /report-hub-brand\.js\?v=20260809-rh4/);
  assert.match(output, /report-page-layout\.css\?v=20260809-rh4/);
  assert.match(output, /report-page-layout\.js\?v=20260809-rh4/);
  assert.match(output, /report-comments\.css\?v=20260809-comments1/);
  assert.match(output, /report-comments\.js\?v=20260809-comments1" data-report-id="260809-sample"/);
  assert.match(output, /report-view-counter\.js\?v=20260809-counter-fallback2" data-report-id="260809-sample"/);
  assert.match(output, /report-history\.js\?v=20260809-history2/);
  assert.match(output, /data-report-id="260809-sample"/);
  assert.match(output, /<h1>샘플 기업 분석<\/h1>/);
  assert.match(output, /<body data-report-view="detail" data-report-layout="wide">/);
  assert.doesNotMatch(output, /Report Mode|ReportMode|리포트 모드|RM ·/);

  const secondPass = applyReportHubBrand(output, "reports/260809-sample.html");
  assert.equal(secondPass.match(/report-hub-brand\.css/g)?.length, 1);
  assert.equal(secondPass.match(/report-hub-brand\.js/g)?.length, 1);
  assert.equal(secondPass.match(/report-page-layout\.css/g)?.length, 1);
  assert.equal(secondPass.match(/report-page-layout\.js/g)?.length, 1);
  assert.equal(secondPass.match(/report-comments\.css/g)?.length, 1);
  assert.equal(secondPass.match(/report-comments\.js/g)?.length, 1);
  assert.equal(secondPass.match(/report-view-counter\.js/g)?.length, 1);
  assert.equal(secondPass.match(/report-history\.js/g)?.length, 1);
});

test("keeps redirect-only report pages byte-for-byte unchanged", () => {
  const redirect = '<!doctype html><meta http-equiv="refresh" content="0;url=https://example.com">';
  assert.equal(applyReportHubBrand(redirect, "reports/link-only.html"), redirect);
});

test("uses the correct asset depth for folder reports", () => {
  const source = "<!doctype html><html><head><title>폴더 보고서</title></head><body><h1>폴더 보고서</h1></body></html>";
  const output = applyReportHubBrand(source, "reports/folder-report/index.html");
  assert.match(output, /href="\.\.\/\.\.\/assets\/report-hub-brand\.css\?v=20260809-rh4"/);
  assert.match(output, /href="\.\.\/\.\.\/assets\/report-comments\.css\?v=20260809-comments1"/);
  assert.match(output, /src="\.\.\/\.\.\/assets\/report-page-layout\.js\?v=20260809-rh4"/);
  assert.match(output, /src="\.\.\/\.\.\/assets\/report-comments\.js\?v=20260809-comments1" data-report-id="folder-report"/);
  assert.match(output, /src="\.\.\/\.\.\/assets\/report-view-counter\.js\?v=20260809-counter-fallback2" data-report-id="folder-report"/);
  assert.match(output, /src="\.\.\/\.\.\/assets\/report-history\.js\?v=20260809-history2" data-report-id="folder-report"/);
});
