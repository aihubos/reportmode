import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const zipPath = process.argv[2];
if (!zipPath || !fs.existsSync(zipPath)) {
  throw new Error("사용법: node scripts/import-draft-bundle.mjs <zip-path>");
}

const root = process.cwd();
const reportsRoot = path.join(root, "reports");
const draftsRoot = path.join(reportsRoot, "drafts");
const manifestPath = path.join(reportsRoot, "manifest.json");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "reportmode-drafts-"));

function text(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function meta(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text(html.match(new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']*)`, "i"))?.[1] || "");
}

function metadata(html) {
  const raw = html.match(/<script[^>]+id=["']report-metadata["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function extractThumbnail(html, destination) {
  const image = html.match(/src=["']data:image\/(png|jpeg|jpg|webp);base64,([^"']+)["']/i);
  if (!image) return { html, cover: undefined };
  const extension = image[1].toLowerCase() === "jpeg" ? "jpg" : image[1].toLowerCase();
  const assets = path.join(destination, "assets");
  fs.mkdirSync(assets, { recursive: true });
  fs.writeFileSync(path.join(assets, `thumbnail.${extension}`), Buffer.from(image[2], "base64"));
  return {
    html: html.replace(image[0], `src="assets/thumbnail.${extension}"`),
    cover: `thumbnail.${extension}`,
  };
}

try {
  execFileSync("unzip", ["-q", zipPath, "-d", tempRoot]);
  const htmlFiles = fs.readdirSync(tempRoot).filter((name) => name.toLowerCase().endsWith(".html")).sort();
  if (!htmlFiles.length) throw new Error("ZIP에서 HTML을 찾지 못했습니다.");

  fs.rmSync(draftsRoot, { recursive: true, force: true });
  fs.mkdirSync(draftsRoot, { recursive: true });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const published = (manifest.reports || []).filter((item) => item.category !== "Draft");
  const drafts = [];

  for (const fileName of htmlFiles) {
    const slug = path.basename(fileName, path.extname(fileName));
    const destination = path.join(draftsRoot, slug);
    fs.mkdirSync(destination, { recursive: true });
    let html = fs.readFileSync(path.join(tempRoot, fileName), "utf8");
    const info = metadata(html);
    const title = info.title || text(html.match(/<title>(.*?)\s*\|/i)?.[1] || slug);
    const summary = meta(html, "description") || title;
    const reportId = String(info.reportId || `draft-${slug}`).slice(0, 120);
    const created = String(info.createdAt || "2026-08-09").slice(0, 10);
    const canonical = `https://aihubos.github.io/reportmode/reports/drafts/${slug}/`;
    const thumbnail = extractThumbnail(html, destination);
    const canonicalTag = thumbnail.html.match(/<link[^>]*rel=["']canonical["'][^>]*>/i)?.[0] || "";
    const oldCanonical = canonicalTag.match(/href=["']([^"']+)["']/i)?.[1] || "";
    html = thumbnail.html;
    if (oldCanonical) html = html.replaceAll(oldCanonical, canonical);
    html = html
      .replace(/<meta[^>]*name=["']robots["'][^>]*>/i, '<meta name="robots" content="noindex,nofollow">')
      .replace(/<link[^>]*rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${canonical}">`)
      .replace(/<body([^>]*)>/i, '<body$1 data-report-draft="true"><div class="draft-report-status" role="status">Draft · 관리자 검토 전 초안</div><style>.draft-report-status{position:fixed;right:16px;bottom:16px;z-index:9999;padding:8px 12px;border:1px solid #e5e8eb;border-radius:999px;color:#4e5968;background:rgba(255,255,255,.94);box-shadow:0 8px 24px rgba(25,31,40,.1);font:800 11px/1.2 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo",sans-serif}@media print{.draft-report-status{display:none}}</style>');
    fs.writeFileSync(path.join(destination, "index.html"), html);
    const sourceCount = (html.match(/class=["'][^"']*source-card/g) || []).length;
    drafts.push({
      id: reportId,
      slug,
      title,
      subtitle: "관리자 검토 전 초안",
      category: "Draft",
      summary,
      createdAt: `${created}T20:00:00+09:00`,
      updatedAt: `${created}T20:00:00+09:00`,
      status: "published",
      path: `reports/drafts/${slug}/`,
      url: canonical,
      displayDate: created.replace(/-/g, "").slice(2),
      sourceCount,
      tags: ["Draft", "Jeremy Style"],
      coverImage: thumbnail.cover ? `reports/drafts/${slug}/assets/${thumbnail.cover}` : undefined,
      coverAlt: `${title} 초안 대표 이미지`,
    });
  }

  manifest.generatedAt = new Date().toISOString();
  manifest.reports = [...published, ...drafts];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Imported ${drafts.length} Draft reports.`);
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
