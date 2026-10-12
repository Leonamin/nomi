// Approved copy sample contract. Actual app evidence is recorded separately in docs/qa.
import { chromium } from '@playwright/test'
import { expectVisible, expectText, clickOrFail } from './_assert.mjs'
import { assertMockupContract } from './_contract.mjs'
import projectContract, { settingsContract, guideContract } from '../../docs/design/mockups/contracts/2026-10-12-korean-guidance.intent.mjs'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.goto(process.env.NOMI_KOREAN_SAMPLE_URL || 'http://127.0.0.1:9133/docs/design/mockups/2026-10-12-korean-guidance/index.html')
  await assertMockupContract(page, projectContract)
  await page.evaluate(() => window.openPanel('settings'))
  await assertMockupContract(page, settingsContract)
  await expectVisible(page.getByRole('group', { name: '언어 선택' }), '세 언어 선택 영역')
  await clickOrFail(page.getByRole('button', { name: 'English', exact: true }), 'English 언어 선택')
  await expectText(page.locator('#language-note'), 'English 선택 예시입니다. 실제 앱에는 아직 적용되지 않았습니다.', '선택한 언어 피드백')
  await page.evaluate(() => document.querySelector('#panel').close())
  await page.evaluate(() => window.openPanel('guide'))
  await assertMockupContract(page, guideContract)
  await expectText(page.locator('#panel-title'), '첫 영상 만들기', '학생용 도움말 제목')
  console.log('Approved Korean copy sample: 16 relationships passed.')
} finally {
  await browser.close()
}
