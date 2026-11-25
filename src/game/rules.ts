// Pravidla hry: výnosy, města, pohyb, boj, průběh tahu. Bez závislosti na Phaseru.
import {
  ERAS, GOLDEN_TURNS, TUNE, TRADITIONS, TRADITION_IDS, traditionCost, type TraditionId, SCENARIOS, BUILDINGS, BUILDING_IDS, DIFFICULTY, IMPROVEMENTS, NATIONS, PROMO_IDS, RESOURCES, ROAD, TECHS, TECH_IDS, TERRAIN, UNITS, UNIT_IDS, XP_LEVELS, unitFor,
  type BuildingId, type ImprovementId, type PromoId, type ResourceId, type TechId, type UnitId, type Yields,
  PERSONAS, type PersonaId,
} from './data.ts'
import { hexDist, neighborXY } from './hex.ts'
import { rand } from './rng.ts'
import { barbId, type BuildItem, type City, type GameEvent, type GameState, type JobId, type Note, type Player, type Tile, type Unit } from './types.ts'

// ---------------------------------------------------------------- události

const events: GameEvent[] = []
export function emit(ev: GameEvent): void { events.push(ev) }
export function drainEvents(): GameEvent[] { return events.splice(0) }

/** Lidští hráči, kteří jsou ještě ve hře. */
export function humans(s: GameState): Player[] { return s.players.filter(p => p.human && p.alive) }

export function note(s: GameState, pid: number, text: string, kind: Note['kind'] = 'info', x?: number, y?: number): void {
  if (!s.players[pid]?.human) return
  s.notes.push({ pid, turn: s.turn, text, kind, x, y })
  // Každému hráči zůstává posledních 60 zpráv.
  let n = 0
  for (const o of s.notes) if (o.pid === pid) n++
  for (let i = 0; n > 60 && i < s.notes.length; i++) if (s.notes[i].pid === pid) { s.notes.splice(i--, 1); n-- }
}

/** Zpráva všem lidským hráčům. `own` přepíše text pro jednotlivé hráče (null = tomuto hráči nic), `only` omezí příjemce. */
export function noteAll(s: GameState, text: string | null, kind: Note['kind'] = 'info', x?: number, y?: number, own: Record<number, string | null> = {}, only?: (p: Player) => boolean): void {
  for (const h of humans(s)) {
    const t = h.id in own ? own[h.id] : only && !only(h) ? null : text
    if (t) note(s, h.id, t, kind, x, y)
  }
}

// ---------------------------------------------------------------- mapa

export const idx = (s: GameState, x: number, y: number): number => y * s.W + x
export const inMap = (s: GameState, x: number, y: number): boolean => x >= 0 && y >= 0 && x < s.W && y < s.H
export function tileAt(s: GameState, x: number, y: number): Tile | null { return inMap(s, x, y) ? s.tiles[y * s.W + x] : null }

export function neighbors(s: GameState, x: number, y: number): [number, number][] {
  const out: [number, number][] = []
  for (let d = 0; d < 6; d++) {
    const n = neighborXY(x, y, d)
    if (inMap(s, n[0], n[1])) out.push(n)
  }
  return out
}

export function tilesWithin(s: GameState, x: number, y: number, r: number): [number, number][] {
  const out: [number, number][] = []
  for (let yy = Math.max(0, y - r); yy <= Math.min(s.H - 1, y + r); yy++) {
    for (let xx = Math.max(0, x - r - 1); xx <= Math.min(s.W - 1, x + r + 1); xx++) {
      if (hexDist(x, y, xx, yy) <= r) out.push([xx, yy])
    }
  }
  return out
}

// ---------------------------------------------------------------- dotazy

export const isCivilian = (u: Unit): boolean => !!UNITS[u.type].civilian
export function unitsAt(s: GameState, x: number, y: number): Unit[] { return s.units.filter(u => u.x === x && u.y === y) }
export function militaryAt(s: GameState, x: number, y: number): Unit | undefined { return s.units.find(u => u.x === x && u.y === y && !isCivilian(u)) }
export function civilianAt(s: GameState, x: number, y: number): Unit | undefined { return s.units.find(u => u.x === x && u.y === y && isCivilian(u)) }
export function cityAt(s: GameState, x: number, y: number): City | undefined { return s.cities.find(c => c.x === x && c.y === y) }
export function cityById(s: GameState, id: number): City | undefined { return s.cities.find(c => c.id === id) }
export function unitById(s: GameState, id: number): Unit | undefined { return s.units.find(u => u.id === id) }
export function citiesOf(s: GameState, pid: number): City[] { return s.cities.filter(c => c.owner === pid) }
export function unitsOf(s: GameState, pid: number): Unit[] { return s.units.filter(u => u.owner === pid) }
export const hasTech = (p: Player, t: TechId): boolean => p.techs.includes(t)

export const isWater = (t: Tile): boolean => !TERRAIN[t.t].land
export const isNaval = (u: Unit): boolean => !!UNITS[u.type].naval
/** Pozemní jednotka na vodě pluje na člunech: nemůže útočit a brání se slabě. */
export function isEmbarked(s: GameState, u: Unit): boolean { return !isNaval(u) && isWater(s.tiles[idx(s, u.x, u.y)]) }
export function isCoastal(s: GameState, x: number, y: number): boolean { return neighbors(s, x, y).some(n => isWater(s.tiles[idx(s, n[0], n[1])])) }

/** Smí jednotka na dané pole (bez ohledu na obsazení)? Naloďovat se umí jen hráč; soupeři vodu nechávají lodím. */
export function canEnterTile(s: GameState, u: Unit, t: Tile): boolean {
  const d = UNITS[u.type]
  if (isWater(t)) {
    if (d.naval) return t.t === 'coast' || !!d.ocean
    const p = s.players[u.owner]
    if (!p.human && !u.sea) return false
    if (u.owner === barbId(s)) return t.t === 'coast'
    return hasTech(p, t.t === 'coast' ? 'sailing' : 'navigation')
  }
  return !d.naval && TERRAIN[t.t].passable
}

/** Pohyb na začátku tahu: naloděné jednotky plují pevnou rychlostí. */
/** Rychlost naloděných jednotek. */
export function embarkSpeed(p: Player): number { return (hasTech(p, 'navigation') ? 4 : 3) + (p.nation === 'thal' ? 1 : 0) + (p.traditions.includes('sea') ? 1 : 0) }

export function maxMoves(s: GameState, u: Unit): number {
  const p = s.players[u.owner]
  if (isEmbarked(s, u)) return embarkSpeed(p)
  return UNITS[u.type].move + (u.promos.includes('march') ? 1 : 0) + (UNITS[u.type].mounted && p.nation === 'tark' ? 1 : 0) + (isNaval(u) && p.nation === 'thal' ? 1 : 0) + (isNaval(u) && p.traditions.includes('sea') ? 1 : 0)
}

export function atWar(s: GameState, a: number, b: number): boolean {
  if (a === b) return false
  if (a === barbId(s) || b === barbId(s)) return true
  return s.players[a].war.includes(b)
}

export function resourceVisible(p: Player, r: ResourceId): boolean {
  const t = RESOURCES[r].tech
  return !t || hasTech(p, t)
}

/** Kolik jednotek uživí jeden zdroj strategické suroviny. */
export const UNITS_PER_SOURCE = 2

/** Počet vlastních zdrojů suroviny: pole ve vlastním území s patřičným vylepšením nebo pod městem. */
export function ownSources(s: GameState, pid: number, r: ResourceId): number {
  let n = 0
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i]
    if (t.owner !== pid || t.res !== r) continue
    if (t.imp === RESOURCES[r].improvement || s.cities.some(c => c.y * s.W + c.x === i)) n++
  }
  return n
}

/** Vlastní zdroj suroviny (bez nakoupených). */
export function ownsResource(s: GameState, pid: number, r: ResourceId): boolean { return ownSources(s, pid, r) > 0 }

/** Kolik jednotek může hráč se surovinou držet: vlastní zdroje + nakoupené − prodané, krát jednotek na zdroj. */
export function resourceCap(s: GameState, pid: number, r: ResourceId): number {
  let n = ownSources(s, pid, r)
  for (const d of s.deals) {
    if (d.res !== r) continue
    if (d.buyer === pid && ownsResource(s, d.seller, r)) n++
    if (d.seller === pid) n--
  }
  return Math.max(0, n) * UNITS_PER_SOURCE
}

/** Kolik kapacity už je zabrané: existující jednotky a rozestavěné v ostatních městech (město `exceptCity` se nepočítá). */
export function resourceUsed(s: GameState, pid: number, r: ResourceId, exceptCity = -1): number {
  let n = 0
  for (const u of s.units) if (u.owner === pid && UNITS[u.type].needs === r) n++
  for (const c of s.cities) if (c.owner === pid && c.id !== exceptCity && c.build?.kind === 'unit' && UNITS[c.build.id].needs === r) n++
  return n
}

export function resourceFree(s: GameState, pid: number, r: ResourceId, exceptCity = -1): number {
  return resourceCap(s, pid, r) - resourceUsed(s, pid, r, exceptCity)
}

/** Má hráč k surovině vůbec nějaký přístup (vlastní zdroj nebo koupi)? */
export function hasResource(s: GameState, pid: number, r: ResourceId): boolean { return resourceCap(s, pid, r) > 0 }

// ---------------------------------------------------------------- výnosy

export function tileYield(s: GameState, i: number, pid: number): Yields {
  const t = s.tiles[i]
  const p = s.players[pid]
  const nation = p.nation
  const td = TERRAIN[t.t]
  let food = td.food, prod = td.prod, gold = td.gold
  if (t.forest) { food = Math.min(food, 1); prod += 1; if (nation === 'sylv') prod += 1 }
  if (t.res && resourceVisible(p, t.res)) { const r = RESOURCES[t.res]; food += r.food; prod += r.prod; gold += r.gold; if (t.res === 'stone' && nation === 'morv') prod += 1 }
  if (t.imp) {
    const im = IMPROVEMENTS[t.imp]
    food += im.food; prod += im.prod; gold += im.gold
    if (t.imp === 'farm') { if (nation === 'aur') food += 1; if (hasTech(p, 'irrigation')) food += 1 }
    if (t.imp === 'mine' && nation === 'khar') prod += 1
    if (t.imp === 'pasture' && nation === 'tark') food += 1
  }
  if (t.t === 'coast' && nation === 'thal') gold += 1
  if (t.t === 'desert' && nation === 'zahi') gold += 1
  if (t.river && td.land) gold += 1
  return { food, prod, gold }
}

export interface CityYields { food: number; prod: number; gold: number; sci: number; culture: number; foodNet: number }

export function cityWorkable(s: GameState, c: City): number[] {
  const out: number[] = []
  for (const [x, y] of tilesWithin(s, c.x, c.y, 2)) {
    if (x === c.x && y === c.y) continue
    const i = idx(s, x, y)
    const t = s.tiles[i]
    if (t.owner !== c.owner || t.t === 'mountain') continue
    if (t.city !== c.id && t.city !== -1) continue
    out.push(i)
  }
  return out
}

/** Automaticky rozmístí obyvatele na nejlepší pole. */
export function assignWorkers(s: GameState, c: City): void {
  const cand = cityWorkable(s, c).filter(i => !s.cities.some(o => o.id !== c.id && o.owner === c.owner && o.worked.includes(i)))
  // Zabraná pole nepřítelem (stojí na nich nepřátelská jednotka) nelze obdělávat.
  const free = cand.filter(i => { const u = s.units.find(v => v.y * s.W + v.x === i && !isCivilian(v)); return !u || !atWar(s, u.owner, c.owner) })
  const needFood = c.pop <= 3 ? 3.2 : 2.6
  const score = (i: number) => { const y = tileYield(s, i, c.owner); return y.food * needFood + y.prod * 2.3 + y.gold * 1.2 }
  free.sort((a, b) => score(b) - score(a))
  c.worked = free.slice(0, c.pop)
}

