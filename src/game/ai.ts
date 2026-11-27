// Umělá inteligence soupeřů a barbarů.
import { TUNE, BUILDINGS, DIFFICULTY, NATIONS, PERSONAS, RESOURCES, TECHS, TERRAIN, UNITS, unitFor, type BuildingId, type PersonaDef, type PersonaId, type TechId, type UnitId } from './data.ts'
import { hexDist } from './hex.ts'
import { rand, randInt } from './rng.ts'
import { log } from './log.ts'
import {
  assignWorkers, atWar, attack, availableTechs, buy, buyCost, canBuildBuilding, canBuildUnit, canFoundCity, cityAt, citiesOf, cityFull, cityTotal, cityWalls, wallFactor, cityStrength, cityYields, unitStrength, SIEGE_UNITS,
  declareWar, foundCity, idx, headcount, mergeTargets, mergeUnits, unitSize, BORDER_MAX, CITY_GAP, popCap, pillage, pillageBlock, recommendJob, isCivilian, isCoastal, isNaval, isWater, stopUnit, itemCost, makePeace, makeUnit, militaryAt, militaryPower, moveUnit, neighbors,
  note, pathMap, pathTo, playerIncome, previewAttack, startWork, tileYield, tilesWithin, unitsAt, unitsOf, updateVisibility, emit,
  canWork, followAll, hasRoad, hasTech, isEmbarked, resourceCap, resourceVisible, unitsNeeding, upgradeBlock, upgradeCost, upgradeUnit,
  type PathMap,
} from './rules.ts'
import { barbId, type BuildItem, type City, type GameState, type JobId, type Player, type Unit } from './types.ts'

/** Povaha, podle které se národ rozhoduje; lidskému hráči radí stavitel. */
const per = (p: Player): PersonaDef => PERSONAS[p.personality as PersonaId] ?? PERSONAS.builder

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
  // Komu po tažení zbyl pohyb na cizím vylepšeném poli, ten plení.
  for (const u of unitsOf(s, pid)) if (s.units.includes(u) && !pillageBlock(s, u)) pillage(s, u)
  aiSpend(s, p)
}

/** Národ, kterému se vyplatí moře: Thalassové vždy, v souostroví všichni. */
const seafarer = (s: GameState, p: Player): boolean => p.nation === 'thal' || s.scenario === 'islands'

function aiResearch(s: GameState, p: Player): void {
  if (p.research) return
  const avail = availableTechs(p)
  if (!avail.length) return
  let order = per(p).research
  if (seafarer(s, p)) order = ['sailing', 'fishing', ...(p.techs.length >= 5 ? ['navigation' as TechId] : []), ...order]
  p.research = order.find(t => avail.includes(t)) ?? avail[0]
}

// ---------------------------------------------------------------- diplomacie

function majors(s: GameState, p: Player): Player[] {
  return s.players.filter(q => q.id !== p.id && q.id !== barbId(s) && q.alive)
}

export function warDuration(s: GameState, p: Player): number { return s.turn - p.lastWarTurn }

/** Přijme AI nabídku míru od hráče `from`? */
export function aiAcceptsPeace(s: GameState, aiId: number, from = 0): boolean {
  const p = s.players[aiId]
  // Kdo drží Sluneční chrám, s tím se mír neuzavírá.
  if (s.mission.wonderBy === from) return false
  if (warDuration(s, p) < 6) return false
  const mine = militaryPower(s, aiId), theirs = militaryPower(s, from)
  if (mine < theirs * 1.35) return true
  return warDuration(s, p) >= 20
}

