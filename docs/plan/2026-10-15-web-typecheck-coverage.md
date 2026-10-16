# Web 类型检查覆盖与合并后修复

> 📎 참고 기록 · 현재 fork의 미완료 작업을 뜻하지 않습니다. 구현·검증·배포 범위는 본문과 해당 PR에서 확인합니다.


改动名：Web 类型检查覆盖与合并后错误修复　线/负责人：sol_implementation　类别：[其他]

| 格 | 结论 | 证据 |
|---|---|---|
| ★1 用户怎么用 | 用户在 Web 打开已有项目，生成媒体应能显示；开发者在 PR 合并前运行 gates，Web 源码类型错误必须拦住。真实任务：① 已有生成图片项目打开并看卡片；② 已有生成视频项目播放；③ 文件拖入画布。此次不改这些任务的功能，只恢复其构建保证。 | PR #29 浏览器报告 `docs/qa/2026-10-15-web-platform-media-browser.md`；合并后 `pnpm exec tsc -p tsconfig.web.json --noEmit` 红灯 |
| ★2 谁说了算 | 类型检查作业名单由 `scripts/typecheck.mjs:TYPECHECK_JOBS` 唯一拥有；Web 可用能力由 `web/hostCapabilities.ts:projectWebHostCapabilities` 拥有。 `web/client.ts` 只调用能力投影，不再重复删除 videoDepth。 | `node scripts/door-map.mjs TYPECHECK_JOBS --roots=scripts,web`；`node scripts/door-map.mjs projectWebHostCapabilities --roots=web,src,electron` |
| ★3 一致与复用 | 复用现有并发 typecheck 编排器，加入已有 `tsconfig.web.json`；现有名单棘轮测试同时锁住 Web。删除 client 中已由投影负责的重复路径。 | `scripts/typecheck.mjs`；`scripts/typecheck.node-test.mjs` |
| ★4 全状态 | 检查成功则 gates 继续；Web 类型错误、编译器启动失败均使 typecheck/gates 红；并发其他检查仍跑完。无需 UI 文案或视觉变化。 | `node --test scripts/typecheck.node-test.mjs`；`pnpm run typecheck` |
| ★9 验收与回滚 | 红灯样本为合并 SHA `c69d20d5f7a1ffd837e73aca4755c688fc133eec` 上两条 TS 错误；修后显式 Web tsc、typecheck、Web 测试/构建、完整 gates 在最终提交上通过。另一条线静态复核报告 PR 中链接；异常时 revert 本次修复提交。 | `/tmp/nomi-web-types-red.log`；最终验证日志；独立报告 |

根因：Web `tsconfig.web.json` 只在独立 Web workflow 使用，根 gates 的 typecheck 编排器漏列它；前次提交只跑了 Web 测试/构建与 gates，未显式运行 Web tsc，因此误报完整 Web 验证。直接错误是必需属性的 `delete` 和无类型注解的递归推断局部变量。
