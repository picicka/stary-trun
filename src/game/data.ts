// Herní data: terén, suroviny, jednotky, budovy, technologie, národy.
// Čistá data bez závislosti na Phaseru.

export type ScenarioId = 'valley' | 'islands' | 'random'
export interface ScenarioDef { name: string; short: string; desc: string; intro: string; inPlace: string; over: string; ruinsWhere: string }
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  valley: {
    name: 'Údolí Starého trůnu', short: 'Údolí', desc: 'Ručně navržená mapa: jeden kontinent, tři kouty oddělené horami s průsmyky, ruiny uprostřed. Vyvážená mise pro první hru; ve kterém koutě začnete, je pokaždé jiné.',
    intro: 'přivádí svůj lid do jednoho ze tří úrodných koutů údolí. Za horami se ale usazují další dva národy se stejným cílem.',
    inPlace: 'v Údolí', over: 'Nad Údolím Starého trůnu', ruinsWhere: 'uprostřed údolí',
  },
  islands: {
    name: 'Souostroví Sedmi větrů', short: 'Souostroví', desc: 'Každý národ začíná na jednom ze tří velkých ostrovů (pokaždé na jiném) a všichni už umějí plout. K ruinám, k soupeřům i na menší ostrovy se dostanete jen po moři; piráti tu mají žně.',
    intro: 'přistává se svým lidem na jednom z velkých ostrovů. Na dalších dvou se usazují soupeři a o prostřední ostrov s ruinami se strhne závod po moři.',
    inPlace: 'v Souostroví', over: 'Nad Souostrovím Sedmi větrů', ruinsWhere: 'na prostředním ostrově',
  },
  random: {
    name: 'Neznámá země', short: 'Neznámá země', desc: 'Pokaždé jiná, náhodně vytvořená země. Nevíte, kde leží moře, hory ani soupeři – průzkum je tu důležitější než kdekoli jinde.',
    intro: 'vede svůj lid do země, kterou nikdo nezmapoval. Někde v ní hledají nový domov i další dva národy.',
    inPlace: 'v této zemi', over: 'Nad Neznámou zemí', ruinsWhere: 'kdesi mezi vámi a soupeři',
  },
}
export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]

export type TerrainId = 'ocean' | 'coast' | 'grass' | 'plains' | 'desert' | 'hills' | 'mountain'
export type ResourceId = 'wheat' | 'horses' | 'iron' | 'gold' | 'stone' | 'fish' | 'deer'
export type ImprovementId = 'farm' | 'mine' | 'pasture' | 'lumber'
export type NationId = 'aur' | 'khar' | 'thal' | 'sylv' | 'barb'
export type UnitId =
  | 'settler' | 'worker' | 'scout' | 'warrior' | 'spearman' | 'archer' | 'horseman'
  | 'swordsman' | 'catapult' | 'chariot' | 'axeman' | 'hoplite' | 'hunter' | 'galley' | 'trireme'
export type BuildingId =
  | 'monument' | 'granary' | 'workshop' | 'market' | 'library' | 'walls' | 'barracks'
  | 'temple' | 'aqueduct' | 'academy' | 'court' | 'harbor' | 'wonder'
export type TechId =
  | 'agriculture' | 'husbandry' | 'mining' | 'archery'
  | 'pottery' | 'bronze' | 'writing' | 'wheel' | 'masonry' | 'forestry'
  | 'riding' | 'iron' | 'currency' | 'mysticism' | 'tactics' | 'construction'
  | 'math' | 'philosophy' | 'law' | 'irrigation'
  | 'astronomy' | 'sailing' | 'navigation'

export interface Yields { food: number; prod: number; gold: number }

