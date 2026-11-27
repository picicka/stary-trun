import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createGame } from '../src/game/state.ts'
import type { GameOver } from '../src/game/types.ts'
import { BUILDINGS, BUILDING_IDS, ERAS, PERSONAS, PERSONA_IDS, TECHS, TECH_IDS, UNITS, UNIT_IDS, type TechId } from '../src/game/data.ts'
import { SIEGE_VS_CITY, SIEGE_VS_UNIT, unitStrength, RAM_BONUS, SIEGE_UNITS, besieged, previewAttack, idx, WONDER_TURNS, checkVictory, wonderLeft, canBuildBuilding, citiesOf, cityMaxHp, wallMax, cityStrength, cityYields, foundCity, makeUnit, techPath, unitsOf, upgradeTarget, availableTechs, grantTech, techCost } from '../src/game/rules.ts'

const game = () => {
  const s = createGame('aur', 'normal', 'valley', 7)
  foundCity(s, unitsOf(s, 0).find(u => u.type === 'settler')!)
  return { s, p: s.players[0], c: citiesOf(s, 0)[0] }
}

test('strom technologií: sedm stupňů a opakovatelná technologie, platné předpoklady, žádné dvě karty na stejném místě', () => {
  assert.equal(TECH_IDS.filter(t => !TECHS[t].repeat).length, 36)
  assert.equal(Math.max(...TECH_IDS.filter(t => !TECHS[t].repeat).map(t => TECHS[t].tier)), 7)
  const spots = new Set<string>()
  for (const id of TECH_IDS) {
    const t = TECHS[id]
    for (const r of t.req) assert.ok(TECHS[r].tier < t.tier && TECHS[r].cost <= t.cost, `${id}: předpoklad ${r} musí být z nižšího stupně`)
    // Stupně nejdou přeskakovat: aspoň jeden předpoklad je ze stupně těsně pod.
    if (t.tier > 1) assert.ok(t.req.some(r => TECHS[r].tier === t.tier - 1), `${id}: chybí předpoklad ze stupně ${t.tier - 1}`)
    assert.ok(!spots.has(`${t.tier}/${t.row}`), `${id}: místo ${t.tier}/${t.row} je obsazené`)
    spots.add(`${t.tier}/${t.row}`)
    assert.ok(t.row >= 0 && t.row <= 6)
  }
  for (const u of UNIT_IDS) if (UNITS[u].tech) assert.ok(TECHS[UNITS[u].tech!])
  for (const b of BUILDING_IDS) if (BUILDINGS[b].tech) assert.ok(TECHS[BUILDINGS[b].tech!])
  assert.ok(ERAS[ERAS.length - 1].techs <= TECH_IDS.length)
})

test('každá technologie od čtvrtého stupně výš něco odemyká', () => {
  for (const id of TECH_IDS.filter(t => TECHS[t].tier >= 5 && !TECHS[t].repeat)) {
    const gives = UNIT_IDS.some(u => UNITS[u].tech === id) || BUILDING_IDS.some(b => BUILDINGS[b].tech === id)
    assert.ok(gives, `${id} nic neodemyká`)
  }
})

test('ke Slunečnímu kalendáři vede učenecká a stavitelská větev, ne celý strom', () => {
  const { p } = game()
  p.techs = []
  const path = techPath(p, 'calendar')
  for (const t of ['masonry', 'construction', 'math', 'engineering', 'philosophy', 'education', 'astronomy', 'architecture'] as TechId[]) assert.ok(path.includes(t), `cesta vede přes ${t}`)
  for (const t of ['steel', 'chivalry', 'siegecraft', 'banking', 'navigation', 'iron'] as TechId[]) assert.ok(!path.includes(t), `cesta nevede přes ${t}`)
  const cost = path.reduce((a, t) => a + TECHS[t].cost, 0)
  assert.ok(cost > 2000 && cost < 3200, `cesta k chrámu stojí ${cost} bodů`)
  assert.equal(BUILDINGS.wonder.tech, 'calendar')
})

