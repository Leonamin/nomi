# 웹 제작 통합 독립 인수

구현선 `/root`; 독립 인수선 `/root/independent_acceptance`. 인수선은 구현 코드를 수정하지 않고 이 보고서만 작성한다.

## 최종 독립 판단

2026-10-14 최종 미커밋 변경을 재검한 결과, 이번 단순 원고·장면계획 → 명시적 승인 → ComfyUI 이미지/영상 후보 생성 범위는 PR 검토에 전달 가능한 상태다. 아래 중간 기록의 execution owner 및 plan freshness 발견사항은 모두 수정 후 재검했다. 새 코드의 열린 blocker/major 발견사항은 없다. 이 판단은 merge 또는 운영 배포 확인이 아니며 최종 commit SHA는 구현선의 PR evidence와 대응해야 한다. 검토 기준 HEAD는 여전히 `2ec238d403c017012dd2ee63c262cde1e46ae4d9`이고 미커밋 diff를 검토했다.

- 웹 일반 command는 native humanGesture를 부여하지 않는다. desktop만 trusted sender 검사 후 명시적으로 부여한다. 웹의 canonical spend는 signed web-session receipt를 사용한다.
- 문서 execution은 production-run owner로 통일됐고 direct renderer 생성 요청 경로가 삭제됐다. desktop renderer 기본 동작은 보존했다.
- 원고 revision/hash와 저장된 장면계획의 실행내용을 admission 유무와 무관하게 검증한다. candidate가 실행할 내용과 원고 계획이 다르면 fail-closed다. approval 대기 중 prompt/keyframe/promptSegments/anchorIds 변경을 거절하는 테스트를 확인했다.
- 카드 수정과 tool 수정의 patch/revise 두 입구는 runtime의 하나의 `syncDocumentPatch`를 통해 같은 normalizedPatch로 원고 design과 Run candidate를 갱신한다. shared planning에 중복 author patch 구현을 두지 않는다.
- 최종 독립 재실행 `productionHost.test.ts` 12개, `productionRuntime.test.ts` 3개, `productionCommand.test.ts` 2개, 총 17개 통과. 원고·계획 stale 승인 차단 및 카드 edit 동기화가 포함된다.
- concept trust_domain 두 신규 불일치와 ComfyUI pending consumer 등록은 최종 diff에서 수정됨을 확인했다. vocabularies 검사는 독립 실행해 통과했다.

## 최종 실제 결과 검토

격리 실제 데이터의 durable snapshot과 agent ledger를 독립적으로 읽고 materialized 파일의 SHA256를 직접 계산했다.

| 실제 흐름 | 확인한 결과 |
|---|---|
| canvas 이미지 `op-30f15d5a-a12d-479a-8d7f-f0528d02a84f` | completed, ready job/attempt 1, task `30578bf9-f248-4c21-a1e2-4cbf3ff0cb1f`, PNG 존재와 hash 일치 |
| 문서 이미지 `op-986f3193-4f21-4af9-93ad-cbcbda91f7af` | ready job/attempt 1, task `31704aa7-8c9c-45ea-be34-36d1b49625d5`, PNG 존재와 hash 일치. 실제 Codex check_job ledger에서 completed 응답 확인. 이후 사용자가 명시적으로 다시 generate하고 새 확인카드를 닫아 draft로 되돌아간 snapshot에서도 기존 job 1개/attempt 1 보존 확인 |
| canonical 영상 `op-b5a5a707-c332-4745-9b3f-737ec0f07e83` | completed, ready job/attempt 1, task `404a7a73-8126-4ad0-818e-3abd3b48e398`, MP4 존재와 hash 일치. evidence metadata는 640×384 / 24fps / 124 frames / 5.167s h264+aac. `canonical-video-frame.png`를 직접 열어 영상 frame 확인 |

증거 `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-recovered/canonical-evidence.json`, 같은 경로의 projects Run snapshots 및 agents ledger. 원고 editor와 후보 screenshot도 독립적으로 직접 확인했다. 초기 renderer video 2회는 owner 결함 발견 증거이고 canonical 성공 횟수에 포함하지 않는다. 구현선이 보고한 총 GPU 제출 5회는 초기 renderer video 2 + canonical image 2 + canonical video 1이다.

## 인수 한계와 전체 gates

