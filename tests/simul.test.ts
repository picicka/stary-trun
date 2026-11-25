import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actors, canAct, createGame, deserialize, serialize, settle, stateHash } from '../src/game/state.ts'
import { exec } from '../src/game/commands.ts'
import { drainEvents, killUnit, unitsOf } from '../src/game/rules.ts'
import type { GameState } from '../src/game/types.ts'

const game = () => createGame('aur', 'normal', 'valley', 11, 0, ['khar', 'thal'], { nations: 4, simul: true })
const end = (s: GameState, pid: number) => { const r = exec(s, pid, { t: 'endTurn' }); drainEvents(); return r }
const meet = (s: GameState, a: number, b: number) => { s.players[a].met.push(b); s.players[b].met.push(a) }

test('souběžné tahy: kdo se nepotkal, táhne zároveň; kolo končí, až skončí všichni', () => {
  const s = game()
  assert.deepEqual(actors(s), [0, 1, 2])
  // Táhnout smí kdokoli a v libovolném pořadí.
  const u2 = unitsOf(s, 2).find(u => u.type === 'settler')!
  assert.ok(exec(s, 2, { t: 'found', unit: u2.id }).ok)
  assert.ok(end(s, 1).ok)
  assert.equal(canAct(s, 1), false)
  assert.equal(exec(s, 1, { t: 'endTurn' }).ok, false, 'kdo skončil, už v tomto kole netáhne')
  assert.equal(s.turn, 1)
  assert.ok(end(s, 2).ok)
  assert.deepEqual(actors(s), [0])
  assert.ok(end(s, 0).ok)
  assert.equal(s.turn, 2, 'po posledním hráči odehraje počítač a začne nové kolo')
  assert.deepEqual(actors(s), [0, 1, 2])
  for (const pid of [0, 1, 2]) assert.ok(unitsOf(s, pid).every(u => u.moves > 0 || u.work), `hráč ${pid} má na nové kolo pohyb`)
})

test('souběžné tahy: kdo se potkal, od dalšího kola se střídá; ostatní táhnou dál zároveň', () => {
  const s = game()
  meet(s, 0, 1)
  assert.deepEqual(actors(s), [0, 1, 2], 'setkání platí až od dalšího kola')
  for (const pid of [0, 1, 2]) end(s, pid)
  assert.equal(s.turn, 2)
  assert.deepEqual(actors(s), [0, 2])
  assert.equal(exec(s, 1, { t: 'endTurn' }).ok, false, 'hráč 1 čeká na hráče 0')
  assert.ok(s.notes.some(n => n.pid === 1 && n.text.includes('po řadě')))
  end(s, 0)
  assert.deepEqual(actors(s), [1, 2])
  end(s, 2); end(s, 1)
  assert.equal(s.turn, 3)
  // Přes prostředníka: 1 zná 0 i 2, všichni tři tvoří jednu skupinu.
  meet(s, 1, 2)
  end(s, 0); end(s, 2); end(s, 1)
  assert.equal(s.turn, 4)
  assert.deepEqual(actors(s), [0])
})

test('souběžné tahy: vyřazený hráč kolo nezablokuje', () => {
  const s = game()
  end(s, 0); end(s, 2)
  assert.deepEqual(actors(s), [1])
  // Hráč 1 vypadne ze hry dřív, než stihne ukončit tah (ve hře se to stane uvnitř cizího příkazu nebo tahu počítače).
  for (const u of unitsOf(s, 1)) killUnit(s, u)
  s.players[1].alive = false
  assert.deepEqual(actors(s), [])
  settle(s)
  assert.equal(s.turn, 2, 'kolo se dohraje bez něj')
  assert.deepEqual(actors(s), [0, 2])
})

test('souběžné tahy: stejné příkazy ve stejném pořadí dají stejný stav, i po uložení', () => {
  const play = (s: GameState) => { for (const pid of [2, 0, 1]) end(s, pid); for (const pid of [1, 0, 2]) end(s, pid); return s }
  const a = play(game())
  const mid = game(); end(mid, 2)
  const b = deserialize(serialize(mid))!
  assert.equal(b.simul, true)
  for (const pid of [0, 1]) end(b, pid); for (const pid of [1, 0, 2]) end(b, pid)
  assert.equal(stateHash(a), stateHash(b))
})

test('bez volby souběžných tahů se hraje po řadě jako dřív', () => {
  const s = createGame('aur', 'normal', 'valley', 11, 0, ['khar'])
  assert.equal(s.simul, undefined)
  assert.deepEqual(actors(s), [0])
  end(s, 0)
  assert.deepEqual(actors(s), [1])
})
