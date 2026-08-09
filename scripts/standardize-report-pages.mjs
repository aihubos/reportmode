import fs from "node:fs";
import path from "node:path";

import { enhanceCurrentReport, reportIdFromPath } from "./report-refresh-lib.mjs";

const root = path.resolve(import.meta.dirname, "..");
const reportsRoot = path.join(root, "reports");
const snapshotId = process.argv[2] || "2026-08-09-before-refresh";

function reportFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "assets") return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return reportFiles(target);
    return entry.isFile() && entry.name.endsWith(".html") ? [target] : [];
  });
}

let updated = 0;
let skipped = 0;
for (const file of reportFiles(reportsRoot)) {
  const reportPath = path.relative(root, file).split(path.sep).join("/");
  const before = fs.readFileSync(file, "utf8");
  const after = enhanceCurrentReport(before, {
    reportPath,
    reportId: reportIdFromPath(reportPath),
    snapshotId,
  });
  if (after === before) skipped += 1;
  else {
    fs.writeFileSync(file, after);
    updated += 1;
  }
}

console.log(JSON.stringify({ updated, skipped, snapshotId }, null, 2));
