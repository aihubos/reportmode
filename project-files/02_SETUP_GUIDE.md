# ChatGPT Project 설정법

## 1. Project 만들기
- ChatGPT 웹의 Projects에서 새 Project를 만듭니다.
- 이름 예시: `Report Mode`.
- 프로젝트 전용 메모리를 선택할 수 있다면 권장합니다.

## 2. 모델·도구
- 웹 검색과 데이터 분석을 지원하는 가장 강한 추론 모델을 권장합니다.
- 이미지가 필요한 보고서는 이미지 생성 기능도 사용할 수 있습니다.
- 기능명과 파일 수 한도는 요금제·워크스페이스·시점에 따라 달라질 수 있으므로 현재 화면과 OpenAI 도움말을 최종 기준으로 확인합니다.

## 3. 업로드
`00_START_HERE.md`에 적힌 6개 파일을 우선 업로드합니다. 여유가 있으면 `scripts/` 2개와 `prompts/`도 올립니다.

## 4. Instructions
`01_PROJECT_INSTRUCTIONS.txt` 전체를 Project instructions에 붙여넣습니다. 입력 한도 때문에 잘리면 다음 순서로 유지합니다.
1. 완료 조건·파일 생성
2. 조사 규칙
3. 보고서 구조
4. 디자인

## 5. 첫 실행
`prompts/01_NEW_REPORT_PROMPT.md`에서 주제와 독자만 채워 실행합니다. 자료가 있다면 같은 Project에 업로드하고 파일명을 프롬프트에 적습니다.

## 6. 실패 대응
- HTML 대신 설명만 나옴: `prompts/03_FORCE_HTML_DELIVERY.md`
- 숫자·링크 검수 필요: `prompts/02_REVISION_AND_QA_PROMPT.md`
- 템플릿 토큰 남음: 렌더러를 다시 실행하고 `{{` 검색 결과 0건 확인
- 이미지 깨짐: 외부 URL 대신 적법한 data URI 또는 HTML/CSS 도표 사용

OpenAI Projects 도움말(현재 UI 확인용): https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt
