# Report Hub 업로드 안내

- Report: `AI에게 조사시켜도 원문 링크를 끝까지 여는 이유: 출처 검증 7단계`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`
- Target repository: `https://github.com/aihubos/reportmode`
- Branch: `main`
- Upload folder: `reports/260810-01-ai-research-original-source-check-v1-0-0/`
- Expected Pages URL: `https://aihubos.github.io/reportmode/reports/260810-01-ai-research-original-source-check-v1-0-0/`

## 업로드 순서

1. ZIP의 `reports/260810-01-ai-research-original-source-check-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 그대로 추가합니다.
2. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
3. 기존 `archive/index.html` 또는 sitemap을 읽은 뒤, `archive-entry.json`과 `sitemap-entry.xml`을 안전하게 병합합니다.
4. 외부 게시 전 제목, 숫자, 출처 링크, YouTube Help 수동 접근 상태를 사람 검토합니다.
5. 기존 archive/sitemap 원문을 읽지 못한 상태에서는 빈 파일로 덮어쓰지 않습니다.

## QA 요약

- 1200×630 PNG/SVG 썸네일 포함
- 모바일 320px 대응, 표 전용 가로 스크롤
- `prefers-reduced-motion`, 키보드 포커스, skip link, 인쇄 CSS 포함
- 모든 외부 링크에 `target="_blank" rel="noopener noreferrer"` 적용
- `report-metadata`와 `report.json` 버전 `1.0.0` 일치
- 핵심 출처의 확인일·위치·링크 상태는 `source-ledger.json`에 기록
