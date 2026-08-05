# 시작 안내

이 패키지는 Hermes의 Report Mode 원칙을 ChatGPT 웹 Project 환경에 맞게 옮긴 것입니다. GPT 웹에는 Hermes식 3개 서브에이전트 실행을 강제하는 설정이 없으므로, **공식 근거·독립 검증·시장/반응의 3개 조사 트랙**을 한 대화 안에서 순차 또는 병렬 도구 사용으로 수행하도록 설계했습니다.

## 10분 설치
1. ChatGPT → Projects → New project.
2. Project 이름: `Report Mode`.
3. 가능하면 프로젝트 전용 메모리를 선택합니다. 기존 대화 영향을 줄이는 데 유리합니다.
4. 웹 검색과 데이터 분석을 사용할 수 있는 가장 강한 추론 모델을 선택합니다.
5. 아래 6개를 업로드합니다.
   - `project-files/00_REPORT_MODE_RULES.md`
   - `project-files/02_SETUP_GUIDE.md`
   - `project-files/03_RESEARCH_PROTOCOL.md`
   - `project-files/04_HTML_OUTPUT_SPEC.md`
   - `project-files/05_SOURCE_LEDGER_TEMPLATE.csv`
   - `templates/report-shell.html`
6. `project-files/01_PROJECT_INSTRUCTIONS.txt`를 Project instructions에 붙여넣습니다.
7. 새 채팅에서 `prompts/01_NEW_REPORT_PROMPT.md`를 사용합니다.

## 출력 확인
완료 응답에는 최소한 다음이 있어야 합니다.
- `YYMMDD-english-slug.html` 다운로드 파일
- 조사 범위와 확인일
- 핵심 한계 1~3개
- “사용자가 최종 검수” 안내

HTML을 열어 제목, 간단/상세 토글, 표, 출처 링크, 모바일 폭을 확인하세요.
