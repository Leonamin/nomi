import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const hook = path.join(repoRoot, 'scripts/check-progress-update.cjs')
const plan = 'docs/archive/plan/2026-05-25-phase-e2-completion-and-tech-uplift.md'

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nomi-progress-plan-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' })
  git('init', '--quiet')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.invalid')
  const file = path.join(root, plan)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '| E.2C-01 | ⏸ |\n| E.2C-02 | ⏸ |\n')
  git('add', plan)
  git('commit', '--quiet', '-m', 'test(fixture): seed progress plan')
  return { root, file, git }
}

test('tagged commits read the canonical archived plan for different task IDs', (t) => {
  assert.ok(fs.existsSync(path.join(repoRoot, plan)), 'the real canonical source must exist')
  const { root, file, git } = fixture(t)
  fs.writeFileSync(file, '| E.2C-01 | ✓ |\n| E.2C-02 | ✓ |\n')
  git('add', plan)
  for (const id of ['E.2C-01', 'E.2C-02']) {
    const message = path.join(root, 'message')
    fs.writeFileSync(message, `chore(progress): finish [${id}]\n`)
    const result = spawnSync(process.execPath, [hook, message], { cwd: root, encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
  }
})

test('another task row or an unstaged completion cannot satisfy the gate', (t) => {
  const { root, file, git } = fixture(t)
  fs.writeFileSync(file, '| E.2C-01 | ✓ |\n| E.2C-02 | ⏸ |\n')
  git('add', plan)
  fs.writeFileSync(file, '| E.2C-01 | ✓ |\n| E.2C-02 | ✓ |\n')
  const message = path.join(root, 'message')
  fs.writeFileSync(message, 'chore(progress): finish [E.2C-02]\n')
  const result = spawnSync(process.execPath, [hook, message], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /does not mark it/)
})
