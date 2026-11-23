// Umělá inteligence soupeřů a barbarů.
import { BUILDINGS, DIFFICULTY, NATIONS, RESOURCES, TECHS, TERRAIN, UNITS, unitFor, type BuildingId, type TechId, type UnitId } from './data.ts'
import { hexDist } from './hex.ts'
import { rand, randInt } from './rng.ts'
import {
  assignWorkers, atWar, attack, availableTechs, buy, buyCost, canBuildBuilding, canBuildUnit, canFoundCity, cityAt, citiesOf, cityYields,
  declareWar, foundCity, idx, improvementsFor, isCivilian, isCoastal, isNaval, isWater, stopUnit, itemCost, makePeace, makeUnit, militaryAt, militaryPower, moveUnit, neighbors,
  note, pathMap, pathTo, playerIncome, previewAttack, startWork, tileYield, tilesWithin, unitsAt, unitsOf, updateVisibility, emit,
  canWork, hasRoad, hasTech, isEmbarked, resourceCap, resourceVisible, unitsNeeding, upgradeBlock, upgradeCost, upgradeUnit,
  type PathMap,
} from './rules.ts'
import { BARB, type BuildItem, type City, type GameState, type Player, type Unit } from './types.ts'

const RESEARCH: Record<string, TechId[]> = {
  builder: ['agriculture', 'pottery', 'mining', 'husbandry', 'archery', 'writing', 'bronze', 'wheel', 'mysticism', 'masonry', 'currency', 'philosophy', 'math', 'astronomy', 'sailing', 'forestry', 'construction', 'iron', 'tactics', 'riding', 'irrigation', 'navigation', 'law'],
  aggressive: ['mining', 'archery', 'agriculture', 'bronze', 'husbandry', 'pottery', 'wheel', 'iron', 'riding', 'tactics', 'writing', 'masonry', 'math', 'sailing', 'forestry', 'construction', 'navigation', 'mysticism', 'currency', 'irrigation', 'philosophy', 'law', 'astronomy'],
}

const BUILD_ORDER: Record<string, BuildingId[]> = {
  builder: ['monument', 'granary', 'library', 'workshop', 'temple', 'market', 'academy', 'harbor', 'aqueduct', 'court', 'walls', 'barracks'],
  aggressive: ['monument', 'granary', 'barracks', 'workshop', 'library', 'walls', 'market', 'temple', 'aqueduct', 'academy', 'court', 'harbor'],
}

export function aiTurn(s: GameState, pid: number): void {
  const p = s.players[pid]
  if (!p.alive) return
  updateVisibility(s, pid)
  aiResearch(s, p)
  aiDiplomacy(s, p)
  for (const c of citiesOf(s, pid)) aiCityBuild(s, p, c)
  const claimed = new Set<number>()
  for (const u of unitsOf(s, pid)) {
    if (!s.units.includes(u)) continue
    if (u.type === 'settler') aiSettler(s, p, u, claimed)
    else if (u.type === 'worker') aiWorker(s, p, u, claimed)
  }
  aiMilitary(s, p)
  aiNavy(s, p)
  aiSpend(s, p)
}

/** Národ, kterému se vyplatí moře: Thalassové vždy, v souostroví všichni. */
const seafarer = (s: GameState, p: Player): boolean => p.nation === 'thal' || s.scenario === 'islands'

function aiResearch(s: GameState, p: Player): void {
  if (p.research) return
  const avail = availableTechs(p)
  if (!avail.length) return
  let order = RESEARCH[p.personality] ?? RESEARCH.builder
  if (seafarer(s, p)) order = ['sailing', ...(p.techs.length >= 5 ? ['navigation' as TechId] : []), ...order]
  p.research = order.find(t => avail.includes(t)) ?? avail[0]
}

// ---------------------------------------------------------------- diplomacie

function majors(s: GameState, p: Player): Player[] {
  return s.players.filter(q => q.id !== p.id && q.id !== BARB && q.alive)
}

export function warDuration(s: GameState, p: Player): number { return s.turn - p.lastWarTurn }

/** Přijme AI nabídku míru od hráče? */
export function aiAcceptsPeace(s: GameState, aiId: number): boolean {
  const p = s.players[aiId]
  if (warDuration(s, p) < 6) return false
  const mine = militaryPower(s, aiId), theirs = militaryPower(s, 0)
  if (mine < theirs * 1.35) return true
  return warDuration(s, p) >= 20
}