export interface TerrainDef { name: string; food: number; prod: number; gold: number; move: number; land: boolean; passable: boolean; defense: number }
export const TERRAIN: Record<TerrainId, TerrainDef> = {
  ocean: { name: 'Oceán', food: 1, prod: 0, gold: 0, move: 1, land: false, passable: false, defense: 0 },
  coast: { name: 'Pobřežní vody', food: 1, prod: 0, gold: 1, move: 1, land: false, passable: false, defense: 0 },
  grass: { name: 'Louky', food: 2, prod: 0, gold: 0, move: 1, land: true, passable: true, defense: 0 },
  plains: { name: 'Pláně', food: 1, prod: 1, gold: 0, move: 1, land: true, passable: true, defense: 0 },
  desert: { name: 'Poušť', food: 0, prod: 0, gold: 0, move: 1, land: true, passable: true, defense: 0 },
  hills: { name: 'Pahorkatina', food: 0, prod: 2, gold: 0, move: 2, land: true, passable: true, defense: 0.25 },
  mountain: { name: 'Hory', food: 0, prod: 0, gold: 0, move: 9, land: true, passable: false, defense: 0 },
}

export interface ResourceDef { name: string; food: number; prod: number; gold: number; improvement: ImprovementId | null; tech?: TechId; strategic?: boolean }
export const RESOURCES: Record<ResourceId, ResourceDef> = {
  wheat: { name: 'Obilí', food: 1, prod: 0, gold: 0, improvement: 'farm' },
  horses: { name: 'Koně', food: 0, prod: 1, gold: 0, improvement: 'pasture', strategic: true },
  iron: { name: 'Železo', food: 0, prod: 1, gold: 0, improvement: 'mine', tech: 'bronze', strategic: true },
  gold: { name: 'Zlato', food: 0, prod: 0, gold: 2, improvement: 'mine' },
  stone: { name: 'Kámen', food: 0, prod: 1, gold: 0, improvement: 'mine' },
  fish: { name: 'Ryby', food: 2, prod: 0, gold: 0, improvement: null },
  deer: { name: 'Zvěř', food: 1, prod: 0, gold: 0, improvement: 'pasture' },
}

export interface ImprovementDef { name: string; verb: string; turns: number; tech: TechId; food: number; prod: number; gold: number }
export const IMPROVEMENTS: Record<ImprovementId, ImprovementDef> = {
  farm: { name: 'Farma', verb: 'Postavit farmu', turns: 4, tech: 'agriculture', food: 1, prod: 0, gold: 0 },
  mine: { name: 'Důl', verb: 'Vyhloubit důl', turns: 5, tech: 'mining', food: 0, prod: 1, gold: 0 },
  pasture: { name: 'Ohrada', verb: 'Postavit ohradu', turns: 4, tech: 'husbandry', food: 1, prod: 1, gold: 0 },
  lumber: { name: 'Pila', verb: 'Postavit pilu', turns: 4, tech: 'forestry', food: 0, prod: 1, gold: 0 },
}

/** Tradice: trvalé výhody, které si národ vybírá za nastřádanou kulturu. */
export type TraditionId = 'craft' | 'stores' | 'trade' | 'scribes' | 'feasts' | 'warrior' | 'militia' | 'builders' | 'settlers' | 'sea'
export const TRADITIONS: Record<TraditionId, { name: string; desc: string }> = {
  craft: { name: 'Řemeslné cechy', desc: '+1 výroba v každém městě.' },
  stores: { name: 'Společné sýpky', desc: '+1 jídlo v každém městě.' },
  trade: { name: 'Kupecké stezky', desc: '+2 zlato v každém městě.' },
  scribes: { name: 'Písařské školy', desc: '+1 věda v každém městě, s knihovnou +2.' },
  feasts: { name: 'Slavnosti', desc: '+2 kultura v každém městě – další tradice i hranice přijdou dřív.' },
  warrior: { name: 'Válečnický kodex', desc: '+10 % síly při útoku a nové vojenské jednotky začínají s 5 zkušenostmi.' },
  militia: { name: 'Domobrana', desc: '+25 % k obraně všech měst.' },
  builders: { name: 'Stavitelské bratrstvo', desc: 'Dělníci dokončí každou práci o tah dřív.' },
  settlers: { name: 'Osadnický duch', desc: 'Nově založená města začínají se 2 obyvateli.' },
  sea: { name: 'Námořní tradice', desc: 'Lodě i naloděné jednotky mají +1 pohyb.' },
}
export const TRADITION_IDS = Object.keys(TRADITIONS) as TraditionId[]
/** Kolik kultury stojí další tradice, když jich národ už má `n`. */
export const traditionCost = (n: number): number => 25 + 20 * n + 5 * n * n

