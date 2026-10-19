# Web host capability design card

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


Change: expose only executable desktop bridge methods in Web. Owner: Web bridge projection. Category: long-running settings/media actions; no new surface.

| Cell | Decision | Evidence |
|---|---|---|
| 1 User task | In Web, opening Skills, settings, asset library, canvas video actions, or mobile camera must show supported actions or a clear unavailable state before starting work. Real tasks: list model settings, check project location, inspect a dropped camera clip. | `/tmp/nomi-desktop-api-audit.md`; Web RPC table |
| 2 Ownership | `web/client.ts` exposes the one host bridge. `web/rpc.ts` owns admitted commands; UI reads method presence and handles partial settings APIs. | `node scripts/door-map.mjs exposeInMainWorld`; source trace |
| 3 Reuse | Keep existing Web RPC methods, existing `assets.importNativeFile`, `assets.list`, and existing missing-method UI guards. Strip only unsupported native methods at the Web bridge projection. | `web/rpc.ts`; `src/desktop/bridge*.ts` |
| 4 States | Supported: unchanged. Unsupported native action: hidden or disabled before invocation. Read-only settings: value visible, write control disabled. Loading must settle instead of spinning forever. Errors from supported RPC remain visible. | Focused tests; browser settings read-only controls checked in docs/archive/qa/2026-10-15-web-platform-media-browser.md |
| 5 Interruptions | Unsupported actions never start, so stop/network/restart/repeat do not create pending work or spend. Supported actions retain their existing host lifecycle. | Bridge capability tests; live interruption unverified |
| 6 External data/failure | Web RPC admission is authoritative; the projection's exclusions are checked against its actual command table. No inferred support from the Electron preload shape. | `web/rpc.ts`; contract test |
| 7 Performance | Property removal is once during bridge exposure. No new requests or polling. | Code review |
| 8 Real conditions | Final Web preview showed unsupported Skills rail and diagnostics trace directory absent, screenshot toggle disabled, and project-location, sound and automation policy controls disabled when their methods are unavailable. zh/en settings captures were inspected. Electron acceptance remains unverified. | Focused tests and docs/archive/qa/2026-10-15-web-platform-media-browser.md |
| 9 Acceptance/rollback | Contract test proves unsupported methods absent and supported methods retained against actual Web routes; UI guard tests verify no false work starts. Coordinator completed Web acceptance in docs/archive/qa/2026-10-15-web-platform-media-browser.md; Electron remains unverified. Revert task commit if needed. | Focused tests; docs/archive/qa/2026-10-15-web-platform-media-review.md |