export function cityYields(s: GameState, c: City): CityYields {
  const p = s.players[c.owner]
  const centre = tileYield(s, idx(s, c.x, c.y), c.owner)
  let food = Math.max(2, centre.food), prod = Math.max(1, centre.prod), gold = centre.gold + 1
  const has = (b: BuildingId) => c.buildings.includes(b)
  for (const i of c.worked) {
    const y = tileYield(s, i, c.owner); food += y.food; prod += y.prod; gold += y.gold
    if (has('harbor') && isWater(s.tiles[i])) food += 1
  }
  let sci = c.pop
  const culture = cultureSources(c, p, s.turn).reduce((a, x) => a + x[1], 0)
  if (c.capital) { prod += 1; gold += 2; sci += 2 }
  const tr = (id: TraditionId) => p.traditions.includes(id)
  if (tr('craft')) prod += 1
  if (tr('stores')) food += 1
  if (tr('trade')) gold += 2
  if (tr('scribes')) sci += has('library') ? 2 : 1
  if (s.turn < p.goldenUntil) { prod += 1; gold += 1 }
  if (has('harbor')) gold += 2
  if (has('granary')) food += 2
  if (has('workshop')) prod += 2
  if (has('library')) sci += 2 + Math.floor(c.pop / 2)
  if (p.nation === 'lume') sci += (has('library') ? 2 : 0) + (has('temple') ? 2 : 0)
  if (has('temple')) gold += 1
  if (has('academy')) sci = Math.round((sci + 3) * 1.25)
  if (has('court')) gold += 4
  if (has('market')) gold = Math.round((gold + 2) * 1.25)
  if (has('bank')) gold = Math.round((gold + 3) * 1.2)
  if (!p.human && c.owner !== barbId(s)) {
    const m = DIFFICULTY[s.difficulty].aiMult
    prod = Math.max(1, Math.round(prod * m)); sci = Math.max(1, Math.round(sci * m)); food = Math.round(food * (0.5 + m / 2))
  }
  return { food, prod, gold, sci, culture, foodNet: food - c.pop * 2 }
}

/** Odkud město bere kulturu (pro výpočet i pro nápovědu). */
export function cultureSources(c: City, p?: Player, turn = 0): [string, number][] {
  const out: [string, number][] = [['Město', 1]]
  if (p?.traditions.includes('feasts')) out.push(['Slavnosti', 2])
  if (p && turn < p.goldenUntil) out.push(['Zlatý věk', 1])
  if (c.capital) out.push(['Hlavní město', 1])
  if (c.buildings.includes('monument')) out.push(['Monument', 2])
  if (c.buildings.includes('temple')) out.push(['Chrám', 3])
  if (p?.nation === 'lume') { const n = Number(c.buildings.includes('library')) + Number(c.buildings.includes('temple')); if (n) out.push(['Světlo poznání', n]) }
  if (c.buildings.includes('wonder')) out.push(['Sluneční chrám', 4])
  return out
}

/** Kolik nastřádané kultury je třeba na 2. a 3. okruh hranic. */
export const BORDER_AT = [18, 90]

export function growthNeed(s: GameState, c: City): number {
  const base = Math.floor(11 + 6 * (c.pop - 1) + Math.pow(c.pop - 1, 1.5))
  return s.players[c.owner].nation === 'aur' ? Math.round(base * 0.85) : base
}

export function freeUnits(s: GameState, pid: number): number { return 3 + citiesOf(s, pid).length * 2 }

export interface Income { gold: number; sci: number; upkeep: number; maint: number; trade: number }
export function playerIncome(s: GameState, pid: number): Income {
  let gold = 0, sci = 0, maint = 0
  for (const c of citiesOf(s, pid)) {
    const y = cityYields(s, c)
    gold += y.gold; sci += y.sci
    for (const b of c.buildings) maint += BUILDINGS[b].maint
  }
  const mil = unitsOf(s, pid).filter(u => !isCivilian(u)).length
  const upkeep = Math.max(0, mil - freeUnits(s, pid))
  let trade = 0
  for (const d of s.deals) { if (d.seller === pid) trade += d.gpt; if (d.buyer === pid) trade -= d.gpt }
  return { gold: gold - maint - upkeep + trade, sci, upkeep, maint, trade }
}

// ---------------------------------------------------------------- území a viditelnost

export function claimTiles(s: GameState, c: City): void {
  for (const [x, y] of tilesWithin(s, c.x, c.y, c.radius)) {
    const t = s.tiles[idx(s, x, y)]
    if (t.owner !== -1) continue
    t.owner = c.owner; t.city = c.id
    // Strategická surovina v novém území stojí za zprávu.
    if (s.players[c.owner].human && t.res && RESOURCES[t.res].strategic && resourceVisible(s.players[c.owner], t.res) && !cityAt(s, x, y)) {
      const imp = RESOURCES[t.res].improvement
      const need = unitsNeeding(s, c.owner, t.res)
      note(s, c.owner, `Na území města ${c.name} je surovina ${RESOURCES[t.res].name.toLowerCase()}. ${need.length ? `Pošlete tam dělníky postavit ${imp === 'mine' ? 'důl' : 'ohradu'} – pak půjde stavět: ${need.join(', ')}.` : `Vaše vojsko ji nepotřebuje, ale s vylepšením (${imp === 'mine' ? 'důl' : 'ohrada'}) ji můžete prodávat v Diplomacii.`}`, 'good', x, y)
    }
  }
}

/** Jména jednotek hráče, které vyžadují danou surovinu. */
export function unitsNeeding(s: GameState, pid: number, r: ResourceId): string[] {
  const nation = s.players[pid].nation
  return UNIT_IDS.filter(id => UNITS[id].needs === r && (!UNITS[id].nation || UNITS[id].nation === nation) && !UNIT_IDS.some(o => UNITS[o].replaces === id && UNITS[o].nation === nation)).map(id => UNITS[id].name)
}

export interface ResourceInfo { res: ResourceId; known: boolean; improved: number[]; raw: number[]; bought: boolean; sold: boolean; cap: number; used: number }

/** Přehled surovin na území hráče: pole s vylepšením (surovina se využívá) a pole bez něj. */
export function resourceReport(s: GameState, pid: number): ResourceInfo[] {
  const p = s.players[pid]
  const out = new Map<ResourceId, ResourceInfo>()
  const get = (r: ResourceId) => { let o = out.get(r); if (!o) { o = { res: r, known: resourceVisible(p, r), improved: [], raw: [], bought: s.deals.some(d => d.buyer === pid && d.res === r), sold: s.deals.some(d => d.seller === pid && d.res === r), cap: resourceCap(s, pid, r), used: resourceUsed(s, pid, r) }; out.set(r, o) } return o }
  for (const r of Object.keys(RESOURCES) as ResourceId[]) if (RESOURCES[r].strategic) get(r)
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i]
    if (t.owner !== pid || !t.res || !resourceVisible(p, t.res)) continue
    const def = RESOURCES[t.res]
    const used = !def.improvement || t.imp === def.improvement || s.cities.some(c => c.y * s.W + c.x === i)
    ;(used ? get(t.res).improved : get(t.res).raw).push(i)
  }
  return [...out.values()].sort((a, b) => Number(!!RESOURCES[b.res].strategic) - Number(!!RESOURCES[a.res].strategic))
}

export function updateVisibility(s: GameState, pid: number): void {
  const p = s.players[pid]
  const n = s.W * s.H
  if (p.visible.length !== n) p.visible = new Array(n).fill(0)
  else p.visible.fill(0)
  if (p.explored.length !== n) p.explored = new Array(n).fill(0)
  const see = (x: number, y: number, r: number) => {
    for (const [tx, ty] of tilesWithin(s, x, y, r)) { const i = idx(s, tx, ty); p.visible[i] = 1; p.explored[i] = 1 }
  }
  for (const u of s.units) if (u.owner === pid) see(u.x, u.y, UNITS[u.type].sight ?? 2)
  for (const c of s.cities) if (c.owner === pid) see(c.x, c.y, c.radius + 1)
  // Setkání s jinými národy.
  if (pid !== barbId(s)) {
    for (const u of s.units) if (u.owner !== pid && u.owner !== barbId(s) && p.visible[idx(s, u.x, u.y)]) meet(s, pid, u.owner)
    for (const c of s.cities) if (c.owner !== pid && p.visible[idx(s, c.x, c.y)]) meet(s, pid, c.owner)
  }
}

function meet(s: GameState, a: number, b: number): void {
  const pa = s.players[a], pb = s.players[b]
  if (pa.met.includes(b)) return
  pa.met.push(b); pb.met.push(a)
  note(s, a, `Setkali jste se s národem ${NATIONS[pb.nation].name}. Vládne mu ${NATIONS[pb.nation].leader}.`, 'info')
  note(s, b, `Setkali jste se s národem ${NATIONS[pa.nation].name}. Vládne mu ${NATIONS[pa.nation].leader}.`, 'info')
}

// ---------------------------------------------------------------- pohyb

export function hasRoad(s: GameState, i: number): boolean {
  return !!s.tiles[i].road || s.cities.some(c => c.y * s.W + c.x === i)
}

/** Teče mezi dvěma sousedními poli řeka? */
export function riverBetween(s: GameState, from: number, to: number): boolean {
  const r = s.tiles[from].river
  if (!r) return false
  const x = from % s.W, y = (from / s.W) | 0
  for (let d = 0; d < 6; d++) if (r & (1 << d)) { const n = neighborXY(x, y, d); if (n[1] * s.W + n[0] === to && inMap(s, n[0], n[1])) return true }
  return false
}

/** Cena kroku ze sousedního pole `from` na `to`. Po cestě stojí krok půl bodu, brod přes řeku bod navíc. */
export function moveCost(s: GameState, u: Unit, from: number, to: number): number {
  const d = UNITS[u.type]
  const t = s.tiles[to]
  if (isWater(t)) return 1
  const road = hasRoad(s, from) && hasRoad(s, to)
  if (road) return 0.5
  const ford = riverBetween(s, from, to) ? 1 : 0
  if (d.ignoreTerrain) return 1 + ford
  const nation = s.players[u.owner].nation
  let c = TERRAIN[t.t].move
  if (t.t === 'hills' && nation === 'khar') c = 1
  if (t.forest && nation !== 'sylv') c = Math.max(c, 2)
  return c + ford
}

/** 0 = volno, 1 = lze projít, ale ne zastavit, 2 = neprůchodné. */
function blockLevel(s: GameState, u: Unit, x: number, y: number, occ: Map<number, Unit[]>): number {
  const i = idx(s, x, y)
  const t = s.tiles[i]
  if (!canEnterTile(s, u, t)) return 2
  const city = s.cities.find(c => c.x === x && c.y === y)
  if (city && city.owner !== u.owner) return 2
  const here = occ.get(i)
  if (!here) return 0
  const civ = isCivilian(u)
  let level = 0
  for (const o of here) {
    if (o.id === u.id) continue
    if (o.owner !== u.owner) {
      if (!isCivilian(o)) return 2
      // Cizí civilista: voják ve válce ho zajme, jinak blokuje.
      if (civ || !atWar(s, u.owner, o.owner)) return 2
    } else if (isCivilian(o) === civ) level = 1
  }
  return level
}

/** Nalodění a vylodění spotřebuje zbytek pohybu. */
function stepEndsTurn(s: GameState, u: Unit, from: number, to: number): boolean {
  return !isNaval(u) && isWater(s.tiles[from]) !== isWater(s.tiles[to])
}

function occupancy(s: GameState): Map<number, Unit[]> {
  const m = new Map<number, Unit[]>()
  for (const u of s.units) { const i = idx(s, u.x, u.y); const a = m.get(i); if (a) a.push(u); else m.set(i, [u]) }
  return m
}

export interface PathMap { dist: Float32Array; prev: Int32Array; stop: Uint8Array }

