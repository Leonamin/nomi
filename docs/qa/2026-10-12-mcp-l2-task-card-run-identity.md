# 독립 검수 — mcp-l2 작업 센터 카드 런 정체 (2026-10-12)

- 구현선: mcp-l2-task-card-implementation
- 검수선: mcp-l2-task-card-acceptance (별도 세션·읽기 전용, 구현 이력 상속 없음)
- 대상 SHA: `fix/mcp-l2-task-card` (`8e43aaa2b`까지) vs base `origin/main` `9a90916fc`
- 판정: **PASS-with-caveats**

## 검수선이 확인한 것

1. **원인 귀속은 맞다(클래스·기구 모두).**
   - 변경면이 주장과 일치: `productionRunView.ts` `runId` 추가, `ProductionRunTaskCard.tsx` `data-production-run-id` 방출, 카드 단위 테스트, `tests/ux/mcp-l2-journeys.e2e.mjs`의 런 id 지목 + Phase A 취소.
   - 카드 본문의 단계 목록이 무조건 렌더되고(접힌 `<details>`) `textContent`에 포함되므로 `hasText:/导出|成片|export/i`가 예산 카드도 매칭한다.
   - 整카드는 하나만 마운트된다(`TaskCenterPanel.tsx` — 열린 runId 일 때만 카드). 후보는 `updatedAt` 내림차순 목록의 `find(isActive)`라 프로브 런이 이길 수 있다. 기존 `count()===0` 폴백은 실제로 죽은 코드였다.

2. **같은 클래스의 다른 진입점 점검.**
   - 테스트 전체 grep에서 카드를 **문구로** 거르는 곳은 고친 여정 하나뿐이었다.
   - `production-mcp-journey.e2e.mjs`(실사용 CI 세트의 다른 제작 카드 소비자)는 프로젝트당 런을 하나만 만들어 카드가 유일하다 → 영향 없음.
   - `test:real-user-journeys:ci`를 부르는 워크플로·매니페스트는 각각 하나뿐.

3. **Phase A 취소가 뒷 단언을 깨지 않는다.**
   - `generation.cancel`은 로컬이며 공급자 제출이 없다(`provider.hits` 단언과 일치). Phase A의 operationId는 이후 재참조되지 않는다.
   - 취소 후 `plan.state=cancelled` → `isProductionRunTask` false → 설령 `run.status`가 비종료로 남아도 카드를 차지할 수 없다.

## 지적과 반영

- **(반영)** 계약 `direct_cause`의 "폴백 액션" 표현이 부정확: 예산 게이트는 `decisionHome='nomi'`라 라우티드 폴백이 아니라 일반 주 버튼이 뜬다. 계약 문구를 정정했다.
- **(반영)** `same_class_scan`의 소비자 목록이 완전하지 않았다(테스트 전체에 소비자가 더 있음). 결론은 유지되나 서술을 실제 범위로 넓혔다.
- **(잔여 위험, 계약 `residual_risks`에 기록됨)** C12는 여전히 "4샷 런이 유일한 整카드"라는 상태에 기댄다. 런 id 지목은 소유자가 틀리면 **조용한 오클릭 대신 시끄러운 타임아웃**으로 바꿔줄 뿐이다. 프로젝트에 active 런이 여럿일 때 패널에서 특정 런 카드를 고정하는 제품 동작은 이번 범위 밖.

## 검수선이 재현하지 못한 것 (residual)

- 초록 증거(단일 실행 3/3, 게이트 9/9)는 검수 세션에 셸이 없어 **재실행하지 못했다**. 구현선의 로그를 그대로 인정한 상태다.
- 실패 시점의 CI 카드 본문·소유 런 식별은 관측하지 못했다(정적 근거 + 구현선 로그로 대체).
