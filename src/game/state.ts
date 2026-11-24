// Založení hry, průběh celého kola a ukládání.
import { MAX_NATIONS, NATIONS, PLAYABLE, SCENARIOS, type Difficulty, type NationId, type ScenarioId, type TechId, DIFFICULTY } from './data.ts'
import { aiTurn, autoUnits, barbTurn } from './ai.ts'
import { generateScenario, ISLANDS_SEEDS, tierOf, VALLEY_SEEDS, type MapOptions } from './mapgen.ts'
import { rand, type RngHolder } from './rng.ts'
import { eraOf, beginTurn, checkVictory, endPlayerTurn, idx, makeUnit, neighbors, noteAll, unitsAt, updateVisibility } from './rules.ts'
import { TERRAIN } from './data.ts'
import { barbId, type GameState, type Player } from './types.ts'

export const SAVE_VERSION = 3
export const MAX_TURNS = 120
const SAVE_KEY = 'hex4x-save-v' + SAVE_VERSION

export const START_TECH: Record<NationId, TechId> = { aur: 'agriculture', khar: 'mining', thal: 'agriculture', sylv: 'archery', tark: 'husbandry', zahi: 'agriculture', morv: 'mining', lume: 'agriculture', barb: 'mining' }

/** `slots` = počet hráčů včetně barbarů (délka polí vztahů). */
function makePlayer(id: number, nation: NationId, human: boolean, personality: Player['personality'], slots: number): Player {
  const zeros = () => new Array<number>(slots).fill(0)
  return {
    id, nation, human, alive: true, gold: nation === 'thal' ? 60 : 30, research: null, techQueue: [], progress: 0, techs: nation !== 'barb' ? (nation === 'thal' ? [START_TECH[nation], 'sailing'] : [START_TECH[nation]]) : [],
    explored: [], visible: [], war: [], met: [], personality, lastWarTurn: -99, peaceUntil: zeros(), cityNames: 0, attitude: zeros(), pactUntil: zeros(), culture: 0, traditions: [], era: 0, goldenUntil: 0,
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
export const MAX_HUMANS = MAX_NATIONS

/** Nastavení nové hry nad rámec národa, obtížnosti a scénáře. */
export interface GameOptions {
  /** Počet národů ve hře včetně lidí (2–8). Bez udání tři, nebo tolik, kolik je lidí. */
  nations?: number
  /** Nastavení mapy (typ krajiny, velikost, barbaři). */
  map?: Omit<MapOptions, 'players'>
  /** Délka hry v tazích. */
  maxTurns?: number
}

/** Národy soupeřů řízených počítačem: vylosují se ze zbylých, střídavě výbojný a stavitel, dokud je z čeho brát. */
function drawRivals(taken: NationId[], count: number, seed: number): NationId[] {
  const R: RngHolder = { rng: seed * 17 + 3 }
  const rest = PLAYABLE.filter(n => !taken.includes(n))
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rand(R) * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]] }
  const out: NationId[] = []
  for (let k = 0; k < count && rest.length; k++) {
    const want = k % 2 === 0 ? 'aggressive' : 'builder'
    const i = rest.findIndex(n => NATIONS[n].temper === want)
    out.push(rest.splice(i >= 0 ? i : 0, 1)[0])
  }
  return out
}

/**
 * Založí hru. `others` jsou národy dalších lidských hráčů (hra více hráčů); zbylá místa do počtu národů obsadí soupeři řízení počítačem.
 * Lidští hráči mají id 0, 1, … a táhnou v tomto pořadí, po nich soupeři a nakonec barbaři (poslední v seznamu).
 */
