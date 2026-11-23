// Ověření: klik na surovinu v liště / v přehledu vycentruje mapu na ložisko a zůstane tam.
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
// Vzdálené ložisko koní dáme hráči do území, ať je kam skákat.
const target = await page.evaluate(() => {
  const a = window.app, s = a.state, c = s.cities[0]
  for (const t of s.tiles) if (t.owner === 0 && t.res === 'horses') t.res = null
  let best = -1, bd = 0
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i]; if (t.t !== 'grass' && t.t !== 'plains') continue
    const x = i % s.W, y = Math.floor(i / s.W), d = Math.abs(x - c.x) + Math.abs(y - c.y)
    if (d > bd && d < 26) { bd = d; best = i }
  }
  s.tiles[best].res = 'horses'; s.tiles[best].owner = 0
  for (let i = 0; i < s.tiles.length; i++) s.players[0].explored[i] = 1
  a.scene.syncAll(); a.refresh()
  return { i: best, x: best % s.W, y: Math.floor(best / s.W), wx: (best % s.W) * 32 + (Math.floor(best / s.W) & 1) * 16 + 16, wy: Math.floor(best / s.W) * 24 + 16 }
})
const mid = () => page.evaluate(() => { const v = window.app.scene.viewRect; return [Math.round(v.x + v.width / 2), Math.round(v.y + v.height / 2)] })
await page.click('[data-a="zoom"][data-v="-1"]'); await page.click('[data-a="zoom"][data-v="-1"]'); await page.waitForTimeout(300)
const out = { target: [target.wx, target.wy], before: await mid(), samples: [] }
out.zoom = await page.evaluate(() => window.app.scene.zoom)
await page.mouse.move(700, 300); await page.mouse.down(); await page.mouse.move(720, 150, { steps: 4 }); await page.mouse.move(720, 20, { steps: 3 }); await page.mouse.up()
out.afterDrag = await mid()
const chip = await (await page.$('#topbar .stat.res.clickable')).boundingBox()
await page.mouse.move(chip.x + 10, chip.y + 10); await page.mouse.down(); await page.mouse.move(chip.x + 14, chip.y + 12); await page.mouse.up()
await page.mouse.move(chip.x + 60, chip.y + 80, { steps: 5 })
for (const ms of [100, 200, 300, 500, 900, 1500]) { await page.waitForTimeout(ms === 100 ? 100 : 200); out.samples.push(await mid()) }
await page.mouse.move(700, 450); await page.waitForTimeout(300)
out.afterMouseMove = await mid()
console.log(JSON.stringify({ out, errors }))
await browser.close()
