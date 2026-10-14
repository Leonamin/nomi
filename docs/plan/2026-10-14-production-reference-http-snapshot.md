# Production reference HTTP snapshot repair

Implementation: opencode_execution; spend/long-running/interruptible.

| Cell | Decision |
|---|---|
| 1 | Approve first/last frame video using actual indexed generated images; transport uploads once, seals HTTP snapshots, submits the GPU job. |
| 2 | Project asset identity owns bytes/hash; ingestion transport owns upload receipt; productionReferenceUrls owns seal mapping. Door maps in RCA. |
| 3 | Reuse localizeAssetsForVendor and canonical buildViewUrl; remove web no-op composition. |
| 4 | Pending upload/approval remains original card; malformed receipt or identity conflict fails before submission; success shows queued/run/ready original states. |
| 5 | Stop/close/network/restart/repeated approval reuse original Run receipt/outbox; upload failures do not submit generation; post-upload identity and scope guards remain. |
| 6 | Comfy official upload name/subfolder/type + view URL protocol inspected; unsupported locator fails closed; HTTP seal is unchanged. |
| 7 | Same-asset first/last upload deduplicated by existing asset transport; multiasset uploads retain current serial policy. |
| 8 | Browser real failure captured before paid GPU dispatch; unit class slice followed by coordinator actual browser/GPU verification; Windows unverified. |
| 9 | Independent acceptance checks HTTP snapshots and actual GPU references; revert task change on failure. |