function aiDiplomacy(s: GameState, p: Player): void {
  const aggro = DIFFICULTY[s.difficulty].aiAggro
  const mine = militaryPower(s, p.id)
  const myMil = unitsOf(s, p.id).filter(u => !isCivilian(u)).length
  for (const q of majors(s, p)) {
    if (!p.met.includes(q.id)) continue
    const theirs = militaryPower(s, q.id)
    if (atWar(s, p.id, q.id)) {
      const dur = warDuration(s, p)
      if (dur >= 10 && (mine < theirs * 0.9 || dur >= 26)) {
        if (q.human) {
          if (!s.offers.some(o => o.from === p.id) && s.turn % 4 === p.id % 4) s.offers.push({ from: p.id })
        } else if (militaryPower(s, q.id) < mine * 1.6 || dur >= 26) makePeace(s, p.id, q.id)
      }
      continue
    }
    if (s.turn < (p.peaceUntil[q.id] ?? 0)) continue
    // Spojenec ani přítel hráče nenapadne.
    if (q.human && (s.turn < p.pactUntil || p.attitude >= 40)) continue
    if (p.war.length > 0) continue
    let want = false
    // Soupeř, který staví div, je hrozbou pro každého.
    const qWonder = s.cities.some(c => c.owner === q.id && c.build?.kind === 'building' && c.build.id === 'wonder' && c.prod > 90)
    if (qWonder && mine >= theirs * 0.8 && myMil >= 3) want = true
    if (p.personality === 'aggressive') {
      if (s.turn >= 24 / aggro && myMil >= 4 && mine >= theirs * (1.3 / aggro)) want = rand(s) < 0.22 * aggro
    } else if (s.turn >= 55 / aggro && myMil >= 5 && mine >= theirs * (2.0 / aggro)) want = rand(s) < 0.1 * aggro
    // Na lehké obtížnosti dostane hráč na začátku klid.
    if (q.human && s.difficulty === 'easy' && s.turn < 45 && !qWonder) want = false
    // Dobré vztahy válku oddalují.
    if (want && q.human && p.attitude >= 15 && !qWonder && rand(s) < 0.6) want = false
    if (want) declareWar(s, p.id, q.id)
  }
  // Žádost o pomoc: soupeř ve válce s jiným národem zve hráče do spojenectví.
  const me = s.players[0]
  if (me.alive && p.met.includes(0) && !atWar(s, p.id, 0) && p.attitude >= 0 && s.turn % 9 === p.id % 9 && !s.offers.some(o => o.from === p.id)) {
    const foe = majors(s, p).find(q => !q.human && atWar(s, p.id, q.id) && me.met.includes(q.id) && !atWar(s, 0, q.id))
    if (foe && warDuration(s, p) >= 3) s.offers.push({ from: p.id, kind: 'ally', vs: foe.id })
  }
}

// ---------------------------------------------------------------- města

export function siteScore(s: GameState, pid: number, x: number, y: number): number {
  const t = s.tiles[idx(s, x, y)]
  if (!TERRAIN[t.t].passable || t.special) return -1
  if (t.owner !== -1 && t.owner !== pid) return -1
  for (const c of s.cities) if (hexDist(c.x, c.y, x, y) < 4) return -1
  const p = s.players[pid]
  let v = 0
  for (const [tx, ty] of tilesWithin(s, x, y, 2)) {
    const i = idx(s, tx, ty)
    const tt = s.tiles[i]
    if (tt.owner !== -1 && tt.owner !== pid) { v -= 0.5; continue }
    // Hráč nezná, co je v neprozkoumané mlze: počítá se průměrné pole, ať rada nic neprozradí.
    if (p.human && !p.explored[i]) { v += 2.5; continue }
    const yl = tileYield(s, i, pid)
    let tv = yl.food * 1.4 + yl.prod + yl.gold * 0.6
    if (tt.res && resourceVisible(p, tt.res)) {
      // Koně a železo živí vojsko; nejcennější jsou, když národu úplně chybějí a jeho jednotky je potřebují.
      const strat = RESOURCES[tt.res].strategic
      tv += strat ? (unitsNeeding(s, pid, tt.res).length ? (resourceCap(s, pid, tt.res) === 0 ? 7 : 4) : 2) : 1.5
    }
    // Pole, která už patří jinému vlastnímu městu, nové město skoro nevyužije.
    v += tt.owner === pid && tt.city !== -1 ? tv * 0.3 : tv
  }
  if (t.t === 'hills') v += 2
  // Barbarský tábor za humny znamená neustálé nájezdy.
  for (const [tx, ty] of tilesWithin(s, x, y, 3)) if (s.tiles[idx(s, tx, ty)].special === 'camp' && (!p.human || p.explored[idx(s, tx, ty)])) v -= 7
  // Přístav se hodí: lodě, přístavní budova, obchod po moři.
  if (isCoastal(s, x, y)) v += seafarer(s, s.players[pid]) ? 12 : 4
  return v
}

function bestSite(s: GameState, p: Player, u: Unit, pm: PathMap, claimed: Set<number>): [number, number] | null {
  let best: [number, number] | null = null
  let bv = 14
  const home = citiesOf(s, p.id)
  for (let i = 0; i < s.tiles.length; i++) {
    if (pm.dist[i] === Infinity || claimed.has(i)) continue
    const x = i % s.W, y = (i / s.W) | 0
    if (home.length && Math.min(...home.map(c => hexDist(c.x, c.y, x, y))) > (u.sea ? 14 : 8)) continue
    const sc = siteScore(s, p.id, x, y)
    if (sc < 0) continue
    const v = sc - pm.dist[i] * 0.7
    if (v > bv) { bv = v; best = [x, y] }
  }
  return best
}

