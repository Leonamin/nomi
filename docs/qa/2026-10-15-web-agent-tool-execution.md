# 웹 에이전트 문서 실행 검증

구현선: web-tool-implementation. 독립 검토선: tool-execution-review.

## 수정 전 증거

프로젝트 project-1792039532853-rtp2qv의 마지막 응답은 assistant-text로만 저장돼 있었고 write_script tool-call/result가 없었다. 앞선 read_script/look_at_canvas는 실제 성공했다. 같은 증상이 별도 프로젝트에도 있었다. 모델/provider 중 어느 쪽이 DSML을 텍스트로 만든 것인지는 미확정이다.

회귀 테스트를 먼저 실행했을 때 양 엔진의 분할 DSML 텍스트가 정상 종료로 처리됐고, whole-document 스키마/선행 읽기 검사가 실패했다(4 failed / 14 passed).

## 자동 검증

- `pnpm run test:web`: 최종 24 파일 / 148 테스트 통과. 사용자 오류 분류 15 테스트도 통과.
- `pnpm exec tsc -p tsconfig.web.json --noEmit`: 통과.
- `pnpm run check:root-cause-contracts`: 통과. UI 지역화 파일의 door-map 범위 경고만 있으며 상태 변경 입구가 아닌 소비자다.
- 클래스 회귀: DSML/function_calls/tool_call × OpenCode/Codex 분할 출력 거부, 정상 인용 유지, 전체 교체 전 읽기 요구, browser scope 거부, 기존 충돌 검사, 저장을 무시하는 저장소의 영수증 거부(양 쓰기 입구).

## 실제 엔진 검증

사용자 데이터와 분리된 `/tmp/nomi-agent-resume-data`에서 실제 프로젝트 repository, semantic tools, MCP SDK/Hono endpoint, native CLI를 연결했다. 자체 도구 파서/가짜 모델 응답은 사용하지 않았다. 모델 인증은 설치된 엔진의 설정을 그대로 사용했다.

| 엔진 | 실제 모델 | 첫 요청 | 같은 세션 후속 요청 | 디스크 확인 |
|---|---|---|---|---|
| OpenCode 2.0.28 | opencode-go/deepseek-v4.1-flash | read → whole-document write → read | read → end write → read | 한국어 2줄 일치 |
| Codex CLI 0.162.1 | 엔진 기본 설정 | read → whole-document write → read | read → end write → read | 한국어 2줄 일치 |

최종 저장 내용: `검증 원고: 마인크래프트 흙집` + 줄바꿈 + `검증 완료`. 각 엔진 모두 실제 write 2회, read 4회 성공. 미디어 생성·유료 생성 제출은 수행하지 않았다. 모델 추론 사용량은 엔진 계정에서 정산되며 이 검증기는 비용을 집계하지 않는다.

## 독립 코드리뷰

독립 검토선 `tool-execution-review`는 diff, 모델 스키마, 승인, 선행 읽기, 충돌, 영수증을 검토했다. 최초 정규식의 정상 인용 오탐 1건을 발견했으며, 응답 시작만 검사하도록 수정하고 회귀 테스트를 추가했다. 재검토에서 차단 결함 없음, 관련 3파일 / 34테스트를 독립 실행해 통과했다. 최종 공통 쓰기 경계 통합 delta 재검토도 수락했으며, 관련 3파일 / 38테스트를 독립 실행해 통과했다.

검사 범위 한계: 호출문 탐지는 응답 시작의 프로토콜 형식에 한정된다. 일반 자연어 성공 주장이나 문장 뒤 인용문을 자동 실행·해석하지 않는다. 모델의 모든 의도 누락을 자동 판정한다는 보장은 없다. 실제 모델이 다시 호출 대신 텍스트를 출력할 수 있으나 사용자 문서를 임의 실행하거나 자동 재시도하지 않는다.

## 화면/배포

`pnpm run build:web` 성공. 격리 서버 http://127.0.0.1:19075 의 실제 구상 화면을 zh/en으로 열고 저장한 한국어 두 문단을 직접 시각 확인했다. 캡처: `/tmp/nomi-tool-en.png`, `/tmp/nomi-tool-zh.png` (둘 다 직접 읽음). 신규 오류 문구가 실제 모델 실패로 나타나는 화면은 unverified; 분류는 회귀 테스트로 확인했다. 사용자 기존 문서는 검증에서 수정하지 않는다.

최초 gates는 테스트에 추가된 lint 경고 9개로 실패했고 모두 제거했다. 개념 소유권의 이번 두 경계도 기존 개념에 등록했다. 최종 gates와 운영 배포 결과는 PR 및 배포 health 응답으로 확인한다.
