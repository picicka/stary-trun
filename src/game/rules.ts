// Pravidla hry: výnosy, města, pohyb, boj, průběh tahu. Bez závislosti na Phaseru.
import {
  ERAS, GOLDEN_TURNS, REPEAT_STEP, TUNE, TRADITIONS, TRADITION_IDS, BRANCHES, BRANCH_IDS, branchOf, type BranchId, traditionCost, type TraditionId, SCENARIOS, BUILDINGS, BUILDING_IDS, DIFFICULTY, IMPROVEMENTS, CLEAR, REPAIR, REPLACE_TURNS, PILLAGE_GOLD, LINK_TECH, NATIONS, PROMO_IDS, RESOURCES, ROAD, TECHS, TECH_IDS, TERRAIN, UNITS, UNIT_IDS, XP_LEVELS, unitFor,
  type BuildingId, type ImprovementId, type PromoId, type ResourceId, type TechId, type UnitId, type Yields,
  PERSONAS, type PersonaId,
} from './data.ts'
import { hexDist, neighborXY } from './hex.ts'
import { rand } from './rng.ts'
import { log } from './log.ts'
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
    if ((t.imp === RESOURCES[r].improvement && !t.ruin) || s.cities.some(c => c.y * s.W + c.x === i)) n++
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
  for (const u of s.units) if (u.owner === pid && UNITS[u.type].needs === r) n += unitSize(u)
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
  if (t.imp && !t.ruin) {
    const im = IMPROVEMENTS[t.imp]
    food += im.food; prod += im.prod; gold += im.gold
    // Zavlažování pomáhá jen farmám u řeky; pile řeka plaví dřevo; ves vynáší víc ve městě spojeném s hlavním.
    if (t.imp === 'farm') { if (nation === 'aur') food += 1; if (hasTech(p, 'irrigation') && t.river) food += 1 }
    if (t.imp === 'lumber' && t.river) prod += 1
    if (t.imp === 'village' && hasTech(p, LINK_TECH) && cityById(s, t.city)?.linked) gold += 1
    if (t.imp === 'village' && p.traditions.includes('merchants')) gold += 1
    if (t.imp === 'fishery' && p.traditions.includes('fishers')) food += 1
    if (t.imp === 'mine' && nation === 'khar') prod += 1
    if (t.imp === 'pasture' && nation === 'tark') food += 1
  }
  if (t.t === 'coast' && nation === 'thal') gold += 1
  if (t.t === 'desert' && nation === 'zahi') gold += 1
  if (t.river && td.land) gold += 1
  return { food, prod, gold }
}

/** Observatoř je silnější ve městě na pahorkatině nebo hned u hor. */
export function observatorySite(s: GameState, c: City): boolean {
  return s.tiles[idx(s, c.x, c.y)].t === 'hills' || neighbors(s, c.x, c.y).some(n => s.tiles[idx(s, n[0], n[1])].t === 'mountain')
}

export interface CityYields { food: number; prod: number; gold: number; sci: number; culture: number; foodNet: number }

export function cityWorkable(s: GameState, c: City): number[] {
  const out: number[] = []
  for (const [x, y] of tilesWithin(s, c.x, c.y, BORDER_MAX)) {
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
  // Zaměření města dá zvolenému výnosu výraznou přednost; ostatní výnosy rozhodují mezi stejně dobrými poli.
  const w = c.focus === 'food' ? [8, 1.2, 0.8] : c.focus === 'prod' ? [1.5, 8, 0.8] : c.focus === 'gold' ? [1.5, 1.2, 8] : [needFood, 2.3, 1.2]
  const score = (i: number) => { const y = tileYield(s, i, c.owner); return y.food * w[0] + y.prod * w[1] + y.gold * w[2] }
  free.sort((a, b) => score(b) - score(a))
  c.worked = free.slice(0, c.pop)
  if (!c.focus || c.focus === 'food') return
  // Zaměření na výrobu či zlato nesmí město vyhladovět: nejhladovější pole se mění za nejúrodnější volná.
  const food = (i: number) => tileYield(s, i, c.owner).food
  for (let n = 0; n < c.pop && cityYields(s, c).foodNet < 0; n++) {
    const out = [...c.worked].sort((a, b) => food(a) - food(b) || score(a) - score(b))[0]
    const into = free.filter(i => !c.worked.includes(i)).sort((a, b) => food(b) - food(a) || score(b) - score(a))[0]
    if (out === undefined || into === undefined || food(into) <= food(out)) break
    c.worked[c.worked.indexOf(out)] = into
  }
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
  if (tr('stargazers')) sci += has('observatory') ? 3 : 1
  if (tr('fishers') && has('harbor')) gold += 1
  if (s.turn < p.goldenUntil) { prod += 1; gold += 1 }
  if (has('harbor')) gold += 2
  if (has('granary')) food += 2
  if (has('workshop')) prod += 2
  if (has('guildhall')) prod += 2 + Math.floor(c.pop / 4)
  if (has('caravanserai') && c.linked) gold += 3
  gold += p.empire ?? 0
  if (has('library')) sci += 2 + Math.floor(c.pop / 2)
  if (has('university')) sci += 4 + Math.floor(c.pop / 3)
  if (has('observatory')) sci += 3 + (observatorySite(s, c) ? 3 : 0)
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
  // Velké město dává víc kultury než několik malých.
  if (c.pop >= 4) out.push(['Obyvatelé', Math.floor(c.pop / 4)])
  if (p?.traditions.includes('feasts')) out.push(['Slavnosti', 2])
  if (p && turn < p.goldenUntil) out.push(['Zlatý věk', 1])
  if (c.capital) out.push(['Hlavní město', 1])
  if (c.buildings.includes('monument')) out.push(['Monument', 2])
  if (c.buildings.includes('temple')) out.push(['Chrám', 3])
  if (c.buildings.includes('amphitheater')) out.push(['Amfiteátr', 4])
  if (p?.nation === 'lume') { const n = Number(c.buildings.includes('library')) + Number(c.buildings.includes('temple')); if (n) out.push(['Světlo poznání', n]) }
  if (c.buildings.includes('wonder')) out.push(['Sluneční chrám', 4])
  return out
}

/** Kolik nastřádané kultury je třeba na 2. a 3. okruh hranic. */
/** Nejdál od města, kam jeho hranice dosáhnou. */
export const BORDER_MAX = 3
/** Cena dalšího pole v kultuře: základ a příplatek za každé pole, které už město zabralo. */
export const BORDER_BASE = 8
export const BORDER_STEP = 2
/** Nejmenší vzdálenost dvou měst. */
export const CITY_GAP = 5
/** Strop obyvatel: bez akvaduktu, s akvaduktem bez kanalizace. */
export const POP_CAP = [6, 12]

/** Kolik obyvatel město nejvýš uživí se svými stavbami. */
export function popCap(c: City): number {
  return !c.buildings.includes('aqueduct') ? POP_CAP[0] : !c.buildings.includes('sewer') ? POP_CAP[1] : Infinity
}

/** Kolik kultury stojí další pole města. */
export function borderCost(s: GameState, c: City): number {
  const base = BORDER_BASE + BORDER_STEP * (c.grown ?? 0)
  return s.players[c.owner].traditions.includes('chroniclers') ? Math.ceil(base * 0.75) : base
}

/** Pole, která může město zabrat: volná, do tří polí od města a sousedící s jeho územím. */
export function borderOptions(s: GameState, c: City): number[] {
  const out: number[] = []
  for (const [x, y] of tilesWithin(s, c.x, c.y, BORDER_MAX)) {
    const i = idx(s, x, y)
    if (s.tiles[i].owner !== -1) continue
    if (neighbors(s, x, y).some(n => s.tiles[idx(s, n[0], n[1])].city === c.id)) out.push(i)
  }
  return out
}

/** Jak moc město o pole stojí: suroviny napřed, pak řeka a výnos, bližší dřív, hory nakonec. */
export function borderValue(s: GameState, c: City, i: number): number {
  const t = s.tiles[i], p = s.players[c.owner]
  const y = tileYield(s, i, c.owner)
  let v = y.food * 1.4 + y.prod + y.gold * 0.6
  if (t.res && resourceVisible(p, t.res)) v += RESOURCES[t.res].strategic ? 40 : 20
  if (t.river) v += 1.5
  if (t.t === 'mountain') v -= 30
  if (t.t === 'ocean') v -= 4
  return v - hexDist(c.x, c.y, i % s.W, (i / s.W) | 0) * 3
}

/** Které pole město zabere příště: hráčova volba, jinak nejcennější. −1 = není co, nebo se čeká na hráče. */
export function borderTarget(s: GameState, c: City): number {
  const opts = borderOptions(s, c)
  if (c.nextTile !== undefined && opts.includes(c.nextTile)) return c.nextTile
  if (c.border === 'manual' && s.players[c.owner].human) return -1
  let best = -1, bv = -Infinity
  for (const i of opts) { const v = borderValue(s, c, i); if (v > bv) { bv = v; best = i } }
  return best
}

/** Připojí pole k městu. */
function claimTile(s: GameState, c: City, i: number): void {
  const t = s.tiles[i]
  t.owner = c.owner; t.city = c.id
  c.radius = Math.max(c.radius, hexDist(c.x, c.y, i % s.W, (i / s.W) | 0))
  if (s.players[c.owner].human && t.res && RESOURCES[t.res].strategic && resourceVisible(s.players[c.owner], t.res)) {
    const need = unitsNeeding(s, c.owner, t.res)
    note(s, c.owner, `${c.name} zabralo pole se surovinou ${RESOURCES[t.res].name.toLowerCase()}. ${need.length ? `Pošlete tam dělníky postavit ${RESOURCES[t.res].improvement === 'mine' ? 'důl' : 'ohradu'} – pak půjde stavět: ${need.join(', ')}.` : ''}`, 'good', i % s.W, (i / s.W) | 0)
  }
}

/** Růst hranic: za nastřádanou kulturu město zabírá pole po jednom. */
export function growBorders(s: GameState, c: City): void {
  for (let guard = 0; guard < 4; guard++) {
    const cost = borderCost(s, c)
    if (c.culture < cost) return
    const i = borderTarget(s, c)
    if (i < 0) {
      if (c.border === 'manual' && s.players[c.owner].human && borderOptions(s, c).length) noteOnce(s, c.owner, `${c.name} má dost kultury na další pole. Otevřete město a vyberte, které zabrat.`, 'info', c.x, c.y)
      return
    }
    c.culture -= cost
    c.grown = (c.grown ?? 0) + 1
    delete c.nextTile
    claimTile(s, c, i)
    updateVisibility(s, c.owner)
  }
}

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
  const mil = headcount(unitsOf(s, pid).filter(u => !isCivilian(u)))
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
  return (!!s.tiles[i].road && !s.tiles[i].roadRuin) || s.cities.some(c => c.y * s.W + c.x === i)
}

