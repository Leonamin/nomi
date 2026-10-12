# Nomi 개인용 웹 버전 — 설계와 실제 검증 계획

> 📎 승인·구현·실제 GPU 검증 기록 · Git 수령은 PR #1 및 exact merge SHA receipt로 확인.

작성일: 2026-10-12. 구현선: `nomi-web-implementation`. 실제 GPU·브라우저 검증 결과: [검증 보고서](../qa/2026-10-12-personal-web.md). Git 합입과 exact SHA CI 수령 여부는 PR #1 및 delivery receipt로 별도 확인한다.

## 개발 기준

- 검증된 소스: upstream v0.23.1, `66d6eafed07ad6239acd765dd05c9eb0870cf849`. 이전 실제 검증 보고서: `/Users/leonamin/.codex/qa/nomi/2026-10-12/report.md`.
- 조사한 최신 upstream main: `8f7a9271854cb656fda1ba77f090a6b63a8c4e3c`. 검증 버전에서 1,799커밋, 4,926파일, 308,132줄 추가, 38,580줄 삭제. 현재 package version 문자열도 0.23.1이므로 버전 문자열 대신 SHA로 기준을 고정한다.
- 주요 차이: 생성 목록 화면, 캔버스 외곽 컨트롤과 그룹 배치, 입력 이벤트, source-video 편집, 생성 복구 및 개발 규칙 변경. 웹 포팅과 동시에 전부 반영하면 기존 실제 검증을 기준으로 삼기 어렵다.
- 사용자 승인으로 새 fork main의 초기 기준을 검증 SHA로 설정했다. 그 기준의 최신 개인 fork origin/main에서 sibling worktree `/Users/leonamin/dev/nomi-web-personal-web`, `feat/personal-web`을 생성하고 preflight/install 후 구현했다. 이후 main 직접 push와 force push 없이 PR로 전달한다. upstream 추적 remote는 유지한다.
- 공개 fork: https://github.com/Leonamin/nomi-web . 개인 fork [PR #1](https://github.com/Leonamin/nomi-web/pull/1)에서 전달하며, hamsbox에는 push한 커밋을 fetch해서만 배포했다. 원래 Mac checkout과 기존 hamsbox Nomi checkout을 수정하지 않았다.

## 구조 조사와 구현 경계

| 개념 | 현재 소유자 | 웹 전환 방향 |
|---|---|---|
| 앱·프로젝트·캔버스 UI | `src/main.tsx`, `NomiRouterApp`, `workbench/NomiStudioApp`, `generationCanvas` | 기존 React 화면·토큰·zh/en·제작 순서를 재사용한다. noVNC나 Electron 화면 전송 없이 브라우저에서 렌더링한다. |
| 프로젝트 원본 | `electron/projects/repository.ts`, workspace repository | 별도 웹 데이터 루트에서 동일 프로젝트 형식과 저장 경계를 재사용한다. 브라우저 localStorage를 원본 저장소로 사용하지 않는다. |
| 브라우저·서버 연결 | `src/desktop/bridge.ts`, Electron preload, IPC | 수동 제작에 필요한 명시적 웹 transport와 서버 endpoint만 공개한다. 임의 IPC 채널 실행, 셸 실행, 서버 임의 경로 읽기는 허용하지 않는다. 기존 44개 동기 bridge 호출의 bootstrap/저장 흐름을 조사하고 브라우저 요청 계약으로 정리한다. |
| 생성 제출·결과 수집 | `electron/runtime.ts`, `tasks/taskResultQuery.ts`, `submissionLedger` | 기존 모델·workflow·결과 정규화를 재사용한다. 서버가 수락한 작업을 영속 기록하고 결과 수집을 계속한다. 브라우저 연결 해제는 작업 취소 신호가 아니다. |
| 노드 결과와 후보 이력 | `src/workbench/generationCanvas/store/nodeRunOutcome.ts` | 이력 병합·상태 전이는 기존 단일 함수를 재사용한다. 서버 완료 결과를 새 브라우저 저장본이 덮어쓰지 않도록 프로젝트 저장 경계에서 작업 결과와 버전을 대조한다. |
| 타임라인·미리보기·내보내기 | `src/workbench/timeline`, `player`, `electron/export` | 동일한 타임라인 스냅샷과 미디어 참조를 사용한다. FFmpeg는 서버에서 실행한다. 브라우저 canvas 녹화에 의존하는 내보내기는 이 웹 범위에서 사용하지 않는다. 지원하지 않는 편집 조합은 시작 전에 명확히 알린다. |