function aiSettler(s: GameState, p: Player, u: Unit, claimed: Set<number>): void {
  if (citiesOf(s, p.id).length === 0) {
    // Mořeplavci si pro první město dojdou k nejbližšímu dobrému místu na pobřeží (nejvýš pár tahů).
    if (p.nation === 'thal' && s.turn <= 4 && !isCoastal(s, u.x, u.y)) {
      const pm0 = pathMap(s, u)
      let best: [number, number] | null = null, bv = -Infinity
      for (const [x, y] of tilesWithin(s, u.x, u.y, 5)) {
        const i = idx(s, x, y)
        if (!isCoastal(s, x, y) || pm0.dist[i] === Infinity || pm0.dist[i] > 6) continue
        const sc = siteScore(s, p.id, x, y)
        if (sc < 0) continue
        const v = sc - pm0.dist[i] * 1.5
        if (v > bv) { bv = v; best = [x, y] }
      }
      if (best) { moveUnit(s, u, best[0], best[1]); if (u.x === best[0] && u.y === best[1] && !canFoundCity(s, u)) foundCity(s, u); return }
    }
    if (!canFoundCity(s, u)) { foundCity(s, u); return }
  }
  let pm = pathMap(s, u)
  let site = bestSite(s, p, u, pm, claimed)
  // Na souši není kde: osadníci se nalodí a hledají místo za vodou.
  if (!site && !u.sea && hasTech(p, 'sailing')) {
    u.sea = true
    pm = pathMap(s, u)
    site = bestSite(s, p, u, pm, claimed)
    if (!site && !isWater(s.tiles[idx(s, u.x, u.y)])) u.sea = false
  }
  if (!site) { if (!canFoundCity(s, u)) foundCity(s, u); return }
  claimed.add(idx(s, site[0], site[1]))
  if (site[0] === u.x && site[1] === u.y) { foundCity(s, u); return }
  moveUnit(s, u, site[0], site[1])
  if (u.x === site[0] && u.y === site[1] && s.units.includes(u) && !canFoundCity(s, u)) foundCity(s, u)
}

function aiWorker(s: GameState, p: Player, u: Unit, claimed: Set<number>): void {
  // Před nepřítelem dělníci utíkají do města.
  if (threatNear(s, p.id, u.x, u.y, 2) > 0) {
    const c = nearestCity(s, p.id, u.x, u.y)
    if (c && (c.x !== u.x || c.y !== u.y)) { moveUnit(s, u, c.x, c.y); return }
  }
  if (u.work) return
  const pm = pathMap(s, u)
  // Každý druhý dělník dává přednost cestám mezi městy.
  if (u.id % 2 === 0 && aiRoad(s, p, u, pm, claimed)) return
  let best = -1, bv = -Infinity
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i]
    if (t.owner !== p.id || t.imp || t.special || pm.dist[i] === Infinity || claimed.has(i)) continue
    const x = i % s.W, y = (i / s.W) | 0
    if (cityAt(s, x, y)) continue
    const imps = improvementsFor(s, t, p)
    if (!imps.length) continue
    if (s.units.some(o => atWar(s, o.owner, p.id) && !isCivilian(o) && hexDist(o.x, o.y, x, y) <= 2)) continue
    const worked = s.cities.some(c => c.owner === p.id && c.worked.includes(i))
    const v = (t.res ? 6 : 0) + (worked ? 4 : 0) - pm.dist[i] * 1.2
    if (v > bv) { bv = v; best = i }
  }
  if (best < 0) { aiRoad(s, p, u, pm, claimed); return }
  claimed.add(best)
  const x = best % s.W, y = (best / s.W) | 0
  if (u.x !== x || u.y !== y) moveUnit(s, u, x, y)
  if (u.x === x && u.y === y && u.moves > 0) startWork(s, u, improvementsFor(s, s.tiles[best], p)[0])
}

/** Když není co vylepšovat, dělníci propojují města cestou do hlavního města. */
function aiRoad(s: GameState, p: Player, u: Unit, pm: PathMap, claimed: Set<number>): boolean {
  if (!hasTech(p, 'wheel') || isEmbarked(s, u)) return false
  const cities = citiesOf(s, p.id)
  const cap = cities.find(c => c.capital) ?? cities[0]
  if (!cap || cities.length < 2) return false
  // Od nejbližšího vlastního města, které ještě nemá cestu až do hlavního.
  const from = cities.filter(c => c !== cap).sort((a, b) => hexDist(a.x, a.y, u.x, u.y) - hexDist(b.x, b.y, u.x, u.y))
  for (const c of from) {
    const probe: Unit = { ...u, x: c.x, y: c.y, sea: false }
    const cm = pathMap(s, probe)
    const path = pathTo(s, cm, cap.x, cap.y)
    if (!path || path.length > 14) continue
    const gap = path.find(([x, y]) => {
      const i = idx(s, x, y), t = s.tiles[i]
      return !hasRoad(s, i) && !isWater(t) && !claimed.has(i) && (t.owner === p.id || t.owner === -1) && pm.dist[i] !== Infinity && threatNear(s, p.id, x, y, 2) === 0
    })
    if (!gap) continue
    claimed.add(idx(s, gap[0], gap[1]))
    if (u.x !== gap[0] || u.y !== gap[1]) moveUnit(s, u, gap[0], gap[1])
    if (u.x === gap[0] && u.y === gap[1] && canWork(s, u, 'road')) startWork(s, u, 'road')
    return true
  }
  return false
}

function bestMilitary(s: GameState, p: Player, c: City, defensive: boolean): UnitId | null {
  const mine = unitsOf(s, p.id).filter(u => !isCivilian(u) && !isNaval(u))
  const ranged = mine.filter(u => UNITS[u.type].ranged && !UNITS[u.type].siege).length
  const siege = mine.filter(u => UNITS[u.type].siege).length
  const melee = mine.length - ranged - siege
  const can = (id: UnitId) => { const a = unitFor(p.nation, id); return canBuildUnit(s, c, a) ? a : null }
  const archer = can('archer')
  if (defensive && archer) return archer
  if (p.war.length && melee >= 3 && siege < 2) { const k = can('catapult'); if (k) return k }
  if (archer && ranged < (mine.length + 1) * 0.35) return archer
  const opts = (['swordsman', 'horseman', 'spearman', 'warrior'] as UnitId[]).map(can).filter((x): x is UnitId => !!x)
  if (!opts.length) return archer
  opts.sort((a, b) => UNITS[b].str - UNITS[a].str)
  // Občas jízda kvůli pestrosti.
  if (opts.length > 1 && UNITS[opts[1]].mounted && rand(s) < 0.3) return opts[1]
  return opts[0]
}

