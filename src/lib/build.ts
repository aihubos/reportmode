import path from "node:path";
import { loadConfig } from "./config.js";
import { writeText } from "./fs.js";
import {
  listReportsNewestFirst,
  reportPublicExists,
  toManifestItem,
} from "./store.js";
import {
  renderHomeHtml,
  renderRedirectHtml,
  renderReportHtml,
} from "./render.js";
import { publicReportPath, repoRoot } from "./paths.js";
import { runtimeDir } from "./paths.js";
import type { ReportDocument } from "../schema/report.js";

export function buildReport(doc: ReportDocument): string {
  const html = renderReportHtml(doc);
  writeText(publicReportPath(doc.id), html);
  return publicReportPath(doc.id);
}

export function buildDraftPreview(doc: ReportDocument): string {
  const previewPath = path.join(runtimeDir("previews"), doc.id, "index.html");
  writeText(previewPath, renderReportHtml(doc));
  return previewPath;
}

export function buildSite(options?: {
  legacyRedirects?: Array<{ from: string; toId: string; title: string }>;
}) {
  const docs = listReportsNewestFirst().filter(
    (doc) => doc.status !== "draft" && doc.status !== "publish_failed",
  );
  const config = loadConfig();
  const items = docs.map(toManifestItem);

  for (const doc of docs) {
    buildReport(doc);
  }

  writeText(path.join(repoRoot(), "index.html"), renderHomeHtml(items));
  writeText(
    path.join(repoRoot(), "reports", "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        siteBase: config.siteBase,
        reports: items,
      },
      null,
      2,
    ) + "\n",
  );

  for (const legacy of options?.legacyRedirects || []) {
    writeText(
      path.join(repoRoot(), "reports", legacy.from, "index.html"),
      renderRedirectHtml(`reports/${legacy.toId}/`, legacy.title),
    );
  }

  return {
    reportCount: docs.length,
    home: path.join(repoRoot(), "index.html"),
    manifest: path.join(repoRoot(), "reports", "manifest.json"),
    published: docs.filter((d) => reportPublicExists(d.id)).map((d) => d.id),
  };
}
