// Approved copy sample contract. Actual app evidence is recorded separately in docs/qa.
import { chromium } from '@playwright/test'
import { assertMockupContract } from './_contract.mjs'
import projectContract, { settingsContract, guideContract } from '../../docs/design/mockups/contracts/2026-10-12-korean-guidance.intent.mjs'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(process.env.NOMI_KOREAN_SAMPLE_URL || 'http://127.0.0.1:9133/docs/design/mockups/2026-10-12-korean-guidance/index.html')
  await assertMockupContract(page, projectContract)
  await page.evaluate(() => window.openPanel('settings'))
  await assertMockupContract(page, settingsContract)
  await page.evaluate(() => document.querySelector('#panel').close())
  await page.evaluate(() => window.openPanel('guide'))
  await assertMockupContract(page, guideContract)
  console.log('Approved Korean copy sample: 16 relationships passed.')
} finally {
  await browser.close()
}
