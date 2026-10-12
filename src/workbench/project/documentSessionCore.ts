import StarterKit from '@tiptap/starter-kit'
import { generateText, type JSONContent } from '@tiptap/core'
import type { DocumentAnchorRef, PreconditionSet, TargetRef } from '../../../electron/shared/capabilityTargeting'
import { SurfacePortWireError } from '../../../electron/shared/surfacePortBinding'
import { RICH_TEXT_FEATURE_EXTENSIONS } from '../creation/documentTextExtensions'
import { markdownToTiptapContent } from '../creation/markdownToTiptap'
import { documentContentHash } from '../creation/documentWriteTarget'
import { normalizeWorkbenchContentJson, type WorkbenchDocument } from '../workbenchTypes'

export type DocumentWriteOperation = 'insert' | 'replace' | 'append'

export type DocumentSessionState = Readonly<{ revision: number; contentHash: string; anchor: DocumentAnchorRef }>

export type DocumentSessionWriteInput = Readonly<{
  operation: DocumentWriteOperation
  content: string
  target: TargetRef
  preconditions: PreconditionSet
}>

export type DocumentSessionWriteResult = Readonly<{ applied: true; revision: number; contentHash: string }>

export const WHOLE_DOCUMENT_ANCHOR: DocumentAnchorRef = Object.freeze({ kind: 'whole-document' as const })

// 和 `useNomiRichTextEditor` 里创作编辑器的 schema 一致（Placeholder / 持久选区不改 schema）。
const DOCUMENT_TEXT_EXTENSIONS = [StarterKit, ...RICH_TEXT_FEATURE_EXTENSIONS]

/** 文档正文的唯一派生：和 `editor.getText({ blockSeparator: '\n' }).trim()` 逐字相同。 */
export function workbenchDocumentPlainText(document: Pick<WorkbenchDocument, 'contentJson'> | null | undefined): string {
  const content = normalizeWorkbenchContentJson(document?.contentJson) as JSONContent
  return generateText(content, DOCUMENT_TEXT_EXTENSIONS, { blockSeparator: '\n' }).trim()
}

export function documentSessionState(document: WorkbenchDocument, anchor: DocumentAnchorRef = WHOLE_DOCUMENT_ANCHOR): DocumentSessionState {
  return Object.freeze({ revision: document.updatedAt, contentHash: documentContentHash(workbenchDocumentPlainText(document)), anchor })
}

function unsupported(): never {
  throw new SurfacePortWireError('capability_unsupported')
}

export function applyWholeDocumentWrite(
  document: WorkbenchDocument,
  operation: DocumentWriteOperation,
  content: string,
): WorkbenchDocument {
  if (operation === 'insert') unsupported()
  const nodes = markdownToTiptapContent(content)
  if (!nodes.length) throw new SurfacePortWireError('capability_input_invalid')
  const current = normalizeWorkbenchContentJson(document.contentJson) as { type: 'doc'; content?: unknown[] }
  const contentJson = operation === 'append'
    ? { ...current, content: [...(Array.isArray(current.content) ? current.content : []), ...nodes] }
    : { ...current, content: nodes }
  return { ...document, contentJson, updatedAt: Date.now() }
}