function aiDiplomacy(s: GameState, p: Player): void {
  const aggro = DIFFICULTY[s.difficulty].aiAggro
  const k = per(p)
  const mine = militaryPower(s, p.id)
  const myMil = headcount(unitsOf(s, p.id).filter(u => !isCivilian(u)))
  // Jak daleko má k nejbližšímu městu soupeře; válka přes půl světa nedává smysl.
  const myCities = citiesOf(s, p.id)
  const reach = (q: Player): number => {
    let d = Infinity
    for (const a of myCities) for (const b of s.cities) if (b.owner === q.id) d = Math.min(d, hexDist(a.x, a.y, b.x, b.y))
    return d
  }
  const far = 16 + Math.floor(s.turn / 8)
  // Nejdřív sousedé: nejbližší a nejslabší soupeř je nejlákavější cíl.
  const order = majors(s, p).map(q => ({ q, d: reach(q) })).sort((a, b) => (a.d + militaryPower(s, a.q.id) / 4) - (b.d + militaryPower(s, b.q.id) / 4) || a.q.id - b.q.id)
  for (const { q, d: dist } of order) {
    if (!p.met.includes(q.id)) continue
    const theirs = militaryPower(s, q.id)
    if (atWar(s, p.id, q.id)) {
      const dur = warDuration(s, p)
      // Mír se neuzavírá s držitelem chrámu, při slibném obléhání, a mezi počítači ani tehdy, když obléhá druhá strana.
      if (s.mission.wonderBy === q.id || pressing(s, p, q) || (!q.human && pressing(s, q, p))) continue
      if (TUNE.keepWar && mine >= theirs * 1.2 && dur < 45) continue
      if (dur >= 10 && (mine < theirs * k.peaceRatio || dur >= k.peaceAfter)) {
        if (q.human) {
          if (!s.offers.some(o => o.from === p.id && o.to === q.id) && s.turn % 4 === p.id % 4) s.offers.push({ from: p.id, to: q.id })
        } else if (militaryPower(s, q.id) < mine * 1.6 || dur >= k.peaceAfter) {
          log(s, p.id, 'mír', () => `s národem ${nat(s, q.id)} po ${dur} tazích války: ${mine < theirs * k.peaceRatio ? `slabší vojsko (${Math.round(mine)} proti ${Math.round(theirs)})` : 'válka trvá dlouho'}${p.siege ? `, tažení na město ${cityName(s, p.siege.city)} ${p.siege.go ? 'bylo na cestě' : 'se chystalo'}` : ''}`)
          makePeace(s, p.id, q.id)
        }
      }
      continue
    }
    // Držitel Slunečního chrámu vítězí za pár tahů: proti němu se zvedne každý, kdo na něj dosáhne, bez ohledu na smlouvy.
    if (s.mission.wonderBy === q.id && myMil >= 2 && dist <= far + 12) { log(s, p.id, 'válka', `národu ${nat(s, q.id)}: drží Sluneční chrám`); declareWar(s, p.id, q.id); continue }
    if (s.turn < (p.peaceUntil[q.id] ?? 0)) continue
    // Spojenec ani přítel hráče nenapadne.
    if (q.human && (s.turn < p.pactUntil[q.id] || p.attitude[q.id] >= 40)) continue
    if (p.war.length > 0) continue
    let want = false
    // Soupeř, který staví div, je hrozbou pro každého.
    const wCity = s.cities.find(c => c.owner === q.id && c.build?.kind === 'building' && c.build.id === 'wonder')
    const qWonder = !!wCity && wCity.prod > BUILDINGS.wonder.cost * 0.5
    // Na stavitele chrámu se chystá tažení hned, jak stavbu začne; válka přijde, až bude vojsko připravené nebo stavba pokročí.
    if (wCity && myMil >= 3 && dist <= far + 8 && s.turn >= (p.peaceUntil[q.id] ?? 0) && (!p.siege || (p.siege.pre && p.siege.city !== wCity.id))) {
      p.siege = { city: wCity.id, go: false, since: s.turn, pre: true }
      log(s, p.id, 'tažení', `plán na město ${wCity.name} (${nat(s, q.id)}): staví Sluneční chrám; vlastních jednotek ${myMil}`)
      continue
    }
    if (qWonder && mine >= theirs * 0.8 && myMil >= 3 && dist <= far + 8) want = true
    if (dist <= far && s.turn >= k.warFrom * TUNE.warFrom / aggro && myMil >= k.warMil && mine >= theirs * ((k.warRatio + 0.3) / aggro)) want = rand(s) < k.warChance * TUNE.warChance * aggro
    // Vypočítavý národ udeří na toho, kdo už válčí s někým jiným a nemá navrch.
    if (!want && k.dogpile > 0 && dist <= far && s.turn >= 20 / aggro && myMil >= 3 && mine >= theirs * 0.85 && q.war.some(w => w !== barbId(s) && w !== p.id && s.players[w].alive)) want = rand(s) < k.dogpile * aggro
    // Na lehké obtížnosti dostane hráč na začátku klid.
    if (q.human && s.difficulty === 'easy' && s.turn < 45 && !qWonder) want = false
    // Dobré vztahy válku oddalují.
    if (want && q.human && p.attitude[q.id] >= 15 && !qWonder && rand(s) < 0.6) want = false
    // Kdo drží většinu sídel a blíží se vítězství dobytím, proti tomu se zvedne každý, kdo může.
    const urgent = (qWonder && want) || (s.conquest?.by === q.id && myMil >= 2)
    if (urgent) { log(s, p.id, 'válka', `národu ${nat(s, q.id)}: ${qWonder ? 'dostavuje Sluneční chrám' : 'drží většinu sídel'}`); declareWar(s, p.id, q.id); continue }
    // Válku nevyhlašuje hned: nejdřív si u hranic nachystá vojsko a stroje (aiMilitary), vyhlásí ji až s připraveným tažením.
    if (want && !p.siege) {
      let best: City | null = null, bd = Infinity
      for (const c of s.cities) if (c.owner === q.id) for (const a of myCities) { const d = hexDist(a.x, a.y, c.x, c.y) + cityTotal(c) / 80 - (c.seat >= 0 ? TUNE.seatFocus : 0); if (d < bd) { bd = d; best = c } }
      if (best) { p.siege = { city: best.id, go: false, since: s.turn, pre: true }; log(s, p.id, 'tažení', `plán na město ${best.name} (${nat(s, q.id)}), ${Math.round(bd)} polí od vlastního města; síla ${Math.round(mine)} proti ${Math.round(theirs)}, jednotek ${myMil}`) }
      else { log(s, p.id, 'válka', `národu ${nat(s, q.id)} bez cíle tažení`); declareWar(s, p.id, q.id) }
    }
  }
  // Žádost o pomoc: soupeř ve válce s jiným národem zve hráče do spojenectví.
  for (const me of s.players) {
    if (!me.human || !me.alive || !p.met.includes(me.id) || atWar(s, p.id, me.id) || p.attitude[me.id] < 0 || s.turn % 9 !== p.id % 9 || s.offers.some(o => o.from === p.id && o.to === me.id)) continue
    const foe = majors(s, p).find(q => q.id !== me.id && atWar(s, p.id, q.id) && me.met.includes(q.id) && !atWar(s, me.id, q.id))
    if (foe && warDuration(s, p) >= 3) s.offers.push({ from: p.id, to: me.id, kind: 'ally', vs: foe.id })
  }
}

// ---------------------------------------------------------------- města

