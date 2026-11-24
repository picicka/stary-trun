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
  /** Startovní pozice. V malém Údolí: 0 = hráč (jihozápad), 1 = východ, 2 = sever. Bývá jich i víc než národů. */
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

/** Typ krajiny náhodné mapy: jeden kontinent, několik kontinentů oddělených mořem, nebo souostroví. */
export type Landform = 'continent' | 'continents' | 'islands'

/** Nastavení mapy. Bez něj vzniká dosavadní mapa pro tři národy (40×26). */
export interface MapOptions {
  /** Počet národů (2–8). Určuje velikost mapy a nejmenší počet startů. */
  players: number
  /** Jen náhodná mapa (`random`). */
  landform?: Landform
  /** Jen náhodná mapa: −1 menší, 0 běžná, 1 větší než odpovídá počtu národů. */
  size?: -1 | 0 | 1
  /** Barbarské tábory: 0 žádné, 1 málo, 2 běžně, 3 hodně. */
  barbarians?: 0 | 1 | 2 | 3
}

/** Velikosti ručně navržených scénářů: pro kolik národů která je. */
export const TIERS: [number, number][] = [[2, 3], [4, 5], [6, 8]]
export const tierOf = (players: number): number => (players <= 3 ? 0 : players <= 5 ? 1 : 2)

/** Pevné seedy ručních scénářů podle velikosti (index = `tierOf`). */
export const VALLEY_SEEDS: number[] = [MISSION_SEED, 1300, 7142]
export const ISLANDS_SEEDS: number[] = [ISLANDS_SEED, 7671, 9281]

/** Ručně navržené rozvržení jedné velikosti scénáře. */
interface Hand {
  W: number
  H: number
  starts: [number, number][]
  ruins: [number, number]
  /** Horské hřebeny (lomené čáry) a průsmyky – místa, kde hřeben vždy povolí. */
  ridges: number[][][]
  passes: number[][]
  /** Zálivy a vnitřní moře: [střed x, střed y, poloosa x, poloosa y, síla]. */
  seas: number[][]
  /** Ostrovy: [střed x, střed y, poloměr]. */
  isles: number[][]
  /** Oblasti barbarských táborů; první polovina se použije i při nastavení „málo“. */
  camps: number[][]
}

