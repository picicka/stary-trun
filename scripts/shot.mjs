// Spustí hru v headless prohlížeči, provede kroky a uloží snímky.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
const url = process.argv[2] || 'http://localhost:5173'
const steps = process.argv[3] || 'title'
mkdirSync('shots', { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning, null, { timeout: 15000 })
await page.waitForTimeout(800)
const shot = async n => { await page.screenshot({ path: `shots/${n}.png` }); console.log('shot', n) }
const ev = fn => page.evaluate(fn)
if (steps.includes('title')) await shot('title')
if (steps.includes('setup')) { await page.click('[data-a="m-new"]'); await page.waitForTimeout(300); await shot('setup') }
if (steps.includes('game')) {
  if (!steps.includes('setup')) await page.click('[data-a="m-new"]')
  await page.click('[data-a="m-start"]'); await page.waitForTimeout(900); await shot('brief')
  await page.click('[data-a="close"]'); await page.waitForTimeout(400); await shot('game1')
  await page.keyboard.press('b'); await page.waitForTimeout(900); await shot('city')
}
if (steps.includes('play')) {
  // Odehraje N tahů s AI rádcem za hráče, aby bylo vidět rozvinutou hru.
  const n = +(steps.match(/play(\d+)/)?.[1] ?? 30)
  await page.evaluate(async (n) => {
    const { aiTurn } = await import('/src/game/ai.ts')
    const { endTurn } = await import('/src/game/state.ts')
    const { drainEvents } = await import('/src/game/rules.ts')
    const app = window.app
    app.state.players[0].personality = 'builder'
    app.state.tutorial.push('off')
    for (let i = 0; i < n && !app.state.over; i++) { aiTurn(app.state, 0); endTurn(app.state); drainEvents() }
    app.state.players[0].personality = 'human'
    app.selCity = -1; app.selUnit = -1
    app.scene.syncAll(); app.refresh()
    const c = app.state.cities.find(c => c.owner === 0)
    if (c) app.scene.centerOn(c.x, c.y, false)
    app.refresh()
  }, n)
  await page.waitForTimeout(700); await shot('play')
  await ev(() => { const a = window.app; const c = a.state.cities.find(c => c.owner === 0); a.openCity(c) }); await page.waitForTimeout(400); await shot('play-city')
  await ev(() => { window.app.openCity(null); window.app.hud.showTech() }); await page.waitForTimeout(300); await shot('play-tech')
  await ev(() => { window.app.hud.closeModal(); window.app.hud.showDiplo() }); await page.waitForTimeout(300); await shot('play-diplo')
  await ev(() => { window.app.hud.closeModal(); window.app.hud.showMission() }); await page.waitForTimeout(300); await shot('play-mission')
  await ev(() => { window.app.hud.closeModal(); const a = window.app; const u = a.state.units.find(u => u.owner === 0 && u.type !== 'worker' && u.type !== 'settler'); if (u) a.select(u, true); a.scene.zoomBy(-1) }); await page.waitForTimeout(600); await shot('play-unit')
}
console.log(JSON.stringify({ errors }, null, 2))
await browser.close()
process.exit(errors.length ? 1 : 0)
