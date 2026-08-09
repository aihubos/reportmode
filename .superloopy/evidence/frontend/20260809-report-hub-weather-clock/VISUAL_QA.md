# Report Hub 날씨·시계·아이콘 브라우저 QA

검수일: 2026-08-09 KST

## 메인 도서관

- 1280×900: 문서 폭 1280px, 스크롤 폭 1280px로 가로 넘침 없음.
- 1280×900: 브랜드 왼쪽 16px, 우측 고정 영역 380px, 공유 아이콘 36px.
- 1280×900: 첫 공유 아이콘과 대표 이미지 겹침 `false`.
- 768×1024: 브랜드 왼쪽 16px, 우측 영역은 본문 흐름으로 전환, 가로 넘침 없음.
- 390×844: 브랜드 왼쪽 8px, 본문 폭 390px, 스크롤 폭 390px.
- 390×844: 공유 아이콘과 96px 대표 이미지 겹침 `false`.
- 동탄8동 날씨는 현재 28°, 대체로 맑음과 이후 4일 예보를 렌더링했고 `aria-busy=false` 확인.
- 날씨 성공 후 로딩 문구는 숨김 처리됨.
- 메인 공유 클릭 후 URL은 도서관에 유지되고 버튼 상태가 `check`, 안내가 `보고서 링크가 복사되었습니다`로 변경됨.

## 실제 보고서

대표 표본: `reports/260806-palantir-business-ai-analysis/`

- 1280px: 플로팅 메뉴 왼쪽 16px, 브랜드 내부 `flex-start/left`.
- 서울 시계가 `8월 9일 일요일 18:35:47` 형태의 한 줄 `flex`로 표시됨.
- 기본 레이아웃은 `wide`, PDF·공유 버튼은 각각 40×40px.
- PDF·공유 버튼의 화면 텍스트는 비어 있고 `PDF 저장`, `링크 복사` 도움말과 접근성 라벨은 유지됨.
- 공유 클릭 후 `check` 아이콘, `복사 완료`, `보고서 링크가 복사되었습니다` 상태를 확인함.
- 390×844: 문서 폭과 스크롤 폭 모두 390px, 메뉴 8–382px, PDF·공유 버튼 모두 화면 안쪽.
- 브라우저 콘솔 오류 0건, 경고 0건. 비밀번호 폼 관련 Chromium verbose 안내 1건만 존재.

## 캡처

- `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/archive-1280.png`
- `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/archive-768.png`
- `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/archive-390.png`
- `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/report-1280.png`
- `.superloopy/evidence/frontend/20260809-report-hub-weather-clock/report-390.png`
