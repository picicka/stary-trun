import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, deserialize, serialize } from '../src/game/state.ts'
import { exec, type Command } from '../src/game/commands.ts'
import { NATIONS, PLAYABLE, UNITS, unitFor, type NationId } from '../src/game/data.ts'
import { buyPrice, salePrice } from '../src/game/diplo.ts'
import {
  availableTechs, citiesOf, cityStrength, cityYields, drainEvents, foundCity, idx, itemCost, makeUnit, maxMoves, tileYield, unitStrength, unitsOf,
} from '../src/game/rules.ts'
import { barbId, type GameState } from '../src/game/types.ts'

const settler = (s: GameState, pid: number) => unitsOf(s, pid).find(u => u.type === 'settler')!

test('osm národů: každý má vlastní unikátní jednotku a úplná data', () => {
  assert.equal(PLAYABLE.length, 8)
  const uniques = new Set<string>()
  for (const n of PLAYABLE) {
    const d = NATIONS[n], u = UNITS[d.unique]
    assert.equal(u.nation, n, `${n}: unikátní jednotka patří národu`)
    assert.ok(u.replaces && unitFor(n, u.replaces) === d.unique)
    assert.ok(d.cities.length >= 8 && d.leader && d.trait && d.traitDesc && d.lore)
    uniques.add(d.unique)
  }
  assert.equal(uniques.size, 8)
  assert.equal(new Set(PLAYABLE.map(n => NATIONS[n].color)).size, 8, 'barvy národů se neopakují')
})

test('počet národů: 2 až 8, lidé první, barbaři poslední', () => {
  for (let n = 2; n <= 8; n++) {
    for (const humans of [1, n]) {
      const others = PLAYABLE.slice(1, humans)
      const s = createGame('aur', 'normal', 'random', 500 + n, 0, others, { nations: n })
      assert.equal(s.players.length, n + 1)
      assert.equal(barbId(s), n)
      assert.equal(s.players[n].nation, 'barb')
      assert.deepEqual(s.players.map(p => p.human), Array.from({ length: n + 1 }, (_, i) => i < humans))
      assert.equal(new Set(s.players.map(p => p.nation)).size, n + 1, 'každý národ je ve hře jednou')
      const at = new Set<number>()
      for (let pid = 0; pid < n; pid++) {
        const u = settler(s, pid)
        assert.ok(u, `národ ${pid} má osadníky`)
        at.add(idx(s, u.x, u.y))
        const p = s.players[pid]
        assert.equal(p.attitude.length, n + 1); assert.equal(p.pactUntil.length, n + 1); assert.equal(p.peaceUntil.length, n + 1)
        if (!p.human) assert.equal(p.personality, NATIONS[p.nation].temper)
      }
      assert.equal(at.size, n, 'každý začíná jinde')
      assert.ok(s.W * s.H >= 40 * 26)
    }
  }
  // Stejný kód mapy a nastavení = stejná hra, včetně vylosovaných soupeřů.
  const a = createGame('khar', 'normal', 'random', 4321, 2, [], { nations: 6, map: { landform: 'continents' } })
  const b = createGame('khar', 'normal', 'random', 4321, 2, [], { nations: 6, map: { landform: 'continents' } })
  assert.equal(serialize(a), serialize(b))
  assert.throws(() => createGame('aur', 'normal', 'random', 1, 0, [], { nations: 1 }))
})

test('ruční scénáře mají velikost podle počtu národů', () => {
  for (const kind of ['valley', 'islands'] as const) {
    const small = createGame('aur', 'normal', kind, undefined, 0, [], { nations: 3 })
    const mid = createGame('aur', 'normal', kind, undefined, 0, [], { nations: 5 })
    const big = createGame('aur', 'normal', kind, undefined, 0, [], { nations: 8 })
    assert.equal(small.W, 40)
    assert.ok(mid.W > small.W && big.W > mid.W)
    for (const s of [small, mid, big]) for (let pid = 0; pid < barbId(s); pid++) assert.ok(settler(s, pid))
    // Nastavení pro tři národy dá stejnou mapu jako mise bez nastavení.
    const plain = createGame('aur', 'normal', kind)
    assert.deepEqual(small.tiles.map(t => [t.t, t.res, t.special, t.forest]), plain.tiles.map(t => [t.t, t.res, t.special, t.forest]))
  }
})

