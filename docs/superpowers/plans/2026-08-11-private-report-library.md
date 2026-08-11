# Report Hub Private Report Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 인증 전에는 목록과 원문을 전송하지 않는 Report Hub 비공개 카테고리와 관리 화면을 구축한다.

**Architecture:** 공개 GitHub Pages에는 잠금 UI와 빈 뷰어만 둔다. 기존 Cloudflare Worker가 30분 임시 인증키를 발급하고, 비공개 메타데이터는 D1, HTML과 썸네일은 비공개 R2 버킷에서 읽고 쓴다. 공개 보고서와 Draft 경로는 변경하지 않는다.

**Tech Stack:** TypeScript, Node test runner, Cloudflare Workers, D1, R2, 정적 HTML/CSS/JavaScript, Playwright

---

## 파일 책임

- `workers/report-request-board/src/private-reports.ts`: 임시 세션, 로그인 제한, 메타데이터 정규화, R2 저장 API의 단일 책임 모듈
- `workers/report-request-board/src/private-reports.test.ts`: 인증, 권한, CRUD, 롤백을 검증하는 가짜 D1/R2 기반 테스트
- `workers/report-request-board/src/index.ts`: 기존 API 라우터에서 비공개 모듈로 요청 전달
- `workers/report-request-board/migrations/0010_private_reports.sql`: 비공개 메타데이터, 세션, 인증 실패 테이블
- `workers/report-request-board/wrangler.jsonc`: 비공개 R2 바인딩 선언
- `src/site/assets/archive-private-library.js`: 도서관 카테고리 인증, 목록 렌더링, 잠금 처리
- `src/site/assets/archive-private-library.css`: 기존 토큰만 사용하는 잠금창과 비공개 카드 상태
- `assets/archive-private-library.test.mjs`: 도서관 잠금 상태와 동적 목록 테스트
- `src/lib/render.ts`: `비공개` 카테고리 버튼, 인증 dialog, 공통 자산 로드
- `src/lib/render.test.ts`: 공개 HTML에 비공개 메타데이터가 없고 잠금 버튼만 있는지 검증
- `archive/private/index.html`: 원문이 없는 비공개 보고서 뷰어 껍데기
- `src/site/assets/private-report-viewer.js`: 인증 후 본문 요청과 sandbox iframe 표시
- `src/site/assets/private-report-viewer.css`: 뷰어 잠금, 로딩, 오류, 상단 제어 UI
- `assets/private-report-viewer.test.mjs`: 직접 URL 인증 전 원문 미요청, 인증 후 렌더링 테스트
- `archive/admin/index.html`: 비공개 업로드·수정·삭제 관리 영역과 dialog
- `src/site/assets/archive-admin-console.js`: 기존 관리자 인증 후 임시 인증키 발급 및 비공개 CRUD
- `src/site/assets/archive-admin-console.css`: 기존 관리자 토큰 기반 비공개 관리 표와 업로드 dialog
- `assets/archive-admin-console.test.mjs`: 기존 표 기능과 비공개 관리 회귀 테스트
- `DESIGN.md`: 비공개 잠금·뷰어·관리 컴포넌트 토큰 사용 규칙

### Task 1: 깨끗한 기준선 확인

**Files:**
- Verify only: repository and existing tests

- [ ] **Step 1: 의존성 설치**

Run: `npm ci`

Expected: exit 0 and no tracked-file changes.

- [ ] **Step 2: 현재 핵심 테스트 실행**

Run: `npx tsx --test src/lib/render.test.ts workers/report-request-board/src/*.test.ts && node --test assets/archive-admin-console.test.mjs`

Expected: all existing tests pass.

### Task 2: Worker 인증과 저장 계약

**Files:**
- Create: `workers/report-request-board/src/private-reports.test.ts`
- Create: `workers/report-request-board/src/private-reports.ts`
- Modify: `workers/report-request-board/src/index.ts`

- [ ] **Step 1: 실패하는 인증 테스트 작성**

테스트는 다음 계약을 고정한다.

```ts
test("private list rejects a request without a bearer token", async () => {
  const result = await call(env(), "/private-reports");
  assert.equal(result.response.status, 401);
});

test("private session returns a 30 minute token and stores only its hash", async () => {
  const result = await call(env(), "/private-session", "POST", { adminPassword: "correct" });
  assert.equal(result.response.status, 201);
  assert.match(result.json.token, /^[A-Za-z0-9_-]{40,}$/);
  assert.equal(environment.DB.sessions.has(result.json.token), false);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test workers/report-request-board/src/private-reports.test.ts`

