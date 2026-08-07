# Report Wishlist v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 페이지의 희망 리포트 패널에 신청자 이름·비밀번호, 본인 수정·삭제, 공개 관리자 답글 기능을 추가한다.

**Architecture:** GitHub Pages의 `archive/index.html`은 화면과 상호작용을 담당하고, Cloudflare Worker는 비밀번호 확인과 CRUD API를 담당한다. D1에는 신청자 정보와 비밀번호 변환값을 기존 요청 행에 추가하고, 관리자 답글은 요청 ID에 연결된 별도 테이블로 저장한다.

**Tech Stack:** 정적 HTML/CSS/JavaScript, Cloudflare Workers TypeScript, D1 SQLite, Wrangler, Playwright CLI

---

### Task 1: D1 요청 게시판 스키마 확장

**Files:**
- Create: `workers/report-request-board/migrations/0003_request_board_v2.sql`

- [ ] `report_requests`에 `author`, `password_salt`, `password_hash`, `updated_at` 열을 추가한다.
- [ ] 요청 ID와 1:1로 연결되는 `report_request_replies` 테이블과 작성일 인덱스를 추가한다.
- [ ] 로컬 D1에 마이그레이션을 적용하고 오류가 없는지 확인한다.
- [ ] 스키마 변경을 커밋한다.

### Task 2: 요청 수정·삭제·관리자 답글 API

**Files:**
- Modify: `workers/report-request-board/src/index.ts`

- [ ] Worker `Env`에 `ADMIN_PASSWORD`를 추가하고 CORS 허용 메서드에 `PATCH`를 포함한다.
- [ ] `GET /requests`가 신청자 이름, 수정 시각, 관리자 답글을 함께 반환하도록 JOIN 조회를 구현한다.
- [ ] `POST /requests`가 이름·비밀번호·내용을 검증하고 비밀번호 원문 대신 salt/hash를 저장하도록 구현한다.
- [ ] `PATCH /requests/:id`가 작성 비밀번호를 확인한 뒤 이름과 내용을 수정하도록 구현한다.
- [ ] `DELETE /requests/:id`가 작성 비밀번호를 확인한 뒤 요청과 연결 답글을 삭제하도록 구현한다.
- [ ] `POST /requests/:id/reply`가 `ADMIN_PASSWORD`를 확인한 뒤 관리자 답글을 등록하거나 갱신하도록 구현한다.
- [ ] 잘못된 입력, 잘못된 비밀번호, 기존 읽기 전용 글에 각각 명확한 오류 코드를 반환한다.
- [ ] TypeScript 검사를 통과시키고 API 변경을 커밋한다.

### Task 3: 우측 플로팅 게시판 UI 고도화

**Files:**
- Modify: `archive/index.html`

- [ ] 제목 핵심 문구에 노란 형광펜 효과를 추가하되 텍스트 대비를 유지한다.
- [ ] 등록 폼에 신청자 이름과 수정·삭제 비밀번호 입력란을 추가한다.
- [ ] 게시물 카드에 이름 배지, 작성일, 전체 요청 내용, 수정·삭제·관리자 답글 버튼을 배치한다.
- [ ] 수정 시 이름·내용·작성 비밀번호를 받는 인라인 편집 폼을 제공한다.
- [ ] 삭제 시 작성 비밀번호를 확인하고 성공 후 목록을 갱신한다.
- [ ] 관리자 답글 입력 시 답글과 관리자 비밀번호를 받고 공개 답글 영역에 표시한다.
- [ ] 관리자 답글이 있는 글은 `답글 수정`으로 다시 저장할 수 있게 한다.
- [ ] 1280px 이상에서는 우측 고정 패널, 작은 화면에서는 전체 폭 일반 배치를 유지한다.
- [ ] 서버 오류와 각 비밀번호 오류를 버튼 근처의 상태 문구로 안내한다.
- [ ] UI 변경을 커밋한다.

### Task 4: 로컬 기능·화면 검수

**Files:**
- Verify only

- [ ] 로컬 Worker에 신규 마이그레이션을 적용하고 `ADMIN_PASSWORD` 개발 변수를 주입해 실행한다.
- [ ] 등록 → 잘못된 비밀번호 수정 거부 → 정상 수정 → 잘못된 관리자 비밀번호 거부 → 정상 답글 → 정상 삭제 순서로 API를 검증한다.
- [ ] 정적 사이트를 실행하고 Playwright로 1440px 우측 고정, 스크롤 추적, 형광펜 제목, 입력·카드·답글 표시를 확인한다.
- [ ] 390px에서 가로 넘침 없이 입력·수정·삭제·답글 UI가 표시되는지 확인한다.
- [ ] `npm run typecheck`, `git diff --check`를 통과시킨다.

### Task 5: Worker와 GitHub Pages 공개

**Files:**
- Deploy only

- [ ] 원격 D1에 `0003_request_board_v2.sql`을 적용한다.
- [ ] Cloudflare Worker 비밀 환경값 `ADMIN_PASSWORD`를 설정한다.
- [ ] Worker를 배포하고 공개 API에서 전체 CRUD 흐름을 실제 검증한다.
- [ ] 테스트 요청과 답글을 정확한 ID로 삭제하고 잔여 테스트 데이터가 0건인지 확인한다.
- [ ] 변경 브랜치를 GitHub에 올리고 PR을 생성·병합한다.
- [ ] GitHub Pages가 병합 커밋으로 성공했는지 확인한다.
- [ ] 공개 메인 페이지에서 데스크톱·모바일 UI와 실제 등록·수정·답글·삭제를 재검증한다.
