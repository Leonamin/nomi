# Repository cleanup · 2026-10-16

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


Category: repository assets and documentation; no product behavior or new UI.

## 设计卡

| Cell | Decision / evidence |
| --- | --- |
| ★1 User job | Find implementation, open historical design samples, and inspect original verification evidence without root-level scratch folders. Preserve real media, test inputs, approved samples and receipts. |
| ★2 Owner | Existing `docs/design/` owns design records; `docs/archive/` owns retired handoffs. Runtime output paths remain owned by their existing walkthrough scripts. No application state owner changes. Repository-wide path/content searches identify consumers; no production mutator is changed. |
| ★3 Reuse | Use existing documentation directories and Git history. Consolidate historical samples under `docs/design/archive/`; update incoming and relative links. No new framework or duplicate implementation. |
| ★4 States | Not applicable: file organization only; existing app states and zh/en UI remain unchanged. Keep historical verification claims dated and unchanged. |
| ★9 Acceptance / rollback | Compare moved bytes, verify affected local links, preserve referenced assets, run repository gates and inspect the diff. Revert the cleanup commit to restore all tracked content. Independent acceptance is not required for this category. |

## Retention decisions

- Remove three root-level experimental screenshot folders; retain the relay walkthrough source and ignore regenerated local output.
- Move retired root reports and the README-only runtime experiment into `docs/archive/` without changing their historical status claims.
- Consolidate `docs/mockups/`, `docs/prototypes/`, `docs/plan/mockups/`, `docs/ui-designs/` and output-only design samples under `docs/design/archive/`.
- Keep provider evidence, A/B source videos and generated images, anchor references, failure captures, acceptance screenshots, JSON receipts and the feel seed ledger.
- Delete only derived camera frame/contact sheets with retained source video, and unreferenced cover contact sheets. Keep rejected paid images because generation receipts refer to them.
- Clean ignored local `.tmp/` and `test-results/` from the original checkout after repository validation. These are prior results, not current verification.

Root-cause production contract: not applicable; this is an authorized asset/document cleanup, with no production corrective change.

## Moved files

| Original | Current |
| --- | --- |
| `docs/mockups/c1-generation-error.html` | `docs/design/archive/c1-generation-error.html` |
| `docs/mockups/c5-text-node.html` | `docs/design/archive/c5-text-node.html` |
| `docs/mockups/node-error-state-redesign.html` | `docs/design/archive/node-error-state-redesign.html` |
| `docs/mockups/selection-dropdown-redesign.html` | `docs/design/archive/selection-dropdown-redesign.html` |
| `docs/mockups/unified-assistant-panel.html` | `docs/design/archive/unified-assistant-panel.html` |
| `docs/prototypes/canvas-workflow-plugin.html` | `docs/design/archive/canvas-workflow-plugin.html` |
| `docs/prototypes/library-discovery.html` | `docs/design/archive/library-discovery.html` |
| `docs/prototypes/workflow-library.html` | `docs/design/archive/workflow-library.html` |
| `docs/plan/mockups/2026-06-09-plan-card.html` | `docs/design/archive/2026-06-09-plan-card.html` |
| `docs/plan/mockups/2026-08-01-nomi-bilingual-homepage.html` | `docs/design/archive/2026-08-01-nomi-bilingual-homepage.html` |
| `docs/plan/mockups/2026-09-07-storyboard-table-node/now-01-right-rail-cards.png` | `docs/design/archive/2026-09-07-storyboard-table-node/now-01-right-rail-cards.png` |
| `docs/plan/mockups/2026-09-07-storyboard-table-node/now-02-landed-frames-lose-columns.png` | `docs/design/archive/2026-09-07-storyboard-table-node/now-02-landed-frames-lose-columns.png` |
| `docs/plan/mockups/editor-toolbar-layout.html` | `docs/design/archive/editor-toolbar-layout.html` |
| `docs/ui-designs/3d-node-canvas-state.png` | `docs/design/archive/3d-node-canvas-state.png` |
| `outputs/issue-198-group-port-design/index.html` | `docs/design/archive/group-port-design.html` |
| `outputs/issue-198-group-port-design/01-collapsed-group-port.png` | `docs/design/archive/group-port-01-collapsed.png` |
| `outputs/issue-198-group-port-design/02-expanded-group-lines.png` | `docs/design/archive/group-port-02-expanded.png` |
| `outputs/canvas-card-stack-20260827/00-approved-mockup.png` | `docs/design/archive/canvas-card-stack-approved.png` |
| `CODEX-HANDOFF.md` | `docs/archive/2026-09-28-canvas-media-dimensions-handoff.md` |
| `CODEX-REPORT.md` | `docs/archive/2026-09-06-agent-panel-v4-report.md` |
| `.superpowers/sdd/2026-09-01-agent-architecture-test-system/task-1-report.md` | `docs/archive/2026-09-01-agent-architecture-task-1.md` |
| `experiments/pi-agent-runtime/README.md` | `docs/archive/2026-08-26-pi-agent-runtime.md` |

