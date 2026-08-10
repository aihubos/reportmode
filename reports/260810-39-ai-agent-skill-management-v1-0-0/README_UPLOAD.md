# Report Hub 업로드 안내

- Repository: `aihubos/reportmode`
- Branch: `main`
- Report folder: `reports/260810-39-ai-agent-skill-management-v1-0-0/`
- Canonical: https://aihubos.github.io/reportmode/reports/260810-39-ai-agent-skill-management-v1-0-0/
- Version: v1.0.0
- Status: Published · AI-assisted · Published

## 업로드 순서

1. ZIP을 저장소 루트에서 해제합니다.
2. `reports/260810-39-ai-agent-skill-management-v1-0-0/` 폴더와 루트의 `archive-entry.json`, `sitemap-entry.xml`, `upload-manifest.json`을 검토합니다.
3. 기존 `archive/index.html`과 sitemap 원문을 읽지 않은 상태에서는 자동으로 덮어쓰지 않습니다.
4. `archive-entry.json`과 `sitemap-entry.xml`의 내용을 기존 파일에 안전하게 병합합니다.
5. 외부 게시 전에 본문 1인칭 경험, 스킬 템플릿 경로, 최신 Hermes 설치 버전을 사람이 최종 확인합니다.

## 중요

- 실제 GitHub push와 블로그 발행은 이 패키지 생성 과정에서 수행하지 않았습니다.
- `upload-manifest.json`은 자기 자신을 제외한 ZIP payload 파일의 SHA256과 크기를 기록합니다. 자기 참조 해시의 재귀 문제를 피하기 위한 명시적 설계입니다.