/** Údolí Starého trůnu: malé (3 národy), střední (5) a velké (8). */
const VALLEY: Hand[] = [
  {
    W: MAP_W, H: MAP_H,
    starts: [[8, 18], [31, 16], [20, 4]],
    ruins: [20, 12],
    // Hřebeny: západní (odděluje jihozápad od severu) a východní (odděluje východ od středu).
    ridges: [
      [[3, 9], [8, 10], [12, 8], [15, 9]],
      [[26, 3], [26, 8], [27, 11]],
      [[27, 15], [26, 19], [27, 23]],
      [[13, 22], [17, 20], [21, 21]],
    ],
    passes: [[10, 9], [26, 6], [27, 13], [19, 20]],
    // Záliv na západě a moře na severovýchodě.
    seas: [[3, 14, 5.5, 3.2, 0.5], [33, 7, 3.2, 2.4, 0.55]],
    isles: [],
    camps: [[14, 14], [24, 17], [27, 9], [13, 4], [19, 22], [34, 21]],
  },
  {
    // Pět kotlin kolem středu, mezi sousedy paprskovité hřebeny s průsmykem.
    W: 52, H: 34,
    starts: [[26, 5], [39, 13], [35, 27], [17, 27], [13, 13]],
    ruins: [26, 17],
    ridges: [
      [[30, 13], [34, 9], [36, 5], [37, 2]],
      [[32, 19], [38, 20], [43, 22], [48, 23]],
      [[26, 22], [25, 26], [26, 29], [26, 32]],
      [[20, 19], [14, 20], [9, 22], [4, 23]],
      [[22, 13], [18, 9], [16, 5], [15, 2]],
    ],
    passes: [[35, 7], [40.5, 21], [25, 26], [11.5, 21], [17, 7]],
    // Záliv na východě a moře na severozápadě.
    seas: [[50, 18, 4.5, 2.6, 0.5], [6, 6, 4.2, 3, 0.55]],
    isles: [],
    camps: [[34, 8], [41, 22], [24, 27], [11, 22], [18, 8], [32, 16], [20, 17], [26, 11], [31, 23], [21, 23]],
  },
  {
    // Osm kotlin: dvě na severu, dvě na jihu a po dvou na východě a západě.
    W: 64, H: 42,
    starts: [[21, 6], [43, 6], [51, 14], [51, 28], [43, 36], [21, 36], [13, 28], [13, 14]],
    ruins: [32, 21],
    ridges: [
      [[32, 15], [31, 10], [32, 6], [32, 2]],
      [[38, 16], [43, 12], [48, 9], [53, 5], [56, 3]],
      [[40, 21], [46, 20], [53, 21], [61, 21]],
      [[38, 26], [43, 30], [48, 33], [53, 37], [56, 39]],
      [[32, 27], [33, 32], [32, 36], [32, 40]],
      [[26, 26], [21, 30], [16, 33], [11, 37], [8, 39]],
      [[24, 21], [18, 22], [11, 21], [3, 21]],
      [[26, 16], [21, 12], [16, 9], [11, 5], [8, 3]],
    ],
    passes: [[31, 10], [46, 10], [53, 21], [46, 32], [33, 32], [18, 32], [11, 21], [18, 10]],
    // Zálivy na severovýchodě a jihozápadě.
    seas: [[60, 4, 5, 3, 0.5], [4, 38, 5, 3, 0.5]],
    isles: [],
    camps: [[31, 10], [46, 10], [53, 21], [46, 32], [33, 32], [18, 32], [11, 21], [18, 10], [37, 18], [27, 24], [27, 18], [37, 24], [58, 9], [58, 34], [6, 9], [6, 33]],
  },
]

/** Souostroví: domovské ostrovy jsou první (jeden na start), za nimi ostrov s ruinami a neobydlené ostrůvky. */
const ISLANDS: Hand[] = [
  {
    W: MAP_W, H: MAP_H,
    starts: [[7, 19], [32, 18], [19, 5]],
    ruins: [20, 13],
    ridges: [], passes: [], seas: [],
    isles: [[7, 19, 5.4], [32, 18, 5.4], [19, 5, 5.2], [20, 13, 3.3], [5, 7, 2.7], [34, 6, 2.9], [13, 12, 2.1], [27, 11, 2.2], [20, 21, 2.8], [35, 12, 1.8], [12, 3, 1.8]],
    camps: [[5, 7], [34, 6], [20, 21], [13, 12], [27, 11], [20, 15]],
  },
  {
    W: 52, H: 34,
    starts: [[26, 6], [42, 13], [37, 27], [15, 27], [10, 13]],
    ruins: [26, 17],
    ridges: [], passes: [], seas: [],
    isles: [
      [26, 6, 5.3], [42, 13, 5.4], [37, 27, 5.3], [15, 27, 5.3], [10, 13, 5.4], [26, 17, 3.4],
      [16, 6, 2.2], [36, 6, 2.3], [46, 23, 2.4], [6, 23, 2.5], [26, 28, 2.7], [18, 18, 2.1], [34, 18, 2.1], [47, 4, 1.9], [4, 4, 1.8], [47, 30, 1.9], [4, 31, 1.7],
    ],
    camps: [[16, 6], [36, 6], [46, 23], [6, 23], [26, 28], [18, 18], [34, 18], [47, 4], [47, 30], [4, 4]],
  },
  {
    // Osm domovských ostrovů v prstenci, uvnitř i vně drobné ostrovy.
    W: 64, H: 42,
    starts: [[19, 7], [45, 7], [55, 15], [55, 28], [45, 35], [19, 35], [9, 28], [9, 15]],
    ruins: [32, 21],
    ridges: [], passes: [], seas: [],
    isles: [
      [19, 7, 5.3], [45, 7, 5.3], [55, 15, 5.4], [55, 28, 5.3], [45, 35, 5.3], [19, 35, 5.3], [9, 28, 5.4], [9, 15, 5.3], [32, 21, 3.5],
      [32, 5, 2.6], [32, 37, 2.6], [44, 21, 2.6], [20, 21, 2.6], [58, 4, 2.2], [6, 37, 2.2], [38, 14, 2.1], [26, 28, 2.1],
      [32, 12, 2], [32, 30, 2], [6, 4, 2.2], [58, 37, 2.1], [26, 14, 2.1], [38, 28, 2.1], [61, 21, 1.6], [3, 21, 1.6],
    ],
    camps: [[32, 5], [32, 37], [44, 21], [20, 21], [58, 4], [6, 37], [38, 14], [26, 28], [32, 12], [32, 30], [6, 4], [58, 37], [26, 14], [38, 28], [61, 21], [3, 21]],
  },
]

