import fs from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

function brandControl(file: string) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let control: ts.JsxElement | undefined
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'NomiBrand' && ts.isJsxElement(node.parent)) control = node.parent
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (!control) throw new Error('Header brand is missing')
  return { tag: control.openingElement.tagName.getText(source), attributes: control.openingElement.attributes.getText(source) }
}

describe('project home navigation in both header layouts', () => {
  for (const file of ['src/ui/app-shell/NomiAppBar.tsx', 'src/workbench/WorkbenchShell.tsx']) {
    it(`${file} exposes the brand as an accessible button using the project leave owner`, () => {
      const control = brandControl(file)
      expect(control.tag).toBe('WorkbenchButton')
      expect(control.attributes).toContain('onClick={onBackToLibrary}')
      expect(control.attributes).toMatch(/aria-label=\{t\(["']appBar.backToLibrary["']\)\}/)
      expect(control.attributes).toContain('select-none')
    })
  }
})
