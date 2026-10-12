import { markInputRule, markPasteRule, type AnyExtension } from '@tiptap/core'
import { Highlight } from '@tiptap/extension-highlight'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'

// ==高亮== 输入/粘贴规则：Tiptap 默认规则要求 `==` 前是行首或空白，中文「这是==重点==」
// 无空格场景会失效；这里放宽为任意位置触发，对齐 ColaMD 的 `/==([^=]+)==/`。
const HighlightWithZh = Highlight.extend({
  addInputRules() {
    return [markInputRule({ find: /==([^=]+)==$/, type: this.type })]
  },
  addPasteRules() {
    return [markPasteRule({ find: /==([^=]+)==/g, type: this.type })]
  },
})

// 创作编辑器的富文本特性扩展（模块级稳定引用，避免 editor 反复重建）。
// 画布文字节点（TextDocumentNode）复用同一内核但不挂这些——它保持基础能力，行为零回归。
export const RICH_TEXT_FEATURE_EXTENSIONS: AnyExtension[] = [
  HighlightWithZh,
  TaskList,
  TaskItem,
  TableKit,
]