웹 canonical candidate로 표현할 수 없는 richer storyboard author 실행의도는 서버 생성에서 fail-closed다. 원본 UI 편집·desktop renderer는 유지하지만 이 제한을 사용자에게 명시해야 한다. 새 GPU 작업이 실제 source-origin 단순 이미지와 canvas-origin 영상에서 닫힌 루프를 이루었다는 인수이며, 모든 author 변환 지원으로 확대해 주장하지 않는다. OpenCode v2 live, Windows/native Electron, OS 전체 재부팅, 대규모 장기 배치는 unverified다.

구현선은 최종 full 테스트 1689파일/16024테스트, 2 expected-fail 및 4 skip을 보고했다. 이 대규모 실행을 독립선이 반복 실행하지 않았으며 독립선의 위 focused 검증과 구분한다. contracts 전체는 main과 동일한 design-lab 152 visual baseline mismatch가 남아 있다고 보고되어 전체 gates green이나 merge 완료로 인정하지 않는다. 이 기존 실패의 근거 및 정확한 gate receipt는 구현선의 최종 QA/PR에 첨부되어야 한다.

아래는 문제 발견 당시의 중간 검토 기록이며 현재 열린 결함 목록이 아니다.

## 검토 기준과 상태

2026-10-14 검토 시작 HEAD는 `2ec238d403c017012dd2ee63c262cde1e46ae4d9` (`origin/main`)이다. 당시 미커밋 변경은 tracked 36파일 및 신규 production/capability/projection 파일이다. 작업 디렉터리는 `/Users/leonamin/dev/nomi-web-recovered-production`이다. 구현선의 후속 수정과 실제 브라우저/GPU 증거가 아직 진행 중이므로 아래 판단은 현재 변경에 대한 중간 검토다. 최종 커밋 SHA와 실제 증거 검토 후 인수 상태를 갱신해야 한다.

## 확인한 경계

- `web/agentMcp.ts`는 요청마다 새 MCP server/transport를 구성한다. 이전 main의 무상태 transport 수정이 보존됐고 tool schema는 canonical semantic registry에서 가져온다. `web/nativeAgentConfig.ts`, `web/agentProcess.ts`는 main과 동일하다. `web/agentLanes.ts`의 엔진별 모델 선택·실제 모델 목록 읽기·persist 경계도 보존됐다.
- `web/productionRuntime.ts`는 기존 ProductionRun repository/service, generation operation store, sealed authorization, submission outbox, batch scheduler, observation owner를 조합한다. ComfyUI provider submit은 canonical persisted intent, 승인 gate 및 wire payload hash를 검사한 후 grant를 발급한다. task ID 없는 복구는 indeterminate로 유지하며 자동 재제출한다고 선언하지 않는다.
- 웹 승인은 별도 `web_session_gesture` MAC attestation으로 surface/session/origin을 기록한다. pending spend 경계는 committed project selection/lease를 다시 검사한다. 기존 native gesture와 외부 elicitation을 웹 승인으로 위장하지 않는다.
- 원고·장면계획 및 캔버스 공유 projection은 browser의 observed hashes에 대한 편집만 적용한다. unseen agent node/group/edge와 server 결과를 보존하고 observed deletion 및 새 local run을 구분한다. 서버 저장과 브라우저 projection은 같은 merge owner를 사용한다.
- ComfyUI capability는 workflow 이름 대신 bound inputs/output에서 계산한다. v13→14 migration은 native importer가 만든 mapping임을 graph/mapping/control 형태로 증명한 경우에만 contract를 채운다. 명시적 contract와 사용자 변경 mapping은 보존하며 migration 자체가 원본 상태를 수정하지 않는다.
- document tools는 자신이 성공시킨 write의 source pin만 전진시킨다. 사람이 바꾼 source나 plan은 승인 전 fresh check에서 거절한다. Stop과 native turn 종료를 구분하고 승인 대기는 시간 제한에서 제외한다.

## 발견 사항

### major — 웹 일반 gate command에 native humanGesture 인정 가능성 (수정 후 재검 통과)

검토 당시 `web/rpc.ts:162`는 공유 `rendererCommand`를 통해 `gate.decide`에 `humanGesture: true`를 부여했다. 최신 semantic generation gate는 repository의 authorizationDigest/receiptId 검사로 receipt 없는 승인이 실패하지만, 기존 프로젝트의 legacy `budget_envelope`/`job_set` gate에는 이 검사가 없다. `productionRunApprovalReceipt.ts:164`는 native humanGesture를 유효한 승인으로 인정한다. 새 웹 명령 채널은 기존 Run도 열므로 canonical pending-spend 확인 대신 일반 gate command로 legacy spend 승인이 가능해진다.

