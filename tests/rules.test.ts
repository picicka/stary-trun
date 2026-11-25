import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hexDist, hexCenter, pixelToHex, neighborXY } from '../src/game/hex.ts'
import { createGame, endTurn, serialize, deserialize } from '../src/game/state.ts'
import { aiTurn } from '../src/game/ai.ts'
import {
  attack, canFoundCity, citiesOf, cityYields, declareWar, drainEvents, foundCity, idx, makeUnit, moveUnit, previewAttack, reachable, score, unitsOf,
} from '../src/game/rules.ts'
import { TERRAIN, UNITS } from '../src/game/data.ts'

test('hex: sousedé jsou ve vzdálenosti 1 a pixelToHex je inverzní k hexCenter', () => {
  for (const [x, y] of [[5, 4], [6, 7], [0, 1], [12, 13]]) {
    for (let d = 0; d < 6; d++) { const [nx, ny] = neighborXY(x, y, d); assert.equal(hexDist(x, y, nx, ny), 1) }
    const [cx, cy] = hexCenter(x, y)
    assert.deepEqual(pixelToHex(cx, cy), [x, y])
    assert.deepEqual(pixelToHex(cx + 9, cy - 6), [x, y])
  }
  assert.equal(hexDist(0, 0, 3, 0), 3)
  assert.equal(hexDist(2, 2, 4, 6), 4)
})

test('mise: mapa je vždy stejná a starty jsou na úrodné pevnině', () => {
  const a = createGame('aur', 'normal'), b = createGame('khar', 'hard')
  assert.deepEqual(a.tiles.map(t => t.t), b.tiles.map(t => t.t))
  for (const p of [0, 1, 2]) {
    const s = unitsOf(a, p).find(u => u.type === 'settler')!
    assert.ok(TERRAIN[a.tiles[idx(a, s.x, s.y)].t].passable)
    assert.equal(canFoundCity(a, s), null)
  }
  assert.ok(a.tiles.filter(t => t.special === 'camp').length >= 5)
  assert.equal(a.tiles.filter(t => t.special === 'ruins').length, 1)
})

test('město: založení, území, výnosy a růst', () => {
  const s = createGame('aur', 'normal')
  const settler = unitsOf(s, 0).find(u => u.type === 'settler')!
  const c = foundCity(s, settler)!
  assert.ok(c.capital)
  assert.equal(s.tiles.filter(t => t.owner === 0).length, 7)
  const y = cityYields(s, c)
  assert.ok(y.food >= 3 && y.prod >= 1)
  c.build = { kind: 'unit', id: 'warrior' }
  s.players[0].research = 'mining'
  const pop = c.pop
  for (let i = 0; i < 12; i++) endTurn(s)
  assert.ok(c.pop > pop, 'město vyrostlo')
  assert.ok(unitsOf(s, 0).filter(u => u.type === 'warrior').length >= 2, 'postaven válečník')
  assert.ok(s.players[0].techs.includes('mining'))
})

test('pohyb: dosah respektuje terén a jednotka dojde na cíl', () => {
  const s = createGame('thal', 'normal')
  const scout = unitsOf(s, 0).find(u => u.type === 'scout')!
  const r = reachable(s, scout)
  assert.ok(r.length > 6)
  const t = r[0]
  moveUnit(s, scout, t % s.W, Math.floor(t / s.W))
  assert.equal(idx(s, scout.x, scout.y), t)
  assert.ok(scout.moves < 3)
})

test('boj: útok bez války nejde, po vyhlášení ubírá životy', () => {
  const s = createGame('khar', 'normal')
  const w = unitsOf(s, 0).find(u => u.type === 'warrior')!
  const spot = [0, 1, 2, 3, 4, 5].map(d => neighborXY(w.x, w.y, d)).find(([x, y]) => TERRAIN[s.tiles[idx(s, x, y)].t].passable && !s.units.some(u => u.x === x && u.y === y))!
  const foe = makeUnit(s, 1, 'warrior', spot[0], spot[1])
  const pv = previewAttack(s, w, foe.x, foe.y)!
  assert.equal(pv.needWar, 1)
  assert.equal(attack(s, w, foe.x, foe.y), false)
  declareWar(s, 0, 1)
  assert.equal(attack(s, w, foe.x, foe.y), true)
  assert.ok(foe.hp < 100 && w.hp < 100)
  assert.equal(w.attacked, true)
  drainEvents()
})

