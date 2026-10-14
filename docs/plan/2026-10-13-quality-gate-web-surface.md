# 품질 게이트 — web 서피스 인식

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

2026-10-13. 브랜치 `fix/quality-gate-web-surface`. 카테고리: [其他] (검증 인프라 — UI·돈·장기실행·중단 없음).

## 왜

이 fork는 브라우저 워크스페이스 `web/`을 2026-10-12에 추가했다(`docs/plan/2026-10-12-personal-web.md`). 그런데 `scripts/validation-policy.mjs`의 인식 경로 목록(`RECOGNIZED_ROOT_PATTERNS`)에 `web`이 없다. 이 파일의 규율은 "인식 못 하는 경로는 전량(fail-closed)"이므로, **web만 바꾼 PR도 캔버스 성능(실측 26분)·Mac 패키지·Electron 워크스루·캔버스 인수까지 전부 돈다.**

실측(PR #14 `feat/web-agent-model-selection`의 실제 diff로 재현):
```
NO deletions(가정) : unrecognized_path_fail_closed:web/agentLanes.ts → unit=full desktop=true canvas=full performance=true package=true
```
즉 문서 삭제를 걷어내도 `web/`이 인식되지 않아 여전히 전량이 난다. 이 PR은 그 원인 하나만 고친다.

근거(모노레포 경계 실측):
- `web/`는 `electron/**`(93곳)와 `src/**`(29곳)를 import하지만, **역방향 의존은 0건**(`src`/`electron` 어디도 `web/`을 import하지 않음). 따라서 web만 바꾼 diff는 데스크톱 Electron 앱 거동을 바꿀 수 없다.
- 루트 `tsconfig.json`은 `src`만 포함하고 데스크톱 `pnpm run build`는 `web/`을 건드리지 않는다.
- web 테스트는 루트 vitest `include`에 없다(별도 `vitest.web.config.ts`, `pnpm run test:web`, `personal-web.yml`). `pnpm exec vitest run web/agentLanes.test.ts`는 루트 설정에서 "No test files found"로 **exit 1** — 그래서 web을 focused 레인에 그대로 넘기면 red가 난다(실측).

## 범위 밖(이 PR이 하지 않는 것)

- **문서/rename 삭제 완화**: diff에 `D`/`R`이 있고 전체가 순수 문서가 아니면 전량으로 가는 동작은 **의도된 불변식**이며(이미 schema-v3 루트코즈 계약 `docs/fixes/2026-09-08-docs-deletion-scope.root-cause.json`이 고정: "혼합된 프로덕션·테스트·CI·미인식 경로는 기존 정책 유지"), 이 PR은 건드리지 않는다. 따라서 **문서 삭제를 섞은 PR은 지금도 전량을 낸다** — 습관으로 순수 문서 PR을 분리하면 `docs_only`로 스킵된다.
- web 테스트 실행 소유권을 옮기지 않는다(여전히 `personal-web.yml`·`pnpm run test:web`).
- **web 파일 삭제를 포함한 diff**는 위 삭제 불변식에 따라 아직 전량을 낸다(후속 결정 필요).

## 설계 카드

```
변경명: 품질 게이트 web 서피스 인식    라인/담당: fix/quality-gate-web-surface    범주: [其他]
```

| 칸 | 결론 | 증거 |
|---|---|---|
| ★1 사용자가 어떻게 쓰나 | 개발자가 `web/**`만 바꾼(추가·수정) PR을 올리면, CI가 데스크톱 전용 레인(캔버스 인수·성능·Electron 워크스루·Mac 패키지)을 돌리지 않고 계약+핵심 스모크만 돈다. **하지 않는 것**: web 테스트 실행 소유권 이동 없음. 알려진 한계: `web`+`electron`/`src`가 섞이면 데스크톱 레인은 정상적으로 다시 켜진다(단조 상승 유지). | 로컬 재현: `GITHUB_EVENT_NAME=pull_request NOMI_BASE_SHA=… NOMI_HEAD_SHA=… node scripts/select-quality-gate-profile.mjs` |
| ★2 누가 결정하나 | 분류 상태는 여전히 `scripts/validation-policy.mjs` `classifyValidationPolicy` 단일 owner. 새로 생기는 사실은 "web 서피스 경로"(단일 패턴 상수) 하나. 소비자 = `select-quality-gate-profile.mjs`(CI), `run-gates-tests.mjs`(로컬), `git-delivery.mjs`(합후 수령) — 전부 같은 함수를 부른다. | `git grep -n "classifyValidationPolicy("` |
| ★3 일관·재사용 | 새 로직을 만들지 않고 기존 구조를 따른다: `RECOGNIZED_ROOT_PATTERNS`에 `web` 추가(=`assets`/`public`/`infra`처럼 인식되는 비-데스크톱 루트), `WEB_SURFACE_PATTERNS` 상수 하나, 기본 프로파일 분기에 `webOnly` 한 갈래. `unit`은 새 값(`none`)을 만들지 않고 기존 `focused`를 그대로 쓴다. | `check:self-written`, `git grep` |
| ★4 전 상태 | 해당 없음: 제품 UI 상태가 없는 검증 인프라 변경이다. 분류 프로파일 조합은 단위 테스트로 전수 커버. | `pnpm run check:quality-gate-workflow` |
| ★9 검증·롤백 | 검증: (a) `scripts/validation-policy.node-test.mjs`에 성질 테스트 추가 — web 전용은 `unit=focused, desktop/journeys/canvas/perf/package=false, failClosed=false`; 문서+web 혼합도 동일; `web`+`electron`/`src`는 데스크톱 레인 유지(단조). (b) `scripts/test-focused.node-test.mjs`에 web 테스트가 루트 focused 레인에서 선택되지 않음을 고정. 롤백: 이 커밋 revert(단일 커밋). | `node --test scripts/validation-policy.node-test.mjs scripts/test-focused.node-test.mjs` |

## 변경 요약

1. `scripts/validation-policy.mjs`
   - `web`을 `RECOGNIZED_ROOT_PATTERNS`에 추가.
   - `WEB_SURFACE_PATTERNS = [/^web(?:\/|$)/]` 추가.
   - 기본 프로파일에 `webOnly` 갈래: 순수 문서가 아니고 비-문서 파일이 전부 web이면 `{ coreSmoke: true, unit: 'focused', desktop/journeys/canvas/perf/package off, reason: 'web_surface:<path>' }`.
   - 파일 순회에서 web 경로는 어떤 레인도 올리지 않음(`continue`) — 단조 상승 유지, `web`+`electron`은 데스크톱 유지.
2. `scripts/test-focused.mjs`
   - 루트 vitest 설정에 `web/**`이 없으므로, focused 선택에서 web 테스트/소스를 제외(안 하면 `vitest run web/*.test.ts`가 exit 1).
3. 테스트 2파일 + 이 카드 + `docs/plan/INDEX.md` 한 줄.
