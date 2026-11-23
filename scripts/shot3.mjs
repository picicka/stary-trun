// Ověření: řeky, cesty, obdělávaná pole, rozkazy dělníkům, povýšení, diplomacie, sbalený rádce.
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
await page.click('[data-a="m-new"]'); await page.click('[data-a="m-next"]'); await page.click('[data-a="m-nation"][data-v="aur"]'); await page.click('[data-a="m-start"]')
await page.waitForTimeout(600); await page.click('[data-a="close"]')
await page.keyboard.press('b'); await page.waitForTimeout(800)
out.setup = await page.evaluate(async () => {
  const a = window.app, s = a.state
  const R = await import('/src/game/rules.ts')
  const p = s.players[0]
  p.techs.push('wheel', 'mining', 'husbandry', 'forestry', 'bronze'); p.gold = 300
  for (let i = 0; i < s.tiles.length; i++) p.explored[i] = 1
  const c = s.cities[0]
  c.pop = 4; c.radius = 2; R.claimTiles(s, c); R.assignWorkers(s, c)
  // Cesta od města na východ.
  let x = c.x, y = c.y
  for (let k = 0; k < 4; k++) { x++; const t = s.tiles[R.idx(s, x, y)]; if (t.t !== 'mountain' && t.t !== 'coast' && t.t !== 'ocean') t.road = true }
  const w = R.makeUnit(s, 0, 'worker', c.x, c.y + 1)
  const war = s.units.find(u => u.owner === 0 && u.type === 'warrior'); war.xp = 12
  s.players[1].met.push(0, 2); s.players[2].met.push(0, 1); p.met.push(1, 2); s.players[1].attitude = 25
  R.updateVisibility(s, 0); a.scene.syncAll()
  a.openCity(c)
  return { rivers: s.tiles.filter(t => t.river).length, worker: w.id, warrior: war.id, city: [c.x, c.y] }
})
await page.waitForTimeout(500)
await page.screenshot({ path: 'shots/m_worked.png' })
await page.keyboard.press('Escape')
const scr = (id, dx, dy) => page.evaluate(([id, dx, dy]) => { const a = window.app, u = a.state.units.find(v => v.id === id); a.select(u); const x = u.x + dx, y = u.y + dy; return a.scene.worldToScreen(x * 32 + (y & 1) * 16 + 16, y * 24 + 16) }, [id, dx, dy])
let p = await scr(out.setup.worker, 1, 0)
await page.mouse.move(p[0], p[1]); await page.waitForTimeout(200)
out.workerHover = await page.evaluate(() => document.getElementById('tileinfo').innerText)
out.jobs = await page.evaluate(() => window.app.jobs.size)
await page.screenshot({ path: 'shots/m_worker.png' })
// Klik na zelené pole = dojít a stavět.
const target = await page.evaluate(() => { const a = window.app, s = a.state, u = a.unit; const i = [...a.jobs.keys()].find(k => k !== u.y * s.W + u.x); const x = i % s.W, y = Math.floor(i / s.W); return { i, sc: a.scene.worldToScreen(x * 32 + (y & 1) * 16 + 16, y * 24 + 16) } })
await page.mouse.click(target.sc[0], target.sc[1]); await page.waitForTimeout(900)
out.workerOrder = await page.evaluate(id => { const u = window.app.state.units.find(v => v.id === id); return { todo: u.todo, work: u.work, goto: u.goto } }, out.setup.worker)
// Povýšení.
await scr(out.setup.warrior, 0, 0); await page.waitForTimeout(200)
out.promoButtons = await page.$$eval('#unitpanel .promo button', b => b.map(x => x.textContent))
await page.screenshot({ path: 'shots/m_promo.png' })
await page.click('#unitpanel .promo button'); await page.waitForTimeout(150)
out.promos = await page.evaluate(id => window.app.state.units.find(v => v.id === id).promos, out.setup.warrior)
// Diplomacie.
await page.click('[data-a="diplo"]'); await page.waitForTimeout(200)
await page.screenshot({ path: 'shots/m_diplo.png' })
await page.click('[data-a="dip"][data-v^="gift"]'); await page.waitForTimeout(150)
out.diploMsg = await page.$eval('#modal .body p', e => e.textContent)
await page.keyboard.press('Escape')
out.tipMini = await page.evaluate(() => document.getElementById('tip').className)
// Mapa z dálky: řeky a cesty.
await page.keyboard.press('Escape')
await page.click('[data-a="zoom"][data-v="-1"]'); await page.waitForTimeout(400)
await page.screenshot({ path: 'shots/m_map.png' })
for (let i = 0; i < 4; i++) { await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(1600) }
out.after = await page.evaluate(id => { const s = window.app.state, u = s.units.find(v => v.id === id); return { turn: s.turn, work: u?.work, imp: s.tiles[u.y * s.W + u.x].imp } }, out.setup.worker)
console.log(JSON.stringify({ out, errors: errors.slice(0, 8) }, null, 1))
await browser.close()
