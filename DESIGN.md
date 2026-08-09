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

대비 기준: `--rh-primary-hover`/`--rh-paper`, `--rh-ink`/`--rh-paper` 조합은 일반 텍스트 AA 기준을 충족한다. 기본 `--rh-primary` 텍스트는 20px 이상의 굵은 워드마크에만 사용한다.

## 3. Typography

- 공통 스택 `--rh-sans`: `Pretendard Variable`, `Pretendard`, `SF Pro Display`, `SF Pro Text`, `Apple SD Gothic Neo`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif
- 워드마크 `--rh-type-wordmark`: 24px · 850 · 1.05 · -0.05em
- 모바일 워드마크 `--rh-type-wordmark-mobile`: 20px · 850 · 1.05 · -0.045em
- 전환 버튼 `--rh-type-control`: 12px · 800 · 1.2 · -0.02em
- 접근성 라벨 `--rh-type-label`: 11px · 700 · 1.2 · 0

## 4. Spacing

기본 단위는 4px이다.

- `--rh-space-1`: 4px
- `--rh-space-2`: 8px
- `--rh-space-3`: 12px
- `--rh-space-4`: 16px
- `--rh-space-5`: 20px
- `--rh-space-6`: 24px
- 데스크톱 화면 여백: 16px
- 모바일 화면 여백: 8px
- 플로팅 메뉴 최소 높이: 56px
- 전환 컨트롤 너비: 156px, 모바일 136px

## 5. Components

### Report Hub wordmark

- 아이콘 없이 `Report Hub` 글자만 사용한다.
- 24px/850 Toss Blue, 모바일 20px/850이다.
- 배경은 투명하고 최소 터치 높이는 44px이다.
- hover는 `--rh-primary-hover`, active는 `scale(.98)`, focus는 `--rh-ring`을 사용한다.

### Floating navigation

- 화면 왼쪽 상단에 fixed로 유지한다.
- 흰색 표면, 1px 경계선, 16px 반경, 16px 간격의 한 단계 그림자를 사용한다.
- 워드마크와 가로·세로 세그먼트를 한 줄에 배치한다.
- 390px에서도 한 줄을 유지하며 가로 스크롤을 만들지 않는다.
- 인쇄할 때는 전체를 숨긴다.

### Layout segmented control

- 156px 너비, 4px 안쪽 여백, 12px 반경을 사용한다.
- 비활성은 `--rh-soft`/`--rh-sub`, 활성은 `--rh-primary`/`--rh-paper`다.
- 가로·세로 아이콘과 텍스트를 함께 표시한다.

### Report title top link

- 보고서의 대표 h1 내용은 유지하고 링크만 감싼다.
- 색상과 타이포그래피는 기존 보고서를 그대로 상속한다.
- hover는 투명도 변화, focus는 `--rh-primary` 윤곽선으로 표시한다.

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
