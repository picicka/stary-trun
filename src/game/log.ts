// Ladicí záznam: co se ve hře dělo a proč se počítač rozhodl, jak se rozhodl.
// Záznam stojí mimo stav hry – neukládá se s ním, neposílá se po síti a hru nijak neovlivňuje.
// Ve výchozím stavu je vypnutý; zapíná se v nápovědě hry (nebo adresou s ?log=1), v simulacích voláním logOn().
import { NATIONS } from './data.ts'
import type { GameState } from './types.ts'

export interface LogEntry { t: number; pid: number; k: string; text: string }

const MAX = 20000
let on = false
let buf: LogEntry[] = []

export function logOn(v = true): void { on = v }
export function logging(): boolean { return on }
export function logClear(): void { buf = [] }
export function logEntries(): LogEntry[] { return buf }
export function logRestore(entries: LogEntry[]): void { buf = entries.slice(-MAX) }

/** Zapíše řádek: `k` = druh (válka, mír, tažení, boj, město…), `text` = co se stalo a proč. */
export function log(s: GameState, pid: number, k: string, text: string | (() => string)): void {
  if (!on) return
  buf.push({ t: s.turn, pid, k, text: typeof text === 'function' ? text() : text })
  if (buf.length > MAX) buf.splice(0, buf.length - MAX)
}

/** Záznam jako text: jeden řádek na událost, čitelný bez hry. Volitelně jen některé druhy nebo jeden národ. */
export function logText(s: GameState, only?: { kinds?: string[]; pid?: number }): string {
  const name = (pid: number) => (pid < 0 ? '–' : pid === s.players.length - 1 ? 'Barbaři' : `${NATIONS[s.players[pid]?.nation]?.name ?? '?'}#${pid}`)
  const head = `Starý trůn – ladicí záznam. Tah ${s.turn}, národy: ${s.players.slice(0, -1).map(p => `${name(p.id)} (${p.human ? 'hráč' : p.personality}${p.alive ? '' : ', vyřazen'})`).join(', ')}.`
  const rows = buf.filter(e => (!only?.kinds || only.kinds.includes(e.k)) && (only?.pid === undefined || e.pid === only.pid))
  return [head, ...rows.map(e => `t${String(e.t).padStart(3, '0')}  ${name(e.pid).padEnd(14)} ${e.k.padEnd(8)} ${e.text}`)].join('\n') + '\n'
}
