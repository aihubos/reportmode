# Report Hub 업로드 안내

- Report ID: `rh-260810-36-m5-max-128gb-local-llm`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`
- Target repository: `aihubos/reportmode`
- Branch: `main`
- Target folder: `reports/260810-36-m5-max-128gb-local-llm-v1-0-0/`
- Expected Pages URL: `https://aihubos.github.io/reportmode/reports/260810-36-m5-max-128gb-local-llm-v1-0-0/`

## 업로드

1. ZIP의 `reports/260810-36-m5-max-128gb-local-llm-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 그대로 추가합니다.
2. 기존 `archive/index.html`이나 sitemap 원문을 빈 파일로 덮어쓰지 않습니다.
3. ZIP 루트의 `archive-entry.json`과 `sitemap-entry.xml`을 기존 파일에 안전하게 병합합니다.
4. 실제 게시 전 Mac의 사양 화면과 직접 측정한 모델별 수치를 검수합니다.

## 주의

- 본문에는 제공되지 않은 tokens/s·발열·배터리 수치를 만들지 않았습니다.
- 메모리 계산기는 계획용 추정치이며 실제 런타임 값을 보장하지 않습니다.
- `upload-manifest.json`은 자기 자신을 제외한 ZIP payload 파일의 SHA256과 크기를 기록합니다.