구현선에 즉시 전달했고 수정 후 독립 재검했다. 공유 `rendererCommand(value, shouldAttestHumanGesture = false)`는 기본값에서 humanGesture를 부여하지 않고 payload에 있는 위조 값도 버린다. Electron IPC만 `assertTrustedSender` 이후 명시적으로 `true`를 전달한다. 웹 일반 command는 gate approval owner의 receipt 요구를 그대로 받으므로 legacy spend gate도 receipt 없는 승인을 거부한다. 별도 웹 canonical pendingSpend 경로는 유효한 web-session receipt를 유지한다. `web/productionCommand.test.ts` 2테스트를 독립 재실행해 통과했다. 현재 열려 있는 코드 발견 사항은 없다.

## 독립 실행 검증

- 기본 Vitest 설정: `src/workbench/project/webCanvasProjection.test.ts`, `webCreationProjection.test.ts`, `electron/catalog/comfyuiWorkflowCapabilities.test.ts`, `comfyuiWorkflowDiscovery.test.ts`, `comfyuiWorkflowImport.test.ts` — 5파일, 92테스트 통과.
- 웹 Vitest 설정: `web/agentMcp.test.ts`, `agentLanes.test.ts`, `webApprovalReceipt.test.ts`, `productionRuntime.test.ts`, `productionHost.test.ts`, `semanticAgentTools.test.ts`, `rendererRequests.test.ts`, `comfyuiProductionProvider.test.ts`, `canvasSave.test.ts`, `creationSave.test.ts` — 10파일, 40테스트 통과.
- 추가 웹 경계: `web/agentProcess.test.ts`, `creationContext.test.ts`, `generationSync.test.ts` — 3파일, 12테스트 통과. native 실행 설정 보존, creation 입력 처리 및 server 결과 복원 범위를 확인했다.
- 웹/desktop 명령 attestation 분리: `web/productionCommand.test.ts` — 1파일, 2테스트 통과.
- 후속 native 승인/원고 제한 변경: `web/agentProcessApproval.test.ts`, `semanticAgentTools.test.ts` — 2파일, 8테스트 통과. Codex의 승인 위임은 `mcp_servers.nomi.default_tools_approval_mode` 하나로 한정되며 read-only sandbox 및 shell/apps/plugins/hooks 차단을 유지한다. Nomi의 정책/원고 승인과 production spend 승인은 여전히 서버 domain owner를 통과한다. 웹 `write_script`는 append만 허용하고 cursor/selection은 fail-closed, `read_script` selection도 서버 project port에서 거절한다.

## 실제 원고 증거 검토

독립 인수선이 `/Users/leonamin/.codex/visualizations/2026/10/14/01a13800-e067-7f22-89a3-2641424b72d3/nomi-script-saved-ko.png`를 직접 열어 한국어 원고가 실제 editor에 표시됨을 확인했다. 격리 데이터 `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-recovered/agents/*.json`의 tool ledger에서 native Codex `read_script` 성공, `where=cursor`의 unsupported 실패, 이어진 `where=end` append 성공 및 재읽기 결과가 원고와 동일함을 확인했다. CLI가 단순 설명문을 생성한 결과로 대신하지 않고 실제 MCP tool call/result와 editor 결과가 연결된다.

후속 `scripts/check-design-lab.mjs` 수정은 project-owned `@playwright/test/cli`를 `process.execPath`로 실행하도록 하여 test package와 다른 npx CLI의 혼용을 제거한다. outcome field vocabulary 등록의 단일 소유자를 확인했고 `check-vocabularies`는 217 owner 통과했다. 신규 concept owner 3개의 symbol/path는 실제 코드와 일치하지만 직접 `check-concept-owners` 실행은 총 45건 실패했다. 신규 두 trust_domain은 path-derived 값과 불일치한다(`webCanvasProjection`은 renderer, `comfyuiWorkflowCapabilities`는 main으로 registry gate가 요구). 신규 `comfyuiProductionProvider`의 mintSpendGrant도 pending consumer 등록 경계에 걸렸다. 나머지는 기존 미등록/기존 웹 소비자와 섞여 있어 main 대조 없이 모두 이번 변경의 회귀로 단정하지 않는다. 구현선에 신규 delta 수정 및 baseline 구분을 요청했다. 전체 design-lab 실측 결과도 구현선에서 전달받아야 한다.

## 실제 GPU에서 발견된 execution owner 결함 (최종 수정 후 재검 통과)

