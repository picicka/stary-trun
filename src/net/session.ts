// Síťová hra bez serveru: jeden hráč hru hostí, ostatní se k němu připojí napřímo.
// Všichni drží celý stav hry a provádějí stejné příkazy ve stejném pořadí. Pořadí určuje hostitel:
// příkaz očísluje ve chvíli, kdy ho sám provede, a rozešle všem (i odesílateli jako potvrzení).
// Hráč své příkazy provádí hned; táhne-li zároveň někdo další a hostitel jeho příkaz zařadil dřív,
// hráč si stav přepočítá v hostitelově pořadí. Při neshodě pošle hostitel svůj stav.
// Vrstva nezná prohlížeč ani způsob spojení.
import type { Command } from '../game/commands.ts'
import { PLAYABLE, type NationId } from '../game/data.ts'

export type Msg =
  | { t: 'hello'; name: string; token: string; v: string }
  | { t: 'pick'; nation: NationId }
  /** Od hráče bez čísla (`n` = 0); od hostitele s pořadím `n` a hráčem `pid`. */
  | { t: 'cmd'; n: number; pid?: number; cmd: Command }
  | { t: 'hash'; n: number; h: string }
  | { t: 'resync' }
  | { t: 'leave' }
  | { t: 'lobby'; lobby: Lobby }
  | { t: 'start'; state: string; seat: number; n: number; first: boolean }
  | { t: 'deny'; why: string }
  | { t: 'bye' }
  /** Zpráva v chatu a zazvonění na ostatní; `from` doplňuje hostitel. */
  | { t: 'chat'; from?: number; text: string }
  | { t: 'ring'; from?: number }

/** Jedno spojení mezi hostitelem a hráčem. */
export interface Link {
  send(m: Msg): void
  close(): void
  onMessage: (m: Msg) => void
  onClose: () => void
}

/** Hostitelův konec: přijímá nová spojení. */
export interface HostEnd {
  onLink: (l: Link) => void
  close(): void
}

export interface Member { name: string; nation: NationId; online: boolean; host: boolean }

/** Místnost, jak ji vidí jeden hráč (`you` = jeho pořadí, zároveň číslo hráče ve hře). */
export interface Lobby { code: string; info: string; max: number; members: Member[]; /** Národy soupeřů vedených počítačem, které přidal hostitel; každý zabírá jedno místo. */ bots: NationId[]; you: number; started: boolean }

/** Co síťová vrstva potřebuje od hry. */
export interface NetGame {
  /**
   * Provede příkaz jiného hráče (včetně animace). S `hashed` vrátí otisk stavu hned po provedení –
   * než animace doběhne, může už místní hráč táhnout sám.
   */
  apply(pid: number, cmd: Command, hashed: boolean, at?: () => void): Promise<string>
  snapshot(): string
  /** Otisk současného stavu. */
  hash(): string
  /**
   * Souběh: mezi vlastní nepotvrzené příkazy `pending` zařadil hostitel cizí příkaz. Stav se přepočítá ze
   * snímku `base` v hostitelově pořadí (`confirmed`, poslední je ten nový) a pak se znovu provedou vlastní.
   */
  replay(base: string, confirmed: { pid: number; cmd: Command }[], pending: Command[], seat: number): Promise<void>
  /** Nahradí stav hry stavem od hostitele; `first` = hra právě začala. */
  load(json: string, seat: number, first: boolean): void
}

export interface NetEvents {
  /** Změnila se místnost (hráči, národy, kdo je připojen). */
  lobby(l: Lobby): void
  /** Krátká zpráva pro hráče (někdo se připojil, spojení vypadlo…). */
  status(text: string): void
  /** Hra po síti skončila a nejde v ní pokračovat. */
  closed(why: string): void
  /** Zpráva od jiného hráče. */
  chat(from: number, text: string): void
  /** Jiný hráč zvoní. */
  ring(from: number): void
  /** Hostitel: hráč se vrátil do běžící hry (ještě než dostane stav). */
  rejoined(seat: number): void
}

