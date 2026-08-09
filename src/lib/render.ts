import fs from "node:fs";
import path from "node:path";
import type { ManifestItem, ReportDocument, SectionKind } from "../schema/report.js";
import { loadConfig } from "./config.js";
import { escapeHtml, inlineMark, nl2p } from "./html.js";
import { displayDateFromIso, prettyDateFromIso } from "./time.js";
import { repoRoot } from "./paths.js";
import { REPORT_COUNTER_VERSION, REPORT_HISTORY_VERSION, REPORT_HUB_BRAND_VERSION, REPORT_HUB_HOME, REPORT_LAYOUT_SCRIPT_VERSION } from "./public-brand.js";

const ARCHIVE_WEATHER_VERSION = "20260809-weather1";

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

function archiveShareIconMarkup(state: "share" | "check" | "error" = "share"): string {
  const paths = {
    share: '<path d="M12 15V3"></path><path d="m8 7 4-4 4 4"></path><path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"></path>',
    check: '<path d="m5 12 4 4L19 6"></path>',
    error: '<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>',
  };
  return `<span class="archive-share-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${paths[state]}</svg></span><span class="archive-share-status" aria-live="polite"></span>`;
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
  const eyebrow = doc.heroEyebrow || `Report Hub · ${dateCode}`;

  return `<!doctype html>
<html lang="${escapeHtml(doc.language || "ko")}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/svg+xml" sizes="any" href="../../assets/favicon.svg?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="icon" type="image/png" sizes="32x32" href="../../assets/favicon-32x32.png?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="apple-touch-icon" sizes="180x180" href="../../assets/apple-touch-icon.png?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="manifest" href="../../site.webmanifest?v=${REPORT_HUB_BRAND_VERSION}">
  <meta name="application-name" content="Report Hub">
  <meta property="og:site_name" content="Report Hub">
  <meta name="description" content="${escapeHtml(doc.summary)}">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(dateCode)} · ${escapeHtml(doc.title)} | Report Hub</title>
  <style>${css()}</style>
  <link rel="stylesheet" href="../../assets/report-page-layout.css?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="stylesheet" href="../../assets/report-hub-brand.css?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="stylesheet" href="../../assets/report-comments.css?v=20260809-comments1">
</head>
<body data-report-view="detail" data-report-layout="wide">
  <a class="report-home-button" href="${REPORT_HUB_HOME}" aria-label="Report Hub 메인으로 이동"><span class="report-hub-brand-copy"><span class="report-hub-wordmark">Report Hub</span><span class="report-hub-byline">by Jeremy</span></span></a>
  <nav class="nav" aria-label="보고서 탐색">
    <div class="nav-inner">
      <a href="${REPORT_HUB_HOME}">Report Hub</a>
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
      <span>Report Hub · ${escapeHtml(dateCode)} · ${escapeHtml(doc.author)}</span>
      <span>최종 판단과 검수는 사용자에게 있습니다.</span>
    </div>
  </footer>
  <script src="../../assets/report-page-layout.js?v=${REPORT_LAYOUT_SCRIPT_VERSION}"></script>
  <script src="../../assets/report-view-counter.js?v=${REPORT_COUNTER_VERSION}" data-report-id="${escapeHtml(doc.id)}"></script>
  <script src="../../assets/report-comments.js?v=20260809-comments1" data-report-id="${escapeHtml(doc.id)}"></script>
  <script src="../../assets/report-history.js?v=${REPORT_HISTORY_VERSION}" data-report-id="${escapeHtml(doc.id)}"></script>
  <script src="../../assets/report-hub-brand.js?v=${REPORT_HUB_BRAND_VERSION}"></script>
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
  const categoryOrder = ["AI", "게임", "자동차", "IT 기기", "비즈니스", "라이프", "기타", "Draft"];
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
            ? items.filter((item) => categoryFor(item) !== "Draft").length
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
      const reportHref = linkPrefix + item.path;
      return `
      <article class="archive-post" data-report-item data-report-id="${escapeHtml(item.id)}" data-category="${escapeHtml(archiveCategory)}"${archiveCategory === "Draft" ? ' data-report-draft="true"' : ""} data-search="${escapeHtml(searchText)}">
        <a class="archive-post-link" href="${escapeHtml(reportHref)}">
          <div class="archive-post-number" aria-label="게시글 번호">${String(items.length - index).padStart(3, "0")}</div>
          <div class="archive-post-copy">
            <div class="archive-post-meta">
              <span class="archive-post-category">${escapeHtml(archiveCategory)}</span>${archiveCategory === "Draft" ? '<span class="archive-draft-badge">초안</span>' : ""}
              <span>${escapeHtml(item.displayDate)}</span>
              <span>출처 ${item.sourceCount}개</span>
              <span class="archive-view-count" data-view-count data-view-count-fallback="${fallbackViewCount}">조회수 ${fallbackViewCount.toLocaleString("ko-KR")}</span>
            </div>
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.summary)}</p>
            ${tags ? `<div class="archive-tags">${tags}</div>` : ""}
          </div>
          ${cover}
        </a>
        <button class="archive-share-button" type="button" data-report-share data-report-share-url="${escapeHtml(reportHref)}" data-share-state="share" aria-label="${escapeHtml(item.title)} 보고서 링크 복사" title="링크 복사">${archiveShareIconMarkup()}</button>
      </article>`;
    })
    .join("\n");

  const spotlightItem = (
    item: ManifestItem,
    index: number,
    kind: "featured" | "popular",
  ) => {
    const reportHref = linkPrefix + item.path;
    const rawCount = Number(fallbackViewCountsById[item.id] || 0);
    const viewCount = Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : 0;
    const coverSource = item.coverImage
      ? /^(?:https?:|data:)/i.test(item.coverImage)
        ? item.coverImage
        : linkPrefix + item.coverImage
      : "";
    const cover = coverSource
      ? `<img src="${escapeHtml(coverSource)}" alt="" loading="lazy">`
      : `<span class="archive-spotlight-cover-fallback" aria-hidden="true">RH</span>`;
    const attribute = kind === "featured"
      ? "data-featured-fallback-item"
      : "data-popular-report";
    const meta = kind === "popular"
      ? `조회수 ${viewCount.toLocaleString("ko-KR")}`
      : `${escapeHtml(categoryFor(item))} · ${escapeHtml(item.displayDate)}`;
    return `<a class="archive-spotlight-item" ${attribute} data-spotlight-report-id="${escapeHtml(item.id)}" href="${escapeHtml(reportHref)}">
      <span class="archive-spotlight-rank" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
      <span class="archive-spotlight-copy"><small>${meta}</small><strong>${escapeHtml(item.title)}</strong></span>
      <span class="archive-spotlight-cover">${cover}</span>
    </a>`;
  };
  const featuredItems = items.slice(0, 3)
    .map((item, index) => spotlightItem(item, index, "featured"))
    .join("\n");
  const popularItems = items
    .map((item, index) => ({ item, index, count: Number(fallbackViewCountsById[item.id] || 0) }))
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .slice(0, 3)
    .map(({ item }, index) => spotlightItem(item, index, "popular"))
    .join("\n");

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="검증 가능한 AI·비즈니스 보고서 허브">
  <link rel="icon" type="image/svg+xml" sizes="any" href="../assets/favicon.svg?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="icon" type="image/png" sizes="32x32" href="../assets/favicon-32x32.png?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="apple-touch-icon" sizes="180x180" href="../assets/apple-touch-icon.png?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="manifest" href="../site.webmanifest?v=${REPORT_HUB_BRAND_VERSION}">
  <link rel="canonical" href="${REPORT_HUB_HOME}">
  <meta name="application-name" content="Report Hub">
  <meta property="og:site_name" content="Report Hub">
  <meta property="og:title" content="Report Hub | AI 리서치 라이브러리">
  <title>Report Hub | AI 리서치 라이브러리</title>
  <style>${css()}</style>
  <link rel="stylesheet" href="../assets/report-hub-brand.css?v=${REPORT_HUB_BRAND_VERSION}">
</head>
<body class="archive-page">
  <header class="archive-topbar">
    <div class="archive-topbar-inner">
      <div class="report-hub-brand-cluster">
        <a class="archive-brand report-hub-brand-link" href="${REPORT_HUB_HOME}" aria-label="Report Hub 메인으로 이동">
          <span class="report-hub-brand-copy"><span class="report-hub-wordmark">Report Hub</span><span class="report-hub-byline">by Jeremy</span></span>
        </a>
        <time class="report-hub-clock" data-report-hub-clock="true" aria-label="서울 현재 날짜와 시각"><span class="report-hub-clock-date"></span><span class="report-hub-clock-time"></span></time>
      </div>
      <div class="archive-topbar-actions">
        <span class="archive-visitor-count" id="archiveVisitorCount" aria-live="polite">방문 집계 중</span>
        <a class="archive-blog-card" href="https://blog.naver.com/jeremylee0213" target="_blank" rel="noopener"><span class="archive-blog-mark">N</span><span class="archive-blog-card-copy"><b>Jeremy's Blog</b><small>네이버 블로그</small></span></a>
      </div>
    </div>
  </header>

  <main class="archive-shell">
    <section class="archive-spotlight" id="archiveSpotlight" aria-labelledby="spotlight-title">
      <div class="archive-spotlight-head">
        <div><span>먼저 볼 리포트</span><h1 id="spotlight-title">지금 읽을 보고서</h1></div>
        <p>Jeremy's Pick과 저장된 조회수 기준 인기글을 모았습니다.</p>
      </div>
      <div class="archive-spotlight-grid">
        <section class="archive-spotlight-column" aria-labelledby="featured-title">
          <div class="archive-spotlight-column-head"><span class="archive-spotlight-star" aria-hidden="true">★</span><h2 id="featured-title">Jeremy's Pick</h2><small>최대 3개</small></div>
          <div class="archive-spotlight-list" id="archiveFeaturedList">${featuredItems}</div>
        </section>
        <section class="archive-spotlight-column" aria-labelledby="popular-title">
          <div class="archive-spotlight-column-head"><span class="archive-spotlight-chart" aria-hidden="true">1</span><h2 id="popular-title">인기글</h2><small>조회수 기준</small></div>
          <div class="archive-spotlight-list" id="archivePopularList">${popularItems}</div>
        </section>
      </div>
    </section>
    <div class="archive-content-layout">
    <aside class="archive-right-rail" aria-label="방문자 참여와 동탄 날씨">
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

      <section class="archive-weather-card is-loading" data-archive-weather aria-labelledby="archive-weather-title" aria-busy="true">
        <div class="archive-weather-head">
          <div>
            <div class="archive-weather-kicker">WEEKLY WEATHER</div>
            <h2 id="archive-weather-title">동탄 날씨</h2>
            <p data-weather-location>경기도 화성시 동탄8동</p>
          </div>
          <span class="archive-weather-updated" data-weather-updated>업데이트 중</span>
        </div>
        <div class="archive-weather-status" data-weather-status role="status">날씨를 불러오는 중입니다.</div>
        <div class="archive-weather-content" data-weather-content hidden>
          <div class="archive-weather-current">
            <div>
              <strong data-weather-temperature>--°</strong>
              <span data-weather-condition>날씨 확인 중</span>
            </div>
            <div class="archive-weather-current-meta">
              <span data-weather-high-low>최고 --° · 최저 --°</span>
              <span data-weather-precipitation>강수 --%</span>
            </div>
          </div>
          <ol class="archive-weather-forecast" data-weather-forecast aria-label="향후 4일 예보"></ol>
        </div>
        <button class="archive-weather-retry" type="button" data-weather-retry hidden>다시 시도</button>
      </section>
    </aside>

    <div class="archive-layout">
      <aside class="archive-sidebar" aria-label="도서관 안내와 분류">
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
          <div class="archive-board-controls">
            <label class="archive-search">
              <span class="sr-only">보고서 검색</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"/></svg>
              <input id="archiveSearch" type="search" placeholder="제목, 본문, 태그 검색" autocomplete="off">
            </label>
            <label class="archive-page-size">표시 개수<select id="archivePageSize" aria-label="페이지당 보고서 수"><option value="5">5개</option><option value="10">10개</option><option value="20">20개</option><option value="30" selected>30개</option></select></label>
          </div>
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
    </div>

    <footer class="archive-footer">
      <span>Report Hub</span>
    </footer>
  </main>

  <script>
  (function () {
    var DEFAULT_PAGE_SIZE = 30;
    var ALLOWED_PAGE_SIZES = [5, 10, 20, 30];
    var COUNTER_API = "https://reportmode-request-board.report-request-board.workers.dev";
    var liveViewCounts = null;
    var viewCountsPromise = null;
    var posts = Array.prototype.slice.call(document.querySelectorAll("[data-report-item]"));
    var filters = Array.prototype.slice.call(document.querySelectorAll("[data-category-filter]"));
    var search = document.getElementById("archiveSearch");
    var count = document.getElementById("archiveResultCount");
    var pagination = document.getElementById("archivePagination");
    var pageSizeSelect = document.getElementById("archivePageSize");
    var empty = document.getElementById("archiveEmpty");
    var tagCloud = document.querySelector("[data-report-tag-cloud]");
    var params = new URLSearchParams(window.location.search);
    var requestedPageSize = parseInt(params.get("size") || String(DEFAULT_PAGE_SIZE), 10);
    var state = {
      query: params.get("q") || "",
      category: params.get("category") || "all",
      page: Math.max(1, parseInt(params.get("page") || "1", 10) || 1),
      pageSize: ALLOWED_PAGE_SIZES.indexOf(requestedPageSize) >= 0 ? requestedPageSize : DEFAULT_PAGE_SIZE
    };

    search.value = state.query;
    pageSizeSelect.value = String(state.pageSize);

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

    function legacyCopyReportLink(value) {
      return new Promise(function (resolve, reject) {
        var input = document.createElement("textarea");
        input.value = value;
        input.setAttribute("readonly", "");
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        input.setSelectionRange(0, value.length);
        var copied = false;
        try {
          copied = document.execCommand("copy");
        } catch (_) {
          copied = false;
        }
        input.remove();
        if (copied) resolve();
        else reject(new Error("copy unavailable"));
      });
    }

    function copyReportLink(button) {
      var url = new URL(button.dataset.reportShareUrl || "", window.location.href);
      url.search = "";
      url.hash = "";
      var copy = navigator.clipboard && typeof navigator.clipboard.writeText === "function"
        ? navigator.clipboard.writeText(url.href).catch(function () { return legacyCopyReportLink(url.href); })
        : legacyCopyReportLink(url.href);
      return copy.then(function () {
        setArchiveShareState(button, "check", "보고서 링크가 복사되었습니다", "복사 완료", "링크가 복사되었습니다");
        window.clearTimeout(button.reportHubResetTimer);
        button.reportHubResetTimer = window.setTimeout(function () {
          setArchiveShareState(button, "share", "보고서 링크 복사", "링크 복사", "");
        }, 1800);
      });
    }

    function archiveShareIconMarkup(state) {
      var paths = {
        share: '<path d="M12 15V3"></path><path d="m8 7 4-4 4 4"></path><path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"></path>',
        check: '<path d="m5 12 4 4L19 6"></path>',
        error: '<path d="M6 6l12 12"></path><path d="M18 6 6 18"></path>'
      };
      return '<span class="archive-share-icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">' + (paths[state] || paths.share) + '</svg></span>' +
        '<span class="archive-share-status" aria-live="polite"></span>';
    }

    function setArchiveShareState(button, state, ariaLabel, title, status) {
      button.dataset.shareState = state;
      button.innerHTML = archiveShareIconMarkup(state);
      button.setAttribute("aria-label", ariaLabel);
      button.setAttribute("title", title);
      var output = button.querySelector(".archive-share-status");
      if (output) output.textContent = status || "";
    }

    document.addEventListener("click", function (event) {
      var button = event.target.closest("[data-report-share]");
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      copyReportLink(button).catch(function () {
        setArchiveShareState(button, "error", "보고서 링크 복사에 실패했습니다", "복사 실패", "링크 복사에 실패했습니다");
        window.clearTimeout(button.reportHubResetTimer);
        button.reportHubResetTimer = window.setTimeout(function () {
          setArchiveShareState(button, "share", "보고서 링크 복사", "링크 복사", "");
        }, 1800);
      });
    });

    function fetchLiveViewCounts() {
      if (viewCountsPromise) return viewCountsPromise;
      var controller = new AbortController();
      var timeoutId = window.setTimeout(function () {
        controller.abort();
      }, 5000);
      viewCountsPromise = fetch(COUNTER_API + "/report-views", {
        cache: "no-store",
        mode: "cors",
        signal: controller.signal
      })
        .then(function (response) {
          if (!response.ok) throw new Error("counter unavailable");
          return response.json();
        })
        .then(function (data) {
          if (!data || !data.counts || typeof data.counts !== "object") {
            throw new Error("invalid counter values");
          }
          liveViewCounts = data.counts;
          posts.forEach(function (post) {
            applyViewCount(post, liveViewCounts);
          });
          window.dispatchEvent(new CustomEvent("reportmode:view-counts-updated"));
          return liveViewCounts;
        })
        .finally(function () {
          window.clearTimeout(timeoutId);
        })
        .catch(function () {
          viewCountsPromise = null;
          return null;
        });
      return viewCountsPromise;
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

    function applyViewCount(post, counts) {
      var output = post.querySelector("[data-view-count]");
      var reportId = post.dataset.reportId || "";
      if (!output || !reportId) return;
      var fallback = Number(output.dataset.viewCountFallback || "0");
      var cached = cachedViewCount(reportId);
      var live = counts && Object.prototype.hasOwnProperty.call(counts, reportId)
        ? Number(counts[reportId])
        : null;
      var displayed = Number.isFinite(live)
        ? live
        : cached !== null && Number.isFinite(cached)
          ? cached
          : fallback;
      displayed = Math.max(0, Math.trunc(displayed));
      output.dataset.viewCountLive = String(displayed);
      output.textContent = "조회수 " + displayed.toLocaleString("ko-KR");
      if (Number.isFinite(live)) storeViewCount(reportId, displayed);
    }

    function loadViewCounts(visiblePosts) {
      visiblePosts.forEach(function (post) {
        applyViewCount(post, liveViewCounts);
      });
      fetchLiveViewCounts();
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
      if (state.pageSize !== DEFAULT_PAGE_SIZE) next.set("size", String(state.pageSize));
      var query = next.toString();
      window.history.replaceState(null, "", window.location.pathname + (query ? "?" + query : ""));
    }

    function render(shouldScroll) {
      var normalizedQuery = state.query.trim().toLocaleLowerCase("ko");
      var filtered = posts.filter(function (post) {
        var reportId = post.dataset.reportId || "";
        var hiddenSet = window.reportmodeHiddenReports;
        var isHidden = (hiddenSet && typeof hiddenSet.has === "function" && hiddenSet.has(reportId)) || post.dataset.adminForceHidden === "true";
        if (isHidden && !window.reportmodeAdminUnlocked) return false;
        var isDraft = post.dataset.reportDraft === "true";
        var promotedSet = window.reportmodeDraftPromotions;
        var isPromoted = promotedSet && typeof promotedSet.has === "function" && promotedSet.has(reportId);
        var categoryMatches = state.category === "Draft"
          ? isDraft
          : state.category === "all"
            ? (!isDraft || isPromoted)
            : post.dataset.category === state.category;
        var queryMatches = !normalizedQuery || (post.dataset.search || "").indexOf(normalizedQuery) !== -1;
        return categoryMatches && queryMatches;
      });
      var totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
      state.page = Math.min(state.page, totalPages);
      var start = (state.page - 1) * state.pageSize;
      var visible = filtered.slice(start, start + state.pageSize);

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
    pageSizeSelect.addEventListener("change", function () {
      var selected = parseInt(pageSizeSelect.value, 10);
      state.pageSize = ALLOWED_PAGE_SIZES.indexOf(selected) >= 0 ? selected : DEFAULT_PAGE_SIZE;
      state.page = 1;
      render(false);
    });
    window.reportmodeArchiveRender = render;
    render(false);
  })();
  </script>
  <script src="../assets/archive-request-board.js"></script>
  <script src="../assets/archive-report-admin.js?v=20260810-draft-views1"></script>
  <script src="../assets/archive-visitor-counter.js?v=20260809-visits1"></script>
  <script src="../assets/archive-weather.js?v=${ARCHIVE_WEATHER_VERSION}"></script>
  <script src="../assets/report-hub-brand.js?v=${REPORT_HUB_BRAND_VERSION}"></script>
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
