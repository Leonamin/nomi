# 设计卡：批量「生成剩下 N 张」只发出 1–2 镜

分支 `fix/spend-batch-reference-scope`。花钱路径（四类之一），填满 9 格。

## 症状与根因

- 症状：点「生成剩下 6」只发出第一镜（偶尔两镜），卡变成「生成剩下 5」；日志 `spend-confirm-failed code=generation_not_started` + `generation_reference_scope_changed`，同时有 `canvas-landing-skipped WorkspaceManifestLockBusyError`。
- 直接原因：`confirmRemainingShots` 逐镜 `confirmOneShot`；每镜的 `prepareAuthorization` 先取快照（项目 revision + Run revision），再 `await localize`（上传参考图）。上一镜刚 `start`：`landCanvasBestEffort`、`generation.submit` 命令、`kickSchedulerForRun`——调度器在后台往同一个 Run 写 job 状态，画布落地写项目；它们落在下一镜上传的异步窗口里，`assertCurrent` 看到 revision 前进就抛 `generation_reference_scope_changed`，`confirmRemainingShots` 在第一个失败处停下。落地因 manifest 锁忙被跳过只是同一窗口里的并发写的另一个症状。
- 类根因：快照—异步上传—断言是乐观并发，却没有「冲突就重取快照重来」，把我们自己的写入当成了用户改项目。

## 九格

| 格 | 内容 |
|---|---|
| ★1 用户怎么用 | 当我在多镜卡上点「生成剩下 N」，我想要 N 镜都被批下去。不做：不放宽 fail-closed；已知坑：第一镜开跑后后台写入必然推进 Run revision。真实任务：带 first_frame 参考的 6 镜 ComfyUI 生产 Run（线上复现形态）。 |
| ★2 谁说了算 | 授权信封快照归 `prepareAuthorization` 宿主闭包（web `web/productionRuntime.ts`、桌面 `appIntegration.ts`、`mcpStdioServer.ts`）；三者都经 `mcpGenerationTools` gate_request 一个调用点。`door-map prepareAuthorization`：该调用点是唯一的汇合处。 |
| ★3 一致与复用 | 重试助手 `retryOnReferenceScopeChange` 住在错误码的所有者 `productionReferenceUrls.ts`；不新增宿主侧分支，不留旧路径。 |
| ★4 全状态 | 成功：N 镜都批下。重试后仍冲突（3 次）：照旧 `generation_not_started` toast，卡上留下未批的镜，不花钱。素材身份真变：`generation_reference_identity_changed` 直接失败不重试。取消：× 在两镜之间生效，不变。过期/空：不涉及。 |
| 5 中途表 | 重试发生在封印之前，未签收据、未扣额度；关窗/重启/连点由 `serializeCardAction` 与 `shotAlreadyDecided` 照旧处理。 |
| 6 外部数据与失败 | 供应商上传失败仍原样失败；只重试本地快照冲突这一个码。 |
| 7 性能 | 冲突时重试复用同一次重试里已上传的参考（`AsyncLocalStorage` 作用域，只活在一次重试里，签名 URL 不跨请求复用），所以每批每镜最多上传一次；重试窗口里没有 I/O，视频渲染中 Run 进度高频写入也插不进快照与断言之间。 |
| 8 真实条件 | 2026-10-19 实测（web，ComfyUI）：图片 2 镜批量一次点击两镜都发出；视频批量在仅重试版本下第 2 镜三次全输（Wan 渲染中 Run 写入过密）→ 加入重试内上传复用后修复，单测复现「每次上传都有写入」。 |
| ★9 验收与回滚 | 验收：`npx vitest run electron/capabilityCore/productionReferenceUrls.test.ts`；上线后在真实 6 镜 Run 点「生成剩下」。回滚：revert 本修复提交。独立验收：待另一条线。 |

## 为什么在这个边界重试而不是串行化

串行化要等「上一镜的所有后台写」落定，调度器是持续运行的，没有可等的终点；重试在汇合点只依赖「冲突可检测」，覆盖三个宿主，且每次尝试都重新取快照，封出的信封始终基于最新 revision。

## 2026-10-19 追加：仅重试不够

实测视频批量：第一镜 Wan 渲染时 Run 进度写入覆盖每个上传窗口，3 次重试全部冲突。根因是窗口本身（`await localize`）；重试复用首个 attempt 的上传结果后，快照到断言之间不再有 I/O 等待。