/** Uložená sestava hráčů, aby šla rozehraná hra znovu hostit. */
export interface SavedSeat { token: string; name: string; nation: NationId }

interface Peer extends SavedSeat { link: Link | null; ready: boolean; pending: Msg[] }

export class HostSession {
  readonly role = 'host' as const
  readonly seat = 0
  readonly code: string
  started = false
  private peers: Peer[]
  private bots: NationId[] = []
  /** Pořadí posledního provedeného příkazu a počet přijatých, které na provedení čekají. */
  private seq = 0
  private queued = 0
  private chain: Promise<void> = Promise.resolve()
  private end: HostEnd
  private max: number
  private info: string
  private version: string
  private game: NetGame
  private ev: NetEvents

  constructor(end: HostEnd, o: { code: string; name: string; token: string; max: number; info: string; version: string; resume?: SavedSeat[] }, game: NetGame, ev: NetEvents) {
    this.end = end; this.code = o.code; this.max = o.max; this.info = o.info; this.version = o.version; this.game = game; this.ev = ev
    const blank = { link: null, ready: false, pending: [] }
    if (o.resume) { this.peers = o.resume.map(m => ({ ...m, ...blank, pending: [] })); this.started = true }
    else this.peers = [{ token: o.token, name: o.name, nation: PLAYABLE[0], ...blank }]
    end.onLink = l => this.accept(l)
  }

  get ready(): boolean { return this.started }
  /** Nečeká na provedení žádný cizí příkaz. */
  get idle(): boolean { return this.queued === 0 }
  online(seat: number): boolean { return seat === 0 || !!this.peers[seat]?.link }
  seats(): SavedSeat[] { return this.peers.map(p => ({ token: p.token, name: p.name, nation: p.nation })) }

  lobby(you = 0): Lobby {
    return { code: this.code, info: this.info, max: this.max, started: this.started, you, bots: this.bots.slice(), members: this.peers.map((p, i) => ({ name: p.name, nation: p.nation, online: this.online(i), host: i === 0 })) }
  }

  private announce(): void {
    this.peers.forEach((p, i) => p.link?.send({ t: 'lobby', lobby: this.lobby(i) }))
    this.ev.lobby(this.lobby())
  }

  /** Změna nastavení hry, dokud se čeká v místnosti. */
  setInfo(info: string, max: number): void { this.info = info; this.max = max; this.announce() }

  pick(nation: NationId, seat = 0): void {
    if (this.started || this.bots.includes(nation) || this.peers.some((p, i) => i !== seat && p.nation === nation)) return
    this.peers[seat].nation = nation
    this.announce()
  }

  /** První národ, který nemá žádný hráč ani počítač (hledá se od `from`). */
  private freeNation(from = 0): NationId | undefined {
    for (let k = 0; k < PLAYABLE.length; k++) {
      const n = PLAYABLE[(from + k) % PLAYABLE.length]
      if (!this.bots.includes(n) && !this.peers.some(p => p.nation === n)) return n
    }
    return undefined
  }

  /** Hostitel přidá soupeře vedeného počítačem na volné místo. */
  addBot(): void {
    const n = this.freeNation()
    if (this.started || !n || this.peers.length + this.bots.length >= this.max) return
    this.bots.push(n)
    this.announce()
  }

  removeBot(i: number): void {
    if (this.started || i < 0 || i >= this.bots.length) return
    this.bots.splice(i, 1)
    this.announce()
  }

  /** Dá soupeři další volný národ v pořadí. */
  cycleBot(i: number): void {
    if (this.started || i < 0 || i >= this.bots.length) return
    const n = this.freeNation(PLAYABLE.indexOf(this.bots[i]) + 1)
    if (!n) return
    this.bots[i] = n
    this.announce()
  }

  private accept(link: Link): void {
    link.onMessage = m => this.recv(link, m)
    link.onClose = () => this.drop(link)
  }