/** Rozměry náhodné mapy podle počtu národů (index = počet národů). */
const RANDOM_SIZES: [number, number][] = [[40, 26], [40, 26], [40, 26], [40, 26], [46, 30], [52, 34], [56, 36], [60, 40], [64, 42]]
const clampPlayers = (n: number): number => Math.max(2, Math.min(8, Math.round(n) || 3))

/** Rozměry mapy pro daný scénář a nastavení (souhlasí s tím, co vrátí generateScenario). */
export function mapSize(kind: ScenarioId, opts?: MapOptions): { W: number; H: number } {
  if (!opts) return { W: MAP_W, H: MAP_H }
  const players = clampPlayers(opts.players)
  if (kind !== 'random') { const h = (kind === 'islands' ? ISLANDS : VALLEY)[tierOf(players)]; return { W: h.W, H: h.H } }
  const [w, h] = RANDOM_SIZES[players]
  const k = opts.size === -1 ? 0.85 : opts.size === 1 ? 1.15 : 1
  return { W: Math.round(w * k), H: Math.round(h * k) }
}

/** Počet táborů: 2 na národ při běžném nastavení, polovina při „málo“, jedenapůlnásobek při „hodně“. */
function campTarget(base: number, barbarians: number): number {
  return barbarians <= 0 ? 0 : barbarians === 1 ? Math.ceil(base / 2) : barbarians === 2 ? base : Math.round(base * 1.5)
}

/** Souvislé oblasti průchozí pevniny: číslo oblasti pro každé pole (−1 = moře, hory) a jejich velikosti. */
function landAreas(tiles: Tile[], W: number, H: number): { area: Int32Array; sizes: number[] } {
  const area = new Int32Array(W * H).fill(-1)
  const sizes: number[] = []
  for (let s = 0; s < W * H; s++) {
    if (area[s] !== -1 || !TERRAIN[tiles[s].t].passable) continue
    const id = sizes.length
    let n = 0
    const stack = [s]
    area[s] = id
    while (stack.length) {
      const i = stack.pop()!
      n++
      for (let d = 0; d < 6; d++) {
        const [nx, ny] = neighborXY(i % W, (i / W) | 0, d)
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const ni = ny * W + nx
        if (area[ni] === -1 && TERRAIN[tiles[ni].t].passable) { area[ni] = id; stack.push(ni) }
      }
    }
    sizes.push(n)
  }
  return { area, sizes }
}

