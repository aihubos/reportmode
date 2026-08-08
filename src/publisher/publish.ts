import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { ensureDir, readText, writeText } from "../lib/fs.js";
import { repoRoot, runtimeDir } from "../lib/paths.js";
import { appendRevision } from "../lib/revisions.js";
import { nowIsoKst } from "../lib/time.js";
import {
  UploadedReportMetaSchema,
  UploadedReportRegistrySchema,
  type UploadedReportMeta,
  type UploadedReportRegistry,
} from "./schema.js";
import {
  loadRuntimeUpload,
  saveRuntimeUpload,
  writeRegistry,
  type PreparedUpload,
} from "./store.js";

type PublishAction = "upload" | "update" | "delete";

export type PublisherResult = {
  id: string;
  action: PublishAction;
  publicUrl?: string;
  commitSha: string;
  pagesStatus: "built";
};

function runFile(file: string, args: string[], cwd: string): string {
  return execFileSync(file, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  }).trim();
}

function runGit(args: string[], cwd = repoRoot()): string {
  return runFile("git", args, cwd);
}

function repositoryFromRemote(remoteUrl: string): string {
  const cleaned = remoteUrl.trim().replace(/\.git$/, "");
  return cleaned.match(/github\.com[/:]([^/]+\/[^/]+)$/)?.[1] || "";
}

function remoteDetails() {
  const config = loadConfig();
  const remoteUrl = runGit(["remote", "get-url", config.publish.remote]);
  const repository = repositoryFromRemote(remoteUrl);
  if (!repository) throw new Error("GitHub 저장소 주소를 확인할 수 없습니다.");
  return { config, remoteUrl, repository };
}

function cloneLatest(): { tmp: string; repository: string } {
  const { config, remoteUrl, repository } = remoteDetails();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reportmode-board-"));
  runGit(
    ["clone", "--branch", config.publish.branch, "--single-branch", remoteUrl, tmp],
  );
  return { tmp, repository };
}

function writePreparedToClone(tmp: string, prepared: PreparedUpload) {
  const contentDir = path.join(tmp, "content", "uploads", prepared.meta.id);
  const publicDir = path.join(tmp, "reports", prepared.meta.id);
  fs.rmSync(contentDir, { recursive: true, force: true });
  fs.rmSync(publicDir, { recursive: true, force: true });
  ensureDir(path.join(contentDir, "files"));
  ensureDir(publicDir);
  writeText(
    path.join(contentDir, "meta.json"),
    JSON.stringify(prepared.meta, null, 2) + "\n",
  );
  for (const [relative, data] of prepared.files) {
    for (const base of [path.join(contentDir, "files"), publicDir]) {
      const target = path.resolve(base, relative);
      if (target !== base && !target.startsWith(base + path.sep)) {
        throw new Error("업로드 경로가 게시 폴더를 벗어났습니다.");
      }
      ensureDir(path.dirname(target));
      fs.writeFileSync(target, data);
    }
  }
}

function rebuildArchive(tmp: string) {
  writeRegistry(tmp);
  runFile("npm", ["ci", "--ignore-scripts"], tmp);
  runFile("npm", ["run", "report", "--", "archive-build"], tmp);
}

function commitAndPush(
  tmp: string,
  id: string,
  action: PublishAction,
): string {
  const { config } = remoteDetails();
  const paths = [
    path.join("content", "uploads"),
    path.join("reports", id),
    path.join("archive", "index.html"),
    path.join("reports", "manifest.json"),
    "index.html",
  ];
  runGit(["add", "-A", "--", ...paths], tmp);
  const staged = runGit(["diff", "--cached", "--name-only"], tmp);
  if (!staged) return runGit(["rev-parse", "HEAD"], tmp);
  const verb = action === "delete" ? "delete" : action === "update" ? "update" : "upload";
  runGit(
    [
      "-c",
      "user.name=Report Mode",
      "-c",
      "user.email=reportmode@aihubos.local",
      "commit",
      "-m",
      `report: ${verb} ${id}`,
    ],
    tmp,
  );
  try {
    runGit(["push", "origin", config.publish.branch], tmp);
  } catch (error) {
    throw new Error(
      `원격 변경과 충돌했거나 푸시 권한이 없습니다. 업로드 원본은 이 Mac에 보존했습니다. ${(error as Error).message}`,
    );
  }
  return runGit(["rev-parse", "HEAD"], tmp);
}

