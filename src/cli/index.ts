#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { buildArchive, buildSite } from "../lib/build.js";
import { loadConfig } from "../lib/config.js";
import {
  listReportsNewestFirst,
  loadReport,
  toManifestItem,
} from "../lib/store.js";
import { ReportDocumentSchema } from "../schema/report.js";
import { runGenerate, runImport } from "../pipeline/generate.js";
import { publishReport } from "../pipeline/publish.js";
import { listProviders } from "../providers/index.js";
import { startStudio } from "../studio/server.js";

const program = new Command();
program
  .name("reportmode")
  .description("Report Mode — magazine reports for Hermes, Codex, and company APIs")
  .version("1.0.0");

program
  .command("build")
  .description("로컬 보고서 HTML/홈/manifest 생성")
  .action(() => {
    const result = buildSite({
      legacyRedirects: [
        {
          from: "apple-foldable-iphone",
          toId: "260802-apple-foldable-iphone",
          title: "Apple 폴더블 iPhone",
        },
      ],
    });
    console.log(
      JSON.stringify(
        {
          ok: true,
          reportCount: result.reportCount,
          home: result.home,
          manifest: result.manifest,
        },
        null,
        2,
      ),
    );
  });

program
  .command("archive-build")
  .description("기존 보고서 파일은 건드리지 않고 아카이브와 manifest만 생성")
  .action(() => {
    const result = buildArchive();
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  });

program
  .command("list")
  .description("로컬 보고서와 공개 URL 목록")
  .action(() => {
    const items = listReportsNewestFirst().map(toManifestItem);
    console.log(JSON.stringify({ count: items.length, reports: items }, null, 2));
  });

