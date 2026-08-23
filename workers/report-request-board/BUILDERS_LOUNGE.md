# Builders Lounge 계정·빌드 플랫폼

기존 Report Mode 게시판 Worker와 D1을 함께 사용합니다. 게시글 등록과 `+1빌드` 적립은 같은 D1 묶음으로 처리하며, 보상받은 글을 삭제하면 1빌드가 취소됩니다.

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

## 관리자 설정 범위

- 회의록, 쇼츠, 웹툰, 세계명화 도구 활성화
- 도구별 API 공급자, HTTPS 주소, 모델, 시스템 지시문, 빌드 가격
- API 키 입력·교체·삭제
- 멤버 빌드 충전·회수와 계정 삭제
- 관리자 계정 추가·권한 해제

AI API 키는 암호화해 D1에 저장하고 관리자 화면에도 다시 표시하지 않습니다. Google ID 토큰은 서버에서 서명, 발급자, 대상과 만료를 검증합니다.
