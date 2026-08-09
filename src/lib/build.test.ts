import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ManifestItem } from "../schema/report.js";
import { discoverCoverImage } from "./build.js";

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