test('celá partie s AI doběhne do konce a uložení jde načíst', () => {
  let s = createGame('sylv', 'normal')
  s.players[0].personality = 'builder'
  let navySeen = false
  while (!s.over && s.turn <= s.maxTurns + 1) {
    aiTurn(s, 0); endTurn(s); drainEvents()
    if (s.turn === 50) { const r = deserialize(serialize(s)); assert.ok(r); s = r!; s.players[0].personality = 'builder' }
    for (const u of s.units) assert.ok(canEnterTile(s, u, s.tiles[idx(s, u.x, u.y)]), 'jednotka stojí na poli, kam smí')
    navySeen ||= s.units.some(u => UNITS[u.type].naval)
  }
  assert.ok(s.over, 'hra skončila')
  console.log('navy built in sim:', navySeen)
  assert.ok(citiesOf(s, 0).length + citiesOf(s, 1).length + citiesOf(s, 2).length >= 6)
  assert.ok(score(s, 0) > 100)
})

import { canEnterTile, updateVisibility, enqueue, dequeue, promote, isEmbarked, isWater, maxMoves, pathMap as pm2, pathTo as pt2, pathTurns, neighbors as nb2, canBuildUnit as cbu } from '../src/game/rules.ts'
import { autoUnits } from '../src/game/ai.ts'

test('fronta výroby: řazení, přednost a pokračování po dokončení', () => {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  assert.equal(enqueue(s, c, { kind: 'unit', id: 'warrior' }), null)
  assert.equal(enqueue(s, c, { kind: 'building', id: 'monument' }), null)
  assert.equal(enqueue(s, c, { kind: 'unit', id: 'scout' }), null)
  assert.ok(enqueue(s, c, { kind: 'building', id: 'monument' }), 'budova nesmí být ve frontě dvakrát')
  assert.deepEqual([c.build!.id, ...c.queue.map(q => q.id)], ['warrior', 'monument', 'scout'])
  promote(s, c, 1)
  assert.deepEqual([c.build!.id, ...c.queue.map(q => q.id)], ['scout', 'warrior', 'monument'])
  dequeue(s, c, 0)
  assert.deepEqual([c.build!.id, ...c.queue.map(q => q.id)], ['scout', 'monument'])
  s.players[0].research = 'pottery'
  const before = unitsOf(s, 0).length
  for (let i = 0; i < 40 && c.build?.id !== undefined && !c.buildings.includes('monument'); i++) endTurn(s)
  assert.ok(c.buildings.includes('monument'), 'fronta se odstavěla až k monumentu')
  assert.ok(unitsOf(s, 0).length > before)
  assert.equal(c.build, null)
  const back = deserialize(serialize(s))!
  assert.deepEqual(back.cities[0].queue, [])
})

test('plavba: nalodění ukončí tah, na vodě se neútočí, lodě jen z pobřeží', () => {
  const s = createGame('aur', 'normal')
  const me = s.players[0]
  // Válečníka postavíme na břeh.
  let shore: [number, number] | null = null, sea: [number, number] | null = null
  for (let i = 0; i < s.tiles.length && !shore; i++) {
    const x = i % s.W, y = (i / s.W) | 0, t = s.tiles[i]
    if (t.t !== 'grass' && t.t !== 'plains') continue
    if (s.units.some(u => u.x === x && u.y === y)) continue
    const w = nb2(s, x, y).find(n => s.tiles[idx(s, n[0], n[1])].t === 'coast')
    if (w) { shore = [x, y]; sea = w }
  }
  assert.ok(shore && sea)
  const u = makeUnit(s, 0, 'warrior', shore![0], shore![1])
  assert.equal(pt2(s, pm2(s, u), sea![0], sea![1]), null, 'bez Plavby se na vodu nesmí')
  me.techs.push('sailing')
  assert.ok(reachable(s, u).includes(idx(s, sea![0], sea![1])))
  assert.ok(moveUnit(s, u, sea![0], sea![1]))
  assert.ok(isEmbarked(s, u) && isWater(s.tiles[idx(s, u.x, u.y)]))
  assert.equal(u.moves, 0)
  assert.equal(maxMoves(s, u), 3)
  // Naloděná jednotka nemůže útočit.
  u.moves = 3
  const foe = makeUnit(s, 3, 'warrior', shore![0], shore![1])
  assert.equal(previewAttack(s, u, foe.x, foe.y), null)
  // Pěšák ze břehu na člun zblízka nedosáhne, lučištník ano.
  assert.equal(previewAttack(s, foe, u.x, u.y), null)
  foe.type = 'archer'
  updateVisibility(s, 3)
  assert.ok(previewAttack(s, foe, u.x, u.y))
  // Cesta po vodě má rozumný odhad tahů.
  const far = pathTo2(s, u)
  assert.ok(far >= 0)
  drainEvents()
})

