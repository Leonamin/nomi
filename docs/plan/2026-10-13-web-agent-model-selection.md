# 웹 에이전트의 엔진·모델 선택

🚧 进行中 · 尚未推送. 2026-10-13 사용자 승인(② 범위: **모델 선택 UI까지**).

## 문제

개인 웹의 에이전트 패널은 엔진(OpenCode/Codex)만 고를 수 있고 **모델은 UI에 없다**. 모델은 `NOMI_WEB_OPENCODE_MODEL` env 또는 OpenCode 자체 저장소(`~/.local/state/opencode/model.json`)의 favorite/recent에서 파생되고, 실행 파일 경로도 `~/.opencode/bin/opencode`·`~/.local/bin/codex`로 박혀 있다(`web/agentProcess.ts`). 사용자 지적: **"AI 연동이 하드코딩"**.

PR #12로 도구 호출 자체는 복구됐다. 이 작업은 그 위에서 **고를 수 있게** 만든다.

## 설계 카드

| 칸 | 결정과 검증 |
| --- | --- |
| ★1 사용자 흐름 | 프로젝트를 열고 에이전트 패널의 모델 버튼 → 팝오버에서 엔진(OpenCode/Codex)과 **모델**을 함께 고른다 → 요청을 보내면 그 모델로 실행된다. 모델 목록은 엔진이 실제로 인증한 것만 보여준다. |
| ★2 상태 소유자 | 프로젝트별 대화 상태(`WebAgentLanes`의 ProjectState)가 engine/model을 소유한다. 모델 목록의 원천은 엔진 CLI(`opencode models`)이고 Nomi는 투영만 한다. |
| ★3 재사용 | 기존 에이전트 모델 팝오버(`agentPanelV4ModelRows`)와 기존 브리지(`agentSettings`)를 확장한다. 새 화면·새 저장소를 만들지 않는다. OpenCode는 공식 `models` 서브커맨드를 쓴다. |
| ★4 전체 상태 | 엔진 미설치 / 모델 0개 / 조회 실패 / 저장된 모델이 사라짐을 각각 다른 문구로 표시하고, 사라진 모델은 '모델 없음'으로 정직하게 되돌린다(현행 `agent_lane_model_unconfigured` 정신 유지). |
| 5 중단 | 모델 조회는 짧은 타임아웃 + 프로세스 정리. 조회가 실패해도 대화는 계속된다. 대화 진행 중 엔진/모델 변경은 현행대로 거절. |
| 6 외부와 실패 | 엔진 버전별 `models` 출력 차이를 방어적으로 파싱한다. 인증 없음·바이너리 없음·타임아웃을 success로 위장하지 않는다. |
| 7 성능 | 모델 조회는 턴 시작을 지연시키지 않는다(패널이 열릴 때 lazy + 짧은 캐시). |
| 8 실제 조건 | 이 개발기의 실제 OpenCode v2.0.27 + 실제 프로젝트에서 검증. Windows·미설치 엔진·Codex 미로그인은 unverified로 남긴다. |
| ★9 검증·회수 | 설계카드 → 샘플 승인 → 구현 → 단위 테스트(설정·파싱·상태) → 실기기 E2E(모델 선택 후 실제 턴) → PR. 문제 시 revert. |

## 결정한 것 (열린 항목 없음)

- **엔진 목록·바이너리 경로**: env(`NOMI_WEB_OPENCODE_BIN`/`NOMI_WEB_CODEX_BIN`) + 기존 기본값 유지. 설정 파일을 새로 만들지 않는다 — 운영자가 둘뿐이라 UI로 뺄 가치가 없다.
- **모델 선택 범위**: 엔진이 실제로 인증한 모델 목록만 노출한다(수동 입력 없음). Nomi가 모델을 '발명'하지 않는다.
- **저장**: 프로젝트별 대화 상태에 engine과 함께 저장한다(이미 engine을 그렇게 저장하고 있다).

## 경계

포크 소유 `web/**` + `src/workbench/ai/v4/**`의 모델 행 + `electron/shared/webAgentContracts.ts`. root-cause 계약 `docs/fixes/2026-10-12-web-host-connections.root-cause.json`의 scope_paths를 같은 커밋에 갱신한다(R21/R33).
