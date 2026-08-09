#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REVIEW_FILE = "docs/report-refresh/2026-08-09-content-review.json";
const REVIEW_MARKDOWN = "docs/report-refresh/2026-08-09-content-review.md";
const VERSION_MANIFEST = "versions/manifest.json";
const VERDICTS = new Set(["corrected", "verified", "historical"]);

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function markdownCell(value) {
  return String(value || "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

function reviewMarkdown(document, records, counts) {
  const lines = [
    "# Report Hub 내용 검토 결과",
    "",
    `- 검토일: ${document.reviewedAt}`,
    `- 전체: ${counts.total}`,
    `- 사실·계산 수정: ${counts.corrected}`,
    `- 출처·시점 재검증: ${counts.verified}`,
    `- 과거판 보존: ${counts.historical}`,
    "",
    "| 보고서 | 판정 | 검토 요약 | 반영 내용 | 계속 확인할 항목 |",
    "|---|---|---|---|---|",
    ...records.map((record) => {
      const review = record.contentReview;
      return `| ${markdownCell(record.title)} | ${markdownCell(review.label)} | ${markdownCell(review.summary)} | ${markdownCell(review.changes.join(" / "))} | ${markdownCell(review.watchItems.join(" / "))} |`;
    }),
    "",
    "## 검토 원칙",
    "",
    ...(document.methodology || []).map((item) => `- ${item}`),
    "",
  ];
  return lines.join("\n");
}

function validateReview(id, review) {
  if (!review) throw new Error(`검토 기록 누락: ${id}`);
  if (!VERDICTS.has(review.verdict)) throw new Error(`알 수 없는 검토 판정: ${id} (${review.verdict})`);
  if (!review.label || !review.summary) throw new Error(`검토 설명 누락: ${id}`);
  if (!Array.isArray(review.changes) || !Array.isArray(review.watchItems)) {
    throw new Error(`검토 목록 형식 오류: ${id}`);
  }
}

export function applyContentReviews({ root }) {
  const absoluteRoot = path.resolve(root);
  const reviewPath = path.join(absoluteRoot, REVIEW_FILE);
  const manifestPath = path.join(absoluteRoot, VERSION_MANIFEST);
  const reviewDocument = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const reviews = reviewDocument.reports || {};
  const manifestIds = new Set((manifest.reports || []).map((record) => record.id));

  for (const id of Object.keys(reviews)) {
    if (!manifestIds.has(id)) throw new Error(`대상 없는 검토 기록: ${id}`);
  }

  const records = (manifest.reports || []).map((record) => {
    const review = reviews[record.id];
    validateReview(record.id, review);
    return {
      ...record,
      changeSummary: review.summary,
      contentReview: {
        reviewedAt: reviewDocument.reviewedAt,
        verdict: review.verdict,
        label: review.label,
        summary: review.summary,
        changes: review.changes,
        watchItems: review.watchItems,
        sourceBasis: review.sourceBasis || "보고서 원문 출처와 공개 링크 재검증",
      },
    };
  });

  const counts = {
    total: records.length,
    corrected: records.filter((record) => record.contentReview.verdict === "corrected").length,
    verified: records.filter((record) => record.contentReview.verdict === "verified").length,
    historical: records.filter((record) => record.contentReview.verdict === "historical").length,
  };
  writeJson(manifestPath, { ...manifest, contentReview: { reviewedAt: reviewDocument.reviewedAt, counts }, reports: records });
  fs.writeFileSync(path.join(absoluteRoot, REVIEW_MARKDOWN), reviewMarkdown(reviewDocument, records, counts));
  return { counts, reports: records };
}

function main() {
  const result = applyContentReviews({ root: process.cwd() });
  process.stdout.write(`${JSON.stringify(result.counts, null, 2)}\n`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(currentFile).href) main();
