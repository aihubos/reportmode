import assert from "node:assert/strict";
import test from "node:test";
import { publicIdFromReportPath } from "./report-view-id-qa.mjs";

test("uses the same public ID rules as report pages", () => {
  assert.equal(publicIdFromReportPath("reports/example/index.html"), "example");
  assert.equal(publicIdFromReportPath("reports/example/"), "example");
  assert.equal(publicIdFromReportPath("reports/example.html"), "example");
  assert.equal(publicIdFromReportPath("reports/drafts/example/index.html"), "example");
});
