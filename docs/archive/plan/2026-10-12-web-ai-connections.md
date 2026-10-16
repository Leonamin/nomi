# 웹 ComfyUI 연결 관리와 외부 에이전트 패널

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

기준: own origin/main `3f5ba5e728b4123a4d18d470129ff31db0eae985`; branch `feat/web-ai-connections`; 구현선 `nomi-web-connections-implementation`; 독립선 `nomi-web-connections-acceptance`. 사용자 요청: 기존 UI를 유지하여 ComfyUI 주소 변경/연결 검사/워크플로 가져오기, OpenCode 기본/Codex 선택, 실제 연결과 생성 검증. 기존 Nomi/Japonica/leo 및 기존 OpenCode 서비스·설정 보존. commit→push→hamsbox fetch 배포만 사용한다.

## 설계 카드

분류: 장기 실행·중단 가능·연결 UI·실제 모델 요청. 9칸을 모두 작성한다.

| 칸 | 결정과 검증 |
|---|---|
| 1 사용자 흐름 | 기존 Models → ComfyUI 주소 저장/연결 검사 → API/Save JSON 분석·누락 확인 → 명시적 GPU 시험/등록 → 샷 수동 생성. 기존 Agent 대화 패널에서 OpenCode 기본/Codex 선택 → 사용자 요청 → 실제 엔진 응답과 도구 작업 → 후보 확인. 실제 3과제: 잘못된 주소 복구; H3 워크플로 가져오기와 GPU 결과; 두 엔진의 실제 대화 및 명시적으로 요청한 생성. 자동 의미 검수·자동 재생성 루프/TTS/결제/SaaS는 제외. |
| 2 상태 소유자 | 모델 설정은 기존 catalog와 canonical integrationCertification, 생성은 기존 WebGenerationJobs, 대화와 엔진 요청은 server lane owner, 원본 프로젝트는 기존 project repository/saveWebProject. 브라우저는 기존 LaneDesktopCommand/LaneWorkspaceProjection 소비자. door-map 원본과 wrapper 검색을 QA 기록에 보존. |
| 3 재사용 | ComfyuiLocalCard/WorkflowSettingsPage/기존 JSON 변환·object_info 대조·catalog staging/certification을 재사용. 기존 AgentPanelV4와 모델 선택 메뉴, 공유 Lane 계약 유지. 외부 엔진은 실제 OpenCode/Codex CLI 또는 공식 서버 API/SDK, Nomi 도구는 표준 MCP를 우선한다. 인증파일 복사·별도 에이전트 UI·직접 프로젝트 파일 편집은 하지 않는다. |
| 4 상태 | 기존 zh/en UI에 미설정/연결 검사/누락 노드·모델/시험 중/등록 성공/실패/취소/설정 변경으로 과거 결과 만료를 표현. Agent는 기존 streaming/tools/errors/stop/대화 목록 UI와 실제 backend identity를 표시한다. 검증은 시안과 실제 zh/en 캡처를 직접 확인. |
| 5 중단 | 연결 검사 중 닫기/단절은 설정을 자동 쓰지 않음; 저장은 원자적. GPU/agent 수락 후 브라우저 종료·단절은 서버 작업 지속. 서비스 재시작은 GPU accepted ID 수집 복원, agent 중단은 정직한 실패/수동 재요청 및 대화 보존. 연속 클릭은 원래 idempotent receipt/one-turn admission; Stop은 해당 요청만 취소. 수동 생성·시험 생성 중 해당 연결의 주소 변경/삭제는 명확히 거절하여 accepted receipt의 연결을 보존함. |
| 6 외부와 실패 | ComfyUI API/UI graph, object_info, 실제 media; OpenCode 2.0.23와 Codex 0.161.0 hamsbox 로그인 상태 확인. 사용자 CLI/auth/config는 원본 보존. 공식 OpenCode server/MCP docs 및 설치된 --help/프로토콜을 대조한다. 미지원·로그인 없음·모델 실패는 success로 위장하지 않음. |
| 7 성능 | 기존 corpus/performance gates; actual 연결 검사·첫 응답·GPU 시간을 측정. 대규모 32×1080p/1000샷은 별도 실제 자원이 없으면 unverified. 대화 입력은 128KB, 도구 출력은 50KB, 엔진 실행은 30분 상한; native 미지원 중간 steer/queue/첨부·skill은 정직하게 거절함. |
| 8 실제 조건 | hamsbox Linux/leo RTX5080 실제 자원, Mac Chromium zh/en·좁은 창·탭 종료/재접속. Windows 실제 웹과 전체 서버 재부팅은 unverified. 기존 profile/catalog/서비스/PID/Tailscale 경로 전후 대조. 초기 상속 시각 실패 승인 범위는 유지하되 새 실패는 허용하지 않음. |
| 9 검증/롤백 | 독립선이 고정 SHA/시안/실제 증거와 별도 테스트를 검수, PR에 보고서 링크. 기능 CI와 merge SHA delivery receipt 필수. exact-commit clean release 배포; 이전 웹 release와 별도 data backup으로 rollback. 기존 원본 앱/데이터/서비스는 rollback 대상으로 쓰지 않음. |