Expected: FAIL because private routes do not exist.

- [ ] **Step 3: 인증 유틸리티 최소 구현**

`private-reports.ts`에서 다음을 구현한다.

```ts
export async function handlePrivateReportRequest(request: Request, env: PrivateEnv): Promise<Response | null>;
```

- 32바이트 `crypto.getRandomValues` 인증키
- SHA-256 인증키 저장
- 30분 만료
- `Authorization: Bearer` 확인
- IP와 별도 secret을 SHA-256 처리한 실패 식별값
- 15분 5회 실패, 30분 차단
- `Cache-Control: private, no-store`

- [ ] **Step 4: 인증 테스트 통과 확인**

Run: `npx tsx --test workers/report-request-board/src/private-reports.test.ts`

Expected: authentication tests pass.

- [ ] **Step 5: CRUD 실패 테스트 추가**

다음을 검증한다.

- 인증 없는 목록, 원문, 표지, 등록, 수정, 삭제는 401
- HTML 최대 5MB, 썸네일 최대 1MB
- 허용 HTML MIME과 이미지 MIME만 저장
- 등록 성공 후 목록과 원문 일치
- 수정 실패 시 기존 R2 객체 유지
- 삭제 후 목록과 원문에서 제거

- [ ] **Step 6: R2와 D1 CRUD 구현**

업로드는 `multipart/form-data`를 사용한다. R2 객체를 먼저 쓰고 D1 저장 실패 시 새 객체를 삭제한다. 수정은 임시 R2 키를 쓴 뒤 D1 변경 성공 후 기존 객체를 정리한다.

- [ ] **Step 7: Worker 전체 테스트**

Run: `npx tsx --test workers/report-request-board/src/*.test.ts`

Expected: all Worker tests pass.

- [ ] **Step 8: 커밋**

```bash
git add workers/report-request-board/src/private-reports.ts workers/report-request-board/src/private-reports.test.ts workers/report-request-board/src/index.ts
git commit -m "feat: add protected private report API"
```

### Task 3: 저장소 migration과 배포 설정

**Files:**
- Create: `workers/report-request-board/migrations/0010_private_reports.sql`
- Modify: `workers/report-request-board/wrangler.jsonc`

- [ ] **Step 1: migration 작성**

세 테이블과 만료 조회 인덱스를 만든다.

```sql
CREATE TABLE IF NOT EXISTS private_reports (...);
CREATE TABLE IF NOT EXISTS private_admin_sessions (...);
CREATE TABLE IF NOT EXISTS private_auth_attempts (...);
```

- [ ] **Step 2: R2 바인딩 선언**

`PRIVATE_REPORTS` 바인딩을 비공개 버킷 `reportmode-private-reports`에 연결한다.

- [ ] **Step 3: 로컬 migration 적용**

Run: `npx wrangler d1 migrations apply reportmode-request-board --local --config workers/report-request-board/wrangler.jsonc`

Expected: `0010_private_reports.sql` applied.

- [ ] **Step 4: typecheck와 테스트**

Run: `npm run typecheck && npx tsx --test workers/report-request-board/src/*.test.ts`

Expected: pass.

- [ ] **Step 5: 커밋**

```bash
git add workers/report-request-board/migrations/0010_private_reports.sql workers/report-request-board/wrangler.jsonc
git commit -m "chore: configure private report storage"
```

### Task 4: 도서관 비공개 카테고리

**Files:**
- Create: `src/site/assets/archive-private-library.js`
- Create: `src/site/assets/archive-private-library.css`
- Create: `assets/archive-private-library.test.mjs`
- Modify: `src/lib/render.ts`
- Modify: `src/lib/render.test.ts`
- Modify: `DESIGN.md`

- [ ] **Step 1: 실패하는 렌더 테스트 작성**

다음을 고정한다.

- `data-category-filter="Private"` 버튼이 존재한다.
- 인증 전 카운트는 숫자가 아니다.
- dialog는 접근 가능한 label과 status를 가진다.
- 공개 HTML에는 `private_reports` 데이터, 비공개 제목, 원문이 없다.
- 자산 버전이 한 번만 로드된다.

- [ ] **Step 2: 실패 확인**