function threatNear(s: GameState, pid: number, x: number, y: number, r: number): number {
  let n = 0
  for (const u of s.units) if (!isCivilian(u) && atWar(s, pid, u.owner) && hexDist(u.x, u.y, x, y) <= r) n++
  return n
}

function aiCityBuild(s: GameState, p: Player, c: City): void {
  if (c.build && c.prod >= itemCost(c.build) * 0.2) return
  const cities = citiesOf(s, p.id)
  const units = unitsOf(s, p.id)
  const mil = units.filter(u => !isCivilian(u) && !isNaval(u) && u.type !== 'scout').length
  const navy = units.filter(isNaval).length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && !!UNITS[o.build.id].naval).length
  const settlers = units.filter(u => u.type === 'settler').length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && o.build.id === 'settler').length
  const workers = units.filter(u => u.type === 'worker').length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && o.build.id === 'worker').length
  const threat = threatNear(s, p.id, c.x, c.y, 4)
  const garrison = militaryAt(s, c.x, c.y)
  const war = p.war.length > 0
  const hard = DIFFICULTY[s.difficulty].aiExtra
  const setU = (id: UnitId | null) => { if (id) { c.build = { kind: 'unit', id }; return true } return false }
  const setB = (id: BuildingId) => { c.build = { kind: 'building', id } }
  c.build = null

  if ((threat > 0 && (!garrison || threat > 1)) || mil < cities.length) { if (setU(bestMilitary(s, p, c, !garrison))) return }
  if (cities.length === 1 && !units.some(u => u.type === 'scout') && s.turn < 12 && mil >= 1 && canBuildUnit(s, c, 'scout')) { setU('scout'); return }
  const targetCities = (p.personality === 'builder' ? 5 : 4) + hard
  if (cities.length + settlers < targetCities && settlers === 0 && c.pop >= 2 && threatNear(s, p.id, c.x, c.y, 2) === 0 && s.turn < 85) {
    // Stojí za to jen tehdy, když je kde stavět.
    let any = false
    for (const [x, y] of tilesWithin(s, c.x, c.y, 7)) if (siteScore(s, p.id, x, y) > 16) { any = true; break }
    if (any) { setU('settler'); return }
  }
  const anyImpTech = p.techs.some(t => ['agriculture', 'mining', 'husbandry', 'forestry'].includes(t))
  if (anyImpTech && workers < Math.min(cities.length, 3) + (cities.length >= 3 ? 1 : 0)) { setU('worker'); return }
  if (canBuildBuilding(s, c, 'wonder')) {
    const bestProd = cities.slice().sort((a, b) => cityYields(s, b).prod - cityYields(s, a).prod)[0]
    if (bestProd.id === c.id && (p.personality === 'builder' || !war)) { setB('wonder'); return }
  }
  // Loďstvo: pár lodí na obranu pobřeží, ve válce o jednu víc.
  const sea = seafarer(s, p)
  if (sea && isCoastal(s, c.x, c.y) && c.buildings.length >= 2 && canBuildBuilding(s, c, 'harbor')) { setB('harbor'); return }
  if (isCoastal(s, c.x, c.y) && mil >= cities.length + (sea ? 0 : 1) && s.turn > (sea ? 14 : 30)) {
    const want = Math.min(3, cities.filter(o => isCoastal(s, o.x, o.y)).length) + (war ? 1 : 0) - (p.personality === 'builder' && !war && !sea ? 1 : 0) + (sea ? 1 : 0)
    const ship: UnitId | null = canBuildUnit(s, c, 'trireme') ? 'trireme' : canBuildUnit(s, c, 'galley') ? 'galley' : null
    if (ship && navy < want && playerIncome(s, p.id).gold > 0) { setU(ship); return }
  }
  const armyTarget = cities.length * 1.6 + (p.personality === 'aggressive' ? 3 + s.turn / 18 : 1 + s.turn / 40) + (war ? 3 : 0)
  if ((war || p.personality === 'aggressive') && mil < armyTarget) { if (setU(bestMilitary(s, p, c, false))) return }
  for (const b of BUILD_ORDER[p.personality] ?? BUILD_ORDER.builder) {
    if (!canBuildBuilding(s, c, b)) continue
    if (b === 'walls' && !war && threat === 0 && p.personality === 'builder') continue
    if (BUILDINGS[b].maint > 0 && playerIncome(s, p.id).gold < 0 && p.gold < 30) continue
    setB(b); return
  }
  if (mil < armyTarget * 1.3 && playerIncome(s, p.id).gold > 1) { if (setU(bestMilitary(s, p, c, false))) return }
  c.build = null
}

function aiSpend(s: GameState, p: Player): void {
  const reserve = p.personality === 'builder' ? 90 : 60
  if (p.gold < reserve) return
  // Zastaralé jednotky přezbrojit, když je to levné.
  for (const u of unitsOf(s, p.id)) {
    if (upgradeBlock(s, u) || p.gold - upgradeCost(s, u) < 40) continue
    upgradeUnit(s, u)
    break
  }
  if (p.gold < reserve) return
  const cities = citiesOf(s, p.id).filter(c => c.build && !(c.build.kind === 'building' && c.build.id === 'wonder'))
  cities.sort((a, b) => threatNear(s, p.id, b.x, b.y, 3) - threatNear(s, p.id, a.x, a.y, 3) || buyCost(s, b) - buyCost(s, a))
  for (const c of cities) {
    const cost = buyCost(s, c)
    if (cost > 0 && p.gold - cost >= 15) { buy(s, c); return }
  }
}

