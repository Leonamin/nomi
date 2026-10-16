# 삭제 fail-closed — 같은 면(문서·web) 안에 갇힌 삭제 완화

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


2026-10-13. 브랜치 `fix/deletion-scope-docs-web`(PR #18 위에 스택). 카테고리: [其他] (검증 인프라 — UI·돈·장기실행·중단 없음).

## 왜

`scripts/validation-policy.mjs`의 `ambiguousStructuralChange`는 diff 전체가 순수 문서가 아니면 `D`(삭제)·`R`(rename)을 **경로와 무관하게** 전량(FULL_POLICY)으로 보냅니다. 그래서 문서 파일 몇 개를 지우며 코드를 바꾼 PR(이 fork에서 흔한 형태 — 옛 plan 문서 정리)이 `Canvas Performance`(실측 26분)·`Canvas Acceptance`·`Mac Package`를 전부 돕니다. PR #14가 정확히 이 경우였습니다.

## 안전성 근거(실측)

- **런타임은 문서를 읽지 않는다**: `src`/`electron`에서 `docs/` 파일을 여는 코드 없음(문서 경로는 주석/표시 문자열). 문서 참조 dangling은 contracts의 `check:docs-index`(advisory)·`check:doc-status`·`check:site`가 잡고, main의 `docs-autosync`가 보정.
- **`tests/ux/marketing-home.static.mjs`는 `check:site`가 실행**하고 그건 `gates:contracts`에 있어 **모든 PR에서 돈다**. 즉 기존 "혼합 diff를 full로 유지"는 이 파일에 추가 커버리지를 주지 않았다(2026-09-08 계약의 residual이 걱정한 케이스).
- **web**: 역방향 의존 0건이라 web 삭제는 web 테스트·tsc가 그 면 안에서 잡는다.
- **rename은 예외에서 제외**: `scripts/lib/gitPaths.mjs`의 `gitNameStatus`는 R/C에서 **새 경로만** 남긴다. `git mv src/foo.ts docs/foo.md`는 `R100 docs/foo.md`로 보여 문서처럼 위장되므로, rename은 계속 fail-closed.

## 범위

- 완화: `D`이면서 지운 경로가 `docs/`·`marketing/`·`README*`·`AGENTS.md`·`CLAUDE.md`·`web/`인 경우.
- 유지: 모든 `R`, 그리고 생산(`src`/`electron`)·테스트·CI·미인식 경로의 `D`/`R` → 여전히 전량.
- 2026-09-08 계약을 **대체**(그 파일은 history로 보존, 현행 판정은 새 계약이 소유).

## 설계 카드

```
변경명: 삭제 fail-closed 같은 면 완화    라인/담당: fix/deletion-scope-docs-web    범주: [其他]
```

| 칸 | 결론 | 증거 |
|---|---|---|
| ★1 사용자가 어떻게 쓰나 | 옛 plan 문서를 지우며 코드를 바꾸는 PR이 더 이상 26분 캔버스 성능을 타지 않는다. **하지 않는 것**: 생산/테스트/CI 삭제와 rename의 fail-closed는 그대로. | `node -e` 분류 재현 / 이 카드 "검증" |
| ★2 누가 결정하나 | 분류 상태는 여전히 `scripts/validation-policy.mjs#classifyValidationPolicy` 단일 owner. 소비자 3곳(select-quality-gate-profile / run-gates-tests / git-delivery)이 같은 함수를 부름. | `git grep -n "classifyValidationPolicy("` |
| ★3 일관·재사용 | 새 패턴 문자열을 만들지 않고 기존 `DOCS_ONLY_PATTERN`과 `WEB_SURFACE_PATTERNS`를 재사용. 조건도 `deletionStaysWithinItsSurface` 한 술어로 좁힘. | `check:self-written` |
| ★4 전 상태 | 해당 없음(제품 UI 없음). 분류 조합은 단위 테스트로 전수 커버. | `pnpm run check:quality-gate-workflow` |
| ★9 검증·롤백 | 성질 테스트: (a) 문서 삭제+코드 → isolated_change(전량 아님), (b) web 삭제+web 코드 → web_surface, (c) 생산/테스트/미인식 삭제 → 여전히 full, (d) 문서/web/src rename → 여전히 full, (e) 역사적 QR 커밋 혼합 diff → focused. 롤백: 이 커밋 revert. | `node --test scripts/validation-policy.node-test.mjs` |

루트코즈 계약(schema v3): `docs/fixes/2026-10-13-deletion-scope-same-surface.root-cause.json` (2026-09-08 계약 대체).
