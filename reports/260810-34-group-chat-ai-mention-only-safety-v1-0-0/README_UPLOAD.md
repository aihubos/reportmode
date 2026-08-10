# Upload Guide — 단체방 AI가 @멘션에만 답하게 만든 이유: 침묵도 보안이다

- Report folder: `reports/260810-34-group-chat-ai-mention-only-safety-v1-0-0/`
- Canonical: `https://aihubos.github.io/reportmode/reports/260810-34-group-chat-ai-mention-only-safety-v1-0-0/`
- Version: `v1.0.0`
- Status: `Published · AI-assisted · Published`

## Upload

1. ZIP의 `reports/260810-34-group-chat-ai-mention-only-safety-v1-0-0/` 폴더를 저장소의 `reports/` 아래에 그대로 추가합니다.
2. 기존 `archive/index.html` 또는 `sitemap.xml`을 임의로 덮어쓰지 않습니다.
3. ZIP 루트의 `archive-entry.json`과 `sitemap-entry.xml`을 기존 파일을 읽은 뒤 안전하게 병합합니다.
4. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
5. GitHub Pages 배포 후 canonical, OG 이미지, 공유 스크립트, 모바일 표 스크롤을 확인합니다.

## Human review priorities

- 실제 단체방 구현에서 Telegram privacy mode/Slack event 구독 설정 확인
- 개인 위키·일정 Credential이 단체방 런타임과 물리적으로 분리됐는지 확인
- 외부 발신·수정·삭제 작업에 승인과 감사 로그가 실제로 적용됐는지 확인
