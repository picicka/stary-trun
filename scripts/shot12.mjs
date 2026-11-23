// Ověření: tlačítko „Jak hrát“ v hlavním menu otevře návod, jde jím listovat a zavřít.
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
const out = {}
await page.click('[data-a="m-help"]'); await page.waitForTimeout(300)
// Je okno návodu opravdu navrchu (ne schované pod menu)?
out.onTop = await page.evaluate(() => { const b = document.querySelector('#modal .modalbox'); if (!b) return 'no modal'; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + 30); return !!el && b.contains(el) })
out.title1 = await page.$eval('#modal h2', e => e.textContent)
await page.screenshot({ path: 'shots/g_menu_guide.png' })
await page.click('#modal .foot [data-a="guide"]:last-child'); await page.waitForTimeout(200)
out.title2 = await page.$eval('#modal h2', e => e.textContent)
await page.click('#modal .foot [data-a="close"]'); await page.waitForTimeout(200)
out.closed = await page.evaluate(() => document.getElementById('modal').classList.contains('hidden'))
out.menuStillThere = await page.evaluate(() => !!document.querySelector('[data-a="m-new"]') && !document.getElementById('menu').classList.contains('hidden'))
console.log(JSON.stringify({ out, errors }))
await browser.close()
