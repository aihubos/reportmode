import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");

test("community board ships a shared static page and safe text rendering", () => {
  const source = fs.readFileSync(path.join(root, "src", "site", "board", "index.html"), "utf8");
  const script = fs.readFileSync(path.join(root, "src", "site", "assets", "community-board.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "src", "site", "assets", "community-board.css"), "utf8");

  assert.match(source, /class="community-board-page"/);
  assert.match(source, /id="board-post-dialog"/);
  assert.match(source, /id="board-comment-form"/);
  assert.match(source, /data-board-open-write/);
  assert.match(source, /Report Hub/);
  assert.match(script, /\/board\/posts/);
  assert.match(script, /history\.pushState/);
  assert.match(script, /popstate/);
  assert.match(script, /\.textContent = post\.content/);
  assert.match(script, /element\("p", "community-board-comment-content", comment\.content/);
  assert.doesNotMatch(script, /innerHTML\s*=\s*[^;]*content/);
  assert.match(script, /method: postId \? "PATCH" : "POST"/);
  assert.match(script, /method: "DELETE"/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /community-board-mobile-write/);
  assert.match(css, /overflow-wrap: anywhere/);
});

test("archive renderer exposes the board entry without removing the wishlist", () => {
  const render = fs.readFileSync(path.join(root, "src", "lib", "render.ts"), "utf8");
  assert.match(render, /archive-community-board-card/);
  assert.match(render, /\$\{linkPrefix\}board\//);
  assert.match(render, /id="request-board"/);
});
