# Report Mode

Jeremy를 위한 source-grounded 매거진 보고서 시스템입니다.

- Public site: https://aihubos.github.io/reportmode/
- Repo: https://github.com/aihubos/reportmode
- 생성: Hermes · 로컬 Codex · 회사 API
- 공개: GitHub Pages (`main` 루트, 자동)

## 한 줄 이해

1. AI는 **ReportDocument JSON**을 만듭니다.
2. Report Mode가 **매거진 HTML**로 렌더링합니다.
3. 정상 생성이면 **자동으로 GitHub Pages에 공개**합니다.
4. `--draft`를 켠 경우만 로컬에 남깁니다.

## 준비

```bash
cd /Users/JeremyLee/Projects/reportmode
npm install
cp .env.example .env   # 필요 시 API 키 입력
```

환경변수 예:

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GEMINI_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY` / `OPENAI_COMPATIBLE_BASE_URL`

## 비개발자용 사용 순서

### 1) 로컬 Studio

```bash
npm run studio
```

브라우저에서 `http://127.0.0.1:8787` 을 엽니다.  
주제·출처·공급자를 넣고 생성하면, 완료 시 즉시 공개됩니다.

### 2) Hermes / 로컬 Codex

```bash
npm run skill:install -- both
```

이후 에이전트에게:

> Report Mode로 OO 주제 보고서 만들어 공개해줘

에이전트는 JSON을 만든 뒤:

```bash
npm run report -- import .reportmode/imports/<id>.json
```

### 3) 회사 API 직접 생성

```bash
npm run report -- create \
  --topic "주제" \
  --provider openai \
  --url https://example.com/source-1 \
  --notes "핵심 메모"
```

지원 공급자: `agent` | `openai` | `anthropic` | `gemini` | `openai-compatible`

### 4) 목록 / 재공개 / 수정

```bash
npm run report -- list
npm run report -- retry-publish <id>
npm run report -- update <id> --document path/to/report.json
npm run build
```

## 날짜 규칙

- 기준 시zone: Asia/Seoul
- id: `YYMMDD-english-slug` 예) `260702-market-brief`
- 화면: `260702 · 제목`
- 본문: `2026.07.02 KST`

## 폴더 구조

- `src/` 생성 엔진, 렌더러, CLI, Studio
- `content/reports/<id>/report.json` 편집 가능한 원본
- `reports/<id>/index.html` 공개 HTML
- `reports/manifest.json` 목록 API성 파일
- `skills/report-mode/` Hermes·Codex 공용 스킬
- `.reportmode/` 로컬 임시 로그/추출물 (Git 제외)

## 기존 보고서

- 신주소: [260802 · Apple 폴더블 iPhone](https://aihubos.github.io/reportmode/reports/260802-apple-foldable-iphone/)
- 구주소 안내: [/reports/apple-foldable-iphone/](https://aihubos.github.io/reportmode/reports/apple-foldable-iphone/)

## 참고

- 매거진 레이아웃 영감: [Artifex](https://github.com/chojondocho/artifex) (MIT, 아이디어만 재구현)
- 상세 고지: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)

