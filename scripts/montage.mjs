// Složí snímky animace dělníků (shots/w_<práce>_<fáze>.png) do jedné tabulky shots/w_all.png.
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
const jobs = ['mine', 'farm', 'pasture', 'lumber', 'road']
const img = (j, f) => `data:image/png;base64,${readFileSync(`shots/w_${j}_${f}.png`).toString('base64')}`
const html = `<body style="margin:0;background:#111;color:#fff;font:14px monospace">${jobs.map(j => `<div style="display:flex;align-items:center"><div style="width:70px">${j}</div>${[0, 1, 2, 3, 4, 5].map(f => `<img src="${img(j, f)}" style="width:180px;height:170px">`).join('')}</div>`).join('')}</body>`
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1160, height: 850 } })
await page.setContent(html)
await page.screenshot({ path: 'shots/w_all.png' })
await browser.close()
