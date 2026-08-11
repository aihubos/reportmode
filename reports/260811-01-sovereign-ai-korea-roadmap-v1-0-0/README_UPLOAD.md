# Report Hub 업로드 안내

## 보고서
- 제목: 소버린 AI란? 비전공자가 10분 만에 이해하는 개념부터 한국의 2028 로드맵까지
- 버전: v1.0.0
- 상태: Draft · Publish-ready
- 기준일: 2026-08-11
- 예상 공개 URL: https://aihubos.github.io/reportmode/reports/260811-01-sovereign-ai-korea-roadmap-v1-0-0/

## 업로드 위치
ZIP의 `reports/260811-01-sovereign-ai-korea-roadmap-v1-0-0/` 폴더를 저장소 `reports/` 아래에 그대로 추가합니다.

## 함께 반영할 데이터
- `archive-entry.json`: 기존 `archive/index.html`을 읽은 뒤 카드 생성에 활용합니다. 기존 파일을 빈 내용으로 덮어쓰지 않습니다.
- `sitemap-entry.xml`: 기존 sitemap을 읽은 뒤 `<urlset>` 안에 안전하게 삽입합니다.
- `upload-manifest.json`: 파일 SHA256과 크기를 확인합니다. manifest 자체는 재귀 해시 문제로 목록에서 제외했습니다.

## 공유 스크립트
`index.html`은 보고서 폴더 기준으로 다음 공유 자산을 참조합니다.
- `../../assets/report-page-layout.js`
- `../../assets/report-view-counter.js`
- `../../assets/report-comments.js`
- `../../assets/report-history.js`
- `../../assets/report-hub-brand.js`

## 발행 전 확인
1. 2026년 8월 독자 AI 파운데이션 모델 2차 평가의 공식 최종 결과가 발표됐는지 재확인
2. GPU 약 5만 장 확보·배분 일정과 국가 AI 컴퓨팅센터 일정 변경 여부 재확인
3. `report.json`의 status를 필요 시 `Published`로 변경하고 embedded `report-metadata`와 일치시킴
