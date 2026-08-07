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

function renderTable(section: ReportDocument["sections"][number]): string {
  if (!section.table) return "";
  return `
  <div class="table-wrap" role="region" aria-label="${escapeHtml(section.heading)} 표" tabindex="0">
    <table class="report-table">
      <thead><tr>${section.table.columns
        .map((column) => `<th scope="col">${inlineMark(column)}</th>`)
        .join("")}</tr></thead>
      <tbody>${section.table.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${inlineMark(cell)}</td>`).join("")}</tr>`,
        )
        .join("")}</tbody>
    </table>
  </div>`;
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
      const table = renderTable(section);
      return `
<article class="paper section-card" id="${escapeHtml(section.id)}">
  <div class="badge ${section.kind}">${KIND_LABEL[section.kind]}</div>
  <h3>${escapeHtml(section.heading)}</h3>
  <div class="body">${nl2p(section.body)}</div>
  ${table}
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
  <link rel="stylesheet" href="../../assets/report-page-layout.css?v=20260807-controls">
</head>
<body data-report-view="detail" data-report-layout="wide">
  <a class="report-home-button" href="../../archive/" aria-label="보고서 도서관 메인으로 이동">🏠 메인</a>
  <nav class="nav" aria-label="보고서 탐색">
    <div class="nav-inner">
      <a href="../../archive/">Report Mode</a>
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
  <script src="../../assets/report-page-layout.js?v=20260807-inputfix"></script>
  <script src="../../assets/report-view-counter.js" data-report-id="${escapeHtml(doc.id)}"></script>
</body>
</html>
`;
}

