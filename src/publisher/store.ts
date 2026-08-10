import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { loadConfig } from "../lib/config.js";
import { ensureDir, readText, writeText } from "../lib/fs.js";
import { repoRoot, runtimeDir } from "../lib/paths.js";
import { displayDateFromIso, nowIsoKst, yymmdd } from "../lib/time.js";
import { sanitizeTags } from "../lib/tags.js";
import type { ManifestItem } from "../schema/report.js";
import {
  UploadedReportMetaSchema,
  UploadedReportRegistrySchema,
  type UploadedReportMeta,
  type UploadedReportRegistry,
} from "./schema.js";

const MAX_UPLOAD_BYTES = 45 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 150 * 1024 * 1024;
const MAX_ARCHIVE_FILES = 600;
const MAX_SINGLE_FILE_BYTES = 90 * 1024 * 1024;

export type PreparedUpload = {
  meta: UploadedReportMeta;
  files: Map<string, Uint8Array>;
};

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function plainText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function htmlTitle(html: string): string {
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  return plainText(title || heading || "").slice(0, 160);
}

function htmlSummary(html: string): string {
  const description = html.match(
    /<meta\b[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i,
  )?.[1] || html.match(
    /<meta\b[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i,
  )?.[1];
  const paragraph = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1];
  return plainText(description || paragraph || html).slice(0, 500);
}

function htmlSourceCount(html: string): number {
  const urls = new Set<string>();
  for (const match of html.matchAll(/\bhref=["'](https?:\/\/[^"']+)["']/gi)) {
    if (match[1]) urls.add(match[1]);
  }
  return urls.size;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "uploaded-report";
}

function normalizeArchivePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((part) => part === "..")
  ) {
    throw new Error(`ZIP 안에 허용되지 않는 경로가 있습니다: ${value}`);
  }
  return normalized;
}

function shouldIgnoreArchivePath(value: string): boolean {
  const parts = value.split("/");
  return (
    value.endsWith("/") ||
    parts.includes("__MACOSX") ||
    parts.includes(".git") ||
    parts.includes("node_modules") ||
    parts.some((part) => part === ".DS_Store" || part.startsWith("._")) ||
    parts.some((part) => /^\.env(?:\.|$)/i.test(part))
  );
}

function extractZip(bytes: Uint8Array): Map<string, Uint8Array> {
  const archive = unzipSync(bytes);
  const entries = Object.entries(archive)
    .map(([name, data]) => [normalizeArchivePath(name), data] as const)
    .filter(([name]) => !shouldIgnoreArchivePath(name));

  if (entries.length === 0) throw new Error("ZIP 안에 게시할 파일이 없습니다.");
  if (entries.length > MAX_ARCHIVE_FILES) {
    throw new Error(`ZIP 파일 수는 ${MAX_ARCHIVE_FILES}개 이하여야 합니다.`);
  }
  let totalBytes = 0;
  for (const [, data] of entries) {
    totalBytes += data.byteLength;
    if (data.byteLength > MAX_SINGLE_FILE_BYTES) {
      throw new Error("ZIP 안의 단일 파일은 90MB 이하여야 합니다.");
    }
  }
  if (totalBytes > MAX_EXTRACTED_BYTES) {
    throw new Error("ZIP 압축 해제 크기는 150MB 이하여야 합니다.");
  }

  const indexCandidates = entries
    .map(([name]) => name)
    .filter((name) => /(^|\/)index\.html?$/i.test(name))
    .sort((a, b) => a.split("/").length - b.split("/").length);
  const htmlCandidates = entries
    .map(([name]) => name)
    .filter((name) => /\.html?$/i.test(name));
  const entryName = indexCandidates[0] ||
    (htmlCandidates.length === 1 ? htmlCandidates[0] : undefined);
  if (!entryName) {
    throw new Error("ZIP에는 index.html 또는 하나의 HTML 파일이 필요합니다.");
  }

  const rootPrefix = entryName.includes("/")
    ? entryName.slice(0, entryName.lastIndexOf("/") + 1)
    : "";
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of entries) {
    if (rootPrefix && !name.startsWith(rootPrefix)) continue;
    const relative = rootPrefix ? name.slice(rootPrefix.length) : name;
    if (!relative) continue;
    files.set(relative === entryName.slice(rootPrefix.length) ? "index.html" : relative, data);
  }
  if (!files.has("index.html")) {
    throw new Error("ZIP의 시작 HTML을 찾지 못했습니다.");
  }
  return files;
}

function decodeBase64(value: string): Uint8Array {
  const buffer = Buffer.from(value, "base64");
  if (buffer.byteLength === 0) throw new Error("업로드 파일이 비어 있습니다.");
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("업로드 파일은 45MB 이하여야 합니다.");
  }
  return new Uint8Array(buffer);
}

function existingIds(): Set<string> {
  const ids = new Set<string>();
  for (const base of [
    path.join(repoRoot(), "reports"),
    path.join(repoRoot(), "content", "uploads"),
    runtimeDir("publisher"),
  ]) {
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) ids.add(entry.name);
      if (entry.isFile() && entry.name.endsWith(".html")) {
        ids.add(entry.name.replace(/\.html$/, ""));
      }
    }
  }
  return ids;
}

