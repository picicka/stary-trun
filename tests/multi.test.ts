import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame, deserialize, serialize } from '../src/game/state.ts'
import { exec, type Command } from '../src/game/commands.ts'
import { atWar, availableTechs, checkVictory, citiesOf, drainEvents, score, unitsOf } from '../src/game/rules.ts'
import { BARB, type GameOver, type GameState } from '../src/game/types.ts'

const settler = (s: GameState, pid: number) => unitsOf(s, pid).find(u => u.type === 'settler')!

test('více hráčů: lidé mají první místa, zbytek vede počítač', () => {
  const two = createGame('aur', 'normal', 'valley', undefined, 0, ['khar'])
  assert.deepEqual(two.players.map(p => p.human), [true, true, false, false])
  assert.deepEqual(two.players.map(p => p.nation).slice(0, 2), ['aur', 'khar'])
  assert.equal(two.players[2].nation, 'sylv')
  assert.equal(two.players[BARB].nation, 'barb')
  const three = createGame('aur', 'normal', 'valley', undefined, 0, ['khar', 'thal'])
  assert.deepEqual(three.players.map(p => p.human), [true, true, true, false])
  for (const pid of [0, 1, 2]) assert.ok(settler(three, pid), `hráč ${pid} má osadníky`)
  // Soupeř řízený počítačem dostává posily podle obtížnosti, lidé ne.
  const hard = createGame('aur', 'hard', 'valley', undefined, 0, ['khar'])
  assert.equal(unitsOf(hard, 0).length, unitsOf(hard, 1).length)
  assert.ok(unitsOf(hard, 2).length > unitsOf(hard, 0).length)
  assert.throws(() => createGame('aur', 'normal', 'valley', undefined, 0, ['aur']))
})

test('více hráčů: tahy jdou po sobě a příkaz mimo pořadí se odmítne', () => {
  const s = createGame('aur', 'normal', 'valley', undefined, 0, ['khar'])
  assert.equal(s.cur, 0)
  const before = serialize(s)
  // Druhý hráč ještě nehraje; cizí jednotku nelze ovládat ani na vlastním tahu.
  assert.equal(exec(s, 1, { t: 'found', unit: settler(s, 1).id }).ok, false)
  assert.equal(exec(s, 0, { t: 'found', unit: settler(s, 1).id }).ok, false)
  assert.equal(exec(s, 1, { t: 'endTurn' }).ok, false)
  assert.equal(serialize(s), before, 'odmítnutý příkaz stav nemění')
  assert.ok(exec(s, 0, { t: 'found', unit: settler(s, 0).id }).city !== undefined)
  const aiUnits = unitsOf(s, 2).map(u => [u.x, u.y].join())
  assert.ok(exec(s, 0, { t: 'endTurn' }).ok)
  // Po prvním hráči táhne druhý; soupeři a barbaři až po obou.
  assert.equal(s.cur, 1)
  assert.equal(s.turn, 1)
  assert.deepEqual(unitsOf(s, 2).map(u => [u.x, u.y].join()), aiUnits)
  assert.ok(exec(s, 1, { t: 'found', unit: settler(s, 1).id }).ok)
  assert.ok(exec(s, 1, { t: 'endTurn' }).ok)
  assert.equal(s.cur, 0)
  assert.equal(s.turn, 2)
  assert.ok(unitsOf(s, 0).every(u => u.moves > 0), 'hráč na tahu má obnovený pohyb')
})

test('více hráčů: zprávy, rady a okna má každý své', () => {
  const s = createGame('aur', 'normal', 'valley', undefined, 0, ['khar'])
  assert.equal(s.notes.filter(n => n.text.startsWith('Vítejte')).length, 2)
  exec(s, 0, { t: 'found', unit: settler(s, 0).id })
  assert.ok(s.notes.some(n => n.pid === 0 && n.text.startsWith('Založili jste')))
  assert.ok(!s.notes.some(n => n.pid === 1 && n.text.startsWith('Založili jste')))
  exec(s, 0, { t: 'tip', id: 'welcome' })
  exec(s, 0, { t: 'endTurn' })
  exec(s, 1, { t: 'tip', id: 'welcome' })
  assert.deepEqual(s.tutorial, ['welcome', '1:welcome'])
  // Válka mezi lidmi: oba dostanou vlastní znění zprávy.
  assert.ok(exec(s, 1, { t: 'war', vs: 0 }).ok)
  assert.ok(atWar(s, 0, 1))
  assert.ok(s.notes.some(n => n.pid === 1 && n.text.startsWith('Vyhlásili jste válku')))
  assert.ok(s.notes.some(n => n.pid === 0 && n.text.includes('vám vyhlásili válku')))
  // Mír mezi lidmi: nabídka čeká, až bude druhý hráč na tahu.
  const r = exec(s, 1, { t: 'peace', vs: 0 })
  assert.ok(r.ok && atWar(s, 0, 1))
  assert.deepEqual(s.offers.map(o => [o.from, o.to]), [[1, 0]])
  assert.equal(exec(s, 1, { t: 'peace', vs: 0 }).ok, false, 'druhá nabídka se nefrontuje')
  exec(s, 1, { t: 'found', unit: settler(s, 1).id })
  exec(s, 1, { t: 'endTurn' })
  assert.ok(exec(s, 0, { t: 'answer', from: 1, accept: true }).ok)
  assert.ok(!atWar(s, 0, 1))
  assert.equal(s.offers.length, 0)
  // Dar mezi lidmi jen přesune zlato.
  s.players[0].gold = 100
  const g1 = s.players[1].gold
  assert.ok(exec(s, 0, { t: 'diplo', kind: 'gift', vs: 1 }).ok)
  assert.equal(s.players[1].gold, g1 + 40)
  assert.equal(exec(s, 0, { t: 'diplo', kind: 'sell', vs: 1, arg: 'horses' }).ok, false)
})

