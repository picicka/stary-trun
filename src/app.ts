// Ovladač hry: drží stav, výběr a propojuje pravidla, mapu a rozhraní.
import { IMPROVEMENTS, NATIONS, UNITS, type Difficulty, type ImprovementId, type NationId, type TechId } from './game/data.ts'
import { aiAcceptsPeace, adviseBuild } from './game/ai.ts'
import { answerAlly, askAlliance, buyResource, giveGold, sellResource } from './game/diplo.ts'
import type { PromoId, ResourceId, ScenarioId } from './game/data.ts'
import { hexDist } from './game/hex.ts'
import {
  atWar, attack, availableTechs, buy, canFoundCity, cityAt, cityById, citiesOf, cityWorkable, declareWar, dequeue, drainEvents, enqueue, foundCity, idx, isCivilian, isEmbarked,
  isNaval, promoteUnit, roadStep, tileJobs, upgradeUnit, upgradeBlock, canWork, killUnit, makePeace, moveUnit, note, pathMap, pathTo, pathTurns, previewAttack, promote, reachable, startWork, stopUnit, tilesWithin, unitById, unitsAt, unitsOf,
  updateVisibility, type PathMap,
} from './game/rules.ts'
import { clearSave, createGame, endTurn, loadGame, saveGame } from './game/state.ts'
import type { BuildItem, City, GameState, Unit } from './game/types.ts'
import { sfx, unlockAudio } from './audio.ts'
import { Hud } from './ui/hud.ts'
import type { MapHost, MapScene } from './view/MapScene.ts'

export type Attention = { kind: 'research' } | { kind: 'city'; city: City } | { kind: 'unit'; unit: Unit } | { kind: 'end' }

export class App implements MapHost {
  state!: GameState
  scene: MapScene
  hud: Hud
  selUnit = -1
  selCity = -1
  busy = false
  inGame = false
  private reach = new Set<number>()
  private targets = new Set<number>()
  private pm: PathMap | null = null
  /** Za kolik tahů dorazí vybraná jednotka na pole pod kurzorem (0 = letos), nebo -1. */
  hoverEta = -1
  /** Další klik na mapu určí cíl cesty, kterou mají dělníci postavit. */
  roadMode = false
  /** Pole, kde mohou vybraní dělníci stavět vylepšení (index → práce). */
  jobs = new Map<number, string>()
  /** Za kolik tahů dorazí vybraná jednotka do cíle své cesty, nebo -1. */
  gotoEta = -1

  constructor(scene: MapScene) {
    this.scene = scene
    scene.host = this
    this.hud = new Hud(this)
    scene.floater = (wx, wy, text, color) => this.hud.floater(wx, wy, text, color)
    window.addEventListener('keydown', e => this.onKey(e))
    window.addEventListener('pointerdown', () => unlockAudio(), { capture: true })
    this.hud.showTitle()
  }

  // ------------------------------------------------------------ start

  newGame(nation: NationId, difficulty: Difficulty, scenario: ScenarioId = 'valley'): void {
    this.begin(createGame(nation, difficulty, scenario))
    this.hud.showBriefing()
  }

  continueGame(): boolean {
    const s = loadGame()
    if (!s) return false
    this.begin(s)
    return true
  }

  private begin(s: GameState): void {
    this.state = s
    this.inGame = true
    this.selUnit = -1; this.selCity = -1
    drainEvents()
    const go = () => {
      this.scene.reset()
      const cap = citiesOf(s, 0).find(c => c.capital) ?? citiesOf(s, 0)[0]
      const u = unitsOf(s, 0)[0]
      if (cap) this.scene.centerOn(cap.x, cap.y, false)
      else if (u) this.scene.centerOn(u.x, u.y, false)
      this.hud.enterGame()
      const first = unitsOf(s, 0).find(v => v.type === 'settler')
      if (first && !cap) this.select(first)
      this.refresh()
    }
    if (this.scene.scene.isActive()) go()
    else this.scene.events.once('ready', go)
  }

  quitToMenu(): void {
    this.inGame = false
    this.hud.showTitle()
  }

  // ------------------------------------------------------------ výběr

  get unit(): Unit | undefined { return this.selUnit >= 0 ? unitById(this.state, this.selUnit) : undefined }
  get city(): City | undefined { return this.selCity >= 0 ? cityById(this.state, this.selCity) : undefined }

  select(u: Unit | null, center = false): void {
    this.selCity = -1
    this.selUnit = u ? u.id : -1
    if (u && center && !this.scene.inView(u.x, u.y)) this.scene.centerOn(u.x, u.y)
    this.refresh()
  }