function pathTo2(s: ReturnType<typeof createGame>, u: ReturnType<typeof makeUnit>): number {
  const m = pm2(s, u)
  let best = -1
  for (let i = 0; i < s.tiles.length; i++) if (m.dist[i] !== Infinity && m.dist[i] > 6 && s.tiles[i].t === 'coast') { best = i; break }
  if (best < 0) return -1
  const p = pt2(s, m, best % s.W, (best / s.W) | 0)!
  const t = pathTurns(s, u, p)
  assert.ok(t >= 1 && t <= p.length)
  return t
}

test('lodě a automatika: galéra jen v pobřežním městě, dělníci sami pracují', () => {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  s.players[0].techs.push('sailing', 'navigation')
  const coastal = nb2(s, c.x, c.y).some(n => isWater(s.tiles[idx(s, n[0], n[1])]))
  assert.equal(cbu(s, c, 'galley'), coastal)
  const w = makeUnit(s, 0, 'worker', c.x, c.y)
  w.auto = true
  for (let i = 0; i < 12; i++) endTurn(s)
  assert.ok(s.tiles.some(t => t.owner === 0 && t.imp), 'automatičtí dělníci něco postavili')
  autoUnits(s)
  drainEvents()
})

import { moveCost as mc2, riverBetween, hasResource as hr2, promoteUnit, pendingPromos as pp2, upgradeTarget as ut2, upgradeUnit as uu2, upgradeBlock as ub2, roadStep, tileJobs as tj2, playerIncome as pi2, startWork as sw2 } from '../src/game/rules.ts'
import { sellResource, askAlliance, giveGold } from '../src/game/diplo.ts'

test('cesty a řeky: půl bodu po cestě, brod stojí bod navíc, most ho ruší', () => {
  const s = createGame('aur', 'normal')
  assert.ok(s.tiles.filter(t => t.river).length > 20, 'mapa má řeky')
  // Každá řeka je zapsaná z obou stran hrany.
  for (let i = 0; i < s.tiles.length; i++) {
    const r = s.tiles[i].river ?? 0
    for (let d = 0; d < 6; d++) if (r & (1 << d)) {
      const [nx, ny] = neighborXY(i % s.W, (i / s.W) | 0, d)
      assert.ok(riverBetween(s, idx(s, nx, ny), i))
    }
  }
  const u = unitsOf(s, 0).find(v => v.type === 'warrior')!
  let pair: [number, number] | null = null
  for (let i = 0; i < s.tiles.length && !pair; i++) {
    const t = s.tiles[i]
    if (!t.river || t.t !== 'grass' || t.forest) continue
    for (const n of nb2(s, i % s.W, (i / s.W) | 0)) { const j = idx(s, n[0], n[1]); if (riverBetween(s, i, j) && s.tiles[j].t === 'grass' && !s.tiles[j].forest) { pair = [i, j]; break } }
  }
  assert.ok(pair)
  assert.equal(mc2(s, u, pair![0], pair![1]), 2)
  s.tiles[pair![0]].road = true; s.tiles[pair![1]].road = true
  assert.equal(mc2(s, u, pair![0], pair![1]), 0.5)
})

