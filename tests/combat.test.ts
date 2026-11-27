import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/game/state.ts'
import { exec } from '../src/game/commands.ts'
import { hexDist } from '../src/game/hex.ts'
import type { GameState, Unit } from '../src/game/types.ts'
import {
  attack, attackBlock, beginTurn, cityHit, cityMaxHp, cityStrength, cityWalls, declareWar, drainEvents, endPlayerTurn, foundCity, idx, killUnit,
  lineOfSight, makeUnit, neighbors, previewAttack, tilesWithin, unitStrength, unitsOf, wallMax, FLANK, FORTIFY, HEAL_ENEMY, HURT_MIN, WALL_MELEE, WALL_RANGED,
} from '../src/game/rules.ts'

/** Hra s městem hráče 0 a rovnou loukou kolem něj; `foe` je první soupeř, se kterým je válka. */
function field() {
  const s = createGame('aur', 'normal')
  const c = foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)!
  for (const u of [...s.units]) if (u.x !== c.x || u.y !== c.y) killUnit(s, u)
  for (const [x, y] of tilesWithin(s, c.x, c.y, 4)) { const t = s.tiles[idx(s, x, y)]; t.t = 'grass'; t.forest = false; t.res = null; t.river = 0; t.special = null }
  const foe = 1
  declareWar(s, 0, foe)
  s.players[0].techs.push('tactics'); s.players[foe].techs.push('tactics')
  drainEvents()
  const ring = (r: number) => tilesWithin(s, c.x, c.y, r).filter(([x, y]) => hexDist(x, y, c.x, c.y) === r)
  return { s, c, foe, ring }
}
const put = (s: GameState, owner: number, type: Parameters<typeof makeUnit>[2], [x, y]: number[]): Unit => makeUnit(s, owner, type, x, y)

test('hradby berou rány místo obránců: pěchota pětinu, střelci polovinu, stroje vše', () => {
  const { c } = field()
  assert.equal(cityMaxHp(c), 200)
  assert.deepEqual(cityHit(c, 40, WALL_MELEE), { wall: 0, hp: 40 }, 'bez hradeb jde vše na obránce')
  c.buildings.push('walls')
  assert.equal(wallMax(c), 100)
  assert.deepEqual(cityHit(c, 40, WALL_MELEE), { wall: 8, hp: 0 })
  assert.deepEqual(cityHit(c, 40, WALL_RANGED), { wall: 20, hp: 0 })
  assert.deepEqual(cityHit(c, 40, 1), { wall: 40, hp: 0 })
  c.wallDmg = 90
  assert.deepEqual(cityHit(c, 40, 1), { wall: 10, hp: 30 }, 'co hradby nepoberou, projde na obránce')
  const strong = cityStrength(field().s, c)
  c.wallDmg = 100
  assert.equal(cityWalls(c), 0)
  assert.ok(cityStrength(field().s, c) < strong, 'zbořené hradby obranu nenásobí')
})

test('dobyté město si nechá stavbu hradeb a obráncům zbude čtvrtina', () => {
  const { s, c, foe, ring } = field()
  c.buildings.push('walls')
  c.wallDmg = 100; c.hp = 1
  const u = put(s, foe, 'swordsman', ring(1)[0])
  beginTurn(s, foe)
  assert.ok(attack(s, u, c.x, c.y))
  assert.equal(c.owner, foe)
  assert.equal(c.hp, 50)
  assert.ok(c.buildings.includes('walls'))
  assert.equal(cityWalls(c), 0, 'hradby zůstanou pobořené')
})

test('zpráva o ztrátách města na začátku tahu', () => {
  const { s, c, foe, ring } = field()
  endPlayerTurn(s, 0)
  const u = put(s, foe, 'swordsman', ring(1)[0])
  beginTurn(s, foe)
  attack(s, u, c.x, c.y)
  s.notes = []
  beginTurn(s, 0)
  assert.ok(s.notes.some(n => n.pid === 0 && n.text.includes(c.name) && n.text.includes('ztratilo')))
})