program
  .command("create")
  .description("주제·공급자·출처로 보고서 생성 후 자동 공개")
  .requiredOption("--topic <topic>", "보고서 주제")
  .option("--purpose <purpose>", "작성 목적", "의사결정 지원 보고서")
  .option("--audience <audience>", "독자", "경영진")
  .option("--language <language>", "언어", "ko")
  .option("--category <category>", "분류")
  .option("--url <url>", "출처 URL (반복 가능)", (v, acc: string[]) => {
    acc.push(v);
    return acc;
  }, [] as string[])
  .option("--file <path>", "로컬 파일 (반복 가능)", (v, acc: string[]) => {
    acc.push(v);
    return acc;
  }, [] as string[])
  .option("--notes <notes>", "추가 메모", "")
  .option(
    "--provider <provider>",
    `공급자 (${listProviders().join("|")})`,
    loadConfig().defaultProvider,
  )
  .option("--model <model>", "모델명")
  .option("--author <author>", "작성자")
  .option("--draft", "공개하지 않고 로컬 초안만 저장", false)
  .option("--document <path>", "agent 모드용 ReportDocument JSON 경로")
  .action(async (opts) => {
    try {
      const document = opts.document
        ? ReportDocumentSchema.parse(
            JSON.parse(fs.readFileSync(path.resolve(opts.document), "utf8")),
          )
        : undefined;
      const result = await runGenerate({
        topic: opts.topic,
        purpose: opts.purpose,
        audience: opts.audience,
        language: opts.language,
        category: opts.category,
        urls: opts.url,
        files: opts.file,
        notes: opts.notes,
        provider: opts.provider,
        model: opts.model,
        author: opts.author,
        draft: Boolean(opts.draft),
        document,
      });
      printResult(result);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("import")
  .description("Hermes/Codex ReportDocument JSON을 가져와 렌더/공개")
  .argument("<jsonPath>", "ReportDocument JSON 파일 경로")
  .option("--draft", "공개하지 않고 로컬 초안만 저장", false)
  .option("--id <id>", "기존 id 유지/지정")
  .action(async (jsonPath, opts) => {
    try {
      const raw = JSON.parse(fs.readFileSync(path.resolve(jsonPath), "utf8"));
      const document = ReportDocumentSchema.parse(raw);
      let preserveCreatedAt: string | undefined;
      if (opts.id) {
        try {
          preserveCreatedAt = loadReport(opts.id).createdAt;
        } catch {
          preserveCreatedAt = document.createdAt;
        }
      }
      const result = await runImport(document, {
        draft: Boolean(opts.draft),
        preserveId: opts.id,
        preserveCreatedAt,
      });
      printResult(result);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("update")
  .description("기존 보고서를 수정하고 createdAt을 보존")
  .argument("<id>", "보고서 id")
  .option("--document <path>", "새 ReportDocument JSON 경로")
  .option("--topic <topic>", "새 주제 (API 재생성 시)")
  .option("--purpose <purpose>", "작성 목적", "기존 보고서 업데이트")
  .option("--audience <audience>", "독자", "경영진")
  .option("--language <language>", "언어")
  .option("--category <category>", "분류")
  .option("--url <url>", "출처 URL", (v, acc: string[]) => {
    acc.push(v);
    return acc;
  }, [] as string[])
  .option("--file <path>", "로컬 파일", (v, acc: string[]) => {
    acc.push(v);
    return acc;
  }, [] as string[])
  .option("--notes <notes>", "추가 메모", "")
  .option("--provider <provider>", "공급자")
  .option("--model <model>", "모델명")
  .option("--draft", "공개하지 않음", false)
  .action(async (id, opts) => {
    try {
      const existing = loadReport(id);
      if (opts.document) {
        const document = ReportDocumentSchema.parse(
          JSON.parse(fs.readFileSync(path.resolve(opts.document), "utf8")),
        );
        const result = await runImport(
          { ...document, id, createdAt: existing.createdAt },
          {
            draft: Boolean(opts.draft),
            preserveId: id,
            preserveCreatedAt: existing.createdAt,
          },
        );
        printResult(result);
        return;
      }
      const result = await runGenerate(
        {
          topic: opts.topic || existing.title,
          purpose: opts.purpose,
          audience: opts.audience,
          language: opts.language || existing.language,
          category: opts.category || existing.category,
          urls: opts.url,
          files: opts.file,
          notes: opts.notes,
          provider: opts.provider || existing.provider || "agent",
          model: opts.model,
          draft: Boolean(opts.draft),
          document: opts.provider === "agent" || !opts.provider ? existing : undefined,
        },
        { preserveId: id, preserveCreatedAt: existing.createdAt },
      );
      printResult(result);
    } catch (err) {
      fail(err);
    }
  });

program
  .command("retry-publish")
  .description("생성은 끝났지만 공개가 실패한 보고서를 다시 공개")
  .argument("<id>", "보고서 id")
  .action(async (id) => {
    try {
      const pub = await publishReport(id);
      console.log(
        JSON.stringify(
          {
            ok: true,
            id,
            publicUrl: pub.publicUrl,
            commitSha: pub.commitSha,
            pagesStatus: pub.pagesStatus,
          },
          null,
          2,
        ),
      );
    } catch (err) {
      fail(err);
    }
  });

program
  .command("studio")
  .description("로컬 작성 화면 실행")
  .option("--port <port>", "포트", "8787")
  .action(async (opts) => {
    await startStudio(Number(opts.port) || 8787);
  });

function printResult(result: {
  document: { id: string; title: string; createdAt: string; sources: unknown[] };
  publicUrl?: string;
  commitSha?: string;
  pagesStatus?: string;
  localPreviewPath?: string;
  localPreviewUrl?: string;
  published: boolean;
  draft: boolean;
}) {
  const item = toManifestItem(result.document as any);
  console.log(
    JSON.stringify(
      {
        ok: true,
        draft: result.draft,
        published: result.published,
        id: result.document.id,
        title: result.document.title,
        createdAt: result.document.createdAt,
        displayDate: item.displayDate,
        sourceCount: result.document.sources.length,
        publicUrl: result.publicUrl,
        localPreviewPath: result.localPreviewPath,
        localPreviewUrl: result.localPreviewUrl,
        commitSha: result.commitSha,
        pagesStatus: result.pagesStatus,
      },
      null,
      2,
    ),
  );
}

function fail(err: unknown): never {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

program.parseAsync(process.argv);
