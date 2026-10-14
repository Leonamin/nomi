# Web execution independent acceptance — 2026-10-14

Acceptance line: `execution_acceptance` (separate from implementation lines).

Status: **ACCEPTED for the stated execution/ownership scope at `34bcc18e5de9ed4ba403a471ebab1d17ae95cbd2`, with the explicit limitations below.** Real video/history/playback, public alternate-view ownership, and original-output thumbnail evidence have been independently inspected. This document is not a PR CI, merge or release receipt. Reviewed base: `56a8ef8abfb06746d1e1901e7051d22113ed65a8`; reviewed final commit: `34bcc18e5de9ed4ba403a471ebab1d17ae95cbd2`. Independently compared all 78 committed files to the frozen working files byte for byte: no difference. Only this independent report remained untracked.

## Findings and corrections independently checked

- OpenCode configuration parsing initially treated malformed present `info`/`mcp` as absence. It now rejects malformed structures while allowing legitimate missing fields.
- Source repinning initially returned a stale Run revision. Create, patch and revise now read the operation after author writes and repinning; tests exercise a second revision using the returned revision.
- The private OpenCode server initially did not drain stderr. The final adapter drains it without publishing its contents; capability checks describe the actual private-server launch.
- Initial editor no-op code used a lossy document normalizer. A cell `colspan` change was independently reproduced as ignored and attributes were dropped. The corrected helper compares full JSON while equating only absent versus empty node-child content arrays, preserves attributes/marks, and persists raw incoming JSON on real edits. Existing DocumentSlice normalization is a separate, preexisting limitation.
- Alternate-view source patches initially persisted `storyboard` in both project and Run candidate. The correction writes author metadata through the project owner first, strips it from execution patches, and rejects duplicated author metadata at repository-create/reducer-patch/revise boundaries. Legacy duplicated candidates remain readable, but edits are refused before canonical source mutation; they were not silently migrated.
- Multi-shot normalization now targets each real row once. Top candidates mirror their owning row atomically; ambiguous ownership is rejected. Non-draft multi-shot revision still requires an explicit shot.
- Imported first/last frame controls retain typed roles; the spend card loads published image-to-video models and the owning custom capability metadata. HTTP authorization snapshots are converted to the selected ComfyUI input filename before wire-payload hashing. The strict authorization HTTP requirement remains.

## Actual evidence independently inspected

Private evidence root: `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-execution-completion`.

Read `sd15-approval-ko.png` visually: Korean original text remains in the editor; the card shows the actual English prompt and seed 12345 before approval. Read both actual materialized 512×512 PNGs visually. Recomputed SHA256 and compared the corresponding ComfyUI history:

| Run | Task | Seed | Artifact SHA256 | Result |
|---|---|---|---|---|
| `op-97e5aefc-b83a-4aa8-8a82-87c2675f7e83` | `3856d437-252d-4beb-b67c-7a423456b659` | 12345 | `1df234d268a8104d35700a35473cb252248891cbcf827639391b1386fdcac81c` | history success; approved prompt matches node 6; red paper lantern on table, extra background lantern |
| `op-f870483d-a345-4727-8261-ba6d530bc626` | `fc2ff086-bc0c-4c8e-99e6-65d2bf84817f` | 12346 | `45c43f100dcb531152f9aeb869d19205f031ef891122332401ad2bb5e00060ae` | history success; approved prompt matches node 6; yellow-lit wooden lantern on table and red hanging lantern |

Both KSampler histories used 20 steps and CFG 7. These prove correct prompt delivery and lantern semantics; **the second image does not preserve the same red tabletop subject, identity or placement**. It is not accepted as a continuous end frame. Same-seed Korean baseline failure remains part of the coordinator's evidence; this line has not independently read that baseline image and does not claim a quantified quality comparison.

Read `/Users/leonamin/.codex/qa/nomi-web/2026-10-14-opencode-runtime/resume-evidence.json`: one real OpenCode session returns counter-1 then counter-2 across two MCP turns. This establishes resume/tool availability for that fixture.

