// Mapa mise „Údolí Starého trůnu“. Rozvržení je navržené ručně (pohoří, průsmyky,
// starty, ruiny, tábory), detaily terénu doplňuje šum s pevným seedem – mapa je tedy
// při každém spuštění stejná.
import type { ResourceId, ScenarioId, TerrainId } from './data.ts'
import { TERRAIN } from './data.ts'
import { hexDist, neighborXY } from './hex.ts'
import { rand, randInt, type RngHolder } from './rng.ts'
import type { Tile } from './types.ts'

export const MAP_W = 40
export const MAP_H = 26
export const MISSION_SEED = 7341
export const ISLANDS_SEED = 9127

export interface Scenario {
  W: number
  H: number
  tiles: Tile[]
  /** Startovní pozice: 0 = hráč (jihozápad), 1 = východ, 2 = sever. */
  starts: [number, number][]
  ruins: [number, number]
  camps: [number, number][]
}

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function smooth(t: number): number { return t * t * (3 - 2 * t) }

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y)
  const fx = smooth(x - xi), fy = smooth(y - yi)
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed)
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

function fbm(x: number, y: number, seed: number): number {
  return valueNoise(x, y, seed) * 0.6 + valueNoise(x * 2.1, y * 2.1, seed + 17) * 0.3 + valueNoise(x * 4.3, y * 4.3, seed + 31) * 0.1
}

/** Vzdálenost bodu od lomené čáry (v jednotkách polí). */
function distToPolyline(px: number, py: number, pts: number[][]): number {
  let best = Infinity
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1]
    const dx = bx - ax, dy = by - ay
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (d < best) best = d
  }
  return best
}

/** Ostrovy scénáře Souostroví: [střed x, střed y, poloměr]. První tři jsou domovské, čtvrtý nese ruiny. */
const ISLES = [[7, 19, 5.4], [32, 18, 5.4], [19, 5, 5.2], [20, 13, 3.3], [5, 7, 2.7], [34, 6, 2.9], [13, 12, 2.1], [27, 11, 2.2], [20, 21, 2.8], [35, 12, 1.8], [12, 3, 1.8]]

