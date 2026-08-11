import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const VIEW_COUNT_API = "https://reportmode-request-board.report-request-board.workers.dev/report-views";

export function normalizeCounts(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("view count payload must be an object");
  }
  const source = payload.counts && typeof payload.counts === "object" && !Array.isArray(payload.counts)
    ? payload.counts
    : payload;
  const entries = Object.entries(source);
  const normalized = {};
  for (const [id, value] of entries) {
    if (typeof id !== "string" || !id.trim()) {
      throw new TypeError("view count ID must be a non-empty string");
    }
    if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
      throw new TypeError("view count must be a non-negative integer");
    }
    normalized[id] = value;
  }
  return Object.fromEntries(Object.keys(normalized).sort().map((id) => [id, normalized[id]]));
}

export async function syncReportViewCounts({ fetchImpl = fetch, apiUrl = VIEW_COUNT_API, outputPath } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetchImpl(apiUrl, { method: "GET", cache: "no-store", signal: controller.signal });
    if (!response.ok) throw new Error(`view count API returned ${response.status}`);
    const payload = await response.json();
    const counts = normalizeCounts(payload);
    const target = outputPath || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "reports", "view-counts.json");
    fs.writeFileSync(target, `${JSON.stringify(counts, null, 2)}\n`, "utf8");
    return { target, counts };
  } finally {
    clearTimeout(timeout);
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  syncReportViewCounts()
    .then(({ target, counts }) => {
      console.log(`synced ${Object.keys(counts).length} report view counts to ${target}`);
    })
    .catch((error) => {
      console.error(`report view count sync failed: ${error.message}`);
      process.exitCode = 1;
    });
}