async function waitForPages(repository: string, commitSha: string): Promise<"built"> {
  const { config } = remoteDetails();
  try {
    runFile("gh", ["api", "--method", "POST", `repos/${repository}/pages/builds`], repoRoot());
  } catch {
    // A normal push usually starts Pages. The poll below remains authoritative.
  }
  const deadline = Date.now() + config.publish.pagesPollSeconds * 1000;
  let lastCommit = "unknown";
  let lastStatus = "unknown";
  while (Date.now() < deadline) {
    try {
      const latest = JSON.parse(
        runFile("gh", ["api", `repos/${repository}/pages/builds/latest`], repoRoot()),
      ) as { commit?: string; status?: string };
      lastCommit = latest.commit || "unknown";
      lastStatus = latest.status || "unknown";
      if (lastCommit === commitSha && lastStatus === "built") return "built";
      if (lastCommit === commitSha && lastStatus === "errored") {
        throw new Error("GitHub Pages 빌드가 실패했습니다.");
      }
    } catch (error) {
      if ((error as Error).message.includes("빌드가 실패")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, config.publish.pagesPollIntervalMs));
  }
  throw new Error(`Pages 반영 대기 시간 초과: commit=${lastCommit}, status=${lastStatus}`);
}

async function waitForPublicState(args: {
  id: string;
  deleted: boolean;
  commitSha: string;
}) {
  const { config } = remoteDetails();
  const siteBase = config.siteBase.replace(/\/$/, "");
  const deadline = Date.now() + config.publish.pagesPollSeconds * 1000;
  let last = "아직 반영되지 않았습니다.";
  while (Date.now() < deadline) {
    try {
      const archive = await fetch(`${siteBase}/archive/?commit=${args.commitSha}`, {
        headers: { "cache-control": "no-cache" },
      });
      const archiveHtml = archive.ok ? await archive.text() : "";
      if (args.deleted) {
        if (archive.ok && !archiveHtml.includes(`data-report-id="${args.id}"`)) return;
      } else {
        const report = await fetch(`${siteBase}/reports/${args.id}/?commit=${args.commitSha}`, {
          headers: { "cache-control": "no-cache" },
        });
        const reportHtml = report.ok ? await report.text() : "";
        if (
          archive.ok &&
          report.ok &&
          archiveHtml.includes(`data-report-id="${args.id}"`) &&
          /<html\b|<!doctype\s+html/i.test(reportHtml)
        ) return;
        last = `archive=${archive.status}, report=${report.status}`;
      }
    } catch (error) {
      last = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, config.publish.pagesPollIntervalMs));
  }
  throw new Error(`공개 페이지 확인 실패: ${last}`);
}

function writePublishLog(result: PublisherResult) {
  writeText(
    runtimeDir("logs", `${result.id}-board-${result.action}.json`),
    JSON.stringify({ at: nowIsoKst(), ...result }, null, 2) + "\n",
  );
}

