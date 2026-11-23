// Ověření: strategické suroviny v liště, v přehledu a v bublině u pole.
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
await page.click('[data-a="m-new"]'); await page.click('[data-a="m-next"]'); await page.click('[data-a="m-start"]')
await page.waitForTimeout(600); await page.click('[data-a="close"]')
await page.keyboard.press('b'); await page.waitForTimeout(800); await page.keyboard.press('Escape')
const out = {}
const chips = () => page.$$eval('#topbar .stat.res', e => e.map(x => x.className.replace('stat res ', '') + ':' + x.innerText.trim()))
out.start = await chips()
out.notes = await page.evaluate(() => window.app.state.notes.map(n => n.text).filter(t => /surovin|ložisk/i.test(t)))
// Bronz odhalí železo; ohrada na koních dá přístup.
await page.evaluate(async () => {
  const a = window.app, s = a.state
  const R = await import('/src/game/rules.ts')
  const c = s.cities[0]
  c.radius = 3; R.claimTiles(s, c)
  await a.run(() => { R.grantTech(s, s.players[0], 'husbandry'); R.grantTech(s, s.players[0], 'mining'); R.grantTech(s, s.players[0], 'bronze') })
  const i = s.tiles.findIndex(t => t.owner === 0 && t.res === 'horses')
  const w = R.makeUnit(s, 0, 'worker', i % s.W, Math.floor(i / s.W))
  R.startWork(s, w, 'pasture'); w.workLeft = 1
  a.scene.syncAll(); a.refresh()
})
out.afterBronze = await chips()
await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(2500)
await page.keyboard.press('Escape')
out.afterPasture = await chips()
out.notes2 = await page.evaluate(() => window.app.state.notes.map(n => n.text).filter(t => /surovin|ložisk/i.test(t)).slice(-3))
await page.keyboard.press('l'); await page.waitForTimeout(300)
out.overview = await page.$$eval('#overview .ov .resic', e => e.length)
out.menuFits = await page.evaluate(() => document.querySelector('#topbar [data-a="menu"]').getBoundingClientRect().right <= window.innerWidth)
await page.hover('#topbar .stat.res'); await page.waitForTimeout(200)
out.tip = await page.evaluate(() => document.getElementById('tooltip').innerText)
await page.screenshot({ path: 'shots/r_res.png' })
console.log(JSON.stringify({ out, errors }, null, 1))
await browser.close()
