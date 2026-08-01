import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runGenerate, runImport } from "../pipeline/generate.js";
import { listProviders } from "../providers/index.js";
import { listReportsNewestFirst, toManifestItem } from "../lib/store.js";
import { ReportDocumentSchema } from "../schema/report.js";
import { loadConfig } from "../lib/config.js";

function studioHtml(): string {
  const providers = listProviders()
    .map((p) => '<option value="' + p + '">' + p + "</option>")
    .join("");

  return [
    "<!doctype html>",
    '<html lang="ko">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>Report Mode Studio</title>",
    "<style>",
    ":root{--ink:#171717;--muted:#666;--bg:#f4f1ea;--card:#fffdf8;--line:#ddd4c5;--accent:#0b3d91;--serif:\"Iowan Old Style\",Palatino,serif;--sans:system-ui,sans-serif}",
    "*{box-sizing:border-box}body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--ink)}",
    ".wrap{max-width:1100px;margin:0 auto;padding:32px 20px 64px}",
    "h1{font-family:var(--serif);font-size:48px;letter-spacing:-.04em;margin:0 0 8px}",
    ".sub{color:var(--muted);margin-bottom:28px}",
    ".grid{display:grid;grid-template-columns:1.1fr .9fr;gap:18px}",
    ".card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px}",
    "label{display:block;font-size:13px;font-weight:700;margin:12px 0 6px}",
    "input,textarea,select,button{width:100%;font:inherit}",
    "input,textarea,select{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}",
    "textarea{min-height:110px;resize:vertical}",
    "button{margin-top:16px;border:0;border-radius:12px;padding:14px 16px;background:var(--accent);color:#fff;font-weight:800;cursor:pointer}",
    "button.secondary{background:#222}",
    ".banner{background:#111;color:#fff;border-radius:12px;padding:12px 14px;font-size:14px;margin-bottom:12px}",
    ".status{white-space:pre-wrap;font-family:ui-monospace,monospace;font-size:12px;background:#111;color:#d8ffd8;border-radius:12px;padding:14px;min-height:180px}",
    "iframe{width:100%;height:70vh;border:1px solid var(--line);border-radius:12px;background:#fff}",
    ".row{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
    "@media(max-width:900px){.grid,.row{grid-template-columns:1fr}}",
    "</style>",
    "</head>",
    "<body>",
    '<div class="wrap">',
    "<h1>Report Mode Studio</h1>",
    "<p class=\"sub\">로컬 전용 작성기입니다. 생성 완료 시 즉시 GitHub Pages에 공개됩니다. API 키는 이 컴퓨터의 환경변수에서만 읽습니다.</p>",
    '<div class="grid">',
    '<section class="card">',
    '<div class="banner">완료 시 즉시 공개 · draft 체크 시에만 로컬 저장</div>',
    '<div class="row"><div><label>주제</label><input id="topic" placeholder="예: 폴더블 아이폰 구매 판단"></div><div><label>분류</label><input id="category" placeholder="제품 분석"></div></div>',
    '<div class="row"><div><label>독자</label><input id="audience" value="경영진"></div><div><label>목적</label><input id="purpose" value="의사결정 지원 보고서"></div></div>',
    '<div class="row"><div><label>공급자</label><select id="provider">' +
      providers +
      '</select></div><div><label>모델 (선택)</label><input id="model" placeholder="비우면 설정 기본값"></div></div>',
    '<label>출처 URL (줄마다 하나)</label><textarea id="urls" placeholder="https://example.com/article"></textarea>',
    '<label>추가 메모 / 붙여넣은 원문</label><textarea id="notes" placeholder="핵심 메모, 회의 내용, 붙여넣은 텍스트"></textarea>',
    '<label>agent 모드 JSON (선택)</label><textarea id="documentJson" placeholder="{ schemaVersion: 1, ... }"></textarea>',
    '<label><input id="draft" type="checkbox" style="width:auto;margin-right:8px"> draft로만 저장 (공개 안 함)</label>',
    '<button id="generate">보고서 생성 · 완료 시 즉시 공개</button>',
    '<button id="refresh" class="secondary">목록 새로고침</button>',
    '<div style="margin-top:14px" class="status" id="status">대기 중</div>',
    "</section>",
    '<section class="card">',
    "<label>미리보기 / 최근 결과</label>",
    '<iframe id="preview" title="preview"></iframe>',
    '<div id="list" style="margin-top:14px;color:var(--muted);font-size:14px"></div>',
    "</section>",
    "</div></div>",
    "<script>",
    "const statusEl=document.getElementById('status');",
    "const preview=document.getElementById('preview');",
    "const listEl=document.getElementById('list');",
    "async function refresh(){",
    "  const res=await fetch('/api/list');",
    "  const data=await res.json();",
    "  listEl.innerHTML=(data.reports||[]).map(function(r){",
    "    return '<div style=\"padding:8px 0;border-top:1px solid #eee\"><a href=\"' + r.url + '\" target=\"_blank\">' + r.displayDate + ' · ' + r.title + '</a></div>';",
    "  }).join('') || '보고서 없음';",
    "  if(data.reports && data.reports[0]) preview.src='/' + data.reports[0].path;",
    "}",
    "document.getElementById('refresh').onclick=refresh;",
    "document.getElementById('generate').onclick=async function(){",
    "  statusEl.textContent='생성 중...';",
    "  var urls=document.getElementById('urls').value.split(/\n+/).map(function(s){return s.trim();}).filter(Boolean);",
    "  var documentJson=document.getElementById('documentJson').value.trim();",
    "  var doc=undefined;",
    "  if(documentJson){ try{ doc=JSON.parse(documentJson);} catch(e){ statusEl.textContent='JSON 파싱 실패: '+e.message; return; } }",
    "  var body={",
    "    topic:document.getElementById('topic').value.trim(),",
    "    category:document.getElementById('category').value.trim()||undefined,",
    "    audience:document.getElementById('audience').value.trim(),",
    "    purpose:document.getElementById('purpose').value.trim(),",
    "    provider:document.getElementById('provider').value,",
    "    model:document.getElementById('model').value.trim()||undefined,",
    "    urls:urls,",
    "    notes:document.getElementById('notes').value,",
    "    draft:document.getElementById('draft').checked,",
    "    document:doc",
    "  };",
    "  try{",
    "    var res=await fetch('/api/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});",
    "    var data=await res.json();",
    "    statusEl.textContent=JSON.stringify(data,null,2);",
    "    if(data.publicUrl) preview.src=data.publicUrl;",
    "    await refresh();",
    "  }catch(e){ statusEl.textContent='오류: '+e.message; }",
    "};",
    "refresh();",
    "</script>",
    "</body></html>",
  ].join("\n");
}