/** Dijkstra od jednotky. `budget` = jen pole dosažitelná v tomto tahu (pravidlo: s kladným zbytkem pohybu lze vždy udělat krok). */
export function pathMap(s: GameState, u: Unit, budget?: number, fogFor?: Player): PathMap {
  const n = s.W * s.H
  const dist = new Float32Array(n).fill(Infinity)
  const prev = new Int32Array(n).fill(-1)
  const stop = new Uint8Array(n)
  const occ = occupancy(s)
  const start = idx(s, u.x, u.y)
  const fullTurn = Math.max(2, UNITS[u.type].move)
  dist[start] = 0
  // Přihrádky po půlbodech pohybu (cesty stojí 0,5).
  const B = budget !== undefined ? Math.round(budget * 2) : undefined
  const buckets: number[][] = [[start]]
  for (let c = 0; c < buckets.length; c++) {
    const b = buckets[c]
    if (!b) continue
    for (let k = 0; k < b.length; k++) {
      const i = b[k]
      if (dist[i] * 2 !== c) continue
      if (B !== undefined && c >= B) continue
      const x = i % s.W, y = (i / s.W) | 0
      for (let d = 0; d < 6; d++) {
        const [nx, ny] = neighborXY(x, y, d)
        if (!inMap(s, nx, ny)) continue
        const ni = idx(s, nx, ny)
        let lvl: number
        if (fogFor && !fogFor.explored[ni]) lvl = 0
        else if (fogFor && !fogFor.visible[ni]) lvl = canEnterTile(s, u, s.tiles[ni]) && !s.cities.some(ct => ct.x === nx && ct.y === ny && ct.owner !== u.owner) ? 0 : 2
        else lvl = blockLevel(s, u, nx, ny, occ)
        if (lvl === 2) continue
        let nc = c + (stepEndsTurn(s, u, i, ni) ? (B ?? fullTurn * 2) : Math.round(moveCost(s, u, i, ni) * 2))
        if (B !== undefined && nc > B) nc = B
        if (nc / 2 < dist[ni]) {
          dist[ni] = nc / 2; prev[ni] = i; stop[ni] = lvl === 0 ? 1 : 0
          ;(buckets[nc] ??= []).push(ni)
        }
      }
    }
  }
  return { dist, prev, stop }
}

export function pathTo(s: GameState, pm: PathMap, tx: number, ty: number): [number, number][] | null {
  let i = idx(s, tx, ty)
  if (pm.dist[i] === Infinity) return null
  const out: [number, number][] = []
  while (pm.prev[i] !== -1) { out.push([i % s.W, (i / s.W) | 0]); i = pm.prev[i] }
  return out.reverse()
}

/** Pole, kam jednotka letos dojde a může tam zastavit. */
export function reachable(s: GameState, u: Unit): number[] {
  if (u.moves <= 0) return []
  const pm = pathMap(s, u, u.moves)
  const out: number[] = []
  for (let i = 0; i < pm.dist.length; i++) if (pm.dist[i] !== Infinity && pm.dist[i] > 0 && pm.stop[i]) out.push(i)
  // dist 0 je jen start; pole s cenou zaokrouhlenou na rozpočet jsou zahrnuta.
  return out
}

function clearOrders(u: Unit): void { u.fortified = false; u.sleep = false; u.work = null; u.workLeft = 0 }
/** Zruší cestu i frontu průjezdních bodů. */
export function stopUnit(u: Unit): void { u.goto = null; u.way = []; u.todo = null; u.roadTo = null }

/** Kolikátý tah od teď jednotka dorazí na konec cesty (0 = ještě v tomto tahu). */
export function pathTurns(s: GameState, u: Unit, path: [number, number][]): number {
  let turns = 0, moves = u.moves
  let cur = idx(s, u.x, u.y)
  const pl = s.players[u.owner]
  const speed = (i: number) => (!isNaval(u) && isWater(s.tiles[i]) ? embarkSpeed(pl) : UNITS[u.type].move + (u.promos.includes('march') ? 1 : 0) + (UNITS[u.type].mounted && pl.nation === 'tark' ? 1 : 0) + (isNaval(u) && pl.nation === 'thal' ? 1 : 0) + (isNaval(u) && pl.traditions.includes('sea') ? 1 : 0))
  for (const [x, y] of path) {
    const ni = idx(s, x, y)
    if (moves <= 0) { turns++; moves = speed(cur) }
    moves = stepEndsTurn(s, u, cur, ni) ? 0 : moves - Math.min(moves, moveCost(s, u, cur, ni))
    cur = ni
  }
  return turns
}

/** Posune jednotku směrem k cíli, kam až letos dojde. Vrací true, pokud se pohnula. */
export function moveUnit(s: GameState, u: Unit, tx: number, ty: number): boolean {
  if (u.x === tx && u.y === ty) { u.goto = null; const m = nextWaypoint(s, u); if (!u.goto) doTodo(s, u); return m }
  const p = s.players[u.owner]
  const pm = pathMap(s, u, undefined, p.human ? p : undefined)
  const path = pathTo(s, pm, tx, ty)
  if (!path) { stopUnit(u); return false }
  const walked: [number, number][] = [[u.x, u.y]]
  let lastStop = 0
  let moves = u.moves
  const occ = occupancy(s)
  const costs: number[] = []
  for (let k = 0; k < path.length && moves > 0; k++) {
    const [nx, ny] = path[k]
    const lvl = blockLevel(s, u, nx, ny, occ)
    if (lvl === 2) break
    const last = walked[walked.length - 1]
    const c = stepEndsTurn(s, u, idx(s, last[0], last[1]), idx(s, nx, ny)) ? moves : Math.min(moves, moveCost(s, u, idx(s, last[0], last[1]), idx(s, nx, ny)))
    moves -= c
    walked.push([nx, ny]); costs.push(c)
    if (lvl === 0) lastStop = walked.length - 1
  }
  if (lastStop === 0) {
    // Nelze se hnout (zablokováno); u cíle hned vedle rozkaz zrušíme.
    if (u.moves <= 0) u.goto = [tx, ty]; else { const todo = u.todo; stopUnit(u); if (todo) note(s, u.owner, 'Dělníci se na místo práce nedostali, cesta je zablokovaná.', 'info', u.x, u.y) }
    return false
  }
  walked.length = lastStop + 1
  let spent = 0
  for (let k = 0; k < lastStop; k++) spent += costs[k]
  clearOrders(u)
  u.moves = Math.max(0, u.moves - spent)
  const [fx, fy] = walked[lastStop]
  u.x = fx; u.y = fy
  u.goto = fx === tx && fy === ty ? null : [tx, ty]
  emit({ e: 'move', unit: u.id, owner: u.owner, path: walked })
  arrive(s, u)
  updateVisibility(s, u.owner)
  if (!u.goto) nextWaypoint(s, u)
  if (!u.goto) doTodo(s, u)
  return true
}

/** Dělníci po příchodu na místo začnou s naplánovanou prací. */
function doTodo(s: GameState, u: Unit): void {
  const job = u.todo
  if (!job || !s.units.includes(u)) return
  u.todo = null
  if (job === 'found') {
    // Osadníci došli na vybrané místo a usadí se.
    if (!foundCity(s, u)) note(s, u.owner, 'Osadníci dorazili, ale město tu už založit nejde. Vyberte jim jiné místo.', 'bad', u.x, u.y)
    return
  }
  if (!startWork(s, u, job)) note(s, u.owner, 'Dělníci dorazili, ale naplánovanou práci už tu provést nejde.', 'info', u.x, u.y)
}

/** Po dosažení cíle pokračuje k dalšímu bodu fronty. */
function nextWaypoint(s: GameState, u: Unit): boolean {
  if (!u.way?.length || !s.units.includes(u)) return false
  const [nx, ny] = u.way.shift()!
  if (u.moves > 0) return moveUnit(s, u, nx, ny)
  u.goto = [nx, ny]
  return false
}

/** Důsledky vstupu na pole: zajetí civilistů, ruiny, barbarský tábor. */
function arrive(s: GameState, u: Unit): void {
  const t = s.tiles[idx(s, u.x, u.y)]
  if (!isCivilian(u)) {
    for (const o of unitsAt(s, u.x, u.y)) {
      if (o.owner !== u.owner && isCivilian(o)) {
        if (o.type === 'worker' && u.owner !== barbId(s)) {
          note(s, o.owner, 'Vaši dělníci byli zajati!', 'bad', o.x, o.y)
          note(s, u.owner, 'Zajali jste nepřátelské dělníky.', 'good', o.x, o.y)
          o.owner = u.owner; clearOrders(o); stopUnit(o); o.auto = false; o.sea = false; o.moves = 0
        } else {
          note(s, o.owner, `${UNITS[o.type].name}: jednotka byla zničena nepřítelem.`, 'bad', o.x, o.y)
          killUnit(s, o)
        }
      }
    }
    if (t.special === 'camp' && u.owner !== barbId(s)) {
      t.special = null
      const pl = s.players[u.owner]
      pl.gold += 35
      for (const b of s.units) if (b.owner === barbId(s) && b.home === idx(s, u.x, u.y)) b.home = -1
      note(s, u.owner, 'Barbarský tábor vypálen! Kořist: 35 zlata.', 'good', u.x, u.y)
      emit({ e: 'sound', id: 'camp' })
      if (pl.human) {
        s.mission.campsDestroyed++
        if (s.mission.campsDestroyed >= 2 && !s.mission.questCamps) {
          s.mission.questCamps = true; s.mission.campsBy = pl.id
          pl.gold += 60
          note(s, pl.id, 'Vedlejší úkol splněn: kraj je bezpečnější. Odměna 60 zlata.', 'good')
        }
      }
    }
  }
  if (t.special === 'ruins' && u.owner !== barbId(s)) {
    t.special = null
    s.mission.ruinsBy = u.owner
    const pl = s.players[u.owner]
    pl.gold += 50
    const tech = cheapestTech(pl)
    if (tech) grantTech(s, pl, tech)
    if (pl.human) { s.mission.questRuins = true; emit({ e: 'sound', id: 'quest' }) }
    note(s, pl.id, `V ruinách Starého trůnu jste našli zlato (50) a staré svitky${tech ? ` – objevena technologie ${TECHS[tech].name}` : ''}.`, 'good', u.x, u.y)
    noteAll(s, `${NATIONS[pl.nation].name} vyplenili ruiny Starého trůnu dřív než vy.`, 'bad', u.x, u.y, { [pl.id]: null })
  }
}

// ---------------------------------------------------------------- technologie

export function availableTechs(p: Player): TechId[] {
  return TECH_IDS.filter(t => !p.techs.includes(t) && TECHS[t].req.every(r => p.techs.includes(r)))
}

function cheapestTech(p: Player): TechId | null {
  const a = availableTechs(p).sort((x, y) => TECHS[x].cost - TECHS[y].cost)
  if (p.research && a.includes(p.research)) return p.research
  return a[0] ?? null
}

export function grantTech(s: GameState, p: Player, t: TechId): void {
  if (p.techs.includes(t)) return
  p.techs.push(t)
  if (p.research === t) { p.research = null; p.progress = 0 }
  p.techQueue = p.techQueue.filter(q => q !== t)
  nextResearch(p)
  if (p.human) emit({ e: 'sound', id: 'tech' })
  if (p.id === barbId(s)) return
  if (p.human) {
    // Která vojska teď půjde přezbrojit.
    // Nově viditelné suroviny (železo po objevu bronzu).
    for (const r of Object.keys(RESOURCES) as ResourceId[]) {
      if (RESOURCES[r].tech !== t) continue
      const mine: number[] = []
      for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i].res === r && s.tiles[i].owner === p.id) mine.push(i)
      note(s, p.id, `Na mapě se objevila ložiska: ${RESOURCES[r].name.toLowerCase()}. ${mine.length ? `Na vašem území: ${mine.length} – postavte na nich důl.` : 'Na vašem území žádné není; hledejte je v okolí, založte u nich město, nebo surovinu kupte v Diplomacii.'}`, 'good', mine.length ? mine[0] % s.W : undefined, mine.length ? (mine[0] / s.W) | 0 : undefined)
    }
    const up = new Set<string>()
    for (const u of unitsOf(s, p.id)) { const to = upgradeTarget(s, u); if (to && UNITS[to].tech === t) up.add(`${UNITS[u.type].name} → ${UNITS[to].name}`) }
    if (up.size) note(s, p.id, `Nová výzbroj: ${[...up].join(', ')}. Jednotku vyberte na vlastním území a zvolte Přezbrojit (klávesa U).`, 'good')
  }
  const e = eraOf(p)
  if (e <= p.era) return
  p.era = e
  const first = s.eraFirst[e] === undefined
  if (first) { s.eraFirst[e] = p.id; p.goldenUntil = s.turn + GOLDEN_TURNS }
  const gold = 30 * e, cult = 15 * e
  p.gold += gold; p.culture += cult
  const name = ERAS[e].name
  if (p.human) {
    emit({ e: 'sound', id: 'quest' })
    s.popups.push({ pid: p.id, title: `Nový věk: ${name}`, text: `Váš lid vstoupil do nového věku. Milník přináší ${gold} zlata a ${cult} bodů kultury.${first ? ` Jste v něm první ze všech národů – nastává zlatý věk: po ${GOLDEN_TURNS} tahů dává každé vaše město +1 výrobu, +1 zlato a +1 kulturu.` : ` Jiný národ vás ale předběhl, zlatý věk připadl jemu.`}` })
    note(s, p.id, `Nový věk: ${name}.${first ? ' Zlatý věk!' : ''}`, 'good')
  }
  noteAll(s, `${NATIONS[p.nation].name} vstoupili do nového věku: ${name}${first ? ' (jako první – mají zlatý věk)' : ''}.`, 'info', undefined, undefined, { [p.id]: null }, h => h.met.includes(p.id))
}

