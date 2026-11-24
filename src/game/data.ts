// Herní data: terén, suroviny, jednotky, budovy, technologie, národy.
// Čistá data bez závislosti na Phaseru.

export type ScenarioId = 'valley' | 'islands' | 'random'
export interface ScenarioDef { name: string; short: string; desc: string; intro: string; inPlace: string; over: string; ruinsWhere: string }
export const SCENARIOS: Record<ScenarioId, ScenarioDef> = {
  valley: {
    name: 'Údolí Starého trůnu', short: 'Údolí', desc: 'Ručně navržená mapa: jeden kontinent, úrodné kouty oddělené horami s průsmyky, ruiny uprostřed. Vyvážená mise pro první hru; ve kterém koutě začnete, je pokaždé jiné.',
    intro: 'přivádí svůj lid do jednoho z úrodných koutů údolí. Za horami se ale usazují další národy se stejným cílem.',
    inPlace: 'v Údolí', over: 'Nad Údolím Starého trůnu', ruinsWhere: 'uprostřed údolí',
  },
  islands: {
    name: 'Souostroví Sedmi větrů', short: 'Souostroví', desc: 'Každý národ začíná na jednom z velkých ostrovů (pokaždé na jiném) a všichni už umějí plout. K ruinám, k soupeřům i na menší ostrovy se dostanete jen po moři; piráti tu mají žně.',
    intro: 'přistává se svým lidem na jednom z velkých ostrovů. Na dalších se usazují soupeři a o prostřední ostrov s ruinami se strhne závod po moři.',
    inPlace: 'v Souostroví', over: 'Nad Souostrovím Sedmi větrů', ruinsWhere: 'na prostředním ostrově',
  },
  random: {
    name: 'Neznámá země', short: 'Neznámá země', desc: 'Pokaždé jiná, náhodně vytvořená země. Nevíte, kde leží moře, hory ani soupeři – průzkum je tu důležitější než kdekoli jinde.',
    intro: 'vede svůj lid do země, kterou nikdo nezmapoval. Někde v ní hledají nový domov i další národy.',
    inPlace: 'v této zemi', over: 'Nad Neznámou zemí', ruinsWhere: 'kdesi mezi vámi a soupeři',
  },
}
export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[]

export type TerrainId = 'ocean' | 'coast' | 'grass' | 'plains' | 'desert' | 'hills' | 'mountain'
export type ResourceId = 'wheat' | 'horses' | 'iron' | 'gold' | 'stone' | 'fish' | 'deer'
export type ImprovementId = 'farm' | 'mine' | 'pasture' | 'lumber'
export type NationId = 'aur' | 'khar' | 'thal' | 'sylv' | 'tark' | 'zahi' | 'morv' | 'lume' | 'barb'
export type UnitId =
  | 'settler' | 'worker' | 'scout' | 'warrior' | 'spearman' | 'archer' | 'horseman'
  | 'swordsman' | 'catapult' | 'chariot' | 'axeman' | 'hoplite' | 'hunter' | 'galley' | 'trireme'
  | 'manatarms' | 'knight' | 'trebuchet' | 'ram'
  | 'raider' | 'camel' | 'ballista' | 'templar'
export type BuildingId =
  | 'monument' | 'granary' | 'workshop' | 'market' | 'library' | 'walls' | 'barracks'
  | 'temple' | 'aqueduct' | 'academy' | 'court' | 'harbor' | 'bastion' | 'bank' | 'wonder'
