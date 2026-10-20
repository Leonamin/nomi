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
| 05f7a343a | e2ef6acaa | MCP 확인카드: 가격 미상일 때 CNY0 대신 미상 표시 |
| f042d462a | bfbe1d842 | MCP 확인 거부는 종결 상태("확인해 주세요"로 되돌리지 않음) |
| 54c444e53 (일부) | 326ba1588 | 초안 단계 매개변수 사전 검증 admitDraftParameters + draftTimeParameterAdmission 테스트. cae5b7adf의 전제라 원본에서 이 부분만 수동 반영 |
| 3117f6a67, 111570788, 37fdca366, 66ee8dff5, 4970a1574, 89c854f4b, 7dc13539d, 3143828a0, afd49641a, 85f5789f8, 1cf0ceaaa, 0a27818c2 | 6050d26ce, 9722ef05f, ba87edfdc, b6af0b794, 3480b329a, 23bbaf3a2, f374c0e30, f7294ed53, 4decd9f59, 6562ed96f, 6c76f7c79, dc843c953 | #1213 비동기 결과 결과 가져오기 사슬(release/0.23.2 이식본, 0.23.1 기준 보정): 릴레이 영상 질의 계약, 공용 상태 어휘/결과 읽기, 단계 코드(retrieval-*), 다운로드 단계 오류 보존 |
| 3d60e8b07, 9da97a0ac, 72bce828b, e9b0434d8, 2331d4fd8, c53c77509 | 42968177a, b1cf088b6, 169ef81ca, e02085a88, 033c33ba9, 43515aa02 | 위 사슬의 영상 질의 계약 매트릭스 테스트·오선택 방어·재시작 후 복구 테스트·0.23.1 인접 차이 |
| 7171ae332, 34c005287 (원본 42736b307/df728c339/78787c0c4) | 77c01ca01, a714e0f85 | 생성 산출물 저장 관문이 작업 기대 유형으로 바이트를 검사(HTML 오류 페이지·유형 불일치 페이로드는 저장 거부, retrieval-download). 포크 보충: web/rpc.ts, web/comfyuiProductionProvider.ts 호출부에 expectedKind 전달, ko 로캘 문구 추가, ComfyUI 산출물 유형 불일치 거부 테스트(web/comfyuiMaterializeKind.test.ts) |
| (포크 보충) | 6e1f65c49, fbe83756e | ko 로캘 문구 추가, 비용 단정 문구 제거(outcomeText 가드), 모델면 기준선에 variantId 반영 |

## 제외

| 업스트림 SHA | 사유 |
| --- | --- |
| d2cae6c11 (#975) | 결과 가져오기 신뢰 origin/결정적 결과 가져오기 실패 정지. #1213 사슬과 별개 이슈이며 main(0.24) 구조(productionRun 확장) 의존. 이식본(release/0.23.2)에도 없음 |
| 4991cd94c | 어휘 게이트 기준선 축소. 포크 gates 결과에 따라 필요 시 반영(아래 PR 참고) |
| f9564fcd2 | 'Agent가 분镜표 행/열/체크 읽기'. 업스트림 shot-table 노드/스키마(feat/shot-table-node, 업스트림 PR #1252 미병합)가 포크에 없음. 업스트림 릴리스에 들어오면 재검토 |
| d3a0bee47, 6123d2754, 8b2e31d58, af7dcd720, 4b64c7f82, 4c0b435aa | 'MCP HTTP 서버 + 데스크톱 포워더'. 0.24 신규·Electron 데스크톱 쪽이고 포크 배포는 웹 호스트라 가치 낮음. 사용자가 데스크톱 MCP를 원할 때만 재검토 |
| f9564fcd2 | Agent의 분镜표 행/열 읽기. 업스트림 shot-table 스키마(columns/rows/source 상태)가 포크에 없음 |
| 6210978b5 | 개념 소유자 등록. 포크에는 해당 개념 파일이 없음(gate도 요구하지 않음) |
| cae5b7adf 내 aspectRatio·null 허용 스키마 | 0.24 전용. draft_shots의 null 매개변수는 포크에서 스키마 단계에서 거부됨(에이전트가 오류를 보고 고침) |
| df3d138b0, 54c444e53, 2b834bc5e, 98ac5dcab | main 쪽 원본. 이식본(3764be5f5, a9093bfff)이 포크 UI에 맞게 이미 반영 |
| 6123d2754, 8b2e31d58, af7dcd720, 4b64c7f82 | MCP HTTP 서버(mcpHttpServer/Bridge/VerifyHttp/Desktop, 0.24 신설)가 포크에 없음. 포크는 stdio 런처 + web/agentMcp 경로 |
| 4c0b435aa | 캔버스 쓰기 4개 라우트가 director 레퍼런스 작업(3D-BOX, 0.24)에 묶여 충돌 |
| 121745347 | 확인카드 미상 가격 문구. 포크는 2026-09-10 확정 문구로 이미 처리(¥0 미표시)하여 포크 유지, 문구 통일 가드 스크립트(check-i18n-no-cost-claims)도 포크에 없음 |
| feat(telemetry), perf.session.summary | 텔레메트리/성능 수집은 포크 방향과 무관 |
| 3D-BOX director 통합 | 0.24 구조 필요 |
| 문서·테스트만의 변경, 사이트/튜토리얼 | 가져올 가치 없음 |