export function renderHomeHtml(
  items: ManifestItem[],
  linkPrefix = "",
  bodySearchTextById: Record<string, string> = {},
  fallbackViewCountsById: Record<string, number> = {},
): string {
  const categoryOrder = ["AI", "게임", "자동차", "IT 기기", "비즈니스", "라이프", "기타"];
  const categoryFor = (item: ManifestItem) => {
    const selectedCategory = String(item.category || "").trim();
    if (categoryOrder.includes(selectedCategory)) return selectedCategory;
    const text = [item.title, item.subtitle, item.category, ...(item.tags || [])]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ko");
    if (/(pokemon|pokopia|nintendo|cozy-game|game|게임|포켓몬|포코피아)/.test(text)) {
      return "게임";
    }
    if (/(tesla|model-y|electric-vehicle|전기차|자동차)/.test(text)) {
      return "자동차";
    }
    if (/(deepseek|gpt-|gemini|claude|ai-agent|ai model|ai 모델|인공지능|hermes|openclaw|codex|buzz|slack|discord|telegram)/.test(text)) {
      return "AI";
    }
    if (/(apple|iphone|samsung|galaxy|foldable|폴더블|갤럭시|스마트폰|it 기기)/.test(text)) {
      return "IT 기기";
    }
    return "기타";
  };
  const categories = categoryOrder.filter((category) =>
    items.some((item) => categoryFor(item) === category),
  );
  const categoryButtons = ["전체", ...categories]
    .map(
      (category) => {
        const value = category === "전체" ? "all" : category;
        const count =
          value === "all"
            ? items.length
            : items.filter((item) => categoryFor(item) === category).length;
        return `<button class="archive-category" type="button" data-category-filter="${escapeHtml(value)}"><span>${escapeHtml(category)}</span><b>${count}</b></button>`;
      },
    )
    .join("\n");

  const tagLabels: Record<string, string> = {
    "ai-agent": "AI 에이전트",
    "ai-model": "AI 모델",
    apple: "Apple",
    automation: "자동화",
    benchmarks: "벤치마크",
    buzz: "Buzz",
    "claude-sonnet-5": "Claude Sonnet 5",
    codex: "Codex",
    comparison: "비교",
    "cozy-game": "코지 게임",
    deepseek: "DeepSeek",
    "deepseek-v4-flash": "DeepSeek V4 Flash",
    "deep-dive": "심층분석",
    discord: "Discord",
    "electric-vehicle": "전기차",
    foldable: "폴더블",
    "galaxy-z-fold7": "Galaxy Z Fold7",
    "galaxy-z-fold8": "Galaxy Z Fold8",
    "galaxy-z-fold8-ultra": "Galaxy Z Fold8 Ultra",
    "gemini-3.6": "Gemini 3.6",
    "gpt-5.6": "GPT-5.6",
    "hermes-agent": "Hermes",
    iphone: "iPhone",
    "iphone-fold": "iPhone Fold",
    "model-y-l": "Model Y L",
    "nintendo-switch-2": "Nintendo Switch 2",
    official: "공식 발표",
    openclaw: "OpenClaw",
    pokemon: "포켓몬",
    pokopia: "포코피아",
    "purchase-decision": "구매 결정",
    rumor: "루머",
    samsung: "Samsung",
    security: "보안",
    "self-hosted": "셀프호스팅",
    slack: "Slack",
    telegram: "Telegram",
    tesla: "Tesla",
  };
  const tagLinks = items
    .flatMap((item) => {
      const reportHref = linkPrefix + item.path;
      return (item.tags || []).slice(0, 3).map((tag) => {
          const label = tagLabels[tag.toLocaleLowerCase("en")] || tag;
          return `<a class="archive-report-tag" href="${escapeHtml(reportHref)}" aria-label="${escapeHtml(label)} 태그: ${escapeHtml(item.title)} 보고서 열기">#${escapeHtml(label)}</a>`;
        });
    })
    .join("\n");

  const posts = items
    .map((item, index) => {
      const archiveCategory = categoryFor(item);
      const rawFallbackViewCount = Number(fallbackViewCountsById[item.id] || 0);
      const fallbackViewCount = Number.isFinite(rawFallbackViewCount)
        ? Math.max(0, Math.trunc(rawFallbackViewCount))
        : 0;
      const tags = (item.tags || [])
        .slice(0, 3)
        .map((tag) => `<span>#${escapeHtml(tag)}</span>`)
        .join("");
      const searchText = [
        item.title,
        item.subtitle,
        item.summary,
        item.category,
        ...(item.tags || []),
        bodySearchTextById[item.id] || "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("ko");
      const coverSource = item.coverImage
        ? /^(?:https?:|data:)/i.test(item.coverImage)
          ? item.coverImage
          : linkPrefix + item.coverImage
        : "";
      const coverAlt = item.coverAlt || item.title + " 보고서 대표 이미지";
      const cover = coverSource
        ? `<figure class="archive-post-cover"><img src="${escapeHtml(coverSource)}" alt="${escapeHtml(coverAlt)}" loading="lazy"><figcaption>${escapeHtml(item.displayDate)}</figcaption></figure>`
        : `<div class="archive-post-cover archive-post-cover-fallback" aria-hidden="true"><span>REPORT</span><strong>${escapeHtml(item.displayDate.slice(0, 2))}</strong><small>${escapeHtml(item.category)}</small></div>`;
      return `
      <article class="archive-post" data-report-item data-report-id="${escapeHtml(item.id)}" data-category="${escapeHtml(archiveCategory)}" data-search="${escapeHtml(searchText)}">
        <a class="archive-post-link" href="${escapeHtml(linkPrefix + item.path)}">
          <div class="archive-post-number" aria-label="게시글 번호">${String(items.length - index).padStart(3, "0")}</div>
          <div class="archive-post-copy">
            <div class="archive-post-meta">
              <span class="archive-post-category">${escapeHtml(archiveCategory)}</span>
              <span>${escapeHtml(item.displayDate)}</span>
              <span>출처 ${item.sourceCount}개</span>
              <span class="archive-view-count" data-view-count data-view-count-fallback="${fallbackViewCount}">조회수 ${fallbackViewCount.toLocaleString("ko-KR")}</span>
            </div>
            <h2>${escapeHtml(item.displayDate)} · ${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.summary)}</p>
            ${tags ? `<div class="archive-tags">${tags}</div>` : ""}
          </div>
          ${cover}
        </a>
      </article>`;
    })
    .join("\n");

  const latestDate = items[0]?.displayDate || "—";

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Jeremy를 위한 검증 가능한 웹 보고서 아카이브">
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%233182f6'/%3E%3Ctext x='32' y='43' text-anchor='middle' font-family='Arial' font-size='34' font-weight='800' fill='white'%3ER%3C/text%3E%3C/svg%3E">
  <title>Jeremy's AI Report 도서관</title>
  <style>${css()}</style>
</head>
<body class="archive-page">
  <header class="archive-topbar">
    <div class="archive-topbar-inner">
      <a class="archive-brand" href="../" aria-label="Jeremy's AI Report 홈">
        <span class="archive-brand-mark">R</span>
        <span>Jeremy's AI Report</span>
      </a>
      <nav aria-label="주요 메뉴">
        <a class="is-current" href="./">보고서 도서관</a>
        <a href="https://blog.naver.com/jeremylee0213" target="_blank" rel="noopener">Jeremy's Blog</a>
      </nav>
    </div>
  </header>

  <main class="archive-shell">
    <section class="archive-profile" aria-labelledby="archive-title">
      <div class="archive-avatar" aria-hidden="true"><span>RM</span></div>
      <div class="archive-profile-copy">
        <div class="archive-eyebrow">AI RESEARCH LIBRARY</div>
        <h1 id="archive-title">Jeremy's AI Report 도서관</h1>
        <p>원자료를 조사하고 사실과 해석을 나눠 기록하는 개인 보고서 아카이브입니다.</p>
        <div class="archive-profile-meta">
          <span>전체 보고서 <b>${items.length}</b></span>
          <span>최근 작성 <b>${escapeHtml(latestDate)}</b></span>
          <span>자동 업데이트</span>
        </div>
      </div>
      <a class="archive-primary-action archive-blog-action" href="https://blog.naver.com/jeremylee0213" target="_blank" rel="noopener"><span class="archive-blog-mark">N</span><span><b>Jeremy's Blog</b><small>blog.naver.com/jeremylee0213</small></span><i aria-hidden="true">↗</i></a>
    </section>

    <section class="request-board" aria-labelledby="request-board-title">
      <div class="request-board-copy">
        <div class="request-board-kicker">REPORT WISHLIST</div>
        <h2 id="request-board-title"><span class="request-board-highlight">다음 리포트,</span><br>무엇이 궁금하신가요?</h2>
        <p>원하는 기업·제품·이슈를 남겨 주세요. 검토할 가치가 있는 주제는 다음 리포트 후보로 반영합니다.</p>
      </div>
      <form class="request-board-form" id="requestBoardForm" novalidate>
        <div class="request-board-identity">
          <label>신청자 이름<input id="requestAuthor" name="author" maxlength="24" autocomplete="name" required placeholder="이름 또는 닉네임"></label>
          <label>수정·삭제 비밀번호<input id="requestPassword" name="password" type="password" minlength="4" maxlength="80" autocomplete="new-password" required placeholder="4글자 이상"></label>
        </div>
        <label>궁금한 점 또는 원하는 리포트 주제<textarea id="requestTopic" name="topic" minlength="4" maxlength="240" required placeholder="예: 엔비디아 실적과 경쟁력 분석. AMD·구글과 비교해 장기 경쟁력이 궁금합니다."></textarea></label>
        <p class="request-board-helper">비밀번호는 글을 수정하거나 삭제할 때 필요합니다.</p>
        <button class="request-board-submit" type="submit">리포트 희망 남기기 →</button>
        <p class="request-board-status" id="requestBoardStatus" role="status"></p>
      </form>
      <div class="request-board-feed" aria-live="polite">
        <div class="request-board-feed-head"><strong>최근 희망 리포트</strong><span id="requestBoardCount">불러오는 중</span></div>
        <div class="request-board-list" id="requestBoardList"><div class="request-board-empty">아직 제안된 주제가 없습니다. 첫 번째 주제를 남겨 주세요.</div></div>
      </div>
    </section>

    <div class="archive-layout">
      <aside class="archive-sidebar" aria-label="도서관 안내와 분류">
        <section class="archive-side-card">
          <div class="archive-side-label">ABOUT</div>
          <h2>읽고 판단하기 좋은<br>리서치만 모았습니다.</h2>
          <p>모든 보고서는 작성일, 판단 근거, 사실·분석 구분과 전체 출처를 포함합니다.</p>
        </section>
        <section class="archive-side-card archive-side-categories">
          <div class="archive-side-label">CATEGORY</div>
          <div class="archive-category-list">
${categoryButtons}
          </div>
        </section>
        <section class="archive-side-card archive-side-tags">
          <div class="archive-side-label">REPORT TAGS</div>
          <h2>주제 태그</h2>
          <div class="archive-tag-cloud" data-report-tag-cloud>
${tagLinks}
          </div>
        </section>
        <section class="archive-side-note">
          <span class="archive-note-dot" aria-hidden="true"></span>
          <p>새 보고서가 공개되면 목록 맨 위에 자동으로 추가됩니다.</p>
        </section>
      </aside>

      <section class="archive-board" aria-labelledby="board-title">
        <div class="archive-board-head">
          <div>
            <div class="archive-side-label">ALL REPORTS</div>
            <h2 id="board-title">전체 보고서</h2>
            <p id="archiveResultCount">총 ${items.length}개의 글</p>
          </div>
          <label class="archive-search">
            <span class="sr-only">보고서 검색</span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>
            <input id="archiveSearch" type="search" placeholder="제목, 본문, 태그 검색" autocomplete="off">
          </label>
        </div>

        <div class="archive-mobile-categories" aria-label="보고서 분류">
${categoryButtons}
        </div>

        <div class="archive-list-head" aria-hidden="true">
          <span>번호</span><span>보고서</span><span>표지</span>
        </div>
        <div class="archive-posts" id="archivePosts">
${posts || "          <p class=\"archive-empty-static\">아직 공개된 보고서가 없습니다.</p>"}
        </div>
        <div class="archive-empty" id="archiveEmpty" hidden>
          <div>🔎</div>
          <h3>찾는 보고서가 없습니다.</h3>
          <p>검색어나 카테고리를 바꿔보세요.</p>
        </div>
        <nav class="archive-pagination" id="archivePagination" aria-label="보고서 페이지 이동"></nav>
      </section>
    </div>

    <footer class="archive-footer">
      <span>Jeremy's AI Report Library</span>
      <a href="https://blog.naver.com/jeremylee0213" target="_blank" rel="noopener">blog.naver.com/jeremylee0213</a>
    </footer>
  </main>

  <script>
  (function () {
    var PAGE_SIZE = 10;
    var COUNTER_BASE = "https://api.counterapi.dev/v1/aihubos-reportmode/";
    var COUNTER_ENABLED = window.location.hostname === "aihubos.github.io";
    var posts = Array.prototype.slice.call(document.querySelectorAll("[data-report-item]"));
    var filters = Array.prototype.slice.call(document.querySelectorAll("[data-category-filter]"));
    var search = document.getElementById("archiveSearch");
    var count = document.getElementById("archiveResultCount");
    var pagination = document.getElementById("archivePagination");
    var empty = document.getElementById("archiveEmpty");
    var tagCloud = document.querySelector("[data-report-tag-cloud]");
    var params = new URLSearchParams(window.location.search);
    var state = {
      query: params.get("q") || "",
      category: params.get("category") || "all",
      page: Math.max(1, parseInt(params.get("page") || "1", 10) || 1)
    };

    search.value = state.query;

    if (tagCloud) {
      var shuffledTags = Array.prototype.slice.call(tagCloud.children);
      for (var tagIndex = shuffledTags.length - 1; tagIndex > 0; tagIndex -= 1) {
        var randomIndex = Math.floor(Math.random() * (tagIndex + 1));
        var temporaryTag = shuffledTags[tagIndex];
        shuffledTags[tagIndex] = shuffledTags[randomIndex];
        shuffledTags[randomIndex] = temporaryTag;
      }
      shuffledTags.forEach(function (tag) {
        tagCloud.appendChild(tag);
      });
    }

    function viewStorageKey(reportId) {
      return "reportmode:view:" + reportId;
    }

    function incrementView(reportId) {
      if (!COUNTER_ENABLED || !reportId) return;
      var key = viewStorageKey(reportId);
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
      fetch(COUNTER_BASE + encodeURIComponent(reportId) + "/up", {
        cache: "no-store",
        keepalive: true,
        mode: "cors"
      }).catch(function () {
        window.sessionStorage.removeItem(key);
      });
    }

    function wait(delay) {
      return new Promise(function (resolve) {
        window.setTimeout(resolve, delay);
      });
    }

    function fetchViewCount(reportId, attemptsLeft) {
      var controller = new AbortController();
      var timeoutId = window.setTimeout(function () {
        controller.abort();
      }, 5000);
      return fetch(COUNTER_BASE + encodeURIComponent(reportId) + "/", {
        cache: "no-store",
        mode: "cors",
        signal: controller.signal
      })
        .then(function (response) {
          if (!response.ok) throw new Error("counter unavailable");
          return response.json();
        })
        .then(function (data) {
          var value = Number(data.count);
          if (!Number.isFinite(value)) throw new Error("invalid counter value");
          return value;
        })
        .finally(function () {
          window.clearTimeout(timeoutId);
        })
        .catch(function (error) {
          if (attemptsLeft <= 1) throw error;
          return wait(350).then(function () {
            return fetchViewCount(reportId, attemptsLeft - 1);
          });
        });
    }

    function cachedViewCount(reportId) {
      try {
        var cached = window.localStorage.getItem("reportmode:view-count:" + reportId);
        var value = Number(cached);
        return cached !== null && Number.isFinite(value) ? value : null;
      } catch (_) {
        return null;
      }
    }

    function storeViewCount(reportId, value) {
      try {
        window.localStorage.setItem("reportmode:view-count:" + reportId, String(value));
      } catch (_) {
        // Continue without a local cache when browser storage is unavailable.
      }
    }

    function loadViewCounts(visiblePosts) {
      var pending = [];
      visiblePosts.forEach(function (post) {
        var output = post.querySelector("[data-view-count]");
        var reportId = post.dataset.reportId || "";
        if (!output || output.dataset.loaded === "true") return;
        if (!COUNTER_ENABLED) {
          return;
        }
        output.dataset.loaded = "true";
        var cached = cachedViewCount(reportId);
        var fallback = Number(output.dataset.viewCountFallback || "0");
        var displayed = cached === null || !Number.isFinite(cached) ? fallback : cached;
        output.textContent = "조회수 " + displayed.toLocaleString("ko-KR");
        pending.push({ output: output, reportId: reportId, cached: cached });
      });

      var nextIndex = 0;
      function loadNextCount() {
        var task = pending[nextIndex];
        nextIndex += 1;
        if (!task) return Promise.resolve();
        return fetchViewCount(task.reportId, 2)
          .then(function (value) {
            task.output.textContent = "조회수 " + value.toLocaleString("ko-KR");
            storeViewCount(task.reportId, value);
          })
          .catch(function () {
            task.output.dataset.loaded = "false";
          })
          .then(function () {
            return wait(120).then(loadNextCount);
          });
      }

      var workerCount = Math.min(1, pending.length);
      for (var workerIndex = 0; workerIndex < workerCount; workerIndex += 1) {
        loadNextCount();
      }
    }

    function makePageButton(label, page, active, disabled, className) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "archive-page-button" + (active ? " is-active" : "") + (className ? " " + className : "");
      button.textContent = label;
      button.disabled = disabled;
      if (active) button.setAttribute("aria-current", "page");
      button.addEventListener("click", function () {
        state.page = page;
        render(true);
      });
      return button;
    }

    function syncUrl() {
      var next = new URLSearchParams();
      if (state.query) next.set("q", state.query);
      if (state.category !== "all") next.set("category", state.category);
      if (state.page > 1) next.set("page", String(state.page));
      var query = next.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
    }

    function render(shouldScroll) {
      var normalizedQuery = state.query.trim().toLocaleLowerCase("ko");
      var filtered = posts.filter(function (post) {
        var categoryMatches = state.category === "all" || post.dataset.category === state.category;
        var queryMatches = !normalizedQuery || (post.dataset.search || "").indexOf(normalizedQuery) !== -1;
        return categoryMatches && queryMatches;
      });
      var totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      state.page = Math.min(state.page, totalPages);
      var start = (state.page - 1) * PAGE_SIZE;
      var visible = filtered.slice(start, start + PAGE_SIZE);

      posts.forEach(function (post) { post.hidden = true; });
      visible.forEach(function (post) { post.hidden = false; });
      loadViewCounts(visible);
      filters.forEach(function (filter) {
        var active = filter.dataset.categoryFilter === state.category;
        filter.classList.toggle("is-active", active);
        filter.setAttribute("aria-pressed", active ? "true" : "false");
      });

      count.textContent = filtered.length === 0
        ? "검색 결과가 없습니다"
        : "총 " + filtered.length + "개의 글 · " + state.page + "/" + totalPages + " 페이지";
      empty.hidden = filtered.length !== 0;
      pagination.hidden = filtered.length === 0;
      pagination.replaceChildren();

      if (filtered.length > 0) {
        pagination.appendChild(makePageButton("이전", Math.max(1, state.page - 1), false, state.page === 1, "is-wide"));
        var firstPage = Math.max(1, Math.min(state.page - 2, totalPages - 4));
        var lastPage = Math.min(totalPages, firstPage + 4);
        for (var page = firstPage; page <= lastPage; page += 1) {
          pagination.appendChild(makePageButton(String(page), page, page === state.page, false, ""));
        }
        pagination.appendChild(makePageButton("다음", Math.min(totalPages, state.page + 1), false, state.page === totalPages, "is-wide"));
      }

      syncUrl();
      if (shouldScroll) {
        document.querySelector(".archive-board").scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    filters.forEach(function (filter) {
      filter.addEventListener("click", function () {
        state.category = filter.dataset.categoryFilter || "all";
        state.page = 1;
        render(false);
      });
    });
    search.addEventListener("input", function () {
      state.query = search.value;
      state.page = 1;
      render(false);
    });
    posts.forEach(function (post) {
      var link = post.querySelector(".archive-post-link");
      if (!link) return;
      link.addEventListener("click", function () {
        incrementView(post.dataset.reportId || "");
      });
    });
    render(false);
  })();
  </script>
  <script src="../assets/archive-request-board.js"></script>
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