HTTP·스트리밍·정적 파일 제공은 Hono와 Node adapter 등 기존 프레임워크를 사용한다. 새 범용 인프라를 손으로 만드는 대신 기존 Nomi 도메인 경계를 연결한다. 추가 의존성은 공식 문서·잠금 버전을 확인하고 저장소 prior-art/self-written 등록 규칙을 따른다.

## 설계 카드

분류: 장시간 작업 / 중단 가능 / 웹 실행 경계 및 UI. 모든 9칸 적용.

| 칸 | 결정과 증거 계획 |
|---|---|
| ★1 사용 흐름 | 프로젝트 생성 → 프롬프트 작성 → 수동 GPU 생성 → 후보 선택 → 타임라인 배치/교체 → 전체 미리보기 → MP4 다운로드. 실제 작업은 두 샷 생성, 한 샷 새 후보 생성 후 이전 후보 선택·교체, 생성/내보내기 중 탭 닫기·재접속의 세 가지다. TTS·AI 자동 검수/재생성·결제·다중 사용자·원본 upstream PR은 제외한다. |
| ★2 상태 소유자 | 프로젝트·작업·산출물은 hamsbox 서버와 기존 Nomi repository/export 경계가 원본이다. 브라우저는 편집 명령·표시만 담당한다. 생성 결과 병합은 nodeRunOutcomePatch 한 곳으로 유지한다. 시작 전 door-map으로 실제 쓰기/읽기 입구를 기록한다. |
| ★3 일관성과 재사용 | 기존 Nomi 디자인 토큰·컴포넌트·프로젝트 형식·ComfyUI mapping·결과 parser·타임라인 manifest·FFmpeg 렌더러를 재사용한다. HTTP만 표준 웹 프레임워크로 연결한다. 기존 데스크톱 설치와 운영 데이터는 변경하지 않는다. |
| ★4 전체 상태 | 빈 프로젝트는 기존 생성/업로드 안내, 수락/대기/실행/저장은 기존 작업 표시, 완료는 결과/후보, 실패는 복구 가능한 오류, 일부 성공은 성공 후보 보존, 취소 중은 취소 확인 대기, 만료/미확인 제출은 재제출 없이 확인 필요 상태로 표시한다. 새 문구는 zh/en이다. |
| 5 중단 | 아래 표 적용. 탭 종료·연결 끊김은 서버 작업을 취소하지 않는다. 서비스 재시작 후 수락한 ComfyUI prompt ID를 이어 조회하고, 불명확한 제출은 자동 재제출하지 않는다. FFmpeg 서비스 재시작은 기존 Nomi export 회수 경계에서 실패로 표시하며 사용자가 명시적으로 새 내보내기를 시작한다. 탭 종료 시 서버 렌더는 계속된다. |
| 6 외부 데이터·실패 | ComfyUI workflow 입력/노드 오류, HTTP 실패/시간 초과, 잘못된 미디어·경로·range, FFmpeg 오류를 경계에서 검증한다. 인증·설정 파일은 정적 파일 루트에 포함하지 않는다. `/prompt`, `/history/{id}`, `/view`, WebSocket은 공식 ComfyUI 계약을 따른다. |
| 7 성능 | 실제 두 샷과 재생성 후보로 GPU 수락/완료 시간, 첫 화면/프로젝트 복원 시간, 미디어 전송량, preview dropped frames, FFmpeg 시간·메모리를 기록한다. 32개 1080p 영상·1000샷은 현재 unverified. |
| 8 실제 조건 | Mac 실제 Chromium, hamsbox Node 서비스, leo RTX 5080, zh/en, 넓은/좁은 데스크톱 viewport, 새 웹 데이터 루트, 탭 종료/재접속 및 서비스 재시작을 확인한다. Windows·모바일 편집·유료 모델·전체 서버 재부팅은 이 범위에서 unverified. |
| ★9 검증·롤백 | 단위/계약 → 실제 브라우저 GPU 작업 → 후보·타임라인 → 영상·오디오·순서 → 탭 종료/재접속 → 독립 인수 검토 → PR/CI → merge SHA 검증 순서다. 독립 인수선은 구현선과 다른 agent가 읽기 전용으로 검토한다. 롤백은 새 웹 unit 정지 또는 current를 이전 clean release로 바꾸며 데이터와 기존 서비스를 삭제하지 않는다. |

## 중단 표

