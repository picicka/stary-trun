import type { TraditionId, ScenarioId, BuildingId, Difficulty, ImprovementId, NationId, PersonaId, PromoId, ResourceId, TechId, TerrainId, UnitId } from './data.ts'

/** Práce dělníků: vylepšení pole, cesta, vymýcení lesa, nebo oprava po vyplenění. */
export type JobId = ImprovementId | 'road' | 'clear' | 'repair'

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
  /** Vylepšení je vypleněné: na poli zůstává, ale nefunguje, dokud ho dělníci neopraví. */
  ruin?: boolean
  /** Vypleněná cesta: nezrychluje a nespojuje města. */
  roadRuin?: boolean
  /** Rozpracovaná práce dělníků a kolik tahů zbývá; přeruší-li se, zůstane na poli. */
  job?: JobId
  jobLeft?: number
  /** Řeky na hranách pole: bit d = hrana směrem d (0 = V, dále po směru hodin). */
  river?: number
}

export type BuildItem = { kind: 'unit'; id: UnitId } | { kind: 'building'; id: BuildingId }

export type CityFocus = 'food' | 'prod' | 'gold'

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
  /** Zaměření města: čemu dávají obyvatelé při výběru polí přednost (bez hodnoty = vyváženě). */
  focus?: CityFocus
  /** Kolik polí už město zabralo kulturou (od toho se odvíjí cena dalšího). */
  grown?: number
  /** Růst hranic: bez hodnoty vybírá pole město samo, 'manual' = vybírá hráč. */
  border?: 'manual'
  /** Pole, které si hráč vybral jako další k zabrání (index), nebo nic. */
  nextTile?: number
  /** Město je spojené cestou (nebo přístavem) s hlavním městem; trhové vsi pak vynášejí víc. */
  linked?: boolean
  /** Město už v tomto tahu vystřelilo z hradeb (na cíl, který vybral hráč). */
  fired?: boolean
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
  todo: JobId | 'found' | null
  /** Dělníci staví cestu pole po poli až sem. */
  roadTo: [number, number] | null
  xp: number
  promos: PromoId[]
  /** Spojené jednotky: 2 = šik, 3 = voj. Bez hodnoty je jednotka samostatná. */
  size?: number
  /** Soupeř či barbar smí na vodu (výsadek, nájezd z moře). */
  sea: boolean
  workLeft: number
  goto: [number, number] | null
  /** Doprovod: id vlastní civilní jednotky, kterou tato vojenská jednotka následuje a chrání. */
  escort?: number
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
  /** Fronta výzkumu: co zkoumat po aktuální technologii. */
  techQueue: TechId[]
  progress: number
  techs: TechId[]
  explored: number[]
  /** Dočasná viditelnost, neukládá se trvale (přepočítává se). */
  visible: number[]
  war: number[]
  met: number[]
  personality: PersonaId | 'human' | 'barbarian'
  lastWarTurn: number
  /** Tažení počítače: na které město táhne, zda už vyrazil (jinak shromažďuje vojsko) a odkdy. `pre` = válka ještě nebyla vyhlášena. */
  siege?: { city: number; go: boolean; since: number; pre?: boolean } | null
  peaceUntil: number[]
  cityNames: number
  /** Vztah soupeře k jednotlivým hráčům (−100 až 100), index = id hráče. */
  attitude: number[]
  /** Kolikrát národ dokončil opakovatelnou technologii Správa říše (+1 zlato v každém městě za každé dokončení). */
  empire?: number
  /** Nastřádaná kultura národa na další tradici. */
  culture: number
  traditions: TraditionId[]
  era: number
  /** Do tohoto tahu trvá zlatý věk (+1 výroba, zlato a kultura v každém městě). */
  goldenUntil: number
  /** Do tohoto tahu soupeř daného hráče nenapadne (spojenectví), index = id hráče. */
  pactUntil: number[]
}

/** Obchod se surovinou: prodávající dostává `gpt` zlata za tah, kupující má k surovině přístup. */
export interface Deal { seller: number; buyer: number; res: ResourceId; gpt: number; until: number }

/** Zpráva pro hráče `pid`. */
export interface Note { pid: number; turn: number; text: string; kind: 'info' | 'good' | 'bad' | 'war'; x?: number; y?: number }

export interface Mission {
  ruinsBy: number
  campsDestroyed: number
  questCities: boolean
  questCamps: boolean
  questRuins: boolean
  /** Kdo drží dostavěný Sluneční chrám (-1 = nestojí) a od kterého tahu. */
  wonderBy: number
  wonderSince?: number
  /** Kdo splnil vedlejší úkol (id hráče), kvůli skóre. */
  citiesBy?: number
  campsBy?: number
}

/** Konec hry. `title` a `text` platí pro vítěze (nebo pro poražené, když nevyhrál člověk); `other` čtou lidští hráči, kteří nevyhráli. */
export interface GameOver { won: boolean; winner: number; kind: 'conquest' | 'wonder' | 'score' | 'defeat'; /** Čím hra skončila (i když vyhrál počítač). */ how?: 'conquest' | 'wonder' | 'score'; title: string; text: string; other?: string }

/** Nabídka od `from` hráči `to`: mír, nebo pozvání do války proti `vs`. */
export interface PeaceOffer { from: number; to: number; kind?: 'peace' | 'ally'; vs?: number }

export interface GameState {
  version: number
  seed: number
  scenario: ScenarioId
  rng: number
  turn: number
  /** Lidský hráč, který je právě na tahu. */
  cur: number
  maxTurns: number
  /**
   * Souběžné tahy (síťová hra): hráči, kteří se ještě nepotkali, táhnou zároveň; kteří se znají, střídají se mezi sebou.
   * `groups[pid]` = skupina hráče v tomto kole (nejnižší id ve skupině), `done` = kdo už kolo ukončil, `begun` = komu kolo začalo.
   */
  simul?: boolean
  groups?: number[]
  done?: number[]
  begun?: number[]
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
  /** Kdo drží většinu cizích sídelních měst a od kterého tahu (odpočet vítězství dobytím). */
  conquest?: { by: number; since: number } | null
  /** Kdo vstoupil do kterého věku první (id hráče, index = věk). */
  eraFirst: number[]
  /** Zprávy, které má rozhraní ukázat hráči `pid` v okně (nový věk apod.). */
  popups: { pid: number; title: string; text: string }[]
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

/** Id barbarů: vždy poslední hráč v seznamu, za všemi národy. */
export const barbId = (s: { players: unknown[] }): number => s.players.length - 1
