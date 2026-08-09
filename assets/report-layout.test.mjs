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
  assert.match(script, /report-hub-brand\.js\?v=20260809-rh8/);
  assert.match(script, /querySelector\("\.report-hub-floating-menu"\)/);
  assert.match(css, /\.report-layout-buttons[^}]*width:\s*156px/);
});

test("shared report actions place copy beside PDF and expose the report view count", () => {
  const script = fs.readFileSync(new URL("./report-page-layout.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");

  assert.match(script, /function ensureReportActions\(/);
  assert.match(script, /id = "report-pdf-button"/);
  assert.match(script, /id = "report-share-button"/);
  assert.match(script, /function reportActionIconMarkup\(/);
  assert.match(script, /report-action-icon/);
  assert.match(script, /setReportActionIcon\(pdf, "pdf"\)/);
  assert.match(script, /setReportActionIcon\(share, "share"\)/);
  assert.match(script, /setShareState\(share, "check"/);
  assert.doesNotMatch(script, /button\.textContent = "PDF 저장"/);
  assert.doesNotMatch(script, /share\.textContent = "공유"/);
  assert.match(script, /navigator\.clipboard\.writeText/);
  assert.match(script, /document\.execCommand\("copy"\)/);
  assert.match(script, /url\.search = ""/);
  assert.match(script, /url\.hash = ""/);
  assert.match(script, /data-report-view-count/);
  assert.match(script, /closest\("\.nav-wrap, \.floating-menu, \.topbar, \.toolbar, nav\.nav"\)/);
  assert.match(css, /\.report-sharing-tools/);
  assert.match(css, /\.report-share-button/);
  assert.match(css, /\.report-view-count-panel/);
  assert.match(css, /\.report-sharing-tools[^}]*grid-template-columns:\s*40px 40px minmax\(86px,auto\)/s);
  assert.match(css, /\.report-sharing-tools\s*>\s*#report-pdf-button,[\s\S]*?width:\s*40px\s*!important;[\s\S]*?height:\s*40px\s*!important;/);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*\.report-view-switcher\s*{[^}]*margin-top:\s*96px\s*!important;[^}]*top:\s*154px\s*!important;/);
});

test("portrait mode deliberately reduces large report headings", () => {
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");
  assert.match(css, /body\.report-a4-mode h1[^}]*font-size:\s*clamp\(26px,4vw,36px\)/);
  assert.match(css, /body\.report-a4-mode h2[^}]*font-size:\s*clamp\(20px,3vw,28px\)/);
  assert.match(css, /body\.report-a4-mode h3[^}]*font-size:\s*clamp\(17px,2\.4vw,22px\)/);
});

test("portrait mode moves the shared menu into the right A4 gutter", () => {
  const css = fs.readFileSync(new URL("./report-hub-brand.css", import.meta.url), "utf8");
  assert.match(css, /@media \(min-width:\s*1280px\)[\s\S]*body\.report-a4-mode \.report-hub-floating-menu/);
  assert.match(css, /left:\s*calc\(50% \+ 105mm \+ var\(--rh-space-4\)\)/);
  assert.match(css, /width:\s*var\(--rh-a4-menu-width\)/);
  assert.match(css, /flex-direction:\s*column/);
});

test("portrait mode contains wide tables and media without clipping their content", () => {
  const script = fs.readFileSync(new URL("./report-page-layout.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");
  assert.match(script, /report-overflow-shell/);
  assert.match(script, /table, pre, iframe, canvas, video/);
  assert.match(css, /body\.report-a4-mode \.report-overflow-shell[^}]*overflow-x:\s*auto/);
  assert.match(css, /body\.report-a4-mode img[^}]*max-width:\s*100%/);
  assert.match(css, /body\.report-a4-mode \.hero-orbit[^}]*animation:\s*none\s*!important/);
  assert.match(css, /body\.report-a4-mode \.hero-orbit[^}]*aspect-ratio:\s*1/);
  assert.match(css, /body\.report-a4-mode :where\(a, button\)[^}]*min-width:\s*0/);
  assert.match(css, /body\.report-a4-mode \.source-grid[^}]*grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /body\.report-a4-mode \.usage-flow[^}]*grid-template-columns:\s*repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /body\.report-a4-mode \.visual-glow[^}]*inset-inline:\s*0/);
  assert.match(css, /body\.report-a4-mode :where\(\.table-wrap, \[class\*="table-wrap"\]/);
});

test("portrait mode keeps decorative hero elements inside the A4 sheet", () => {
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");
  assert.match(css, /body\.report-a4-mode \.orbit[^}]*max-width:\s*100%/);
  assert.match(css, /body\.report-a4-mode \.floating-note[^}]*right:\s*0\s*!important/);
  assert.match(css, /body\.report-a4-mode \.float-chip[^}]*display:\s*none\s*!important/);
  assert.match(css, /body\.report-a4-mode \.hero-specs[^}]*left:\s*0\s*!important/);
});
