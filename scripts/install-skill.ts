#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = (process.argv[2] || "both").toLowerCase();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "skills", "report-mode");

function copySkill(dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true, force: true });
  console.log(`installed -> ${dest}`);
}

if (!["codex", "hermes", "both"].includes(target)) {
  console.error("usage: npm run skill:install -- codex|hermes|both");
  process.exit(1);
}

if (target === "codex" || target === "both") {
  copySkill(path.join(os.homedir(), ".codex", "skills", "report-mode"));
}
if (target === "hermes" || target === "both") {
  copySkill(
    path.join(os.homedir(), ".hermes", "skills", "reporting", "report-mode"),
  );
}

