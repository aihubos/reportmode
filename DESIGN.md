# Report Hub Brand System

## 1. Atmosphere / signature

Report Hub는 보고서보다 먼저 시선을 빼앗지 않는 임원용 리서치 내비게이션이다. Apple처럼 표면은 사라지고 동작만 남기며, 기존 Eduflex Toss Blue 프로젝트처럼 한 가지 파란색을 이동과 선택에만 사용한다. 공통 브랜드는 아이콘 없이 큰 `Report Hub` 글자만 사용한다. 파비콘은 작은 브라우저 탭에서 식별이 필요하므로 RH 심벌을 유지한다.

## 2. Color

- `#3182F6` · `--rh-primary` · 워드마크, 선택 상태, 포커스
- `#1B64DA` · `--rh-primary-hover` · 호버와 활성 상태
- `#E8F3FF` · `--rh-primary-soft` · 선택 전환 배경
- `#191F28` · `--rh-ink` · 기본 전경
- `#4E5968` · `--rh-sub` · 비활성 컨트롤
- `#8B95A1` · `--rh-muted` · 보조 텍스트
- `#FFFFFF` · `--rh-paper` · 플로팅 표면과 선택 글자
- `#F2F4F6` · `--rh-soft` · 세그먼트 배경
- `#E5E8EB` · `--rh-border` · 표면 경계선
- `rgba(49,130,246,.22)` · `--rh-ring` · 키보드 포커스 링
- `rgba(25,31,40,.12)` · `--rh-shadow-color` · 플로팅 표면 깊이
- `#03C75A` · `--rh-naver` · 네이버 블로그 카드
- `#02B350` · `--rh-naver-hover` · 네이버 블로그 카드 호버
- `#08783E` · `--rh-success` · 댓글 완료 상태
- `#B42318` · `--rh-danger` · 댓글 오류와 삭제 동작
- `#FFF7F6` · `--rh-danger-soft` · 삭제 동작 배경
- `#F8FAFC` · `--rh-surface-muted` · 댓글 목록과 입력 보조 표면

대비 기준: `--rh-primary-hover`/`--rh-paper`, `--rh-ink`/`--rh-paper` 조합은 일반 텍스트 AA 기준을 충족한다. 기본 `--rh-primary` 텍스트는 20px 이상의 굵은 워드마크에만 사용한다.

## 3. Typography

- 공통 스택 `--rh-sans`: `Pretendard Variable`, `Pretendard`, `SF Pro Display`, `SF Pro Text`, `Apple SD Gothic Neo`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif
- 워드마크 `--rh-type-wordmark`: 36px · 850 · 1.02 · -0.05em
- 모바일·세로 A4 워드마크 `--rh-type-wordmark-compact`: 30px · 850 · 1.02 · -0.045em
- 제작자 서명 `--rh-type-byline`: 11px · 600 · 1.2 · 0.01em
- 시계 날짜 `--rh-type-clock-date`: 13px · 650 · 1.2 · -0.01em
- 시계 시간 `--rh-type-clock-time`: 22px · 700 · 1.05 · 0, `tabular-nums`
- 모바일·세로 A4 시계: 날짜 11px, 시간 18px
- 전환 버튼 `--rh-type-control`: 12px · 800 · 1.2 · -0.02em
- 접근성 라벨 `--rh-type-label`: 11px · 700 · 1.2 · 0
- 댓글 제목 `--rh-type-comments-title`: 24px · 850 · 1.2 · -0.04em
- 댓글 본문 `--rh-type-comments-body`: 14px · 400 · 1.6 · -0.01em
- 방문자 수 `--rh-type-visitor`: 11px · 800 · 1.2 · 0
- 보고서 조회수 `--rh-type-report-count`: 11px · 800 · 1.2 · 0, `tabular-nums`
- 공유·PDF 동작 버튼 `--rh-type-report-action`: 12px · 800 · 1.2 · -0.01em
- 날씨 현재 기온 `--rh-type-weather-current`: 32px · 850 · 1 · -0.04em, `tabular-nums`
- 날씨 예보 `--rh-type-weather-forecast`: 12px · 650 · 1.4 · -0.01em, `tabular-nums`
- 세로 A4 제목: h1 최대 36px, h2 최대 28px, h3 최대 22px

