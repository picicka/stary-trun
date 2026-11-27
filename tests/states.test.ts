import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, aiRound } from '../src/game/state.ts'
import { exec } from '../src/game/commands.ts'
import { hexDist } from '../src/game/hex.ts'
import { barbId, type GameState } from '../src/game/types.ts'
import {
  cityTargets, cityYields, drainEvents, foundCity, grantTech, idx, killUnit, makeUnit, moveUnit, previewAttack, tilesWithin, unitsOf, updateVisibility, availableTechs, pathMap,
} from '../src/game/rules.ts'
import {
  ALLY, FRIEND, STATE_BONUS, STATE_MAX, campOutlook, campRipe, giftGold, settleCamps, stateBonus, stateCities, stateHostile, stateLevel, tickStates, type StateCity,
} from '../src/game/states.ts'

/** Hra s městem hráče 0, bez cizích jednotek a táborů; `camp(d)` položí tábor `d` polí od města. */
function world() {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  for (const u of [...s.units]) killUnit(s, u)
  for (const t of s.tiles) if (t.special === 'camp') t.special = null
  for (const [x, y] of tilesWithin(s, c.x, c.y, 8)) { const t = s.tiles[idx(s, x, y)]; t.t = 'grass'; t.forest = false; t.res = null; t.river = 0; t.special = null; if (t.city !== c.id) { t.owner = -1; t.city = -1 } }
  for (const o of [...s.cities]) if (o !== c) s.cities.splice(s.cities.indexOf(o), 1)
  drainEvents()
  const at = (d: number, south: boolean) => { const r = tilesWithin(s, c.x, c.y, d).filter(([x, y]) => hexDist(x, y, c.x, c.y) === d).sort((a, b) => a[1] - b[1] || a[0] - b[0]); return south ? r[r.length - 1] : r[0] }
  const camp = (d: number, south = false) => { const [x, y] = at(d, south); s.tiles[idx(s, x, y)].special = 'camp'; return idx(s, x, y) }
  /** Rovnou hotový stát `d` polí od města. */
  const state = (d = 6, south = false): StateCity => { const i = camp(d, south); s.turn = Math.max(s.turn, campRipe(i)); settleCamps(s); return stateCities(s).find(o => idx(s, o.x, o.y) === i)! }
  return { s, c, camp, state }
}
const quest = (s: GameState, st: StateCity, q: StateCity['state']['quest'][number]) => { st.state.quest[0] = q }

test('městský stát: tábor dozraje ve svém tahu, ne dřív a ne blízko města', () => {
  const { s, c, camp } = world()
  const far = camp(6), near = camp(3)
  assert.equal(campOutlook(s, near), null, 'blízko města stát nevznikne')
  s.turn = campRipe(far) - 5
  assert.equal(campOutlook(s, far), 5)
  settleCamps(s)
  assert.equal(stateCities(s).length, 0)
  const guard = makeUnit(s, barbId(s), 'warrior', far % s.W, (far / s.W) | 0); guard.home = far
  s.turn = campRipe(far)
  settleCamps(s)
  const st = stateCities(s)[0]
  assert.ok(st && idx(s, st.x, st.y) === far)
  assert.equal(s.tiles[far].special, null)
  assert.equal(st.owner, barbId(s))
  assert.ok(st.buildings.includes('walls'))
  assert.ok(!s.units.includes(guard), 'barbaři z tábora se usadili')
  assert.equal(s.tiles[near].special, 'camp')
  assert.equal(c.owner, 0)
})

test('městský stát: nejvýš STATE_MAX za hru', () => {
  const { s, camp } = world()
  camp(6)
  s.mission.states = STATE_MAX
  s.turn = 200
  settleCamps(s)
  assert.equal(stateCities(s).length, 0)
})

test('městský stát: první objevitel dostane bod a na začátku kola úkol', () => {
  const { s, state } = world()
  const st = state()
  assert.deepEqual(st.state.met, [])
  makeUnit(s, 0, 'scout', st.x + 1, st.y)
  updateVisibility(s, 0)
  assert.deepEqual(st.state.met, [0])
  assert.equal(st.state.rel[0], 1)
  assert.ok(!s.players[0].met.includes(barbId(s)), 'barbary tím hráč „nepotkal“')
  tickStates(s)
  assert.ok(st.state.quest[0], 'stát zadal úkol')
})