  private recv(link: Link, m: Msg): void {
    const seat = this.peers.findIndex(p => p.link === link)
    if (m.t === 'hello') {
      if (m.v !== this.version) { this.deny(link, 'Hostitel má jinou verzi hry. Obnovte oba stránku a zkuste to znovu.'); return }
      let i = this.peers.findIndex((p, k) => k > 0 && p.token === m.token)
      if (i < 0) {
        if (this.started) { this.deny(link, 'Tato hra už běží a nové hráče nepřijímá.'); return }
        if (this.peers.length + this.bots.length >= this.max) { this.deny(link, 'Hra je plná.'); return }
        const free = this.freeNation()!
        i = this.peers.push({ token: m.token, name: m.name.slice(0, 20) || 'Hráč', nation: free, link: null, ready: false, pending: [] }) - 1
      }
      const p = this.peers[i]
      // Totéž místo z nového spojení (obnovená stránka): staré zavřít bez povyku.
      // Starému oknu se řekne, ať se nevrací – jinak by se obě přetahovala o jedno místo.
      if (p.link && p.link !== link) this.deny(p.link, 'Na vaše místo ve hře se připojilo jiné okno.')
      p.link = link
      this.ev.status(`${p.name}: ${this.started ? 'znovu ve hře' : 'v místnosti'}.`)
      this.announce()
      if (this.started) { this.ev.rejoined(i); this.sync(p, false) }
      return
    }
    if (seat < 1) return
    const p = this.peers[seat]
    if (m.t === 'pick') this.pick(m.nation, seat)
    else if (m.t === 'leave') { link.close(); this.drop(link) }
    else if (m.t === 'resync') { if (this.started) this.sync(p, false) }
    else if (m.t === 'chat') { const text = m.text.slice(0, CHAT_MAX).trim(); if (text) { this.ev.chat(seat, text); this.tell({ t: 'chat', from: seat, text }, seat) } }
    else if (m.t === 'ring') { this.ev.ring(seat); this.tell({ t: 'ring', from: seat }, seat) }
    else if (m.t === 'cmd') {
      if (!this.started || !p.ready) return
      this.queued += 1
      this.chain = this.chain.then(async () => {
        const turn = m.cmd.t === 'endTurn'
        let n = 0
        // Pořadí dostane příkaz až ve chvíli provedení – mezitím mohl hostitel táhnout sám.
        const h = await this.game.apply(seat, m.cmd, turn, () => { n = ++this.seq; this.relay({ t: 'cmd', n, pid: seat, cmd: m.cmd }, -1) })
        // Na konci tahu si všichni porovnají otisk stavu s hostitelovým.
        if (turn && n) this.relay({ t: 'hash', n, h }, 0)
      }).catch(e => console.error(e)).then(() => { this.queued -= 1 })
    }
  }

  private deny(link: Link, why: string): void {
    link.send({ t: 'deny', why })
    link.onClose = () => {}
    link.onMessage = () => {}
  }

  /** Zprávy mimo hru (chat, zvonek) jdou hned všem připojeným. */
  private tell(m: Msg, except: number): void {
    this.peers.forEach((p, i) => { if (i !== except) p.link?.send(m) })
  }

  say(text: string): void { this.tell({ t: 'chat', from: 0, text: text.slice(0, CHAT_MAX) }, 0) }
  ring(): void { this.tell({ t: 'ring', from: 0 }, 0) }

  private relay(m: Msg, except: number): void {
    this.peers.forEach((p, i) => {
      if (i === except || !p.link) return
      if (p.ready) p.link.send(m)
      else p.pending.push(m)
    })
  }

  /** Pošle hráči celý stav hry; příkazy přijaté mezitím dostane hned po něm. */
  private sync(p: Peer, first: boolean): void {
    p.ready = false
    p.pending = []
    this.chain = this.chain.then(() => {
      if (!p.link || p.ready) return
      p.link.send({ t: 'start', state: this.game.snapshot(), seat: this.peers.indexOf(p), n: this.seq, first })
      for (const m of p.pending) if ((m.t === 'cmd' || m.t === 'hash') && m.n > this.seq) p.link.send(m)
      p.pending = []
      p.ready = true
    }).catch(e => console.error(e))
  }