/** Když se nic nezkoumá, vezme první dostupnou technologii z fronty. */
function nextResearch(p: Player): void {
  if (p.research) return
  const avail = availableTechs(p)
  const i = p.techQueue.findIndex(q => avail.includes(q))
  if (i >= 0) p.research = p.techQueue.splice(i, 1)[0]
}

/** Technologie, které je třeba objevit před `t` (včetně ní), v pořadí, v jakém to jde. */
export function techPath(p: Player, t: TechId): TechId[] {
  const out: TechId[] = []
  const visit = (id: TechId) => {
    if (p.techs.includes(id) || out.includes(id)) return
    for (const r of TECHS[id].req.slice().sort((a, b) => TECHS[a].cost - TECHS[b].cost)) visit(r)
    out.push(id)
  }
  visit(t)
  return out
}

/** Naplánuje výzkum až k technologii `t`: nahradí dosavadní plán, nebo (append) se zařadí za něj. */
export function planResearch(p: Player, t: TechId, append = false): boolean {
  if (p.techs.includes(t)) return false
  const path = techPath(p, t)
  if (append && p.research) {
    for (const id of path) if (id !== p.research && !p.techQueue.includes(id)) p.techQueue.push(id)
  } else {
    // Rozpracovaný výzkum neztrácí body: přejde se na první krok nové cesty.
    p.research = null
    p.techQueue = path
  }
  nextResearch(p)
  return true
}

export function eraOf(p: Player): number { return ERAS.filter(e => p.techs.length >= e.techs).length - 1 }

/** Může si národ vybrat další tradici? */
export function traditionReady(p: Player): boolean {
  return p.traditions.length < TRADITION_IDS.length && p.culture >= traditionCost(p.traditions.length)
}

/** Která tradice se národu právě hodí nejvíc (volba soupeřů i tip pro hráče): ve válce a výbojným bojové, jinak hospodářské. */
export function traditionAdvice(p: Player): TraditionId | null {
  const martial = (PERSONAS[p.personality as PersonaId]?.martial ?? false) || (p.human && p.war.length > 0)
  const pref: TraditionId[] = martial ? ['craft', 'warrior', 'stores', 'trade', 'militia', 'builders', 'scribes', 'feasts', 'settlers', 'sea'] : ['stores', 'craft', 'scribes', 'feasts', 'trade', 'settlers', 'builders', 'militia', 'sea', 'warrior']
  return pref.find(x => !p.traditions.includes(x)) ?? null
}

export function adoptTradition(_s: GameState, p: Player, id: TraditionId): boolean {
  if (!traditionReady(p) || p.traditions.includes(id)) return false
  p.culture -= traditionCost(p.traditions.length)
  p.traditions.push(id)
  return true
}

// ---------------------------------------------------------------- města

export function cityMaxHp(c: City): number { return TUNE.cityHp + (c.buildings.includes('walls') ? 60 : 0) + (c.buildings.includes('bastion') ? 40 : 0) }

export function cityStrength(s: GameState, c: City): number {
  let v = 7 + c.pop * 0.9 + s.players[c.owner].techs.length * 0.15
  if (c.buildings.includes('walls')) v *= 1.4
  if (c.buildings.includes('bastion')) v *= 1.25
  if (s.players[c.owner].traditions.includes('militia')) v *= 1.25
  if (s.players[c.owner].nation === 'morv') v *= 1.25
  const g = militaryAt(s, c.x, c.y)
  if (g && g.owner === c.owner) v += UNITS[g.type].str * 0.3
  return v
}

export function canFoundCity(s: GameState, u: Unit): string | null {
  if (u.type !== 'settler') return 'Město zakládají jen osadníci.'
  return foundBlock(s, u.owner, u.x, u.y)
}

/** Proč hráč `pid` na poli město založit nemůže, nebo null. */
export function foundBlock(s: GameState, pid: number, x: number, y: number): string | null {
  const t = s.tiles[idx(s, x, y)]
  if (!TERRAIN[t.t].passable) return 'Zde město stát nemůže.'
  if (t.owner !== -1 && t.owner !== pid) return 'Toto území patří jinému národu.'
  if (t.special) return 'Zde město stát nemůže.'
  for (const c of s.cities) if (hexDist(c.x, c.y, x, y) < 4) return 'Příliš blízko jiného města (nejméně 3 pole mezi městy).'
  return null
}

export function foundCity(s: GameState, u: Unit): City | null {
  if (canFoundCity(s, u)) return null
  const p = s.players[u.owner]
  const names = NATIONS[p.nation].cities
  const name = names[p.cityNames % names.length] + (p.cityNames >= names.length ? ' II' : '')
  p.cityNames++
  const first = !s.cities.some(c => c.founder === u.owner)
  const c: City = {
    id: s.nextId++, owner: u.owner, founder: u.owner, name, x: u.x, y: u.y, pop: p.traditions.includes('settlers') ? 2 : 1, food: 0, prod: 0, culture: 0, radius: 1,
    build: null, queue: [], buildings: [], hp: 200, capital: first, seat: first ? u.owner : -1, worked: [],
  }
  const t = s.tiles[idx(s, u.x, u.y)]
  t.forest = false; t.imp = null; t.owner = u.owner; t.city = c.id
  s.cities.push(c)
  s.units.splice(s.units.indexOf(u), 1)
  claimTiles(s, c)
  assignWorkers(s, c)
  updateVisibility(s, c.owner)
  emit({ e: 'found', city: c.id, x: c.x, y: c.y })
  if (p.human) {
    note(s, p.id, `Založili jste město ${c.name}.`, 'good', c.x, c.y)
    if (!s.mission.questCities && citiesOf(s, p.id).length >= 3) {
      s.mission.questCities = true; s.mission.citiesBy = p.id
      p.gold += 60
      note(s, p.id, 'Vedlejší úkol splněn: tři města pod vaší vládou. Odměna 60 zlata.', 'good')
      emit({ e: 'sound', id: 'quest' })
    }
  }
  noteAll(s, `${NATIONS[p.nation].name} založili město ${c.name}.`, 'info', c.x, c.y, { [p.id]: null }, h => !!h.visible[idx(s, c.x, c.y)])
  return c
}

/** Cena položky ve výrobě; s hráčem `p` včetně slevy jeho národa (Morvané stavějí budovy o 15 % levněji). */
export function itemCost(it: BuildItem, p?: Player): number {
  if (it.kind === 'unit') return UNITS[it.id].cost
  const cost = BUILDINGS[it.id].cost
  return p?.nation === 'morv' && it.id !== 'wonder' ? Math.round(cost * 0.85) : cost
}
export function itemName(it: BuildItem): string { return it.kind === 'unit' ? UNITS[it.id].name : BUILDINGS[it.id].name }

export function canBuildUnit(s: GameState, c: City, id: UnitId): boolean {
  const d = UNITS[id]
  const p = s.players[c.owner]
  if (d.nation && d.nation !== p.nation) return false
  // Běžná jednotka, kterou národ nahrazuje unikátní, není dostupná.
  if (UNIT_IDS.some(o => UNITS[o].replaces === id && UNITS[o].nation === p.nation)) return false
  if (d.tech && !hasTech(p, d.tech)) return false
  if (d.needs && resourceFree(s, c.owner, d.needs, c.id) <= 0) return false
  if (id === 'settler' && c.pop < 2) return false
  if (d.naval && !isCoastal(s, c.x, c.y)) return false
  return true
}

export function canBuildBuilding(s: GameState, c: City, id: BuildingId): boolean {
  const d = BUILDINGS[id]
  const p = s.players[c.owner]
  if (c.buildings.includes(id)) return false
  if (d.tech && !hasTech(p, d.tech)) return false
  if (id === 'harbor' && !isCoastal(s, c.x, c.y)) return false
  if (id === 'bastion' && !c.buildings.includes('walls')) return false
  if (id === 'wonder') {
    if (s.mission.wonderBy >= 0) return false
    const isW = (it: BuildItem | null) => it?.kind === 'building' && it.id === 'wonder'
    if (s.cities.some(o => o.owner === c.owner && o.id !== c.id && (isW(o.build) || o.queue.some(isW)))) return false
  }
  return true
}

export function availableBuilds(s: GameState, c: City): BuildItem[] {
  const out: BuildItem[] = []
  for (const id of UNIT_IDS) if (canBuildUnit(s, c, id)) out.push({ kind: 'unit', id })
  for (const id of BUILDING_IDS) if (canBuildBuilding(s, c, id)) out.push({ kind: 'building', id })
  return out
}

/** Proč jednotku zatím nelze stavět (pro nápovědu v UI), nebo null. */
export function unitBlockReason(s: GameState, c: City, id: UnitId): string | null {
  const d = UNITS[id]
  const p = s.players[c.owner]
  if (d.tech && !hasTech(p, d.tech)) return `Vyžaduje technologii ${TECHS[d.tech].name}`
  if (d.needs && !hasResource(s, c.owner, d.needs)) return `Vyžaduje surovinu ${RESOURCES[d.needs].name} (s vylepšením ve vašem území)`
  if (d.needs && resourceFree(s, c.owner, d.needs, c.id) <= 0) return `Zdroje suroviny ${RESOURCES[d.needs].name.toLowerCase()} jsou vytížené (${resourceUsed(s, c.owner, d.needs, c.id)} / ${resourceCap(s, c.owner, d.needs)} jednotek). Každý zdroj uživí ${UNITS_PER_SOURCE} jednotky – získejte další ložisko`
  if (id === 'settler' && c.pop < 2) return 'Město musí mít alespoň 2 obyvatele'
  if (d.naval && !isCoastal(s, c.x, c.y)) return 'Lodě lze stavět jen v pobřežním městě'
  return null
}

export function setBuild(_s: GameState, c: City, it: BuildItem | null): void {
  c.build = it
}

export const sameItem = (a: BuildItem | null, b: BuildItem | null): boolean => !!a && !!b && a.kind === b.kind && a.id === b.id
export const QUEUE_MAX = 8

function stillValid(s: GameState, c: City, it: BuildItem): boolean {
  return it.kind === 'unit' ? canBuildUnit(s, c, it.id) || it.id === 'settler' : canBuildBuilding(s, c, it.id)
}

/** Zařadí položku do výroby: na konec fronty, nebo (front) hned na řadu. Vrací důvod odmítnutí, nebo null. */
export function enqueue(s: GameState, c: City, it: BuildItem, front = false): string | null {
  if (!stillValid(s, c, it)) return 'Tuto položku teď město stavět nemůže.'
  if (it.kind === 'building' && (sameItem(c.build, it) || c.queue.some(q => sameItem(q, it)))) return 'Tato budova už ve frontě je.'
  if (!c.build) { c.build = it; return null }
  if (c.queue.length >= QUEUE_MAX) return 'Fronta výroby je plná.'
  if (front) { c.queue.unshift(c.build); c.build = it } else c.queue.push(it)
  return null
}

