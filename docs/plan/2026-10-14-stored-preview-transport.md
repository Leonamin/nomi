# Stored preview transport design card

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

Owner: OpenCode execution implementation line. Category: corrective DTO boundary.

| Cell | Decision and evidence |
|---|---|
| ★1 Creator task | Open generated asset library, see video poster, play full video, reopen project and see same poster. Real generated video and imported image/video cases use stored sidecars; coordinator owns actual browser sample. |
| ★2 Ownership | assetPreview.withPreviewFields owns derived preview DTO; projectAssetStore owns persisted listing; web/mediaUrls owns HTTP translation. Door map taken before edits. |
| ★3 Reuse | Export existing preview DTO derivation and invoke it during list construction; no new thumbnail encoder, UI fallback or URL transport. |
| ★4 States | Stored preview: canonical URL transported to browser; absent preview: existing absent state; read/decode failure: existing localized error; listing does not introduce asynchronous cancellation. |
| ★9 Acceptance | Red and green real-image/video persistence tests plus actual recursive HTTP translation; coordinator confirms generated video poster. Rollback two production paths together. |

The sidecar persists relative paths, not transient transport URLs. All derived URLs must exist before platform translation. Listing must not rewrite or regenerate files.
