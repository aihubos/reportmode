import assert from "node:assert/strict";
import test from "node:test";

import worker from "./index.js";

type Post = {
  id: string;
  category: string;
  title: string;
  content: string;
  author: string;
  password_salt: string;
  password_hash: string;
  is_admin: number;
  view_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string | null;
};

type Comment = {
  id: string;
  post_id: string;
  author: string;
  content: string;
  password_salt: string;
  password_hash: string;
  is_admin: number;
  created_at: string;
  updated_at: string | null;
};

class FakePrepared {
  args: unknown[] = [];
  constructor(private db: FakeD1, private sql: string) {}
  bind(...args: unknown[]) { this.args = args; return this; }
  run() { return this.db.run(this.sql, this.args); }
  first<T>() { return this.db.first(this.sql, this.args) as Promise<T | null>; }
  all<T>() { return this.db.all(this.sql, this.args) as Promise<{ results: T[] }>; }
}

class FakeD1 {
  posts = new Map<string, Post>();
  comments = new Map<string, Comment>();
  views = new Set<string>();

  prepare(sql: string) { return new FakePrepared(this, sql); }

  async batch(statements: FakePrepared[]) {
    return Promise.all(statements.map((statement) => statement.run()));
  }

  async run(sql: string, args: unknown[]) {
    if (/INSERT INTO board_posts/i.test(sql)) {
      const [id, category, title, content, author, salt, hash, isAdmin, createdAt] = args;
      this.posts.set(String(id), {
        id: String(id), category: String(category), title: String(title), content: String(content),
        author: String(author), password_salt: String(salt), password_hash: String(hash),
        is_admin: Number(isAdmin), view_count: 0, comment_count: 0,
        created_at: String(createdAt), updated_at: null,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/INSERT INTO board_comments/i.test(sql)) {
      const [id, postId, author, content, salt, hash, isAdmin, createdAt] = args;
      this.comments.set(String(id), {
        id: String(id), post_id: String(postId), author: String(author), content: String(content),
        password_salt: String(salt), password_hash: String(hash), is_admin: Number(isAdmin),
        created_at: String(createdAt), updated_at: null,
      });
      const post = this.posts.get(String(postId));
      if (post) post.comment_count += 1;
      return { success: true, meta: { changes: 1 } };
    }
    if (/INSERT OR IGNORE INTO board_post_daily_views/i.test(sql)) {
      const [postId, visitorId, day] = args.map(String);
      const key = postId + ":" + visitorId + ":" + day;
      if (this.views.has(key)) return { success: true, meta: { changes: 0 } };
      this.views.add(key);
      const post = this.posts.get(postId);
      if (post) post.view_count += 1;
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE board_posts SET category/i.test(sql)) {
      const [category, title, content, author, isAdmin, updatedAt, id] = args;
      const post = this.posts.get(String(id));
      if (post) Object.assign(post, { category, title, content, author, is_admin: Number(isAdmin), updated_at: updatedAt });
      return { success: true, meta: { changes: post ? 1 : 0 } };
    }
    if (/DELETE FROM board_comments WHERE post_id/i.test(sql)) {
      const postId = String(args[0]);
      for (const [id, comment] of this.comments) if (comment.post_id === postId) this.comments.delete(id);
      return { success: true, meta: { changes: 1 } };
    }
    if (/DELETE FROM board_post_daily_views WHERE post_id/i.test(sql)) {
      const postId = String(args[0]);
      for (const key of this.views) if (key.startsWith(postId + ":")) this.views.delete(key);
      return { success: true, meta: { changes: 1 } };
    }
    if (/DELETE FROM board_posts WHERE id/i.test(sql)) {
      this.posts.delete(String(args[0]));
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE board_comments SET author/i.test(sql)) {
      const [author, content, isAdmin, updatedAt, id] = args;
      const comment = this.comments.get(String(id));
      if (comment) Object.assign(comment, { author, content, is_admin: Number(isAdmin), updated_at: updatedAt });
      return { success: true, meta: { changes: comment ? 1 : 0 } };
    }
    if (/DELETE FROM board_comments WHERE id/i.test(sql)) {
      const comment = this.comments.get(String(args[0]));
      if (comment) {
        this.comments.delete(String(args[0]));
        const post = this.posts.get(comment.post_id);
        if (post) post.comment_count = Math.max(0, post.comment_count - 1);
      }
      return { success: true, meta: { changes: 1 } };
    }
    throw new Error("Unhandled run SQL: " + sql);
  }

  async first<T>(sql: string, args: unknown[]) {
    if (/SELECT COUNT\(\*\) AS count FROM board_posts/i.test(sql)) {
      return { count: this.filteredPosts(args) .length } as T;
    }
    if (/FROM board_posts WHERE id = \?/i.test(sql)) return this.posts.get(String(args[0])) || null;
    if (/FROM board_comments WHERE id = \?/i.test(sql)) return this.comments.get(String(args[0])) || null;
    if (/SELECT view_count FROM board_posts/i.test(sql)) return this.posts.get(String(args[0])) || null;
    throw new Error("Unhandled first SQL: " + sql);
  }

  async all<T>(sql: string, args: unknown[]) {
    if (/FROM board_posts\s+WHERE/i.test(sql)) {
      const rows = this.filteredPosts(args)
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(Number(args[5]), Number(args[5]) + Number(args[4]))
        .map(({ password_salt, password_hash, ...post }) => post);
      return { results: rows as T[] };
    }
    if (/FROM board_comments WHERE post_id/i.test(sql)) {
      const rows = Array.from(this.comments.values())
        .filter((comment) => comment.post_id === String(args[0]))
        .sort((left, right) => left.created_at.localeCompare(right.created_at))
        .map(({ password_salt, password_hash, ...comment }) => comment);
      return { results: rows as T[] };
    }
    throw new Error("Unhandled all SQL: " + sql);
  }

  private filteredPosts(args: unknown[]) {
    const category = String(args[1] || "");
    const query = String(args[2] || "").toLocaleLowerCase();
    return Array.from(this.posts.values()).filter((post) => {
      const categoryMatches = !category || post.category === category;
      const haystack = (post.title + " " + post.content + " " + post.author).toLocaleLowerCase();
      return categoryMatches && (!query || haystack.includes(query));
    });
  }
}

function environment() {
  return { DB: new FakeD1(), ADMIN_PASSWORD: "admin-test-password" } as any;
}

async function call(environment: any, path: string, method = "GET", body?: unknown) {
  const response = await worker.fetch(new Request("https://board.test" + path, {
    method,
    headers: body
      ? { "Content-Type": "application/json", Origin: "https://aihubos.github.io" }
      : { Origin: "https://aihubos.github.io" },
    body: body ? JSON.stringify(body) : undefined,
  }), environment);
  return { response, json: await response.json() as any };
}

test("community board creates and reloads text-only posts without password fields", async () => {
  const env = environment();
  const created = await call(env, "/board/posts", "POST", {
    category: "ai_question", title: "AI 질문입니다",
    content: "보고서 내용을 읽고 궁금한 점을 남깁니다.", author: "방문자", password: "user-password",
  });
  assert.equal(created.response.status, 201);
  assert.equal("password_hash" in created.json.post, false);
  const id = created.json.post.id;
  const listed = await call(env, "/board/posts?category=ai_question&q=궁금한");
  assert.equal(listed.response.status, 200);
  assert.equal(listed.json.posts[0].id, id);
  assert.equal((await call(env, "/board/posts/" + id)).json.post.content, "보고서 내용을 읽고 궁금한 점을 남깁니다.");
});

test("community board protects edits and permits the administrator to remove a post", async () => {
  const env = environment();
  const created = await call(env, "/board/posts", "POST", {
    category: "free_opinion", title: "게시글 수정 테스트",
    content: "작성자가 나중에 고칠 수 있는 본문입니다.", author: "작성자", password: "user-password",
  });
  const id = created.json.post.id;
  const denied = await call(env, "/board/posts/" + id, "PATCH", {
    category: "free_opinion", title: "바뀐 제목",
    content: "바뀐 본문도 충분히 긴 내용입니다.", author: "작성자", password: "wrong-password",
  });
  assert.equal(denied.response.status, 403);
  const edited = await call(env, "/board/posts/" + id, "PATCH", {
    category: "free_opinion", title: "바뀐 제목",
    content: "바뀐 본문도 충분히 긴 내용입니다.", author: "작성자", password: "user-password",
  });
  assert.equal(edited.json.post.title, "바뀐 제목");
  assert.ok(edited.json.post.updated_at);
  assert.equal((await call(env, "/board/posts/" + id, "DELETE", { password: "admin-test-password" })).response.status, 200);
  assert.equal((await call(env, "/board/posts/" + id)).response.status, 404);
});

test("community board counts comments and deduplicates daily views", async () => {
  const env = environment();
  const created = await call(env, "/board/posts", "POST", {
    category: "report_opinion", title: "댓글과 조회수 테스트",
    content: "댓글 수와 조회수의 저장 동작을 확인하는 글입니다.", author: "방문자", password: "user-password",
  });
  const id = created.json.post.id;
  const firstView = await call(env, "/board/posts/" + id + "/views", "POST", { visitorId: "11111111-1111-4111-8111-111111111111" });
  const secondView = await call(env, "/board/posts/" + id + "/views", "POST", { visitorId: "11111111-1111-4111-8111-111111111111" });
  assert.equal(firstView.json.counted, true);
  assert.equal(secondView.json.counted, false);
  const createdComment = await call(env, "/board/posts/" + id + "/comments", "POST", {
    author: "댓글 작성자", content: "좋은 글입니다.", password: "comment-password",
  });
  assert.equal(createdComment.response.status, 201);
  assert.equal((await call(env, "/board/posts/" + id)).json.post.comment_count, 1);
  const commentId = createdComment.json.comment.id;
  assert.equal((await call(env, "/board/comments/" + commentId, "DELETE", { password: "comment-password" })).response.status, 200);
  assert.equal((await call(env, "/board/posts/" + id)).json.post.comment_count, 0);
});

test("community board reserves the administrator name", async () => {
  const result = await call(environment(), "/board/posts", "POST", {
    category: "free_opinion", title: "관리자 이름 보호",
    content: "관리자 이름을 일반 방문자가 사용할 수 없는지 확인합니다.",
    author: "Jeremy", password: "wrong-password",
  });
  assert.equal(result.response.status, 403);
  assert.equal(result.json.error, "reserved_admin_name");
});
