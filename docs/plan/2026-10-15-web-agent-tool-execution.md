# 웹 에이전트 문서 실행 보강

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


구현선: web-tool-implementation. 분류: 기타(기존 동기 문서 저장과 CLI 결과 경계 수정; 새 UI/취소/장기 작업 없음).

| 설계 셀 | 결정 / 근거 |
|---|---|
| ★1 사용자 경험 | 기존 채팅에서 원고 읽기 → 정리 요청 → 기존 승인 → 저장 → 읽기 확인 → 화면 반영. 실제 작업: Minecraft 원고 정리(사용자 원문은 보존), 별도 검증 프로젝트에 한국어 문서 교체·영문 추가. 모델이 호출문만 출력하면 실행 실패로 안내하며 자동 실행/재시도하지 않음. |
| ★2 소유권 | 도구 실행은 web/agentLanes.ts와 MCP SDK; 문서는 productionProjectPort의 기존 직렬화 저장·버전 경계 소유. door-map --roots=web 결과는 근인 계약 참조. |
| ★3 재사용 | 기존 documentWriteSemanticInputSchema, documentWriteResultSchema, 문서 port/충돌 검사 재사용. 웹의 write_script만 실제 지원하는 whole-document/end 범위로 투영. |
| ★4 상태 | 일반 대화는 유지; 호출문 유출은 지역화된 실행 미완료 오류; 저장 실패·충돌은 기존 실패 흐름; 저장 영수증은 재조회된 revision/hash 기준. 새 시각 표면 없음. |
| 5 중단 | 기존 CLI 중단/브라우저 종료/네트워크 끊김/재시작/중복 요청 수명은 유지한다. 문서 쓰기는 기존 직렬화 저장 경계에서 처리하며 자동 재시도하지 않는다. 저장 후 검증 실패는 성공으로 보고하지 않으며 문서 확인을 요청한다. |
| 6 외부 데이터 | 엔진 JSONL은 실행 명령이 아니며 호출문 텍스트는 실패로 표시. MCP SDK의 tools/call만 실행한다. 공식 OpenCode MCP 문서 참조. |
| 7 성능 | 기존 30분 CLI 상한은 유지; assistant text는 완료 검증까지 메모리에 보관하므로 실제 모델 응답 크기에 비례한다. 별도 성능 규모 벤치마크는 unverified. |
| 8 실제 조건 | Linux 호스트, 설치된 OpenCode/Codex 실제 인증으로 한글 원고 교체와 같은 세션 추가 성공. Windows/깨끗한 설치/미디어 유료 생성/키보드 전체 여정은 unverified. zh/en 화면은 QA 결과 참조. |
| ★9 검증/롤백 | 회귀: 호출문 텍스트·분할 출력·양 엔진, 전체 교체·추가·잘못된 범위·동시 수정·저장 불일치. 실제 CLI+MCP+별도 프로젝트 저장 확인. 코드 리뷰 후 PR, merge-preflight와 CI 통과 시 합입. rollback은 해당 merge revert 후 이전 release 재배포. |

## 원인 구분
증상: DSML 호출문이 채팅에 나타나고 문서는 그대로임. 직접 원인: 정식 MCP 호출 대신 assistant text가 반환됨. 공통 결함: CLI 성공 종료를 정상 완료로 취급하고 호출 프로토콜 텍스트를 검사하지 않음; 웹 도구 스키마는 지원하지 않는 cursor/selection을 광고하고 전체 문서 교체를 표현하지 못함. 모델/provider 어느 쪽이 DSML을 텍스트로 만든 것인지는 미확정.

## 기존 자산 조사
OpenCode 2 공식 MCP 문서 https://dev.opencode.ai/v2/docs/mcp-servers/ 및 SDK 기반 web/agentMcp.ts 재사용. 엔진 교체나 자체 프로토콜 파서 없이, 텍스트는 실행하지 않고 실패로 처리한다. 전체 문서 교체에는 먼저 read_script를 요구하며 기존 내용 충돌 검사를 유지한다.


## 사용자 승인에 따른 원격 CI 예외

2026-10-15 사용자가 이번 PR의 GitHub CI 요건을 명시적으로 면제했다. 로컬 CI는 항상 필수라는 지정을 반영한다. 규칙의 정본 CLAUDE.md와 rules.json, 관련 교부/병합 문서를 동기화하며 AGENTS/rules 뷰는 생성기로 갱신한다. GitHub 설정과 검증 스크립트를 변경하지 않고, 실제 merge 신원 및 로컬 검증·배포 근거를 기록한다. 이 규칙 변경은 별도 실행 경로나 원격 green check를 만들지 않는다.
