# Report Hub 업로드 안내

- Report ID: `260810-25-report-to-blog-class-website`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`
- Target repository: `aihubos/reportmode`
- Branch: `main`
- Target folder: `reports/260810-25-report-to-blog-class-website-v1-0-0/`
- Expected URL: `https://aihubos.github.io/reportmode/reports/260810-25-report-to-blog-class-website-v1-0-0/`

## 업로드 순서

1. ZIP의 `reports/260810-25-report-to-blog-class-website-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 추가합니다.
2. 기존 `archive/index.html`과 `sitemap.xml`을 먼저 읽고, 루트의 `archive-entry.json`과 `sitemap-entry.xml` 내용을 안전하게 병합합니다.
3. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
4. 로컬 또는 미리보기 배포에서 모바일 320px, 데스크톱, 인쇄 화면을 확인합니다.
5. 사람 검토 후 게시 상태를 Draft에서 Published로 갱신합니다.

## 주의

- 기존 archive나 sitemap 원문을 빈 파일로 덮어쓰지 마세요.
- 실제 외부 게시 전 수치, 링크, 공개 범위, 이미지 권리를 최종 검수하세요.
- 공유 스크립트는 보고서 폴더 기준 `../../assets/` 상대 경로를 사용합니다.