/** Úplné zadání pro stavbu jedné mapy. */
interface Plan {
  W: number
  H: number
  /** Tvar pevniny: ruční údolí, ostrovy kolem zadaných středů, nebo šumový kontinent. */
  land: 'valley' | 'isles' | 'wild'
  starts: [number, number][]
  ruins: [number, number]
  ridges: number[][][]
  passes: number[][]
  seas: number[][]
  isles: number[][]
  /** Mořské průlivy mezi kontinenty (lomené čáry). */
  channels: number[][][]
  /** Hledání startů v neznámé zemi: původní pro tři národy, nové pro libovolný počet, nebo žádné (starty jsou dané). */
  place: 'legacy' | 'fair' | null
  players: number
  /** Na kolik pevnin se starty dělí. */
  groups: number
  /** Přísné podmínky férovosti; při nesplnění stavba vrátí null a zkusí se jiný seed. */
  strict: boolean
  /** Tábory: ruční oblasti, původní náhodné rozmístění, nebo rovnoměrné rozmístění. */
  campMode: 'hand' | 'legacy' | 'auto'
  campSpots: number[][]
  campCount: number
}

/** Plán ručního scénáře dané velikosti. */
function handPlan(kind: ScenarioId, tier: number, barbarians: number): Plan {
  const h = (kind === 'islands' ? ISLANDS : VALLEY)[tier]
  return {
    W: h.W, H: h.H, land: kind === 'islands' ? 'isles' : 'valley',
    starts: h.starts.map(s => [s[0], s[1]] as [number, number]), ruins: [h.ruins[0], h.ruins[1]],
    ridges: h.ridges, passes: h.passes, seas: h.seas, isles: h.isles, channels: [],
    place: null, players: h.starts.length, groups: 1, strict: false,
    campMode: 'hand', campSpots: h.camps, campCount: campTarget(h.camps.length, barbarians),
  }
}

/** Původní náhodná mapa pro tři národy (volání bez nastavení). */
function legacyPlan(): Plan {
  const h = VALLEY[0]
  return {
    W: MAP_W, H: MAP_H, land: 'wild',
    starts: h.starts.map(s => [s[0], s[1]] as [number, number]), ruins: [h.ruins[0], h.ruins[1]],
    ridges: [], passes: [], seas: [], isles: [], channels: [],
    place: 'legacy', players: 3, groups: 1, strict: false,
    campMode: 'legacy', campSpots: [], campCount: 6,
  }
}

/** Vzdálenost středů ostrovů v téže metrice, jakou používá tvar ostrova (řady jsou hustší než sloupce). */
const isleDist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, (ay - by) * 1.12)

