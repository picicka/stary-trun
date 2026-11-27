// Rozhraní v HTML nad plátnem: lišta, panely, okna, menu, tutoriál.
import {
  BUILDINGS, BUILDING_IDS, DIFFICULTY, IMPROVEMENTS, PILLAGE_GOLD, NATIONS, PLAYABLE, RESOURCES, TECHS, TECH_IDS, TERRAIN, UNITS, UNIT_IDS, BRANCHES, BRANCH_IDS, branchOf,
  type BuildingId, type Difficulty, type ImprovementId, type NationId, type TechId, type UnitId,
} from '../game/data.ts'
import { adviseTech, describeAI, recommendBuild, siteScore } from '../game/ai.ts'
import { attitudeWord, buyBlock, buyPrice, DEAL_TURNS, GIFT, saleBlock, salePrice, TRADABLE } from '../game/diplo.ts'
import { ERAS, GOLDEN_TURNS, PERSONAS, PROMOS, type PersonaId, PROMO_IDS, ROAD, SCENARIOS, SCENARIO_IDS, TRADITIONS, TRADITION_IDS, XP_LEVELS, traditionCost, type ScenarioId, type TraditionId } from '../game/data.ts'
import { generateScenario, ISLANDS_SEEDS, mapSize, TIERS, tierOf, VALLEY_SEEDS, type Landform } from '../game/mapgen.ts'
import { hexCenter } from '../game/hex.ts'
import {
  CONQUEST_TURNS, WONDER_TURNS, SIEGE_UNITS, besieged, wonderCity, wonderLeft, seatCount,
  atWar, availableBuilds, availableTechs, borderCost, borderOptions, borderTarget, popCap, openTraditions, branchDone, buyCost, buyItemBlock, buyItemCost, canBuy, canFoundCity, cityAt, attackBlock, PROMO_NO_MOVES, cityWalls, wallMax, WALL_MELEE, WALL_RANGED, cityMaxHp, citiesOf, cityStrength, cityYields, cultureSources, freeUnits, growthNeed, hasTech, idx,
  cityTargets, escortBlock, escortOf, wardOf, isCivilian, isEmbarked, isNaval, isWater, itemCost, itemName, maxMoves, militaryPower, sameItem, playerIncome, previewAttack, resourceVisible, score, tileYield, unitBlockReason, unitStrength,
  unitsAt, unitsOf, UNITS_PER_SOURCE, resourceReport, unitsNeeding, traditionAdvice, techPath, foundBlock, isCoastal, traditionReady, pendingPromos, techCost, unitSize, formationName, FORMATION, mergeTargets, splitBlock, tileJobs, jobInfo, recommendJob, pillageBlock, upgradeBlock, upgradeCost, upgradeTarget, xpLevel,
} from '../game/rules.ts'
import { actors, canAct, hasSave, START_TECH } from '../game/state.ts'
import { CHAT_MAX, cleanCode } from '../net/session.ts'
import { tipKey } from '../game/commands.ts'
import { barbId, type BuildItem, type City, type CityFocus, type Note, type Unit } from '../game/types.ts'
import { isMusicOn, isMuted, setMusic, setMuted, sfx } from '../audio.ts'
import type { App } from '../app.ts'
import { cityIconUrl, unitIconUrl } from '../view/nationArt.ts'
import { pediaHtml, PEDIA_TABS, techArtUrl, type PediaTab } from './pedia.ts'

