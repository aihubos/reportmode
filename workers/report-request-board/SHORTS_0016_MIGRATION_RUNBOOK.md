# Builders Lounge 쇼츠 0016 적용·복구 절차

이 문서는 `0016_lounge_shorts_media.sql`을 원격 D1에 적용할 때의 운영 절차다. 문서 자체는 배포 승인이 아니다. 독립 검증실의 코드 게이트와 주인님의 운영 시험 승인이 모두 확인되기 전에는 migration, Worker·Pages 배포, 설정 변경을 실행하지 않는다.

## 변경 범위

0016은 다음 작업을 한 번에 수행한다.

- 쇼츠 작업, Build 원장 이벤트, 게시 요청 이력 테이블과 인덱스를 추가한다.
- `shorts` 도구 비용을 `5 Build`로 맞춘다.
- `board_posts`에 미디어·쇼츠·권리 확인 필드 6개를 추가한다.

## 로컬 예약 만료 회수 코드 경로

코드에는 `src/index.ts`의 Worker `scheduled` 핸들러가
`src/lounge-platform.ts`의 `sweepExpiredShortsReservations`를 호출하고,
`wrangler.jsonc`의 `* * * * *` cron 설정이 매분 실행하도록 연결되어 있다.
이 항목은 로컬 소스의 코드 경로만 기록한 것이며, 원격 Worker cron 활성화나
배포가 완료되었다는 의미가 아니다.

## WebM 판별 범위

Worker는 R2 저장 뒤 EBML 컨테이너, `webm` DocType, 비디오 트랙 번호·코덱,
Cluster의 비디오 Block 헤더와 VP8·VP9 최소 단독 키프레임 구조를 확인한다.
빈 BlockGroup, 헤더만 있는 Block, 선언되지 않은 트랙 번호는 실패 처리한다.
VP8은 frame tag가 선언한 첫 partition 길이와 실제 payload 경계를 대조하고,
VP9은 sync code·화면 크기와 uncompressed header 뒤 압축 데이터 존재를 대조한다.
이 검사는 컨테이너·최소 프레임 경계 검사이며 VP8·VP9을 완전히 디코딩해 재생 품질을
판정하지 않는다. 최종 사용자용 완료 판정에는 MoneyPrinterTurbo 렌더 서버와
실제 재생 검증을 별도 운영 시험으로 확인해야 한다.

MoneyPrinterTurbo MP4는 `ftyp`, `moov`, 비디오 handler와 내용이 있는 `mdat`을
확인한 뒤에만 저장·정산한다. 이 역시 코덱 완전 디코딩이나 품질 판정은 아니며,
서버 간 계약과 로컬 재생 증거는 `SHORTS_MPT_LOCAL_RUNBOOK.md`를 따른다.

Wrangler는 오류가 난 migration을 롤백하지만, 명령 응답 유실·과거 수동 변경·실제 migration 기록 불일치는 별도로 확인해야 한다. 또한 SQLite의 `ALTER TABLE ... ADD COLUMN`은 같은 열이 있으면 재실행에 실패한다. 따라서 적용 여부가 불명확하거나 일부 객체가 이미 있으면 migration을 다시 실행하지 않는다.

## 적용 전 확인

아래 명령은 모두 읽기 전용이다. 실행자는 실제 출력, 실행 시각, 현재 Pages 배포 SHA, 직전 정상 Worker version ID를 접근 통제된 배포 기록에 남긴다. 계정·토큰·이메일·복구 지점은 공개 채널에 쓰지 않는다.

```bash
npx wrangler whoami
npx wrangler d1 migrations list reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc
npx wrangler d1 time-travel info reportmode-request-board --config workers/report-request-board/wrangler.jsonc
```

0016은 대기 상태여야 한다. 다음 조회 결과도 함께 저장한다.

```bash
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT tool_id, enabled, build_cost, updated_at FROM lounge_tool_settings WHERE tool_id = 'shorts';"
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT type, name FROM sqlite_master WHERE name IN ('lounge_shorts_jobs','lounge_shorts_ledger_events','lounge_shorts_publish_requests','idx_lounge_shorts_user_created','idx_lounge_shorts_expiry','idx_lounge_shorts_ledger_user_created','idx_lounge_shorts_one_active_publish','idx_lounge_shorts_publish_user_created','idx_board_posts_shorts_job') ORDER BY type, name;"
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('board_posts') WHERE name IN ('origin','media_url','media_type','shorts_job_id','rights_notice_version','rights_confirmed_at') ORDER BY name;"
```

0016이 대기인데 위 신규 객체나 열이 하나라도 나오면 부분 적용 가능성이 있으므로 즉시 중단한다. migration 상태와 스키마가 일치할 때까지 적용하지 않는다.

전체 D1 export와 Time Travel 복구 지점을 적용 직전에 만든다. `<ACCESS_CONTROLLED_BACKUP_PATH>`는 공개 저장소 밖의 승인된 보관 위치로 바꾼다.

```bash
npx wrangler d1 export reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --output <ACCESS_CONTROLLED_BACKUP_PATH>
shasum -a 256 <ACCESS_CONTROLLED_BACKUP_PATH>
```

