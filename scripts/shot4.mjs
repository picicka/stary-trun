// Ověření: výběr scénáře a start v souostroví.
import { chromium } from 'playwright'
const url = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning)
await page.waitForTimeout(400)
await page.click('[data-a="m-new"]')
await page.click('[data-a="m-scen"][data-v="islands"]')
await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/s_scen.png' })
await page.click('[data-a="m-next"]')
await page.click('[data-a="m-nation"][data-v="thal"]')
await page.waitForTimeout(300)
await page.screenshot({ path: 'shots/s_setup.png' })
const fits = await page.evaluate(() => { const m = document.getElementById('menu'); return { scrollH: m.scrollHeight, clientH: m.clientHeight, start: document.querySelector('[data-a="m-start"]').getBoundingClientRect().bottom } })
await page.click('[data-a="m-start"]'); await page.waitForTimeout(700)
const brief = await page.$eval('#modal h2', e => e.textContent)
await page.click('[data-a="close"]')
await page.click('[data-a="zoom"][data-v="-1"]'); await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/s_islands.png' })
const st = await page.evaluate(() => { const s = window.app.state; return { scenario: s.scenario, techs: s.players[0].techs } })
for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(1500) }
console.log(JSON.stringify({ fits, brief, st, turn: await page.evaluate(() => window.app.state.turn), errors }, null, 1))
await browser.close()