export type TechId =
  | 'agriculture' | 'husbandry' | 'mining' | 'archery'
  | 'pottery' | 'bronze' | 'writing' | 'wheel' | 'masonry' | 'forestry'
  | 'riding' | 'iron' | 'currency' | 'mysticism' | 'tactics' | 'construction'
  | 'math' | 'philosophy' | 'law' | 'irrigation'
  | 'astronomy' | 'sailing' | 'navigation'
  | 'steel' | 'engineering' | 'chivalry' | 'siegecraft' | 'banking'

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
  { name: 'Věk rytířů', techs: 24 },
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
  /** Beranidlo: samo neútočí, ale pěchotě útočící na město, u kterého stojí, přidává sílu. */
  ram?: boolean
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
  horseman: { name: 'Jezdec', desc: 'Rychlá jízda. Vyžaduje koně.', cost: 58, move: 4, str: 12, mounted: true, tech: 'riding', needs: 'horses', upgrade: ['knight'] },
  swordsman: { name: 'Šermíř', desc: 'Těžká pěchota. Vyžaduje železo.', cost: 62, move: 2, str: 15, tech: 'iron', needs: 'iron', upgrade: ['manatarms'] },
  catapult: { name: 'Katapult', desc: 'Obléhací stroj: trojnásobný účinek proti městům, proti jednotkám poloviční.', cost: 72, move: 2, str: 4, ranged: 9, range: 2, tech: 'math', siege: true, upgrade: ['trebuchet'] },
  chariot: { name: 'Válečný vůz', desc: 'Rychlý střelecký vůz. Nepotřebuje koně.', cost: 54, move: 4, str: 7, ranged: 9, range: 2, mounted: true, tech: 'riding', replaces: 'horseman', nation: 'aur' },
  axeman: { name: 'Sekerník', desc: 'Silnější než šermíř a nepotřebuje železo.', cost: 58, move: 2, str: 16, tech: 'iron', replaces: 'swordsman', nation: 'khar', upgrade: ['manatarms'] },
  hoplite: { name: 'Hoplít', desc: 'Odolná falanga, +50 % proti jízdě.', cost: 42, move: 2, str: 13, tech: 'bronze', antiMounted: true, replaces: 'spearman', nation: 'thal' },
  raider: { name: 'Nájezdník', desc: 'Lehká stepní jízda: levnější a silnější než jezdec. Vyžaduje koně.', cost: 50, move: 4, str: 13, mounted: true, tech: 'riding', needs: 'horses', replaces: 'horseman', nation: 'tark', upgrade: ['knight'] },
  camel: { name: 'Velbloudí střelec', desc: 'Střelec v sedle: rychlejší než lučištník, zblízka slabý.', cost: 42, move: 3, str: 6, ranged: 8, range: 2, mounted: true, tech: 'archery', replaces: 'archer', nation: 'zahi' },
  ballista: { name: 'Balista', desc: 'Obléhací stroj s dostřelem 3 pole: trojnásobný účinek proti městům, proti jednotkám poloviční.', cost: 76, move: 2, str: 4, ranged: 9, range: 3, tech: 'math', siege: true, replaces: 'catapult', nation: 'morv', upgrade: ['trebuchet'] },
  templar: { name: 'Chrámová stráž', desc: 'Pěchota místo válečníka: na vlastním území se brání o 25 % lépe.', cost: 30, move: 2, str: 9, upgrade: ['swordsman', 'spearman'], replaces: 'warrior', nation: 'lume' },
  hunter: { name: 'Lovec', desc: 'Rychlý lučištník s delším rozhledem.', cost: 40, move: 3, str: 6, ranged: 9, range: 2, tech: 'archery', replaces: 'archer', nation: 'sylv', sight: 3 },
  ram: { name: 'Beranidlo', desc: 'Samo neútočí. Stojí-li hned u nepřátelského města, má vaše pěchota při útoku na to město +50 % síly a vaše jednotky hned u města +50 % obrany proti odvetě i střelbě z hradeb.', cost: 40, move: 2, str: 4, tech: 'bronze', siege: true, ram: true },
  manatarms: { name: 'Zbrojnoš', desc: 'Pěchota v plné zbroji, nejsilnější v boji zblízka. Vyžaduje železo.', cost: 84, move: 2, str: 20, tech: 'steel', needs: 'iron' },
  knight: { name: 'Rytíř', desc: 'Těžká jízda: rychlá a silná. Vyžaduje koně.', cost: 88, move: 4, str: 18, mounted: true, tech: 'chivalry', needs: 'horses' },
  trebuchet: { name: 'Trebuchet', desc: 'Těžký obléhací stroj s dostřelem 3 pole: trojnásobný účinek proti městům, proti jednotkám poloviční.', cost: 98, move: 2, str: 5, ranged: 13, range: 3, tech: 'siegecraft', siege: true },
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
  walls: { name: 'Hradby', desc: '+40 % obrana města a +60 životů.', cost: 50, tech: 'masonry', maint: 0 },
  barracks: { name: 'Kasárna', desc: 'Nové jednotky jsou veteráni (+15 % síla).', cost: 52, tech: 'tactics', maint: 1 },
  temple: { name: 'Chrám', desc: '+3 kultura, +1 zlato.', cost: 56, tech: 'mysticism', maint: 0 },
  aqueduct: { name: 'Akvadukt', desc: 'Po růstu zůstane městu 40 % zásob jídla.', cost: 78, tech: 'construction', maint: 1 },
  academy: { name: 'Akademie', desc: '+3 věda a +25 % vědy města.', cost: 88, tech: 'philosophy', maint: 1 },
  court: { name: 'Soudní dvůr', desc: '+4 zlato.', cost: 70, tech: 'law', maint: 0 },
  harbor: { name: 'Přístav', desc: '+1 jídlo z každého obdělávaného vodního pole a +2 zlato. Jen v pobřežním městě.', cost: 54, tech: 'sailing', maint: 1 },
  bastion: { name: 'Bašty', desc: 'Dalších +25 % obrana města a +40 životů. Vyžadují hradby.', cost: 84, tech: 'engineering', maint: 1 },
  bank: { name: 'Banka', desc: '+3 zlato a +20 % zlata města.', cost: 92, tech: 'banking', maint: 0 },
  wonder: { name: 'Sluneční chrám', desc: 'Div světa. Kdo jej dostaví první a udrží jeho město 15 tahů, vyhrává misi.', cost: 300, tech: 'astronomy', maint: 0 },
}

