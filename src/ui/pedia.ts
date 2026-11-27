// Encyklopedie: přehled jednotek, staveb, výzkumu, národů, polí, pravidel a kláves.
// Čte jen herní data, ne stav hry – jde tedy otevřít i z hlavního menu.
import {
  BRANCHES, BRANCH_IDS, branchOf, CLEAR, BUILDINGS, BUILDING_IDS, ERAS, GOLDEN_TURNS, IMPROVEMENTS, NATIONS, PERSONAS, PLAYABLE, PROMOS, PROMO_IDS, RESOURCES, ROAD, TECHS, TECH_IDS,
  TERRAIN, TRADITIONS, TRADITION_IDS, TUNE, UNITS, UNIT_IDS, XP_LEVELS, traditionCost,
  type BuildingId, type ImprovementId, type NationId, type ResourceId, type TechId, type TerrainId, type UnitDef, type UnitId,
} from '../game/data.ts'
import { REPAIR_COST, BORDER_BASE, BORDER_STEP, POP_CAP, WALL_HP, WALL_MELEE, WALL_RANGED, CONQUEST_TURNS, RAM_BONUS, RAM_COVER, SIEGE_UNITS, SIEGE_VS_CITY, SIEGE_VS_UNIT, UNITS_PER_SOURCE, WONDER_TURNS } from '../game/rules.ts'
import { unitIconUrl } from '../view/nationArt.ts'
import { esc, ic, tip, UI } from './hud.ts'

export type PediaTab = 'units' | 'buildings' | 'techs' | 'nations' | 'land' | 'rules' | 'keys'
export const PEDIA_TABS: [PediaTab, string][] = [
  ['units', 'Jednotky'], ['buildings', 'Stavby'], ['techs', 'Výzkum'], ['nations', 'Národy'], ['land', 'Pole a suroviny'], ['rules', 'Pravidla'], ['keys', 'Klávesy'],
]