export function generateScenario(seed = MISSION_SEED, kind: ScenarioId = 'valley'): Scenario {
  const W = MAP_W, H = MAP_H
  const R: RngHolder = { rng: seed }
  const valley = kind === 'valley', isles = kind === 'islands'
  let starts: [number, number][] = isles ? [[7, 19], [32, 18], [19, 5]] : [[8, 18], [31, 16], [20, 4]]
  let ruins: [number, number] = isles ? [20, 13] : [20, 12]

  // Hřebeny: západní (odděluje jihozápad od severu) a východní (odděluje východ od středu).
  const ridges = !valley ? [] : [
    [[3, 9], [8, 10], [12, 8], [15, 9]],
    [[26, 3], [26, 8], [27, 11]],
    [[27, 15], [26, 19], [27, 23]],
    [[13, 22], [17, 20], [21, 21]],
  ]
  // Průsmyky – místa, kde hřeben vždy povolí.
  const passes = !valley ? [] : [[10, 9], [26, 6], [27, 13], [19, 20]]

  const idx = (x: number, y: number) => y * W + x
  const tiles: Tile[] = []
  const elev: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x + (y & 1) * 0.5
      const e = fbm(fx / 7, y / 6, seed)
      // Pevninská maska: u okrajů klesá do moře, západ je členitější (zálivy).
      const ex = Math.min(fx, W - 0.5 - fx) / 5.5
      const ey = Math.min(y, H - 1 - y) / 4.2
      const edge = Math.min(1, Math.min(ex, ey))
      const bay = valley ? Math.max(0, 1 - Math.hypot((fx - 3) / 5.5, (y - 14) / 3.2)) * 0.5 : 0 // záliv na západě
      const lake = valley ? Math.max(0, 1 - Math.hypot((fx - 33) / 3.2, (y - 7) / 2.4)) * 0.55 : 0 // moře na severovýchodě
      let land = e * 0.5 + edge * 0.8 - bay - lake
      if (isles) {
        // Souostroví: pevnina jen kolem středů ostrovů, okraj rozvlněný šumem.
        let best = -1
        for (const [cx, cy, r] of ISLES) best = Math.max(best, 1 - Math.hypot(fx - cx, (y - cy) * 1.12) / r)
        land = x < 1 || y < 1 || x > W - 2 || y > H - 2 ? 0 : 0.6 + (best - 0.14) * 0.5 + (e - 0.5) * 0.26
      } else if (!valley) {
        // Neznámá země: členitý kontinent s vnitřními moři podle šumu.
        land = e * 0.75 + edge * 0.62 - Math.max(0, fbm(fx / 9 + 300, y / 8 + 300, seed + 21) - 0.55) * 1.4
      }
      elev.push(e)
      let t: TerrainId
      if (land < 0.6) t = 'ocean'
      else {
        const moist = fbm(fx / 6 + 40, y / 5 + 40, seed + 5)
        // Jihovýchod je suchý, sever vlhký.
        const dry = (fx / W) * 0.45 + (y / H) * 0.4 - moist * 0.55
        if (dry > 0.42) t = 'desert'
        else if (dry > 0.22) t = 'plains'
        else t = 'grass'
        const rough = fbm(fx / 4 + 200, y / 3.5 + 200, seed + 13)
        if (rough > 0.62) t = 'hills'
        if (rough > (isles ? 0.84 : 0.76)) t = 'mountain'
      }
      tiles.push({ t, forest: false, res: null, imp: null, owner: -1, city: -1, variant: randInt(R, 3), special: null })
    }
  }

  // Hřebeny a průsmyky.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tl = tiles[idx(x, y)]
    if (!TERRAIN[tl.t].land) continue
    const fx = x + (y & 1) * 0.5
    let d = Infinity
    for (const r of ridges) d = Math.min(d, distToPolyline(fx, y, r))
    const wob = hash(x, y, seed + 99) * 0.5
    if (d < 0.75 + wob * 0.5) tl.t = 'mountain'
    else if (d < 1.7 + wob && tl.t !== 'mountain') tl.t = 'hills'
    for (const p of passes) {
      const pd = Math.hypot(fx - p[0], y - p[1])
      if (pd < 1.3) tl.t = pd < 0.8 ? 'plains' : 'hills'
    }
  }

  // Neznámá země: starty co nejdál od sebe na místech s dostatkem pevniny, ruiny mezi nimi.
  if (!valley && !isles) {
    const room = (x: number, y: number) => {
      let n = 0
      for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || hexDist(x, y, xx, yy) > 2) continue
        const tt = tiles[idx(xx, yy)].t
        if (TERRAIN[tt].land && tt !== 'mountain') n++
      }
      return n
    }
    const cand: [number, number][] = []
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      const tt = tiles[idx(x, y)].t
      if (TERRAIN[tt].land && tt !== 'mountain' && room(x, y) >= 15) cand.push([x, y])
    }
    if (cand.length >= 3) {
      const far = (pts: [number, number][]) => cand.reduce((b, c) => (Math.min(...pts.map(p => hexDist(p[0], p[1], c[0], c[1]))) > Math.min(...pts.map(p => hexDist(p[0], p[1], b[0], b[1]))) ? c : b))
      const first = cand[randInt(R, cand.length)]
      const second = far([first])
      const third = far([first, second])
      starts = [first, second, third]
      const mx = (first[0] + second[0] + third[0]) / 3, my = (first[1] + second[1] + third[1]) / 3
      const ok = cand.filter(c => starts.every(s => hexDist(s[0], s[1], c[0], c[1]) >= 5))
      if (ok.length) ruins = ok.reduce((b, c) => (Math.hypot(c[0] - mx, c[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? c : b))
    }
  }

  // Lesy: vlhké oblasti, hlavně sever a střed.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tl = tiles[idx(x, y)]
    if (tl.t !== 'grass' && tl.t !== 'plains' && tl.t !== 'hills') continue
    const fx = x + (y & 1) * 0.5
    const f = fbm(fx / 3.5 + 90, y / 3 + 90, seed + 9) + (1 - y / H) * 0.12
    const limit = tl.t === 'hills' ? 0.7 : tl.t === 'grass' ? 0.6 : 0.66
    if (f > limit) tl.forest = true
  }

  // Starty: úrodné okolí bez hor a lesa přímo na startu.
  for (const [sx, sy] of starts) {
    for (let y = sy - 2; y <= sy + 2; y++) for (let x = sx - 2; x <= sx + 2; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue
      const d = hexDist(sx, sy, x, y)
      const tl = tiles[idx(x, y)]
      if (d === 0) { tl.t = 'grass'; tl.forest = false }
      else if (d === 1) {
        if (!TERRAIN[tl.t].land || tl.t === 'mountain' || tl.t === 'desert') tl.t = hash(x, y, seed + 3) > 0.5 ? 'grass' : 'plains'
        if (hash(x, y, seed + 4) > 0.35) tl.forest = false
      } else if (d === 2 && tl.t === 'mountain') tl.t = 'hills'
    }
  }

  // Ruiny Starého trůnu: pahorek uprostřed údolí.
  {
    const [rx, ry] = ruins
    for (let d = 0; d < 6; d++) {
      const [nx, ny] = neighborXY(rx, ry, d)
      const tl = tiles[idx(nx, ny)]
      if (!TERRAIN[tl.t].land || tl.t === 'mountain') tl.t = 'grass'
    }
    const tl = tiles[idx(rx, ry)]
    tl.t = 'hills'; tl.forest = false; tl.special = 'ruins'
  }

  // Pobřežní vody = moře sousedící s pevninou.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tl = tiles[idx(x, y)]
    if (tl.t !== 'ocean') continue
    for (let d = 0; d < 6; d++) {
      const [nx, ny] = neighborXY(x, y, d)
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      if (TERRAIN[tiles[idx(nx, ny)].t].land) { tl.t = 'coast'; break }
    }
  }
  // V souostroví jsou mělčiny širší, aby se dalo plout podél břehů i mezi blízkými ostrovy.
  if (isles) {
    const wide: number[] = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (tiles[idx(x, y)].t !== 'ocean') continue
      for (let d = 0; d < 6; d++) {
        const [nx, ny] = neighborXY(x, y, d)
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        if (tiles[idx(nx, ny)].t === 'coast') { wide.push(idx(x, y)); break }
      }
    }
    for (const i of wide) tiles[i].t = 'coast'
  }

  // Suroviny – náhodně podle terénu.
  const place = (x: number, y: number, r: ResourceId) => { const tl = tiles[idx(x, y)]; if (!tl.res && !tl.special) { tl.res = r; return true } return false }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const tl = tiles[idx(x, y)]
    const h = rand(R)
    if (tl.special) continue
    if (starts.some(s => s[0] === x && s[1] === y)) continue
    if (tl.t === 'coast') { if (h < 0.08) tl.res = 'fish' }
    else if (tl.t === 'grass' && !tl.forest) { if (h < 0.05) tl.res = 'wheat'; else if (h < 0.085) tl.res = 'horses' }
    else if (tl.t === 'plains' && !tl.forest) { if (h < 0.05) tl.res = 'wheat'; else if (h < 0.09) tl.res = 'horses'; else if (h < 0.11) tl.res = 'stone' }
    else if (tl.t === 'desert') { if (h < 0.05) tl.res = 'gold'; else if (h < 0.1) tl.res = 'stone'; else if (h < 0.14) tl.res = 'wheat' }
    else if (tl.t === 'hills' && !tl.forest) { if (h < 0.06) tl.res = 'iron'; else if (h < 0.12) tl.res = 'gold'; else if (h < 0.19) tl.res = 'stone' }
    else if (tl.forest) { if (h < 0.1) tl.res = 'deer' }
  }

  // Zaručené suroviny u každého startu: obilí, koně, železo, kámen/zvěř.
  for (const [sx, sy] of starts) {
    const ring = (min: number, max: number, ok: (t: Tile) => boolean): [number, number][] => {
      const out: [number, number][] = []
      for (let y = sy - max; y <= sy + max; y++) for (let x = sx - max; x <= sx + max; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        const d = hexDist(sx, sy, x, y)
        if (d < min || d > max) continue
        const tl = tiles[idx(x, y)]
        if (!tl.res && !tl.special && ok(tl)) out.push([x, y])
      }
      return out
    }
    const has = (r: ResourceId, max: number) => {
      for (let y = sy - max; y <= sy + max; y++) for (let x = sx - max; x <= sx + max; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue
        if (hexDist(sx, sy, x, y) <= max && tiles[idx(x, y)].res === r) return true
      }
      return false
    }
    const ensure = (r: ResourceId, min: number, max: number, ok: (t: Tile) => boolean, convert?: (t: Tile) => void) => {
      if (has(r, max)) return
      let c = ring(min, max, ok)
      if (!c.length && convert) {
        c = ring(min, max, t => TERRAIN[t.t].land && t.t !== 'mountain')
        if (c.length) { const p = c[randInt(R, c.length)]; convert(tiles[idx(p[0], p[1])]); place(p[0], p[1], r) }
        return
      }
      if (c.length) { const p = c[randInt(R, c.length)]; place(p[0], p[1], r) }
    }
    const flat = (t: Tile) => (t.t === 'grass' || t.t === 'plains') && !t.forest
    ensure('wheat', 1, 2, flat, t => { t.t = 'grass'; t.forest = false })
    ensure('horses', 1, 3, flat, t => { t.t = 'plains'; t.forest = false })
    ensure('iron', 2, 3, t => t.t === 'hills' && !t.forest, t => { t.t = 'hills'; t.forest = false })
    ensure('stone', 1, 3, t => (t.t === 'hills' || t.t === 'plains') && !t.forest, t => { t.t = 'hills'; t.forest = false })
    ensure('deer', 1, 3, t => t.forest, t => { if (t.t === 'desert') t.t = 'plains'; t.forest = true })
  }

  // Barbarské tábory: ručně zvolené oblasti, přesná pozice = nejbližší vhodné pole.
  let campSpots = [[14, 14], [24, 17], [27, 9], [13, 4], [19, 22], [34, 21]]
  if (isles) campSpots = [[5, 7], [34, 6], [20, 21], [13, 12], [27, 11], [20, 15]]
  else if (!valley) {
    // Tábory rozprostřené daleko od startů i od sebe.
    campSpots = []
    for (let k = 0; k < 400 && campSpots.length < 6; k++) {
      const x = 2 + randInt(R, W - 4), y = 2 + randInt(R, H - 4)
      if (starts.some(s => hexDist(s[0], s[1], x, y) < 7) || campSpots.some(c => hexDist(c[0], c[1], x, y) < 6)) continue
      if (TERRAIN[tiles[idx(x, y)].t].passable) campSpots.push([x, y])
    }
  }
  const camps: [number, number][] = []
  for (const [cx, cy] of campSpots) {
    let best: [number, number] | null = null
    let bd = Infinity
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const tl = tiles[idx(x, y)]
      if (!TERRAIN[tl.t].passable || tl.special || tl.res) continue
      if (starts.some(s => hexDist(s[0], s[1], x, y) < 6)) continue
      if (hexDist(ruins[0], ruins[1], x, y) < 3) continue
      const d = hexDist(cx, cy, x, y)
      if (d < bd) { bd = d; best = [x, y] }
    }
    if (best && bd <= (isles ? 2 : 4)) {
      const tl = tiles[idx(best[0], best[1])]
      tl.special = 'camp'; tl.forest = false
      camps.push(best)
    }
  }

  // Řeky: z úpatí hor stékají nejkratší cestou k moři a vedou podél hran polí.
  const toSea = new Int32Array(W * H).fill(-1)
  let frontier: number[] = []
  for (let i = 0; i < W * H; i++) if (!TERRAIN[tiles[i].t].land) { toSea[i] = 0; frontier.push(i) }
  while (frontier.length) {
    const next: number[] = []
    for (const i of frontier) for (let d = 0; d < 6; d++) {
      const [nx, ny] = neighborXY(i % W, (i / W) | 0, d)
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const ni = idx(nx, ny)
      if (toSea[ni] !== -1 || tiles[ni].t === 'mountain') continue
      toSea[ni] = toSea[i] + 1; next.push(ni)
    }
    frontier = next
  }
  const mark = (x: number, y: number, d: number) => {
    const [nx, ny] = neighborXY(x, y, d)
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return
    const a = tiles[idx(x, y)], b = tiles[idx(nx, ny)]
    if (!TERRAIN[a.t].land || !TERRAIN[b.t].land) return
    a.river = (a.river ?? 0) | (1 << d)
    b.river = (b.river ?? 0) | (1 << ((d + 3) % 6))
  }
  const sources: [number, number][] = []
  const cand: [number, number, number][] = []
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = idx(x, y)
    if (tiles[i].t === 'mountain' || toSea[i] < (isles ? 3 : 5) || toSea[i] > 13) continue
    let nearMountain = false
    for (let d = 0; d < 6; d++) { const [nx, ny] = neighborXY(x, y, d); const nt = tiles[idx(nx, ny)]?.t; if (nt === 'mountain' || (isles && nt === 'hills')) nearMountain = true }
    if (nearMountain) cand.push([x, y, hash(x, y, seed + 77)])
  }
  cand.sort((a, b) => a[2] - b[2])
  for (const [x, y] of cand) {
    if (sources.length >= 6) break
    if (sources.some(o => hexDist(o[0], o[1], x, y) < 8)) continue
    sources.push([x, y])
  }
  const riverTiles = new Set<number>()
  for (const [sx, sy] of sources) {
    let x = sx, y = sy
    for (let guard = 0; guard < 30 && toSea[idx(x, y)] > 0; guard++) {
      let bd = -1, bh = 2
      for (let d = 0; d < 6; d++) {
        const [nx, ny] = neighborXY(x, y, d)
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const ni = idx(nx, ny)
        if (toSea[ni] !== toSea[idx(x, y)] - 1) continue
        const h = hash(nx, ny, seed + 91)
        if (h < bh) { bh = h; bd = d }
      }
      if (bd < 0) break
      const joined = riverTiles.has(idx(x, y))
      riverTiles.add(idx(x, y))
      mark(x, y, (bd + 1) % 6); mark(x, y, (bd + 2) % 6)
      if (joined) break
      ;[x, y] = neighborXY(x, y, bd)
    }
  }

  void elev
  return { W, H, tiles, starts, ruins, camps }
}

/** Textový náhled mapy pro ladění. */
export function asciiMap(s: Scenario): string {
  const ch: Record<TerrainId, string> = { ocean: '~', coast: '-', grass: ',', plains: '.', desert: ':', hills: 'n', mountain: 'A' }
  const rows: string[] = []
  for (let y = 0; y < s.H; y++) {
    let row = y & 1 ? ' ' : ''
    for (let x = 0; x < s.W; x++) {
      const tl = s.tiles[y * s.W + x]
      let c = ch[tl.t]
      if (tl.forest) c = tl.t === 'hills' ? 'F' : 'f'
      if (tl.res) c = tl.res === 'fish' ? '%' : tl.res[0].toUpperCase()
      if (tl.special === 'ruins') c = '@'
      if (tl.special === 'camp') c = 'X'
      const si = s.starts.findIndex(p => p[0] === x && p[1] === y)
      if (si >= 0) c = String(si)
      row += c + ' '
    }
    rows.push(row)
  }
  return rows.join('\n')
}
