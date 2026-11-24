// Jednorázová kontrola: přebarvení v prohlížeči (src/view/nationArt.ts) dává pixel po pixelu totéž,
// co dřívější předbarvené soubory public/assets/ui/u_*_<národ>.png a city_*_<národ>.png z gitu.
// Použití: npx vite --port 5201 --strictPort &  node scripts/check-recolor.mjs http://localhost:5201 [revize=HEAD]
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'

const url = process.argv[2] || 'http://localhost:5173'
const rev = process.argv[3] || 'HEAD'
const git = (...a) => execFileSync('git', a, { maxBuffer: 1 << 28 })
const names = git('ls-tree', '--name-only', `${rev}:public/assets/ui/`).toString().split('\n')
  .filter(f => /^(u|city)_.+_[a-z]+\.png$/.test(f))
const old = Object.fromEntries(names.map(f => [f.slice(0, -4), git('show', `${rev}:public/assets/ui/${f}`).toString('base64')]))
const oldAtlas = { png: git('show', `${rev}:public/assets/atlas.png`).toString('base64'), json: JSON.parse(git('show', `${rev}:public/assets/atlas.json`).toString()) }

const browser = await chromium.launch()
const page = await browser.newPage()
const errors = []
page.on('pageerror', e => errors.push(e.message))
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
await page.goto(url)
await page.waitForFunction(() => window.game?.isRunning && window.game.scene.isActive('map'), null, { timeout: 15000 })

