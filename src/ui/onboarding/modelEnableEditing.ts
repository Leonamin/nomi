/**
 * 中转站模型「勾选启用/停用」编辑的纯逻辑（从 ModelEnableEditor.tsx 抽出以便 node 单测）。
 * 见 docs/archive/plan/2026-07-04-relay-model-enable-editing.md。
 */
import type { ChipModel } from './ModelChipGroups'

/** 大小写无关的子串匹配 labelZh + modelKey（空串 = 全部）。 */
export function filterModelsByQuery(models: ChipModel[], query: string): ChipModel[] {
  const q = query.trim().toLowerCase()
  if (!q) return models
  return models.filter(
    (m) => m.labelZh.toLowerCase().includes(q) || m.modelKey.toLowerCase().includes(q),
  )
}

/** 已启用计数。 */
export function enabledCount(models: ChipModel[]): number {
  return models.reduce((n, m) => (m.enabled ? n + 1 : n), 0)
}

/** 批量操作实际会翻转的行：全选 → 当前可见里未启用的；全不选 → 当前可见里已启用的（已是目标态的不重复写库）。 */
export function bulkToggleTargets(visible: ChipModel[], enable: boolean): ChipModel[] {
  return visible.filter((m) => m.enabled !== enable)
}

/** 稳定行键：vendorKey + modelKey（跨渲染标识一行，供多选/批量删除）。用 \0 分隔避免 a-b|c 与 a|b-c 碰撞。 */
export function modelRowKey(model: Pick<ChipModel, 'vendorKey' | 'modelKey'>): string {
  return `${model.vendorKey}\0${model.modelKey}`
}

/** 从选中键集合还原出仍存在的模型行（保序；已被删/被搜索过滤掉的键自动忽略——刷新后 selected 里的陈旧键不会误伤）。 */
export function selectedModelRows(models: ChipModel[], selectedKeys: ReadonlySet<string>): ChipModel[] {
  if (selectedKeys.size === 0) return []
  return models.filter((m) => selectedKeys.has(modelRowKey(m)))
}