test('dělníci: rozkaz na dálku a cesta až do cíle', () => {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  s.players[0].techs.push('wheel', 'mining', 'husbandry', 'forestry')
  const w = makeUnit(s, 0, 'worker', c.x, c.y)
  const spot = s.tiles.findIndex((t, i) => t.owner === 0 && tj2(s, i, 0).some(j => j.ok && j.job !== 'road') && i !== idx(s, c.x, c.y))
  assert.ok(spot >= 0)
  const job = tj2(s, spot, 0).find(j => j.ok && j.job !== 'road')!.job
  w.todo = job
  moveUnit(s, w, spot % s.W, (spot / s.W) | 0)
  for (let i = 0; i < 4 && !w.work; i++) endTurn(s)
  assert.equal(w.work, job)
  for (let i = 0; i < 8 && w.work; i++) endTurn(s)
  assert.equal(s.tiles[spot].imp, job)
  // Cesta o tři pole dál.
  const goal = tilesWithinTest(s, w.x, w.y)
  w.roadTo = goal
  roadStep(s, w)
  for (let i = 0; i < 30 && w.roadTo; i++) endTurn(s)
  assert.equal(w.roadTo, null)
  assert.ok(s.tiles[idx(s, goal[0], goal[1])].road)
  assert.ok(s.tiles.filter(t => t.road).length >= 3)
  assert.ok(sw2 !== undefined)
  drainEvents()
})

function tilesWithinTest(s: ReturnType<typeof createGame>, x: number, y: number): [number, number] {
  for (let i = 0; i < s.tiles.length; i++) {
    const tx = i % s.W, ty = (i / s.W) | 0, t = s.tiles[i]
    if (hexDist(x, y, tx, ty) === 3 && TERRAIN[t.t].passable && (t.owner === 0 || t.owner === -1) && !t.special) return [tx, ty]
  }
  throw new Error('no goal')
}

test('povýšení, přezbrojení, obchod a spojenectví', () => {
  const s = createGame('khar', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  const u = unitsOf(s, 0).find(v => v.type === 'warrior')!
  u.xp = 26
  assert.equal(pp2(u), 2)
  assert.ok(promoteUnit(s, u, 'march'))
  assert.equal(maxMoves(s, u), 3)
  assert.ok(!promoteUnit(s, u, 'march'))
  assert.equal(pp2(u), 1)
  // Přezbrojení: bez bronzu nic, s bronzem kopiník.
  assert.equal(ut2(s, u), null)
  s.players[0].techs.push('bronze')
  assert.equal(ut2(s, u), 'spearman')
  s.players[0].gold = 200
  u.x = c.x; u.y = c.y; u.moves = 2
  assert.equal(ub2(s, u), null)
  assert.ok(uu2(s, u))
  assert.equal(u.type, 'spearman')
  assert.deepEqual(u.promos, ['march'])
  assert.ok(s.players[0].gold < 200)
  // Obchod: prodáme koně, soupeř je získá a platí.
  const t = s.tiles[idx(s, c.x, c.y)]
  t.res = 'horses'
  s.players[1].gold = 100
  const before = pi2(s, 0).gold
  assert.ok(!hr2(s, 1, 'horses'))
  const r = sellResource(s, 1, 'horses')
  assert.ok(r.ok, r.text)
  assert.ok(hr2(s, 1, 'horses'))
  assert.equal(pi2(s, 0).gold, before + 3)
  // Spojenectví: chladnému soupeři se nechce, po darech ano.
  s.players[1].met.push(2); s.players[2].met.push(1)
  s.players[1].attitude[0] = 0
  assert.ok(!askAlliance(s, 1, 2).ok)
  s.players[0].gold = 500
  giveGold(s, 1); giveGold(s, 1)
  s.players[1].attitude[0] = 30
  const a = askAlliance(s, 1, 2)
  if (a.ok) { assert.ok(s.players[1].war.includes(2)); assert.ok(s.players[0].war.includes(2)); assert.ok(s.players[1].pactUntil[0] > s.turn) }
  // Válka obchod ruší.
  declareWar(s, 0, 1)
  assert.equal(s.deals.length, 0)
  drainEvents()
})

import { generateScenario as gs2 } from '../src/game/mapgen.ts'
import { isCoastal as ic2, unitStrength as us2 } from '../src/game/rules.ts'

test('scénáře: souostroví a náhodná země jsou hratelné, Thalassové vládnou moři', () => {
  // Souostroví: starty na různých ostrovech (po souši se k sobě nedostanou), všichni umějí plout.
  const s = createGame('thal', 'normal', 'islands')
  assert.equal(s.scenario, 'islands')
  for (const p of [0, 1, 2]) {
    assert.ok(s.players[p].techs.includes('sailing'))
    const st = unitsOf(s, p).find(u => u.type === 'settler')!
    assert.equal(canFoundCity(s, st), null)
  }
  const ai = unitsOf(s, 1).find(u => u.type === 'warrior')!
  const other = unitsOf(s, 2).find(u => u.type === 'settler')!
  assert.equal(pt2(s, pm2(s, ai), other.x, other.y), null, 'soupeři jsou odděleni mořem')
  assert.equal(s.tiles.filter(t => t.special === 'ruins').length, 1)
  // Thalassové: rychlejší a odolnější na vodě.
  const w = unitsOf(s, 0).find(u => u.type === 'warrior')!
  const sea = s.tiles.findIndex(t => t.t === 'coast')
  w.x = sea % s.W; w.y = (sea / s.W) | 0
  assert.equal(maxMoves(s, w), 4)
  assert.ok(us2(s, w, { defending: true }) > 7)
  const g = makeUnit(s, 0, 'galley', w.x, w.y)
  assert.equal(maxMoves(s, g), 5)
  // Náhodná země: různé seedy dají různé mapy, vždy tři platné starty a ruiny.
  const a = gs2(11, 'random'), b = gs2(12, 'random')
  assert.notDeepEqual(a.tiles.map(t => t.t), b.tiles.map(t => t.t))
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const r = createGame('aur', 'normal', 'random', seed)
    assert.equal(unitsOf(r, 0).length, 3)
    for (const p of [0, 1, 2]) assert.equal(canFoundCity(r, unitsOf(r, p).find(u => u.type === 'settler')!), null)
    assert.equal(r.tiles.filter(t => t.special === 'ruins').length, 1)
  }
  // AI Thalassů si první město postaví u moře.
  const v = createGame('aur', 'normal')
  for (let i = 0; i < 6; i++) { aiTurn(v, 0); endTurn(v); drainEvents() }
  const thal = v.players.find(p => p.nation === 'thal')!
  const cap = citiesOf(v, thal.id)[0]
  assert.ok(cap && ic2(v, cap.x, cap.y), 'hlavní město Thalassů leží na pobřeží')
})

