// Ověření: doporučená místa pro město a rozkaz „dojdi a usaď se“.
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
await page.evaluate(() => { const a = window.app, s = a.state; for (let i = 0; i < s.tiles.length; i++) s.players[0].explored[i] = 1; a.scene.syncAll(); a.select(s.units.find(u => u.owner === 0 && u.type === 'settler')) })
await page.click('[data-a="tip-open"]').catch(() => {})
await page.click('[data-a="zoom"][data-v="-1"]'); await page.waitForTimeout(500)
const out = {}
const info = await page.evaluate(() => { const a = window.app, s = a.state, u = a.unit; const list = [...a.sites.entries()].map(([i, sc]) => ({ i, sc: Math.round(sc), x: i % s.W, y: Math.floor(i / s.W) })); const t = list.find(o => !(o.x === u.x && o.y === u.y)); return { list, t, sc: a.scene.worldToScreen(t.x * 32 + (t.y & 1) * 16 + 16, t.y * 24 + 16), from: [u.x, u.y] } })
out.sites = info.list.map(o => `${o.x},${o.y}:${o.sc}`).join(' '); out.from = info.from; out.target = [info.t.x, info.t.y]
await page.mouse.move(info.sc[0], info.sc[1]); await page.waitForTimeout(200)
out.hover = await page.evaluate(() => document.getElementById('tileinfo').innerText)
await page.screenshot({ path: 'shots/p_sites.png' })
out.el = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName, info.sc)
await page.mouse.click(info.sc[0], info.sc[1]); await page.waitForTimeout(900)
for (let i = 0; i < 6; i++) { if (await page.evaluate(() => window.app.state.cities.some(c => c.owner === 0))) break; await page.keyboard.press('Shift+Enter'); await page.waitForTimeout(1500) }
out.city = await page.evaluate(() => { const c = window.app.state.cities.find(o => o.owner === 0); return c ? [c.x, c.y, window.app.state.turn] : null })
console.log(JSON.stringify({ out, errors }, null, 1))
await browser.close()