// ---------------------------------------------------------------- vojsko

/** Nejlepší okamžitý útok jednotky; vrací true, když zaútočila. */
function tryAttack(s: GameState, u: Unit, bold = 0): boolean {
  const d = UNITS[u.type]
  if (d.civilian || u.attacked || u.moves <= 0) return false
  const r = d.ranged ? d.range! : 1
  let best: [number, number] | null = null
  let bv = 0
  for (const [x, y] of tilesWithin(s, u.x, u.y, r)) {
    const pv = previewAttack(s, u, x, y)
    if (!pv || pv.needWar >= 0) continue
    let v = pv.dmgDef - pv.dmgAtt * 0.9 + bold
    const kills = pv.dmgDef >= pv.defHp
    if (kills) v += pv.city ? 80 : 30
    if (pv.city && !pv.ranged && !kills && pv.city.hp > 70 && u.hp < 70) v -= 30
    if (!pv.ranged && pv.dmgAtt >= pv.attHp - 5 && !kills) v -= 60
    if (pv.ranged) v += 8
    if (v > bv) { bv = v; best = [x, y] }
  }
  if (!best) return false
  return attack(s, u, best[0], best[1])
}

/** Přiblíží jednotku k cíli na vzdálenost `range` (cílové pole samo bývá obsazené). */
function approach(s: GameState, u: Unit, tx: number, ty: number, range: number): boolean {
  if (u.moves <= 0) return false
  const cur = hexDist(u.x, u.y, tx, ty)
  if (cur <= range && cur >= Math.min(range, 1)) return false
  const pm = pathMap(s, u)
  let best = -1, bd = Infinity
  for (const [x, y] of tilesWithin(s, tx, ty, range)) {
    const i = idx(s, x, y)
    if (pm.dist[i] === Infinity || (!pm.stop[i] && pm.dist[i] > 0)) continue
    if (!isNaval(u) && isWater(s.tiles[i])) continue
    const hd = hexDist(x, y, tx, ty)
    // Střelci si drží odstup.
    const v = pm.dist[i] + (range > 1 ? (range - hd) * 1.5 : 0)
    if (v < bd) { bd = v; best = i }
  }
  if (best < 0) {
    // Cesta neexistuje nebo je vše obsazeno – aspoň se přiblížit vzdušnou čarou.
    let bi = -1, bh = cur
    for (let i = 0; i < pm.dist.length; i++) {
      if (pm.dist[i] === Infinity || !pm.stop[i] || pm.dist[i] > u.moves + 2) continue
      const h = hexDist(i % s.W, (i / s.W) | 0, tx, ty)
      if (h < bh) { bh = h; bi = i }
    }
    if (bi < 0) return false
    best = bi
  }
  if (best === idx(s, u.x, u.y)) return false
  return moveUnit(s, u, best % s.W, (best / s.W) | 0)
}

function nearestCity(s: GameState, pid: number, x: number, y: number): City | null {
  let best: City | null = null, bd = Infinity
  for (const c of s.cities) if (c.owner === pid) { const d = hexDist(c.x, c.y, x, y); if (d < bd) { bd = d; best = c } }
  return best
}

