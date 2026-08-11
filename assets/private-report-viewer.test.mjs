import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagePath = path.join(root, "archive", "private", "index.html");
const scriptPath = path.join(root, "src", "site", "assets", "private-report-viewer.js");
const stylePath = path.join(root, "src", "site", "assets", "private-report-viewer.css");

test("private report viewer ships only a noindex authentication shell", () => {
  assert.equal(fs.existsSync(pagePath), true);
  if (!fs.existsSync(pagePath)) return;
  const page = fs.readFileSync(pagePath, "utf8");
  assert.match(page, /name="robots" content="noindex, nofollow"/);
  assert.match(page, /id="privateViewerGate"/);
  assert.match(page, /id="privateViewerFrame"/);
  assert.match(page, /private-report-viewer\.js/);
  assert.match(page, /private-report-viewer\.css/);
  assert.doesNotMatch(page, /657700/);
  assert.doesNotMatch(page, /보호된 본문/);
});

test("private report viewer requires a session before requesting content", () => {
  assert.equal(fs.existsSync(scriptPath), true);
  if (!fs.existsSync(scriptPath)) return;
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /reportmode:private-session/);
  assert.match(script, /function loadReport\(\)[\s\S]*?if \(!state\.token\)[\s\S]*?openGate/);
  assert.match(script, /reportPath \+ "\/content"/);
  assert.match(script, /Authorization/);
  assert.match(script, /frame\.srcdoc/);
  assert.match(script, /allow-scripts allow-forms allow-popups allow-downloads allow-modals/);
  assert.doesNotMatch(script, /allow-same-origin/);
  assert.match(script, /private_session_expired/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.doesNotMatch(script, /657700/);
});

test("private report viewer styles use only Report Hub tokens", () => {
  assert.equal(fs.existsSync(stylePath), true);
  if (!fs.existsSync(stylePath)) return;
  const style = fs.readFileSync(stylePath, "utf8");
  assert.match(style, /\.private-viewer-gate/);
  assert.match(style, /\.private-viewer-frame/);
  assert.match(style, /var\(--rh-primary\)/);
  assert.match(style, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(style, /#[0-9a-f]{3,8}\b/i);
});
