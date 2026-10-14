# Source storyboard execution

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

Implementation line: keyframe-execution. Category: spend, long-running.

| Cell | Decision and evidence |
|---|---|
| 1 | Generate and approve a keyframe image, inspect its actual result, pin that project image as first_frame, then approve image_to_video. Browser row execution keeps its existing dependency waves. |
| 2 | Original storyboardDesign owns author body; ProductionRun stores only a derived sourceStoryboardHash. door-map assertDocumentOperation identifies both semantic entry and authorization recheck. |
| 3 | Reuse compileShotOutbound and existing canonical asset references, approvals and provider jobs. No second scheduler. |
| 4 | Existing pending/ready/failed/cancelled/stale UI states remain. Missing first frame fails closed before spend. |
| 5 | Before approval interruption spends nothing; accepted job keeps existing durable provider receipt; restart preserves source plan digest; repeated confirmation uses existing receipts; altered source fails. |
| 6 | Project asset identities and owning model schemas determine permitted first_frame input. Unknown/unready image is refused by existing asset admission. |
| 7 | Linear projection over authored rows; no new network request. Measure in targeted tests. |
| 8 | Root coordinator verifies actual browser and GPU two-phase flow; Windows/native new install unverified here. |
| 9 | Independent acceptance by separate line; revert this task commit to restore conservative guard. |

Independent acceptance follow-up: source pin increments the Run revision. Create, patch and revise must return a fresh read after all author writes, so a second edit using the returned expectedRevision succeeds. Both single and multi-shot source creation are characterized.

Browser evidence follow-up: model reference inputs must retain first_frame/last_frame and media kind; derive object input from the existing owner and normalize legacy IDs once at model boundary. Precompile source author plan before Run creation so invalid duplicated referenceBindings leaves no partial durable task. Keep the existing MCP payload ceiling.

Actual GPU follow-up: a top candidate ID is not the author shot ID. Normalize each real shot once; resolve the mirrored top candidate by unique candidate identity and update shot plus alias atomically. Multiple matches fail closed. Author updates use the real shot owner, preserving source execution agreement throughout normalization.

Runtime budget follow-up: retain every typed reference field and author constraint; shorten duplicated model-facing field descriptions within the existing pi estimator core785/full1706 ceilings. Regenerate the intentional model-face snapshot without increasing any budget.

Actual approval screenshot follow-up: card model list must include every published mode, and the transient card node must retain the quoted catalog model normalized custom capability contract through the existing owner. Preserve first/last reference identity and prevent copying arbitrary catalog metadata. Keep explicit shot selection for already-started multi-shot edits.

Actual editor mount follow-up: Tiptap omits an empty paragraph content array while the document owner normalizes it to []. Compare normalized current and incoming full JSON before editor-only revision creation. Formatting edits retain their revision effect even when plaintext hash is unchanged. Explicit document-write revision contracts and source guards remain unchanged.

Independent acceptance correction: legacy workbench normalization drops supported rich attributes. Editor equality now retains raw full JSON and equates only omitted versus empty node content arrays. Supported table span/column-width, list start, code language and mark attributes stay significant and raw emitted content is preserved.

### Comfy approved snapshot protocol correction
The real approved first/last video request failed before GPU admission: LoadImage received HTTP /view URLs rather than uploaded input names. Upload authorization deliberately seals HTTP snapshots, while the original runtime localizer only handles local/data assets. The Comfy protocol owner validates origin, base path, type=input and safe unique filename/subfolder, then lowers both role and generic references before wire sealing. Approval hashes, asset versions, upload/hash verification and submission_unknown reconciliation remain unchanged. Red evidence: /tmp/nomi-comfy-reference-red.log (six failures, three existing passes). No direct retry of the unknown job; the coordinator owns reconciliation and fresh browser approval. Design cells 1–9 retain the existing two-phase ownership/approval flow; this change affects only the explicit uploaded receipt representation.

### Alternate-view source ownership correction
Source-origin identity follows the durable Run even when draft_shots is invoked from generation view. Previously the canonical source writer accepted storyboard author fields, then the same patch persisted them in candidate.storyboard. The shared domain assertion rejects author metadata in source-backed durable create/patch/revise; Web sync preserves those fields in the project before returning an execution-only patch. Legacy duplicated records remain readable and are never silently repaired. Red characterization covers source create and alternate-view patch/revise plus direct durable entrances. The existing nine-cell design retains project ownership, source hash pins, two approvals and no new scheduler; failed canonical source writes must never reach the candidate mutation.

### Missing-origin compatibility characterization
The source ownership precheck initially dereferenced origin before command classification, breaking existing partial/legacy non-source task records before their original artifact review guard. The ownership boundary now classifies source ownership only by an explicit optional sourceDocument binding, leaving legacy non-source commands with their existing guards. Red evidence /tmp/nomi-source-origin-red.log covers task artifact approval and missing-origin generation patch; source-backed author duplication tests remain mandatory. No persisted QA records or schema fields are rewritten.
