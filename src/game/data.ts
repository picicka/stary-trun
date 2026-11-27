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
export type ImprovementId = 'farm' | 'mine' | 'pasture' | 'lumber' | 'village' | 'fishery'
export type NationId = 'aur' | 'khar' | 'thal' | 'sylv' | 'tark' | 'zahi' | 'morv' | 'lume' | 'barb' | 'free'
export type UnitId =
  | 'settler' | 'worker' | 'scout' | 'warrior' | 'spearman' | 'archer' | 'horseman'
  | 'swordsman' | 'catapult' | 'chariot' | 'axeman' | 'hoplite' | 'hunter' | 'galley' | 'trireme'
  | 'manatarms' | 'knight' | 'trebuchet' | 'ram' | 'crossbow'
  | 'raider' | 'camel' | 'ballista' | 'templar'
export type BuildingId =
  | 'monument' | 'granary' | 'workshop' | 'market' | 'library' | 'walls' | 'barracks'
  | 'temple' | 'aqueduct' | 'academy' | 'court' | 'harbor' | 'bastion' | 'bank' | 'wonder'
  | 'caravanserai' | 'armory' | 'shipyard' | 'guildhall' | 'university' | 'amphitheater' | 'observatory' | 'sewer'
export type TechId =
  | 'agriculture' | 'husbandry' | 'mining' | 'archery'
  | 'pottery' | 'bronze' | 'writing' | 'wheel' | 'masonry' | 'forestry'
  | 'riding' | 'iron' | 'currency' | 'mysticism' | 'tactics' | 'construction'
  | 'math' | 'philosophy' | 'law' | 'irrigation'
  | 'astronomy' | 'sailing' | 'navigation'
  | 'steel' | 'engineering' | 'chivalry' | 'siegecraft' | 'banking'
  | 'fishing' | 'commerce' | 'armory' | 'shipbuilding' | 'guilds' | 'education' | 'architecture' | 'calendar' | 'empire'

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
  village: { name: 'Trhová ves', verb: 'Založit trhovou ves', turns: 5, tech: 'currency', food: 0, prod: 0, gold: 1 },
  fishery: { name: 'Loviště', verb: 'Zřídit loviště', turns: 4, tech: 'fishing', food: 1, prod: 0, gold: 0 },
}
/** Vymýcení lesa: les zmizí a nejbližší město dostane jednorázově výrobu. */
export const CLEAR = { name: 'Vymýcení lesa', verb: 'Vymýtit les', turns: 3, tech: 'bronze' as TechId, prod: 20 }
/** Oprava vypleněného vylepšení či cesty trvá polovinu původní doby. */
export const REPAIR = { name: 'Oprava', verb: 'Opravit' }
/** O kolik tahů déle trvá přestavba stojícího vylepšení na jiné. */
export const REPLACE_TURNS = 2
/** Kolik zlata přinese vyplenění pole. */
export const PILLAGE_GOLD = 10
/** Od této technologie dávají trhové vsi +1 zlato navíc ve městě spojeném s hlavním městem. */
export const LINK_TECH: TechId = 'commerce'

/** Tradice: trvalé výhody, které si národ vybírá za nastřádanou kulturu. Jsou ve čtyřech větvích; v každé se postupuje odshora. */
export type TraditionId =
  | 'militia' | 'warrior' | 'raiders' | 'campaign'
  | 'stores' | 'settlers' | 'builders' | 'craft'
  | 'scribes' | 'feasts' | 'chroniclers' | 'stargazers'
  | 'trade' | 'merchants' | 'sea' | 'fishers'
