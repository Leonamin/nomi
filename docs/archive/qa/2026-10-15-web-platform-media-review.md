# Web platform media independent code review — 2026-10-15

Acceptance line: `sol_review` (reviewer; separate from implementation and real-browser acceptance).

Status: **ACCEPTED for static code review of the current working diff** against base `93b0830f20e2dc97db54738157f2c1f527fbe152`. This is not a browser, CI, PR, merge, or release receipt. The implementation is still uncommitted at this review point.

## Findings corrected and rechecked

- The Web bridge projection removed `skill`, while the router read `skill.onChanged` without guarding the parent. The router now guards `skill?.onChanged`; Web mount no longer has this specific exception path.
- The projection removed project-location action methods, attention-sound native action methods, and automation-policy writes while the settings UI still offered their controls. Those callers now guard/disable unsupported actions. The attention-sound cleanup also guards the absent `stop` method.
- Screenshot hotkey and diagnostics trace-directory methods have no Web RPC routes. The projection now removes both; screenshot controls check method availability, and the trace section hides itself when its method is absent.
- The Skill library rail and its management link now follow the projected `skill.list` capability. The browser asset popover drop path was examined but is not reachable through normal Web navigation because its browser bridge is projected out and all three normal browser entry points require that bridge.

## Review basis

- Media delivery: the shared resolver changes URLs at image/video/audio consumption boundaries while RPC translation recovers canonical `nomi-local://asset/` identity before persistence. The HTTP policy admits only specified project-owned media locations and extensions, rejects encoded traversal/slashes and query strings, and delegates Range/HEAD streaming to the existing protocol handler. The repository resolver checks symlink containment.
- Generation canvas: completed-result recovery uses the successful current run's `resultId`, checks merged history for that exact id, and preserves an explicitly edited local selection.
- Browser file drop: Web uploads original `File` bytes through `importNativeFile`; Electron retains native-path batch copy. Per-file failures are counted without moving imports to a different project.
- Inspected the full touched diff, route/bridge callers and policy/protocol ownership. No additional actionable static defect remained in this scope.

## Independent checks and limits

- `pnpm exec vitest run web/mediaUrls.test.ts web/mediaPathPolicy.test.ts web/hostCapabilities.test.ts --config vitest.web.config.ts`: 19/19 passed.
- `pnpm exec vitest run src/media/assetDeliveryUrl.test.ts src/workbench/project/webCanvasProjection.test.ts src/workbench/assets/assetLibraryLocalImport.test.ts --config vitest.config.ts`: 20/20 passed. The expected failed-import fixture logs its handled error.
- `git diff --check`: clean.
- No independent live browser task loop, media playback, screenshot inspection, hosted CI, merge, or merged-SHA verification was performed by this reviewer. The coordinator owns those acceptance steps. Recheck this line if implementation changes after this report.

## Post-review assertion check

The final-gates failure came from `electron/skills/skillLibraryBroadcast.test.ts:49`, a source-text assertion that still expected the unsafe `skill.onChanged` expression. The revised assertion expects `skill?.onChanged`, matching the reviewed router guard without changing broadcast behavior. I independently ran that test file: 2/2 passed. No production source change was required for this correction; the static review decision above stands. Full gates and live-browser acceptance are coordinator-owned.