/** Odkaz na jiné heslo encyklopedie. */
const link = (tab: PediaTab, id: string, text: string) => `<a class="pl" data-a="pedia" data-v="${tab}:${id}">${esc(text)}</a>`
const techLink = (t: TechId) => link('techs', t, TECHS[t].name)
const unitLink = (u: UnitId) => link('units', u, UNITS[u].name)
const buildingLink = (b: BuildingId) => link('buildings', b, BUILDINGS[b].name)
const list = (a: string[], last = ' a ') => (a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')}${last}${a[a.length - 1]}`)
const pct = (m: number) => `${Math.round(Math.abs(m - 1) * 100)} %`
const num = (n: number) => String(n).replace('.', ',')
const stat = (icon: string, value: string | number, label: string) => `<span class="ps"${tip(label)}>${ic(icon, 's')}${value}</span>`
const fact = (label: string, html: string) => `<span><i>${esc(label)}</i> ${html}</span>`
const entry = (tab: PediaTab, id: string, img: string, name: string, stats: string, desc: string, facts: string[]) => `
  <div class="pe" id="pd-${tab}-${id}">${img}<div><div class="ph"><b>${esc(name)}</b>${stats}</div><p>${desc}</p>${facts.length ? `<div class="pf">${facts.join('')}</div>` : ''}</div></div>`
const yields = (o: { food: number; prod: number; gold: number }) => {
  const a = [o.food ? `${ic('food', 's')}${o.food}` : '', o.prod ? `${ic('prod', 's')}${o.prod}` : '', o.gold ? `${ic('gold', 's')}${o.gold}` : ''].filter(Boolean)
  return a.length ? `<span class="ps">${a.join(' ')}</span>` : '–'
}

// ---------------------------------------------------------------- jednotky

const UNIT_GROUPS: [string, (d: UnitDef) => boolean][] = [
  ['Civilní jednotky', d => !!d.civilian],
  ['Lodě', d => !!d.naval],
  ['Obléhací stroje', d => !!d.siege],
  ['Jízda', d => !!d.mounted],
  ['Střelci', d => !!d.ranged],
  ['Pěchota a průzkum', () => true],
]

function unitEntry(id: UnitId, nation: NationId): string {
  const d = UNITS[id]
  const stats = [
    stat('prod', d.cost, 'Cena ve výrobě'),
    d.str ? stat('str', d.str, 'Síla v boji zblízka a při obraně') : '',
    d.ranged ? stat('rng', `${d.ranged} na ${d.range} pole`, 'Síla střelby a dostřel') : '',
    stat('move', d.move, 'Pohyb: kolik polí ujde za tah'),
  ].join('')
  const facts: string[] = []
  if (d.nation && d.replaces) facts.push(fact('Jen', `${link('nations', d.nation, NATIONS[d.nation].name)}, místo jednotky ${unitLink(d.replaces)}`))
  facts.push(fact('Technologie', d.tech ? techLink(d.tech) : 'žádná, jde stavět od začátku'))
  if (d.needs) facts.push(fact('Surovina', esc(`${RESOURCES[d.needs].name} (jeden zdroj uživí ${UNITS_PER_SOURCE} jednotky)`)))
  if (d.sight) facts.push(fact('Rozhled', esc(`${d.sight} pole místo obvyklých 2`)))
  if (d.upgrade?.length) facts.push(fact('Přezbrojení na', list(d.upgrade.map(unitLink), ' nebo ')))
  const from = UNIT_IDS.filter(o => UNITS[o].upgrade?.includes(id))
  if (from.length) facts.push(fact('Vzniká přezbrojením z', list(from.map(unitLink))))
  const variants = UNIT_IDS.filter(o => UNITS[o].replaces === id)
  if (variants.length) facts.push(fact('Národní obdoby', list(variants.map(o => `${unitLink(o)} (${esc(NATIONS[UNITS[o].nation!].name)})`))))
  return entry('units', id, `<img class="pi" src="${unitIconUrl(id, d.nation ?? nation)}" alt="">`, d.name, stats, esc(d.desc), facts)
}

function unitsTab(nation: NationId): string {
  const left = new Set(UNIT_IDS)
  let out = `<p class="plead">${esc('Cena se platí výrobou města, za zlato lze rozestavěnou jednotku dokoupit. Jednotky s označením národa jsou unikátní: staví je jen ten národ, a to místo běžné jednotky.')}</p>`
  for (const [title, test] of UNIT_GROUPS) {
    const ids = [...left].filter(id => test(UNITS[id]))
    for (const id of ids) left.delete(id)
    // Unikátní jednotka hned za tou, kterou nahrazuje.
    ids.sort((a, b) => ids.indexOf(UNITS[a].replaces ?? a) - ids.indexOf(UNITS[b].replaces ?? b) || (UNITS[a].replaces ? 1 : 0) - (UNITS[b].replaces ? 1 : 0))
    out += `<h4>${title}</h4><div class="pgrid">${ids.map(id => unitEntry(id, nation)).join('')}</div>`
  }
  return out
}

// ---------------------------------------------------------------- stavby

function buildingsTab(): string {
  const cards = BUILDING_IDS.map(id => {
    const d = BUILDINGS[id]
    const stats = stat('prod', d.cost, 'Cena ve výrobě') + (d.maint ? stat('gold', `−${d.maint}`, 'Údržba: zlato za tah') : '')
    return entry('buildings', id, `<img class="pi" src="${UI}b_${id}.png" alt="">`, d.name, stats, esc(d.desc), [fact('Technologie', d.tech ? techLink(d.tech) : 'žádná, jde stavět od začátku')])
  })
  return `<p class="plead">${esc('Každou stavbu může mít město jen jednou. Údržba se platí ze společné pokladny každý tah.')}</p><div class="pgrid">${cards.join('')}</div>`
}

// ---------------------------------------------------------------- výzkum

/** Obrázek k technologii: to hlavní, co odemyká (jednotka, stavba, nebo vylepšení pole). */
export function techArtUrl(id: TechId, nation: NationId): string {
  if (id === 'irrigation') return `${UI}r_wheat.png`
  if (id === 'empire') return `${UI}ic_gold.png`
  const unit = UNIT_IDS.find(u => UNITS[u].tech === id && !UNITS[u].replaces)
  if (unit) return unitIconUrl(unit, nation)
  const b = BUILDING_IDS.find(o => BUILDINGS[o].tech === id)
  if (b) return `${UI}b_${b}.png`
  const imp = (Object.keys(IMPROVEMENTS) as ImprovementId[]).find(i => IMPROVEMENTS[i].tech === id)
  return imp ? `${UI}i_${imp}.png` : ''
}

function techEntry(id: TechId, nation: NationId): string {
  const d = TECHS[id]
  const facts: string[] = []
  facts.push(fact('Vyžaduje', d.req.length ? list(d.req.map(techLink)) : 'nic, jde zkoumat od začátku'))
  const units = UNIT_IDS.filter(u => UNITS[u].tech === id)
  if (units.length) facts.push(fact('Jednotky', list(units.map(unitLink))))
  const builds = BUILDING_IDS.filter(b => BUILDINGS[b].tech === id)
  if (builds.length) facts.push(fact('Stavby', list(builds.map(buildingLink))))
  const imps = (Object.keys(IMPROVEMENTS) as ImprovementId[]).filter(i => IMPROVEMENTS[i].tech === id).map(i => esc(IMPROVEMENTS[i].name))
  if (ROAD.tech === id) imps.push(esc(ROAD.name))
  if (imps.length) facts.push(fact('Vylepšení polí', list(imps)))
  const next = TECH_IDS.filter(t => TECHS[t].req.includes(id))
  if (next.length) facts.push(fact('Vede k', list(next.map(techLink))))
  return entry('techs', id, `<img class="pi" src="${techArtUrl(id, nation)}" alt="">`, d.name, stat('sci', d.cost, 'Cena ve vědě'), esc(d.unlocks), facts)
}

function techsTab(nation: NationId): string {
  const tiers = [...new Set(TECH_IDS.map(t => TECHS[t].tier))].sort((a, b) => a - b)
  let out = `<p class="plead">${esc(`Technologie se zkoumá, jakmile znáte všechny, které vyžaduje. Počet objevených technologií vás posouvá věky: ${ERAS.slice(1).map(e => `${e.name} při ${e.techs}`).join(', ')}. Kdo do věku vstoupí první, získá na ${GOLDEN_TURNS} tahů zlatý věk.`)}</p>`
  for (const tier of tiers) {
    const ids = TECH_IDS.filter(t => TECHS[t].tier === tier).sort((a, b) => TECHS[a].row - TECHS[b].row)
    out += `<h4>${tier}. stupeň</h4><div class="pgrid">${ids.map(t => techEntry(t, nation)).join('')}</div>`
  }
  return out
}

// ---------------------------------------------------------------- národy

function nationsTab(): string {
  const cards = PLAYABLE.map(id => {
    const n = NATIONS[id]
    const p = PERSONAS[n.persona]
    return entry('nations', id, `<img class="pi big" src="${UI}p_${id}.png" style="border-color:${n.css}" alt="">`, n.name, `<span class="ps">${esc(`${n.leader}, ${n.title}`)}</span>`, esc(n.lore), [
      fact(n.trait, esc(n.traitDesc)),
      fact('Unikátní jednotka', `${unitLink(n.unique)} místo jednotky ${unitLink(UNITS[n.unique].replaces!)}`),
      fact('Vede-li ho počítač', esc(`${p.name}. ${p.desc}`)),
    ])
  })
  return `<div class="pgrid wide">${cards.join('')}</div>`
}

// ---------------------------------------------------------------- pole a suroviny

function landTab(): string {
  const def = (n: number) => (n ? `+${Math.round(n * 100)} %` : '–')
  const note: Partial<Record<TerrainId, string>> = {
    ocean: 'Jen pro triéry a naloděné jednotky s Navigací.',
    coast: 'Pro lodě a naloděné jednotky (od Plavby).',
    hills: 'Krok sem stojí 2 body pohybu.',
    mountain: 'Neprostupné.',
    desert: 'Bez řeky či suroviny nedá nic.',
  }
  const terrain = (Object.keys(TERRAIN) as TerrainId[]).map(id => {
    const t = TERRAIN[id]
    return `<tr><td><b>${esc(t.name)}</b></td><td>${yields(t)}</td><td>${def(t.defense)}</td><td>${esc(note[id] ?? '')}</td></tr>`
  }).join('')
  const resources = (Object.keys(RESOURCES) as ResourceId[]).map(id => {
    const r = RESOURCES[id]
    const notes = [
      r.improvement ? `Vylepšuje ji ${IMPROVEMENTS[r.improvement].name.toLowerCase()}.` : 'Nevylepšuje se.',
      r.strategic ? `Strategická: s vylepšením uživí ${UNITS_PER_SOURCE} jednotky (${list(UNIT_IDS.filter(u => UNITS[u].needs === id).map(u => UNITS[u].name.toLowerCase()))}).` : '',
    ].filter(Boolean).join(' ')
    return `<tr><td><img class="ri" src="${UI}r_${id}.png" alt=""><b>${esc(r.name)}</b></td><td>${yields(r)}</td><td>${esc(notes)}${r.tech ? ` Na mapě ji odhalí ${techLink(r.tech)}.` : ''}</td></tr>`
  }).join('')
  const imps = (Object.keys(IMPROVEMENTS) as ImprovementId[]).map(id => {
    const m = IMPROVEMENTS[id]
    return `<tr><td><img class="ri" src="${UI}i_${id}.png" alt=""><b>${esc(m.name)}</b></td><td>${yields(m)}</td><td>${esc(`${m.turns} ${m.turns < 5 ? 'tahy' : 'tahů'}`)}</td><td>${techLink(m.tech)}</td></tr>`
  }).join('')
  return `
    <h4>Krajina</h4>
    <table class="scores ptab"><tr><th>Pole</th><th>Výnos</th><th>Obrana</th><th></th></tr>${terrain}
      <tr><td><b>Les</b></td><td><span class="ps">${ic('prod', 's')}+1</span></td><td>+25 %</td><td>${esc('Roste na loukách, pláních i pahorkatině. Jídlo pole sníží nejvýš na 1, krok sem stojí 2 body pohybu.')}</td></tr>
      <tr><td><b>Řeka</b></td><td><span class="ps">${ic('gold', 's')}+1</span></td><td>–</td><td>${esc('Teče po hranách polí. Přechod stojí bod pohybu navíc a útok zblízka přes řeku je o 20 % slabší; cesta na obou březích je mostem až se Stavitelstvím.')}</td></tr>
    </table>
    <h4>Suroviny</h4>
    <table class="scores ptab"><tr><th>Surovina</th><th>Výnos</th><th></th></tr>${resources}</table>
    <h4>Vylepšení polí</h4>
    <p>${esc('Staví je dělníci na vlastním území. Na poli stojí jen jedno; na rovině se volí mezi farmou a trhovou vsí. Výnos se přičítá k výnosu pole a suroviny. Farma u řeky dává se Zavlažováním +1 jídlo navíc, pila u řeky +1 výrobu, trhová ves ve městě spojeném s hlavním městem +1 zlato (s Kupectvím). Přestavba na jiné vylepšení trvá o 2 tahy déle; vypleněné vylepšení nefunguje, dokud ho dělníci za polovinu doby neopraví.')}</p>
    <table class="scores ptab"><tr><th>Vylepšení</th><th>Výnos</th><th>Práce</th><th>Technologie</th></tr>${imps}
      <tr><td><b>${esc(ROAD.name)}</b></td><td>–</td><td>${esc(`${ROAD.turns} tahy, v lese a pahorkatině ${ROAD.rough}`)}</td><td>${techLink(ROAD.tech)}</td></tr>
      <tr><td><b>${esc(CLEAR.name)}</b></td><td>${esc(`jednorázově +${CLEAR.prod} výroby`)}</td><td>${esc(`${CLEAR.turns} tahy`)}</td><td>${techLink(CLEAR.tech)}</td></tr>
    </table>
    <p>${esc('Krok z cesty na cestu stojí půl bodu pohybu; města se počítají jako cesta.')}</p>`
}

// ---------------------------------------------------------------- pravidla

function rulesTab(): string {
  const walls = BUILDINGS.walls, bastion = BUILDINGS.bastion
  const engines = list(UNIT_IDS.filter(u => UNITS[u].siege && !UNITS[u].ram).map(unitLink))
  return `
    <h4>Cesty k vítězství</h4><ul>
      <li>${esc(`Dobytí: držte své sídelní město a většinu cizích po ${CONQUEST_TURNS} tahů.`)}</li>
      <li>${buildingLink('wonder')}${esc(`: dostavte ho a udržte jeho město ${WONDER_TURNS} tahů. Kdo město s chrámem dobude, přebírá chrám i odpočet.`)}</li>
      <li>${esc('Skóre: po posledním tahu vyhrává národ s nejvyšším skóre.')}</li></ul>
    <h4>Obléhání měst</h4><ul>
      <li>${esc(`Město má ${TUNE.cityHp} životů, jednou za tah střílí na nepřítele do 2 polí (cíl vyberete v otevřeném městě kliknutím, jinak střílí samo na nejslabšího) a každý tah si ${TUNE.cityHeal} životů opraví. Dobudete ho tak, že mu životy srazíte na nulu a vstoupíte jednotkou pro boj zblízka.`)}</li>
      <li>${esc(`Stavby Hradby a Bašty přidají městu po ${WALL_HP} bodech hradeb. Dokud hradby stojí, berou rány místo obránců: od pěchoty jen ${Math.round(WALL_MELEE * 100)} % škody (s beranidlem u města plnou), od střelců ${Math.round(WALL_RANGED * 100)} %, od obléhacích strojů plnou. Co hradby nepoberou, projde na obránce. Hradby se opravují stejně jako obránci, ${TUNE.cityHeal} bodů za tah mimo obležení. Dobytému městu zůstanou hradby tak pobořené, jak jsou, a obráncům čtvrtina životů. Zhruba polovina ostatních staveb se při dobývání poškodí: nefungují, dokud je ve výrobě města neopravíte za ${Math.round(REPAIR_COST * 100)} % ceny.`)}</li>
      <li>${buildingLink('walls')}: ${esc(walls.desc)} ${buildingLink('bastion')}: ${esc(bastion.desc)}</li>
      <li>${esc(`Obklíčení: stojí-li hned u města aspoň ${SIEGE_UNITS} nepřátelské vojenské jednotky, město se neopravuje.`)}</li>
      <li>${engines}${esc(`: proti městům mají ${num(SIEGE_VS_CITY)}násobný účinek, proti jednotkám jen ${num(SIEGE_VS_UNIT)}násobný. Potřebují doprovod.`)}</li>
      <li>${unitLink('ram')}${esc(`: samo neútočí. Stojí-li hned u města, má vaše pěchota při útoku na město +${pct(RAM_BONUS)} síly a vaše jednotky hned u města +${pct(RAM_COVER)} obrany proti odvetě i střelbě z hradeb.`)}</li></ul>
    <h4>Boj</h4><ul>
      <li>${esc('Na jednom poli smí stát jedna vojenská a jedna civilní jednotka.')}</li>
      <li>${esc('V boji zblízka utrpí ztráty obě strany, střelci odvetu nedostanou.')}</li>
      <li>${esc('Obránce má v pahorkatině a v lese +25 %, opevněný dalších +25 %. Útok zblízka přes řeku je o 20 % slabší.')}</li>
      <li>${esc('Jednotka, která se celý tah nehýbe, se léčí; nejrychleji ve městě.')}</li>
      <li>${esc('Opevnění (+25 % k obraně) platí hned, jen když jednotka v tahu neútočila a zbyl jí pohyb; jinak až od příštího tahu.')}</li>
      <li>${esc('Útok zblízka stojí tolik pohybu jako vstup na pole cíle; jednotka s plným pohybem smí zaútočit vždy.')}</li>
      <li>${esc('Střelci na dvě pole nevidí přes les, pahorkatinu ani hory. Z pahorkatiny se střílí přes les i přes jiné pahorky, ne však přes zalesněnou pahorkatinu a hory. Jednotky s dostřelem 3 střílejí přes překážky.')}</li>
      <li>${esc('Obléhací stroje nestřílejí v tahu, kdy se přesunuly.')}</li>
      <li>${esc('Po objevu Válečnictví: útok zblízka +10 % za každou další vaši jednotku pro boj zblízka u cíle, obránce +10 % za každou svou jednotku vedle sebe.')}</li>
      <li>${esc('Šermíři, sekerníci a zbrojnoši mají +25 % proti kopiníkům, jízda +25 % proti střelcům a strojům.')}</li>
      <li>${esc('Zraněná jednotka ztrácí nejvýš 35 % síly.')}</li>
      <li>${esc('Na území národa, se kterým válčíte, se jednotky léčí jen o 5 životů za tah.')}</li>
      <li>${esc('Šik a voj: dvě stejné jednotky vedle sebe se s Válečnictvím spojí v šik (+50 % síly), se Zbrojířstvím tři ve voj (+90 %). Životy se zprůměrují a zůstává jich nejvýš 100; žold a suroviny se platí za každou jednotku. Rozdělit jde jen na vlastním území.')}</li>
      <li>${esc('Plenění: bojová jednotka na poli nepřítele vyřadí vylepšení, napodruhé cestu, a získá zlato. Vypleněné pole nefunguje, dokud ho dělníci neopraví.')}</li></ul>
    <h4>Povýšení</h4>
    <p>${esc(`Jednotky sbírají bojem zkušenosti. Při ${list(XP_LEVELS.map(String))} bodech si vyberou jedno povýšení. Výběr stojí 1 bod pohybu a vyléčí 25 životů:`)}</p>
    <table class="scores ptab">${PROMO_IDS.map(id => `<tr><td><b>${esc(PROMOS[id].name)}</b></td><td>${esc(PROMOS[id].desc)}</td></tr>`).join('')}</table>
    <h4>Tradice</h4>
    <p>${esc(`Kultura měst se sčítá do pokladnice národa a platí se jí za tradice, trvalé výhody pro celý národ. První stojí ${traditionCost(0)} kultury, druhá ${traditionCost(1)}, třetí ${traditionCost(2)} a každá další víc, takže všechny se za hru stihnout nedají. Tradice jsou ve čtyřech větvích a v každé se postupuje odshora; kdo větev dokončí, získá zlatý věk na ${GOLDEN_TURNS} tahů.`)}</p>
    <table class="scores ptab">${BRANCH_IDS.map(b => `<tr><th colspan="2">${esc(BRANCHES[b].name)}</th></tr>` + branchOf(b).map((id, k) => `<tr><td><b>${k + 1}. ${esc(TRADITIONS[id].name)}</b></td><td>${esc(TRADITIONS[id].desc)}</td></tr>`).join('')).join('')}</table>
    <h4>Hranice a velikost měst</h4>
    <p>${esc(`Město při založení dostane šest sousedních polí. Další zabírá za kulturu po jednom, nejdál 3 pole od sebe: první stojí ${BORDER_BASE} kultury a každé další o ${BORDER_STEP} víc. Samo si bere nejdřív suroviny, pak pole u řeky a výnosná pole; v okně města lze přepnout na ruční výběr. Obdělávat jde každé zabrané pole. Kulturu dává město samo, jeho stavby a +1 za každé 4 obyvatele. Bez akvaduktu město neporoste přes ${POP_CAP[0]} obyvatel, bez kanalizace přes ${POP_CAP[1]}.`)}</p>
    <p class="plead">${esc('Města, pokladnu, obchod a nalodění popisuje nápověda (klávesa H).')}</p>`
}

// ---------------------------------------------------------------- klávesy

/** Klávesové zkratky; při změně v `App.onKey` upravit i tady. */
const KEYS: [string, [string, string][]][] = [
  ['Tah a výběr', [
    ['Enter, mezerník', 'Další rozhodnutí, které na vás čeká; když nic nečeká, konec tahu.'],
    ['Shift + Enter', 'Ukončit tah hned.'],
    ['Tab, N', 'Další jednotka, která čeká na rozkaz.'],
    ['Shift + Tab', 'Předchozí jednotka, která čeká na rozkaz.'],
    ['Esc', 'Zrušit výběr nebo zavřít okno.'],
  ]],
  ['Okna', [
    ['T', 'Technologie.'], ['C', 'Tradice.'], ['M', 'Cíle mise.'], ['L', 'Přehled měst a jednotek.'], ['K', 'Encyklopedie.'], ['H, ?', 'Nápověda.'], ['I', 'Tipy rádce zapnout a vypnout.'],
  ]],
  ['Mapa', [
    ['W A S D, šipky', 'Posun mapy.'], ['+ −', 'Přiblížit a oddálit.'],
  ]],
  ['Vybraná jednotka', [
    ['B', 'Založit město (osadníci).'], ['F', 'Opevnit se (vojenské jednotky).'], ['E', 'Automatika: dělníci vylepšují pole, zvěd a lodě zkoumají mapu.'],
    ['R', 'Cesta do… (dělníci postaví celou trasu).'], ['G', 'Doprovázet civilní jednotku na stejném nebo sousedním poli; znovu G doprovod zruší.'], ['U', 'Přezbrojit na novější jednotku.'], ['Z', 'Spát: jednotka přestane čekat na rozkaz.'], ['X', 'Přeskočit tah.'],
  ]],
  ['Myš', [
    ['Levé tlačítko', 'Výběr jednotky či města; s vybranou jednotkou pohyb na pole nebo útok.'],
    ['Shift + klik na mapě', 'Přidá jednotce další průjezdní bod.'],
    ['Pravé tlačítko', 'Pošle jednotku i na pole s vlastní jednotkou či městem.'],
    ['Shift + klik ve městě', 'Začne položku stavět hned, místo zařazení na konec fronty.'],
    ['Shift + klik na technologii', 'Zařadí technologii do fronty výzkumu.'],
    ['Tažení, kolečko', 'Posun a přiblížení mapy.'],
  ]],
]

function keysTab(): string {
  return KEYS.map(([title, rows]) => `<h4>${esc(title)}</h4><table class="scores ptab keys">${rows.map(([k, d]) => `<tr><td>${k.split(', ').map(x => `<kbd>${x}</kbd>`).join(' ')}</td><td>${esc(d)}</td></tr>`).join('')}</table>`).join('')
}

/** Obsah okna encyklopedie: záložky a zvolená kapitola. `nation` určuje barvy obrázků běžných jednotek. */
export function pediaHtml(tab: PediaTab, nation: NationId): string {
  const body = tab === 'units' ? unitsTab(nation) : tab === 'buildings' ? buildingsTab() : tab === 'techs' ? techsTab(nation) : tab === 'nations' ? nationsTab() : tab === 'land' ? landTab() : tab === 'rules' ? rulesTab() : keysTab()
  return `<div class="pedia"><div class="ptabs">${PEDIA_TABS.map(([id, name]) => `<button class="tabbtn ${id === tab ? 'on' : ''}" data-a="pedia" data-v="${id}">${esc(name)}</button>`).join('')}</div><div class="pscroll">${body}</div></div>`
}
