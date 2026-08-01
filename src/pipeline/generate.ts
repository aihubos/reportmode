import type { GenerateRequest, ReportDocument } from "../schema/report.js";
import { GenerateRequestSchema } from "../schema/report.js";
import { collectFiles, collectUrls } from "../lib/sources.js";
import { getProvider } from "../providers/index.js";
import { normalizeDocument } from "./normalize.js";
import { saveReport, loadReport } from "../lib/store.js";
import { buildSite } from "../lib/build.js";
import { publishReport } from "./publish.js";
import { writeText } from "../lib/fs.js";
import { runtimeDir } from "../lib/paths.js";
import { nowIsoKst } from "../lib/time.js";

export type PipelineResult = {
  document: ReportDocument;
  publicUrl?: string;
  commitSha?: string;
  pagesStatus?: string;
  published: boolean;
  draft: boolean;
};

export async function runGenerate(
  input: GenerateRequest,
  options?: { preserveId?: string; preserveCreatedAt?: string },
): Promise<PipelineResult> {
  const request = GenerateRequestSchema.parse(input);
  const sources = request.urls.length ? await collectUrls(request.urls) : [];
  const fileNotes = request.files.length ? collectFiles(request.files) : "";

  writeText(
    runtimeDir("logs", `${Date.now()}-request.json`),
    JSON.stringify({ request, collectedSourceCount: sources.length }, null, 2),
  );

  const provider = getProvider(request.provider);
  const draft = await provider.generate({
    request,
    sources,
    fileNotes,
    model: request.model,
  });

  const document = normalizeDocument({
    draft,
    request,
    sources,
    preserveId: options?.preserveId,
    preserveCreatedAt: options?.preserveCreatedAt,
  });

  saveReport(document);
  buildSite({
    legacyRedirects: [
      {
        from: "apple-foldable-iphone",
        toId: "260802-apple-foldable-iphone",
        title: "Apple 폴더블 iPhone",
      },
    ],
  });

  if (request.draft) {
    document.status = "draft";
    saveReport(document);
    return { document, published: false, draft: true };
  }

  try {
    const pub = await publishReport(document.id);
    const updated = loadReport(document.id);
    return {
      document: updated,
      publicUrl: pub.publicUrl,
      commitSha: pub.commitSha,
      pagesStatus: pub.pagesStatus,
      published: true,
      draft: false,
    };
  } catch (err) {
    const failed = loadReport(document.id);
    failed.status = "publish_failed";
    failed.updatedAt = nowIsoKst();
    saveReport(failed);
    writeText(
      runtimeDir("logs", `${document.id}-publish-error.json`),
      JSON.stringify(
        { at: nowIsoKst(), error: (err as Error).message },
        null,
        2,
      ),
    );
    throw err;
  }
}

export async function runImport(
  document: ReportDocument,
  options?: { draft?: boolean; preserveId?: string; preserveCreatedAt?: string },
): Promise<PipelineResult> {
  return runGenerate(
    {
      topic: document.title,
      purpose: "imported report",
      audience: "경영진",
      language: document.language || "ko",
      category: document.category,
      urls: [],
      files: [],
      notes: "",
      provider: "agent",
      draft: options?.draft ?? false,
      document,
    },
    {
      preserveId: options?.preserveId,
      preserveCreatedAt: options?.preserveCreatedAt,
    },
  );
}