/** Plán náhodné mapy podle nastavení. Vrací null, když se rozvržení ostrovů na mapu nevejde. */
function wildPlan(seed: number, players: number, landform: Landform, size: number, barbarians: number, strict: boolean): Plan | null {
  const { W, H } = mapSize('random', { players, size: size as -1 | 0 | 1 })
  const R: RngHolder = { rng: seed ^ 0x2545f491 }
  const plan: Plan = {
    W, H, land: 'wild', starts: [], ruins: [W >> 1, H >> 1],
    ridges: [], passes: [], seas: [], isles: [], channels: [],
    place: 'fair', players, groups: 1, strict,
    campMode: 'auto', campSpots: [], campCount: campTarget(players * 2, barbarians),
  }
  if (landform === 'continents') {
    // Dva kontinenty dělí jeden průliv shora dolů, tři kontinenty průliv ve tvaru T.
    plan.groups = players >= 6 ? 3 : 2
    if (plan.groups === 2) {
      const xa = W * (0.42 + rand(R) * 0.16), xb = W * (0.42 + rand(R) * 0.16)
      const xm = (xa + xb) / 2 + (rand(R) - 0.5) * W * 0.12
      plan.channels = [[[xa, -3], [xm, H / 2], [xb, H + 3]]]
    } else {
      const flip = rand(R) < 0.5
      let vx = W * (0.4 + rand(R) * 0.05)
      if (flip) vx = W - vx
      const j = () => (rand(R) - 0.5) * 4
      const hy = H * (0.46 + rand(R) * 0.08), hy2 = H * (0.42 + rand(R) * 0.16)
      plan.channels = [
        [[vx + j(), -3], [vx, hy], [vx + j(), H + 3]],
        [[vx, hy], [flip ? vx / 2 : (vx + W) / 2, (hy + hy2) / 2 + j()], [flip ? -3 : W + 3, hy2]],
      ]
    }
  } else if (landform === 'islands') {
    // Uprostřed ostrov s ruinami, kolem něj domovské ostrovy co nejdál od sebe, mezi nimi ostrůvky.
    plan.land = 'isles'
    plan.place = null
    const rh = size < 0 ? 4.8 : 5.3
    let rr = size < 0 ? 2.8 : 3.3
    let cx = (W >> 1) + randInt(R, 3) - 1, cy = (H >> 1) + randInt(R, 3) - 1
    const mx = Math.ceil(rh + 1.6), my = Math.ceil(rh / 1.12 + 1.2)
    const box: [number, number][] = []
    for (let y = my; y <= H - 1 - my; y++) for (let x = mx; x <= W - 1 - mx; x++) box.push([x, y])
    const near = (c: [number, number], pts: [number, number][], skip = -1) => {
      let m = Infinity
      for (let i = 0; i < pts.length; i++) if (i !== skip) m = Math.min(m, isleDist(c[0], c[1], pts[i][0], pts[i][1]))
      return m
    }
    /** Domovské ostrovy: hladově nejvzdálenější místa, pak posouvání, dokud roste nejmenší rozestup. */
    const spread = (spots: [number, number][]): [number, number][] => {
      const homes: [number, number][] = [spots[randInt(R, spots.length)]]
      while (homes.length < players) homes.push(spots.reduce((b, c) => (near(c, homes) > near(b, homes) ? c : b)))
      for (let round = 0; round < 6; round++) for (let i = 0; i < homes.length; i++) {
        const b = spots.reduce((b, c) => (near(c, homes, i) > near(b, homes, i) ? c : b), homes[i])
        if (near(b, homes, i) > near(homes[i], homes, i)) homes[i] = b
      }
      return homes
    }
    const gapOf = (homes: [number, number][]) => homes.reduce((m, h, i) => Math.min(m, near(h, homes, i)), Infinity)
    const need = 2 * rh + 2.4
    const ring = box.filter(c => isleDist(c[0], c[1], cx, cy) >= rh + rr + 2.2)
    let homes = ring.length >= players ? spread(ring) : null
    if (!homes || gapOf(homes) < need) {
      // Na těsné mapě se ostrov s ruinami doprostřed nevejde: domovy se rozmístí bez něj
      // a ruiny dostanou ostrůvek v největší mezeře mezi nimi.
      if (box.length < players) return null
      homes = spread(box)
      if (strict && gapOf(homes) < need) return null
      let clear = -Infinity
      for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
        const c = Math.min(near([x, y], homes) - rh - 2, x - 1.5, W - 2.5 - x, (y - 1.5) * 1.12, (H - 2.5 - y) * 1.12)
        if (c > clear) { clear = c; cx = x; cy = y }
      }
      rr = Math.min(rr, clear)
      if (rr < 2) { if (strict) return null; rr = 2 }
    }
    for (const h of homes) plan.isles.push([h[0], h[1], rh + rand(R) * 0.15])
    plan.isles.push([cx, cy, rr])
    // Neobydlené ostrůvky: náhodná místa, poloměr podle toho, kolik je kolem volného moře.
    const want = players * 3 + 1
    for (let k = 0; k < players * 150 && plan.isles.length < players + 1 + want; k++) {
      const x = 3 + randInt(R, W - 6), y = 3 + randInt(R, H - 6)
      let r = Math.min(1.7 + rand(R) * 1.2, x - 1.5, W - 2.5 - x, (y - 1.5) * 1.12, (H - 2.5 - y) * 1.12)
      for (let i = 0; i < plan.isles.length; i++) {
        const o = plan.isles[i]
        r = Math.min(r, isleDist(x, y, o[0], o[1]) - o[2] - (i < players ? 2.2 : 1.6))
      }
      if (r >= 1.5) plan.isles.push([x, y, r])
    }
    plan.starts = homes.map(h => [h[0], h[1]] as [number, number])
    plan.ruins = [cx, cy]
  }
  return plan
}

