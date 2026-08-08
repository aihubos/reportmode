import fs from "node:fs";
import path from "node:path";
import { ensureDir } from "./fs.js";
import { nowIsoKst } from "./time.js";

export type RevisionFile = {
  name: string;
  content: string | Uint8Array;
};

function nextRevision(historyDir: string): number {
  if (!fs.existsSync(historyDir)) return 1;
  const latest = fs
    .readdirSync(historyDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{6}$/.test(entry.name))
    .map((entry) => Number(entry.name))
    .reduce((max, value) => Math.max(max, value), 0);
  return latest + 1;
}

export function appendRevision(
  historyDir: string,
  reason: string,
  files: RevisionFile[],
): string {
  ensureDir(historyDir);
  const revision = nextRevision(historyDir);
  const revisionName = String(revision).padStart(6, "0");
  const revisionDir = path.join(historyDir, revisionName);
  fs.mkdirSync(revisionDir);

  for (const file of files) {
    fs.writeFileSync(path.join(revisionDir, file.name), file.content, {
      flag: "wx",
    });
  }
  fs.writeFileSync(
    path.join(revisionDir, "revision.json"),
    JSON.stringify(
      {
        schemaVersion: 1,
        revision,
        archivedAt: nowIsoKst(),
        reason,
        files: files.map((file) => file.name),
      },
      null,
      2,
    ) + "\n",
    { encoding: "utf8", flag: "wx" },
  );

  return revisionDir;
}