export interface TechDef { name: string; tier: number; row: number; cost: number; req: TechId[]; unlocks: string }
const C = [0, 20, 42, 78, 125, 190, 270]
export const TECHS: Record<TechId, TechDef> = {
  agriculture: { name: 'Zemědělství', tier: 1, row: 0, cost: C[1], req: [], unlocks: 'Farmy' },
  husbandry: { name: 'Chov zvířat', tier: 1, row: 1, cost: C[1], req: [], unlocks: 'Ohrady (koně, zvěř)' },
  mining: { name: 'Těžba', tier: 1, row: 2, cost: C[1], req: [], unlocks: 'Doly' },
  archery: { name: 'Lukostřelba', tier: 1, row: 3, cost: C[1], req: [], unlocks: 'Lučištník' },
  sailing: { name: 'Plavba', tier: 1, row: 4, cost: C[1], req: [], unlocks: 'Galéra, přístav, nalodění na pobřežní vody' },
  navigation: { name: 'Navigace', tier: 3, row: 6, cost: C[3], req: ['sailing'], unlocks: 'Triéra, plavba přes oceán' },
  pottery: { name: 'Hrnčířství', tier: 2, row: 0, cost: C[2], req: ['agriculture'], unlocks: 'Sýpka' },
  wheel: { name: 'Kolo', tier: 2, row: 1, cost: C[2], req: ['husbandry'], unlocks: 'Dílna, cesty' },
  bronze: { name: 'Bronz', tier: 2, row: 2, cost: C[2], req: ['mining'], unlocks: 'Kopiník, beranidlo, odhalí železo' },
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
  astronomy: { name: 'Astronomie', tier: 6, row: 1, cost: C[6], req: ['philosophy', 'engineering'], unlocks: 'Div: Sluneční chrám' },
  steel: { name: 'Ocel', tier: 5, row: 2, cost: C[5], req: ['iron', 'tactics'], unlocks: 'Zbrojnoš' },
  engineering: { name: 'Inženýrství', tier: 5, row: 3, cost: C[5], req: ['math', 'construction'], unlocks: 'Bašty' },
  chivalry: { name: 'Rytířství', tier: 6, row: 2, cost: C[6], req: ['steel', 'riding'], unlocks: 'Rytíř' },
  siegecraft: { name: 'Obléhání', tier: 6, row: 3, cost: C[6], req: ['engineering', 'steel'], unlocks: 'Trebuchet' },
  banking: { name: 'Bankovnictví', tier: 6, row: 5, cost: C[6], req: ['law', 'math'], unlocks: 'Banka' },
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
  /** Tábor národa při losování soupeřů: střídají se výbojní a stavitelé. */
  temper: 'aggressive' | 'builder'
  /** Povaha národa, když ho vede počítač. */
  persona: PersonaId
}

/** Povahy soupeřů vedených počítačem. */
export type PersonaId = 'aggressive' | 'builder' | 'expansionist' | 'scholar' | 'opportunist' | 'defender'

export interface PersonaDef {
  name: string
  /** Věta do diplomacie a krátké označení do úvodu mise. */
  desc: string
  label: string
  research: TechId[]
  build: BuildingId[]
  /** Dává přednost bojovým tradicím a povýšením. */
  martial: boolean
  /** Kolik měst chce založit a do kterého tahu ještě posílá osadníky. */
  cities: number
  settleUntil: number
  /** Cílová velikost vojska: 1,6 × měst + armyBase + tah / armyPace. */
  armyBase: number
  armyPace: number
  /** Zbrojí na cílovou velikost i v míru. */
  alwaysArm: boolean
  /** Staví Sluneční chrám i za války. */
  wonderInWar: boolean
  /** Hradby staví i bez ohrožení. */
  wallsAlways: boolean
  /** Zlatá rezerva, pod kterou nenakupuje. */
  reserve: number
  /** Kolik zdravých polních jednotek potřebuje, než vytáhne na nepřátelské město. */
  marchAt: number
  /** Vyhlášení války: od kterého tahu, s kolika jednotkami, při jakém poměru sil a s jakou šancí za tah. */
  warFrom: number
  warMil: number
  warRatio: number
  warChance: number
  /** Šance za tah, že napadne národ, který už válčí s někým jiným (0 = nikdy). */
  dogpile: number
  /** Mír hledá, když je jeho síla pod tímto násobkem soupeřovy, nebo po tolika tazích války. */
  peaceRatio: number
  peaceAfter: number
}