export type BranchId = 'war' | 'land' | 'lore' | 'trade'
export const BRANCHES: Record<BranchId, { name: string; desc: string }> = {
  war: { name: 'Válka', desc: 'Obrana měst, útok a kořist.' },
  land: { name: 'Země', desc: 'Jídlo, výroba, dělníci a nová města.' },
  lore: { name: 'Učenost', desc: 'Věda, kultura a hranice.' },
  trade: { name: 'Obchod a moře', desc: 'Zlato, vsi, lodě a rybolov.' },
}
export const BRANCH_IDS = Object.keys(BRANCHES) as BranchId[]
/** Pořadí v tomto zápisu je pořadí ve větvi. */
export const TRADITIONS: Record<TraditionId, { name: string; desc: string; branch: BranchId }> = {
  militia: { name: 'Domobrana', desc: '+25 % k obraně všech měst.', branch: 'war' },
  warrior: { name: 'Válečnický kodex', desc: '+10 % síly při útoku a nové vojenské jednotky začínají s 5 zkušenostmi.', branch: 'war' },
  raiders: { name: 'Kořistníci', desc: 'Plenění přináší dvojnásobek zlata a plenící jednotce vyléčí 15 životů.', branch: 'war' },
  campaign: { name: 'Tažení', desc: 'Odpočívající jednotky se mimo vlastní území léčí o 10 životů za tah rychleji.', branch: 'war' },
  stores: { name: 'Společné sýpky', desc: '+1 jídlo v každém městě.', branch: 'land' },
  settlers: { name: 'Osadnický duch', desc: 'Nově založená města začínají se 2 obyvateli.', branch: 'land' },
  builders: { name: 'Stavitelské bratrstvo', desc: 'Dělníci dokončí každou práci o tah dřív.', branch: 'land' },
  craft: { name: 'Řemeslné cechy', desc: '+1 výroba v každém městě.', branch: 'land' },
  scribes: { name: 'Písařské školy', desc: '+1 věda v každém městě, s knihovnou +2.', branch: 'lore' },
  feasts: { name: 'Slavnosti', desc: '+2 kultura v každém městě – další tradice i hranice přijdou dřív.', branch: 'lore' },
  chroniclers: { name: 'Kronikáři', desc: 'Další pole stojí města o čtvrtinu kultury méně.', branch: 'lore' },
  stargazers: { name: 'Hvězdáři', desc: '+1 věda v každém městě, s observatoří +3.', branch: 'lore' },
  trade: { name: 'Kupecké stezky', desc: '+2 zlato v každém městě.', branch: 'trade' },
  merchants: { name: 'Trhovci', desc: 'Každá trhová ves dává +1 zlato.', branch: 'trade' },
  sea: { name: 'Námořní tradice', desc: 'Lodě i naloděné jednotky mají +1 pohyb.', branch: 'trade' },
  fishers: { name: 'Rybáři', desc: 'Loviště dávají +1 jídlo a přístav +1 zlato.', branch: 'trade' },
}
export const TRADITION_IDS = Object.keys(TRADITIONS) as TraditionId[]
/** Tradice jedné větve v pořadí, v jakém se přijímají. */
export const branchOf = (b: BranchId): TraditionId[] => TRADITION_IDS.filter(t => TRADITIONS[t].branch === b)
/** Kolik kultury stojí další tradice, když jich národ už má `n`. Všechny se za hru stihnout nemají. */
export const traditionCost = (n: number): number => 30 + 30 * n + 12 * n * n

/** Věky: do dalšího se vstupuje počtem objevených technologií. */
export const ERAS = [
  { name: 'Věk úsvitu', techs: 0 },
  { name: 'Bronzový věk', techs: 6 },
  { name: 'Železný věk', techs: 12 },
  { name: 'Klasický věk', techs: 18 },
  { name: 'Věk rytířů', techs: 24 },
]
export const GOLDEN_TURNS = 10

/** Laditelné volby pro simulace (scripts/…): výchozí hodnoty = pravidla hry. */
export const TUNE = {
  /** Kolik cizích sídel je třeba k dobytí: 'majority' = nadpoloviční většina, 'third' = třetina (nejméně 1), 'half' = polovina zaokrouhlená nahoru. */
  seatNeed: 'majority' as 'majority' | 'third' | 'half',
  conquestTurns: 5,
  /** O kolik polí je pro počítač sídelní město lákavější cíl než obyčejné. */
  seatFocus: 8,
  /** Násobek tahu, od kterého povaha začíná válčit (menší = dřív), a násobek chuti válčit. */
  warFrom: 1,
  warChance: 1,
  /** Jednotky navíc pro bojovné povahy. */
  armyPlus: 0,
  /** Kdo ve válce vede, mír nenabízí. */
  keepWar: true,
  /** Dobyté město neztrácí obyvatele a zůstane mu víc životů. */
  softCapture: false,
  /** Padne-li sídlo, zbylá města národa se po tolika tazích vzdají dobyvateli (0 = vypnuto). */
  surrender: 0,
  /** Životy města bez hradeb a oprava za tah. */
  cityHp: 200,
  cityHeal: 10,
  /** Násobek síly, kterou počítač chce mít před tažením (1 = výchozí). */
  muster: 1,
}

