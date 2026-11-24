// Barvy národů až v prohlížeči. Jednotky (u_<typ>) a města (city_<n>) jsou v atlasu jen jednou se dvěma
// zástupnými barvami; pro každý národ z NATIONS z nich tady vzniká varianta `<snímek>_<národ>`:
//  – pro mapu jako další snímky textury atlasu (addNationFrames),
//  – pro HTML rozhraní jako data URL (unitIconUrl, cityIconUrl).
// Národy i snímky se berou z dat a z atlasu, nic se tu nevypisuje ručně.
import Phaser from 'phaser'
import { NATIONS, type NationId } from '../game/data.ts'

/** Zástupné barvy z palety grafiky (art/art.px.js, klíče N a M). */
const LIGHT = [255, 0, 255] as const
const DARK = [160, 0, 160] as const
/** Snímky, které se přebarvují. */
const RECOLORED = /^(u|city)_/
const PAD = 2
const SHEET_W = 1024
const EMPTY = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

interface Rect { x: number; y: number; w: number; h: number }
interface Atlas { w: number; h: number; rgba: Uint8Array | Uint8ClampedArray; frames: Map<string, Rect> }

let atlas: Atlas | null = null
let loading: Promise<void> | null = null
const urls = new Map<string, string>()

/** Načte atlas a připraví přebarvování. Volá se jednou při startu, dřív než vznikne rozhraní i mapa. */
export function loadNationArt(base = `${import.meta.env.BASE_URL}assets/`): Promise<void> {
  loading ??= (async () => {
    const [json, bytes] = await Promise.all([
      fetch(`${base}atlas.json`).then(r => r.json()) as Promise<{ frames: Record<string, { frame: Rect }> }>,
      fetch(`${base}atlas.png`).then(r => r.arrayBuffer()),
    ])
    let img: { w: number; h: number; rgba: Uint8Array | Uint8ClampedArray }
    try { img = await decodePng(new Uint8Array(bytes)) } catch (e) {
      console.warn('nationArt: vlastní čtení PNG selhalo, zkouším canvas', e)
      img = await decodeViaCanvas(bytes)
    }
    const frames = new Map<string, Rect>()
    for (const [name, f] of Object.entries(json.frames)) if (RECOLORED.test(name)) frames.set(name, f.frame)
    atlas = { ...img, frames }
  })()
  return loading
}

/** Názvy snímků se zástupnými barvami (např. `u_warrior`, `city_2`). */
export function nationBaseFrames(): string[] { return atlas ? [...atlas.frames.keys()] : [] }

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]

/** Pixely jednoho snímku (RGBA, nepřednásobené) v barvách národa. */
export function nationPixels(frame: string, nation: NationId): { w: number; h: number; data: Uint8ClampedArray } | null {
  const f = atlas?.frames.get(frame), def = NATIONS[nation]
  if (!atlas || !f || !def) return null
  const light = rgb(def.color), dark = rgb(def.colorDark)
  const out = new Uint8ClampedArray(f.w * f.h * 4), src = atlas.rgba
  for (let y = 0; y < f.h; y++) {
    const s = ((f.y + y) * atlas.w + f.x) * 4
    out.set(src.subarray(s, s + f.w * 4), y * f.w * 4)
  }
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] !== 255 || out[i + 1] !== 0) continue
    const to = out[i] === LIGHT[0] && out[i + 2] === LIGHT[2] ? light : out[i] === DARK[0] && out[i + 2] === DARK[2] ? dark : null
    if (to) { out[i] = to[0]; out[i + 1] = to[1]; out[i + 2] = to[2] }
  }
  return { w: f.w, h: f.h, data: out }
}

/** Adresa (data URL) snímku v barvách národa; vyrobí se jednou a pamatuje se. */
export function nationIconUrl(frame: string, nation: NationId): string {
  const key = `${frame}_${nation}`
  let url = urls.get(key)
  if (url) return url
  const px = nationPixels(frame, nation)
  if (!px) { console.warn(`nationArt: chybí snímek ${key}${atlas ? '' : ' (atlas ještě není načtený)'}`); return EMPTY }
  url = encodePngUrl(px.w, px.h, px.data)
  urls.set(key, url)
  return url
}
/** Ikona jednotky (i `boat`, `workerb`) v barvách národa. */
export const unitIconUrl = (type: string, nation: NationId): string => nationIconUrl(`u_${type}`, nation)
/** Obrázek města velikosti 1–3 v barvách národa. */
export const cityIconUrl = (size: number, nation: NationId): string => nationIconUrl(`city_${size}`, nation)

