import { chromium } from 'playwright'
import type { Browser, Page } from 'playwright'
import { installComfyGraphWindowFactory } from '../electron/comfyuiGraphConvert'

/** Run ComfyUI's own converter in an isolated browser, without Electron/preload or desktop data. */
export function installWebGraphHost() {
  installComfyGraphWindowFactory(base => {
    let isDestroyed = false
    let browser: Browser | undefined
    const page: Promise<Page> = (async () => {
      browser = await chromium.launch({ headless: true, ...(process.env.NOMI_WEB_CHROMIUM_PATH ? { executablePath: process.env.NOMI_WEB_CHROMIUM_PATH } : {}), chromiumSandbox: true })
      if (isDestroyed) { await browser.close(); throw new Error('ComfyUI converter closed') }
      const context = await browser.newContext()
      const current = await context.newPage()
      current.on('dialog', dialog => void dialog.dismiss())
      await current.goto(`${base}/`, { waitUntil: 'domcontentloaded', timeout: 40_000 })
      await current.waitForFunction(() => {
        const host = window as unknown as { app?: { graphToPrompt?: unknown; loadGraphData?: unknown } }
        return Boolean(host.app?.graphToPrompt && host.app.loadGraphData)
      }, null, { timeout: 40_000 })
      return current
    })()
    return {
      win: {
        isDestroyed: () => isDestroyed,
        destroy: () => { isDestroyed = true; void browser?.close() },
        webContents: { executeJavaScript: async source => {
          if (isDestroyed) throw new Error('ComfyUI converter closed')
          return (await page).evaluate(source)
        } },
      },
      ready: page.then(() => true, () => false),
    }
  })
}
