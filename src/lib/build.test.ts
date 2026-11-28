import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ManifestItem } from "../schema/report.js";
import { discoverCoverImage, isExternalLinkPage } from "./build.js";

test("archive thumbnail ignores the shared RH home logo", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-hub-cover-"));
  try {
    const reportDirectory = path.join(root, "reports", "sample");
    fs.mkdirSync(reportDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(reportDirectory, "index.html"),
      '<body><a class="report-home-button"><img class="report-hub-logo" src="../../assets/favicon.svg"></a><main><img src="assets/company-logo.png" alt="공식 회사 로고"></main></body>',
    );
    const item: ManifestItem = {
      id: "sample",
      slug: "sample",
      title: "샘플 보고서",
      category: "AI",
      summary: "샘플",
      createdAt: "2026-08-09T00:00:00+09:00",
      updatedAt: "2026-08-09T00:00:00+09:00",
      status: "published",
      path: "reports/sample/",
      url: "https://example.com/reports/sample/",
      displayDate: "260809",
      sourceCount: 0,
      tags: [],
    };

    const result = discoverCoverImage(root, item);
    assert.equal(result.coverImage, "reports/sample/assets/company-logo.png");
    assert.equal(result.coverAlt, "공식 회사 로고");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("cover alt keeps apostrophes inside a double-quoted attribute", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-hub-cover-quote-"));
  try {
    const reportDirectory = path.join(root, "reports", "quoted");
    fs.mkdirSync(reportDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(reportDirectory, "index.html"),
      `<body data-report-cover="assets/cover.jpg" data-report-cover-alt="분석좌 유튜브 영상 'AI 컨닝사태 이후, 한국에 벌어질 일들' 원본 썸네일"><img src="assets/cover.jpg" alt="분석좌 유튜브 영상 'AI 컨닝사태 이후, 한국에 벌어질 일들' 원본 썸네일"></body>`,
    );
    const item: ManifestItem = {
      id: "quoted",
      slug: "quoted",
      title: "따옴표 표지",
      category: "AI",
      summary: "표지",
      createdAt: "2026-11-28T10:30:00+09:00",
      updatedAt: "2026-11-28T10:30:00+09:00",
      status: "published",
      path: "reports/quoted/",
      url: "https://example.com/reports/quoted/",
      displayDate: "261128",
      sourceCount: 0,
      tags: [],
    };
    const result = discoverCoverImage(root, item);
    assert.equal(result.coverAlt, "분석좌 유튜브 영상 'AI 컨닝사태 이후, 한국에 벌어질 일들' 원본 썸네일");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("manifest marks redirect-only pages as external links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-hub-external-link-"));
  try {
    const reportDirectory = path.join(root, "reports", "external");
    fs.mkdirSync(reportDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(reportDirectory, "index.html"),
      '<meta http-equiv="refresh" content="0; url=https://example.com/">',
    );
    const item: ManifestItem = {
      id: "external",
      slug: "external",
      title: "외부 링크",
      category: "AI",
      summary: "외부 링크",
      createdAt: "2026-08-09T00:00:00+09:00",
      updatedAt: "2026-08-09T00:00:00+09:00",
      status: "published",
      path: "reports/external/",
      url: "https://example.com/reports/external/",
      displayDate: "260809",
      sourceCount: 0,
      tags: [],
    };
    assert.equal(isExternalLinkPage(root, item), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
