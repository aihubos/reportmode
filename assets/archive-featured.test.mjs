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

test("spotlight layout has responsive and selected-star states", () => {
  const css = fs.readFileSync(path.join(root, "../src/styles/magazine.css"), "utf8");
  assert.match(css, /\.archive-spotlight\s*{/);
  assert.match(css, /\.archive-spotlight-grid\s*{/);
  assert.match(css, /\.archive-admin-feature\.is-featured/);
  assert.match(css, /@media \(max-width: 767px\)[\s\S]*\.archive-spotlight-grid\s*{[^}]*grid-template-columns:\s*1fr/s);
});