function aiMilitary(s: GameState, p: Player): void {
  const pid = p.id
  const cities = citiesOf(s, pid)
  const army = unitsOf(s, pid).filter(u => !isCivilian(u) && !isNaval(u))
  if (!army.length) return
  const assigned = new Set<number>()

  // Průzkumníci.
  for (const u of army) {
    if (u.type !== 'scout') continue
    assigned.add(u.id)
    explore(s, p, u)
  }

  // Posádky: každé město chce jednu jednotku, ohrožená města nejdřív.
  const byThreat = cities.slice().sort((a, b) => threatNear(s, pid, b.x, b.y, 4) - threatNear(s, pid, a.x, a.y, 4))
  for (const c of byThreat) {
    let best: Unit | null = null, bd = Infinity
    for (const u of army) {
      if (assigned.has(u.id)) continue
      const ud = UNITS[u.type]
      const d = hexDist(u.x, u.y, c.x, c.y) + (ud.mounted ? 3 : 0) + (ud.siege ? 5 : 0) - (ud.ranged ? 1 : 0)
      if (d < bd) { bd = d; best = u }
    }
    if (!best || bd > 9) continue
    assigned.add(best.id)
    if (best.x !== c.x || best.y !== c.y) moveUnit(s, best, c.x, c.y)
    if (best.x === c.x && best.y === c.y) {
      // Posádka střílí vždy, zblízka útočí jen výhodně a vrací se zpět do města díky opevnění.
      if (UNITS[best.type].ranged) tryAttack(s, best)
      if (best.moves > 0 && !best.attacked) best.fortified = true
    } else tryAttack(s, best)
  }

  const field = army.filter(u => !assigned.has(u.id) && s.units.includes(u))
  if (!field.length) return

  // Válečný cíl: nejbližší nepřátelské město.
  let target: City | null = null
  const home = cities.find(c => c.capital) ?? cities[0]
  if (p.war.length && home) {
    let bd = Infinity
    for (const c of s.cities) {
      if (!p.war.includes(c.owner) || !p.explored[idx(s, c.x, c.y)]) continue
      const d = hexDist(home.x, home.y, c.x, c.y) + c.hp / 80
      if (d < bd) { bd = d; target = c }
    }
  }
  const strong = field.filter(u => u.hp >= 60).length
  const march = !!target && strong >= (p.personality === 'aggressive' ? 3 : 4)

  for (const u of field) {
    if (!s.units.includes(u)) continue
    const ud = UNITS[u.type]
    const near = nearestCity(s, pid, u.x, u.y)
    // Zraněné jednotky se stahují a léčí.
    if (u.hp < 40 && near) {
      if (tryAttack(s, u, -15)) continue
      const t = s.tiles[idx(s, u.x, u.y)]
      if (t.owner !== pid || threatNear(s, pid, u.x, u.y, 1) > 0) approach(s, u, near.x, near.y, 1)
      continue
    }
    if (tryAttack(s, u)) { if (u.moves <= 0 || !s.units.includes(u)) continue }
    // Nepřítel poblíž vlastního území má přednost.
    let foe: Unit | null = null, fd = Infinity
    for (const o of s.units) {
      if (isCivilian(o) && o.owner === BARB) continue
      if (!atWar(s, pid, o.owner) || !p.visible[idx(s, o.x, o.y)]) continue
      const d = hexDist(u.x, u.y, o.x, o.y)
      const own = near ? hexDist(near.x, near.y, o.x, o.y) : 99
      if (d <= 5 && own <= 6 && d < fd) { fd = d; foe = o }
    }
    if (foe && u.hp >= 50) {
      approach(s, u, foe.x, foe.y, ud.ranged ? ud.range! : 1)
      if (s.units.includes(u)) tryAttack(s, u)
      continue
    }
    const onWater = isWater(s.tiles[idx(s, u.x, u.y)])
    if (u.sea && !march && !onWater) u.sea = false
    if (march && target) {
      // Výsadek: když je cesta po moři výrazně kratší (nebo jediná), jednotka se nalodí.
      if (!u.sea && !ud.siege && hasTech(p, 'sailing') && isCoastal(s, target.x, target.y)) {
        const goal = (m: PathMap) => Math.min(...tilesWithin(s, target!.x, target!.y, 1).map(([x, y]) => (isWater(s.tiles[idx(s, x, y)]) ? Infinity : m.dist[idx(s, x, y)])))
        const land = goal(pathMap(s, u))
        u.sea = true
        const sea = goal(pathMap(s, u))
        if (!(sea < Infinity && (land === Infinity || sea < land * 0.7))) u.sea = false
      }
      approach(s, u, target.x, target.y, ud.ranged ? ud.range! : 1)
      if (s.units.includes(u)) tryAttack(s, u, 6)
      continue
    }
    // Barbarské tábory v dosahu.
    if (u.hp >= 70 && near && !ud.siege) {
      let camp: [number, number] | null = null, cd = Infinity
      for (let i = 0; i < s.tiles.length; i++) {
        if (s.tiles[i].special !== 'camp' || !p.explored[i]) continue
        const x = i % s.W, y = (i / s.W) | 0
        const d = hexDist(near.x, near.y, x, y)
        if (d <= 6 && d < cd) { cd = d; camp = [x, y] }
      }
      if (camp && field.length >= 2) {
        const guard = militaryAt(s, camp[0], camp[1])
        if (guard) { approach(s, u, camp[0], camp[1], ud.ranged ? ud.range! : 1); if (s.units.includes(u)) tryAttack(s, u, 4) }
        else moveUnit(s, u, camp[0], camp[1])
        continue
      }
    }
    // Jinak hlídka poblíž domova.
    if (near) {
      const d = hexDist(u.x, u.y, near.x, near.y)
      if (d > 2) approach(s, u, near.x, near.y, 2)
      else if (u.moves >= ud.move) u.fortified = true
    }
  }
}

/** Lodě: střílejí a útočí na vše v dosahu, stíhají nepřítele u pobřeží, ve válce ostřelují přímořská města, jinak hlídkují doma. */
function aiNavy(s: GameState, p: Player): void {
  const pid = p.id
  for (const u of unitsOf(s, pid).filter(isNaval)) {
    if (!s.units.includes(u)) continue
    const ud = UNITS[u.type]
    const range = ud.ranged ? ud.range! : 1
    const near = nearestCity(s, pid, u.x, u.y)
    if (u.hp < 40 && near) { if (!tryAttack(s, u, -15)) approach(s, u, near.x, near.y, 1); continue }
    if (tryAttack(s, u)) { if (u.moves <= 0 || !s.units.includes(u)) continue }
    let foe: Unit | null = null, fd = Infinity
    for (const o of s.units) {
      if (!atWar(s, pid, o.owner) || !p.visible[idx(s, o.x, o.y)]) continue
      // Galéra dosáhne jen na cíle na vodě.
      if (!ud.ranged && !isWater(s.tiles[idx(s, o.x, o.y)])) continue
      const d = hexDist(u.x, u.y, o.x, o.y)
      if (d <= 8 && d < fd) { fd = d; foe = o }
    }
    if (foe) { approach(s, u, foe.x, foe.y, range); if (s.units.includes(u)) tryAttack(s, u); continue }
    if (ud.ranged && p.war.length) {
      let target: City | null = null, bd = Infinity
      for (const c of s.cities) {
        if (!p.war.includes(c.owner) || !p.explored[idx(s, c.x, c.y)] || !isCoastal(s, c.x, c.y)) continue
        const d = hexDist(u.x, u.y, c.x, c.y)
        if (d < bd) { bd = d; target = c }
      }
      if (target && bd <= 24) { approach(s, u, target.x, target.y, range); if (s.units.includes(u)) tryAttack(s, u, 6); continue }
    }
    if (near && hexDist(u.x, u.y, near.x, near.y) > 3) approach(s, u, near.x, near.y, 2)
    else if (u.moves >= ud.move) u.fortified = true
  }
}

