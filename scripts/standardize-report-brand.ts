import fs from "node:fs";
import path from "node:path";

import { applyReportHubBrand } from "../src/lib/public-brand.js";

const root = path.resolve(import.meta.dirname, "..");
const reportsRoot = path.join(root, "reports");

function reportFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "assets") return [];
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return reportFiles(target);
    return entry.isFile() && entry.name.endsWith(".html") && (entry.name === "index.html" || directory === reportsRoot) ? [target] : [];
  });
}

let updated = 0;
let skipped = 0;
for (const file of reportFiles(reportsRoot)) {
  const reportPath = path.relative(root, file).split(path.sep).join("/");
  const before = fs.readFileSync(file, "utf8");
  const after = applyReportHubBrand(before, reportPath);
  if (after === before) skipped += 1;
  else {
    fs.writeFileSync(file, after);
    updated += 1;
  }
}

process.stdout.write(`${JSON.stringify({ updated, skipped }, null, 2)}\n`);
