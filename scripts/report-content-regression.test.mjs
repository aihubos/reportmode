import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function read(relativePath) {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("GPT-5.6 reports use the reverified official Terra and Luna prices", () => {
  const guide = read("reports/260802-gpt-5-6-sol-terra-luna-guide.html");
  const comparison = read("reports/260803-deepseek-v4-flash-comparison.html");
  const pricing = read("reports/260807-chatgpt-codex-pricing-api-comparison-02/index.html");

  assert.match(guide, /Terra \$2\.50\/\$15, Luna \$1\/\$6/);
  assert.doesNotMatch(guide, /2026년 7월 30일 Terra·Luna 가격이 인하됐습니다/);
  assert.match(comparison, /GPT-5\.6 Luna<\/td><td>\$1\.00 \/ \$6\.00/);
  assert.match(comparison, /GPT-5\.6 Terra<\/td><td>\$2\.50 \/ \$15\.00/);
  assert.match(comparison, /GPT-5\.6 Luna<\/td><td>7\.1×<\/td><td>21\.4×/);
  assert.match(pricing, /terra: \{ label: 'GPT-5\.6 Terra', input: 2\.5, output: 15/);
  assert.match(pricing, /luna: \{ label: 'GPT-5\.6 Luna', input: 1, output: 6/);
  assert.doesNotMatch(pricing, /GPT-5\.6 Terra<\/small><strong>\$2 \/ \$12/);
});

test("Tesla reports separate current Korean specifications from older regional data", () => {
  const deepDive = read("reports/260802-tesla-model-y-l-deep-dive.html");
  const decision = read("reports/260803-tesla-model-y-l-delivery-decision.html");

  assert.match(deepDive, /2026년 8월 9일 현재 한국 판매는 공식 확인됐습니다/);
  assert.match(deepDive, /https:\/\/www\.tesla\.com\/ko_kr\/modely/);
  assert.doesNotMatch(deepDive, /한국 출시는 여전히 미확정입니다/);
  assert.match(decision, /543km MCT/);
  assert.match(decision, /전장 4,970mm/);
  assert.doesNotMatch(decision, /전장 4,976mm/);
});

test("Palantir report carries the refreshed market snapshot and working SEC source", () => {
  const report = read("reports/260806-palantir-business-ai-analysis/index.html");
  assert.match(report, /\$172\.01/);
  assert.match(report, /\$441\.8B/);
  assert.match(report, /pltr-20260331\.htm/);
  assert.doesNotMatch(report, /kiplinger\.com/);
});

test("root page redirects to the report archive and contains no skill builder", () => {
  for (const file of ["index.html", "src/site/index.html"]) {
    const html = read(file);
    assert.match(html, /http-equiv="refresh" content="0; url=archive\/"/);
    assert.match(html, /window\.location\.replace\("archive\/"\)/);
    assert.doesNotMatch(html, /Skill Builder|스킬 만들기/);
  }
});
