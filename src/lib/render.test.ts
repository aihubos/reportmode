import assert from "node:assert/strict";
import test from "node:test";
import { renderHomeHtml, renderReportHtml } from "./render.js";

test("renders a structured report table with column headers and cells", () => {
  const html = renderReportHtml({
    schemaVersion: "1",
    id: "table-test",
    slug: "table-test",
    title: "표 렌더링",
    subtitle: "",
    category: "테스트",
    language: "ko",
    author: "Test",
    createdAt: "2026-08-07T00:00:00+09:00",
    updatedAt: "2026-08-07T00:00:00+09:00",
    status: "draft",
    summary: "요약",
    verdict: "판단",
    metrics: [],
    sections: [
      {
        id: "pricing",
        heading: "요금제 비교",
        kind: "fact",
        body: "동일 기준 비교",
        bullets: [],
        sourceIds: ["s1"],
        table: {
          columns: ["요금제", "월 비용"],
          rows: [["Plus", "$20"]],
        },
      },
    ],
    pros: [],
    cons: [],
    decisions: [],
    timeline: [],
    quotes: [],
    sources: [
      {
        id: "s1",
        kind: "web",
        title: "공식 가격표",
        publisher: "OpenAI",
        url: "https://openai.com/",
        accessedAt: "2026-08-07T00:00:00+09:00",
      },
    ],
    tags: [],
  } as any);

  assert.match(html, /<table class="report-table">/);
  assert.match(html, /<th scope="col">요금제<\/th>/);
  assert.match(html, /<td>\$20<\/td>/);
  assert.match(html, /report-page-layout\.css\?v=20260809-rh3/);
  assert.match(html, /report-page-layout\.js\?v=20260809-rh3/);
  assert.match(html, /report-comments\.css\?v=20260809-comments1/);
  assert.match(html, /report-comments\.js\?v=20260809-comments1" data-report-id="table-test"/);
  assert.match(html, /report-history\.js\?v=20260809-history2/);
  assert.match(html, /id="report-home-button"|class="report-home-button"/);
  assert.match(html, /href="https:\/\/aireport\.ai-hub-os\.com\/"/);
  assert.match(html, /Report Hub/);
  assert.doesNotMatch(html, /class="report-hub-logo"/);
  assert.doesNotMatch(html, /Report Mode/);
});

test("renders the simplified archive with one Naver card and a 30-item default selector", () => {
  const items = Array.from({ length: 31 }, (_, index) => ({
    id: `sample-${index + 1}`,
    path: `reports/sample-${index + 1}.html`,
    title: `샘플 보고서 ${index + 1}`,
    subtitle: "",
    summary: "샘플 요약",
    category: "AI",
    tags: [],
    displayDate: "260809",
    sourceCount: 1,
  })) as any;
  const html = renderHomeHtml(items);

  assert.doesNotMatch(html, /class="archive-profile"/);
  assert.doesNotMatch(html, /원자료를 조사하고 사실과 해석을 나눠 기록하는/);
  assert.doesNotMatch(html, /읽고 판단하기 좋은/);
  assert.equal(html.match(/https:\/\/blog\.naver\.com\/jeremylee0213/g)?.length, 1);
  assert.match(html, /class="archive-blog-card"/);
  assert.match(html, /id="archiveVisitorCount"/);
  assert.match(html, /archive-visitor-counter\.js\?v=20260809-visits1/);
  assert.match(html, /id="archivePageSize"/);
  assert.match(html, /<option value="5">5개<\/option>/);
  assert.match(html, /<option value="10">10개<\/option>/);
  assert.match(html, /<option value="20">20개<\/option>/);
  assert.match(html, /<option value="30" selected>30개<\/option>/);
  assert.match(html, /var DEFAULT_PAGE_SIZE = 30/);
  assert.match(html, /state\.pageSize/);
});