Read `final-source-video-approval-ko.png` visually: Korean source remains, both frame preview slots are populated with the accepted first image, the selected model is QA H3 first last frames, and the exact generation prompt is visible before approval. The rejected different-identity second image was not used.

Actual final video: source-bound Run `op-73ad7706-5026-474d-907e-1f8e777edfb9`; source hash `2b6f5113766ad3163f83523fc769bafe45d9a9e31ca6069dc7914236b2ac0015`; task `41ba680b-5b39-4bc2-b38c-153e99f955ea`; artifact `4665c981145a17026fa1`. Independently recomputed materialized MP4 SHA256 `4195a1001a3d8283c209a62861b103740b8c33ac0c8e69a5f3911a292905b575`. `final-video-engine-history.json` reports success and both LoadImage nodes 17/18 use `nomi-reference-1df234d268a8104d35700a35473cb252248891cbcf827639391b1386fdcac81c.png`; generation node 5 has the approved English prompt, 640×384, length 124; CreateVideo has 24 fps. `final-video-ffprobe.json` reports H.264, 124 frames, 24 fps, duration 5.166667 seconds.

`browser-video-playback.json` records 20 strictly increasing time samples, no media error, and ended=true at 5.167 seconds; `browser-original-video-playback.json` also records ended=true and no error for the original output copy (it contains no time-sample array). Read first/middle/last frame PNGs visually: the tabletop red paper lantern remains identifiable, with warm light variation; the final frame also visibly reframes/crops the lantern. Thus delivery/playback succeeds, but exact locked-camera and identical framing cannot be claimed from the visible output.

Read `alternate-view-public-tools.json` and `alternate-view-source-ownership.json`: source-created Run `op-6cbfcafa-71b6-43a2-b47a-20e9c39487d7` is checked and then patched through public `draft_shots` from the alternate generation view; both tools return without error. The canonical project row has ownership-seg range 0→4, Run revision 3 and source hash `60e6bff7ff31f17e8f2fd335370f1ef36b01d76344939e7a155bda4276e77312`; top and all shot candidates have no storyboard; zero GPU jobs. This closes the public alternate-view receipt gap for the reported path.

The minimal thumbnail change reuses the existing preview field owner during asset listing; independent `assetPreview.test.ts` passes 12 tests. `browser-video-thumbnail.json` records complete=true, naturalWidth=640 and the original video's HTTP `.preview.jpg` URL. Read `final-assets-thumbnail-zh.png`: original video shows the red lantern thumbnail; the materialized copy remains a gray video placeholder. Read actual `final-video-playing-en.png` and `final-video-playing-zh.png`: the materialized video plays under English and Chinese UI. These playing screenshots precede the thumbnail correction and show an original thumbnail load error in the background; the later thumbnail receipt closes that specific original-preview error. They do not establish thumbnails for every materialized copy or complete localized conversation output.

Final rebuilt-bundle replay: read `final-video-playing-ko.png` visually after the thumbnail correction; original-video preview is visible behind the playback modal. `browser-final-build-playback.json` records original-output duration 5.167, ended=true and errorCode=null. This is a replay of the already verified video, not an additional GPU generation.

## Nine-cell reconciliation