test('opevnění: hned jen bez útoku a se zbylým pohybem, jinak od příštího tahu', () => {
  const { s, foe, ring } = field()
  const a = put(s, 0, 'warrior', ring(2)[0]), b = put(s, 0, 'warrior', ring(2)[3])
  const e = put(s, foe, 'warrior', ring(3)[0])
  beginTurn(s, 0)
  const base = unitStrength(s, a, { defending: true })
  assert.ok(exec(s, 0, { t: 'order', unit: a.id, o: 'fortify' }).ok)
  assert.ok(Math.abs(unitStrength(s, a, { defending: true }) - base * (1 + FORTIFY)) < 1e-9, 'čerstvá jednotka je opevněná hned')
  b.moves = 0
  const bb = unitStrength(s, b, { defending: true })
  assert.ok(exec(s, 0, { t: 'order', unit: b.id, o: 'fortify' }).ok)
  assert.equal(b.fortWait, true)
  assert.equal(unitStrength(s, b, { defending: true }), bb, 'bez pohybu se bonus v tomto tahu nepočítá')
  beginTurn(s, 0)
  assert.ok(unitStrength(s, b, { defending: true }) > bb, 'od příštího tahu platí')
  void e
})

test('obléhací stroj nestřílí v tahu, kdy se přesunul', () => {
  const { s, foe, ring } = field()
  const [x, y] = ring(3)[0]
  const cat = put(s, 0, 'catapult', [x, y])
  const far = tilesWithin(s, x, y, 2).filter(([a, b]) => hexDist(a, b, x, y) === 2 && !s.units.some(u => u.x === a && u.y === b))
  const e = put(s, foe, 'warrior', far[0])
  beginTurn(s, 0)
  assert.ok(previewAttack(s, cat, e.x, e.y), 'stojící stroj střílí')
  cat.moved = true
  assert.equal(previewAttack(s, cat, e.x, e.y), null)
  assert.match(attackBlock(s, cat, e.x, e.y) ?? '', /přesouval/)
  beginTurn(s, 0)
  assert.ok(previewAttack(s, cat, e.x, e.y), 'další tah už ano')
})

test('výhled střelců: les a pahorkatina mezi střelcem a cílem brání, z pahorkatiny se střílí přes les', () => {
  const { s, foe, ring } = field()
  const [ax, ay] = ring(3)[0]
  // Cíl v přímce o dvě pole dál: mezi nimi leží jediné pole.
  const targets = tilesWithin(s, ax, ay, 2).filter(([x, y]) => hexDist(x, y, ax, ay) === 2 && neighbors(s, ax, ay).filter(([nx, ny]) => hexDist(nx, ny, x, y) === 1).length === 1)
  const [tx, ty] = targets[0]
  const [mx, my] = neighbors(s, ax, ay).find(([nx, ny]) => hexDist(nx, ny, tx, ty) === 1)!
  for (const [x, y] of [[ax, ay], [tx, ty], [mx, my]]) { const t = s.tiles[idx(s, x, y)]; t.t = 'grass'; t.forest = false }
  const archer = put(s, 0, 'archer', [ax, ay]), e = put(s, foe, 'warrior', [tx, ty])
  beginTurn(s, 0)
  assert.ok(lineOfSight(s, ax, ay, tx, ty))
  assert.ok(previewAttack(s, archer, e.x, e.y))
  s.tiles[idx(s, mx, my)].forest = true
  assert.equal(lineOfSight(s, ax, ay, tx, ty), false)
  assert.equal(previewAttack(s, archer, e.x, e.y), null)
  assert.match(attackBlock(s, archer, e.x, e.y) ?? '', /výhledu/)
  s.tiles[idx(s, ax, ay)].t = 'hills'
  assert.ok(lineOfSight(s, ax, ay, tx, ty), 'z pahorkatiny přes les')
  s.tiles[idx(s, mx, my)].t = 'hills'
  assert.equal(lineOfSight(s, ax, ay, tx, ty), false, 'přes zalesněnou pahorkatinu ne')
})

test('obklíčení a podpora po Válečnictví', () => {
  const { s, foe, ring } = field()
  const [tx, ty] = ring(3)[0]
  const e = put(s, foe, 'warrior', [tx, ty])
  const free = neighbors(s, tx, ty).filter(([x, y]) => hexDist(x, y, ring(0)[0][0], ring(0)[0][1]) > 0)
  const a = put(s, 0, 'warrior', free[0])
  beginTurn(s, 0)
  const alone = previewAttack(s, a, tx, ty)!
  assert.equal(alone.flank, 0)
  put(s, 0, 'warrior', free[1]); put(s, 0, 'archer', free[2])
  const two = previewAttack(s, a, tx, ty)!
  assert.equal(two.flank, 1, 'počítá se jen jednotka pro boj zblízka')
  assert.ok(two.dmgDef > alone.dmgDef)
  put(s, foe, 'warrior', free[3])
  const sup = previewAttack(s, a, tx, ty)!
  assert.equal(sup.support, 1)
  assert.ok(sup.dmgDef < two.dmgDef)
  s.players[0].techs = s.players[0].techs.filter(t => t !== 'tactics')
  assert.equal(previewAttack(s, a, tx, ty)!.flank, 0, 'bez Válečnictví ne')
  void FLANK
})