test('Správa říše: jde zkoumat opakovaně, zdražuje a přidává zlato každému městu', () => {
  const { s, p, c } = game()
  p.techs = TECH_IDS.filter(t => !TECHS[t].repeat)
  assert.deepEqual(availableTechs(p), ['empire'])
  const gold = cityYields(s, c).gold, cost = techCost(p, 'empire')
  grantTech(s, p, 'empire')
  assert.equal(p.empire, 1)
  assert.ok(!p.techs.includes('empire'))
  assert.deepEqual(availableTechs(p), ['empire'])
  assert.equal(cityYields(s, c).gold, gold + 1)
  assert.ok(techCost(p, 'empire') > cost)
})

test('povahy počítače mají v plánu výzkumu každou technologii právě jednou', () => {
  for (const k of PERSONA_IDS) {
    const r = PERSONAS[k].research
    assert.equal(r.length, TECH_IDS.length, k)
    assert.equal(new Set(r).size, TECH_IDS.length, k)
    for (const b of PERSONAS[k].build) assert.ok(BUILDINGS[b], `${k}: ${b}`)
    for (const b of BUILDING_IDS) if (b !== 'wonder') assert.ok(PERSONAS[k].build.includes(b), `${k} nestaví ${b}`)
  }
})

test('bašty vyžadují hradby a zesilují město', () => {
  const { s, p, c } = game()
  p.techs.push('engineering')
  assert.equal(canBuildBuilding(s, c, 'bastion'), false)
  c.buildings.push('walls')
  assert.equal(canBuildBuilding(s, c, 'bastion'), true)
  const before = cityStrength(s, c), hp = cityMaxHp(c), walls = wallMax(c)
  c.buildings.push('bastion')
  assert.ok(cityStrength(s, c) > before * 1.15, 'bašty přidávají obranu (posádka se nenásobí)')
  assert.equal(cityMaxHp(c), hp, 'životy obránců se nemění')
  assert.equal(wallMax(c), walls + 100, 'bašty přidají 100 bodů hradeb')
})

test('banka přidává zlato', () => {
  const { s, c } = game()
  const before = cityYields(s, c).gold
  c.buildings.push('bank')
  assert.ok(cityYields(s, c).gold >= before + 3)
})

test('přezbrojení vede k novým jednotkám', () => {
  const { s, p, c } = game()
  p.techs.push('iron', 'steel', 'riding', 'chivalry', 'math', 'siegecraft')
  // Zdroj železa a koní na území města.
  let n = 0
  for (let i = 0; i < s.tiles.length && n < 2; i++) {
    const t = s.tiles[i]
    if (t.owner !== 0 || t.res || (i % s.W === c.x && Math.floor(i / s.W) === c.y)) continue
    t.res = n ? 'iron' : 'horses'; t.imp = n ? 'mine' : 'pasture'; n++
  }
  assert.equal(n, 2)
  const mk = (type: 'swordsman' | 'horseman' | 'catapult') => makeUnit(s, 0, type, c.x, c.y)
  assert.equal(upgradeTarget(s, mk('catapult')), 'trebuchet')
  assert.equal(upgradeTarget(s, mk('swordsman')), 'manatarms')
  assert.equal(upgradeTarget(s, mk('horseman')), 'knight')
})

test('Sluneční chrám: vítězí až ten, kdo jeho město udrží; dobytím přechází na dobyvatele', () => {
  const { s, c } = game()
  c.buildings.push('wonder'); s.mission.wonderBy = 0; s.mission.wonderSince = s.turn
  checkVictory(s)
  assert.equal(s.over, null)
  assert.equal(wonderLeft(s), WONDER_TURNS)
  s.turn += WONDER_TURNS - 1; checkVictory(s)
  assert.equal(s.over, null, 'tah před koncem odpočtu se ještě nevyhrává')
  // Město padne soupeři: chrám je jeho a odpočet začíná znovu.
  makeUnit(s, 0, 'settler', c.x, c.y)
  c.owner = 1; checkVictory(s)
  assert.equal(s.mission.wonderBy, 1)
  assert.equal(wonderLeft(s), WONDER_TURNS)
  s.turn += WONDER_TURNS; checkVictory(s)
  const over = s.over as GameOver | null
  assert.equal(over?.how, 'wonder')
  assert.equal(over?.winner, 1)
  assert.equal(over?.won, false)
})