/** Věky: do dalšího se vstupuje počtem objevených technologií. */
export const ERAS = [
  { name: 'Věk úsvitu', techs: 0 },
  { name: 'Bronzový věk', techs: 6 },
  { name: 'Železný věk', techs: 12 },
  { name: 'Klasický věk', techs: 18 },
]
export const GOLDEN_TURNS = 10

export const ROAD = { name: 'Cesta', verb: 'Postavit cestu', turns: 2, tech: 'wheel' as TechId }

export type PromoId = 'drill' | 'guard' | 'medic' | 'march'
export const PROMOS: Record<PromoId, { name: string; desc: string }> = {
  drill: { name: 'Výcvik', desc: '+15 % síly při útoku (zblízka i střelbou).' },
  guard: { name: 'Zocelení', desc: '+20 % síly při obraně.' },
  medic: { name: 'Ranhojič', desc: 'Při odpočinku se léčí o 10 životů za tah víc.' },
  march: { name: 'Pochodník', desc: '+1 pohyb.' },
}
export const PROMO_IDS = Object.keys(PROMOS) as PromoId[]
/** Zkušenosti potřebné na 1., 2. a 3. povýšení. */
export const XP_LEVELS = [10, 25, 45]

export interface UnitDef {
  name: string
  desc: string
  cost: number
  move: number
  str: number
  ranged?: number
  range?: number
  civilian?: boolean
  mounted?: boolean
  tech?: TechId
  needs?: ResourceId
  /** Unikátní jednotka: kterou běžnou nahrazuje a pro koho. */
  replaces?: UnitId
  nation?: NationId
  antiMounted?: boolean
  siege?: boolean
  ignoreTerrain?: boolean
  sight?: number
  /** Loď: pohybuje se jen po vodě. */
  naval?: boolean
  /** Loď smí na otevřený oceán. */
  ocean?: boolean
  /** Na co lze jednotku za zlato přezbrojit (první dostupná možnost). */
  upgrade?: UnitId[]
}

export const UNITS: Record<UnitId, UnitDef> = {
  settler: { name: 'Osadníci', desc: 'Založí nové město.', cost: 62, move: 2, str: 0, civilian: true },
  worker: { name: 'Dělníci', desc: 'Staví farmy, doly, ohrady a pily.', cost: 36, move: 2, str: 0, civilian: true },
  scout: { name: 'Zvěd', desc: 'Rychlý průzkumník, terén ho nezpomaluje.', cost: 22, move: 3, str: 5, ignoreTerrain: true, sight: 3, upgrade: ['horseman'] },
  warrior: { name: 'Válečník', desc: 'Základní pěchota.', cost: 28, move: 2, str: 8, upgrade: ['swordsman', 'spearman'] },
  spearman: { name: 'Kopiník', desc: 'Pěchota, +50 % proti jízdě.', cost: 42, move: 2, str: 11, tech: 'bronze', antiMounted: true, upgrade: ['swordsman'] },
  archer: { name: 'Lučištník', desc: 'Střílí na 2 pole, v boji zblízka slabý.', cost: 40, move: 2, str: 5, ranged: 8, range: 2, tech: 'archery' },
  horseman: { name: 'Jezdec', desc: 'Rychlá jízda. Vyžaduje koně.', cost: 58, move: 4, str: 12, mounted: true, tech: 'riding', needs: 'horses' },
  swordsman: { name: 'Šermíř', desc: 'Těžká pěchota. Vyžaduje železo.', cost: 62, move: 2, str: 15, tech: 'iron', needs: 'iron' },
  catapult: { name: 'Katapult', desc: 'Obléhací stroj, dvojnásobný účinek proti městům.', cost: 72, move: 2, str: 4, ranged: 9, range: 2, tech: 'math', siege: true },
  chariot: { name: 'Válečný vůz', desc: 'Rychlý střelecký vůz. Nepotřebuje koně.', cost: 54, move: 4, str: 7, ranged: 9, range: 2, mounted: true, tech: 'riding', replaces: 'horseman', nation: 'aur' },
  axeman: { name: 'Sekerník', desc: 'Silnější než šermíř a nepotřebuje železo.', cost: 58, move: 2, str: 16, tech: 'iron', replaces: 'swordsman', nation: 'khar' },
  hoplite: { name: 'Hoplít', desc: 'Odolná falanga, +50 % proti jízdě.', cost: 42, move: 2, str: 13, tech: 'bronze', antiMounted: true, replaces: 'spearman', nation: 'thal' },
  hunter: { name: 'Lovec', desc: 'Rychlý lučištník s delším rozhledem.', cost: 40, move: 3, str: 6, ranged: 9, range: 2, tech: 'archery', replaces: 'archer', nation: 'sylv', sight: 3 },
  galley: { name: 'Galéra', desc: 'Válečná loď pro boj zblízka. Pluje jen po pobřežních vodách, útočí na lodě a naloděné jednotky.', cost: 46, move: 4, str: 11, tech: 'sailing', naval: true, upgrade: ['trireme'] },
  trireme: { name: 'Triéra', desc: 'Těžká loď se střelci: střílí na 2 pole, i na břeh a na města. Smí na oceán.', cost: 76, move: 5, str: 12, ranged: 11, range: 2, tech: 'navigation', naval: true, ocean: true, sight: 3 },
}