/** Cesta: v lese a pahorkatině se staví déle; řeku překlene až most, který umí národ se Stavitelstvím. */
export const ROAD = { name: 'Cesta', verb: 'Postavit cestu', turns: 2, rough: 3, tech: 'wheel' as TechId, bridgeTech: 'construction' as TechId }

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
  /** Těžká pěchota: bonus proti kopiníkům. */
  antiSpear?: boolean
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
  worker: { name: 'Dělníci', desc: 'Vylepšují pole, stavějí cesty a opravují, co nepřítel vyplenil.', cost: 36, move: 2, str: 0, civilian: true },
  scout: { name: 'Zvěd', desc: 'Rychlý průzkumník, terén ho nezpomaluje.', cost: 22, move: 3, str: 5, ignoreTerrain: true, sight: 3, upgrade: ['horseman'] },
  warrior: { name: 'Válečník', desc: 'Základní pěchota.', cost: 28, move: 2, str: 8, upgrade: ['swordsman', 'spearman'] },
  spearman: { name: 'Kopiník', desc: 'Pěchota, +50 % proti jízdě.', cost: 42, move: 2, str: 11, tech: 'bronze', antiMounted: true, upgrade: ['swordsman'] },
  archer: { name: 'Lučištník', desc: 'Střílí na 2 pole, v boji zblízka slabý.', cost: 40, move: 2, str: 5, ranged: 8, range: 2, tech: 'archery', upgrade: ['crossbow'] },
  crossbow: { name: 'Kušník', desc: 'Těžký střelec: střílí na 2 pole a prorazí i zbroj.', cost: 68, move: 2, str: 8, ranged: 13, range: 2, tech: 'armory' },
  horseman: { name: 'Jezdec', desc: 'Rychlá jízda. Vyžaduje koně.', cost: 58, move: 4, str: 12, mounted: true, tech: 'riding', needs: 'horses', upgrade: ['knight'] },
  swordsman: { name: 'Šermíř', desc: 'Těžká pěchota. Vyžaduje železo. +25 % proti kopiníkům.', cost: 62, move: 2, str: 15, tech: 'iron', needs: 'iron', upgrade: ['manatarms'], antiSpear: true },
  catapult: { name: 'Katapult', desc: 'Obléhací stroj: trojnásobný účinek proti městům, proti jednotkám poloviční.', cost: 72, move: 2, str: 4, ranged: 9, range: 2, tech: 'math', siege: true, upgrade: ['trebuchet'] },
  chariot: { name: 'Válečný vůz', desc: 'Rychlý střelecký vůz. Nepotřebuje koně.', cost: 54, move: 4, str: 7, ranged: 9, range: 2, mounted: true, tech: 'riding', replaces: 'horseman', nation: 'aur' },
  axeman: { name: 'Sekerník', desc: 'Silnější než šermíř a nepotřebuje železo. +25 % proti kopiníkům.', cost: 58, move: 2, str: 16, tech: 'iron', replaces: 'swordsman', nation: 'khar', upgrade: ['manatarms'], antiSpear: true },
  hoplite: { name: 'Hoplít', desc: 'Odolná falanga, +50 % proti jízdě; spojení v šik či voj se brání o 25 % lépe.', cost: 42, move: 2, str: 13, tech: 'bronze', antiMounted: true, replaces: 'spearman', nation: 'thal' },
  raider: { name: 'Nájezdník', desc: 'Lehká stepní jízda: levnější a silnější než jezdec. Vyžaduje koně.', cost: 50, move: 4, str: 13, mounted: true, tech: 'riding', needs: 'horses', replaces: 'horseman', nation: 'tark', upgrade: ['knight'] },
  camel: { name: 'Velbloudí střelec', desc: 'Střelec v sedle: rychlejší než lučištník, zblízka slabý.', cost: 42, move: 3, str: 6, ranged: 8, range: 2, mounted: true, tech: 'archery', replaces: 'archer', nation: 'zahi', upgrade: ['crossbow'] },
  ballista: { name: 'Balista', desc: 'Obléhací stroj s dostřelem 3 pole: trojnásobný účinek proti městům, proti jednotkám poloviční.', cost: 76, move: 2, str: 4, ranged: 9, range: 3, tech: 'math', siege: true, replaces: 'catapult', nation: 'morv', upgrade: ['trebuchet'] },
  templar: { name: 'Chrámová stráž', desc: 'Pěchota místo válečníka: na vlastním území se brání o 25 % lépe.', cost: 30, move: 2, str: 9, upgrade: ['swordsman', 'spearman'], replaces: 'warrior', nation: 'lume' },
  hunter: { name: 'Lovec', desc: 'Rychlý lučištník s delším rozhledem.', cost: 40, move: 3, str: 6, ranged: 9, range: 2, tech: 'archery', replaces: 'archer', nation: 'sylv', sight: 3, upgrade: ['crossbow'] },
  ram: { name: 'Beranidlo', desc: 'Samo neútočí. Stojí-li hned u nepřátelského města, má vaše pěchota při útoku na to město +50 % síly a vaše jednotky hned u města +50 % obrany proti odvetě i střelbě z hradeb.', cost: 40, move: 2, str: 4, tech: 'bronze', siege: true, ram: true },
  manatarms: { name: 'Zbrojnoš', desc: 'Pěchota v plné zbroji, nejsilnější v boji zblízka. Vyžaduje železo. +25 % proti kopiníkům.', cost: 84, move: 2, str: 20, tech: 'steel', needs: 'iron', antiSpear: true },
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
  walls: { name: 'Hradby', desc: 'Hradby se 100 body, které berou rány místo obránců, a +40 % obrana města, dokud stojí.', cost: 50, tech: 'masonry', maint: 0 },
  barracks: { name: 'Kasárna', desc: 'Nové jednotky jsou veteráni (+15 % síla).', cost: 52, tech: 'tactics', maint: 1 },
  temple: { name: 'Chrám', desc: '+3 kultura, +1 zlato.', cost: 56, tech: 'mysticism', maint: 0 },
  aqueduct: { name: 'Akvadukt', desc: 'Po růstu zůstane městu 40 % zásob jídla.', cost: 78, tech: 'construction', maint: 1 },
  academy: { name: 'Akademie', desc: '+3 věda a +25 % vědy města.', cost: 88, tech: 'philosophy', maint: 1 },
  court: { name: 'Soudní dvůr', desc: '+4 zlato.', cost: 70, tech: 'law', maint: 0 },
  harbor: { name: 'Přístav', desc: '+1 jídlo z každého obdělávaného vodního pole a +2 zlato. Jen v pobřežním městě.', cost: 54, tech: 'sailing', maint: 1 },
  bastion: { name: 'Bašty', desc: 'Dalších 100 bodů hradeb a +25 % obrana města. Vyžadují hradby.', cost: 84, tech: 'engineering', maint: 1 },
  bank: { name: 'Banka', desc: '+3 zlato a +20 % zlata města.', cost: 92, tech: 'banking', maint: 0 },
  caravanserai: { name: 'Karavanseraj', desc: '+3 zlato, je-li město spojené cestou nebo přístavem s hlavním městem.', cost: 70, tech: 'commerce', maint: 0 },
  armory: { name: 'Zbrojnice', desc: 'Nové bojové jednotky začínají s 10 zkušenostmi.', cost: 80, tech: 'armory', maint: 1 },
  shipyard: { name: 'Loděnice', desc: 'Lodě se tu stavějí o polovinu rychleji. Jen v pobřežním městě.', cost: 76, tech: 'shipbuilding', maint: 1 },
  guildhall: { name: 'Cechovní dům', desc: '+2 výroba a +1 výroba za každé 4 obyvatele.', cost: 96, tech: 'guilds', maint: 1 },
  university: { name: 'Univerzita', desc: '+4 věda a +1 věda za každé 3 obyvatele.', cost: 110, tech: 'education', maint: 2 },
  amphitheater: { name: 'Amfiteátr', desc: '+4 kultura.', cost: 100, tech: 'architecture', maint: 1 },
  observatory: { name: 'Observatoř', desc: '+3 věda; dalších +3, stojí-li město na pahorkatině nebo hned u hor.', cost: 104, tech: 'astronomy', maint: 1 },
  sewer: { name: 'Kanalizace', desc: 'Město smí růst přes 16 obyvatel. Vyžaduje akvadukt.', cost: 110, tech: 'engineering', maint: 1 },
  wonder: { name: 'Sluneční chrám', desc: 'Div světa. Kdo jej dostaví první a udrží jeho město 15 tahů, vyhrává misi.', cost: 800, tech: 'calendar', maint: 0 },
}

