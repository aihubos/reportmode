import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

test("archive admin exposes persistent three-item star controls", () => {
  const script = fs.readFileSync(path.join(root, "archive-report-admin.js"), "utf8");
  assert.match(script, /\/featured-reports/);
  assert.match(script, /archive-admin-feature/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /featured_limit_reached/);
  assert.match(script, /renderSpotlights/);
});

test("archive admin exposes Draft main-list promotion controls", () => {
  const script = fs.readFileSync(path.join(root, "archive-report-admin.js"), "utf8");
  assert.match(script, /\/draft-promotions/);
  assert.match(script, /메인 등록/);
  assert.match(script, /메인 제외/);
  assert.match(script, /reportmodeDraftPromotions/);
});

test("spotlight layout has responsive and selected-star states", () => {
  const css = fs.readFileSync(path.join(root, "../src/styles/magazine.css"), "utf8");
  assert.match(css, /\.archive-spotlight\s*{/);
  assert.match(css, /\.archive-spotlight-grid\s*{/);
  assert.match(css, /\.archive-admin-feature\.is-featured/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.archive-spotlight-grid\s*{[^}]*grid-template-columns:\s*1fr/s);
});

test("spotlight keeps overlapping popular reports in the right column and shows featured view counts", () => {
  const script = fs.readFileSync(path.join(root, "archive-report-admin.js"), "utf8");
  assert.match(script, /var popularIds = new Set\(popularPosts\.map/);
  assert.match(script, /featuredPosts = featuredPosts\.filter/);
  assert.match(script, /count \? count\.textContent : "조회수 0"/);
});

test("archive admin provides a persistent report card presentation editor", () => {
  const script = fs.readFileSync(path.join(root, "archive-report-admin.js"), "utf8");

  assert.match(script, /report-overrides/);
  assert.match(script, /archive-admin-edit/);
  assert.match(script, /archive-admin-editor/);
  assert.match(script, /썸네일 이미지 주소/);
  assert.match(script, /원래 정보로 되돌리기/);
  assert.match(script, /archive-admin-thumbnail-drop/);
  assert.match(script, /clipboardData/);
  assert.match(script, /dragover/);
  assert.match(script, /image\/jpeg/);
});