export interface BuildingDef { name: string; desc: string; cost: number; tech?: TechId; maint: number }
export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  monument: { name: 'Monument', desc: '+2 kultura (rychlejší růst hranic).', cost: 30, maint: 0 },
  granary: { name: 'Sýpka', desc: '+2 jídlo.', cost: 48, tech: 'pottery', maint: 1 },
  workshop: { name: 'Dílna', desc: '+2 výroba.', cost: 60, tech: 'wheel', maint: 1 },
  market: { name: 'Tržiště', desc: '+2 zlato a +25 % zlata města.', cost: 66, tech: 'currency', maint: 0 },
  library: { name: 'Knihovna', desc: '+2 věda a +1 věda za každé 2 obyvatele.', cost: 58, tech: 'writing', maint: 1 },
  walls: { name: 'Hradby', desc: '+50 % obrana města a +60 životů.', cost: 50, tech: 'masonry', maint: 0 },
  barracks: { name: 'Kasárna', desc: 'Nové jednotky jsou veteráni (+15 % síla).', cost: 52, tech: 'tactics', maint: 1 },
  temple: { name: 'Chrám', desc: '+3 kultura, +1 zlato.', cost: 56, tech: 'mysticism', maint: 0 },
  aqueduct: { name: 'Akvadukt', desc: 'Po růstu zůstane městu 40 % zásob jídla.', cost: 78, tech: 'construction', maint: 1 },
  academy: { name: 'Akademie', desc: '+3 věda a +25 % vědy města.', cost: 88, tech: 'philosophy', maint: 1 },
  court: { name: 'Soudní dvůr', desc: '+4 zlato.', cost: 70, tech: 'law', maint: 0 },
  harbor: { name: 'Přístav', desc: '+1 jídlo z každého obdělávaného vodního pole a +2 zlato. Jen v pobřežním městě.', cost: 54, tech: 'sailing', maint: 1 },
  wonder: { name: 'Sluneční chrám', desc: 'Div světa. Kdo jej dostaví první, vyhrává misi.', cost: 300, tech: 'astronomy', maint: 0 },
}

