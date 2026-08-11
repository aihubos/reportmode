import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function publicIdFromReportPath(reportPath) {
  const normalized = String(reportPath || "").replaceAll("\\", "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  let last = parts[parts.length - 1] || "";
  if (last.toLowerCase() === "index.html") last = parts[parts.length - 2] || "";
  return last.replace(/\.html$/i, "");
}

function reportPagePath(reportPath) {
  const relative = String(reportPath || "").replace(/^\/+/, "");
  return path.join(root, relative.endsWith("/") ? relative + "index.html" : relative);
}

function counterIdFromHtml(html) {
  const tag = html.match(/<script\b[^>]*src=["'][^"']*report-view-counter\.js(?:\?[^"']*)?["'][^>]*>/i)?.[0] || "";
  return tag.match(/\bdata-report-id=["']([^"']+)["']/i)?.[1] || "";
}

export function runReportViewIdQa({ manifestPath = path.join(root, "reports", "manifest.json") } = {}) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const reports = Array.isArray(manifest.reports) ? manifest.reports : [];
  const failures = [];
  let checked = 0;
  let redirects = 0;
  for (const report of reports) {
    const reportPath = String(report?.path || "");
    const pagePath = reportPagePath(reportPath);
    if (!fs.existsSync(pagePath)) {
      failures.push(`${reportPath}: page not found`);
      continue;
    }
    const html = fs.readFileSync(pagePath, "utf8");
    const expected = publicIdFromReportPath(reportPath);
    const actual = counterIdFromHtml(html);
    if (!actual && /http-equiv\s*=\s*["']?refresh|location\.(?:replace|assign)\s*\(/i.test(html)) {
      redirects += 1;
      continue;
    }
    checked += 1;
    if (!actual) failures.push(`${reportPath}: report-view-counter data-report-id missing`);
    else if (actual !== expected) failures.push(`${reportPath}: expected ${expected}, found ${actual}`);
  }
  return { checked, redirects, total: reports.length, failures };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    const result = runReportViewIdQa();
    console.log(JSON.stringify({ ...result, status: result.failures.length ? "failed" : "ok" }, null, 2));
    if (result.failures.length) process.exitCode = 1;
  } catch (error) {
    console.error(`report view ID QA failed: ${error.message}`);
    process.exitCode = 1;
  }
}
