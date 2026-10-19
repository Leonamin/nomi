// 浏览器 UX 测试经 `/tailwind.generated.css` 取样式，而它是构建产物（gitignored）：gates 先跑测试后 build，
// 新 worktree / 干净 checkout 里文件不存在，版式塌掉、指针选区落空（2026-10-19 text-document-generation-ownership）。
// 旧 worktree 靠上次 build 留下的旧文件才绿——这里每次运行前生成一次（约 3s），不靠残留。
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  execFileSync(process.execPath, [fileURLToPath(new URL("../../scripts/build-tailwind.mjs", import.meta.url))], { stdio: ["ignore", "ignore", "inherit"] });
}
