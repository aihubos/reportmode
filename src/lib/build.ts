import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "./config.js";
import { readText, writeText } from "./fs.js";
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
import {
  ManifestItemSchema,
  type ManifestItem,
  type ReportDocument,
} from "../schema/report.js";

function existingManifestItems(root: string): ManifestItem[] {
  const manifestPath = path.join(root, "reports", "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = JSON.parse(readText(manifestPath));
    if (!Array.isArray(raw?.reports)) return [];
    return raw.reports.flatMap((item: unknown) => {
      const parsed = ManifestItemSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function mergeManifestItems(
  existing: ManifestItem[],
  generated: ManifestItem[],
): ManifestItem[] {
  const itemsById = new Map(existing.map((item) => [item.id, item]));
  for (const item of generated) itemsById.set(item.id, item);
  return Array.from(itemsById.values())
    .filter((item) => item.status !== "draft" && item.status !== "publish_failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function writeArchiveArtifacts(
  root: string,
  items: ManifestItem[],
  siteBase: string,
) {
  const archivePath = path.join(root, "archive", "index.html");
  const manifestPath = path.join(root, "reports", "manifest.json");
  writeText(archivePath, renderHomeHtml(items, "../"));
  writeText(
    manifestPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        siteBase,
        reports: items,
      },
      null,
      2,
    ) + "\n",
  );
  return { archive: archivePath, manifest: manifestPath };
}

export function buildArchive() {
  const root = repoRoot();
  const config = loadConfig();
  const docs = listReportsNewestFirst().filter(
    (doc) => doc.status !== "draft" && doc.status !== "publish_failed",
  );
  const items = mergeManifestItems(
    existingManifestItems(root),
    docs.map(toManifestItem),
  );
  return {
    reportCount: items.length,
    ...writeArchiveArtifacts(root, items, config.siteBase),
  };
}

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
  const root = repoRoot();
  const items = mergeManifestItems(
    existingManifestItems(root),
    docs.map(toManifestItem),
  );

  for (const doc of docs) {
    buildReport(doc);
  }

  writeText(
    path.join(root, "index.html"),
    readText(path.join(root, "src", "site", "index.html")),
  );
  fs.cpSync(path.join(root, "src", "site", "assets"), path.join(root, "assets"), {
    recursive: true,
    force: true,
  });
  const archiveArtifacts = writeArchiveArtifacts(root, items, config.siteBase);

  for (const legacy of options?.legacyRedirects || []) {
    writeText(
      path.join(repoRoot(), "reports", legacy.from, "index.html"),
      renderRedirectHtml(`reports/${legacy.toId}/`, legacy.title),
    );
  }

  return {
    reportCount: docs.length,
    home: path.join(root, "index.html"),
    archive: archiveArtifacts.archive,
    manifest: archiveArtifacts.manifest,
    published: docs.filter((d) => reportPublicExists(d.id)).map((d) => d.id),
  };
}
