# Browser asset-library drop design card

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


Change: import ordinary browser `File` drops into the project asset library. Owner: asset-library import. Category: long-running import.

| Cell | Decision | Evidence |
|---|---|---|
| 1 User task | Creator opens a project library, drags one or several local image/video/audio files, waits for import, then sees them in the library. Real task shapes: camera JPEG plus MP4; a recorded WAV. Missing files remain visibly failed. No new upload endpoint or UI. | `src/workbench/assets/assetLibraryLocalImport.ts`; `/tmp/nomi-desktop-api-audit.md` |
| 2 Ownership | Project assets belong to the host asset import service. The renderer owns only drop dispatch and feedback; the Web bridge uploads bytes and Electron copies native paths. | `node scripts/door-map.mjs copyFiles`; `node scripts/door-map.mjs importNativeFile` |
| 3 Reuse | Web already implements `assets.importNativeFile` with `/api/upload`; desktop already implements `assets.copyFiles`. Use those contracts. | `web/client.ts`; `src/workbench/api/assetUploadApi.ts`; `rg 'importNativeFile|copyFiles'` |
| 4 States | Empty drop: existing no-files warning. Importing: existing library drag state clears. Success: refresh both asset collections. Partial/failed: existing failed-count feedback. Canceling: no explicit cancel control. Stale project: import payload binds the original project ID. | `src/workbench/assets/assetLibraryLocalImport.ts`; focused tests; ko/en/zh image screenshot and real drop in docs/qa/2026-10-15-web-platform-media-browser.md |
| 5 Interruptions | For each imported file, closing window/network failure/restart may stop the request and produce a failed count if the page remains. Repeated drop starts another import, as with existing desktop behavior. No spend. Existing backend owns durable files and error receipts. | Existing bridge contract; focused test; live interruption unverified |
| 6 External data/failure | Browser supplies `File` bytes without a native absolute path. The existing Web upload endpoint validates media and reports import errors; malformed/no bridge result counts as failed. | `web/client.ts`; `web/rpc.ts`; `electron/shared/contracts/assetImportResult.ts` |
| 7 Performance | Sequential per-file uploads avoid overlapping project writes; no additional renderer byte-buffer copies. Large-file timing and memory unverified. | Code review; live benchmark unverified |
| 8 Real conditions | Mac Chromium to Linux Web host imported a real PNG from browser File bytes, displayed it at 1024px, and retained it after refresh. Windows, smallest window, clean install and large-file performance remain unverified. | Focused tests and docs/qa/2026-10-15-web-platform-media-browser.md |
| 9 Acceptance/rollback | Reported browser File and class-level mixed/multiple File tests pass; Electron path tests remain green. Coordinator completed Web acceptance in docs/qa/2026-10-15-web-platform-media-browser.md; Electron remains unverified. Revert the task commit if needed. | `pnpm exec vitest run src/workbench/assets/assetLibraryLocalImport.test.ts`; docs/qa/2026-10-15-web-platform-media-review.md |