Run: `npx tsx --test src/lib/render.test.ts && node --test assets/archive-private-library.test.mjs`

Expected: FAIL for missing private library UI.

- [ ] **Step 3: 렌더러와 토큰 계약 확장**

`DESIGN.md`에 기존 색상과 간격만 참조하는 `Private library` 컴포넌트를 추가한다. `render.ts`는 잠금 버튼과 dialog만 정적으로 생성한다.

- [ ] **Step 4: 클라이언트 상태 구현**

클라이언트는 다음 상태를 명시적으로 가진다.

```text
locked -> authenticating -> unlocked/loading -> unlocked/ready
                                      -> unlocked/empty
                                      -> error
expired -> locked
```

인증키는 `sessionStorage.reportmode:private-session`에 저장한다. 목록 링크는 `./private/?report=<id>`로 만든다. 잠금 시 인증키와 동적 DOM을 즉시 제거한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx tsx --test src/lib/render.test.ts && node --test assets/archive-private-library.test.mjs`

Expected: pass.

- [ ] **Step 6: 커밋**

```bash
git add DESIGN.md src/lib/render.ts src/lib/render.test.ts src/site/assets/archive-private-library.* assets/archive-private-library.test.mjs
git commit -m "feat: add locked private archive category"
```

### Task 5: 직접 주소용 비공개 뷰어

**Files:**
- Create: `archive/private/index.html`
- Create: `src/site/assets/private-report-viewer.js`
- Create: `src/site/assets/private-report-viewer.css`
- Create: `assets/private-report-viewer.test.mjs`

- [ ] **Step 1: 실패하는 뷰어 테스트 작성**

- 인증키가 없으면 `/content` 요청 0회
- 비밀번호 성공 후 metadata와 content 요청
- 401이면 iframe을 비우고 잠금 화면 복귀
- iframe에는 `allow-same-origin`이 없음
- 잠금 시 object URL과 인증키 제거

- [ ] **Step 2: 실패 확인**

Run: `node --test assets/private-report-viewer.test.mjs`

Expected: FAIL because viewer assets do not exist.

- [ ] **Step 3: 뷰어 구현**

페이지는 `noindex, nofollow`와 빈 iframe만 포함한다. 스크립트는 인증 성공 전에는 메타데이터나 원문을 요청하지 않는다. HTML은 `srcdoc`에 넣고 sandbox는 `allow-scripts allow-forms allow-popups allow-downloads allow-modals`만 허용한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test assets/private-report-viewer.test.mjs`

Expected: pass.

- [ ] **Step 5: 커밋**

```bash
git add archive/private/index.html src/site/assets/private-report-viewer.* assets/private-report-viewer.test.mjs
git commit -m "feat: add authenticated private report viewer"
```

### Task 6: 관리자 비공개 보고서 관리

**Files:**
- Modify: `archive/admin/index.html`
- Modify: `src/site/assets/archive-admin-console.js`
- Modify: `src/site/assets/archive-admin-console.css`
- Modify: `assets/archive-admin-console.test.mjs`

- [ ] **Step 1: 실패하는 관리자 테스트 작성**

- 기존 관리자 인증 성공 응답의 임시 인증키를 보관
- 비공개 목록을 인증 후에만 요청
- HTML 필수, 썸네일 선택 업로드
- 제목, 설명, 작성일, 출처 수, 태그 수정
- 삭제 확인 후 DELETE
- 401 시 다시 관리자 확인 화면

- [ ] **Step 2: 실패 확인**

Run: `node --test assets/archive-admin-console.test.mjs`

Expected: FAIL for missing private management controls.

- [ ] **Step 3: 관리 HTML과 JS 구현**

기존 통계·공개 보고서 표 아래에 별도 `비공개 보고서 관리` 패널을 추가한다. 한 개의 dialog를 등록과 수정에 재사용한다. 제출 중 모든 관련 버튼을 disabled 처리하고 성공 후 목록을 다시 읽는다.

- [ ] **Step 4: 관리 CSS 구현**

기존 `--rh-*` 토큰과 관리자 표 컴포넌트를 재사용한다. 390px에서는 입력 폼과 버튼을 한 열로 쌓고 표는 기존처럼 자체 가로 스크롤을 사용한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `node --test assets/archive-admin-console.test.mjs`

Expected: old and new admin tests pass.

- [ ] **Step 6: 커밋**