export function siteScore(s: GameState, pid: number, x: number, y: number): number {
  const t = s.tiles[idx(s, x, y)]
  if (!TERRAIN[t.t].passable || t.special) return -1
  if (t.owner !== -1 && t.owner !== pid) return -1
  for (const c of s.cities) if (hexDist(c.x, c.y, x, y) < CITY_GAP) return -1
  const p = s.players[pid]
  let v = 0
  const own = citiesOf(s, pid)
  for (const [tx, ty] of tilesWithin(s, x, y, BORDER_MAX)) {
    const i = idx(s, tx, ty)
    const tt = s.tiles[i]
    // Třetí okruh přijde až za dlouho, proto váží méně.
    const far = hexDist(x, y, tx, ty) > 2 ? 0.35 : 1
    if (tt.owner !== -1 && tt.owner !== pid) { v -= 0.5 * far; continue }
    // Hráč nezná, co je v neprozkoumané mlze: počítá se průměrné pole, ať rada nic neprozradí.
    if (p.human && !p.explored[i]) { v += 2.5 * far; continue }
    const yl = tileYield(s, i, pid)
    let tv = yl.food * 1.4 + yl.prod + yl.gold * 0.6
    if (tt.res && resourceVisible(p, tt.res)) {
      // Koně a železo živí vojsko; nejcennější jsou, když národu úplně chybějí a jeho jednotky je potřebují.
      const strat = RESOURCES[tt.res].strategic
      tv += strat ? (unitsNeeding(s, pid, tt.res).length ? (resourceCap(s, pid, tt.res) === 0 ? 7 : 4) : 2) : 1.5
    }
    // Pole, která už patří jinému vlastnímu městu nebo na která si dělá nárok (do tří polí od něj), nové město skoro nevyužije.
    const taken = (tt.owner === pid && tt.city !== -1) || own.some(c => hexDist(c.x, c.y, tx, ty) <= (hexDist(c.x, c.y, tx, ty) <= 2 ? 2 : BORDER_MAX) && hexDist(c.x, c.y, tx, ty) <= hexDist(x, y, tx, ty))
    v += (taken ? tv * 0.3 : tv) * far
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
  const afloat = isWater(s.tiles[idx(s, u.x, u.y)])
  // Dělníci počítače smějí na vodu jen kvůli lovišti; na souši se zase vylodí.
  if (!p.human && u.sea && !afloat) u.sea = false
  const pm = pathMap(s, u)
  // Každý druhý dělník dává přednost cestám mezi městy.
  if (!afloat && u.id % 2 === 0 && aiRoad(s, p, u, pm, claimed)) return
  let best = -1, bv = -Infinity, bestJob: JobId | null = null
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i]
    if (t.owner !== p.id || t.special || claimed.has(i)) continue
    const x = i % s.W, y = (i / s.W) | 0
    // Na loviště se počítač nalodí z břehu hned vedle; hráčovi dělníci tam umějí doplout sami.
    let dist = pm.dist[i]
    if (dist === Infinity && isWater(t) && !p.human && hasTech(p, 'sailing')) for (const [nx, ny] of neighbors(s, x, y)) dist = Math.min(dist, pm.dist[idx(s, nx, ny)] + 2)
    if (dist === Infinity) continue
    // Co se na poli hodí, určuje stejné pravidlo jako rada pro hráče: surovina, oprava, farma či ves podle potřeb města.
    const job = recommendJob(s, i, p.id)
    if (!job) continue
    if (s.units.some(o => atWar(s, o.owner, p.id) && !isCivilian(o) && hexDist(o.x, o.y, x, y) <= (isWater(t) ? 4 : 2))) continue
    const worked = s.cities.some(c => c.owner === p.id && c.worked.includes(i))
    const v = (t.res ? 6 : 0) + (worked ? 4 : 0) + (job === 'repair' ? 5 : 0) - dist * 1.2
    if (v > bv) { bv = v; best = i; bestJob = job }
  }
  if (best < 0 || !bestJob) {
    // Na vodě není co dělat: zpátky na nejbližší břeh.
    if (afloat) { const c = nearestCity(s, p.id, u.x, u.y); if (c) moveUnit(s, u, c.x, c.y) } else aiRoad(s, p, u, pm, claimed)
    return
  }
  claimed.add(best)
  const x = best % s.W, y = (best / s.W) | 0
  if (!p.human && isWater(s.tiles[best])) u.sea = true
  if (u.x !== x || u.y !== y) moveUnit(s, u, x, y)
  if (u.x === x && u.y === y && u.moves > 0) startWork(s, u, bestJob)
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

/** Obléhací stroj, který výpravě chybí (počítá i ty, které už některé město staví), nebo null. */
function wantedEngine(s: GameState, p: Player, c: City): UnitId | null {
  if (!(p.war.some(w => w !== barbId(s)) || p.siege?.pre)) return null
  const mine = unitsOf(s, p.id).filter(u => !isCivilian(u) && !isNaval(u))
  const queued = citiesOf(s, p.id).filter(o => o.id !== c.id && o.build?.kind === 'unit').map(o => UNITS[(o.build as { id: UnitId }).id])
  const rams = mine.filter(u => UNITS[u.type].ram).length + queued.filter(d => d.ram).length
  const siege = mine.filter(u => UNITS[u.type].siege && !UNITS[u.type].ram).length + queued.filter(d => d.siege && !d.ram).length
  const melee = mine.filter(u => !UNITS[u.type].ranged && !UNITS[u.type].siege).length
  const can = (id: UnitId) => { const a = unitFor(p.nation, id); return canBuildUnit(s, c, a) ? a : null }
  if (melee >= 2 && siege < Math.max(4, Math.floor(melee * 0.7))) { const k = can('trebuchet') ?? can('catapult'); if (k) return k }
  // Beranidlo: jedno na výpravu, u větší armády dvě (hradby na ně střílejí).
  if (melee >= 3 && rams < (melee >= 7 ? 2 : 1)) return can('ram')
  return null
}