const R_BUILDER: TechId[] = ['agriculture', 'pottery', 'mining', 'husbandry', 'archery', 'writing', 'bronze', 'wheel', 'mysticism', 'masonry', 'currency', 'philosophy', 'math', 'construction', 'engineering', 'astronomy', 'sailing', 'forestry', 'law', 'banking', 'iron', 'tactics', 'irrigation', 'steel', 'riding', 'navigation', 'siegecraft', 'chivalry']
const R_WAR: TechId[] = ['mining', 'archery', 'agriculture', 'bronze', 'husbandry', 'pottery', 'wheel', 'writing', 'math', 'iron', 'riding', 'tactics', 'masonry', 'steel', 'construction', 'chivalry', 'engineering', 'siegecraft', 'sailing', 'forestry', 'navigation', 'mysticism', 'currency', 'irrigation', 'philosophy', 'law', 'banking', 'astronomy']
const B_BUILDER: BuildingId[] = ['monument', 'granary', 'library', 'workshop', 'temple', 'market', 'academy', 'harbor', 'aqueduct', 'court', 'bank', 'walls', 'barracks', 'bastion']
const B_WAR: BuildingId[] = ['monument', 'granary', 'barracks', 'workshop', 'library', 'walls', 'market', 'temple', 'aqueduct', 'academy', 'court', 'bastion', 'bank', 'harbor']

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  // Dobyvatel: brzy zbrojí a napadá slabší sousedy.
  aggressive: {
    name: 'Dobyvatel', desc: 'Výbojný národ: zbrojí od začátku a slabšího souseda napadne.', label: 'výbojný sok',
    research: R_WAR, build: B_WAR, martial: true, cities: 4, settleUntil: 85, armyBase: 3, armyPace: 18, alwaysArm: true, wonderInWar: false, wallsAlways: true,
    reserve: 60, marchAt: 3, warFrom: 24, warMil: 4, warRatio: 1.3, warChance: 0.22, dogpile: 0, peaceRatio: 0.9, peaceAfter: 26,
  },
  // Stavitel: rozvíjí města a míří ke Slunečnímu chrámu; válčí jen s drtivou převahou.
  builder: {
    name: 'Stavitel', desc: 'Národ stavitelů: rozvíjí města a míří ke Slunečnímu chrámu.', label: 'trpělivý stavitel',
    research: R_BUILDER, build: B_BUILDER, martial: false, cities: 5, settleUntil: 85, armyBase: 1, armyPace: 40, alwaysArm: false, wonderInWar: true, wallsAlways: false,
    reserve: 90, marchAt: 4, warFrom: 55, warMil: 5, warRatio: 2.0, warChance: 0.1, dogpile: 0, peaceRatio: 0.9, peaceAfter: 26,
  },
  // Osadník: zabere co nejvíc země a budovy dohání později.
  expansionist: {
    name: 'Osadník', desc: 'Rozpínavý národ: zakládá město za městem a zabírá volnou zemi.', label: 'neúnavný osadník',
    research: ['agriculture', 'pottery', 'husbandry', 'mining', 'wheel', 'archery', 'bronze', 'writing', 'masonry', 'currency', 'forestry', 'sailing', 'irrigation', 'construction', 'math', 'mysticism', 'iron', 'law', 'philosophy', 'banking', 'riding', 'tactics', 'navigation', 'astronomy', 'steel', 'engineering', 'chivalry', 'siegecraft'],
    build: ['granary', 'monument', 'workshop', 'market', 'library', 'walls', 'court', 'aqueduct', 'bank', 'temple', 'harbor', 'barracks', 'academy', 'bastion'],
    martial: false, cities: 8, settleUntil: 100, armyBase: 2, armyPace: 30, alwaysArm: true, wonderInWar: false, wallsAlways: false,
    reserve: 70, marchAt: 4, warFrom: 45, warMil: 5, warRatio: 1.6, warChance: 0.12, dogpile: 0, peaceRatio: 1.0, peaceAfter: 20,
  },
  // Učenec: věda a kultura především, malé vojsko, chrám staví i za války.
  scholar: {
    name: 'Učenec', desc: 'Národ učenců: žene vědu a kulturu, vojsko drží malé.', label: 'zahloubaný učenec',
    research: ['agriculture', 'pottery', 'writing', 'mysticism', 'mining', 'philosophy', 'husbandry', 'wheel', 'math', 'masonry', 'construction', 'engineering', 'currency', 'astronomy', 'archery', 'bronze', 'law', 'banking', 'irrigation', 'forestry', 'sailing', 'iron', 'tactics', 'steel', 'riding', 'navigation', 'siegecraft', 'chivalry'],
    build: ['library', 'monument', 'granary', 'temple', 'academy', 'workshop', 'market', 'aqueduct', 'walls', 'court', 'bank', 'harbor', 'barracks', 'bastion'],
    martial: false, cities: 4, settleUntil: 70, armyBase: 1, armyPace: 45, alwaysArm: false, wonderInWar: true, wallsAlways: false,
    reserve: 80, marchAt: 5, warFrom: 70, warMil: 6, warRatio: 2.5, warChance: 0.05, dogpile: 0, peaceRatio: 1.1, peaceAfter: 16,
  },
  // Vypočítavý: čeká na příležitost a vrhne se na toho, kdo už krvácí jinde; z prohrané války rychle couvne.
  opportunist: {
    name: 'Vypočítavý', desc: 'Vypočítavý národ: udeří, když soupeř válčí jinde, a z prohrané války rychle couvne.', label: 'vypočítavý soused',
    research: ['mining', 'agriculture', 'archery', 'pottery', 'bronze', 'husbandry', 'writing', 'wheel', 'math', 'iron', 'currency', 'masonry', 'riding', 'tactics', 'steel', 'mysticism', 'law', 'banking', 'chivalry', 'sailing', 'forestry', 'construction', 'engineering', 'siegecraft', 'philosophy', 'navigation', 'irrigation', 'astronomy'],
    build: ['monument', 'granary', 'workshop', 'barracks', 'market', 'library', 'walls', 'temple', 'court', 'bank', 'aqueduct', 'academy', 'bastion', 'harbor'],
    martial: true, cities: 5, settleUntil: 85, armyBase: 2, armyPace: 24, alwaysArm: true, wonderInWar: false, wallsAlways: false,
    reserve: 70, marchAt: 3, warFrom: 40, warMil: 4, warRatio: 1.7, warChance: 0.1, dogpile: 0.3, peaceRatio: 1.15, peaceAfter: 14,
  },
  // Obránce: sám nezačíná, ale města má za hradbami a s posádkou.
  defender: {
    name: 'Obránce', desc: 'Národ obránců: válku nezačíná, ale jeho města stojí za hradbami.', label: 'ostražitý obránce',
    research: ['mining', 'agriculture', 'archery', 'masonry', 'pottery', 'bronze', 'husbandry', 'writing', 'wheel', 'construction', 'math', 'engineering', 'iron', 'mysticism', 'currency', 'tactics', 'steel', 'philosophy', 'forestry', 'irrigation', 'law', 'astronomy', 'siegecraft', 'banking', 'riding', 'chivalry', 'sailing', 'navigation'],
    build: ['monument', 'walls', 'granary', 'workshop', 'barracks', 'library', 'bastion', 'temple', 'market', 'aqueduct', 'court', 'academy', 'bank', 'harbor'],
    martial: false, cities: 5, settleUntil: 85, armyBase: 3, armyPace: 30, alwaysArm: true, wonderInWar: true, wallsAlways: true,
    reserve: 80, marchAt: 6, warFrom: 9999, warMil: 99, warRatio: 99, warChance: 0, dogpile: 0, peaceRatio: 1.2, peaceAfter: 12,
  },
}
export const PERSONA_IDS = Object.keys(PERSONAS) as PersonaId[]