/** Odebere položku z fronty; i = −1 znamená právě stavěnou. */
export function dequeue(s: GameState, c: City, i: number): void {
  if (i < 0) c.build = nextQueued(s, c)
  else c.queue.splice(i, 1)
}

/** Položka fronty se začne stavět hned, dosavadní výroba se zařadí za ni. */
export function promote(_s: GameState, c: City, i: number): void {
  const [it] = c.queue.splice(i, 1)
  if (!it) return
  if (c.build) c.queue.unshift(c.build)
  c.build = it
}

function nextQueued(s: GameState, c: City): BuildItem | null {
  while (c.queue.length) {
    const it = c.queue.shift()!
    if (stillValid(s, c, it)) return it
  }
  return null
}

export function buyCost(s: GameState, c: City): number {
  if (!c.build) return 0
  const left = Math.max(0, itemCost(c.build, s.players[c.owner]) - c.prod)
  const m = s.players[c.owner].nation === 'thal' ? 0.7 : 1
  return Math.ceil(left * 2.6 * m)
}

export function canBuy(s: GameState, c: City): boolean {
  if (!c.build) return false
  if (c.build.kind === 'building' && c.build.id === 'wonder') return false
  const cost = buyCost(s, c)
  return cost > 0 && s.players[c.owner].gold >= cost
}

export function buy(s: GameState, c: City): boolean {
  if (!canBuy(s, c)) return false
  s.players[c.owner].gold -= buyCost(s, c)
  c.prod = itemCost(c.build!, s.players[c.owner])
  completeBuild(s, c)
  return true
}

/** Najde pole pro novou jednotku: město, jinak nejbližší volné okolí. */
function spawnSpot(s: GameState, c: City, civ: boolean, naval = false): [number, number] | null {
  const free = (x: number, y: number) => {
    const t = s.tiles[idx(s, x, y)]
    if (naval ? t.t !== 'coast' : !TERRAIN[t.t].passable) return false
    if (x !== c.x || y !== c.y) { if (cityAt(s, x, y)) return false }
    return !unitsAt(s, x, y).some(o => o.owner !== c.owner || isCivilian(o) === civ)
  }
  if (free(c.x, c.y)) return [c.x, c.y]
  for (let r = 1; r <= 2; r++) for (const [x, y] of tilesWithin(s, c.x, c.y, r)) if (free(x, y)) return [x, y]
  return null
}

export function makeUnit(s: GameState, owner: number, type: UnitId, x: number, y: number, vet = false): Unit {
  const u: Unit = {
    id: s.nextId++, owner, type, x, y, hp: 100, moves: UNITS[type].move, fortified: false, attacked: false, skip: false, sleep: false,
    vet, work: null, workLeft: 0, goto: null, way: [], auto: false, home: -1, todo: null, roadTo: null, xp: 0, promos: [], sea: false,
  }
  s.units.push(u)
  return u
}

function completeBuild(s: GameState, c: City): boolean {
  const it = c.build
  if (!it) return false
  if (it.kind === 'unit') {
    const civ = !!UNITS[it.id].civilian
    const spot = spawnSpot(s, c, civ, !!UNITS[it.id].naval)
    if (!spot) return false // není kam jednotku postavit, počkáme
    if (it.id === 'settler') {
      if (c.pop < 2) return false
      c.pop -= 1; assignWorkers(s, c)
    }
    const u = makeUnit(s, c.owner, it.id, spot[0], spot[1], c.buildings.includes('barracks') && !civ)
    u.moves = 0
    // Thalasské lodě vyplouvají se zkušenou posádkou.
    if (UNITS[it.id].naval && s.players[c.owner].nation === 'thal') gainXp(s, u, 10)
    if (!civ && s.players[c.owner].traditions.includes('warrior')) u.xp += 5
    emit({ e: 'spawn', unit: u.id, x: u.x, y: u.y })
    note(s, c.owner, `${c.name}: dokončena jednotka ${UNITS[it.id].name}.`, 'info', c.x, c.y)
    c.prod -= UNITS[it.id].cost
    // Pokračuje fronta; počítač si bez fronty vybere znovu (jinak by levnou jednotku stavěl pořád dokola).
    c.build = nextQueued(s, c)
  } else {
    c.buildings.push(it.id)
    c.prod -= itemCost(it, s.players[c.owner])
    c.build = nextQueued(s, c)
    note(s, c.owner, `${c.name}: dokončena stavba ${BUILDINGS[it.id].name}.`, 'good', c.x, c.y)
    if (it.id === 'walls') c.hp = Math.min(cityMaxHp(c), c.hp + 60)
    if (it.id === 'bastion') c.hp = Math.min(cityMaxHp(c), c.hp + 40)
    if (it.id === 'wonder') {
      s.mission.wonderBy = c.owner
      s.mission.wonderSince = s.turn
      // O chrámu se dozví celý svět: kdo jeho stavitele dosud neznal, teď ho zná (a může mu vyhlásit válku).
      for (const o of s.players) if (o.id !== c.owner && o.id !== barbId(s) && o.alive) meet(s, c.owner, o.id)
      noteAll(s, `${NATIONS[s.players[c.owner].nation].name} dostavěli Sluneční chrám ve městě ${c.name}! Udrží-li město ${WONDER_TURNS} tahů, zvítězí. Kdo město dobude, získá chrám pro sebe.`, 'war', c.x, c.y, { [c.owner]: `Sluneční chrám stojí! Udržte ${c.name} ${WONDER_TURNS} tahů a zvítězíte. Soupeři se ho pokusí dobýt.` })
      for (const o of s.cities) {
        o.queue = o.queue.filter(q => !(q.kind === 'building' && q.id === 'wonder'))
        if (o.build?.kind === 'building' && o.build.id === 'wonder') o.build = nextQueued(s, o)
      }
      emit({ e: 'sound', id: 'wonder' })
    }
  }
  c.prod = Math.max(0, c.prod)
  return true
}

function processCity(s: GameState, c: City): void {
  const p = s.players[c.owner]
  assignWorkers(s, c)
  const y = cityYields(s, c)
  // Jídlo a růst.
  c.food += y.foodNet
  const need = growthNeed(s, c)
  if (c.food >= need) {
    c.pop += 1
    c.food = c.buildings.includes('aqueduct') ? Math.floor(need * 0.4) : 0
    assignWorkers(s, c)
    if (c.pop % 3 === 0) note(s, c.owner, `${c.name} roste – už má ${c.pop} obyvatel.`, 'info', c.x, c.y)
  } else if (c.food < 0) {
    if (c.pop > 1) { c.pop -= 1; note(s, c.owner, `${c.name} hladoví, obyvatel ubylo.`, 'bad', c.x, c.y); assignWorkers(s, c) }
    c.food = 0
  }
  // Kultura a hranice.
  c.culture += y.culture
  const wantRadius = c.culture >= BORDER_AT[1] ? 3 : c.culture >= BORDER_AT[0] ? 2 : 1
  if (wantRadius > c.radius) { c.radius = wantRadius; claimTiles(s, c); note(s, c.owner, `${c.name}: hranice města se rozšířily.`, 'info', c.x, c.y) }
  // Výroba.
  if (c.build) {
    // Položka mohla mezitím přestat být dostupná (div dokončil někdo jiný).
    if (!stillValid(s, c, c.build)) c.build = nextQueued(s, c)
  }
  if (c.build) {
    c.prod += y.prod
    if (c.prod >= itemCost(c.build, p)) completeBuild(s, c)
  } else {
    // Bez zadání se výroba mění na zlato.
    p.gold += Math.floor(y.prod / 2)
  }
  // Opravy a střelba z hradeb.
  if (!besieged(s, c)) c.hp = Math.min(cityMaxHp(c), c.hp + TUNE.cityHeal)
  cityShoot(s, c)
}

function cityShoot(s: GameState, c: City): void {
  let target: Unit | null = null
  for (const u of s.units) {
    if (isCivilian(u) || !atWar(s, c.owner, u.owner)) continue
    if (hexDist(c.x, c.y, u.x, u.y) > 2) continue
    if (!target || u.hp < target.hp) target = u
  }
  if (!target) return
  const a = cityStrength(s, c) * 0.62
  const d = unitStrength(s, target, { defending: true }) * ramCover(s, target, c)
  // Ani obléhací stroj nepadne jedinou salvou z hradeb.
  const dmg = Math.min(45, damage(s, a, d))
  target.hp -= dmg
  emit({ e: 'cityShot', from: [c.x, c.y], to: [target.x, target.y], dmg })
  if (target.hp <= 0) {
    note(s, target.owner, `${UNITS[target.type].name} padl pod hradbami města ${c.name}.`, 'bad', target.x, target.y)
    note(s, c.owner, `${c.name} zničilo nepřátelskou jednotku (${UNITS[target.type].name}).`, 'good', target.x, target.y)
    killUnit(s, target)
  }
}

// ---------------------------------------------------------------- dělníci

export function validImprovements(s: GameState, u: Unit): ImprovementId[] {
  if (u.type !== 'worker' || isEmbarked(s, u)) return []
  const t = s.tiles[idx(s, u.x, u.y)]
  if (t.owner !== u.owner || cityAt(s, u.x, u.y) || t.special) return []
  return improvementsFor(s, t, s.players[u.owner])
}

/** Vylepšení, které se na pole hodí podle terénu a suroviny (bez ohledu na technologie). */
export function impCandidate(t: Tile, p: Player): ImprovementId | null {
  if (!TERRAIN[t.t].passable) return null
  const res = t.res && resourceVisible(p, t.res) ? t.res : null
  if (res === 'horses' || res === 'deer') return 'pasture'
  if (t.forest) return 'lumber'
  if (res === 'iron' || res === 'gold' || res === 'stone' || t.t === 'hills') return 'mine'
  if (t.t === 'grass' || t.t === 'plains' || (t.t === 'desert' && res === 'wheat')) return 'farm'
  return null
}

export function improvementsFor(_s: GameState, t: Tile, p: Player): ImprovementId[] {
  const c = impCandidate(t, p)
  return c && hasTech(p, IMPROVEMENTS[c].tech) && t.imp !== c ? [c] : []
}

export interface TileJob { job: JobId; name: string; effect: string; turns: number; ok: boolean; why: string }

/** Co mohou dělníci hráče `pid` na poli postavit a proč případně ne (pro nápovědu a rozkazy na dálku). */
export function tileJobs(s: GameState, i: number, pid: number): TileJob[] {
  const t = s.tiles[i], p = s.players[pid]
  const out: TileJob[] = []
  if (!TERRAIN[t.t].passable || t.special || s.cities.some(c => c.y * s.W + c.x === i)) return out
  const c = impCandidate(t, p)
  if (c) {
    const d = IMPROVEMENTS[c]
    const eff = [d.food ? `+${d.food + (c === 'farm' && p.nation === 'aur' ? 1 : 0)} jídlo` : '', d.prod ? `+${d.prod + (c === 'mine' && p.nation === 'khar' ? 1 : 0)} výroba` : '', t.res && RESOURCES[t.res].strategic && RESOURCES[t.res].improvement === c ? `zpřístupní ${RESOURCES[t.res].name.toLowerCase()}` : ''].filter(Boolean).join(', ')
    const why = t.imp === c ? 'už stojí' : t.owner !== pid ? 'pole není ve vašem území' : !hasTech(p, d.tech) ? `chybí technologie ${TECHS[d.tech].name}` : ''
    out.push({ job: c, name: d.name, effect: eff + (t.imp && t.imp !== c ? ` (nahradí: ${IMPROVEMENTS[t.imp].name.toLowerCase()})` : ''), turns: d.turns, ok: !why, why })
  }
  const whyR = t.road ? 'už stojí' : t.owner !== pid && t.owner !== -1 ? 'cizí území' : !hasTech(p, ROAD.tech) ? `chybí technologie ${TECHS[ROAD.tech].name}` : ''
  out.push({ job: 'road', name: ROAD.name, effect: 'pohyb po cestě stojí půl bodu, cesta překlene řeku', turns: ROAD.turns, ok: !whyR, why: whyR })
  return out
}

