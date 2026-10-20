# 업스트림 동기화 장부

업스트림(`upstream` = https://github.com/aqm857886159/Nomi.git)과 포크는 트리가 크게 갈라져 있어(시험 병합에서 1720개 파일 충돌) 병합·리베이스 대신 **선별 cherry-pick**으로 가져옵니다. 한 번 검토한 커밋을 다시 검토하지 않도록 이 장부에 남깁니다.

- 마지막 검토 업스트림 SHA: `08597facd` (2026-10-19, 검토 시점의 `upstream/main`)
- 사용법: `git fetch upstream` → `git log 08597facd..upstream/main` (새 커밋) / `git cherry -v origin/main upstream/main` (아직 안 들어온 것) → 항상 `git cherry-pick -x`(원본 SHA가 본문에 남음). "0.23.x 移植" 커밋이 있으면 그쪽을 우선합니다(0.23.1 기준으로 보정되어 있음).
- 검토를 마치면 위의 "마지막 검토 SHA"와 아래 표를 갱신합니다.

## 채택

| 업스트림 SHA | 포크 SHA | 내용 |
| --- | --- | --- |
| 3764be5f5, a9093bfff | 24c6f45c5, 13cb38a5c | Agent가 선택 매개변수를 null로 써도 생성 전체가 거부되지 않음 / 확인 거부 사유 표시 (0.23.x 이식) |
| cae5b7adf | bf73dc2a8 | 초안 거부 후 코드별 안내, 잘못된 위치 필드 안내, draft_shots variantId (충돌: aspectRatio 등 0.24 전용 부분은 포크 쪽 유지) |
| 1c6f6383e | e9ffc5166 | 위 변경의 변이 테스트 보강 |
| 60d187e8a | 045bacefa | 안내표 파일을 shared/agentCapabilities로 이동 |
| (포크 보충) | 이 PR | ko 로캘에 새 문구 2건 추가 |

## 제외

| 업스트림 SHA | 사유 |
| --- | --- |
| 7171ae332 (+42736b307 원본) | 생성 산출물 바이트 종류 검사. `retrieval-download` 코드·retrieval 계열(d2cae6c11, a1c712be9, 31e72c476, ad46b995d, 5ce949038)에 의존해 사슬이 깊음. 별도 작업으로 |
| f9564fcd2 | Agent의 분镜표 행/열 읽기. 업스트림 shot-table 스키마(columns/rows/source 상태)가 포크에 없음 |
| 6210978b5 | 개념 소유자 등록. 포크에는 해당 개념 파일이 없음 |
| df3d138b0, 54c444e53, 2b834bc5e, 98ac5dcab | main 쪽 원본. 이식본(3764be5f5, a9093bfff)이 포크 UI에 맞게 이미 반영 |
| feat(telemetry), perf.session.summary | 텔레메트리/성능 수집은 포크 방향과 무관 |
| 3D-BOX director 통합 | 0.24 구조 필요 |
| 문서·테스트만의 변경, 사이트/튜토리얼 | 가져올 가치 없음 |