import { adoptTradition, traditionReady, eraOf, grantTech as gt2 } from '../src/game/rules.ts'
import { traditionCost, ERAS } from '../src/game/data.ts'

test('kultura a věky: tradice za kulturu, milníky a zlatý věk za výzkum', () => {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  const p = s.players[0]
  assert.deepEqual(p.techs, ['agriculture'], 'národ začíná s jednou technologií')
  assert.equal(p.era, 0)
  // Kultura města se sčítá národu.
  endTurn(s)
  assert.ok(p.culture >= 2)
  assert.ok(!traditionReady(p))
  p.culture = traditionCost(0)
  const before = cityYields(s, c).prod
  assert.ok(adoptTradition(s, p, 'craft'))
  assert.equal(cityYields(s, c).prod, before + 1)
  assert.equal(p.culture, 0)
  assert.ok(!adoptTradition(s, p, 'stores'), 'bez kultury další tradice nejde')
  assert.ok(traditionCost(1) > traditionCost(0))
  // Šestá technologie = Bronzový věk, první národ dostane zlatý věk.
  const gold = p.gold
  for (const t of ['husbandry', 'mining', 'archery', 'pottery', 'wheel'] as const) gt2(s, p, t)
  assert.equal(p.techs.length, ERAS[1].techs)
  assert.equal(eraOf(p), 1)
  assert.equal(p.era, 1)
  assert.equal(s.eraFirst[1], 0)
  assert.ok(p.goldenUntil > s.turn)
  assert.equal(p.gold, gold + 30)
  assert.ok(s.popups.some(o => o.pid === 0 && o.title.includes('Bronzový')))
  // Druhý národ už zlatý věk nedostane.
  const q = s.players[1]
  while (q.techs.length < ERAS[1].techs) gt2(s, q, (['agriculture', 'husbandry', 'mining', 'archery', 'pottery', 'wheel', 'bronze'] as const).find(t => !q.techs.includes(t))!)
  assert.equal(q.era, 1)
  assert.equal(q.goldenUntil, 0)
  drainEvents()
})

test('osadníci: rozkaz dojít na místo a usadit se', () => {
  const s = createGame('aur', 'normal')
  const st = unitsOf(s, 0).find(u => u.type === 'settler')!
  const goal: [number, number] = [st.x + 3, st.y - 1]
  st.todo = 'found'
  moveUnit(s, st, goal[0], goal[1])
  for (let i = 0; i < 5 && !citiesOf(s, 0).length; i++) endTurn(s)
  const c = citiesOf(s, 0)[0]
  assert.ok(c, 'město založeno')
  assert.deepEqual([c.x, c.y], goal)
  assert.ok(!s.units.includes(st))
  drainEvents()
})

