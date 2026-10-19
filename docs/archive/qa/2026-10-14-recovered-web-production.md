# 복구 작업 통합 검증 — 2026-10-14

구현선: recovered-web-production. 독립 인수선: independent_acceptance.
기준 main: `2ec238d403c017012dd2ee63c262cde1e46ae4d9` (PR #24). 운영 서비스와 운영 데이터는 수정하지 않았다.

## 필요한 변경의 통합

보존된 automated-creation의 원고/장면계획 저장, 서버 ProductionRun 승인·제출·관찰·캔버스 결과 투영 및 브라우저 저장 충돌 처리를 통합했다. 예전 web 전용 shot writer와 renderer 생성 우회 경로를 제거했다. 문서와 캔버스에서 시작한 생성은 같은 ProductionRun/receipt/outbox/scheduler 소유자를 사용한다.

보존된 ComfyUI model capabilities의 임의 워크플로 모델 능력 선언과 카탈로그 v13→v14 마이그레이션을 통합했다. 기존에 생성된 매핑임을 증명한 모델만 보강하고 사용자 편집·알 수 없는 매핑은 덮어쓰지 않는다.

최신 main의 MCP 요청별 새 transport/server, OpenCode v2 설정, 엔진/provider/model 선택·저장·목록 API와 프로젝트 초기화 수정은 유지했다. 실제 Codex exec에서는 Nomi MCP 쓰기가 CLI에서 막히므로 공식 서버별 `default_tools_approval_mode=approve`를 추가했다. Nomi 내부의 문서/프로젝트 pin 및 생성 승인 검사는 유지하고, CLI shell/apps/plugins/hooks/multi-agent는 비활성화하며 read-only sandbox를 유지한다.

## 실제 브라우저와 GPU

격리 QA 서버 `http://127.0.0.1:19032`, 격리 데이터 `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-recovered`를 사용했다. hamsbox의 기존 ComfyUI 터널을 임시 Mac 터널로 연결해 실제 Leo RTX 5080에서 실행했다. 운영 model catalog는 keyless ComfyUI 행만 복사했고 endpoint만 QA 터널로 변경했다. 운영 Nomi는 재시작/배포/데이터 수정하지 않았다.

- 실제 브라우저 메시지 → native Codex MCP `read_script`/`write_script` → 원고 저장 → 새로고침 후 같은 내용 유지.
- 원고 메시지 → `draft_shots` → 원본 문서 아래 장면계획 저장 → canonical 승인 카드 → 사용자 클릭 → GPU image task → Run artifact → `check_job` 응답 일치.
- 캔버스에서 시작한 이미지도 같은 canonical Run owner를 사용.
- 실제 5초 영상 계획 → 승인 → GPU video task → materialized MP4 → Run completed와 native `check_job` 일치.
- 브라우저/서버 재시작 후 저장된 카드 및 결과 복원 확인. 네이티브 도구 호출 자체는 서버 종료 시 취소되고 새 메시지로 상태를 읽는 기존 정책이다. 진행 중 GPU가 있는 상태의 서버 강제종료/전체 OS 재부팅은 검증하지 않았다.
- 완료한 문서 계획에 `generate`를 한 번 더 요청하면 기존 main 정책대로 새 승인 카드를 만든다. 승인 없이 닫은 뒤 jobs=1, attempt=1, 기존 artifact 유지 확인. 자동 재제출은 없었다.
- 한국어 실사용 화면과 zh/en 실제 화면을 캡처하고 직접 확인했다. 엔진 메뉴와 실제 Codex `gpt-6.1-sol` 모델 목록을 확인했다.

| canonical Run | 기원 | provider task | 증거 |
|---|---|---|---|
| `op-30f15d5a-a12d-479a-8d7f-f0528d02a84f` | canvas | `30578bf9-f248-4c21-a1e2-4cbf3ff0cb1f` | completed, ready image artifact |
| `op-986f3193-4f21-4af9-93ad-cbcbda91f7af` | document | `31704aa7-8c9c-45ea-be34-36d1b49625d5` | completed 후 명시적 재출가/거절로 draft; ready job·artifact 유지 |
| `op-b5a5a707-c332-4745-9b3f-737ec0f07e83` | canvas | `404a7a73-8126-4ad0-818e-3abd3b48e398` | completed, ready video artifact |

모든 canonical artifact 파일의 SHA256는 Run의 contentHash와 일치했다. 최종 영상은 H264 640×384, 124 frames / 24fps, 5.167초 및 AAC이며 실제 첫 프레임도 직접 확인했다. 브라우저 media readyState=4, duration=5.167초와 실제 재생을 확인했다. 실제 ComfyUI history의 prompt가 승인된 내용과 일치했다. SD1.5 이미지 두 건은 한국어 프롬프트의 의미를 충실히 따르지 못했으므로 이미지 내용 품질 성공으로 판단하지 않는다. 영상 내용은 붉은 종이등과 일치한다.

GPU 제출은 총 5건: 초기 진단 중 기존 renderer 영상 2건, canonical 이미지 2건, 최종 canonical 영상 1건. 초기 renderer 두 건은 canonical 경로의 성공 증거로 사용하지 않는다. 외부 유료 생성 API는 사용하지 않았고 native Codex 계정 사용 비용은 이 앱에서 숫자로 제공하지 않았다.

실제 데이터/해시/probe 증거: QA 디렉터리의 `canonical-evidence.json`, `gpu-summary.json`. 캡처: `/Users/leonamin/.codex/visualizations/2026/10/14/01a13800-e067-7f22-89a3-2641424b72d3/`의 `nomi-script-saved-ko.png`, `nomi-document-canonical-approval-ko.png`, `nomi-video-approval-zh.png`, `nomi-recovered-results-zh.png`, `nomi-settings-en.png`, `nomi-settings-zh.png`. 개인정보/키/토큰은 PR에 첨부하지 않는다.

## 코드 검증

- 전체 unit: 1689 files, 16024 passed / 2 expected fail / 4 skipped. macOS `/tmp` alias 때문에 실패한 seed fixture는 실제 경로로 정규화한 뒤 관련 2개 테스트 통과. 재실행 전체 unit은 모두 통과했다.
- 최종 web suite: 23 files 93 tests 통과. Host 최종 12 tests 포함. canonical source owner shared suite 53 tests 통과.
- agent-worktree-janitor, agent-runtime, stats, legacy MCP, engineering-system 검증은 별도 로그로 기록.
- app/electron/electron-pi/test typecheck, web typecheck 통과. ESLint errors=0 / 기존 warnings=79.
- desktop build 및 web build 통과. 기존 chunk-size/import.meta bundling warnings는 별도 잔존.
- 계약 검사 96개 중 design-lab만 실패. 현재 macOS visual 152 failures는 origin/main에서도 같은 152개 이름으로 재현되고 143개 diff PNG hash가 완전히 같다. snapshot을 갱신하거나 허용치를 완화하지 않았다. 전체 gates를 green으로 표시하지 않는다.
- 원고 변경, 계획 prompt/keyframe/promptSegments/anchorIds 변경 → 승인 거절 / GPU job 없음; UI 카드 후보 수정 → 원본 authored plan과 Run candidate 동일; trusted desktop gesture와 forged web gesture 분리; import/migration 사용자 편집 보존 등의 회귀 검증.

## 범위와 미검증

웹 서버는 후보 생성까지 실행한다. canonical candidate로 표현되지 않는 authored keyframe/promptSegments/anchorIds 등 richer storyboard 실행은 불일치 검사에서 fail-closed되며 renderer로 우회하지 않는다. 기존 Electron의 renderer 소유 실행 경로는 유지된다. 자동 QA/자동 편집·export까지 수행한 증거는 아니다.

OpenCode v2의 실제 native tool execution, native Electron/Windows, 전체 재부팅, 대규모 장기 배치는 unverified. hosted CI/merge/배포는 실제 상태를 별도로 판단한다. 독립 보고서: [2026-10-14-recovered-web-production-independent.md](2026-10-14-recovered-web-production-independent.md).
