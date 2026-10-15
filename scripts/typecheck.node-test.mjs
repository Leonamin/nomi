// typecheck 编排器的判据测试：五份检查一份都不许悄悄少；任何一份红整体红；并发且不早退。
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { TYPECHECK_JOBS, runTypecheckJobs } from './typecheck.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('五份检查一份都不少：app / web / electron / electron-pi 四份生产 tsc，加 check:test-types', () => {
  const tsc = TYPECHECK_JOBS.filter((job) => job.kind === 'tsc').map((job) => job.args.join(' '))
  assert.deepEqual(tsc, ['-p tsconfig.app.json', '-p tsconfig.web.json', '-p electron/tsconfig.json', '-p electron/tsconfig.pi.json --noEmit'])
  const scripts = TYPECHECK_JOBS.filter((job) => job.kind === 'script').map((job) => job.script)
  assert.deepEqual(scripts, ['scripts/check-test-types.mjs'])
  for (const job of TYPECHECK_JOBS) {
    if (job.script) assert.ok(fs.existsSync(path.join(repoRoot, job.script)), `${job.script} 不存在`)
  }
})

test('package.json：typecheck 走编排器；gates:contracts 里 typecheck 在、check:test-types 不再单列（由 typecheck 带起）', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))
  assert.equal(pkg.scripts.typecheck, 'node ./scripts/typecheck.mjs')
  assert.match(pkg.scripts['check:test-types'], /check-test-types\.mjs/)
  const gates = pkg.scripts['gates:contracts'].split(/\s+/)
  assert.ok(gates.includes('typecheck'))
  assert.ok(!gates.includes('check:test-types'), 'check:test-types 已并入 typecheck，不许同时再跑一遍')
})

test('并发而不早退：先红的不阻止后面的跑完；任何一份红整体红，汇总点名', async () => {
  const started = []
  const run = async (job) => {
    started.push(job.name)
    await new Promise((resolve) => setTimeout(resolve, job.name === 'tsc app' ? 30 : 5))
    return { name: job.name, code: job.name === 'tsc electron' ? 2 : 0, output: '', ms: job.name === 'tsc app' ? 30 : 5 }
  }
  const outcome = await runTypecheckJobs(TYPECHECK_JOBS, { run })
  assert.equal(started.length, TYPECHECK_JOBS.length, '五份都得启动，不因某一份红而不跑')
  assert.deepEqual(outcome.failed.map((result) => result.name), ['tsc electron'])
  assert.equal(outcome.results.length, TYPECHECK_JOBS.length)
  // 并发：墙钟接近最慢那份，而不是总和
  assert.ok(outcome.wallMs < outcome.sumMs, `并发应该比串行快：wall ${outcome.wallMs} vs sum ${outcome.sumMs}`)
})

test('Web 程序报错时根 typecheck 失败，其他程序仍执行', async () => {
  const jobsRun = []
  const outcome = await runTypecheckJobs(TYPECHECK_JOBS, { run: async (job) => {
    jobsRun.push(job.name)
    return { name: job.name, code: job.name === 'tsc web' ? 2 : 0, output: '', ms: 1 }
  } })
  assert.deepEqual(jobsRun, TYPECHECK_JOBS.map((job) => job.name))
  assert.deepEqual(outcome.failed.map((result) => result.name), ['tsc web'])
})

test('没跑起来也算红（失败方向只有一个）', async () => {
  const outcome = await runTypecheckJobs(TYPECHECK_JOBS.slice(0, 1), { run: async (job) => ({ name: job.name, code: 1, output: 'spawn failed', ms: 1 }) })
  assert.equal(outcome.failed.length, 1)
})
