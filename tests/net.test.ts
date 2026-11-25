// Síťová hra: hostitel a dva hráči spojení v paměti hrají stejnou hru a musí se shodnout na stavu.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exec, type Command } from '../src/game/commands.ts'
import { createGame, deserialize, serialize, stateHash } from '../src/game/state.ts'
import type { GameState } from '../src/game/types.ts'
import { cleanCode, ClientSession, HostSession, roomCode, type HostEnd, type Link, type Lobby, type Msg, type NetGame } from '../src/net/session.ts'

const tick = (ms = 5) => new Promise(r => setTimeout(r, ms))
/** Počká, až podmínka platí (nejdéle 2 s). */
async function until(ok: () => boolean, what = 'podmínka'): Promise<void> {
  for (let k = 0; k < 400; k++) { if (ok()) return; await tick(5) }
  assert.fail(`nedočkal jsem se: ${what}`)
}

/** Dvojice propojených konců; zprávy chodí se zpožděním a v pořadí jako po síti. */
function pair(): [Link, Link] {
  let open = true
  const mk = (): Link => ({ send: () => {}, close: () => {}, onMessage: () => {}, onClose: () => {} })
  const a = mk(), b = mk()
  const wire = (from: Link, to: Link) => {
    from.send = (m: Msg) => { const copy = JSON.parse(JSON.stringify(m)) as Msg; setTimeout(() => { if (open) to.onMessage(copy) }, 0) }
    from.close = () => { if (!open) return; open = false; setTimeout(() => { a.onClose(); b.onClose() }, 0) }
  }
  wire(a, b); wire(b, a)
  return [a, b]
}

class Seat implements NetGame {
  s: GameState | null = null
  seat = -1
  loads = 0
  log: string[] = []
  net!: HostSession | ClientSession
  lobby: Lobby | null = null
  closed = ''
  ev = { lobby: (l: Lobby) => { this.lobby = l }, status: (t: string) => { this.log.push(t) }, closed: (w: string) => { this.closed = w } }
  replays = 0
  async apply(pid: number, cmd: Command, hashed: boolean, at?: () => void) { await tick(this.lag); exec(this.s!, pid, cmd); at?.(); const h = hashed ? this.hash() : ''; await tick(1); return h }
  /** Zdržení před provedením cizího příkazu (jako když hostiteli dobíhá animace). */
  lag = 0
  async replay(base: string, confirmed: { pid: number; cmd: Command }[], pending: Command[], seat: number) {
    const s = deserialize(base)!
    for (const c of confirmed) exec(s, c.pid, c.cmd)
    for (const c of pending) exec(s, seat, c)
    this.s = s; this.replays++
  }
  hash() { return stateHash(this.s!) }
  snapshot() { return serialize(this.s!) }
  load(json: string, seat: number) { this.s = deserialize(json); this.seat = seat; this.loads++ }
  /** Místní hráč zadá příkaz. */
  cmd(c: Command) {
    this.net.predict()
    const r = exec(this.s!, this.seat, c)
    this.net.local(this.seat, c, c.t === 'endTurn' ? this.hash() : undefined)
    return r
  }
}

function room(max = 3) {
  const end: HostEnd = { onLink: () => {}, close: () => {} }
  const host = new Seat()
  host.seat = 0
  const hs = new HostSession(end, { code: 'ABCDE', name: 'Host', token: 'h', max, info: 'zkouška', version: '1' }, host, host.ev)
  host.net = hs
  const links: Link[] = []
  const join = (name: string, token = name, version = '1') => {
    const g = new Seat()
    const cs = new ClientSession(async () => { const [a, b] = pair(); links.push(a); end.onLink(b); return a }, { name, token, version }, g, g.ev)
    cs.retryMs = 80
    g.net = cs
    return { g, cs }
  }
  const all: Seat[] = [host]
  const start = async (simul = false) => {
    host.s = createGame(hs.lobby().members[0].nation, 'normal', 'valley', 77, 0, hs.lobby().members.slice(1).map(m => m.nation), { nations: 4, simul })
    hs.start()
    await until(() => all.every(g => g.s), 'všichni mají stav')
  }
  /** Všichni mají stejný stav. */
  const same = () => all.every(g => g.s) && new Set(all.map(g => g.hash())).size === 1
  const joinIn = async (name: string) => { const j = join(name); all.push(j.g); await j.cs.open(); await until(() => j.g.lobby !== null, 'místnost'); return j }
  return { host, hs, join, joinIn, start, links, same, all }
}