function nextId(slug: string): string {
  const base = `${yymmdd()}-${slug}`;
  const ids = existingIds();
  if (!ids.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${String(index).padStart(2, "0")}`;
    if (!ids.has(candidate)) return candidate;
  }
  throw new Error("같은 이름의 보고서가 너무 많습니다. 제목을 바꿔주세요.");
}

function cleanTags(value: unknown): string[] {
  return sanitizeTags(value);
}

export function prepareUpload(body: Record<string, unknown>): PreparedUpload {
  const sourceName = String(body.fileName || "").trim();
  const encoded = String(body.dataBase64 || "");
  if (!/\.(?:html?|zip)$/i.test(sourceName)) {
    throw new Error("HTML 또는 ZIP 파일만 업로드할 수 있습니다.");
  }
  const bytes = decodeBase64(encoded);
  const files = /\.zip$/i.test(sourceName)
    ? extractZip(bytes)
    : new Map([["index.html", bytes]]);
  const htmlBytes = files.get("index.html");
  if (!htmlBytes) throw new Error("시작 HTML이 없습니다.");
  const html = new TextDecoder("utf-8", { fatal: false }).decode(htmlBytes);
  if (!/<html\b|<!doctype\s+html/i.test(html)) {
    throw new Error("유효한 HTML 문서를 찾지 못했습니다.");
  }

  const fallbackTitle = htmlTitle(html) || sourceName.replace(/\.(?:html?|zip)$/i, "");
  const title = String(body.title || fallbackTitle).trim().slice(0, 160);
  if (!title) throw new Error("보고서 제목을 입력해주세요.");
  const slug = slugify(String(body.slug || fallbackTitle || sourceName));
  const id = nextId(slug);
  const now = nowIsoKst();
  const summary = String(body.summary || htmlSummary(html) || `${title} 업로드 보고서`)
    .trim()
    .slice(0, 500);
  const sourceCountText = String(body.sourceCount ?? "").trim();
  const requestedSourceCount = sourceCountText ? Number(sourceCountText) : Number.NaN;
  const sourceCount = Number.isFinite(requestedSourceCount) && requestedSourceCount >= 0
    ? Math.trunc(requestedSourceCount)
    : htmlSourceCount(html);
  const meta = UploadedReportMetaSchema.parse({
    schemaVersion: "1",
    id,
    slug,
    title,
    category: String(body.category || "기타").trim() || "기타",
    tags: cleanTags(body.tags),
    summary,
    createdAt: now,
    updatedAt: now,
    status: "published",
    sourceName,
    sourceCount,
    entry: "index.html",
  });
  return { meta, files };
}

export function saveRuntimeUpload(prepared: PreparedUpload): string {
  const target = runtimeDir("publisher", prepared.meta.id);
  fs.rmSync(target, { recursive: true, force: true });
  ensureDir(path.join(target, "files"));
  writeText(path.join(target, "meta.json"), JSON.stringify(prepared.meta, null, 2) + "\n");
  for (const [relative, data] of prepared.files) {
    const output = path.resolve(target, "files", relative);
    const filesRoot = path.resolve(target, "files");
    if (output !== filesRoot && !output.startsWith(filesRoot + path.sep)) {
      throw new Error("업로드 파일 경로가 허용 범위를 벗어났습니다.");
    }
    ensureDir(path.dirname(output));
    fs.writeFileSync(output, data);
  }
  return target;
}

export function loadRuntimeUpload(id: string): PreparedUpload {
  if (!/^\d{6}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error("잘못된 보고서 ID입니다.");
  }
  const target = runtimeDir("publisher", id);
  const meta = UploadedReportMetaSchema.parse(
    JSON.parse(readText(path.join(target, "meta.json"))),
  );
  const files = new Map<string, Uint8Array>();
  const root = path.join(target, "files");
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else files.set(path.relative(root, absolute).split(path.sep).join("/"), fs.readFileSync(absolute));
    }
  };
  visit(root);
  return { meta, files };
}

export function listUploadedReports(root = repoRoot()): UploadedReportMeta[] {
  const base = path.join(root, "content", "uploads");
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      try {
        const meta = JSON.parse(readText(path.join(base, entry.name, "meta.json")));
        return [UploadedReportMetaSchema.parse(meta)];
      } catch {
        return [];
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function uploadedToManifest(meta: UploadedReportMeta): ManifestItem {
  const config = loadConfig();
  const relativePath = `reports/${meta.id}/`;
  return {
    id: meta.id,
    slug: meta.slug,
    title: meta.title,
    category: meta.category,
    summary: meta.summary,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    status: "published",
    path: relativePath,
    url: `${config.siteBase.replace(/\/$/, "")}/${relativePath}`,
    displayDate: displayDateFromIso(meta.createdAt),
    sourceCount: meta.sourceCount,
    tags: meta.tags,
  };
}

export function readRegistry(root = repoRoot()): UploadedReportRegistry {
  const file = path.join(root, "content", "uploads", "index.json");
  if (!fs.existsSync(file)) {
    return { version: 1, updatedAt: nowIsoKst(), reports: [] };
  }
  return UploadedReportRegistrySchema.parse(JSON.parse(readText(file)));
}

export function writeRegistry(root: string): UploadedReportRegistry {
  const registry: UploadedReportRegistry = {
    version: 1,
    updatedAt: nowIsoKst(),
    reports: listUploadedReports(root),
  };
  writeText(
    path.join(root, "content", "uploads", "index.json"),
    JSON.stringify(registry, null, 2) + "\n",
  );
  return registry;
}