export function createGame(nation: NationId, difficulty: Difficulty, scenario: ScenarioId = 'valley', seedIn?: number, startSlot = 0, others: NationId[] = [], opts: GameOptions = {}): GameState {
  const humans = [nation, ...others].slice(0, MAX_HUMANS)
  if (new Set(humans).size !== humans.length) throw new Error('Každý hráč musí mít jiný národ.')
  const total = Math.max(humans.length, Math.min(MAX_NATIONS, opts.nations ?? 3))
  if (total < 2) throw new Error('Ve hře musí být aspoň dva národy.')
  // Bez nastavení zůstává mapa i sestava soupeřů přesně jako v misi pro jednoho hráče.
  const custom = opts.nations !== undefined || opts.map !== undefined
  // Ruční scénáře mají pro každou velikost vlastní pevný kód mapy; náhodná země pokaždé jiný.
  const tier = custom ? tierOf(total) : 0
  const seed = seedIn ?? (scenario === 'valley' ? VALLEY_SEEDS[tier] : scenario === 'islands' ? ISLANDS_SEEDS[tier] : 1 + Math.floor(Math.random() * 999983))
  const sc = generateScenario(seed, scenario, custom ? { ...opts.map, players: total } : undefined)
  if (sc.starts.length < total) throw new Error(`Mapa má jen ${sc.starts.length} startovních míst, národů je ${total}.`)
  const slots = total + 1
  const players = humans.map((n, i) => makePlayer(i, n, true, 'human', slots))
  let rivals: NationId[]
  if (custom) rivals = drawRivals(humans, total - humans.length, seed)
  else if (humans.length === 1) rivals = pickRivals(nation)
  else {
    // Třetí u stolu: výbojný soused, pokud je takový národ volný.
    const rest = PLAYABLE.filter(n => !humans.includes(n))
    rivals = total > humans.length ? [(['khar', 'sylv'] as NationId[]).find(n => rest.includes(n)) ?? rest[0]] : []
  }
  for (const n of rivals) players.push(makePlayer(players.length, n, false, custom || humans.length > 1 ? NATIONS[n].temper : players.length === 1 ? 'aggressive' : 'builder', slots))
  const BARB = players.length
  players.push(makePlayer(BARB, 'barb', false, 'barbarian', slots))
  const s: GameState = {
    version: SAVE_VERSION, seed, scenario, rng: seed * 31 + 7, turn: 1, cur: 0, maxTurns: opts.maxTurns ?? MAX_TURNS, difficulty, W: sc.W, H: sc.H, tiles: sc.tiles,
    players, cities: [], units: [], nextId: 1, notes: [],
    mission: { ruinsBy: -1, campsDestroyed: 0, questCities: false, questCamps: false, questRuins: false, wonderBy: -1 },
    over: null, offers: [], deals: [], eraFirst: [0], popups: [], tutorial: [],
  }
  const freeNear = (x: number, y: number): [number, number] => {
    for (const n of neighbors(s, x, y)) if (TERRAIN[s.tiles[idx(s, n[0], n[1])].t].passable && !unitsAt(s, n[0], n[1]).length) return n
    return [x, y]
  }
  for (let pid = 0; pid < BARB; pid++) {
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
      if (p.human || p.id === barbId(s) || !p.alive) continue
      beginTurn(s, p.id)
      aiTurn(s, p.id)
      endPlayerTurn(s, p.id)
      checkVictory(s)
    }
    if (!s.over) {
      beginTurn(s, barbId(s))
      barbTurn(s)
      endPlayerTurn(s, barbId(s))
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
    // Pole vztahů mají jedno místo na každého hráče; starší hry je měly jako jedno číslo vůči hráči 0.
    const each = (v: unknown): number[] => { const a = Array.isArray(v) ? v.slice() : [Number(v) || 0]; while (a.length < s.players.length) a.push(0); return a }
    for (const p of s.players) { p.attitude = each(p.attitude); p.pactUntil = each(p.pactUntil); p.peaceUntil = each(p.peaceUntil); p.techQueue ??= []; p.culture ??= 0; p.traditions ??= []; p.era ??= eraOf(p); p.goldenUntil ??= 0 }
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
