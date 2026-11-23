// Zkopíruje výstup pxl (art/out) do public/assets.
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
const out = 'art/out', dst = 'public/assets'
mkdirSync(join(dst, 'ui'), { recursive: true })
cpSync(join(out, 'atlas.png'), join(dst, 'atlas.png'))
cpSync(join(out, 'atlas.json'), join(dst, 'atlas.json'))
if (existsSync(join(out, 'scenes/title_bg.png'))) cpSync(join(out, 'scenes/title_bg.png'), join(dst, 'title_bg.png'))
let n = 0
for (const f of readdirSync(join(out, 'sprites'))) {
  if (!f.endsWith('.png') || f.startsWith('_')) continue
  cpSync(join(out, 'sprites', f), join(dst, 'ui', f)); n++
}
console.log(`assets: ${n} sprites + atlas`)
