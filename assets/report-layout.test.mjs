import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("shared layout removes manual orientation controls and keeps one responsive mode", () => {
  const script = fs.readFileSync(new URL("./report-page-layout.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");

  assert.match(script, /className = "report-view-icon"/);
  assert.match(script, /data-report-view-target/);
  assert.match(script, /body\.dataset\.reportLayout = "responsive"/);
  assert.match(script, /body\.classList\.remove\("report-a4-mode"\)/);
  assert.match(script, /@page \{ size: A4 landscape/);
  assert.doesNotMatch(script, /aria-label="가로 보기"|aria-label="세로 보기"|data-report-layout="a4"/);
  assert.match(script, /report-hub-brand\.js\?v=20260810-mobile-scroll1/);
  assert.match(script, /querySelector\("\.report-hub-floating-menu"\)/);
  assert.doesNotMatch(css, /\.report-layout-buttons|\.report-layout-button|body\.report-a4-mode/);
  assert.match(css, /@page \{ size: A4 landscape/);
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
  assert.match(
    script,
    /var direct = document\.getElementById\("report-pdf-button"\);\s*if \(direct && !direct\.closest\("\.nav-wrap, \.floating-menu, \.topbar, \.toolbar, nav\.nav"\)\) return direct;/,
  );
  assert.match(script, /closest\("\.nav-wrap, \.floating-menu, \.topbar, \.toolbar, nav\.nav"\)/);
  assert.match(css, /\.report-sharing-tools/);
  assert.match(css, /\.report-share-button/);
  assert.match(css, /\.report-view-count-panel/);
  assert.match(css, /\.report-sharing-tools[^}]*grid-template-columns:\s*40px 40px minmax\(86px,auto\)/s);
  assert.match(css, /\.report-sharing-tools\s*>\s*#report-pdf-button,[\s\S]*?width:\s*40px\s*!important;[\s\S]*?height:\s*40px\s*!important;/);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*\.report-view-switcher\s*{[^}]*margin-top:\s*96px\s*!important;[^}]*top:\s*154px\s*!important;/);
});

test("mobile responsive mode contains wide tables and media without page overflow", () => {
  const script = fs.readFileSync(new URL("./report-page-layout.js", import.meta.url), "utf8");
  const css = fs.readFileSync(new URL("./report-page-layout.css", import.meta.url), "utf8");
  assert.match(script, /report-overflow-shell/);
  assert.match(script, /table, pre, iframe, canvas, video/);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*html, body \{[^}]*overflow-x:\s*clip/);
  assert.match(css, /\.report-overflow-shell \{[^}]*overflow-x:\s*auto/);
  assert.match(css, /body :where\(img, video, canvas, svg\)[^}]*max-width:\s*100%/);
  assert.match(css, /body :where\(\.table-wrap, \[class\*="table-wrap"\]/);
  assert.match(css, /body :where\(main, \.wrap, \.container, \.report-section, \.page, \.slide-shell\)[^}]*max-width:\s*100%/);
});
