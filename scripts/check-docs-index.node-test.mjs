import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { scanDocumentIndex } from './docs-index-lib.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const planIndexPath = path.join(repoRoot, 'docs', 'plan', 'INDEX.md')
const planFilePath = path.join(repoRoot, 'docs', 'plan', '2026-09-04-cross-device-min-energy-redesign.md')
const planPath = '2026-09-04-cross-device-min-energy-redesign.md'

test('indexes the cross-device minimum-energy redesign plan', () => {
  const index = fs.readFileSync(planIndexPath, 'utf8')
  assert.ok(index.includes(`](${planPath})`), `docs/plan/INDEX.md must link ${planPath}`)
})

test('marks the cross-device minimum-energy redesign plan with a status', () => {
  const opening = fs.readFileSync(planFilePath, 'utf8').split(/\r?\n/).slice(0, 12).join('\n')
  assert.match(opening, /✅|🚧|⏳|🧊|📋|⛔|📎/, `${planPath} must declare a status in its opening 12 lines`)
})

function wikiFixture(t, wikiPath = 'knowledge') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-wiki-index-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const write = (file, body) => {
    const target = path.join(root, file)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, body)
  }
  write('.agents/wiki-path', `./${wikiPath}\n`)
  write(`${wikiPath}/index.md`, '[Concepts](concepts/index.md)\n')
  write(`${wikiPath}/concepts/index.md`, '[Domain](domain.md)\n[Deep](deep/index.md)\n')
  write(`${wikiPath}/concepts/domain.md`, '# Domain\n')
  write(`${wikiPath}/concepts/deep/index.md`, '[State](state.md)\n')
  write(`${wikiPath}/concepts/deep/state.md`, '# State\n')
  return { root, write }
}

test('wiki location comes from project config and indexes direct children at every depth', (t) => {
  const { root } = wikiFixture(t)
  const scan = scanDocumentIndex(root)
  assert.equal(scan.documents.length, 4)
  assert.deepEqual(scan.unindexed, [])
})

test('a global link cannot conceal a missing local wiki index entry', (t) => {
  const { root, write } = wikiFixture(t)
  write('knowledge/concepts/deep/index.md', '# Empty index\n')
  write('docs/README.md', '[State](../knowledge/concepts/deep/state.md)\n')
  assert.deepEqual(scanDocumentIndex(root).unindexed, ['knowledge/concepts/deep/state.md'])
})

test('subdirectory indexes must be linked by their immediate parent', (t) => {
  const { root, write } = wikiFixture(t)
  write('knowledge/concepts/index.md', '[Domain](domain.md)\n')
  assert.deepEqual(scanDocumentIndex(root).unindexed, ['knowledge/concepts/deep/index.md'])
})

test('missing wiki root or invalid config fails visibly; legacy repos need no wiki', (t) => {
  const { root, write } = wikiFixture(t)
  for (const value of ['', '..', './absent', './knowledge\n./other']) {
    write('.agents/wiki-path', value)
    assert.throws(() => scanDocumentIndex(root), /wiki-path/)
  }
  fs.rmSync(path.join(root, '.agents/wiki-path'))
  assert.deepEqual(scanDocumentIndex(root).documents, [])
})
