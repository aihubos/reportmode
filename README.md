# Report Mode Skill Builder

## 2026-08-08 보고서 통합 업데이트

- 전체 HTML 보고서·가이드 45개 중 실내용 42개를 최신 공식 자료와 공통 AIHUBOS ReportMode 형식으로 업데이트했습니다.
- 외부 원문으로 연결되는 단순 링크형 3개는 콘텐츠 업데이트 대상에서 제외하고 링크 상태를 유지했습니다.
- 모든 실내용 보고서에 1페이지 요약, 로컬 이미지, 공식 데모·자료 링크, 실제 예시, `report-metadata`, 누적 변경 이력, 모바일·A4 인쇄 규칙을 적용했습니다.
- 전체 도서관: [`archive/index.html`](./archive/index.html)
- 업데이트 감사 보고서: [`UPDATE_AUDIT_20260808.md`](./UPDATE_AUDIT_20260808.md)
- 자동 검증용 데이터: [`UPDATE_AUDIT_20260808.json`](./UPDATE_AUDIT_20260808.json)


Hermes가 사용할 보고서 스킬의 디자인과 작성 규칙을 화면에서 만드는 도구입니다.

- 공개 제작기: https://aihubos.github.io/reportmode/
- GitHub: https://github.com/aihubos/reportmode
- 기존 보고서: https://aihubos.github.io/reportmode/archive/

## 사용 순서

1. 왼쪽에서 일반/심층 깊이, 5개 문서 스타일, 레포트 타입, 하이라이트, 글꼴, 필수 섹션을 정합니다.
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

### HTML·ZIP 보고서 게시판 관리

로컬 Studio를 실행한 뒤 아래 관리 화면을 엽니다.

```text
http://127.0.0.1:8787/publisher/
```

1. HTML 파일 한 장 또는 `index.html`과 이미지·CSS가 들어 있는 ZIP을 선택합니다.
2. 제목, 카테고리, 태그, 목록 요약을 입력합니다. 비워둔 제목·요약·출처 수는 HTML에서 자동 추출됩니다.
3. `업로드하고 즉시 게시`를 누르면 GitHub 커밋과 Pages 공개까지 자동으로 진행됩니다.
4. 오른쪽 게시판에서 공개 보고서를 열거나 제목·분류·태그·HTML을 수정할 수 있습니다.
5. 삭제는 이 관리 화면으로 업로드한 보고서에만 제공되며 공개 목록과 파일을 함께 제거합니다.

업로드·수정·삭제 기능은 GitHub 권한을 보호하기 위해 `127.0.0.1` 로컬 화면에서만 동작합니다. 공개 GitHub Pages에는 관리 API나 키 입력 화면이 없습니다.

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
- 일반 보고서와 매우 상세한 심층보고서모드
- Toss Clean, Ultra Violet, Dark, Neon Signal, Editorial Paper
- 매거진, 백서, 에디토리얼, 미니멀, 다크 레이아웃
- 6개 인기 포인트·하이라이트 팔레트와 표현 방식, 강도, 적극 사용 여부
- 제목·본문 폰트와 크기, 줄 간격
- 본문 폭과 카드 모서리
- 요약, 사양, 장단점, 판단 기준, 출처 섹션 포함 여부
- 순백색 한글 화이트보드 두들 이미지 실제 생성
- 실제 제품 사진과 허용되는 공식 로고 웹 검색·출처 표기
- Terra 또는 Luna 조사 서브에이전트와 Sol 최종 작성
- 모든 자료를 문서 최하단 출처 표에 통합

## Hermes 모델 역할

- 부모/최종 작성: `gpt-5.6-sol`
- 기본 자료조사 자식: `gpt-5.6-terra`
- 대안 자료조사 자식: `gpt-5.6-luna`

현재 Hermes는 자식 작업마다 모델을 섞지 않고 프로필의 `delegation.model` 하나를 사용합니다. 기본 프로필은 Sol 부모와 Terra 자식, 동시 최대 3개로 설정합니다. Luna를 사용하려면 해당 Hermes 프로필의 `delegation.model`을 Luna로 바꿉니다.

## 기존 보고서

- [260802 · Apple 폴더블 iPhone](https://aihubos.github.io/reportmode/reports/260802-apple-foldable-iphone/)
- [기존 주소 이동 안내](https://aihubos.github.io/reportmode/reports/apple-foldable-iphone/)

기존 보고서 생성 엔진과 원본은 호환을 위해 저장소에 유지하지만, 사용자 화면의 중심 기능은 Hermes용 스킬 제작기입니다.

## 참고

- 매거진 레이아웃 영감: [Artifex](https://github.com/chojondocho/artifex) (MIT, 아이디어를 새 구조로 구현)
- 상세 고지: [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)
