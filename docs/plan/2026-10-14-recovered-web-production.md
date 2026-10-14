# 최신 main 기준 웹 제작 통합

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

구현선: `/root`. 사용자 요청: 보존한 자동 제작·저장 보존과 ComfyUI 모델 호환을 최신 main에 통합하고 실제 브라우저·GPU까지 검증. 기준 SHA `2ec238d403c017012dd2ee63c262cde1e46ae4d9`.

## 设计卡

| 칸 | 결정과 검증 |
|---|---|
| 1 사용자 흐름 | 기존 프로젝트·원고 화면에서 원고 요청 → 기존 장면 계획 확인 → 생성 승인 → GPU 후보 확인 → 새로고침·홈 이동 후 다시 열어 저장 보존 확인. 실제 2과제: 원고·장면 계획 생성, 등록된 ComfyUI 영상 모델로 작은 1샷 생성. 기존 zh/en 화면과 모델 선택 메뉴 재사용. |
| 2 상태 소유자 | 원고는 DocumentLanePort/project repository, 생성은 기존 ProductionRun/planning/submission/receipt, 캔버스 병합은 공유 observation 경계, catalog는 기존 importer/migration. `door-map --roots=src,electron,web`로 호출자 조사. 브라우저는 구독·승인 소비자. |
| 3 재사용 | 보존본의 domain adapter만 선별. 최신 main의 요청별 MCP transport·OpenCode 설정·실제 모델 목록·모델 선택 유지. 웹 전용 기존 단순 shot writer를 canonical semantic tools로 대체하며 병렬 fallback을 남기지 않음. |
| 4 상태 | 기존 tool-call/result, 승인 카드, ProductionRun 진행·후보·실패·취소 상태 표시. 새로운 화면이나 시각 스타일을 추가하지 않음. 영어·중국어 실제 화면 캡처를 직접 검사. |
| 5 중단 | 승인 전 취소는 GPU 미제출; 명시적 Stop은 대기 승인을 철회. 제출 후 브라우저 종료·홈 이동은 서버 작업을 취소하지 않음. 재접속은 현재 작업과 결과를 관찰. 서버 재시작은 accepted task ID를 복원하며 자동 재생성 없음. 중복 클릭은 기존 operation/receipt/idempotency 경계로 차단. 각 경우의 확인 범위를 QA에 기록. |
| 6 외부 실패 | 설치된 native CLI·표준 MCP와 실제 ComfyUI 응답을 사용. 인증·모델·transport 실패는 실제 오류 표시. 기존 main의 프로토콜 수정 유지. 외부 API 키나 인증파일 복사 없이 소유 런타임에서 읽음. |
| 7 예산 | 검증은 작은 1샷 GPU 요청과 짧은 원고에 제한. 실행 시간과 실제 요청 수 기록. 32×1080p/1000샷 성능은 이번에 unverified. |
| 8 실제 조건 | 운영과 분리한 테스트 데이터·포트에서 브라우저 및 접근 가능한 GPU 검증. 운영 서비스·catalog·프로젝트 변경 없이 테스트. Windows/native Electron/전체 재부팅은 unverified. |
| 9 인수·롤백 | 독립 검수선이 고정 diff·테스트·실제 증거를 확인. 테스트·웹 타입·build·위험별 gates 후 PR 전달. 미병합 상태는 작업 브랜치 제거로 롤백. 운영 배포는 이 작업의 검증용 실행과 구분. |

## 보존본 재사용 범위

- 자동 제작 런타임 및 원고/캔버스 observation 병합은 통합 보존본을 기준으로 재구성.
- ComfyUI capability importer·v13→v14 migration·video candidate metadata 전달은 모델 보존본에서 선별.
- 오래된 MCP transport, OpenCode config, UI 엔진 모델 선택, locale/게이트/배포 스크립트의 되돌림은 가져오지 않음.

## 검증 상태

진행 중. 실제 결과와 독립 인수 보고서는 `docs/qa/2026-10-14-recovered-web-production.md`에 기록.