test('městský stát: dar ve zlatě, technologie a jednotka plní úkoly; od tří bodů přítel, od šesti spojenec', () => {
  const { s, c, state } = world()
  const st = state(), p = s.players[0]
  st.state.met.push(0)
  const before = cityYields(s, c)
  quest(s, st, { k: 'gold', n: 40 })
  p.gold = 10
  assert.ok(!exec(s, 0, { t: 'stateGift', state: st.id }).ok, 'bez zlata to nejde')
  p.gold = 100
  assert.ok(exec(s, 0, { t: 'stateGift', state: st.id }).ok)
  assert.equal(p.gold, 60)
  assert.equal(st.state.rel[0], 1)
  assert.equal(st.state.quest[0], null)
  const tech = availableTechs(p)[0]
  quest(s, st, { k: 'tech', id: tech })
  grantTech(s, p, tech)
  assert.equal(st.state.rel[0], 2)
  const u = makeUnit(s, 0, 'warrior', st.x + 3, st.y)
  quest(s, st, { k: 'unit' })
  assert.ok(!exec(s, 0, { t: 'stateUnit', unit: u.id, state: st.id }).ok, 'jednotka musí stát u města')
  moveUnit(s, u, st.x + 2, st.y); u.moves = 9; u.x = st.x + 1; u.y = st.y
  assert.ok(exec(s, 0, { t: 'stateUnit', unit: u.id, state: st.id }).ok)
  assert.ok(!s.units.includes(u))
  assert.equal(st.state.rel[0], 4)
  assert.ok(st.state.rel[0] >= FRIEND)
  assert.equal(stateLevel(s, st, 0), 1)
  assert.equal(stateBonus(s, 0)[st.state.kind], STATE_BONUS)
  // Výhoda se projeví ve výnosech hlavního města.
  const mid = cityYields(s, c), k = st.state.kind
  assert.equal(mid[k] - before[k], STATE_BONUS)
  st.state.rel[0] = ALLY - 1
  quest(s, st, { k: 'gold', n: 10 })
  assert.equal(giftGold(s, 0, st), null)
  assert.equal(st.state.ally, 0)
  assert.equal(stateLevel(s, st, 0), 2)
  assert.equal(cityYields(s, c)[k] - before[k], STATE_BONUS * 2)
})

test('městský stát: spojenec je jen jeden – ten s nejvíce body, při shodě dosavadní', () => {
  const { s, state } = world()
  const st = state()
  st.state.met.push(0, 1)
  st.state.rel[0] = ALLY; st.state.rel[1] = ALLY
  tickStates(s)
  const first = st.state.ally
  assert.ok(first === 0 || first === 1)
  const other = 1 - first
  tickStates(s)
  assert.equal(st.state.ally, first, 'shoda spojence nemění')
  st.state.rel[other] = ALLY + 1
  tickStates(s)
  assert.equal(st.state.ally, other)
  assert.equal(stateLevel(s, st, first), 1, 'bývalý spojenec zůstává přítelem')
})

test('městský stát: útok chce potvrzení, vynuluje vztah a hradby pak střílejí jen po útočníkovi', () => {
  const { s, state } = world()
  const st = state()
  st.state.met.push(0, 1); st.state.rel[0] = 5
  const u = makeUnit(s, 0, 'warrior', st.x + 1, st.y)
  const peaceful = makeUnit(s, 1, 'warrior', st.x - 1, st.y)
  assert.deepEqual(cityTargets(s, st), [], 'v míru stát nestřílí')
  const pv = previewAttack(s, u, st.x, st.y)!
  assert.ok(pv.needWar >= 0)
  assert.ok(!exec(s, 0, { t: 'attack', unit: u.id, x: st.x, y: st.y }).ok, 'bez potvrzení se neútočí')
  assert.ok(exec(s, 0, { t: 'attack', unit: u.id, x: st.x, y: st.y, war: true }).ok)
  assert.ok(stateHostile(s, st, 0))
  assert.equal(st.state.rel[0], 0)
  assert.ok(!s.players[0].war.includes(barbId(s)))
  if (s.units.includes(u)) assert.deepEqual(cityTargets(s, st), [u])
  assert.ok(!cityTargets(s, st).includes(peaceful))
  assert.ok(!stateHostile(s, st, 1))
})

test('městský stát: po dobytí je to obyčejné město a ostatní státy to dobyvateli zazlí', () => {
  const { s, state } = world()
  const st = state(6), other = state(6, true)
  assert.ok(other && other !== st)
  other.state.met.push(0); other.state.rel[0] = 4
  const u = makeUnit(s, 0, 'swordsman', st.x + 1, st.y)
  st.hp = 1; st.wallDmg = 100
  assert.ok(exec(s, 0, { t: 'attack', unit: u.id, x: st.x, y: st.y, war: true }).ok)
  assert.equal(st.owner, 0)
  assert.equal(stateCities(s).length, 1)
  assert.equal(other.state.rel[0], 2)
  assert.equal(s.tiles[idx(s, st.x, st.y)].owner, 0)
})

test('městský stát: barbaři do něj nevstoupí a celé kolo s ním proběhne bez chyby', () => {
  const { s, state } = world()
  const st = state()
  const b = makeUnit(s, barbId(s), 'warrior', st.x + 1, st.y)
  assert.equal(pathMap(s, b).dist[idx(s, st.x, st.y)], Infinity)
  moveUnit(s, b, st.x, st.y)
  assert.ok(b.x !== st.x || b.y !== st.y)
  for (const p of s.players) p.human = false
  for (let k = 0; k < 5; k++) aiRound(s)
  assert.equal(stateCities(s).length, 1)
})
