# Builders Lounge MoneyPrinterTurbo 로컬 통합 절차

이 문서는 Builders Lounge Worker와 로컬 MoneyPrinterTurbo를 검증하는 절차다. 저장소 코드와 로컬 실행만 다루며, Cloudflare 변수·비밀값 설정, migration, push, 배포, 외부 렌더 서버 생성과 결제를 승인하지 않는다.

## 서버 간 계약

- Worker만 `POST /api/v1/builders-lounge/videos`로 렌더를 시작한다.
- Worker만 `GET /api/v1/builders-lounge/tasks/{jobId}`로 상태를 조회한다.
- 완성 파일은 공개 정적 경로가 아니라 인증된 `GET /api/v1/builders-lounge/tasks/{jobId}/video`로 받는다.
- 세 요청은 모두 같은 Bearer 토큰을 사용한다. 토큰과 렌더 서버 주소는 브라우저 응답에 포함하지 않는다.
- Lounge `jobId`를 MPT 작업 ID로 그대로 사용한다. 같은 작업의 생성 요청이 반복돼도 새 렌더 작업을 만들지 않는다.

Worker의 로컬 연결 입력은 `SHORTS_RENDERER_URL`, `SHORTS_RENDERER_TOKEN`이다. HTTP 주소는 `127.0.0.1` 또는 `localhost`만 허용하고, 원격 주소는 HTTPS만 허용한다. MPT 프로세스는 같은 값을 `BUILDERS_LOUNGE_RENDER_TOKEN`으로 받고, `BUILDERS_LOUNGE_MATERIALS`에는 서버가 소유한 로컬 자료 파일명 2개 이상을 지정한다. 실제 값은 저장소·브라우저·채널·로그에 기록하지 않는다.

Worker의 `GET /lounge/health`는 D1 쇼츠 스키마·비용 5, R2 바인딩, 로그인·암호화 설정, renderer 설정 여부를 불리언으로만 반환한다. 핵심 저장 계약이 준비되지 않으면 HTTP 503 `unavailable`, 핵심 저장 계약은 준비됐지만 로그인·암호화·renderer 설정 중 하나가 없으면 HTTP 200 `degraded`, 모두 설정됐으면 HTTP 200 `ready`다. `rendererConfigured`는 URL·토큰 형식이 설정됐다는 뜻이며 실제 MPT 프로세스 도달·영상 생성 성공을 뜻하지 않는다. 비밀값과 renderer 주소는 응답하지 않는다.

## 처리 순서와 Build

1. 사용자가 한 줄 주제를 제출하면 Worker가 상세 제작안과 장면 2개 이상을 만든 뒤 Build 5를 예약한다.
2. MPT는 한국어 음성, 자막, 9:16, 순차 장면, BGM 없음으로 MP4 1건을 만든다.
3. Worker는 렌더 상태를 조회하고, 완료 파일을 서버 간 인증으로 가져와 R2에 저장한다.
4. R2 재조회 파일의 크기·MP4 구조가 맞을 때만 작업을 완료하고 Build 5를 확정한다.
5. 렌더 실패, 사용자 취소, 30분 만료, 다운로드·저장·구조 판별 실패는 예약을 멱등 해제한다. 반복 요청에도 release 이벤트는 1건만 남는다.
6. 생성 완료 시 게시글은 0건이다. 사용자가 `게시판에 등록`을 누른 뒤에만 1건을 만들며 같은 요청 반복에도 1건을 유지한다.

사용자 취소나 Worker 만료는 Lounge의 Build 예약과 저장 경로를 닫는다. 현재 로컬 MPT 프로세스에서 이미 실행 중인 FFmpeg 작업을 강제 종료하는 계약은 포함하지 않으므로, 해당 작업은 로컬에서 끝날 수 있지만 결과는 Lounge에 확정·게시하지 않는다.

## MP4 판별 범위

Worker는 `ftyp`, `moov`, 비디오 `trak/mdia/hdlr`, 내용이 있는 `mdat`의 경계와 크기를 확인한다. 비디오 sample table의 `stsz` 또는 `stz2`, `stsc`, `stco` 또는 `co64`도 읽어 최소 1개 sample이 선언됐는지 확인하고, 각 chunk에 배치된 sample의 크기·offset이 실제 `mdat` payload 안에 완전히 존재하며 서로 겹치지 않는지 대조한다. 0 sample, 0바이트 sample, 범위 초과, 안전 정수 범위를 넘는 64비트 offset, 겹치는 sample은 닫힌 실패로 처리한다. MPT 응답의 미디어 형식은 `video/mp4`여야 하며, 파일 주소는 같은 렌더 서버의 해당 `jobId` 전용 인증 경로와 정확히 일치해야 한다.

이 검사는 Cloudflare Worker 번들에 새 런타임 의존성을 추가하지 않는 범위 한정 파서로 구현했다. 필요한 box와 정수 경계만 읽어 공격 표면과 번들 크기를 제한하며, 인식하지 못하거나 모순된 sample table은 승인하지 않는다. 완전한 범용 MP4 파서나 코덱 디코더를 대체하지 않는다.

이 검사는 Worker 메모리 안에서 수행하는 컨테이너 구조 검사다. H.264/AAC 완전 디코딩, 음성 내용, 자막 가독성, 장면 변화와 재생 품질까지 판정하지 않는다. 최종 사용자용 완료 판정은 로컬 대표 영상에서 다음을 별도로 확인해야 한다.

- `ffprobe`: MP4, 9:16, 비디오·오디오 스트림, 읽힌 패킷
- 실제 브라우저: 재생 시작·시간 진행·영상 크기
- 시작·중간 프레임: 서로 다른 장면 2개 이상과 자막 표시
- 실제 청취 또는 파형·오디오 스트림: 한국어 음성 존재

## 로컬 검증 순서

1. 저장소 밖의 로컬 프로세스 환경에 일회용 시험 토큰과 서로 다른 자료 파일명 2개 이상을 주입한다.
2. MPT를 `127.0.0.1`에만 바인딩한다.
3. Worker 로컬 환경에 같은 시험 토큰과 로컬 MPT 주소를 주입한다.
4. 한 줄 입력부터 렌더 생성·상태 조회·R2 저장·게시 버튼까지 실행한다.
5. 응답과 로그에서 시험 토큰·절대 자료 경로·서버 내부 파라미터가 나오지 않는지 확인한다.
6. 정상 MP4와 손상 MP4, 렌더 실패, 취소, 만료를 실행해 confirmation 또는 release가 정확히 1건인지 확인한다.
7. 세 저장소의 전체 검사와 독립 검증이 끝나기 전에는 원격 변경을 하지 않는다.

로컬 연결 실패를 해결하기 위해 토큰을 코드나 설정 파일에 쓰지 않는다. 실제 원격 운영 시험은 별도 승인 뒤 접근 통제된 비밀값 설정과 배포 계획을 다시 검토한다.
