// Real Chromium, original TextDocumentNode/ProseMirror and generation action; controlled supplier/storage, not Electron acceptance.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { chromium } from 'playwright'
import { expect as browserExpect } from '@playwright/test'
import { createServer } from 'vite'
import { stationTimeout } from './_station-budget.mjs'

let server, browser, cacheDir
beforeAll(async () => {
  cacheDir = mkdtempSync(path.join(tmpdir(), 'nomi-text-ownership-vite-'))
  server = await createServer({ configFile: false, cacheDir, server: { host: '127.0.0.1', port: 0, hmr: false, watch: null } })
  await server.listen()
  browser = await chromium.launch({ headless: true })
})
afterAll(async () => {
  await browser?.close()
  await server?.close()
  if (cacheDir) rmSync(cacheDir, { recursive: true, force: true })
})

test('selection rewrite persists its actual result body, reopens without replay, and rejects later manual edits', async () => {
  const page = await browser.newPage()
  page.setDefaultTimeout(stationTimeout({ operations: 1 }))
  try {
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/tests/ux/fixtures/text-document-generation-ownership.html`)
    await page.addStyleTag({ url: '/tailwind.generated.css' })
    const editor = page.locator('.ProseMirror')
    await browserExpect(editor).toBeVisible()
    await browserExpect(editor).toHaveText('Keep OLD tail')
    // Select the actual phrase by a native pointer gesture. The subject is ownership
    // of a real editor selection, not platform-specific select-all/arrow commands.
    const endpoints = await editor.evaluate((element) => {
      const text = element.querySelector('p').firstChild
      const start = document.createRange()
      start.setStart(text, 5)
      start.collapse(true)
      const end = document.createRange()
      end.setStart(text, 8)
      end.collapse(true)
      const from = start.getBoundingClientRect()
      const to = end.getBoundingClientRect()
      return { from: { x: from.x, y: from.y + from.height / 2 }, to: { x: to.x, y: to.y + to.height / 2 } }
    })
    await page.mouse.move(endpoints.from.x, endpoints.from.y)
    await page.mouse.down()
    await page.mouse.move(endpoints.to.x, endpoints.to.y, { steps: 6 })
    await page.mouse.up()
    await browserExpect(editor).toBeFocused()
    await browserExpect.poll(() => page.evaluate(() => ({
      native: window.getSelection()?.toString(),
      stored: window.textOwnership.snapshot().selection,
    }))).toEqual({ native: 'OLD', stored: 'OLD' })
    await page.evaluate(() => window.textOwnership.prepare())
    await page.evaluate(() => window.textOwnership.generate())
    await browserExpect.poll(() => page.evaluate(() => window.textOwnership.snapshot().pending)).toBe(null)
    const generated = await page.evaluate(() => ({ ...window.textOwnership.snapshot(), validation: window.textOwnership.validate() }))
    expect(generated.text).toBe('Keep\nNEW\ntail')
    expect(generated.validation).toEqual({ accepted: true })
    expect(generated.appliedRun.resultId).toBe(generated.result.id)
    expect(generated.appliedRun.textDocumentDigest).toMatch(/^sha256-[a-f0-9]{64}$/)
    expect(generated.persistRevision).toBeGreaterThan(generated.beforeApplyRevision)

    await page.evaluate(() => window.textOwnership.reopen())
    await browserExpect(editor).toHaveText('Keep NEW tail')
    const reopened = await page.evaluate(() => ({ ...window.textOwnership.snapshot(), validation: window.textOwnership.validate() }))
    expect(reopened.text).toBe(generated.text)
    expect(reopened.appliedRun.textDocumentDigest).toBe(generated.appliedRun.textDocumentDigest)
    expect(reopened.validation).toEqual({ accepted: true })

    await editor.click()
    await page.keyboard.type(' MANUAL')
    const edited = await page.evaluate(() => ({ ...window.textOwnership.snapshot(), validation: window.textOwnership.validate() }))
    expect(edited.text).toContain('MANUAL')
    expect(edited.appliedRun.textDocumentDigest).toBe(generated.appliedRun.textDocumentDigest)
    expect(edited.validation.accepted).toBe(false)
  } finally { await page.close() }
})