| 상태 | 취소 | 탭 종료 | 연결 끊김 | 서버 재시작 | 중복 클릭 |
|---|---|---|---|---|---|
| 제출 전 | 요청 안 보냄 | 요청 안 보냄 | 요청 안 보냄 | 작업 없음 | 한 요청만 수락 |
| 제출 중 | 확인 후 취소 | 서버가 제출 결과 기록 | 같은 작업 ID로 조회 | 수락 여부 미확인은 재제출 없이 표시 | 같은 idempotency key로 합침 |
| GPU 대기/실행 | 해당 작업만 취소; 다른 앱의 작업에 전역 interrupt를 보내지 않음 | GPU와 서버 수집 계속 | GPU와 서버 수집 계속 | 기록된 prompt ID로 상태 복구 | 실행 중 샷의 두 번째 제출 거절 |
| 결과 저장 | 저장 원자성 유지 | 저장 계속 | 저장 계속 | 완료 결과·후보 대조 후 반영 | 같은 산출물 중복 후보 생성 안 함 |
| FFmpeg 내보내기 | 전용 프로세스 취소, 임시 파일만 처리 | 서버 인코딩 계속 | 서버 인코딩 계속 | 고정 manifest/작업 회수 후 실패 또는 안전 재개 표시 | 같은 프로젝트 중복 export 수락 안 함 |
| 완료/실패 | 기존 산출물 보존 | 영속 결과 유지 | 재접속 시 결과 유지 | 영속 결과 유지 | 새 작업은 명시적 재생성/재내보내기 |

위 작업은 기존 로컬 GPU와 서버만 사용하며 결제 API를 호출하지 않는다. 상태·수락 ID·산출물은 웹 데이터 루트의 회수 가능한 작업 기록에 남긴다.

## 후보 선택과 타임라인 교체

- 후보 선택은 해당 노드의 현재 후보만 바꾼다. 이미 타임라인에 배치한 컷은 바뀌지 않는다.
- 별도 ‘타임라인의 이 샷 교체’ 동작은 그 샷에 연결된 컷의 소스만 교체한다. 순서·배치·트림·볼륨을 유지한다. 새 소스 길이가 기존 트림을 충족하지 못하면 조용히 늘리거나 자르지 않고 명확히 실패한다.
- 신규 배치와 기존 컷 교체를 구분한다. 타임라인에 없는 샷은 기존 배치 동작을 사용한다.
- 사용자가 직접 눌러볼 샘플: `candidate-sample.html`. 실제 Nomi 화면 위에서 후보 선택/교체 동작을 표현한다. 샘플의 MP4는 지난 검증 파일로, 새 구현의 검증 증거로 쓰지 않는다.

## 운영 계획

| 항목 | 조사 결과와 새 웹 버전의 경로 |
|---|---|
| 서버 | `127.0.0.1:9031`은 현재 비어 있음. 설치 직전 재확인한다. |
| Tailscale | 내부 HTTPS `8445`는 현재 사용하지 않음. 기존 443·8443·8444 유지, Funnel 사용 안 함. |
| GPU 터널 | 새 `nomi-web-comfyui.service`, `127.0.0.1:19188` → SSH leo `127.0.0.1:8188`. 기존 `nomi-studio-comfyui`/18188에 의존하지 않음. |
| 코드 | `/home/leonamin/apps/nomi-web/releases/<commit>`에 clean Git release를 만들고 `/home/leonamin/apps/nomi-web/current`로 전환. commit → push → hamsbox fetch만 사용. |
| 데이터 | `/home/leonamin/nomi-web-data`. 기존 `/home/leonamin/nomi-data`를 쓰기 대상으로 연결하거나 symlink하지 않음. 비밀키 없이 검증된 workflow 선언만 읽기 전용으로 조사해 새 웹 설정으로 별도 등록. |
| 보존 | Japonica, 기존 Nomi·noVNC·결과 서버, leo ComfyUI·모델·서비스·기존 접속 경로 유지. 현재 기존 Nomi app은 inactive이므로 이를 이번 작업에서 임의로 시작/재시작하지 않음. |
| dirty 보호 | 새/기존 release의 tracked/untracked 상태와 current 대상 확인. dirty면 정리/reset/덮어쓰기 대신 중지하고 원인을 보고. |
| 라이선스 | AGPL-3.0-only, LICENSE, 기존 저작권 유지. 웹 화면에서 정확한 실행 commit의 공개 소스 링크 제공. |

## 실제 완료 판정

조사 중 확인: 기존 검증 MP4에는 실제 AAC 32 kHz stereo 오디오가 있다. FFmpeg volumedetect 결과 평균 -34.9 dB, 최대 0.0 dB여서 완전한 무음이 아니다. 이전 결과의 기술적 사실이며, 새 웹 버전의 오디오 일치 또는 청취 검증을 대신하지 않는다. 샘플 브라우저는 기존 MP4 duration 10.334초, readyState 4, 미디어 오류 없음으로 읽었다. 조사 당시 leo ComfyUI running/pending queue는 모두 0이었으며 새 생성 요청은 보내지 않았다.

