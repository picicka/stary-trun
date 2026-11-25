import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/game/state.ts'
import { exec } from '../src/game/commands.ts'
import { drainEvents, escortOf, reachable, unitsOf } from '../src/game/rules.ts'
import { hexDist } from '../src/game/hex.ts'

const setup = () => {
  const s = createGame('aur', 'normal', 'valley', 11)
  const settler = unitsOf(s, 0).find(u => u.type === 'settler')!
  const warrior = unitsOf(s, 0).find(u => u.type === 'warrior')!
  warrior.x = settler.x; warrior.y = settler.y
  return { s, settler, warrior }
}
/** Nejvzdálenější pole, kam jednotka letos dojde. */
const far = (s: ReturnType<typeof setup>['s'], u: ReturnType<typeof setup>['settler']) => {
  const [i] = [...reachable(s, u)].filter(k => !s.units.some(o => o !== u && o.x === k % s.W && o.y === ((k / s.W) | 0)))
    .sort((a, b) => hexDist(b % s.W, (b / s.W) | 0, u.x, u.y) - hexDist(a % s.W, (a / s.W) | 0, u.x, u.y))
  return [i % s.W, (i / s.W) | 0] as const
}

test('doprovod: voják jde s civilistou a vlastní rozkaz vazbu zruší', () => {
  const { s, settler, warrior } = setup()
  assert.ok(exec(s, 0, { t: 'escort', unit: warrior.id, ward: settler.id }).ok)
  assert.equal(escortOf(s, settler), warrior)
  const [x, y] = far(s, settler)
  assert.ok(exec(s, 0, { t: 'move', unit: settler.id, x, y }).ok)
  assert.deepEqual([settler.x, settler.y], [x, y])
  assert.deepEqual([warrior.x, warrior.y], [x, y], 'doprovod došel na stejné pole')
  assert.equal(warrior.goto, null)
  // Další tah: doprovod bez pohybu dožene chráněnce na začátku příštího tahu.
  exec(s, 0, { t: 'endTurn' }); drainEvents()
  const [x2, y2] = far(s, settler)
  warrior.moves = 0
  assert.ok(exec(s, 0, { t: 'move', unit: settler.id, x: x2, y: y2 }).ok)
  assert.notDeepEqual([warrior.x, warrior.y], [settler.x, settler.y])
  exec(s, 0, { t: 'endTurn' }); drainEvents()
  assert.deepEqual([warrior.x, warrior.y], [settler.x, settler.y], 'dohnal ho na začátku tahu')
  // Vlastní rozkaz doprovod ukončí.
  assert.ok(exec(s, 0, { t: 'order', unit: warrior.id, o: 'fortify' }).ok)
  assert.equal(warrior.escort, undefined)
  assert.equal(escortOf(s, settler), undefined)
})

test('doprovod: jen vojenská jednotka u vlastního civilisty; založením města vazba zaniká', () => {
  const { s, settler, warrior } = setup()
  assert.equal(exec(s, 0, { t: 'escort', unit: settler.id, ward: warrior.id }).ok, false)
  warrior.x += 3
  assert.equal(exec(s, 0, { t: 'escort', unit: warrior.id, ward: settler.id }).ok, false, 'příliš daleko')
  warrior.x = settler.x
  assert.ok(exec(s, 0, { t: 'escort', unit: warrior.id, ward: settler.id }).ok)
  assert.ok(exec(s, 0, { t: 'found', unit: settler.id }).ok)
  exec(s, 0, { t: 'endTurn' }); drainEvents()
  assert.equal(warrior.escort, undefined, 'chráněnec zanikl')
})
