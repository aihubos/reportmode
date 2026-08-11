import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  inlineLocalAssets,
  lifecycleCompletionStatus,
  removeReportFromManifest,
  resolveReportPage,
} from "./report-lifecycle.mjs";

test("lifecycle inlines local image assets and keeps external URLs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "report-lifecycle-"));
  await fs.mkdir(path.join(root, "reports", "sample"), { recursive: true });
  await fs.writeFile(path.join(root, "reports", "sample", "cover.png"), Buffer.from([137, 80, 78, 71]));
  const html = '<!doctype html><html><body><a href="../archive/">도서관</a><img src="cover.png"><img src="https://example.com/remote.png"></body></html>';
  const result = await inlineLocalAssets(html, path.join(root, "reports", "sample", "index.html"), root);
  assert.match(result, /data:image\/png;base64/);
  assert.match(result, /https:\/\/example\.com\/remote\.png/);
  assert.match(result, /href="\.\.\/archive\/"/);
});

test("lifecycle resolves folder and single-file report pages", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "report-lifecycle-path-"));
  await fs.mkdir(path.join(root, "reports", "folder-report"), { recursive: true });
  await fs.writeFile(path.join(root, "reports", "folder-report", "index.html"), "<html></html>");
  await fs.writeFile(path.join(root, "reports", "single.html"), "<html></html>");
  assert.equal(await resolveReportPage(root, "reports/folder-report/"), path.join(root, "reports", "folder-report", "index.html"));
  assert.equal(await resolveReportPage(root, "reports/single.html"), path.join(root, "reports", "single.html"));
});

test("lifecycle removes one report from a manifest without touching other reports", () => {
  const manifest = { reports: [{ id: "remove-me" }, { id: "keep-me" }] };
  assert.deepEqual(removeReportFromManifest(manifest, "remove-me"), { reports: [{ id: "keep-me" }] });
});

test("lifecycle completion status reflects all item outcomes", () => {
  assert.equal(lifecycleCompletionStatus([{ status: "completed" }, { status: "completed" }]), "completed");
  assert.equal(lifecycleCompletionStatus([{ status: "completed" }, { status: "failed" }]), "partial");
  assert.equal(lifecycleCompletionStatus([{ status: "failed" }]), "failed");
});
