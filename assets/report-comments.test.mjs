import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("shared comments asset provides required identity and inline edit/delete states", () => {
  const scriptUrl = new URL("./report-comments.js", import.meta.url);
  const styleUrl = new URL("./report-comments.css", import.meta.url);
  assert.equal(fs.existsSync(scriptUrl), true, "report-comments.js must exist");
  assert.equal(fs.existsSync(styleUrl), true, "report-comments.css must exist");
  if (!fs.existsSync(scriptUrl) || !fs.existsSync(styleUrl)) return;

  const script = fs.readFileSync(scriptUrl, "utf8");
  const css = fs.readFileSync(styleUrl, "utf8");
  assert.match(script, /신청자 이름|작성자 이름/);
  assert.match(script, /수정·삭제 비밀번호/);
  assert.match(script, /data-comment-action="edit"/);
  assert.match(script, /data-comment-action="delete"/);
  assert.match(script, /method:\s*"PATCH"/);
  assert.match(script, /method:\s*"DELETE"/);
  assert.match(script, /report-history/);
  assert.match(script, /item\.id = "comment-" \+ comment\.id/);
  assert.match(script, /window\.addEventListener\("hashchange"/);
  assert.match(script, /scrollIntoView/);
  assert.doesNotMatch(script, /\bprompt\s*\(|\balert\s*\(/);
  assert.match(css, /\.report-comments/);
  assert.match(css, /\.report-comments\s*\{[^}]*width:\s*min\(1120px,\s*calc\(100% - 40px\)\)/s);
  assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.report-comments\s*\{[^}]*width:\s*min\(100% - 24px,\s*1120px\)/s);
  assert.match(css, /\.report-comment-admin-badge/);
  assert.match(css, /\.report-comment\.is-targeted/);
  assert.match(css, /:focus-visible/);
});
