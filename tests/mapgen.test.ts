import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { TERRAIN, type ScenarioId } from '../src/game/data.ts'
import { hexDist, neighborXY } from '../src/game/hex.ts'
import {
  generateScenario, mapSize, tierOf, TIERS, ISLANDS_SEED, ISLANDS_SEEDS, MISSION_SEED, VALLEY_SEEDS,
  type Landform, type MapOptions, type Scenario,
} from '../src/game/mapgen.ts'

const print = (s: Scenario): string => createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0, 16)

const PLAYERS = [2, 3, 4, 5, 6, 7, 8]
const LANDFORMS: Landform[] = ['continent', 'continents', 'islands']
const SIZES: (-1 | 0 | 1)[] = [-1, 0, 1]
const BARBARIANS: (0 | 1 | 2 | 3)[] = [0, 1, 2, 3]
const SEEDS = [1, 4242, 99]

/** Souvislé oblasti průchozí pevniny: číslo oblasti pro každé pole (−1 = moře, hory). */
function landAreas(s: Scenario): Int32Array {
  const { W, H, tiles } = s
  const area = new Int32Array(W * H).fill(-1)
  let id = 0
  for (let i = 0; i < W * H; i++) {
    if (area[i] !== -1 || !TERRAIN[tiles[i].t].passable) continue
    const stack = [i]
    area[i] = id
    while (stack.length) {
      const c = stack.pop()!
      for (let d = 0; d < 6; d++) {
        const [nx, ny] = neighborXY(c % W, (c / W) | 0, d)
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const ni = ny * W + nx
        if (area[ni] === -1 && TERRAIN[tiles[ni].t].passable) { area[ni] = id; stack.push(ni) }
      }
    }
    id++
  }
  return area
}

/** Oblasti, na kterých leží starty (v pořadí startů). */
function startAreas(s: Scenario): number[] {
  const area = landAreas(s)
  return s.starts.map(([x, y]) => area[y * s.W + x])
}

function within(s: Scenario, x: number, y: number, r: number): [number, number][] {
  const out: [number, number][] = []
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (xx < 0 || yy < 0 || xx >= s.W || yy >= s.H || hexDist(x, y, xx, yy) > r) continue
    out.push([xx, yy])
  }
  return out
}

function minStartGap(s: Scenario): number {
  let m = Infinity
  for (let i = 0; i < s.starts.length; i++) for (let j = 0; j < i; j++) m = Math.min(m, hexDist(s.starts[i][0], s.starts[i][1], s.starts[j][0], s.starts[j][1]))
  return m
}