  openCity(c: City | null): void {
    this.selUnit = -1
    this.selCity = c ? c.id : -1
    if (c && !this.scene.inView(c.x, c.y, 120)) this.scene.centerOn(c.x, c.y)
    this.refresh()
  }

  private computeSelection(): void {
    this.reach.clear(); this.targets.clear(); this.pm = null; this.gotoEta = -1; this.jobs.clear()
    if (!this.unit || this.unit.type !== 'worker') this.roadMode = false
    const u = this.unit
    const c = this.city
    if (c && c.owner === 0) {
      this.scene.showWorked(c.worked, cityWorkable(this.state, c))
      this.scene.showCityRing(c.x, c.y)
      this.scene.showWorked(c.worked, cityWorkable(this.state, c))
      return
    }
    if (!u || u.owner !== 0) { this.selUnit = -1; this.scene.showSelection(null, [], []); return }
    const s = this.state
    for (const i of reachable(s, u)) if (s.players[0].explored[i]) this.reach.add(i)
    const d = UNITS[u.type]
    for (const [x, y] of tilesWithin(s, u.x, u.y, d.ranged ? d.range! : 1)) {
      const pv = previewAttack(s, u, x, y)
      if (pv && s.players[0].visible[idx(s, x, y)]) { this.targets.add(idx(s, x, y)); this.reach.delete(idx(s, x, y)) }
    }
    this.pm = pathMap(s, u, undefined, s.players[0])
    this.scene.showSelection(u, [...this.reach], [...this.targets])
    if (u.type === 'worker' && !u.work) {
      for (let i = 0; i < s.tiles.length; i++) {
        if (s.tiles[i].owner !== 0 || !s.players[0].explored[i]) continue
        const j = tileJobs(s, i, 0).find(o => o.ok && o.job !== 'road')
        if (j && this.pm.dist[i] !== Infinity) this.jobs.set(i, j.job)
      }
      this.scene.showJobs([...this.jobs].map(([i, job]) => ({ i, job })))
    }
    const far = u.goto ?? u.roadTo
    if (far && !u.goto) { const path = pathTo(s, this.pm, far[0], far[1]); if (path) this.scene.showRoute(path, [far]) }
    if (u.goto) {
      const path = pathTo(s, this.pm, u.goto[0], u.goto[1])
      if (path) { this.gotoEta = pathTurns(s, u, path); this.scene.showRoute(path, [u.goto, ...u.way]) }
    }
  }

  refresh(): void {
    if (!this.inGame) return
    this.computeSelection()
    this.hud.render()
  }

  // ------------------------------------------------------------ akce

  /** Provede změnu stavu, přehraje animace a uloží hru. */
  async run(fn: () => void, fast = false): Promise<void> {
    if (this.busy || this.state.over) return
    this.busy = true
    try {
      fn()
      this.scene.ensureUnitViews()
      this.scene.clearPath()
      await this.scene.play(drainEvents(), fast)
    } finally {
      this.busy = false
    }
    if (this.selUnit >= 0 && !this.unit) this.selUnit = -1
    saveGame(this.state)
    this.refresh()
    if (this.state.over) this.gameOver()
  }

  private gameOver(): void {
    clearSave()
    sfx(this.state.over!.won ? 'fanfare' : 'defeat')
    this.hud.showGameOver()
  }

