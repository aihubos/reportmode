# GPT 웹 Project용 Report Mode v1.0

ChatGPT 웹의 **Projects**에 업로드해, 조사부터 최종 독립형 HTML 보고서까지 만드는 패키지입니다.

## 가장 빠른 설치
1. ChatGPT 웹에서 새 Project를 만들고 이름을 `Report Mode`로 지정합니다.
2. `project-files/`의 5개 파일과 `templates/report-shell.html`을 Project 파일로 업로드합니다.
3. `project-files/01_PROJECT_INSTRUCTIONS.txt` 전체를 Project instructions에 붙여넣습니다.
4. 새 채팅에서 `prompts/01_NEW_REPORT_PROMPT.md`를 복사하고 대괄호 항목만 채워 실행합니다.
5. 결과로 받은 `.html` 파일을 다운로드해 브라우저에서 엽니다.

자세한 설정은 `00_START_HERE.md`와 `project-files/02_SETUP_GUIDE.md`를 확인하세요.

## 핵심 원칙
- 최종 산출물은 설명이 아니라 **실제 다운로드 가능한 `.html` 파일**입니다.
- 중요한 사실·숫자는 원문 URL과 확인일을 남깁니다.
- 사실, 분석, 전망, 루머를 구분합니다.
- 현재 자료가 부족하면 그럴듯하게 채우지 않습니다.
- 최종 검수는 사용자가 합니다.

## 구성
- `project-files/`: Project에 올릴 운영 규칙·설정 문서
- `prompts/`: 새 보고서, 수정, QA용 프롬프트
- `templates/`: 고정 HTML 셸
- `scripts/`: JSON→HTML 렌더러와 정적 QA
- `examples/`: 동작 확인용 예제 데이터와 결과
- `assets/`: 예제 자산

버전 기준일: 2026-08-05 KST