  private drop(link: Link): void {
    const i = this.peers.findIndex(p => p.link === link)
    if (i < 1) return
    const p = this.peers[i]
    p.link = null; p.ready = false; p.pending = []
    if (!this.started) this.peers.splice(i, 1)
    this.ev.status(`${p.name}: ${this.started ? 'spojení vypadlo' : 'odešel z místnosti'}.`)
    this.announce()
  }

  /** Hra začíná: stav už je v hostitelově hře, ostatní ho dostanou. */
  start(): void {
    this.started = true
    this.seq = 0
    this.announce()
    for (const p of this.peers.slice(1)) this.sync(p, true)
  }

  /** Příkaz provedený u hostitele (jeho vlastní, nebo ukončení tahu za odpojeného hráče). */
  local(pid: number, cmd: Command, h?: string): void {
    this.seq += 1
    this.relay({ t: 'cmd', n: this.seq, pid, cmd }, 0)
    if (h) this.relay({ t: 'hash', n: this.seq, h }, 0)
  }

  /** Hostitel nic nepředpovídá: jeho stav je ten platný. */
  predict(): void {}

  close(): void {
    for (const p of this.peers) if (p.link) { p.link.onClose = () => {}; p.link.send({ t: 'bye' }) }
    // Rozloučení musí stihnout odejít, než spojení zanikne.
    setTimeout(() => this.end.close(), 300)
  }
}

export class ClientSession {
  readonly role = 'client' as const
  seat = -1
  started = false
  /** Hra běží a stav souhlasí s hostitelem. */
  ready = false
  view: Lobby | null = null
  private n = 0
  /** Vlastní příkazy, které hostitel ještě nepotvrdil. */
  private pend: Command[] = []
  /** Snímek stavu před prvním nepotvrzeným příkazem a příkazy, které hostitel od té doby potvrdil (pro přepočet při souběhu). */
  private base: string | null = null
  private log: { pid: number; cmd: Command }[] = []
  /** Vlastní otisky stavu po koncích tahů (podle pořadí příkazu), dokud nepřijde hostitelův. */
  private hashes = new Map<number, string>()
  private chain: Promise<void> = Promise.resolve()
  private link: Link | null = null
  private stopped = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private connect: () => Promise<Link>
  private me: { name: string; token: string; version: string }
  private game: NetGame
  private ev: NetEvents
  /** Za jak dlouho zkusit ztracené spojení navázat znovu (ms). */
  retryMs = 3000

  constructor(connect: () => Promise<Link>, me: { name: string; token: string; version: string }, game: NetGame, ev: NetEvents) {
    this.connect = connect; this.me = me; this.game = game; this.ev = ev
  }

  get connected(): boolean { return !!this.link }
  online(seat: number): boolean { return this.view?.members[seat]?.online ?? true }
  lobby(): Lobby | null { return this.view }

  /** Naváže spojení a ohlásí se; chyba znamená, že hra s tímto kódem není dostupná. */
  async open(): Promise<void> {
    const link = await this.connect()
    if (this.stopped) { link.close(); return }
    this.link = link
    link.onMessage = m => this.recv(m)
    link.onClose = () => this.lost()
    link.send({ t: 'hello', name: this.me.name, token: this.me.token, v: this.me.version })
  }

