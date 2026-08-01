import { execFileSync, execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { ensureDir, writeText } from "../lib/fs.js";
import { loadReport, saveReport, toManifestItem } from "../lib/store.js";
import { buildSite } from "../lib/build.js";
import { repoRoot } from "../lib/paths.js";
import { nowIsoKst } from "../lib/time.js";

function run(cmd: string, cwd: string): string {
  return execSync(cmd, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runFile(file: string, args: string[], cwd: string): string {
  return execFileSync(file, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function copyTree(src: string, dest: string) {
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true, force: true });
}

async function waitForPagesBuilt(seconds: number, intervalMs: number) {
  const deadline = Date.now() + seconds * 1000;
  let last = "unknown";
  while (Date.now() < deadline) {
    try {
      const out = runFile("gh", ["api", "repos/aihubos/reportmode/pages"], repoRoot());
      const json = JSON.parse(out) as { status?: string; html_url?: string };
      last = json.status || "unknown";
      if (last === "built") return { status: last, htmlUrl: json.html_url };
    } catch {
      last = "poll_error";
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: last, htmlUrl: undefined as string | undefined };
}

export async function publishReport(id: string): Promise<{
  publicUrl: string;
  commitSha: string;
  pagesStatus: string;
}> {
  const config = loadConfig();
  const root = repoRoot();
  const doc = loadReport(id);

  // Rebuild public artifacts in the working tree first.
  buildSite({
    legacyRedirects: [
      {
        from: "apple-foldable-iphone",
        toId: "260802-apple-foldable-iphone",
        title: "Apple 폴더블 iPhone",
      },
    ],
  });

  // Fetch latest remote main into a temp clean worktree-like checkout.
  run(`git fetch ${config.publish.remote} ${config.publish.branch}`, root);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reportmode-publish-"));
  try {
    // Create temp directory content from remote main.
    run(
      `git archive --format=tar ${config.publish.remote}/${config.publish.branch} | tar -x -C "${tmp}"`,
      root,
    );

    // Copy only the intended publish artifacts into temp.
    const contentSrc = path.join(root, "content", "reports", id);
    const contentDest = path.join(tmp, "content", "reports", id);
    copyTree(contentSrc, contentDest);

    // Also copy full generated public reports/home/manifest from local build,
    // but only after re-building inside temp using local content merge.
    // Simpler approach: copy local generated public files for this report + regenerate index/manifest from local content list if present.
    // For correctness with remote history, rebuild using temp content only.
    // Copy engine needed files if missing in remote (first migration).
    for (const rel of [
      "package.json",
      "tsconfig.json",
      "reportmode.config.json",
      "src",
      "scripts",
      "skills",
      "THIRD_PARTY_NOTICES.md",
      "README.md",
      ".nojekyll",
      ".gitignore",
      ".env.example",
    ]) {
      const from = path.join(root, rel);
      if (fs.existsSync(from)) {
        copyTree(from, path.join(tmp, rel));
      }
    }

    // Copy all local content reports so home archive is complete for this machine's intended state.
    // But to avoid leaking unrelated local drafts, only copy reports that already exist remotely or this id.
    const localContentRoot = path.join(root, "content", "reports");
    const remoteContentRoot = path.join(tmp, "content", "reports");
    ensureDir(remoteContentRoot);
    if (fs.existsSync(localContentRoot)) {
      for (const name of fs.readdirSync(localContentRoot)) {
        const remoteHas = fs.existsSync(path.join(remoteContentRoot, name));
        if (name === id || remoteHas) {
          copyTree(
            path.join(localContentRoot, name),
            path.join(remoteContentRoot, name),
          );
        }
      }
    }

    // Build inside temp using tsx if node_modules available; otherwise use local built HTML copy.
    // Prefer copying generated public artifacts for selected reports from local after ensuring content is present.
    // Rebuild with local node_modules via npx tsx pointing at temp? Easier: run build with REPORTMODE root override.
    // We'll copy local public outputs for selected report ids and regenerate home/manifest via a lightweight local call on temp content by temporarily swapping CWD through env.
    // Practical approach: use current process build functions after chdir? Avoid. Copy local public files for all content ids present in temp.
    const ids = fs.readdirSync(remoteContentRoot);
    for (const reportId of ids) {
      const localPublic = path.join(root, "reports", reportId);
      if (fs.existsSync(localPublic)) {
        copyTree(localPublic, path.join(tmp, "reports", reportId));
      }
    }
    // Copy home + manifest from local latest build (based on local content which includes this report)
    copyTree(path.join(root, "index.html"), path.join(tmp, "index.html"));
    if (fs.existsSync(path.join(root, "reports", "manifest.json"))) {
      copyTree(
        path.join(root, "reports", "manifest.json"),
        path.join(tmp, "reports", "manifest.json"),
      );
    }
    // Preserve legacy redirect if present locally.
    const legacy = path.join(root, "reports", "apple-foldable-iphone");
    if (fs.existsSync(legacy)) {
      copyTree(legacy, path.join(tmp, "reports", "apple-foldable-iphone"));
    }

    // Init git in temp from remote main and commit.
    run("git init", tmp);
    run(`git remote add origin ${run("git remote get-url origin", root)}`, tmp);
    run(`git fetch origin ${config.publish.branch}`, tmp);
    run(`git checkout -B ${config.publish.branch} origin/${config.publish.branch}`, tmp);

    // Re-apply files after checkout.
    for (const rel of [
      "package.json",
      "tsconfig.json",
      "reportmode.config.json",
      "src",
      "scripts",
      "skills",
      "content",
      "reports",
      "index.html",
      "THIRD_PARTY_NOTICES.md",
      "README.md",
      ".nojekyll",
      ".gitignore",
      ".env.example",
    ]) {
      const from = path.join(root, rel);
      // For content/reports, prefer the filtered temp content we prepared earlier.
      if (rel === "content") {
        // already prepared in tmp/content before checkout may have been overwritten
        // rebuild filtered content
        fs.rmSync(path.join(tmp, "content"), { recursive: true, force: true });
        ensureDir(path.join(tmp, "content", "reports"));
        for (const reportId of ids) {
          copyTree(
            path.join(localContentRoot, reportId),
            path.join(tmp, "content", "reports", reportId),
          );
        }
        continue;
      }
      if (fs.existsSync(from)) copyTree(from, path.join(tmp, rel));
    }

    // Ensure we don't stage secrets / runtime.
    if (fs.existsSync(path.join(tmp, ".reportmode"))) {
      fs.rmSync(path.join(tmp, ".reportmode"), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(tmp, "node_modules"))) {
      fs.rmSync(path.join(tmp, "node_modules"), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(tmp, ".env"))) {
      fs.rmSync(path.join(tmp, ".env"), { force: true });
    }

    run("git add -A", tmp);
    const status = run("git status --porcelain", tmp);
    if (!status) {
      // nothing new; still treat as success if already published
      const item = toManifestItem(doc);
      return {
        publicUrl: item.url,
        commitSha: run("git rev-parse HEAD", tmp),
        pagesStatus: "built",
      };
    }

    run(`git -c user.name='Report Mode' -c user.email='reportmode@aihubos.local' commit -m "report: publish ${id}"`, tmp);

    try {
      run(`git push origin ${config.publish.branch}`, tmp);
    } catch (err) {
      throw new Error(
        `푸시 충돌 또는 권한 오류: ${(err as Error).message}. 로컬 결과는 보존되어 있습니다. reportmode retry-publish ${id}`,
      );
    }

    const commitSha = run("git rev-parse HEAD", tmp);
    const pages = await waitForPagesBuilt(
      config.publish.pagesPollSeconds,
      config.publish.pagesPollIntervalMs,
    );

    const item = toManifestItem(doc);
    // Verify live page when possible.
    try {
      const res = await fetch(item.url);
      if (!res.ok) {
        throw new Error(`공개 URL HTTP ${res.status}`);
      }
      const html = await res.text();
      if (!html.includes(doc.title) || !html.includes(item.displayDate)) {
        throw new Error("공개 페이지에 제목/날짜가 보이지 않습니다.");
      }
    } catch (err) {
      throw new Error(
        `Pages 확인 실패(${pages.status}): ${(err as Error).message}`,
      );
    }

    doc.status = "published";
    doc.updatedAt = nowIsoKst();
    saveReport(doc);
    buildSite({
      legacyRedirects: [
        {
          from: "apple-foldable-iphone",
          toId: "260802-apple-foldable-iphone",
          title: "Apple 폴더블 iPhone",
        },
      ],
    });

    writeText(
      path.join(root, ".reportmode", "logs", `${id}-publish.json`),
      JSON.stringify(
        {
          at: nowIsoKst(),
          id,
          commitSha,
          pagesStatus: pages.status,
          publicUrl: item.url,
        },
        null,
        2,
      ),
    );

    return {
      publicUrl: item.url,
      commitSha,
      pagesStatus: pages.status,
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