## UI 승인

실제 현재 연결 화면을 확인했다. 운영 데이터의 검증용 candidate vendor는 일반 provider detail로 보여 ComfyUI 관리 화면 접근에도 차이가 있다. 기존 ComfyUI 전문 화면으로 연결하고 기존 에이전트 모델 메뉴를 통해 OpenCode/Codex를 선택하는 것으로 구성한다. 동작 시안은 로컬 QA `connections-sample.html`; 사용자가 동작 시안대로 구현 승인(2026-10-12). 실제 제품에서 시안의 독립 페이지 레이아웃을 새로 만들지 않고 기존 components와 navigation을 유지한다.

## 추가 요청 설계 카드: 자동 제작과 홈

사용자가 2026-10-12 같은 작업에 AI 자동 제작 활성화와 로고 홈 이동을 추가했다. 현재 실제 운영 화면을 확인했고 로고의 텍스트 선택을 재현했다. 로고는 기존 `backToLibrary`/`leaveProject`를 사용하여 저장을 마친 뒤 이동한다. 별도 화면을 만들지 않는다.

| 칸 | 결정과 검증 |
|---|---|
| 1 흐름 | 에이전트에 대본과 샷 제작을 요청 → 기존 대본/분镜 소유자에 기록 → 실제 등록 모델로 생성 → 후보 확인. 로고 클릭/키보드 → 저장 → 프로젝트 목록 → 재열기. 처음 제외한 자동 QA/재생성은 사용자 답변 전까지 제외 유지. |
| 2 소유자 | 문서/분镜/생성 계획은 기존 capabilityCore/ProductionRun 소유자, 서버 실행 포트만 웹 호스트가 제공. 홈은 NomiStudioApp.leaveProject/useProjectLeaveAction. |
| 3 재사용 | 현역 read_script/write_script/draft_shots/generate/check_job 어휘와 canonical generation planning/submission 경계 조사 후 재사용. 폐기된 production.generate-node writer는 복원하지 않음. 두 플랫폼 브랜드는 WorkbenchButton 사용. |
| 4 상태 | 기존 에이전트 도구/승인/진행/후보 화면과 오류 표시 유지. 홈 저장 실패는 기존 프로젝트 화면을 유지. zh/en 버튼 label은 기존 번역 재사용. |
| 5 중단 | 서버 수락한 생성은 탭 종료/홈 이동 후 지속. 승인 대기에는 사용자 응답만 인정. 자동 제작은 완료된 후보를 자동 교체하지 않음. 반복 홈은 기존 공유 leave promise로 단일 저장. |
| 6 외부 | 설치된 OpenCode/Codex 로그인과 실제 ComfyUI 사용. Chromium은 웹 전용 경로와 AppArmor userns 허용만 추가하고 샌드박스/전역 제한 유지. 기존 서비스/설정 무변경. |
| 7 예산 | 명시한 작은 실제 대본/샷 2개로 GPU 흐름 검증; 전체 corpus 성능은 기존 gates. 도구/입력/시간 상한은 위 카드와 동일. |
| 8 실제 | Mac 실제 브라우저 zh/en/좁은 화면, hamsbox/leo GPU, 탭 종료와 재접속 검증. Windows 실제 기기와 서버 재부팅은 unverified. |
| 9 검증 | 독립선이 canonical 소유권과 실제 증거를 검수. 로고 red/green 계약 검사와 저장 수명주기 검사. 동일 웹 release rollback과 isolated data backup 사용. |
