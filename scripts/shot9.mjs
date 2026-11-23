// Ověření: tipy rádce (žárovka) ve městě, výzkumu, tradicích a na mapě; přepínač.
import { chromium } from 'playwright'
const url = process.argv[2] || 'http://localhost:5173'
const browser = await chromium.launch()
// Nový kontext = čisté úložiště prohlížeče, tipy jsou ve výchozím stavu zapnuté.
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning)
await page.waitForTimeout(400)
await page.click('[data-a="m-new"]'); await page.click('[data-a="m-next"]'); await page.click('[data-a="m-start"]')
await page.waitForTimeout(600); await page.click('[data-a="close"]')
const out = {}
const tipMarks = () => page.evaluate(() => window.app.scene.marks.filter(m => m.frame?.name === 'ic_tip').length)
out.siteTip = await tipMarks()
await page.screenshot({ path: 'shots/h_settler.png' })
await page.keyboard.press('b'); await page.waitForTimeout(800)
out.cityRec = await page.$$eval('#city .build.rec', e => e.map(x => x.dataset.v))
out.poradit = await page.evaluate(() => document.getElementById('city').innerText.includes('Poradit'))
out.recInside = await page.evaluate(() => { const r = document.querySelector('#city .rec-ic').getBoundingClientRect(), p = document.querySelector('#city .inner').getBoundingClientRect(); return [Math.round(r.left - p.left), Math.round(r.top - p.top)] })
await page.screenshot({ path: 'shots/h_city.png' })
await page.keyboard.press('Escape')
await page.keyboard.press('t'); await page.waitForTimeout(200)
out.techRec = await page.$$eval('.tech.rec', e => e.map(x => x.dataset.v))
await page.screenshot({ path: 'shots/h_tech.png' })
await page.keyboard.press('Escape')
await page.evaluate(() => { window.app.state.players[0].culture = 30; window.app.refresh() })
await page.keyboard.press('c'); await page.waitForTimeout(200)
out.tradRec = await page.$$eval('.trad.rec b', e => e.map(x => x.textContent))
await page.screenshot({ path: 'shots/h_trad.png' })
await page.keyboard.press('Escape')
// Vypnutí: žádná žárovka, žádný rádce, žádné značky.
await page.keyboard.press('i'); await page.waitForTimeout(200)
await page.evaluate(async () => { const a = window.app, s = a.state; const R = await import('/src/game/rules.ts'); s.players[0].techs.push('mining', 'husbandry'); const c = s.cities[0]; const w = R.makeUnit(s, 0, 'worker', c.x + 1, c.y); a.scene.syncAll(); a.select(w) })
out.off = await page.evaluate(() => ({ hints: window.app.hints, jobs: window.app.jobs.size, tipHidden: document.getElementById('tip').classList.contains('hidden'), stored: localStorage.getItem('hex4x-hints') }))
await page.keyboard.press('t'); await page.waitForTimeout(150); out.offTechRec = (await page.$$('.tech.rec')).length; await page.keyboard.press('Escape')
await page.keyboard.press('i'); await page.waitForTimeout(200)
out.on = { hints: await page.evaluate(() => window.app.hints), jobs: await page.evaluate(() => window.app.jobs.size), tips: await tipMarks() }
await page.screenshot({ path: 'shots/h_worker.png' })
console.log(JSON.stringify({ out, errors }))
await browser.close()
