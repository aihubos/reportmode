#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildVersionRecord,
  createSnapshotHtml,
  deriveReportVersion,
  enhanceCurrentReport,
  extractReportTitle,
  isRedirectHtml,
  nextMinorVersion,
  reportIdFromPath,
} from "./report-refresh-lib.mjs";

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true });
}

function writeFileAtomic(file, content) {
  ensureDir(path.dirname(file));
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content);
  fs.renameSync(temporary, file);
}

function walkHtml(directory, root) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "assets" || entry.name === "versions") return [];
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return walkHtml(absolute, root);
    if (!entry.isFile() || !entry.name.endsWith(".html")) return [];
    return [path.relative(root, absolute).split(path.sep).join("/")];
  });
}

function normalizeManifestPath(value) {
  return value.endsWith("/") ? `${value}index.html` : value;
}

function versionGroup(id) {
  return id.replace(/-v\d+-\d+-\d+$/i, "");
}

function versionParts(version) {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1).map(Number) : [0, 0, 0];
}

function compareVersion(a, b) {
  const left = versionParts(a);
  const right = versionParts(b);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function snapshotIndex(snapshotId, reports) {
  const links = reports
    .map((report) => `<li><a href="./${report.canonicalPath}">${report.title}</a><small>${report.id}</small></li>`)
    .join("\n");
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report Mode 이전판 · ${snapshotId}</title>
<style>body{max-width:920px;margin:0 auto;padding:48px 24px;color:#191f28;background:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}h1{font-size:34px}p{color:#6b7684}ul{display:grid;gap:8px;padding:0;list-style:none}li{display:flex;justify-content:space-between;gap:18px;padding:14px 16px;border:1px solid #e5e8eb;border-radius:12px;background:#fff}a{color:#1b64da;font-weight:800;text-decoration:none}small{color:#8b95a1}</style></head><body>
<h1>Report Mode 이전판</h1><p>${snapshotId} 기준으로 보존한 보고서입니다. 최신 정보는 각 보고서의 현재판을 확인하세요.</p><ul>${links}</ul></body></html>`;
}

function inventoryMarkdown(snapshotId, counts, reports) {
  const lines = [
    `# Report Mode 전체 갱신 인벤토리`,
    "",
    `- 기준 스냅샷: ${snapshotId}`,
    `- 전체 HTML 경로: ${counts.total}`,
    `- 내용형: ${counts.content}`,
    `- 링크·이동형: ${counts.redirects}`,
    `- 도서관 등록: ${counts.listed}`,
    `- 비노출: ${counts.unlisted}`,
    "",
    "| ID | 제목 | 유형 | 도서관 | 이전 버전 | 현재 버전 | 제목 잠금 |",
    "|---|---|---|---|---|---|---|",
    ...reports.map((report) => `| ${report.id} | ${report.title.replaceAll("|", "\\|")} | ${report.kind} | ${report.listed ? "등록" : "비노출"} | ${report.previousVersion || "-"} | ${report.currentVersion || "-"} | ${report.titleLocked ? "유지" : "확인 필요"} |`),
    "",
  ];
  return lines.join("\n");
}

export function runRefresh({ root, snapshotId }) {
  const absoluteRoot = path.resolve(root);
  const reportsRoot = path.join(absoluteRoot, "reports");
  const manifestPath = path.join(reportsRoot, "manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
    : { reports: [] };
  const listedPaths = new Set((manifest.reports || []).map((item) => normalizeManifestPath(item.path)));
  const listedIds = new Set((manifest.reports || []).map((item) => item.id));
  const reportPaths = walkHtml(reportsRoot, absoluteRoot).sort();
  const source = reportPaths.map((reportPath) => {
    const html = fs.readFileSync(path.join(absoluteRoot, reportPath), "utf8");
    const id = reportIdFromPath(reportPath);
    return {
      id,
      reportPath,
      html,
      title: extractReportTitle(html) || id,
      redirect: isRedirectHtml(html),
      listed: listedIds.has(id) || listedPaths.has(reportPath),
      previousVersion: isRedirectHtml(html) ? null : deriveReportVersion(html, reportPath),
    };
  });

  const groupLatest = new Map();
  for (const report of source.filter((item) => !item.redirect)) {
    const group = versionGroup(report.id);
    const latest = groupLatest.get(group);
    if (!latest || compareVersion(report.previousVersion, latest.previousVersion) > 0) groupLatest.set(group, report);
  }

  const snapshotRoot = path.join(absoluteRoot, "versions", snapshotId);
  if (fs.existsSync(snapshotRoot)) throw new Error(`기존 스냅샷은 덮어쓸 수 없습니다: ${snapshotRoot}`);
  ensureDir(snapshotRoot);

  const records = [];
  const inventory = [];
  for (const report of source) {
    const snapshotFile = path.join(snapshotRoot, report.reportPath);
    const snapshotHtml = report.redirect
      ? report.html
      : createSnapshotHtml(report.html, { reportPath: report.reportPath, snapshotId });
    writeFileAtomic(snapshotFile, snapshotHtml);

    if (report.redirect) {
      inventory.push({
        id: report.id,
        path: report.reportPath,
        title: report.title,
        kind: "redirect",
        listed: report.listed,
        titleLocked: true,
      });
      continue;
    }

    const historical = groupLatest.get(versionGroup(report.id)) !== report;
    const currentVersion = historical ? report.previousVersion : nextMinorVersion(report.previousVersion);
    const record = {
      ...buildVersionRecord({
        reportId: report.id,
        reportPath: report.reportPath,
        title: report.title,
        snapshotId,
        version: report.previousVersion,
      }),
      currentVersion,
      updatedAt: "2026-08-09",
      status: historical ? "historical" : "content-refreshed",
      changeSummary: historical ? "과거 공개판 보존 및 연결" : "내용·출처 재검증, 공통 양식 및 이전판 연결",
    };
    records.push(record);

    const enhanced = enhanceCurrentReport(report.html, {
      reportPath: report.reportPath,
      reportId: report.id,
      snapshotId,
    });
    writeFileAtomic(path.join(absoluteRoot, report.reportPath), enhanced);
    inventory.push({
      id: report.id,
      path: report.reportPath,
      title: report.title,
      kind: historical ? "historical" : "content",
      listed: report.listed,
      previousVersion: report.previousVersion,
      currentVersion,
      titleLocked: extractReportTitle(enhanced) === report.title,
    });
  }

  const counts = {
    total: source.length,
    content: source.filter((item) => !item.redirect).length,
    redirects: source.filter((item) => item.redirect).length,
    listed: source.filter((item) => item.listed).length,
    unlisted: source.filter((item) => !item.listed).length,
  };
  const generatedAt = "2026-08-09T00:00:00+09:00";
  const versionsManifest = { schemaVersion: 1, snapshotId, generatedAt, reports: records };
  writeFileAtomic(path.join(absoluteRoot, "versions", "manifest.json"), `${JSON.stringify(versionsManifest, null, 2)}\n`);
  writeFileAtomic(path.join(snapshotRoot, "index.html"), snapshotIndex(snapshotId, records));

  const inventoryDocument = { schemaVersion: 1, snapshotId, generatedAt, counts, reports: inventory };
  const inventoryDir = path.join(absoluteRoot, "docs", "report-refresh");
  writeFileAtomic(path.join(inventoryDir, "2026-08-09-inventory.json"), `${JSON.stringify(inventoryDocument, null, 2)}\n`);
  writeFileAtomic(path.join(inventoryDir, "2026-08-09-inventory.md"), inventoryMarkdown(snapshotId, counts, inventory));
  return { counts, reports: inventory, versions: records };
}

function main() {
  const root = process.cwd();
  const snapshotId = process.argv[2] || "2026-08-09-before-refresh";
  const result = runRefresh({ root, snapshotId });
  process.stdout.write(`${JSON.stringify(result.counts, null, 2)}\n`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(currentFile).href) main();