/** Jednoduchý hráč pro test: vše, co udělá, jde přes příkazy a zapisuje se do záznamu. */
function playTurn(s: GameState, log: Command[]): void {
  const pid = s.cur, p = s.players[pid]
  const run = (c: Command) => { log.push(c); return exec(s, pid, c) }
  for (const u of unitsOf(s, pid)) {
    if (u.type === 'settler') run({ t: 'found', unit: u.id })
    else if ((u.type === 'worker' || u.type === 'scout') && !u.auto) run({ t: 'order', unit: u.id, o: 'auto' })
    else if (u.type === 'warrior' && u.moves > 0 && s.turn % 3 === 0) run({ t: 'move', unit: u.id, x: Math.min(s.W - 1, u.x + 1), y: u.y })
  }
  if (!p.research) { const a = availableTechs(p); if (a.length) run({ t: 'research', tech: a[a.length - 1] }) }
  for (const c of citiesOf(s, pid)) { if (!c.build) run({ t: 'advise', city: c.id }); else if (s.turn % 7 === 0) run({ t: 'buy', city: c.id }) }
  run({ t: 'endTurn' })
  drainEvents()
}

test('více hráčů: stejné příkazy dají na dvou počítačích stejný stav', () => {
  const a = createGame('thal', 'normal', 'random', 777, 1, ['sylv'])
  const start = serialize(a)
  const log: Command[] = []
  const who: number[] = []
  for (let k = 0; k < 80 && !a.over; k++) { const n = log.length; const pid = a.cur; playTurn(a, log); for (let i = n; i < log.length; i++) who.push(pid) }
  assert.ok(a.turn >= 30, `hra došla do tahu ${a.turn}`)
  assert.ok(citiesOf(a, 0).length && citiesOf(a, 1).length)
  // Druhý počítač dostal počáteční stav a pak už jen příkazy.
  const b = deserialize(start)!
  log.forEach((c, i) => { exec(b, who[i], c); drainEvents() })
  assert.equal(serialize(b), serialize(a))
})

test('více hráčů: vyřazený hráč vypadne z pořadí a vítěz je jeden', () => {
  const s = createGame('aur', 'normal', 'valley', undefined, 0, ['khar', 'thal'])
  for (const pid of [0, 1, 2]) { exec(s, pid, { t: 'found', unit: settler(s, pid).id }); if (pid < 2) exec(s, pid, { t: 'endTurn' }) }
  assert.equal(s.cur, 2)
  // Hráč 1 přijde o město: dál se střídají jen hráči 0 a 2.
  citiesOf(s, 1)[0].owner = 2
  checkVictory(s)
  assert.equal(s.players[1].alive, false)
  assert.equal(s.over, null)
  assert.ok(s.notes.some(n => n.pid === 0 && n.text.includes('byl vyhlazen')))
  exec(s, 2, { t: 'endTurn' })
  assert.equal(s.cur, 0)
  exec(s, 0, { t: 'endTurn' })
  assert.equal(s.cur, 2)
  assert.equal(exec(s, 1, { t: 'endTurn' }).ok, false)
  // Hráč 2 drží i sídlo hráče 0: vítězí dobytím a hráč 0 má vlastní text porážky.
  const seat0 = s.cities.find(c => c.seat === 0)!
  seat0.owner = 2
  checkVictory(s)
  const over = s.over as GameOver | null
  assert.ok(over)
  assert.equal(over.winner, 2)
  assert.equal(over.kind, 'conquest')
  assert.ok(over.other)
  assert.equal(exec(s, 2, { t: 'endTurn' }).ok, false)
})

test('více hráčů: po posledním tahu vítězí nejvyšší skóre', () => {
  const s = createGame('aur', 'normal', 'valley', undefined, 0, ['khar'])
  exec(s, 0, { t: 'found', unit: settler(s, 0).id }); exec(s, 0, { t: 'endTurn' })
  exec(s, 1, { t: 'found', unit: settler(s, 1).id })
  s.players[1].techs.push('pottery', 'writing', 'bronze', 'wheel')
  s.turn = s.maxTurns
  exec(s, 1, { t: 'endTurn' })
  assert.ok(s.over)
  const best = [0, 1, 2].sort((x, y) => score(s, y) - score(s, x))[0]
  assert.equal(s.over!.winner, best)
})

test('uložená hra jednoho hráče ze starší verze se načte', () => {
  const s = createGame('aur', 'normal')
  const raw = JSON.parse(serialize(s))
  // Starý tvar: vztah a pakt jako jedno číslo, zprávy a nabídky bez adresáta, jedno okno.
  for (const p of raw.players) { p.attitude = p.id === 1 ? 25 : 0; p.pactUntil = p.id === 1 ? 40 : 0 }
  for (const n of raw.notes) delete n.pid
  raw.offers = [{ from: 1 }]
  delete raw.cur; delete raw.popups; raw.popup = null
  const t = deserialize(JSON.stringify(raw))!
  assert.ok(t)
  assert.equal(t.cur, 0)
  assert.deepEqual(t.players[1].attitude, [25, 0, 0, 0])
  assert.equal(t.players[1].pactUntil[0], 40)
  assert.ok(t.notes.every(n => n.pid === 0))
  assert.equal(t.offers[0].to, 0)
  assert.deepEqual(t.popups, [])
  assert.ok(exec(t, 0, { t: 'endTurn' }).ok)
})
