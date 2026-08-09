#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { extractReportTitle } from "./report-refresh-lib.mjs";

export function expectedReportBase(reportPath) {
  if (reportPath.endsWith("/index.html")) return `/reportmode/${reportPath.slice(0, -"index.html".length)}`;
  return `/reportmode/${path.posix.dirname(reportPath)}/`;
}

function localTarget(root, reportPath, value) {
  if (!value || /^(?:#|data:|mailto:|tel:|javascript:|https?:|\/\/)/i.test(value)) return null;
  const clean = decodeURIComponent(value.split(/[?#]/)[0]);
  if (clean.startsWith("/reportmode/")) return path.join(root, clean.slice("/reportmode/".length));
  if (clean.startsWith("/")) return path.join(root, clean.slice(1));
  return path.resolve(path.dirname(reportPath), clean);
}

export function scanHtml({ root, reportPath, html }) {
  const issues = [];
  for (const asset of ["report-page-layout.js", "report-view-counter.js", "report-history.js"]) {
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expression = new RegExp(`<script\\b[^>]*src=["'][^"']*${escaped}(?:\\?[^"']*)?["'][^>]*><\\/script>`, "gi");
    const count = Array.from(html.matchAll(expression)).length;
    if (count > 1) issues.push({ type: "duplicate-shared-script", asset, count });
  }
  const ids = Array.from(html.matchAll(/(?:^|\s)id=["']([^"']+)["']/gi), (match) => match[1]);
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  for (const [id, count] of counts) {
    if (count > 1) issues.push({ type: "duplicate-id", value: id, count });
  }
  for (const match of html.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) {
    const target = localTarget(root, reportPath, match[1]);
    if (target && !fs.existsSync(target)) issues.push({ type: "missing-local", value: match[1], target });
  }
  for (const match of html.matchAll(/<a\b[^>]*href=["']#([^"']+)["'][^>]*>/gi)) {
    if (!ids.includes(match[1])) issues.push({ type: "missing-anchor", value: match[1] });
  }
  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(match[1])) issues.push({ type: "missing-alt", value: match[0].slice(0, 140) });
  }
  if (!/<title\b[^>]*>[^<]+<\/title>/i.test(html)) issues.push({ type: "missing-title" });
  if (!/<h1\b[^>]*>[\s\S]*?<\/h1>/i.test(html)) issues.push({ type: "missing-h1" });
  if (/\{\{[A-Z0-9_]+\}\}/.test(html)) issues.push({ type: "unresolved-token" });
  return issues;
}

export function runIntegrityQa({ root, snapshotId }) {
  const inventoryPath = path.join(root, "docs", "report-refresh", "2026-08-09-inventory.json");
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
  const issues = [];
  for (const report of inventory.reports) {
    const currentPath = path.join(root, report.path);
    const previousPath = path.join(root, "versions", snapshotId, report.path);
    const current = fs.readFileSync(currentPath, "utf8");
    const previous = fs.readFileSync(previousPath, "utf8");
    if (extractReportTitle(current) !== extractReportTitle(previous)) {
      issues.push({ report: report.id, type: "title-changed" });
    }
    if (report.kind === "redirect") {
      if (current !== previous) issues.push({ report: report.id, type: "redirect-changed" });
      continue;
    }
    if (!/data-report-view=["']detail["']/i.test(current)) issues.push({ report: report.id, type: "wrong-default-view" });
    if (!/data-report-layout=["']wide["']/i.test(current)) issues.push({ report: report.id, type: "wrong-default-layout" });
    if (!/report-history\.js\?v=20260809/.test(current)) issues.push({ report: report.id, type: "missing-history" });
    const expectedBase = expectedReportBase(report.path);
    if (!previous.includes(`<base href="${expectedBase}">`)) {
      issues.push({ report: report.id, type: "wrong-snapshot-base", expected: expectedBase });
    }
    for (const issue of scanHtml({ root, reportPath: currentPath, html: current })) {
      issues.push({ report: report.id, ...issue });
    }
  }
  const byType = Object.fromEntries(
    Array.from(new Set(issues.map((issue) => issue.type))).map((type) => [type, issues.filter((issue) => issue.type === type).length]),
  );
  const result = {
    checkedAt: "2026-08-09T00:00:00+09:00",
    snapshotId,
    checkedReports: inventory.reports.length,
    passed: issues.length === 0,
    issueCount: issues.length,
    byType,
    issues,
  };
  const output = path.join(root, "docs", "report-refresh", "2026-08-09-integrity.json");
  fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

function main() {
  const snapshotId = process.argv[2] || "2026-08-09-before-refresh";
  const result = runIntegrityQa({ root: process.cwd(), snapshotId });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.passed) process.exitCode = 1;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(currentFile).href) main();
