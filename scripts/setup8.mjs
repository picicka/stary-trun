// Ověření zakládání hry pro víc národů: volby mapy, výběr z osmi národů, hra a diplomacie v osmi.
import { chromium } from 'playwright'
const url = process.argv[2] || 'http://localhost:5199'
const dir = process.argv[3] || '/tmp/civ-mp'
const nations = Number(process.argv[4] || 8)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning)
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.game?.isRunning)
await page.waitForTimeout(400)
const broken = () => page.evaluate(() => [...document.querySelectorAll('img')].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src.slice(-40)))
await page.click('[data-a="m-new"]')
await page.click(`[data-a="m-nations"][data-v="${nations}"]`)
await page.click('[data-a="m-scen"][data-v="random"]')
await page.click('[data-a="m-land"][data-v="continents"]')
await page.fill('#seed', '4242')
await page.waitForTimeout(200)
await page.screenshot({ path: `${dir}/s1-setup.png`, fullPage: false })
const out = { brokenSetup: await broken() }
await page.click('[data-a="m-next"]')
await page.click('[data-a="m-nation"][data-v="morv"]')
await page.waitForTimeout(200)
await page.screenshot({ path: `${dir}/s2-nation.png` })
out.brokenNation = await broken()
if (process.argv[5] !== 'nogame') {
  await page.click('[data-a="m-start"]'); await page.waitForTimeout(900)
  out.state = await page.evaluate(() => { const s = window.app.state; return { W: s.W, H: s.H, seed: s.seed, players: s.players.map(p => p.nation + (p.human ? '*' : '')), maxTurns: s.maxTurns } })
  await page.screenshot({ path: `${dir}/s3-brief.png` })
  await page.click('[data-a="close"]'); await page.keyboard.press('b'); await page.waitForTimeout(900); await page.keyboard.press('Escape')
  const t0 = Date.now()
  for (let k = 0; k < 12; k++) { await page.keyboard.press('Shift+Enter'); await page.waitForFunction(() => !window.app.busy, null, { timeout: 60000 }); await page.waitForTimeout(150); if (await page.evaluate(() => window.app.hud.modalOpen)) await page.keyboard.press('Escape') }
  out.msPerTurn = Math.round((Date.now() - t0) / 12)
  // Odkryjeme mapu a seznámíme národy, ať je vidět celá země a diplomacie se všemi.
  await page.evaluate(() => { const a = window.app, s = a.state; for (let i = 0; i < s.tiles.length; i++) { s.players[0].explored[i] = 1; s.players[0].visible[i] = 1 } for (const p of s.players) if (p.id && p.id < s.players.length - 1 && !s.players[0].met.includes(p.id)) { s.players[0].met.push(p.id); p.met.push(0) } a.scene.syncAll(); a.refresh() })
  await page.click('[data-a="zoom"][data-v="-1"]'); await page.click('[data-a="zoom"][data-v="-1"]'); await page.waitForTimeout(500)
  await page.screenshot({ path: `${dir}/s4-map.png` })
  await page.click('[data-a="diplo"]'); await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/s5-diplo.png` })
  await page.keyboard.press('Escape'); await page.keyboard.press('m'); await page.waitForTimeout(300)
  await page.screenshot({ path: `${dir}/s6-mission.png` })
  out.turn = await page.evaluate(() => window.app.state.turn)
  out.cities = await page.evaluate(() => { const s = window.app.state; return s.players.slice(0, -1).map(p => s.cities.filter(c => c.owner === p.id).length) })
  out.brokenGame = await broken()
}
out.errors = errors
console.log(JSON.stringify(out))
await browser.close()
