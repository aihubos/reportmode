import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("archive comment explorer provides recent, full, and direct-comment navigation", () => {
  const scriptUrl = new URL("./archive-comment-explorer.js", import.meta.url);
  assert.equal(fs.existsSync(scriptUrl), true, "archive-comment-explorer.js must exist");
  if (!fs.existsSync(scriptUrl)) return;

  const script = fs.readFileSync(scriptUrl, "utf8");
  assert.match(script, /\/comments\/recent/);
  assert.match(script, /archiveCommentsRecentList/);
  assert.match(script, /archiveAllCommentsList/);
  assert.match(script, /archiveCommentsOpenAll/);
  assert.match(script, /#comment-/);
  assert.match(script, /showModal/);
  assert.doesNotMatch(script, /\bprompt\s*\(|\balert\s*\(/);
});