  private recv(m: Msg): void {
    if (this.stopped) return
    if (m.t === 'lobby') { this.view = m.lobby; this.seat = m.lobby.you; this.ev.lobby(m.lobby) }
    else if (m.t === 'deny') this.finish(m.why)
    else if (m.t === 'bye') this.finish('Hostitel hru ukončil.')
    else if (m.t === 'chat') this.ev.chat(m.from ?? 0, m.text)
    else if (m.t === 'ring') this.ev.ring(m.from ?? 0)
    else if (m.t === 'start') {
      this.chain = this.chain.then(() => {
        this.seat = m.seat; this.n = m.n; this.started = true; this.ready = true
        this.hashes.clear(); this.pend = []; this.base = null; this.log = []
        this.game.load(m.state, m.seat, m.first)
      }).catch(e => console.error(e))
    } else if (m.t === 'cmd') {
      this.chain = this.chain.then(async () => {
        if (!this.ready) return
        if (m.n !== this.n + 1) { this.resync(); return }
        this.n = m.n
        const turn = m.cmd.t === 'endTurn'
        if (m.pid === this.seat && this.pend.length) {
          // Potvrzení vlastního příkazu: je proveden, jen dostal pořadí.
          const c = this.pend.shift()!
          if (this.base) this.log.push({ pid: this.seat, cmd: c })
          if (!this.pend.length) { this.base = null; this.log = []; if (turn) this.hashes.set(m.n, this.game.hash()) }
          return
        }
        if (this.pend.length) {
          // Souběh: cizí příkaz přišel na řadu před vlastními nepotvrzenými.
          if (!this.base) { this.resync(); return }
          this.log.push({ pid: m.pid!, cmd: m.cmd })
          await this.game.replay(this.base, this.log, this.pend, this.seat)
          return
        }
        const h = await this.game.apply(m.pid!, m.cmd, turn)
        if (turn) this.hashes.set(m.n, h)
      }).catch(e => console.error(e))
    } else if (m.t === 'hash') {
      this.chain = this.chain.then(() => {
        const mine = this.hashes.get(m.n)
        this.hashes.delete(m.n)
        if (this.ready && mine !== undefined && mine !== m.h) this.resync()
      }).catch(e => console.error(e))
    }
  }

  private resync(): void {
    this.ready = false
    this.link?.send({ t: 'resync' })
  }

  /**
   * Volá se těsně před provedením vlastního příkazu, pokud zároveň smí táhnout i někdo jiný:
   * uschová stav, ze kterého se dá při souběhu přepočítat hostitelovo pořadí.
   */
  predict(): void {
    if (this.ready && !this.pend.length) { this.base = this.game.snapshot(); this.log = [] }
  }

  /** Příkaz provedený místním hráčem: hostitel ho zařadí a potvrdí. */
  local(_pid: number, cmd: Command): void {
    if (!this.link || !this.ready) return
    this.pend.push(cmd)
    this.link.send({ t: 'cmd', n: 0, cmd })
  }

  pick(nation: NationId): void { this.link?.send({ t: 'pick', nation }) }
  say(text: string): void { this.link?.send({ t: 'chat', text: text.slice(0, CHAT_MAX) }) }
  ring(): void { this.link?.send({ t: 'ring' }) }

  private lost(): void {
    this.link = null
    this.ready = false
    if (this.stopped) return
    this.ev.status('Spojení s hostitelem vypadlo, zkouším ho obnovit…')
    this.retry()
  }

  private retry(): void {
    if (this.stopped) return
    this.timer = setTimeout(() => {
      this.open().then(() => { if (!this.stopped) this.ev.status('Spojení obnoveno.') }, () => this.retry())
    }, this.retryMs)
  }

  private finish(why: string): void {
    this.stop()
    this.ev.closed(why)
  }

  private stop(): void {
    this.stopped = true
    this.ready = false
    if (this.timer) clearTimeout(this.timer)
    const l = this.link
    this.link = null
    if (l) { l.onClose = () => {}; l.onMessage = () => {}; setTimeout(() => l.close(), 300) }
  }

  close(): void {
    this.link?.send({ t: 'leave' })
    this.stop()
  }
}

export type Session = HostSession | ClientSession
/** Nejdelší zpráva v chatu. */
export const CHAT_MAX = 300

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Kód místnosti: pět znaků bez těch, které se pletou (0/O, 1/I). */
export function roomCode(rnd: () => number = Math.random): string {
  let s = ''
  for (let i = 0; i < 5; i++) s += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)]
  return s
}
export function cleanCode(raw: string): string { return [...raw.toUpperCase()].filter(ch => CODE_CHARS.includes(ch)).join('').slice(0, 5) }
