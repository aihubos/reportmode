# Report Hub 업로드 안내

## 보고서

- 제목: 조직개편, 전략인가 권력의 지도인가: 새 팀명보다 먼저 확인할 5가지
- 버전: v1.0.0
- 기준일: 2026-08-10
- 대상 경로: `reports/260810-033-reorganization-power-map-v1-0-0/`
- canonical: `https://aihubos.github.io/reportmode/reports/260810-033-reorganization-power-map-v1-0-0/`
- 상태: AI-assisted · Published

## 안전한 업로드 순서

1. ZIP을 저장소 루트에서 풉니다.
2. `reports/260810-033-reorganization-power-map-v1-0-0/` 폴더 전체를 `main` 브랜치에 추가합니다.
3. `archive-entry.json`은 기존 `archive/index.html`을 덮어쓰지 않고 아카이브 생성기 또는 수동 삽입 데이터로 사용합니다.
4. `sitemap-entry.xml`도 기존 sitemap 전체를 덮어쓰지 않고 `<urlset>` 내부에 삽입합니다.
5. `upload-manifest.json`의 SHA256과 파일 크기를 확인합니다.
6. Pages 배포 뒤 canonical, OG 이미지, 모바일 320px, 공유 스크립트 상대 경로를 다시 확인합니다.

## Git 예시

```bash
git checkout main
git pull --ff-only
# ZIP을 저장소 루트에 풀기
git add reports/260810-033-reorganization-power-map-v1-0-0/
git commit -m "Add Report Hub newsletter: reorganization-power-map v1.0.0"
git push origin main
```

## 주의

- 실제 GitHub push는 이 패키지 생성 과정에서 수행하지 않았습니다.
- 브런치 원문 이미지는 사용하지 않았으며, `assets/thumbnail.png`와 `thumbnail.svg`는 자체 제작한 추상 그래픽입니다.
- 조직개편 관련 법률 판단은 개별 사실관계에 따라 달라지므로 공개 전 필요하면 노무·법무 검토를 거치세요.
