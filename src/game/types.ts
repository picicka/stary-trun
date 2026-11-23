import type { ScenarioId, BuildingId, Difficulty, ImprovementId, NationId, PromoId, ResourceId, TechId, TerrainId, UnitId } from './data.ts'

/** Práce dělníků: vylepšení pole, nebo cesta. */
export type JobId = ImprovementId | 'road'

export interface Tile {
  t: TerrainId
  forest: boolean
  res: ResourceId | null
  imp: ImprovementId | null
  /** Vlastník pole (id hráče) nebo -1. */
  owner: number
  /** Město, kterému pole patří, nebo -1. */
  city: number
  variant: number
  special: 'ruins' | 'camp' | null
  road?: boolean
  /** Řeky na hranách pole: bit d = hrana směrem d (0 = V, dále po směru hodin). */
  river?: number
}

export type BuildItem = { kind: 'unit'; id: UnitId } | { kind: 'building'; id: BuildingId }

export interface City {
  id: number
  owner: number
  founder: number
  name: string
  x: number
  y: number
  pop: number
  food: number
  prod: number
  culture: number
  radius: number
  build: BuildItem | null
  /** Fronta výroby: co se má stavět po aktuální položce. */
  queue: BuildItem[]
  buildings: BuildingId[]
  hp: number
  capital: boolean
  /** Původní sídlo hráče (id) nebo -1 – rozhoduje o vítězství dobytím. */
  seat: number
  /** Indexy polí, na kterých obyvatelé pracují. */
  worked: number[]
}

export interface Unit {
  id: number
  owner: number
  type: UnitId
  x: number
  y: number
  hp: number
  moves: number
  fortified: boolean
  /** Už tento tah útočila. */
  attacked: boolean
  /** Hráč jednotku pro tento tah odložil. */
  skip: boolean
  sleep: boolean
  vet: boolean
  work: JobId | null
  /** Co mají dělníci postavit, až dojdou na cíl cesty. */
  todo: JobId | null
  /** Dělníci staví cestu pole po poli až sem. */
  roadTo: [number, number] | null
  xp: number
  promos: PromoId[]
  /** Soupeř či barbar smí na vodu (výsadek, nájezd z moře). */
  sea: boolean
  workLeft: number
  goto: [number, number] | null
  /** Další průjezdní body po dosažení cíle (fronta rozkazů). */
  way: [number, number][]
  /** Automatika: dělníci sami vylepšují pole, ostatní zkoumají mapu. */
  auto: boolean
  /** Domovský tábor barbarů (index pole) nebo -1. */
  home: number
}

export interface Player {
  id: number
  nation: NationId
  human: boolean
  alive: boolean
  gold: number
  research: TechId | null
  progress: number
  techs: TechId[]
  explored: number[]
  /** Dočasná viditelnost, neukládá se trvale (přepočítává se). */
  visible: number[]
  war: number[]
  met: number[]
  personality: 'aggressive' | 'builder' | 'human' | 'barbarian'
  lastWarTurn: number
  peaceUntil: number[]
  cityNames: number
  /** Vztah soupeře k hráči (−100 až 100). */
  attitude: number
  /** Do tohoto tahu soupeř hráče nenapadne (spojenectví). */
  pactUntil: number
}

/** Obchod se surovinou: prodávající dostává `gpt` zlata za tah, kupující má k surovině přístup. */
export interface Deal { seller: number; buyer: number; res: ResourceId; gpt: number; until: number }

export interface Note { turn: number; text: string; kind: 'info' | 'good' | 'bad' | 'war'; x?: number; y?: number }

export interface Mission {
  ruinsBy: number
  campsDestroyed: number
  questCities: boolean
  questCamps: boolean
  questRuins: boolean
  wonderBy: number
}

export interface GameOver { won: boolean; kind: 'conquest' | 'wonder' | 'score' | 'defeat'; title: string; text: string }

export interface PeaceOffer { from: number; kind?: 'peace' | 'ally'; vs?: number }

export interface GameState {
  version: number
  seed: number
  scenario: ScenarioId
  rng: number
  turn: number
  maxTurns: number
  difficulty: Difficulty
  W: number
  H: number
  tiles: Tile[]
  players: Player[]
  cities: City[]
  units: Unit[]
  nextId: number
  notes: Note[]
  mission: Mission
  over: GameOver | null
  offers: PeaceOffer[]
  deals: Deal[]
  tutorial: string[]
}

/** Události pro vykreslovací vrstvu (animace). Nejsou součástí uložené hry. */
export type GameEvent =
  | { e: 'move'; unit: number; owner: number; path: [number, number][] }
  | { e: 'attack'; unit: number; owner: number; from: [number, number]; to: [number, number]; ranged: boolean; dmgDef: number; dmgAtt: number; city: boolean }
  | { e: 'die'; unit: number; x: number; y: number }
  | { e: 'cityShot'; from: [number, number]; to: [number, number]; dmg: number }
  | { e: 'found'; city: number; x: number; y: number }
  | { e: 'capture'; city: number; x: number; y: number; by: number }
  | { e: 'spawn'; unit: number; x: number; y: number }
  | { e: 'sound'; id: string }

export const BARB = 3