export async function startStudio(port: number) {
  const config = loadConfig();
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://" + req.headers.host);
      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(studioHtml());
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/list") {
        const reports = listReportsNewestFirst().map(toManifestItem);
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ reports, siteBase: config.siteBase }));
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/generate") {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        let result;
        if (body.document) {
          const document = ReportDocumentSchema.parse(body.document);
          result = await runImport(document, { draft: Boolean(body.draft) });
        } else {
          result = await runGenerate({
            topic: body.topic,
            purpose: body.purpose || "의사결정 지원 보고서",
            audience: body.audience || "경영진",
            language: body.language || "ko",
            category: body.category,
            urls: body.urls || [],
            files: body.files || [],
            notes: body.notes || "",
            provider: body.provider || config.defaultProvider,
            model: body.model,
            draft: Boolean(body.draft),
          });
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            id: result.document.id,
            title: result.document.title,
            createdAt: result.document.createdAt,
            sourceCount: result.document.sources.length,
            publicUrl: result.publicUrl || toManifestItem(result.document).url,
            commitSha: result.commitSha,
            pagesStatus: result.pagesStatus,
            published: result.published,
            draft: result.draft,
          }),
        );
        return;
      }

      const rel = decodeURIComponent(url.pathname).replace(/^\//, "");
      const root = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../..",
      );
      const filePath = path.resolve(root, rel || "index.html");
      if (
        !filePath.startsWith(root) ||
        !fs.existsSync(filePath) ||
        fs.statSync(filePath).isDirectory()
      ) {
        const index = path.join(filePath, "index.html");
        if (fs.existsSync(index)) {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(fs.readFileSync(index));
          return;
        }
        res.writeHead(404).end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      const type =
        ext === ".html"
          ? "text/html; charset=utf-8"
          : ext === ".json"
            ? "application/json"
            : ext === ".css"
              ? "text/css"
              : "text/plain; charset=utf-8";
      res.writeHead(200, { "content-type": type });
      res.end(fs.readFileSync(filePath));
    } catch (err) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });

  server.listen(port, "127.0.0.1", () => {
    console.log("Report Mode Studio: http://127.0.0.1:" + port);
    console.log(
      "완료 시 즉시 공개 모드입니다. draft 체크 시에만 로컬 저장합니다.",
    );
  });
}