## 4. Spacing

기본 단위는 4px이다.

- `--rh-space-1`: 4px
- `--rh-space-2`: 8px
- `--rh-space-3`: 12px
- `--rh-space-4`: 16px
- `--rh-space-5`: 20px
- `--rh-space-6`: 24px
- `--rh-space-8`: 32px
- `--rh-space-10`: 40px
- `--rh-space-12`: 48px
- 데스크톱 화면 여백: 16px
- 모바일 화면 여백: 8px
- 플로팅 메뉴 최소 높이: 72px
- 플로팅 메뉴와 첫 콘텐츠 사이 최소 간격: 24px
- 전환 컨트롤 너비: 156px, 모바일 136px
- 세로 A4 오른쪽 메뉴 너비: 208px
- 모바일 도서관 상단 메뉴 높이: 112px
- 세로 A4 장식 궤도 최대 폭: 520px, 부모 폭을 넘지 않음
- 댓글 최대 너비: 920px
- 보고서 동작 버튼 최소 높이: 40px, PDF·공유 동일 너비 76px
- 보고서 조회수 영역 최소 높이: 40px, 최소 너비 86px
- 메인 우측 영역 너비: 380px, 카드 사이 간격 12px
- 도서관 공통 외곽선: 최대 1400px, 데스크톱 좌우 20px, 모바일 좌우 14px
- 도서관 본문과 우측 영역 사이 간격: 최소 24px
- 날씨 카드 안쪽 여백: 18px, 예보 행 최소 높이 38px

## 5. Components

### Report Hub wordmark

- 아이콘 없이 `Report Hub` 글자만 사용한다.
- 36px/850 Toss Blue, 모바일·세로 A4는 30px/850이다.
- `by Jeremy`는 워드마크 바로 아래 11px/600 `--rh-muted`로 표시한다.
- 워드마크와 `by Jeremy`는 브랜드 버튼 안에서 왼쪽 정렬한다.
- 메인 도서관의 브랜드 묶음은 화면 왼쪽 16px, 모바일 8px에 맞춘다.
- 배경은 투명하고 최소 터치 높이는 44px이다.
- hover는 `--rh-primary-hover`, active는 `scale(.98)`, focus는 `--rh-ring`을 사용한다.

### Floating navigation

- 기본 가로 화면에서는 상단 중앙에 fixed로 유지한다. 1280px 이상 세로 A4는 문서 오른쪽 여백, 모바일은 화면 좌우 여백 안에 배치한다.
- 흰색 표면, 1px 경계선, 16px 반경, 16px 간격의 한 단계 그림자를 사용한다.
- 워드마크와 가로·세로 세그먼트를 한 줄에 배치한다.
- 날짜·요일·초 단위 서울 시계를 워드마크와 보기 전환 사이에 둔다.
- 390px에서는 브랜드·시계를 첫 줄, 보기 전환을 두 번째 줄에 배치해 가로 스크롤을 만들지 않는다.
- 첫 콘텐츠는 메뉴 하단에서 최소 24px 아래에 시작해 제목과 겹치지 않는다.
- 인쇄할 때는 전체를 숨긴다.
- 1280px 이상 세로 A4에서는 용지 오른쪽 끝에서 16px 떨어진 여백에 208px 세로 메뉴로 배치한다.
- 1279px 이하에서는 문서 폭을 늘리지 않는 우측 상단 메뉴로 전환한다.

### Layout segmented control

