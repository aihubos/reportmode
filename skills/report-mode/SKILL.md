---
name: report-mode
description: Create source-grounded magazine reports, render them to static HTML, and auto-publish to aihubos/reportmode GitHub Pages. Use when Jeremy asks for 레포트 모드, reportmode, magazine report, GitHub Pages report publish, Hermes report, or Codex report generation.
version: 1.0.0
metadata:
  hermes:
    tags: [report, magazine, github-pages, research]
    category: reporting
  openaicodex:
    tags: [report, magazine, github-pages]
---

# Report Mode

Jeremy 전용 매거진 보고서 생성·공개 스킬입니다.

## When to Use
- 보고서/레포트/매거진 리포트를 만들어 달라고 할 때
- Hermes 또는 로컬 Codex에서 Report Mode를 쓸 때
- GitHub Pages(`https://aihubos.github.io/reportmode/`)에 보고서를 올릴 때

## Core Rules
1. AI는 완성 HTML을 직접 쓰지 않는다. **ReportDocument v1 JSON**만 만든다.
2. 날짜 기준은 **Asia/Seoul**. 보고서 id는 `YYMMDD-english-slug` (예: `260702-market-brief`).
3. 화면 표기는 `260702 · 제목`, 본문 날짜는 `2026.07.02 KST`.
4. 정상 생성이 끝나면 **자동 공개**한다. 로컬만 남기려면 `--draft`.
5. 출처 URL 수집이 하나라도 실패하면 공개하지 않고 중단한다.
6. 기사 전문을 저장하지 않는다. 제목·발행처·URL·발행일·확인일만 남긴다.
7. 사실(`fact`) / 분석(`analysis`) / 전망(`forecast`) / 루머(`rumor`)를 분리한다.
8. 강제 푸시 금지. 원격 충돌 시 로컬 결과를 보존하고 `retry-publish`로 안내한다.

## Working Directory
기본 저장소: `/Users/JeremyLee/Projects/reportmode`
공개 사이트: `https://aihubos.github.io/reportmode/`
GitHub: `https://github.com/aihubos/reportmode`

## Procedure
1. 주제, 독자, 목적, 출처 URL/메모를 확인한다.
2. 출처를 조사한 뒤 ReportDocument v1 JSON을 만든다.
3. JSON을 임시 파일로 저장한다. 예: `.reportmode/imports/<id>.json`
4. 저장소에서 실행한다:

```bash
cd /Users/JeremyLee/Projects/reportmode
npm run report -- import .reportmode/imports/<id>.json
```

5. draft만 필요하면:

```bash
npm run report -- import .reportmode/imports/<id>.json --draft
```

6. 회사 API 직접 생성:

```bash
npm run report -- create \
  --topic "주제" \
  --provider openai \
  --url https://example.com/a \
  --url https://example.com/b \
  --notes "추가 메모"
```

7. 공개 실패 시:

```bash
npm run report -- retry-publish <id>
```

8. 기존 보고서 수정 시 createdAt 보존:

```bash
npm run report -- update <id> --document .reportmode/imports/<id>.json
```

## Final Response Format
항상 아래 항목을 한국어로 짧게 보고한다.
- 작성일 (`YYMMDD`)
- 제목
- 출처 수
- 공개 URL
- GitHub 커밋
- Pages 상태

예시:
```
작성일: 260802
제목: Apple 폴더블 iPhone
출처 수: 4
공개 URL: https://aihubos.github.io/reportmode/reports/260802-apple-foldable-iphone/
GitHub 커밋: abc1234
Pages 상태: built
```

## Pitfalls
- 공개 GitHub Pages 페이지에서 API 키를 받지 않는다. 생성은 로컬/Hermes/Codex에서만.
- 동일 날짜·유사 제목 충돌 시 엔진이 `-02`, `-03`을 붙인다.
- 기존 id 수정은 반드시 `update`를 사용하고 최초 작성일을 유지한다.
- Pages가 building/404여도 즉시 실패로 단정하지 말고 built와 본문 확인까지 본다.

