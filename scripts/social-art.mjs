// Obrázky pro sdílení odkazu a ikony na plochu: public/og.png, apple-touch-icon.png, icon-192.png, icon-512.png.
// Spuštění: node scripts/social-art.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const b64 = p => readFileSync(new URL('../' + p, import.meta.url)).toString('base64')
const png = p => `data:image/png;base64,${b64(p)}`
const font = (w, sub) => `@font-face { font-family: P; font-weight: ${w}; src: url(data:font/woff2;base64,${b64(`node_modules/@fontsource/pixelify-sans/files/pixelify-sans-${sub}-${w}-normal.woff2`)}) format('woff2'); }`
const css = `${font(700, 'latin')}${font(700, 'latin-ext')}${font(400, 'latin')}${font(400, 'latin-ext')}
  * { margin: 0; box-sizing: border-box; } body { font-family: P; image-rendering: pixelated; overflow: hidden; }
  img { image-rendering: pixelated; }`

const og = `<style>${css}
  body { width: 1200px; height: 630px; background: #0b1020 url(${png('public/assets/title_bg.png')}) center / cover; }
  .shade { position: absolute; inset: 0; background: linear-gradient(#0b1020cc, #0b102000 45%, #0b1020e6 82%); }
  h1 { position: absolute; top: 44px; width: 100%; text-align: center; font-size: 132px; font-weight: 700; color: #ffe9a8; text-shadow: 6px 6px 0 #2a1a08, -3px -3px 0 #2a1a08, 3px -3px 0 #2a1a08, -3px 3px 0 #2a1a08; }
  p { position: absolute; bottom: 104px; width: 100%; text-align: center; font-size: 46px; color: #fff; text-shadow: 3px 3px 0 #0b1020; }
  .em { position: absolute; bottom: 22px; width: 100%; display: flex; justify-content: center; gap: 18px; }
  .em img { width: 72px; height: 72px; }
</style><div class="shade"></div><h1>Starý trůn</h1><p>Hexová tahová strategie v prohlížeči</p>
<div class="em">${['aur', 'khar', 'lume', 'morv', 'sylv', 'tark', 'thal', 'zahi'].map(n => { try { return `<img src="${png(`public/assets/ui/em_${n}.png`)}">` } catch { return '' } }).join('')}</div>`

const icon = n => `<style>${css}
  body { width: ${n}px; height: ${n}px; background: #0b1020 url(${png('public/assets/title_bg.png')}) center / cover; display: grid; place-items: center; }
  .shade { position: absolute; inset: 0; background: #0b102099; }
  img { position: relative; width: ${Math.floor(n * 0.72 / 24) * 24}px; }
</style><div class="shade"></div><img src="${png('public/assets/ui/em_aur.png')}">`

const browser = await chromium.launch()
async function shot(html, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.setContent(html)
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: new URL('../public/' + out, import.meta.url).pathname })
  await page.close()
}
await shot(og, 1200, 630, 'og.png')
await shot(icon(180), 180, 180, 'apple-touch-icon.png')
await shot(icon(192), 192, 192, 'icon-192.png')
await shot(icon(512), 512, 512, 'icon-512.png')
await browser.close()
