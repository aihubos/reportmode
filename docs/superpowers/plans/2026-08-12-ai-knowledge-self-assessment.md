# AI 지식 자가진단 슬라이드 보고서 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제공된 10개 AI 지식 점검 이미지를 한 화면에 한 장씩 보여 주는 Report Hub 슬라이드 보고서를 공개한다.

**Architecture:** `reports/260812-ai-knowledge-self-assessment/` 안에 독립 HTML과 로컬 이미지 자산을 둔다. HTML은 슬라이드 순서와 이동 상태를 브라우저에서만 관리하고, `reports/manifest.json`은 도서관 카드와 대표 이미지를 연결한다. 공통 Report Hub 브랜드·레이아웃·댓글·조회수·이력 스크립트는 기존 페이지와 같은 상대 경로로 한 번씩 포함한다.

**Tech Stack:** 정적 HTML, CSS, 브라우저 JavaScript, Report Hub 정적 생성기, Node.js 검수 스크립트, GitHub Pages.

---

### Task 1: 격리 작업본과 입력 자산을 준비한다

**Files:**
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-01-beginner-word-cloud.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-01-beginner-term-table.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-02-intermediate-word-cloud.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-02-intermediate-term-table.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-03-advanced-word-cloud.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-03-advanced-term-table.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-04-expert-word-cloud.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-04-expert-term-table.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-05-frontier-word-cloud.png`
- Create: `reports/260812-ai-knowledge-self-assessment/assets/level-05-frontier-term-table.png`

- [ ] **Step 1: 입력 폴더에서 10개 이미지 이름을 확인한다.**

Run: `rg --files '<input-root>' | rg 'word-cloud|term-table'`

Expected: 워드클라우드 5개와 용어표 5개가 한 번씩 보인다.

- [ ] **Step 2: 보고서 전용 assets 폴더에 명확한 영문 이름으로 복사한다.**

Expected: 보고서 외부의 iCloud 경로를 참조하지 않고, `assets/` 아래에 10개 이미지가 있다.

- [ ] **Step 3: 이미지 차원과 파일 수를 확인한다.**

Run: `sips -g pixelWidth -g pixelHeight reports/260812-ai-knowledge-self-assessment/assets/*.png`

Expected: 10개 모두 읽을 수 있고 0바이트 파일이 없다.

### Task 2: 한 장씩 넘기는 전체 화면 슬라이드 보고서를 만든다

**Files:**
- Create: `reports/260812-ai-knowledge-self-assessment/index.html`

- [ ] **Step 1: 보고서 머리말과 공통 Report Hub 자산 연결을 작성한다.**

Include: `data-report-cover`, Report Hub 제목·파비콘·공통 브랜드·레이아웃·댓글 CSS 상대 경로.

- [ ] **Step 2: 10개 슬라이드의 순서 데이터를 HTML에 정의한다.**

Expected order: 초급 워드클라우드→초급 용어표→중급 워드클라우드→중급 용어표→심화 워드클라우드→심화 용어표→전문가 워드클라우드→전문가 용어표→연구·최전선 워드클라우드→연구·최전선 용어표.

- [ ] **Step 3: 전체 화면 이미지 무대를 구현한다.**

Use `object-fit: contain`, 어두운 배경, 이미지의 원본 비율 유지, 작은 제목·단계·진행 표시를 적용한다. 화면마다 이미지 하나만 표시한다.

- [ ] **Step 4: 수동 이동을 구현한다.**

Implement: 이전·다음 버튼, 키보드 `ArrowLeft`·`ArrowRight`, 모바일 수평 스와이프, 마지막/첫 번째 경계 처리, `aria-live` 상태 알림. 자동 재생은 넣지 않는다.

- [ ] **Step 5: 동작 축소 환경과 모바일 CSS를 넣는다.**

Implement: `prefers-reduced-motion`에서 전환을 최소화하고, 390px에서 버튼·텍스트가 겹치거나 가로 넘침이 없게 한다.

- [ ] **Step 6: 기존 공통 기능 스크립트를 정확히 한 번씩 추가한다.**

Include: `report-page-layout.js`, `report-view-counter.js`, `report-comments.js`, `report-history.js`, `report-entry-tracker.js`, `report-hub-brand.js`.

### Task 3: 도서관 카드와 생성 결과를 연결한다

**Files:**
- Modify: `reports/manifest.json`
- Modify: `archive/index.html` (생성 결과만)

- [ ] **Step 1: 새 manifest 항목을 최상단에 추가한다.**

Set: ID, slug, 제목 `[자가진단] 나의 AI 관련 지식은 어느 수준?`, category `AI`, 간단한 설명, `260812` 작성일, `sourceCount: 0`, 1번 워드클라우드 `coverImage`, 적절한 `coverAlt`.

- [ ] **Step 2: 도서관을 다시 생성한다.**

Run: `npm run report -- archive-build`

Expected: 새 카드는 도서관 상단에 있고 실제 첫 번째 워드클라우드 썸네일을 표시한다.

### Task 4: 정적 검수와 브라우저 검수를 실행한다

**Files:**
- Verify: `reports/260812-ai-knowledge-self-assessment/index.html`
- Verify: `reports/manifest.json`
- Verify: `archive/index.html`

- [ ] **Step 1: 보고서 자산·마크업·경로를 점검한다.**

Run: `npm run reports:integrity && npm run reports:brand-qa && npm run reports:view-id-qa`

Expected: 새 보고서의 공통 스크립트와 대표 이미지 경로가 통과한다.

- [ ] **Step 2: 프로젝트 회귀 검수를 실행한다.**

Run: `npm test && npm run typecheck`

Expected: 종료 코드 0.

- [ ] **Step 3: 로컬 서버에서 데스크톱과 390px 화면을 확인한다.**

Check: 첫·마지막 슬라이드, 버튼·키보드 이동, 이미지 비율, 가로 넘침, 콘솔 오류, 도서관 카드의 썸네일.

### Task 5: 안전하게 공개하고 Pages를 확인한다

**Files:**
- Commit: 새 보고서, 10개 이미지, manifest, 생성된 archive, 계획·설계 문서

- [ ] **Step 1: 변경 범위와 비밀정보를 확인한다.**

Run: `git diff --check && git status --short`

Expected: 의도한 새 보고서·자산·도서관·문서만 있다.

- [ ] **Step 2: 검증된 파일만 커밋하고 브랜치를 푸시한다.**

Expected: 강제 푸시 없이 PR을 만들 수 있는 커밋 SHA가 있다.

- [ ] **Step 3: PR을 병합한 뒤 GitHub Pages 완료 상태를 기다린다.**

Expected: Pages가 병합 커밋을 빌드한다.

- [ ] **Step 4: 공개 보고서와 도서관을 다시 확인한다.**

Check: 공개 URL 200, 10개 슬라이드, 대표 썸네일, Report Hub 메인 링크.
