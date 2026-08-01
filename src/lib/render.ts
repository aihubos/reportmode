import fs from "node:fs";
import path from "node:path";
import type { ManifestItem, ReportDocument, SectionKind } from "../schema/report.js";
import { loadConfig } from "./config.js";
import { escapeHtml, inlineMark, nl2p } from "./html.js";
import { displayDateFromIso, prettyDateFromIso } from "./time.js";
import { repoRoot } from "./paths.js";

const KIND_LABEL: Record<SectionKind, string> = {
  fact: "사실",
  analysis: "분석",
  forecast: "전망",
  rumor: "루머",
};

function css(): string {
  return fs.readFileSync(
    path.join(repoRoot(), "src/styles/magazine.css"),
    "utf8",
  );
}

function sourceMap(doc: ReportDocument): Map<string, ReportDocument["sources"][number]> {
  return new Map(doc.sources.map((s) => [s.id, s]));
}

function renderSections(doc: ReportDocument): string {
  const map = sourceMap(doc);
  return doc.sections
    .map((section) => {
      const refs = section.sourceIds
        .map((id) => map.get(id))
        .filter(Boolean)
        .map((s) =>
          s!.url
            ? `<a href="${escapeHtml(s!.url)}" rel="noopener">${escapeHtml(s!.title)}</a>`
            : `<strong>${escapeHtml(s!.title)}</strong>`,
        )
        .join(" · ");
      const bullets =
        section.bullets?.length > 0
          ? `<ul>${section.bullets
              .map((b) => `<li>${inlineMark(b)}</li>`)
              .join("")}</ul>`
          : "";
      return `
<article class="paper section-card" id="${escapeHtml(section.id)}">
  <div class="badge ${section.kind}">${KIND_LABEL[section.kind]}</div>
  <h3>${escapeHtml(section.heading)}</h3>
  <div class="body">${nl2p(section.body)}</div>
  ${bullets}
  ${refs ? `<p class="muted" style="margin-top:14px;color:var(--muted);font-size:14px;">출처: ${refs}</p>` : ""}
</article>`;
    })
    .join("\n");
}

function renderMetrics(doc: ReportDocument): string {
  if (!doc.metrics?.length) return "";
  return `<div class="metrics">${doc.metrics
    .map(
      (m) => `<div class="metric"><div class="value">${escapeHtml(m.value)}</div><div class="label">${escapeHtml(m.label)}${m.note ? ` · ${escapeHtml(m.note)}` : ""}</div></div>`,
    )
    .join("")}</div>`;
}

function renderQuotes(doc: ReportDocument): string {
  if (!doc.quotes?.length) return "";
  return doc.quotes.map((q) => `<blockquote class="quote">${escapeHtml(q)}</blockquote>`).join("");
}

function renderProsCons(doc: ReportDocument): string {
  if (!doc.pros?.length && !doc.cons?.length) return "";
  return `
<section>
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">Trade-offs</div>
      <h2>얻게 되는 것과<br>감수해야 하는 것</h2>
    </div>
    <div class="duo">
      <article class="panel pros"><h3>장점</h3><ul>${(doc.pros || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></article>
      <article class="panel cons"><h3>단점</h3><ul>${(doc.cons || []).map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul></article>
    </div>
  </div>
</section>`;
}

