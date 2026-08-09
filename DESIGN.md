# Report Hub Brand System

## 1. Atmosphere / signature

Report Hub는 임원이 빠르게 신뢰하고 다시 찾는 편집형 리서치 허브다. 기존 보고서의 개별 디자인은 유지하고, 사이트 공통 표식만 검정 라운드 사각형 안의 `RH`로 고정한다. 장식보다 식별성과 일관성이 우선이며, 브랜드 영역에는 그라데이션·광택·글로우를 사용하지 않는다.

## 2. Color

- `#111111` · `--rh-ink` · 로고 바탕, 브랜드 텍스트, 기본 전경
- `#FFFFFF` · `--rh-paper` · 로고 문자, 역상 텍스트
- `#F2F4F6` · `--rh-soft` · 밝은 호버 배경
- `#8B95A1` · `--rh-muted` · 보조 텍스트
- `#D1D6DB` · `--rh-border` · 밝은 배경의 경계선
- `#FFFFFF` · `--rh-focus` · 어두운 버튼의 키보드 포커스 링
- `rgba(17,17,17,.88)` · `--rh-floating` · 보고서 플로팅 버튼 배경
- `rgba(255,255,255,.18)` · `--rh-floating-border` · 보고서 플로팅 버튼 경계

대비 기준: `--rh-paper`/`--rh-ink`와 `--rh-ink`/`--rh-paper` 조합은 일반 텍스트 AA 기준을 넘는다. 브랜드 색상은 흑백 한 체계만 사용한다.

## 3. Typography

- 공통 스택 `--rh-sans`: `Avenir Next`, `Segoe UI`, `Apple SD Gothic Neo`, `Noto Sans KR`, sans-serif
- 워드마크 `--rh-type-wordmark`: 13px · 800 · 1.2 · -0.02em
- 모바일 워드마크 `--rh-type-wordmark-mobile`: 12px · 800 · 1.2 · -0.02em
- 보조 라벨 `--rh-type-label`: 11px · 700 · 1.2 · 0
- SVG 모노그램: 24px 상당 · 900 · 중앙 정렬

## 4. Spacing

기본 단위는 4px이다.

- `--rh-space-1`: 4px
- `--rh-space-2`: 8px
- `--rh-space-3`: 12px
- `--rh-space-4`: 16px
- `--rh-space-6`: 24px
- 로고 크기: 32px, 보고서 플로팅 버튼에서는 28px
- 최소 터치 높이: 40px

## 5. Components

### RH logo

- 64×64 viewBox의 검정 라운드 사각형과 흰색 `RH` 모노그램
- 라운드 반경은 16px 상당
- 헤더·보고서 버튼·favicon·Apple Touch Icon에 같은 원본 SVG를 사용

### Report Hub brand link

- 기본: 투명 배경, 검정 텍스트, 32px 로고, 8px 간격
- hover: `--rh-soft` 배경
- focus: 3px 포커스 링과 3px 바깥 여백
- active: `transform: scale(.98)`
- disabled 상태는 사용하지 않음

### Report home button

- 고정 위치의 40px 높이 버튼
- `--rh-floating` 배경, `--rh-paper` 텍스트, 28px 로고
- 12px 모서리, 4px/12px 내부 여백
- 430px 이하에서는 워드마크를 숨기고 RH 심벌만 유지

## 6. Motion

- 지속시간 `--rh-motion-fast`: 160ms
- easing `--rh-ease`: ease-out
- hover/active는 transform과 opacity만 사용
- `prefers-reduced-motion: reduce`에서는 전환을 제거

## 7. Depth

경계선 중심 전략을 사용한다. 밝은 헤더는 1px 경계선과 배경 변화만 사용한다. 보고서 플로팅 버튼은 기존 가독성을 위해 어두운 반투명 면과 블러를 유지하되 별도 그림자는 추가하지 않는다.

## Do / Don't

- Do: 모든 공통 브랜드 링크는 `https://aireport.ai-hub-os.com/`로 연결한다.
- Do: 공개 표기는 `RH`와 `Report Hub` 두 형태만 사용한다.
- Don't: `RM`, `Report Mode`, `Jeremy's AI Report`를 공개 브랜드 영역에 혼용하지 않는다.
- Don't: 보고서 고유 제목·본문·URL·카테고리는 브랜드 변경 때문에 수정하지 않는다.