test('délka hry a barbaři se dají nastavit', () => {
  const s = createGame('aur', 'normal', 'random', 77, 0, [], { nations: 4, maxTurns: 80, map: { barbarians: 0 } })
  assert.equal(s.maxTurns, 80)
  assert.equal(s.tiles.filter(t => t.special === 'camp').length, 0)
  assert.equal(unitsOf(s, barbId(s)).length, 0)
  const many = createGame('aur', 'normal', 'random', 77, 0, [], { nations: 4, map: { barbarians: 3 } })
  const few = createGame('aur', 'normal', 'random', 77, 0, [], { nations: 4, map: { barbarians: 1 } })
  assert.ok(many.tiles.filter(t => t.special === 'camp').length > few.tiles.filter(t => t.special === 'camp').length)
})

/** Hra čtyř národů, kde hráč 0 vede `nation`; ostatní jsou lidé, ať nic netáhne samo. */
function gameOf(nation: NationId): GameState {
  const others = PLAYABLE.filter(n => n !== nation).slice(0, 3)
  return createGame(nation, 'normal', 'random', 31, 0, others, { nations: 4 })
}

test('nové národy: vlastnosti', () => {
  // Tarkové: jízda +1 pohyb, ohrada +1 jídlo.
  let s = gameOf('tark'), ref = gameOf('aur')
  const st = settler(s, 0)
  const rider = makeUnit(s, 0, 'raider', st.x, st.y)
  assert.equal(maxMoves(s, rider), UNITS.raider.move + 1)
  assert.equal(maxMoves(ref, makeUnit(ref, 0, 'chariot', settler(ref, 0).x, settler(ref, 0).y)), UNITS.chariot.move)
  const i = idx(s, st.x, st.y)
  const base = tileYield(s, i, 0).food
  s.tiles[i].imp = 'pasture'; ref.tiles[i].imp = 'pasture'; ref.tiles[i].t = s.tiles[i].t; ref.tiles[i].res = s.tiles[i].res; ref.tiles[i].forest = s.tiles[i].forest; ref.tiles[i].river = s.tiles[i].river
  assert.equal(tileYield(s, i, 0).food, tileYield(ref, i, 0).food + 1)
  assert.ok(tileYield(s, i, 0).food > base)

  // Zahirové: poušť +1 zlato, výhodnější obchod.
  s = gameOf('zahi')
  const j = idx(s, settler(s, 0).x, settler(s, 0).y)
  s.tiles[j].t = 'desert'; s.tiles[j].res = null; s.tiles[j].river = 0
  assert.equal(tileYield(s, j, 0).gold, tileYield(s, j, 1).gold + 1)
  assert.equal(salePrice(s.players[1], 0, s.players[0]), salePrice(s.players[1], 0) + 1)
  assert.equal(buyPrice(s.players[1], 0, s.players[0]), buyPrice(s.players[1], 0) - 1)

  // Morvané: levnější budovy (ne div), kámen +1 výroba, odolnější města.
  s = gameOf('morv')
  const me = s.players[0], they = s.players[1]
  assert.equal(itemCost({ kind: 'building', id: 'library' }, me), Math.round(itemCost({ kind: 'building', id: 'library' }, they) * 0.85))
  assert.equal(itemCost({ kind: 'building', id: 'wonder' }, me), itemCost({ kind: 'building', id: 'wonder' }, they))
  assert.equal(itemCost({ kind: 'unit', id: 'warrior' }, me), itemCost({ kind: 'unit', id: 'warrior' }, they))
  const mine = foundCity(s, settler(s, 0))!, theirs = foundCity(s, settler(s, 1))!
  mine.pop = theirs.pop = 3
  for (const u of [...s.units]) if (u.type !== 'settler') s.units.splice(s.units.indexOf(u), 1)
  assert.ok(Math.abs(cityStrength(s, mine) - cityStrength(s, theirs) * 1.25) < 1e-9)
  const k = idx(s, mine.x + 1, mine.y)
  s.tiles[k].res = 'stone'
  assert.equal(tileYield(s, k, 0).prod, tileYield(s, k, 1).prod + 1)
  // Levnější budova se opravdu dřív dostaví: výroba přesně na zlevněnou cenu.
  exec(s, 0, { t: 'build', city: mine.id, item: { kind: 'building', id: 'monument' } })
  mine.prod = itemCost({ kind: 'building', id: 'monument' }, me) - cityYields(s, mine).prod
  exec(s, 0, { t: 'endTurn' })
  assert.ok(mine.buildings.includes('monument'))

  // Lumenové: knihovna a chrám dávají vědu a kulturu navíc.
  s = gameOf('lume')
  const a = foundCity(s, settler(s, 0))!, b = foundCity(s, settler(s, 1))!
  a.pop = b.pop = 2
  const plainA = cityYields(s, a), plainB = cityYields(s, b)
  a.buildings.push('library', 'temple'); b.buildings.push('library', 'temple')
  const dA = cityYields(s, a), dB = cityYields(s, b)
  assert.equal((dA.sci - plainA.sci) - (dB.sci - plainB.sci), 4)
  assert.equal((dA.culture - plainA.culture) - (dB.culture - plainB.culture), 2)
  // Chrámová stráž se doma brání lépe než v cizině.
  const guard = makeUnit(s, 0, 'templar', a.x, a.y)
  const home = unitStrength(s, guard, { defending: true })
  s.tiles[idx(s, a.x, a.y)].owner = 1
  assert.ok(home > unitStrength(s, guard, { defending: true }))
  assert.equal(UNITS.ballista.range, 3)
})

