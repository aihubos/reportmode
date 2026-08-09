# Report Hub 업로드 안내

## 보고서
- 제목: 데미스 하사비스 일대기: 4세 체스 신동에서 노벨상·Alphabet 수석과학자까지
- 버전: v1.0.0
- 상태: Draft — 외부 공개 전 사용자 승인 필요
- Canonical: https://aihubos.github.io/reportmode/reports/260810-01-demis-hassabis-life-timeline-v1-0-0/

## 업로드 위치
이 ZIP의 `reports/260810-01-demis-hassabis-life-timeline-v1-0-0/` 폴더를 저장소 `aihubos/reportmode`의 동일 경로에 추가합니다.

## 공유 자산
`index.html`은 보고서 폴더 기준으로 다음 기존 스크립트를 참조합니다.
- `../../assets/report-page-layout.js`
- `../../assets/report-view-counter.js`
- `../../assets/report-comments.js`
- `../../assets/report-history.js`
- `../../assets/report-hub-brand.js`

## 안전한 아카이브 갱신
`archive-entry.json`과 `sitemap-entry.xml`은 삽입용 데이터입니다. 기존 `archive/index.html` 또는 sitemap 원문을 읽지 않은 상태에서 전체 파일을 덮어쓰지 마십시오.

## 무결성
루트 `upload-manifest.json`은 모든 payload 파일의 SHA256과 크기를 기록합니다. 자기 자신은 재귀 해시 문제가 있어 목록에서 제외하며 `manifestPolicy`에 명시했습니다.

## 게시 전 확인
1. 2026년 8월 이후 하사비스의 직책 변경 여부
2. 외부 출처 URL 접근 여부와 어린 시절 회고 표현
3. 사용자 제공 데미스 하사비스 사진이 대표 썸네일로 올바르게 표시되는지
