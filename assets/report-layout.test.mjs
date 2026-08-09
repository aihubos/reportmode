import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("shared layout starts wide and uses equal-size icon segmented controls", () => {
  const script = fs.readFileSync(new URL("./report-page-layout.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");

  assert.match(script, /DEFAULT_LAYOUT = "wide"/);
  assert.match(script, /class="report-layout-icon"/);
  assert.match(script, /className = "report-view-icon"/);
  assert.match(script, /data-report-view-target/);
  assert.match(script, /aria-label="가로 보기"/);
  assert.match(script, /aria-label="세로 보기"/);
  assert.match(script, /report-hub-brand\.js\?v=20260809-rh1/);
  assert.match(css, /\.report-layout-buttons[^}]*width:\s*180px/);
  assert.match(css, /report-view-switcher-inner\s*>\s*\.report-view-buttons[^}]*width:\s*180px/);
  assert.match(css, /report-view-switcher-inner\s*>\s*\.report-view-buttons[^}]*padding:\s*3px/);
  assert.match(css, /report-view-buttons\s+\.report-view-button[^}]*width:\s*50%/);
});

test("portrait mode deliberately reduces large report headings", () => {
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");
  assert.match(css, /body\.report-a4-mode h1[^}]*font-size:\s*clamp\(28px,5vw,40px\)/);
  assert.match(css, /body\.report-a4-mode h2[^}]*font-size:\s*clamp\(22px,3\.5vw,32px\)/);
});
