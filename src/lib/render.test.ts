import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { renderHomeHtml, renderReportHtml } from "./render.js";

test("renders a structured report table with column headers and cells", () => {
  const html = renderReportHtml({
    schemaVersion: "1",
    id: "table-test",
    slug: "table-test",
    title: "표 렌더링",
    subtitle: "",
    category: "테스트",
    language: "ko",
    author: "Test",
    createdAt: "2026-08-07T00:00:00+09:00",
    updatedAt: "2026-08-07T00:00:00+09:00",
    status: "draft",
    summary: "요약",
    verdict: "판단",
    metrics: [],
    sections: [
      {
        id: "pricing",
        heading: "요금제 비교",
        kind: "fact",
        body: "동일 기준 비교",
        bullets: [],
        sourceIds: ["s1"],
        table: {
          columns: ["요금제", "월 비용"],
          rows: [["Plus", "$20"]],
        },
      },
    ],
    pros: [],
    cons: [],
    decisions: [],
    timeline: [],
    quotes: [],
    sources: [
      {
        id: "s1",
        kind: "web",
        title: "공식 가격표",
        publisher: "OpenAI",
        url: "https://openai.com/",
        accessedAt: "2026-08-07T00:00:00+09:00",
      },
    ],
    tags: [],
  } as any);

  assert.match(html, /<table class="report-table">/);
  assert.match(html, /<th scope="col">요금제<\/th>/);
  assert.match(html, /<td>\$20<\/td>/);
  assert.match(html, /report-page-layout\.css\?v=20260812-report-hub-logo2/);
  assert.match(html, /report-page-layout\.js\?v=20260812-report-hub-logo2/);
  assert.match(html, /report-comments\.css\?v=20260810-comments2/);
  assert.match(html, /report-comments\.js\?v=20260810-comments2" data-report-id="table-test"/);
  assert.match(html, /report-view-counter\.js\?v=20260810-counter-d1-1" data-report-id="table-test"/);
  assert.match(html, /report-history\.js\?v=20260809-history2/);
  assert.match(html, /id="report-home-button"|class="report-home-button"/);
  assert.match(html, /href="https:\/\/aireport\.ai-hub-os\.com\/"/);
  assert.match(html, /Report Hub/);
  assert.match(html, /class="report-hub-logo-mark-shimmer" aria-hidden="true"/);
  assert.match(html, /class="report-hub-logo-image"[^>]*src="\.\.\/\.\.\/assets\/report-hub-logo\.png\?v=20260812-report-hub-logo2"[^>]*alt="Report Hub"/);
  assert.doesNotMatch(html, /report-hub-wordmark|report-hub-byline|by Jeremy/);
  assert.doesNotMatch(html, /Report Mode/);
});

test("renders the simplified archive with one Naver card and a 30-item default selector", () => {
  const items = Array.from({ length: 31 }, (_, index) => ({
    id: `sample-${index + 1}`,
    path: `reports/sample-${index + 1}.html`,
    title: `샘플 보고서 ${index + 1}`,
    subtitle: "",
    summary: "샘플 요약",
    category: "AI",
    tags: [],
    displayDate: "260809",
    sourceCount: 1,
  })) as any;
  const html = renderHomeHtml(items);

  assert.doesNotMatch(html, /class="archive-profile"/);
  assert.doesNotMatch(html, /원자료를 조사하고 사실과 해석을 나눠 기록하는/);
  assert.doesNotMatch(html, /읽고 판단하기 좋은/);
  assert.match(html, /class="report-hub-logo-image"[^>]*src="\.\.\/assets\/report-hub-logo\.png\?v=20260812-report-hub-logo2"[^>]*alt="Report Hub"/);
  assert.match(html, /aria-label="Report Hub 메인으로 이동"/);
  assert.doesNotMatch(html, /class="archive-brand-mark"/);
  assert.equal(html.match(/https:\/\/blog\.naver\.com\/jeremylee0213/g)?.length, 1);
  assert.match(html, /class="archive-blog-card"/);
  assert.equal(html.match(/https:\/\/daangn\.com\/kr\/share\/community\/ref\/invite-group\/baRr2nojJVT\?utm_campaign=share_qr/g)?.length, 1);
  assert.doesNotMatch(html, /class="archive-carrot-card"/);
  assert.match(html, /class="archive-builders-card"/);
  assert.match(html, /src="\.\.\/assets\/ai-builders-lab-logo\.png"/);
  assert.match(html, /class="archive-builders-card" href="https:\/\/builderslab\.ai-hub-os\.com"/);
  assert.match(html, /aria-label="AI Builders Lab 웹사이트 열기"/);
  assert.match(html, /class="archive-kakao-openchat-card" href="https:\/\/open\.kakao\.com\/o\/grZIANIi"/);
  assert.match(html, /aria-label="AI Builders Lab 카카오 오픈채팅방 열기"/);
  assert.match(html, /class="archive-kakao-openchat-card"/);
  assert.match(html, /src="\.\.\/assets\/kakao-openchat-banner\.png"/);
  assert.match(html, /class="archive-daangn-banner-card"/);
  assert.match(html, /src="\.\.\/assets\/daangn-community-banner\.png"/);
  assert.doesNotMatch(html, /class="archive-guidebook-card"/);
  assert.doesNotMatch(html, /원하는 기업·제품·이슈를 남겨 주세요/);
  assert.match(html, /<label>이름<input id="requestAuthor"/);
  assert.match(html, /<label>비밀번호<input id="requestPassword"/);
  assert.match(html, /<label>희망 리포트 주제<input id="requestTopic"/);
  assert.match(html, /id="archiveVisitorCount"/);
  assert.match(html, /class="report-hub-clock"/);
  assert.match(html, /class="archive-content-layout"/);
  assert.equal(html.match(/class="archive-right-rail"/g)?.length, 1);
  assert.equal(html.match(/data-archive-weather/g)?.length, 1);
  assert.match(html, /id="archive-weather-title">동탄 날씨/);
  assert.match(html, /data-weather-retry/);
  assert.match(html, /data-archive-mobile-panel-open="request"/);
  assert.match(html, /data-archive-mobile-panel-open="comments"/);
  assert.match(html, /data-archive-mobile-panel-open="taxonomy"/);
  assert.match(html, /data-archive-mobile-panel-open="weather"/);
  assert.match(html, /class="archive-taxonomy-card"/);
  assert.match(html, /id="archiveCommentsRecentList"/);
  assert.match(html, /id="archiveAllCommentsList"/);
  assert.match(html, /id="archiveCommentsOpenAll"/);
  assert.match(html, /id="archiveCommentsDialog"/);
  assert.match(html, /data-archive-mobile-panel-backdrop/);
  assert.match(html, /data-archive-mobile-panel-close/);
  assert.match(html, /function installArchiveMobilePanels\(\)/);
  assert.match(html, /archive-weather\.js\?v=20260809-weather1/);
  assert.match(html, /archive-comment-explorer\.js\?v=20260811-view-identity1/);
  assert.ok(html.indexOf('class="request-board"') < html.indexOf("data-archive-weather"));
  assert.match(html, /archive-visitor-counter\.js\?v=20260809-visits1/);
  assert.match(html, /id="archivePageSize"/);
  assert.match(html, /id="archiveSort"/);
  assert.match(html, /<option value="created">생성일 최신순<\/option>/);
  assert.match(html, /<option value="updated">수정일 최신순<\/option>/);
  assert.match(html, /<option value="views">조회수 높은순<\/option>/);
  assert.match(html, /<option value="5">5개<\/option>/);
  assert.match(html, /<option value="10">10개<\/option>/);
  assert.match(html, /<option value="20">20개<\/option>/);
  assert.match(html, /<option value="30" selected>30개<\/option>/);
  assert.match(html, /var DEFAULT_PAGE_SIZE = 30/);
  assert.match(html, /var ALLOWED_SORTS = \["created", "updated", "views"\]/);
  assert.match(html, /state\.pageSize/);
  assert.match(html, /state\.sort/);
  assert.match(html, /post\.dataset\.adminTitle/);
  assert.match(html, /post\.dataset\.adminSummary/);
  assert.equal(html.match(/data-report-share(?=[ >])/g)?.length, 31);
  assert.equal(html.match(/class="archive-share-button"[^>]*>[\s\S]*?class="archive-share-icon"/g)?.length, 31);
  assert.doesNotMatch(html, />공유<\/button>/);
  assert.match(html, /function archiveShareIconMarkup\(/);
  assert.match(html, /setArchiveShareState\(button, "check"/);
  assert.match(html, /function copyReportLink\(/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /document\.execCommand\("copy"\)/);

  const archiveCss = fs.readFileSync(new URL("../styles/magazine.css", import.meta.url), "utf8");
  assert.match(archiveCss, /\.archive-post\s*{[^}]*--archive-cover-width:\s*154px[^}]*--archive-cover-gap:\s*18px/s);
  assert.match(archiveCss, /\.archive-post-copy\s*{[^}]*padding-right:\s*44px/s);
  assert.match(archiveCss, /\.archive-share-button\s*{[^}]*right:\s*calc\(var\(--archive-cover-width\) \+ var\(--archive-cover-gap\) \+ var\(--archive-cover-edge\)\)/s);
  assert.match(archiveCss, /\.archive-topbar-inner\s*{[^}]*width:\s*min\(var\(--archive-shell-max\),\s*calc\(100% - \(var\(--archive-shell-edge\) \* 2\)\)\)/s);
  assert.match(archiveCss, /--archive-right-rail-width:\s*270px/);
  assert.match(archiveCss, /\.archive-content-layout\s*{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) var\(--archive-right-rail-width\)/s);
  assert.doesNotMatch(archiveCss, /\.request-board-list\s*{[^}]*max-height:/s);
  assert.match(archiveCss, /\.archive-comments-card/);
  assert.match(archiveCss, /\.archive-comments-dialog::backdrop/);
  assert.match(archiveCss, /is-mobile-panel-comments/);
  const privateArchiveCss = fs.readFileSync(new URL("../site/assets/archive-private-library.css", import.meta.url), "utf8");
  assert.match(privateArchiveCss, /is-mobile-panel-taxonomy/);
  assert.match(archiveCss, /\.archive-topbar \.report-hub-clock-date\s*{\s*display:\s*none;/s);
  assert.match(archiveCss, /\.archive-admin-console-link\[hidden\]\s*{\s*display:\s*none;/);
  assert.match(
    archiveCss,
    /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.archive-board-head\s*{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);[^}]*align-items:\s*stretch;/,
  );
  assert.match(
    archiveCss,
    /@media \(max-width:\s*860px\)\s*{[\s\S]*?\.archive-sidebar\s*{\s*display:\s*none;\s*}[\s\S]*?\.archive-mobile-categories\s*{\s*display:\s*none;\s*}/,
  );
  assert.match(archiveCss, /\.archive-mobile-panel-actions\s*{\s*display:\s*none;/);
  assert.match(
    archiveCss,
    /@media \(max-width:\s*860px\)\s*{[\s\S]*?\.archive-mobile-panel-actions\s*{[^}]*display:\s*grid;[\s\S]*?\.archive-right-rail\s*{[^}]*display:\s*none;/,
  );
  assert.match(
    archiveCss,
    /\.archive-mobile-panel-actions\s*{[^}]*top:\s*calc\(var\(--rh-archive-mobile-height\) \+ var\(--rh-space-3\)\);[^}]*right:\s*var\(--archive-shell-edge-mobile\);/,
  );
  assert.match(
    archiveCss,
    /@media \(max-width:\s*640px\)\s*{[\s\S]*?\.archive-mobile-panel-actions\s*{[^}]*top:\s*auto;[^}]*bottom:\s*var\(--rh-space-4\);/,
  );
  assert.match(archiveCss, /body\.archive-mobile-panel-open\s*{\s*overflow:\s*hidden;/);
  assert.match(
    archiveCss,
    /@media \(prefers-reduced-motion:\s*reduce\)\s*{[\s\S]*?\.archive-mobile-panel-button,\s*\.archive-mobile-panel-close\s*{\s*transition:\s*none;/,
  );
});

test("curates blocked and duplicate archive tags into one searchable navigation tag", () => {
  const base = {
    subtitle: "",
    summary: "태그 정리 확인",
    category: "AI",
    displayDate: "260810",
    sourceCount: 1,
    createdAt: "2026-08-10T09:00:00+09:00",
    updatedAt: "2026-08-10T10:00:00+09:00",
  };
  const html = renderHomeHtml([
    {
      ...base,
      id: "tag-one",
      path: "reports/tag-one/",
      title: "첫 번째 태그 보고서",
      tags: ["Draft", "Jeremy Style", "Hermes Agent", "hermes", "LLM-Wiki", "LLM Wiki"],
    },
    {
      ...base,
      id: "tag-two",
      path: "reports/tag-two/",
      title: "두 번째 태그 보고서",
      tags: ["Hermes", "LLM Wiki", "Temporary Chat", "AI Report"],
    },
  ] as any);

  assert.doesNotMatch(html, /#Draft|#Jeremy Style|#Temporary Chat|#AI Report/);
  assert.equal(html.match(/data-tag-filter="hermes"/g)?.length, 2);
  assert.equal(html.match(/data-tag-filter="llm-wiki"/g)?.length, 2);
  assert.match(html, /data-tag-keys="hermes\|llm-wiki"/);
});

test("renders the same fallback count and report-specific share URL on archive cards", () => {
  const html = renderHomeHtml([
    {
      id: "sample-count",
      path: "reports/sample-count.html",
      title: "조회수 샘플",
      subtitle: "",
      summary: "조회수 확인",
      category: "AI",
      tags: [],
      displayDate: "260809",
      sourceCount: 1,
    },
  ] as any, "", {}, { "sample-count": 17 });

  assert.match(html, /data-view-count-fallback="17">조회수 17<\/span>/);
  assert.match(html, /data-report-share[^>]*data-report-share-url="reports\/sample-count\.html"/);
});

test("renders a top spotlight with three curated defaults and three view-ranked reports", () => {
  const items = Array.from({ length: 6 }, (_, index) => ({
    id: `spotlight-${index + 1}`,
    path: `reports/spotlight-${index + 1}/`,
    title: `추천 후보 ${index + 1}`,
    subtitle: "",
    summary: `추천 후보 ${index + 1} 요약`,
    category: index % 2 ? "비즈니스" : "AI",
    tags: [],
    displayDate: `26080${9 - index}`,
    sourceCount: index + 1,
    coverImage: `assets/spotlight-${index + 1}.png`,
  })) as any;
  const counts = {
    "spotlight-1": 3,
    "spotlight-2": 21,
    "spotlight-3": 8,
    "spotlight-4": 34,
    "spotlight-5": 13,
    "spotlight-6": 1,
  };

  const html = renderHomeHtml(items, "../", {}, counts);

  assert.ok(html.indexOf('class="archive-spotlight"') < html.indexOf('class="archive-content-layout"'));
  assert.match(html, /id="archiveSpotlight"/);
  assert.match(html, /id="archiveFeaturedList"/);
  assert.match(html, /id="archivePopularList"/);
  assert.match(html, /<h2 id="featured-title">Jeremy's Pick<\/h2>/);
  assert.doesNotMatch(html, /관리자 추천/);
  assert.equal(html.match(/data-featured-fallback-item/g)?.length, 3);
  assert.equal(html.match(/data-popular-report/g)?.length, 3);
  const popular = html.slice(html.indexOf('id="archivePopularList"'));
  const featured = html.slice(
    html.indexOf('id="archiveFeaturedList"'),
    html.indexOf('id="archivePopularList"'),
  );
  assert.ok(popular.indexOf("추천 후보 4") < popular.indexOf("추천 후보 2"));
  assert.ok(popular.indexOf("추천 후보 2") < popular.indexOf("추천 후보 5"));
  assert.match(popular, /조회수 34/);
  assert.match(featured, /조회수 3/);
  assert.doesNotMatch(featured, /추천 후보 2/);
  assert.match(html, /class="archive-marker">지금 읽을 보고서<\/span>/);
});

test("Draft reports use a separate category and stay out of the default total", () => {
  const base = {
    path: "reports/sample/",
    title: "보고서",
    subtitle: "",
    summary: "요약",
    tags: [],
    displayDate: "260809",
    sourceCount: 1,
  };
  const html = renderHomeHtml([
    { ...base, id: "published-one", category: "AI" },
    { ...base, id: "draft-one", category: "Draft", title: "초안 보고서" },
  ] as any);
  assert.match(html, /data-category-filter="Draft"[^>]*hidden[^>]*><span>Draft<\/span><b>1<\/b>/);
  assert.match(html, /data-report-id="draft-one"[^>]*data-report-draft="true"/);
  assert.match(html, /!isDraft \|\| isPromoted/);
  assert.match(html, /data-category-filter="all"><span>전체<\/span><b>1<\/b>/);
});

test("keeps the management ID while attaching the path-based public ID", () => {
  const html = renderHomeHtml([
    {
      id: "management-id",
      path: "reports/public-report/index.html",
      title: "공개 ID 연결 샘플",
      subtitle: "",
      summary: "요약",
      category: "AI",
      tags: [],
      displayDate: "260811",
      sourceCount: 1,
      coverImage: "assets/public-report.png",
    },
  ] as any, "../", {}, { "public-report": 42, "management-id": 7 });

  assert.match(html, /data-report-id="management-id"[^>]*data-report-public-id="public-report"/);
  assert.match(html, /data-view-count-fallback="42">조회수 42<\/span>/);
  assert.doesNotMatch(html, /<figcaption>/);
  assert.match(html, /260811/);
});

test("renders Draft filters hidden until administrator unlock and protects Draft URLs", () => {
  const html = renderHomeHtml([
    {
      id: "published-one",
      path: "reports/published-one/",
      title: "공개 보고서",
      subtitle: "",
      summary: "요약",
      category: "AI",
      tags: [],
      displayDate: "260811",
      sourceCount: 1,
    },
    {
      id: "draft-one",
      path: "reports/drafts/draft-one/",
      title: "초안 보고서",
      subtitle: "",
      summary: "요약",
      category: "Draft",
      tags: [],
      displayDate: "260811",
      sourceCount: 1,
    },
  ] as any);

  assert.equal(html.match(/data-category-filter="Draft"[^>]*\shidden(?:\s|=|>)/g)?.length, 3);
  assert.match(html, /state\.category === "Draft" && !adminUnlocked/);
  assert.match(html, /window\.reportmodeAdminUnlocked === true/);
  assert.match(html, /setInterval\([\s\S]*?30000/);
  assert.match(html, /visibilitychange/);
});

test("renders a locked private category without embedding private report data", () => {
  const html = renderHomeHtml([
    {
      id: "public-one",
      path: "reports/public-one/",
      title: "공개 보고서",
      subtitle: "",
      summary: "공개 요약",
      category: "AI",
      tags: [],
      displayDate: "260811",
      sourceCount: 1,
    },
  ] as any);

  assert.equal(html.match(/data-category-filter="Private"/g)?.length, 3);
  assert.equal(html.match(/data-private-category(?:\s|>)/g)?.length, 3);
  assert.match(html, /class="archive-taxonomy-card"/);
  assert.match(html, /data-archive-mobile-panel-open="taxonomy"/);
  assert.match(html, /reportmode:archive-close-mobile-panel/);
  assert.match(html, /id="archivePrivateAuthDialog"/);
  assert.match(html, /id="archivePrivatePassword"[^>]*type="password"/);
  assert.match(html, /id="archivePrivateAuthStatus"[^>]*role="status"/);
  assert.match(html, /archive-private-library\.css/);
  assert.match(html, /archive-private-library\.js/);
  assert.match(html, /if \(filterValue === "Private"\) return/);
  assert.match(html, /window\.reportmodePrivateLibraryActive === true/);
  assert.doesNotMatch(html, /private_reports/);
  assert.doesNotMatch(html, /657700/);
});