export interface TechDef { name: string; tier: number; row: number; cost: number; req: TechId[]; unlocks: string }
const C = [0, 20, 42, 78, 125, 190]
export const TECHS: Record<TechId, TechDef> = {
  agriculture: { name: 'Zemědělství', tier: 1, row: 0, cost: C[1], req: [], unlocks: 'Farmy' },
  husbandry: { name: 'Chov zvířat', tier: 1, row: 1, cost: C[1], req: [], unlocks: 'Ohrady (koně, zvěř)' },
  mining: { name: 'Těžba', tier: 1, row: 2, cost: C[1], req: [], unlocks: 'Doly' },
  archery: { name: 'Lukostřelba', tier: 1, row: 3, cost: C[1], req: [], unlocks: 'Lučištník' },
  sailing: { name: 'Plavba', tier: 1, row: 4, cost: C[1], req: [], unlocks: 'Galéra, přístav, nalodění na pobřežní vody' },
  navigation: { name: 'Navigace', tier: 2, row: 6, cost: 70, req: ['sailing'], unlocks: 'Triéra, plavba přes oceán' },
  pottery: { name: 'Hrnčířství', tier: 2, row: 0, cost: C[2], req: ['agriculture'], unlocks: 'Sýpka' },
  wheel: { name: 'Kolo', tier: 2, row: 1, cost: C[2], req: ['husbandry'], unlocks: 'Dílna, cesty' },
  bronze: { name: 'Bronz', tier: 2, row: 2, cost: C[2], req: ['mining'], unlocks: 'Kopiník, odhalí železo' },
  masonry: { name: 'Zdivo', tier: 2, row: 3, cost: C[2], req: ['mining'], unlocks: 'Hradby' },
  forestry: { name: 'Dřevařství', tier: 2, row: 4, cost: C[2], req: ['archery'], unlocks: 'Pily' },
  writing: { name: 'Písmo', tier: 2, row: 5, cost: C[2], req: ['pottery'], unlocks: 'Knihovna' },
  riding: { name: 'Jezdectví', tier: 3, row: 1, cost: C[3], req: ['wheel'], unlocks: 'Jezdec' },
  iron: { name: 'Železo', tier: 3, row: 2, cost: C[3], req: ['bronze'], unlocks: 'Šermíř' },
  tactics: { name: 'Válečnictví', tier: 3, row: 3, cost: C[3], req: ['bronze', 'archery'], unlocks: 'Kasárna' },
  construction: { name: 'Stavitelství', tier: 3, row: 4, cost: C[3], req: ['masonry', 'wheel'], unlocks: 'Akvadukt' },
  mysticism: { name: 'Mystika', tier: 3, row: 0, cost: C[3], req: ['pottery'], unlocks: 'Chrám' },
  currency: { name: 'Měna', tier: 3, row: 5, cost: C[3], req: ['writing'], unlocks: 'Tržiště' },
  math: { name: 'Matematika', tier: 4, row: 3, cost: C[4], req: ['writing', 'wheel'], unlocks: 'Katapult' },
  philosophy: { name: 'Filosofie', tier: 4, row: 0, cost: C[4], req: ['mysticism', 'writing'], unlocks: 'Akademie' },
  law: { name: 'Zákoník', tier: 4, row: 5, cost: C[4], req: ['currency'], unlocks: 'Soudní dvůr' },
  irrigation: { name: 'Zavlažování', tier: 4, row: 4, cost: C[4], req: ['construction', 'agriculture'], unlocks: 'Farmy +1 jídlo' },
  astronomy: { name: 'Astronomie', tier: 5, row: 2, cost: C[5], req: ['philosophy', 'math'], unlocks: 'Div: Sluneční chrám' },
}
export const TECH_IDS = Object.keys(TECHS) as TechId[]
export const UNIT_IDS = Object.keys(UNITS) as UnitId[]
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[]

export interface NationDef {
  name: string
  adjective: string
  leader: string
  title: string
  color: number
  colorDark: number
  css: string
  trait: string
  traitDesc: string
  unique: UnitId
  lore: string
  cities: string[]
}