/** Hráč na tahu založí město (má-li osadníky), nastaví výzkum a ukončí tah. */
function playTurn(g: Seat) {
  const s = g.s!
  const settler = s.units.find(u => u.owner === g.seat && u.type === 'settler')
  if (settler) g.cmd({ t: 'found', unit: settler.id })
  const scout = s.units.find(u => u.owner === g.seat && u.type === 'scout')
  if (scout) g.cmd({ t: 'order', unit: scout.id, o: 'auto' })
  g.cmd({ t: 'endTurn' })
}

test('kód místnosti', () => {
  assert.match(roomCode(), /^[A-Z2-9]{5}$/)
  assert.equal(cleanCode(' ab-cd e9 '), 'ABCDE')
})

test('místnost: připojení, výběr národa, plná hra, jiná verze', async () => {
  const r = room(2)
  const a = r.join('Anna')
  await a.cs.open()
  await until(() => r.hs.lobby().members.length === 2 && a.g.lobby?.members.length === 2, 'Anna v místnosti')
  assert.equal(a.g.lobby!.you, 1)
  assert.notEqual(a.g.lobby!.members[1].nation, a.g.lobby!.members[0].nation)
  // Obsazený národ vybrat nejde, volný ano (zprávy jdou po jednom spojení v pořadí, druhá volba tedy přijde po první).
  a.cs.pick(r.hs.lobby().members[0].nation)
  a.cs.pick('lume')
  await until(() => r.hs.lobby().members[1].nation === 'lume' && a.g.lobby!.members[1].nation === 'lume', 'volba národa')
  assert.notEqual(r.hs.lobby().members[1].nation, r.hs.lobby().members[0].nation)
  const b = r.join('Bob')
  await b.cs.open()
  await until(() => b.g.closed !== '', 'odmítnutí plné hry')
  assert.match(b.g.closed, /plná/)
  const c = r.join('Cyril', 'c', '2')
  await c.cs.open()
  await until(() => c.g.closed !== '', 'odmítnutí jiné verze')
  assert.match(c.g.closed, /verzi/)
  // Odchod z místnosti uvolní místo.
  a.cs.close()
  await until(() => r.hs.lobby().members.length === 1, 'uvolnění místa')
})

test('tři hráči po síti hrají stejnou hru', async () => {
  const r = room()
  const a = await r.joinIn('Anna'), b = await r.joinIn('Bob')
  await r.start()
  const seats = [r.host, a.g, b.g]
  assert.deepEqual(seats.map(g => g.seat), [0, 1, 2])
  assert.equal(seats[0].s!.players.filter(p => p.human).length, 3)
  for (let k = 0; k < 18; k++) {
    const cur = r.host.s!.cur
    // Kdo není na tahu, příkaz neprosadí.
    assert.equal(exec(seats[(cur + 1) % 3].s!, (cur + 1) % 3, { t: 'endTurn' }).ok, false)
    playTurn(seats[cur])
    await until(r.same, `shoda v kroku ${k}`)
    assert.equal(seats[1].s!.cur, r.host.s!.cur)
  }
  assert.equal(r.host.s!.turn, 7)
  assert.ok(r.host.s!.cities.length >= 3)
  assert.equal(a.g.loads, 1)
  assert.equal(b.g.loads, 1)
})

test('rozejití stavu se opraví stavem od hostitele', async () => {
  const r = room()
  const a = await r.joinIn('Anna'), b = await r.joinIn('Bob')
  await r.start()
  const seats = [r.host, a.g, b.g]
  b.g.s!.players[2].gold += 5
  playTurn(r.host); await until(() => b.g.loads === 2 && r.same(), 'oprava u Boba')
  // Rozejde se hráč, který je sám na tahu: pozná to hostitel podle otisku u konce tahu.
  a.g.s!.players[1].gold += 9
  playTurn(a.g); await until(() => a.g.loads === 2 && r.same(), 'oprava u Anny')
  playTurn(b.g); await until(r.same, 'shoda')
  assert.equal(seats.length, 3)
  assert.equal(r.host.s!.turn, 2)
})

test('výpadek spojení: hostitel odehraje tah za hráče, ten se vrátí a pokračuje', async () => {
  const r = room()
  const a = await r.joinIn('Anna'), b = await r.joinIn('Bob')
  await r.start()
  const seats = [r.host, a.g, b.g]
  playTurn(r.host); await until(r.same, 'shoda')
  r.links[0].close()
  await until(() => !r.hs.online(1) && b.g.lobby!.members[1].online === false, 'výpadek')
  // Anna je na tahu a není tu: hostitel její tah ukončí.
  assert.equal(r.host.s!.cur, 1)
  assert.ok(r.hs.idle)
  exec(r.host.s!, 1, { t: 'endTurn' })
  r.hs.local(1, { t: 'endTurn' }, r.host.hash())
  await until(() => r.hs.online(1) && a.g.loads === 2 && r.same(), 'návrat')
  playTurn(b.g); await until(r.same, 'shoda')
  playTurn(r.host); await until(r.same, 'shoda')
  playTurn(a.g); await until(r.same, 'shoda')
  assert.equal(seats.length, 3)
  assert.equal(r.host.s!.turn, 2)
  // Do rozehrané hry se nikdo cizí nedostane.
  const c = r.join('Cyril')
  await c.cs.open(); await tick()
  assert.match(c.g.closed, /běží/)
})

