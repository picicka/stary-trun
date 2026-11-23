// Rozhraní v HTML nad plátnem: lišta, panely, okna, menu, tutoriál.
import {
  BUILDINGS, BUILDING_IDS, DIFFICULTY, IMPROVEMENTS, NATIONS, PLAYABLE, RESOURCES, TECHS, TECH_IDS, TERRAIN, UNITS, UNIT_IDS,
  type BuildingId, type Difficulty, type ImprovementId, type NationId, type TechId, type UnitId,
} from '../game/data.ts'
import { describeAI, siteScore } from '../game/ai.ts'
import { attitudeWord, buyBlock, buyPrice, DEAL_TURNS, GIFT, saleBlock, salePrice, TRADABLE } from '../game/diplo.ts'
import { ERAS, GOLDEN_TURNS, PROMOS, PROMO_IDS, ROAD, SCENARIOS, SCENARIO_IDS, TRADITIONS, TRADITION_IDS, XP_LEVELS, traditionCost, type ScenarioId, type TraditionId } from '../game/data.ts'
import { generateScenario, ISLANDS_SEED, MISSION_SEED } from '../game/mapgen.ts'
import { hexCenter } from '../game/hex.ts'
import {
  atWar, availableBuilds, availableTechs, BORDER_AT, buyCost, canBuy, canFoundCity, cityAt, cityMaxHp, citiesOf, cityStrength, cityYields, cultureSources, freeUnits, growthNeed, hasTech, idx,
  isCivilian, isEmbarked, isNaval, isWater, itemCost, itemName, maxMoves, militaryPower, sameItem, playerIncome, previewAttack, resourceVisible, score, tileYield, unitBlockReason, unitStrength,
  unitsAt, unitsOf, foundBlock, isCoastal, traditionReady, pendingPromos, tileJobs, upgradeBlock, upgradeCost, upgradeTarget, xpLevel,
} from '../game/rules.ts'
import { hasSave, pickRivals, START_TECH } from '../game/state.ts'
import { BARB, type BuildItem, type City, type Note, type Unit } from '../game/types.ts'
import { isMusicOn, isMuted, setMusic, setMuted, sfx } from '../audio.ts'
import type { App } from '../app.ts'

