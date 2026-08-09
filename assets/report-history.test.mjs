import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

test("history widget renders current and directly linked previous versions", () => {
  const source = fs.readFileSync(new URL("./report-history.js", import.meta.url), "utf8");
  const context = { console, URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);

  const api = context.ReportModeHistory;
  assert.ok(api);
  const markup = api.buildMarkup({
    id: "sample",
    title: "제목 <보존>",
    currentVersion: "v1.1.0",
    updatedAt: "2026-08-09",
    status: "content-refreshed",
    changeSummary: "내용과 출처 재검증",
    contentReview: {
      verdict: "corrected",
      label: "수정 완료",
      summary: "공식 가격과 계산식을 바로잡았습니다.",
      changes: ["Terra·Luna 공식 단가 반영", "비용 예시 재계산"],
      watchItems: ["API 가격은 결제 전 재확인"],
    },
    previousVersion: {
      version: "v1.0.0",
      date: "2026-08-09",
      label: "내용 최신화 전 기준판",
      url: "/reportmode/versions/2026-08-09-before-refresh/reports/sample/",
    },
  });

  assert.match(markup, /v1\.1\.0/);
  assert.match(markup, /내용과 출처 재검증/);
  assert.match(markup, /내용 검토 결과/);
  assert.match(markup, /수정 완료/);
  assert.match(markup, /공식 가격과 계산식을 바로잡았습니다/);
  assert.match(markup, /Terra·Luna 공식 단가 반영/);
  assert.match(markup, /API 가격은 결제 전 재확인/);
  assert.match(markup, /이전 보고서 보기/);
  assert.match(markup, /\/reportmode\/versions\/2026-08-09-before-refresh\/reports\/sample\//);
  assert.doesNotMatch(markup, /제목 <보존>/);
  assert.match(markup, /제목 &lt;보존&gt;/);
});

test("history widget can derive a previous URL if the manifest request fails", () => {
  const source = fs.readFileSync(new URL("./report-history.js", import.meta.url), "utf8");
  const context = { console, URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  assert.equal(
    context.ReportModeHistory.fallbackPreviousUrl(
      "/reportmode/reports/sample/index.html",
      "2026-08-09-before-refresh",
    ),
    "/reportmode/versions/2026-08-09-before-refresh/reports/sample/index.html",
  );
});

test("history widget ignores footers nested inside summary slides", () => {
  const source = fs.readFileSync(new URL("./report-history.js", import.meta.url), "utf8");
  const context = { console, URL };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  const pageFooter = { id: "page-footer" };
  const doc = {
    querySelectorAll(selector) {
      assert.equal(selector, "body > footer");
      return [pageFooter];
    },
  };
  assert.equal(context.ReportModeHistory.findPageFooter(doc), pageFooter);
});
