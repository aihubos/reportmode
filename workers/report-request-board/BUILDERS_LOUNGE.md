# Builders Lounge 계정·빌드 플랫폼

기존 Report Mode 게시판 Worker와 D1을 함께 사용합니다. 일반 글과 댓글 등록은 각각 `+1빌드`로 같은 D1에서 처리하며, 삭제하면 그 1빌드가 취소됩니다. 쇼츠는 실제 WebM 저장 성공 1건당 `5 Build`를 사용하고 실패·취소·30분 만료 시 예약을 해제합니다. 쇼츠 결과를 `게시판에 등록`하는 동작은 추가 비용도 등록 보상도 `0 Build`이며, 사용자가 버튼을 누르기 전에는 게시하지 않습니다. 이미지 기본 비용과 다른 도구 비용은 관리자 화면에서 바꿀 수 있습니다.

## 운영 설정

필수 Worker 비밀값:

- `GOOGLE_CLIENT_ID`: Google OAuth 웹 클라이언트 ID
- `LOUNGE_CONFIG_KEY`: 관리자 API 키를 AES-GCM으로 암호화하는 32바이트 base64 키

기본 관리자는 `wrangler.jsonc`의 `ADMIN_EMAILS`와 D1의 `lounge_admins`에 등록된 `jeremylee0213@gmail.com`입니다.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID --config workers/report-request-board/wrangler.jsonc
openssl rand -base64 32 | npx wrangler secret put LOUNGE_CONFIG_KEY --config workers/report-request-board/wrangler.jsonc
npx wrangler d1 migrations apply reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc
npx wrangler deploy --config workers/report-request-board/wrangler.jsonc
```

비밀값은 저장소나 브라우저 코드에 넣지 않습니다.

쇼츠용 `0016_lounge_shorts_media.sql`은 일반 배포 명령으로 바로 적용하지 않습니다. 적용 전 백업, 스키마 확인, 적용 후 검증, 부분 실패 판단은 [SHORTS_0016_MIGRATION_RUNBOOK.md](./SHORTS_0016_MIGRATION_RUNBOOK.md)를 따릅니다. 독립 검증실의 코드 판정과 주인님 승인 전에는 원격 migration·Worker·Pages 배포를 실행하지 않습니다.

## 관리자 설정 범위

- 회의록, 쇼츠, 웹툰, 세계명화 도구 활성화
- 도구별 API 공급자(OpenAI, OpenRouter, Kimi Moonshot, Gemini, Anthropic), HTTPS 주소, 모델, 시스템 지시문, 빌드 가격
- API 키 입력·교체·삭제
- 멤버 빌드 충전·회수와 계정 삭제
- 관리자 계정 추가·권한 해제

AI API 키는 암호화해 D1에 저장하고 관리자 화면에도 다시 표시하지 않습니다. Google ID 토큰은 서버에서 서명, 발급자, 대상과 만료를 검증합니다.
