import path from "node:path";
import {
  ReportDocument,
  ReportDocumentSchema,
  ManifestItem,
} from "../schema/report.js";
import { loadConfig } from "./config.js";
import { exists, listDirs, readText, writeText } from "./fs.js";
import {
  contentReportPath,
  publicReportPath,
  repoRoot,
} from "./paths.js";
import { displayDateFromIso } from "./time.js";

export function listReportIds(): string[] {
  return listDirs(path.join(repoRoot(), "content", "reports"));
}

export function loadReport(id: string): ReportDocument {
  const file = contentReportPath(id);
  if (!exists(file)) throw new Error(`보고서가 없습니다: ${id}`);
  const raw = JSON.parse(readText(file));
  return ReportDocumentSchema.parse(raw);
}

export function saveReport(doc: ReportDocument): void {
  const parsed = ReportDocumentSchema.parse(doc);
  writeText(contentReportPath(parsed.id), JSON.stringify(parsed, null, 2) + "\n");
}

export function toManifestItem(doc: ReportDocument): ManifestItem {
  const config = loadConfig();
  const pathRel = `reports/${doc.id}/`;
  return {
    id: doc.id,
    slug: doc.slug,
    title: doc.title,
    subtitle: doc.subtitle,
    category: doc.category,
    summary: doc.summary,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    status: doc.status,
    path: pathRel,
    url: `${config.siteBase.replace(/\/$/, "")}/${pathRel}`,
    displayDate: displayDateFromIso(doc.createdAt),
    sourceCount: doc.sources.length,
    tags: doc.tags ?? [],
  };
}

export function listReportsNewestFirst(): ReportDocument[] {
  return listReportIds()
    .map((id) => loadReport(id))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function reportPublicExists(id: string): boolean {
  return exists(publicReportPath(id));
}

