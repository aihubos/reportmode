#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function collectLinks(root) {
  const inventory = JSON.parse(
    fs.readFileSync(path.join(root, "docs", "report-refresh", "2026-08-09-inventory.json"), "utf8"),
  );
  const links = new Map();
  for (const report of inventory.reports.filter((item) => item.kind !== "redirect")) {
    const html = fs.readFileSync(path.join(root, report.path), "utf8");
    for (const match of html.matchAll(/\b(href|src)=["'](https?:\/\/[^"']+)["']/gi)) {
      let url;
      try {
        const parsed = new URL(match[2]);
        parsed.hash = "";
        url = parsed.href;
      } catch {
        continue;
      }
      const item = links.get(url) || { url, uses: [] };
      item.uses.push({ report: report.id, attribute: match[1].toLowerCase() });
      links.set(url, item);
    }
  }
  return Array.from(links.values());
}

async function request(url, method) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    headers: method === "GET" ? { Range: "bytes=0-2047" } : {},
    signal: AbortSignal.timeout(8000),
  });
  if (response.body) await response.body.cancel();
  return { status: response.status, finalUrl: response.url };
}

function classify(status, error) {
  if (error) return "uncertain";
  if (status >= 200 && status < 400) return "accessible";
  if ([401, 403, 405, 418, 429].includes(status)) return "blocked";
  if ([404, 410].includes(status)) return "broken";
  if (status >= 500) return "server-error";
  return "uncertain";
}

async function checkLink(item) {
  try {
    let result = await request(item.url, "HEAD");
    if ([400, 404, 405, 410, 501].includes(result.status)) result = await request(item.url, "GET");
    return { ...item, ...result, category: classify(result.status) };
  } catch (error) {
    return { ...item, status: 0, finalUrl: item.url, category: "uncertain", error: error.name || "FetchError" };
  }
}

async function runPool(items, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await checkLink(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const root = process.cwd();
const links = collectLinks(root);
const results = await runPool(links, 20);
const counts = Object.fromEntries(
  Array.from(new Set(results.map((item) => item.category))).map((category) => [category, results.filter((item) => item.category === category).length]),
);
const output = {
  checkedAt: "2026-08-09T00:00:00+09:00",
  total: results.length,
  counts,
  results,
};
fs.writeFileSync(
  path.join(root, "docs", "report-refresh", "2026-08-09-link-audit.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify({ total: output.total, counts }, null, 2)}\n`);