function bestMilitary(s: GameState, p: Player, c: City, defensive: boolean): UnitId | null {
  const mine = unitsOf(s, p.id).filter(u => !isCivilian(u) && !isNaval(u))
  const ranged = mine.filter(u => UNITS[u.type].ranged && !UNITS[u.type].siege).length
  const planning = p.war.some(w => w !== barbId(s)) || !!p.siege?.pre
  const can = (id: UnitId) => { const a = unitFor(p.nation, id); return canBuildUnit(s, c, a) ? a : null }
  const archer = can('archer')
  if (defensive && archer) return archer
  const engine = wantedEngine(s, p, c)
  if (engine) return engine
  // Na tažení je potřeba hlavně pěchota: obklíčí město a obsadí ho.
  if (archer && ranged < (mine.length + 1) * (planning ? 0.2 : 0.35)) return archer
  const opts = (['manatarms', 'knight', 'swordsman', 'horseman', 'spearman', 'warrior'] as UnitId[]).map(can).filter((x): x is UnitId => !!x)
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
  if (c.build && c.prod >= itemCost(c.build, p) * 0.2) return
  const cities = citiesOf(s, p.id)
  const units = unitsOf(s, p.id)
  const mil = headcount(units.filter(u => !isCivilian(u) && !isNaval(u) && u.type !== 'scout'))
  const navy = units.filter(isNaval).length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && !!UNITS[o.build.id].naval).length
  const settlers = units.filter(u => u.type === 'settler').length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && o.build.id === 'settler').length
  const workers = units.filter(u => u.type === 'worker').length + cities.filter(o => o.id !== c.id && o.build?.kind === 'unit' && o.build.id === 'worker').length
  const threat = threatNear(s, p.id, c.x, c.y, 4)
  const garrison = militaryAt(s, c.x, c.y)
  const war = p.war.length > 0 || !!p.siege?.pre
  const hard = DIFFICULTY[s.difficulty].aiExtra
  const setU = (id: UnitId | null) => { if (id) { c.build = { kind: 'unit', id }; return true } return false }
  const setB = (id: BuildingId) => { c.build = { kind: 'building', id } }
  c.build = null

  if ((threat > 0 && (!garrison || threat > 1)) || mil < cities.length) { if (setU(bestMilitary(s, p, c, !garrison))) return }
  if (cities.length === 1 && !units.some(u => u.type === 'scout') && s.turn < 12 && mil >= 1 && canBuildUnit(s, c, 'scout')) { setU('scout'); return }
  const k = per(p)
  const targetCities = k.cities + hard
  if (cities.length + settlers < targetCities && settlers === 0 && c.pop >= 2 && threatNear(s, p.id, c.x, c.y, 2) === 0 && s.turn < k.settleUntil) {
    // Stojí za to jen tehdy, když je kde stavět.
    let any = false
    for (const [x, y] of tilesWithin(s, c.x, c.y, 7)) if (siteScore(s, p.id, x, y) > 16) { any = true; break }
    if (any) { setU('settler'); return }
  }
  const anyImpTech = p.techs.some(t => ['agriculture', 'mining', 'husbandry', 'forestry'].includes(t))
  if (anyImpTech && workers < Math.min(cities.length, 3) + (cities.length >= 3 ? 1 : 0)) { setU('worker'); return }
  if (canBuildBuilding(s, c, 'wonder')) {
    const bestProd = cities.slice().sort((a, b) => cityYields(s, b).prod - cityYields(s, a).prod)[0]
    if (bestProd.id === c.id && (k.wonderInWar || !war)) { setB('wonder'); return }
  }
  // Loďstvo: pár lodí na obranu pobřeží, ve válce o jednu víc.
  const sea = seafarer(s, p)
  if (sea && isCoastal(s, c.x, c.y) && c.buildings.length >= 2 && canBuildBuilding(s, c, 'harbor')) { setB('harbor'); return }
  if (isCoastal(s, c.x, c.y) && mil >= cities.length + (sea ? 0 : 1) && s.turn > (sea ? 14 : 30)) {
    const want = Math.min(3, cities.filter(o => isCoastal(s, o.x, o.y)).length) + (war ? 1 : 0) - (!k.alwaysArm && !war && !sea ? 1 : 0) + (sea ? 1 : 0)
    const ship: UnitId | null = canBuildUnit(s, c, 'trireme') ? 'trireme' : canBuildUnit(s, c, 'galley') ? 'galley' : null
    if (ship && navy < want && playerIncome(s, p.id).gold > 0) { setU(ship); return }
  }
  // Kdo drží chrám, musí ho ubránit.
  const holds = s.mission.wonderBy === p.id
  if (holds && c.buildings.includes('wonder')) for (const b of ['walls', 'bastion'] as BuildingId[]) if (canBuildBuilding(s, c, b)) { setB(b); return }
  const armyTarget = cities.length * 1.6 + k.armyBase + s.turn / k.armyPace + (war ? 3 : 0) + (holds ? 4 : 0) + (p.siege ? 9 : 0) + (k.martial ? TUNE.armyPlus : 0)
  // Stroje na chystané tažení se staví, i když je vojska jinak dost.
  if (p.siege && setU(wantedEngine(s, p, c))) return
  if ((war || k.alwaysArm || holds) && mil < armyTarget) { if (setU(bestMilitary(s, p, c, false))) return }
  // Město pod stropem obyvatel potřebuje akvadukt či kanalizaci dřív než cokoli jiného.
  if (c.pop >= popCap(c) - 1) for (const b of ['aqueduct', 'sewer'] as BuildingId[]) if (canBuildBuilding(s, c, b)) { setB(b); return }
  for (const b of k.build) {
    if (!canBuildBuilding(s, c, b)) continue
    if ((b === 'walls' || b === 'bastion') && !war && threat === 0 && !k.wallsAlways) continue
    if (BUILDINGS[b].maint > 0 && playerIncome(s, p.id).gold < 0 && p.gold < 30) continue
    setB(b); return
  }
  if (mil < armyTarget * 1.3 && playerIncome(s, p.id).gold > 1) { if (setU(bestMilitary(s, p, c, false))) return }
  c.build = null
}

function aiSpend(s: GameState, p: Player): void {
  // Válečné povahy drží menší rezervu a zlato dávají hlavně do vojska.
  const martial = per(p).martial
  const reserve = martial ? Math.min(per(p).reserve, 30) : per(p).reserve
  if (p.gold < reserve) return
  // Zastaralé jednotky přezbrojit, když je to levné.
  for (const u of unitsOf(s, p.id)) {
    if (upgradeBlock(s, u) || p.gold - upgradeCost(s, u) < 40) continue
    upgradeUnit(s, u)
    break
  }
  if (p.gold < reserve) return
  const cities = citiesOf(s, p.id).filter(c => c.build && !(c.build.kind === 'building' && c.build.id === 'wonder'))
  const arms = (c: City) => Number(martial && c.build?.kind === 'unit' && !UNITS[c.build.id].civilian)
  cities.sort((a, b) => threatNear(s, p.id, b.x, b.y, 3) - threatNear(s, p.id, a.x, a.y, 3) || arms(b) - arms(a) || buyCost(s, b) - buyCost(s, a))
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
    let v = pv.dmgDef + (pv.dmgWall ?? 0) - pv.dmgAtt * 0.9 + bold
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
  const bx = best % s.W, by = (best / s.W) | 0
  if (moveUnit(s, u, bx, by)) return true
  if (u.moves <= 0 || !s.units.includes(u)) return false
  // Cestu ucpaly vlastní jednotky (kolona na úzké stezce): obejít je po nejbližším volném poli směrem k cíli.
  let side = -1, sh = hexDist(u.x, u.y, bx, by), sd = Infinity
  for (const [x, y] of tilesWithin(s, u.x, u.y, 2)) {
    const i = idx(s, x, y)
    if (!pm.stop[i] || pm.dist[i] > Math.max(u.moves, 2) || (!isNaval(u) && !u.sea && isWater(s.tiles[i]))) continue
    const h = hexDist(x, y, bx, by)
    if (h < sh || (h === sh && h < hexDist(u.x, u.y, bx, by) && pm.dist[i] < sd)) { sh = h; sd = pm.dist[i]; side = i }
  }
  return side >= 0 && moveUnit(s, u, side % s.W, (side / s.W) | 0)
}

