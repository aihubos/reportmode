# Report Mode Skill Builder

Hermes가 사용할 보고서 스킬의 디자인과 작성 규칙을 화면에서 만드는 도구입니다.

- 공개 제작기: https://aihubos.github.io/reportmode/
- GitHub: https://github.com/aihubos/reportmode
- 기존 보고서: https://aihubos.github.io/reportmode/archive/

## 사용 순서

1. 왼쪽에서 레포트 타입, 레이아웃, 하이라이트, 글꼴, 크기, 필수 섹션을 정합니다.
2. 오른쪽 Apple 폴더블 사양·장단점 예시로 결과를 바로 확인합니다.
3. `완료 · Hermes 스킬 생성`을 누릅니다.
4. 공개 사이트에서는 `SKILL.md`를 내려받습니다.
5. 로컬 사이트에서는 `Hermes에 바로 적용`을 누를 수 있습니다.

## 로컬에서 실행

```bash
cd /Users/JeremyLee/Projects/reportmode
npm install
npm run build
npm run studio
```

브라우저에서 http://127.0.0.1:8787 을 엽니다.

로컬의 `Hermes에 바로 적용` 버튼은 생성된 스킬을 다음 위치에 설치합니다.

```text
~/.hermes/skills/reporting/<만든-스킬-이름>/SKILL.md
```

## 기본 Report Mode 스킬 설치

```bash
npm run skill:install -- hermes
```

기본 스킬 위치는 `~/.hermes/skills/reporting/report-mode/SKILL.md`입니다.

## 만들 수 있는 설정

- 제품 분석, 경영진 브리핑, 시장 분석, 기술 분석, 리서치 타입
- 매거진, 백서, 에디토리얼, 미니멀, 다크 레이아웃
- 하이라이트 색상, 표현 방식, 강도, 적극 사용 여부
- 제목·본문 폰트와 크기, 줄 간격
- 본문 폭, 카드 모서리, 표면 색감
- 요약, 사양, 장단점, 판단 기준, 출처 섹션 포함 여부

## 기존 보고서

- [260802 · Apple 폴더블 iPhone](https://aihubos.github.io/reportmode/reports/260802-apple-foldable-iphone/)
- [기존 주소 이동 안내](https://aihubos.github.io/reportmode/reports/apple-foldable-iphone/)

기존 보고서 생성 엔진과 원본은 호환을 위해 저장소에 유지하지만, 사용자 화면의 중심 기능은 Hermes용 스킬 제작기입니다.

## 참고

- 매거진 레이아웃 영감: [Artifex](https://github.com/chojondocho/artifex) (MIT, 아이디어를 새 구조로 구현)
- 상세 고지: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