export const NATIONS: Record<NationId, NationDef> = {
  aur: {
    name: 'Aurané', adjective: 'auranský', leader: 'Nefira Zlatooká', title: 'Dcera slunce',
    color: 0xf2c230, colorDark: 0xb8791e, css: '#f2c230',
    trait: 'Dar řeky', traitDesc: 'Farmy dávají +1 jídlo a města potřebují k růstu o 15 % méně jídla.',
    unique: 'chariot',
    lore: 'Lid z říčních niv, který měří čas podle záplav a slunce. Jejich města rostou rychleji než kterákoli jiná.',
    cities: ['Aur-Sethet', 'Nehabu', 'Tamarit', 'Sehem', 'Iunet', 'Kepra', 'Meruat', 'Hatanu'], temper: 'builder', persona: 'builder',
  },
  khar: {
    name: 'Kharové', adjective: 'kharský', leader: 'Borgun Železná pěst', title: 'Náčelník Devíti štítů',
    color: 0xd6453d, colorDark: 0x8a2433, css: '#e0554d',
    trait: 'Synové hor', traitDesc: 'Pahorkatina nezpomaluje pohyb, doly dávají +1 výrobu a v kopcích bojují o 15 % lépe.',
    unique: 'axeman',
    lore: 'Horalé z průsmyků, kováři a nájezdníci. Co nevykutají ze skály, to si vezmou sekerou.',
    cities: ['Khar-Dum', 'Grimvar', 'Skaldheim', 'Torvak', 'Uldren', 'Brakka', 'Durnholt', 'Varguz'], temper: 'aggressive', persona: 'aggressive',
  },
  thal: {
    name: 'Thalassové', adjective: 'thalasský', leader: 'Meliton Výmluvný', title: 'Archón přístavů',
    color: 0x3aa0d8, colorDark: 0x235a94, css: '#4bb0e8',
    trait: 'Vládci vln', traitDesc: 'Začínají s Plavbou. Pobřežní vody dávají +1 zlato, lodě mají +1 pohyb a rodí se zkušené, naloděné jednotky plují rychleji a brání se dvojnásob. Nákup za zlato je o 30 % levnější.',
    unique: 'hoplite',
    lore: 'Kupci a mořeplavci z bílých přístavů. Kde jiní vidí konec světa, oni vidí cestu – a svá města stavějí tam, kde kotví lodě.',
    cities: ['Thalassa', 'Korinea', 'Myrena', 'Pelagos', 'Aigion', 'Delphara', 'Naxira', 'Halike'], temper: 'builder', persona: 'expansionist',
  },
  sylv: {
    name: 'Sylvané', adjective: 'sylvanský', leader: 'Ysmera Tichá', title: 'Strážkyně Nočního hvozdu',
    color: 0xa05ad6, colorDark: 0x5f2f94, css: '#b872ea',
    trait: 'Lesní stezky', traitDesc: 'Les nezpomaluje pohyb, lesní pole dávají +1 výrobu a v lese se brání o 25 % lépe.',
    unique: 'hunter',
    lore: 'Lid Nočního hvozdu, lovci pod fialovými prapory. Les je jejich hradbou i zbrojnicí.',
    cities: ['Sylvaren', 'Elowen', 'Mirthal', 'Nyvara', 'Caelwood', 'Thornhal', 'Lunaris', 'Verdan'], temper: 'aggressive', persona: 'opportunist',
  },
  tark: {
    name: 'Tarkové', adjective: 'tarkský', leader: 'Batu Rudý vítr', title: 'Chán Tisíce kopyt',
    color: 0xf08a2c, colorDark: 0xa8551a, css: '#f59a44',
    trait: 'Děti stepi', traitDesc: 'Jízdní jednotky mají +1 pohyb a ohrady dávají +1 jídlo.',
    unique: 'raider',
    lore: 'Jezdci z nekonečných plání, kteří se rodí v sedle. Jejich stany stojí tam, kde se pasou stáda, a jejich hranice sahají tam, kam dojede kůň.',
    cities: ['Tark-Ordu', 'Sarai', 'Kumyz', 'Altan', 'Borte', 'Ulgen', 'Kharkol', 'Temuz'], temper: 'aggressive', persona: 'aggressive',
  },
  zahi: {
    name: 'Zahirové', adjective: 'zahirský', leader: 'Samira Hvězdná', title: 'Paní karavan',
    color: 0x2fc7a8, colorDark: 0x1a7f74, css: '#3fd7b8',
    trait: 'Karavanní stezky', traitDesc: 'Pouštní pole dávají +1 zlato a obchod se surovinami vynáší o 1 zlato za tah víc.',
    unique: 'camel',
    lore: 'Kupci z oáz, kteří čtou cestu ve hvězdách. Kde jiní vidí jen písek, oni vedou karavany a počítají zisk.',
    cities: ['Zahira', 'Qasr-Nur', 'Tamrit', 'Bahar', 'Sidrah', 'Mirzan', 'Wadiya', 'Ashkal'], temper: 'builder', persona: 'opportunist',
  },
  morv: {
    name: 'Morvané', adjective: 'morvanský', leader: 'Hradimír Kamenný', title: 'Strážce Bílé zdi',
    color: 0xe8e6d8, colorDark: 0x9a9788, css: '#eeeadc',
    trait: 'Kamenné základy', traitDesc: 'Budovy jsou o 15 % levnější, kámen dává +1 výrobu a města se brání o 25 % lépe.',
    unique: 'ballista',
    lore: 'Kameníci a stavitelé z bílých lomů. Nespěchají, ale co postaví, to stojí – a kdo se o jejich zdi opře, ten si vyláme zuby.',
    cities: ['Morvahrad', 'Bělá', 'Kamenec', 'Skalná', 'Vysoká Brána', 'Lomnice', 'Opuka', 'Starý Val'], temper: 'builder', persona: 'defender',
  },
  lume: {
    name: 'Lumenové', adjective: 'lumenský', leader: 'Iskra Vědoucí', title: 'Opatrovnice Tisíce svitků',
    color: 0xf06aa8, colorDark: 0xa83a70, css: '#f47fb6',
    trait: 'Světlo poznání', traitDesc: 'Knihovny a chrámy dávají +2 vědu a +1 kulturu.',
    unique: 'templar',
    lore: 'Učenci a mystici z klášterů na útesech. Věří, že říši neudrží meč, ale paměť – a tak zapisují všechno, i své nepřátele.',
    cities: ['Lumenar', 'Svitava', 'Auriel', 'Tichá Věž', 'Miralis', 'Noctua', 'Sedmihvězd', 'Elysar'], temper: 'builder', persona: 'scholar',
  },
  barb: {
    name: 'Barbaři', adjective: 'barbarský', leader: '', title: '',
    color: 0x5a5a66, colorDark: 0x2c2c36, css: '#8a8a96',
    trait: '', traitDesc: '', unique: 'warrior', lore: '', cities: [], temper: 'aggressive', persona: 'aggressive',
  },
}
export const PLAYABLE: NationId[] = ['aur', 'khar', 'thal', 'sylv', 'tark', 'zahi', 'morv', 'lume']
/** Nejvíc národů v jedné hře (bez barbarů). */
export const MAX_NATIONS = 8

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
