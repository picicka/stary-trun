// Hraje přes skutečné rozhraní (klávesy a kliky) a hlídá chyby.
import { chromium } from 'playwright'
const url = process.argv[2] || 'http://localhost:5173'
const turns = +(process.argv[3] || 25)
const nation = process.argv[4] || 'khar'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning)
await page.waitForTimeout(500)
await page.click('[data-a="m-new"]'); await page.click('[data-a="m-next"]')
await page.click(`[data-a="m-nation"][data-v="${nation}"]`)
await page.click('[data-a="m-start"]')
await page.waitForTimeout(700)
await page.click('[data-a="close"]')
await page.keyboard.press('b')
await page.waitForTimeout(700)
const st = () => page.evaluate(() => { const a = window.app; return { turn: a.state.turn, busy: a.busy, att: a.attention().kind, modal: a.hud.modalOpen, over: !!a.state.over } })
let guard = 0
while (guard++ < 3000) {
  const s = await st()
  if (s.over || s.turn > turns) break
  if (s.busy) { await page.waitForTimeout(60); continue }
  if (s.modal) {
    const tech = await page.$('.tech.avail:not(.cur), .trad.avail')
    if (tech) { await tech.click().catch(() => {}); await page.keyboard.press('Escape') }
    else { const b = await page.$('#modal .foot .btn:last-child'); if (b) await b.click().catch(() => {}); else await page.keyboard.press('Escape') }
    continue
  }
  if (s.att === 'city') {
    await page.keyboard.press('Enter'); await page.waitForTimeout(40)
    const opts = await page.$$('#city .build:not(.off)')
    if (opts.length) await opts[(s.turn * 7) % opts.length].click().catch(() => {})
    await page.keyboard.press('Escape'); continue
  }
  if (s.att === 'unit') {
    await page.keyboard.press('Enter'); await page.waitForTimeout(30)
    // Zkusit pohyb skutečným kliknutím na dosažitelné pole, jinak akci z panelu.
    const moved = await page.evaluate(() => {
      const a = window.app, u = a.unit
      if (!u) return 'none'
      const t = [...a.targets]
      const r = [...a.reach]
      const pickI = t.length ? t[0] : r.length && u.type !== 'settler' && u.type !== 'worker' ? r[(u.id * 13 + a.state.turn * 7) % r.length] : -1
      if (pickI < 0) return 'panel'
      const x = pickI % a.state.W, y = Math.floor(pickI / a.state.W)
      const cx = x * 32 + (y & 1) * 16 + 16, cy = y * 24 + 16
      // Klikat jen tam, kde je opravdu vidět mapa (ne panel rádce, popisek města apod.).
      const sc = a.scene.worldToScreen(cx, cy)
      return document.elementFromPoint(sc[0], sc[1])?.tagName === 'CANVAS' ? sc : 'panel'
    })
    if (Array.isArray(moved) && moved[0] > 440 && moved[0] < 1200 && moved[1] > 60 && moved[1] < 640) {
      await page.mouse.click(moved[0], moved[1]); await page.waitForTimeout(40)
      const s2 = await st()
      if (s2.modal) await page.click('#confirm-yes').catch(() => {})
    } else {
      const b = await page.$('#unitpanel [data-v="found"], #unitpanel [data-v^="imp:"]:not([disabled])')
      // Když založení města nejde (příliš blízko jiného), osadníky tento tah přeskočit.
      if (b) { await b.click().catch(() => {}); await page.waitForTimeout(60); const same = await page.evaluate(() => { const u = window.app.unit; return !!u && u.type === 'settler' && !window.app.busy }); if (same) await page.keyboard.press('x') }
      else await page.keyboard.press((await page.$('#unitpanel [data-v="fortify"]')) ? 'f' : 'x')
    }
    await page.waitForTimeout(30); continue
  }
  await page.keyboard.press('Enter'); await page.waitForTimeout(50)
}
const fin = await page.evaluate(() => { const a = window.app, s = a.state; return { turn: s.turn, cities: s.cities.filter(c => c.owner === 0).length, units: s.units.filter(u => u.owner === 0).length, techs: s.players[0].techs.length, over: s.over, war: s.players[0].war } })
await page.screenshot({ path: 'shots/playtest.png' })
console.log(JSON.stringify({ fin, guard, errors: errors.slice(0, 8) }, null, 1))
await browser.close()
process.exit(errors.length ? 1 : 0)
