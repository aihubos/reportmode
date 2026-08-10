# GitHub Upload Guide

- Repository: `aihubos/reportmode`
- Branch: `main`
- Target folder: `reports/260810-13-rag-vs-llm-wiki-operations-v1-0-0/`
- Expected URL: `https://aihubos.github.io/reportmode/reports/260810-13-rag-vs-llm-wiki-operations-v1-0-0/`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`

## Upload

1. ZIP을 해제합니다.
2. `reports/260810-13-rag-vs-llm-wiki-operations-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 그대로 추가합니다.
3. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
4. `archive-entry.json`과 `sitemap-entry.xml`은 기존 archive/sitemap 원문을 읽은 뒤 안전하게 병합합니다. 기존 파일을 빈 내용으로 덮어쓰지 않습니다.
5. 배포 전 `index.html`의 외부 출처 링크, 모바일 320px, 인쇄 화면, 썸네일 OG 경로를 최종 검토합니다.

## Notes

- `archive-entry.json`은 아카이브 카드 삽입용 데이터입니다.
- `sitemap-entry.xml`은 기존 sitemap에 추가할 단일 `<url>` 조각입니다.
- 실제 GitHub push와 외부 블로그 발행은 사용자 승인 후 수행합니다.