import { planResearch, techPath } from '../src/game/rules.ts'

test('fronta výzkumu: cesta ke vzdálené technologii a postupné zkoumání', () => {
  const s = createGame('aur', 'normal')
  foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)
  const p = s.players[0]
  // Filosofie: mystika + písmo, obojí přes hrnčířství (zemědělství už umíme).
  assert.deepEqual(techPath(p, 'philosophy'), ['pottery', 'writing', 'mysticism', 'philosophy'])
  assert.ok(planResearch(p, 'philosophy'))
  assert.equal(p.research, 'pottery')
  assert.deepEqual(p.techQueue, ['writing', 'mysticism', 'philosophy'])
  // Přidání za plán nic nezruší.
  planResearch(p, 'mining', true)
  assert.equal(p.research, 'pottery')
  assert.deepEqual(p.techQueue, ['writing', 'mysticism', 'philosophy', 'mining'])
  // Po objevu se výzkum sám posune dál.
  gt2(s, p, 'pottery')
  assert.equal(p.research, 'writing')
  for (let i = 0; i < 60 && !p.techs.includes('writing'); i++) endTurn(s)
  assert.ok(p.techs.includes('writing'))
  assert.equal(p.research, 'mysticism')
  // Nový plán bez Shiftu nahradí starý.
  planResearch(p, 'archery')
  assert.equal(p.research, 'archery')
  assert.deepEqual(p.techQueue, [])
  drainEvents()
})

import { resourceCap, resourceUsed, resourceFree, canBuildUnit as cbu3, unitBlockReason as ubr3 } from '../src/game/rules.ts'
import { barbTurn } from '../src/game/ai.ts'

