// Založení hry, průběh celého kola a ukládání.
import { PLAYABLE, SCENARIOS, type Difficulty, type NationId, type ScenarioId, type TechId, DIFFICULTY } from './data.ts'
import { aiTurn, autoUnits, barbTurn } from './ai.ts'
import { generateScenario, ISLANDS_SEED, MISSION_SEED } from './mapgen.ts'
import { eraOf, beginTurn, checkVictory, endPlayerTurn, idx, makeUnit, neighbors, note, unitsAt, updateVisibility } from './rules.ts'
import { TERRAIN } from './data.ts'
import { BARB, type GameState, type Player } from './types.ts'

export const SAVE_VERSION = 3
export const MAX_TURNS = 120
const SAVE_KEY = 'hex4x-save-v' + SAVE_VERSION

export const START_TECH: Record<NationId, TechId> = { aur: 'agriculture', khar: 'mining', thal: 'agriculture', sylv: 'archery', barb: 'mining' }

function makePlayer(id: number, nation: NationId, human: boolean, personality: Player['personality']): Player {
  return {
    id, nation, human, alive: true, gold: nation === 'thal' ? 60 : 30, research: null, progress: 0, techs: id !== BARB ? (nation === 'thal' ? [START_TECH[nation], 'sailing'] : [START_TECH[nation]]) : [],
    explored: [], visible: [], war: [], met: [], personality, lastWarTurn: -99, peaceUntil: [0, 0, 0, 0], cityNames: 0, attitude: 0, pactUntil: 0, culture: 0, traditions: [], era: 0, goldenUntil: 0,
  }
}

/** Soupeři: jeden výbojný a jeden stavitel z národů, které si hráč nevybral. */
export function pickRivals(nation: NationId): [NationId, NationId] {
  const rest = PLAYABLE.filter(n => n !== nation)
  const aggr = (['khar', 'sylv'] as NationId[]).find(n => rest.includes(n))!
  const build = (['aur', 'thal'] as NationId[]).find(n => rest.includes(n))!
  return [aggr, build]
}

export function createGame(nation: NationId, difficulty: Difficulty, scenario: ScenarioId = 'valley', seed = scenario === 'valley' ? MISSION_SEED : scenario === 'islands' ? ISLANDS_SEED : 1 + Math.floor(Math.random() * 999983)): GameState {
  const sc = generateScenario(seed, scenario)
  const [aggr, build] = pickRivals(nation)
  const players = [
    makePlayer(0, nation, true, 'human'),
    makePlayer(1, aggr, false, 'aggressive'),
    makePlayer(2, build, false, 'builder'),
    makePlayer(BARB, 'barb', false, 'barbarian'),
  ]
  const s: GameState = {
    version: SAVE_VERSION, seed, scenario, rng: seed * 31 + 7, turn: 1, maxTurns: MAX_TURNS, difficulty, W: sc.W, H: sc.H, tiles: sc.tiles,
    players, cities: [], units: [], nextId: 1, notes: [],
    mission: { ruinsBy: -1, campsDestroyed: 0, questCities: false, questCamps: false, questRuins: false, wonderBy: -1 },
    over: null, offers: [], deals: [], eraFirst: [0], popup: null, tutorial: [],
  }
  const freeNear = (x: number, y: number): [number, number] => {
    for (const n of neighbors(s, x, y)) if (TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length) return n
    return [x, y]
  }
  for (let pid = 0; pid < 3; pid++) {
    const [sx, sy] = sc.starts[pid]
    makeUnit(s, pid, 'settler', sx, sy)
    makeUnit(s, pid, 'warrior', sx, sy)
    const a = freeNear(sx, sy)
    makeUnit(s, pid, 'scout', a[0], a[1])
    if (pid !== 0) for (let k = 0; k < DIFFICULTY[difficulty].aiExtra; k++) { const b = freeNear(sx, sy); makeUnit(s, pid, 'warrior', b[0], b[1]) }
  }
  for (const [cx, cy] of sc.camps) {
    const u = makeUnit(s, BARB, 'warrior', cx, cy)
    u.home = idx(s, cx, cy); u.fortified = true
  }
  // V souostroví umějí plout všichni od začátku.
  if (scenario === 'islands') for (const p of players) if (p.id !== BARB && !p.techs.includes('sailing')) p.techs.push('sailing')
  for (const p of players) updateVisibility(s, p.id)
  note(s, 0, `Vítejte: ${SCENARIOS[scenario].name}. Založte první město – vyberte osadníky a zvolte „Založit město“.`, 'info')
  return s
}

/** Ukončí tah hráče a odehraje tahy soupeřů a barbarů. */
export function endTurn(s: GameState): void {
  if (s.over) return
  endPlayerTurn(s, 0)
  checkVictory(s)
  for (const pid of [1, 2]) {
    if (s.over) break
    if (!s.players[pid].alive) continue
    beginTurn(s, pid)
    aiTurn(s, pid)
    endPlayerTurn(s, pid)
    checkVictory(s)
  }
  if (!s.over) {
    beginTurn(s, BARB)
    barbTurn(s)
    endPlayerTurn(s, BARB)
  }
  s.turn += 1
  checkVictory(s)
  if (!s.over) {
    beginTurn(s, 0)
    autoUnits(s)
    if (s.turn === s.maxTurns - 10) note(s, 0, 'Zbývá posledních 10 tahů. Po nich rozhodne skóre.', 'info')
  }
  updateVisibility(s, 0)
}

// ---------------------------------------------------------------- ukládání

export function serialize(s: GameState): string {
  return JSON.stringify(s, (k, v) => (k === 'visible' ? [] : v))
}

export function deserialize(json: string): GameState | null {
  try {
    const s = JSON.parse(json) as GameState
    if (!s || s.version !== SAVE_VERSION || !Array.isArray(s.tiles) || s.tiles.length !== s.W * s.H) return null
    // Doplnění polí, která starší uložené hry neznají.
    for (const c of s.cities) c.queue ??= []
    for (const u of s.units) { u.way ??= []; u.auto ??= false; u.todo ??= null; u.roadTo ??= null; u.xp ??= 0; u.promos ??= []; u.sea ??= false }
    for (const p of s.players) { p.attitude ??= 0; p.pactUntil ??= 0; p.culture ??= 0; p.traditions ??= []; p.era ??= eraOf(p); p.goldenUntil ??= 0 }
    s.eraFirst ??= [0]; s.popup ??= null
    s.deals ??= []
    s.scenario ??= 'valley'
    for (const p of s.players) updateVisibility(s, p.id)
    return s
  } catch {
    return null
  }
}

export function saveGame(s: GameState): void {
  try { localStorage.setItem(SAVE_KEY, serialize(s)) } catch { /* plné úložiště: hra běží dál bez uložení */ }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? deserialize(raw) : null
  } catch { return null }
}

export function hasSave(): boolean {
  try { return !!localStorage.getItem(SAVE_KEY) } catch { return false }
}

export function clearSave(): void {
  try { localStorage.removeItem(SAVE_KEY) } catch { /* nic */ }
}
