# GitHub Upload Guide

- Repository: `aihubos/reportmode`
- Branch: `main`
- Target folder: `reports/260810-01-m5-max-dgx-spark-ryzen-ai-max-395-v1-0-0/`
- Canonical URL: `https://aihubos.github.io/reportmode/reports/260810-01-m5-max-dgx-spark-ryzen-ai-max-395-v1-0-0/`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`

## Upload

1. ZIP 루트의 `reports/260810-01-m5-max-dgx-spark-ryzen-ai-max-395-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 그대로 추가합니다.
2. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
3. `archive-entry.json`은 기존 아카이브 파일을 읽은 뒤 안전하게 카드 데이터로 병합합니다.
4. `sitemap-entry.xml`은 기존 sitemap을 덮어쓰지 말고 URL 항목만 삽입합니다.
5. 실제 공개 전 Apple·NVIDIA·AMD 가격과 Ollama 태그를 다시 확인합니다.

## Important

- 기존 `archive/index.html`과 `sitemap.xml`을 빈 파일로 덮어쓰지 마세요.
- 영상 벤치마크는 개인 측정입니다. 제목과 본문에서 보편적 성능 사실로 확대하지 마세요.
- 공유 스크립트 상대 경로는 보고서 폴더 기준 `../../assets/`입니다.
