# 交付与评审（L2）：push 前分层 · 交付身份 · 合并前检查

> 从 CLAUDE.md 搬来（规则体系瘦身）。**用到时怎么保证看到**：`self-check.sh` 在用户消息含「合并 / merge / 收据 / verify-merged / preflight / 开 PR / 交工 / 推送」时注入【交付】块（带合并规矩要点与本文件指针）；CLAUDE.md 的「常用命令」一节也直接指向本文件；push 时 pre-push 闸门自己拦没过的。
> 详解在 `docs/engineering-rules.md` 的 R11 / R22；编排侧见 `docs/engineering/agent-orchestration-playbook.md` §19。

## Push 前按风险面分层（R22）

contracts 始终跑（一次跑完全部门岗再汇总，不再第一个红就停；`check:concept-owners` 只出 warning 不阻断；`check:docs-index` / `check:doc-status` / `check:ledger` 已移出 PR 的 Contracts——合入 main 后由 `docs-autosync` workflow 自动补齐回写；档案默认值生成物由 `archetype-autosync` 工作流自动重生成；`check:root-cause-contracts` 只对 schema 不合法阻断）；unit 独立选 focused/full（**本机 `pnpm run gates` 也按同一份 `scripts/validation-policy.mjs` 分档**，全量一万两千多个测试交给 CI 并行机器，不再占着全机那把 gates 锁；想本机兜底跑全量用 `pnpm run gates:full`）；Electron、真实旅程、React Flow 画布、性能和 macOS package 各按受影响路径独立触发，`main` push 也按真实 `before..after` 分类，不因事件名自动全量。删除/重命名、空 diff、测试/CI 分类器自身和手动发布边界 fail-closed 到全维度。连续小修先在本地收敛，再一次性验证和 push，不让每个微提交反复触发全套 CI。

## 交付身份只走统一命令（R11）

任务开始先跑 `delivery:preflight`；正常路径 PR 合并后**立即**在 Git fetch 得到的真实 merge SHA 上跑 `delivery:verify-merged`：非纯文档的 merge 必须看到该 SHA 上 `Core Flow Smoke (empty)` / `(used)` 都是 success 才发收据（skipped / 缺席一律拒绝）。**合并规矩（只由协调会话合并）**：本地 CI 必须通过，GitHub CI 通过且扫描干净就合；GitHub CI 仅可按下述用户明确授权豁免；**最多 3 个合并在等收据**（`quality-gate.yml` 按 SHA 分组，每个合并提交各跑一套），任何一个收据红了**立刻停止再合**，交人定修还是回滚（冒烟红了不自动回滚）。任务 commit、PR head、merge commit 与 tree 分开报告；禁止用 REST compare 文件列表重建 Git tree/commit，禁止把 `same-tree-different-commit` 叫成代码不匹配。

## 用户明确授权的 GitHub CI 例外（2026-10-15）

- **本地 CI 始终必需，不能豁免。** 按真实改动风险运行 `pnpm run gates`，以及受影响平台/产品的必要检查；网页改动还需 web 类型检查、`test:web`、`build:web`。失败必须修复，缺少真实环境如实标记 `unverified`。
- 默认仍须 GitHub CI 成功才合并。只有用户明确允许时，可在授权范围内忽略 GitHub CI 缺席/不可用/未通过这一远端条件；不得自行把授权扩大到其他 PR，也不得把它当成本地检查失败的豁免。
- PR 必须记录用户授权、适用 PR/提交、原因、本地命令与结果、未验证范围。授权不是允许修改仓库 Actions 权限、削弱分支保护或伪造绿色 check。
- 合并后仍从 Git fetch 核对真实 main/HEAD/merge SHA 和 tree。正常路径继续使用 `delivery:verify-merged`；该命令要求远端 check，不因文档例外伪造结果。
- 授权例外改用明确标为 `local-ci-user-authorized` 的本地验收记录：记录用户授权、PR、merge SHA/tree、匹配关系、运行过的命令/退出码与原测试 SHA/tree、部署 SHA/health、真实任务结果和未验证项。实现 tree 未变时可复用同 tree 的已通过测试，但须证明 tree；文档变化仅可复用排除文档后的实现内容完全相同的测试，另跑文档同步和相关规则检查。必要产品检查在真实 merge 上重新运行。
- 本地验收与部署结果通过后可报告完成，但必须说明 GitHub CI 未验证和用户授权例外；本地记录不能冒充 `delivery:verify-merged` 的 GitHub 回执。若本地检查或部署验证失败，停止并修复，不沿用远端豁免绕过。

## 合并前检查：设计卡 + 独立验收（取代旧的交工前评审，R24 由 PR #223 保留）

2026-10-02 起，原来的交工前评审（适配器、收据、延后账本、`review:branch`、PR 正文评审小节）整套删除，用两个暂停点代替：

- **暂停点①设计卡**：碰花钱 / 长跑 / 可打断 / 新界面，动手前写一页卡（`docs/engineering/design-card.md`），PR 正文 `## 设计卡` 放链接或全文；其余改动只填 ★ 格。
- **暂停点②独立验收**：四类改动合并前由另一条线验收，PR 正文 `## 独立验收` 带报告链接和验收线编号，编号不得与实现线相同。
- **协调会话合并前跑** `node scripts/merge-preflight.mjs <PR 号>`：按路径判是否四类、查卡格是否填全、查独立验收、修逃逸 bug 时查带 `detected_by` 的根因合同。脚本只打印结论，不合并。
