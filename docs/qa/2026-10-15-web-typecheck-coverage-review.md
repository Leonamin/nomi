# Web typecheck coverage independent review — 2026-10-15

Acceptance line: `sol_review` (independent static reviewer, separate from implementation).

Status: **ACCEPTED for the frozen uncommitted follow-up diff** on `fix/web-platform-media-types`, based on merged `main` at `c69d20d5f7a1ffd837e73aca4755c688fc133eec`. This is a postmerge, predeployment repair of the Web typecheck failure. It is not a gate, PR, deployment, or merged-SHA receipt.

## Reviewed behavior

- `web/client.ts` removes its direct deletion of the required `videoDepth` bridge property. `projectWebHostCapabilities` already removes that unsupported Web capability, so runtime projection still has one owner and TypeScript no longer rejects deletion of a required field.
- `web/hostCapabilities.ts` types the traversed property as `unknown` before the existing object check and narrowed record cast. This resolves the inferred-local TS7022 error while retaining runtime type validation; it does not cast the whole bridge to `any` or hide a Web diagnostic.
- `scripts/typecheck.mjs` adds the existing `tsconfig.web.json` program to the root typecheck job list. Root `gates:contracts` invokes `typecheck`; its runner fails when any job is nonzero. `scripts/typecheck.node-test.mjs` pins the exact five-job inventory and verifies a simulated Web failure marks the aggregate red while other jobs still run. The wiring and gate comments were updated consistently.
- `tsconfig.web.json` includes Web production TypeScript and inherits `noEmit: true`. The separate Web workflow already used the same program. No runtime feature or persisted data format changes in this follow-up.
- I found no actionable defect in the reviewed type fixes or gate boundary.

## Independent checks and limits

- `pnpm exec tsc -p tsconfig.web.json --noEmit`: passed.
- `node --test scripts/typecheck.node-test.mjs scripts/gate-slimming.node-test.mjs`: 10/10 passed.
- `pnpm exec vitest run scripts/agent-runtime-wiring.test.mjs --config vitest.config.ts`: 6/6 passed.
- `git diff --check`: clean.
- Full gates, final commit, PR checks, live Web deployment, and postdeployment task-loop verification remain coordinator-owned. Recheck this line if source changes after this report.
