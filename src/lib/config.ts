import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.js";

export type AppConfig = {
  siteBase: string;
  author: string;
  language: string;
  timezone: string;
  defaultProvider: string;
  providers: Record<
    string,
    {
      defaultModel?: string;
      envKey?: string;
      baseUrlEnv?: string;
      modelEnv?: string;
    }
  >;
  publish: {
    branch: string;
    remote: string;
    pagesPollSeconds: number;
    pagesPollIntervalMs: number;
  };
};

export function loadConfig(): AppConfig {
  const file = path.join(repoRoot(), "reportmode.config.json");
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as AppConfig;
  return {
    ...raw,
    siteBase: process.env.REPORTMODE_SITE_BASE || raw.siteBase,
    author: process.env.REPORTMODE_AUTHOR || raw.author,
    defaultProvider:
      process.env.REPORTMODE_DEFAULT_PROVIDER || raw.defaultProvider,
  };
}

