// 真实项目模板的执行层（走查用）。走查要一个**完整合法的** project.json 才能 hydrate 进画布，
// 而模板来自跑测者本机的一个真实项目（含完整 payload），不进仓库。路径走 env NOMI_WALK_PROJECT。
//
// 为什么不回退到写死的路径：同 fixtures/realMedia.mjs——登记/默认路径是给人看的提示，
// 不是给脚本兜底的第二真相源。兜底一旦存在，「没配 env」就会静默变成「跑了别的东西」。
// 缺了直接抛，消息里给出补法，让走查红得可诊断，而不是 ENOENT 或假绿。
import fs from 'node:fs'

export function resolveWalkProjectTemplate({ env = process.env } = {}) {
  const file = env.NOMI_WALK_PROJECT
  if (!file || file.trim() === '') {
    throw new Error(
      '真实项目模板缺失：环境变量 NOMI_WALK_PROJECT 未设置。\n' +
        '  指向一个真实 Nomi 项目的 project.json（含完整 payload），例如：\n' +
        '  export NOMI_WALK_PROJECT="$HOME/Documents/Nomi Projects/<项目>/.nomi/project.json"',
    )
  }
  if (!fs.existsSync(file)) throw new Error(`真实项目模板不存在：NOMI_WALK_PROJECT=${file}`)
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
