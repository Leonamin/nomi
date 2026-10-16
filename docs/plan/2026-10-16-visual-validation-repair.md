# Visual validation repair · 2026-10-16

## 设计卡

| Cell | Decision / evidence |
| --- | --- |
| ★1 User job | Validate the cleaned repository and merge PR 32 without hiding genuine UI changes. Reproduce the desktop creation layout, compare a small unchanged button specimen, then run the complete visual suite. |
| ★2 Owner | Design-lab host fixtures own advertised desktop capabilities and projection transport; calibration owns approved pixels. Product capability detection remains unchanged. `door-map labHostState --roots=src,tests --include-tests` finds five fixture callers. |
| ★3 Reuse | Reuse the real `LaneBridge` interface, existing lane client and Playwright screenshot assertions; consolidate duplicate fixture transport setup. Retain snapshot tolerances. |
| ★4 States | Read-only host advertises its available lane, receives the fixed projection, rejects commands, and restores prior host identity on disposal. Screenshot assertions wait for the real workspace instead of accepting a lazy loading shell. No product UI text changes. |
| ★9 Acceptance / rollback | Add host lifecycle and browser layout assertions. Verify shared fixture cleanup and no command side effects. Keep previous approved PNGs unless the user approves a reviewed calibration change. Revert this repair commit independently of cleanup. |

## Findings before modification

- Clean base and cleanup produce identical failing `columns-current` screenshots.
- The creation specimen connects `laneClient` directly, while the current production shell reserves a dock only when `window.nomiDesktop.agentLane` exists. Therefore its body expands under the separately rendered Agent panel. The fixture needs to advertise the same bridge it actually uses.
- `SingleState` marks readiness after two frames even while nested workspace chunks are still loading. A direct diagnostic reached readiness with zero `.ProseMirror` nodes. Screenshot stabilization alone can accept a stable loading shell.
- An unchanged button specimen differs by a small number of glyph pixels with both Metal and default Chromium. Locale en-US/zh-CN/ko-KR does not explain the layout shift. The approved calibration records only `darwin`, not macOS/font/browser identity. Do not silently rewrite the approved images to hide that uncertainty.

## Approved recalibration

On 2026-10-16 the user approved the reviewed current renders: “현재 화면을 새 기준으로 승인”. The review gallery contains 152 old/current/diff triples; all 13 contact-sheet pages were inspected. The old references were frozen under ignored `.tmp/visual-repair/approved-before/` before replacement.

Exactly those 152 reviewed actual PNGs were copied byte-for-byte into their corresponding existing baseline paths. No new baseline was created, no tolerance changed, and the three separately pending-approval screen families remain pending and untouched. The candidate render identity is now the approved calibration: darwin / arm64 / OS release 25.3.0 / owning @playwright/test 1.60.0 / Chromium revision 1223. OS identity comes from node:os and engine identity from the owning runner's installed manifest.

The screenshot suite will independently re-render every calibrated state against these exact approved bytes. The environment guard also covers the normal check-design-lab runner and direct Playwright globalSetup. Product capability checks and production UI remain unchanged.

## Verification so far

- Reported-case regression: two host lifecycle tests failed before the installer existed and pass after the repair.
- Class calibration regression: two new environment tests failed before the guard existed; the combined focused suite passes 11 tests.
- Chinese and English creation-host browser contracts: 2/2 passed, screenshots inspected.
- Full Vitest: 1,695 files / 16,125 passing tests; 2 expected failures and 4 existing skips reported by the suite. The complete native runtime, stats, legacy MCP and engineering chain also passed under `pnpm run test` (exit 0).
- Root-cause contract checks passed; existing snapshot tolerances are unchanged.