/** Složka s obrázky rozhraní včetně základní adresy webu. */
export const UI = `${import.meta.env.BASE_URL}assets/ui/`
const NB = ' '
/** Česká typografie: pevná mezera za jednopísmennými předložkami a spojkami a mezi číslem a jednotkou. */
export function typo(s: string): string {
  return s
    .replace(/(^|[\s(„>])([ksvzouaiKSVZOUAI])[ \t]+(?=\S)/g, `$1$2${NB}`)
    .replace(/(\d)[ \t]+(?=[%\p{L}])/gu, `$1${NB}`)
    .replace(/ - /g, ' – ')
}
export const esc = (s: string) => typo(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** Atribut s bublinovou nápovědou. Tvar „Nadpis|text“, řádky odděluje \n. */
export const tip = (s: string) => ` data-tip="${typo(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`
export const ic = (n: string, cls = '') => `<img class="ic ${cls}" src="${UI}ic_${n}.png" alt="">`
/** Body pohybu mohou být po cestách půlené. */
const mv = (n: number) => String(Math.round(n * 2) / 2).replace('.', ',')
/** Žárovka u doporučené volby. */
const REC = `<img class="rec-ic" src="${import.meta.env.BASE_URL}assets/ui/ic_tip.png" alt="tip">`
const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const turnsWord = (n: number) => (n === 1 ? 'tah' : n >= 2 && n <= 4 ? 'tahy' : 'tahů')

function h<T extends HTMLElement = HTMLDivElement>(tag: string, attrs: Record<string, string> = {}, html = ''): T {
  const e = document.createElement(tag) as T
  for (const k in attrs) e.setAttribute(k, attrs[k])
  e.innerHTML = html
  return e
}

interface Tip { id: string; title: string; text: string }

export class Hud {
  private root = document.getElementById('ui')!
  private top = h('div', { id: 'topbar', class: 'hidden' })
  private notes = h('div', { id: 'notes' })
  private labels = h('div', { id: 'labels' })
  private unitPanel = h('div', { id: 'unitpanel', class: 'panel hidden' })
  private tileInfo = h('div', { id: 'tileinfo', class: 'hidden' })
  private corner = h('div', { id: 'corner', class: 'hidden' })
  private mini = h<HTMLCanvasElement>('canvas', { id: 'minimap', width: '212', height: '136' })
  private endBtn = h<HTMLButtonElement>('button', { id: 'endturn', class: 'btn' })
  private cityPanel = h('div', { id: 'city', class: 'panel hidden' })
  private tip = h('div', { id: 'tip', class: 'panel hidden' })
  private waiting = h('div', { id: 'waiting', class: 'hidden' }, 'Soupeři táhnou…')
  private modal = h('div', { id: 'modal', class: 'hidden' })
  private menu = h('div', { id: 'menu' })
  private tipBox = h('div', { id: 'tooltip', class: 'hidden' })
  /** Chat síťové hry: zprávy této hry (jen v paměti), počet nepřečtených a okno, které se nepřekresluje s ostatním rozhraním. */
  private chat = h('div', { id: 'chat', class: 'panel hidden' })
  private chatLog: { from: number; text: string }[] = []
  private chatUnread = 0
  private chatOn = false
  private overview = h('div', { id: 'overview', class: 'panel hidden' })
  private overviewOn = (() => { try { return localStorage.getItem('hex4x-overview') === '1' } catch { return false } })()
  private tipFor: HTMLElement | null = null
  private cityLabels = new Map<number, HTMLElement>()
  private read = new WeakSet<Note>()
  private hoverXY: [number, number] = [-1, -1]
  private toastTimer = 0
  private modalKind = ''
  private pickNation: NationId = 'aur'
  private pickDiff: Difficulty = 'normal'
  private pickScenario: ScenarioId = 'valley'
  private setupStep = 0
  /** Kolik lidí hraje u jednoho počítače a které národy si už vybrali. */
  private pickHumans = 1
  private picks: NationId[] = []
  /** Národů ve hře celkem (lidé + soupeři vedení počítačem). */
  private pickNations = 3
  private pickTurns = 160
  /** Síťová hra: hráči, kteří se ještě nepotkali, táhnou zároveň. */
  private pickSimul = true
  private pickLand: Landform = 'continent'
  private pickSize: -1 | 0 | 1 = 0
  private pickBarb: 0 | 1 | 2 | 3 = 2
  /** Kód náhodné mapy; prázdný = pokaždé jiná. */
  private pickSeed = ''
  /** Nastavuje se hra po síti (hráči se připojí v místnosti) místo hry u jednoho počítače. */
  private netMode = false
  private netCode = ''

  private app: App

  constructor(app: App) {
    this.app = app
    this.corner.append(this.mini, this.endBtn)
    this.root.append(this.labels, this.top, this.notes, this.unitPanel, this.tileInfo, this.corner, this.cityPanel, this.tip, this.overview, this.chat, this.waiting, this.modal, this.menu, this.tipBox)
    this.root.addEventListener('mouseover', e => this.showTip((e.target as HTMLElement).closest<HTMLElement>('[data-tip]')))
    this.root.addEventListener('mouseleave', () => this.showTip(null))
    this.root.addEventListener('pointerdown', () => this.showTip(null), { capture: true })
    this.endBtn.onclick = e => this.app.mainAction((e as MouseEvent).shiftKey)
    this.mini.onpointerdown = e => this.miniClick(e)
    this.mini.onpointermove = e => { if (e.buttons & 1) this.miniClick(e) }
    this.root.addEventListener('click', e => this.onClick(e))
    this.root.addEventListener('input', e => { const el = e.target as HTMLInputElement; if (el.id === 'seed') this.pickSeed = el.value.replace(/\D/g, '').slice(0, 6)
      else if (el.id === 'netname') this.app.playerName = el.value
      else if (el.id === 'netcode') { this.netCode = cleanCode(el.value); if (el.value !== this.netCode) el.value = this.netCode }
    })
    this.root.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.target as HTMLElement).id === 'netcode') { sfx('click'); void this.app.joinGame(this.netCode) } })
    this.chat.innerHTML = `<h2>${ic('chat', 's')}Chat<button class="x" data-a="chat" data-tip="Zavřít chat">✕</button></h2><div class="log"></div><input id="chatin" type="text" maxlength="${CHAT_MAX}" autocomplete="off" placeholder="Napište zprávu a stiskněte Enter">`
    this.chat.addEventListener('keydown', e => {
      e.stopPropagation()
      const inp = e.target as HTMLInputElement
      if (e.key === 'Escape') { inp.blur(); this.toggleChat(false) }
      else if (e.key === 'Enter' && inp.value.trim()) { this.app.say(inp.value.trim()); inp.value = '' }
    })
    this.root.addEventListener('wheel', e => { if (!(e.target as HTMLElement).closest('.body, .inner, .log, #menu')) e.preventDefault() }, { passive: false })
  }

  // ------------------------------------------------------------ bublinová nápověda

  private showTip(el: HTMLElement | null): void {
    if (el === this.tipFor) return
    this.tipFor = el
    const raw = el?.dataset.tip
    if (!el || !raw) { this.tipBox.classList.add('hidden'); return }
    const cut = raw.indexOf('|')
    const safe = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    this.tipBox.innerHTML = cut >= 0 ? `<b>${safe(raw.slice(0, cut))}</b>${safe(raw.slice(cut + 1))}` : safe(raw)
    this.tipBox.classList.remove('hidden')
    const r = el.getBoundingClientRect()
    const w = this.tipBox.offsetWidth, hh = this.tipBox.offsetHeight
    const W = window.innerWidth, H = window.innerHeight
    let x: number, y: number
    if (r.width > 240 && r.right + 10 + w < W) { x = r.right + 10; y = r.top }
    else { x = r.left + r.width / 2 - w / 2; y = r.bottom + 8; if (y + hh > H - 6) y = r.top - hh - 8 }
    this.tipBox.style.left = `${Math.round(Math.max(6, Math.min(W - w - 6, x)))}px`
    this.tipBox.style.top = `${Math.round(Math.max(6, Math.min(H - hh - 6, y)))}px`
  }

  private unitTip(id: UnitId): string {
    const d = UNITS[id]
    const l = [d.desc, `Cena ${d.cost} výroby · pohyb ${d.move}${d.str ? ` · síla ${d.str}` : ''}${d.ranged ? ` · střelba ${d.ranged} na ${d.range} pole` : ''}`]
    if (d.needs) l.push(`Vyžaduje surovinu: ${RESOURCES[d.needs].name}. Každý zdroj (ložisko s vylepšením na vašem území, nebo koupě) uživí ${UNITS_PER_SOURCE} takové jednotky.`)
    if (d.replaces) l.push(`Unikátní jednotka vašeho národa (místo: ${UNITS[d.replaces].name}).`)
    if (d.naval) l.push('Loď: staví se jen v pobřežním městě a pluje jen po vodě.')
    if (!d.civilian) l.push('Vojsko nad volný limit stojí 1 zlato za tah.')
    return `${d.name}|${l.join('\n')}`
  }

  private buildingTip(id: BuildingId): string {
    const d = BUILDINGS[id]
    return `${d.name}|${d.desc}\nCena ${d.cost} výroby${d.maint ? ` · údržba ${d.maint} zlato za tah` : ' · bez údržby'}`
  }

  private techTip(id: TechId): string {
    const d = TECHS[id]
    const un: string[] = []
    for (const u of UNIT_IDS) if (UNITS[u].tech === id && (!UNITS[u].nation || UNITS[u].nation === this.pickedNation)) un.push(`jednotka ${UNITS[u].name}`)
    for (const b of BUILDING_IDS) if (BUILDINGS[b].tech === id) un.push(`budova ${BUILDINGS[b].name} (${BUILDINGS[b].desc})`)
    for (const i of Object.keys(IMPROVEMENTS) as ImprovementId[]) if (IMPROVEMENTS[i].tech === id) un.push(`vylepšení ${IMPROVEMENTS[i].name}`)
    const extra: Partial<Record<TechId, string>> = {
      bronze: 'na mapě se objeví ložiska železa; dělníci mohou mýtit les (jednorázová výroba pro město)', wheel: 'dělníci mohou stavět cesty (pohyb za půl bodu; řeku cesta překlene až se Stavitelstvím)', irrigation: 'farmy u řeky dávají +1 jídlo', calendar: 'kdo dostaví Sluneční chrám a udrží ho, vyhrává misi',
      construction: 'cesty na vašem území překlenou řeku mostem', tactics: 'dvě stejné jednotky se mohou spojit v šik', armory: 'tři stejné jednotky se mohou spojit ve voj', commerce: 'trhové vsi dávají +1 zlato navíc ve městě spojeném cestou nebo přístavem s hlavním městem',
      empire: 'každé dokončení přidá +1 zlato za tah v každém městě; další kolo je dražší',
      fishing: 'nalodění dělníci stavějí loviště na pobřežních polích s rybami',
      sailing: 'pozemní jednotky se mohou nalodit a plout po pobřežních vodách', navigation: 'naloděné jednotky smějí na oceán a plují rychleji',
    }
    if (extra[id]) un.push(extra[id]!)
    return `${d.name}|Cena: ${d.cost} bodů vědy${d.req.length ? `\nVyžaduje: ${d.req.map(r => TECHS[r].name).join(', ')}` : ''}\nOdemyká: ${un.join('; ') || d.unlocks}`
  }

  private get pickedNation(): NationId { return this.app.inGame ? this.me.nation : this.pickNation }

  get modalOpen(): boolean { return !this.modal.classList.contains('hidden') }
  private get s() { return this.app.state }
  private get me() { return this.app.state.players[this.app.me] }
  /** Id hráče, který se na hru dívá. */
  private get my(): number { return this.app.me }
  /** Ostatní národy (bez barbarů). */
  private get rivals() { return this.s.players.filter(p => p.id !== barbId(this.s) && p.id !== this.my) }

  // ------------------------------------------------------------ delegované kliky

  private onClick(e: Event): void {
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')
    if (!el || (el as HTMLButtonElement).disabled) return
    const a = el.dataset.a!
    const arg = el.dataset.v ?? ''
    const app = this.app
    switch (a) {
      case 'unit': app.unitAction(arg); break
      case 'tech-open': sfx('click'); this.showTech(); break
      case 'temple': { const c = wonderCity(this.s); if (c && !app.busy) { sfx('select'); app.scene.centerOn(c.x, c.y); app.scene.ping(c.x, c.y) } break }
      case 'overview': sfx('click'); this.toggleOverview(); break
      case 'chat': sfx('click'); this.toggleChat(); break
      case 'ring': app.ring(); break
      case 'ov-city': { const c = this.s.cities.find(o => o.id === Number(arg)); if (c && !app.busy) { sfx('select'); app.openCity(c) } break }
      case 'ov-tile': { const i = Number(arg); if (!app.busy) { sfx('select'); app.scene.centerOn(i % this.s.W, (i / this.s.W) | 0); app.scene.ping(i % this.s.W, (i / this.s.W) | 0) } break }
      case 'ov-unit': { const u = this.s.units.find(o => o.id === Number(arg)); if (u && !app.busy) { sfx('select'); app.select(u, true) } break }
      case 'trad-open': sfx('click'); this.showTraditions(); break
      case 'trad': app.chooseTradition(arg as TraditionId); if (traditionReady(this.me)) this.showTraditions(); else this.closeModal(); break
      case 'tech': app.chooseTech(arg as TechId, (e as MouseEvent).shiftKey); this.showTech(); break
      case 'mission': sfx('click'); this.showMission(); break
      case 'diplo': sfx('click'); this.showDiplo(); break
      case 'help': sfx('click'); this.showHelp(); break
      case 'log-toggle': sfx('click'); app.setLog(!app.logOn); this.showHelp(); break
      case 'log-save': sfx('click'); app.downloadLog(); break
      case 'pedia': sfx('click'); this.showPedia(arg); break
      case 'close': sfx('click'); this.closeModal(); break
      case 'seat': this.seatTaken(); break
      case 'city-close': app.openCity(null); break
      case 'build': {
        const c = app.city
        if (!c) break
        const [kind, id] = arg.split(':')
        app.chooseBuild(c, { kind, id } as BuildItem, (e as MouseEvent).shiftKey)
        break
      }
      case 'q-del': if (app.city) app.queueRemove(app.city, Number(arg)); break
      case 'q-up': if (app.city) app.queuePromote(app.city, Number(arg)); break
      case 'guide': sfx('click'); this.showGuide(Number(arg)); break
      case 'dip': { const [kind, pid, x] = arg.split(':'); this.showDiplo(app.diplo(kind, Number(pid), x ?? '')); break }
      case 'tip-open': this.tipOpen = !this.tipOpen; sfx('click'); this.renderTip(); break
      case 'buy': if (app.city) app.buyNow(app.city); break
      case 'buy-item': { const [kind, id] = arg.split(':'); if (app.city) app.buyNow(app.city, { kind, id } as BuildItem); break }
      case 'advise': if (app.city) app.advise(app.city); break
      case 'focus': if (app.city) app.focusCity(app.city, (arg || null) as CityFocus | null); break
      case 'border': if (app.city) app.borderMode(app.city, arg as 'auto' | 'manual'); break
      case 'mute': setMuted(!isMuted()); this.render(); break
      case 'music': setMusic(!isMusicOn()); sfx('click'); this.render(); break
      case 'zoom': app.scene.zoomBy(Number(arg)); break
      case 'menu': this.confirm('Odejít do hlavního menu?', !app.net ? 'Hra je průběžně ukládána, můžete v ní později pokračovat.' : app.net.role === 'host' ? 'Hru po síti tím přerušíte všem. Zůstane uložená: až zvolíte Pokračovat, místnost se otevře znovu a spoluhráči se vrátí stejným kódem.' : 'Ze hry odejdete. Dokud ji hostitel má otevřenou, můžete se z hlavního menu vrátit na své místo.', 'Odejít', () => app.quitToMenu()); break
      case 'tip-ok': this.tipOpen = false; sfx('click'); this.app.tipRead(arg); break
      case 'tip-off': app.toggleHints(false); break
      case 'hints': app.toggleHints(); break
      case 'note': {
        const n = this.s.notes[Number(arg)]
        if (n) { this.read.add(n); if (n.x !== undefined && n.y !== undefined) { app.scene.centerOn(n.x, n.y); app.scene.ping(n.x, n.y) } }
        this.renderNotes()
        break
      }
      case 'citylabel': {
        const c = this.s.cities.find(o => o.id === Number(arg))
        if (c && c.owner === this.my && !app.busy) { sfx('select'); app.openCity(c) }
        break
      }
      case 'war': this.confirm('Vyhlásit válku?', `Opravdu chcete vyhlásit válku národu ${NATIONS[this.s.players[Number(arg)].nation].name}?`, 'Vyhlásit válku', () => { app.declare(Number(arg)); this.showDiplo() }); break
      case 'peace': { const msg = app.proposePeace(Number(arg)); this.showDiplo(msg) ; break }
      case 'offer-yes': app.answerOffer(Number(arg), true); this.closeModal(); this.checkOffers(); break
      case 'offer-no': app.answerOffer(Number(arg), false); this.closeModal(); this.checkOffers(); break
      case 'm-new': sfx('click'); this.netMode = false; this.setupStep = 0; this.picks = []; this.showSetup(); break
      case 'm-net': sfx('click'); this.showNet(); break
      case 'n-host': sfx('click'); this.netMode = true; this.setupStep = 0; this.picks = []; this.pickNations = Math.max(this.pickNations, 2); this.showSetup(); break
      case 'n-open': {
        sfx('click')
        const random = this.pickScenario === 'random'
        const n = this.pickNations
        void app.hostGame({
          difficulty: this.pickDiff, scenario: this.pickScenario, max: n,
          opts: { nations: n, maxTurns: this.pickTurns, simul: this.pickSimul, map: { barbarians: this.pickBarb, ...(random ? { landform: this.pickLand, size: this.pickSize } : {}) } },
          seed: random && this.pickSeed ? Number(this.pickSeed) : undefined,
          info: `${SCENARIOS[this.pickScenario].name} · ${n} ${n < 5 ? 'národy' : 'národů'} · obtížnost ${DIFFICULTY[this.pickDiff].name.toLowerCase()} · ${this.pickTurns} tahů · ${this.pickSimul ? 'souběžné tahy do setkání' : 'tahy po řadě'}`,
        })
        break
      }
      case 'n-join': sfx('click'); void app.joinGame(this.netCode); break
      case 'n-rejoin': sfx('click'); void app.joinGame(arg); break
      case 'n-pick': sfx('select'); app.net?.pick(arg as NationId); break
      case 'n-start': sfx('found'); app.netStart(); break
      case 'n-bot': { const n = app.net; if (n?.role === 'host') { sfx('click'); n.addBot() } break }
      case 'n-bot-x': { const n = app.net; if (n?.role === 'host') { sfx('click'); n.removeBot(Number(arg)) } break }
      case 'n-bot-n': { const n = app.net; if (n?.role === 'host') { sfx('select'); n.cycleBot(Number(arg)) } break }
      case 'n-leave': sfx('click'); app.leaveNet(); this.showNet(); break
      case 'n-copy': sfx('click'); void navigator.clipboard?.writeText(app.joinUrl).then(() => { el.textContent = 'Zkopírováno' }, () => { this.menu.querySelector<HTMLInputElement>('#neturl')?.select() }); break
      case 'm-next': sfx('click'); this.setupStep = 1; this.picks = []; this.showSetup(); break
      case 'm-humans': this.pickHumans = Number(arg); sfx('click'); this.showSetup(); break
      case 'm-nations': this.pickNations = Number(arg); this.pickHumans = Math.min(this.pickHumans, this.pickNations); sfx('click'); this.showSetup(); break
      case 'm-turns': this.pickTurns = Number(arg); sfx('click'); this.showSetup(); break
      case 'm-simul': this.pickSimul = arg === '1'; sfx('click'); this.showSetup(); break
      case 'm-land': this.pickLand = arg as Landform; sfx('click'); this.showSetup(); break
      case 'm-size': this.pickSize = Number(arg) as -1 | 0 | 1; sfx('click'); this.showSetup(); break
      case 'm-barb': this.pickBarb = Number(arg) as 0 | 1 | 2 | 3; sfx('click'); this.showSetup(); break
      case 'm-back-title': sfx('click'); this.showTitle(); break
      case 'm-continue': sfx('click'); if (!app.continueGame()) this.showTitle(); break
      case 'm-help': sfx('click'); this.showGuide(0); break
      case 'm-back': sfx('click'); if (this.picks.length) { this.pickNation = this.picks.pop()!; this.showSetup() } else if (this.setupStep === 1) { this.setupStep = 0; this.showSetup() } else if (this.netMode) this.showNet(); else this.showTitle(); break
      case 'm-nation': if (!this.picks.includes(arg as NationId)) { this.pickNation = arg as NationId; sfx('select'); this.showSetup() } break
      case 'm-diff': this.pickDiff = arg as Difficulty; sfx('click'); this.showSetup(); break
      case 'm-start': {
        // Hráči si vybírají národ jeden po druhém; po posledním hra začne.
        this.picks.push(this.pickNation)
        if (this.picks.length < this.pickHumans) { sfx('select'); this.pickNation = PLAYABLE.find(n => !this.picks.includes(n))!; this.showSetup(); break }
        sfx('found')
        const nations = this.picks
        this.picks = []
        const random = this.pickScenario === 'random'
        app.newGame(nations, this.pickDiff, this.pickScenario, {
          nations: this.pickNations, maxTurns: this.pickTurns,
          map: { barbarians: this.pickBarb, ...(random ? { landform: this.pickLand, size: this.pickSize } : {}) },
        }, random && this.pickSeed ? Number(this.pickSeed) : undefined)
        break
      }
      case 'm-scen': this.pickScenario = arg as ScenarioId; sfx('select'); this.showSetup(); break
      case 'over-menu': this.modalKind = ''; this.closeModal(); app.quitToMenu(); break
    }
  }

  // ------------------------------------------------------------ menu

  showTitle(): void {
    this.setGameUi(false)
    this.modal.classList.add('hidden')
    this.menu.className = ''
    this.menu.innerHTML = `
      <div class="title"><h1>STARÝ TRŮN</h1><div class="subtitle">${esc('Hexová tahová strategie o dědictví staré říše')}</div></div>
      <div class="buttons">
        ${hasSave() ? `<button class="btn" data-a="m-continue">Pokračovat v${NB}misi</button>` : ''}
        ${this.app.rejoinCode ? `<button class="btn" data-a="n-rejoin" data-v="${this.app.rejoinCode}">Vrátit se do hry po síti</button>` : ''}
        <button class="btn" data-a="m-new">Nová hra</button>
        <button class="btn" data-a="m-net">Hra po síti</button>
        <button class="btn" data-a="m-help">Jak hrát</button>
        <button class="btn" data-a="pedia" data-v="units">Encyklopedie</button>
      </div>
      <div class="credit">Tři scénáře · osm národů · až osm hráčů</div>`
  }

  // ------------------------------------------------------------ hra po síti

  /** Rozcestník síťové hry: založit místnost, nebo se připojit kódem. */
  showNet(code = '', err = ''): void {
    if (code) this.netCode = cleanCode(code)
    this.setGameUi(false)
    this.modalKind = ''
    this.modal.classList.add('hidden')
    this.menu.className = 'setup'
    const back = this.app.rejoinCode
    this.menu.innerHTML = `
      <h2>Hra po síti</h2>
      <div class="lead">${esc('Jeden z vás hru založí a ostatním pošle kód místnosti nebo odkaz. Hraje se napřímo mezi vašimi prohlížeči, bez herního serveru. Tahy se střídají: kdo není na řadě, dívá se.')}</div>
      ${err ? `<div class="neterr">${esc(err)}</div>` : ''}
      <div class="setuprow"><span>Vaše jméno:</span><input id="netname" class="seed wide" maxlength="20" placeholder="jak vás uvidí ostatní" value="${esc(this.app.playerName).replace(/"/g, '&quot;')}"></div>
      <div class="netbox">
        <div class="panel"><h3>Založit hru</h3><p>${esc('Zvolíte mapu a pravidla, otevřete místnost a počkáte na spoluhráče. Místa, která neobsadí lidé, povede počítač.')}</p>
          <button class="btn big" data-a="n-host">Založit hru</button></div>
        <div class="panel"><h3>Připojit se</h3><p>${esc('Zadejte kód, který vám poslal hostitel.')}</p>
          <div class="setuprow"><input id="netcode" class="seed code" maxlength="5" placeholder="KÓD" autocomplete="off" spellcheck="false" value="${this.netCode}"><button class="btn big" data-a="n-join">Připojit se</button></div>
          ${back && back !== this.netCode ? `<button class="btn" data-a="n-rejoin" data-v="${back}">Vrátit se do hry ${back}</button>` : ''}</div>
      </div>
      <div class="setuprow"><button class="btn big" data-a="m-back-title">Zpět</button></div>`
  }

  showConnecting(text: string): void {
    this.setGameUi(false)
    this.menu.className = 'setup'
    this.menu.innerHTML = `<h2>Hra po síti</h2><div class="lead" style="margin-top:18vh;font-size:26px">${esc(text)}</div><div class="setuprow"><button class="btn big" data-a="n-leave">Zrušit</button></div>`
  }

  /** Místnost: kdo je připojen, výběr národů; hostitel odtud hru spouští. */
  showLobby(): void {
    const net = this.app.net
    const l = net?.lobby()
    if (!net || !l) return
    this.setGameUi(false)
    this.menu.className = 'setup'
    const host = net.role === 'host'
    const mine = l.members[l.you]?.nation ?? PLAYABLE[0]
    const rows = l.members.map((m, i) => {
      const n = NATIONS[m.nation]
      return `<div class="member" style="--c:${n.css}"><img src="${UI}em_${m.nation}.png" alt=""><b>${esc(m.name)}</b><span>${n.name}</span><small>${[m.host ? 'hostitel' : '', i === l.you ? 'vy' : ''].filter(Boolean).join(', ')}</small></div>`
    }).join('') + l.bots.map((b, i) => {
      const n = NATIONS[b]
      return `<div class="member bot" style="--c:${n.css}"><img src="${UI}em_${b}.png" alt=""><b>Počítač</b><span>${n.name}</span><small>${esc(PERSONAS[n.persona].name.toLowerCase())}</small>${host ? `<button class="btn" data-a="n-bot-n" data-v="${i}"${tip('Jiný národ|Dá soupeři další volný národ.')}>Jiný národ</button><button class="btn" data-a="n-bot-x" data-v="${i}"${tip('Odebrat soupeře')}>✕</button>` : ''}</div>`
    }).join('')
    const free = l.max - l.members.length - l.bots.length
    const tiles = PLAYABLE.map(id => {
      const n = NATIONS[id]
      const by = l.members.findIndex(m => m.nation === id)
      const bot = l.bots.includes(id)
      const taken = bot || (by >= 0 && by !== l.you)
      return `<button class="ntile panel small ${id === mine ? 'sel' : ''} ${taken ? 'taken' : ''}" style="--c:${n.css}" data-a="n-pick" data-v="${id}" ${taken ? `disabled${tip(bot ? 'Tento národ vede počítač.' : `Tento národ si vybral hráč ${l.members[by].name}.`)}` : ''}>
        <img class="p" src="${UI}p_${id}.png" alt=""><span><img class="e" src="${UI}em_${id}.png" alt="">${n.name}</span></button>`
    }).join('')
    const n = NATIONS[mine], u = UNITS[n.unique]
    const detail = `<div class="ndetail panel" style="--c:${n.css}">
        <img class="p" src="${UI}p_${mine}.png" alt="">
        <div class="who"><h3><img class="e" src="${UI}em_${mine}.png" alt="">${n.name}</h3><div class="leader">${esc(`${n.leader}, ${n.title.toLowerCase()}`)}</div><div class="lore">${esc(n.lore)}</div></div>
        <div class="traits"><div class="trait"><b>${esc(n.trait)}</b>${esc(n.traitDesc)}</div>
          <div class="trait"><img src="${unitIconUrl(n.unique, mine)}" alt=""><b>${esc(u.name)}</b>${esc(u.desc)}${u.replaces ? ` (místo: ${UNITS[u.replaces].name})` : ''}</div></div>
      </div>`
    const scroll = this.menu.scrollTop
    this.menu.innerHTML = `
      <h2>Místnost <span class="roomcode">${l.code}</span></h2>
      <div class="lead">${esc(l.info)}</div>
      ${host ? `<div class="setuprow"><span>Pošlete spoluhráčům kód nebo odkaz:</span><input id="neturl" class="seed url" readonly value="${this.app.joinUrl}"><button class="btn" data-a="n-copy">Kopírovat odkaz</button></div>` : ''}
      <div class="members">${rows}</div>
      ${host && free > 0 ? `<div class="setuprow"><button class="btn" data-a="n-bot"${tip('Přidat soupeře|Obsadí jedno volné místo národem, který povede počítač. Národ pak můžete změnit.')}>Přidat soupeře vedeného počítačem</button></div>` : ''}
      <div class="setupinfo">${esc(free > 0 ? `${free === 1 ? 'Zbývá jedno volné místo' : free < 5 ? `Zbývají ${free} volná místa` : `Zbývá ${free} volných míst`} pro další hráče. Co při spuštění zůstane volné, povede počítač s vylosovaným národem.` : l.bots.length ? 'Všechna místa jsou obsazená.' : 'Všechna místa jsou obsazená lidmi.')}</div>
      <div class="ntiles">${tiles}</div>
      ${detail}
      <div class="setupinfo">${esc(host ? (l.members.length < 2 ? 'Počkejte, až se připojí aspoň jeden spoluhráč.' : 'Až budou všichni připraveni, spusťte hru. Později už se nikdo nový nepřipojí.') : 'Vyberte si národ a počkejte, až hostitel hru spustí.')}</div>
      <div class="setuprow"><button class="btn big" data-a="n-leave">${host ? 'Zavřít místnost' : 'Odejít'}</button>${host ? `<button class="btn big" data-a="n-start" ${l.members.length < 2 ? 'disabled' : ''}>Spustit hru</button>` : ''}</div>`
    this.menu.scrollTop = scroll
  }

  private showSetup(): void {
    this.menu.className = 'setup'
    if (this.netMode) this.pickHumans = 1
    const multi = this.pickHumans > 1
    if (this.picks.includes(this.pickNation)) this.pickNation = PLAYABLE.find(n => !this.picks.includes(n))!
    const who = this.picks.length + 1
    const last = who >= this.pickHumans
    const seg = (a: string, cur: string | number, opts: [string | number, string][]) => `<div class="seg">${opts.map(([v, label]) => `<button class="${v === cur ? 'on' : ''}" data-a="${a}" data-v="${v}">${label}</button>`).join('')}</div>`
    const tiles = PLAYABLE.map(id => {
      const n = NATIONS[id]
      const taken = this.picks.indexOf(id)
      return `<button class="ntile panel ${id === this.pickNation ? 'sel' : ''} ${taken >= 0 ? 'taken' : ''}" style="--c:${n.css}" data-a="m-nation" data-v="${id}" ${taken >= 0 ? `disabled${tip(`Tento národ si vybral ${taken + 1}. hráč.`)}` : ''}>
        <img class="p" src="${UI}p_${id}.png" alt=""><span><img class="e" src="${UI}em_${id}.png" alt="">${n.name}</span></button>`
    }).join('')
    const id = this.pickNation, n = NATIONS[id], u = UNITS[n.unique]
    const detail = `<div class="ndetail panel" style="--c:${n.css}">
        <img class="p" src="${UI}p_${id}.png" alt="">
        <div class="who"><h3><img class="e" src="${UI}em_${id}.png" alt="">${n.name}</h3><div class="leader">${esc(`${n.leader}, ${n.title.toLowerCase()}`)}</div><div class="lore">${esc(n.lore)}</div>
          <div class="starts">${ic('sci', 's')}Začíná se znalostí: ${TECHS[START_TECH[id]].name}${id === 'thal' ? ', Plavba' : ''}</div></div>
        <div class="traits"><div class="trait"><b>${esc(n.trait)}</b>${esc(n.traitDesc)}</div>
          <div class="trait"><img src="${unitIconUrl(n.unique, id)}" alt=""><b>${esc(u.name)}</b>${esc(u.desc)}${u.replaces ? ` (místo: ${UNITS[u.replaces].name})` : ''}</div></div>
      </div>`
    const players = this.pickNations
    const [lo, hi] = TIERS[tierOf(players)]
    const scens = SCENARIO_IDS.map(sid => {
      const random = sid === 'random'
      const sz = mapSize(sid, { players, ...(random ? { landform: this.pickLand, size: this.pickSize } : {}) })
      return `<button class="scen panel ${sid === this.pickScenario ? 'sel' : ''}" data-a="m-scen" data-v="${sid}">
        <canvas width="120" height="78" data-scen="${sid}"></canvas><div><h3>${esc(SCENARIOS[sid].name)}</h3><div class="lore">${esc(SCENARIOS[sid].desc)}</div>
        <div class="fit">${esc(random ? `Mapa vznikne přesně pro ${players} ${players < 5 ? 'národy' : 'národů'} · ${sz.W} × ${sz.H} polí` : `Mapa pro ${lo}–${hi} národů · ${sz.W} × ${sz.H} polí`)}</div></div></button>`
    }).join('')
    const scroll = this.menu.scrollTop
    const sd = SCENARIOS[this.pickScenario]
    const ai = players - this.pickHumans
    const humansInfo = this.netMode ? 'Do místnosti se vejde tolik hráčů, kolik je národů. Národy, které si nikdo nevezme, povede počítač (vylosují se ze zbylých).' : `${this.pickHumans === 1 ? 'Hrajete sami' : `U počítače se střídá ${this.pickHumans} hráčů; mezi tahy mapu zakryje opona`}${ai ? ` a ${ai === 1 ? 'jeden národ vede' : ai < 5 ? `${ai} národy vede` : `${ai} národů vede`} počítač (vylosují se ze zbylých).` : '. Všechny národy vedou lidé.'}`
    const randomRows = this.pickScenario !== 'random' ? '' : `
      <div class="setuprow"><span>Krajina:</span>${seg('m-land', this.pickLand, [['continent', 'Pevnina'], ['continents', 'Kontinenty'], ['islands', 'Souostroví']])}
        <span>Velikost:</span>${seg('m-size', this.pickSize, [[-1, 'Menší'], [0, 'Běžná'], [1, 'Větší']])}
        <span${tip('Kód mapy|Číslo, ze kterého mapa vzniká. Stejný kód a stejné nastavení dají stejnou zemi – hodí se na odvetu. Prázdné pole = pokaždé jiná mapa; kód odehrané hry najdete v okně Mise.')}>Kód mapy:</span><input id="seed" class="seed" inputmode="numeric" maxlength="6" placeholder="náhodný" value="${this.pickSeed}"></div>
      <div class="setupinfo">${esc({ continent: 'Jeden členitý kontinent: všichni jsou propojeni po souši.', continents: 'Několik pevnin oddělených mořem: sousedy máte po souši, zbytek světa až za vodou.', islands: 'Každý národ na vlastním ostrově: bez lodí se nikam nedostanete.' }[this.pickLand])}</div>`
    this.menu.innerHTML = this.setupStep === 0 ? `
      <h2>${this.netMode ? 'Nová hra po síti' : 'Nová hra'}</h2>
      <div class="lead">${esc('Stará říše padla a její trůn osiřel. Kolik národů se o něj utká a kde?')}</div>
      <div class="setuprow"><span>Národů ve hře:</span>${seg('m-nations', players, [2, 3, 4, 5, 6, 7, 8].map(k => [k, String(k)]))}
        ${this.netMode ? '' : `<span>Z${NB}toho lidí:</span>${seg('m-humans', this.pickHumans, Array.from({ length: players }, (_, k) => [k + 1, String(k + 1)]))}`}</div>
      <div class="setupinfo">${esc(humansInfo)}</div>
      <div class="scens">${scens}</div>${randomRows}
      <div class="setuprow"><span>Obtížnost:</span>${seg('m-diff', this.pickDiff, (Object.keys(DIFFICULTY) as Difficulty[]).map(d => [d, DIFFICULTY[d].name]))}
        <span>Délka hry:</span>${seg('m-turns', this.pickTurns, [[80, 'Krátká 80'], [120, 'Střední 120'], [160, 'Plná 160']])}
        <span>Barbaři:</span>${seg('m-barb', this.pickBarb, [[0, 'Žádní'], [1, 'Málo'], [2, 'Běžně'], [3, 'Hodně']])}</div>
      <div class="setupinfo">${esc(`${DIFFICULTY[this.pickDiff].desc} Hra trvá nejvýš ${this.pickTurns} tahů, pak rozhodne skóre.${this.pickTurns < 160 ? ' Na Sluneční chrám a na vítězství dobytím je kratší hra obvykle příliš krátká.' : ''}`)}</div>
      ${this.netMode ? `<div class="setuprow"><span>Tahy:</span>${seg('m-simul', this.pickSimul ? '1' : '0', [['1', 'Souběžné do setkání'], ['0', 'Po řadě']])}</div>
      <div class="setupinfo">${esc(this.pickSimul ? 'Hráči, kteří se ještě nepotkali, táhnou zároveň – nikdo nečeká. Kdo se potká, od dalšího tahu se s tím druhým střídá.' : 'Hráči táhnou jeden po druhém od začátku hry.')}</div>` : ''}
      <div class="setuprow"><button class="btn big" data-a="m-back">Zpět</button>${this.netMode ? '<button class="btn big" data-a="n-open">Otevřít místnost</button>' : '<button class="btn big" data-a="m-next">Dál: výběr národa</button>'}</div>` : `
      <h2>${multi ? `${who}. hráč: vyberte svůj národ` : 'Vyberte svůj národ'}</h2>
      <div class="lead">${esc(`${sd.name}, ${players} ${players < 5 ? 'národy' : 'národů'}, obtížnost ${DIFFICULTY[this.pickDiff].name.toLowerCase()}. Každý národ má jednu výjimečnou vlastnost a jednu unikátní jednotku.`)}</div>
      <div class="ntiles">${tiles}</div>
      ${detail}
      <div class="setupinfo">${esc(multi ? `Vybráno: ${this.picks.map((x, k) => `${k + 1}. hráč – ${NATIONS[x].name}`).join(', ') || 'zatím nikdo'}.` : ai ? 'Soupeři se vylosují ze zbylých národů.' : '')}</div>
      <div class="setuprow"><button class="btn big" data-a="m-back">Zpět</button><button class="btn big" data-a="m-start">${last ? 'Začít hru' : `Dál: ${who + 1}. hráč`}</button></div>`
    this.menu.scrollTop = scroll
    this.drawScenarioPreviews()
  }

  private previewCache = new Map<string, { W: number; H: number; cols: string[] }>()

  /** Malý náhled mapy scénáře ve velikosti pro zvolený počet národů; náhodná země zůstává tajemstvím. */
  private drawScenarioPreviews(): void {
    for (const cv of this.menu.querySelectorAll<HTMLCanvasElement>('canvas[data-scen]')) {
      const id = cv.dataset.scen as ScenarioId
      const g = cv.getContext('2d')!
      g.fillStyle = '#0b1020'; g.fillRect(0, 0, cv.width, cv.height)
      if (id === 'random') {
        g.fillStyle = '#1f4f9c'; g.fillRect(0, 0, cv.width, cv.height)
        g.fillStyle = '#f2c230'; g.font = '48px VT323, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'
        g.fillText('?', cv.width / 2, cv.height / 2 + 2)
        continue
      }
      const key = `${id}:${tierOf(this.pickNations)}`
      let pv = this.previewCache.get(key)
      if (!pv) {
        const sc = generateScenario((id === 'valley' ? VALLEY_SEEDS : ISLANDS_SEEDS)[tierOf(this.pickNations)], id, { players: this.pickNations })
        const cols = sc.tiles.map(t => (t.special === 'ruins' ? '#f2c230' : t.forest ? '#2f7a3a' : Hud.MINI[t.t]))
        for (const [x, y] of sc.starts) cols[y * sc.W + x] = '#ffffff'
        pv = { W: sc.W, H: sc.H, cols }
        this.previewCache.set(key, pv)
      }
      const cw = cv.width / (pv.W + 0.5), ch = cv.height / pv.H
      for (let i = 0; i < pv.cols.length; i++) {
        const x = i % pv.W, y = (i / pv.W) | 0
        g.fillStyle = pv.cols[i]; g.fillRect(x * cw + (y & 1) * cw / 2, y * ch, cw + 0.5, ch + 0.5)
      }
    }
  }

  private setGameUi(on: boolean): void {
    for (const e of [this.top, this.corner]) e.classList.toggle('hidden', !on)
    if (!on) for (const e of [this.unitPanel, this.tileInfo, this.cityPanel, this.tip, this.overview, this.waiting]) e.classList.add('hidden')
    this.notes.classList.toggle('hidden', !on)
    this.labels.classList.toggle('hidden', !on)
    this.menu.classList.toggle('hidden', on)
  }

  enterGame(): void {
    this.setGameUi(true)
    for (const el of this.cityLabels.values()) el.remove()
    this.cityLabels.clear()
    this.read = new WeakSet()
    // Minimapa se přizpůsobí velikosti mapy.
    this.mini.width = 8 + Math.ceil((this.s.W + 0.5) * this.miniCell); this.mini.height = 6 + this.s.H * this.miniCell
    // Po načtení uložené hry nezahlcovat starými zprávami.
    if (this.s.turn > 1) for (const n of this.s.notes) this.read.add(n)
    if (this.modalKind !== 'handover') this.modal.classList.add('hidden')
  }

  // ------------------------------------------------------------ vykreslení

  render(): void {
    if (!this.app.inGame) return
    if (this.tipFor && !this.tipFor.isConnected) this.showTip(null)
    this.renderTop()
    this.renderNotes()
    this.renderUnit()
    this.renderCity()
    this.renderEnd()
    this.renderNet()
    this.renderTip()
    this.renderOverview()
    this.renderLabels()
    this.drawMini()
    this.hover(this.hoverXY[0], this.hoverXY[1])
  }

  private renderTop(): void {
    const s = this.s, p = this.me
    const n = NATIONS[p.nation]
    const inc = playerIncome(s, this.my)
    const cult = citiesOf(s, this.my).reduce((a, c) => a + cityYields(s, c).culture, 0)
    const mil = unitsOf(s, this.my).filter(u => !isCivilian(u)).length
    let research: string
    if (p.research) {
      const t = TECHS[p.research]
      const tc = techCost(p, p.research)
      const left = Math.max(1, Math.ceil((tc - p.progress) / Math.max(1, inc.sci)))
      research = `<div class="research" data-a="tech-open"${tip(`Výzkum: ${t.name}|${p.progress} / ${tc} bodů vědy, hotovo za ${left} ${turnsWord(left)}.\nOdemyká: ${t.unlocks}.${p.techQueue.length ? `\nPotom: ${p.techQueue.map(q => TECHS[q].name).join(' → ')}.` : ''}\nKliknutím otevřete strom technologií (T).`)}>${ic('sci')}<span>${t.name}</span><div class="bar"><i style="width:${Math.min(100, 100 * p.progress / tc)}%"></i></div><small>${left}${NB}${turnsWord(left)}</small></div>`
    } else {
      const any = availableTechs(p).length > 0
      research = `<div class="research ${any && citiesOf(s, this.my).length ? 'need' : ''}" data-a="tech-open"${tip('Výzkum|Kliknutím otevřete strom technologií (T) a zvolte, co zkoumat.')}>${ic('sci')}<span>${any ? 'Zvolte výzkum' : 'Vše objeveno'}</span></div>`
    }
    this.top.innerHTML = `
      <div class="nation" style="color:${n.css}"${tip(`${n.name} – ${n.trait}|${n.traitDesc}\nUnikátní jednotka: ${UNITS[n.unique].name}. ${UNITS[n.unique].desc}`)}><img src="${UI}em_${p.nation}.png" alt="">${n.name}</div>
      <div class="stat"${tip(`Pokladna: ${p.gold} zlata|Města vynášejí: +${inc.gold + inc.maint + inc.upkeep - inc.trade}\nÚdržba budov: −${inc.maint}\nŽold vojska: −${inc.upkeep} (jednotek ${mil}, zdarma ${freeUnits(s, this.my)})${inc.trade ? `\nObchod se surovinami: ${signed(inc.trade)}` : ''}\nCelkem za tah: ${signed(inc.gold)}\nZa zlato lze ve městě dokončit výrobu ihned. Prázdná pokladna brzdí výzkum.`)}>${ic('gold')}${p.gold} <small>${signed(inc.gold)}</small></div>
      <div class="stat"${tip('Věda za tah|Každý obyvatel dává 1 vědu, další přidává hlavní město, knihovny a akademie.')}>${ic('sci')}<small>${signed(inc.sci)}</small></div>
      <div class="stat clickable ${traditionReady(p) ? 'need' : ''}" data-a="trad-open"${tip(`Kultura: ${p.culture} / ${traditionCost(p.traditions.length)}|Města dohromady dávají ${signed(cult)} kultury za tah. Za nastřádanou kulturu si národ vybírá tradice – trvalé výhody (máte ${p.traditions.length}).${traditionReady(p) ? '\nMůžete zvolit novou tradici!' : cult > 0 ? `\nDalší tradice za ${Math.max(1, Math.ceil((traditionCost(p.traditions.length) - p.culture) / cult))} tahů.` : ''}\nKaždé město navíc svou kulturou rozšiřuje hranice. Kliknutím otevřete tradice (C).`)}>${ic('culture')}${p.culture}<small>/${traditionCost(p.traditions.length)}</small></div>
      <div class="stat clickable" data-a="mission"${tip(`${ERAS[p.era].name}|${p.era < ERAS.length - 1 ? `Další věk (${ERAS[p.era + 1].name}) při ${ERAS[p.era + 1].techs} technologiích, máte ${p.techs.length}. Vstup do věku přináší zlato a kulturu; kdo je první, získá zlatý věk.` : 'Dosáhli jste posledního věku.'}${s.turn < p.goldenUntil ? `\nZlatý věk: ještě ${p.goldenUntil - s.turn} tahů (+1 výroba, zlato a kultura v každém městě).` : ''}`)}>${s.turn < p.goldenUntil ? '<b style="color:var(--gold)">★</b> ' : ''}${ERAS[p.era].name.replace(/^Věk | věk$/, '').replace(/^./, ch => ch.toUpperCase())}</div>
      ${research}
      ${this.resourceChips()}
      <div class="stat"${tip(`Tah ${Math.min(s.turn, s.maxTurns)} z ${s.maxTurns}|Po posledním tahu rozhodne o vítězi skóre.`)}>${ic('turn')}${Math.min(s.turn, s.maxTurns)}${NB}/${NB}${s.maxTurns}</div>
      ${this.templeChip()}
      <div class="stat"${tip('Skóre|Technologie 6 bodů, město 12, obyvatel 4, budova 3, pole území 0,5, splněné vedlejší úkoly 20–25.')}>${ic('star')}${score(s, this.my)}</div>
      ${this.netChip()}
      ${this.app.net ? `<button class="tbtn ${this.chatOn ? 'on' : ''}${this.chatUnread ? ' unread' : ''}" data-a="chat"${tip('Chat (Y)|Zprávy mezi hráči této hry.')}>${ic('chat', 's')}${this.chatUnread ? `<b>${this.chatUnread}</b>` : ''}</button><button class="tbtn" data-a="ring"${tip('Zazvonit na ostatní|Ostatním hráčům zazní zvonek a ukáže se, kdo zvoní – hodí se, když se na někoho čeká.')}>${ic('bell', 's')}</button>` : ''}
      <div class="spacer"></div>
      <button class="tbtn ${this.overviewOn ? 'on' : ''}" data-a="overview"${tip('Přehled měst a jednotek (L)|Postranní seznam: co která města stavějí a co dělají jednotky. Kliknutím na řádek na ně skočíte. Zůstává otevřený, dokud ho nevypnete.')}>${ic('pop', 's')}<span class="lbl">Přehled</span></button>
      <button class="tbtn" data-a="mission" data-tip="Cíle mise (M)">${ic('flag', 's')}<span class="lbl">Mise</span></button>
      <button class="tbtn" data-a="diplo"${tip('Diplomacie|Přehled soupeřů, vyhlášení války a nabídka míru.')}>${ic(this.me.war.length ? 'war' : 'peace', 's')}<span class="lbl">Diplomacie</span></button>
      <button class="tbtn ${this.app.hints ? 'on' : ''}" data-a="hints"${tip(`Tipy: ${this.app.hints ? 'zapnuty' : 'vypnuty'} (I)|Žárovka označuje doporučenou volbu: co stavět ve městě, co zkoumat, kterou tradici přijmout, kde založit město a které pole vylepšit. Zapnuté tipy ukazují i rady rádce. Doporučení je jen vodítko – rozhodnutí je vždy na vás.`)}>${this.app.hints ? ic('tip', 's') : `<img class="ic s" src="${UI}ic_tip.png" alt="" style="opacity:.35;filter:grayscale(1)">`}</button>
      <button class="tbtn" data-a="pedia" data-v="units"${tip('Encyklopedie (K)|Jednotky, stavby, výzkum, národy, pole, pravidla a klávesové zkratky.')}>${ic('book', 's')}</button>
      <button class="tbtn" data-a="help" data-tip="Nápověda (H)">${ic('help', 's')}</button>
      <button class="tbtn" data-a="zoom" data-v="-1" data-tip="Oddálit (−)">−</button>
      <button class="tbtn" data-a="zoom" data-v="1" data-tip="Přiblížit (+)">+</button>
      <button class="tbtn" data-a="music" data-tip="Hudba">${isMusicOn() ? '♪' : '<s>♪</s>'}</button>
      <button class="tbtn" data-a="mute" data-tip="Zvuk">${ic(isMuted() ? 'mute' : 'sound', 's')}</button>
      <button class="tbtn" data-a="menu"${tip('Hlavní menu|Hra se ukládá sama, můžete v ní později pokračovat.')}>Menu</button>`
  }

  private netChip(): string {
    const net = this.app.net, l = net?.lobby()
    if (!net || !l) return ''
    const s = this.s
    const rows = l.members.map((m, i) => `${net.online(i) ? '●' : '○'} ${m.name} – ${NATIONS[m.nation].name}${i === l.you ? ' (vy)' : ''}${m.host ? ' (hostitel)' : ''}${net.online(i) ? '' : ' – bez spojení'}${s.players[i]?.away ? ' – hraje počítač' : ''}${s.cur === i && !s.over ? ' – na tahu' : ''}`)
    const off = l.members.some((_, i) => !net.online(i)) || !net.ready
    return `<div class="stat"${tip(`Hra po síti – místnost ${l.code}|${rows.join('\n')}${net.role === 'host' ? '\nHráč, kterému vypadne spojení, se vrátí stejným kódem. Je-li zrovna na tahu, můžete jeho národ předat počítači.' : ''}`)}><b style="color:${off ? 'var(--bad)' : 'var(--good)'}">●</b> ${l.code}</div>`
  }

  // ------------------------------------------------------------ chat

  toggleChat(on = !this.chatOn): void {
    this.chatOn = on && !!this.app.net
    this.chat.classList.toggle('hidden', !this.chatOn)
    if (this.chatOn) { this.chatUnread = 0; this.drawChat(); this.chat.querySelector<HTMLInputElement>('#chatin')?.focus() }
    if (this.app.inGame) this.renderTop()
  }

  /** Nová zpráva (vlastní i cizí). Při zavřeném okně se cizí zpráva ukáže krátce dole a přičte se k nepřečteným. */
  addChat(from: number, text: string): void {
    this.chatLog.push({ from, text })
    if (this.chatLog.length > 200) this.chatLog.shift()
    if (this.chatOn) this.drawChat()
    else if (from !== this.my) { this.chatUnread += 1; this.toast(`${this.chatName(from)}: ${text}`) }
    if (this.app.inGame) this.renderTop()
  }

  clearChat(): void { this.chatLog = []; this.chatUnread = 0; this.toggleChat(false) }

  chatName(pid: number): string { return this.app.seatName(pid) || NATIONS[this.s.players[pid]?.nation]?.name || 'Hráč' }

  private drawChat(): void {
    const log = this.chat.querySelector<HTMLElement>('.log')!
    log.innerHTML = this.chatLog.map(m => `<div><b style="color:${NATIONS[this.s.players[m.from]?.nation]?.css ?? 'var(--text)'}">${esc(this.chatName(m.from))}:</b> ${esc(m.text)}</div>`).join('') || '<div class="sub">Zatím tu nic není. Zprávu uvidí všichni hráči.</div>'
    log.scrollTop = log.scrollHeight
  }

  markNotesRead(): void { for (const n of this.s.notes) if (n.pid === this.my) this.read.add(n) }

  private renderNotes(): void {
    const all = this.s.notes
    const fresh = all.map((n, i) => ({ n, i })).filter(o => o.n.pid === this.my && !this.read.has(o.n)).slice(-7)
    this.notes.innerHTML = fresh.map(o => `<div class="note ${o.n.kind}" data-a="note" data-v="${o.i}"${o.n.x !== undefined ? tip('Kliknutím ukážete místo na mapě.') : ''}>${esc(o.n.text)}</div>`).join('')
  }

  toast(text: string): void {
    this.tileInfo.classList.remove('hidden')
    this.tileInfo.innerHTML = `<span class="pv">${esc(text)}</span>`
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => { this.toastTimer = 0; this.hover(this.hoverXY[0], this.hoverXY[1]) }, 2200)
  }

  private unitIcon(type: UnitId, owner: number): string { return unitIconUrl(type, this.s.players[owner].nation) }

  private renderUnit(): void {
    const u = this.app.unit
    if (!u) { this.unitPanel.classList.add('hidden'); return }
    const s = this.s
    const d = UNITS[u.type]
    const civ = isCivilian(u)
    const emb = isEmbarked(s, u)
    const btn = (a: string, label: string, key = '', icon = '', dis = false, title = '') => `<button class="btn" data-a="unit" data-v="${a}" ${dis ? 'disabled' : ''} data-tip="${esc(title)}">${icon ? ic(icon, 's') : ''}${label}${key ? `<kbd>${key}</kbd>` : ''}</button>`
    const acts: string[] = []
    if (u.type === 'settler') { const err = canFoundCity(s, u); acts.push(btn('found', `Založit město`, 'B', 'flag', false, err ?? 'Založí město na tomto poli')) }
    if (u.type === 'worker') {
      if (u.work) acts.push(`<span>${jobInfo(u.work).name}: ještě ${u.workLeft}${NB}${turnsWord(u.workLeft)}${u.roadTo ? ', pak cesta dál' : ''}</span>`)
      else {
        // Co lze postavit na poli, kde dělníci stojí – i s důvodem, proč něco nejde. Rádce označí, co se tu hodí nejvíc.
        const recJob = this.app.hints ? recommendJob(s, idx(s, u.x, u.y), this.my) : null
        for (const j of tileJobs(s, idx(s, u.x, u.y), this.my)) {
          const verb = (j.job === recJob ? REC : '') + (j.job === 'repair' ? j.name : jobInfo(j.job).verb)
          const tt = `${j.name}|${j.effect ? `${j.effect[0].toUpperCase()}${j.effect.slice(1)}.\n` : ''}Stavba trvá ${j.turns} ${turnsWord(j.turns)}.${j.ok ? '' : `\nNelze: ${j.why}.`}`
          if (j.ok || j.why !== 'už stojí') acts.push(btn(`imp:${j.job}`, verb, '', j.job === 'road' ? 'road' : 'work', !j.ok || u.moves <= 0, tt))
        }
        if (!emb && hasTech(this.me, ROAD.tech)) acts.push(`<button class="btn ${this.app.roadMode ? 'on' : ''}" data-a="unit" data-v="roadto"${tip('Cesta až do…|Kliknete na cílové pole a dělníci postaví cestu pole po poli až tam. Sami se přesouvají, dokud není hotovo.')}>${ic('road', 's')}Cesta do…<kbd>R</kbd></button>`)
      }
    }
    // Povýšení a přezbrojení.
    const pend = pendingPromos(u)
    const promoRow = pend > 0 ? `<div class="promo"><b>${ic('xp', 's')}Povýšení${pend > 1 ? ` (${pend}×)` : ''} – vyberte:</b>${PROMO_IDS.filter(id => !u.promos.includes(id)).map(id => `<button class="btn small" data-a="unit" data-v="promo:${id}" ${u.moves <= 0 ? 'disabled' : ''}${tip(`${PROMOS[id].name}|${PROMOS[id].desc}\nPovýšení vyléčí 25 životů a stojí 1 bod pohybu.${u.moves <= 0 ? `\nNelze: ${PROMO_NO_MOVES}` : ''}`)}>${PROMOS[id].name}</button>`).join('')}</div>` : ''
    const upT = civ ? null : upgradeTarget(s, u)
    if (upT) {
      const why = upgradeBlock(s, u)
      acts.push(`<button class="btn${why ? '' : ' upok'}" data-a="unit" data-v="upgrade" ${why ? 'disabled' : ''}${tip(`Přezbrojit: ${UNITS[upT].name}|${UNITS[upT].desc}\nSíla ${UNITS[upT].str}${UNITS[upT].ranged ? `, střelba ${UNITS[upT].ranged}` : ''}, pohyb ${UNITS[upT].move}. Zkušenosti a povýšení zůstanou.\nCena ${upgradeCost(s, u)} zlata, spotřebuje tah.${why ? `\nNelze: ${why}` : ''}`)}>${ic('up', 's')}${UNITS[upT].name} ${ic('gold', 's')}${upgradeCost(s, u)}<kbd>U</kbd></button>`)
      const same = unitsOf(s, this.my).filter(o => o.type === u.type && !upgradeBlock(s, o))
      if (same.length > 1) acts.push(`<button class="btn small" data-a="unit" data-v="upgradeall"${tip(`Přezbrojit všechny|Přezbrojí všech ${same.length} jednotek tohoto druhu, které stojí na vašem území a mají pohyb – dokud stačí zlato (${upgradeCost(s, u)} za kus).`)}>${ic('up', 's')}Všechny (${same.length})</button>`)
    }
    const ward = wardOf(s, u)
    const guard = civ ? escortOf(s, u) : undefined
    const resting = u.fortified || u.sleep || u.work || u.goto || u.auto || u.roadTo || ward
    if (resting) acts.push(btn('wake', ward ? 'Zrušit doprovod' : u.auto ? 'Zrušit automatiku' : u.roadTo ? 'Zrušit stavbu cesty' : u.work ? 'Přerušit práci' : u.goto ? 'Zrušit cestu' : 'Probudit', '', '', false, 'Jednotka zruší dosavadní rozkaz a počká na nový.'))
    else {
      if (u.type === 'worker') acts.push(btn('auto', 'Automaticky', 'E', 'work', false, 'Automatika|Dělníci budou sami chodit po vašem území a stavět vylepšení, která se zrovna hodí. Před nepřítelem utečou do města.'))
      else if (u.type === 'scout' || isNaval(u)) acts.push(btn('auto', 'Zkoumat', 'E', 'move', false, 'Automatický průzkum|Jednotka bude sama odkrývat neznámá pole, dokud je co zkoumat.'))
      if (!civ && !emb) acts.push(btn('fortify', 'Opevnit', 'F', 'shield', false, u.attacked || u.moves <= 0 ? '+25 % k obraně, jednotka čeká. Protože v tomto tahu útočila nebo už nemá pohyb, začne opevnění platit až od příštího tahu.' : '+25 % k obraně, jednotka čeká. Platí hned.'))
      // Spojení se sousední stejnou jednotkou a rozdělení zpět.
      if (!civ && mergeTargets(s, u).length) { const n = unitSize(u) + unitSize(mergeTargets(s, u)[0]); acts.push(btn('merge', n === 3 ? 'Spojit ve voj' : 'Spojit v šik', 'J', 'shield', false, `${formationName(n)}|Jednotka se připojí k sousední stejné jednotce. Vznikne jedna jednotka na jednom poli se silou +${Math.round(((FORMATION[n] ?? 1) - 1) * 100)} %. Životy se zprůměrují, zkušenosti se berou od zkušenější. Žold i suroviny se dál počítají za každou zvlášť. Stojí zbytek tahu.`)) }
      if (!civ && unitSize(u) > 1) { const why = splitBlock(s, u); acts.push(btn('split', 'Rozdělit', '', 'move', !!why, `Rozdělit ${formationName(unitSize(u)).toLowerCase()}|Jednotky se rozestoupí na volná sousední pole, každá se stejnými životy a zkušenostmi. Jde jen na vlastním území.${why ? `\nNelze: ${why}` : ''}`)) }
      if (!civ && !pillageBlock(s, u)) acts.push(btn('pillage', 'Vyplenit', 'P', 'str', false, `Vyplenit pole|Vylepšení (napodruhé cesta) na tomto poli přestane fungovat, dokud ho nepřítel neopraví. Stojí zbytek tahu a přinese ${PILLAGE_GOLD} zlata. Vypleněný důl či ohrada nedodává surovinu, vypleněná cesta přeruší spojení měst.`))
      if (!civ && !isNaval(u) && unitsOf(s, this.my).some(o => isCivilian(o) && Math.abs(o.x - u.x) <= 1 && Math.abs(o.y - u.y) <= 1 && !escortBlock(s, u, o))) acts.push(btn('escort', 'Doprovázet', 'G', 'shield', false, 'Doprovod|Jednotka se sváže s vaší civilní jednotkou na stejném nebo sousedním poli: půjde všude s ní a bude ji chránit, dokud jí nedáte jiný rozkaz.'))
      acts.push(btn('sleep', 'Spát', 'Z', 'skip'))
      acts.push(btn('skip', 'Přeskočit', 'X'))
    }
    acts.push(`<button class="btn small danger" data-a="unit" data-v="disband" data-tip="Rozpustit jednotku">✕</button>`)
    const eta = this.app.gotoEta
    const status = [ward ? `doprovází: ${UNITS[ward.type].name}` : guard ? `chrání je: ${UNITS[guard.type].name}` : u.auto ? 'automatika' : u.roadTo ? 'staví cestu' : u.todo === 'found' ? 'jde založit město' : u.todo ? 'jde za prací' : u.work ? 'pracuje' : u.fortified ? (u.fortWait ? 'opevňuje se – bonus od příštího tahu' : 'opevněna, +25 % obrana') : u.sleep ? 'spí' : u.goto ? `na cestě${eta > 0 ? `, dorazí za ${eta} ${turnsWord(eta)}` : ''}${u.way.length ? `, pak ještě ${u.way.length} ${u.way.length === 1 ? 'bod' : u.way.length < 5 ? 'body' : 'bodů'}` : ''}` : u.moves <= 0 ? 'bez pohybu' : '', emb ? 'naloděna' : '', !civ && d.siege && d.ranged && u.moved ? 'po přesunu, střílet může až příští tah' : ''].filter(Boolean).join(', ')
    // Šik a voj: síla se násobí, jméno to říká.
    const size = unitSize(u), fm = FORMATION[size] ?? 1
    const one = (v: number) => Math.round(v * fm * 10) / 10
    const title = size > 1 ? `${formationName(size)}: ${d.name}` : d.name
    const str = d.str ? `<span data-tip="Síla zblízka${size > 1 ? ` (${formationName(size).toLowerCase()}: ${size} jednotky, +${Math.round((fm - 1) * 100)} %)` : ''}">${ic('str', 's')}${one(d.str)}${u.vet ? '★' : ''}</span>` : ''
    const rng = d.ranged ? `<span data-tip="Střelecká síla, dostřel ${d.range}">${ic('rng', 's')}${one(d.ranged)}</span>` : ''
    this.unitPanel.classList.remove('hidden')
    this.unitPanel.innerHTML = `
      <div class="head"><img class="portrait" src="${emb ? unitIconUrl('boat', this.me.nation) : this.unitIcon(u.type, u.owner)}" alt="">
        <div style="flex:1"><h3>${title}${this.rankMark(u)}${status ? ` <small style="color:var(--muted);font-size:15px">– ${status}</small>` : ''}</h3>
          <div class="stats"><span data-tip="Zdraví">${ic('hp', 's')}${u.hp}</span>${str}${rng}<span data-tip="Pohyb">${ic('move', 's')}${mv(u.moves)}${NB}/${NB}${maxMoves(s, u)}</span>${civ ? '' : `<span${tip(`Zkušenosti: ${u.xp}|Jednotka je získává bojem. Povýšení při ${XP_LEVELS.join(', ')} bodech.${u.promos.length ? `\nMá: ${u.promos.map(x => `${PROMOS[x].name} (${PROMOS[x].desc})`).join(' ')}` : ''}`)}>${ic('xp', 's')}${u.xp}${XP_LEVELS[u.promos.length] ? `${NB}/${NB}${XP_LEVELS[u.promos.length]}` : ''}</span>`}</div>
          <div class="bar hp ${u.hp < 40 ? 'low' : ''}" style="margin-top:4px"><i style="width:${u.hp}%"></i></div>
        </div></div>
      <div class="desc">${esc(d.desc)}${u.vet ? ' Veterán (+15 % síla).' : ''}${emb ? esc(` Na člunech: nemůže útočit a brání se slabě (síla ${this.me.nation === 'thal' ? 8 : 4}). Vylodění ukončí tah.`) : ''}</div>
      <div class="desc hint">${esc(this.app.roadMode ? 'Klikněte na pole, kam má cesta vést.' : u.type === 'settler' ? 'Blikající světlé značky ukazují dobrá místa pro město (největší značka je nejlepší). Klikněte na některé a osadníci tam dojdou a usadí se.' : u.type === 'worker' && !u.work ? 'Pole s blikající světlou značkou lze vylepšit: klikněte na ně a dělníci tam dojdou a pustí se do práce.' : u.goto ? 'Shift + klik přidá další průjezdní bod.' : 'Klik na kterékoli pole pošle jednotku na cestu, i na více tahů.')}</div>
      ${promoRow}
      <div class="actions">${acts.join('')}</div>`
  }

  private itemIcon(it: BuildItem, owner: number): string { return it.kind === 'unit' ? this.unitIcon(it.id, owner) : `${UI}b_${it.id}.png` }

  private renderCity(): void {
    const c = this.app.city
    if (!c || c.owner !== this.my) { this.cityPanel.classList.add('hidden'); this.notes.classList.remove('hidden'); return }
    const s = this.s
    const y = cityYields(s, c)
    const need = growthNeed(s, c)
    const growT = y.foodNet > 0 ? Math.ceil((need - c.food) / y.foodNet) : 0
    const turns = (it: BuildItem) => Math.max(1, Math.ceil((itemCost(it, this.me) - c.prod) / Math.max(1, y.prod)))
    const scroll = this.cityPanel.querySelector('.inner')?.scrollTop ?? 0
    const shots = cityTargets(s, c).filter(t => this.me.visible[idx(s, t.x, t.y)]).length
    const rec = this.app.hints ? recommendBuild(s, c) : null
    const cs = cultureSources(c, this.me, s.turn)
    // Hranice: město zabírá pole po jednom, každé další je dražší.
    const bCost = borderCost(s, c), bOpts = borderOptions(s, c), bNext = borderTarget(s, c)
    const cultT = Math.max(1, Math.ceil((bCost - c.culture) / Math.max(1, y.culture)))
    const manual = c.border === 'manual'
    const cap = popCap(c)
    // Koupě rovnou ze seznamu: tlačítko s cenou, neaktivní s důvodem v nápovědě.
    const buyBtn = (it: BuildItem) => {
      if (it.kind === 'building' && it.id === 'wonder') return ''
      const why = buyItemBlock(s, c, it), bc = buyItemCost(s, c, it)
      return `<button class="btn small buyit" data-a="buy-item" data-v="${it.kind}:${it.id}" ${why ? 'disabled' : ''}${tip(why ? `Koupit za ${bc} zlata|${why}` : `Koupit za ${bc} zlata|Vznikne hned. Rozestavěná výroba a fronta zůstanou, jak jsou. Máte ${this.me.gold} zlata.`)}>${ic('gold', 's')}${bc}</button>`
    }
    let acc = c.build ? turns(c.build) : 0
    const queue = c.queue.map((it, i) => {
      acc += Math.max(1, Math.ceil(itemCost(it, this.me) / Math.max(1, y.prod)))
      return `<div class="qitem"><b>${i + 2}.</b><img src="${this.itemIcon(it, this.my)}" alt=""><span class="n">${itemName(it)}</span><span class="c">za ${acc} t.</span>
        ${buyBtn(it)}
        <button class="btn small" data-a="q-up" data-v="${i}"${tip('Stavět hned|Položka přeskočí na začátek, dosavadní výroba se zařadí za ni.')}>▲</button>
        <button class="btn small" data-a="q-del" data-v="${i}"${tip('Odebrat z fronty')}>✕</button></div>`
    }).join('')
    let cur = `<div class="current"><div class="n">Město nic nestaví – výroba se mění na zlato.<br><b style="color:var(--gold)">Vyberte, co stavět.</b></div></div>`
    if (c.build) {
      const cost = itemCost(c.build, this.me), t = turns(c.build), bc = buyCost(s, c)
      const wonder = c.build.kind === 'building' && c.build.id === 'wonder'
      cur = `<div class="current"><img src="${this.itemIcon(c.build, this.my)}" alt=""><div class="n"><b>${itemName(c.build)}</b>
        <div class="sub"><div class="bar prod"><i style="width:${Math.min(100, 100 * c.prod / cost)}%"></i></div>${c.prod}${NB}/${NB}${cost} · ${t}${NB}${turnsWord(t)}</div></div>
        ${wonder ? '' : `<button class="btn small" data-a="buy" ${canBuy(s, c) ? '' : 'disabled'}${tip(`Koupit za ${bc} zlata|Dokončí rozestavěnou položku ihned. Máte ${this.me.gold} zlata.`)}>${ic('gold', 's')}${bc}</button>`}
        <button class="btn small" data-a="q-del" data-v="-1"${tip('Zrušit|Přestane stavět tuto položku; na řadu přijde další z fronty. Nastřádaná výroba zůstane.')}>✕</button></div>`
    }
    const row = (it: BuildItem) => {
      const def = it.kind === 'unit' ? UNITS[it.id] : BUILDINGS[it.id]
      const isCur = sameItem(c.build, it)
      const isRec = sameItem(rec, it)
      const inQ = c.queue.filter(q => sameItem(q, it)).length
      const tt = (it.kind === 'unit' ? this.unitTip(it.id) : this.buildingTip(it.id)) + '\nKlik: zařadit do fronty · Shift + klik: stavět hned'
      const extra = it.kind === 'unit' ? [UNITS[it.id].str ? `síla ${UNITS[it.id].str}` : '', UNITS[it.id].ranged ? `střelba ${UNITS[it.id].ranged}` : '', `pohyb ${UNITS[it.id].move}`].filter(Boolean).join(', ') + '. ' : ''
      return `<div class="buildrow"><button class="build ${isCur ? 'cur' : ''} ${isRec ? 'rec' : ''}" data-a="build" data-v="${it.kind}:${it.id}"${tip(tt + (isRec ? '\nTip rádce: tohle se městu teď hodí nejvíc.' : ''))}>${isRec ? REC : ''}<img src="${this.itemIcon(it, this.my)}" alt="">
        <span class="n">${def.name}${inQ ? ` <em class="inq">ve frontě${inQ > 1 ? ` ${inQ}×` : ''}</em>` : ''}<small>${esc(extra + def.desc)}</small></span><span class="c">${ic('prod', 's')}${itemCost(it, this.me)}<br>${turns(it)}${NB}${turnsWord(turns(it))}</span></button>${isCur ? '' : buyBtn(it)}</div>`
    }
    const opts = availableBuilds(s, c)
    const blocked = UNIT_IDS.filter(id => {
      const d = UNITS[id]
      if (d.nation && d.nation !== this.me.nation) return false
      if (UNIT_IDS.some(o => UNITS[o].replaces === id && UNITS[o].nation === this.me.nation)) return false
      return (!d.tech || hasTech(this.me, d.tech)) && !opts.some(o => o.kind === 'unit' && o.id === id)
    }).map(id => `<div class="build off"${tip(this.unitTip(id))}><img src="${this.unitIcon(id, this.my)}" alt=""><span class="n">${UNITS[id].name}<small>${esc(unitBlockReason(s, c, id) ?? '')}</small></span></div>`).join('')
    const built = c.buildings.length ? c.buildings.map(b => `<span${tip(this.buildingTip(b))}><img src="${UI}b_${b}.png" alt="">${BUILDINGS[b].name}</span>`).join('') : '<span style="border:none;color:var(--muted)">zatím žádné</span>'
    const maxHp = cityMaxHp(c), wMax = wallMax(c), wNow = cityWalls(c), wDmg = wMax - wNow
    this.cityPanel.classList.remove('hidden')
    this.notes.classList.add('hidden')
    this.cityPanel.innerHTML = `
      <h2>${c.capital ? ic('star') : ''}${esc(c.name)}<button class="x" data-a="city-close" data-tip="Zavřít (Esc)">✕</button></h2>
      <div class="inner">
      <div class="yields">
        <span${tip(`Obyvatelé: ${c.pop}|Každý obyvatel obdělává jedno pole, sní 2 jídla a dává 1 vědu. K dalšímu růstu chybí ${Math.max(0, need - c.food)} jídla.${cap === Infinity ? '' : `\nStrop: ${cap} obyvatel – výš město poroste až s ${c.buildings.includes('aqueduct') ? 'kanalizací' : 'akvaduktem'}.`}`)}>${ic('pop')}${c.pop}${c.pop >= cap ? `<small style="color:var(--bad)">/${cap}</small>` : ''}</span>
        <span${tip(`Jídlo: ${signed(y.foodNet)} za tah|Město vyprodukuje ${y.food}, obyvatelé snědí ${c.pop * 2}. Přebytek se střádá na růst (${c.food} / ${need}).`)}>${ic('food')}${signed(y.foodNet)}</span>
        <span${tip(`Výroba: ${y.prod} za tah|Z obdělávaných polí, dolů, pil a dílny. Jde na stavbu budov a jednotek; bez zadání se půlka mění na zlato.`)}>${ic('prod')}${y.prod}</span>
        <span${tip(`Zlato: ${y.gold} za tah|Hrubý výnos města před odečtením údržby budov a žoldu.`)}>${ic('gold')}${y.gold}</span>
        <span${tip(`Věda: ${y.sci} za tah|1 za obyvatele, navíc hlavní město, knihovna a akademie.`)}>${ic('sci')}${y.sci}</span>
        <span${tip(`Kultura: +${y.culture} za tah|${cs.map(([n, v]) => `${n}: +${v}`).join('\n')}\nNastřádáno ${c.culture}, další pole stojí ${bCost}. Kultura rozšiřuje hranice města pole po poli a sčítá se i národu na tradice.`)}>${ic('culture')}+${y.culture}</span>
        <span${tip(`Obrana města: ${Math.round(cityStrength(s, c))}|Roste s počtem obyvatel a technologií, hradby dávají +40 %, bašty dalších +25 %, posádka přidá část své síly. Hradby a bašty násobí obranu, jen dokud stojí. Město samo střílí na nepřátele do 2 polí a každý tah si opraví 10 životů obránců i 10 bodů hradeb – ne však v obležení, tedy když u něj stojí aspoň ${SIEGE_UNITS} nepřátelské bojové jednotky.`)}>${ic('shield')}${Math.round(cityStrength(s, c))}</span>
      </div>
      <div class="sub">${ic('food', 's')}<div class="bar food"><i style="width:${Math.min(100, 100 * c.food / need)}%"></i></div>${c.pop >= cap ? `<span style="color:var(--bad)">strop ${cap}: chybí ${c.buildings.includes('aqueduct') ? 'kanalizace' : 'akvadukt'}</span>` : y.foodNet > 0 ? `růst za ${growT}${NB}${turnsWord(growT)}` : y.foodNet < 0 ? '<span style="color:var(--bad)">hladoví!</span>' : 'neroste'}</div>
      ${c.hp < maxHp || wDmg ? `<div class="sub">${ic('hp', 's')}<div class="bar hp low"><i style="width:${100 * c.hp / maxHp}%"></i></div>obránci ${c.hp}${NB}/${NB}${maxHp}${besieged(s, c) ? ' · <span style="color:var(--bad)">v obležení, neopravuje se</span>' : ''}</div>` : ''}
      ${wMax ? `<div class="sub"${tip(`Hradby: ${wNow} / ${wMax}|Dokud stojí, berou rány místo obránců: od pěchoty jen ${Math.round(WALL_MELEE * 100)} % škody (s beranidlem plnou), od střelců ${Math.round(WALL_RANGED * 100)} %, od obléhacích strojů plnou. Stojící hradby navíc zvyšují obranu města.`)}>${ic('shield', 's')}<div class="bar wall"><i style="width:${100 * wNow / wMax}%"></i></div>hradby ${wNow}${NB}/${NB}${wMax}</div>` : ''}
      ${shots ? `<div class="sub" style="color:${c.fired ? 'var(--muted)' : 'var(--war)'}">${ic('rng', 's')}${c.fired ? 'Hradby v tomto tahu už střílely.' : esc(`Nepřátel v dostřelu hradeb: ${shots}. Klikněte na cíl v červeném rámu; jinak město vystřelí samo na konci tahu.`)}</div>` : ''}
      <div class="sub"${tip(`Kultura a hranice|Město střádá +${y.culture} kultury za tah (${cs.map(([n, v]) => `${n.toLowerCase()} ${v}`).join(', ')}). Za kulturu zabírá okolní pole po jednom, nejdál 3 pole od města; každé další je dražší. Obdělávat jde každé zabrané pole.`)}>${ic('culture', 's')}<div class="bar cult"><i style="width:${bOpts.length ? Math.min(100, 100 * c.culture / bCost) : 100}%"></i></div>${!bOpts.length ? 'hranice jsou největší možné' : c.culture >= bCost && bNext < 0 ? '<span style="color:var(--gold)">vyberte pole na mapě</span>' : `další pole za ${cultT}${NB}${turnsWord(cultT)} (${c.culture}${NB}/${NB}${bCost})`}
        <button class="btn small ${manual ? 'on' : ''}" data-a="border" data-v="${manual ? 'auto' : 'manual'}"${tip(manual ? 'Hranice: vybíráte sami|Fialově označená pole může město zabrat; kliknutím na mapě zvolíte, které bude další. Kliknutím sem vrátíte výběr městu.' : 'Hranice: vybírá město|Město si bere nejdřív pole se surovinami, pak pole u řeky a výnosná pole, bližší před vzdálenějšími. Fialový rám na mapě ukazuje, které přijde příště. Kliknutím sem si začnete pole vybírat sami.')}>${manual ? 'Ručně' : 'Samo'}</button></div>
      <div class="sub">${ic('pop', 's')}Pole ve zlatém rámu s hlavou obyvatele město obdělává; ztmavená pole patří městu, ale nikdo na nich nepracuje.</div>
      <div class="sub"><span>Zaměření:</span><div class="seg focus">${([['', 'Vyváženě', '', 'Vyváženě|Obyvatele rozmístí město samo: malé město hlavně roste, větší víc vyrábí.'], ['food', 'Jídlo', 'food', 'Zaměření na jídlo|Obyvatelé obsadí nejúrodnější pole, město rychleji roste.'], ['prod', 'Výroba', 'prod', 'Zaměření na výrobu|Obyvatelé obsadí pole s nejvyšší výrobou. Město přitom nenechají hladovět.'], ['gold', 'Zlato', 'gold', 'Zaměření na zlato|Obyvatelé obsadí nejvýnosnější pole. Město přitom nenechají hladovět.']] as const).map(([v, l, i, t]) => `<button class="${(c.focus ?? '') === v ? 'on' : ''}" data-a="focus" data-v="${v}"${tip(t)}>${i ? ic(i, 's') : ''}${l}</button>`).join('')}</div></div>
      <h4>Výroba a fronta</h4>
      ${cur}${queue}
      <div class="sub hint">Klik na položku ji zařadí do fronty, Shift + klik ji začne stavět hned.</div>
      <h4>Jednotky</h4>
      ${opts.filter(o => o.kind === 'unit').map(row).join('')}${blocked}
      <h4>Budovy</h4>
      ${opts.filter(o => o.kind === 'building').map(row).join('') || '<div class="sub">Vše dostupné je postaveno. Nové budovy odemyká výzkum.</div>'}
      <h4>Postaveno</h4>
      <div class="built">${built}</div>
      </div>`
    const inner = this.cityPanel.querySelector('.inner')
    if (inner) inner.scrollTop = scroll
  }

  /** Síťová hra: pruh s tím, na koho se čeká, a stav spojení. */
  private renderNet(): void {
    const net = this.app.net
    if (!net) return
    const s = this.s
    let text = ''
    if (!net.ready) text = 'Spojení s hostitelem je přerušeno, obnovuji…'
    else if (!s.over && !this.app.myTurn) {
      const names = actors(s).map(id => { const p = s.players[id], who = this.app.seatName(id); return `${NATIONS[p.nation].name}${who ? ` (${who})` : ''}${net.online(id) ? '' : ' – bez spojení'}` })
      text = `${canAct(s, this.my) ? '' : s.simul && (s.done ?? []).includes(this.my) ? 'Tah jste ukončili. ' : ''}${names.length > 1 ? 'Na tahu jsou' : 'Na tahu'}: ${names.join(', ')}`
    }
    if (text) this.waiting.textContent = typo(text)
    if (text || !this.app.busy) this.waiting.classList.toggle('hidden', !text)
  }

  private renderEnd(): void {
    if (this.app.net && !this.app.myTurn) {
      const force = this.app.canForceEnd
      this.endBtn.classList.toggle('attn', false)
      if (this.app.canResume) {
        this.endBtn.innerHTML = `Vrátit se k tahu<small>${esc('ostatní ještě táhnou')}</small>`
        this.endBtn.disabled = this.app.busy
        return
      }
      this.endBtn.innerHTML = force ? `Předat národ počítači<small>${esc('hráč na tahu nemá spojení')}</small>` : this.me.away ? `Hraje za vás počítač<small>${esc('od příštího tahu hrajete zase vy')}</small>` : `${this.s.simul && (this.s.done ?? []).includes(this.my) ? 'Čekáte na ostatní' : 'Čekáte na tah'}<small>${esc('mapu si zatím můžete prohlížet')}</small>`
      this.endBtn.disabled = !force || this.app.busy
      return
    }
    const a = this.app.attention()
    const map: Record<string, [string, string]> = {
      research: ['Zvolit výzkum', 'vědci čekají'],
      tradition: ['Zvolit tradici', 'kultura nastřádána'],
      city: ['Zvolit výrobu', a.kind === 'city' ? a.city.name : ''],
      unit: ['Další jednotka', a.kind === 'unit' ? `${UNITS[a.unit.type].name} čeká na rozkaz` : ''],
      end: ['Ukončit tah', 'Enter'],
    }
    const [label, sub] = map[a.kind]
    this.endBtn.classList.toggle('attn', a.kind !== 'end')
    this.endBtn.innerHTML = `${label}<small>${esc(sub)}${a.kind !== 'end' ? ' · Shift+Enter ukončí tah' : ''}</small>`
    this.endBtn.disabled = this.app.busy
  }

  setWaiting(on: boolean): void {
    if (on) this.waiting.textContent = 'Soupeři táhnou…'
    this.waiting.classList.toggle('hidden', !on)
    this.endBtn.disabled = on
  }

  // ------------------------------------------------------------ tutoriál

  private nextTip(): Tip | null {
    const s = this.s, me = this.me
    if (!this.app.hints) return null
    const done = (id: string) => s.tutorial.includes(tipKey(this.my, id))
    const cities = citiesOf(s, this.my)
    const units = unitsOf(s, this.my)
    const tips: [string, boolean, string, string][] = [
      ['welcome', cities.length === 0 && units.some(u => u.type === 'settler'), 'Založte město',
        'Vítejte, vládče! Klikněte na osadníky a zvolte Založit město (klávesa B). Místo, kde stojí, je úrodné. Blikající světlé značky na mapě ukazují další dobrá místa – kliknutím tam osadníky pošlete a sami se usadí.'],
      ['production', cities.some(c => !c.build), 'Výroba ve městě',
        'Město čeká na rozkazy. Klikněte na něj a vyberte, co stavět. Na začátek se hodí válečník nebo zvěd, potom dělníci a osadníci pro další město.'],
      ['research', cities.length > 0 && !me.research, 'Výzkum',
        'Zvolte, co mají vaši učenci zkoumat – klikněte na ukazatel vědy nahoře (klávesa T). Technologie odemykají jednotky, budovy a vylepšení polí.'],
      ['move', cities.length > 0 && s.turn <= 4, 'Pohyb a průzkum',
        'Jednotku vyberete kliknutím. Zvýrazněná pole jsou v dosahu ještě tento tah; kliknutím na vzdálenější pole pošlete jednotku na cestu přes více tahů. Zvědovi stačí dát rozkaz Zkoumat (klávesa E) a mapu odkryje sám. Mapu posouváte tažením či klávesami WASD, kolečkem přibližujete.'],
      ['queue', cities.some(c => c.build && !c.queue.length) && s.turn >= 3, 'Fronta výroby',
        'Ve městě můžete naplánovat víc staveb za sebou: každé kliknutí na položku ji přidá do fronty, Shift + klik ji začne stavět hned. Město pak nečeká na další rozkaz.'],
      ['endturn', cities.length > 0 && !!me.research && cities.every(c => c.build) && s.turn <= 3, 'Konec tahu',
        'Až rozdáte rozkazy, ukončete tah tlačítkem vpravo dole (Enter). Tlačítko vás samo upozorní, když něco čeká na rozhodnutí.'],
      ['worker', units.some(u => u.type === 'worker'), 'Dělníci',
        'Dělníci vylepšují pole ve vašem území: farmy dávají jídlo, doly výrobu, trhové vsi zlato. Na rovině si vybíráte, co postavit; žárovka označí, co se městu hodí víc. Nechcete-li je vodit ručně, dejte jim rozkaz Automaticky (klávesa E) – řídí se zaměřením města. Koně potřebují ohradu a železo důl – teprve pak můžete stavět jízdu a šermíře.'],
      ['road', hasTech(me, 'wheel') && units.some(u => u.type === 'worker') && cities.length >= 2, 'Cesty',
        'Dělníci už umějí stavět cesty. Vyberte je, zvolte Cesta do… (klávesa R) a klikněte třeba na sousední město – postaví cestu pole po poli sami. Po cestě stojí každý krok jen půl bodu pohybu. Řeku cesta překlene až mostem, který umí národ se Stavitelstvím.'],
      ['tradition', traditionReady(me), 'Tradice',
        'Vaše města nastřádala dost kultury na první tradici. Tradice je trvalá výhoda pro celý národ – víc výroby, jídla, vědy, silnější vojsko a další. Klikněte na ukazatel kultury nahoře (klávesa C) a jednu si vyberte. Každá další stojí víc kultury.'],
      ['promo', units.some(u => pendingPromos(u) > 0), 'Povýšení',
        'Jedna z vašich jednotek nasbírala v boji zkušenosti. Vyberte ji a v jejím panelu zvolte povýšení – třeba silnější útok, obranu nebo pohyb navíc. Povýšení také vyléčí 25 životů a stojí jednotku 1 bod pohybu.'],
      ['pirates', s.units.some(u => u.owner === barbId(s) && UNITS[u.type].naval && me.visible[idx(s, u.x, u.y)]), 'Piráti',
        'U pobřeží se objevili piráti. Jejich galéra napadá lodě a čluny a blokuje vodní pole města, nájezdníci se vylodí a potáhnou na město. Lučištníci na ně dostřelí ze břehu, galéra je potopí na vodě.'],
      ['barb', s.units.some(u => u.owner === barbId(s) && me.visible[idx(s, u.x, u.y)]), 'Barbaři',
        'Na obzoru jsou barbaři! Zaútočíte kliknutím na nepřítele v červeném rámečku. Jednotka, která se tah nehýbe, se léčí. Barbarský tábor vypálíte tím, že na něj vstoupíte – přinese zlato.'],
      ['expand', cities.length === 1 && cities[0].pop >= 3 && s.turn > 10, 'Rozšiřujte říši',
        'Vaše město roste. Postavte osadníky a založte další města – víc měst znamená víc výroby, vědy i skóre. Hranice města rozšiřuje kultura (monument, chrám).'],
      ['war', me.war.length > 0, 'Válka',
        'Jste ve válce. Města se brání sama a střílejí na 2 pole. K dobytí je třeba porazit obránce města (200 životů) a vstoupit do něj pěchotou; má-li město hradby, berou rány nejdřív ony a pěchota jim bez beranidla ubírá jen pětinu. Bez obléhacích strojů to skoro nejde: beranidlo (Bronz) přidá pěchotě u města +50 % síly i obrany, katapulty (Matematika) hradby rozstřílejí. Město, u kterého stojí aspoň tři vaše bojové jednotky, se přestane opravovat. Mír lze nabídnout v okně Diplomacie.'],
      ['thal', me.nation === 'thal' && s.turn <= 3, 'Vládci vln',
        'Thalassové jsou doma na moři: lodě mají rychlejší a zkušenější, pobřežní vody jim nesou zlato a plout umějí od začátku. Vyplatí se zakládat města přímo na pobřeží – klidně s osadníky dojděte k moři, než první město založíte.'],
      ['sail', hasTech(me, 'sailing') && s.turn > 3, 'Plavba',
        'Umíte plout! Pozemní jednotky teď smějí vstoupit na pobřežní vody – nalodí se na čluny (nalodění i vylodění ukončí tah) a obeplují hory i nepřítele. Na vodě se ale skoro neubrání, proto je doprovázejte galérou z pobřežního města.'],
      ['wonder', hasTech(me, 'calendar'), 'Sluneční chrám',
        `Znáte Sluneční kalendář – můžete stavět Sluneční chrám. Kdo jej dostaví první a udrží jeho město ${WONDER_TURNS} tahů, vyhrává misi. Stavte jej ve městě s nejvyšší výrobou, postavte tam hradby a připravte posádku – soupeři na něj zaútočí.`],
    ]
    for (const [id, cond, title, text] of tips) if (cond && !done(id)) return { id, title, text }
    return null
  }

  /** Stav strategických surovin (koně, železo) v horní liště. */
  private resourceChips(): string {
    const s = this.s
    return resourceReport(s, this.my).filter(r => RESOURCES[r.res].strategic).map(r => {
      const def = RESOURCES[r.res]
      const nm = def.name, low = nm.toLowerCase()
      const units = unitsNeeding(s, this.my, r.res).join(', ') || 'žádná vaše jednotka (můžete ji ale prodávat v Diplomacii)'
      const imp = def.improvement === 'mine' ? 'důl' : 'ohradu'
      const first = r.improved[0] ?? r.raw[0] ?? -1
      let state: string, mark: string, text: string
      if (!r.known) { state = 'unknown'; mark = '?'; text = `Ložiska zatím nevidíte – odhalí je technologie ${TECHS[def.tech!].name}.` }
      else if (r.cap > 0) { state = r.used >= r.cap ? 'full' : 'have'; mark = `${r.used}/${r.cap}`; text = `Uživíte ${r.cap} ${r.cap === 1 ? 'jednotku' : r.cap < 5 ? 'jednotky' : 'jednotek'}, máte jich ${r.used}${r.used >= r.cap ? ' – další postavíte, až získáte nový zdroj' : ''}. Každý zdroj uživí ${UNITS_PER_SOURCE} jednotky.\nVlastních zdrojů s vylepšením: ${r.improved.length}.${r.raw.length ? ` Dalších ${r.raw.length} na vašem území čeká na ${imp}.` : ''}${r.bought ? ' Jeden zdroj kupujete.' : ''}${r.sold ? ' Jeden zdroj prodáváte.' : ''}` }
      else if (r.raw.length) { state = 'raw'; mark = '!'; text = `Na vašem území ${r.raw.length === 1 ? 'je 1 ložisko' : `jsou ${r.raw.length} ložiska`}, ale bez vylepšení. Pošlete tam dělníky postavit ${imp}.` }
      else { state = 'none'; mark = '–'; text = 'Na vašem území není. Hledejte ji na mapě a založte u ní město, nebo ji kupte v Diplomacii.' }
      return `<div class="stat res ${state}${first >= 0 ? ' clickable' : ''}" ${first >= 0 ? `data-a="ov-tile" data-v="${first}"` : ''}${tip(`${nm} – strategická surovina|${text}\nPotřebuje ji: ${units}.${first >= 0 ? '\nKliknutím ukážete ložisko na mapě.' : ''}`)}><i class="resic" style="background-image:url(${UI}r_${r.res}.png)" aria-label="${low}"></i><small>${mark}</small></div>`
    }).join('')
  }

  toggleOverview(): void {
    this.overviewOn = !this.overviewOn
    try { localStorage.setItem('hex4x-overview', this.overviewOn ? '1' : '0') } catch { /* bez úložiště */ }
    this.render()
  }

  /** Značka hodnosti: jeden šíp za každé povýšení. */
  private rankMark(u: Unit): string {
    const n = Math.min(3, u.promos.length)
    return n ? ` <img class="mk" src="${UI}mk_rank${n}.png" alt=""${tip(`${n}. hodnost|${u.promos.map(x => `${PROMOS[x].name}: ${PROMOS[x].desc}`).join('\n')}`)}>` : ''
  }

  /** Krátký popis toho, co jednotka právě dělá; druhá hodnota = čeká na rozkaz. */
  private unitDoing(u: Unit): [string, boolean] {
    const s = this.s
    if (u.auto) return [u.type === 'worker' ? 'automaticky vylepšuje pole' : 'automaticky zkoumá', false]
    if (u.work) return [`${u.work === 'road' ? 'staví cestu' : `pracují: ${jobInfo(u.work).name.toLowerCase()}`}, ještě ${u.workLeft} ${turnsWord(u.workLeft)}${u.roadTo ? ', pak dál' : ''}`, false]
    if (u.roadTo) return ['staví cestu na dálku', false]
    if (u.todo === 'found') return ['jde založit město', false]
    if (u.todo) return [`jde za prací: ${u.todo === 'road' ? 'cesta' : jobInfo(u.todo).name.toLowerCase()}`, false]
    if (u.goto) { const c = cityAt(s, u.goto[0], u.goto[1]); return [`na cestě${c ? ` do města ${c.name}` : ''}${u.way.length ? ` (+${u.way.length} body)` : ''}`, false] }
    if (u.fortified) { const c = cityAt(s, u.x, u.y); return [c ? `posádka: ${c.name}` : u.fortWait ? 'opevňuje se' : 'opevněna', false] }
    if (u.sleep) return ['spí', false]
    if (u.skip) return ['tento tah přeskočena', false]
    if (u.moves <= 0) return ['bez pohybu', false]
    return ['čeká na rozkaz', true]
  }

  private renderOverview(): void {
    const on = this.overviewOn && !this.app.city
    this.overview.classList.toggle('hidden', !on)
    this.root.classList.toggle('with-overview', on)
    if (!on) return
    const s = this.s
    const scroll = this.overview.querySelector('.inner')?.scrollTop ?? 0
    const cities = citiesOf(s, this.my).map(c => {
      const y = cityYields(s, c)
      const need = growthNeed(s, c)
      const grow = y.foodNet > 0 ? `růst za ${Math.ceil((need - c.food) / y.foodNet)} t.` : y.foodNet < 0 ? '<span style="color:var(--bad)">hladoví</span>' : 'neroste'
      let what = '<b style="color:var(--gold)">nic nestaví!</b>'
      if (c.build) {
        const t = Math.max(1, Math.ceil((itemCost(c.build, this.me) - c.prod) / Math.max(1, y.prod)))
        what = `${esc(itemName(c.build))} <small>${t} ${turnsWord(t)}</small>${c.queue.length ? ` <small>· pak ${c.queue.map(q => esc(itemName(q))).join(', ')}</small>` : ''}`
      }
      return `<div class="ov" data-a="ov-city" data-v="${c.id}">${c.build ? `<img src="${this.itemIcon(c.build, this.my)}" alt="">` : `<img src="${UI}ic_prod.png" alt="" style="opacity:.4">`}<div><b>${c.capital ? '★ ' : ''}${esc(c.name)}</b> <small>${ic('pop', 's')}${c.pop} · ${grow}${c.hp < cityMaxHp(c) ? ` · <span style="color:var(--bad)">hradby ${c.hp}</span>` : ''}</small><br>${what}</div></div>`
    }).join('')
    const mine = unitsOf(s, this.my)
    const row = (u: Unit) => {
      const [doing, idle] = this.unitDoing(u)
      const emb = isEmbarked(s, u)
      return `<div class="ov ${u.id === this.app.selUnit ? 'sel' : ''}" data-a="ov-unit" data-v="${u.id}"><img src="${emb ? unitIconUrl('boat', this.me.nation) : this.unitIcon(u.type, this.my)}" alt=""><div><b>${UNITS[u.type].name}</b>${this.rankMark(u)}${pendingPromos(u) > 0 ? ` <img class="mk" src="${UI}mk_promo.png" alt=""${tip('Čeká na povýšení')}>` : ''}${upgradeTarget(s, u) ? ` <img class="mk${upgradeBlock(s, u) ? ' dim' : ''}" src="${UI}mk_up.png" alt=""${tip(`Lze přezbrojit: ${UNITS[upgradeTarget(s, u)!].name}${upgradeBlock(s, u) ? `|Teď ne: ${upgradeBlock(s, u)}` : ''}`)}>` : ''} <small>${u.hp < 100 ? `<span style="color:${u.hp < 40 ? 'var(--bad)' : 'var(--war)'}">${ic('hp', 's')}${u.hp}</span> · ` : ''}${ic('move', 's')}${mv(u.moves)}${emb ? ' · na moři' : ''}</small><br><span class="${idle ? 'idle' : 'doing'}">${esc(doing)}</span></div></div>`
    }
    const civ = mine.filter(u => isCivilian(u)), mil = mine.filter(u => !isCivilian(u))
    const waiting = mine.filter(u => this.unitDoing(u)[1]).length
    this.overview.innerHTML = `<h2>Přehled<button class="x" data-a="overview"${tip('Zavřít přehled (L)')}>✕</button></h2><div class="inner">
      <h4>Suroviny</h4>${resourceReport(s, this.my).map(r => {
        const def = RESOURCES[r.res], n = r.improved.length + r.raw.length
        const first = r.improved[0] ?? r.raw[0] ?? -1
        const st = !r.known ? 'zatím neznámé' : def.strategic && r.cap > 0 ? `jednotek ${r.used} / ${r.cap}${r.raw.length ? `, bez vylepšení ${r.raw.length}` : ''}` : r.improved.length ? `využíváte ${r.improved.length}${r.raw.length ? `, bez vylepšení ${r.raw.length}` : ''}` : r.bought ? 'kupujete' : n ? `${n}× na území, chybí ${def.improvement === 'mine' ? 'důl' : def.improvement === 'pasture' ? 'ohrada' : 'farma'}` : 'nemáte'
        return `<div class="ov" ${first >= 0 ? `data-a="ov-tile" data-v="${first}"` : 'style="cursor:default"'}><i class="resic" style="background-image:url(${UI}r_${r.res}.png)"></i><div><b>${def.name}</b>${def.strategic ? ' <small>strategická</small>' : ''}<br><span class="${r.known && !r.improved.length && r.raw.length ? 'idle' : 'doing'}">${st}</span></div></div>`
      }).join('')}
      <h4>Města (${citiesOf(s, this.my).length})</h4>${cities || '<div class="sub">Zatím žádné město.</div>'}
      <h4>Civilní jednotky (${civ.length})</h4>${civ.map(row).join('') || '<div class="sub">Žádné.</div>'}
      <h4>Vojsko (${mil.length})${waiting ? ` <small style="color:var(--gold)">· na rozkaz čeká ${waiting}</small>` : ''}</h4>${mil.map(row).join('') || '<div class="sub">Žádné.</div>'}</div>`
    const inner = this.overview.querySelector('.inner')
    if (inner) inner.scrollTop = scroll
  }

  private tipOpen = false
  private tipSeen = ''

  private renderTip(): void {
    const t = this.app.city ? null : this.nextTip()
    if (!t) { this.tip.classList.add('hidden'); return }
    this.tip.classList.remove('hidden')
    // Nová rada se v prvních tazích rozbalí sama, později jen zabliká jako štítek.
    if (t.id !== this.tipSeen) { this.tipSeen = t.id; this.tipOpen = this.s.turn <= 2 }
    this.tip.classList.toggle('mini', !this.tipOpen)
    if (!this.tipOpen) {
      this.tip.innerHTML = `<button class="pill" data-a="tip-open"${tip('Rádce|Kliknutím radu rozbalíte.')}><img src="${UI}em_${this.me.nation}.png" alt="">Rada: ${esc(t.title)}</button>`
      return
    }
    this.tip.innerHTML = `<button class="x" data-a="tip-open"${tip('Sbalit')}>–</button><div class="row"><img src="${UI}em_${this.me.nation}.png" alt=""><div><h4>Rádce: ${esc(t.title)}</h4><p>${esc(t.text)}</p>
      <div style="display:flex;gap:6px;justify-content:flex-end"><button class="btn small" data-a="tip-off" data-tip="Vypnout rady">Bez rad</button><button class="btn small" data-a="tip-ok" data-v="${t.id}">Rozumím</button></div></div></div>`
  }

  // ------------------------------------------------------------ popisky na mapě

  cameraMoved(): void { this.positionLabels(); this.drawMini() }

  private renderLabels(): void {
    const s = this.s
    const seen = new Set<number>()
    for (const c of s.cities) {
      if (!this.me.explored[idx(s, c.x, c.y)]) continue
      seen.add(c.id)
      let el = this.cityLabels.get(c.id)
      if (!el) { el = h('div', { class: 'citylabel', 'data-a': 'citylabel', 'data-v': String(c.id) }); this.labels.append(el); this.cityLabels.set(c.id, el) }
      const n = NATIONS[s.players[c.owner].nation]
      el.style.setProperty('--c', n.css)
      const vis = this.me.visible[idx(s, c.x, c.y)]
      let extra = ''
      if (c.owner === this.my) {
        if (c.build) { const y = cityYields(s, c); const t = Math.max(1, Math.ceil((itemCost(c.build, this.me) - c.prod) / Math.max(1, y.prod))); extra = `<em>${esc(itemName(c.build))} · ${t} t.${c.queue.length ? ` → ${esc(itemName(c.queue[0]))}${c.queue.length > 1 ? '…' : ''}` : ''}</em>`; el.dataset.tip = typo(`${c.name}|Staví: ${itemName(c.build)}, hotovo za ${t} ${turnsWord(t)}.${c.queue.length ? `\nVe frontě potom: ${c.queue.map(q => itemName(q)).join(', ')}.` : '\nFronta je prázdná.'}\nKliknutím otevřete město.`) }
        else { extra = `<em style="color:var(--gold)">nečinné!</em>`; el.dataset.tip = typo(`${c.name}|Město nic nestaví, výroba se mění na zlato.\nKliknutím otevřete město a vyberete stavbu.`) }
      }
      const maxHp = cityMaxHp(c), wm = wallMax(c), wn = cityWalls(c)
      const html = `<b>${vis || c.owner === this.my ? c.pop : '?'}</b><span>${c.capital ? '★ ' : ''}${esc(c.name)}</span>${extra}${vis && wm && (c.hp < maxHp || wn < wm) ? `<div class="hpb wall"><i style="width:${100 * wn / wm}%"></i></div>` : ''}${vis && (c.hp < maxHp || wn < wm) ? `<div class="hpb${wm ? ' two' : ''}"><i style="width:${100 * c.hp / maxHp}%"></i></div>` : ''}`
      if (el.dataset.html !== html) { el.innerHTML = html; el.dataset.html = html }
    }
    for (const [id, el] of this.cityLabels) if (!seen.has(id)) { el.remove(); this.cityLabels.delete(id) }
    this.positionLabels()
  }

  private positionLabels(): void {
    const s = this.s
    const sc = this.app.scene
    for (const [id, el] of this.cityLabels) {
      const c = s.cities.find(o => o.id === id)
      if (!c) continue
      const [wx, wy] = hexCenter(c.x, c.y)
      const [x, y] = sc.worldToScreen(wx, wy + 13)
      el.style.left = `${Math.round(x)}px`; el.style.top = `${Math.round(y)}px`
      el.style.fontSize = sc.zoom <= 1 ? '12px' : sc.zoom === 2 ? '14px' : '16px'
    }
  }

  floater(wx: number, wy: number, text: string, color: string): void {
    const [x, y] = this.app.scene.worldToScreen(wx, wy)
    const el = h('div', { class: 'floater', style: `left:${x}px;top:${y}px;color:${color}` }, text)
    this.labels.append(el)
    window.setTimeout(() => el.remove(), 950)
  }

  // ------------------------------------------------------------ informace o poli

  hover(x: number, y: number): void {
    this.hoverXY = [x, y]
    if (this.toastTimer) return
    const s = this.s
    if (x < 0 || !this.app.inGame || this.modalOpen) { this.tileInfo.classList.add('hidden'); return }
    const i = idx(s, x, y)
    if (!this.me.explored[i]) { this.tileInfo.classList.remove('hidden'); this.tileInfo.innerHTML = 'Neprozkoumané území' + (this.app.unit && this.app.hoverEta >= 0 ? '<br><span class="eta">Klikněte a jednotka tam vyrazí na průzkum</span>' : ''); return }
    const t = s.tiles[i]
    const parts: string[] = [TERRAIN[t.t].name + (t.forest ? ', les' : '')]
    if (t.special === 'ruins') parts.push('<b style="color:var(--gold)">Ruiny Starého trůnu</b>')
    if (t.special === 'camp') parts.push('<b style="color:var(--bad)">Barbarský tábor</b>')
    if (t.res && resourceVisible(this.me, t.res)) parts.push(`<b>${RESOURCES[t.res].name}</b>`)
    const strat = t.res && resourceVisible(this.me, t.res) && RESOURCES[t.res].strategic ? t.res : null
    if (t.imp) parts.push(IMPROVEMENTS[t.imp].name)
    if (t.road) parts.push('cesta')
    if (t.river && TERRAIN[t.t].land) parts.push('řeka')
    const yl = tileYield(s, i, this.my)
    const ys = [yl.food ? `${ic('food', 's')}${yl.food}` : '', yl.prod ? `${ic('prod', 's')}${yl.prod}` : '', yl.gold ? `${ic('gold', 's')}${yl.gold}` : ''].filter(Boolean).join(' ')
    let html = parts.join(' · ') + (ys ? ` &nbsp; ${ys}` : '')
    const mc = t.t === 'mountain' ? 'neprůchodné' : isWater(t) ? (hasTech(this.me, t.t === 'coast' ? 'sailing' : 'navigation') ? 'splavné' : t.t === 'coast' ? 'voda (vyžaduje Plavbu)' : 'voda (vyžaduje Navigaci)') : ''
    if (mc) html += ` · ${mc}`
    if (t.owner >= 0) html += ` · <span style="color:${NATIONS[s.players[t.owner].nation].css}">${NATIONS[s.players[t.owner].nation].name}</span>`
    if (this.me.visible[i]) {
      const c = cityAt(s, x, y)
      if (c) html += `<br>${ic('shield', 's')}Město ${esc(c.name)} – obrana ${Math.round(cityStrength(s, c))}, obránci ${c.hp}${NB}/${NB}${cityMaxHp(c)}${wallMax(c) ? `, hradby ${cityWalls(c)}${NB}/${NB}${wallMax(c)}` : ''}${besieged(s, c) ? ' · v obležení' : ''}`
      for (const u of unitsAt(s, x, y)) {
        const d = UNITS[u.type]
        const own = u.owner === 0 ? '' : ` <span style="color:${NATIONS[s.players[u.owner].nation].css}">(${NATIONS[s.players[u.owner].nation].name})</span>`
        html += `<br>${d.name}${own} ${ic('hp', 's')}${u.hp}${d.str ? ` ${ic('str', 's')}${Math.round(unitStrength(s, u, { defending: true }) * 10) / 10}` : ''}${u.fortified ? (u.fortWait ? ' · opevňuje se' : ' · opevněn') : ''}`
      }
      const sel = this.app.unit
      if (sel) {
        const pv = previewAttack(s, sel, x, y)
        if (pv) html += `<br><span class="pv">${ic('war', 's')}Útok: ${pv.city ? `${pv.dmgWall ? `hradby −${pv.dmgWall}${pv.dmgDef ? ', ' : ''}` : ''}${pv.dmgDef || !pv.dmgWall ? `obránci −${pv.dmgDef}` : ''}${pv.dmgDef >= pv.defHp && !pv.ranged ? ' (město padne)' : ''}` : `nepřítel −${pv.dmgDef}${pv.dmgDef >= pv.defHp ? ' (zničen)' : ''}`}${pv.ranged ? ', bez odvety' : `, vy −${pv.dmgAtt}${pv.dmgAtt >= pv.attHp ? ' (padnete!)' : ''}`}${pv.river ? ' · přes řeku −20 %' : ''}${pv.needWar >= 0 ? ' · znamená válku' : ''}${pv.flank ? ` · obklíčení +${pv.flank * 10} %` : ''}${pv.support ? ` · obránce má podporu +${pv.support * 10} %` : ''}</span>`
        else { const why = attackBlock(s, sel, x, y); if (why) html += `<br><span class="nojob">${ic('war', 's')}${esc(why)}</span>` }
      }
    }
    if (strat) {
      const def = RESOURCES[strat]
      const used = t.imp === def.improvement || !!cityAt(s, x, y)
      html += `<br><span class="${used ? 'job' : 'nojob'}">${esc(`Strategická surovina pro: ${unitsNeeding(s, 0, strat).join(', ') || '–'}. ${used ? (t.owner === 0 ? 'Využíváte ji.' : 'Využívá ji jiný národ.') : `Zpřístupní ji ${def.improvement === 'mine' ? 'důl' : 'ohrada'} na území města.`}`)}</span>`
    }
    const sel = this.app.unit, eta = this.app.hoverEta
    if (sel && sel.type === 'settler' && sel.owner === this.my && TERRAIN[t.t].passable) {
      // Jak dobré je pole pro město.
      const why = foundBlock(s, this.my, x, y)
      if (why) html += `<br><span class="nojob">${ic('flag', 's')}Město zde založit nelze: ${esc(why)}</span>`
      else {
        const sc = siteScore(s, this.my, x, y)
        let food = 0, prod = 0, res = 0
        for (let k = 0; k < s.tiles.length; k++) {
          const tx = k % s.W, ty = (k / s.W) | 0
          if (Math.abs(tx - x) > 3 || Math.abs(ty - y) > 2 || !this.me.explored[k]) continue
          const dx = hexCenter(tx, ty), dc = hexCenter(x, y)
          if (Math.hypot(dx[0] - dc[0], dx[1] - dc[1]) > 70) continue
          const yl = tileYield(s, k, this.my); food += yl.food; prod += yl.prod
          if (s.tiles[k].res && resourceVisible(this.me, s.tiles[k].res!)) res++
        }
        const word = sc >= 58 ? 'výborné' : sc >= 50 ? 'dobré' : sc >= 42 ? 'průměrné' : 'slabé'
        const extras = [isCoastal(s, x, y) ? 'u moře (lodě, přístav)' : '', t.river ? 'u řeky' : '', t.t === 'hills' ? 'na pahorku (lepší obrana)' : ''].filter(Boolean).join(', ')
        html += `<br><span class="${sc >= 50 ? 'job' : 'nojob'}">${ic('flag', 's')}Město zde: ${word} · ${ic('food', 's')}${food} ${ic('prod', 's')}${prod} · surovin ${res}</span>${extras ? `<br><span class="job">${esc(extras[0].toUpperCase() + extras.slice(1))}</span>` : ''}`
        if (this.app.sites.has(i) && !(sel.x === x && sel.y === y)) html += '<br><span class="job">Klikněte: osadníci sem dojdou a založí město</span>'
      }
    }
    if (sel && sel.type === 'worker' && sel.owner === this.my) {
      // Co tu mohou dělníci postavit.
      const jobs = tileJobs(s, i, this.my)
      const here = sel.x === x && sel.y === y
      const lines = jobs.filter(j => j.ok || j.why !== 'už stojí').map(j => `<span class="${j.ok ? 'job' : 'nojob'}">${ic(j.job === 'road' ? 'road' : 'work', 's')}${j.name}${j.ok ? `: ${j.job === 'road' ? 'rychlejší pohyb' : j.effect}, ${j.turns} ${turnsWord(j.turns)}` : ` – nelze, ${j.why}`}</span>`)
      if (lines.length) html += `<br>${lines.join(' · ')}`
      else if (TERRAIN[t.t].passable && !t.special) html += '<br><span class="nojob">Dělníci tu nemají co stavět</span>'
      if (this.app.jobs.has(i) && !here) html += '<br><span class="job">Klikněte: dělníci sem dojdou a začnou stavět</span>'
    }
    if (sel && eta >= 0) {
      const ship = isWater(t) !== isWater(s.tiles[idx(s, sel.x, sel.y)]) && !isNaval(sel) ? (isWater(t) ? ' · nalodění ukončí tah' : ' · vylodění ukončí tah') : ''
      html += `<br><span class="eta">${ic('move', 's')}${eta === 0 ? 'V dosahu ještě tento tah' : `Daleko: klikněte a jednotka dojde sama za ${eta} ${turnsWord(eta)}`}${ship}</span>`
    }
    this.tileInfo.classList.remove('hidden')
    this.tileInfo.innerHTML = html
  }

  // ------------------------------------------------------------ minimapa

  private static MINI: Record<string, string> = { ocean: '#1f4f9c', coast: '#3aa0c8', grass: '#5fae3e', plains: '#b9b54a', desert: '#e3c477', hills: '#8a8f4a', mountain: '#9aa0ad' }

  /** Velikost jednoho pole na minimapě v bodech plátna. */
  private get miniCell(): number { return this.app.inGame ? Math.max(3, Math.min(5, Math.floor(204 / this.s.W))) : 5 }

  private drawMini(): void {
    if (!this.app.inGame) return
    const s = this.s
    const g = this.mini.getContext('2d')!
    const cw = this.miniCell, ch = cw
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, this.mini.width, this.mini.height)
    for (let i = 0; i < s.tiles.length; i++) {
      if (!this.me.explored[i]) continue
      const x = i % s.W, y = (i / s.W) | 0
      const t = s.tiles[i]
      const px = 4 + x * cw + (y & 1) * cw / 2, py = 3 + y * ch
      g.fillStyle = t.forest ? '#2f7a3a' : Hud.MINI[t.t]
      g.fillRect(px, py, cw, ch)
      if (t.owner >= 0) { g.globalAlpha = 0.55; g.fillStyle = NATIONS[s.players[t.owner].nation].css; g.fillRect(px, py, cw, ch); g.globalAlpha = 1 }
      if (!this.me.visible[i]) { g.fillStyle = '#0b102066'; g.fillRect(px, py, cw, ch) }
    }
    for (const c of s.cities) {
      if (!this.me.explored[idx(s, c.x, c.y)]) continue
      const px = 4 + c.x * cw + (c.y & 1) * cw / 2, py = 3 + c.y * ch
      g.fillStyle = '#fff'; g.fillRect(px - 1, py - 1, cw + 2, ch + 2)
      g.fillStyle = NATIONS[s.players[c.owner].nation].css; g.fillRect(px, py, cw, ch)
    }
    for (const u of s.units) {
      if (!this.me.visible[idx(s, u.x, u.y)]) continue
      const px = 4 + u.x * cw + (u.y & 1) * cw / 2, py = 3 + u.y * ch
      g.fillStyle = u.owner === barbId(s) ? '#111' : NATIONS[s.players[u.owner].nation].css
      g.fillRect(px + 1, py + 1, cw - 2, cw - 2)
    }
    const v = this.app.scene.viewRect
    g.strokeStyle = '#fff'; g.lineWidth = 1
    g.strokeRect(4 + v.x / 32 * cw + 0.5, 3 + v.y / 24 * ch + 0.5, v.width / 32 * cw, v.height / 24 * ch)
  }

  private miniClick(e: PointerEvent): void {
    if (this.app.busy) return
    const r = this.mini.getBoundingClientRect()
    const mx = (e.clientX - r.left) * this.mini.width / r.width, my = (e.clientY - r.top) * this.mini.height / r.height
    const x = Math.max(0, Math.min(this.s.W - 1, Math.round((mx - 4) / this.miniCell - 0.5)))
    const y = Math.max(0, Math.min(this.s.H - 1, Math.round((my - 3) / this.miniCell - 0.5)))
    this.app.scene.centerOn(x, y, false)
  }

  // ------------------------------------------------------------ okna

  private open(kind: string, title: string, body: string, foot = `<button class="btn" data-a="close">Zavřít</button>`, width = ''): void {
    this.modalKind = kind
    this.modal.classList.remove('hidden')
    // Předání počítače zakrývá celou mapu, ať další hráč nevidí cizí říši.
    this.modal.classList.toggle('curtain', kind === 'handover')
    this.modal.innerHTML = `<div class="modalbox panel" ${width ? `style="width:${width}"` : ''}><h2>${title}${kind === 'over' || kind === 'confirm' || kind === 'offer' || kind === 'handover' ? '' : '<button class="x" data-a="close">✕</button>'}</h2><div class="body">${body}</div><div class="foot">${foot}</div></div>`
    this.tileInfo.classList.add('hidden')
    this.modal.querySelector<HTMLElement>('.foot .btn:last-child')?.focus()
  }

  /** Enter v okně s jedinou volbou ji potvrdí; vrací, zda se tak stalo. */
  confirmModal(): boolean {
    if (this.modalKind !== 'handover') return false
    this.seatTaken()
    return true
  }

  private seatCb: (() => void) | null = null

  /** Hráč `pid` je na tahu: zakryje mapu, dokud neusedne k počítači. */
  showHandover(pid: number, cb: () => void): void {
    const p = this.s.players[pid], n = NATIONS[p.nation]
    this.seatCb = cb
    this.open('handover', `Na tahu: ${esc(n.name)}`, `<div style="display:flex;gap:16px;align-items:center"><img src="${UI}p_${p.nation}.png" style="width:144px;height:144px;border:3px solid ${n.css};flex:none" alt="">
      <div><p style="font-size:21px">${esc(`${n.leader}, ${n.title.toLowerCase()}.`)}</p><p>${esc(`Tah ${Math.min(this.s.turn, this.s.maxTurns)} z ${this.s.maxTurns}. Předejte počítač hráči, který vede národ ${n.name}. Ostatní se teď nedívají.`)}</p></div></div>`,
    `<button class="btn big" data-a="seat">Jsem tu, hrajeme</button>`, '640px')
  }

  private seatTaken(): void {
    const f = this.seatCb
    this.seatCb = null
    this.modalKind = ''
    this.closeModal()
    sfx('turn')
    f?.()
  }

  closeModal(): void {
    if (this.modalKind === 'over' || this.modalKind === 'handover') return
    this.modal.classList.add('hidden')
    this.modalKind = ''
    this.confirmCb = null
    if (this.app.inGame) this.render()
  }

  private confirmCb: (() => void) | null = null
  confirm(title: string, text: string, yes: string, cb: () => void): void {
    this.open('confirm', esc(title), `<p>${esc(text)}</p>`, `<button class="btn" data-a="close">Zpět</button><button class="btn danger" id="confirm-yes">${esc(yes)}</button>`, '520px')
    this.confirmCb = cb
    const b = this.modal.querySelector<HTMLButtonElement>('#confirm-yes')!
    b.onclick = () => { const f = this.confirmCb; this.closeModal(); f?.() }
  }

  showBriefing(): void {
    const n = NATIONS[this.me.nation]
    const rivals = this.rivals
    this.open('brief', `Mise: ${esc(SCENARIOS[this.s.scenario].name)}`, `
      <div style="display:flex;gap:16px"><img src="${UI}p_${this.me.nation}.png" style="width:144px;height:144px;border:3px solid ${n.css};flex:none" alt="">
      <div><p>${esc(`Stará říše se rozpadla a její trůn osiřel. ${n.leader}, ${n.title.toLowerCase()}, ${SCENARIOS[this.s.scenario].intro}`)}</p>
      <p>${esc(`Vaši soupeři: ${rivals.map(r => `${NATIONS[r.nation].name} (${r.human ? `${NATIONS[r.nation].leader}, vede jiný hráč` : describeAI(r)})`).join(', ').replace(/, ([^,]*)$/, ' a $1')}. V divočině mezi vámi táboří barbaři.`)}</p></div></div>
      ${this.goalsHtml()}
      <p>${esc(`Každý národ si z domoviny přináší jednu znalost. Váš lid už ovládá: ${this.me.techs.map(t => TECHS[t].name).join(', ')} – proto je ve stromu technologií od začátku hotová.`)}</p>
      <p style="color:var(--muted)">${esc(`Na vše máte ${this.s.maxTurns} tahů. Cíle mise si kdykoli zobrazíte tlačítkem Mise (klávesa M). Rádce vás provede prvními tahy.`)}</p>`,
    `<button class="btn big" data-a="close">Rovnou hrát</button><button class="btn big" data-a="guide" data-v="0">Jak se to hraje</button>`, '860px')
  }

  /** Odpočet Slunečního chrámu v horní liště; klik skočí na jeho město. */
  private templeChip(): string {
    const s = this.s, left = wonderLeft(s), c = wonderCity(s)
    if (left === null || !c) return ''
    const mine = s.mission.wonderBy === this.my
    return `<div class="stat clickable" data-a="temple" style="color:var(${mine ? '--gold' : '--bad'})"${tip(`Sluneční chrám|${this.templeText().trim()}\nKliknutím mapu posunete na město.`)}><img src="${UI}b_wonder.png" alt="" style="height:20px;image-rendering:pixelated;vertical-align:-4px;margin-right:4px">${left}${NB}${turnsWord(left)}</div>`
  }

  /** Kdo drží Sluneční chrám a kolik tahů mu zbývá (prázdné, když chrám nestojí). */
  private templeText(): string {
    const s = this.s, left = wonderLeft(s), c = wonderCity(s)
    if (left === null || !c) return ''
    const by = s.mission.wonderBy
    return by === this.my
      ? ` Chrám stojí ve vašem městě ${c.name}: udržte ho ještě ${left} ${turnsWord(left)}.`
      : ` Pozor: chrám drží ${this.me.met.includes(by) ? NATIONS[s.players[by].nation].name : 'neznámý národ'} (${c.name}), do jejich vítězství zbývá ${left} ${turnsWord(left)}! Dobuďte město a chrám bude váš.`
  }

  private goalsHtml(): string {
    const s = this.s, m = s.mission
    const goal = (done: boolean, text: string, icon = 'star') => `<div class="goal ${done ? 'done' : ''}">${ic(done ? 'check' : icon)}<div>${esc(text)}</div></div>`
    const sn = seatCount(s, this.my), cq = s.conquest ?? null, left = cq ? Math.max(0, CONQUEST_TURNS - (s.turn - cq.since)) : 0
    const seats = this.rivals.map(p => {
      const c = s.cities.find(ct => ct.seat === p.id)
      const held = !p.alive || (!!c && c.owner === this.my)
      const known = this.me.met.includes(p.id)
      return `${known ? NATIONS[p.nation].name : 'neznámý národ'}${c && this.me.explored[idx(s, c.x, c.y)] ? ` (${c.name})` : ''}${held ? ' ✓' : ''}`
    }).join(', ')
    return `
      <h4>Cesty k vítězství (stačí jedna)</h4>
      ${goal(false, `Dobytí: držte své sídelní město a většinu cizích (${sn.held} z ${sn.total}, potřeba ${sn.need}) po ${CONQUEST_TURNS} tahů – ${seats}.${cq ? (cq.by === this.my ? ` Odpočet běží: ještě ${left} ${turnsWord(left)}.` : ` Pozor: ${this.me.met.includes(cq.by) ? NATIONS[s.players[cq.by].nation].name : 'neznámý národ'} většinu drží, zbývá ${left} ${turnsWord(left)}!`) : ''}`, 'war')}
      ${goal(false, `Div: objevte Sluneční kalendář, dostavte Sluneční chrám dřív než ostatní a udržte jeho město ${WONDER_TURNS} tahů.${this.templeText() || (hasTech(this.me, 'calendar') ? ' Astronomii už znáte.' : '')}`, 'sci')}
      ${goal(false, `Sláva: mějte po ${s.maxTurns} tazích nejvyšší skóre.`, 'turn')}
      <h4>Vedlejší úkoly</h4>
      ${goal(m.questRuins && m.ruinsBy === this.my, m.ruinsBy >= 0 && m.ruinsBy !== this.my ? `Prozkoumejte ruiny Starého trůnu ${SCENARIOS[s.scenario].ruinsWhere} – bohužel vás někdo předběhl.` : `Prozkoumejte ruiny Starého trůnu ${SCENARIOS[s.scenario].ruinsWhere} (odměna: zlato a technologie).`, 'flag')}
      ${goal(!!this.me.questCities, `Vládněte třem městům (odměna 60 zlata). Nyní: ${citiesOf(s, this.my).length}.`, 'pop')}
      ${goal(!!this.me.questCamps, `Vypalte dva barbarské tábory (odměna 60 zlata). Nyní: ${this.me.camps ?? 0}.`, 'str')}`
  }

  showMission(): void {
    const s = this.s
    const rows = s.players.filter(p => p.id !== barbId(s)).map(p => {
      const known = p.id === this.my || this.me.met.includes(p.id)
      const n = NATIONS[p.nation]
      return `<tr><td style="color:${known ? n.css : 'var(--muted)'}">${known ? n.name : 'Neznámý národ'}${p.alive ? '' : ' †'}</td><td>${known ? score(s, p.id) : '?'}</td><td>${known ? citiesOf(s, p.id).length : '?'}</td><td>${known ? p.techs.length : '?'}</td></tr>`
    }).join('')
    this.open('mission', `Mise: ${esc(SCENARIOS[s.scenario].name)}`, `${this.goalsHtml()}
      <h4>Milníky věků</h4>
      ${ERAS.slice(1).map((e, k) => {
        const i = k + 1, first = s.eraFirst[i]
        const who = first === undefined ? '' : first === this.my ? ' První jste byli vy – zlatý věk.' : this.me.met.includes(first) ? ` První byli ${NATIONS[s.players[first].nation].name}.` : ' První byl neznámý národ.'
        return `<div class="goal ${this.me.era >= i ? 'done' : ''}">${ic(this.me.era >= i ? 'check' : 'sci')}<div>${esc(`${e.name}: objevte ${e.techs} technologií (máte ${this.me.techs.length}). Odměna ${30 * i} zlata a ${15 * i} kultury; první národ získá zlatý věk na ${GOLDEN_TURNS} tahů.${who}`)}</div></div>`
      }).join('')}
      <h4>Stav sil</h4><table class="scores"><tr><th>Národ</th><th>Skóre</th><th>Města</th><th>Technologie</th></tr>${rows}</table>
      <p style="color:var(--muted);margin-top:10px">Tah ${Math.min(s.turn, s.maxTurns)} z ${s.maxTurns}.${s.scenario === 'random' ? ` Kód mapy: ${s.seed}.` : ''} Porážka: ztráta všech měst, nebo když Sluneční chrám dostaví a udrží soupeř.</p>`, undefined, '760px')
  }

  showTech(): void {
    const p = this.me
    const inc = playerIncome(this.s, this.my)
    const avail = availableTechs(p)
    const recTech = this.app.hints ? adviseTech(this.s, p) : null
    // Sedm sloupců; opakovatelná technologie stojí ve stejném sloupci pod vrcholovou.
    const W = 166, H = 70, GX = 16, GY = 12
    const col = (t: TechId) => Math.min(TECHS[t].tier, 7)
    const pos = (t: TechId) => [(col(t) - 1) * (W + GX), (TECHS[t].repeat ? 3 : TECHS[t].row) * (H + GY)]
    let lines = ''
    let cards = ''
    for (const id of TECH_IDS) {
      const t = TECHS[id]
      const [x, y] = pos(id)
      for (const r of t.req) {
        const [rx, ry] = pos(r)
        const done = p.techs.includes(r)
        lines += `<path d="M${rx + W} ${ry + H / 2} C ${rx + W + 20} ${ry + H / 2}, ${x - 20} ${y + H / 2}, ${x} ${y + H / 2}" stroke="${done ? '#3f8f5a' : '#3a466f'}" stroke-width="3" fill="none"/>`
      }
      const qi = p.techQueue.indexOf(id)
      const isRec = recTech === id && p.research !== id
      const cls = p.techs.includes(id) ? 'done' : p.research === id ? 'cur avail' : `${avail.includes(id) ? 'avail' : 'locked far'}${qi >= 0 ? ' queued' : ''}`
      // U plánovaných technologií se tahy sčítají přes celou frontu.
      const cost = techCost(p, id)
      let pts = cost - (p.research === id ? p.progress : 0)
      if (qi >= 0) pts = (p.research ? techCost(p, p.research) - p.progress : 0) + p.techQueue.slice(0, qi + 1).reduce((a, q) => a + techCost(p, q), 0)
      const left = Math.max(1, Math.ceil(pts / Math.max(1, inc.sci)))
      const order = p.research === id ? '1' : qi >= 0 ? String(qi + (p.research ? 2 : 1)) : ''
      cards += `<div class="tech ${cls}${isRec ? ' rec' : ''}" style="left:${x}px;top:${y}px;width:${W}px"${tip(`${this.techTip(id)}${p.techs.includes(id) ? '' : avail.includes(id) ? '\nKlik: zkoumat hned · Shift + klik: zařadit za dosavadní plán' : `\nKlik: naplánovat cestu sem (${techPath(p, id).map(q => TECHS[q].name).join(' → ')}) · Shift + klik: zařadit za dosavadní plán`}`)} ${p.techs.includes(id) ? '' : `data-a="tech" data-v="${id}"`}>
        <img class="art" src="${techArtUrl(id, p.nation)}" alt="">${isRec ? REC : ''}${order ? `<i class="ord">${order}</i>` : ''}<span class="cost">${p.techs.includes(id) ? '✓' : `${cost} · ${left}${NB}t.`}</span><b>${t.name}${t.repeat && p.empire ? ` ${p.empire}×` : ''}</b><small>${esc(t.unlocks)}</small></div>`
    }
    const tiers = Math.max(...TECH_IDS.map(col))
    const w = tiers * W + (tiers - 1) * GX, hh = 7 * (H + GY)
    this.open('tech', `${ic('sci')}Strom technologií`, `<p style="color:var(--muted)">${esc(`Klikněte na kteroukoli technologii: u vzdálené se naplánuje celá cesta k ní a výzkum pak pokračuje sám. Shift + klik ji zařadí za dosavadní plán. Čísla ukazují pořadí. Vaše věda: ${inc.sci} za tah.${p.techQueue.length ? ` Ve frontě: ${p.techQueue.map(q => TECHS[q].name).join(' → ')}.` : ''}`)}${p.progress && !p.research ? esc(` Nastřádáno ${p.progress} bodů.`) : ''}</p>
      <div class="tree" style="width:${w}px;height:${hh}px"><svg width="${w}" height="${hh}">${lines}</svg>${cards}</div>`)
  }

  /** Tradice: trvalé výhody za nastřádanou kulturu. */
  showTraditions(): void {
    const p = this.me
    const ready = traditionReady(p)
    const cost = traditionCost(p.traditions.length)
    const cult = citiesOf(this.s, this.my).reduce((a, c) => a + cityYields(this.s, c).culture, 0)
    const left = Math.max(0, cost - p.culture)
    const recTrad = this.app.hints ? traditionAdvice(p) : null
    // Čtyři větve vedle sebe; v každé je na řadě vždy jen nejvyšší nepřijatá tradice.
    const open = openTraditions(p)
    const cards = BRANCH_IDS.map(b => {
      const list = branchOf(b).map((id, k) => {
        const has = p.traditions.includes(id), next = open.includes(id)
        return `<div class="trad ${has ? 'done' : next && ready ? 'avail' : next ? 'next' : 'locked'}${id === recTrad ? ' rec' : ''}" ${!has && next && ready ? `data-a="trad" data-v="${id}"` : ''}${tip(has ? `${TRADITIONS[id].name}|Přijato.` : next ? `${TRADITIONS[id].name}|Na řadě ve větvi ${BRANCHES[b].name}.` : `${TRADITIONS[id].name}|Nejdřív přijměte tradice nad ní.`)}>${id === recTrad ? REC : ''}<b>${has ? '✓ ' : `${k + 1}. `}${TRADITIONS[id].name}</b><small>${esc(TRADITIONS[id].desc)}</small></div>`
      }).join('')
      return `<div class="branch ${branchDone(p, b) ? 'done' : ''}"><h4>${BRANCHES[b].name}</h4><p>${esc(BRANCHES[b].desc)}</p>${list}<p class="fin">${branchDone(p, b) ? '✓ větev úplná' : `Celá větev: zlatý věk na ${GOLDEN_TURNS}${NB}tahů`}</p></div>`
    }).join('')
    const all = p.traditions.length >= TRADITION_IDS.length
    this.open('trad', `${ic('culture')}Tradice`, `<p>${esc(all ? 'Váš národ přijal všechny tradice.' : ready ? `Máte ${p.culture} kultury – vyberte si novou tradici (stojí ${cost}). Platí pro celý národ a napořád. Ve větvi se postupuje odshora; všechny tradice se za hru stihnout nedají.` : `Další tradice stojí ${cost} kultury, máte ${p.culture}.${cult > 0 ? ` Při ${cult} kultury za tah to bude za ${Math.ceil(left / cult)} tahů.` : ' Vaše města zatím žádnou kulturu nedávají.'} Kulturu zvyšují monumenty a chrámy.`)}</p>
      <div class="trads">${cards}</div>`, undefined, '1180px')
  }

  showPopup(title: string, text: string): void {
    this.open('popup', `${ic('star')}${esc(title)}`, `<p style="font-size:21px;line-height:1.3">${esc(text)}</p>`, `<button class="btn big" data-a="close">Výborně</button>`, '620px')
  }

  showDiplo(msg = ''): void {
    const s = this.s
    const mine = militaryPower(s, this.my)
    const my = this.my
    const cards = this.rivals.map(p => {
      const n = NATIONS[p.nation]
      if (!this.me.met.includes(p.id)) return `<div class="rival" style="--c:#667"><h3>Neznámý národ</h3><p>Tento národ jste zatím nepotkali. Pošlete zvědy za hory.</p></div>`
      if (!p.alive) return `<div class="rival" style="--c:${n.css}"><h3>${n.name} †</h3><p>Tento národ byl vyhlazen.</p></div>`
      const war = atWar(s, my, p.id)
      const theirs = militaryPower(s, p.id)
      const cmp = theirs > mine * 1.4 ? 'výrazně silnější než vy' : theirs > mine * 1.1 ? 'o něco silnější' : theirs > mine * 0.75 ? 'vyrovnané' : 'slabší než vy'
      const others = p.war.filter(w => w !== my && w !== barbId(s)).map(w => NATIONS[s.players[w].nation].name)
      const asked = s.offers.some(o => o.from === my && o.to === p.id && o.kind !== 'ally')
      const foot = `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">${war ? `<button class="btn" data-a="peace" data-v="${p.id}" ${asked ? 'disabled' : ''}>Nabídnout mír</button>` : `<button class="btn danger" data-a="war" data-v="${p.id}">Vyhlásit válku</button>`}</div></div>`
      const gift = `<button class="btn small" data-a="dip" data-v="gift:${p.id}" ${this.me.gold < GIFT ? 'disabled' : ''}${tip(p.human ? `Dar ${GIFT} zlata|Zlato dostane druhý hráč hned.` : `Dar ${GIFT} zlata|Zlepší vztah o 12 bodů.`)}>${ic('gold', 's')}Dar ${GIFT}</button>`
      // Lidský soupeř: jen válka, mír a dar; ostatní si hráči domluví sami.
      if (p.human) return `<div class="rival" style="--c:${n.css}"><div class="top"><img class="p" src="${UI}p_${p.nation}.png" alt=""><div><h3>${n.name}</h3><div>${esc(n.leader)}</div>
        <div class="st ${war ? 'war' : 'peace'}">${ic(war ? 'war' : 'peace', 's')}${war ? 'Válka' : 'Mír'}</div></div></div>
        <p>${esc(`Národ vede ${this.app.seatName(p.id) || 'jiný hráč'}. Vojsko: ${cmp}. Skóre ${score(s, p.id)}, měst ${citiesOf(s, p.id).length}.`)}${others.length ? esc(` Válčí s: ${others.join(', ')}.`) : ''}</p>
        ${asked ? `<p class="deal">${ic('peace', 's')}Vaše nabídka míru čeká na odpověď.</p>` : ''}
        ${war ? '' : `<div class="dip">${gift}</div>`}${foot}`
      return `<div class="rival" style="--c:${n.css}"><div class="top"><img class="p" src="${UI}p_${p.nation}.png" alt=""><div><h3>${n.name}</h3><div>${esc(n.leader)}</div>
        <div class="st ${war ? 'war' : 'peace'}">${ic(war ? 'war' : 'peace', 's')}${war ? 'Válka' : 'Mír'}</div></div></div>
        <p>${esc(`${PERSONAS[p.personality as PersonaId]?.desc ?? ''} Vojsko: ${cmp}. Skóre ${score(s, p.id)}, měst ${citiesOf(s, p.id).length}.`)}${others.length ? esc(` Válčí s: ${others.join(', ')}.`) : ''}</p>
        <p${tip('Vztah k vám|Zlepšují ho dary, obchod a společný boj; kazí ho vyhlášení války a odmítnutí pomoci. Přátelský národ vás nenapadne a spíš přijme spojenectví.')}>Vztah k vám: <b style="color:${p.attitude[my] >= 15 ? 'var(--good)' : p.attitude[my] <= -15 ? 'var(--bad)' : 'var(--text)'}">${attitudeWord(p, my)}</b> (${signed(p.attitude[my])})${s.turn < p.pactUntil[my] ? ` · spojenec ještě ${p.pactUntil[my] - s.turn}${NB}${turnsWord(p.pactUntil[my] - s.turn)}` : ''}</p>
        ${s.deals.filter(d => (d.seller === p.id && d.buyer === my) || (d.buyer === p.id && d.seller === my)).map(d => `<p class="deal">${ic('trade', 's')}${d.seller === my ? 'Prodáváte' : 'Kupujete'}: ${RESOURCES[d.res].name.toLowerCase()}, ${d.seller === my ? '+' : '−'}${d.gpt} zlata za tah, ještě ${d.until - s.turn}${NB}${turnsWord(d.until - s.turn)}</p>`).join('')}
        ${war ? '' : `<div class="dip">${TRADABLE.map(r => {
          const sb = saleBlock(s, p.id, r, my), bb = buyBlock(s, p.id, r, my)
          const nm = RESOURCES[r].name.toLowerCase()
          return `<button class="btn small" data-a="dip" data-v="sell:${p.id}:${r}" ${sb ? 'disabled' : ''}${tip(`Prodat: ${nm}|Dostanete ${salePrice(p, my, this.me)} zlata za tah po ${DEAL_TURNS} tahů. Jeden váš zdroj tím přenecháte soupeři: vy uživíte o ${UNITS_PER_SOURCE} jednotky méně, on o ${UNITS_PER_SOURCE} více.${sb ? `\nNelze: ${sb}` : ''}`)}>${ic('trade', 's')}Prodat ${nm} +${salePrice(p, my, this.me)}</button>
            <button class="btn small" data-a="dip" data-v="buy:${p.id}:${r}" ${bb ? 'disabled' : ''}${tip(`Koupit: ${nm}|Zaplatíte ${buyPrice(p, my, this.me)} zlata za tah po ${DEAL_TURNS} tahů a uživíte o ${UNITS_PER_SOURCE} jednotky se surovinou víc.${bb ? `\nNelze: ${bb}` : ''}`)}>${ic('trade', 's')}Koupit ${nm} −${buyPrice(p, my, this.me)}</button>`
        }).join('')}
          ${gift}
          ${this.rivals.some(q => q.id !== p.id && q.alive && this.me.met.includes(q.id)) ? `<span class="allylbl">${ic('war', 's')}Spojenectví proti:</span>` : ''}
          ${this.rivals.filter(q => q.id !== p.id && q.alive && this.me.met.includes(q.id)).map(q => `<button class="btn small" data-a="dip" data-v="ally:${p.id}:${q.id}"${tip(`Spojenectví proti: ${NATIONS[q.nation].name}|Oba vyhlásíte tomuto národu válku a spojenec vás 25 tahů nenapadne. Přijme, když je k vám aspoň vstřícný (vztah 20+) a soupeř pro něj není příliš silný, nebo když s ním už válčí.`)}>${NATIONS[q.nation].name}</button>`).join('')}
        </div>`}
        ${foot}`
    }).join('')
    this.open('diplo', 'Diplomacie', `${msg ? `<p style="color:var(--gold)">${esc(msg)}</p>` : ''}<div class="rivals">${cards}</div>`)
  }

  /** Ukáže další nabídku (mír, spojenectví), která čeká na hráče u počítače. */
  checkOffers(): void {
    const my = this.my
    const o = this.s.offers.find(x => x.to === my)
    if (!o || this.modalOpen || this.s.over || !this.app.myTurn) return
    const p = this.s.players[o.from]
    const n = NATIONS[p.nation]
    if (o.kind === 'ally') {
      const foe = this.s.players[o.vs!]
      // Zastaralou nabídku příkaz jen odklidí.
      if (!foe.alive || !atWar(this.s, o.from, o.vs!) || atWar(this.s, my, o.from) || atWar(this.s, my, o.vs!)) { this.app.answerOffer(o.from, false); if (!this.s.offers.includes(o)) this.checkOffers(); return }
      sfx('quest')
      this.open('offer', `${n.name} žádají o pomoc`, `<div style="display:flex;gap:14px"><img src="${UI}p_${p.nation}.png" style="width:96px;height:96px;border:2px solid ${n.css}" alt=""><div><p>${esc(`„Válčíme s národem ${NATIONS[foe.nation].name},“ vzkazuje ${n.leader}. „Přidejte se k nám a budeme vám přáteli.“`)}</p><p style="color:var(--muted)">${esc(`Přijetí znamená válku s národem ${NATIONS[foe.nation].name}; ${n.name} vás pak 25 tahů nenapadnou a vztah se výrazně zlepší. Odmítnutí vztah mírně zhorší.`)}</p></div></div>`,
        `<button class="btn" data-a="offer-no" data-v="${o.from}">Odmítnout</button><button class="btn" data-a="offer-yes" data-v="${o.from}">Přidat se do války</button>`, '640px')
      return
    }
    if (!atWar(this.s, my, o.from)) { this.app.answerOffer(o.from, false); if (!this.s.offers.includes(o)) this.checkOffers(); return }
    sfx('quest')
    this.open('offer', `${n.name} nabízejí mír`, `<div style="display:flex;gap:14px"><img src="${UI}p_${p.nation}.png" style="width:96px;height:96px;border:2px solid ${n.css}" alt=""><p>${esc(`„Dost krve bylo prolito,“ vzkazuje ${n.leader}. „Složme zbraně a každý ať si ponechá, co drží.“`)}</p></div>`,
      `<button class="btn" data-a="offer-no" data-v="${o.from}">Odmítnout</button><button class="btn" data-a="offer-yes" data-v="${o.from}">Přijmout mír</button>`, '600px')
  }

  showHelp(): void {
    this.open('help', `${ic('help')}Jak hrát`, `
      <h4>Cíl</h4><p>${esc('Vyhrajte jednou ze tří cest: dobytím (držte své sídelní město a většinu cizích po 5 tahů – ostatní se o odpočtu dozvědí a mohou zasáhnout), dostavbou Slunečního chrámu, nebo nejvyšším skóre po posledním tahu.')}</p>
      <h4>Ovládání</h4><ul>
        <li>${esc('Levé tlačítko: výběr jednotky či města. S vybranou jednotkou kliknutí na pole = pohyb (i na více tahů, jednotka pak chodí sama), na červený rámeček = útok.')}</li>
        <li>${esc('Shift + klik: přidá jednotce na cestě další průjezdní bod (fronta rozkazů, nejvýš 6). Pravé tlačítko: pošle jednotku i na pole s vlastní jednotkou či městem.')}</li>
        <li>${esc('Najetím myši na kteroukoli ikonu, tlačítko, stavbu nebo technologii zobrazíte nápovědu.')}</li>
        <li>${esc('Tažení myší nebo WASD / šipky: posun mapy. Kolečko nebo + a −: přiblížení.')}</li>
        <li>${esc('Osadníci: blikající světlé značky ukazují doporučená místa pro město, kliknutím tam osadníky pošlete a po příchodu město sami založí. Po najetí myší na pole uvidíte, jak je pro město dobré.')}</li>
        <li>${esc('I: tipy rádce zapnout / vypnout. Žárovka značí doporučenou volbu – stavbu ve městě, technologii, tradici, místo pro město i pole pro dělníky.')}</li>
        <li>${esc('L: přehled měst a jednotek – postranní seznam, co se kde staví a co která jednotka dělá.')}</li>
        <li>${esc('Enter: další rozhodnutí nebo konec tahu (Shift+Enter ukončí tah hned). Tab nebo N: další jednotka, Shift + Tab předchozí. T: technologie. M: mise. K: encyklopedie se všemi zkratkami. Esc: zrušit výběr.')}</li>
        <li>${esc('Jednotky: B založit město, F opevnit, G doprovázet civilní jednotku (voják s ní pak chodí sám), Z spát, X přeskočit tah, E automatika (dělníci vylepšují pole, zvěd a lodě zkoumají mapu).')}</li></ul>
      <h4>Města</h4><p>${esc('Obyvatelé obdělávají pole, která město zabralo (nejdál 3 pole od něj), a přinášejí jídlo (růst), výrobu (stavby a jednotky) a zlato. Každý obyvatel sní 2 jídla a dává 1 vědu. Kultura (monument, chrám) rozšiřuje hranice pole po poli: první stojí 8 kultury, každé další o 2 víc. Za zlato lze rozestavěnou položku dokončit ihned.')}</p>
      <p>${esc('Fronta výroby: kliknutí na položku ji zařadí na konec fronty, Shift + klik ji začne stavět hned. Ve frontě lze položky posouvat dopředu (▲) a rušit (✕).')}</p>
      <h4>Kultura, tradice a věky</h4><p>${esc('Kultura měst se sčítá do společné pokladnice národa. Jakmile jí je dost, vyberete si tradici (klávesa C) – trvalou výhodu pro celý národ. První stojí 30 kultury, každá další víc. Zároveň každé město svou kulturou rozšiřuje hranice.')}</p>
      <p>${esc(`Výzkum vás posouvá věky: ${ERAS.slice(1).map(e => `${e.name} při ${e.techs} technologiích`).join(', ')}. Vstup do věku je milník s odměnou ve zlatě a kultuře; národ, který do věku vstoupí první, získá zlatý věk (+1 výroba, zlato a kultura v každém městě na ${GOLDEN_TURNS} tahů). Každý národ začíná s jednou technologií, kterou si přinesl z domoviny.`)}</p>
      <h4>Cesty a řeky</h4><p>${esc('Po objevu Kola stavějí dělníci cesty (2 tahy na pole, v lese a pahorkatině 3; rozkaz Cesta do… postaví celou trasu). Krok z cesty na cestu stojí půl bodu pohybu, města se počítají jako cesta. Řeky tečou po hranách polí: pole u řeky dává +1 zlato, přechod řeky stojí bod pohybu navíc a útok zblízka přes řeku je o 20 % slabší. Cesta sama řeku nepřeklene; most na ní vznikne, až národ, kterému některý břeh patří, objeví Stavitelství. Město spojené cestou s hlavním městem (nebo přístavem na přístav) má po objevu Kupectví z každé trhové vsi +1 zlato navíc.')}</p>
      <h4>Ladicí záznam</h4><p>${esc('Zapisuje, co se ve hře děje a proč se počítač rozhodl, jak se rozhodl: války, mír, tažení, boje, města, výzkum. Hru neovlivňuje a nikam se neposílá – zůstává ve vašem prohlížeči a dá se stáhnout jako textový soubor.')}</p>
      <p><button class="btn small" data-a="log-toggle">${this.app.logOn ? 'Vypnout záznam' : 'Zapnout záznam'}</button> <button class="btn small" data-a="log-save" ${this.app.logOn && this.app.logSize ? '' : 'disabled'}>Stáhnout záznam (${this.app.logSize} řádků)</button></p>
      <h4>Hra po síti</h4><p>${esc('Chat otevřete tlačítkem s bublinou nahoře (klávesa Y), zvonek vedle něj zazvoní všem ostatním hráčům. Když táhnete zároveň s ostatními a ukončíte tah dřív, hlavní tlačítko vás k tahu vrátí, dokud ostatní ještě táhnou. Útok na národ, se kterým máte mír, i zajetí jeho dělníků znamená válku – hra se nejdřív zeptá.')}</p>
      <h4>Zkušenosti a přezbrojení</h4><p>${esc('Výběr povýšení stojí 1 bod pohybu a vyléčí 25 životů; jednotka bez pohybu si ho vybere až v dalším tahu. Jednotky získávají bojem zkušenosti a při 10, 25 a 45 bodech si vyberou povýšení: Výcvik (+15 % útok), Zocelení (+20 % obrana), Ranhojič (rychlejší léčení) nebo Pochodník (+1 pohyb). Zastaralou jednotku lze na vlastním území za zlato přezbrojit (klávesa U): válečník → kopiník → šermíř, zvěd → jezdec, galéra → triéra. Na mapě má jednotka u nohou zlatý šíp za každé povýšení, nad jednotkou čekající na povýšení se pohupuje hvězda a šipka nahoru značí, že ji lze přezbrojit – bílá hned, šedá až na vlastním území nebo s dostatkem zlata.')}</p>
      <h4>Obchod a spojenectví</h4><p>${esc('V okně Diplomacie vidíte vztah každého soupeře k vám. Koně a železo můžete prodávat či kupovat za zlato za tah, darem vztah zlepšíte. Vstřícný soupeř přijme spojenectví proti třetímu národu a 25 tahů vás nenapadne; někdy o pomoc požádá sám.')}</p>
      <h4>Lodě a nalodění</h4><p>${esc('Technologie Plavba dovolí pozemním jednotkám vstoupit na pobřežní vody, Navigace i na oceán. Nalodění i vylodění ukončí tah; naloděná jednotka pluje 3 pole za tah (s Navigací 4), nemůže útočit a brání se silou 4. Pobřežní město staví galéry (boj zblízka proti lodím a člunům) a triéry (střelba na 2 pole, i na břeh a města) a přístav (+1 jídlo z vodních polí, +2 zlato).')}</p>
      <h4>Suroviny</h4><p>${esc('Obilí, zvěř, ryby, kámen a zlato zvyšují výnos pole. Koně a železo jsou strategické: teprve s ohradou (koně) či dolem (železo) na vašem území jdou stavět jezdci a šermíři, a každý takový zdroj uživí jen 2 jednotky. Kdo chce víc jezdců či šermířů, potřebuje víc ložisek nebo surovinu dokoupit; přijdete-li o zdroj, hotové jednotky vám zůstanou, ale nové nepostavíte. Železo se na mapě objeví až po objevu Bronzu. Stav obou surovin ukazují ikony v horní liště, všechny suroviny na vašem území najdete v Přehledu (L). Chybějící surovinu lze koupit v Diplomacii.')}</p>
      <h4>Pole a vylepšení</h4><p>${esc('Louky dávají jídlo, pláně jídlo i výrobu, pahorkatina výrobu, les výrobu. Na poli stojí vždy jen jedno vylepšení a na rovině si vybíráte: farma (jídlo), nebo trhová ves (zlato). Na pahorkatině se hloubí doly, v lese stojí pily – nebo les vymýtíte za jednorázovou výrobu pro město. Koně a zvěř chtějí ohradu, ryby loviště (staví ho nalodění dělníci). Zavlažování přidá jídlo jen farmám u řeky, pila u řeky dává výrobu navíc. Přestavba na jiné vylepšení trvá o 2 tahy déle. Rozpracovaná práce na poli zůstane, i když dělníci odejdou. Koně a železo je nutné vylepšit, aby šlo stavět jezdce a šermíře.')}</p>
      <h4>Plenění</h4><p>${esc('Bojová jednotka na poli národa, se kterým válčíte, může pole vyplenit (klávesa P): vylepšení, napodruhé i cesta, přestane fungovat, dokud je dělníci neopraví, a vy získáte zlato. Vypleněný důl či ohrada nedodává surovinu, vypleněná cesta přeruší spojení měst. Oprava trvá polovinu doby stavby. Plení i barbaři.')}</p>
      <h4>Šik a voj</h4><p>${esc('Dvě stejné jednotky stojící vedle sebe se po objevu Válečnictví spojí v šik (klávesa J), se Zbrojířstvím tři ve voj. Vznikne jedna jednotka na jednom poli se silou +50 %, respektive +90 %; hodí se tam, kde je málo místa, hlavně u hradeb. Životů má dál nejvýš 100 – při spojení dostane průměr spojovaných jednotek – a zkušenosti přebírá od zkušenější. Žold a suroviny se platí dál za každou jednotku. Rozdělit ji lze jen na vlastním území. Spojovat se smí pěchota, jízda a střelci.')}</p>
      <h4>Boj</h4><p>${esc('Na jednom poli může stát jedna vojenská a jedna civilní jednotka. V boji zblízka utrpí ztráty obě strany, střelci (dostřel 2) odvetu nedostanou. Pahorkatina a les dávají obránci +25 %, opevnění dalších +25 %. Kopiníci mají +50 % proti jízdě, obléhací stroje trojnásobný účinek proti městům a poloviční proti jednotkám. Jednotka, která se celý tah nehýbe, se léčí (nejrychleji ve městě). Opevnění (+25 % k obraně) platí hned, jen když jednotka v tahu neútočila a zbyl jí pohyb; jinak až od příštího tahu. Opevněná jednotka má na mapě štít. Útok zblízka stojí tolik pohybu jako vstup na pole cíle – jednotka s plným pohybem smí zaútočit vždy. Střelci na dvě pole nevidí přes les, pahorkatinu ani hory; z pahorkatiny se střílí přes les i přes jiné pahorky. Obléhací stroje nestřílejí v tahu, kdy se přesunuly. Po objevu Válečnictví pomáhá obklíčení: útok zblízka je o 10 % silnější za každou další vaši jednotku pro boj zblízka u cíle a obránce o 10 % za každou svou jednotku vedle sebe. Šermíři, sekerníci a zbrojnoši mají +25 % proti kopiníkům, jízda +25 % proti střelcům a strojům. Zraněná jednotka ztrácí nejvýš 35 % síly. Na území národa, se kterým válčíte, se jednotky léčí jen o 5 životů za tah. Spící jednotku probudí jen nepřítel, kterého vidíte do dvou polí.')}</p>
      <p>${esc(`Město má 200 životů obránců; dobudete ho, když je útoky srazíte na nulu a vstoupíte do něj jednotkou pro boj zblízka. Stavby Hradby a Bašty přidají po 100 bodech hradeb, které berou rány místo obránců: od pěchoty jen 20 % škody (s beranidlem u města plnou), od střelců 50 %, od obléhacích strojů plnou. Co hradby nepoberou, projde na obránce. Dobyté město si hradby nechá tak pobořené, jak jsou, a obráncům zbude čtvrtina životů. Města střílejí na nepřátele do 2 polí – jednou za tah, cíl můžete vybrat v otevřeném městě kliknutím na jednotku v červeném rámu, jinak město vystřelí samo na nejslabší – a každý tah si opraví 10 životů. Obléhejte proto se stroji: beranidlo samo neútočí, ale pěchotě útočící na město, u kterého stojí, přidá +50 % síly a jednotkám hned u města +50 % obrany proti odvetě i střelbě z hradeb; katapult, balista a trebuchet mají proti městům trojnásobný účinek, proti jednotkám jen poloviční. Stojí-li hned u města aspoň ${SIEGE_UNITS} vaše bojové jednotky, je v obležení a neopravuje se.`)}</p>
      <h4>Více hráčů</h4><p>${esc('Při zakládání hry zvolte, kolik národů se utká (2–8) a kolik z nich vedou lidé u tohoto počítače. Každý si vybere národ a pak táhnete jeden po druhém; mezi tahy mapu zakryje opona a počítač si předáte. Po posledním z vás táhnou soupeři vedení počítačem a barbaři. Zprávy, mlhu i rady má každý své. Mezi sebou si můžete vyhlásit válku, nabídnout mír (druhý hráč odpoví, až bude na tahu) a poslat dar; vše ostatní si domluvíte u stolu.')}</p>
      <h4>Pokladna</h4><p>${esc('Každá vojenská jednotka nad volný limit (3 + 2 za město) stojí 1 zlato za tah, některé budovy také. Prázdná pokladna brzdí výzkum.')}</p>`, `<button class="btn" data-a="pedia" data-v="units">Encyklopedie</button><button class="btn" data-a="guide" data-v="0">Návod krok za krokem</button><button class="btn" data-a="close">Zavřít</button>`, '820px')
  }

  /** Encyklopedie; `at` je záložka, případně „záložka:heslo“, na které se má okno otevřít. */
  showPedia(at = 'units'): void {
    const [t, id] = at.split(':')
    const tab = (PEDIA_TABS.some(([k]) => k === t) ? t : 'units') as PediaTab
    this.open('pedia', `${ic('book')}Encyklopedie`, pediaHtml(tab, this.app.inGame ? this.me.nation : 'aur'), undefined, '1180px')
    const el = id ? this.modal.querySelector<HTMLElement>(`#pd-${tab}-${id}`) : null
    if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('hit') }
  }

  /** Úvodní návod po stránkách. */
  showGuide(page = 0): void {
    const nat = this.pickedNation
    const img = (src: string, w: number) => `<img src="${src}" style="width:${w}px" alt="">`
    const pic = (name: string, w = 72) => img(`${UI}${name}.png`, w)
    const upic = (type: string, w = 72) => img(unitIconUrl(type, nat), w)
    const li = (items: string[]) => `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    const pages: [string, string, string][] = [
      ['O co jde', pic(`p_${nat}`, 120) + pic('f_ruins', 96) + pic('b_wonder', 80),
        `<p>${esc('Vedete svůj národ v zemi, kde osiřel trůn staré říše. Hraje se na tahy: nejdřív rozdáte rozkazy vy, potom táhnou soupeři a barbaři. Délku hry volíte při zakládání (běžně 120 tahů).')}</p>` +
        li(['Dobytí: držte své sídelní město a většinu cizích po 5 tahů.', `Div: vyzkoumejte Sluneční kalendář, dostavte Sluneční chrám jako první a udržte jeho město ${WONDER_TURNS} tahů. Kdo město dobude, získá chrám pro sebe.`, 'Sláva: mějte po posledním tahu nejvyšší skóre.']) +
        `<p>${esc('Stačí jedna z cest. Prohrajete, když ztratíte všechna města nebo když Sluneční chrám dostaví a udrží soupeř.')}</p>`],
      ['Mapa a ovládání', pic('t_grass_1', 96) + pic('hex_move', 96) + pic('hex_attack', 96),
        li(['Mapu posouváte tažením myši nebo klávesami WASD, kolečkem přibližujete.', 'Kliknutím vyberete jednotku nebo město. Esc výběr zruší.', 'S vybranou jednotkou: klik na světlé pole = pohyb ještě tento tah, klik kamkoli dál = cesta na více tahů (jednotka pak chodí sama), klik na červený rámeček = útok.', 'Shift + klik přidá jednotce další průjezdní bod.', 'Najeďte myší na cokoli v rozhraní a zobrazí se nápověda. Dole uprostřed vidíte popis pole pod kurzorem.'])],
      ['První město', upic('settler', 88) + img(cityIconUrl(1, nat), 110),
        `<p>${esc('Začínáte s osadníky, válečníkem a zvědem. Vyberte osadníky a založte město (klávesa B) – místo, kde stojí, je dobré.')}</p>` +
        li(['Kliknutím na město otevřete jeho okno. Obyvatelé obdělávají okolní pole a přinášejí jídlo (růst), výrobu (stavby) a zlato.', 'Vyberte, co stavět. Další kliknutí přidávají položky do fronty, takže město může mít plán na mnoho tahů dopředu.', 'Na začátek: válečník nebo zvěd, pak dělníci a osadníci pro druhé město. Žárovka u položky značí, co rádce doporučuje.'])],
      ['Pole, dělníci a kultura', upic('worker', 80) + pic('i_farm', 80) + pic('i_mine', 80) + pic('ic_culture', 60),
        li(['Dělníci staví na polích ve vašem území farmy, doly, ohrady a pily, později trhové vsi a loviště. Na rovině volíte mezi farmou a vsí. Když dělníky vyberete, pole k vylepšení se označí blikající světlou značkou – stačí na ně kliknout. Rozkaz Automaticky (E) je nechá pracovat samostatně.', 'Po objevu Kola stavějí i cesty: pohyb po nich stojí polovinu. Most přes řeku přijde až se Stavitelstvím.', 'Koně a železo je nutné vylepšit (ohrada, důl), teprve pak lze stavět jízdu a šermíře.', 'Kultura rozšiřuje hranice města. Každé město ji střádá zvlášť a zabírá za ni okolní pole po jednom, nejdál 3 pole od sebe; každé další je dražší. Vybírá si je samo (nejdřív suroviny), v okně města můžete přepnout na ruční výběr. Zrychlí to monument, chrám a velké město.', 'Město bez akvaduktu neporoste přes 6 obyvatel, bez kanalizace přes 12.', 'Kultura všech měst se navíc sčítá a národ si za ni vybírá tradice – trvalé výhody ve čtyřech větvích (ukazatel kultury nahoře, klávesa C). Všechny se stihnout nedají; dokončená větev přinese zlatý věk.'])],
      ['Výzkum', pic('ic_sci', 72) + pic('b_library', 80) + pic('b_academy', 80),
        li(['Vědu dávají obyvatelé, knihovny a akademie. Co zkoumat, volíte ve stromu technologií (klávesa T nebo ukazatel nahoře). Kliknete-li na vzdálenou technologii, naplánuje se celá cesta k ní.', 'Technologie odemykají jednotky, budovy a vylepšení polí. Po najetí myší na kartu uvidíte přesně co.', 'Každý národ začíná s jednou hotovou technologií. Počet objevů vás posouvá do dalších věků – kdo je v novém věku první, získá zlatý věk.', 'Sluneční kalendář na vrcholu stromu odemyká Sluneční chrám; vede k němu učenecká a stavitelská větev, ne celý strom. Po něm lze opakovaně zkoumat Správu říše, která přidává zlato.'])],
      ['Vojsko a boj', upic('warrior', 80) + upic('archer', 80) + pic('f_camp', 96),
        li(['Na jednom poli stojí nejvýš jedna vojenská a jedna civilní jednotka.', 'Zblízka utrpí ztráty obě strany, střelci (dostřel 2 pole) odvetu nedostanou. Před útokem vidíte odhad ztrát.', 'Les a pahorkatina pomáhají obránci, opevnění (F) také, útok přes řeku je slabší. Jednotka, která se tah nehýbe, se léčí.', 'Bojem jednotky sbírají zkušenosti a vybírají si povýšení; staré jednotky lze za zlato přezbrojit.', 'Barbarský tábor vypálíte tím, že na něj vstoupíte. Město dobudete, když mu srazíte hradby na nulu a vejdete do něj pěchotou.'])],
      ['Lodě', upic('galley', 80) + upic('trireme', 80) + upic('boat', 80) + pic('b_harbor', 80),
        li(['Po objevu Plavby se pozemní jednotky mohou nalodit: stačí je poslat na pobřežní vodu. Nalodění i vylodění ukončí tah.', 'Na člunech jednotka nemůže útočit a skoro se neubrání, zato obepluje hory i hradby.', 'Pobřežní město staví galéry (boj s loděmi a čluny) a později triéry, které střílejí i na břeh a města.', 'Navigace otevře oceán. Přístav dává jídlo z vodních polí a zlato.'])],
      ['Konec tahu', pic('ic_turn', 72) + pic(`em_${nat}`, 80),
        li(['Tlačítko vpravo dole (Enter) vás vždy zavede k tomu, co čeká na rozhodnutí: výzkum, město bez výroby, jednotka bez rozkazu. Když nic nečeká, ukončí tah.', 'Shift + Enter ukončí tah hned.', 'Rádce vpravo nahoře vám v prvních tazích napoví další krok. Cíle mise ukáže tlačítko Mise (M), celá pravidla tlačítko s otazníkem (H).'])],
    ]
    const n = pages.length
    const p = Math.max(0, Math.min(n - 1, page))
    const [title, pics, text] = pages[p]
    const dots = pages.map((_, i) => `<i class="${i === p ? 'on' : ''}" data-a="guide" data-v="${i}"></i>`).join('')
    const foot = `<button class="btn" data-a="close">${p === n - 1 ? 'Zavřít' : 'Přeskočit návod'}</button>${p > 0 ? `<button class="btn" data-a="guide" data-v="${p - 1}">Zpět</button>` : ''}${p < n - 1 ? `<button class="btn big" data-a="guide" data-v="${p + 1}">Další</button>` : `<button class="btn big" data-a="close">${this.app.inGame ? 'Hrát!' : 'Rozumím'}</button>`}`
    this.open('guide', `Jak hrát – ${esc(title)} <small>${p + 1} / ${n}</small>`, `<div class="guide"><div class="pics">${pics}</div><div class="txt">${text}</div></div><div class="dots">${dots}</div>`, foot, '860px')
  }

  showGameOver(): void {
    const s = this.s, o = s.over!
    // Vítěz čte svůj text; lidský hráč, který nevyhrál, čte ten druhý.
    const mine = o.winner === this.my || !s.players[o.winner]?.human
    const won = o.won && mine
    const title = mine ? o.title : 'Porážka'
    const text = mine ? o.text : o.other ?? o.text
    const multi = s.players.filter(p => p.human).length > 1
    const rows = s.players.filter(p => p.id !== barbId(s)).map(p => `<tr><td style="color:${NATIONS[p.nation].css}">${NATIONS[p.nation].name}${p.alive ? '' : ' †'}</td><td>${score(s, p.id)}</td><td>${citiesOf(s, p.id).length}</td><td>${p.techs.length}</td></tr>`).join('')
    this.open('over', esc(multi && won ? `${NATIONS[this.me.nation].name}: ${title}` : title), `<div style="display:flex;gap:16px"><img src="${UI}${won ? `p_${this.me.nation}` : 'em_barb'}.png" style="width:144px;height:144px;flex:none;border:3px solid ${won ? 'var(--gold)' : 'var(--bad)'}" alt=""><div><p style="font-size:19px">${esc(text)}</p>
      <p style="color:var(--muted)">${esc(`Hra skončila v tahu ${Math.min(s.turn, s.maxTurns)}. Obtížnost: ${DIFFICULTY[s.difficulty].name.toLowerCase()}.`)}</p></div></div>
      <table class="scores"><tr><th>Národ</th><th>Skóre</th><th>Města</th><th>Technologie</th></tr>${rows}</table>`,
    `<button class="btn big" data-a="over-menu">Hlavní menu</button>`, '760px')
  }
}

void itemName