/** Automatika hráčových jednotek: dělníci vylepšují pole, ostatní zkoumají mapu. */
export function autoUnits(s: GameState): void {
  const p = s.players[0]
  const claimed = new Set<number>()
  for (const u of unitsOf(s, 0)) {
    if (!u.auto || !s.units.includes(u)) continue
    if (u.type === 'worker') {
      // Rozdělaná práce jiných dělníků se nedubluje.
      for (const o of unitsOf(s, 0)) if (o !== u && o.type === 'worker' && o.work) claimed.add(idx(s, o.x, o.y))
      aiWorker(s, p, u, claimed)
    } else if (!explore(s, p, u)) {
      u.auto = false; u.fortified = false
      note(s, 0, `${UNITS[u.type].name}: není už co zkoumat, automatický průzkum končí.`, 'info', u.x, u.y)
    }
  }
}

/** Pošle jednotku k nejbližší hranici poznaného světa; false = není kam. */
function explore(s: GameState, p: Player, u: Unit): boolean {
  if (u.hp < 50) return true
  stopUnit(u)
  const naval = isNaval(u)
  const pm = pathMap(s, u)
  let best = -1, bv = Infinity
  for (let i = 0; i < s.tiles.length; i++) {
    if (pm.dist[i] === Infinity || !pm.stop[i] || p.explored[i] === 0) continue
    const x = i % s.W, y = (i / s.W) | 0
    // Hranice poznaného světa: sousedí s neprozkoumaným polem.
    if (!neighbors(s, x, y).some(n => !p.explored[idx(s, n[0], n[1])])) continue
    if (threatNear(s, p.id, x, y, 2) > 0) continue
    // Pěší průzkumníci se sami nenaloďují.
    if (!naval && isWater(s.tiles[i])) continue
    const v = pm.dist[i] + ((i * 7 + u.id) % 5) * 0.3
    if (v < bv) { bv = v; best = i }
  }
  if (best >= 0) { moveUnit(s, u, best % s.W, (best / s.W) | 0); u.goto = null; return true }
  u.fortified = true
  return false
}

// ---------------------------------------------------------------- barbaři

export function barbTurn(s: GameState): void {
  const diff = DIFFICULTY[s.difficulty]
  updateVisibility(s, BARB)
  // Posily z táborů.
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i].special !== 'camp') continue
    const x = i % s.W, y = (i / s.W) | 0
    const mine = s.units.filter(u => u.owner === BARB && u.home === i)
    const guard = militaryAt(s, x, y)
    const cap = 2 + (s.turn > 50 ? 1 : 0)
    const due = (s.turn + i) % diff.barbEvery === 0
    if ((!guard && mine.length === 0 && s.turn % 3 === 0) || (due && s.turn > 6 && mine.length < cap)) {
      let spot: [number, number] | null = guard ? null : [x, y]
      if (!spot) for (const n of neighbors(s, x, y)) { if (TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length && !cityAt(s, n[0], n[1])) { spot = n; break } }
      if (spot) {
        const pool: UnitId[] = s.turn < 28 ? ['warrior', 'warrior', 'archer'] : s.turn < 65 ? ['warrior', 'spearman', 'archer', 'spearman'] : ['spearman', 'swordsman', 'archer', 'horseman']
        const u = makeUnit(s, BARB, pool[randInt(s, pool.length)], spot[0], spot[1])
        u.home = i
        emit({ e: 'spawn', unit: u.id, x: u.x, y: u.y })
      }
    }
  }
  const raidEvery = s.difficulty === 'easy' ? 22 : s.difficulty === 'normal' ? 15 : 11
  if (s.turn >= 30 && s.turn % raidEvery === 0) seaRaid(s)
  const reach = s.difficulty === 'easy' ? 4 : s.difficulty === 'normal' ? 6 : 7
  for (const u of unitsOf(s, BARB)) {
    if (!s.units.includes(u)) continue
    const water = isWater(s.tiles[idx(s, u.x, u.y)])
    if (u.sea && !water) u.sea = false
    if (water) {
      // Piráti: loď napadá plavidla a blokuje přístav, nájezdníci plují k nejbližšímu městu.
      const naval = isNaval(u)
      if (tryAttack(s, u, 3)) continue
      let prey: Unit | null = null, pd = Infinity
      if (naval) for (const o of s.units) {
        if (o.owner === BARB || !isWater(s.tiles[idx(s, o.x, o.y)])) continue
        const d = hexDist(u.x, u.y, o.x, o.y)
        if (d <= 6 && d < pd) { pd = d; prey = o }
      }
      if (prey) { approach(s, u, prey.x, prey.y, 1); if (s.units.includes(u)) tryAttack(s, u, 3); continue }
      let c: City | null = null, cd = Infinity
      for (const o of s.cities) { const d = hexDist(u.x, u.y, o.x, o.y); if (d < cd) { cd = d; c = o } }
      if (c && cd <= 14) { if (naval) { if (cd > 2) approach(s, u, c.x, c.y, 2) } else approach(s, u, c.x, c.y, 1) }
      continue
    }
    const hx = u.home >= 0 ? u.home % s.W : u.x, hy = u.home >= 0 ? (u.home / s.W) | 0 : u.y
    const isGuard = u.home >= 0 && u.x === hx && u.y === hy
    // Barbaři jsou draví: napadnou i vyrovnaného soupeře, stráž tábora je jen o málo opatrnější.
    if (tryAttack(s, u, isGuard ? 14 : 16)) continue
    if (isGuard) { u.fortified = true; continue }
    // Tábor bez stráže: nejbližší se vrátí hlídat.
    if (u.home >= 0 && !militaryAt(s, hx, hy)) { moveUnit(s, u, hx, hy); continue }
    if (u.hp < 35) { if (u.home >= 0) approach(s, u, hx, hy, 1); continue }
    // Cíl: nejbližší cizí jednotka nebo město v dosahu.
    let tx = -1, ty = -1, td = Infinity
    if (s.turn > 6) {
      for (const o of s.units) {
        if (o.owner === BARB) continue
        const d = hexDist(u.x, u.y, o.x, o.y) - (isCivilian(o) ? 1 : 0)
        if (d <= reach && d < td) { td = d; tx = o.x; ty = o.y }
      }
      if (s.turn > 22) for (const c of s.cities) {
        const d = hexDist(u.x, u.y, c.x, c.y) + 1
        if (d <= reach && d < td) { td = d; tx = c.x; ty = c.y }
      }
    }
    if (tx >= 0) {
      const ud = UNITS[u.type]
      const civOnly = !militaryAt(s, tx, ty) && !cityAt(s, tx, ty)
      if (civOnly) moveUnit(s, u, tx, ty)
      else approach(s, u, tx, ty, ud.ranged ? ud.range! : 1)
      if (s.units.includes(u)) tryAttack(s, u, 3)
      continue
    }
    // Bezcílné potulování kolem tábora.
    const opts = neighbors(s, u.x, u.y).filter(n => TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length && !cityAt(s, n[0], n[1]) && hexDist(n[0], n[1], hx, hy) <= 3)
    if (opts.length && rand(s) < 0.6) { const n = opts[randInt(s, opts.length)]; moveUnit(s, u, n[0], n[1]) }
  }
}

