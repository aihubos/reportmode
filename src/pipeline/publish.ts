import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { ensureDir, writeText } from "../lib/fs.js";
import { contentReportPath, publicReportPath, repoRoot } from "../lib/paths.js";
import { loadReport, saveReport, toManifestItem } from "../lib/store.js";
import { nowIsoKst } from "../lib/time.js";

function runFile(file: string, args: string[], cwd: string): string {
  return execFileSync(file, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runGit(args: string[], cwd: string): string {
  return runFile("git", args, cwd);
}

function copyTree(src: string, dest: string) {
  ensureDir(path.dirname(dest));
  fs.cpSync(src, dest, { recursive: true, force: true });
}

function githubRepositoryFromRemote(remoteUrl: string): string {
  const cleaned = remoteUrl.trim().replace(/\.git$/, "");
  const httpsMatch = cleaned.match(/github\.com\/([^/]+\/[^/]+)$/);
  if (httpsMatch?.[1]) return httpsMatch[1];
  const sshMatch = cleaned.match(/github\.com:([^/]+\/[^/]+)$/);
  if (sshMatch?.[1]) return sshMatch[1];
  throw new Error(`GitHub 저장소 주소를 해석할 수 없습니다: ${remoteUrl}`);
}

async function waitForPagesCommit(args: {
  repository: string;
  commitSha: string;
  seconds: number;
  intervalMs: number;
}): Promise<"built"> {
  const deadline = Date.now() + args.seconds * 1000;
  let lastCommit = "unknown";
  let lastStatus = "unknown";

  while (Date.now() < deadline) {
    try {
      const out = runFile(
        "gh",
        ["api", `repos/${args.repository}/pages/builds/latest`],
        repoRoot(),
      );
      const latest = JSON.parse(out) as { commit?: string; status?: string };
      lastCommit = latest.commit || "unknown";
      lastStatus = latest.status || "unknown";
      if (lastCommit === args.commitSha && lastStatus === "built") {
        return "built";
      }
      if (lastCommit === args.commitSha && lastStatus === "errored") {
        throw new Error("GitHub Pages 빌드가 실패했습니다.");
      }
    } catch (error) {
      if ((error as Error).message.includes("빌드가 실패")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
  }

  throw new Error(
    `Pages 완료 대기 시간 초과: commit=${lastCommit}, status=${lastStatus}`,
  );
}

async function waitForLiveReport(args: {
  url: string;
  title: string;
  displayDate: string;
  commitSha: string;
  seconds: number;
  intervalMs: number;
}): Promise<void> {
  const deadline = Date.now() + args.seconds * 1000;
  let lastError = "공개 페이지가 아직 준비되지 않았습니다.";

  while (Date.now() < deadline) {
    try {
      const separator = args.url.includes("?") ? "&" : "?";
      const cacheBustedUrl = `${args.url}${separator}commit=${args.commitSha}`;
      const response = await fetch(cacheBustedUrl, {
        headers: { "cache-control": "no-cache" },
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        const html = await response.text();
        if (html.includes(args.title) && html.includes(args.displayDate)) return;
        lastError = "공개 페이지에 새 제목 또는 날짜가 보이지 않습니다.";
      }
    } catch (error) {
      lastError = (error as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, args.intervalMs));
  }

  throw new Error(`Pages 본문 확인 실패: ${lastError}`);
}

function syncPublishedFilesFromClone(tmp: string, id: string) {
  const root = repoRoot();
  copyTree(
    path.join(tmp, "content", "reports", id),
    path.join(root, "content", "reports", id),
  );
  copyTree(
    path.join(tmp, "reports", id),
    path.join(root, "reports", id),
  );
  copyTree(
    path.join(tmp, "archive", "index.html"),
    path.join(root, "archive", "index.html"),
  );
  copyTree(
    path.join(tmp, "reports", "manifest.json"),
    path.join(root, "reports", "manifest.json"),
  );
  copyTree(path.join(tmp, "index.html"), path.join(root, "index.html"));
}

export async function publishReport(id: string): Promise<{
  publicUrl: string;
  commitSha: string;
  pagesStatus: string;
}> {
  const config = loadConfig();
  const root = repoRoot();
  const sourceDocument = loadReport(id);
  const publishedDocument = {
    ...sourceDocument,
    status: "published" as const,
    updatedAt: nowIsoKst(),
  };
  const remoteUrl = runGit(
    ["remote", "get-url", config.publish.remote],
    root,
  );
  const repository = githubRepositoryFromRemote(remoteUrl);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reportmode-publish-"));

  try {
    runGit(
      [
        "clone",
        "--branch",
        config.publish.branch,
        "--single-branch",
        remoteUrl,
        tmp,
      ],
      root,
    );

    copyTree(
      path.join(root, "content", "reports", id),
      path.join(tmp, "content", "reports", id),
    );
    writeText(
      path.join(tmp, "content", "reports", id, "report.json"),
      JSON.stringify(publishedDocument, null, 2) + "\n",
    );

    runFile("npm", ["ci", "--ignore-scripts"], tmp);
    runFile("npm", ["run", "build"], tmp);

    const stagedPaths = [
      path.join("content", "reports", id),
      path.join("reports", id, "index.html"),
      path.join("archive", "index.html"),
      path.join("reports", "manifest.json"),
      "index.html",
    ];
    runGit(["add", "--", ...stagedPaths], tmp);

    const staged = runGit(["diff", "--cached", "--name-only"], tmp);
    let commitSha: string;
    if (staged) {
      runGit(
        [
          "-c",
          "user.name=Report Mode",
          "-c",
          "user.email=reportmode@aihubos.local",
          "commit",
          "-m",
          `report: publish ${id}`,
        ],
        tmp,
      );
      try {
        runGit(["push", "origin", config.publish.branch], tmp);
      } catch (error) {
        throw new Error(
          `푸시 충돌 또는 권한 오류: ${(error as Error).message}. ` +
            `로컬 결과는 보존되어 있습니다. reportmode retry-publish ${id}`,
        );
      }
      commitSha = runGit(["rev-parse", "HEAD"], tmp);
    } else {
      commitSha = runGit(["rev-parse", "HEAD"], tmp);
    }

    const item = toManifestItem(publishedDocument);
    const pagesStatus = await waitForPagesCommit({
      repository,
      commitSha,
      seconds: config.publish.pagesPollSeconds,
      intervalMs: config.publish.pagesPollIntervalMs,
    });
    await waitForLiveReport({
      url: item.url,
      title: publishedDocument.title,
      displayDate: item.displayDate,
      commitSha,
      seconds: config.publish.pagesPollSeconds,
      intervalMs: config.publish.pagesPollIntervalMs,
    });

    syncPublishedFilesFromClone(tmp, id);
    saveReport(publishedDocument, { recordHistory: false });
    writeText(
      path.join(root, ".reportmode", "logs", `${id}-publish.json`),
      JSON.stringify(
        {
          at: nowIsoKst(),
          id,
          commitSha,
          pagesStatus,
          publicUrl: item.url,
        },
        null,
        2,
      ),
    );

    return { publicUrl: item.url, commitSha, pagesStatus };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