function renderDecisions(doc: ReportDocument): string {
  if (!doc.decisions?.length) return "";
  return `
<section>
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">Decision Criteria</div>
      <h2>판단 기준</h2>
    </div>
    <div class="checks">
      ${doc.decisions
        .map(
          (d, i) => `
        <article class="check">
          <div class="num">${String(i + 1).padStart(2, "0")}</div>
          <h3>${escapeHtml(d.title)}</h3>
          <p>${escapeHtml(d.body)}</p>
        </article>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderTimeline(doc: ReportDocument): string {
  if (!doc.timeline?.length) return "";
  return `
<section>
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">Timeline</div>
      <h2>타임라인</h2>
    </div>
    <div class="timeline">
      ${doc.timeline
        .map(
          (t) => `
        <div class="t-item">
          <div class="date">${escapeHtml(t.date)}</div>
          <div>
            <strong>${escapeHtml(t.title)}</strong>
            <div style="color:var(--muted);margin-top:4px;">${escapeHtml(t.body)}</div>
          </div>
        </div>`,
        )
        .join("")}
    </div>
  </div>
</section>`;
}

function renderSources(doc: ReportDocument): string {
  return `
<section>
  <div class="wrap">
    <div class="section-head">
      <div class="kicker">Sources</div>
      <h2>원문과 확인 범위</h2>
      <p>기사 전문은 저장하지 않습니다. 제목·발행처·URL·확인일만 남깁니다.</p>
    </div>
    <div class="paper">
      <ul class="sources">
        ${doc.sources
          .map(
            (s) => `
          <li>
            ${
              s.url
                ? `<a href="${escapeHtml(s.url)}" rel="noopener">${escapeHtml(s.title)}</a>`
                : `<strong>${escapeHtml(s.title)}</strong>`
            }
            <span>${escapeHtml(s.publisher)}${s.publishedAt ? ` · 발행 ${escapeHtml(s.publishedAt)}` : ""} · 확인 ${escapeHtml(prettyDateFromIso(s.accessedAt))}${s.note ? ` · ${escapeHtml(s.note)}` : ""}</span>
          </li>`,
          )
          .join("")}
      </ul>
    </div>
  </div>
</section>`;
}

export function renderReportHtml(doc: ReportDocument): string {
  const dateCode = displayDateFromIso(doc.createdAt);
  const createdPretty = prettyDateFromIso(doc.createdAt);
  const updatedPretty = prettyDateFromIso(doc.updatedAt);
  const eyebrow = doc.heroEyebrow || `Report Mode · ${dateCode}`;

  return `<!doctype html>
<html lang="${escapeHtml(doc.language || "ko")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(doc.summary)}">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(dateCode)} · ${escapeHtml(doc.title)} — Report Mode</title>
  <style>${css()}</style>
</head>
<body>
  <nav class="nav" aria-label="보고서 탐색">
    <div class="nav-inner">
      <a href="../../">Report Mode</a>
      <div class="nav-links">
        <a href="#summary">요약</a>
        <a href="#body">본문</a>
        <a href="#sources">출처</a>
      </div>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-inner">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h1>${escapeHtml(doc.title)}</h1>
      <p class="lede">${escapeHtml(doc.subtitle || doc.summary)}</p>
      <div class="meta-row">
        <div class="chip"><span class="dot" aria-hidden="true"></span>${escapeHtml(dateCode)} · ${escapeHtml(doc.category)}</div>
        <div class="chip">작성 ${escapeHtml(createdPretty)}</div>
        <div class="chip">수정 ${escapeHtml(updatedPretty)}</div>
        <div class="chip">출처 ${doc.sources.length}개</div>
      </div>
    </div>
  </header>

  <main>
    <section id="summary">
      <div class="wrap">
        <div class="section-head">
          <div class="kicker">Executive Summary</div>
          <h2>한 문장 판단</h2>
          <p>${escapeHtml(doc.summary)}</p>
        </div>
        <div class="verdict-grid">
          <article class="paper verdict-main">
            <h3>${escapeHtml(doc.verdict)}</h3>
            ${renderQuotes(doc)}
          </article>
          <aside class="verdict-side">
            <div class="big">${doc.decisions?.length || doc.metrics?.length || doc.sources.length}</div>
            <p>핵심 기준·지표와 출처를 함께 확인하세요. 최종 판단과 검수는 사용자에게 있습니다.</p>
          </aside>
        </div>
        ${renderMetrics(doc)}
        <div class="legend">
          <span class="badge fact">사실</span>
          <span class="badge analysis">분석</span>
          <span class="badge forecast">전망</span>
          <span class="badge rumor">루머</span>
        </div>
      </div>
    </section>

    <section id="body">
      <div class="wrap">
        <div class="section-head">
          <div class="kicker">Body</div>
          <h2>본문</h2>
          <p>사실·분석·전망·루머를 분리해 정리했습니다.</p>
        </div>
        ${renderSections(doc)}
      </div>
    </section>

    ${renderProsCons(doc)}
    ${renderDecisions(doc)}
    ${renderTimeline(doc)}
    <div id="sources">${renderSources(doc)}</div>
  </main>

  <footer>
    <div class="footer-inner">
      <span>Report Mode · ${escapeHtml(dateCode)} · ${escapeHtml(doc.author)}</span>
      <span>최종 판단과 검수는 사용자에게 있습니다.</span>
    </div>
  </footer>
</body>
</html>
`;
}

export function renderHomeHtml(items: ManifestItem[]): string {
  const cards = items
    .map(
      (item) => `
    <a class="card" href="${escapeHtml(item.path)}">
      <div>
        <div class="tag">${escapeHtml(item.displayDate)} · ${escapeHtml(item.category)}</div>
        <h2>${escapeHtml(item.displayDate)} · ${escapeHtml(item.title)}</h2>
        <p>${escapeHtml(item.summary)}</p>
      </div>
      <span class="arrow" aria-hidden="true">→</span>
    </a>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Jeremy를 위한 검증 가능한 웹 보고서 아카이브">
  <title>Report Mode — Web Reports</title>
  <style>${css()}</style>
</head>
<body class="home">
  <main class="home-wrap">
    <div class="eyebrow">GitHub Pages Report Archive</div>
    <h1>Report<br>Mode.</h1>
    <p class="intro">원자료를 조사하고, 사실과 해석을 분리해, 공유 가능한 웹페이지로 발행한 보고서 모음입니다. 생성은 Hermes·로컬 Codex·회사 API에서, 공개는 GitHub Pages에서 합니다.</p>
    <section class="cards" aria-label="보고서 목록">
      ${cards || "<p>아직 공개된 보고서가 없습니다.</p>"}
    </section>
    <footer style="margin-top:48px;color:var(--muted);font-size:13px;">Report Mode · 최종 판단과 검수는 사용자에게 있습니다.</footer>
  </main>
</body>
</html>
`;
}

export function renderRedirectHtml(targetPath: string, title: string): string {
  const config = loadConfig();
  const url = `${config.siteBase.replace(/\/$/, "")}/${targetPath.replace(/^\//, "")}`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta http-equiv="refresh" content="0; url=../${escapeHtml(targetPath.replace(/^reports\//, ""))}">
  <link rel="canonical" href="${escapeHtml(url)}">
  <title>이동 중 — ${escapeHtml(title)}</title>
  <style>body{font-family:system-ui,sans-serif;padding:48px;max-width:640px;margin:auto;line-height:1.6}a{color:#0b3d91}</style>
</head>
<body>
  <h1>보고서 주소가 변경되었습니다</h1>
  <p><strong>${escapeHtml(title)}</strong> 보고서는 새 주소로 이동했습니다.</p>
  <p><a href="../${escapeHtml(targetPath.replace(/^reports\//, ""))}">새 보고서로 이동</a></p>
</body>
</html>
`;
}
