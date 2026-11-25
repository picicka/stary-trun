// Ovladač hry: drží stav, výběr a propojuje pravidla, mapu a rozhraní.
import { IMPROVEMENTS, NATIONS, UNITS, type Difficulty, type ImprovementId, type NationId, type TechId } from './game/data.ts'
import { siteScore } from './game/ai.ts'
import { exec, type Command, type Result } from './game/commands.ts'
import type { PromoId, ScenarioId, TraditionId } from './game/data.ts'
import { hexDist } from './game/hex.ts'
import {
  atWar, availableTechs, canFoundCity, cityAt, cityById, citiesOf, cityWorkable, drainEvents, idx, isCivilian, isEmbarked,
  isNaval, traditionReady, tileJobs, upgradeBlock, pathMap, pathTo, pathTurns, previewAttack, reachable, tilesWithin, unitById, unitsAt, unitsOf,
  type PathMap,
} from './game/rules.ts'
import { actors, canAct, clearSave, createGame, deserialize, loadGame, saveGame, serialize, stateHash, type GameOptions } from './game/state.ts'
import { cleanCode, ClientSession, HostSession, roomCode, type Lobby, type NetEvents, type NetGame, type SavedSeat, type Session } from './net/session.ts'
import { localTransport, NetError, peerTransport, type Transport } from './net/transport.ts'
import type { BuildItem, City, GameState, JobId, Unit } from './game/types.ts'
import { sfx, unlockAudio } from './audio.ts'
import { Hud } from './ui/hud.ts'
import type { MapHost, MapScene } from './view/MapScene.ts'

export type Attention = { kind: 'research' } | { kind: 'tradition' } | { kind: 'city'; city: City } | { kind: 'unit'; unit: Unit } | { kind: 'end' }

/** Nastavení síťové hry, které hostitel zvolil před otevřením místnosti. */
export interface NetConfig { difficulty: Difficulty; scenario: ScenarioId; opts: GameOptions; seed?: number; info: string; max: number }

