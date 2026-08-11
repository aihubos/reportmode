import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const WORKER_URL = process.env.REPORT_LIFECYCLE_WORKER_URL || "https://reportmode-request-board.report-request-board.workers.dev";
const SECRET = process.env.REPORT_LIFECYCLE_WORKER_SECRET || "";
const JOB_ID = process.env.REPORT_LIFECYCLE_JOB_ID || "";
const REPOSITORY_ROOT = process.cwd();

const MIME_TYPES = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function mimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function isExternalReference(value) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|data:)/i.test(String(value || ""));
}

function safeLocalPath(baseDir, reference, root) {
  const cleanReference = String(reference || "").split(/[?#]/, 1)[0];
  if (!cleanReference || isExternalReference(cleanReference)) return null;
  const resolved = path.resolve(baseDir, cleanReference);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolved;
}

function dataUri(filePath, bytes) {
  return `data:${mimeType(filePath)};base64,${Buffer.from(bytes).toString("base64")}`;
}

async function inlineCss(css, cssPath, root) {
  let output = css;
  const matches = Array.from(css.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi));
  for (const match of matches) {
    const reference = match[2];
    const localPath = safeLocalPath(path.dirname(cssPath), reference, root);
    if (!localPath) continue;
    try {
      output = output.replace(match[0], `url(${dataUri(localPath, await fs.readFile(localPath))})`);
    } catch {
      // Keep unresolved CSS URLs untouched.
    }
  }
  return output;
}

async function inlineLocalAssets(html, htmlPath, root) {
  let output = String(html || "");
  output = output.replace(/<script\b[^>]*(?:report-comments|report-view-counter|report-history|report-entry-tracker|archive-)[^>]*>[\s\S]*?<\/script>/gi, "");

  const stylesheetPattern = /<link\b([^>]*?)\brel=["']stylesheet["']([^>]*?)\bhref=["']([^"']+)["'][^>]*>/gi;
  const styleMatches = Array.from(output.matchAll(stylesheetPattern));
  for (const match of styleMatches) {
    const localPath = safeLocalPath(path.dirname(htmlPath), match[3], root);
    if (!localPath) continue;
    try {
      const css = await inlineCss(await fs.readFile(localPath, "utf8"), localPath, root);
      output = output.replace(match[0], `<style data-private-source="${match[3]}">${css}</style>`);
    } catch {
      // Keep an unresolved stylesheet visible so validation can report it later.
    }
  }

  const attributes = /\b(?:src|poster)=["']([^"']+)["']/gi;
  const references = Array.from(output.matchAll(attributes));
  for (const match of references) {
    const reference = match[1];
    const localPath = safeLocalPath(path.dirname(htmlPath), reference, root);
    if (!localPath || /^(?:mailto:|tel:|javascript:)/i.test(reference)) continue;
    try {
      const bytes = await fs.readFile(localPath);
      output = output.replace(match[0], match[0].replace(reference, dataUri(localPath, bytes)));
    } catch {
      // Leave an external or unresolved link untouched for the final check.
    }
  }

  return output;
}

async function resolveReportPage(root, reportPath) {
  const relative = String(reportPath || "").replace(/^\/+/, "");
  const candidate = path.resolve(root, relative.endsWith("/") ? `${relative}index.html` : relative);
  const rootRelative = path.relative(root, candidate);
  if (rootRelative.startsWith("..") || path.isAbsolute(rootRelative)) throw new Error("report_path_outside_repository");
  await fs.access(candidate);
  return candidate;
}

function removeReportFromManifest(manifest, reportId) {
  return {
    ...manifest,
    reports: Array.isArray(manifest.reports) ? manifest.reports.filter((report) => report && report.id !== reportId) : [],
  };
}

function lifecycleCompletionStatus(items) {
  const rows = Array.isArray(items) ? items : [];
  const completed = rows.filter((item) => item && item.status === "completed").length;
  const failed = rows.filter((item) => item && item.status === "failed").length;
  if (rows.length > 0 && completed === rows.length) return "completed";
  if (completed > 0 && failed > 0) return "partial";
  if (failed > 0) return "failed";
  return "partial";
}

async function requestJson(pathname, options = {}) {
  const response = await fetch(`${WORKER_URL}${pathname}`, {
    ...options,
    headers: { ...(options.headers || {}), "X-Report-Lifecycle-Secret": SECRET },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `worker_${response.status}`);
  return body;
}

async function postForm(pathname, form) {
  return requestJson(pathname, { method: "POST", body: form });
}

async function loadJob() {
  if (!JOB_ID || !SECRET) throw new Error("lifecycle_environment_missing");
  return requestJson(`/internal/report-jobs/${encodeURIComponent(JOB_ID)}`);
}

async function markItem(reportId, status, extra = {}) {
  return requestJson(`/internal/report-jobs/${encodeURIComponent(JOB_ID)}/items/${encodeURIComponent(reportId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, ...extra }),
  });
}

async function recoverReport(reportId, html) {
  const form = new FormData();
  form.set("key", `${JOB_ID}/${reportId}.html`);
  form.set("file", new File([html], `${reportId}.html`, { type: "text/html" }));
  await postForm("/internal/recovery-objects", form);
}

async function removePublicSource(root, report) {
  const reportPath = String(report.path || "").replace(/^\/+/, "");
  if (reportPath) {
    const target = path.resolve(root, reportPath.endsWith("/") ? reportPath : reportPath);
    const relative = path.relative(root, target);
    if (!relative.startsWith("..") && !path.isAbsolute(relative)) await fs.rm(target, { recursive: true, force: true });
  }
  await fs.rm(path.join(root, "content", "uploads", report.id), { recursive: true, force: true });
  await fs.rm(path.join(root, "content", "reports", report.id), { recursive: true, force: true });
  const manifestPath = path.join(root, "reports", "manifest.json");
  try {
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    await fs.writeFile(manifestPath, `${JSON.stringify(removeReportFromManifest(manifest, report.id), null, 2)}\n`);
  } catch {
    // Build will regenerate the manifest when the source is gone.
  }
}

async function processJobItem(job, item, manifest) {
  const report = (manifest.reports || []).find((entry) => entry && entry.id === item.report_id);
  if (!report) {
    await markItem(item.report_id, "failed", { errorMessage: "report_not_found_in_manifest" });
    return false;
  }
  try {
    const page = await resolveReportPage(REPOSITORY_ROOT, report.path);
    const original = await fs.readFile(page, "utf8");
    if (job.action === "make_private") {
      const html = await inlineLocalAssets(original, page, REPOSITORY_ROOT);
      const privateId = `private-${report.id}`.slice(0, 120);
      const form = new FormData();
      form.set("id", privateId);
      form.set("title", report.title || report.id);
      form.set("summary", report.summary || `${report.title || report.id} 비공개 보고서`);
      form.set("displayDate", report.displayDate || report.id.slice(0, 6));
      form.set("sourceCount", String(report.sourceCount || 0));
      form.set("tags", Array.isArray(report.tags) ? report.tags.join(",") : "");
      form.set("originReportId", report.id);
      form.set("originPublicUrl", report.url || "");
      form.set("conversionJobId", JOB_ID);
      form.set("html", new File([html], "index.html", { type: "text/html" }));
      if (report.coverImage && !isExternalReference(report.coverImage)) {
        const cover = safeLocalPath(REPOSITORY_ROOT, report.coverImage, REPOSITORY_ROOT);
        if (cover) {
          try { form.set("cover", new File([await fs.readFile(cover)], path.basename(cover), { type: mimeType(cover) })); } catch {}
        }
      }
      const privateResult = await postForm("/internal/private-packages", form);
      await removePublicSource(REPOSITORY_ROOT, report);
      await markItem(report.id, "completed", { privateReportId: privateResult.report?.id || privateId });
    } else if (job.action === "delete") {
      const recoveryHtml = await inlineLocalAssets(original, page, REPOSITORY_ROOT);
      await recoverReport(report.id, recoveryHtml);
      await removePublicSource(REPOSITORY_ROOT, report);
      await markItem(report.id, "completed");
    } else {
      await markItem(report.id, "failed", { errorMessage: "unsupported_lifecycle_action" });
      return false;
    }
    return true;
  } catch (error) {
    await markItem(report.id, "failed", { errorMessage: String(error?.message || error).slice(0, 240) });
    return false;
  }
}

async function commitChanges() {
  await exec("npm", ["run", "build"], { cwd: REPOSITORY_ROOT });
  const { stdout: status } = await exec("git", ["status", "--porcelain"], { cwd: REPOSITORY_ROOT });
  if (!status.trim()) return "";
  await exec("git", ["config", "user.name", "github-actions[bot]"], { cwd: REPOSITORY_ROOT });
  await exec("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: REPOSITORY_ROOT });
  await exec("git", ["add", "-A"], { cwd: REPOSITORY_ROOT });
  await exec("git", ["commit", "-m", `chore: process report lifecycle job ${JOB_ID}`], { cwd: REPOSITORY_ROOT });
  await exec("git", ["push", "origin", "HEAD:main"], { cwd: REPOSITORY_ROOT });
  const { stdout: sha } = await exec("git", ["rev-parse", "HEAD"], { cwd: REPOSITORY_ROOT });
  return sha.trim();
}

export { inlineLocalAssets, lifecycleCompletionStatus, removeReportFromManifest, resolveReportPage };

export async function main() {
  const jobPayload = await loadJob();
  await requestJson(`/internal/report-jobs/${encodeURIComponent(JOB_ID)}/start`, { method: "POST" });
  const manifest = JSON.parse(await fs.readFile(path.join(REPOSITORY_ROOT, "reports", "manifest.json"), "utf8"));
  for (const item of jobPayload.items || []) {
    if (item.status === "completed") continue;
    await processJobItem(jobPayload.job, item, manifest);
  }
  const latestJob = await loadJob();
  const completionStatus = lifecycleCompletionStatus(latestJob.items);
  const sha = await commitChanges();
  await requestJson(`/internal/report-jobs/${encodeURIComponent(JOB_ID)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: completionStatus, commitSha: sha }),
  });
  return sha;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (error) => {
    console.error(error?.stack || error);
    if (JOB_ID && SECRET) {
      await requestJson(`/internal/report-jobs/${encodeURIComponent(JOB_ID)}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed", errorMessage: String(error?.message || error).slice(0, 240) }),
      }).catch(() => undefined);
    }
    process.exitCode = 1;
  });
}