| Cell | Independent assessment |
|---|---|
| 1 Creator task | Korean source → visible English image prompt → approved real images verified. Source-backed accepted image in first/last slots → real GPU video → browser playback verified. Rejected second-image continuity and final video reframing limitations above retained. |
| 2 Ownership | Project storyboard owns author body; Run holds execution candidate and source hash. Repository/reducer ownership guards and canonical source-sync-before-strip inspected. Public alternate-view draft_shots receipt verifies canonical metadata update, no candidate duplicate and zero GPU jobs. |
| 3 Reuse | Existing compiler, typed reference slots, asset admission/upload, Comfy view URL helper, outbox, wire hash and approval authority reused. No second scheduler or weakened HTTP authorization. |
| 4 States | Existing stale-source/invalid-reference rejection tests pass; Korean image/video approval screenshots and English/Chinese actual playback screenshots read; video success/playback and original thumbnail verified. Complete localized failure/cancellation matrix unverified. |
| 5 Interruptions | Source changed while approval is pending is rejected; restart preserves source hash; returned-revision repeat edits pass. Full real stop/close/network/restart/repeat interruption matrix unverified. Unknown old submissions must remain untouched. |
| 6 External contract | Actual OpenCode config output shape checked without exposing secrets. Private loopback lease, strict effective MCP readiness, selected-provider input URL and receipt validation inspected. Independently reread resume-evidence.json: both turns' unauthenticated and wrong-credential requests return 401; cleanup records hasExited=true and isPortClosed=true for both leases. Confirmed for this real fixture, not all platforms. |
| 7 Performance | Targeted tests completed; maximum canvas/shot scale and production memory/latency unverified. |
| 8 Real conditions | macOS Korean creator loop, real Comfy image/video tasks, English/Chinese playback and original thumbnail verified; Windows, minimum window, clean installation, full keyboard path and complete zh/en creator loop unverified. |
| 9 Acceptance/rollback | Independent line has no remaining confirmed static finding in reviewed corrections; reported creator/video/ownership scope accepted at immutable `34bcc18e5de9ed4ba403a471ebab1d17ae95cbd2` with stated output-quality and environment limits. Coordinator must separately verify PR CI, merge scan and merged-SHA receipt. If rollback is needed, revert this task commit through normal PR workflow. |

## Independent commands and limits

- `pnpm exec vitest run web/productionHost.test.ts web/sourceStoryboardExecution.test.ts --config vitest.web.config.ts`: latest ownership batch 28 tests passed.
- `pnpm exec vitest run electron/capabilityCore/generationPlanPatch.test.ts electron/productionRun/productionGenerationOperationStore.test.ts --config vitest.config.ts`: 13 tests passed in candidate-owner batch.
- `pnpm exec vitest run electron/catalog/comfyuiWorkflowCapabilities.test.ts src/workbench/ai/v4/spendCardDraft.test.ts src/workbench/ai/v4/useAgentPanelSpendConfirm.test.ts --config vitest.config.ts`: 49 tests passed in role/card batch.
- `pnpm exec vitest run web/comfyuiProductionProvider.test.ts --config vitest.web.config.ts`: 10 tests passed in protocol batch.
- `pnpm exec vitest run electron/catalog/comfyuiLocal.test.ts electron/capabilityCore/productionReferenceUrls.test.ts electron/capabilityCore/productionReferenceTransport.test.ts --config vitest.config.ts`: 56 tests passed in protocol batch.
- Corrected editor core and reference transport slice: 19 tests passed across three files. These counts cover successive batches and are not a claim that every command ran against one final immutable SHA.
- Final full `pnpm test`: `full-test-frozen.log`, 1,693 test files, 16,094 passing tests, 2 expected failures and 4 skips; janitor 13/13, agent-runtime 488/488, stats 8/8, legacy MCP 2/2, engineering system 20/20. Coordinator reports process exit 0; independently read all these log summaries and no command-failure marker. Earlier `full-unit-accepted.log` is an archived red run (487/488 agent-runtime) and is **not** acceptance evidence.
- Final web suite: `web-tests-final.log`, 24 files and 139 tests passed.
- Contracts: `contracts-final.log`, 95 selected checks, 94 passed, 0 blocking failures and 1 inherited advisory failure. The known main design-lab failure (152) was excluded by the coordinator; this is not a claim that the unmodified full contract command is green. `concept-final.log` retains 42 existing concept-owner advisory findings after the new registry correction.
- Final builds: `build-frozen.log` and `build-web-frozen.log` show completed builds; coordinator's final process receipts (54340 and 55189) report exit 0. Earlier `build-desktop-final.log` and `build-web-final.log` are prior snapshots. PR-hosted CI and `delivery:verify-merged` were not performed by this acceptance line.
- No production edits or commits were made by this acceptance line.

Final implementation SHA: `34bcc18e5de9ed4ba403a471ebab1d17ae95cbd2`. Final real-video task/artifact SHA: verified above. Final acceptance decision: **ACCEPTED for the stated execution/ownership scope and documented limits; PR CI, merge and merged-SHA receipt remain coordinator-owned**.
