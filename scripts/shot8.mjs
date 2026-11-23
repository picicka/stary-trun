// Ověření: fronta výzkumu a animace pracujících dělníků.
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
await page.keyboard.press('t'); await page.waitForTimeout(200)
await page.click('.tech[data-v="philosophy"]'); await page.waitForTimeout(150)
await page.click('.tech[data-v="mining"]', { modifiers: ['Shift'] }); await page.waitForTimeout(150)
out.plan = await page.evaluate(() => { const p = window.app.state.players[0]; return [p.research, ...p.techQueue] })
out.badges = await page.$$eval('.tech .ord', e => e.map(x => x.textContent + ':' + x.parentElement.dataset.v))
await page.screenshot({ path: 'shots/q_tech.png' })
await page.keyboard.press('Escape')
out.topTip = await page.$eval('#topbar .research', e => e.dataset.tip.includes('Potom:'))
// Dělník při práci.
await page.evaluate(async () => { const a = window.app, s = a.state; const R = await import('/src/game/rules.ts'); const c = s.cities[0]; const [x, y] = R.neighbors(s, c.x, c.y).find(n => R.tileJobs(s, R.idx(s, n[0], n[1]), 0).some(j => j.ok)); const w = R.makeUnit(s, 0, 'worker', x, y); R.startWork(s, w, R.tileJobs(s, R.idx(s, x, y), 0).find(j => j.ok).job); window.__w = w.id; a.scene.syncAll(); a.refresh() })
const sample = () => page.evaluate(() => { const v = window.app.scene.units.get(window.__w); return [Math.round(v.spr.angle * 10) / 10, Math.round(v.spr.y * 10) / 10, !!v.work] })
out.anim = []
for (let i = 0; i < 5; i++) { out.anim.push(await sample()); await page.waitForTimeout(130) }
await page.screenshot({ path: 'shots/q_work.png' })
await page.evaluate(() => { const a = window.app, u = a.state.units.find(o => o.id === window.__w); u.work = null; a.scene.syncAll() })
out.stopped = await sample()
console.log(JSON.stringify({ out, errors }))
await browser.close()
