import path from "node:path";
import { fileURLToPath } from "node:url";

export function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../..");
}

export function contentReportDir(id: string): string {
  return path.join(repoRoot(), "content", "reports", id);
}

export function contentReportPath(id: string): string {
  return path.join(contentReportDir(id), "report.json");
}

export function publicReportDir(id: string): string {
  return path.join(repoRoot(), "reports", id);
}

export function publicReportPath(id: string): string {
  return path.join(publicReportDir(id), "index.html");
}

export function runtimeDir(...parts: string[]): string {
  return path.join(repoRoot(), ".reportmode", ...parts);
}