  onTileClick(x: number, y: number, right: boolean, shift = false): void {
    if (this.busy || !this.inGame || this.hud.modalOpen || this.state.over) return
    const s = this.state
    const i = idx(s, x, y)
    const u = this.unit
    if (u && this.roadMode) {
      this.roadMode = false
      if (right) { this.refresh(); return }
      if (!this.pm || !pathTo(s, this.pm, x, y)) { sfx('error'); this.hud.toast('Tam dělníci cestu nedovedou.'); this.refresh(); return }
      stopUnit(u); u.auto = false; u.roadTo = [x, y]
      sfx('build')
      void this.run(() => roadStep(s, u)).then(() => { this.hud.toast('Dělníci postaví cestu až na označené pole.'); this.autoAdvance() })
      return
    }
    if (u) {
      if (this.targets.has(i)) { this.orderAttack(u, x, y); return }
      // Dělníci: klik na pole se zelenou značkou = dojít tam a postavit vylepšení.
      const job = this.jobs.get(i)
      if (job && !right && !shift && !(u.x === x && u.y === y)) {
        stopUnit(u); u.auto = false; u.todo = job as ImprovementId
        sfx('build')
        void this.run(() => { moveUnit(s, u, x, y) }).then(() => { const v = this.unit; if (v && (v.work || v.moves <= 0 || v.goto)) this.autoAdvance() })
        return
      }
      // Levé tlačítko pošle jednotku i na vzdálené pole; na poli s vlastní jednotkou či městem místo toho vybírá.
      const own = unitsAt(s, x, y).some(o => o.owner === 0) || cityAt(s, x, y)?.owner === 0
      if (!(u.x === x && u.y === y) && (right || shift || this.reach.has(i) || !own)) { this.orderMove(u, x, y, shift); return }
    }
    if (right) return
    // Výběr: postupně voják, civilista, město.
    const mine = unitsAt(s, x, y).filter(o => o.owner === 0).sort((a, b) => Number(isCivilian(a)) - Number(isCivilian(b)))
    const c = cityAt(s, x, y)
    const opts: (Unit | City)[] = [...mine]
    if (c && c.owner === 0) opts.push(c)
    if (!opts.length) { this.selUnit = -1; this.selCity = -1; this.refresh(); return }
    const curIdx = opts.findIndex(o => ('type' in o ? o.id === this.selUnit : o.id === this.selCity))
    const next = opts[(curIdx + 1) % opts.length]
    sfx('select')
    if ('type' in next) this.select(next)
    else this.openCity(next)
  }

  private orderMove(u: Unit, x: number, y: number, append = false): void {
    const s = this.state
    if (append && u.goto) {
      if (u.way.length >= 6) { sfx('error'); this.hud.toast('Fronta rozkazů je plná (nejvýš 6 bodů).'); return }
      u.way.push([x, y]); u.auto = false
      sfx('click'); this.hud.toast(`Průjezdní bod ${u.way.length} přidán do fronty rozkazů.`)
      saveGame(s); this.refresh()
      return
    }
    stopUnit(u); u.auto = false
    if (!this.pm || !pathTo(s, this.pm, x, y)) { sfx('error'); this.hud.toast('Tam se jednotka nedostane.'); return }
    void this.run(() => { moveUnit(s, u, x, y) }).then(() => {
      const v = this.unit
      if (v && v.goto && this.gotoEta > 0) this.hud.toast(`${UNITS[v.type].name}: na cestě, dorazí za ${this.gotoEta} ${this.gotoEta === 1 ? 'tah' : this.gotoEta < 5 ? 'tahy' : 'tahů'}.`)
      if (v && v.moves <= 0) this.autoAdvance()
    })
  }

  private orderAttack(u: Unit, x: number, y: number): void {
    const s = this.state
    const pv = previewAttack(s, u, x, y)
    if (!pv) return
    const go = () => void this.run(() => { attack(s, u, x, y) }).then(() => { const v = this.unit; if (!v || v.moves <= 0) this.autoAdvance() })
    if (pv.needWar >= 0) {
      const n = NATIONS[s.players[pv.needWar].nation]
      this.hud.confirm(`Vyhlásit válku?`, `Útok na národ ${n.name} znamená válku. ${n.leader} vám to jen tak nezapomene.`, 'Vyhlásit válku', () => {
        declareWar(s, 0, pv.needWar); go()
      })
    } else go()
  }

  /** Po vyčerpání pohybu skočí na další jednotku, která čeká na rozkaz. */
  private autoAdvance(): void {
    const n = this.idleUnits()[0]
    if (n) window.setTimeout(() => { if (!this.busy && this.inGame) this.select(n, true) }, 180)
    else { this.selUnit = -1; this.refresh() }
  }

  idleUnits(): Unit[] {
    return unitsOf(this.state, 0).filter(u => u.moves > 0 && !u.skip && !u.sleep && !u.fortified && !u.work && !u.goto && !u.auto && !u.roadTo)
  }

  attention(): Attention {
    const s = this.state
    const cs = citiesOf(s, 0)
    if (cs.length && !s.players[0].research && availableTechs(s.players[0]).length) return { kind: 'research' }
    const c = cs.find(o => !o.build)
    if (c) return { kind: 'city', city: c }
    const idle = this.idleUnits()
    if (idle.length) {
      const cur = this.unit
      const pick = cur && idle.length > 1 ? idle.filter(u => u.id !== cur.id).sort((a, b) => hexDist(a.x, a.y, cur.x, cur.y) - hexDist(b.x, b.y, cur.x, cur.y))[0] : idle[0]
      return { kind: 'unit', unit: pick }
    }
    return { kind: 'end' }
  }