/** Podmínky, které musí splnit každá mapa. */
function checkMap(s: Scenario, kind: ScenarioId, opts: MapOptions, label: string): void {
  const { W, H } = mapSize(kind, opts)
  assert.equal(s.W, W, `${label}: šířka`)
  assert.equal(s.H, H, `${label}: výška`)
  assert.equal(s.tiles.length, W * H, `${label}: počet polí`)
  const at = (x: number, y: number) => s.tiles[y * W + x]
  assert.ok(s.starts.length >= opts.players, `${label}: startů je ${s.starts.length}, národů ${opts.players}`)
  assert.ok(minStartGap(s) >= 8, `${label}: starty jsou příliš blízko (${minStartGap(s)})`)
  for (const [sx, sy] of s.starts) {
    const tl = at(sx, sy)
    assert.ok(TERRAIN[tl.t].land && TERRAIN[tl.t].passable && tl.special === null, `${label}: start ${sx},${sy} není na volné průchozí pevnině`)
    const room = within(s, sx, sy, 2).filter(([x, y]) => TERRAIN[at(x, y).t].land && at(x, y).t !== 'mountain').length
    assert.ok(room >= 15, `${label}: start ${sx},${sy} má kolem sebe jen ${room} polí pevniny`)
    const has = (res: string, r: number) => within(s, sx, sy, r).some(([x, y]) => at(x, y).res === res)
    assert.ok(has('wheat', 2), `${label}: start ${sx},${sy} nemá obilí do 2 polí`)
    assert.ok(has('horses', 3), `${label}: start ${sx},${sy} nemá koně do 3 polí`)
    assert.ok(has('iron', 3), `${label}: start ${sx},${sy} nemá železo do 3 polí`)
    assert.ok(hexDist(sx, sy, s.ruins[0], s.ruins[1]) >= 5, `${label}: ruiny jsou moc blízko startu ${sx},${sy}`)
  }
  // Právě jedny ruiny, na pevnině a tam, kde je scénář hlásí.
  const ruins = s.tiles.map((t, i) => (t.special === 'ruins' ? i : -1)).filter(i => i >= 0)
  assert.deepEqual(ruins, [s.ruins[1] * W + s.ruins[0]], `${label}: ruiny`)
  assert.ok(TERRAIN[at(s.ruins[0], s.ruins[1]).t].passable, `${label}: ruiny nejsou na průchozí pevnině`)
  // Tábory: na průchozí pevnině, dál od startů a ruin, a souhlasí s poli na mapě.
  assert.equal(s.tiles.filter(t => t.special === 'camp').length, s.camps.length, `${label}: počet polí s táborem`)
  for (const [cx, cy] of s.camps) {
    assert.equal(at(cx, cy).special, 'camp', `${label}: tábor ${cx},${cy}`)
    assert.ok(TERRAIN[at(cx, cy).t].passable, `${label}: tábor ${cx},${cy} není na průchozí pevnině`)
    for (const [sx, sy] of s.starts) assert.ok(hexDist(sx, sy, cx, cy) >= 6, `${label}: tábor ${cx},${cy} je moc blízko startu ${sx},${sy}`)
    assert.ok(hexDist(s.ruins[0], s.ruins[1], cx, cy) >= 3, `${label}: tábor ${cx},${cy} je moc blízko ruin`)
  }
}

test('mapgen: zpětná shoda – bez nastavení vzniká bit po bitu původní mapa', () => {
  assert.equal(print(generateScenario(MISSION_SEED, 'valley')), '8a90d1997393e3f1')
  assert.equal(print(generateScenario(ISLANDS_SEED, 'islands')), '5726caa0c3c5ab31')
  assert.equal(print(generateScenario(1, 'random')), '54b72030610d9e50')
  assert.equal(print(generateScenario(4242, 'random')), '11520cba43aa04c2')
  assert.equal(print(generateScenario(99, 'random')), 'eb2413778af1cffd')
  // Výchozí seed a druh, malé ruční scénáře pro 2 a 3 národy s výchozími barbary.
  assert.equal(print(generateScenario()), '8a90d1997393e3f1')
  for (const players of [2, 3]) {
    assert.equal(print(generateScenario(MISSION_SEED, 'valley', { players })), '8a90d1997393e3f1')
    assert.equal(print(generateScenario(ISLANDS_SEED, 'islands', { players })), '5726caa0c3c5ab31')
    assert.equal(print(generateScenario(MISSION_SEED, 'valley', { players, barbarians: 2 })), '8a90d1997393e3f1')
    assert.equal(print(generateScenario(undefined, 'islands', { players, barbarians: 2 })), '5726caa0c3c5ab31')
  }
  assert.deepEqual(mapSize('valley'), { W: 40, H: 26 })
  assert.deepEqual(mapSize('random'), { W: 40, H: 26 })
})

