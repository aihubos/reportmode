import assert from "node:assert/strict";
import test from "node:test";

import { applyReportHubBrand, REPORT_HUB_HOME } from "./public-brand.js";

test("applies the Report Hub brand without changing the report subject", () => {
  const source = `<!doctype html><html lang="ko"><head><title>샘플 기업 분석 — Report Mode</title><link rel="icon" href="data:,"></head><body><a class="report-home-button" href="../archive/">🏠 메인</a><nav><a class="brand" href="../archive/">RM · Report Mode</a></nav><h1>샘플 기업 분석</h1><footer>AIHUBOS ReportMode · RM 리포트 모드</footer></body></html>`;

  const output = applyReportHubBrand(source, "reports/260809-sample.html");

  assert.match(output, /<title>샘플 기업 분석 \| Report Hub<\/title>/);
  assert.match(output, new RegExp(`href="${REPORT_HUB_HOME}"`));
  assert.match(output, /class="report-hub-logo"[^>]*favicon\.svg\?v=20260809-rh1/);
  assert.match(output, />Report Hub<\/span><\/a>/);
  assert.match(output, /report-hub-brand\.css\?v=20260809-rh1/);
  assert.match(output, /report-hub-brand\.js\?v=20260809-rh1/);
  assert.match(output, /<h1>샘플 기업 분석<\/h1>/);
  assert.doesNotMatch(output, /Report Mode|ReportMode|리포트 모드|RM ·/);
});

test("keeps redirect-only report pages byte-for-byte unchanged", () => {
  const redirect = '<!doctype html><meta http-equiv="refresh" content="0;url=https://example.com">';
  assert.equal(applyReportHubBrand(redirect, "reports/link-only.html"), redirect);
});

test("uses the correct asset depth for folder reports", () => {
  const source = "<!doctype html><html><head><title>폴더 보고서</title></head><body><h1>폴더 보고서</h1></body></html>";
  const output = applyReportHubBrand(source, "reports/folder-report/index.html");
  assert.match(output, /href="\.\.\/\.\.\/assets\/report-hub-brand\.css\?v=20260809-rh1"/);
});