## Removed files

Original bytes remain recoverable from commit `299905da9bab75bf903635a2451ec18d07672069`; no Git history was rewritten.

| Removed path | Bytes | Reason |
| --- | ---: | --- |
| `.camera-follow-lab/cf-FAIL.png` | 124271 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/A-t2i-fallback-image-on-canvas.png` | 464952 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/AB-ERROR.png` | 235633 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/B-after-generate-debug.png` | 338958 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/B-i2i-fallback-with-reference.png` | 484294 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/B0-after-upload.png` | 489316 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/C-ERROR.png` | 224804 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/C-route-disabled-error-card.png` | 254445 | Past experimental run output; no retained report consumes this file |
| `.relay-fallback-walk/wire-log.json` | 130 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/pose-fight.png` | 839285 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/pose-sit.png` | 840616 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/pose-stand.png` | 840360 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/pose-wave.png` | 841068 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/ue-lab-extra.png` | 208622 | Past experimental run output; no retained report consumes this file |
| `.ue-spike-walk/ue-lab-pairs.png` | 305350 | Past experimental run output; no retained report consumes this file |
| `outputs/en-prompt-ab-20260902/camera/en-orbit-first.png` | 575889 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/en-orbit-firstlast.png` | 1429635 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/en-orbit-last.png` | 838831 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/en-push-first.png` | 985037 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/en-push-firstlast.png` | 2081876 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/en-push-last.png` | 1079928 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-orbit-first.png` | 742260 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-orbit-firstlast.png` | 1677629 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-orbit-last.png` | 922972 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-push-first.png` | 980215 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-push-firstlast.png` | 1833532 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `outputs/en-prompt-ab-20260902/camera/zh-push-last.png` | 832373 | Derived camera frame/contact sheet; the corresponding MP4 is retained |
| `docs/design/covers/contact-sheet-v3.png` | 3414117 | Unreferenced intermediate cover contact sheet |
| `docs/design/covers/upstream-contact-sheet.png` | 774348 | Unreferenced intermediate cover contact sheet |

Total removed: 29 files, 24,660,746 bytes.

## Validation evidence

- `delivery:preflight`: passed on latest `origin/main` (`299905da9bab75bf903635a2451ec18d07672069`).
- Move verification: 22 destination files exist; moved HTML/media are byte-identical; Markdown and HTML links in affected files introduce no new missing local targets.
- Source A/B evidence retained: four MP4 camera clips, ten generated character/scene images, original prompt outputs, anchor comparisons, provider receipts and real UI/failure evidence.
- Original checkout local cache cleanup: 74 `.tmp/` files (6,855,670 bytes) and 609 `test-results/` files (14,759,118 bytes), all untracked. Newly generated validation failures in the task worktree are retained for diagnosis.
- `pnpm run gates`: exit 1. All 96 contract checks ran: 94 passed, `check:design-lab` blocked (152 visual differences / 36 passed), and `check:concept-owners` reported an advisory failure on unchanged production paths. Lint and TypeScript checks passed. The later unit/build stages in this command did not run because contracts blocked. A clean checkout of the exact pre-cleanup commit independently reproduces the `columns-current` screenshot failure. No visual baseline was updated.
- Separate `pnpm run build`: exit 0, frontend and Electron compilation passed.
- `git diff --cached --check`: passed. No files under `src/`, `electron/`, `tests/`, or `scripts/` changed.
- Merge remains blocked by the existing local visual gate; this cleanup is delivered as a draft PR, with no local CI waiver or merge claim.

The clean-base and cleanup `columns-current-actual.png` SHA-256 are identical: `404c2a0064a7d86804ede1e91baec40551206a7217879d5eac6bc8a312b184d8`. The baseline run has one selected test and one visual failure (23,117 differing pixels against the committed baseline).
