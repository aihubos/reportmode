import fs from "node:fs";
import path from "node:path";
import { nowIsoKst } from "./time.js";
import { ensureDir, writeText } from "./fs.js";
import { runtimeDir } from "./paths.js";

export type CollectedSource = {
  id: string;
  kind: "web" | "local" | "note";
  title: string;
  publisher: string;
  url?: string;
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
      kind: "web",
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

export function collectFiles(
  files: string[],
  startIndex = 0,
): { sources: CollectedSource[]; text: string } {
  const sources = files.map((f, index) => {
      const abs = path.resolve(f);
      if (!fs.existsSync(abs)) {
        throw new Error(`로컬 파일이 없습니다: ${f}`);
      }
      const title = path.basename(abs);
      const excerpt = fs.readFileSync(abs, "utf8").slice(0, 6000);
      return {
        id: `s${startIndex + index + 1}`,
        kind: "local" as const,
        title,
        publisher: "Local file",
        accessedAt: nowIsoKst(),
        excerpt,
        note: "사용자가 제공한 로컬 자료",
      };
    });
  return {
    sources,
    text: sources
      .map((source) => `# FILE: ${source.title}\n${source.excerpt}`)
      .join("\n\n"),
  };
}

export function collectNote(
  notes: string,
  startIndex: number,
): CollectedSource | undefined {
  const excerpt = notes.trim();
  if (!excerpt) return undefined;
  return {
    id: `s${startIndex + 1}`,
    kind: "note",
    title: "사용자 제공 메모",
    publisher: "User-provided",
    accessedAt: nowIsoKst(),
    excerpt: excerpt.slice(0, 6000),
    note: "사용자가 직접 제공한 메모",
  };
}
