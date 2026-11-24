// Spojení mezi hráči: WebRTC přes PeerJS (jen seznámení jde přes veřejný server, hra pak teče napřímo),
// a pro zkoušení na jednom počítači náhrada přes BroadcastChannel mezi panely prohlížeče.
import type { DataConnection, Peer as PeerT } from 'peerjs'
import type { HostEnd, Link, Msg } from './session.ts'

export interface Transport {
  /** Otevře místnost s daným kódem. Odmítne, když je kód obsazený. */
  host(code: string): Promise<HostEnd>
  /** Připojí se do místnosti. Odmítne, když neexistuje nebo se nejde spojit. */
  join(code: string): Promise<Link>
}

/** Chyba s textem pro hráče; `taken` = kód místnosti už někdo používá. */
export class NetError extends Error {
  taken: boolean
  constructor(text: string, taken = false) { super(text); this.taken = taken }
}

const PREFIX = 'starytrun-v1-'
const PING_MS = 4000
const DEAD_MS = 15000

function blankLink(send: (m: Msg) => void, close: () => void): Link {
  return { send, close, onMessage: () => {}, onClose: () => {} }
}

/** Obalí spojení PeerJS: zprávy jako text, k tomu hlídání, že druhá strana ještě žije. */
function peerLink(conn: DataConnection, after?: () => void): Link {
  let open = true
  let last = Date.now()
  const shut = () => {
    if (!open) return
    open = false
    clearInterval(timer)
    try { conn.close() } catch { /* už zavřeno */ }
    after?.()
    link.onClose()
  }
  const link = blankLink(m => { if (open) try { conn.send(JSON.stringify(m)) } catch { shut() } }, shut)
  const timer = setInterval(() => {
    if (Date.now() - last > DEAD_MS) { shut(); return }
    try { conn.send('"ping"') } catch { shut() }
  }, PING_MS)
  conn.on('data', d => {
    last = Date.now()
    if (typeof d !== 'string') return
    let m: unknown
    try { m = JSON.parse(d) } catch { return }
    if (m && typeof m === 'object') link.onMessage(m as Msg)
  })
  conn.on('close', shut)
  conn.on('error', shut)
  return link
}

export function peerTransport(): Transport {
  const load = async () => (await import('peerjs')).Peer
  return {
    async host(code) {
      const Peer = await load()
      return new Promise<HostEnd>((resolve, reject) => {
        const peer: PeerT = new Peer(PREFIX + code)
        const end: HostEnd = { onLink: () => {}, close: () => peer.destroy() }
        let ready = false
        peer.on('open', () => { ready = true; resolve(end) })
        peer.on('connection', conn => conn.on('open', () => end.onLink(peerLink(conn))))
        // Výpadek seznamovacího serveru běžící spojení neruší; bez něj by se ale nikdo nový nepřipojil.
        peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed && peer.disconnected) peer.reconnect() }, 2000) })
        peer.on('error', e => {
          if (ready) return
          peer.destroy()
          reject(e.type === 'unavailable-id' ? new NetError('Kód místnosti je obsazený.', true) : new NetError('Nepodařilo se spojit se seznamovacím serverem. Zkontrolujte připojení k internetu.'))
        })
      })
    },
    async join(code) {
      const Peer = await load()
      return new Promise<Link>((resolve, reject) => {
        const peer: PeerT = new Peer()
        let done = false
        const fail = (text: string) => { if (done) return; done = true; clearTimeout(timer); peer.destroy(); reject(new NetError(text)) }
        const timer = setTimeout(() => fail('Spojení se nepodařilo navázat. Síť jednoho z vás přímé spojení nepustí, nebo hostitel hru zavřel.'), 20000)
        peer.on('open', () => {
          const conn = peer.connect(PREFIX + code, { reliable: true })
          conn.on('open', () => {
            if (done) return
            done = true; clearTimeout(timer)
            resolve(peerLink(conn, () => peer.destroy()))
          })
          conn.on('error', () => fail('Spojení se nepodařilo navázat.'))
        })
        peer.on('error', e => fail(e.type === 'peer-unavailable' ? 'Hra s tímto kódem neexistuje. Zkontrolujte kód; hostitel musí mít hru otevřenou.' : 'Nepodařilo se spojit se seznamovacím serverem. Zkontrolujte připojení k internetu.'))
      })
    },
  }
}

type Wire = { k: 'conn' | 'ack' | 'close'; id: string; to: 'host' | 'client' } | { k: 'msg'; id: string; to: 'host' | 'client'; m: Msg }

/** Spojení mezi panely téhož prohlížeče (adresa s ?net=local): zkoušení bez internetu. */
export function localTransport(): Transport {
  const chan = (code: string) => new BroadcastChannel(PREFIX + code)
  return {
    async host(code) {
      const bc = chan(code)
      const links = new Map<string, Link>()
      const end: HostEnd = { onLink: () => {}, close: () => { for (const id of links.keys()) bc.postMessage({ k: 'close', id, to: 'client' } satisfies Wire); bc.close() } }
      bc.onmessage = e => {
        const w = e.data as Wire
        if (w.to !== 'host') return
        if (w.k === 'conn') {
          const id = w.id
          const link = blankLink(m => bc.postMessage({ k: 'msg', id, to: 'client', m } satisfies Wire), () => { if (links.delete(id)) { bc.postMessage({ k: 'close', id, to: 'client' } satisfies Wire); link.onClose() } })
          links.set(id, link)
          bc.postMessage({ k: 'ack', id, to: 'client' } satisfies Wire)
          end.onLink(link)
        } else if (w.k === 'msg') links.get(w.id)?.onMessage(w.m)
        else if (w.k === 'close') { const l = links.get(w.id); if (l && links.delete(w.id)) l.onClose() }
      }
      window.addEventListener('pagehide', () => end.close())
      return end
    },
    join(code) {
      return new Promise<Link>((resolve, reject) => {
        const bc = chan(code)
        const id = Math.random().toString(36).slice(2)
        let open = false
        const shut = (tell: boolean) => { if (!open) return; open = false; if (tell) bc.postMessage({ k: 'close', id, to: 'host' } satisfies Wire); bc.close(); link.onClose() }
        const link = blankLink(m => { if (open) bc.postMessage({ k: 'msg', id, to: 'host', m } satisfies Wire) }, () => shut(true))
        const timer = setTimeout(() => { bc.close(); reject(new NetError('Hra s tímto kódem neexistuje. Zkontrolujte kód; hostitel musí mít hru otevřenou.')) }, 1200)
        bc.onmessage = e => {
          const w = e.data as Wire
          if (w.to !== 'client' || w.id !== id) return
          if (w.k === 'ack') { clearTimeout(timer); open = true; resolve(link) }
          else if (w.k === 'msg') link.onMessage(w.m)
          else if (w.k === 'close') shut(false)
        }
        bc.postMessage({ k: 'conn', id, to: 'host' } satisfies Wire)
        window.addEventListener('pagehide', () => shut(true))
      })
    },
  }
}