test('mapgen: velikosti map podle počtu národů', () => {
  assert.deepEqual(TIERS, [[2, 3], [4, 5], [6, 8]])
  assert.deepEqual(PLAYERS.map(tierOf), [0, 0, 1, 1, 2, 2, 2])
  assert.equal(VALLEY_SEEDS[0], MISSION_SEED)
  assert.equal(ISLANDS_SEEDS[0], ISLANDS_SEED)
  const base = [[40, 26], [40, 26], [46, 30], [52, 34], [56, 36], [60, 40], [64, 42]]
  const hand = [[40, 26], [52, 34], [64, 42]]
  PLAYERS.forEach((players, i) => {
    assert.deepEqual(mapSize('random', { players }), { W: base[i][0], H: base[i][1] })
    const small = mapSize('random', { players, size: -1 }), big = mapSize('random', { players, size: 1 })
    assert.ok(small.W < base[i][0] && small.H < base[i][1] && big.W > base[i][0] && big.H > base[i][1])
    for (const kind of ['valley', 'islands'] as ScenarioId[]) {
      // Ruční scénáře velikost ani krajinu z nastavení nečtou.
      assert.deepEqual(mapSize(kind, { players, size: 1, landform: 'islands' }), { W: hand[tierOf(players)][0], H: hand[tierOf(players)][1] })
    }
  })
})

test('mapgen: ruční scénáře ve třech velikostech', () => {
  const startCount = [3, 5, 8]
  for (const kind of ['valley', 'islands'] as ScenarioId[]) {
    const seeds = kind === 'valley' ? VALLEY_SEEDS : ISLANDS_SEEDS
    for (const players of PLAYERS) {
      const tier = tierOf(players)
      const label = `${kind}/${players}`
      const s = generateScenario(seeds[tier], kind, { players })
      checkMap(s, kind, { players }, label)
      assert.equal(s.starts.length, startCount[tier], `${label}: počet startů`)
      const areas = startAreas(s)
      if (kind === 'valley') assert.equal(new Set(areas).size, 1, `${label}: starty nejsou propojené po souši`)
      else {
        assert.equal(new Set(areas).size, areas.length, `${label}: dva starty na jednom ostrově`)
        assert.ok(!areas.includes(landAreas(s)[s.ruins[1] * s.W + s.ruins[0]]), `${label}: ruiny na domovském ostrově`)
      }
      // Výchozí seed je pevný seed dané velikosti; stejné zadání dává stejnou mapu.
      assert.equal(print(generateScenario(undefined, kind, { players })), print(s), `${label}: výchozí seed`)
      assert.equal(print(generateScenario(seeds[tier], kind, { players })), print(s), `${label}: determinismus`)
      // Barbaři mění jen tábory: 0 žádné, 1 polovina, 2 dva na start, 3 víc.
      const base = startCount[tier] * 2
      const counts = BARBARIANS.map(barbarians => {
        const b = generateScenario(seeds[tier], kind, { players, barbarians })
        checkMap(b, kind, { players, barbarians }, `${label}/barbaři ${barbarians}`)
        assert.deepEqual(b.starts, s.starts)
        assert.deepEqual(b.ruins, s.ruins)
        b.tiles.forEach((t, i) => {
          const o = s.tiles[i]
          assert.ok(t.t === o.t && t.res === o.res && t.river === o.river && t.variant === o.variant, `${label}: barbaři ${barbarians} změnili terén`)
          if (t.special !== 'camp' && o.special !== 'camp') assert.ok(t.forest === o.forest && t.special === o.special)
        })
        return b.camps.length
      })
      assert.equal(counts[0], 0, `${label}: tábory při 0`)
      assert.equal(counts[1], base / 2, `${label}: tábory při 1`)
      assert.equal(counts[2], base, `${label}: tábory při 2`)
      assert.ok(counts[3] > counts[2] && counts[3] <= base * 1.5, `${label}: tábory při 3 (${counts[3]})`)
    }
  }
})

test('mapgen: ruční scénáře snesou i jiný seed', () => {
  for (const kind of ['valley', 'islands'] as ScenarioId[]) for (const players of [3, 5, 8]) for (const seed of SEEDS) {
    const s = generateScenario(seed, kind, { players })
    checkMap(s, kind, { players }, `${kind}/${players}/seed ${seed}`)
    const areas = startAreas(s)
    assert.equal(new Set(areas).size, kind === 'valley' ? 1 : areas.length, `${kind}/${players}/seed ${seed}: propojení startů`)
  }
})