test('beranidlo: samo neútočí, pěchotě u města přidává sílu; obklíčené město se neopravuje', () => {
  const s = createGame('aur', 'normal', 'valley', 7, 0, [], { nations: 2 })
  for (const pid of [0, 1]) foundCity(s, unitsOf(s, pid).find(u => u.type === 'settler')!)
  const c = citiesOf(s, 1)[0]
  s.players[0].war.push(1); s.players[1].war.push(0)
  for (const u of s.units.slice()) if (u.owner === 1) s.units.splice(s.units.indexOf(u), 1)
  // Pole kolem města: suchá zem, ať je kam postavit jednotky.
  const ring: [number, number][] = []
  for (let y = c.y - 1; y <= c.y + 1; y++) for (let x = c.x - 1; x <= c.x + 1; x++) {
    if (x === c.x && y === c.y) continue
    const probe = makeUnit(s, 0, 'warrior', x, y)
    s.players[0].visible[idx(s, c.x, c.y)] = 1
    if (previewAttack(s, probe, c.x, c.y)) ring.push([x, y])
    s.units.splice(s.units.indexOf(probe), 1)
  }
  assert.ok(ring.length >= 4, 'kolem města je dost polí')
  const w = makeUnit(s, 0, 'warrior', ring[0][0], ring[0][1])
  const before = previewAttack(s, w, c.x, c.y)!.dmgDef
  const hurtBefore = previewAttack(s, w, c.x, c.y)!.dmgAtt
  assert.equal(besieged(s, c), false)
  const ram = makeUnit(s, 0, 'ram', ring[1][0], ring[1][1])
  assert.equal(previewAttack(s, ram, c.x, c.y), null, 'beranidlo samo neútočí')
  const after = previewAttack(s, w, c.x, c.y)!.dmgDef
  assert.ok(previewAttack(s, w, c.x, c.y)!.dmgAtt < hurtBefore, 'beranidlo kryje: odveta města je slabší')
  assert.ok(after > before, `s beranidlem pěchota ubírá víc (${before} → ${after})`)
  assert.ok(RAM_BONUS > 1)
  makeUnit(s, 0, 'warrior', ring[2][0], ring[2][1])
  assert.equal(besieged(s, c), SIEGE_UNITS <= 3)
})

test('obléhací stroj: proti městu trojnásobná síla, proti jednotkám poloviční', () => {
  const { s, c } = game()
  const cat = makeUnit(s, 0, 'catapult', c.x, c.y)
  const base = unitStrength(s, cat, { ranged: true, vsCity: false, defending: true })
  assert.ok(Math.abs(unitStrength(s, cat, { ranged: true, vsCity: true }) / base - SIEGE_VS_CITY) < 0.001)
  assert.ok(Math.abs(unitStrength(s, cat, { ranged: true }) / base - SIEGE_VS_UNIT) < 0.001)
})

test('zbývá-li jen opakovatelná technologie, zkoumá se dál sama', () => {
  const { s, p } = game()
  for (const t of TECH_IDS) if (!TECHS[t].repeat) grantTech(s, p, t)
  assert.equal(p.research, 'empire', 'po posledním objevu se rovnou pokračuje Správou říše')
  grantTech(s, p, 'empire')
  assert.equal(p.empire, 1)
  assert.equal(p.research, 'empire', 'a po jejím dokončení znovu, bez výběru')
})
