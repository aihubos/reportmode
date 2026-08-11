import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(root, "src", "site", "assets", "archive-private-library.js");
const stylePath = path.join(root, "src", "site", "assets", "archive-private-library.css");

test("private archive library authenticates before loading protected metadata", () => {
  assert.equal(fs.existsSync(scriptPath), true);
  if (!fs.existsSync(scriptPath)) return;
  const script = fs.readFileSync(scriptPath, "utf8");
  assert.match(script, /reportmode:private-session/);
  assert.match(script, /\/private-session/);
  assert.match(script, /\/private-reports/);
  assert.match(script, /Authorization/);
  assert.match(script, /Bearer/);
  assert.match(script, /sessionStorage/);
  assert.match(script, /private_session_expired/);
  assert.match(script, /dataset\.privateReport/);
  assert.match(script, /URLSearchParams/);
  assert.doesNotMatch(script, /657700/);
});

test("private archive library uses the Report Hub token contract and responsive states", () => {
  assert.equal(fs.existsSync(stylePath), true);
  if (!fs.existsSync(stylePath)) return;
  const style = fs.readFileSync(stylePath, "utf8");
  assert.match(style, /\.archive-private-auth/);
  assert.match(style, /\.archive-private-post/);
  assert.match(style, /var\(--rh-primary\)/);
  assert.match(style, /var\(--rh-border\)/);
  assert.match(style, /\.archive-taxonomy-card/);
  assert.match(style, /is-mobile-panel-taxonomy/);
  assert.match(style, /@media \(max-width: 860px\)/);
  assert.match(style, /@media \(max-width: 700px\)/);
  assert.doesNotMatch(style, /#[0-9a-f]{3,8}\b/i);
});