export interface TechDef { name: string; tier: number; row: number; cost: number; req: TechId[]; unlocks: string; /** Lze zkoumat opakovaně; každé další kolo je dražší. */ repeat?: boolean }
const C = [0, 20, 45, 80, 125, 190, 280, 380, 500]
/** O kolik zdraží opakovatelná technologie s každým dokončením. */
export const REPEAT_STEP = 150
/** Každá technologie vyžaduje aspoň jednu ze stupně těsně pod sebou, takže stupně nejdou přeskakovat. */
export const TECHS: Record<TechId, TechDef> = {
  agriculture: { name: 'Zemědělství', tier: 1, row: 0, cost: C[1], req: [], unlocks: 'Farmy' },
  husbandry: { name: 'Chov zvířat', tier: 1, row: 1, cost: C[1], req: [], unlocks: 'Ohrady (koně, zvěř)' },
  mining: { name: 'Těžba', tier: 1, row: 2, cost: C[1], req: [], unlocks: 'Doly' },
  archery: { name: 'Lukostřelba', tier: 1, row: 3, cost: C[1], req: [], unlocks: 'Lučištník' },
  sailing: { name: 'Plavba', tier: 1, row: 4, cost: C[1], req: [], unlocks: 'Galéra, přístav, nalodění' },
  pottery: { name: 'Hrnčířství', tier: 2, row: 0, cost: C[2], req: ['agriculture'], unlocks: 'Sýpka' },
  wheel: { name: 'Kolo', tier: 2, row: 1, cost: C[2], req: ['husbandry'], unlocks: 'Dílna, cesty' },
  bronze: { name: 'Bronz', tier: 2, row: 2, cost: C[2], req: ['mining'], unlocks: 'Kopiník, beranidlo, mýcení lesa' },
  masonry: { name: 'Zdivo', tier: 2, row: 3, cost: C[2], req: ['mining'], unlocks: 'Hradby' },
  forestry: { name: 'Dřevařství', tier: 2, row: 4, cost: C[2], req: ['archery'], unlocks: 'Pily' },
  writing: { name: 'Písmo', tier: 2, row: 5, cost: C[2], req: ['agriculture'], unlocks: 'Knihovna' },
  fishing: { name: 'Rybolov', tier: 2, row: 6, cost: C[2], req: ['sailing'], unlocks: 'Loviště' },
  mysticism: { name: 'Mystika', tier: 3, row: 0, cost: C[3], req: ['pottery'], unlocks: 'Chrám' },
  riding: { name: 'Jezdectví', tier: 3, row: 1, cost: C[3], req: ['wheel'], unlocks: 'Jezdec' },
  iron: { name: 'Železo', tier: 3, row: 2, cost: C[3], req: ['bronze'], unlocks: 'Šermíř' },
  tactics: { name: 'Válečnictví', tier: 3, row: 3, cost: C[3], req: ['bronze', 'archery'], unlocks: 'Kasárna, šik' },
  construction: { name: 'Stavitelství', tier: 3, row: 4, cost: C[3], req: ['masonry', 'wheel'], unlocks: 'Akvadukt, mosty' },
  currency: { name: 'Měna', tier: 3, row: 5, cost: C[3], req: ['writing'], unlocks: 'Tržiště, trhové vsi' },
  navigation: { name: 'Navigace', tier: 3, row: 6, cost: C[3], req: ['fishing'], unlocks: 'Triéra, plavba přes oceán' },
  philosophy: { name: 'Filosofie', tier: 4, row: 0, cost: C[4], req: ['mysticism', 'writing'], unlocks: 'Akademie' },
  commerce: { name: 'Kupectví', tier: 4, row: 1, cost: C[4], req: ['currency'], unlocks: 'Karavanseraj, výnosnější vsi' },
  armory: { name: 'Zbrojířství', tier: 4, row: 2, cost: C[4], req: ['iron', 'tactics'], unlocks: 'Zbrojnice, kušník, voj' },
  math: { name: 'Matematika', tier: 4, row: 3, cost: C[4], req: ['currency', 'wheel'], unlocks: 'Katapult' },
  irrigation: { name: 'Zavlažování', tier: 4, row: 4, cost: C[4], req: ['construction', 'agriculture'], unlocks: 'Farmy u řeky +1 jídlo' },
  law: { name: 'Zákoník', tier: 4, row: 5, cost: C[4], req: ['currency'], unlocks: 'Soudní dvůr' },
  shipbuilding: { name: 'Loďařství', tier: 4, row: 6, cost: C[4], req: ['navigation'], unlocks: 'Loděnice' },
  education: { name: 'Vzdělanost', tier: 5, row: 0, cost: C[5], req: ['philosophy', 'math'], unlocks: 'Univerzita' },
  steel: { name: 'Ocel', tier: 5, row: 2, cost: C[5], req: ['armory'], unlocks: 'Zbrojnoš' },
  engineering: { name: 'Inženýrství', tier: 5, row: 3, cost: C[5], req: ['math', 'construction'], unlocks: 'Bašty, kanalizace' },
  guilds: { name: 'Cechy', tier: 5, row: 5, cost: C[5], req: ['commerce', 'law'], unlocks: 'Cechovní dům' },
  architecture: { name: 'Architektura', tier: 6, row: 0, cost: C[6], req: ['engineering', 'education'], unlocks: 'Amfiteátr' },
  astronomy: { name: 'Astronomie', tier: 6, row: 1, cost: C[6], req: ['education', 'engineering'], unlocks: 'Observatoř' },
  chivalry: { name: 'Rytířství', tier: 6, row: 2, cost: C[6], req: ['steel', 'riding'], unlocks: 'Rytíř' },
  siegecraft: { name: 'Obléhání', tier: 6, row: 3, cost: C[6], req: ['engineering', 'steel'], unlocks: 'Trebuchet' },
  banking: { name: 'Bankovnictví', tier: 6, row: 5, cost: C[6], req: ['guilds', 'math'], unlocks: 'Banka' },
  calendar: { name: 'Sluneční kalendář', tier: 7, row: 1, cost: C[7], req: ['astronomy', 'architecture'], unlocks: 'Div: Sluneční chrám' },
  empire: { name: 'Správa říše', tier: 8, row: 1, cost: C[8], req: ['calendar'], unlocks: '+1 zlato ve městech, opakovaně', repeat: true },
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
  /** Vlastní pořadí tradic; bez něj se volí podle toho, jestli je povaha válečná. */
  traditions?: TraditionId[]
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

const R_BUILDER: TechId[] = ['agriculture', 'pottery', 'mining', 'husbandry', 'archery', 'writing', 'bronze', 'wheel', 'mysticism', 'masonry', 'currency', 'philosophy', 'math', 'construction', 'education', 'engineering', 'astronomy', 'architecture', 'calendar', 'sailing', 'forestry', 'law', 'commerce', 'irrigation', 'guilds', 'banking', 'iron', 'tactics', 'fishing', 'armory', 'steel', 'riding', 'navigation', 'shipbuilding', 'siegecraft', 'chivalry', 'empire']
const R_WAR: TechId[] = ['mining', 'bronze', 'archery', 'agriculture', 'husbandry', 'wheel', 'iron', 'tactics', 'pottery', 'writing', 'currency', 'math', 'armory', 'riding', 'masonry', 'construction', 'steel', 'engineering', 'siegecraft', 'chivalry', 'sailing', 'forestry', 'fishing', 'navigation', 'mysticism', 'irrigation', 'philosophy', 'law', 'commerce', 'education', 'guilds', 'banking', 'shipbuilding', 'astronomy', 'architecture', 'calendar', 'empire']
const B_BUILDER: BuildingId[] = ['monument', 'granary', 'library', 'workshop', 'temple', 'market', 'academy', 'harbor', 'aqueduct', 'university', 'court', 'caravanserai', 'guildhall', 'observatory', 'amphitheater', 'sewer', 'bank', 'walls', 'barracks', 'shipyard', 'armory', 'bastion']
const B_WAR: BuildingId[] = ['monument', 'granary', 'barracks', 'workshop', 'library', 'walls', 'armory', 'market', 'temple', 'aqueduct', 'academy', 'guildhall', 'court', 'bastion', 'university', 'caravanserai', 'sewer', 'bank', 'observatory', 'amphitheater', 'harbor', 'shipyard']

export const PERSONAS: Record<PersonaId, PersonaDef> = {
  // Dobyvatel: brzy zbrojí a napadá slabší sousedy.
  aggressive: {
    name: 'Dobyvatel', desc: 'Výbojný národ: zbrojí od začátku a slabšího souseda napadne.', label: 'výbojný sok',
    research: R_WAR, build: B_WAR, traditions: ['militia', 'warrior', 'raiders', 'campaign', 'stores', 'settlers', 'builders', 'craft'],
    martial: true, cities: 4, settleUntil: 85, armyBase: 5, armyPace: 12, alwaysArm: true, wonderInWar: false, wallsAlways: true,
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
    research: ['agriculture', 'pottery', 'husbandry', 'mining', 'wheel', 'archery', 'bronze', 'writing', 'masonry', 'currency', 'forestry', 'sailing', 'fishing', 'irrigation', 'construction', 'math', 'commerce', 'mysticism', 'iron', 'law', 'philosophy', 'guilds', 'banking', 'riding', 'tactics', 'navigation', 'education', 'engineering', 'astronomy', 'architecture', 'calendar', 'armory', 'steel', 'shipbuilding', 'chivalry', 'siegecraft', 'empire'],
    build: ['granary', 'monument', 'workshop', 'market', 'library', 'walls', 'court', 'aqueduct', 'caravanserai', 'guildhall', 'bank', 'temple', 'harbor', 'sewer', 'university', 'barracks', 'academy', 'amphitheater', 'observatory', 'shipyard', 'armory', 'bastion'],
    martial: false, cities: 8, settleUntil: 100, armyBase: 2, armyPace: 30, alwaysArm: true, wonderInWar: false, wallsAlways: false,
    reserve: 70, marchAt: 4, warFrom: 45, warMil: 5, warRatio: 1.6, warChance: 0.12, dogpile: 0, peaceRatio: 1.0, peaceAfter: 20,
  },
  // Učenec: věda a kultura především, malé vojsko, chrám staví i za války.
  scholar: {
    name: 'Učenec', desc: 'Národ učenců: žene vědu a kulturu, vojsko drží malé.', label: 'zahloubaný učenec',
    research: ['agriculture', 'pottery', 'writing', 'mysticism', 'mining', 'philosophy', 'husbandry', 'wheel', 'currency', 'math', 'education', 'masonry', 'construction', 'engineering', 'astronomy', 'architecture', 'calendar', 'archery', 'bronze', 'law', 'commerce', 'guilds', 'banking', 'irrigation', 'forestry', 'sailing', 'fishing', 'iron', 'tactics', 'armory', 'steel', 'riding', 'navigation', 'shipbuilding', 'siegecraft', 'chivalry', 'empire'],
    build: ['library', 'monument', 'granary', 'temple', 'academy', 'workshop', 'university', 'market', 'aqueduct', 'observatory', 'amphitheater', 'walls', 'court', 'guildhall', 'sewer', 'caravanserai', 'bank', 'harbor', 'barracks', 'shipyard', 'armory', 'bastion'],
    martial: false, cities: 4, settleUntil: 70, armyBase: 1, armyPace: 45, alwaysArm: false, wonderInWar: true, wallsAlways: false,
    reserve: 80, marchAt: 5, warFrom: 70, warMil: 6, warRatio: 2.5, warChance: 0.05, dogpile: 0, peaceRatio: 1.1, peaceAfter: 16,
  },
  // Vypočítavý: čeká na příležitost a vrhne se na toho, kdo už krvácí jinde; z prohrané války rychle couvne.
  opportunist: {
    name: 'Vypočítavý', desc: 'Vypočítavý národ: udeří, když soupeř válčí jinde, a z prohrané války rychle couvne.', label: 'vypočítavý soused',
    research: ['mining', 'agriculture', 'archery', 'pottery', 'bronze', 'husbandry', 'writing', 'wheel', 'currency', 'math', 'iron', 'masonry', 'riding', 'tactics', 'armory', 'steel', 'mysticism', 'law', 'commerce', 'guilds', 'banking', 'chivalry', 'sailing', 'forestry', 'construction', 'engineering', 'siegecraft', 'philosophy', 'education', 'fishing', 'navigation', 'irrigation', 'astronomy', 'architecture', 'calendar', 'shipbuilding', 'empire'],
    build: ['monument', 'granary', 'workshop', 'barracks', 'market', 'library', 'walls', 'temple', 'court', 'caravanserai', 'guildhall', 'bank', 'armory', 'aqueduct', 'academy', 'university', 'sewer', 'bastion', 'observatory', 'amphitheater', 'harbor', 'shipyard'],
    martial: true, cities: 5, settleUntil: 85, armyBase: 2, armyPace: 24, alwaysArm: true, wonderInWar: false, wallsAlways: false,
    reserve: 70, marchAt: 3, warFrom: 40, warMil: 4, warRatio: 1.7, warChance: 0.1, dogpile: 0.3, peaceRatio: 1.15, peaceAfter: 14,
  },
  // Obránce: sám nezačíná, ale města má za hradbami a s posádkou.
  defender: {
    name: 'Obránce', desc: 'Národ obránců: válku nezačíná, ale jeho města stojí za hradbami.', label: 'ostražitý obránce',
    research: ['mining', 'agriculture', 'archery', 'masonry', 'pottery', 'bronze', 'husbandry', 'writing', 'wheel', 'construction', 'currency', 'math', 'engineering', 'iron', 'mysticism', 'tactics', 'armory', 'steel', 'philosophy', 'forestry', 'irrigation', 'law', 'education', 'astronomy', 'architecture', 'calendar', 'siegecraft', 'commerce', 'guilds', 'banking', 'riding', 'chivalry', 'sailing', 'fishing', 'navigation', 'shipbuilding', 'empire'],
    build: ['monument', 'walls', 'granary', 'workshop', 'barracks', 'library', 'bastion', 'armory', 'temple', 'market', 'aqueduct', 'guildhall', 'court', 'academy', 'university', 'sewer', 'caravanserai', 'bank', 'observatory', 'amphitheater', 'harbor', 'shipyard'],
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
    color: 0x7a2b3a, colorDark: 0x2c1420, css: '#c0566a',
    trait: '', traitDesc: '', unique: 'warrior', lore: '', cities: [], temper: 'aggressive', persona: 'aggressive',
  },
  // Městské státy nejsou hráč: jejich města patří barbarskému hráči, tenhle záznam jim dává jen jméno a barvy.
  free: {
    name: 'Městský stát', adjective: 'svobodný', leader: '', title: '',
    color: 0xa9b6c6, colorDark: 0x5c6878, css: '#b9c6d6',
    trait: '', traitDesc: '', unique: 'warrior', lore: '',
    cities: ['Brodec', 'Vranov', 'Solnice', 'Jasenná', 'Medník', 'Záhoří', 'Rudava', 'Havraní Újezd'], temper: 'builder', persona: 'defender',
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
