import { describe, expect, it, vi } from 'vitest'
import StarterKit from '@tiptap/starter-kit'
import { getSchema } from '@tiptap/core'
import { RICH_TEXT_FEATURE_EXTENSIONS } from '../creation/documentTextExtensions'
import { createDefaultWorkbenchDocument, normalizeWorkbenchContentJson } from '../workbenchTypes'
import { applyEditorDocumentContentChange, documentSessionState } from './documentSessionCore'
const content = { type: 'doc', content: [{ type: 'paragraph', content: [] }, { type: 'paragraph', content: [{ type: 'text', text: '고요한 밤, 붉은 종이등' }] }] }
const current = () => ({ ...createDefaultWorkbenchDocument(), contentJson: normalizeWorkbenchContentJson(content), updatedAt: 1000 })
describe('canonical editor content writes', () => {
  it('does not mint a revision when the real Tiptap schema omits empty content arrays', () => {
    const document = current(), clock = vi.fn(() => 2000)
    const emitted = getSchema([StarterKit, ...RICH_TEXT_FEATURE_EXTENSIONS]).nodeFromJSON(document.contentJson).toJSON()
    expect(emitted).not.toEqual(document.contentJson)
    expect(normalizeWorkbenchContentJson(emitted)).toEqual(document.contentJson)
    const next = applyEditorDocumentContentChange(document, emitted, clock)
    expect(next).toBe(document)
    expect(clock).not.toHaveBeenCalled()
    expect(documentSessionState(next)).toEqual(documentSessionState(document))
  })
  it.each(['bold', 'heading'])('advances source revision for a real %s edit even if plaintext hash stays equal', formatting => {
    const document = current(), changed = structuredClone(content)
    const row = changed.content[1] as Record<string, unknown>
    if (formatting === 'bold') row.content = [{ type: 'text', text: '고요한 밤, 붉은 종이등', marks: [{ type: 'bold' }] }]
    else { row.type = 'heading'; row.attrs = { level: 2 } }
    const next = applyEditorDocumentContentChange(document, changed, () => 2000)
    expect(next.updatedAt).toBe(2000)
    expect(next.contentJson).toBe(changed)
    expect(documentSessionState(next).contentHash).toBe(documentSessionState(document).contentHash)
    expect(documentSessionState(next).revision).not.toBe(documentSessionState(document).revision)
  })
})

const schema = () => getSchema([StarterKit, ...RICH_TEXT_FEATURE_EXTENSIONS])
const richDocument = (contentJson: unknown) => ({ ...current(), contentJson })
it.each(['colspan', 'rowspan', 'colwidth'])('preserves a real TableKit %s edit and advances its revision', attribute => {
  const cell = { type: 'tableCell', attrs: { colspan: 1, rowspan: 1, colwidth: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cell' }] }] }
  const original = schema().nodeFromJSON({ type: 'doc', content: [{ type: 'table', content: [{ type: 'tableRow', content: [cell] }] }] }).toJSON()
  const changed = structuredClone(original)
  changed.content![0].content![0].content![0].attrs![attribute] = attribute === 'colwidth' ? [240] : 2
  const emitted = schema().nodeFromJSON(changed).toJSON()
  const document = richDocument(original)
  const next = applyEditorDocumentContentChange(document, emitted, () => 2000)
  expect(next).not.toBe(document)
  expect(next.updatedAt).toBe(2000)
  expect(next.contentJson).toBe(emitted)
})
it.each(['orderedList', 'codeBlock'])('preserves real %s attributes with unchanged text', type => {
  const original = schema().nodeFromJSON({ type: 'doc', content: [type === 'orderedList'
    ? { type, attrs: { start: 1 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same' }] }] }] }
    : { type, attrs: { language: 'python' }, content: [{ type: 'text', text: 'Same' }] }] }).toJSON()
  const changed = structuredClone(original)
  changed.content![0].attrs![type === 'orderedList' ? 'start' : 'language'] = type === 'orderedList' ? 4 : 'typescript'
  const emitted = schema().nodeFromJSON(changed).toJSON()
  const next = applyEditorDocumentContentChange(richDocument(original), emitted, () => 2000)
  expect(next.updatedAt).toBe(2000)
  expect(next.contentJson).toBe(emitted)
})
it('preserves non-whitelisted supported mark attributes', () => {
  const original = schema().nodeFromJSON({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same' }] }] }).toJSON()
  const changed = structuredClone(original)
  changed.content![0].content![0].marks = [{ type: 'link', attrs: { href: 'https://example.com/reference', target: '_blank', rel: 'noopener' } }]
  const emitted = schema().nodeFromJSON(changed).toJSON()
  const next = applyEditorDocumentContentChange(richDocument(original), emitted, () => 2000)
  expect(next.updatedAt).toBe(2000)
  expect(next.contentJson).toBe(emitted)
})

it('does not remove an empty content attribute or mark metadata while comparing node child arrays', () => {
  const document = richDocument({ type: 'doc', content: [{ type: 'paragraph', attrs: { content: ['annotation'] }, content: [] }] })
  const emitted = { type: 'doc', content: [{ type: 'paragraph', attrs: { content: [] } }] }
  const next = applyEditorDocumentContentChange(document, emitted, () => 2000)
  expect(next.updatedAt).toBe(2000)
  expect(next.contentJson).toBe(emitted)
})