for (const landform of LANDFORMS) {
  test(`mapgen: náhodná mapa – ${landform}`, () => {
    for (const size of SIZES) for (const players of PLAYERS) for (const seed of SEEDS) {
      const label = `random/${landform}/velikost ${size}/${players} národů/seed ${seed}`
      const opts: MapOptions = { players, landform, size }
      const s = generateScenario(seed, 'random', opts)
      checkMap(s, 'random', opts, label)
      assert.equal(s.starts.length, players, `${label}: počet startů`)
      assert.equal(print(generateScenario(seed, 'random', { ...opts })), print(s), `${label}: determinismus`)
      // Rozdělení startů na pevniny podle typu krajiny.
      const areas = startAreas(s)
      const perArea = new Map<number, number>()
      for (const a of areas) perArea.set(a, (perArea.get(a) ?? 0) + 1)
      if (landform === 'continent') assert.equal(perArea.size, 1, `${label}: starty nejsou propojené po souši`)
      else if (landform === 'islands') assert.equal(perArea.size, players, `${label}: dva starty na jednom ostrově`)
      else {
        assert.ok(perArea.size >= 2 && perArea.size <= 3, `${label}: starty jsou na ${perArea.size} pevninách`)
        if (players >= 4) assert.ok([...perArea.values()].every(n => n >= 2), `${label}: osamělý start na pevnině`)
      }
      // Tábory: žádné při 0, s nastavením jich přibývá, odstupy mezi sebou aspoň 6 polí.
      const counts = BARBARIANS.map(barbarians => {
        const b = generateScenario(seed, 'random', { ...opts, barbarians })
        checkMap(b, 'random', { ...opts, barbarians }, `${label}/barbaři ${barbarians}`)
        assert.deepEqual(b.starts, s.starts, `${label}: barbaři ${barbarians} změnili starty`)
        for (let i = 0; i < b.camps.length; i++) {
          for (const [sx, sy] of b.starts) assert.ok(hexDist(sx, sy, b.camps[i][0], b.camps[i][1]) > 6, `${label}: tábor do 6 polí od startu`)
          for (let j = 0; j < i; j++) assert.ok(hexDist(b.camps[i][0], b.camps[i][1], b.camps[j][0], b.camps[j][1]) >= 6, `${label}: tábory moc blízko sebe`)
        }
        return b.camps.length
      })
      assert.equal(counts[0], 0, `${label}: tábory při 0`)
      assert.equal(s.camps.length, counts[2], `${label}: výchozí barbaři`)
      assert.ok(counts[1] >= 1 && counts[1] <= counts[2] && counts[2] <= counts[3], `${label}: tábory ${counts}`)
      assert.ok(counts[2] <= players * 2 && counts[3] <= players * 3, `${label}: tábory ${counts}`)
      // Na těsném souostroví (menší mapa) se víc táborů na ostrůvky nevejde; jinde jich musí přibývat.
      if (!(landform === 'islands' && size === -1)) {
        assert.equal(counts[1], players, `${label}: tábory při 1`)
        assert.ok(counts[3] > counts[1], `${label}: tábory ${counts}`)
      }
      if (landform !== 'islands' && size >= 0) assert.equal(counts[2], players * 2, `${label}: tábory při 2`)
    }
  })
}

test('mapgen: výchozí krajina je jeden kontinent a řek přibývá s plochou', () => {
  for (const seed of SEEDS) {
    assert.equal(print(generateScenario(seed, 'random', { players: 6 })), print(generateScenario(seed, 'random', { players: 6, landform: 'continent', size: 0, barbarians: 2 })))
  }
  const rivers = (players: number) => SEEDS.reduce((n, seed) => n + generateScenario(seed, 'random', { players }).tiles.filter(t => t.river).length, 0)
  assert.ok(rivers(8) > rivers(3) * 1.5, `řeky: ${rivers(3)} pro 3 národy, ${rivers(8)} pro 8`)
})
