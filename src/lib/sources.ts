import fs from "node:fs";
import path from "node:path";
import { nowIsoKst } from "./time.js";
import { ensureDir, writeText } from "./fs.js";
import { runtimeDir } from "./paths.js";

export type CollectedSource = {
  id: string;
  title: string;
  publisher: string;
  url: string;
  accessedAt: string;
  excerpt: string;
  note?: string;
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function guessTitle(text: string, fallback: string): string {
  const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m?.[1]) return stripHtml(m[1]).slice(0, 180) || fallback;
  return fallback;
}

function guessPublisher(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export async function collectUrls(urls: string[]): Promise<CollectedSource[]> {
  const out: CollectedSource[] = [];
  const stamp = Date.now();
  ensureDir(runtimeDir("sources"));

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "user-agent":
            "ReportMode/1.0 (+https://aihubos.github.io/reportmode; research)",
          accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        },
      });
    } catch (err) {
      throw new Error(
        `출처 수집 실패: ${url} (네트워크 오류: ${(err as Error).message})`,
      );
    }
    if (!res.ok) {
      throw new Error(`출처 수집 실패: ${url} (HTTP ${res.status})`);
    }
    const html = await res.text();
    const text = stripHtml(html).slice(0, 6000);
    const source: CollectedSource = {
      id: `s${i + 1}`,
      title: guessTitle(html, url),
      publisher: guessPublisher(url),
      url,
      accessedAt: nowIsoKst(),
      excerpt: text,
    };
    writeText(
      runtimeDir("sources", `${stamp}-${i + 1}.json`),
      JSON.stringify(source, null, 2),
    );
    out.push(source);
  }
  return out;
}

export function collectFiles(files: string[]): string {
  return files
    .map((f) => {
      const abs = path.resolve(f);
      if (!fs.existsSync(abs)) {
        throw new Error(`로컬 파일이 없습니다: ${f}`);
      }
      return `# FILE: ${abs}\n${fs.readFileSync(abs, "utf8")}`;
    })
    .join("\n\n");
}