/** Přidá do textury atlasu snímky `<snímek>_<národ>` pro všechny národy (druhý zdroj textury, ostré pixely). */
export function addNationFrames(textures: Phaser.Textures.TextureManager, key: string): void {
  if (!atlas) { console.warn('nationArt: atlas není načtený, národní snímky chybí'); return }
  const tex = textures.get(key)
  const nations = Object.keys(NATIONS) as NationId[]
  const todo: { name: string; frame: string; nation: NationId; r: Rect }[] = []
  let x = PAD, y = PAD, rowH = 0
  for (const nation of nations) for (const [frame, f] of atlas.frames) {
    const name = `${frame}_${nation}`
    if (tex.has(name)) continue
    if (x + f.w + PAD > SHEET_W) { x = PAD; y += rowH + PAD; rowH = 0 }
    todo.push({ name, frame, nation, r: { x, y, w: f.w, h: f.h } })
    x += f.w + PAD; rowH = Math.max(rowH, f.h)
  }
  if (!todo.length) return
  const canvas = document.createElement('canvas')
  canvas.width = SHEET_W; canvas.height = y + rowH + PAD
  const ctx = canvas.getContext('2d')!
  for (const t of todo) {
    const px = nationPixels(t.frame, t.nation)!
    ctx.putImageData(new ImageData(px.data as Uint8ClampedArray<ArrayBuffer>, px.w, px.h), t.r.x, t.r.y)
  }
  // Filtr „nearest“ nastaví TextureSource sám podle pixelArt (config.antialias = false).
  const si = tex.source.push(new Phaser.Textures.TextureSource(tex, canvas)) - 1
  for (const t of todo) tex.add(t.name, si, t.r.x, t.r.y, t.r.w, t.r.h)
}

// ---------------------------------------------------------------- PNG
// Vlastní čtení i zápis PNG: canvas barvy s poloprůhledností (stín města) zaokrouhluje přednásobením alfou
// a některé prohlížeče do getImageData/toDataURL přidávají šum proti otiskům – tady jsou pixely bit po bitu.

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** 8bitové PNG bez prokládání: paleta (typ 3, s tRNS), RGB (2), RGBA (6), šedá (0, 4). */
export async function decodePng(b: Uint8Array): Promise<{ w: number; h: number; rgba: Uint8Array }> {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('není PNG')
  let w = 0, h = 0, type = 0, plte: Uint8Array | null = null, trns: Uint8Array | null = null
  const idat: Uint8Array[] = []
  for (let p = 8; p < b.length;) {
    const len = dv.getUint32(p), id = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]), body = b.subarray(p + 8, p + 8 + len)
    if (id === 'IHDR') {
      w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); type = body[9]
      if (body[8] !== 8 || body[12] !== 0) throw new Error(`nepodporované PNG (hloubka ${body[8]}, prokládání ${body[12]})`)
    } else if (id === 'PLTE') plte = body
    else if (id === 'tRNS') trns = body
    else if (id === 'IDAT') idat.push(body)
    else if (id === 'IEND') break
    p += 12 + len
  }
  const bpp = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[type]
  if (!bpp || (type === 3 && !plte)) throw new Error(`nepodporované PNG (typ ${type})`)
  const all = new Uint8Array(idat.reduce((n, c) => n + c.length, 0))
  let o = 0
  for (const c of idat) { all.set(c, o); o += c.length }
  const raw = await inflate(all), line = w * bpp
  if (raw.length < (line + 1) * h) throw new Error('PNG je useknuté')
  const px = new Uint8Array(line * h)
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (line + 1)], src = y * (line + 1) + 1, dst = y * line
    for (let i = 0; i < line; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0, up = y ? px[dst + i - line] : 0, c = i >= bpp && y ? px[dst + i - line - bpp] : 0
      let pred = 0
      if (ft === 1) pred = a
      else if (ft === 2) pred = up
      else if (ft === 3) pred = (a + up) >> 1
      else if (ft === 4) { const pa = Math.abs(up - c), pb = Math.abs(a - c), pc = Math.abs(a + up - 2 * c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? up : c }
      px[dst + i] = (raw[src + i] + pred) & 255
    }
  }
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0, j = 0; i < w * h; i++, j += 4) {
    const s = i * bpp
    if (type === 3) { const k = px[s] * 3; rgba[j] = plte![k]; rgba[j + 1] = plte![k + 1]; rgba[j + 2] = plte![k + 2]; rgba[j + 3] = trns && px[s] < trns.length ? trns[px[s]] : 255 }
    else if (type === 6) { rgba[j] = px[s]; rgba[j + 1] = px[s + 1]; rgba[j + 2] = px[s + 2]; rgba[j + 3] = px[s + 3] }
    else if (type === 2) { rgba[j] = px[s]; rgba[j + 1] = px[s + 1]; rgba[j + 2] = px[s + 2]; rgba[j + 3] = 255 }
    else { rgba[j] = rgba[j + 1] = rgba[j + 2] = px[s]; rgba[j + 3] = type === 4 ? px[s + 1] : 255 }
  }
  return { w, h, rgba }
}