1. 브라우저에서 새 웹 프로젝트를 만들어 다른 프롬프트의 두 샷을 실제 GPU로 생성한다. 서버 로그와 ComfyUI prompt ID를 연결한다.
2. 같은 샷을 명시적으로 한 번 재생성해 후보 두 개를 보존하고 이전 후보를 선택한다. 선택 전후 기존 타임라인이 유지되는지, 교체 후 소스만 바뀌는지 확인한다.
3. 실제 생성 중 탭을 닫고 결과 완료 후 재접속한다. 웹 서버가 계속 결과를 받아 저장했다는 로그·파일·복원 화면을 확인한다.
4. 전체 preview에서 샷 순서·경계·트림·영상 프레임과 오디오 존재/비음소거/파형을 확인한다. MP4를 ffprobe·decode하고 같은 타임라인 시점의 영상과 PCM 오디오를 대조한다. 조용한 오디오로 오디오 검증을 대신하지 않는다. 실제 비무음 오디오 자원이 없으면 이 항목은 unverified로 남기고 완료로 보고하지 않는다.
5. MP4 인코딩 중 탭을 닫아 완료 후 결과 다운로드와 상태 복원을 확인한다. 서버 재시작에서도 프로젝트·후보·선택·타임라인·export 결과가 유지되는지 확인한다.
6. 영문/중문 실제 UI screenshot을 직접 읽고 승인 샘플과 대조한다. 폭이 좁아도 생성/후보/교체/preview/export 동작에 접근 가능한지 검사한다.
7. 다른 인수선이 고정 커밋과 실제 증거를 검토한다. 필수 gates/CI/merge scan과 merge SHA의 delivery receipt가 없으면 ‘已解决’로 보고하지 않는다. Windows 등 제외 검증을 통과로 바꾸지 않는다.

설치 성공, 단위 테스트, 이전 MP4 또는 mock 성공만으로 완료를 선언하지 않는다.

## 공식 참고

- https://docs.comfy.org/development/comfyui-server/comms_routes
- https://hono.dev/docs/getting-started/nodejs
- https://hono.dev/docs/middleware/builtin/body-limit
- https://tailscale.com/kb/1242/tailscale-serve

## 先查别人

- [Hono Node adapter](https://hono.dev/docs/getting-started/nodejs): Node HTTP, static files and request body handling already exist. This implementation composes its middleware rather than writing HTTP/multipart/range servers.
- [Nomi task query](../../electron/tasks/taskResultQuery.ts:344): Existing stateless restoration accepts provider task ID, vendor, model and task kind. The web worker stores that receipt and reuses this exact collector contract.
- [Nomi local media protocol](../../electron/protocol/localProtocol.ts:1): Existing owned file streams and byte-range handling are reused behind a restricted media URL.
- [Nomi export jobs](../../electron/export/exportJobs.ts:1): Existing FFmpeg plan, progress, output verification and restart recovery remain the only export owner.
- [Tailscale Serve](https://tailscale.com/docs/reference/tailscale-cli/serve): Adds one tailnet-only HTTPS port without replacing existing routes.

## 승인 기록

2026-10-12 사용자는 검증된 v0.23.1(66d6eaf)을 새 공개 fork main의 초기 기준으로 승인했다. 최신 upstream 8f7a927과는 1799 commits 차이가 있으므로 최신이라는 package version 문자열만으로 기준을 판단하지 않는다. 또한 http://127.0.0.1:9341/candidate-sample.html 의 후보 선택과 별도 타임라인 교체 동작을 승인했다. 이 승인은 웹 구현을 진행하는 UI 기준이며 실제 GPU 검증을 대신하지 않는다.

## 기존 로컬 시각 게이트 예외

2026-10-12 사용자가 깨끗한 v0.23.1과 작업 트리에서 동일하게 재현한 기존 design-lab 시각 차이의 초기 구현 예외를 승인했다. sb-zone-02-anchors-expanded는 양쪽 모두 416픽셀 차이를 보고했다. 원본 기준 PNG와 UI는 갱신하지 않는다. 이 검사는 통과로 기록하지 않고 advisory failure로 보존한다. 새 lint/type/web 단위 검사, 기존 기능 검사, CI와 실제 GPU 웹 흐름에는 이 예외를 확대하지 않는다. 증거: /Users/leonamin/.codex/qa/nomi-web/2026-10-12/baseline-visual.log, gates.log.

## 빌드 경계 검증

웹 산출물은 기존에 도구들이 제외하는 `dist/web` 안에 둔다. 새 `dist-web` HTML이 Vite의 개발 HTML 탐색에 섞여 기존 lazy composer 테스트를 실패시키는 것을 재현했으며, 산출물을 밖으로 옮긴 실험에서 같은 23개 테스트가 통과했다. 별도 파일 검색/테스트 예외를 늘리지 않고 기존 build artifact 경계를 따른다.
