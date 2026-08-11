import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "archive", "admin", "index.html");
const scriptPath = path.join(root, "assets", "archive-admin-console.js");
const stylePath = path.join(root, "assets", "archive-admin-console.css");
const sourceScriptPath = path.join(root, "src", "site", "assets", "archive-admin-console.js");
const sourceStylePath = path.join(root, "src", "site", "assets", "archive-admin-console.css");

test("archive administrator console provides analytics and bulk report controls", () => {
  assert.equal(fs.existsSync(pagePath), true);
  assert.equal(fs.existsSync(scriptPath), true);
  assert.equal(fs.existsSync(stylePath), true);
  if (!fs.existsSync(pagePath) || !fs.existsSync(scriptPath) || !fs.existsSync(stylePath)) return;

  const page = fs.readFileSync(pagePath, "utf8");
  const script = fs.readFileSync(scriptPath, "utf8");
  const style = fs.readFileSync(stylePath, "utf8");
  assert.match(page, /id="archiveAdminAnalytics"/);
  assert.match(page, /id="archiveAdminReportTable"/);
  assert.match(page, /id="archiveAdminEditDialog"/);
  assert.match(script, /\/admin\/analytics/);
  assert.match(script, /\/report-overrides\//);
  assert.match(script, /\/hidden-reports/);
  assert.match(script, /function reportPublicId\(report\)/);
  assert.match(script, /reportsByPublicId/);
  assert.match(script, /state\.counts\[reportPublicId\(report\)\]/);
  assert.match(script, /state\.reportsByPublicId\.get\(row\.reportId\)/);
  assert.match(script, /function reportUrl\(report\)[\s\S]*?var path = String\(\(report && report\.path\) \|\| ""\)[\s\S]*?if \(path\) return new URL\("\.\.\/\.\.\/" \+ path,/);
  assert.match(script, /관리자 비밀번호/);
  assert.doesNotMatch(script, /657700/);
  assert.match(script, /querySelectorAll\("\.archive-admin-console-table-wrap"\).*scrollLeft = 0/s);
  assert.match(style, /\.archive-admin-console-table/);
  assert.match(style, /\.archive-admin-console-panel \.archive-admin-console-table\s*\{\s*min-width:\s*100%;/);
  assert.match(style, /\.archive-admin-console-dashboard\s*\{[^}]*min-width:\s*0;/s);
  assert.match(style, /\.archive-admin-console-gate\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(style, /\.archive-admin-console-dashboard\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(style, /@media \(max-width: 700px\)/);
});

test("archive footer can open the full report management table after administrator unlock", () => {
  const script = fs.readFileSync(path.join(root, "assets", "archive-report-admin.js"), "utf8");
  assert.match(script, /archiveAdminConsoleLink/);
  assert.match(script, /전체 게시물 표 관리/);
});

test("administrator console manages private HTML reports only after protected session creation", () => {
  const page = fs.readFileSync(pagePath, "utf8");
  const script = fs.readFileSync(sourceScriptPath, "utf8");
  const style = fs.readFileSync(sourceStylePath, "utf8");
  assert.match(page, /id="archiveAdminPrivatePanel"/);
  assert.match(page, /id="archiveAdminPrivateTableBody"/);
  assert.match(page, /id="archiveAdminPrivateDialog"/);
  assert.match(page, /id="archiveAdminPrivateHtml"[^>]*type="file"[^>]*accept="text\/html/);
  assert.match(script, /\/private-session/);
  assert.match(script, /\/private-reports/);
  assert.match(script, /state\.privateToken/);
  assert.match(script, /Authorization/);
  assert.match(script, /new FormData/);
  assert.match(script, /method:\s*editing \? "PUT" : "POST"/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.match(script, /sessionStorage/);
  assert.doesNotMatch(script, /657700/);
  assert.match(style, /\.archive-admin-private-panel/);
  assert.match(style, /\.archive-admin-private-dialog/);
});