export async function publishPreparedUpload(prepared: PreparedUpload): Promise<PublisherResult> {
  saveRuntimeUpload(prepared);
  const { tmp, repository } = cloneLatest();
  try {
    const existing = path.join(tmp, "content", "uploads", prepared.meta.id);
    if (fs.existsSync(existing)) throw new Error("이미 등록된 보고서 ID입니다.");
    writePreparedToClone(tmp, prepared);
    rebuildArchive(tmp);
    const commitSha = commitAndPush(tmp, prepared.meta.id, "upload");
    const pagesStatus = await waitForPages(repository, commitSha);
    await waitForPublicState({
      id: prepared.meta.id,
      deleted: false,
      commitSha,
    });
    const result: PublisherResult = {
      id: prepared.meta.id,
      action: "upload",
      publicUrl: `${loadConfig().siteBase.replace(/\/$/, "")}/reports/${prepared.meta.id}/`,
      commitSha,
      pagesStatus,
    };
    writePublishLog(result);
    return result;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function cleanTags(value: unknown): string[] {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return Array.from(new Set(values.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean))).slice(0, 12);
}

export async function updateUploadedReport(
  id: string,
  body: Record<string, unknown>,
): Promise<PublisherResult> {
  const { tmp, repository } = cloneLatest();
  try {
    const contentDir = path.join(tmp, "content", "uploads", id);
    const publicDir = path.join(tmp, "reports", id);
    const metaPath = path.join(contentDir, "meta.json");
    if (!fs.existsSync(metaPath)) throw new Error("업로드로 등록한 보고서가 아닙니다.");
    const current = UploadedReportMetaSchema.parse(JSON.parse(readText(metaPath)));
    const sourceCountText = String(body.sourceCount ?? "").trim();
    const requestedSourceCount = sourceCountText ? Number(sourceCountText) : Number.NaN;
    const next = UploadedReportMetaSchema.parse({
      ...current,
      title: String(body.title || current.title).trim(),
      category: String(body.category || current.category).trim(),
      tags: body.tags === undefined ? current.tags : cleanTags(body.tags),
      summary: String(body.summary || current.summary).trim(),
      sourceCount: Number.isFinite(requestedSourceCount) && requestedSourceCount >= 0
        ? Math.trunc(requestedSourceCount)
        : current.sourceCount,
      updatedAt: nowIsoKst(),
    });
    const html = body.html === undefined ? undefined : String(body.html);
    if (html !== undefined) {
      if (!/<html\b|<!doctype\s+html/i.test(html)) throw new Error("유효한 HTML 문서가 아닙니다.");
      if (Buffer.byteLength(html, "utf8") > 10 * 1024 * 1024) {
        throw new Error("직접 수정하는 HTML은 10MB 이하여야 합니다.");
      }
    }
    const historyFiles = [{ name: "meta.json", content: readText(metaPath) }];
    const currentHtmlPath = path.join(contentDir, "files", "index.html");
    if (fs.existsSync(currentHtmlPath)) {
      historyFiles.push({ name: "index.html", content: readText(currentHtmlPath) });
    }
    appendRevision(
      path.join(contentDir, "history"),
      "uploaded_report_updated",
      historyFiles,
    );
    writeText(metaPath, JSON.stringify(next, null, 2) + "\n");
    if (html !== undefined) {
      writeText(path.join(contentDir, "files", "index.html"), html);
      writeText(path.join(publicDir, "index.html"), html);
    }
    writeRegistry(tmp);
    rebuildArchive(tmp);
    const commitSha = commitAndPush(tmp, id, "update");
    const pagesStatus = await waitForPages(repository, commitSha);
    await waitForPublicState({ id, deleted: false, commitSha });
    const result: PublisherResult = {
      id,
      action: "update",
      publicUrl: `${loadConfig().siteBase.replace(/\/$/, "")}/reports/${id}/`,
      commitSha,
      pagesStatus,
    };
    writePublishLog(result);
    return result;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function deleteUploadedReport(id: string): Promise<PublisherResult> {
  const { tmp, repository } = cloneLatest();
  try {
    const contentDir = path.join(tmp, "content", "uploads", id);
    if (!fs.existsSync(path.join(contentDir, "meta.json"))) {
      throw new Error("업로드로 등록한 보고서만 삭제할 수 있습니다.");
    }
    fs.rmSync(contentDir, { recursive: true, force: true });
    fs.rmSync(path.join(tmp, "reports", id), { recursive: true, force: true });
    writeRegistry(tmp);
    rebuildArchive(tmp);
    const commitSha = commitAndPush(tmp, id, "delete");
    const pagesStatus = await waitForPages(repository, commitSha);
    await waitForPublicState({ id, deleted: true, commitSha });
    fs.rmSync(runtimeDir("publisher", id), { recursive: true, force: true });
    const result: PublisherResult = { id, action: "delete", commitSha, pagesStatus };
    writePublishLog(result);
    return result;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function remoteUploadedRegistry(): UploadedReportRegistry {
  const { config } = remoteDetails();
  try {
    runGit(["fetch", config.publish.remote, config.publish.branch]);
    const raw = runGit([
      "show",
      `${config.publish.remote}/${config.publish.branch}:content/uploads/index.json`,
    ]);
    return UploadedReportRegistrySchema.parse(JSON.parse(raw));
  } catch {
    return { version: 1, updatedAt: nowIsoKst(), reports: [] };
  }
}

export function remoteUploadedItem(id: string): { meta: UploadedReportMeta; html: string } {
  const { config } = remoteDetails();
  runGit(["fetch", config.publish.remote, config.publish.branch]);
  const ref = `${config.publish.remote}/${config.publish.branch}`;
  const meta = UploadedReportMetaSchema.parse(JSON.parse(runGit(["show", `${ref}:content/uploads/${id}/meta.json`])));
  const html = runGit(["show", `${ref}:content/uploads/${id}/files/index.html`]);
  return { meta, html };
}

export function retryRuntimeUpload(id: string): Promise<PublisherResult> {
  return publishPreparedUpload(loadRuntimeUpload(id));
}
