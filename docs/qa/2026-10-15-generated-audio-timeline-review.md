# Generated audio timeline adoption — independent code review

Acceptance line: `sol_review` (independent reviewer; separate from implementation and browser acceptance).

Status: **ACCEPTED for the exact implementation commit `d50a8488a111ef65eb3f2d9bfebd158c9c79bcd2`**, compared with base `a6197863cb3506c459333e4abe466a008a086fe5`. No actionable static finding remains in the reviewed change. This is a code review receipt, not a browser, PR CI, merge, deployment, or merged-SHA receipt.

## Findings and final behavior checked

- The first candidate still classified `result.type='audio'` in category `shots` as an image and omitted `meta.durationSec`. The final shared builder recognizes the audio result and execution kind, retaining the legacy `categoryId='audio'` placeholder rule. Its duration priority is selected result `durationSeconds`, then current audio result's `meta.durationSec`, then the established non-image fallback; 3.244603 seconds at 30 fps becomes 97 frames.
- Historical audio selection does not borrow the current result's metadata. When a selected audio result has no known duration, the async builder probes that selected file with the existing audio duration reader. A null probe keeps the existing fallback; no persisted wrong-track clips are silently migrated.
- The initial single-node adoption path decoded an unknown-duration source twice and could resume after a project switch against the replacement project's global timeline. The final path measures once, captures the existing project execution context before await, checks its lifetime after await, and silently cancels a stale project. It computes append placement from the live timeline after measurement, preserves the measured frame count in the final position-dependent clip, and declines an fps change. The shared boundary covers quick-add and drag adoption.
- The adoption receipt distinguishes a stale timeline from an ungenerated result, and suppresses a project-changed receipt. The root-cause record was corrected to describe the final one-probe and pure final-builder flow.

## Independent checks and limits

- Re-ran the four focused Vitest files against the frozen commit: 49/49 passed. They cover the reported 97-frame fixture, legacy placeholder, result/meta precedence, historical metadata isolation, unknown-duration probe and fallback, one-probe adoption, project lifetime cancellation, concurrent append placement, fps drift, and receipt behavior.
- `git diff --check a6197863cb3506c459333e4abe466a008a086fe5..HEAD`: clean; reviewed commit worktree was clean before this report.
- I did not run a live browser or export loop. The coordinator owns the final Web QA, PR checks, merge, deployment, and merged-SHA verification. If the implementation commit changes, this acceptance line must be rechecked.