/** Stojí mezi dvěma poli s cestou most? Umí ho národ se Stavitelstvím, kterému aspoň jedno z polí patří. */
export function bridged(s: GameState, from: number, to: number): boolean {
  for (const i of [from, to]) { const o = s.tiles[i].owner; if (o >= 0 && o !== barbId(s) && hasTech(s.players[o], ROAD.bridgeTech)) return true }
  return false
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
  const ford = riverBetween(s, from, to) ? 1 : 0
  // Po cestě půl bodu; přes řeku jen po mostě, jinak se brodí jako bez cesty.
  if (hasRoad(s, from) && hasRoad(s, to) && (!ford || bridged(s, from, to))) return 0.5
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

function clearOrders(u: Unit): void { u.fortified = false; delete u.fortWait; u.sleep = false; u.work = null; u.workLeft = 0 }
/** Zruší cestu i frontu průjezdních bodů. */
export function stopUnit(u: Unit): void { u.goto = null; u.way = []; u.todo = null; u.roadTo = null }

/** Vojenská jednotka, která doprovází civilní jednotku `ward`. */
export function escortOf(s: GameState, ward: Unit): Unit | undefined {
  return s.units.find(o => o.escort === ward.id && o.owner === ward.owner)
}
/** Civilní jednotka, kterou `u` doprovází; zaniklou nebo zajatou vazbu rovnou zruší. */
export function wardOf(s: GameState, u: Unit): Unit | undefined {
  if (u.escort === undefined) return undefined
  const w = s.units.find(o => o.id === u.escort && o.owner === u.owner)
  if (!w) delete u.escort
  return w
}
/** Proč jednotka nemůže civilistu doprovázet, nebo null. */
export function escortBlock(s: GameState, u: Unit, ward: Unit | undefined): string | null {
  if (isCivilian(u) || isNaval(u)) return 'Doprovázet může jen pozemní vojenská jednotka.'
  if (!ward || ward.owner !== u.owner || !isCivilian(ward)) return 'Doprovázet lze jen vlastní civilní jednotku.'
  if (hexDist(u.x, u.y, ward.x, ward.y) > 1) return 'Jednotka musí stát u té, kterou má doprovázet.'
  return null
}
/** Doprovod dojde za svým chráněncem, kam až mu pohyb stačí. */
export function follow(s: GameState, u: Unit): void {
  const w = wardOf(s, u)
  if (!w) return
  u.goto = null; u.way = []
  if (u.x === w.x && u.y === w.y) return
  moveUnit(s, u, w.x, w.y)
  // Co nedošel letos, dožene příště podle toho, kde chráněnec zrovna bude.
  u.goto = null
}
/** Všechny doprovody hráče doženou své chráněnce. */
export function followAll(s: GameState, pid: number): void {
  for (const u of unitsOf(s, pid)) if (u.escort !== undefined) follow(s, u)
}

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
  if (lastStop > 0) u.moved = true
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
      s.mission.campsDestroyed++
      // Vedlejší úkol si plní každý hráč sám: počítají se jen tábory, které vypálil on.
      pl.camps = (pl.camps ?? 0) + 1
      if (pl.human) {
        if (pl.camps >= 2 && !pl.questCamps) {
          pl.questCamps = true
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

/** Cena technologie pro hráče: opakovatelná s každým dokončením zdraží. */
export function techCost(p: Player, t: TechId): number { return TECHS[t].cost + (TECHS[t].repeat ? REPEAT_STEP * (p.empire ?? 0) : 0) }

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
  log(s, p.id, 'výzkum', () => `${TECHS[t].name} (technologií ${p.techs.length + 1})`)
  if (TECHS[t].repeat) {
    // Opakovatelná technologie se mezi objevené nepočítá; jen zvedá úroveň a zůstává v nabídce.
    p.empire = (p.empire ?? 0) + 1
    if (p.research === t) { p.research = null; p.progress = 0 }
    nextResearch(p)
    if (p.human) emit({ e: 'sound', id: 'tech' })
    return
  }
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

/** Tradice, které jsou právě na řadě: v každé větvi ta nejvyšší dosud nepřijatá. */
export function openTraditions(p: Player): TraditionId[] {
  return BRANCH_IDS.map(b => branchOf(b).find(t => !p.traditions.includes(t))).filter((t): t is TraditionId => !!t)
}

/** Má národ celou větev? */
export const branchDone = (p: Player, b: BranchId): boolean => branchOf(b).every(t => p.traditions.includes(t))

/** Která tradice se národu právě hodí nejvíc (volba soupeřů i tip pro hráče): ve válce a výbojným bojové, jinak hospodářské. */
export function traditionAdvice(p: Player): TraditionId | null {
  const martial = (PERSONAS[p.personality as PersonaId]?.martial ?? false) || (p.human && p.war.length > 0)
  const pref: TraditionId[] = martial
    ? ['militia', 'warrior', 'stores', 'settlers', 'raiders', 'builders', 'craft', 'campaign', 'trade', 'scribes', 'merchants', 'feasts', 'chroniclers', 'sea', 'stargazers', 'fishers']
    : ['stores', 'settlers', 'scribes', 'builders', 'craft', 'feasts', 'trade', 'chroniclers', 'merchants', 'stargazers', 'militia', 'sea', 'fishers', 'warrior', 'raiders', 'campaign']
  // Přijmout jde jen tradice, která je ve své větvi na řadě.
  const open = openTraditions(p)
  const own = PERSONAS[p.personality as PersonaId]?.traditions
  return (own ? [...own, ...pref] : pref).find(x => open.includes(x)) ?? null
}

export function adoptTradition(s: GameState, p: Player, id: TraditionId): boolean {
  if (!traditionReady(p) || !openTraditions(p).includes(id)) return false
  p.culture -= traditionCost(p.traditions.length)
  p.traditions.push(id)
  log(s, p.id, 'tradice', () => `${TRADITIONS[id].name} (${p.traditions.length}.)`)
  // Dokončená větev spustí zlatý věk (běžící se prodlouží).
  const b = TRADITIONS[id].branch
  if (branchDone(p, b)) {
    p.goldenUntil = Math.max(p.goldenUntil, s.turn) + GOLDEN_TURNS
    note(s, p.id, `Větev ${BRANCHES[b].name} je úplná! Začíná zlatý věk na ${GOLDEN_TURNS} tahů.`, 'good')
  }
  return true
}

// ---------------------------------------------------------------- města

/** Životy obránců města. Hradby jsou zvláštní vrstva navíc (viz `wallMax`). */
export function cityMaxHp(_c: City): number { return TUNE.cityHp }
/** Body hradeb za stavbu Hradby a za Bašty. */
export const WALL_HP = 100
/** Jaký díl běžné škody berou stojící hradby: od pěchoty, od střelců a od obléhacích strojů. S beranidlem u města má pěchota plnou. */
export const WALL_MELEE = 0.2
export const WALL_RANGED = 0.5
export const WALL_SIEGE = 1
/** Kolik životů obránců zůstane městu po dobytí (díl plného stavu). */
export const CAPTURE_HP = 0.25
export function wallMax(c: City): number { return (c.buildings.includes('walls') ? WALL_HP : 0) + (c.buildings.includes('bastion') ? WALL_HP : 0) }
/** Obránci a hradby dohromady: kolik městu zbývá a kolik má v plném stavu. */
export function cityTotal(c: City): number { return c.hp + cityWalls(c) }
export function cityFull(c: City): number { return cityMaxHp(c) + wallMax(c) }
/** Kolik bodů hradeb městu právě zbývá. */
export function cityWalls(c: City): number { return Math.max(0, wallMax(c) - (c.wallDmg ?? 0)) }
/** Díl škody, kterou hradbám způsobí daný útok. */
export function wallFactor(ranged: boolean, siege: boolean, ram: boolean): number {
  return ranged ? (siege ? WALL_SIEGE : WALL_RANGED) : ram ? 1 : WALL_MELEE
}
/**
 * Rozdělí škodu `raw` mezi hradby a obránce: dokud hradby stojí, berou ránu ony (zmenšenou podle útočníka);
 * co hradby nepoberou, projde na obránce.
 */
export function cityHit(c: City, raw: number, factor: number): { wall: number; hp: number } {
  const w = cityWalls(c)
  if (w <= 0) return { wall: 0, hp: raw }
  const wd = Math.round(raw * factor)
  if (wd <= w) return { wall: wd, hp: 0 }
  return { wall: w, hp: Math.round(raw * (wd - w) / Math.max(1, wd)) }
}

export function cityStrength(s: GameState, c: City): number {
  let v = 7 + c.pop * 0.9 + s.players[c.owner].techs.length * 0.15
  // Hradby a bašty násobí obranu, jen dokud aspoň zčásti stojí.
  if (cityWalls(c) > 0) {
    if (c.buildings.includes('walls')) v *= 1.4
    if (c.buildings.includes('bastion')) v *= 1.25
  }
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
  for (const c of s.cities) if (hexDist(c.x, c.y, x, y) < CITY_GAP) return `Příliš blízko jiného města (nejméně ${CITY_GAP - 1} pole mezi městy).`
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
    id: s.nextId++, owner: u.owner, founder: u.owner, name, x: u.x, y: u.y, pop: p.traditions.includes('settlers') ? 2 : 1, food: 0, prod: 0, culture: 0, radius: 1, grown: 0,
    build: null, queue: [], buildings: [], hp: 200, capital: first, seat: first ? u.owner : -1, worked: [],
  }
  const t = s.tiles[idx(s, u.x, u.y)]
  t.forest = false; t.imp = null; t.owner = u.owner; t.city = c.id
  s.cities.push(c)
  log(s, u.owner, 'město', () => `založeno ${c.name} na ${c.x},${c.y} (měst ${citiesOf(s, u.owner).length})`)
  s.units.splice(s.units.indexOf(u), 1)
  claimTiles(s, c)
  assignWorkers(s, c)
  updateVisibility(s, c.owner)
  emit({ e: 'found', city: c.id, x: c.x, y: c.y })
  if (p.human) {
    note(s, p.id, `Založili jste město ${c.name}.`, 'good', c.x, c.y)
    if (!p.questCities && citiesOf(s, p.id).length >= 3) {
      p.questCities = true
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
  if ((id === 'harbor' || id === 'shipyard') && !isCoastal(s, c.x, c.y)) return false
  if (id === 'bastion' && !c.buildings.includes('walls')) return false
  if (id === 'sewer' && !c.buildings.includes('aqueduct')) return false
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

/** Cena okamžité koupě libovolné položky: rozestavěné se odečte hotová výroba, ostatní se platí celé. */
export function buyItemCost(s: GameState, c: City, it: BuildItem): number {
  if (sameItem(c.build, it)) return buyCost(s, c)
  const m = s.players[c.owner].nation === 'thal' ? 0.7 : 1
  return Math.ceil(itemCost(it, s.players[c.owner]) * 2.6 * m)
}

/** Proč položku nejde hned koupit, nebo null. */
export function buyItemBlock(s: GameState, c: City, it: BuildItem): string | null {
  if (it.kind === 'building' && it.id === 'wonder') return 'Sluneční chrám koupit nelze.'
  if (!stillValid(s, c, it)) return 'Tuto položku teď město stavět nemůže.'
  if (it.kind === 'unit') {
    if (it.id === 'settler' && c.pop < 2) return 'Město musí mít alespoň 2 obyvatele.'
    if (!spawnSpot(s, c, !!UNITS[it.id].civilian, !!UNITS[it.id].naval)) return 'Jednotku není kam postavit: ve městě i okolo už stojí jiné.'
  }
  const cost = buyItemCost(s, c, it)
  if (cost <= 0) return 'Položka je už zaplacená výrobou.'
  if (s.players[c.owner].gold < cost) return `Chybí zlato: stojí ${cost}, máte ${s.players[c.owner].gold}.`
  return null
}

/** Koupí položku hned, i když se nestaví. Rozestavěná výroba a fronta zůstanou, jak byly. */
export function buyItem(s: GameState, c: City, it: BuildItem): boolean {
  if (buyItemBlock(s, c, it)) return false
  if (sameItem(c.build, it)) return buy(s, c)
  const cost = buyItemCost(s, c, it)
  const keep = { build: c.build, prod: c.prod, queue: c.queue.slice() }
  c.build = it
  c.prod = itemCost(it, s.players[c.owner])
  const ok = completeBuild(s, c)
  c.build = keep.build; c.prod = keep.prod; c.queue = keep.queue
  if (!ok) return false
  s.players[c.owner].gold -= cost
  // Koupená budova už ve frontě čekat nemusí.
  if (it.kind === 'building') c.queue = c.queue.filter(q => !sameItem(q, it))
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
    if (!civ && c.buildings.includes('armory')) u.xp += 10
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
  if (c.food >= need && c.pop >= popCap(c)) {
    // Město narazilo na strop: zásoby zůstanou plné a čeká se na akvadukt či kanalizaci.
    c.food = need
    if (p.human) noteOnce(s, c.owner, `${c.name} dál neporoste: s ${c.pop} obyvateli potřebuje ${c.buildings.includes('aqueduct') ? 'kanalizaci' : 'akvadukt'}.`, 'info', c.x, c.y)
  } else if (c.food >= need) {
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
  growBorders(s, c)
  // Výroba.
  if (c.build) {
    // Položka mohla mezitím přestat být dostupná (div dokončil někdo jiný).
    if (!stillValid(s, c, c.build)) c.build = nextQueued(s, c)
  }
  if (c.build) {
    // Loděnice staví lodě o polovinu rychleji.
    const ship = c.build.kind === 'unit' && UNITS[c.build.id].naval && c.buildings.includes('shipyard')
    c.prod += ship ? Math.round(y.prod * 1.5) : y.prod
    if (c.prod >= itemCost(c.build, p)) completeBuild(s, c)
  } else {
    // Bez zadání se výroba mění na zlato.
    p.gold += Math.floor(y.prod / 2)
  }
  // Opravy a střelba z hradeb.
  if (!besieged(s, c)) {
    c.hp = Math.min(cityMaxHp(c), c.hp + TUNE.cityHeal)
    if (c.wallDmg) c.wallDmg = Math.max(0, c.wallDmg - TUNE.cityHeal)
  }
  // Kdo si cíl nevybral sám, za toho město vystřelí na konci tahu.
  if (!c.fired) cityShoot(s, c)
  delete c.fired
}

/** Nepřátelské vojenské jednotky v dostřelu hradeb (2 pole). */
export function cityTargets(s: GameState, c: City): Unit[] {
  return s.units.filter(u => !isCivilian(u) && atWar(s, c.owner, u.owner) && hexDist(c.x, c.y, u.x, u.y) <= 2)
}

/** Výstřel z hradeb: na zvolený cíl, jinak na nejslabší jednotku v dostřelu. Vrací true, pokud město vystřelilo. */
export function cityShoot(s: GameState, c: City, pick?: Unit): boolean {
  const all = cityTargets(s, c)
  let target: Unit | null = pick && all.includes(pick) ? pick : null
  if (!target) for (const u of all) if (!target || u.hp < target.hp) target = u
  if (!target) return false
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
  return true
}

// ---------------------------------------------------------------- dělníci

/** Funguje vylepšení na poli (stojí a není vypleněné)? */
export const impWorks = (t: Tile): boolean => !!t.imp && !t.ruin

export function validImprovements(s: GameState, u: Unit): ImprovementId[] {
  if (u.type !== 'worker') return []
  const t = s.tiles[idx(s, u.x, u.y)]
  if (t.owner !== u.owner || cityAt(s, u.x, u.y) || t.special) return []
  return improvementsFor(s, t, s.players[u.owner])
}

/** Vylepšení, která se na pole hodí podle terénu a suroviny (bez ohledu na technologie). První je to hlavní. */
export function impOptions(t: Tile, p: Player): ImprovementId[] {
  const res = t.res && resourceVisible(p, t.res) ? t.res : null
  if (!TERRAIN[t.t].land) return t.t === 'coast' && res === 'fish' ? ['fishery'] : []
  if (!TERRAIN[t.t].passable) return []
  const out: ImprovementId[] = []
  const add = (i: ImprovementId | null) => { if (i && !out.includes(i)) out.push(i) }
  if (res) add(RESOURCES[res].improvement)
  if (t.forest) add('lumber')
  else if (t.t === 'hills') add('mine')
  else if (t.t === 'grass' || t.t === 'plains') { add('farm'); add('village') }
  else if (t.t === 'desert' && (t.river || res === 'wheat')) add('farm')
  return out
}

/** Hlavní vylepšení pole podle terénu a suroviny (bez ohledu na technologie). */
export function impCandidate(t: Tile, p: Player): ImprovementId | null { return impOptions(t, p)[0] ?? null }

/** Vylepšení, která hráč na poli umí postavit a která tam ještě nestojí. */
export function improvementsFor(_s: GameState, t: Tile, p: Player): ImprovementId[] {
  return impOptions(t, p).filter(c => hasTech(p, IMPROVEMENTS[c].tech) && t.imp !== c)
}

/** Název a rozkaz práce dělníků. */
export function jobInfo(job: JobId): { name: string; verb: string } {
  return job === 'road' ? ROAD : job === 'clear' ? CLEAR : job === 'repair' ? REPAIR : IMPROVEMENTS[job]
}

/** Kolik tahů trvá cesta na daném poli. */
export function roadTurns(t: Tile): number { return t.forest || t.t === 'hills' ? ROAD.rough : ROAD.turns }

/** O kolik vylepšení změní výnos pole (včetně řeky, národa a spojení města). */
function impGain(s: GameState, i: number, pid: number, c: ImprovementId): Yields {
  const t = s.tiles[i]
  const keep = { imp: t.imp, ruin: t.ruin }
  t.imp = null; delete t.ruin
  const a = tileYield(s, i, pid)
  t.imp = c
  const b = tileYield(s, i, pid)
  t.imp = keep.imp; if (keep.ruin) t.ruin = true
  return { food: b.food - a.food, prod: b.prod - a.prod, gold: b.gold - a.gold }
}

const gainText = (y: Yields): string => [y.food ? `${y.food > 0 ? '+' : '−'}${Math.abs(y.food)} jídlo` : '', y.prod ? `${y.prod > 0 ? '+' : '−'}${Math.abs(y.prod)} výroba` : '', y.gold ? `${y.gold > 0 ? '+' : '−'}${Math.abs(y.gold)} zlato` : ''].filter(Boolean).join(', ')

export interface TileJob { job: JobId; name: string; effect: string; turns: number; ok: boolean; why: string }

/** Co mohou dělníci hráče `pid` na poli dělat a proč případně ne (pro nápovědu a rozkazy na dálku). */
export function tileJobs(s: GameState, i: number, pid: number): TileJob[] {
  const t = s.tiles[i], p = s.players[pid]
  const out: TileJob[] = []
  const land = TERRAIN[t.t].land
  if ((land && !TERRAIN[t.t].passable) || t.special || s.cities.some(c => c.y * s.W + c.x === i)) return out
  const mine = t.owner !== pid ? 'pole není ve vašem území' : ''
  const left = (job: JobId, full: number) => t.job === job && t.jobLeft ? t.jobLeft : full
  if (t.imp && t.ruin) {
    out.push({ job: 'repair', name: `${REPAIR.name}: ${IMPROVEMENTS[t.imp].name.toLowerCase()}`, effect: 'vypleněné vylepšení zase začne fungovat', turns: left('repair', Math.ceil(IMPROVEMENTS[t.imp].turns / 2)), ok: !mine, why: mine })
  } else if (t.road && t.roadRuin) {
    const whyR = t.owner !== pid && t.owner !== -1 ? 'cizí území' : ''
    out.push({ job: 'repair', name: `${REPAIR.name}: cesta`, effect: 'vypleněná cesta zase zrychlí pohyb a spojí města', turns: left('repair', Math.ceil(roadTurns(t) / 2)), ok: !whyR, why: whyR })
  }
  for (const c of impOptions(t, p)) {
    const d = IMPROVEMENTS[c]
    const strat = t.res && resourceVisible(p, t.res) && RESOURCES[t.res].strategic
    const eff = [gainText(impGain(s, i, pid, c)), strat && RESOURCES[t.res!].improvement === c ? `zpřístupní ${RESOURCES[t.res!].name.toLowerCase()}` : '',
      strat && RESOURCES[t.res!].improvement !== c ? `${RESOURCES[t.res!].name.toLowerCase()} zůstane nevyužité` : ''].filter(Boolean).join(', ')
    const why = t.imp === c ? (t.ruin ? 'je vypleněné, opravte ho' : 'už stojí') : mine || (!hasTech(p, d.tech) ? `chybí technologie ${TECHS[d.tech].name}` : '')
    const replace = !!t.imp && t.imp !== c
    out.push({ job: c, name: d.name, effect: eff + (replace ? ` (nahradí: ${IMPROVEMENTS[t.imp!].name.toLowerCase()}, o ${REPLACE_TURNS} tahy déle)` : ''), turns: left(c, d.turns + (replace ? REPLACE_TURNS : 0)), ok: !why, why })
  }
  if (!land) return out
  if (t.forest) {
    const why = mine || (!hasTech(p, CLEAR.tech) ? `chybí technologie ${TECHS[CLEAR.tech].name}` : '')
    const c = cityById(s, t.city)
    out.push({ job: 'clear', name: CLEAR.name, effect: `jednorázově +${CLEAR.prod} výroby${c ? ` pro město ${c.name}` : ''}, les zmizí${t.imp === 'lumber' ? ' i s pilou' : ''}`, turns: left('clear', CLEAR.turns), ok: !why, why })
  }
  if (!(t.road && t.roadRuin)) {
    const whyR = t.road ? 'už stojí' : t.owner !== pid && t.owner !== -1 ? 'cizí území' : !hasTech(p, ROAD.tech) ? `chybí technologie ${TECHS[ROAD.tech].name}` : ''
    out.push({ job: 'road', name: ROAD.name, effect: `pohyb po cestě stojí půl bodu; řeku překlene most až se Stavitelstvím`, turns: left('road', roadTurns(t)), ok: !whyR, why: whyR })
  }
  return out
}

/** Co se na poli vyplatí udělat: rada pro hráče, rozkaz Automaticky i volba počítače. Null = nic. */
export function recommendJob(s: GameState, i: number, pid: number): JobId | null {
  const t = s.tiles[i], p = s.players[pid]
  if (t.owner !== pid || t.special || s.cities.some(c => c.y * s.W + c.x === i)) return null
  if ((t.imp && t.ruin) || (t.road && t.roadRuin)) return 'repair'
  if (t.imp) return null
  const opts = improvementsFor(s, t, p)
  const res = t.res && resourceVisible(p, t.res) ? t.res : null
  const main = res ? RESOURCES[res].improvement : null
  // Surovina má přednost; bez technologie na ni pole čeká, ať se nezastaví něčím jiným.
  if (main) return opts.includes(main) ? main : null
  const c = cityById(s, t.city)
  if (t.forest) {
    if (opts.includes('lumber')) return 'lumber'
    // Bez Dřevařství se mýtí jen tam, kde je lesa nadbytek a není u řeky (tam jednou bude pila silnější).
    if (!hasTech(p, CLEAR.tech) || p.nation === 'sylv' || t.river || !c) return null
    return s.tiles.filter(o => o.city === c.id && o.forest).length > 4 ? 'clear' : null
  }
  if (!opts.length) return null
  if (opts.length === 1) return opts[0]
  // Farma, nebo ves: podle zaměření města, jinak podle toho, jestli město roste.
  if (c?.focus === 'gold') return 'village'
  if (c?.focus === 'food' || !c) return 'farm'
  if (t.river && hasTech(p, 'irrigation')) return 'farm'
  if (cityYields(s, c).foodNet < 2 + c.pop / 4) return 'farm'
  let farms = 0, villages = 0
  for (const o of s.tiles) if (o.city === c.id) { if (o.imp === 'farm') farms++; else if (o.imp === 'village') villages++ }
  return villages * 2 < farms ? 'village' : 'farm'
}

export function canWork(s: GameState, u: Unit, job: JobId): boolean {
  if (u.type !== 'worker') return false
  return tileJobs(s, idx(s, u.x, u.y), u.owner).some(j => j.job === job && j.ok)
}

export function startWork(s: GameState, u: Unit, job: JobId): boolean {
  const j = tileJobs(s, idx(s, u.x, u.y), u.owner).find(o => o.job === job && o.ok)
  if (u.type !== 'worker' || !j) return false
  const t = s.tiles[idx(s, u.x, u.y)]
  stopUnit(u)
  // Rozpracovaná práce na poli pokračuje; nová se zkrátí o tah se Stavitelským bratrstvem.
  const resume = t.job === job && !!t.jobLeft
  u.work = job; u.workLeft = resume ? t.jobLeft! : Math.max(1, j.turns - (s.players[u.owner].traditions.includes('builders') ? 1 : 0)); u.moves = 0; u.fortified = false; u.sleep = false
  t.job = job; t.jobLeft = u.workLeft
  return true
}

/** Dokončí práci dělníků na poli. */
function finishWork(s: GameState, u: Unit, job: JobId): void {
  const t = s.tiles[idx(s, u.x, u.y)], pid = u.owner, p = s.players[pid]
  const c = cityById(s, t.city)
  if (job === 'road') { t.road = true; delete t.roadRuin }
  else if (job === 'repair') { if (t.imp && t.ruin) delete t.ruin; else delete t.roadRuin }
  else if (job === 'clear') {
    t.forest = false
    if (t.imp === 'lumber') { t.imp = null; delete t.ruin }
    const to = c ?? citiesOf(s, pid).sort((a, b) => hexDist(a.x, a.y, u.x, u.y) - hexDist(b.x, b.y, u.x, u.y))[0]
    if (to) { to.prod += CLEAR.prod; note(s, pid, `Les vymýcen: ${to.name} dostává ${CLEAR.prod} výroby.`, 'info', u.x, u.y) }
  } else { t.imp = job; delete t.ruin }
  delete t.job; delete t.jobLeft
  if (p.human && impWorks(t) && t.res && RESOURCES[t.res].strategic && RESOURCES[t.res].improvement === t.imp && (job === t.imp || job === 'repair') && t.owner === pid) {
    const need = unitsNeeding(s, pid, t.res)
    note(s, pid, `Máte přístup k surovině ${RESOURCES[t.res].name.toLowerCase()}. ${need.length ? `Můžete stavět: ${need.join(', ')}.` : 'Vaše vojsko ji nepotřebuje, ale můžete ji prodávat v Diplomacii.'}`, 'good', u.x, u.y)
  }
  updateLinks(s)
  if (c) assignWorkers(s, c)
}

// ---------------------------------------------------------------- plenění a spojení měst

/** Proč jednotka nemůže plenit pole, na kterém stojí, nebo null. */
export function pillageBlock(s: GameState, u: Unit): string | null {
  if (isCivilian(u) || UNITS[u.type].ram) return 'Plenit umějí jen bojové jednotky.'
  const t = s.tiles[idx(s, u.x, u.y)]
  if (cityAt(s, u.x, u.y)) return 'Ve městě se neplení.'
  if (t.owner < 0 || t.owner === u.owner || !atWar(s, u.owner, t.owner)) return 'Plenit lze jen na území národa, se kterým válčíte.'
  if (!impWorks(t) && !(t.road && !t.roadRuin)) return 'Není tu co plenit.'
  if (u.moves <= 0) return 'Jednotka už v tomto tahu nemá pohyb.'
  return null
}

/** Vyplení pole: nejdřív vylepšení, podruhé cestu. Stojí zbytek tahu a přinese zlato. */
export function pillage(s: GameState, u: Unit): boolean {
  if (pillageBlock(s, u)) return false
  const t = s.tiles[idx(s, u.x, u.y)], owner = t.owner
  const what = impWorks(t) ? IMPROVEMENTS[t.imp!].name.toLowerCase() : 'cesta'
  if (impWorks(t)) t.ruin = true; else t.roadRuin = true
  delete t.job; delete t.jobLeft
  u.moves = 0; u.fortified = false; u.sleep = false
  const raid = u.owner !== barbId(s) && s.players[u.owner].traditions.includes('raiders')
  const loot = PILLAGE_GOLD * (raid ? 2 : 1)
  if (u.owner !== barbId(s)) s.players[u.owner].gold += loot
  if (raid) u.hp = Math.min(100, u.hp + 15)
  const who = u.owner === barbId(s) ? 'Barbaři' : NATIONS[s.players[u.owner].nation].name
  note(s, owner, `${who} vyplenili pole: ${what} nefunguje, dokud ji dělníci neopraví.`, 'bad', u.x, u.y)
  note(s, u.owner, `Vypleněno: ${what}. Kořist ${loot} zlata.`, 'good', u.x, u.y)
  updateLinks(s)
  const c = cityById(s, t.city)
  if (c) assignWorkers(s, c)
  return true
}

/** Přepočítá, která města jsou spojená s hlavním městem svého národa: po cestách, nebo přístavem na přístav. */
export function updateLinks(s: GameState): void {
  const road = new Uint8Array(s.tiles.length)
  for (let i = 0; i < s.tiles.length; i++) if (s.tiles[i].road && !s.tiles[i].roadRuin) road[i] = 1
  for (const c of s.cities) road[idx(s, c.x, c.y)] = 1
  for (const p of s.players) {
    const cs = citiesOf(s, p.id)
    for (const c of cs) delete c.linked
    const cap = cs.find(c => c.capital) ?? cs[0]
    if (!cap || p.id === barbId(s)) continue
    const seen = new Uint8Array(s.tiles.length)
    const spread = (from: City) => {
      const stack = [idx(s, from.x, from.y)]
      seen[stack[0]] = 1
      while (stack.length) {
        const i = stack.pop()!
        for (const [nx, ny] of neighbors(s, i % s.W, (i / s.W) | 0)) { const n = idx(s, nx, ny); if (road[n] && !seen[n]) { seen[n] = 1; stack.push(n) } }
      }
    }
    spread(cap)
    for (let again = true; again;) {
      again = false
      const linked = cs.filter(c => seen[idx(s, c.x, c.y)])
      // Přístavy jsou spojené po moři, jakmile je přístav i v některém už spojeném městě.
      if (linked.some(c => c.buildings.includes('harbor'))) for (const c of cs) if (!seen[idx(s, c.x, c.y)] && c.buildings.includes('harbor')) { spread(c); again = true }
    }
    for (const c of cs) if (seen[idx(s, c.x, c.y)]) c.linked = true
  }
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

export interface StrengthCtx { defending?: boolean; ranged?: boolean; vs?: Unit | null; vsCity?: boolean; river?: boolean; /** U města stojí vlastní beranidlo. */ ram?: boolean ; /** Obklíčení nebo podpora (díl síly navíc). */ bonus?: number }

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

/** O kolik zranění sráží sílu: jednotka na pokraji sil bojuje na 65 %. */
export const HURT_MIN = 0.65
function hurt(u: Unit): number { return HURT_MIN + (1 - HURT_MIN) * u.hp / 100 }
/** Opevnění: bonus k obraně. */
export const FORTIFY = 0.25
/** Obklíčení a podpora: bonus za každou další vlastní jednotku u cíle, resp. vedle obránce. Odemyká je Válečnictví. */
export const FLANK = 0.1
export const FLANK_TECH: TechId = 'tactics'
/** Protiváhy: těžká pěchota proti kopiníkům, jízda proti střelcům a strojům. */
export const COUNTER = 0.25

export function unitStrength(s: GameState, u: Unit, ctx: StrengthCtx = {}): number {
  const d = UNITS[u.type]
  if (isEmbarked(s, u)) return (s.players[u.owner].nation === 'thal' ? 8 : 4) * hurt(u)
  let base = ctx.ranged && d.ranged ? d.ranged : d.str
  let m = 1
  if (u.vet) m += 0.15
  // Šik a voj: víc síly na jednom poli.
  const formation = FORMATION[unitSize(u)] ?? 1
  const t = s.tiles[idx(s, u.x, u.y)]
  const nation = s.players[u.owner].nation
  if (ctx.defending) {
    m += TERRAIN[t.t].defense
    if (t.forest) m += nation === 'sylv' ? 0.5 : 0.25
    // Opevnění platí, až když se jednotka opravdu zakopala (viz rozkaz Opevnit).
    if (u.fortified && !u.fortWait) m += FORTIFY
    // Chrámová stráž brání domov.
    if (u.type === 'templar' && t.owner === u.owner) m += 0.25
    // Spojení hoplíté jsou pověstná odolná falanga.
    if (u.type === 'hoplite' && unitSize(u) > 1) m += HOPLITE_FORMATION
  }
  if (nation === 'khar' && t.t === 'hills') m += 0.15
  if (u.promos.includes(ctx.defending ? 'guard' : 'drill')) m += ctx.defending ? 0.2 : 0.15
  if (!ctx.defending && s.players[u.owner].traditions.includes('warrior')) m += 0.1
  // Útok zblízka přes řeku je těžší.
  if (ctx.river) m -= 0.2
  if (d.antiMounted && ctx.vs && UNITS[ctx.vs.type].mounted) m += 0.5
  if (d.antiSpear && ctx.vs && UNITS[ctx.vs.type].antiMounted) m += COUNTER
  if (d.mounted && !d.ranged && ctx.vs && UNITS[ctx.vs.type].ranged) m += COUNTER
  if (ctx.bonus) m += ctx.bonus
  if (ctx.vsCity && ctx.ranged) m *= d.siege ? SIEGE_VS_CITY : 0.7
  // Stroje jsou stavěné na hradby; do pohyblivých jednotek se trefují špatně.
  if (!ctx.vsCity && ctx.ranged && d.siege && !ctx.defending) m *= SIEGE_VS_UNIT
  if (ctx.vsCity && d.mounted && !ctx.ranged) m *= 0.75
  if (ctx.vsCity && ctx.ram && !ctx.ranged) m *= RAM_BONUS
  if (base <= 0) base = 1
  return base * m * formation * hurt(u)
}

function damageExpected(a: number, d: number): number {
  return Math.max(4, Math.min(100, 28 * Math.pow(a / d, 1.15)))
}
function damage(s: GameState, a: number, d: number): number {
  return Math.round(damageExpected(a, d) * (0.85 + rand(s) * 0.3))
}

export interface AttackPreview { ranged: boolean; city: City | null; target: Unit | null; /** Kolik jednotek útočníkovi pomáhá obklíčením a kolik obránce podporuje. */ flank?: number; support?: number; dmgDef: number; /** Útok na město: kolik z rány vezmou hradby (`dmgDef` je pak škoda obráncům). */ dmgWall?: number; dmgAtt: number; defHp: number; attHp: number; needWar: number; river: boolean }

/**
 * Stojí na sousedním poli civilní jednotka národa, se kterým je mír, a `u` by ji po vyhlášení války zajala?
 * Vrací číslo toho národa, jinak -1.
 */
export function captureNeedsWar(s: GameState, u: Unit, x: number, y: number): number {
  if (isCivilian(u) || u.moves <= 0 || isEmbarked(s, u) || hexDist(u.x, u.y, x, y) !== 1) return -1
  const t = s.tiles[idx(s, x, y)]
  if (!canEnterTile(s, u, t) || isWater(t) || cityAt(s, x, y) || militaryAt(s, x, y)) return -1
  const o = unitsAt(s, x, y).find(v => v.owner !== u.owner && isCivilian(v))
  if (!o || atWar(s, u.owner, o.owner)) return -1
  return o.owner
}

/** Kolik dalších vlastních jednotek pro boj zblízka stojí u cíle (útočníka nepočítaje). Bez Válečnictví 0. */
export function flankCount(s: GameState, u: Unit, t: Unit): number {
  if (!hasTech(s.players[u.owner], FLANK_TECH)) return 0
  return s.units.filter(o => o !== u && o.owner === u.owner && !isCivilian(o) && !UNITS[o.type].ranged && !UNITS[o.type].ram && !isEmbarked(s, o) && isNaval(o) === isNaval(u) && hexDist(o.x, o.y, t.x, t.y) === 1).length
}
/** Kolik vlastních bojových jednotek stojí vedle obránce. Bez Válečnictví 0. */
export function supportCount(s: GameState, t: Unit): number {
  if (t.owner === barbId(s) || !hasTech(s.players[t.owner], FLANK_TECH)) return 0
  return s.units.filter(o => o !== t && o.owner === t.owner && !isCivilian(o) && !isEmbarked(s, o) && hexDist(o.x, o.y, t.x, t.y) === 1).length
}

/** Terén, přes který se nedá střílet: 0 rovina, 1 les nebo pahorkatina, 2 zalesněná pahorkatina a hory. */
function sightLevel(t: Tile): number {
  if (t.t === 'mountain') return 2
  const hill = t.t === 'hills'
  return hill && t.forest ? 2 : hill || t.forest ? 1 : 0
}
/**
 * Vidí střelec z pole `a` na pole `b`? Na sousední pole vždy. Na dvě pole překáží les, pahorkatina a hory mezi nimi;
 * střelec na pahorkatině střílí přes les i přes jiné pahorky, ne však přes zalesněnou pahorkatinu a hory.
 * Vede-li spojnice mezi dvěma poli, stačí jedno volné.
 */
export function lineOfSight(s: GameState, ax: number, ay: number, bx: number, by: number): boolean {
  if (hexDist(ax, ay, bx, by) <= 1) return true
  const from = s.tiles[idx(s, ax, ay)]
  const eye = from.t === 'hills' ? 1 : 0
  const mid = neighbors(s, ax, ay).filter(([x, y]) => hexDist(x, y, bx, by) === 1)
  return mid.some(([x, y]) => sightLevel(s.tiles[idx(s, x, y)]) <= eye && sightLevel(s.tiles[idx(s, x, y)]) < 2)
}

/** Proč jednotka na pole nemůže zaútočit, ač tam stojí nepřítel na dosah – hláška pro hráče, nebo null. */
export function attackBlock(s: GameState, u: Unit, x: number, y: number): string | null {
  const d = UNITS[u.type]
  if (d.civilian || d.ram || isEmbarked(s, u)) return null
  const city = cityAt(s, x, y), target = militaryAt(s, x, y)
  if (!(city && city.owner !== u.owner) && !(target && target.owner !== u.owner)) return null
  const dist = hexDist(u.x, u.y, x, y)
  if (dist === 0 || dist > (d.ranged ? d.range! : 1)) return null
  if (u.attacked) return 'Jednotka už v tomto tahu útočila.'
  if (u.moves <= 0) return 'Jednotka už nemá pohyb.'
  if (d.ranged) {
    if (d.siege && u.moved) return 'Obléhací stroj se v tomto tahu přesouval – střílet může až v příštím.'
    if (d.range! < 3 && !lineOfSight(s, u.x, u.y, x, y)) return 'Ve výhledu překáží les, pahorkatina nebo hory. Střílet jde ze sousedního pole, nebo z pahorkatiny.'
    return null
  }
  if (!!d.naval !== isWater(s.tiles[idx(s, x, y)])) return null
  if (!canCharge(s, u, x, y)) return `Jednotka nemá dost pohybu na útok: vstup na to pole stojí ${meleeCost(s, u, x, y)}, zbývá jí ${Math.round(u.moves * 10) / 10}.`
  return null
}

/** Kolik pohybu stojí útok zblízka: tolik jako vstup na pole cíle. */
export function meleeCost(s: GameState, u: Unit, x: number, y: number): number {
  return moveCost(s, u, idx(s, u.x, u.y), idx(s, x, y))
}
/** Má jednotka na útok zblízka dost pohybu? Jednotka s plným pohybem smí zaútočit vždy. */
export function canCharge(s: GameState, u: Unit, x: number, y: number): boolean {
  return u.moves >= maxMoves(s, u) || u.moves >= meleeCost(s, u, x, y)
}

const lname = (s: GameState, pid: number): string => (pid === barbId(s) ? 'Barbaři' : `${NATIONS[s.players[pid].nation].name}#${pid}`)

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
  // Stroje po přesunu nestřílejí; střelcům na dvě pole nesmí nic stát ve výhledu; útok zblízka stojí pohyb jako vstup na pole.
  if (ranged && d.siege && u.moved) return null
  if (ranged && d.range! < 3 && !lineOfSight(s, u.x, u.y, x, y)) return null
  if (!ranged && !canCharge(s, u, x, y)) return null
  const needWar = atWar(s, u.owner, foe) ? -1 : foe
  const river = !ranged && riverBetween(s, idx(s, u.x, u.y), idx(s, x, y))
  if (city && city.owner !== u.owner) {
    const a = unitStrength(s, u, { ranged, vsCity: true, river, ram: !ranged && ramAt(s, city, u.owner) })
    const cs = cityStrength(s, city)
    const hit = cityHit(city, Math.round(damageExpected(a, cs)), wallFactor(ranged, !!d.siege, !ranged && ramAt(s, city, u.owner)))
    return { ranged, city, target: null, dmgDef: hit.hp, dmgWall: hit.wall, dmgAtt: ranged ? 0 : Math.round(damageExpected(cs, unitStrength(s, u, {}) * ramCover(s, u, city))), defHp: city.hp, attHp: u.hp, needWar, river }
  }
  if (!target) return null
  const flank = ranged ? 0 : flankCount(s, u, target), support = ranged ? 0 : supportCount(s, target)
  const a = unitStrength(s, u, { ranged, vs: target, river, bonus: FLANK * flank })
  const ds = unitStrength(s, target, { defending: true, vs: u, bonus: FLANK * support })
  return { flank, support, ranged, city: null, target, dmgDef: Math.round(damageExpected(a, ds)), dmgAtt: ranged ? 0 : Math.round(damageExpected(ds, a)), defHp: target.hp, attHp: u.hp, needWar, river }
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
    const hit = cityHit(c, dmgDef, wallFactor(pv.ranged, !!d.siege, !pv.ranged && ramAt(s, c, u.owner)))
    // Střelba město nedorazí: poslední ránu musí dát jednotka zblízka.
    if (pv.ranged) hit.hp = Math.min(hit.hp, Math.max(0, c.hp - 1))
    if (hit.wall) c.wallDmg = (c.wallDmg ?? 0) + hit.wall
    c.hp -= hit.hp
    dmgDef = hit.wall + hit.hp
    u.hp -= dmgAtt
    emit({ e: 'attack', unit: u.id, owner: u.owner, from, to: [x, y], ranged: pv.ranged, dmgDef, dmgAtt, city: true, siege: !!d.siege })
    log(s, u.owner, 'boj', () => `${UNITS[u.type].name}${unitSize(u) > 1 ? ` ×${unitSize(u)}` : ''} (síla ${Math.round(a * 10) / 10}) → město ${c.name} (${lname(s, c.owner)}, obrana ${Math.round(cs * 10) / 10}): hradby −${hit.wall}, obránci −${hit.hp}; zbývá ${Math.max(0, c.hp)} + ${cityWalls(c)}; útočník −${dmgAtt}${u.hp <= 0 ? ' (padl)' : ''}`)
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
  const a = unitStrength(s, u, { ranged: pv.ranged, vs: t, river: pv.river, bonus: FLANK * (pv.flank ?? 0) })
  const ds = unitStrength(s, t, { defending: true, vs: u, bonus: FLANK * (pv.support ?? 0) })
  const dmgDef = damage(s, a, ds)
  const dmgAtt = pv.ranged ? 0 : damage(s, ds, a)
  t.hp -= dmgDef
  u.hp -= dmgAtt
  emit({ e: 'attack', unit: u.id, owner: u.owner, from, to: [x, y], ranged: pv.ranged, dmgDef, dmgAtt, city: false, siege: !!d.siege })
  log(s, u.owner, 'boj', () => `${UNITS[u.type].name}${unitSize(u) > 1 ? ` ×${unitSize(u)}` : ''} (síla ${Math.round(a * 10) / 10}) → ${UNITS[t.type].name} (${lname(s, t.owner)}, síla ${Math.round(ds * 10) / 10}${t.fortified && !t.fortWait ? ', opevněn' : ''})${pv.ranged ? ' střelbou' : ''}: obránce −${dmgDef}${t.hp <= 0 ? ' (zničen)' : `, zbývá ${t.hp}`}; útočník −${dmgAtt}${u.hp <= 0 ? ' (padl)' : ''}${pv.flank ? `; obklíčení ${pv.flank}` : ''}${pv.support ? `; podpora ${pv.support}` : ''}`)
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

/** Kolik pohybu stojí hráče výběr povýšení. */
export const PROMO_COST = 1
export const PROMO_NO_MOVES = 'Povýšení stojí bod pohybu a jednotka už v tomto tahu žádný nemá.'

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
  // Šik a voj se přezbrojují celé, cena roste s počtem jednotek.
  return Math.ceil((Math.max(0, UNITS[t].cost - UNITS[u.type].cost) * 2 + 10) * (s.players[u.owner].nation === 'thal' ? 0.7 : 1)) * unitSize(u)
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
  log(s, by.owner, 'město', () => `dobyto ${c.name} (${lname(s, old)}), obyvatel ${c.pop}${c.capital ? ', hlavní město' : ''}; dobyla jednotka ${UNITS[by.type].name}`)
  const oldP = s.players[old], newP = s.players[by.owner]
  // Posádka i civilisté ve městě padnou.
  for (const o of unitsAt(s, c.x, c.y)) if (o.owner === old) killUnit(s, o)
  if (by.owner === barbId(s)) {
    // Barbaři města nedrží – vyplení je.
    c.hp = Math.floor(cityMaxHp(c) / 2)
    c.wallDmg = wallMax(c)
    c.pop = Math.max(1, c.pop - 1)
    const loot = Math.min(oldP.gold, 40)
    oldP.gold -= loot
    assignWorkers(s, c)
    note(s, old, `Barbaři vyplenili ${c.name}! Ztratili jste ${loot} zlata a část obyvatel.`, 'bad', c.x, c.y)
    return
  }
  c.owner = by.owner
  if (!TUNE.softCapture) c.pop = Math.max(1, c.pop - 1)
  // Obráncům zbude čtvrtina; hradby a bašty zůstávají stát tak pobořené, jak je útok nechal.
  c.hp = Math.floor(cityMaxHp(c) * (TUNE.softCapture ? 0.5 : CAPTURE_HP))
  c.build = null; c.queue = []; c.prod = 0; c.food = 0
  delete c.seen
  if (c.capital) {
    c.capital = false
    const next = citiesOf(s, old).sort((a, b) => b.pop - a.pop)[0]
    if (next) next.capital = true
  }
  if (!citiesOf(s, by.owner).some(o => o.capital)) c.capital = true
  // Dobyvatel získá jen pole, která město už mělo; další si musí zabrat kulturou.
  for (const t of s.tiles) if (t.city === c.id) t.owner = by.owner
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
  log(s, a, 'válka', () => `vyhlášena národu ${lname(s, b)}`)
  log(s, b, 'válka', () => `vyhlásil ji národ ${lname(s, a)}`)
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
  log(s, a, 'mír', () => `uzavřen s národem ${lname(s, b)}`)
  log(s, b, 'mír', () => `uzavřen s národem ${lname(s, a)} (na jeho návrh)`)
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
  for (const u of s.units) if (u.owner === pid && !isCivilian(u)) { const d = UNITS[u.type]; v += Math.max(d.str, d.ranged ?? 0) * (FORMATION[unitSize(u)] ?? 1) * (0.4 + 0.6 * u.hp / 100) }
  return v
}

// ---------------------------------------------------------------- šik a voj

/** Kolik jednotek je ve spojení: 1 = samostatná, 2 = šik, 3 = voj. */
export const unitSize = (u: Unit): number => u.size ?? 1
/** Násobek síly šiku a voje. */
export const FORMATION = [1, 1, 1.5, 1.9]
/** O kolik líp se brání šik či voj hoplítů. */
export const HOPLITE_FORMATION = 0.25
export const formationName = (n: number): string => n === 3 ? 'Voj' : n === 2 ? 'Šik' : ''
/** Počet jednotek včetně těch spojených (pro žold, suroviny a velikost vojska). */
export const headcount = (units: Unit[]): number => units.reduce((a, u) => a + unitSize(u), 0)

function mergeable(u: Unit): boolean {
  const d = UNITS[u.type]
  return !d.civilian && !d.siege && !d.ram && !d.naval && u.type !== 'scout'
}

/** Proč se jednotka `u` nemůže připojit k jednotce `to`, nebo null. */
export function mergeBlock(s: GameState, u: Unit, to: Unit): string | null {
  if (u === to || u.owner !== to.owner) return 'Spojit lze jen dvě vlastní jednotky.'
  if (!mergeable(u) || !mergeable(to)) return 'Spojovat se smí jen pěchota, jízda a střelci.'
  if (u.type !== to.type) return 'Spojit lze jen jednotky stejného druhu.'
  if (hexDist(u.x, u.y, to.x, to.y) !== 1) return 'Jednotky musí stát vedle sebe.'
  if (isEmbarked(s, u) || isEmbarked(s, to)) return 'Na vodě se spojit nelze.'
  const n = unitSize(u) + unitSize(to)
  if (n > 3) return 'Ve voji mohou být nejvýš tři jednotky.'
  const need: TechId = n === 3 ? 'armory' : 'tactics'
  if (!hasTech(s.players[u.owner], need)) return `${formationName(n)} vyžaduje technologii ${TECHS[need].name}.`
  if (u.moves <= 0) return 'Jednotka už v tomto tahu nemá pohyb.'
  return null
}

/** Jednotky, ke kterým se `u` může hned připojit. */
export function mergeTargets(s: GameState, u: Unit): Unit[] {
  if (!mergeable(u)) return []
  return s.units.filter(o => o.owner === u.owner && o !== u && o.type === u.type && hexDist(o.x, o.y, u.x, u.y) === 1 && !mergeBlock(s, u, o))
}

/** Jednotka `u` vejde do jednotky `to`: vznikne šik nebo voj na poli `to`. Životy se zprůměrují, zkušenosti se berou od zkušenější. */
export function mergeUnits(s: GameState, u: Unit, to: Unit): boolean {
  if (mergeBlock(s, u, to)) return false
  const a = unitSize(u), b = unitSize(to)
  to.hp = Math.max(1, Math.round((u.hp * a + to.hp * b) / (a + b)))
  if (u.xp > to.xp) { to.xp = u.xp; to.promos = u.promos.slice(); to.vet = u.vet }
  to.size = a + b
  to.moves = 0; to.fortified = false; to.sleep = false
  clearOrders(to); stopUnit(to)
  for (const o of s.units) if (o.escort === u.id) delete o.escort
  const i = s.units.indexOf(u)
  if (i >= 0) s.units.splice(i, 1)
  return true
}

/** Volná sousední pole, kam se mohou jednotky při rozdělení rozestoupit. */
function splitSpots(s: GameState, u: Unit): [number, number][] {
  return neighbors(s, u.x, u.y).filter(([x, y]) => {
    const t = s.tiles[idx(s, x, y)]
    if (!TERRAIN[t.t].passable || (t.owner !== u.owner && t.owner !== -1)) return false
    const c = cityAt(s, x, y)
    if (c && c.owner !== u.owner) return false
    return !unitsAt(s, x, y).some(o => o.owner !== u.owner || !isCivilian(o))
  })
}

/** Proč šik či voj nejde rozdělit, nebo null. */
export function splitBlock(s: GameState, u: Unit): string | null {
  if (unitSize(u) < 2) return 'Jednotka není spojená.'
  if (s.tiles[idx(s, u.x, u.y)].owner !== u.owner) return 'Rozdělit lze jen na vlastním území.'
  if (isEmbarked(s, u)) return 'Na vodě se rozdělit nelze.'
  if (splitSpots(s, u).length < unitSize(u) - 1) return 'Vedle není dost volných polí.'
  return null
}

/** Rozdělí šik či voj: jednotky se rozestoupí na sousední pole, každá se stejnými životy a zkušenostmi. */
export function splitUnit(s: GameState, u: Unit): boolean {
  if (splitBlock(s, u)) return false
  const spots = splitSpots(s, u).slice(0, unitSize(u) - 1)
  delete u.size
  clearOrders(u); stopUnit(u)
  u.moves = 0
  for (const [x, y] of spots) {
    const n = makeUnit(s, u.owner, u.type, x, y, u.vet)
    n.hp = u.hp; n.xp = u.xp; n.promos = u.promos.slice(); n.moves = 0
    emit({ e: 'spawn', unit: n.id, x, y })
  }
  updateVisibility(s, u.owner)
  return true
}

// ---------------------------------------------------------------- skóre a vítězství

export function score(s: GameState, pid: number): number {
  const p = s.players[pid]
  let v = p.techs.length * 6 + (p.empire ?? 0) * 3 + p.traditions.length * 5 + p.era * 8
  for (const c of citiesOf(s, pid)) v += 12 + c.pop * 4 + c.buildings.length * 3 + (c.buildings.includes('wonder') ? 60 : 0)
  for (const t of s.tiles) if (t.owner === pid) v += 0.5
  const m = s.mission
  v += (p.questCamps ? 20 : 0) + (p.questCities ? 20 : 0) + (m.questRuins && m.ruinsBy === pid ? 25 : 0)
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
  for (const u of unitsOf(s, pid)) { u.moves = maxMoves(s, u); u.attacked = false; u.skip = false; delete u.moved; delete u.fortWait }
  // Co města ztratila, zatímco táhli ostatní.
  for (const c of citiesOf(s, pid)) {
    const lost = (c.seen ?? 0) - cityTotal(c)
    if (lost > 0 && s.players[pid].human) {
      const w = cityWalls(c), wm = wallMax(c)
      note(s, pid, `${c.name} bylo napadeno a ztratilo ${lost} bodů obrany. Obránci ${c.hp} / ${cityMaxHp(c)}${wm ? `, hradby ${w} / ${wm}` : ''}.`, 'bad', c.x, c.y)
    }
    delete c.seen
  }
  updateLinks(s)
  updateVisibility(s, pid)
  if (s.players[pid].human) {
    for (const u of unitsOf(s, pid)) {
      // Spící jednotku probudí nepřítel na dohled.
      // Budí jen nepřítel, kterého hráč opravdu vidí – a hráč se dozví proč.
      if (u.sleep && enemySeen(s, u, 2)) { u.sleep = false; note(s, pid, `${UNITS[u.type].name} se probudil: nepřítel je na dohled.`, 'info', u.x, u.y) }
      if (!u.goto || u.escort !== undefined) continue
      // Nepřítel na dohled cestu přeruší, ať hráč rozhodne sám.
      if (enemyNear(s, u, 2)) { stopUnit(u); continue }
      moveUnit(s, u, u.goto[0], u.goto[1])
    }
    for (const u of unitsOf(s, pid)) if (u.roadTo && !u.work) { if (enemyNear(s, u, 2)) stopUnit(u); else roadStep(s, u) }
    followAll(s, pid)
  }
}

export function enemyNear(s: GameState, u: Unit, r: number): boolean {
  return s.units.some(o => o.owner !== u.owner && !isCivilian(o) && atWar(s, u.owner, o.owner) && hexDist(u.x, u.y, o.x, o.y) <= r)
}

/** Léčení za tah na území národa, se kterým jednotka válčí. */
export const HEAL_ENEMY = 5

/** Stojí do `r` polí od jednotky nepřátelská bojová jednotka, kterou její majitel vidí? */
export function enemySeen(s: GameState, u: Unit, r: number): boolean {
  const vis = s.players[u.owner].visible
  return s.units.some(o => o.owner !== u.owner && !isCivilian(o) && atWar(s, u.owner, o.owner) && hexDist(u.x, u.y, o.x, o.y) <= r && !!vis[idx(s, o.x, o.y)])
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
      u.hp = Math.min(100, u.hp + (inCity ? 25 : t.owner === pid ? 15 : t.owner >= 0 && t.owner !== barbId(s) && atWar(s, pid, t.owner) ? HEAL_ENEMY : 10) + (u.promos.includes('medic') ? 10 : 0) + (t.owner !== pid && p.traditions.includes('campaign') ? 10 : 0))
    }
    if (u.work) {
      const t = s.tiles[idx(s, u.x, u.y)]
      u.workLeft -= 1
      if (t.job === u.work) t.jobLeft = u.workLeft
      if (u.workLeft <= 0) { const job = u.work; u.work = null; finishWork(s, u, job) }
    }
  }
  for (const c of citiesOf(s, pid)) c.seen = cityTotal(c)
  if (s.turn % 10 === 0 && pid !== barbId(s)) log(s, pid, 'stav', () => { const cs = citiesOf(s, pid), mil = unitsOf(s, pid).filter(u => !isCivilian(u)); return `měst ${cs.length}, obyvatel ${cs.reduce((n, c) => n + c.pop, 0)}, vojsko ${headcount(mil)} (strojů ${mil.filter(u => UNITS[u.type].siege).length}), zlato ${p.gold}, technologií ${p.techs.length}, tradic ${p.traditions.length}, skóre ${score(s, pid)}${p.war.filter(w => w !== barbId(s)).length ? `, válčí s: ${p.war.filter(w => w !== barbId(s)).map(w => lname(s, w)).join(', ')}` : ''}` })
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
    const cost = techCost(p, p.research)
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