/**
 * Kolik životů města dokáže skupina ubrat: stroje a střelci za `rounds` kol palby, pěchota za dvě kola zteče
 * (druhé už oslabená). Podle toho se rozhoduje, zda má smysl vyrazit a kdy jít na hradby.
 */
/** Cíl bližší než tolik polí od vlastního města: válka se vyhlásí už při odchodu. */
const MARCH_WAR = 7
/** Do kterého tahu vyráží výprava už v menší síle. */
const EARLY_WAR = 80
/** Jak daleko od cílového města se výprava seřadí, než udeří. */
const RALLY = 5

const nat = (s: GameState, pid: number): string => (pid === barbId(s) ? 'Barbaři' : `${NATIONS[s.players[pid].nation].name}#${pid}`)
const cityName = (s: GameState, id: number): string => s.cities.find(c => c.id === id)?.name ?? '?'

function punch(s: GameState, units: Unit[], c: City, rounds: number): number {
  const cs = cityStrength(s, c)
  const ram = units.some(u => UNITS[u.type].ram)
  // Vrací body, které vojsko městu ubere z hradeb i obránců dohromady; hradby berou od pěchoty a střelců jen díl rány.
  let v = 0, melee = 0, wall = cityWalls(c)
  const blow = (raw: number, f: number) => {
    if (wall <= 0) { v += raw; return }
    const wd = raw * f
    if (wd <= wall) { wall -= wd; v += wd } else { v += wall + raw * (wd - wall) / wd; wall = 0 }
  }
  // Stroje pálí napřed: hradby boří nejlíp.
  for (const u of units.slice().sort((a, b) => Number(!!UNITS[b.type].siege) - Number(!!UNITS[a.type].siege))) {
    if (UNITS[u.type].ram) continue
    const ranged = !!UNITS[u.type].ranged
    const hit = Math.max(4, Math.min(100, 28 * Math.pow(unitStrength(s, u, { ranged, vsCity: true, ram }) / cs, 1.15)))
    blow(ranged ? hit * rounds : hit * 1.6, wallFactor(ranged, !!UNITS[u.type].siege, ram))
    if (!ranged) melee++
  }
  // Město se mezitím opravuje – dokud ho pěchota neobklíčí.
  return v - (melee >= SIEGE_UNITS ? 10 * Math.max(0, rounds - 2) : 10 * rounds)
}

/** Staví se ve městě Sluneční chrám, nebo už v něm stojí? */
function isWonderSite(c: City): boolean {
  return c.buildings.includes('wonder') || (c.build?.kind === 'building' && c.build.id === 'wonder')
}

/** Umí národ postavit obléhací stroj? */
function canSiege(s: GameState, p: Player, cities: City[]): boolean {
  return cities.length > 0 && (['trebuchet', 'catapult', 'ram'] as UnitId[]).some(id => canBuildUnit(s, cities[0], unitFor(p.nation, id)))
}

/** Vede národ právě slibné obléhání města národa `q`? Pak se mír neuzavírá. */
function pressing(s: GameState, p: Player, q: Player): boolean {
  const plan = p.siege
  if (!plan?.go) return false
  const c = s.cities.find(o => o.id === plan.city)
  if (!c || c.owner !== q.id) return false
  const near = unitsOf(s, p.id).filter(u => !isCivilian(u) && u.hp >= 50 && hexDist(u.x, u.y, c.x, c.y) <= 4).length
  return near >= 3 || (near >= 2 && cityTotal(c) < cityFull(c) * 0.6) || s.turn - plan.since < 12
}

/** Před tažením a během něj se zdravé stejné jednotky spojují: kolem města je jen šest polí a víc síly se tam jinak nedostane. */
function aiMerge(s: GameState, p: Player): void {
  if (!p.siege || !hasTech(p, 'tactics')) return
  const pool = unitsOf(s, p.id).filter(u => !isCivilian(u) && !isNaval(u) && u.hp >= 70)
  let n = pool.length
  for (const u of pool) {
    if (n <= 6) return
    // Posádka města zůstává na místě, připojit se k ní může soused.
    if (!s.units.includes(u) || cityAt(s, u.x, u.y)) continue
    const to = mergeTargets(s, u).filter(o => o.hp >= 70).sort((a, b) => unitSize(b) - unitSize(a))[0]
    if (to && mergeUnits(s, u, to)) n--
  }
}

function nearestCity(s: GameState, pid: number, x: number, y: number): City | null {
  let best: City | null = null, bd = Infinity
  for (const c of s.cities) if (c.owner === pid) { const d = hexDist(c.x, c.y, x, y); if (d < bd) { bd = d; best = c } }
  return best
}