export function canWork(s: GameState, u: Unit, job: JobId): boolean {
  if (u.type !== 'worker' || isEmbarked(s, u)) return false
  return tileJobs(s, idx(s, u.x, u.y), u.owner).some(j => j.job === job && j.ok)
}

export function startWork(s: GameState, u: Unit, job: JobId): boolean {
  if (!canWork(s, u, job)) return false
  stopUnit(u)
  u.work = job; u.workLeft = Math.max(1, (job === 'road' ? ROAD.turns : IMPROVEMENTS[job].turns) - (s.players[u.owner].traditions.includes('builders') ? 1 : 0)); u.moves = 0; u.fortified = false; u.sleep = false
  return true
}

/** Stavba cesty na dálku: dělníci postaví cestu na poli, kde stojí, a pak popojdou na další pole trasy. */
export function roadStep(s: GameState, u: Unit): void {
  const goal = u.roadTo
  if (!goal || u.work || !s.units.includes(u)) return
  for (let guard = 0; guard < 3; guard++) {
    if (canWork(s, u, 'road')) { startWork(s, u, 'road'); u.roadTo = goal; return }
    if (u.x === goal[0] && u.y === goal[1]) { u.roadTo = null; note(s, u.owner, 'Dělníci dokončili cestu.', 'good', u.x, u.y); return }
    if (u.moves <= 0) return
    const p = s.players[u.owner]
    const path = pathTo(s, pathMap(s, u, undefined, p.human ? p : undefined), goal[0], goal[1])
    if (!path) { u.roadTo = null; note(s, u.owner, 'Dělníci se k cíli cesty nedostanou, stavba cesty končí.', 'info', u.x, u.y); return }
    const next = path.find(([x, y]) => tileJobs(s, idx(s, x, y), u.owner).some(j => j.job === 'road' && j.ok)) ?? goal
    const was = idx(s, u.x, u.y)
    moveUnit(s, u, next[0], next[1])
    if (!s.units.includes(u)) return
    u.goto = null; u.roadTo = goal
    if (idx(s, u.x, u.y) === was) return
  }
}

// ---------------------------------------------------------------- boj

export interface StrengthCtx { defending?: boolean; ranged?: boolean; vs?: Unit | null; vsCity?: boolean; river?: boolean; /** U města stojí vlastní beranidlo. */ ram?: boolean }

/** Kolikrát beranidlo násobí sílu pěchoty při útoku na město. */
export const RAM_BONUS = 1.5
/** Kolikrát beranidlo násobí obranu jednotek hned u města proti odvetě a střelbě z hradeb. */
export const RAM_COVER = 1.5
/** Střílející obléhací stroje: násobek síly proti městům a proti jednotkám. */
export const SIEGE_VS_CITY = 3
export const SIEGE_VS_UNIT = 0.5

/** Kryje jednotku u města `c` vlastní beranidlo? Vrací násobek její obrany proti městu. */
export function ramCover(s: GameState, u: Unit, c: City): number {
  return !UNITS[u.type].ram && hexDist(u.x, u.y, c.x, c.y) === 1 && ramAt(s, c, u.owner) ? RAM_COVER : 1
}
/** Kolik nepřátelských jednotek hned u města stačí, aby bylo v obležení a přestalo se opravovat. */
export const SIEGE_UNITS = 3

/** Stojí hned u města beranidlo hráče `pid`? */
export function ramAt(s: GameState, c: City, pid: number): boolean {
  return s.units.some(u => u.owner === pid && UNITS[u.type].ram && hexDist(u.x, u.y, c.x, c.y) === 1)
}

/** Město v obležení: hned u něj stojí aspoň SIEGE_UNITS bojových jednotek národů, se kterými válčí. Takové město se neopravuje. */
export function besieged(s: GameState, c: City): boolean {
  let n = 0
  for (const u of s.units) if (!isCivilian(u) && hexDist(u.x, u.y, c.x, c.y) === 1 && atWar(s, c.owner, u.owner) && ++n >= SIEGE_UNITS) return true
  return false
}

export function unitStrength(s: GameState, u: Unit, ctx: StrengthCtx = {}): number {
  const d = UNITS[u.type]
  if (isEmbarked(s, u)) return (s.players[u.owner].nation === 'thal' ? 8 : 4) * (0.5 + 0.5 * u.hp / 100)
  let base = ctx.ranged && d.ranged ? d.ranged : d.str
  let m = 1
  if (u.vet) m += 0.15
  const t = s.tiles[idx(s, u.x, u.y)]
  const nation = s.players[u.owner].nation
  if (ctx.defending) {
    m += TERRAIN[t.t].defense
    if (t.forest) m += nation === 'sylv' ? 0.5 : 0.25
    if (u.fortified) m += 0.25
    // Chrámová stráž brání domov.
    if (u.type === 'templar' && t.owner === u.owner) m += 0.25
  }
  if (nation === 'khar' && t.t === 'hills') m += 0.15
  if (u.promos.includes(ctx.defending ? 'guard' : 'drill')) m += ctx.defending ? 0.2 : 0.15
  if (!ctx.defending && s.players[u.owner].traditions.includes('warrior')) m += 0.1
  // Útok zblízka přes řeku je těžší.
  if (ctx.river) m -= 0.2
  if (d.antiMounted && ctx.vs && UNITS[ctx.vs.type].mounted) m += 0.5
  if (ctx.vsCity && ctx.ranged) m *= d.siege ? SIEGE_VS_CITY : 0.7
  // Stroje jsou stavěné na hradby; do pohyblivých jednotek se trefují špatně.
  if (!ctx.vsCity && ctx.ranged && d.siege && !ctx.defending) m *= SIEGE_VS_UNIT
  if (ctx.vsCity && d.mounted && !ctx.ranged) m *= 0.75
  if (ctx.vsCity && ctx.ram && !ctx.ranged) m *= RAM_BONUS
  if (base <= 0) base = 1
  return base * m * (0.5 + 0.5 * u.hp / 100)
}

function damageExpected(a: number, d: number): number {
  return Math.max(4, Math.min(100, 28 * Math.pow(a / d, 1.15)))
}
function damage(s: GameState, a: number, d: number): number {
  return Math.round(damageExpected(a, d) * (0.85 + rand(s) * 0.3))
}

export interface AttackPreview { ranged: boolean; city: City | null; target: Unit | null; dmgDef: number; dmgAtt: number; defHp: number; attHp: number; needWar: number; river: boolean }

/** Lze zaútočit na pole? Vrací náhled (očekávané ztráty), nebo null. */
export function previewAttack(s: GameState, u: Unit, x: number, y: number): AttackPreview | null {
  const d = UNITS[u.type]
  if (d.civilian || d.ram || u.attacked || u.moves <= 0) return null
  const dist = hexDist(u.x, u.y, x, y)
  const ranged = !!d.ranged
  if (dist === 0 || dist > (ranged ? d.range! : 1)) return null
  // Naloděné jednotky neútočí; zblízka se bojuje jen loď proti lodi a pěšák proti pěšákovi.
  if (isEmbarked(s, u)) return null
  if (!ranged && !!d.naval !== isWater(s.tiles[idx(s, x, y)])) return null
  const city = cityAt(s, x, y)
  const target = militaryAt(s, x, y)
  const foe = city && city.owner !== u.owner ? city.owner : target && target.owner !== u.owner ? target.owner : -1
  if (foe < 0) return null
  if (ranged && !s.players[u.owner].visible[idx(s, x, y)]) return null
  const needWar = atWar(s, u.owner, foe) ? -1 : foe
  const river = !ranged && riverBetween(s, idx(s, u.x, u.y), idx(s, x, y))
  if (city && city.owner !== u.owner) {
    const a = unitStrength(s, u, { ranged, vsCity: true, river, ram: !ranged && ramAt(s, city, u.owner) })
    const cs = cityStrength(s, city)
    return { ranged, city, target: null, dmgDef: Math.round(damageExpected(a, cs)), dmgAtt: ranged ? 0 : Math.round(damageExpected(cs, unitStrength(s, u, {}) * ramCover(s, u, city))), defHp: city.hp, attHp: u.hp, needWar, river }
  }
  if (!target) return null
  const a = unitStrength(s, u, { ranged, vs: target, river })
  const ds = unitStrength(s, target, { defending: true, vs: u })
  return { ranged, city: null, target, dmgDef: Math.round(damageExpected(a, ds)), dmgAtt: ranged ? 0 : Math.round(damageExpected(ds, a)), defHp: target.hp, attHp: u.hp, needWar, river }
}

export function killUnit(s: GameState, u: Unit): void {
  const i = s.units.indexOf(u)
  if (i >= 0) s.units.splice(i, 1)
  emit({ e: 'die', unit: u.id, x: u.x, y: u.y })
}

export function attack(s: GameState, u: Unit, x: number, y: number): boolean {
  const pv = previewAttack(s, u, x, y)
  if (!pv || pv.needWar >= 0) return false
  const d = UNITS[u.type]
  clearOrders(u); stopUnit(u)
  u.attacked = true
  u.moves = d.mounted && !pv.ranged ? Math.max(0, u.moves - 1) : 0
  const from: [number, number] = [u.x, u.y]
  if (pv.city) {
    const c = pv.city
    const a = unitStrength(s, u, { ranged: pv.ranged, vsCity: true, river: pv.river, ram: !pv.ranged && ramAt(s, pv.city, u.owner) })
    const cs = cityStrength(s, c)
    let dmgDef = damage(s, a, cs)
    const dmgAtt = pv.ranged ? 0 : damage(s, cs, unitStrength(s, u, {}) * ramCover(s, u, c))
    if (pv.ranged) dmgDef = Math.min(dmgDef, Math.max(0, c.hp - 1))
    c.hp -= dmgDef
    u.hp -= dmgAtt
    emit({ e: 'attack', unit: u.id, owner: u.owner, from, to: [x, y], ranged: pv.ranged, dmgDef, dmgAtt, city: true })
    gainXp(s, u, pv.ranged ? 2 : 4)
    if (u.hp <= 0) {
      note(s, u.owner, `${UNITS[u.type].name} padl při útoku na ${c.name}.`, 'bad', x, y)
      killUnit(s, u)
      if (c.hp <= 0) c.hp = 1
    } else if (c.hp <= 0) {
      captureCity(s, c, u)
    }
    if (c.owner !== u.owner) noteOnce(s, c.owner, `Město ${c.name} je pod útokem!`, 'bad', c.x, c.y)
    return true
  }
  const t = pv.target!
  const a = unitStrength(s, u, { ranged: pv.ranged, vs: t, river: pv.river })
  const ds = unitStrength(s, t, { defending: true, vs: u })
  const dmgDef = damage(s, a, ds)
  const dmgAtt = pv.ranged ? 0 : damage(s, ds, a)
  t.hp -= dmgDef
  u.hp -= dmgAtt
  emit({ e: 'attack', unit: u.id, owner: u.owner, from, to: [x, y], ranged: pv.ranged, dmgDef, dmgAtt, city: false })
  const an = NATIONS[s.players[u.owner].nation].name, tn = NATIONS[s.players[t.owner].nation].name
  // Oba nemohou padnout zároveň: přežije ten, kdo dopadl lépe.
  if (t.hp <= 0 && u.hp <= 0) { if (t.hp < u.hp) u.hp = 1; else t.hp = 1 }
  if (u.hp > 0) gainXp(s, u, (pv.ranged ? 2 : 4) + (t.hp <= 0 ? 3 : 0))
  if (t.hp > 0) gainXp(s, t, 2)
  if (t.hp <= 0) {
    note(s, t.owner, `Ztratili jste jednotku ${UNITS[t.type].name} (${an}).`, 'bad', x, y)
    note(s, u.owner, `${UNITS[u.type].name} zničil nepřátelskou jednotku ${UNITS[t.type].name} (${tn}).`, 'good', x, y)
    killUnit(s, t)
    if (!pv.ranged && !cityAt(s, x, y) && u.hp > 0) {
      // Vítěz postoupí na dobyté pole.
      if (!unitsAt(s, x, y).some(o => !isCivilian(o))) {
        u.x = x; u.y = y
        emit({ e: 'move', unit: u.id, owner: u.owner, path: [from, [x, y]] })
        arrive(s, u)
        updateVisibility(s, u.owner)
      }
    }
  } else if (u.hp <= 0) {
    note(s, u.owner, `${UNITS[u.type].name} padl v boji (${tn}).`, 'bad', x, y)
    note(s, t.owner, `${UNITS[t.type].name} odrazil útok (${an}).`, 'good', x, y)
    killUnit(s, u)
  }
  return true
}

