// Zkopíruje výstup pxl (art/out) do public/assets.
import { cpSync, mkdirSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
const out = 'art/out', dst = 'public/assets'
mkdirSync(join(dst, 'ui'), { recursive: true })
cpSync(join(out, 'atlas.png'), join(dst, 'atlas.png'))
cpSync(join(out, 'atlas.json'), join(dst, 'atlas.json'))
if (existsSync(join(out, 'scenes/title_bg.png'))) cpSync(join(out, 'scenes/title_bg.png'), join(dst, 'title_bg.png'))
let n = 0
const made = new Set()
for (const f of readdirSync(join(out, 'sprites'))) {
  if (!f.endsWith('.png') || f.startsWith('_')) continue
  cpSync(join(out, 'sprites', f), join(dst, 'ui', f)); made.add(f); n++
}
// Jednotky a města existují jen jednou se zástupnými barvami (barvy národů dosazuje hra za běhu,
// viz src/view/nationArt.ts). Zastaralé kopie (dřívější přebarvené varianty, smazané typy) uklidíme.
let gone = 0
for (const f of readdirSync(join(dst, 'ui'))) {
  if (/^(u|city)_.*\.png$/.test(f) && !made.has(f)) { rmSync(join(dst, 'ui', f)); gone++ }
}
console.log(`assets: ${n} sprites + atlas${gone ? `, removed ${gone} stale` : ''}`)