/** Složka s obrázky rozhraní včetně základní adresy webu. */
const UI = `${import.meta.env.BASE_URL}assets/ui/`
const NB = ' '
/** Česká typografie: pevná mezera za jednopísmennými předložkami a spojkami a mezi číslem a jednotkou. */
export function typo(s: string): string {
  return s
    .replace(/(^|[\s(„>])([ksvzouaiKSVZOUAI])[ \t]+(?=\S)/g, `$1$2${NB}`)
    .replace(/(\d)[ \t]+(?=[%\p{L}])/gu, `$1${NB}`)
    .replace(/ - /g, ' – ')
}
const esc = (s: string) => typo(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
/** Atribut s bublinovou nápovědou. Tvar „Nadpis|text“, řádky odděluje \n. */
const tip = (s: string) => ` data-tip="${typo(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')}"`
const ic = (n: string, cls = '') => `<img class="ic ${cls}" src="${UI}ic_${n}.png" alt="">`
/** Body pohybu mohou být po cestách půlené. */
const mv = (n: number) => String(Math.round(n * 2) / 2).replace('.', ',')
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

  private app: App

  constructor(app: App) {
    this.app = app
    this.corner.append(this.mini, this.endBtn)
    this.root.append(this.labels, this.top, this.notes, this.unitPanel, this.tileInfo, this.corner, this.cityPanel, this.tip, this.overview, this.waiting, this.modal, this.menu, this.tipBox)
    this.root.addEventListener('mouseover', e => this.showTip((e.target as HTMLElement).closest<HTMLElement>('[data-tip]')))
    this.root.addEventListener('mouseleave', () => this.showTip(null))
    this.root.addEventListener('pointerdown', () => this.showTip(null), { capture: true })
    this.endBtn.onclick = e => this.app.mainAction((e as MouseEvent).shiftKey)
    this.mini.onpointerdown = e => this.miniClick(e)
    this.mini.onpointermove = e => { if (e.buttons & 1) this.miniClick(e) }
    this.root.addEventListener('click', e => this.onClick(e))
    this.root.addEventListener('wheel', e => { if (!(e.target as HTMLElement).closest('.body, .inner, #menu')) e.preventDefault() }, { passive: false })
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
    if (d.needs) l.push(`Vyžaduje surovinu: ${RESOURCES[d.needs].name} (vylepšenou ve vašem území).`)
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
      bronze: 'na mapě se objeví ložiska železa', wheel: 'dělníci mohou stavět cesty (pohyb za půl bodu, most přes řeku)', irrigation: 'farmy dávají +1 jídlo', astronomy: 'kdo dostaví Sluneční chrám, vyhrává misi',
      sailing: 'pozemní jednotky se mohou nalodit a plout po pobřežních vodách', navigation: 'naloděné jednotky smějí na oceán a plují rychleji',
    }
    if (extra[id]) un.push(extra[id]!)
    return `${d.name}|Cena: ${d.cost} bodů vědy${d.req.length ? `\nVyžaduje: ${d.req.map(r => TECHS[r].name).join(', ')}` : ''}\nOdemyká: ${un.join('; ') || d.unlocks}`
  }

  private get pickedNation(): NationId { return this.app.inGame ? this.me.nation : this.pickNation }

  get modalOpen(): boolean { return !this.modal.classList.contains('hidden') }
  private get s() { return this.app.state }
  private get me() { return this.app.state.players[0] }

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
      case 'overview': sfx('click'); this.toggleOverview(); break
      case 'ov-city': { const c = this.s.cities.find(o => o.id === Number(arg)); if (c && !app.busy) { sfx('select'); app.openCity(c) } break }
      case 'ov-unit': { const u = this.s.units.find(o => o.id === Number(arg)); if (u && !app.busy) { sfx('select'); app.select(u, true) } break }
      case 'trad-open': sfx('click'); this.showTraditions(); break
      case 'trad': app.chooseTradition(arg as TraditionId); if (traditionReady(this.me)) this.showTraditions(); else this.closeModal(); break
      case 'tech': app.chooseTech(arg as TechId); this.showTech(); break
      case 'mission': sfx('click'); this.showMission(); break
      case 'diplo': sfx('click'); this.showDiplo(); break
      case 'help': sfx('click'); this.showHelp(); break
      case 'close': sfx('click'); this.closeModal(); break
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
      case 'advise': if (app.city) app.advise(app.city); break
      case 'mute': setMuted(!isMuted()); this.render(); break
      case 'music': setMusic(!isMusicOn()); sfx('click'); this.render(); break
      case 'zoom': app.scene.zoomBy(Number(arg)); break
      case 'menu': this.confirm('Odejít do hlavního menu?', 'Hra je průběžně ukládána, můžete v ní později pokračovat.', 'Odejít', () => app.quitToMenu()); break
      case 'tip-ok': this.s.tutorial.push(arg); this.tipOpen = false; sfx('click'); this.render(); break
      case 'tip-off': this.s.tutorial.push('off'); this.render(); break
      case 'note': {
        const n = this.s.notes[Number(arg)]
        if (n) { this.read.add(n); if (n.x !== undefined && n.y !== undefined) app.scene.centerOn(n.x, n.y) }
        this.renderNotes()
        break
      }
      case 'citylabel': {
        const c = this.s.cities.find(o => o.id === Number(arg))
        if (c && c.owner === 0 && !app.busy) { sfx('select'); app.openCity(c) }
        break
      }
      case 'war': this.confirm('Vyhlásit válku?', `Opravdu chcete vyhlásit válku národu ${NATIONS[this.s.players[Number(arg)].nation].name}?`, 'Vyhlásit válku', () => { app.declare(Number(arg)); this.showDiplo() }); break
      case 'peace': { const msg = app.proposePeace(Number(arg)); this.showDiplo(msg) ; break }
      case 'offer-yes': app.answerOffer(Number(arg), true); this.closeModal(); this.checkOffers(); break
      case 'offer-no': app.answerOffer(Number(arg), false); this.closeModal(); this.checkOffers(); break
      case 'm-new': sfx('click'); this.setupStep = 0; this.showSetup(); break
      case 'm-next': sfx('click'); this.setupStep = 1; this.showSetup(); break
      case 'm-continue': sfx('click'); if (!app.continueGame()) this.showTitle(); break
      case 'm-help': sfx('click'); this.showGuide(0); break
      case 'm-back': sfx('click'); if (this.setupStep === 1) { this.setupStep = 0; this.showSetup() } else this.showTitle(); break
      case 'm-nation': this.pickNation = arg as NationId; sfx('select'); this.showSetup(); break
      case 'm-diff': this.pickDiff = arg as Difficulty; sfx('click'); this.showSetup(); break
      case 'm-start': sfx('found'); app.newGame(this.pickNation, this.pickDiff, this.pickScenario); break
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
        <button class="btn" data-a="m-new">Nová hra</button>
        <button class="btn" data-a="m-help">Jak hrát</button>
      </div>
      <div class="credit">Tři scénáře · čtyři národy</div>`
  }

  private showSetup(): void {
    this.menu.className = 'setup'
    const [r1, r2] = pickRivals(this.pickNation)
    const cards = PLAYABLE.map(id => {
      const n = NATIONS[id]
      const u = UNITS[n.unique]
      return `<button class="card panel ${id === this.pickNation ? 'sel' : ''}" style="--c:${n.css}" data-a="m-nation" data-v="${id}">
        <div class="ph"><img class="p" src="${UI}p_${id}.png" alt=""><div><img class="e" src="${UI}em_${id}.png" alt=""><h3>${n.name}</h3></div></div>
        <div class="leader">${esc(n.leader)}<br>${esc(n.title)}</div>
        <div class="lore">${esc(n.lore)}</div>
        <div class="trait"><b>${esc(n.trait)}</b>${esc(n.traitDesc)}</div>
        <div class="starts">${ic('sci', 's')}Začíná se znalostí: ${TECHS[START_TECH[id]].name}${id === 'thal' ? ', Plavba' : ''}</div>
        <div class="trait"><img src="${UI}u_${n.unique}_${id}.png" alt=""><b>${esc(u.name)}</b>${esc(u.desc)}${u.replaces ? ` (místo: ${UNITS[u.replaces].name})` : ''}</div>
      </button>`
    }).join('')
    const diffs = (Object.keys(DIFFICULTY) as Difficulty[]).map(d => `<button class="${d === this.pickDiff ? 'on' : ''}" data-a="m-diff" data-v="${d}">${DIFFICULTY[d].name}</button>`).join('')
    const scens = SCENARIO_IDS.map(id => `<button class="scen panel ${id === this.pickScenario ? 'sel' : ''}" data-a="m-scen" data-v="${id}">
        <canvas width="120" height="78" data-scen="${id}"></canvas><div><h3>${esc(SCENARIOS[id].name)}</h3><div class="lore">${esc(SCENARIOS[id].desc)}</div></div></button>`).join('')
    const scroll = this.menu.scrollTop
    const sd = SCENARIOS[this.pickScenario]
    this.menu.innerHTML = this.setupStep === 0 ? `
      <h2>Vyberte scénář</h2>
      <div class="lead">${esc('Stará říše padla a její trůn osiřel. Kde se o něj utkáte?')}</div>
      <div class="scens">${scens}</div>
      <div class="setuprow"><span>Obtížnost:</span><div class="seg">${diffs}</div></div>
      <div class="setupinfo">${esc(DIFFICULTY[this.pickDiff].desc)}</div>
      <div class="setuprow"><button class="btn big" data-a="m-back">Zpět</button><button class="btn big" data-a="m-next">Dál: výběr národa</button></div>` : `
      <h2>Vyberte svůj národ</h2>
      <div class="lead">${esc(`${sd.name}, obtížnost ${DIFFICULTY[this.pickDiff].name.toLowerCase()}. Každý národ má jednu výjimečnou vlastnost a jednu unikátní jednotku.`)}</div>
      <div class="cards">${cards}</div>
      <div class="setupinfo">${esc(`Soupeři: ${NATIONS[r1].name} (výbojní) a ${NATIONS[r2].name} (stavitelé).`)}</div>
      <div class="setuprow"><button class="btn big" data-a="m-back">Zpět</button><button class="btn big" data-a="m-start">Začít misi</button></div>`
    this.menu.scrollTop = scroll
    this.drawScenarioPreviews()
  }

  private previewCache = new Map<ScenarioId, string[]>()

  /** Malý náhled mapy scénáře; náhodná země zůstává tajemstvím. */
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
      let cols = this.previewCache.get(id)
      if (!cols) {
        const sc = generateScenario(id === 'valley' ? MISSION_SEED : ISLANDS_SEED, id)
        cols = sc.tiles.map(t => (t.special === 'ruins' ? '#f2c230' : t.forest ? '#2f7a3a' : Hud.MINI[t.t]))
        for (const [x, y] of sc.starts) cols[y * sc.W + x] = '#ffffff'
        this.previewCache.set(id, cols)
      }
      for (let i = 0; i < cols.length; i++) {
        const x = i % 40, y = (i / 40) | 0
        g.fillStyle = cols[i]; g.fillRect(x * 3 + (y & 1) * 1.5, y * 3, 3, 3)
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
    // Po načtení uložené hry nezahlcovat starými zprávami.
    if (this.s.turn > 1) for (const n of this.s.notes) this.read.add(n)
    this.modal.classList.add('hidden')
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
    this.renderTip()
    this.renderOverview()
    this.renderLabels()
    this.drawMini()
    this.hover(this.hoverXY[0], this.hoverXY[1])
  }

  private renderTop(): void {
    const s = this.s, p = this.me
    const n = NATIONS[p.nation]
    const inc = playerIncome(s, 0)
    const cult = citiesOf(s, 0).reduce((a, c) => a + cityYields(s, c).culture, 0)
    const mil = unitsOf(s, 0).filter(u => !isCivilian(u)).length
    let research: string
    if (p.research) {
      const t = TECHS[p.research]
      const left = Math.max(1, Math.ceil((t.cost - p.progress) / Math.max(1, inc.sci)))
      research = `<div class="research" data-a="tech-open"${tip(`Výzkum: ${t.name}|${p.progress} / ${t.cost} bodů vědy, hotovo za ${left} ${turnsWord(left)}.\nOdemyká: ${t.unlocks}.\nKliknutím otevřete strom technologií (T).`)}>${ic('sci')}<span>${t.name}</span><div class="bar"><i style="width:${Math.min(100, 100 * p.progress / t.cost)}%"></i></div><small>${left}${NB}${turnsWord(left)}</small></div>`
    } else {
      const any = availableTechs(p).length > 0
      research = `<div class="research ${any && citiesOf(s, 0).length ? 'need' : ''}" data-a="tech-open"${tip('Výzkum|Kliknutím otevřete strom technologií (T) a zvolte, co zkoumat.')}>${ic('sci')}<span>${any ? 'Zvolte výzkum' : 'Vše objeveno'}</span></div>`
    }
    this.top.innerHTML = `
      <div class="nation" style="color:${n.css}"${tip(`${n.name} – ${n.trait}|${n.traitDesc}\nUnikátní jednotka: ${UNITS[n.unique].name}. ${UNITS[n.unique].desc}`)}><img src="${UI}em_${p.nation}.png" alt="">${n.name}</div>
      <div class="stat"${tip(`Pokladna: ${p.gold} zlata|Města vynášejí: +${inc.gold + inc.maint + inc.upkeep - inc.trade}\nÚdržba budov: −${inc.maint}\nŽold vojska: −${inc.upkeep} (jednotek ${mil}, zdarma ${freeUnits(s, 0)})${inc.trade ? `\nObchod se surovinami: ${signed(inc.trade)}` : ''}\nCelkem za tah: ${signed(inc.gold)}\nZa zlato lze ve městě dokončit výrobu ihned. Prázdná pokladna brzdí výzkum.`)}>${ic('gold')}${p.gold} <small>${signed(inc.gold)}</small></div>
      <div class="stat"${tip('Věda za tah|Každý obyvatel dává 1 vědu, další přidává hlavní město, knihovny a akademie.')}>${ic('sci')}<small>${signed(inc.sci)}</small></div>
      <div class="stat clickable ${traditionReady(p) ? 'need' : ''}" data-a="trad-open"${tip(`Kultura: ${p.culture} / ${traditionCost(p.traditions.length)}|Města dohromady dávají ${signed(cult)} kultury za tah. Za nastřádanou kulturu si národ vybírá tradice – trvalé výhody (máte ${p.traditions.length}).${traditionReady(p) ? '\nMůžete zvolit novou tradici!' : cult > 0 ? `\nDalší tradice za ${Math.max(1, Math.ceil((traditionCost(p.traditions.length) - p.culture) / cult))} tahů.` : ''}\nKaždé město navíc svou kulturou rozšiřuje hranice. Kliknutím otevřete tradice (C).`)}>${ic('culture')}${p.culture}<small>/${traditionCost(p.traditions.length)}</small></div>
      <div class="stat clickable" data-a="mission"${tip(`${ERAS[p.era].name}|${p.era < ERAS.length - 1 ? `Další věk (${ERAS[p.era + 1].name}) při ${ERAS[p.era + 1].techs} technologiích, máte ${p.techs.length}. Vstup do věku přináší zlato a kulturu; kdo je první, získá zlatý věk.` : 'Dosáhli jste posledního věku.'}${s.turn < p.goldenUntil ? `\nZlatý věk: ještě ${p.goldenUntil - s.turn} tahů (+1 výroba, zlato a kultura v každém městě).` : ''}`)}>${s.turn < p.goldenUntil ? '<b style="color:var(--gold)">★</b> ' : ''}${ERAS[p.era].name.replace(/^Věk | věk$/, '').replace(/^./, ch => ch.toUpperCase())}</div>
      ${research}
      <div class="stat"${tip(`Tah ${Math.min(s.turn, s.maxTurns)} z ${s.maxTurns}|Po posledním tahu rozhodne o vítězi skóre.`)}>${ic('turn')}${Math.min(s.turn, s.maxTurns)}${NB}/${NB}${s.maxTurns}</div>
      <div class="stat"${tip('Skóre|Technologie 6 bodů, město 12, obyvatel 4, budova 3, pole území 0,5, splněné vedlejší úkoly 20–25.')}>${ic('star')}${score(s, 0)}</div>
      <div class="spacer"></div>
      <button class="tbtn ${this.overviewOn ? 'on' : ''}" data-a="overview"${tip('Přehled měst a jednotek (L)|Postranní seznam: co která města stavějí a co dělají jednotky. Kliknutím na řádek na ně skočíte. Zůstává otevřený, dokud ho nevypnete.')}>${ic('pop', 's')}Přehled</button>
      <button class="tbtn" data-a="mission" data-tip="Cíle mise (M)">${ic('flag', 's')}Mise</button>
      <button class="tbtn" data-a="diplo"${tip('Diplomacie|Přehled soupeřů, vyhlášení války a nabídka míru.')}>${ic(this.me.war.length ? 'war' : 'peace', 's')}Diplomacie</button>
      <button class="tbtn" data-a="help" data-tip="Nápověda (H)">${ic('help', 's')}</button>
      <button class="tbtn" data-a="zoom" data-v="-1" data-tip="Oddálit (−)">−</button>
      <button class="tbtn" data-a="zoom" data-v="1" data-tip="Přiblížit (+)">+</button>
      <button class="tbtn" data-a="music" data-tip="Hudba">${isMusicOn() ? '♪' : '<s>♪</s>'}</button>
      <button class="tbtn" data-a="mute" data-tip="Zvuk">${ic(isMuted() ? 'mute' : 'sound', 's')}</button>
      <button class="tbtn" data-a="menu"${tip('Hlavní menu|Hra se ukládá sama, můžete v ní později pokračovat.')}>Menu</button>`
  }

  markNotesRead(): void { for (const n of this.s.notes) this.read.add(n) }

  private renderNotes(): void {
    const all = this.s.notes
    const fresh = all.map((n, i) => ({ n, i })).filter(o => !this.read.has(o.n)).slice(-7)
    this.notes.innerHTML = fresh.map(o => `<div class="note ${o.n.kind}" data-a="note" data-v="${o.i}"${o.n.x !== undefined ? tip('Kliknutím ukážete místo na mapě.') : ''}>${esc(o.n.text)}</div>`).join('')
  }

  toast(text: string): void {
    this.tileInfo.classList.remove('hidden')
    this.tileInfo.innerHTML = `<span class="pv">${esc(text)}</span>`
    window.clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => { this.toastTimer = 0; this.hover(this.hoverXY[0], this.hoverXY[1]) }, 2200)
  }

  private unitIcon(type: UnitId, owner: number): string { return `${UI}u_${type}_${this.s.players[owner].nation}.png` }

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
      if (u.work) acts.push(`<span>${u.work === 'road' ? ROAD.name : IMPROVEMENTS[u.work].name}: ještě ${u.workLeft}${NB}${turnsWord(u.workLeft)}${u.roadTo ? ', pak cesta dál' : ''}</span>`)
      else if (!emb) {
        // Co lze postavit na poli, kde dělníci stojí – i s důvodem, proč něco nejde.
        for (const j of tileJobs(s, idx(s, u.x, u.y), 0)) {
          const verb = j.job === 'road' ? ROAD.verb : IMPROVEMENTS[j.job].verb
          const tt = `${j.name}|${j.effect ? `${j.effect[0].toUpperCase()}${j.effect.slice(1)}.\n` : ''}Stavba trvá ${j.turns} ${turnsWord(j.turns)}.${j.ok ? '' : `\nNelze: ${j.why}.`}`
          if (j.ok || j.why !== 'už stojí') acts.push(btn(`imp:${j.job}`, verb, '', j.job === 'road' ? 'road' : 'work', !j.ok || u.moves <= 0, tt))
        }
        if (hasTech(this.me, ROAD.tech)) acts.push(`<button class="btn ${this.app.roadMode ? 'on' : ''}" data-a="unit" data-v="roadto"${tip('Cesta až do…|Kliknete na cílové pole a dělníci postaví cestu pole po poli až tam. Sami se přesouvají, dokud není hotovo.')}>${ic('road', 's')}Cesta do…<kbd>R</kbd></button>`)
      }
    }
    // Povýšení a přezbrojení.
    const pend = pendingPromos(u)
    const promoRow = pend > 0 ? `<div class="promo"><b>${ic('xp', 's')}Povýšení${pend > 1 ? ` (${pend}×)` : ''} – vyberte:</b>${PROMO_IDS.filter(id => !u.promos.includes(id)).map(id => `<button class="btn small" data-a="unit" data-v="promo:${id}"${tip(`${PROMOS[id].name}|${PROMOS[id].desc}\nPovýšení navíc vyléčí 25 životů.`)}>${PROMOS[id].name}</button>`).join('')}</div>` : ''
    const upT = civ ? null : upgradeTarget(s, u)
    if (upT) {
      const why = upgradeBlock(s, u)
      acts.push(`<button class="btn" data-a="unit" data-v="upgrade" ${why ? 'disabled' : ''}${tip(`Přezbrojit: ${UNITS[upT].name}|${UNITS[upT].desc}\nSíla ${UNITS[upT].str}${UNITS[upT].ranged ? `, střelba ${UNITS[upT].ranged}` : ''}, pohyb ${UNITS[upT].move}. Zkušenosti a povýšení zůstanou.\nCena ${upgradeCost(s, u)} zlata, spotřebuje tah.${why ? `\nNelze: ${why}` : ''}`)}>${ic('up', 's')}${UNITS[upT].name} ${ic('gold', 's')}${upgradeCost(s, u)}<kbd>U</kbd></button>`)
      const same = unitsOf(s, 0).filter(o => o.type === u.type && !upgradeBlock(s, o))
      if (same.length > 1) acts.push(`<button class="btn small" data-a="unit" data-v="upgradeall"${tip(`Přezbrojit všechny|Přezbrojí všech ${same.length} jednotek tohoto druhu, které stojí na vašem území a mají pohyb – dokud stačí zlato (${upgradeCost(s, u)} za kus).`)}>${ic('up', 's')}Všechny (${same.length})</button>`)
    }
    const resting = u.fortified || u.sleep || u.work || u.goto || u.auto || u.roadTo
    if (resting) acts.push(btn('wake', u.auto ? 'Zrušit automatiku' : u.roadTo ? 'Zrušit stavbu cesty' : u.work ? 'Přerušit práci' : u.goto ? 'Zrušit cestu' : 'Probudit', '', '', false, 'Jednotka zruší dosavadní rozkaz a počká na nový.'))
    else {
      if (u.type === 'worker') acts.push(btn('auto', 'Automaticky', 'E', 'work', false, 'Automatika|Dělníci budou sami chodit po vašem území a stavět vylepšení, která se zrovna hodí. Před nepřítelem utečou do města.'))
      else if (u.type === 'scout' || isNaval(u)) acts.push(btn('auto', 'Zkoumat', 'E', 'move', false, 'Automatický průzkum|Jednotka bude sama odkrývat neznámá pole, dokud je co zkoumat.'))
      if (!civ && !emb) acts.push(btn('fortify', 'Opevnit', 'F', 'shield', false, '+25 % k obraně, jednotka čeká'))
      acts.push(btn('sleep', 'Spát', 'Z', 'skip'))
      acts.push(btn('skip', 'Přeskočit', 'X'))
    }
    acts.push(`<button class="btn small danger" data-a="unit" data-v="disband" data-tip="Rozpustit jednotku">✕</button>`)
    const eta = this.app.gotoEta
    const status = [u.auto ? 'automatika' : u.roadTo ? 'staví cestu' : u.todo === 'found' ? 'jde založit město' : u.todo ? 'jde za prací' : u.work ? 'pracuje' : u.fortified ? 'opevněna' : u.sleep ? 'spí' : u.goto ? `na cestě${eta > 0 ? `, dorazí za ${eta} ${turnsWord(eta)}` : ''}${u.way.length ? `, pak ještě ${u.way.length} ${u.way.length === 1 ? 'bod' : u.way.length < 5 ? 'body' : 'bodů'}` : ''}` : u.moves <= 0 ? 'bez pohybu' : '', emb ? 'naloděna' : ''].filter(Boolean).join(', ')
    const str = d.str ? `<span data-tip="Síla zblízka (aktuální)">${ic('str', 's')}${d.str}${u.vet ? '★' : ''}</span>` : ''
    const rng = d.ranged ? `<span data-tip="Střelecká síla, dostřel ${d.range}">${ic('rng', 's')}${d.ranged}</span>` : ''
    this.unitPanel.classList.remove('hidden')
    this.unitPanel.innerHTML = `
      <div class="head"><img class="portrait" src="${emb ? `${UI}u_boat_${this.me.nation}.png` : this.unitIcon(u.type, u.owner)}" alt="">
        <div style="flex:1"><h3>${d.name}${status ? ` <small style="color:var(--muted);font-size:15px">– ${status}</small>` : ''}</h3>
          <div class="stats"><span data-tip="Zdraví">${ic('hp', 's')}${u.hp}</span>${str}${rng}<span data-tip="Pohyb">${ic('move', 's')}${mv(u.moves)}${NB}/${NB}${maxMoves(s, u)}</span>${civ ? '' : `<span${tip(`Zkušenosti: ${u.xp}|Jednotka je získává bojem. Povýšení při ${XP_LEVELS.join(', ')} bodech.${u.promos.length ? `\nMá: ${u.promos.map(x => `${PROMOS[x].name} (${PROMOS[x].desc})`).join(' ')}` : ''}`)}>${ic('xp', 's')}${u.xp}${'★'.repeat(u.promos.length)}</span>`}</div>
          <div class="bar hp ${u.hp < 40 ? 'low' : ''}" style="margin-top:4px"><i style="width:${u.hp}%"></i></div>
        </div></div>
      <div class="desc">${esc(d.desc)}${u.vet ? ' Veterán (+15 % síla).' : ''}${emb ? esc(` Na člunech: nemůže útočit a brání se slabě (síla ${this.me.nation === 'thal' ? 8 : 4}). Vylodění ukončí tah.`) : ''}</div>
      <div class="desc hint">${esc(this.app.roadMode ? 'Klikněte na pole, kam má cesta vést.' : u.type === 'settler' ? 'Zlatě označená pole jsou dobrá místa pro město (největší značka je nejlepší). Klikněte na některé a osadníci tam dojdou a usadí se.' : u.type === 'worker' && !u.work ? 'Zeleně označená pole lze vylepšit: klikněte na ně a dělníci tam dojdou a pustí se do práce.' : u.goto ? 'Shift + klik přidá další průjezdní bod.' : 'Klik na kterékoli pole pošle jednotku na cestu, i na více tahů.')}</div>
      ${promoRow}
      <div class="actions">${acts.join('')}</div>`
  }

  private itemIcon(it: BuildItem, owner: number): string { return it.kind === 'unit' ? this.unitIcon(it.id, owner) : `${UI}b_${it.id}.png` }

  private renderCity(): void {
    const c = this.app.city
    if (!c || c.owner !== 0) { this.cityPanel.classList.add('hidden'); this.notes.classList.remove('hidden'); return }
    const s = this.s
    const y = cityYields(s, c)
    const need = growthNeed(s, c)
    const growT = y.foodNet > 0 ? Math.ceil((need - c.food) / y.foodNet) : 0
    const turns = (it: BuildItem) => Math.max(1, Math.ceil((itemCost(it) - c.prod) / Math.max(1, y.prod)))
    const scroll = this.cityPanel.querySelector('.inner')?.scrollTop ?? 0
    const cs = cultureSources(c, this.me, s.turn)
    const nextB = c.radius < 2 ? BORDER_AT[0] : c.radius < 3 ? BORDER_AT[1] : 0
    const prevB = c.radius < 2 ? 0 : BORDER_AT[0]
    const cultT = nextB ? Math.max(1, Math.ceil((nextB - c.culture) / Math.max(1, y.culture))) : 0
    let acc = c.build ? turns(c.build) : 0
    const queue = c.queue.map((it, i) => {
      acc += Math.max(1, Math.ceil(itemCost(it) / Math.max(1, y.prod)))
      return `<div class="qitem"><b>${i + 2}.</b><img src="${this.itemIcon(it, 0)}" alt=""><span class="n">${itemName(it)}</span><span class="c">za ${acc} t.</span>
        <button class="btn small" data-a="q-up" data-v="${i}"${tip('Stavět hned|Položka přeskočí na začátek, dosavadní výroba se zařadí za ni.')}>▲</button>
        <button class="btn small" data-a="q-del" data-v="${i}"${tip('Odebrat z fronty')}>✕</button></div>`
    }).join('')
    let cur = `<div class="current"><div class="n">Město nic nestaví – výroba se mění na zlato.<br><b style="color:var(--gold)">Vyberte, co stavět.</b></div></div>`
    if (c.build) {
      const cost = itemCost(c.build), t = turns(c.build), bc = buyCost(s, c)
      const wonder = c.build.kind === 'building' && c.build.id === 'wonder'
      cur = `<div class="current"><img src="${this.itemIcon(c.build, 0)}" alt=""><div class="n"><b>${itemName(c.build)}</b>
        <div class="sub"><div class="bar prod"><i style="width:${Math.min(100, 100 * c.prod / cost)}%"></i></div>${c.prod}${NB}/${NB}${cost} · ${t}${NB}${turnsWord(t)}</div></div>
        ${wonder ? '' : `<button class="btn small" data-a="buy" ${canBuy(s, c) ? '' : 'disabled'}${tip(`Koupit za ${bc} zlata|Dokončí rozestavěnou položku ihned. Máte ${this.me.gold} zlata.`)}>${ic('gold', 's')}${bc}</button>`}
        <button class="btn small" data-a="q-del" data-v="-1"${tip('Zrušit|Přestane stavět tuto položku; na řadu přijde další z fronty. Nastřádaná výroba zůstane.')}>✕</button></div>`
    }
    const row = (it: BuildItem) => {
      const def = it.kind === 'unit' ? UNITS[it.id] : BUILDINGS[it.id]
      const isCur = sameItem(c.build, it)
      const inQ = c.queue.filter(q => sameItem(q, it)).length
      const tt = (it.kind === 'unit' ? this.unitTip(it.id) : this.buildingTip(it.id)) + '\nKlik: zařadit do fronty · Shift + klik: stavět hned'
      const extra = it.kind === 'unit' ? [UNITS[it.id].str ? `síla ${UNITS[it.id].str}` : '', UNITS[it.id].ranged ? `střelba ${UNITS[it.id].ranged}` : '', `pohyb ${UNITS[it.id].move}`].filter(Boolean).join(', ') + '. ' : ''
      return `<button class="build ${isCur ? 'cur' : ''}" data-a="build" data-v="${it.kind}:${it.id}"${tip(tt)}><img src="${this.itemIcon(it, 0)}" alt="">
        <span class="n">${def.name}${inQ ? ` <em class="inq">ve frontě${inQ > 1 ? ` ${inQ}×` : ''}</em>` : ''}<small>${esc(extra + def.desc)}</small></span><span class="c">${ic('prod', 's')}${itemCost(it)}<br>${turns(it)}${NB}${turnsWord(turns(it))}</span></button>`
    }
    const opts = availableBuilds(s, c)
    const blocked = UNIT_IDS.filter(id => {
      const d = UNITS[id]
      if (d.nation && d.nation !== this.me.nation) return false
      if (UNIT_IDS.some(o => UNITS[o].replaces === id && UNITS[o].nation === this.me.nation)) return false
      return (!d.tech || hasTech(this.me, d.tech)) && !opts.some(o => o.kind === 'unit' && o.id === id)
    }).map(id => `<div class="build off"${tip(this.unitTip(id))}><img src="${this.unitIcon(id, 0)}" alt=""><span class="n">${UNITS[id].name}<small>${esc(unitBlockReason(s, c, id) ?? '')}</small></span></div>`).join('')
    const built = c.buildings.length ? c.buildings.map(b => `<span${tip(this.buildingTip(b))}><img src="${UI}b_${b}.png" alt="">${BUILDINGS[b].name}</span>`).join('') : '<span style="border:none;color:var(--muted)">zatím žádné</span>'
    const maxHp = cityMaxHp(c)
    this.cityPanel.classList.remove('hidden')
    this.notes.classList.add('hidden')
    this.cityPanel.innerHTML = `
      <h2>${c.capital ? ic('star') : ''}${esc(c.name)}<button class="x" data-a="city-close" data-tip="Zavřít (Esc)">✕</button></h2>
      <div class="inner">
      <div class="yields">
        <span${tip(`Obyvatelé: ${c.pop}|Každý obyvatel obdělává jedno pole, sní 2 jídla a dává 1 vědu. K dalšímu růstu chybí ${Math.max(0, need - c.food)} jídla.`)}>${ic('pop')}${c.pop}</span>
        <span${tip(`Jídlo: ${signed(y.foodNet)} za tah|Město vyprodukuje ${y.food}, obyvatelé snědí ${c.pop * 2}. Přebytek se střádá na růst (${c.food} / ${need}).`)}>${ic('food')}${signed(y.foodNet)}</span>
        <span${tip(`Výroba: ${y.prod} za tah|Z obdělávaných polí, dolů, pil a dílny. Jde na stavbu budov a jednotek; bez zadání se půlka mění na zlato.`)}>${ic('prod')}${y.prod}</span>
        <span${tip(`Zlato: ${y.gold} za tah|Hrubý výnos města před odečtením údržby budov a žoldu.`)}>${ic('gold')}${y.gold}</span>
        <span${tip(`Věda: ${y.sci} za tah|1 za obyvatele, navíc hlavní město, knihovna a akademie.`)}>${ic('sci')}${y.sci}</span>
        <span${tip(`Kultura: +${y.culture} za tah|${cs.map(([n, v]) => `${n}: +${v}`).join('\n')}\nNastřádáno ${c.culture}. Kultura rozšiřuje hranice města: 2. okruh při ${BORDER_AT[0]}, 3. okruh při ${BORDER_AT[1]}.`)}>${ic('culture')}+${y.culture}</span>
        <span${tip(`Obrana města: ${Math.round(cityStrength(s, c))}|Roste s počtem obyvatel a technologií, hradby dávají +50 %, posádka přidá část své síly. Město samo střílí na nepřátele do 2 polí.`)}>${ic('shield')}${Math.round(cityStrength(s, c))}</span>
      </div>
      <div class="sub">${ic('food', 's')}<div class="bar food"><i style="width:${Math.min(100, 100 * c.food / need)}%"></i></div>${y.foodNet > 0 ? `růst za ${growT}${NB}${turnsWord(growT)}` : y.foodNet < 0 ? '<span style="color:var(--bad)">hladoví!</span>' : 'neroste'}</div>
      ${c.hp < maxHp ? `<div class="sub">${ic('hp', 's')}<div class="bar hp low"><i style="width:${100 * c.hp / maxHp}%"></i></div>hradby ${c.hp}${NB}/${NB}${maxHp}</div>` : ''}
      <div class="sub"${tip(`Kultura a hranice|Město střádá +${y.culture} kultury za tah (${cs.map(([n, v]) => `${n.toLowerCase()} ${v}`).join(', ')}). Monument přidá +2, chrám +3.`)}>${ic('culture', 's')}<div class="bar cult"><i style="width:${nextB ? Math.min(100, 100 * (c.culture - prevB) / (nextB - prevB)) : 100}%"></i></div>${nextB ? `hranice za ${cultT} ${turnsWord(cultT)} (${c.culture} / ${nextB})` : 'hranice jsou největší možné'}</div>
      <div class="sub">${ic('pop', 's')}Pole ve zlatém rámu s hlavou obyvatele město obdělává; ztmavená pole patří městu, ale nikdo na nich nepracuje. Obyvatele rozmisťuje město samo.</div>
      <h4>Výroba a fronta</h4>
      ${cur}${queue}
      <div class="sub hint">Klik na položku ji zařadí do fronty, Shift + klik ji začne stavět hned.</div>
      <div style="display:flex;justify-content:flex-end;margin:5px 0"><button class="btn small" data-a="advise" data-tip="Rádce vybere rozumnou stavbu">Poradit</button></div>
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

  private renderEnd(): void {
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
    this.waiting.classList.toggle('hidden', !on)
    this.endBtn.disabled = on
  }

  // ------------------------------------------------------------ tutoriál

  private nextTip(): Tip | null {
    const s = this.s, me = this.me
    if (s.tutorial.includes('off')) return null
    const done = (id: string) => s.tutorial.includes(id)
    const cities = citiesOf(s, 0)
    const units = unitsOf(s, 0)
    const tips: [string, boolean, string, string][] = [
      ['welcome', cities.length === 0 && units.some(u => u.type === 'settler'), 'Založte město',
        'Vítejte, vládče! Klikněte na osadníky a zvolte Založit město (klávesa B). Místo, kde stojí, je úrodné. Zlaté značky na mapě ukazují další dobrá místa – kliknutím tam osadníky pošlete a sami se usadí.'],
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
        'Dělníci vylepšují pole ve vašem území: farmy dávají jídlo, doly výrobu. Nechcete-li je vodit ručně, dejte jim rozkaz Automaticky (klávesa E). Koně potřebují ohradu a železo důl – teprve pak můžete stavět jízdu a šermíře.'],
      ['road', hasTech(me, 'wheel') && units.some(u => u.type === 'worker') && cities.length >= 2, 'Cesty',
        'Dělníci už umějí stavět cesty. Vyberte je, zvolte Cesta do… (klávesa R) a klikněte třeba na sousední město – postaví cestu pole po poli sami. Po cestě stojí každý krok jen půl bodu pohybu a cesta překlene řeku.'],
      ['tradition', traditionReady(me), 'Tradice',
        'Vaše města nastřádala dost kultury na první tradici. Tradice je trvalá výhoda pro celý národ – víc výroby, jídla, vědy, silnější vojsko a další. Klikněte na ukazatel kultury nahoře (klávesa C) a jednu si vyberte. Každá další stojí víc kultury.'],
      ['promo', units.some(u => pendingPromos(u) > 0), 'Povýšení',
        'Jedna z vašich jednotek nasbírala v boji zkušenosti. Vyberte ji a v jejím panelu zvolte povýšení – třeba silnější útok, obranu nebo pohyb navíc. Povýšení také vyléčí 25 životů.'],
      ['pirates', s.units.some(u => u.owner === BARB && UNITS[u.type].naval && me.visible[idx(s, u.x, u.y)]), 'Piráti',
        'U pobřeží se objevili piráti. Jejich galéra napadá lodě a čluny a blokuje vodní pole města, nájezdníci se vylodí a potáhnou na město. Lučištníci na ně dostřelí ze břehu, galéra je potopí na vodě.'],
      ['barb', s.units.some(u => u.owner === BARB && me.visible[idx(s, u.x, u.y)]), 'Barbaři',
        'Na obzoru jsou barbaři! Zaútočíte kliknutím na nepřítele v červeném rámečku. Jednotka, která se tah nehýbe, se léčí. Barbarský tábor vypálíte tím, že na něj vstoupíte – přinese zlato.'],
      ['expand', cities.length === 1 && cities[0].pop >= 3 && s.turn > 10, 'Rozšiřujte říši',
        'Vaše město roste. Postavte osadníky a založte další města – víc měst znamená víc výroby, vědy i skóre. Hranice města rozšiřuje kultura (monument, chrám).'],
      ['war', me.war.length > 0, 'Válka',
        'Jste ve válce. Města se brání sama a střílejí na 2 pole. K dobytí je třeba srazit hradby na nulu (nejlépe katapulty) a pak do města vstoupit pěchotou. Mír lze nabídnout v okně Diplomacie.'],
      ['thal', me.nation === 'thal' && s.turn <= 3, 'Vládci vln',
        'Thalassové jsou doma na moři: lodě mají rychlejší a zkušenější, pobřežní vody jim nesou zlato a plout umějí od začátku. Vyplatí se zakládat města přímo na pobřeží – klidně s osadníky dojděte k moři, než první město založíte.'],
      ['sail', hasTech(me, 'sailing') && s.turn > 3, 'Plavba',
        'Umíte plout! Pozemní jednotky teď smějí vstoupit na pobřežní vody – nalodí se na čluny (nalodění i vylodění ukončí tah) a obeplují hory i nepřítele. Na vodě se ale skoro neubrání, proto je doprovázejte galérou z pobřežního města.'],
      ['wonder', hasTech(me, 'astronomy'), 'Sluneční chrám',
        'Znáte astronomii – můžete stavět Sluneční chrám. Kdo jej dostaví první, vyhrává misi. Stavte jej ve městě s nejvyšší výrobou a braňte ho.'],
    ]
    for (const [id, cond, title, text] of tips) if (cond && !done(id)) return { id, title, text }
    return null
  }

  toggleOverview(): void {
    this.overviewOn = !this.overviewOn
    try { localStorage.setItem('hex4x-overview', this.overviewOn ? '1' : '0') } catch { /* bez úložiště */ }
    this.render()
  }

  /** Krátký popis toho, co jednotka právě dělá; druhá hodnota = čeká na rozkaz. */
  private unitDoing(u: Unit): [string, boolean] {
    const s = this.s
    if (u.auto) return [u.type === 'worker' ? 'automaticky vylepšuje pole' : 'automaticky zkoumá', false]
    if (u.work) return [`${u.work === 'road' ? 'staví cestu' : `staví: ${IMPROVEMENTS[u.work].name.toLowerCase()}`}, ještě ${u.workLeft} ${turnsWord(u.workLeft)}${u.roadTo ? ', pak dál' : ''}`, false]
    if (u.roadTo) return ['staví cestu na dálku', false]
    if (u.todo === 'found') return ['jde založit město', false]
    if (u.todo) return [`jde stavět: ${u.todo === 'road' ? 'cestu' : IMPROVEMENTS[u.todo].name.toLowerCase()}`, false]
    if (u.goto) { const c = cityAt(s, u.goto[0], u.goto[1]); return [`na cestě${c ? ` do města ${c.name}` : ''}${u.way.length ? ` (+${u.way.length} body)` : ''}`, false] }
    if (u.fortified) { const c = cityAt(s, u.x, u.y); return [c ? `posádka: ${c.name}` : 'opevněna', false] }
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
    const cities = citiesOf(s, 0).map(c => {
      const y = cityYields(s, c)
      const need = growthNeed(s, c)
      const grow = y.foodNet > 0 ? `růst za ${Math.ceil((need - c.food) / y.foodNet)} t.` : y.foodNet < 0 ? '<span style="color:var(--bad)">hladoví</span>' : 'neroste'
      let what = '<b style="color:var(--gold)">nic nestaví!</b>'
      if (c.build) {
        const t = Math.max(1, Math.ceil((itemCost(c.build) - c.prod) / Math.max(1, y.prod)))
        what = `${esc(itemName(c.build))} <small>${t} ${turnsWord(t)}</small>${c.queue.length ? ` <small>· pak ${c.queue.map(q => esc(itemName(q))).join(', ')}</small>` : ''}`
      }
      return `<div class="ov" data-a="ov-city" data-v="${c.id}">${c.build ? `<img src="${this.itemIcon(c.build, 0)}" alt="">` : `<img src="${UI}ic_prod.png" alt="" style="opacity:.4">`}<div><b>${c.capital ? '★ ' : ''}${esc(c.name)}</b> <small>${ic('pop', 's')}${c.pop} · ${grow}${c.hp < cityMaxHp(c) ? ` · <span style="color:var(--bad)">hradby ${c.hp}</span>` : ''}</small><br>${what}</div></div>`
    }).join('')
    const mine = unitsOf(s, 0)
    const row = (u: Unit) => {
      const [doing, idle] = this.unitDoing(u)
      const emb = isEmbarked(s, u)
      return `<div class="ov ${u.id === this.app.selUnit ? 'sel' : ''}" data-a="ov-unit" data-v="${u.id}"><img src="${emb ? `${UI}u_boat_${this.me.nation}.png` : this.unitIcon(u.type, 0)}" alt=""><div><b>${UNITS[u.type].name}</b>${pendingPromos(u) > 0 ? ` <span style="color:var(--gold)"${tip('Čeká na povýšení')}>★</span>` : ''} <small>${u.hp < 100 ? `<span style="color:${u.hp < 40 ? 'var(--bad)' : 'var(--war)'}">${ic('hp', 's')}${u.hp}</span> · ` : ''}${ic('move', 's')}${mv(u.moves)}${emb ? ' · na moři' : ''}</small><br><span class="${idle ? 'idle' : 'doing'}">${esc(doing)}</span></div></div>`
    }
    const civ = mine.filter(u => isCivilian(u)), mil = mine.filter(u => !isCivilian(u))
    const waiting = mine.filter(u => this.unitDoing(u)[1]).length
    this.overview.innerHTML = `<h2>Přehled<button class="x" data-a="overview"${tip('Zavřít přehled (L)')}>✕</button></h2><div class="inner">
      <h4>Města (${citiesOf(s, 0).length})</h4>${cities || '<div class="sub">Zatím žádné město.</div>'}
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
      if (c.owner === 0) {
        if (c.build) { const y = cityYields(s, c); const t = Math.max(1, Math.ceil((itemCost(c.build) - c.prod) / Math.max(1, y.prod))); extra = `<em>${esc(itemName(c.build))} ${t}${c.queue.length ? ` +${c.queue.length}` : ''}</em>` }
        else extra = `<em style="color:var(--gold)">nečinné!</em>`
      }
      const maxHp = cityMaxHp(c)
      const html = `<b>${vis || c.owner === 0 ? c.pop : '?'}</b><span>${c.capital ? '★ ' : ''}${esc(c.name)}</span>${extra}${vis && c.hp < maxHp ? `<div class="hpb"><i style="width:${100 * c.hp / maxHp}%"></i></div>` : ''}`
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
    if (t.imp) parts.push(IMPROVEMENTS[t.imp].name)
    if (t.road) parts.push('cesta')
    if (t.river && TERRAIN[t.t].land) parts.push('řeka')
    const yl = tileYield(s, i, 0)
    const ys = [yl.food ? `${ic('food', 's')}${yl.food}` : '', yl.prod ? `${ic('prod', 's')}${yl.prod}` : '', yl.gold ? `${ic('gold', 's')}${yl.gold}` : ''].filter(Boolean).join(' ')
    let html = parts.join(' · ') + (ys ? ` &nbsp; ${ys}` : '')
    const mc = t.t === 'mountain' ? 'neprůchodné' : isWater(t) ? (hasTech(this.me, t.t === 'coast' ? 'sailing' : 'navigation') ? 'splavné' : t.t === 'coast' ? 'voda (vyžaduje Plavbu)' : 'voda (vyžaduje Navigaci)') : ''
    if (mc) html += ` · ${mc}`
    if (t.owner >= 0) html += ` · <span style="color:${NATIONS[s.players[t.owner].nation].css}">${NATIONS[s.players[t.owner].nation].name}</span>`
    if (this.me.visible[i]) {
      const c = cityAt(s, x, y)
      if (c) html += `<br>${ic('shield', 's')}Město ${esc(c.name)} – obrana ${Math.round(cityStrength(s, c))}, hradby ${c.hp}${NB}/${NB}${cityMaxHp(c)}`
      for (const u of unitsAt(s, x, y)) {
        const d = UNITS[u.type]
        const own = u.owner === 0 ? '' : ` <span style="color:${NATIONS[s.players[u.owner].nation].css}">(${NATIONS[s.players[u.owner].nation].name})</span>`
        html += `<br>${d.name}${own} ${ic('hp', 's')}${u.hp}${d.str ? ` ${ic('str', 's')}${Math.round(unitStrength(s, u, { defending: true }) * 10) / 10}` : ''}${u.fortified ? ' · opevněn' : ''}`
      }
      const sel = this.app.unit
      if (sel) {
        const pv = previewAttack(s, sel, x, y)
        if (pv) html += `<br><span class="pv">${ic('war', 's')}Útok: nepřítel −${pv.dmgDef}${pv.dmgDef >= pv.defHp && !(pv.city && pv.ranged) ? ' (zničen)' : ''}${pv.ranged ? ', bez odvety' : `, vy −${pv.dmgAtt}${pv.dmgAtt >= pv.attHp ? ' (padnete!)' : ''}`}${pv.river ? ' · přes řeku −20 %' : ''}${pv.needWar >= 0 ? ' · znamená válku' : ''}</span>`
      }
    }
    const sel = this.app.unit, eta = this.app.hoverEta
    if (sel && sel.type === 'settler' && sel.owner === 0 && TERRAIN[t.t].passable) {
      // Jak dobré je pole pro město.
      const why = foundBlock(s, 0, x, y)
      if (why) html += `<br><span class="nojob">${ic('flag', 's')}Město zde založit nelze: ${esc(why)}</span>`
      else {
        const sc = siteScore(s, 0, x, y)
        let food = 0, prod = 0, res = 0
        for (let k = 0; k < s.tiles.length; k++) {
          const tx = k % s.W, ty = (k / s.W) | 0
          if (Math.abs(tx - x) > 3 || Math.abs(ty - y) > 2 || !this.me.explored[k]) continue
          const dx = hexCenter(tx, ty), dc = hexCenter(x, y)
          if (Math.hypot(dx[0] - dc[0], dx[1] - dc[1]) > 70) continue
          const yl = tileYield(s, k, 0); food += yl.food; prod += yl.prod
          if (s.tiles[k].res && resourceVisible(this.me, s.tiles[k].res!)) res++
        }
        const word = sc >= 58 ? 'výborné' : sc >= 50 ? 'dobré' : sc >= 42 ? 'průměrné' : 'slabé'
        const extras = [isCoastal(s, x, y) ? 'u moře (lodě, přístav)' : '', t.river ? 'u řeky' : '', t.t === 'hills' ? 'na pahorku (lepší obrana)' : ''].filter(Boolean).join(', ')
        html += `<br><span class="${sc >= 50 ? 'job' : 'nojob'}">${ic('flag', 's')}Město zde: ${word} · ${ic('food', 's')}${food} ${ic('prod', 's')}${prod} · surovin ${res}</span>${extras ? `<br><span class="job">${esc(extras[0].toUpperCase() + extras.slice(1))}</span>` : ''}`
        if (this.app.sites.has(i) && !(sel.x === x && sel.y === y)) html += '<br><span class="job">Klikněte: osadníci sem dojdou a založí město</span>'
      }
    }
    if (sel && sel.type === 'worker' && sel.owner === 0) {
      // Co tu mohou dělníci postavit.
      const jobs = tileJobs(s, i, 0)
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

  private drawMini(): void {
    if (!this.app.inGame) return
    const s = this.s
    const g = this.mini.getContext('2d')!
    const cw = 5, ch = 5
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, this.mini.width, this.mini.height)
    for (let i = 0; i < s.tiles.length; i++) {
      if (!this.me.explored[i]) continue
      const x = i % s.W, y = (i / s.W) | 0
      const t = s.tiles[i]
      const px = 4 + x * cw + (y & 1) * 2.5, py = 3 + y * ch
      g.fillStyle = t.forest ? '#2f7a3a' : Hud.MINI[t.t]
      g.fillRect(px, py, cw, ch)
      if (t.owner >= 0) { g.globalAlpha = 0.55; g.fillStyle = NATIONS[s.players[t.owner].nation].css; g.fillRect(px, py, cw, ch); g.globalAlpha = 1 }
      if (!this.me.visible[i]) { g.fillStyle = '#0b102066'; g.fillRect(px, py, cw, ch) }
    }
    for (const c of s.cities) {
      if (!this.me.explored[idx(s, c.x, c.y)]) continue
      const px = 4 + c.x * cw + (c.y & 1) * 2.5, py = 3 + c.y * ch
      g.fillStyle = '#fff'; g.fillRect(px - 1, py - 1, cw + 2, ch + 2)
      g.fillStyle = NATIONS[s.players[c.owner].nation].css; g.fillRect(px, py, cw, ch)
    }
    for (const u of s.units) {
      if (!this.me.visible[idx(s, u.x, u.y)]) continue
      const px = 4 + u.x * cw + (u.y & 1) * 2.5, py = 3 + u.y * ch
      g.fillStyle = u.owner === BARB ? '#111' : NATIONS[s.players[u.owner].nation].css
      g.fillRect(px + 1, py + 1, 3, 3)
    }
    const v = this.app.scene.viewRect
    g.strokeStyle = '#fff'; g.lineWidth = 1
    g.strokeRect(4 + v.x / 32 * cw + 0.5, 3 + v.y / 24 * ch + 0.5, v.width / 32 * cw, v.height / 24 * ch)
  }

  private miniClick(e: PointerEvent): void {
    if (this.app.busy) return
    const r = this.mini.getBoundingClientRect()
    const mx = (e.clientX - r.left) * this.mini.width / r.width, my = (e.clientY - r.top) * this.mini.height / r.height
    const x = Math.max(0, Math.min(this.s.W - 1, Math.round((mx - 4) / 5 - 0.5)))
    const y = Math.max(0, Math.min(this.s.H - 1, Math.round((my - 3) / 5 - 0.5)))
    this.app.scene.centerOn(x, y, false)
  }

  // ------------------------------------------------------------ okna

  private open(kind: string, title: string, body: string, foot = `<button class="btn" data-a="close">Zavřít</button>`, width = ''): void {
    this.modalKind = kind
    this.modal.classList.remove('hidden')
    this.modal.innerHTML = `<div class="modalbox panel" ${width ? `style="width:${width}"` : ''}><h2>${title}${kind === 'over' || kind === 'confirm' || kind === 'offer' ? '' : '<button class="x" data-a="close">✕</button>'}</h2><div class="body">${body}</div><div class="foot">${foot}</div></div>`
    this.tileInfo.classList.add('hidden')
    this.modal.querySelector<HTMLElement>('.foot .btn:last-child')?.focus()
  }

  closeModal(): void {
    if (this.modalKind === 'over') return
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
    const rivals = this.s.players.filter(p => p.id === 1 || p.id === 2)
    this.open('brief', `Mise: ${esc(SCENARIOS[this.s.scenario].name)}`, `
      <div style="display:flex;gap:16px"><img src="${UI}p_${this.me.nation}.png" style="width:144px;height:144px;border:3px solid ${n.css};flex:none" alt="">
      <div><p>${esc(`Stará říše se rozpadla a její trůn osiřel. ${n.leader}, ${n.title.toLowerCase()}, ${SCENARIOS[this.s.scenario].intro}`)}</p>
      <p>${esc(`Vaši soupeři: ${rivals.map(r => `${NATIONS[r.nation].name} (${describeAI(r)})`).join(' a ')}. V divočině mezi vámi táboří barbaři.`)}</p></div></div>
      ${this.goalsHtml()}
      <p>${esc(`Každý národ si z domoviny přináší jednu znalost. Váš lid už ovládá: ${this.me.techs.map(t => TECHS[t].name).join(', ')} – proto je ve stromu technologií od začátku hotová.`)}</p>
      <p style="color:var(--muted)">${esc(`Na vše máte ${this.s.maxTurns} tahů. Cíle mise si kdykoli zobrazíte tlačítkem Mise (klávesa M). Rádce vás provede prvními tahy.`)}</p>`,
    `<button class="btn big" data-a="close">Rovnou hrát</button><button class="btn big" data-a="guide" data-v="0">Jak se to hraje</button>`, '860px')
  }

  private goalsHtml(): string {
    const s = this.s, m = s.mission
    const goal = (done: boolean, text: string, icon = 'star') => `<div class="goal ${done ? 'done' : ''}">${ic(done ? 'check' : icon)}<div>${esc(text)}</div></div>`
    const seats = s.players.filter(p => p.id === 1 || p.id === 2).map(p => {
      const c = s.cities.find(ct => ct.seat === p.id)
      const held = !p.alive || (!!c && c.owner === 0)
      const known = this.me.met.includes(p.id)
      return `${known ? NATIONS[p.nation].name : 'neznámý národ'}${c && this.me.explored[idx(s, c.x, c.y)] ? ` (${c.name})` : ''}${held ? ' ✓' : ''}`
    }).join(', ')
    return `
      <h4>Cesty k vítězství (stačí jedna)</h4>
      ${goal(false, `Dobytí: obsaďte původní sídelní města obou soupeřů – ${seats}.`, 'war')}
      ${goal(false, `Div: objevte astronomii a dostavte Sluneční chrám dřív než ostatní.${hasTech(this.me, 'astronomy') ? ' Astronomii už znáte.' : ''}`, 'sci')}
      ${goal(false, `Sláva: mějte po ${s.maxTurns} tazích nejvyšší skóre.`, 'turn')}
      <h4>Vedlejší úkoly</h4>
      ${goal(m.questRuins, m.ruinsBy > 0 ? `Prozkoumejte ruiny Starého trůnu ${SCENARIOS[s.scenario].ruinsWhere} – bohužel vás někdo předběhl.` : `Prozkoumejte ruiny Starého trůnu ${SCENARIOS[s.scenario].ruinsWhere} (odměna: zlato a technologie).`, 'flag')}
      ${goal(m.questCities, `Vládněte třem městům (odměna 60 zlata). Nyní: ${citiesOf(s, 0).length}.`, 'pop')}
      ${goal(m.questCamps, `Vypalte dva barbarské tábory (odměna 60 zlata). Nyní: ${m.campsDestroyed}.`, 'str')}`
  }

  showMission(): void {
    const s = this.s
    const rows = s.players.filter(p => p.id !== BARB).map(p => {
      const known = p.id === 0 || this.me.met.includes(p.id)
      const n = NATIONS[p.nation]
      return `<tr><td style="color:${known ? n.css : 'var(--muted)'}">${known ? n.name : 'Neznámý národ'}${p.alive ? '' : ' †'}</td><td>${known ? score(s, p.id) : '?'}</td><td>${known ? citiesOf(s, p.id).length : '?'}</td><td>${known ? p.techs.length : '?'}</td></tr>`
    }).join('')
    this.open('mission', `Mise: ${esc(SCENARIOS[s.scenario].name)}`, `${this.goalsHtml()}
      <h4>Milníky věků</h4>
      ${ERAS.slice(1).map((e, k) => {
        const i = k + 1, first = s.eraFirst[i]
        const who = first === undefined ? '' : first === 0 ? ' První jste byli vy – zlatý věk.' : this.me.met.includes(first) ? ` První byli ${NATIONS[s.players[first].nation].name}.` : ' První byl neznámý národ.'
        return `<div class="goal ${this.me.era >= i ? 'done' : ''}">${ic(this.me.era >= i ? 'check' : 'sci')}<div>${esc(`${e.name}: objevte ${e.techs} technologií (máte ${this.me.techs.length}). Odměna ${30 * i} zlata a ${15 * i} kultury; první národ získá zlatý věk na ${GOLDEN_TURNS} tahů.${who}`)}</div></div>`
      }).join('')}
      <h4>Stav sil</h4><table class="scores"><tr><th>Národ</th><th>Skóre</th><th>Města</th><th>Technologie</th></tr>${rows}</table>
      <p style="color:var(--muted);margin-top:10px">Tah ${Math.min(s.turn, s.maxTurns)} z ${s.maxTurns}. Porážka: ztráta všech měst, nebo když Sluneční chrám dostaví soupeř.</p>`, undefined, '760px')
  }

  showTech(): void {
    const p = this.me
    const inc = playerIncome(this.s, 0)
    const avail = availableTechs(p)
    const W = 196, H = 70, GX = 34, GY = 12
    const pos = (t: TechId) => [(TECHS[t].tier - 1) * (W + GX), TECHS[t].row * (H + GY)]
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
      const cls = p.techs.includes(id) ? 'done' : p.research === id ? 'cur avail' : avail.includes(id) ? 'avail' : 'locked'
      const left = Math.max(1, Math.ceil((t.cost - (p.research === id ? p.progress : 0)) / Math.max(1, inc.sci)))
      cards += `<div class="tech ${cls}" style="left:${x}px;top:${y}px"${tip(this.techTip(id))} ${avail.includes(id) ? `data-a="tech" data-v="${id}"` : ''}>
        <span class="cost">${p.techs.includes(id) ? '✓' : `${t.cost} · ${left}${NB}t.`}</span><b>${t.name}</b><small>${esc(t.unlocks)}</small></div>`
    }
    const w = 5 * W + 4 * GX, hh = 7 * (H + GY)
    this.open('tech', `${ic('sci')}Strom technologií`, `<p style="color:var(--muted)">${esc(`Klikněte na modře orámovanou technologii. Vaše věda: ${inc.sci} za tah.`)}${p.progress && !p.research ? esc(` Nastřádáno ${p.progress} bodů.`) : ''}</p>
      <div class="tree" style="width:${w}px;height:${hh}px"><svg width="${w}" height="${hh}">${lines}</svg>${cards}</div>`)
  }

  /** Tradice: trvalé výhody za nastřádanou kulturu. */
  showTraditions(): void {
    const p = this.me
    const ready = traditionReady(p)
    const cost = traditionCost(p.traditions.length)
    const cult = citiesOf(this.s, 0).reduce((a, c) => a + cityYields(this.s, c).culture, 0)
    const left = Math.max(0, cost - p.culture)
    const cards = TRADITION_IDS.map(id => {
      const has = p.traditions.includes(id)
      return `<div class="trad ${has ? 'done' : ready ? 'avail' : 'locked'}" ${!has && ready ? `data-a="trad" data-v="${id}"` : ''}><b>${has ? '✓ ' : ''}${TRADITIONS[id].name}</b><small>${esc(TRADITIONS[id].desc)}</small></div>`
    }).join('')
    const all = p.traditions.length >= TRADITION_IDS.length
    this.open('trad', `${ic('culture')}Tradice`, `<p>${esc(all ? 'Váš národ přijal všechny tradice.' : ready ? `Máte ${p.culture} kultury – vyberte si novou tradici (stojí ${cost}). Platí pro celý národ a napořád.` : `Další tradice stojí ${cost} kultury, máte ${p.culture}.${cult > 0 ? ` Při ${cult} kultury za tah to bude za ${Math.ceil(left / cult)} tahů.` : ' Vaše města zatím žádnou kulturu nedávají.'} Kulturu zvyšují monumenty a chrámy.`)}</p>
      <div class="trads">${cards}</div>`, undefined, '860px')
  }

  showPopup(title: string, text: string): void {
    this.open('popup', `${ic('star')}${esc(title)}`, `<p style="font-size:21px;line-height:1.3">${esc(text)}</p>`, `<button class="btn big" data-a="close">Výborně</button>`, '620px')
  }

  showDiplo(msg = ''): void {
    const s = this.s
    const mine = militaryPower(s, 0)
    const cards = s.players.filter(p => p.id === 1 || p.id === 2).map(p => {
      const n = NATIONS[p.nation]
      if (!this.me.met.includes(p.id)) return `<div class="rival" style="--c:#667"><h3>Neznámý národ</h3><p>Tento národ jste zatím nepotkali. Pošlete zvědy za hory.</p></div>`
      if (!p.alive) return `<div class="rival" style="--c:${n.css}"><h3>${n.name} †</h3><p>Tento národ byl vyhlazen.</p></div>`
      const war = atWar(s, 0, p.id)
      const theirs = militaryPower(s, p.id)
      const cmp = theirs > mine * 1.4 ? 'výrazně silnější než vy' : theirs > mine * 1.1 ? 'o něco silnější' : theirs > mine * 0.75 ? 'vyrovnané' : 'slabší než vy'
      const others = p.war.filter(w => w !== 0 && w !== BARB).map(w => NATIONS[s.players[w].nation].name)
      return `<div class="rival" style="--c:${n.css}"><div class="top"><img class="p" src="${UI}p_${p.nation}.png" alt=""><div><h3>${n.name}</h3><div>${esc(n.leader)}</div>
        <div class="st ${war ? 'war' : 'peace'}">${ic(war ? 'war' : 'peace', 's')}${war ? 'Válka' : 'Mír'}</div></div></div>
        <p>${esc(`${p.personality === 'aggressive' ? 'Výbojný národ.' : 'Národ stavitelů.'} Vojsko: ${cmp}. Skóre ${score(s, p.id)}, měst ${citiesOf(s, p.id).length}.`)}${others.length ? esc(` Válčí s: ${others.join(', ')}.`) : ''}</p>
        <p${tip('Vztah k vám|Zlepšují ho dary, obchod a společný boj; kazí ho vyhlášení války a odmítnutí pomoci. Přátelský národ vás nenapadne a spíš přijme spojenectví.')}>Vztah k vám: <b style="color:${p.attitude >= 15 ? 'var(--good)' : p.attitude <= -15 ? 'var(--bad)' : 'var(--text)'}">${attitudeWord(p)}</b> (${signed(p.attitude)})${s.turn < p.pactUntil ? ` · spojenec ještě ${p.pactUntil - s.turn}${NB}${turnsWord(p.pactUntil - s.turn)}` : ''}</p>
        ${s.deals.filter(d => (d.seller === p.id && d.buyer === 0) || (d.buyer === p.id && d.seller === 0)).map(d => `<p class="deal">${ic('trade', 's')}${d.seller === 0 ? 'Prodáváte' : 'Kupujete'}: ${RESOURCES[d.res].name.toLowerCase()}, ${d.seller === 0 ? '+' : '−'}${d.gpt} zlata za tah, ještě ${d.until - s.turn}${NB}${turnsWord(d.until - s.turn)}</p>`).join('')}
        ${war ? '' : `<div class="dip">${TRADABLE.map(r => {
          const sb = saleBlock(s, p.id, r), bb = buyBlock(s, p.id, r)
          const nm = RESOURCES[r].name.toLowerCase()
          return `<button class="btn small" data-a="dip" data-v="sell:${p.id}:${r}" ${sb ? 'disabled' : ''}${tip(`Prodat: ${nm}|Dostanete ${salePrice(p)} zlata za tah po ${DEAL_TURNS} tahů, o surovinu sami nepřijdete. Soupeř ale bude moci stavět jednotky, které ji potřebují.${sb ? `\nNelze: ${sb}` : ''}`)}>${ic('trade', 's')}Prodat ${nm} +${salePrice(p)}</button>
            <button class="btn small" data-a="dip" data-v="buy:${p.id}:${r}" ${bb ? 'disabled' : ''}${tip(`Koupit: ${nm}|Zaplatíte ${buyPrice(p)} zlata za tah po ${DEAL_TURNS} tahů a můžete stavět jednotky, které surovinu potřebují.${bb ? `\nNelze: ${bb}` : ''}`)}>${ic('trade', 's')}Koupit ${nm} −${buyPrice(p)}</button>`
        }).join('')}
          <button class="btn small" data-a="dip" data-v="gift:${p.id}" ${this.me.gold < GIFT ? 'disabled' : ''}${tip(`Dar ${GIFT} zlata|Zlepší vztah o 12 bodů.`)}>${ic('gold', 's')}Dar ${GIFT}</button>
          ${s.players.filter(q => (q.id === 1 || q.id === 2) && q.id !== p.id && q.alive && this.me.met.includes(q.id)).map(q => `<button class="btn small" data-a="dip" data-v="ally:${p.id}:${q.id}"${tip(`Spojenectví proti: ${NATIONS[q.nation].name}|Oba vyhlásíte tomuto národu válku a spojenec vás 25 tahů nenapadne. Přijme, když je k vám aspoň vstřícný (vztah 20+) a soupeř pro něj není příliš silný, nebo když s ním už válčí.`)}>${ic('war', 's')}Spojenectví proti: ${NATIONS[q.nation].name}</button>`).join('')}
        </div>`}
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px">${war ? `<button class="btn" data-a="peace" data-v="${p.id}">Nabídnout mír</button>` : `<button class="btn danger" data-a="war" data-v="${p.id}">Vyhlásit válku</button>`}</div></div>`
    }).join('')
    this.open('diplo', 'Diplomacie', `${msg ? `<p style="color:var(--gold)">${esc(msg)}</p>` : ''}<div class="rivals">${cards}</div>`)
  }

  checkOffers(): void {
    const o = this.s.offers[0]
    if (!o || this.modalOpen || this.s.over) return
    const p = this.s.players[o.from]
    const n = NATIONS[p.nation]
    if (o.kind === 'ally') {
      const foe = this.s.players[o.vs!]
      if (!foe.alive || !atWar(this.s, o.from, o.vs!) || atWar(this.s, 0, o.from) || atWar(this.s, 0, o.vs!)) { this.s.offers.shift(); this.checkOffers(); return }
      sfx('quest')
      this.open('offer', `${n.name} žádají o pomoc`, `<div style="display:flex;gap:14px"><img src="${UI}p_${p.nation}.png" style="width:96px;height:96px;border:2px solid ${n.css}" alt=""><div><p>${esc(`„Válčíme s národem ${NATIONS[foe.nation].name},“ vzkazuje ${n.leader}. „Přidejte se k nám a budeme vám přáteli.“`)}</p><p style="color:var(--muted)">${esc(`Přijetí znamená válku s národem ${NATIONS[foe.nation].name}; ${n.name} vás pak 25 tahů nenapadnou a vztah se výrazně zlepší. Odmítnutí vztah mírně zhorší.`)}</p></div></div>`,
        `<button class="btn" data-a="offer-no" data-v="${o.from}">Odmítnout</button><button class="btn" data-a="offer-yes" data-v="${o.from}">Přidat se do války</button>`, '640px')
      return
    }
    if (!atWar(this.s, 0, o.from)) { this.s.offers.shift(); return }
    sfx('quest')
    this.open('offer', `${n.name} nabízejí mír`, `<div style="display:flex;gap:14px"><img src="${UI}p_${p.nation}.png" style="width:96px;height:96px;border:2px solid ${n.css}" alt=""><p>${esc(`„Dost krve bylo prolito,“ vzkazuje ${n.leader}. „Složme zbraně a každý ať si ponechá, co drží.“`)}</p></div>`,
      `<button class="btn" data-a="offer-no" data-v="${o.from}">Odmítnout</button><button class="btn" data-a="offer-yes" data-v="${o.from}">Přijmout mír</button>`, '600px')
  }

  showHelp(): void {
    this.open('help', `${ic('help')}Jak hrát`, `
      <h4>Cíl</h4><p>${esc('Vyhrajte misi jednou ze tří cest: dobytím sídelních měst soupeřů, dostavbou Slunečního chrámu, nebo nejvyšším skóre po 120 tazích.')}</p>
      <h4>Ovládání</h4><ul>
        <li>${esc('Levé tlačítko: výběr jednotky či města. S vybranou jednotkou kliknutí na pole = pohyb (i na více tahů, jednotka pak chodí sama), na červený rámeček = útok.')}</li>
        <li>${esc('Shift + klik: přidá jednotce na cestě další průjezdní bod (fronta rozkazů, nejvýš 6). Pravé tlačítko: pošle jednotku i na pole s vlastní jednotkou či městem.')}</li>
        <li>${esc('Najetím myši na kteroukoli ikonu, tlačítko, stavbu nebo technologii zobrazíte nápovědu.')}</li>
        <li>${esc('Tažení myší nebo WASD / šipky: posun mapy. Kolečko nebo + a −: přiblížení.')}</li>
        <li>${esc('Osadníci: zlaté značky ukazují doporučená místa pro město, kliknutím tam osadníky pošlete a po příchodu město sami založí. Po najetí myší na pole uvidíte, jak je pro město dobré.')}</li>
        <li>${esc('L: přehled měst a jednotek – postranní seznam, co se kde staví a co která jednotka dělá.')}</li>
        <li>${esc('Enter: další rozhodnutí nebo konec tahu (Shift+Enter ukončí tah hned). N: další jednotka. T: technologie. M: mise. Esc: zrušit výběr.')}</li>
        <li>${esc('Jednotky: B založit město, F opevnit, Z spát, X přeskočit tah, E automatika (dělníci vylepšují pole, zvěd a lodě zkoumají mapu).')}</li></ul>
      <h4>Města</h4><p>${esc('Obyvatelé obdělávají pole v okolí města (až 2 pole daleko) a přinášejí jídlo (růst), výrobu (stavby a jednotky) a zlato. Každý obyvatel sní 2 jídla a dává 1 vědu. Kultura (monument, chrám) rozšiřuje hranice: druhý okruh při 18, třetí při 90 bodech. Za zlato lze rozestavěnou položku dokončit ihned.')}</p>
      <p>${esc('Fronta výroby: kliknutí na položku ji zařadí na konec fronty, Shift + klik ji začne stavět hned. Ve frontě lze položky posouvat dopředu (▲) a rušit (✕).')}</p>
      <h4>Kultura, tradice a věky</h4><p>${esc('Kultura měst se sčítá do společné pokladnice národa. Jakmile jí je dost, vyberete si tradici (klávesa C) – trvalou výhodu pro celý národ. První stojí 25 kultury, každá další víc. Zároveň každé město svou kulturou rozšiřuje hranice.')}</p>
      <p>${esc(`Výzkum vás posouvá věky: ${ERAS.slice(1).map(e => `${e.name} při ${e.techs} technologiích`).join(', ')}. Vstup do věku je milník s odměnou ve zlatě a kultuře; národ, který do věku vstoupí první, získá zlatý věk (+1 výroba, zlato a kultura v každém městě na ${GOLDEN_TURNS} tahů). Každý národ začíná s jednou technologií, kterou si přinesl z domoviny.`)}</p>
      <h4>Cesty a řeky</h4><p>${esc('Po objevu Kola stavějí dělníci cesty (2 tahy na pole; rozkaz Cesta do… postaví celou trasu). Krok z cesty na cestu stojí půl bodu pohybu, města se počítají jako cesta. Řeky tečou po hranách polí: pole u řeky dává +1 zlato, přechod řeky stojí bod pohybu navíc a útok zblízka přes řeku je o 20 % slabší. Cesta na obou březích funguje jako most.')}</p>
      <h4>Zkušenosti a přezbrojení</h4><p>${esc('Jednotky získávají bojem zkušenosti a při 10, 25 a 45 bodech si vyberou povýšení: Výcvik (+15 % útok), Zocelení (+20 % obrana), Ranhojič (rychlejší léčení) nebo Pochodník (+1 pohyb). Zastaralou jednotku lze na vlastním území za zlato přezbrojit (klávesa U): válečník → kopiník → šermíř, zvěd → jezdec, galéra → triéra.')}</p>
      <h4>Obchod a spojenectví</h4><p>${esc('V okně Diplomacie vidíte vztah každého soupeře k vám. Koně a železo můžete prodávat či kupovat za zlato za tah, darem vztah zlepšíte. Vstřícný soupeř přijme spojenectví proti třetímu národu a 25 tahů vás nenapadne; někdy o pomoc požádá sám.')}</p>
      <h4>Lodě a nalodění</h4><p>${esc('Technologie Plavba dovolí pozemním jednotkám vstoupit na pobřežní vody, Navigace i na oceán. Nalodění i vylodění ukončí tah; naloděná jednotka pluje 3 pole za tah (s Navigací 4), nemůže útočit a brání se silou 4. Pobřežní město staví galéry (boj zblízka proti lodím a člunům) a triéry (střelba na 2 pole, i na břeh a města) a přístav (+1 jídlo z vodních polí, +2 zlato).')}</p>
      <h4>Pole a vylepšení</h4><p>${esc('Louky dávají jídlo, pláně jídlo i výrobu, pahorkatina výrobu, les výrobu. Dělníci staví farmy (+jídlo), doly (+výroba), ohrady (koně, zvěř) a pily (les). Koně a železo je nutné vylepšit, aby šlo stavět jezdce a šermíře.')}</p>
      <h4>Boj</h4><p>${esc('Na jednom poli může stát jedna vojenská a jedna civilní jednotka. V boji zblízka utrpí ztráty obě strany, střelci (dostřel 2) odvetu nedostanou. Pahorkatina a les dávají obránci +25 %, opevnění dalších +25 %. Kopiníci mají +50 % proti jízdě, katapulty dvojnásobný účinek proti městům. Jednotka, která se celý tah nehýbe, se léčí (nejrychleji ve městě).')}</p>
      <p>${esc('Město se dobývá tak, že mu útoky srazíte hradby na nulu a vstoupíte do něj jednotkou pro boj zblízka. Města sama střílejí na nepřátele do 2 polí.')}</p>
      <h4>Pokladna</h4><p>${esc('Každá vojenská jednotka nad volný limit (3 + 2 za město) stojí 1 zlato za tah, některé budovy také. Prázdná pokladna brzdí výzkum.')}</p>`, `<button class="btn" data-a="guide" data-v="0">Návod krok za krokem</button><button class="btn" data-a="close">Zavřít</button>`, '820px')
  }

  /** Úvodní návod po stránkách. */
  showGuide(page = 0): void {
    const nat = this.pickedNation
    const pic = (name: string, w = 72) => `<img src="${UI}${name}.png" style="width:${w}px" alt="">`
    const li = (items: string[]) => `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    const pages: [string, string, string][] = [
      ['O co jde', pic(`p_${nat}`, 120) + pic('f_ruins', 96) + pic('b_wonder', 80),
        `<p>${esc('Vedete svůj národ v zemi, kde osiřel trůn staré říše. Hraje se na tahy: nejdřív rozdáte rozkazy vy, potom táhnou dva soupeři a barbaři. Mise trvá nejvýš 120 tahů.')}</p>` +
        li(['Dobytí: obsaďte sídelní města obou soupeřů.', 'Div: vyzkoumejte astronomii a dostavte Sluneční chrám jako první.', 'Sláva: mějte po 120 tazích nejvyšší skóre.']) +
        `<p>${esc('Stačí jedna z cest. Prohrajete, když ztratíte všechna města nebo když Sluneční chrám dostaví soupeř.')}</p>`],
      ['Mapa a ovládání', pic('t_grass_1', 96) + pic('hex_move', 96) + pic('hex_attack', 96),
        li(['Mapu posouváte tažením myši nebo klávesami WASD, kolečkem přibližujete.', 'Kliknutím vyberete jednotku nebo město. Esc výběr zruší.', 'S vybranou jednotkou: klik na světlé pole = pohyb ještě tento tah, klik kamkoli dál = cesta na více tahů (jednotka pak chodí sama), klik na červený rámeček = útok.', 'Shift + klik přidá jednotce další průjezdní bod.', 'Najeďte myší na cokoli v rozhraní a zobrazí se nápověda. Dole uprostřed vidíte popis pole pod kurzorem.'])],
      ['První město', pic(`u_settler_${nat}`, 88) + pic(`city_1_${nat}`, 110),
        `<p>${esc('Začínáte s osadníky, válečníkem a zvědem. Vyberte osadníky a založte město (klávesa B) – místo, kde stojí, je dobré.')}</p>` +
        li(['Kliknutím na město otevřete jeho okno. Obyvatelé obdělávají okolní pole a přinášejí jídlo (růst), výrobu (stavby) a zlato.', 'Vyberte, co stavět. Další kliknutí přidávají položky do fronty, takže město může mít plán na mnoho tahů dopředu.', 'Na začátek: válečník nebo zvěd, pak dělníci a osadníci pro druhé město. Tlačítko Poradit vybere rozumnou stavbu za vás.'])],
      ['Pole, dělníci a kultura', pic(`u_worker_${nat}`, 80) + pic('i_farm', 80) + pic('i_mine', 80) + pic('ic_culture', 60),
        li(['Dělníci staví na polích ve vašem území farmy, doly, ohrady a pily. Když je vyberete, pole k vylepšení se označí zeleně – stačí na ně kliknout. Rozkaz Automaticky (E) je nechá pracovat samostatně.', 'Po objevu Kola stavějí i cesty: pohyb po nich stojí polovinu a překlenou řeku.', 'Koně a železo je nutné vylepšit (ohrada, důl), teprve pak lze stavět jízdu a šermíře.', 'Kultura rozšiřuje hranice města. Každé město ji střádá zvlášť: druhý okruh polí získá při 18 bodech, třetí při 90. Zrychlí to monument a chrám.', 'Kultura všech měst se navíc sčítá a národ si za ni vybírá tradice – trvalé výhody (ukazatel kultury nahoře, klávesa C).'])],
      ['Výzkum', pic('ic_sci', 72) + pic('b_library', 80) + pic('b_academy', 80),
        li(['Vědu dávají obyvatelé, knihovny a akademie. Co zkoumat, volíte ve stromu technologií (klávesa T nebo ukazatel nahoře).', 'Technologie odemykají jednotky, budovy a vylepšení polí. Po najetí myší na kartu uvidíte přesně co.', 'Každý národ začíná s jednou hotovou technologií. Počet objevů vás posouvá do dalších věků – kdo je v novém věku první, získá zlatý věk.', 'Astronomie na konci stromu odemyká Sluneční chrám.'])],
      ['Vojsko a boj', pic(`u_warrior_${nat}`, 80) + pic(`u_archer_${nat}`, 80) + pic('f_camp', 96),
        li(['Na jednom poli stojí nejvýš jedna vojenská a jedna civilní jednotka.', 'Zblízka utrpí ztráty obě strany, střelci (dostřel 2 pole) odvetu nedostanou. Před útokem vidíte odhad ztrát.', 'Les a pahorkatina pomáhají obránci, opevnění (F) také, útok přes řeku je slabší. Jednotka, která se tah nehýbe, se léčí.', 'Bojem jednotky sbírají zkušenosti a vybírají si povýšení; staré jednotky lze za zlato přezbrojit.', 'Barbarský tábor vypálíte tím, že na něj vstoupíte. Město dobudete, když mu srazíte hradby na nulu a vejdete do něj pěchotou.'])],
      ['Lodě', pic(`u_galley_${nat}`, 80) + pic(`u_trireme_${nat}`, 80) + pic(`u_boat_${nat}`, 80) + pic('b_harbor', 80),
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
    const rows = s.players.filter(p => p.id !== BARB).map(p => `<tr><td style="color:${NATIONS[p.nation].css}">${NATIONS[p.nation].name}${p.alive ? '' : ' †'}</td><td>${score(s, p.id)}</td><td>${citiesOf(s, p.id).length}</td><td>${p.techs.length}</td></tr>`).join('')
    this.open('over', esc(o.title), `<div style="display:flex;gap:16px"><img src="${UI}${o.won ? `p_${this.me.nation}` : 'em_barb'}.png" style="width:144px;height:144px;flex:none;border:3px solid ${o.won ? 'var(--gold)' : 'var(--bad)'}" alt=""><div><p style="font-size:19px">${esc(o.text)}</p>
      <p style="color:var(--muted)">${esc(`Hra skončila v tahu ${Math.min(s.turn, s.maxTurns)}. Obtížnost: ${DIFFICULTY[s.difficulty].name.toLowerCase()}.`)}</p></div></div>
      <table class="scores"><tr><th>Národ</th><th>Skóre</th><th>Města</th><th>Technologie</th></tr>${rows}</table>`,
    `<button class="btn big" data-a="over-menu">Hlavní menu</button>`, '760px')
  }
}

void itemName