  /** Hlavní tlačítko: vyřídí, co čeká, jinak ukončí tah. */
  mainAction(force = false): void {
    if (this.busy || this.state.over || this.hud.modalOpen) return
    const a = force ? { kind: 'end' as const } : this.attention()
    sfx('click')
    if (a.kind === 'research') this.hud.showTech()
    else if (a.kind === 'city') this.openCity(a.city)
    else if (a.kind === 'unit') this.select(a.unit, true)
    else this.endTurn()
  }

  endTurn(): void {
    if (this.busy || this.state.over) return
    this.selCity = -1
    sfx('turn')
    this.hud.setWaiting(true)
    this.hud.markNotesRead()
    void this.run(() => endTurn(this.state), true).then(() => {
      this.hud.setWaiting(false)
      if (this.state.over) return
      const u = this.unit
      if (!u || u.moves <= 0) { const n = this.idleUnits()[0]; if (n) this.select(n, true) }
      this.hud.checkOffers()
    })
  }

  unitAction(a: string): void {
    const u = this.unit
    if (!u || this.busy) return
    const s = this.state
    if (a === 'found') {
      const err = canFoundCity(s, u)
      if (err) { sfx('error'); this.hud.toast(err); return }
      void this.run(() => { const c = foundCity(s, u); if (c) { this.selUnit = -1; this.selCity = c.id } })
      return
    }
    if (a.startsWith('imp:')) {
      const job = a.slice(4) as ImprovementId | 'road'
      if (canWork(s, u, job) && startWork(s, u, job)) { sfx('build'); this.hud.toast(`${job === 'road' ? 'Cesta' : IMPROVEMENTS[job].name}: hotovo za ${u.workLeft} tahy.`); saveGame(s); this.autoAdvance(); this.refresh() }
      return
    }
    if (a === 'roadto') { this.roadMode = !this.roadMode; sfx('click'); if (this.roadMode) this.hud.toast('Klikněte na pole, kam má cesta vést (pravé tlačítko ruší).'); this.refresh(); return }
    if (a.startsWith('promo:')) {
      if (promoteUnit(s, u, a.slice(6) as PromoId)) { sfx('quest'); saveGame(s); this.refresh() }
      return
    }
    if (a === 'upgrade') {
      const err = upgradeBlock(s, u)
      if (err) { sfx('error'); this.hud.toast(err); return }
      void this.run(() => { upgradeUnit(s, u) })
      return
    }
    if (a === 'auto') {
      stopUnit(u); u.auto = true; u.sleep = false; u.fortified = false
      this.hud.toast(u.type === 'worker' ? 'Dělníci budou sami vylepšovat pole. Zrušíte tlačítkem Probudit.' : 'Jednotka bude sama zkoumat mapu. Zrušíte tlačítkem Probudit.')
    }
    else if (a === 'fortify') { u.fortified = true; stopUnit(u); u.sleep = false }
    else if (a === 'sleep') { u.sleep = true; stopUnit(u) }
    else if (a === 'skip') { u.skip = true }
    else if (a === 'wake') { u.sleep = false; u.fortified = false; u.work = null; stopUnit(u); u.auto = false; u.skip = false; saveGame(s); this.refresh(); return }
    else if (a === 'disband') {
      this.hud.confirm('Rozpustit jednotku?', `${UNITS[u.type].name}: jednotka bude nenávratně rozpuštěna.`, 'Rozpustit', () => {
        void this.run(() => { killUnit(s, u); updateVisibility(s, 0) })
      })
      return
    }
    sfx('click')
    saveGame(s)
    this.autoAdvance()
    this.refresh()
  }

  /** Přidá položku do výroby města: na konec fronty, s `front` hned na řadu. */
  chooseBuild(c: City, it: BuildItem, front = false): void {
    const err = enqueue(this.state, c, it, front)
    if (err) { sfx('error'); this.hud.toast(err); return }
    sfx('build')
    saveGame(this.state)
    this.refresh()
  }

  queueRemove(c: City, i: number): void { dequeue(this.state, c, i); sfx('click'); saveGame(this.state); this.refresh() }
  queuePromote(c: City, i: number): void { promote(this.state, c, i); sfx('build'); saveGame(this.state); this.refresh() }

  advise(c: City): void {
    adviseBuild(this.state, c)
    sfx('build')
    this.refresh()
  }

  buyNow(c: City): void {
    void this.run(() => { if (buy(this.state, c)) sfx('found'); else sfx('error') })
  }

  chooseTech(t: TechId): void {
    const p = this.state.players[0]
    if (!availableTechs(p).includes(t)) return
    p.research = t
    sfx('build')
    saveGame(this.state)
    this.refresh()
  }

