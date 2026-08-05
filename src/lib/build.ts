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
import { listUploadedReports, uploadedToManifest } from "../publisher/store.js";

function publicPagePath(root: string, itemPath: string): string {
  return path.join(root, itemPath.endsWith("/") ? `${itemPath}index.html` : itemPath);
}

function existingManifestItems(root: string): ManifestItem[] {
  const manifestPath = path.join(root, "reports", "manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  try {
    const raw = JSON.parse(readText(manifestPath));
    if (!Array.isArray(raw?.reports)) return [];
    return raw.reports.flatMap((item: unknown) => {
      const parsed = ManifestItemSchema.safeParse(item);
      return parsed.success && fs.existsSync(publicPagePath(root, parsed.data.path))
        ? [parsed.data]
        : [];
    });
  } catch {
    return [];
  }
}

function decodeArchiveText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function archiveDateIso(displayDate: string, order: number): string {
  const match = displayDate.match(/^(\d{2})(\d{2})(\d{2})$/);
  if (!match) return "2000-01-01T00:00:00+09:00";
  const second = String(Math.max(0, 59 - (order % 60))).padStart(2, "0");
  return `20${match[1]}-${match[2]}-${match[3]}T12:00:${second}+09:00`;
}

function existingArchiveItems(root: string, siteBase: string): ManifestItem[] {
  const archivePath = path.join(root, "archive", "index.html");
  if (!fs.existsSync(archivePath)) return [];
  const html = readText(archivePath);
  const items: ManifestItem[] = [];
  const pattern = /<article\b[^>]*class=["'][^"']*archive-post[^"']*["'][^>]*data-report-id=["']([^"']+)["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;
  let order = 0;
  while ((match = pattern.exec(html))) {
    const id = match[1];
    const body = match[2];
    if (!id || !body) continue;
    const href = body.match(/class=["'][^"']*archive-post-link[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const reportPath = href.replace(/^\.\.\//, "").replace(/^\//, "");
    if (!fs.existsSync(publicPagePath(root, reportPath))) continue;
    const heading = decodeArchiveText(body.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || id);
    const dateFromHeading = heading.match(/^(\d{6})\s*[·-]/)?.[1];
    const displayDate = dateFromHeading || id.match(/^(\d{6})/)?.[1] || "000000";
    const title = heading.replace(/^\d{6}\s*[·-]\s*/, "").trim() || id;
    const category = decodeArchiveText(
      body.match(/class=["'][^"']*archive-post-category[^"']*["'][^>]*>([\s\S]*?)<\//i)?.[1] || "기타",
    );
    const summary = decodeArchiveText(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || title);
    const sourceCount = Number(body.match(/출처\s+(\d+)개/)?.[1] || 0);
    const tagBlock = body.match(/class=["'][^"']*archive-tags[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || "";
    const tags = Array.from(tagBlock.matchAll(/<span\b[^>]*>#?([\s\S]*?)<\/span>/gi))
      .map((tag) => decodeArchiveText(tag[1] || "").replace(/^#/, ""))
      .filter(Boolean);
    const imageTag = body.match(/<img\b[^>]*>/i)?.[0] || "";
    const imageSource = imageTag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const imageAlt = imageTag.match(/\balt=["']([^"']*)["']/i)?.[1];
    const coverImage = imageSource
      ? /^(?:https?:|data:)/i.test(imageSource)
        ? imageSource
        : imageSource.replace(/^\.\.\//, "")
      : undefined;
    const createdAt = archiveDateIso(displayDate, order);
    order += 1;
    items.push({
      id,
      slug: id.replace(/^\d{6}-/, "") || id,
      title,
      category,
      summary,
      createdAt,
      updatedAt: createdAt,
      status: "published",
      path: reportPath,
      url: `${siteBase.replace(/\/$/, "")}/${reportPath}`,
      displayDate,
      sourceCount: Number.isFinite(sourceCount) ? sourceCount : 0,
      tags,
      coverImage,
      coverAlt: imageAlt || undefined,
    });
  }
  return items;
}

function mergeManifestItems(
  existing: ManifestItem[],
  generated: ManifestItem[],
): ManifestItem[] {
  const itemsById = new Map(existing.map((item) => [item.id, item]));
  for (const item of generated) {
    const previous = itemsById.get(item.id);
    itemsById.set(item.id, {
      ...previous,
      ...item,
      coverImage: item.coverImage || previous?.coverImage,
      coverAlt: item.coverAlt || previous?.coverAlt,
    });
  }
  return Array.from(itemsById.values())
    .filter((item) => item.status !== "draft" && item.status !== "publish_failed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function discoverCoverImage(root: string, item: ManifestItem): ManifestItem {
  if (item.coverImage) return item;
  const pagePath = item.path.endsWith("/")
    ? `${item.path}index.html`
    : item.path;
  const absolutePagePath = path.join(root, pagePath);
  if (!fs.existsSync(absolutePagePath)) return item;
  try {
    const html = readText(absolutePagePath);
    const imageTag = html.match(/<img\b[^>]*>/i)?.[0];
    if (!imageTag) return item;
    const source = imageTag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if (!source) return item;
    const alt = imageTag.match(/\balt=["']([^"']*)["']/i)?.[1];
    const coverImage = /^(?:https?:|data:)/i.test(source)
      ? source
      : path.posix.normalize(path.posix.join(path.posix.dirname(pagePath), source));
    return {
      ...item,
      coverImage,
      coverAlt: alt || `${item.title} 보고서 대표 이미지`,
    };
  } catch {
    return item;
  }
}

function enrichCoverImages(root: string, items: ManifestItem[]): ManifestItem[] {
  return items.map((item) => discoverCoverImage(root, item));
}

function mergedItems(root: string, siteBase: string, docs: ReportDocument[]): ManifestItem[] {
  const archiveItems = existingArchiveItems(root, siteBase);
  const manifestItems = existingManifestItems(root);
  const baseItems = mergeManifestItems(archiveItems, manifestItems);
  const generatedItems = [
    ...docs.map(toManifestItem),
    ...listUploadedReports(root).map(uploadedToManifest),
  ];
  return enrichCoverImages(root, mergeManifestItems(baseItems, generatedItems));
}

function syncUploadedPublicFiles(root: string) {
  for (const meta of listUploadedReports(root)) {
    const source = path.join(root, "content", "uploads", meta.id, "files");
    const destination = path.join(root, "reports", meta.id);
    if (!fs.existsSync(source)) continue;
    fs.rmSync(destination, { recursive: true, force: true });
    fs.cpSync(source, destination, { recursive: true, force: true });
  }
}

function reportBodySearchText(root: string, item: ManifestItem): string {
  const pagePath = item.path.endsWith("/")
    ? `${item.path}index.html`
    : item.path;
  const absolutePagePath = path.join(root, pagePath);
  if (!fs.existsSync(absolutePagePath)) return "";
  try {
    return readText(absolutePagePath)
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&(?:[a-z]+|#\d+|#x[\da-f]+);/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function reportSearchTextById(
  root: string,
  items: ManifestItem[],
): Record<string, string> {
  return Object.fromEntries(
    items.map((item) => [item.id, reportBodySearchText(root, item)]),
  );
}

function fallbackViewCounts(root: string): Record<string, number> {
  const fallbackPath = path.join(root, "reports", "view-counts.json");
  if (!fs.existsSync(fallbackPath)) return {};
  try {
    const raw = JSON.parse(readText(fallbackPath));
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    return Object.fromEntries(
      Object.entries(raw).flatMap(([id, value]) => {
        const count = Number(value);
        return Number.isFinite(count) && count >= 0
          ? [[id, Math.trunc(count)]]
          : [];
      }),
    );
  } catch {
    return {};
  }
}

function writeArchiveArtifacts(
  root: string,
  items: ManifestItem[],
  siteBase: string,
) {
  const archivePath = path.join(root, "archive", "index.html");
  const manifestPath = path.join(root, "reports", "manifest.json");
  writeText(
    archivePath,
    renderHomeHtml(
      items,
      "../",
      reportSearchTextById(root, items),
      fallbackViewCounts(root),
    ),
  );
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
  const items = mergedItems(root, config.siteBase, docs);
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

  for (const doc of docs) {
    buildReport(doc);
  }
  syncUploadedPublicFiles(root);
  const items = mergedItems(root, config.siteBase, docs);

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
