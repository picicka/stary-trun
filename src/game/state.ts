// Založení hry, průběh celého kola a ukládání.
import { PLAYABLE, SCENARIOS, type Difficulty, type NationId, type ScenarioId, type TechId, DIFFICULTY } from './data.ts'
import { aiTurn, autoUnits, barbTurn } from './ai.ts'
import { generateScenario, ISLANDS_SEED, MISSION_SEED } from './mapgen.ts'
import { eraOf, beginTurn, checkVictory, endPlayerTurn, idx, makeUnit, neighbors, noteAll, unitsAt, updateVisibility } from './rules.ts'
import { TERRAIN } from './data.ts'
import { BARB, type GameState, type Player } from './types.ts'

export const SAVE_VERSION = 3
export const MAX_TURNS = 120
const SAVE_KEY = 'hex4x-save-v' + SAVE_VERSION

export const START_TECH: Record<NationId, TechId> = { aur: 'agriculture', khar: 'mining', thal: 'agriculture', sylv: 'archery', barb: 'mining' }

function makePlayer(id: number, nation: NationId, human: boolean, personality: Player['personality']): Player {
  return {
    id, nation, human, alive: true, gold: nation === 'thal' ? 60 : 30, research: null, techQueue: [], progress: 0, techs: id !== BARB ? (nation === 'thal' ? [START_TECH[nation], 'sailing'] : [START_TECH[nation]]) : [],
    explored: [], visible: [], war: [], met: [], personality, lastWarTurn: -99, peaceUntil: [0, 0, 0, 0], cityNames: 0, attitude: [0, 0, 0, 0], pactUntil: [0, 0, 0, 0], culture: 0, traditions: [], era: 0, goldenUntil: 0,
  }
}

/** Soupeři: jeden výbojný a jeden stavitel z národů, které si hráč nevybral. */
export function pickRivals(nation: NationId): [NationId, NationId] {
  const rest = PLAYABLE.filter(n => n !== nation)
  const aggr = (['khar', 'sylv'] as NationId[]).find(n => rest.includes(n))!
  const build = (['aur', 'thal'] as NationId[]).find(n => rest.includes(n))!
  return [aggr, build]
}

/** Nejvýš tolik lidských hráčů se vejde do jedné hry. */
export const MAX_HUMANS = 3

/**
 * Založí hru. `others` jsou národy dalších lidských hráčů (hra více hráčů); zbylá místa do tří obsadí soupeři řízení počítačem.
 * Lidští hráči mají id 0, 1, … a táhnou v tomto pořadí, po nich soupeři a barbaři.
 */