- 156px 너비, 4px 안쪽 여백, 12px 반경을 사용한다.
- 비활성은 `--rh-soft`/`--rh-sub`, 활성은 `--rh-primary`/`--rh-paper`다.
- 가로·세로 아이콘과 텍스트를 함께 표시한다.

### Report title top link

- 보고서의 대표 h1 내용은 유지하고 링크만 감싼다.
- 색상과 타이포그래피는 기존 보고서를 그대로 상속한다.
- hover는 투명도 변화, focus는 `--rh-primary` 윤곽선으로 표시한다.

### Report comments

- 흰색 표면과 1px `--rh-border`, 18px 반경을 사용한다.
- 입력 높이는 최소 44px, 버튼 높이는 최소 40px이다.
- 작성자와 날짜가 먼저 읽히고, 관리자 댓글은 서버가 확인한 경우에만 Toss Blue 배지를 표시한다.
- 수정·삭제는 각 댓글 안의 인라인 패널로 열며 브라우저 prompt와 alert는 사용하지 않는다.
- 로딩·빈 목록·성공·오류 상태를 같은 위치에 명시한다.

### Draft library

- `Draft`는 기존 카테고리와 같은 사이드 메뉴 형식을 사용하되, 회색 배지로 초안임을 명확히 표시한다.
- 초안 카드는 기본 `전체` 목록에서 숨기고 `Draft` 카테고리에서만 공개한다.
- 관리자가 `메인 등록`한 초안만 전체 목록에 함께 표시한다.
- 관리자 동작은 기존 카드 하단 버튼군에 `메인 등록` 또는 `메인 제외` 텍스트 버튼으로 제공한다.

### Naver blog card

- 메인 도서관 상단 고정 메뉴 안에 한 번만 표시한다.
- `--rh-naver` 배경, 흰색 글자, 12px 반경, 최소 44px 터치 높이를 사용한다.
- 일반 텍스트 블로그 링크와 푸터 중복 링크는 두지 않는다.

### Archive page-size selector

- 보고서 검색과 같은 제어 묶음에 두고 5개·10개·20개·30개를 제공한다.
- 기본값은 30개이며 선택값은 URL의 `size`에 반영한다.

### Archive visitor count

- 메인 상단에서 네이버 카드 옆에 작은 중립색 정보 영역으로 표시한다.
- `누적 방문`과 `오늘` 수치를 함께 보여주고 숫자는 tabular-nums를 사용한다.
- 같은 브라우저의 반복 새로고침은 서울 날짜 기준 하루 한 번만 집계한다.

### Archive featured and popular spotlight

- 도서관 최상단에 하나의 18px 반경 흰색 카드로 배치한다.
- 카드 안은 `Jeremy's Pick`과 `인기글` 두 열이며 각 열은 정확히 3개 글을 표시한다.
- 추천글이 3개보다 적으면 최신 공개 글로 빈자리를 채운다.
- 인기글은 `reports/view-counts.json`의 저장 조회수가 높은 순서이며 동률이면 최신 글을 우선한다.
- 각 항목은 1px `--rh-border`, 12px 반경, 12px 간격을 사용하고 실제 보고서 표지를 표시한다.
- 768px 이상에서는 두 열, 767px 이하에서는 한 열로 쌓아 가로 겹침을 만들지 않는다.
- 관리자 모드에서 각 보고서에 36px 별표 버튼을 표시하고 최대 3개까지만 선택한다.
- 선택된 별표는 `--rh-primary`와 `--rh-primary-soft`, 선택되지 않은 별표는 `--rh-muted`와 `--rh-paper`를 사용한다.
- 로딩과 API 오류 시 정적으로 생성된 최신 추천 3개를 유지한다.

### Seoul date and clock