test('suroviny: jeden zdroj uživí dvě jednotky, další zdroj či koupě kapacitu zvedne', () => {
  const s = createGame('thal', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  s.players[0].techs.push('iron', 'bronze')
  assert.equal(resourceCap(s, 0, 'iron'), 0)
  assert.ok(!cbu3(s, c, 'swordsman'))
  const own = s.tiles.map((t, i) => ({ t, i })).filter(o => o.t.owner === 0 && !(o.i === idx(s, c.x, c.y)))
  own[0].t.res = 'iron'; own[0].t.imp = 'mine'
  assert.equal(resourceCap(s, 0, 'iron'), 2)
  assert.ok(cbu3(s, c, 'swordsman'))
  makeUnit(s, 0, 'swordsman', c.x, c.y)
  assert.ok(cbu3(s, c, 'swordsman'))
  makeUnit(s, 0, 'swordsman', own[0].i % s.W, (own[0].i / s.W) | 0)
  assert.equal(resourceUsed(s, 0, 'iron'), 2)
  assert.equal(resourceFree(s, 0, 'iron'), 0)
  assert.ok(!cbu3(s, c, 'swordsman'), 'třetího šermíře už jeden zdroj neuživí')
  assert.match(ubr3(s, c, 'swordsman')!, /vytížené/)
  // Druhé ložisko = další dva.
  own[1].t.res = 'iron'; own[1].t.imp = 'mine'
  assert.equal(resourceCap(s, 0, 'iron'), 4)
  assert.ok(cbu3(s, c, 'swordsman'))
  // Koupě od soupeře přidá kapacitu, prodej ubere.
  s.deals.push({ seller: 0, buyer: 1, res: 'iron', gpt: 3, until: 99 })
  assert.equal(resourceCap(s, 0, 'iron'), 2)
  assert.equal(resourceCap(s, 1, 'iron'), 2)
  assert.ok(!cbu3(s, c, 'swordsman'))
})

test('startovní místa se protáčejí a barbaři ze sousedního tábora útočí', () => {
  const a = createGame('aur', 'normal', 'valley', undefined, 0), b = createGame('aur', 'normal', 'valley', undefined, 1)
  const pos = (g: typeof a, p: number) => { const u = unitsOf(g, p).find(v => v.type === 'settler')!; return `${u.x},${u.y}` }
  assert.notEqual(pos(a, 0), pos(b, 0))
  assert.equal(pos(b, 0), pos(a, 1))
  assert.equal(pos(b, 2), pos(a, 0))
  for (const p of [0, 1, 2]) assert.equal(canFoundCity(b, unitsOf(b, p).find(u => u.type === 'settler')!), null)
  // Válečník postavený vedle tábora je do pár tahů napaden.
  const s = createGame('aur', 'normal')
  const camp = s.tiles.findIndex(t => t.special === 'camp')
  const cx = camp % s.W, cy = (camp / s.W) | 0
  const spot = nb2(s, cx, cy).find(n => TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !s.units.some(u => u.x === n[0] && u.y === n[1]))!
  const w = makeUnit(s, 0, 'warrior', spot[0], spot[1])
  let attacked = false
  for (let i = 0; i < 4 && !attacked; i++) { barbTurn(s); attacked = !s.units.includes(w) || w.hp < 100 || drainEvents().some(e => e.e === 'attack') }
  assert.ok(attacked, 'barbaři zaútočili na sousední jednotku')
  drainEvents()
})

test('zaměření města přeskupí obyvatele a nenechá město hladovět', async () => {
  const { createGame } = await import('../src/game/state.ts')
  const { exec } = await import('../src/game/commands.ts')
  const { cityYields, unitsOf } = await import('../src/game/rules.ts')
  const s = createGame('aur', 'normal', 'valley', 11)
  exec(s, 0, { t: 'found', unit: unitsOf(s, 0).find(u => u.type === 'settler')!.id })
  const c = s.cities[0]
  c.pop = 5
  const y = (focus: 'food' | 'prod' | 'gold' | null) => { assert.ok(exec(s, 0, { t: 'focus', city: c.id, focus }).ok); assert.equal(c.worked.length, 5); return cityYields(s, c) }
  const auto = y(null), food = y('food'), prod = y('prod'), gold = y('gold')
  assert.equal(c.focus, 'gold')
  assert.ok(food.food >= auto.food && food.food >= prod.food && food.food >= gold.food)
  assert.ok(prod.prod >= auto.prod && prod.prod >= food.prod && prod.prod >= gold.prod)
  assert.ok(gold.gold >= auto.gold && gold.gold >= food.gold && gold.gold >= prod.gold)
  assert.ok(food.food > prod.food || prod.prod > food.prod, 'zaměření něco mění')
  if (food.foodNet >= 0) { assert.ok(prod.foodNet >= 0, 'výroba nevyhladoví'); assert.ok(gold.foodNet >= 0, 'zlato nevyhladoví') }
  y(null); assert.equal(c.focus, undefined)
})

test('střelba z hradeb: hráč vybere cíl, město střílí jednou za tah', async () => {
  const { createGame } = await import('../src/game/state.ts')
  const { exec } = await import('../src/game/commands.ts')
  const { cityShoot, declareWar, drainEvents, makeUnit, neighbors, unitsOf, updateVisibility } = await import('../src/game/rules.ts')
  const s = createGame('aur', 'normal', 'valley', 11)
  exec(s, 0, { t: 'found', unit: unitsOf(s, 0).find(u => u.type === 'settler')!.id })
  const c = s.cities[0]
  declareWar(s, 0, 1)
  const free = neighbors(s, c.x, c.y).filter(([x, y]) => !s.units.some(u => u.x === x && u.y === y) && s.tiles[y * s.W + x].t !== 'mountain' && s.tiles[y * s.W + x].t !== 'coast' && s.tiles[y * s.W + x].t !== 'ocean')
  const weak = makeUnit(s, 1, 'warrior', free[0][0], free[0][1]), strong = makeUnit(s, 1, 'warrior', free[1][0], free[1][1])
  weak.hp = 60
  updateVisibility(s, 0)
  // Hráč míří na silnější jednotku, i když by město samo zvolilo slabší.
  assert.ok(exec(s, 0, { t: 'cityShoot', city: c.id, x: strong.x, y: strong.y }).ok)
  assert.ok(strong.hp < 100)
  assert.equal(weak.hp, 60)
  assert.equal(exec(s, 0, { t: 'cityShoot', city: c.id, x: weak.x, y: weak.y }).ok, false, 'podruhé v tahu už ne')
  assert.equal(exec(s, 0, { t: 'cityShoot', city: c.id, x: c.x + 5, y: c.y }).ok, false)
  drainEvents()
  // Bez volby hráče střílí město samo na nejslabší jednotku.
  delete c.fired
  assert.ok(cityShoot(s, c))
  assert.ok(weak.hp < 60)
})