const NET_KEY = 'hex4x-net'
const JOIN_KEY = 'hex4x-join'
const NAME_KEY = 'hex4x-name'
/** Obě strany musí mít stejná pravidla; číslo sestavení dosazuje Vite. */
const NET_VERSION = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'
const store = {
  get<T>(k: string): T | null { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : null } catch { return null } },
  set(k: string, v: unknown): void { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* bez úložiště */ } },
  del(k: string): void { try { localStorage.removeItem(k) } catch { /* nic */ } },
}
/** Místo v cizí hře si pamatuje prohlížeč; při zkoušení mezi panely (?net=local) každý panel zvlášť. */
const LOCAL_NET = new URLSearchParams(location.search).get('net') === 'local'
const seatStore = {
  get(): { code: string; token: string } | null { if (!LOCAL_NET) return store.get(JOIN_KEY); try { const v = sessionStorage.getItem(JOIN_KEY); return v ? JSON.parse(v) : null } catch { return null } },
  set(v: { code: string; token: string }): void { if (!LOCAL_NET) store.set(JOIN_KEY, v); else try { sessionStorage.setItem(JOIN_KEY, JSON.stringify(v)) } catch { /* nic */ } },
  del(): void { if (!LOCAL_NET) store.del(JOIN_KEY); else try { sessionStorage.removeItem(JOIN_KEY) } catch { /* nic */ } },
}
const newToken = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export class App implements MapHost {
  state!: GameState
  /** Hráč, který se na hru dívá a zadává rozkazy (u jednoho počítače se střídá). */
  me = 0
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
  /** Tipy rádce: doporučení na mapě i v oknech a panel s radami. Platí pro všechny hry. */
  hints = (() => { try { return localStorage.getItem('hex4x-hints') !== '0' } catch { return true } })()
  /** Další klik na mapu určí cíl cesty, kterou mají dělníci postavit. */
  roadMode = false
  /** Pole, kde mohou vybraní dělníci stavět vylepšení (index → práce). */
  jobs = new Map<number, string>()
  /** Doporučená místa pro město pro vybrané osadníky (index pole → hodnocení). */
  sites = new Map<number, number>()
  /** Za kolik tahů dorazí vybraná jednotka do cíle své cesty, nebo -1. */
  gotoEta = -1
  /** Hra po síti: sezení hostitele nebo připojeného hráče. */
  net: Session | null = null
  private netCfg: NetConfig | null = null
  private transport: Transport = LOCAL_NET ? localTransport() : peerTransport()

  constructor(scene: MapScene) {
    this.scene = scene
    scene.host = this
    this.hud = new Hud(this)
    scene.floater = (wx, wy, text, color) => this.hud.floater(wx, wy, text, color)
    window.addEventListener('keydown', e => this.onKey(e))
    window.addEventListener('pointerdown', () => unlockAudio(), { capture: true })
    this.hud.showTitle()
    const join = cleanCode(new URLSearchParams(location.search).get('hra') ?? '')
    if (join.length === 5) this.hud.showNet(join)
  }

  // ------------------------------------------------------------ start

  /** Nová hra; víc národů v `nations` = víc lidských hráčů, kteří se střídají u jednoho počítače. */
  newGame(nations: NationId[], difficulty: Difficulty, scenario: ScenarioId = 'valley', opts: GameOptions = {}, seed?: number): void {
    this.leaveNet()
    store.del(NET_KEY)
    // Pokaždé jiné startovní místo.
    this.begin(createGame(nations[0], difficulty, scenario, seed, Math.floor(Math.random() * 8), nations.slice(1), opts))
    if (this.hotseat) this.handover(() => this.hud.showBriefing())
    else this.hud.showBriefing()
  }

  continueGame(): boolean {
    const s = loadGame()
    if (!s) return false
    this.leaveNet()
    const saved = store.get<{ code: string; seats: SavedSeat[] }>(NET_KEY)
    if (saved && saved.seats.length === s.players.filter(p => p.human).length) { void this.resumeHost(s, saved.code, saved.seats); return true }
    this.begin(s)
    if (this.hotseat) this.handover()
    return true
  }

  /** Hraje víc lidí u jednoho počítače? */
  get hotseat(): boolean { return !this.net && this.state.players.filter(p => p.human).length > 1 }
  /** Je místní hráč na tahu? */
  get myTurn(): boolean { return canAct(this.state, this.me) }
  get player() { return this.state.players[this.me] }

  /** Provede příkaz místního hráče – jediná cesta, kterou rozhraní mění stav hry. */
  cmd(c: Command): Result {
    const net = this.net
    if (net) {
      if (!this.myTurn) return { ok: false, text: 'Nejste na tahu.' }
      if (!net.ready) return { ok: false, text: 'Spojení je přerušeno, hra čeká na jeho obnovení.' }
    }
    // Táhne-li zároveň někdo další, může hostitel jeho příkaz zařadit dřív: uschováme stav pro přepočet.
    if (net && actors(this.state).length > 1) net.predict()
    const r = exec(this.state, this.me, c)
    net?.local(this.me, c, c.t === 'endTurn' ? stateHash(this.state) : undefined)
    return r
  }

  /** Uloží hru (v síťové hře ji ukládá jen hostitel). */
  private save(): void { if (!this.net || this.net.role === 'host') saveGame(this.state) }

  /** Uloží hru a překreslí rozhraní po příkazu bez animace. */
  private commit(): void { this.save(); this.refresh() }

  // ------------------------------------------------------------ hra po síti

  get playerName(): string { return store.get<string>(NAME_KEY) ?? '' }
  set playerName(v: string) { store.set(NAME_KEY, v.trim().slice(0, 20)) }
  /** Rozehraná síťová hra, do které se dá vrátit (kód místnosti), nebo null. */
  get rejoinCode(): string | null { return seatStore.get()?.code ?? null }
  /** Jméno hráče na daném místě (jen v síťové hře). */
  seatName(pid: number): string { return this.net?.lobby()?.members[pid]?.name ?? '' }
  /** Odkaz, kterým se spoluhráči připojí. */
  get joinUrl(): string {
    const u = new URL(location.href)
    u.search = ''
    u.searchParams.set('hra', this.net?.lobby()?.code ?? '')
    if (LOCAL_NET) u.searchParams.set('net', 'local')
    return u.toString()
  }

  private netGame(): NetGame {
    return {
      apply: (pid, cmd, hashed, at) => this.remote(pid, cmd, hashed, at),
      snapshot: () => serialize(this.state),
      hash: () => stateHash(this.state),
      replay: (base, confirmed, pending, seat) => this.replay(base, confirmed, pending, seat),
      load: (json, seat, first) => this.netLoad(json, seat, first),
    }
  }

  private netEvents(): NetEvents {
    return {
      lobby: l => this.onLobby(l),
      status: text => { if (this.inGame) { this.hud.toast(text); this.hud.render() } },
      closed: why => {
        this.net = null
        seatStore.del()
        // Po konci hry si hráč v klidu dočte závěrečnou obrazovku.
        if (this.inGame && this.state.over) return
        this.inGame = false
        this.hud.showNet('', why)
      },
    }
  }

  private onLobby(_l: Lobby): void {
    if (this.inGame) this.hud.render()
    else if (!this.net?.started) this.hud.showLobby()
  }

  /** Otevře místnost pro síťovou hru; ostatní se připojí kódem nebo odkazem. */
  async hostGame(cfg: NetConfig): Promise<void> {
    this.leaveNet()
    this.netCfg = cfg
    this.hud.showConnecting('Otevírám místnost…')
    for (let k = 0; k < 4; k++) {
      const code = roomCode()
      try {
        const end = await this.transport.host(code)
        this.net = new HostSession(end, { code, name: this.playerName || 'Hostitel', token: newToken(), max: cfg.max, info: cfg.info, version: NET_VERSION }, this.netGame(), this.netEvents())
        this.hud.showLobby()
        return
      } catch (e) {
        if (e instanceof NetError && e.taken) continue
        this.hud.showNet('', e instanceof NetError ? e.message : 'Místnost se nepodařilo otevřít.')
        return
      }
    }
    this.hud.showNet('', 'Místnost se nepodařilo otevřít.')
  }

  /** Připojí se do místnosti jiného hráče. */
  async joinGame(raw: string): Promise<void> {
    const code = cleanCode(raw)
    if (code.length !== 5) { this.hud.showNet(raw, 'Kód místnosti má pět znaků.'); return }
    this.leaveNet()
    // Stejný kód = návrat na své místo v rozehrané hře.
    const old = seatStore.get()
    const token = old?.code === code ? old.token : newToken()
    this.hud.showConnecting('Připojuji se…')
    const cs = new ClientSession(() => this.transport.join(code), { name: this.playerName || 'Hráč', token, version: NET_VERSION }, this.netGame(), this.netEvents())
    this.net = cs
    try {
      await cs.open()
      seatStore.set({ code, token })
    } catch (e) {
      if (this.net !== cs) return
      this.net = null
      this.hud.showNet(code, e instanceof NetError ? e.message : 'Připojení se nezdařilo.')
    }
  }

  /** Hostitel spouští hru: národy podle místnosti, zbylá místa vede počítač. */
  netStart(): void {
    const net = this.net, cfg = this.netCfg
    if (!net || net.role !== 'host' || !cfg || net.started) return
    const lobby = net.lobby()
    const nations = lobby.members.map(m => m.nation)
    const s = createGame(nations[0], cfg.difficulty, cfg.scenario, cfg.seed, Math.floor(Math.random() * 8), nations.slice(1), { ...cfg.opts, rivals: lobby.bots })
    this.begin(s, () => this.hud.showBriefing())
    saveGame(s)
    store.set(NET_KEY, { code: net.code, seats: net.seats() })
    net.start()
  }

  /** Hostitel pokračuje v uložené síťové hře: otevře tutéž místnost a hráči se vrátí na svá místa. */
  private async resumeHost(s: GameState, code: string, seats: SavedSeat[]): Promise<void> {
    this.hud.showConnecting('Otevírám místnost…')
    try {
      const end = await this.transport.host(code)
      this.net = new HostSession(end, { code, name: seats[0].name, token: seats[0].token, max: seats.length, info: '', version: NET_VERSION, resume: seats }, this.netGame(), this.netEvents())
      this.begin(s)
      this.hud.toast(`Místnost ${code} je znovu otevřená. Spoluhráči se vrátí stejným kódem.`)
    } catch (e) {
      this.hud.showNet('', e instanceof NetError && e.taken ? 'Místnost je ještě obsazená předchozím spojením. Zkuste to za chvíli znovu.' : e instanceof NetError ? e.message : 'Místnost se nepodařilo otevřít.')
    }
  }

  /** Stav hry od hostitele: začátek hry, návrat do ní, nebo oprava po rozejití. */
  private netLoad(json: string, seat: number, first: boolean, quiet = false): void {
    const s = deserialize(json)
    if (!s || !this.net) return
    const again = this.inGame && !first
    const cam = again ? this.scene.cameras.main : null
    const view = cam ? [cam.scrollX, cam.scrollY] : null
    this.me = seat
    this.busy = false
    this.begin(s, () => {
      if (first) this.hud.showBriefing()
      else {
        if (view) this.scene.cameras.main.setScroll(view[0], view[1])
        if (!quiet) this.hud.toast(again ? 'Hra se srovnala se stavem u hostitele.' : 'Jste zpět ve hře.')
        if (this.myTurn) { this.showPopups(); this.hud.checkOffers() }
      }
    })
  }

  /** Provede příkaz jiného hráče, který přišel po síti, a přehraje jeho animaci. */
  private async remote(pid: number, cmd: Command, hashed: boolean, after?: () => void): Promise<string> {
    for (let k = 0; this.busy && k < 400; k++) await new Promise(r => window.setTimeout(r, 25))
    if (!this.inGame) return ''
    const s = this.state
    const wasMine = this.myTurn
    const turn = s.turn
    this.busy = true
    let h = ''
    try {
      exec(s, pid, cmd)
      if (hashed) h = stateHash(s)
      after?.()
      const ev = drainEvents()
      // Panel na pozadí neanimuje (prohlížeč mu zastaví čas), jen srovná jednotky. Stejně tak cizí tah
      // při souběžných tazích: místní hráč právě táhne sám a animace by mu brala ovládání.
      if (document.hidden || (wasMine && s.turn === turn)) { this.scene.ensureUnitViews(); this.scene.syncUnits() }
      else { this.scene.ensureUnitViews(); await this.scene.play(ev, cmd.t === 'endTurn') }
    } finally {
      this.busy = false
    }
    if (s !== this.state) return h
    if (this.selUnit >= 0 && !this.unit) this.selUnit = -1
    if (this.selCity >= 0 && this.city?.owner !== this.me) this.selCity = -1
    this.save()
    this.refresh()
    if (s.over) this.gameOver()
    else if (!wasMine && this.myTurn) this.turnStarts()
    return h
  }

  /**
   * Souběh při souběžných tazích: hostitel zařadil cizí příkaz před naše nepotvrzené. Nový příkaz provedeme
   * i tady a ověříme, že na pořadí nezáleželo; pokud ano, platí stav přepočítaný v hostitelově pořadí.
   */
  private async replay(base: string, confirmed: { pid: number; cmd: Command }[], pending: Command[], seat: number): Promise<void> {
    for (let k = 0; this.busy && k < 400; k++) await new Promise(r => window.setTimeout(r, 25))
    if (!this.inGame || !confirmed.length) return
    const live = this.state
    const wasMine = this.myTurn
    const last = confirmed[confirmed.length - 1]
    exec(live, last.pid, last.cmd)
    const s = deserialize(base)
    if (!s) return
    for (const c of confirmed) exec(s, c.pid, c.cmd)
    for (const c of pending) exec(s, seat, c)
    drainEvents()
    if (stateHash(s) !== stateHash(live)) { this.netLoad(serialize(s), seat, false, true); return }
    if (this.selUnit >= 0 && !this.unit) this.selUnit = -1
    if (this.selCity >= 0 && this.city?.owner !== this.me) this.selCity = -1
    this.scene.ensureUnitViews(); this.scene.syncUnits()
    this.refresh()
    if (live.over) this.gameOver()
    else if (!wasMine && this.myTurn) this.turnStarts()
  }

  /** V síťové hře přišel místní hráč na řadu. */
  private turnStarts(): void {
    sfx('turn')
    this.hud.toast('Jste na tahu.')
    const n = this.idleUnits()[0]
    if (n && !this.hud.modalOpen) this.select(n, true)
    if (!this.hud.modalOpen) this.showPopups()
    this.hud.checkOffers()
  }

  /** Hostitel může ukončit tah hráče, kterému vypadlo spojení. */
  get canForceEnd(): boolean {
    const net = this.net
    return !!net && net.role === 'host' && net.started && !this.myTurn && !this.state.over && this.offlineActor >= 0 && net.idle
  }

  /** Hráč, který je na tahu a nemá spojení (-1 = nikdo takový). */
  get offlineActor(): number {
    const net = this.net
    return net ? actors(this.state).find(a => !net.online(a)) ?? -1 : -1
  }

  forceEnd(): void {
    const net = this.net
    if (!this.canForceEnd || !net || net.role !== 'host' || this.busy) return
    const pid = this.offlineActor
    const cmd: Command = { t: 'endTurn' }
    void this.remote(pid, cmd, false, () => net.local(pid, cmd, stateHash(this.state)))
  }

  /** Ukončí síťové sezení (hostitel tím hru pro ostatní zavře, uložená mu zůstane). */
  leaveNet(): void {
    const net = this.net
    if (!net) return
    this.net = null
    this.netCfg = null
    net.close()
  }

  /** Předání počítače dalšímu hráči: zakryje mapu a po potvrzení přepne pohled. */
  private handover(then?: () => void): void {
    this.selUnit = -1; this.selCity = -1
    this.hud.showHandover(this.state.cur, () => { this.takeSeat(); then?.() })
  }

  /** Hráč na tahu usedá k počítači: mapa, mlha a zprávy se přepnou na něj. */
  private takeSeat(): void {
    this.me = this.state.cur
    this.selUnit = -1; this.selCity = -1
    const go = () => {
      this.scene.reset()
      this.focusHome()
      this.refresh()
      this.showPopups()
      this.hud.checkOffers()
    }
    if (this.scene.scene.isActive()) go()
    else this.scene.events.once('ready', go)
  }

  private focusHome(): void {
    const s = this.state
    const cap = citiesOf(s, this.me).find(c => c.capital) ?? citiesOf(s, this.me)[0]
    const first = cap ? this.idleUnits()[0] : unitsOf(s, this.me).find(v => v.type === 'settler') ?? unitsOf(s, this.me)[0]
    if (first) this.selUnit = first.id
    const at = first && !cap ? first : cap
    if (at) this.scene.centerOn(at.x, at.y, false)
  }

  /** Ukáže okna určená místnímu hráči (nový věk apod.). */
  private showPopups(): void {
    const s = this.state
    const pop = s.popups.find(o => o.pid === this.me)
    if (!pop) return
    s.popups = s.popups.filter(o => o.pid !== this.me)
    this.hud.showPopup(pop.title, pop.text)
  }

  private begin(s: GameState, then?: () => void): void {
    this.state = s
    this.me = this.net ? Math.max(0, this.net.seat) : s.players[s.cur]?.human ? s.cur : 0
    this.inGame = true
    this.selUnit = -1; this.selCity = -1
    drainEvents()
    const go = () => {
      this.scene.reset()
      const cap = citiesOf(s, this.me).find(c => c.capital) ?? citiesOf(s, this.me)[0]
      const u = unitsOf(s, this.me)[0]
      if (cap) this.scene.centerOn(cap.x, cap.y, false)
      else if (u) this.scene.centerOn(u.x, u.y, false)
      this.hud.enterGame()
      const first = unitsOf(s, this.me).find(v => v.type === 'settler')
      if (first && !cap) this.select(first)
      this.refresh()
      then?.()
    }
    if (this.scene.scene.isActive()) go()
    else this.scene.events.once('ready', go)
  }

  quitToMenu(): void {
    this.inGame = false
    this.leaveNet()
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
    this.reach.clear(); this.targets.clear(); this.pm = null; this.gotoEta = -1; this.jobs.clear(); this.sites.clear()
    if (!this.unit || this.unit.type !== 'worker') this.roadMode = false
    const u = this.unit
    const c = this.city
    if (c && c.owner === this.me) {
      this.scene.showWorked(c.worked, cityWorkable(this.state, c))
      this.scene.showCityRing(c.x, c.y)
      this.scene.showWorked(c.worked, cityWorkable(this.state, c))
      return
    }
    if (!u || u.owner !== this.me) { this.selUnit = -1; this.scene.showSelection(null, [], []); return }
    const s = this.state
    for (const i of reachable(s, u)) if (s.players[this.me].explored[i]) this.reach.add(i)
    const d = UNITS[u.type]
    for (const [x, y] of tilesWithin(s, u.x, u.y, d.ranged ? d.range! : 1)) {
      const pv = previewAttack(s, u, x, y)
      if (pv && s.players[this.me].visible[idx(s, x, y)]) { this.targets.add(idx(s, x, y)); this.reach.delete(idx(s, x, y)) }
    }
    this.pm = pathMap(s, u, undefined, s.players[this.me])
    this.scene.showSelection(u, [...this.reach], [...this.targets])
    if (this.hints && u.type === 'worker' && !u.work) {
      let best = -1, bv = -Infinity
      for (let i = 0; i < s.tiles.length; i++) {
        if (s.tiles[i].owner !== this.me || !s.players[this.me].explored[i]) continue
        const j = tileJobs(s, i, this.me).find(o => o.ok && o.job !== 'road')
        if (!j || this.pm.dist[i] === Infinity) continue
        this.jobs.set(i, j.job)
        // Nejvíc se vyplatí surovina a pole, které město už obdělává; blízkost rozhoduje při shodě.
        const v = (s.tiles[i].res ? 6 : 0) + (s.cities.some(c => c.owner === this.me && c.worked.includes(i)) ? 4 : 0) - this.pm.dist[i] * 1.2
        if (v > bv) { bv = v; best = i }
      }
      this.scene.showJobs([...this.jobs].map(([i, job]) => ({ i, job })), best)
    }
    if (this.hints && u.type === 'settler') {
      // Nejlepší známá místa v dosahu několika tahů, dost daleko od sebe.
      const cand: [number, number][] = []
      for (let i = 0; i < s.tiles.length; i++) {
        if (!s.players[this.me].explored[i] || this.pm.dist[i] === Infinity || this.pm.dist[i] > 12) continue
        const sc = siteScore(s, this.me, i % s.W, (i / s.W) | 0)
        // Vzdálenější místo musí být o to lepší; pole, kde osadníci stojí, má malou výhodu.
        if (sc >= 44) cand.push([i, sc - this.pm.dist[i] * 1.2 + (this.pm.dist[i] === 0 ? 2 : 0)])
      }
      cand.sort((a, b) => b[1] - a[1])
      const picked: number[] = []
      for (const [i] of cand) {
        if (picked.length >= 5) break
        if (picked.some(j => hexDist(i % s.W, (i / s.W) | 0, j % s.W, (j / s.W) | 0) < 3)) continue
        picked.push(i)
        this.sites.set(i, siteScore(s, this.me, i % s.W, (i / s.W) | 0))
      }
      this.scene.showSites(picked.map((i, k) => ({ i, best: k === 0 })), s.players[this.me].nation)
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
    if (this.busy || this.state.over || !this.myTurn) return
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
    this.save()
    this.refresh()
    if (this.state.over) this.gameOver()
    // Po předání tahu si hráč svá okna přečte, až zase usedne k počítači.
    else if (this.myTurn) this.showPopups()
  }

  private gameOver(): void {
    if (!this.net || this.net.role === 'host') { clearSave(); store.del(NET_KEY) }
    seatStore.del()
    const o = this.state.over!
    // U jednoho počítače patří závěrečná obrazovka vítězi.
    if (this.hotseat && this.state.players[o.winner]?.human && this.me !== o.winner) { this.me = o.winner; this.scene.reset(); this.refresh() }
    sfx(o.won && o.winner === this.me ? 'fanfare' : 'defeat')
    this.hud.showGameOver()
  }

  onTileClick(x: number, y: number, right: boolean, shift = false): void {
    if (this.busy || !this.inGame || this.hud.modalOpen || this.state.over || (!this.myTurn && !this.net)) return
    const s = this.state
    const i = idx(s, x, y)
    // Mimo svůj tah si hráč síťové hry může jen prohlížet a vybírat.
    const u = this.myTurn ? this.unit : undefined
    if (u && this.roadMode) {
      this.roadMode = false
      if (right) { this.refresh(); return }
      if (!this.pm || !pathTo(s, this.pm, x, y)) { sfx('error'); this.hud.toast('Tam dělníci cestu nedovedou.'); this.refresh(); return }
      sfx('build')
      void this.run(() => { this.cmd({ t: 'roadTo', unit: u.id, x, y }) }).then(() => { this.hud.toast('Dělníci postaví cestu až na označené pole.'); this.autoAdvance() })
      return
    }
    if (u) {
      if (this.targets.has(i)) { this.orderAttack(u, x, y); return }
      // Osadníci: klik na doporučené místo = dojít tam a založit město.
      if (u.type === 'settler' && this.sites.has(i) && !right && !shift && !(u.x === x && u.y === y)) {
        sfx('build')
        void this.run(() => { this.cmd({ t: 'move', unit: u.id, x, y, todo: 'found' }) }).then(() => {
          const c = cityAt(s, x, y)
          if (c && c.owner === this.me && !this.unit) { this.selCity = c.id; this.refresh() }
          else { this.hud.toast('Osadníci vyrazili a na místě založí město.'); this.autoAdvance() }
        })
        return
      }
      // Dělníci: klik na pole se zelenou značkou = dojít tam a postavit vylepšení.
      const job = this.jobs.get(i)
      if (job && !right && !shift && !(u.x === x && u.y === y)) {
        sfx('build')
        void this.run(() => { this.cmd({ t: 'move', unit: u.id, x, y, todo: job as JobId }) }).then(() => { const v = this.unit; if (v && (v.work || v.moves <= 0 || v.goto)) this.autoAdvance() })
        return
      }
      // Levé tlačítko pošle jednotku i na vzdálené pole; na poli s vlastní jednotkou či městem místo toho vybírá.
      const own = unitsAt(s, x, y).some(o => o.owner === this.me) || cityAt(s, x, y)?.owner === this.me
      if (!(u.x === x && u.y === y) && (right || shift || this.reach.has(i) || !own)) { this.orderMove(u, x, y, shift); return }
    }
    if (right) return
    // Výběr: postupně voják, civilista, město.
    const mine = unitsAt(s, x, y).filter(o => o.owner === this.me).sort((a, b) => Number(isCivilian(a)) - Number(isCivilian(b)))
    const c = cityAt(s, x, y)
    const opts: (Unit | City)[] = [...mine]
    if (c && c.owner === this.me) opts.push(c)
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
      const r = this.cmd({ t: 'waypoint', unit: u.id, x, y })
      if (!r.ok) { sfx('error'); if (r.text) this.hud.toast(r.text); return }
      sfx('click'); this.hud.toast(`Průjezdní bod ${u.way.length} přidán do fronty rozkazů.`)
      this.commit()
      return
    }
    if (!this.pm || !pathTo(s, this.pm, x, y)) { sfx('error'); this.hud.toast('Tam se jednotka nedostane.'); return }
    void this.run(() => { this.cmd({ t: 'move', unit: u.id, x, y }) }).then(() => {
      const v = this.unit
      if (v && v.goto && this.gotoEta > 0) this.hud.toast(`${UNITS[v.type].name}: na cestě, dorazí za ${this.gotoEta} ${this.gotoEta === 1 ? 'tah' : this.gotoEta < 5 ? 'tahy' : 'tahů'}.`)
      if (v && v.moves <= 0) this.autoAdvance()
    })
  }

  private orderAttack(u: Unit, x: number, y: number): void {
    const s = this.state
    const pv = previewAttack(s, u, x, y)
    if (!pv) return
    const go = (war = false) => void this.run(() => { this.cmd({ t: 'attack', unit: u.id, x, y, war }) }).then(() => { const v = this.unit; if (!v || v.moves <= 0) this.autoAdvance() })
    if (pv.needWar >= 0) {
      const n = NATIONS[s.players[pv.needWar].nation]
      this.hud.confirm(`Vyhlásit válku?`, `Útok na národ ${n.name} znamená válku. ${n.leader} vám to jen tak nezapomene.`, 'Vyhlásit válku', () => {
        go(true)
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
    return unitsOf(this.state, this.me).filter(u => u.moves > 0 && !u.skip && !u.sleep && !u.fortified && !u.work && !u.goto && !u.auto && !u.roadTo)
  }

  attention(): Attention {
    const s = this.state
    const cs = citiesOf(s, this.me), p = this.player
    if (cs.length && !p.research && availableTechs(p).length) return { kind: 'research' }
    if (cs.length && traditionReady(p)) return { kind: 'tradition' }
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
    if (!this.myTurn) {
      if (this.canForceEnd) {
        const p = this.state.players[this.offlineActor]
        this.hud.confirm('Ukončit tah za hráče?', `${this.seatName(p.id) || 'Hráč'} nemá spojení. Národ ${NATIONS[p.nation].name} tento tah nic dalšího neudělá a hra půjde dál; vrátit se do ní dá kdykoli stejným kódem.`, 'Ukončit tah', () => this.forceEnd())
      }
      return
    }
    const a = force ? { kind: 'end' as const } : this.attention()
    sfx('click')
    if (a.kind === 'research') this.hud.showTech()
    else if (a.kind === 'tradition') this.hud.showTraditions()
    else if (a.kind === 'city') this.openCity(a.city)
    else if (a.kind === 'unit') this.select(a.unit, true)
    else this.endTurn()
  }

  endTurn(): void {
    if (this.busy || this.state.over || !this.myTurn) return
    this.selCity = -1
    sfx('turn')
    this.hud.setWaiting(true)
    this.hud.markNotesRead()
    void this.run(() => { this.cmd({ t: 'endTurn' }) }, true).then(() => {
      this.hud.setWaiting(false)
      if (this.state.over) return
      // Na řadě je další hráč: po síti jen čekáme, u téhož počítače se předává místo.
      if (!this.myTurn) { if (this.net) this.refresh(); else this.handover(); return }
      const u = this.unit
      if (!u || u.moves <= 0) { const n = this.idleUnits()[0]; if (n) this.select(n, true) }
      this.hud.checkOffers()
    })
  }

  unitAction(a: string): void {
    const u = this.unit
    if (!u || this.busy || !this.myTurn) return
    const s = this.state
    const unit = u.id
    if (a === 'found') {
      const err = canFoundCity(s, u)
      if (err) { sfx('error'); this.hud.toast(err); return }
      void this.run(() => { const r = this.cmd({ t: 'found', unit }); if (r.city !== undefined) { this.selUnit = -1; this.selCity = r.city } })
      return
    }
    if (a.startsWith('imp:')) {
      const job = a.slice(4) as ImprovementId | 'road'
      if (this.cmd({ t: 'work', unit, job }).ok) { sfx('build'); this.hud.toast(`${job === 'road' ? 'Cesta' : IMPROVEMENTS[job].name}: hotovo za ${u.workLeft} tahy.`); this.save(); this.autoAdvance(); this.refresh() }
      return
    }
    if (a === 'roadto') { this.roadMode = !this.roadMode; sfx('click'); if (this.roadMode) this.hud.toast('Klikněte na pole, kam má cesta vést (pravé tlačítko ruší).'); this.refresh(); return }
    if (a.startsWith('promo:')) {
      if (this.cmd({ t: 'promo', unit, id: a.slice(6) as PromoId }).ok) { sfx('quest'); this.commit() }
      return
    }
    if (a === 'upgradeall') {
      // Přezbrojí všechny jednotky téhož druhu, u kterých to právě jde a na které stačí zlato.
      void this.run(() => { this.cmd({ t: 'upgrade', unit, all: true }) })
      return
    }
    if (a === 'upgrade') {
      const err = upgradeBlock(s, u)
      if (err) { sfx('error'); this.hud.toast(err); return }
      void this.run(() => { this.cmd({ t: 'upgrade', unit }) })
      return
    }
    if (a === 'disband') {
      this.hud.confirm('Rozpustit jednotku?', `${UNITS[u.type].name}: jednotka bude nenávratně rozpuštěna.`, 'Rozpustit', () => {
        void this.run(() => { this.cmd({ t: 'disband', unit }) })
      })
      return
    }
    if (a !== 'auto' && a !== 'fortify' && a !== 'sleep' && a !== 'skip' && a !== 'wake') return
    if (!this.cmd({ t: 'order', unit, o: a }).ok) return
    if (a === 'wake') { this.commit(); return }
    if (a === 'auto') this.hud.toast(u.type === 'worker' ? 'Dělníci budou sami vylepšovat pole. Zrušíte tlačítkem Probudit.' : 'Jednotka bude sama zkoumat mapu. Zrušíte tlačítkem Probudit.')
    sfx('click')
    this.save()
    this.autoAdvance()
    this.refresh()
  }

  /** Přidá položku do výroby města: na konec fronty, s `front` hned na řadu. */
  chooseBuild(c: City, it: BuildItem, front = false): void {
    const r = this.cmd({ t: 'build', city: c.id, item: it, front })
    if (!r.ok) { sfx('error'); if (r.text) this.hud.toast(r.text); return }
    sfx('build')
    this.commit()
  }

  queueRemove(c: City, i: number): void { if (this.cmd({ t: 'unqueue', city: c.id, i }).ok) { sfx('click'); this.commit() } }
  queuePromote(c: City, i: number): void { if (this.cmd({ t: 'promote', city: c.id, i }).ok) { sfx('build'); this.commit() } }

  toggleHints(on = !this.hints): void {
    this.hints = on
    try { localStorage.setItem('hex4x-hints', on ? '1' : '0') } catch { /* bez úložiště */ }
    sfx('click')
    this.hud.toast(on ? 'Tipy zapnuty: žárovka označuje doporučenou volbu.' : 'Tipy vypnuty. Zapnete je žárovkou v horní liště (klávesa I).')
    this.refresh()
  }

  advise(c: City): void {
    if (!this.cmd({ t: 'advise', city: c.id }).ok) return
    sfx('build')
    this.commit()
  }

  buyNow(c: City): void {
    void this.run(() => { sfx(this.cmd({ t: 'buy', city: c.id }).ok ? 'found' : 'error') })
  }

  chooseTradition(id: TraditionId): void {
    if (!this.cmd({ t: 'tradition', id }).ok) { sfx('error'); return }
    sfx('quest')
    this.commit()
  }

  /** Zvolí výzkum; u vzdálené technologie naplánuje celou cestu k ní. S `append` se zařadí za dosavadní plán. */
  chooseTech(t: TechId, append = false): void {
    if (!this.cmd({ t: 'research', tech: t, append }).ok) return
    sfx('build')
    this.commit()
  }

  /** Přehraje zvuky, které příkaz vyvolal (bez animací). */
  private sounds(): void { for (const ev of drainEvents()) if (ev.e === 'sound') sfx(ev.id) }

  proposePeace(pid: number): string {
    if (!atWar(this.state, this.me, pid)) return ''
    const r = this.cmd({ t: 'peace', vs: pid })
    sfx(r.ok ? 'quest' : 'error')
    this.commit()
    return r.text ?? ''
  }

  declare(pid: number): void {
    this.cmd({ t: 'war', vs: pid })
    this.sounds()
    this.commit()
  }

  /** Diplomatická akce hráče; vrací odpověď soupeře. */
  diplo(kind: string, pid: number, arg: string): string {
    const r = this.cmd({ t: 'diplo', kind: kind as 'gift' | 'sell' | 'buy' | 'ally', vs: pid, arg })
    this.sounds()
    sfx(r.ok ? 'quest' : 'error')
    this.commit()
    return r.text ?? ''
  }

  answerOffer(from: number, accept: boolean): void {
    this.cmd({ t: 'answer', from, accept })
    this.sounds()
    this.commit()
  }

  /** Rada rádce přečtena. */
  tipRead(id: string): void { this.cmd({ t: 'tip', id }); this.commit() }

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
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // V menu jde klávesou jen zavřít otevřené okno (návod, encyklopedie).
    if (!this.inGame) { if (e.key === 'Escape' && this.hud.modalOpen) this.hud.closeModal(); return }
    if (this.hud.modalOpen) { if (e.key === 'Escape') this.hud.closeModal(); return }
    const k = e.key.toLowerCase()
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.mainAction(e.shiftKey); return }
    if (e.key === 'Escape') { if (this.roadMode) this.roadMode = false; else { this.selUnit = -1; this.selCity = -1 } this.refresh(); return }
    if (k === 'n' || e.key === 'Tab') { e.preventDefault(); const a = this.idleUnits(); if (a.length) { const cur = a.findIndex(u => u.id === this.selUnit); const to = e.shiftKey ? (cur < 0 ? a.length - 1 : cur + a.length - 1) : cur + 1; this.select(a[to % a.length], true) } return }
    if (k === 't') { this.hud.showTech(); return }
    if (k === 'c') { this.hud.showTraditions(); return }
    if (k === 'l') { this.hud.toggleOverview(); return }
    if (k === 'i') { this.toggleHints(); return }
    if (k === 'm') { this.hud.showMission(); return }
    if (k === 'k') { this.hud.showPedia(); return }
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
