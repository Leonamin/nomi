# Engine/model identity correction

> 📋 方案待拍板 · 状态由 docs-autosync 自动登记，作者请按实修改

Implementation line: opencode_execution. Existing UI; no layout changes.

| Cell | Decision and evidence |
|---|---|
| 1 | Switch OpenCode/Codex; choose the current engine model; existing browser selectors reload owning CLI facts. |
| 2 | Server settings own engine and explicit model; hook owns only current projected list. settings/applyWebAgentSelection door maps recorded in RCA. |
| 3 | Reuse current settings/model RPC; replace unscoped reads rather than add competing discovery. |
| 4 | Loading clears obsolete models/providers; failed current request reports error; stale result discarded; success projects returned current engine. |
| 5 | Cancel/close/disconnect/restart/repeated selection: no model execution or spend; obsolete replies discarded on workspace/unmount identity changes; persisted server selection remains authority. |
| 6 | Native CLI lists remain owning model facts; RPC failures remain visible without invented fallback models. |
| 7 | One bounded discovery after successful engine switch, no extra polling; actual browser timing recorded by coordinator. |
| 8 | Mac browser switch reproduced wrong engine model; actual correction verification pending coordinator; Windows unverified. |
| 9 | Independent acceptance checks red/green engine-switch and stale replies; revert task commit on regression. |