/** Záloha pro neobvyklá PNG: dekóduje prohlížeč (poloprůhledné pixely mohou vyjít o jedničku jinak). */
async function decodeViaCanvas(bytes: ArrayBuffer): Promise<{ w: number; h: number; rgba: Uint8ClampedArray }> {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
  const c = document.createElement('canvas')
  c.width = bmp.width; c.height = bmp.height
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bmp, 0, 0)
  return { w: c.width, h: c.height, rgba: ctx.getImageData(0, 0, c.width, c.height).data }
}

const CRC = Uint32Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })

/** RGBA → PNG (typ 6, bez komprese – ikony mají pár set bajtů) jako data URL. */
export function encodePngUrl(w: number, h: number, rgba: Uint8ClampedArray | Uint8Array): string {
  const line = w * 4 + 1, raw = new Uint8Array(line * h)
  for (let y = 0; y < h; y++) raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * line + 1)
  // zlib: hlavička, uložené bloky po nejvýš 65 535 bajtech, Adler-32
  const blocks = Math.max(1, Math.ceil(raw.length / 65535)), z = new Uint8Array(2 + raw.length + blocks * 5 + 4)
  let p = 0, a = 1, s = 0
  z[p++] = 0x78; z[p++] = 0x01
  for (let i = 0; i < blocks; i++) {
    const part = raw.subarray(i * 65535, (i + 1) * 65535), n = part.length
    z[p++] = i === blocks - 1 ? 1 : 0; z[p++] = n & 255; z[p++] = n >> 8; z[p++] = ~n & 255; z[p++] = (~n >> 8) & 255
    z.set(part, p); p += n
  }
  for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; s = (s + a) % 65521 }
  z[p++] = s >> 8; z[p++] = s & 255; z[p++] = a >> 8; z[p++] = a & 255
  const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer)
  hv.setUint32(0, w); hv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6
  const chunks: [string, Uint8Array][] = [['IHDR', ihdr], ['IDAT', z], ['IEND', new Uint8Array(0)]]
  const out = new Uint8Array(8 + chunks.reduce((n, c) => n + 12 + c[1].length, 0)), ov = new DataView(out.buffer)
  out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  let o = 8
  for (const [id, body] of chunks) {
    ov.setUint32(o, body.length)
    for (let i = 0; i < 4; i++) out[o + 4 + i] = id.charCodeAt(i)
    out.set(body, o + 8)
    let c = 0xffffffff
    for (let i = o + 4; i < o + 8 + body.length; i++) c = CRC[(c ^ out[i]) & 255] ^ (c >>> 8)
    ov.setUint32(o + 8 + body.length, (c ^ 0xffffffff) >>> 0)
    o += 12 + body.length
  }
  let bin = ''
  for (let i = 0; i < out.length; i += 0x8000) bin += String.fromCharCode(...out.subarray(i, i + 0x8000))
  return `data:image/png;base64,${btoa(bin)}`
}
