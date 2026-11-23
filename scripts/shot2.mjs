// Ověření novinek v prohlížeči: návod, fronta výroby, bubliny, daleká cesta, lodě.
import { chromium } from 'playwright'
const url = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
const out = {}
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning)
await page.waitForTimeout(400)
await page.click('[data-a="m-new"]'); await page.click('[data-a="m-next"]')
await page.click('[data-a="m-nation"][data-v="thal"]')
await page.click('[data-a="m-start"]')
await page.waitForTimeout(600)
await page.click('[data-a="guide"]')
await page.screenshot({ path: 'shots/n_guide1.png' })
for (let i = 0; i < 6; i++) await page.click('.foot [data-a="guide"]:last-child')
await page.waitForTimeout(400)
out.guidePics = await page.evaluate(() => [...document.querySelectorAll('.guide .pics img')].map(i => i.naturalWidth))
await page.screenshot({ path: 'shots/n_guide7.png' })
await page.keyboard.press('Escape')
await page.keyboard.press('b')
await page.waitForTimeout(800)
// Fronta výroby: tři kliknutí = jedna stavba a dvě položky ve frontě.
const rows = async () => page.$$('#city .build:not(.off)')
await (await rows())[0].click()
await (await rows())[1].click()
await (await rows())[2].click()
out.queue = await page.evaluate(() => { const c = window.app.city; return [c.build?.id, ...c.queue.map(q => q.id)] })
await (await rows())[1].hover()
await page.waitForTimeout(150)
out.tooltip = await page.evaluate(() => document.getElementById('tooltip').textContent.slice(0, 60))
await page.screenshot({ path: 'shots/n_queue.png' })
await page.hover('#city .yields span:nth-child(6)')
await page.waitForTimeout(100)
out.cultureTip = await page.evaluate(() => document.getElementById('tooltip').textContent.slice(0, 80))
await page.screenshot({ path: 'shots/n_culture.png' })
await page.keyboard.press('Escape')
// Daleká cesta levým tlačítkem.
const far = await page.evaluate(() => {
  const a = window.app, s = a.state
  const u = s.units.find(v => v.owner === 0 && v.type === 'scout')
  a.select(u)
  const tx = u.x - 3, ty = u.y - 4
  return { id: u.id, from: [u.x, u.y], to: [tx, ty], xy: a.scene.worldToScreen(tx * 32 + (ty & 1) * 16 + 16, ty * 24 + 16) }
})
await page.mouse.move(far.xy[0], far.xy[1])
await page.waitForTimeout(150)
out.hover = await page.evaluate(() => document.getElementById('tileinfo').textContent.slice(-60))
await page.mouse.click(far.xy[0], far.xy[1])
await page.waitForTimeout(900)
out.goto = await page.evaluate(id => { const u = window.app.state.units.find(v => v.id === id); return { at: [u.x, u.y], goto: u.goto, moves: u.moves } }, far.id)
await page.evaluate(id => window.app.select(window.app.state.units.find(v => v.id === id)), far.id)
await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/n_goto.png' })
// Lodě: dáme hráči Plavbu, postavíme galéru a triéru a nalodíme válečníka.
out.navy = await page.evaluate(async () => {
  const a = window.app, s = a.state
  const R = await import('/src/game/rules.ts')
  s.players[0].techs.push('sailing', 'navigation')
  const c = s.cities.find(o => o.owner === 0)
  const water = R.tilesWithin(s, c.x, c.y, 5).filter(([x, y]) => s.tiles[R.idx(s, x, y)].t === 'coast')
  if (water.length < 3) return { water: water.length }
  R.makeUnit(s, 0, 'galley', water[0][0], water[0][1])
  R.makeUnit(s, 0, 'trireme', water[1][0], water[1][1])
  const w = R.makeUnit(s, 0, 'warrior', water[2][0], water[2][1])
  R.updateVisibility(s, 0)
  a.scene.syncAll(); a.scene.centerOn(water[1][0], water[1][1], false)
  a.select(w)
  return { water: water.length, embarked: R.isEmbarked(s, w), coastal: R.isCoastal(s, c.x, c.y), canGalley: R.canBuildUnit(s, c, 'galley') }
})
await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/n_ships.png' })
await page.keyboard.press('t')
await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/n_tech.png' })
await page.keyboard.press('Escape')
for (let i = 0; i < 3; i++) { await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(1500) }
out.after = await page.evaluate(id => { const s = window.app.state; const u = s.units.find(v => v.id === id); return { turn: s.turn, scout: u ? [u.x, u.y, u.goto] : null } }, far.id)
console.log(JSON.stringify({ out, errors: errors.slice(0, 8) }, null, 1))
await browser.close()