  proposePeace(pid: number): string {
    const s = this.state
    if (!atWar(s, 0, pid)) return ''
    if (aiAcceptsPeace(s, pid)) { makePeace(s, 0, pid); sfx('quest'); saveGame(s); this.refresh(); return 'Mír uzavřen.' }
    sfx('error')
    return 'Odmítnuto. „Ještě jsme neskončili.“'
  }

  declare(pid: number): void {
    declareWar(this.state, 0, pid)
    for (const ev of drainEvents()) if (ev.e === 'sound') sfx(ev.id)
    saveGame(this.state)
    this.refresh()
  }

  /** Diplomatická akce hráče; vrací odpověď soupeře. */
  diplo(kind: string, pid: number, arg: string): string {
    const s = this.state
    const r = kind === 'gift' ? giveGold(s, pid) : kind === 'sell' ? sellResource(s, pid, arg as ResourceId) : kind === 'buy' ? buyResource(s, pid, arg as ResourceId) : askAlliance(s, pid, Number(arg))
    for (const ev of drainEvents()) if (ev.e === 'sound') sfx(ev.id)
    sfx(r.ok ? 'quest' : 'error')
    saveGame(s)
    this.refresh()
    return r.text
  }

  answerOffer(from: number, accept: boolean): void {
    const s = this.state
    const o = s.offers.find(x => x.from === from)
    s.offers = s.offers.filter(x => x !== o)
    if (o?.kind === 'ally') {
      answerAlly(s, from, o.vs!, accept)
      for (const ev of drainEvents()) if (ev.e === 'sound') sfx(ev.id)
      saveGame(s); this.refresh()
      return
    }
    if (accept) makePeace(s, 0, from)
    else note(s, 0, `Odmítli jste mír s národem ${NATIONS[s.players[from].nation].name}.`, 'info')
    saveGame(s)
    this.refresh()
  }

  // ------------------------------------------------------------ vstup

  onHover(x: number, y: number): void {
    if (!this.inGame) return
    this.hud.hover(x, y)
    const u = this.unit
    this.hoverEta = -1
    if (!u || this.busy || x < 0 || !this.pm) { this.scene.clearPath(); return }
    const i = idx(this.state, x, y)
    if (this.targets.has(i) || (u.x === x && u.y === y)) { this.scene.clearPath(); return }
    const path = pathTo(this.state, this.pm, x, y)
    if (!path || path.length > 60) { this.scene.clearPath(); return }
    this.hoverEta = pathTurns(this.state, u, path)
    this.hud.hover(x, y)
    this.scene.showPath(path, k => this.reach.has(k) || (this.pm!.dist[k] <= u.moves && u.moves > 0))
  }

  onCameraMove(): void { if (this.inGame) this.hud.cameraMoved() }

  private onKey(e: KeyboardEvent): void {
    if (!this.inGame || e.metaKey || e.ctrlKey || e.altKey) return
    if (this.hud.modalOpen) { if (e.key === 'Escape') this.hud.closeModal(); return }
    const k = e.key.toLowerCase()
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.mainAction(e.shiftKey); return }
    if (e.key === 'Escape') { if (this.roadMode) this.roadMode = false; else { this.selUnit = -1; this.selCity = -1 } this.refresh(); return }
    if (k === 'n' || e.key === 'Tab') { e.preventDefault(); const a = this.idleUnits(); if (a.length) { const cur = a.findIndex(u => u.id === this.selUnit); this.select(a[(cur + 1) % a.length], true) } return }
    if (k === 't') { this.hud.showTech(); return }
    if (k === 'm') { this.hud.showMission(); return }
    if (k === 'h' || e.key === '?') { this.hud.showHelp(); return }
    if (e.key === '+' || e.key === '=') { this.scene.zoomBy(1); return }
    if (e.key === '-') { this.scene.zoomBy(-1); return }
    const u = this.unit
    if (!u) return
    if (k === 'b' && u.type === 'settler') this.unitAction('found')
    else if (k === 'f' && !isCivilian(u) && !isEmbarked(this.state, u)) this.unitAction('fortify')
    else if (k === 'e' && (u.type === 'worker' || u.type === 'scout' || isNaval(u))) this.unitAction('auto')
    else if (k === 'r' && u.type === 'worker') this.unitAction('roadto')
    else if (k === 'u' && !isCivilian(u)) this.unitAction('upgrade')
    else if (k === 'z') this.unitAction('sleep')
    else if (k === 'x') this.unitAction('skip')
  }
}