/** Nejmenší rozestup startů. */
function minGap(starts: [number, number][]): number {
  let m = Infinity
  for (let i = 0; i < starts.length; i++) for (let j = 0; j < i; j++) m = Math.min(m, hexDist(starts[i][0], starts[i][1], starts[j][0], starts[j][1]))
  return m
}

export function generateScenario(seed?: number, kind: ScenarioId = 'valley', opts?: MapOptions): Scenario {
  const players = clampPlayers(opts?.players ?? 3)
  const tier = tierOf(players)
  const barbarians = opts?.barbarians ?? 2
  if (seed === undefined) seed = kind === 'islands' ? ISLANDS_SEEDS[tier] : kind === 'valley' ? VALLEY_SEEDS[tier] : MISSION_SEED
  if (kind !== 'random') return build(seed, handPlan(kind, tier, barbarians))!
  if (!opts) return build(seed, legacyPlan())!
  // Náhodná mapa: když krajina nevyjde férově (málo místa, rozpadlý kontinent, osamělý start),
  // zkusí se další seed odvozený z původního – výsledek je pořád určený jen seedem a nastavením.
  const landform = opts.landform ?? 'continent', size = opts.size ?? 0
  for (let a = 0; a < 24; a++) {
    const s = (seed + a * 7919) | 0
    const plan = wildPlan(s, players, landform, size, barbarians, true)
    const sc = plan && build(s, plan)
    if (sc) return sc
  }
  // Nouzově bez přísných podmínek (jeden kontinent, starty kdekoli na průchozí pevnině).
  return build(seed, wildPlan(seed, players, 'continent', size, barbarians, false)!)!
}

