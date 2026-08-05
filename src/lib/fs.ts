import fs from "node:fs";
import path from "node:path";

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function writeText(file: string, content: string) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content, "utf8");
}

export function readText(file: string): string {
  return fs.readFileSync(file, "utf8");
}

export function exists(file: string): boolean {
  return fs.existsSync(file);
}

export function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

