# Report Hub Floating Navigation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 실제 보고서에 토스 블루 텍스트 워드마크, 가로·세로 전환, 제목 최상단 이동을 제공하는 공통 플로팅 메뉴를 배포한다.

**Architecture:** `report-hub-brand.js`가 홈 링크와 제목 이동, 플로팅 메뉴 조립을 담당한다. `report-page-layout.js`는 레이아웃 전환 버튼을 만들고 플로팅 메뉴에 결합한다. `public-brand.ts`는 현재와 향후 보고서에 두 공통 자산을 중복 없이 주입한다.

**Tech Stack:** 정적 HTML, CSS, 브라우저 JavaScript, TypeScript 변환기, Node test, GitHub Pages

---

### Task 1: 디자인 토큰 확장

**Files:**
- Modify: `DESIGN.md`
- Create: `.superloopy/evidence/frontend/20260809-report-hub-floating-nav/DESIGN_TOKENS.md`

- [ ] Toss Blue, 큰 텍스트 워드마크, 플로팅 표면, 모바일 크기 토큰을 DESIGN.md에 기록한다.
- [ ] 같은 내용을 증거 폴더에 복사한다.

### Task 2: 동작 테스트 추가

**Files:**
- Modify: `assets/report-hub-brand.test.mjs`
- Modify: `assets/report-layout.test.mjs`
- Modify: `src/lib/public-brand.test.ts`
- Modify: `scripts/report-brand-qa.mjs`

- [ ] 텍스트 전용 워드마크와 고정 플로팅 메뉴 기대값을 추가한다.
- [ ] 제목 최상단 이동 설치 코드를 검사한다.
- [ ] 모든 실제 보고서가 레이아웃 CSS/JS를 하나씩 가지는지 검사한다.
- [ ] 테스트를 실행해 기존 구현에서 실패하는지 확인한다.

### Task 3: 공통 플로팅 메뉴 구현

**Files:**
- Modify: `assets/report-hub-brand.css`
- Modify: `src/site/assets/report-hub-brand.css`
- Modify: `assets/report-hub-brand.js`
- Modify: `src/site/assets/report-hub-brand.js`
- Modify: `assets/report-page-layout.css`
- Modify: `src/site/assets/report-page-layout.css`
- Modify: `assets/report-page-layout.js`
- Modify: `src/site/assets/report-page-layout.js`

- [ ] 홈 버튼을 Toss Blue 텍스트 워드마크로 변경한다.
- [ ] 홈 버튼과 가로·세로 컨트롤을 하나의 fixed 플로팅 메뉴로 묶는다.
- [ ] 모든 h1에 최상단 이동 동작과 키보드 접근성을 추가한다.
- [ ] 모바일과 인쇄 규칙을 적용한다.
- [ ] 단위 테스트를 통과시킨다.

### Task 4: 모든 실제 보고서 횡전개

**Files:**
- Modify: `src/lib/public-brand.ts`
- Modify: `scripts/standardize-report-brand.ts`
- Modify: `reports/**/*.html`
- Modify: `archive/index.html`
- Modify: `archive/upload.html`

- [ ] 레이아웃 CSS/JS를 중복 없이 삽입하는 변환을 구현한다.
- [ ] 실제 보고서 45개에 변환을 실행한다.
- [ ] 리다이렉트 3개가 바뀌지 않았는지 확인한다.
- [ ] 도서관과 업로드 헤더를 텍스트 워드마크로 맞춘다.

### Task 5: 전체 검증과 배포

**Files:**
- Create: `.superloopy/evidence/frontend/20260809-report-hub-floating-nav/VISUAL_QA.md`
- Create: `.superloopy/evidence/frontend/20260809-report-hub-floating-nav/PERF.md`

- [ ] `npm test`, `npm run typecheck`, `npm run reports:brand-qa`, `npm run reports:integrity`를 통과시킨다.
- [ ] 390px, 768px, 1280px에서 도서관과 대표 보고서를 실제 브라우저로 확인한다.
- [ ] 홈 링크, 제목 최상단 이동, 가로·세로 전환을 직접 조작한다.
- [ ] GitHub PR을 병합하고 Pages 성공 SHA를 확인한다.
- [ ] 실제 도메인과 현재·최신·이전판 URL에서 공개 동작을 다시 확인한다.