export function createGame(nation: NationId, difficulty: Difficulty, scenario: ScenarioId = 'valley', seed = scenario === 'valley' ? MISSION_SEED : scenario === 'islands' ? ISLANDS_SEED : 1 + Math.floor(Math.random() * 999983), startSlot = 0, others: NationId[] = []): GameState {
  const sc = generateScenario(seed, scenario)
  const nations = [nation, ...others].slice(0, MAX_HUMANS)
  if (new Set(nations).size !== nations.length) throw new Error('Každý hráč musí mít jiný národ.')
  const players = nations.map((n, i) => makePlayer(i, n, true, 'human'))
  if (nations.length === 1) {
    const [aggr, build] = pickRivals(nation)
    players.push(makePlayer(1, aggr, false, 'aggressive'), makePlayer(2, build, false, 'builder'))
  } else if (nations.length === 2) {
    // Třetí u stolu: výbojný soused, pokud je takový národ volný.
    const rest = PLAYABLE.filter(n => !nations.includes(n))
    const aggr = (['khar', 'sylv'] as NationId[]).find(n => rest.includes(n))
    players.push(makePlayer(2, aggr ?? rest[0], false, aggr ? 'aggressive' : 'builder'))
  }
  players.push(makePlayer(BARB, 'barb', false, 'barbarian'))
  const s: GameState = {
    version: SAVE_VERSION, seed, scenario, rng: seed * 31 + 7, turn: 1, cur: 0, maxTurns: MAX_TURNS, difficulty, W: sc.W, H: sc.H, tiles: sc.tiles,
    players, cities: [], units: [], nextId: 1, notes: [],
    mission: { ruinsBy: -1, campsDestroyed: 0, questCities: false, questCamps: false, questRuins: false, wonderBy: -1 },
    over: null, offers: [], deals: [], eraFirst: [0], popups: [], tutorial: [],
  }
  const freeNear = (x: number, y: number): [number, number] => {
    for (const n of neighbors(s, x, y)) if (TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length) return n
    return [x, y]
  }
  for (let pid = 0; pid < 3; pid++) {
    // Startovní místa se mezi hráči protáčejí: hráč `pid` dostane místo o `startSlot` dál.
    const [sx, sy] = sc.starts[(pid + startSlot) % sc.starts.length]
    makeUnit(s, pid, 'settler', sx, sy)
    makeUnit(s, pid, 'warrior', sx, sy)
    const a = freeNear(sx, sy)
    makeUnit(s, pid, 'scout', a[0], a[1])
    if (!players[pid].human) for (let k = 0; k < DIFFICULTY[difficulty].aiExtra; k++) { const b = freeNear(sx, sy); makeUnit(s, pid, 'warrior', b[0], b[1]) }
  }
  for (const [cx, cy] of sc.camps) {
    const u = makeUnit(s, BARB, 'warrior', cx, cy)
    u.home = idx(s, cx, cy); u.fortified = true
  }
  // V souostroví umějí plout všichni od začátku.
  if (scenario === 'islands') for (const p of players) if (p.id !== BARB && !p.techs.includes('sailing')) p.techs.push('sailing')
  for (const p of players) updateVisibility(s, p.id)
  noteAll(s, `Vítejte: ${SCENARIOS[scenario].name}. Založte první město – vyberte osadníky a zvolte „Založit město“.`, 'info')
  return s
}

/**
 * Ukončí tah hráče, který je na řadě (`s.cur`). Je-li ve hře další lidský hráč, přijde na řadu on;
 * po posledním odehrají soupeři a barbaři a začne nový tah.
 */
export function endTurn(s: GameState): void {
  if (s.over) return
  endPlayerTurn(s, s.cur)
  checkVictory(s)
  const alive = () => s.players.filter(p => p.human && p.alive).map(p => p.id)
  let next = s.over ? undefined : alive().find(id => id > s.cur)
  if (next === undefined && !s.over) {
    for (const p of s.players) {
      if (s.over) break
      if (p.human || p.id === BARB || !p.alive) continue
      beginTurn(s, p.id)
      aiTurn(s, p.id)
      endPlayerTurn(s, p.id)
      checkVictory(s)
    }
    if (!s.over) {
      beginTurn(s, BARB)
      barbTurn(s)
      endPlayerTurn(s, BARB)
    }
    s.turn += 1
    checkVictory(s)
    next = alive()[0]
    if (!s.over && s.turn === s.maxTurns - 10) noteAll(s, 'Zbývá posledních 10 tahů. Po nich rozhodne skóre.', 'info')
  }
  if (!s.over && next !== undefined) {
    s.cur = next
    beginTurn(s, next)
    autoUnits(s, next)
  }
  for (const p of s.players) if (p.human) updateVisibility(s, p.id)
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
    const four = (v: unknown): number[] => (Array.isArray(v) ? v : [Number(v) || 0, 0, 0, 0])
    for (const p of s.players) { p.attitude = four(p.attitude); p.pactUntil = four(p.pactUntil); p.techQueue ??= []; p.culture ??= 0; p.traditions ??= []; p.era ??= eraOf(p); p.goldenUntil ??= 0 }
    s.eraFirst ??= [0]; s.popups ??= []; s.cur ??= 0
    for (const n of s.notes) n.pid ??= 0
    for (const o of s.offers) o.to ??= 0
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
