import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../lib/config.js";
import { writeText } from "../lib/fs.js";
import { repoRoot } from "../lib/paths.js";
import { listReportsNewestFirst, toManifestItem } from "../lib/store.js";

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: Record<string, unknown>,
) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > 2_000_000) throw new Error("스킬 내용이 너무 큽니다.");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function installHermesSkill(body: Record<string, unknown>) {
  const slug = String(body.slug || "").trim();
  const markdown = String(body.markdown || "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Hermes 스킬 이름은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  }
  if (!markdown.startsWith("---\n") || !markdown.includes("\nname: " + slug + "\n")) {
    throw new Error("생성된 SKILL.md의 이름과 설치할 스킬 이름이 일치하지 않습니다.");
  }
  const target = path.join(
    os.homedir(),
    ".hermes",
    "skills",
    "reporting",
    slug,
    "SKILL.md",
  );
  writeText(target, markdown.endsWith("\n") ? markdown : markdown + "\n");
  return target;
}

function contentType(filePath: string): string {
  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return types[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function resolveStatic(pathname: string): string | null {
  const root = repoRoot();
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "") || "index.html";
  let target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    target = path.join(target, "index.html");
  }
  return fs.existsSync(target) && fs.statSync(target).isFile() ? target : null;
}

export async function startStudio(port: number) {
  const config = loadConfig();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));

      if (req.method === "GET" && url.pathname === "/api/list") {
        const reports = listReportsNewestFirst().map(toManifestItem);
        sendJson(res, 200, { reports, siteBase: config.siteBase });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/skill/install") {
        const body = await readJson(req);
        const target = installHermesSkill(body);
        sendJson(res, 200, {
          ok: true,
          slug: String(body.slug),
          path: target,
        });
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        sendJson(res, 405, { ok: false, error: "지원하지 않는 요청입니다." });
        return;
      }

      const filePath = resolveStatic(url.pathname);
      if (!filePath) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "content-type": contentType(filePath),
        "cache-control": "no-store",
      });
      if (req.method === "HEAD") {
        res.end();
      } else {
        res.end(fs.readFileSync(filePath));
      }
    } catch (error) {
      sendJson(res, 400, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log("Report Mode Skill Builder: http://127.0.0.1:" + port);
    console.log("완료 버튼에서 SKILL.md 다운로드 또는 Hermes 직접 적용이 가능합니다.");
  });
}
