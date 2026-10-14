# Generation prompt language design card

Implementation line: Korean quality agent. Category: spend verification, existing surface corrective change.

| Cell | Decision and evidence |
|---|---|
| 1 | Korean creator requests lantern image → agent reads original → drafts Korean title and English encoder prompt → visible spend review → user confirms → real GPU image. Also repeat with different non-Latin subject. Root real browser QA owns acceptance. |
| 2 | Source document remains documentSession owner; draft_shots owns candidate prompt; shared language instruction owns authoring guidance. Door maps recorded in RCA. |
| 3 | Reuse canonical tool instruction and existing selection/reference-safe translator; no new model invocation or hidden rewrite. |
| 4 | Empty text unchanged; translating/loading/cancel/error uses existing localized translator; generated prompt visible in original card. |
| 5 | Closing/canceling translator invokes existing abort; stale selection/project refuses overwrite. Generation approval and restart remain existing ProductionRun lifecycle. No new charge path. |
| 6 | Native agent translates preserving subject/action/style; model profile declarations may determine supported language. Unknown support uses English default. GPU actual history verifies exact text. |
| 7 | Single extra shared instruction; no extra network translation call in normal agent draft path. |
| 8 | Real Korean browser and GPU proof required; Windows/large canvas performance unverified by this subtask. |
| 9 | Independent root acceptance compares before/after GPU subject and confirms Korean source retained. Revert integration commit restores instructions without mutating saved originals. |

## Explicit model-face review

The owning `scripts/check-model-face-frozen.mjs` policy permits intentional baseline updates with an itemized PR explanation. Ran `pnpm exec tsx scripts/check-model-face-frozen.mjs --update-baseline` and inspected the complete diff: only `draft_shots` changed, its `prompt` field description and generation prompt guidelines. No argument fields, requiredness, defaults, effects, tool order or tool count changed. The previous same-user-language instruction is replaced by the generation-specific English default, original source/title/dialogue preservation, faithful translation and actual prompt disclosure before approval.

MCP prose was shortened without increasing its budget or ledger: tools/list is 50,531 bytes (English), 50,487 bytes (Chinese), below the unchanged 50,534-byte ceiling. Frozen-face gate: 6 tests passed; changed language/assembly slice: 13 tests passed.

## Fresh conversation locale repair (before implementation)

The Korean real-browser loop exposed a second language-specific boundary: generated lane name `새 대화2` was rejected by the shared command parser. This corrective change occupies only lane command decoding. The same nine-cell design remains applicable: existing new/select/delete conversation surfaces and their localized states are reused; web and desktop commands converge on `parseLaneName`; Unicode role properties replace ASCII/Han-only ranges; names and old transcripts are not normalized or rewritten; invalid separators, punctuation and controls still fail before storage; no new model call or approval path is introduced. Existing session lifecycle and interruption behavior remain owned by lane hosts. Acceptance is exact-name command tests plus the root’s fresh Korean browser→native OpenCode loop, independently reviewed before merge. Reverting the integration commit restores validation without removing any transcripts.