백업 파일 크기와 SHA-256, Time Travel 복구 지점, 복원 담당자, 적용 전 `shorts` 비용을 같은 배포 기록에 남긴다. 백업이 비어 있거나 무결성 값을 기록하지 못하면 중단한다.

## 승인 후 1회 적용

변경 전 증거와 승인이 모두 있을 때만 다음 명령을 한 번 실행한다.

```bash
npx wrangler d1 migrations apply reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc
```

명령이 오류나 연결 끊김을 반환하면 성공·실패를 추정하지 않는다. 먼저 아래의 적용 후 조회로 실제 상태를 판별한다.

## 적용 후 검증

```bash
npx wrangler d1 migrations list reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT type, name FROM sqlite_master WHERE name IN ('lounge_shorts_jobs','lounge_shorts_ledger_events','lounge_shorts_publish_requests','idx_lounge_shorts_user_created','idx_lounge_shorts_expiry','idx_lounge_shorts_ledger_user_created','idx_lounge_shorts_one_active_publish','idx_lounge_shorts_publish_user_created','idx_board_posts_shorts_job') ORDER BY type, name;"
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT name, type, \"notnull\", dflt_value FROM pragma_table_info('board_posts') WHERE name IN ('origin','media_url','media_type','shorts_job_id','rights_notice_version','rights_confirmed_at') ORDER BY name;"
npx wrangler d1 execute reportmode-request-board --remote --config workers/report-request-board/wrangler.jsonc --command "SELECT tool_id, enabled, build_cost, updated_at FROM lounge_tool_settings WHERE tool_id = 'shorts';"
```

통과 조건은 다음과 같다.

- migration 목록에서 0016이 적용 상태다.
- 신규 테이블 3개와 지정 인덱스 6개가 모두 존재한다.
- `board_posts` 신규 열 6개가 모두 존재한다.
- `shorts`의 `build_cost`가 5다.

하나라도 맞지 않으면 Worker와 Pages를 배포하지 않고 부분 실패 절차로 이동한다.

## 부분 실패와 복구 판단

자동 down migration, 신규 테이블·열 삭제, 원장·게시글·R2 객체 삭제 스크립트는 만들거나 실행하지 않는다.

| 확인 상태 | 조치 |
| --- | --- |
| 0016 대기, 신규 객체 0개 | 오류 원인을 기록하고 HOLD를 유지한다. 재실행은 명령 실패 원인과 승인 상태를 다시 확인한 뒤 별도 결정한다. |
| 0016 대기 또는 적용, 신규 객체·열 일부만 존재 | 재실행하지 않는다. Worker·Pages 배포를 중단하고 실제 스키마를 기록한다. 운영 쓰기가 시작되지 않았다면 검증된 export 또는 기록된 Time Travel 지점으로 전체 D1을 복원하는 방안을 우선 검토한다. 복원은 주인님 승인과 Cloudflare 담당자 실행이 필요하다. |
| 0016 적용, 스키마 전체 존재, Worker 검증 실패 | D1의 추가 스키마와 데이터는 보존한다. Worker와 Pages만 기록된 직전 정상 버전으로 복귀하고 수정 커밋을 새로 검증한다. |
| 적용 뒤 일반 게시·Build 등 운영 쓰기가 발생 | 전체 D1을 과거 시점으로 즉시 복원하지 않는다. 신규 요청을 중지하고, 독립 검증을 거친 전진 수정 migration과 행 단위 정산 계획을 만든다. 전체 복원은 적용 뒤 정상 데이터 유실을 평가한 후 주인님이 별도 승인할 때만 수행한다. |
| 비용만 적용 전 값과 다름 | 적용 전 스냅샷을 기준으로 차이를 기록한다. 자동 SQL로 덮지 않고 승인된 관리자 변경 또는 검토된 전진 migration으로만 복원한다. |

복원 또는 코드 복귀 뒤에는 migration 상태, 위 스키마 조회, `shorts` 비용, 일반 게시판, Build 원장, Worker 상태를 다시 확인한다. 이미 생성된 R2 객체·게시글·원장 이벤트는 감사와 사용자 복구 근거이므로 임의 삭제하지 않는다.

## 이후 배포 순서

0016 검증이 모두 통과한 뒤에만 다음 순서로 진행한다.

1. Worker 배포와 version ID 기록
2. `/lounge/config`의 로그인 준비, 비용 5, 자격 출처와 `X-File-Size` CORS 확인
3. Pages 배포와 실제 자산 확인
4. 승인된 시험계정으로 생성 전후 Build, R2 저장, 게시 0→1→1, 보상 0 검증
5. 독립 검증실의 최종 `RELEASE` 또는 `HOLD` 판정

실패 시 신규 쇼츠 요청부터 중지하고, 기록된 직전 정상 Pages SHA와 Worker version ID로 코드만 복귀한다. 데이터 복원 여부는 위 판단표에 따라 별도로 결정한다.

## 공식 참고

- [Cloudflare D1 migration 명령과 실패 시 롤백](https://developers.cloudflare.com/workers/wrangler/commands/d1/)
- [Cloudflare D1 Time Travel과 복구 주의사항](https://developers.cloudflare.com/d1/reference/time-travel/)
- [Cloudflare D1 전체 export](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