// ---------------------------------------------------------------- zkušenosti a přezbrojení

export function xpLevel(u: Unit): number { return XP_LEVELS.filter(x => u.xp >= x).length }
/** Kolik povýšení si jednotka může vybrat. */
export function pendingPromos(u: Unit): number { return Math.max(0, Math.min(xpLevel(u), PROMO_IDS.length) - u.promos.length) }

function gainXp(s: GameState, u: Unit, n: number): void {
  if (isCivilian(u) || !s.units.includes(u)) return
  const before = pendingPromos(u)
  u.xp += n
  if (pendingPromos(u) <= before) return
  const p = s.players[u.owner]
  if (p.human) { note(s, p.id, `${UNITS[u.type].name} získal zkušenosti a čeká na povýšení.`, 'good', u.x, u.y); return }
  // Soupeři a barbaři volí sami.
  const pref: PromoId[] = UNITS[u.type].ranged ? ['drill', 'march', 'guard', 'medic'] : PERSONAS[p.personality as PersonaId]?.martial ? ['drill', 'guard', 'medic', 'march'] : ['guard', 'drill', 'medic', 'march']
  while (pendingPromos(u) > 0) promoteUnit(s, u, pref.find(x => !u.promos.includes(x))!)
}

export function promoteUnit(_s: GameState, u: Unit, id: PromoId): boolean {
  if (pendingPromos(u) <= 0 || u.promos.includes(id)) return false
  u.promos.push(id)
  u.hp = Math.min(100, u.hp + 25)
  return true
}

/** Na co lze jednotku přezbrojit (podle technologií a surovin), nebo null. */
export function upgradeTarget(s: GameState, u: Unit): UnitId | null {
  const p = s.players[u.owner]
  for (const base of UNITS[u.type].upgrade ?? []) {
    const id = unitFor(p.nation, base)
    const d = UNITS[id]
    if (id === u.type || (d.tech && !hasTech(p, d.tech)) || (d.needs && resourceFree(s, u.owner, d.needs) <= 0)) continue
    return id
  }
  return null
}

export function upgradeCost(s: GameState, u: Unit): number {
  const t = upgradeTarget(s, u)
  if (!t) return 0
  return Math.ceil((Math.max(0, UNITS[t].cost - UNITS[u.type].cost) * 2 + 10) * (s.players[u.owner].nation === 'thal' ? 0.7 : 1))
}

/** Proč přezbrojit nejde, nebo null. */
export function upgradeBlock(s: GameState, u: Unit): string | null {
  if (!upgradeTarget(s, u)) return 'Není na co přezbrojit.'
  if (s.tiles[idx(s, u.x, u.y)].owner !== u.owner) return 'Přezbrojit lze jen na vlastním území.'
  if (u.moves <= 0) return 'Jednotka už tento tah nemá pohyb.'
  if (s.players[u.owner].gold < upgradeCost(s, u)) return 'Nemáte dost zlata.'
  return null
}

export function upgradeUnit(s: GameState, u: Unit): boolean {
  if (upgradeBlock(s, u)) return false
  s.players[u.owner].gold -= upgradeCost(s, u)
  u.type = upgradeTarget(s, u)!
  u.moves = 0; u.fortified = false
  emit({ e: 'sound', id: 'build' })
  return true
}

function noteOnce(s: GameState, pid: number, text: string, kind: Note['kind'], x?: number, y?: number): void {
  if (s.notes.some(n => n.pid === pid && n.turn === s.turn && n.text === text)) return
  note(s, pid, text, kind, x, y)
}

function captureCity(s: GameState, c: City, by: Unit): void {
  const old = c.owner
  const oldP = s.players[old], newP = s.players[by.owner]
  // Posádka i civilisté ve městě padnou.
  for (const o of unitsAt(s, c.x, c.y)) if (o.owner === old) killUnit(s, o)
  if (by.owner === barbId(s)) {
    // Barbaři města nedrží – vyplení je.
    c.hp = Math.floor(cityMaxHp(c) / 2)
    c.pop = Math.max(1, c.pop - 1)
    const loot = Math.min(oldP.gold, 40)
    oldP.gold -= loot
    assignWorkers(s, c)
    note(s, old, `Barbaři vyplenili ${c.name}! Ztratili jste ${loot} zlata a část obyvatel.`, 'bad', c.x, c.y)
    return
  }
  c.owner = by.owner
  if (!TUNE.softCapture) c.pop = Math.max(1, c.pop - 1)
  c.hp = Math.floor(cityMaxHp(c) * (TUNE.softCapture ? 0.75 : 0.5))
  c.build = null; c.queue = []; c.prod = 0; c.food = 0
  c.buildings = c.buildings.filter(b => b !== 'walls' && b !== 'bastion')
  if (c.capital) {
    c.capital = false
    const next = citiesOf(s, old).sort((a, b) => b.pop - a.pop)[0]
    if (next) next.capital = true
  }
  if (!citiesOf(s, by.owner).some(o => o.capital)) c.capital = true
  for (const t of s.tiles) if (t.city === c.id) t.owner = by.owner
  claimTiles(s, c)
  for (const o of s.cities) assignWorkers(s, o)
  const was: [number, number] = [by.x, by.y]
  by.x = c.x; by.y = c.y
  emit({ e: 'move', unit: by.id, owner: by.owner, path: [was, [c.x, c.y]] })
  emit({ e: 'capture', city: c.id, x: c.x, y: c.y, by: by.owner })
  const loot = Math.min(oldP.gold, 30 + c.pop * 8)
  oldP.gold -= loot; newP.gold += loot
  note(s, by.owner, `Dobyli jste město ${c.name}! Kořist: ${loot} zlata.`, 'good', c.x, c.y)
  note(s, old, `Ztratili jste město ${c.name}!`, 'bad', c.x, c.y)
  noteAll(s, `${NATIONS[newP.nation].name} dobyli město ${c.name} (${NATIONS[oldP.nation].name}).`, 'war', c.x, c.y, { [old]: null, [by.owner]: null })
  // Pád sídla: zbytek národa se vzdá dobyvateli.
  if (TUNE.surrender && c.seat === old && old !== barbId(s)) {
    for (const o of citiesOf(s, old)) {
      o.owner = by.owner; o.capital = false; o.build = null; o.queue = []; o.prod = 0
      for (const t of s.tiles) if (t.city === o.id) t.owner = by.owner
    }
    for (const u of unitsOf(s, old)) killUnit(s, u)
    for (const o of s.cities) assignWorkers(s, o)
    noteAll(s, `Sídlo ${c.name} padlo a ${NATIONS[oldP.nation].name} se vzdali. Jejich města připadla národu ${NATIONS[newP.nation].name}.`, 'war', c.x, c.y)
  }
  updateVisibility(s, by.owner); updateVisibility(s, old)
  checkElimination(s, old)
  checkVictory(s)
}

function checkElimination(s: GameState, pid: number): void {
  const p = s.players[pid]
  if (!p.alive || pid === barbId(s)) return
  if (citiesOf(s, pid).length > 0) return
  if (s.units.some(u => u.owner === pid && u.type === 'settler')) return
  p.alive = false
  for (const u of unitsOf(s, pid)) killUnit(s, u)
  for (const o of s.players) { o.war = o.war.filter(w => w !== pid) }
  p.war = []
  s.offers = s.offers.filter(o => o.from !== pid && o.to !== pid)
  noteAll(s, `Národ ${NATIONS[p.nation].name} byl vyhlazen.`, 'war')
}

// ---------------------------------------------------------------- diplomacie

export function declareWar(s: GameState, a: number, b: number): void {
  if (a === b || atWar(s, a, b)) return
  const pa = s.players[a], pb = s.players[b]
  pa.war.push(b); pb.war.push(a)
  pa.lastWarTurn = s.turn; pb.lastWarTurn = s.turn
  s.offers = s.offers.filter(o => !(o.from === a && o.to === b) && !(o.from === b && o.to === a))
  s.deals = s.deals.filter(d => !((d.seller === a && d.buyer === b) || (d.seller === b && d.buyer === a)))
  if (pa.human && !pb.human) { pb.attitude[a] = Math.max(-100, pb.attitude[a] - 50); pb.pactUntil[a] = 0 }
  if (!pa.met.includes(b)) { pa.met.push(b); pb.met.push(a) }
  noteAll(s, `${NATIONS[pa.nation].name} vyhlásili válku národu ${NATIONS[pb.nation].name}.`, 'war', undefined, undefined, {
    [b]: `${NATIONS[pa.nation].name} vám vyhlásili válku!`,
    [a]: `Vyhlásili jste válku národu ${NATIONS[pb.nation].name}.`,
  })
  emit({ e: 'sound', id: 'war' })
}

export function makePeace(s: GameState, a: number, b: number): void {
  const pa = s.players[a], pb = s.players[b]
  pa.war = pa.war.filter(w => w !== b); pb.war = pb.war.filter(w => w !== a)
  pa.peaceUntil[b] = s.turn + 12; pb.peaceUntil[a] = s.turn + 12
  s.offers = s.offers.filter(o => !(o.kind !== 'ally' && ((o.from === a && o.to === b) || (o.from === b && o.to === a))))
  if (pa.human && !pb.human) pb.attitude[a] = Math.min(100, pb.attitude[a] + 10)
  if (pb.human && !pa.human) pa.attitude[b] = Math.min(100, pa.attitude[b] + 10)
  noteAll(s, `${NATIONS[pa.nation].name} a ${NATIONS[pb.nation].name} uzavřeli mír.`, 'info', undefined, undefined, {
    [a]: `Uzavřeli jste mír s národem ${NATIONS[pb.nation].name}.`,
    [b]: `Uzavřeli jste mír s národem ${NATIONS[pa.nation].name}.`,
  })
}

export function militaryPower(s: GameState, pid: number): number {
  let v = 0
  for (const u of s.units) if (u.owner === pid && !isCivilian(u)) { const d = UNITS[u.type]; v += Math.max(d.str, d.ranged ?? 0) * (0.4 + 0.6 * u.hp / 100) }
  return v
}

// ---------------------------------------------------------------- skóre a vítězství

export function score(s: GameState, pid: number): number {
  const p = s.players[pid]
  let v = p.techs.length * 6 + p.traditions.length * 5 + p.era * 8
  for (const c of citiesOf(s, pid)) v += 12 + c.pop * 4 + c.buildings.length * 3 + (c.buildings.includes('wonder') ? 60 : 0)
  for (const t of s.tiles) if (t.owner === pid) v += 0.5
  const m = s.mission
  v += (m.questCamps && (m.campsBy ?? 0) === pid ? 20 : 0) + (m.questCities && (m.citiesBy ?? 0) === pid ? 20 : 0) + (m.questRuins && m.ruinsBy === pid ? 25 : 0)
  return Math.round(v)
}

/** Kolik tahů je třeba držet většinu cizích sídel k vítězství dobytím. */
export const CONQUEST_TURNS = 5
/** Kolik tahů je třeba udržet město se Slunečním chrámem. */
export const WONDER_TURNS = 15
/** Město, kde stojí Sluneční chrám. */
export function wonderCity(s: GameState): City | null { return s.cities.find(c => c.buildings.includes('wonder')) ?? null }
/** Kolik tahů zbývá držiteli chrámu do vítězství (null = chrám nestojí). */
export function wonderLeft(s: GameState): number | null {
  return s.mission.wonderBy >= 0 ? Math.max(0, WONDER_TURNS - (s.turn - (s.mission.wonderSince ?? s.turn))) : null
}