/** Nájezd z moře: pirátská galéra a člun s nájezdníky se objeví u pobřežního města. */
function seaRaid(s: GameState): void {
  if (unitsOf(s, BARB).filter(isNaval).length >= 3) return
  // Cílem jsou města u moře i kousek ve vnitrozemí – nájezdníci k nim dojdou pěšky.
  const targets = s.cities.filter(c => tilesWithin(s, c.x, c.y, 4).some(([x, y]) => s.tiles[idx(s, x, y)].t === 'coast'))
  if (!targets.length) return
  const c = targets[randInt(s, targets.length)]
  const spots = tilesWithin(s, c.x, c.y, 7).filter(([x, y]) => {
    const t = s.tiles[idx(s, x, y)]
    return t.t === 'coast' && hexDist(x, y, c.x, c.y) >= 3 && !unitsAt(s, x, y).length
  })
  if (!spots.length) return
  const first = spots[randInt(s, spots.length)]
  const near = spots.filter(p => hexDist(p[0], p[1], first[0], first[1]) === 1)
  const ship = makeUnit(s, BARB, 'galley', first[0], first[1])
  emit({ e: 'spawn', unit: ship.id, x: ship.x, y: ship.y })
  const crew: UnitId[] = s.turn < 55 ? ['warrior'] : s.turn < 85 ? ['spearman', 'warrior'] : ['swordsman', 'spearman']
  crew.slice(0, near.length).forEach((type, k) => {
    const u = makeUnit(s, BARB, type, near[k][0], near[k][1])
    u.sea = true
    emit({ e: 'spawn', unit: u.id, x: u.x, y: u.y })
  })
  if (c.owner === 0) note(s, 0, `Piráti! U města ${c.name} se objevily nepřátelské lodě s nájezdníky.`, 'bad', first[0], first[1])
}

/** Tip pro hráče: co by ve městě stavěl rozvážný stavitel. Stav hry nemění. */
export function recommendBuild(s: GameState, c: City): BuildItem | null {
  const p = s.players[c.owner]
  const keep = { build: c.build, prod: c.prod, queue: c.queue, rng: s.rng, pers: p.personality }
  p.personality = 'builder'; c.prod = 0; c.build = null
  aiCityBuild(s, p, c)
  const out = c.build as BuildItem | null
  c.build = keep.build; c.prod = keep.prod; c.queue = keep.queue; s.rng = keep.rng; p.personality = keep.pers
  return out
}

/** Tip pro hráče: kterou dostupnou technologii zkoumat. V míru podle stavitele, ve válce podle válečníka. */
export function adviseTech(s: GameState, p: Player): TechId | null {
  const avail = availableTechs(p)
  if (!avail.length) return null
  let order = p.war.length ? RESEARCH.aggressive : RESEARCH.builder
  if (seafarer(s, p)) order = ['sailing', ...(p.techs.length >= 5 ? ['navigation' as TechId] : []), ...order]
  return order.find(t => avail.includes(t)) ?? avail[0]
}

/** Doporučení výroby pro hráče (tlačítko „Poradit“) – stejná logika jako AI stavitel. */
export function adviseBuild(s: GameState, c: City): void {
  const p = s.players[c.owner]
  const saved = p.personality
  p.personality = 'builder'
  const prod = c.prod
  c.prod = 0
  aiCityBuild(s, p, c)
  c.prod = prod
  p.personality = saved
  assignWorkers(s, c)
}

export function describeAI(p: Player): string {
  const n = NATIONS[p.nation]
  return `${n.leader}, ${n.title.toLowerCase()} – ${p.personality === 'aggressive' ? 'výbojný sok' : 'trpělivý stavitel'}`
}

void TECHS; void note