구현선이 전달한 `gpu-summary.json`에서 성공 video 2건과 640×384, 24fps, 124 frames, 5.167s h264/aac 출력 metadata를 확인했고 `nomi-gpu-candidates-ko.png`의 실제 후보 화면도 직접 열어 확인했다. 그러나 이 두 요청은 문서-origin `generate`의 renderer `storyboard.present` 경로에서 기존 direct WebGenerationJobs로 수행됐다. canonical ProductionRun은 draft 및 jobs 빈 배열로 남아 `check_job`과 실제 GPU 결과가 연결되지 않는다. 따라서 GPU 성공을 이번 runtime 통합의 성공으로 인정할 수 없다.

읽기 전용 설계 검토 결과: shared planning handler에 문서 execution owner를 명시하는 host choice를 두고 desktop의 renderer 기본 동작을 보존하며 web에서는 production-run owner로 통일하는 수정에 동의한다. sourceDocument 여부가 present/gate_request/preview/withdraw/plan에 주는 여러 특례를 함께 조정해야 한다. canonical patch와 원고 장면계획이 서로 다른 실행 내용을 나타내면 안 된다. 승인 준비 시 공유 document revision/hash 검증과 Run snapshot 재검을 요구한다. 승인 대기 후 원고 변경의 fail-closed, 실제 Run job/providerTaskId/artifact와 check_job 일치, 동일 operation 재실행의 중복 GPU 제출 방지가 최종 재검 기준이다. 현재 실제 canonical 문서→GPU 폐쇄 루프는 미검증 상태다.

### canonical owner 후속 코드 재검

공유 `mcpGenerationTools.ts`의 document owner 기본값은 renderer로 유지되고 web runtime만 production-run을 지정한다. present, plan, preview, gate_request, withdraw의 sourceDocument 특례를 owner에 따라 분기하며 plan patch는 동일 normalizedPatch로 원고 design과 Run candidate에 적용한다. 기존 웹 renderer decision 요청 운반 구현은 삭제됐다. 공유 source-document revision/hash 검증은 present와 authorization 준비 시 적용된다.

추가 major 후보를 구현선에 전달했다: `productionHost.ts`의 storyboard plan hash 검사는 AsyncLocalStorage admission이 있을 때만 동작한다. UI pendingSpend confirmation은 agent tool 호출 밖에서 실행되어 admission이 없는 동안 source document freshness만 검사한다. 승인 대기 중 사람이 장면계획만 수정하면 canonical candidate가 이전 계획으로 제출될 수 있다. 원고 내용 변경 회귀 테스트와 별개로 장면계획 변경→confirmation 거절 테스트 및 durable plan pin/equivalence owner가 필요하다. 이 경계 해결과 실제 문서→canonical GPU 결과 재검 전에는 인수 완료로 판단하지 않는다.

후속 canonical owner/source 검증을 독립 실행한 `productionHost.test.ts`, `semanticAgentTools.test.ts`, `productionRuntime.test.ts` 3파일 17테스트는 통과했다. canvas-origin Run `op-30f15d5a-a12d-479a-8d7f-f0528d02a84f`의 실제 durable snapshot도 별도로 읽었다. status completed, approved authorization receipt, job ready와 providerTaskId `30578bf9-f248-4c21-a1e2-4cbf3ff0cb1f`, image artifact `asset-97d3f2655c3e31d6ae13`를 확인했고 materialized PNG 파일 존재 및 SHA256가 Run contentHash와 일치했다. 이는 canvas-origin canonical 흐름의 실제 증거로 인정하며 아직 수정 중인 document-origin 흐름과 구분한다.

계획 변경 경계는 source plan과 canonical candidate의 execution equivalence를 기존 `storyboardSubjectAdapter.ts`로 확인하는 방향을 검토 중이다. 현재 ProductionGenerationShot은 original storyboard author fields를 보존하지 않으므로 keyframe/promptSegments/anchorIds 등 처음부터 존재한 유효한 authored 내용이 빠질 가능성을 구현선에 전달했다. author 실행 필드가 있는 정상 계획과 승인 대기 중 해당 필드만 수정한 경우를 함께 검증해야 한다.

위 단위/통합 테스트는 실제 브라우저·GPU 성공 증거를 대체하지 않는다. 실제 native engine/MCP tool 사용, GPU provider receipt/output, reload 및 서버 복구 증거는 구현선에서 전달받은 뒤 별도로 판단한다. Electron native/Windows, 전체 OS 재부팅, 대규모 장기 배치는 아직 unverified이다.