```bash
git add archive/admin/index.html src/site/assets/archive-admin-console.* assets/archive-admin-console.test.mjs
git commit -m "feat: manage private reports from admin console"
```

### Task 7: 빌드와 전체 자동 QA

**Files:**
- Generated: `archive/index.html`, `assets/archive-private-library.*`, `assets/private-report-viewer.*`, `assets/archive-admin-console.*`
- Evidence: `.superloopy/evidence/frontend/20260811-private-report-library/`

- [ ] **Step 1: 빌드**

Run: `npm run build`

Expected: generated archive and root assets updated without rewriting report bodies.

- [ ] **Step 2: 전체 테스트와 정적 점검**

```bash
npm test
npm run typecheck
npm run reports:brand-qa
npm run reports:view-id-qa
npm run reports:links
git diff --check
```

Expected: all pass. Private report titles and HTML must not appear in `reports/manifest.json` or `archive/index.html`.

- [ ] **Step 3: 디자인 토큰 점검**

Run: `superloopy loop prove -- node /Users/JeremyLee/.codex/skills/superloopy-frontend/scripts/ds-compliance.mjs DESIGN.md src/site/assets/archive-private-library.css src/site/assets/private-report-viewer.css src/site/assets/archive-admin-console.css`

Expected: no undeclared colors or off-scale spacing.

### Task 8: 실제 브라우저 QA

**Files:**
- Create evidence: `.superloopy/evidence/frontend/20260811-private-report-library/VISUAL_QA.md`
- Create evidence screenshots at 390px, 768px, 1280px

- [ ] **Step 1: 로컬 Worker와 정적 서버 실행**

로컬 D1/R2를 사용하는 Wrangler와 `python3 -m http.server 8799`를 별도 세션에서 실행한다.

- [ ] **Step 2: 전체 변이 흐름 확인**

실제 브라우저에서 비공개 HTML을 등록하고 다음을 확인한다.

- 잠금 상태에서 원문 요청 없음
- 인증, 목록, 직접 열기, 새로 고침, 잠금, 만료
- 관리자 업로드, 수정, 썸네일 교체, 삭제
- 잘못된 비밀번호와 차단 오류

- [ ] **Step 3: 반응형 캡처와 anti-slop 점검**

390px, 768px, 1280px에서 캡처하고 가로 넘침, 초점, 로딩, 빈 목록, 오류 상태를 확인한다. `VISUAL_QA.md`에 결과를 기록한다.

- [ ] **Step 4: Lighthouse**

프로덕션 빌드를 대상으로 모바일과 데스크톱을 각각 3회 측정하고 중앙값을 `PERF.md`에 기록한다. 90 미만 항목은 수정 후 재측정한다.

### Task 9: Cloudflare와 GitHub Pages 배포

**Files:**
- No new source files unless deployment correction is required

- [ ] **Step 1: Cloudflare 현재 계정 확인**

Run: `npx wrangler whoami`

Expected: the account owning `reportmode-request-board`.

- [ ] **Step 2: R2와 secret 준비**

- `reportmode-private-reports` 버킷이 없을 때만 생성
- 새 `PRIVATE_SESSION_SECRET`을 생성해 Worker secret으로 등록
- secret 값은 터미널 출력과 Git에 남기지 않음

- [ ] **Step 3: 원격 migration 적용**

Run: `npx wrangler d1 migrations apply reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc`

Expected: Cloudflare backup followed by successful `0010` migration.

- [ ] **Step 4: Worker 배포와 API 보호 확인**

Run: `npx wrangler deploy --config workers/report-request-board/wrangler.jsonc`

인증 없는 목록과 원문이 401인지 확인한다.

- [ ] **Step 5: 최종 커밋과 push**

```bash
git add <verified-files-only>
git commit -m "feat: add protected private report library"
git push -u origin codex/private-category-20260811
```

- [ ] **Step 6: main 반영과 Pages 검증**

최신 `origin/main`을 다시 확인하고 fast-forward 또는 PR로 반영한다. Pages가 해당 SHA를 성공 배포한 뒤 두 공개 주소에서 잠금, 인증, 등록한 테스트 보고서 열기와 삭제를 재검증한다.

- [ ] **Step 7: 완료 증거 기록**

Worker 버전, Pages SHA, 테스트 수, 브라우저 캡처 경로, 공개 URL을 최종 보고에 남긴다. 테스트용 비공개 보고서는 검증 후 삭제한다.
