import assert from "node:assert/strict";
import test from "node:test";
import { renderReportHtml } from "./render.js";

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
});