test('protiváhy: šermíř proti kopiníkovi, jízda proti střelcům', () => {
  const { s, foe, ring } = field()
  const sw = put(s, 0, 'swordsman', ring(2)[0]), hm = put(s, 0, 'horseman', ring(2)[2])
  const sp = put(s, foe, 'spearman', ring(3)[5]), ar = put(s, foe, 'archer', ring(3)[8]), wa = put(s, foe, 'warrior', ring(3)[11])
  assert.equal(unitStrength(s, sw, { vs: sp }), unitStrength(s, sw, { vs: wa }) * 1.25)
  assert.equal(unitStrength(s, hm, { vs: ar }), unitStrength(s, hm, { vs: wa }) * 1.25)
})

test('útok zblízka stojí pohyb jako vstup na pole; s plným pohybem jde vždy', () => {
  const { s, foe, ring } = field()
  const [tx, ty] = ring(3)[0]
  s.tiles[idx(s, tx, ty)].t = 'hills'
  const e = put(s, foe, 'warrior', [tx, ty])
  const [ax, ay] = neighbors(s, tx, ty)[0]
  const a = put(s, 0, 'warrior', [ax, ay])
  beginTurn(s, 0)
  assert.ok(previewAttack(s, a, e.x, e.y), 'plný pohyb stačí')
  a.moves = 1
  assert.equal(previewAttack(s, a, e.x, e.y), null)
  assert.match(attackBlock(s, a, e.x, e.y) ?? '', /nemá dost pohybu/)
  s.tiles[idx(s, tx, ty)].t = 'grass'
  assert.ok(previewAttack(s, a, e.x, e.y), 'na rovinu stačí jeden bod')
})

test('zraněná jednotka ztrácí nejvýš 35 % síly; na nepřátelském území se léčí o 5', () => {
  const { s, foe, ring } = field()
  const a = put(s, 0, 'warrior', ring(3)[0])
  const full = unitStrength(s, a)
  a.hp = 0.0001
  assert.ok(Math.abs(unitStrength(s, a) / full - HURT_MIN) < 0.001)
  a.hp = 50
  const t = s.tiles[idx(s, a.x, a.y)]
  t.owner = foe
  beginTurn(s, 0); endPlayerTurn(s, 0)
  assert.equal(a.hp, 50 + HEAL_ENEMY)
  t.owner = -1
  beginTurn(s, 0); endPlayerTurn(s, 0)
  assert.equal(a.hp, 50 + HEAL_ENEMY + 10)
})

test('spící jednotku probudí jen nepřítel, kterého hráč vidí', () => {
  const { s, foe, ring } = field()
  const a = put(s, 0, 'warrior', ring(3)[0])
  a.sleep = true
  beginTurn(s, 0)
  assert.equal(a.sleep, true, 'bez nepřítele spí dál')
  const [ex, ey] = neighbors(s, a.x, a.y).find(([x, y]) => !s.units.some(u => u.x === x && u.y === y))!
  put(s, foe, 'warrior', [ex, ey])
  beginTurn(s, 0)
  assert.equal(a.sleep, false)
  assert.ok(s.notes.some(n => n.pid === 0 && n.text.includes('probudil')))
})

test('povýšení stojí bod pohybu: s pohybem 2 jdou dvě za tah, bez pohybu žádné', () => {
  const { s, ring } = field()
  const a = put(s, 0, 'warrior', ring(3)[0])
  a.xp = 30; a.hp = 40
  beginTurn(s, 0)
  assert.equal(a.moves, 2)
  assert.ok(exec(s, 0, { t: 'promo', unit: a.id, id: 'drill' }).ok)
  assert.equal(a.moves, 1)
  assert.equal(a.hp, 65)
  assert.ok(exec(s, 0, { t: 'promo', unit: a.id, id: 'guard' }).ok)
  assert.equal(a.moves, 0)
  a.xp = 60
  const r = exec(s, 0, { t: 'promo', unit: a.id, id: 'medic' })
  assert.equal(r.ok, false)
  assert.match(r.text ?? '', /bod pohybu/)
  beginTurn(s, 0)
  assert.ok(exec(s, 0, { t: 'promo', unit: a.id, id: 'medic' }).ok, 'další tah už ano')
})