export const NATIONS: Record<NationId, NationDef> = {
  aur: {
    name: 'Aurané', adjective: 'auranský', leader: 'Nefira Zlatooká', title: 'Dcera slunce',
    color: 0xf2c230, colorDark: 0xb8791e, css: '#f2c230',
    trait: 'Dar řeky', traitDesc: 'Farmy dávají +1 jídlo a města potřebují k růstu o 15 % méně jídla.',
    unique: 'chariot',
    lore: 'Lid z říčních niv, který měří čas podle záplav a slunce. Jejich města rostou rychleji než kterákoli jiná.',
    cities: ['Aur-Sethet', 'Nehabu', 'Tamarit', 'Sehem', 'Iunet', 'Kepra', 'Meruat', 'Hatanu'],
  },
  khar: {
    name: 'Kharové', adjective: 'kharský', leader: 'Borgun Železná pěst', title: 'Náčelník Devíti štítů',
    color: 0xd6453d, colorDark: 0x8a2433, css: '#e0554d',
    trait: 'Synové hor', traitDesc: 'Pahorkatina nezpomaluje pohyb, doly dávají +1 výrobu a v kopcích bojují o 15 % lépe.',
    unique: 'axeman',
    lore: 'Horalé z průsmyků, kováři a nájezdníci. Co nevykutají ze skály, to si vezmou sekerou.',
    cities: ['Khar-Dum', 'Grimvar', 'Skaldheim', 'Torvak', 'Uldren', 'Brakka', 'Durnholt', 'Varguz'],
  },
  thal: {
    name: 'Thalassové', adjective: 'thalasský', leader: 'Meliton Výmluvný', title: 'Archón přístavů',
    color: 0x3aa0d8, colorDark: 0x235a94, css: '#4bb0e8',
    trait: 'Vládci vln', traitDesc: 'Začínají s Plavbou. Pobřežní vody dávají +1 zlato, lodě mají +1 pohyb a rodí se zkušené, naloděné jednotky plují rychleji a brání se dvojnásob. Nákup za zlato je o 30 % levnější.',
    unique: 'hoplite',
    lore: 'Kupci a mořeplavci z bílých přístavů. Kde jiní vidí konec světa, oni vidí cestu – a svá města stavějí tam, kde kotví lodě.',
    cities: ['Thalassa', 'Korinea', 'Myrena', 'Pelagos', 'Aigion', 'Delphara', 'Naxira', 'Halike'],
  },
  sylv: {
    name: 'Sylvané', adjective: 'sylvanský', leader: 'Ysmera Tichá', title: 'Strážkyně Nočního hvozdu',
    color: 0xa05ad6, colorDark: 0x5f2f94, css: '#b872ea',
    trait: 'Lesní stezky', traitDesc: 'Les nezpomaluje pohyb, lesní pole dávají +1 výrobu a v lese se brání o 25 % lépe.',
    unique: 'hunter',
    lore: 'Lid Nočního hvozdu, lovci pod fialovými prapory. Les je jejich hradbou i zbrojnicí.',
    cities: ['Sylvaren', 'Elowen', 'Mirthal', 'Nyvara', 'Caelwood', 'Thornhal', 'Lunaris', 'Verdan'],
  },
  barb: {
    name: 'Barbaři', adjective: 'barbarský', leader: '', title: '',
    color: 0x5a5a66, colorDark: 0x2c2c36, css: '#8a8a96',
    trait: '', traitDesc: '', unique: 'warrior', lore: '', cities: [],
  },
}
export const PLAYABLE: NationId[] = ['aur', 'khar', 'thal', 'sylv']

export type Difficulty = 'easy' | 'normal' | 'hard'
export interface DifficultyDef { name: string; desc: string; aiMult: number; barbEvery: number; aiAggro: number; aiExtra: number }
export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: { name: 'Lehká', desc: 'Soupeři jsou pomalejší a mírumilovnější, barbaři řidší.', aiMult: 0.75, barbEvery: 12, aiAggro: 0.6, aiExtra: 0 },
  normal: { name: 'Střední', desc: 'Vyrovnaná hra.', aiMult: 1.0, barbEvery: 9, aiAggro: 1.0, aiExtra: 0 },
  hard: { name: 'Těžká', desc: 'Soupeři mají výhodu ve výrobě i vědě a rádi útočí.', aiMult: 1.3, barbEvery: 7, aiAggro: 1.4, aiExtra: 1 },
}

/** Jednotka, kterou národ skutečně staví místo běžné (unikátní náhrada). */
export function unitFor(nation: NationId, base: UnitId): UnitId {
  for (const id of UNIT_IDS) {
    const d = UNITS[id]
    if (d.replaces === base && d.nation === nation) return id
  }
  return base
}
