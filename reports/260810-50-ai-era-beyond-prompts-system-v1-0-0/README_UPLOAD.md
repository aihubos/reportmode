# Report Hub 업로드 안내

- 보고서: `2026년 AI 시대, 내가 준비하는 것은 ‘프롬프트’가 아니다`
- 상태: `Published · AI-assisted · Published`
- 대상 저장소: `aihubos/reportmode`
- 브랜치: `main`
- 업로드 폴더: `reports/260810-50-ai-era-beyond-prompts-system-v1-0-0/`
- 예상 공개 URL: `https://aihubos.github.io/reportmode/reports/260810-50-ai-era-beyond-prompts-system-v1-0-0/`

## 업로드 전 검토

1. 개인 경험 표현이 실제 운영 경험과 맞는지 Jeremy Lee가 확인합니다.
2. 2026년 AI Index, WEF, NIST, EU AI Literacy Q&A, 대한민국 AI 기본법 링크와 핵심 숫자를 다시 엽니다.
3. 법률 관련 문장은 일반 정보이며 개별 적용 판단이 아니라는 주의 문구를 유지합니다.
4. `archive-entry.json`과 `sitemap-entry.xml`은 외부 게시 승인 후 기존 파일을 읽고 안전하게 병합합니다. 기존 archive/sitemap 전체를 이 ZIP으로 덮어쓰지 않습니다.

## 파일 구조

```text
reports/260810-50-ai-era-beyond-prompts-system-v1-0-0/
  index.html
  assets/thumbnail.png
  assets/thumbnail.svg
  report.json
  source-ledger.json
  README_UPLOAD.md
upload-manifest.json
archive-entry.json
sitemap-entry.xml
```

## 공유 스크립트

`index.html`은 보고서 폴더 기준 `../../assets/`의 Report Hub 공용 스크립트를 연결합니다. 단독 배포 파일 `ai-era-beyond-prompts-system-v1.0.0.html`은 썸네일을 내장하고 공용 스크립트 없이도 본문·체크리스트·시뮬레이터가 작동합니다.
