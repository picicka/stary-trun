// Ověření: animace dělníků podle druhu práce (krumpáč, motyka, kladivo, pila, lopata).
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
const out = await page.evaluate(async () => {
  const a = window.app, s = a.state
  const R = await import('/src/game/rules.ts')
  s.players[0].techs.push('mining', 'husbandry', 'forestry', 'wheel')
  const c = s.cities[0]
  c.radius = 2; R.claimTiles(s, c)
  const made = {}
  for (const [x, y] of R.tilesWithin(s, c.x, c.y, 2)) {
    const i = R.idx(s, x, y)
    for (const j of R.tileJobs(s, i, 0)) {
      if (!j.ok || made[j.job] || R.unitsAt(s, x, y).length || (j.job === 'road' && Object.keys(made).length < 4)) continue
      const w = R.makeUnit(s, 0, 'worker', x, y)
      if (R.startWork(s, w, j.job)) { made[j.job] = [x, y, w.id]; break }
    }
  }
  a.scene.syncAll(); a.select(null)
  a.scene.cameras.main.setZoom(5); a.scene.centerOn(c.x, c.y, false)
  return made
})
await page.waitForTimeout(300)
const pos = await page.evaluate(made => Object.fromEntries(Object.entries(made).map(([job, [x, y, id]]) => { const v = window.app.scene.units.get(id); const p = window.app.scene.worldToScreen(v.c.x, v.c.y); return [job, [Math.round(p[0]), Math.round(p[1]), v.key, v.tool?.frame.name]] })), out)
for (let f = 0; f < 6; f++) {
  for (const [job, [x, y]] of Object.entries(pos)) {
    if (x < 90 || y < 90 || x > 1350 || y > 810) continue
    await page.screenshot({ path: `shots/w_${job}_${f}.png`, clip: { x: x - 90, y: y - 90, width: 180, height: 170 } })
  }
  await page.waitForTimeout(110)
}
console.log(JSON.stringify({ pos, errors }))
await browser.close()