/** Postaví mapu podle plánu. Vrací null jen u přísného plánu, který se nepodařilo splnit. */
function build(seed: number, P: Plan): Scenario | null {
  const W = P.W, H = P.H
  const R: RngHolder = { rng: seed }
  const valley = P.land === 'valley', isles = P.land === 'isles'
  let starts = P.starts
  let ruins = P.ruins
  const ridges = P.ridges
  const passes = P.passes
  const rim = P.place === 'fair'

  const idx = (x: number, y: number) => y * W + x
  const tiles: Tile[] = []
  const elev: number[] = []
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = x + (y & 1) * 0.5
      const e = fbm(fx / 7, y / 6, seed)
      // Pevninská maska: u okrajů klesá do moře, zálivy a vnitřní moře ji prohlubují.
      const ex = Math.min(fx, W - 0.5 - fx) / 5.5
      const ey = Math.min(y, H - 1 - y) / 4.2
      const edge = Math.min(1, Math.min(ex, ey))
      let land = e * 0.5 + edge * 0.8
      for (const [cx, cy, rx, ry, k] of P.seas) land -= Math.max(0, 1 - Math.hypot((fx - cx) / rx, (y - cy) / ry)) * k
      if (isles) {
        // Souostroví: pevnina jen kolem středů ostrovů, okraj rozvlněný šumem.
        let best = -1
        for (const [cx, cy, r] of P.isles) best = Math.max(best, 1 - Math.hypot(fx - cx, (y - cy) * 1.12) / r)
        land = x < 1 || y < 1 || x > W - 2 || y > H - 2 ? 0 : 0.6 + (best - 0.14) * 0.5 + (e - 0.5) * 0.26
      } else if (!valley) {
        // Neznámá země: členitý kontinent s vnitřními moři podle šumu.
        land = e * 0.75 + edge * 0.62 - Math.max(0, fbm(fx / 9 + 300, y / 8 + 300, seed + 21) - 0.55) * 1.4
        // Průlivy mezi kontinenty: uprostřed vždy moře, břehy rozvlněné šumem.
        for (const ch of P.channels) {
          const d = distToPolyline(fx, y, ch) + (fbm(fx / 5 + 500, y / 5 + 500, seed + 41) - 0.5) * 3
          land -= Math.max(0, 1.5 - d * 0.4)
        }
        if (rim && (x < 1 || y < 1 || x > W - 2 || y > H - 2)) land = 0
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

  /** Počet polí použitelné pevniny (bez hor) do dané vzdálenosti. */
  const roomAt = (x: number, y: number, rad: number) => {
    let n = 0
    for (let yy = y - rad; yy <= y + rad; yy++) for (let xx = x - rad; xx <= x + rad; xx++) {
      if (xx < 0 || yy < 0 || xx >= W || yy >= H || hexDist(x, y, xx, yy) > rad) continue
      const tt = tiles[idx(xx, yy)].t
      if (TERRAIN[tt].land && tt !== 'mountain') n++
    }
    return n
  }

  // Neznámá země: starty co nejdál od sebe na místech s dostatkem pevniny, ruiny mezi nimi.
  if (P.place === 'legacy') {
    const room = (x: number, y: number) => roomAt(x, y, 2)
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
  } else if (P.place === 'fair') {
    // Libovolný počet národů: starty jen na největších pevninách, rozdělené úměrně jejich velikosti.
    const { area, sizes } = landAreas(tiles, W, H)
    const order = sizes.map((_, i) => i).sort((a, b) => sizes[b] - sizes[a]).slice(0, P.groups)
    const total = sizes.reduce((a, b) => a + b, 0)
    const top = order.reduce((a, i) => a + sizes[i], 0)
    if (order.length < P.groups || P.players < P.groups) return null
    if (P.strict && (top < total * 0.8 || sizes[order[order.length - 1]] < sizes[order[0]] * 0.3)) return null
    const cands: [number, number][][] = order.map(() => [])
    const inland: [number, number][][] = order.map(() => [])
    const loose: [number, number][][] = order.map(() => [])
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      const g = order.indexOf(area[idx(x, y)])
      if (g < 0) continue
      loose[g].push([x, y])
      if (roomAt(x, y, 2) < 15) continue
      const r4 = roomAt(x, y, 4)
      if (r4 >= 36) cands[g].push([x, y])
      if (r4 >= 46) inland[g].push([x, y])
    }
    // Počty startů na pevninu: úměrně velikosti, při čtyřech a více národech nikdo sám.
    const least = P.players >= 2 * P.groups ? 2 : 1
    const quota = order.map(() => least)
    for (let left = P.players - least * P.groups; left > 0; left--) {
      let g = 0
      for (let i = 1; i < order.length; i++) if (sizes[order[i]] / (quota[i] + 1) > sizes[order[g]] / (quota[g] + 1)) g = i
      quota[g]++
    }
    for (let g = 0; g < order.length; g++) {
      // Kde je dost místa ve vnitrozemí, starty neleží na výběžcích u pobřeží.
      if (inland[g].length >= quota[g] * 12) { cands[g] = inland[g]; continue }
      if (cands[g].length >= quota[g] * 4) continue
      if (P.strict) return null
      cands[g] = loose[g]
      if (cands[g].length < quota[g]) return null
    }
    const near = (c: [number, number], pts: ([number, number] | null)[], skip = -1) => {
      let m = Infinity
      for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (p && i !== skip) m = Math.min(m, hexDist(c[0], c[1], p[0], p[1])) }
      return m
    }
    // Nejdřív hladově nejvzdálenější body, pak se každý start posouvá, dokud tím roste jeho nejmenší rozestup.
    const group: number[] = []
    quota.forEach((q, g) => { for (let k = 0; k < q; k++) group.push(g) })
    const chosen: ([number, number] | null)[] = group.map(() => null)
    chosen[0] = cands[0][randInt(R, cands[0].length)]
    for (let n = 1; n < chosen.length; n++) {
      let bi = -1, bc: [number, number] | null = null, bd = -1
      for (let i = 0; i < chosen.length; i++) {
        if (chosen[i] || (i > 0 && group[i] === group[i - 1] && !chosen[i - 1])) continue
        for (const c of cands[group[i]]) { const d = near(c, chosen); if (d > bd) { bd = d; bc = c; bi = i } }
      }
      if (bi < 0) return null
      chosen[bi] = bc
    }
    for (let round = 0; round < 8; round++) {
      let moved = false
      for (let i = 0; i < chosen.length; i++) {
        let bd = near(chosen[i]!, chosen, i), bc = chosen[i]!
        for (const c of cands[group[i]]) { const d = near(c, chosen, i); if (d > bd) { bd = d; bc = c } }
        if (bc !== chosen[i]) { chosen[i] = bc; moved = true }
      }
      if (!moved) break
    }
    starts = chosen.map(c => c!)
    if (P.strict && minGap(starts) < 8) return null
    // Ruiny: vhodné místo nejblíž těžišti startů, ne blíž než 5 polí od kteréhokoli z nich.
    const mx = starts.reduce((a, s) => a + s[0], 0) / starts.length, my = starts.reduce((a, s) => a + s[1], 0) / starts.length
    let ok = cands.flat().filter(c => starts.every(s => hexDist(s[0], s[1], c[0], c[1]) >= 5))
    if (!ok.length) ok = loose.flat().filter(c => starts.every(s => hexDist(s[0], s[1], c[0], c[1]) >= 5))
    if (!ok.length) return null
    ruins = ok.reduce((b, c) => (Math.hypot(c[0] - mx, c[1] - my) < Math.hypot(b[0] - mx, b[1] - my) ? c : b))
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

  // Přísný plán souostroví: každý národ má vlastní ostrov s dostatkem místa.
  if (P.strict && isles) {
    const { area } = landAreas(tiles, W, H)
    const seen = new Set<number>([area[idx(ruins[0], ruins[1])]])
    for (const [sx, sy] of starts) {
      const a = area[idx(sx, sy)]
      if (seen.has(a) || roomAt(sx, sy, 2) < 15) return null
      seen.add(a)
    }
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
  let campSpots = P.campSpots.slice(0, P.campCount)
  if (P.campMode === 'legacy') {
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
  // Zbylé tábory (náhodná mapa s nastavením, „hodně“ barbarů u ručních map): volná pole v pořadí
  // daném hashem, se stejnými odstupy od startů a mezi sebou jako dřív (u doplňků k ručním o pole menší).
  if (P.campMode !== 'legacy' && camps.length < P.campCount) {
    const hand = P.campMode === 'hand'
    const free: [number, number, number][] = []
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const tl = tiles[idx(x, y)]
      if (!TERRAIN[tl.t].passable || tl.special || tl.res) continue
      if (starts.some(s => hexDist(s[0], s[1], x, y) < 7) || hexDist(ruins[0], ruins[1], x, y) < 3) continue
      free.push([x, y, hash(x, y, seed + 123)])
    }
    free.sort((a, b) => a[2] - b[2])
    for (const [x, y] of free) {
      if (camps.length >= P.campCount) break
      if (camps.some(c => hexDist(c[0], c[1], x, y) < (hand ? 5 : 6))) continue
      const tl = tiles[idx(x, y)]
      tl.special = 'camp'; tl.forest = false
      camps.push([x, y])
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
  // Počet řek roste s plochou mapy (6 na mapě 40×26).
  const maxRivers = Math.round(6 * W * H / (MAP_W * MAP_H))
  for (const [x, y] of cand) {
    if (sources.length >= maxRivers) break
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