test('hostitel obnoví uloženou hru a hráči se vrátí na svá místa', async () => {
  const r = room()
  const a = await r.joinIn('Anna'), b = await r.joinIn('Bob')
  await r.start()
  playTurn(r.host); await until(r.same, 'shoda')
  const saved = serialize(r.host.s!), seats = r.hs.seats()
  // Nové sezení hostitele se stejnou sestavou.
  const end: HostEnd = { onLink: () => {}, close: () => {} }
  const host = new Seat(); host.seat = 0; host.s = deserialize(saved)
  const hs = new HostSession(end, { code: 'ABCDE', name: 'Host', token: 'h', max: 3, info: '', version: '1', resume: seats }, host, host.ev)
  host.net = hs
  const g = new Seat()
  const cs = new ClientSession(async () => { const [x, y] = pair(); end.onLink(y); return x }, { name: 'Bob', token: 'Bob', version: '1' }, g, g.ev)
  g.net = cs
  await cs.open(); await until(() => g.s !== null, 'stav')
  assert.equal(g.seat, 2)
  assert.equal(g.hash(), host.hash())
  assert.equal(hs.online(1), false)
  assert.equal(hs.online(2), true)
})

test('souběžné tahy po síti: hráči táhnou zároveň a stav se shodne i při souběhu', async () => {
  const r = room()
  const a = await r.joinIn('Anna'), b = await r.joinIn('Bob')
  await r.start(true)
  const seats = [r.host, a.g, b.g]
  const scout = (g: Seat) => g.s!.units.find(u => u.owner === g.seat && u.type === 'scout')!
  const settler = (g: Seat) => g.s!.units.find(u => u.owner === g.seat && u.type === 'settler')!
  // Všichni tři zadají příkaz v téže chvíli, dřív než komukoli dorazí cizí.
  for (const g of seats) assert.ok(g.cmd({ t: 'found', unit: settler(g).id }).ok, `hráč ${g.seat} založil město`)
  await until(() => r.same() && r.hs.idle, 'shoda po souběžném založení měst')
  assert.equal(r.host.s!.cities.length, 3)
  // Pár kol s pohybem zvědů (odhalování mapy, ruiny, barbaři) a konci tahů v různém pořadí.
  for (let round = 0; round < 6; round++) {
    for (const g of seats) {
      const u = scout(g)
      if (u) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1]]) if (g.cmd({ t: 'move', unit: u.id, x: u.x + dx, y: u.y + dy }).ok) break
    }
    const order = round % 2 ? [2, 0, 1] : [1, 2, 0]
    for (const i of order) assert.ok(seats[i].cmd({ t: 'endTurn' }).ok, `kolo ${round}: hráč ${i} ukončil tah`)
    await until(() => r.hs.idle && r.same() && r.host.s!.turn === round + 2, `shoda po kole ${round}`)
  }
  assert.equal(r.host.loads + a.g.loads + b.g.loads, 2, 'nikdo nepotřeboval poslat celý stav znovu')
  assert.ok(a.g.replays + b.g.replays > 0, 'souběh nastal a přepočet proběhl')
})

test('souběžné tahy po síti: hostitel táhne, zatímco cizí příkaz čeká na provedení', async () => {
  const r = room(2)
  const a = await r.joinIn('Anna')
  await r.start(true)
  r.host.lag = 30
  const sa = a.g.s!.units.find(u => u.owner === 1 && u.type === 'settler')!
  const sh = r.host.s!.units.find(u => u.owner === 0 && u.type === 'settler')!
  assert.ok(a.g.cmd({ t: 'found', unit: sa.id }).ok)
  await tick(10)
  // Annin příkaz už u hostitele leží, ale ještě není proveden; hostitel mezitím táhne sám.
  assert.ok(r.host.cmd({ t: 'found', unit: sh.id }).ok)
  assert.ok(r.host.cmd({ t: 'endTurn' }).ok)
  await until(() => r.hs.idle && r.same(), 'shoda')
  assert.ok(a.g.cmd({ t: 'endTurn' }).ok)
  await until(() => r.hs.idle && r.same() && r.host.s!.turn === 2, 'nové kolo')
  assert.equal(a.g.loads, 1, 'bez opravy celým stavem')
})