/** Původní sídelní města soupeřů hráče `pid`: kolik jich je a kolik jich hráč drží. */
export function seatCount(s: GameState, pid: number): { held: number; need: number; total: number } {
  const seats = s.cities.filter(c => c.seat >= 0 && c.seat !== pid)
  const n = seats.length
  const need = TUNE.seatNeed === 'third' ? Math.max(1, Math.ceil(n / 3)) : TUNE.seatNeed === 'half' ? Math.max(1, Math.ceil(n / 2)) : Math.floor(n / 2) + 1
  return { held: seats.filter(c => c.owner === pid).length, need, total: n }
}

function holdsMajority(s: GameState, pid: number): boolean {
  const own = s.cities.find(c => c.seat === pid)
  if (!own || own.owner !== pid) return false
  const n = seatCount(s, pid)
  return n.total > 0 && n.held >= n.need
}

function conquered(s: GameState, w: Player): void {
  const sc = SCENARIOS[s.scenario], name = NATIONS[w.nation].name
  s.over = w.human
    ? { won: true, winner: w.id, kind: 'conquest', title: 'Vítězství – dobytí', text: `Sídla vašich soupeřů padla. ${sc.name} má jediného vládce a ${name} píší jeho zákony.`, other: `Sídla soupeřů padla. ${sc.name} má jediného vládce a zákony tu píší ${name}.` }
    : { won: false, winner: w.id, kind: 'defeat', title: 'Porážka', text: `Sídla národů padla. ${sc.name} má jediného vládce a zákony tu píší ${name}.` }
}

export function checkVictory(s: GameState): void {
  if (s.over) return
  const majors = s.players.filter(p => p.id !== barbId(s))
  const sc = SCENARIOS[s.scenario]
  const nm = (p: Player) => NATIONS[p.nation].name
  // Div: kdo dostaví Sluneční chrám a udrží jeho město WONDER_TURNS tahů, vyhrává. Dobytím města přechází chrám na dobyvatele.
  const temple = s.mission.wonderBy >= 0 ? wonderCity(s) : null
  if (s.mission.wonderBy >= 0 && !temple) { s.mission.wonderBy = -1; delete s.mission.wonderSince }
  if (temple && temple.owner !== s.mission.wonderBy) {
    const was = s.players[s.mission.wonderBy], now = s.players[temple.owner]
    s.mission.wonderBy = now.id; s.mission.wonderSince = s.turn
    noteAll(s, `${nm(now)} dobyli ${temple.name} a zmocnili se Slunečního chrámu! Udrží-li město ${WONDER_TURNS} tahů, zvítězí.`, 'war', temple.x, temple.y, { [now.id]: `Sluneční chrám je váš! Udržte ${temple.name} ${WONDER_TURNS} tahů a zvítězíte.`, [was.id]: `Přišli jste o ${temple.name} i o Sluneční chrám. Získejte město zpět, než ${nm(now)} zvítězí.` })
  }
  if (temple && s.mission.wonderSince === undefined) s.mission.wonderSince = s.turn
  if (temple && s.turn - s.mission.wonderSince! >= WONDER_TURNS) {
    const w = s.players[s.mission.wonderBy]
    const lost = `${nm(w)} udrželi Sluneční chrám ${WONDER_TURNS} tahů. Kraj se klaní jinému trůnu.`
    s.over = w.human
      ? { won: true, winner: w.id, kind: 'wonder', title: 'Vítězství – Sluneční chrám', text: `${sc.over} se rozzářil Sluneční chrám. Poutníci ze všech krajů se klaní vaší moudrosti a ${nm(w)} vejdou do dějin jako dědicové staré říše.`, other: lost }
      : { won: false, winner: w.id, kind: 'defeat', title: 'Porážka', text: lost }
    s.over.how = 'wonder'
    return
  }
  // Lidský hráč bez měst i osadníků vypadává; hra končí, když nezbývá žádný.
  for (const h of majors) if (h.human) checkElimination(s, h.id)
  const alive = humans(s)
  // (Hra bez lidí – simulace počítač proti počítači – tímhle nekončí.)
  if (!alive.length && majors.some(p => p.human)) {
    s.over = { won: false, winner: -1, kind: 'defeat', title: 'Porážka', text: 'Vaše poslední město padlo. Kronikáři o vašem lidu napíší jen krátkou poznámku.' }
    return
  }
  // Poslední národ na mapě vítězí hned.
  const standing = majors.filter(p => p.alive)
  if (standing.length === 1 && s.cities.some(c => c.owner === standing[0].id)) { conquered(s, standing[0]); s.over!.how = 'conquest'; return }
  // Dobytí: národ drží vlastní sídlo a nadpoloviční většinu cizích sídelních měst po CONQUEST_TURNS tahů.
  const holder = majors.find(p => p.alive && holdsMajority(s, p.id))
  if (!holder) {
    if (s.conquest) noteAll(s, `${nm(s.players[s.conquest.by])} přišli o většinu sídelních měst. Odpočet dobytí končí.`, 'info', undefined, undefined, { [s.conquest.by]: 'Přišli jste o většinu sídelních měst. Odpočet dobytí končí.' })
    s.conquest = null
  } else if (s.conquest?.by !== holder.id) {
    s.conquest = { by: holder.id, since: s.turn }
    noteAll(s, `${nm(holder)} drží většinu sídelních měst! Udrží-li je ${CONQUEST_TURNS} tahů, zvítězí dobytím.`, 'war', undefined, undefined, { [holder.id]: `Držíte většinu sídelních měst. Udržte je ${CONQUEST_TURNS} tahů a zvítězíte dobytím.` })
  } else if (s.turn - s.conquest.since >= TUNE.conquestTurns) { conquered(s, holder); s.over!.how = 'conquest'; return }
  if (s.turn > s.maxTurns) {
    // Sláva: nejvyšší skóre; při shodě má přednost lidský hráč.
    const rank = majors.filter(p => p.alive).map(r => ({ r, v: score(s, r.id) })).sort((a, b) => b.v - a.v || Number(b.r.human) - Number(a.r.human) || a.r.id - b.r.id)
    const top = rank[0], next = rank[1]
    const lost = (v: number) => `Čas vypršel. ${nm(top.r)} vás zastínili (skóre ${top.v} proti vašim ${v}) a Starý trůn připadl jim.`
    if (top.r.human) {
      s.over = { won: true, winner: top.r.id, kind: 'score', title: 'Vítězství – nejslavnější říše', text: `Po ${s.maxTurns} letech soupeření je váš lid nejmocnější ${sc.inPlace} (skóre ${top.v}${next ? ` proti ${next.v}` : ''}). Rada starších vám svěřuje Starý trůn.`, other: `Čas vypršel. ${nm(top.r)} vás zastínili (skóre ${top.v}) a Starý trůn připadl jim.` }
    } else {
      s.over = { won: false, winner: top.r.id, kind: 'defeat', title: 'Porážka', text: lost(Math.max(...alive.map(h => score(s, h.id)))) }
    }
    s.over.how = 'score'
  }
}

// ---------------------------------------------------------------- tah

export function unitMaxMoves(u: Unit): number { return UNITS[u.type].move }

/** Začátek tahu hráče: obnova pohybu, pokračování v cestě. */
export function beginTurn(s: GameState, pid: number): void {
  for (const u of unitsOf(s, pid)) { u.moves = maxMoves(s, u); u.attacked = false; u.skip = false }
  updateVisibility(s, pid)
  if (s.players[pid].human) {
    for (const u of unitsOf(s, pid)) {
      // Spící jednotku probudí nepřítel na dohled.
      if (u.sleep && enemyNear(s, u, 2)) u.sleep = false
      if (!u.goto) continue
      // Nepřítel na dohled cestu přeruší, ať hráč rozhodne sám.
      if (enemyNear(s, u, 2)) { stopUnit(u); continue }
      moveUnit(s, u, u.goto[0], u.goto[1])
    }
    for (const u of unitsOf(s, pid)) if (u.roadTo && !u.work) { if (enemyNear(s, u, 2)) stopUnit(u); else roadStep(s, u) }
  }
}

export function enemyNear(s: GameState, u: Unit, r: number): boolean {
  return s.units.some(o => o.owner !== u.owner && !isCivilian(o) && atWar(s, u.owner, o.owner) && hexDist(u.x, u.y, o.x, o.y) <= r)
}

/** Konec tahu hráče: léčení, práce dělníků, města, výzkum, pokladna. */
export function endPlayerTurn(s: GameState, pid: number): void {
  const p = s.players[pid]
  if (!p.alive) return
  for (const u of unitsOf(s, pid)) {
    const rested = u.moves >= maxMoves(s, u) && !u.attacked
    if (rested && u.hp < 100) {
      const t = s.tiles[idx(s, u.x, u.y)]
      const inCity = !!cityAt(s, u.x, u.y)
      u.hp = Math.min(100, u.hp + (inCity ? 25 : t.owner === pid ? 15 : 10) + (u.promos.includes('medic') ? 10 : 0))
    }
    if (u.work) {
      const t = s.tiles[idx(s, u.x, u.y)]
      u.workLeft -= 1
      if (u.workLeft <= 0) {
        if (u.work === 'road') t.road = true; else t.imp = u.work
        if (p.human && t.res && RESOURCES[t.res].strategic && RESOURCES[t.res].improvement === u.work && t.owner === pid) {
          const need = unitsNeeding(s, pid, t.res)
          note(s, pid, `Máte přístup k surovině ${RESOURCES[t.res].name.toLowerCase()}. ${need.length ? `Můžete stavět: ${need.join(', ')}.` : 'Vaše vojsko ji nepotřebuje, ale můžete ji prodávat v Diplomacii.'}`, 'good', u.x, u.y)
        }
        u.work = null
        const c = cityById(s, t.city)
        if (c) assignWorkers(s, c)
      }
    }
  }
  if (pid === barbId(s)) return
  // Obchodní smlouvy: vyprší časem, nebo když prodávající o surovinu přijde.
  s.deals = s.deals.filter(d => {
    if (d.seller !== pid) return true
    const ok = s.turn < d.until && ownsResource(s, d.seller, d.res) && s.players[d.buyer].alive
    if (!ok) for (const [me, they] of [[d.seller, d.buyer], [d.buyer, d.seller]]) note(s, me, `Obchod skončil: ${RESOURCES[d.res].name} (${NATIONS[s.players[they].nation].name}).`, 'info')
    return ok
  })
  // Vztahy soupeře k lidským hráčům se časem vracejí k neutrálu; obchod je zlepšuje.
  if (!p.human && s.turn % 4 === 0) for (const h of s.players) {
    if (!h.human) continue
    const a = p.attitude[h.id]
    p.attitude[h.id] = a + (a > 0 ? -1 : a < 0 ? 1 : 0)
    if (s.deals.some(d => (d.seller === pid && d.buyer === h.id) || (d.buyer === pid && d.seller === h.id))) p.attitude[h.id] = Math.min(100, p.attitude[h.id] + 2)
  }
  for (const c of citiesOf(s, pid)) { processCity(s, c); p.culture += cityYields(s, c).culture }
  if (!p.human) {
    while (traditionReady(p)) adoptTradition(s, p, traditionAdvice(p)!)
  } else if (traditionReady(p)) noteOnce(s, pid, 'Nastřádali jste dost kultury na novou tradici.', 'good')
  const inc = playerIncome(s, pid)
  p.gold += inc.gold
  let sci = inc.sci
  if (p.gold < 0) {
    // Prázdná pokladna brzdí vědu.
    sci = Math.max(0, sci + p.gold)
    p.gold = 0
    noteOnce(s, pid, 'Pokladna je prázdná! Schodek brzdí výzkum – stavte tržiště nebo rozpusťte část vojska.', 'bad')
  }
  if (p.research) {
    p.progress += sci
    const cost = TECHS[p.research].cost
    if (p.progress >= cost) {
      const t = p.research
      const over = p.progress - cost
      grantTech(s, p, t)
      p.progress = over
      note(s, pid, `Objevena technologie: ${TECHS[t].name} (${TECHS[t].unlocks}).`, 'good')
    }
  } else {
    p.progress += sci
  }
  updateVisibility(s, pid)
}