- `8월 9일 일요일 17:25:08`을 한 줄로 표시한다.
- 날짜는 13px `--rh-muted`, 시간은 22px `--rh-ink`를 사용하고 숫자는 `tabular-nums`로 고정한다.
- 모바일·세로 A4에서는 날짜 11px, 시간 18px로 줄인다.
- `Asia/Seoul` 기준으로 1초마다 갱신하며 화면 읽기 프로그램의 반복 알림은 만들지 않는다.
- 메인 도서관에서는 브랜드와 시계를 하나의 왼쪽 묶음으로 유지한다.

### Archive weather card

- 메인 오른쪽 리포트 희망 댓글창 아래에 같은 380px 폭으로 배치한다.
- 1280px 이상에서는 댓글창과 날씨 카드를 본문과 같은 그리드의 우측 영역에 둔다. 우측 영역은 상단에 머무르되, 희망 목록은 카드 내부가 아닌 페이지 스크롤로 전체 내용을 확인한다. 좁은 화면에서는 본문 흐름으로 되돌린다.
- 흰색 표면, 1px `--rh-border`, 18px 반경을 사용한다. 날씨 상태별 그라데이션이나 여러 강조색은 사용하지 않는다.
- `경기도 화성시 동탄8동`의 현재 기온·상태·최고/최저·강수 확률과 이후 4일 예보를 표시한다.
- 로딩·오류·재시도 상태가 카드 안에서 바뀌며 댓글과 보고서 목록 동작에는 영향을 주지 않는다.
- Open-Meteo를 브라우저에서 직접 호출하고 성공 데이터는 10분간 저장한다.

### Report actions and view count

- PDF와 공유는 각각 문서·아래 화살표, 사각형·위 화살표 모양의 40px 선형 아이콘 버튼으로 표시한다.
- 화면에는 `PDF 저장`, `공유` 글자를 두지 않고 접근성 라벨과 마우스 도움말로 동작을 설명한다.
- `공유`는 보고서의 쿼리·해시를 제외한 고정 URL을 복사하고 체크 아이콘 상태를 1.8초 표시한다.
- 같은 도구 묶음에 `조회수 N`을 `--rh-primary-soft` 배경의 작은 정보 영역으로 표시한다.
- 조회수는 메인 카드와 동일한 `reports/view-counts.json` 값을 사용하고 데이터가 없으면 0이다.
- PDF 버튼이 없는 보고서는 공통 플로팅 도구가 PDF·공유·조회수를 함께 만든다.
- 메인 보고서 카드에는 카드 링크와 분리된 36px 공유 아이콘을 텍스트 영역 우측 상단에 둔다. 아이콘 전용 여백을 확보해 대표 이미지와 겹치지 않게 한다.
- 390px에서는 PDF·공유를 같은 줄에 유지하고 조회수는 필요하면 다음 줄 전체 폭으로 내려간다.
- 인쇄에서는 공유·조회수 UI를 숨긴다.

## 6. Motion

- 지속시간 `--rh-motion-fast`: 180ms
- easing `--rh-ease`: ease-out
- hover/active는 transform과 opacity 또는 color만 사용한다.
- 최상단 이동은 기본 smooth, `prefers-reduced-motion: reduce`에서는 즉시 이동한다.

## 7. Depth

Apple식 경계선 중심 표면을 사용한다. 플로팅 메뉴에만 `0 8px 24px var(--rh-shadow-color)` 한 단계를 허용한다. 글로우, 그라데이션, 중첩 그림자는 사용하지 않는다.

## Do / Don't

- Do: 모든 공통 브랜드 링크는 `https://aireport.ai-hub-os.com/`로 연결한다.
- Do: 모든 실제 보고서가 같은 플로팅 메뉴와 가로·세로 전환을 사용한다.
- Do: 보고서 제목을 누르면 최상단으로 이동한다.
- Don't: 공개 플로팅 브랜드에 RH 사각 아이콘을 사용하지 않는다.
- Don't: 보고서 고유 제목·본문·URL·카테고리를 변경하지 않는다.
- Don't: 리다이렉트 전용 페이지에 UI를 삽입하지 않는다.