function aiMilitary(s: GameState, p: Player): void {
  const pid = p.id
  const cities = citiesOf(s, pid)
  aiMerge(s, p)
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

  // Válečný cíl: nejbližší nepřátelské město. Jednou zvoleného cíle se vojsko drží, dokud město nepadne nebo nenastane mír.
  const temple = s.cities.find(c => c.buildings.includes('wonder') && p.war.includes(c.owner)) ?? null
  const kept = p.siege ? s.cities.find(c => c.id === p.siege!.city && p.war.includes(c.owner)) ?? null : null
  const busy = !!kept && !!p.siege?.go && (cityTotal(kept) < cityFull(kept) * 0.6 || army.filter(u => hexDist(u.x, u.y, kept.x, kept.y) <= 4).length >= 3)
  let target: City | null = busy ? kept : temple ?? kept
  // Chystané tažení před vyhlášením války; skutečná válka s někým jiným má přednost.
  let pre = false
  if (!target && p.siege?.pre) {
    const c = s.cities.find(o => o.id === p.siege!.city)
    const o = c ? s.players[c.owner] : null
    const ok = !!c && !!o && o.id !== pid && o.id !== barbId(s) && o.alive && !p.war.some(w => w !== barbId(s))
      && s.turn >= (p.peaceUntil[o.id] ?? 0) && !(o.human && s.turn < (p.pactUntil[o.id] ?? 0)) && (s.turn - p.siege.since <= (p.siege.go ? 45 : 36) || isWonderSite(c!))
    if (ok) { target = c!; pre = true } else {
      log(s, pid, 'tažení', `plán na město ${c?.name ?? '?'} zrušen před válkou: ${!c || !o || !o.alive ? 'cíl zanikl' : p.war.some(w => w !== barbId(s)) ? 'mezitím jiná válka' : s.turn - p.siege.since > (p.siege.go ? 45 : 24) ? `nestihlo se to za ${s.turn - p.siege.since} tahů (${p.siege.go ? 'na pochodu' : 'při shromažďování'})` : 'mír nebo smlouva s majitelem'}`)
      p.siege = null
    }
  }
  const home = cities.find(c => c.capital) ?? cities[0]
  if (!target && p.war.length && home) {
    let bd = Infinity
    for (const c of s.cities) {
      // Kde leží města národa, se kterým se zná, ví každý (poslové, kupci) – bez toho by vojsko nemělo kam táhnout.
      if (!p.war.includes(c.owner) || c.owner === barbId(s) && !p.explored[idx(s, c.x, c.y)]) continue
      // Město se Slunečním chrámem má přednost před vším ostatním.
      const d = hexDist(home.x, home.y, c.x, c.y) + cityTotal(c) / 80 - (c.buildings.includes('wonder') ? 100 : 0) - (c.seat >= 0 ? TUNE.seatFocus : 0)
      if (d < bd) { bd = d; target = c }
    }
  }
  // Tažení: vojsko se nejdřív shromáždí u vlastního města nejblíž cíli, počká na obléhací stroje a teprve pak vyrazí pohromadě.
  const fit = field.filter(u => u.hp >= 60)
  let march = false
  let stage: City | null = null
  let storm = false, engines = false, rally = false
  const dT = (u: Unit) => hexDist(u.x, u.y, target!.x, target!.y)
  if (!target) { if (p.siege) log(s, pid, 'tažení', `konec: ${cityName(s, p.siege.city)} už není cílem (${p.siege.go ? 'výprava byla na cestě' : 'chystalo se'})`); p.siege = null }
  else {
    if (p.siege?.city !== target.id) { p.siege = { city: target.id, go: false, since: s.turn }; log(s, pid, 'tažení', `cíl ve válce: ${target.name} (${nat(s, target.owner)}), obrana ${cityTotal(target)} / ${cityFull(target)}`) }
    if (!pre) p.siege.pre = false
    const plan = p.siege
    stage = cities.slice().sort((a, b) => hexDist(a.x, a.y, target!.x, target!.y) - hexDist(b.x, b.y, target!.x, target!.y) || a.id - b.id)[0] ?? null
    const k = per(p)
    const rush = target.buildings.includes('wonder') || (isWonderSite(target) && target.prod > BUILDINGS.wonder.cost * 0.5)
    const need = rush ? 2 : k.marchAt
    const full = cityFull(target)
    if (!plan.go) {
      // Vyráží se, až má shromážděné vojsko na město sílu: stroje mu dají čtyři kola palby, pěchota pak zteč.
      const ready = fit.filter(u => !stage || hexDist(u.x, u.y, stage.x, stage.y) <= 3 || dT(u) <= 6)
      const melee = headcount(ready.filter(u => !UNITS[u.type].ranged && !UNITS[u.type].ram))
      const power = punch(s, ready, target, 4)
      const waited = s.turn - plan.since
      // Kdo umí stavět stroje, nevyráží bez beranidla (pěchotě přidá sílu) nebo tří střílejících strojů, leda by se čekání protáhlo.
      const eng = ready.filter(u => UNITS[u.type].siege && !UNITS[u.type].ram).length
      // Před válkou se čeká v klidu na plnou sílu; už ve válce se po čase vyráží i s menší.
      const late = !pre && waited > 10
      const engOk = !canSiege(s, p, cities) || ready.some(u => UNITS[u.type].ram) || eng >= (late ? 1 : 3)
      // Rané výpravy jsou menší: mladé město má slabou obranu a čekat na velké vojsko by trvalo do půlky hry.
      const early = s.turn < EARLY_WAR
      const enough = melee >= (late ? 2 : early ? 4 : 6) && engOk && power >= full * (late ? 0.8 : early ? 1.3 : 1.7) * TUNE.muster
      if (headcount(ready) >= need && (enough || rush)) {
        // Na vzdálený cíl se vyráží ještě v míru; válka se vyhlásí, až bude výprava na dosah (viz níže).
        log(s, pid, 'tažení', `výprava vyráží na ${target.name}: jednotek ${headcount(ready)} (pěchota ${melee}, strojů ${eng}), odhad škody ${Math.round(power)} proti obraně ${full}, čekalo se ${waited} tahů${pre ? ', zatím v míru' : ''}${rush ? ', spěch kvůli chrámu' : ''}`)
        if (pre && (rush || !stage || hexDist(stage.x, stage.y, target.x, target.y) <= MARCH_WAR)) { log(s, pid, 'válka', `národu ${nat(s, target.owner)}: cíl ${target.name} je blízko, vyhlašuje se při odchodu`); declareWar(s, pid, target.owner); plan.pre = false }
        plan.go = true; plan.since = s.turn
      }
    } else if (fit.length < 2 || (!rush && s.turn - plan.since > 6 && punch(s, fit, target, 4) < cityTotal(target) * 0.6)) {
      log(s, pid, 'tažení', `ústup od ${target.name}: ${fit.length < 2 ? `zbývá jen ${fit.length} zdravých jednotek` : `odhad škody ${Math.round(punch(s, fit, target, 4))} nestačí na obranu ${cityTotal(target)}`}; výprava trvala ${s.turn - plan.since} tahů, nejbližší jednotka ${Math.min(99, ...fit.map(dT))} polí od města`)
      plan.go = false; plan.since = s.turn
    }
    march = plan.go
    // Zteč: jakmile vojsko u města dokáže hradby srazit do dvou kol, jde pěchota na věc.
    const at = fit.filter(u => dT(u) <= 4)
    storm = at.some(u => !UNITS[u.type].ranged && !UNITS[u.type].ram) && punch(s, at, target, 2) >= cityTotal(target)
    engines = at.some(u => UNITS[u.type].siege)
    // Výprava = kdo už od shromaždiště vyrazil; posily a uzdravení, kteří teprve vycházejí z domova, ji nezdržují.
    const out = stage ? hexDist(stage.x, stage.y, target.x, target.y) : Infinity
    const gone = fit.filter(u => dT(u) < out - 1)
    const exp = gone.length >= 4 ? gone : fit.filter(u => dT(u) <= out + 3)
    // Seřadiště před městem: výprava se nejdřív srazí pár polí od cíle a udeří až pohromadě. Do té doby trvá mír, pokud v něm vyrazila.
    if (plan.go && !plan.hit) {
      const here = headcount(exp.filter(u => dT(u) <= RALLY + 2))
      if (here >= 3) plan.at ??= s.turn
      if (rush || here >= Math.max(4, Math.ceil(headcount(exp) * 0.6)) || (plan.at !== undefined && s.turn - plan.at >= 6 && here >= 3)) {
        log(s, pid, 'tažení', `úder na ${target.name}: na seřadišti ${here} z ${headcount(exp)} jednotek výpravy, pochod trval ${s.turn - plan.since} tahů, obrana města ${cityTotal(target)} / ${cityFull(target)}`)
        plan.hit = true; plan.at = s.turn; plan.since = s.turn
        if (plan.pre) { log(s, pid, 'válka', `národu ${nat(s, target.owner)}: výprava stojí před městem ${target.name}`); declareWar(s, pid, target.owner); plan.pre = false }
      }
    }
    if (!plan.go) { delete plan.hit; delete plan.at }
    rally = plan.go && !plan.hit
    // Pěchota nečeká u hradeb donekonečna: když stroje nejsou na cestě, nebo se čeká už čtvrtý tah, jde na zteč i bez nich.
    const foot = headcount(at.filter(u => !UNITS[u.type].ranged && !UNITS[u.type].ram))
    const coming = fit.some(u => UNITS[u.type].siege && !UNITS[u.type].ram && dT(u) > UNITS[u.type].range! && dT(u) <= 8)
    if (!storm && plan.hit && foot >= 3 && (!coming || s.turn - (plan.at ?? s.turn) >= 3)) storm = true
  }

  // Na pochodu táhne napřed čelo, ať zadní řady nenarážejí do stojících.
  if (target && march) field.sort((a, b) => dT(a) - dT(b) || a.id - b.id)
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
      if (isCivilian(o) && o.owner === barbId(s)) continue
      if (!atWar(s, pid, o.owner) || !p.visible[idx(s, o.x, o.y)]) continue
      const d = hexDist(u.x, u.y, o.x, o.y)
      const own = near ? hexDist(near.x, near.y, o.x, o.y) : 99
      // Pěchota na loď nedosáhne.
      if (!ud.ranged && isWater(s.tiles[idx(s, o.x, o.y)])) continue
      if (d <= 5 && own <= 6 && d < fd) { fd = d; foe = o }
    }
    // Výprava se nenechá odlákat: domov brání posádky a jednotky, které ještě nevyrazily.
    const away = march && !!target && !!stage && dT(u) < hexDist(stage.x, stage.y, target.x, target.y) - 1
    if (foe && u.hp >= 50 && !(away && fd > 2)) {
      approach(s, u, foe.x, foe.y, ud.ranged ? ud.range! : 1)
      if (s.units.includes(u)) tryAttack(s, u)
      continue
    }
    const onWater = isWater(s.tiles[idx(s, u.x, u.y)])
    if (u.sea && !march && !onWater) u.sea = false
    if (march && target) {
      // Výsadek: když je cesta po moři výrazně kratší (nebo jediná), jednotka se nalodí.
      if (!u.sea && hasTech(p, 'sailing') && isCoastal(s, target.x, target.y)) {
        const goal = (m: PathMap) => Math.min(...tilesWithin(s, target!.x, target!.y, 1).map(([x, y]) => (isWater(s.tiles[idx(s, x, y)]) ? Infinity : m.dist[idx(s, x, y)])))
        const land = goal(pathMap(s, u))
        u.sea = true
        const sea = goal(pathMap(s, u))
        if (!(sea < Infinity && (land === Infinity || sea < land * 0.7))) u.sea = false
      }
      const d = dT(u)
      // Na seřadiště: dojít pár polí před město a počkat na ostatní.
      if (rally) {
        if (d > RALLY) approach(s, u, target.x, target.y, RALLY)
        else if (u.moves >= ud.move) u.fortified = true
        if (s.units.includes(u)) tryAttack(s, u, 6)
        continue
      }
      // Stroje a střelci pálí hned. Pěchota čeká mimo dostřel hradeb, dokud není město zralé na zteč.
      if (ud.ranged) {
        // Stroje nejdou napřed bez krytí: drží se za pěchotou.
        const covered = !ud.siege || d <= ud.range! || fit.some(o => !UNITS[o.type].ranged && dT(o) <= d + 1)
        if (covered) approach(s, u, target.x, target.y, ud.range!)
        else if (u.moves >= ud.move) u.fortified = true
        if (s.units.includes(u)) tryAttack(s, u, 6)
        continue
      }
      if (storm) { approach(s, u, target.x, target.y, 1); if (s.units.includes(u)) tryAttack(s, u, 55); continue }
      approach(s, u, target.x, target.y, 3)
      if (s.units.includes(u)) tryAttack(s, u, engines ? 0 : 6)
      continue
    }
    // Shromaždiště před tažením.
    if (target && stage && !march && u.hp >= 60) {
      if (hexDist(u.x, u.y, stage.x, stage.y) > 2) approach(s, u, stage.x, stage.y, 2)
      else if (u.moves >= ud.move) u.fortified = true
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
export function autoUnits(s: GameState, pid = 0): void {
  const p = s.players[pid]
  const claimed = new Set<number>()
  for (const u of unitsOf(s, pid)) {
    if (!u.auto || !s.units.includes(u)) continue
    if (u.type === 'worker') {
      // Rozdělaná práce jiných dělníků se nedubluje.
      for (const o of unitsOf(s, pid)) if (o !== u && o.type === 'worker' && o.work) claimed.add(idx(s, o.x, o.y))
      aiWorker(s, p, u, claimed)
    } else if (!explore(s, p, u)) {
      u.auto = false; u.fortified = false
      note(s, pid, `${UNITS[u.type].name}: není už co zkoumat, automatický průzkum končí.`, 'info', u.x, u.y)
    }
  }
  followAll(s, pid)
}

/**
 * Pošle jednotku k nejbližší hranici poznaného světa; false = není kam.
 * Pěší průzkumník zkoumá nejdřív pevninu, na kterou dojde (i přes vodu, zná-li cestu). Když na souši nic nezbývá
 * a národ umí plout, nalodí se a zkoumá po moři, dokud nenarazí na další břeh.
 */
function explore(s: GameState, p: Player, u: Unit): boolean {
  if (u.hp < 50) return true
  stopUnit(u)
  const naval = isNaval(u)
  const pick = (water: boolean): number => {
    const pm = pathMap(s, u)
    let best = -1, bv = Infinity
    for (let i = 0; i < s.tiles.length; i++) {
      if (pm.dist[i] === Infinity || !pm.stop[i] || p.explored[i] === 0) continue
      const x = i % s.W, y = (i / s.W) | 0
      // Hranice poznaného světa: sousedí s neprozkoumaným polem.
      if (!neighbors(s, x, y).some(n => !p.explored[idx(s, n[0], n[1])])) continue
      if (threatNear(s, p.id, x, y, 2) > 0) continue
      if (!naval && !water && isWater(s.tiles[i])) continue
      const v = pm.dist[i] + ((i * 7 + u.id) % 5) * 0.3
      if (v < bv) { bv = v; best = i }
    }
    return best
  }
  let best = pick(naval)
  if (best < 0 && !naval && hasTech(p, 'sailing')) {
    // Na souši není co zkoumat: po moři dál. Jednotky počítače se jinak samy nenaloďují.
    if (!p.human) u.sea = true
    best = pick(true)
    if (best < 0 && !p.human && !isWater(s.tiles[idx(s, u.x, u.y)])) u.sea = false
  }
  if (best >= 0) { moveUnit(s, u, best % s.W, (best / s.W) | 0); u.goto = null; return true }
  u.fortified = true
  return false
}

// ---------------------------------------------------------------- barbaři

export function barbTurn(s: GameState): void {
  const diff = DIFFICULTY[s.difficulty]
  updateVisibility(s, barbId(s))
  // Posily z táborů.
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i].special !== 'camp') continue
    const x = i % s.W, y = (i / s.W) | 0
    const mine = s.units.filter(u => u.owner === barbId(s) && u.home === i)
    const guard = militaryAt(s, x, y)
    const cap = 2 + (s.turn > 50 ? 1 : 0)
    const due = (s.turn + i) % diff.barbEvery === 0
    if ((!guard && mine.length === 0 && s.turn % 3 === 0) || (due && s.turn > 6 && mine.length < cap)) {
      let spot: [number, number] | null = guard ? null : [x, y]
      if (!spot) for (const n of neighbors(s, x, y)) { if (TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length && !cityAt(s, n[0], n[1])) { spot = n; break } }
      if (spot) {
        const pool: UnitId[] = s.turn < 28 ? ['warrior', 'warrior', 'archer'] : s.turn < 65 ? ['warrior', 'spearman', 'archer', 'spearman'] : ['spearman', 'swordsman', 'archer', 'horseman']
        const u = makeUnit(s, barbId(s), pool[randInt(s, pool.length)], spot[0], spot[1])
        u.home = i
        emit({ e: 'spawn', unit: u.id, x: u.x, y: u.y })
      }
    }
  }
  const raidEvery = s.difficulty === 'easy' ? 22 : s.difficulty === 'normal' ? 15 : 11
  if (s.turn >= 30 && s.turn % raidEvery === 0) seaRaid(s)
  const reach = s.difficulty === 'easy' ? 4 : s.difficulty === 'normal' ? 6 : 7
  for (const u of unitsOf(s, barbId(s))) {
    if (!s.units.includes(u)) continue
    const water = isWater(s.tiles[idx(s, u.x, u.y)])
    if (u.sea && !water) u.sea = false
    if (water) {
      // Piráti: loď napadá plavidla a blokuje přístav, nájezdníci plují k nejbližšímu městu.
      const naval = isNaval(u)
      if (tryAttack(s, u, 3)) continue
      let prey: Unit | null = null, pd = Infinity
      if (naval) for (const o of s.units) {
        if (o.owner === barbId(s) || !isWater(s.tiles[idx(s, o.x, o.y)])) continue
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
    // Nájezdníci plení pole, na která vkročí.
    if (!pillageBlock(s, u) && rand(s) < 0.6) { pillage(s, u); continue }
    // Tábor bez stráže: nejbližší se vrátí hlídat.
    if (u.home >= 0 && !militaryAt(s, hx, hy)) { moveUnit(s, u, hx, hy); continue }
    if (u.hp < 35) { if (u.home >= 0) approach(s, u, hx, hy, 1); continue }
    // Cíl: nejbližší cizí jednotka nebo město v dosahu.
    let tx = -1, ty = -1, td = Infinity
    if (s.turn > 6) {
      for (const o of s.units) {
        if (o.owner === barbId(s)) continue
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
  if (unitsOf(s, barbId(s)).filter(isNaval).length >= 3) return
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
  const ship = makeUnit(s, barbId(s), 'galley', first[0], first[1])
  emit({ e: 'spawn', unit: ship.id, x: ship.x, y: ship.y })
  const crew: UnitId[] = s.turn < 55 ? ['warrior'] : s.turn < 85 ? ['spearman', 'warrior'] : ['swordsman', 'spearman']
  crew.slice(0, near.length).forEach((type, k) => {
    const u = makeUnit(s, barbId(s), type, near[k][0], near[k][1])
    u.sea = true
    emit({ e: 'spawn', unit: u.id, x: u.x, y: u.y })
  })
  note(s, c.owner, `Piráti! U města ${c.name} se objevily nepřátelské lodě s nájezdníky.`, 'bad', first[0], first[1])
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
  let order = p.war.length ? PERSONAS.aggressive.research : PERSONAS.builder.research
  if (seafarer(s, p)) order = ['sailing', 'fishing', ...(p.techs.length >= 5 ? ['navigation' as TechId] : []), ...order]
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
  return `${n.leader}, ${n.title.toLowerCase()} – ${per(p).label}`
}

void TECHS; void note
