# Report Hub 업로드 안내

- Report: [인물 연대기] 샘 알트만은 누구인가: 머스크·아모데이와 갈라진 AI 권력의 20년
- Version: v1.0.0
- Status: Draft · AI-assisted · Human review recommended
- Canonical: https://aihubos.github.io/reportmode/reports/260809-21-sam-altman-timeline-musk-amodei-v1-0-0/
- Target repository: `aihubos/reportmode`
- Target branch: `main`

## 업로드 경로

이 ZIP의 `reports/260809-21-sam-altman-timeline-musk-amodei-v1-0-0/` 폴더를 저장소의 동일 경로에 추가합니다.

## 함께 반영할 안전한 항목

- 루트 `archive-entry.json`: 기존 `archive/index.html`을 덮어쓰지 않고 카드 삽입용 데이터만 제공합니다.
- 루트 `sitemap-entry.xml`: 기존 sitemap 전체를 덮어쓰지 않고 URL 한 건만 제공합니다.
- `upload-manifest.json`: ZIP 내 배포 대상 파일의 SHA256과 크기입니다. 자기 자신은 순환 해시 문제로 제외했습니다.

## 게시 전 확인

1. 사람 검수 후 `report.json`과 HTML의 status를 필요 시 Published로 변경합니다.
2. 머스크 소송 항소 제기 상태를 다시 확인합니다.
3. 일일 순번 `21`이 저장소의 실제 최신 순번과 충돌하지 않는지 확인합니다.
4. 기존 archive/sitemap을 읽고 같은 commit에서 안전하게 병합합니다.
