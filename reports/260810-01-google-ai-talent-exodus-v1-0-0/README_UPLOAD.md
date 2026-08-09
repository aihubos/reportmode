# Upload Guide — 구글 AI 천재들이 떠난다: 제프 딘 퇴사와 허사비스 개편, 문제는 관료주의보다 속도다

- Repository: `aihubos/reportmode`
- Branch: `main`
- Report folder: `reports/260810-01-google-ai-talent-exodus-v1-0-0/`
- Expected Pages URL: `https://aihubos.github.io/reportmode/reports/260810-01-google-ai-talent-exodus-v1-0-0/`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · user-provided source image included`

## Upload

1. ZIP을 저장소 루트에 풀어 `reports/260810-01-google-ai-talent-exodus-v1-0-0/` 경로를 그대로 유지합니다.
2. `archive-entry.json`은 기존 `archive/index.html`을 덮어쓰지 않고 카드 삽입 데이터로 사용합니다.
3. `sitemap-entry.xml`도 기존 sitemap 원문을 읽은 뒤 안전하게 병합합니다.
4. 실제 게시 전 `report.json`, `source-ledger.json`, 외부 링크, 숫자와 직책을 사람 검수합니다.

## Rights

사용자 제공 신문 스크랩은 배포 파일에 포함하지 않았습니다. 썸네일은 자체 제작한 추상 그래픽이며, Google 로고나 기사 사진을 복제하지 않았습니다.

## Integrity

`upload-manifest.json`은 자기 자신을 제외한 모든 deployable payload 파일의 SHA-256과 크기를 기록합니다. 자기 참조 해시는 안정적으로 만들 수 없어 manifest 자체는 `manifestExcludes`에 명시했습니다.
