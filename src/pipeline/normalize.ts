import type { GenerateRequest, ReportDocument } from "../schema/report.js";
import { ReportDocumentSchema } from "../schema/report.js";
import type { CollectedSource } from "../lib/sources.js";
import { loadConfig } from "../lib/config.js";
import { listReportIds } from "../lib/store.js";
import { makeReportId, slugify } from "../lib/slug.js";
import { nowIsoKst, yymmdd } from "../lib/time.js";

export function normalizeDocument(args: {
  draft: ReportDocument;
  request: GenerateRequest;
  sources: CollectedSource[];
  preserveId?: string;
  preserveCreatedAt?: string;
}): ReportDocument {
  const config = loadConfig();
  const now = nowIsoKst();
  const existing = listReportIds();
  const slugBase = slugify(args.draft.slug || args.draft.title || args.request.topic);
  const dateCode = yymmdd();
  const id =
    args.preserveId ||
    makeReportId(
      dateCode,
      slugBase,
      existing.filter((x) => x !== args.preserveId),
    );

  const sources =
    args.sources.length > 0
      ? args.sources.map((s) => ({
          id: s.id,
          title: s.title,
          publisher: s.publisher,
          url: s.url,
          accessedAt: s.accessedAt,
          note: s.note,
        }))
      : args.draft.sources;

  if (!sources?.length) {
    throw new Error("출처가 비어 있습니다. URL 또는 sources가 필요합니다.");
  }

  const doc: ReportDocument = {
    ...args.draft,
    schemaVersion: "1",
    id,
    slug: slugBase,
    title: args.draft.title || args.request.topic,
    subtitle: args.draft.subtitle || "",
    category: args.draft.category || args.request.category || "General",
    language: args.request.language || args.draft.language || config.language,
    author: args.request.author || args.draft.author || config.author,
    createdAt: args.preserveCreatedAt || args.draft.createdAt || now,
    updatedAt: now,
    status: args.request.draft ? "draft" : "generated",
    summary: args.draft.summary,
    verdict: args.draft.verdict,
    sources,
    provider: args.request.provider,
    model: args.request.model,
  };

  return ReportDocumentSchema.parse(doc);
}