function playTurn(s: GameState, log: [number, Command][]): void {
  const pid = s.cur, p = s.players[pid]
  const run = (c: Command) => { log.push([pid, c]); return exec(s, pid, c) }
  for (const u of unitsOf(s, pid)) {
    if (u.type === 'settler') run({ t: 'found', unit: u.id })
    else if ((u.type === 'worker' || u.type === 'scout') && !u.auto) run({ t: 'order', unit: u.id, o: 'auto' })
  }
  if (!p.research) { const a = availableTechs(p); if (a.length) run({ t: 'research', tech: a[0] }) }
  for (const c of citiesOf(s, pid)) if (!c.build) run({ t: 'advise', city: c.id })
  run({ t: 'endTurn' })
  drainEvents()
}

test('osm národů: dva lidé a šest soupeřů odehrají hru a záznam příkazů ji zopakuje', () => {
  const s = createGame('lume', 'normal', 'random', 2024, 3, ['tark'], { nations: 8 })
  const start = serialize(s)
  const log: [number, Command][] = []
  const t0 = Date.now()
  for (let k = 0; k < 120 && !s.over && s.turn <= 50; k++) playTurn(s, log)
  const ms = Date.now() - t0
  assert.ok(s.turn > 50 || s.over, `hra došla do tahu ${s.turn}`)
  const majors = s.players.slice(0, barbId(s))
  assert.ok(majors.filter(p => citiesOf(s, p.id).length > 0).length >= 6, 'většina národů má město')
  assert.ok(majors.some(p => !p.human && citiesOf(s, p.id).length >= 2), 'soupeři se rozrůstají')
  assert.ok(ms < 20000, `50 tahů osmi národů trvalo ${ms} ms`)
  const b = deserialize(start)!
  for (const [pid, c] of log) { exec(b, pid, c); drainEvents() }
  assert.equal(serialize(b), serialize(s))
})