const res = await page.evaluate(async ({ old, oldAtlas }) => {
  const art = await import('/src/view/nationArt.ts')
  const { NATIONS } = await import('/src/game/data.ts')
  await art.loadNationArt()
  const bytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  // nezávislé dekódování prohlížečem (přednásobená alfa – stejně pro obě strany)
  const native = async b => {
    const bmp = await createImageBitmap(new Blob([b], { type: 'image/png' }))
    const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d')
    x.drawImage(bmp, 0, 0)
    return { w: bmp.width, h: bmp.height, rgba: x.getImageData(0, 0, bmp.width, bmp.height).data }
  }
  const diff = (a, b) => {
    if (a.w !== b.w || a.h !== b.h) return -1
    let n = 0
    for (let i = 0; i < a.rgba.length; i += 4) if (a.rgba[i] !== b.rgba[i] || a.rgba[i + 1] !== b.rgba[i + 1] || a.rgba[i + 2] !== b.rgba[i + 2] || a.rgba[i + 3] !== b.rgba[i + 3]) n++
    return n
  }
  const out = { files: 0, exact: 0, nativeSame: 0, mapSame: 0, bad: [], semi: 0 }
  const nations = Object.keys(NATIONS).sort((a, b) => b.length - a.length)
  const tex = window.game.textures.get('atlas')
  for (const [name, b64] of Object.entries(old)) {
    out.files++
    const nation = nations.find(n => name.endsWith('_' + n)), frame = name.slice(0, -nation.length - 1)
    const ref = bytes(b64)
    const refPx = await art.decodePng(ref)
    for (let i = 3; i < refPx.rgba.length; i += 4) if (refPx.rgba[i] > 0 && refPx.rgba[i] < 255) out.semi++
    // 1) ikona pro HTML: data URL → PNG → přesné RGBA
    const dataUrl = art.nationIconUrl(frame, nation)
    const got = bytes(dataUrl.split(',')[1])
    const d1 = diff(refPx, await art.decodePng(got))
    // 2) totéž dekódované prohlížečem
    const d2 = diff(await native(ref), await native(got))
    // 3) snímek na mapě: výřez z plátna, které dostal Phaser
    let d3 = -2
    if (tex.has(name)) {
      const f = tex.get(name), src = f.source.image
      const px = src.getContext('2d').getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight)
      d3 = diff(await native(ref), { w: px.width, h: px.height, rgba: px.data })
    }
    if (d1 === 0) out.exact++
    if (d2 === 0) out.nativeSame++
    if (d3 === 0) out.mapSame++
    if (d1 || d2 || d3) out.bad.push({ name, html: d1, htmlNative: d2, map: d3 })
  }
  // Odstíny purpurové v nových zástupných snímcích: smí být jen (255,0,255) a (160,0,160), vždy neprůhledné.
  const cur = await art.decodePng(new Uint8Array(await (await fetch('/assets/atlas.png')).arrayBuffer()))
  const curJson = await (await fetch('/assets/atlas.json')).json()
  const shades = {}
  let placeholders = 0
  for (const [name, f] of Object.entries(curJson.frames)) {
    if (!/^(u|city)_/.test(name)) continue
    const r = f.frame
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const i = ((r.y + y) * cur.w + r.x + x) * 4, [R, G, B, A] = cur.rgba.subarray(i, i + 4)
      if (!A) continue
      const ok = A === 255 && G === 0 && ((R === 255 && B === 255) || (R === 160 && B === 160))
      if (ok) placeholders++
      else if (G * 2 < Math.min(R, B) && Math.abs(R - B) < 60 && R > 60) shades[`${R},${G},${B},${A}`] = (shades[`${R},${G},${B},${A}`] ?? 0) + 1
    }
  }
  // Po přebarvení nesmí zůstat žádná zástupná barva.
  let leftover = 0
  for (const frame of art.nationBaseFrames()) for (const n of Object.keys(NATIONS)) {
    const p = art.nationPixels(frame, n)
    for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 1] === 0 && p.data[i + 3] && ((p.data[i] === 255 && p.data[i + 2] === 255) || (p.data[i] === 160 && p.data[i + 2] === 160))) leftover++
  }
  // Ostatní snímky atlasu (terén, ikony…) se nesmějí změnit.
  const prev = await art.decodePng(bytes(oldAtlas.png))
  const cut = (img, r) => { const o = new Uint8Array(r.w * r.h * 4); for (let y = 0; y < r.h; y++) o.set(img.rgba.subarray(((r.y + y) * img.w + r.x) * 4, ((r.y + y) * img.w + r.x + r.w) * 4), y * r.w * 4); return { w: r.w, h: r.h, rgba: o } }
  const other = { same: 0, changed: [], missing: [], added: [] }
  for (const [name, f] of Object.entries(oldAtlas.json.frames)) {
    if (/^(u|city)_/.test(name)) continue
    const now = curJson.frames[name]
    if (!now) { other.missing.push(name); continue }
    if (diff(cut(prev, f.frame), cut(cur, now.frame)) === 0) other.same++; else other.changed.push(name)
  }
  for (const name of Object.keys(curJson.frames)) if (!/^(u|city)_/.test(name) && !oldAtlas.json.frames[name]) other.added.push(name)
  // Všechny národy × všechny zástupné snímky musí být v textuře mapy a mít filtr nearest.
  const missingFrames = []
  for (const frame of art.nationBaseFrames()) for (const n of Object.keys(NATIONS)) if (!tex.has(`${frame}_${n}`)) missingFrames.push(`${frame}_${n}`)
  return {
    ...out, shades, placeholders, leftover, other, missingFrames,
    nations: Object.keys(NATIONS), baseFrames: art.nationBaseFrames().length, atlasFrames: Object.keys(curJson.frames).length,
    sources: tex.source.map(s => ({ w: s.width, h: s.height, canvas: s.isCanvas, scaleMode: s.scaleMode })),
    renderer: window.game.renderer.type === 2 ? 'webgl' : 'canvas',
  }
}, { old, oldAtlas })
await browser.close()

console.log(JSON.stringify({ ...res, errors }, null, 1))
const ok = res.files > 0 && res.exact === res.files && res.nativeSame === res.files && res.mapSame === res.files && !Object.keys(res.shades).length &&
  !res.leftover && !res.other.changed.length && !res.other.missing.length && !res.missingFrames.length && !errors.length
console.log(ok ? `OK: ${res.files} původních souborů se shoduje pixel po pixelu (HTML ikony i snímky mapy)` : 'CHYBA: viz výše')
process.exit(ok ? 0 : 1)
