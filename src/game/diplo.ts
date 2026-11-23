// Diplomacie hráče se soupeři: dary, obchod se surovinami a spojenectví.
import { NATIONS, RESOURCES, type ResourceId } from './data.ts'
import { atWar, declareWar, hasResource, militaryPower, note, ownsResource, playerIncome } from './rules.ts'
import type { GameState, Player } from './types.ts'

export const TRADABLE: ResourceId[] = ['horses', 'iron']
export const DEAL_TURNS = 20
export const GIFT = 40

export function attitudeWord(p: Player): string {
  const a = p.attitude
  return a >= 40 ? 'přátelský' : a >= 15 ? 'vstřícný' : a > -15 ? 'neutrální' : a > -40 ? 'chladný' : 'nepřátelský'
}

const clamp = (v: number) => Math.max(-100, Math.min(100, v))
const name = (p: Player) => NATIONS[p.nation].name

export interface Reply { ok: boolean; text: string }

/** Dar zlata zlepší vztah. */
export function giveGold(s: GameState, aiId: number): Reply {
  const me = s.players[0], p = s.players[aiId]
  if (me.gold < GIFT) return { ok: false, text: 'Na dar nemáte dost zlata.' }
  me.gold -= GIFT; p.gold += GIFT
  p.attitude = clamp(p.attitude + 12)
  return { ok: true, text: `„Štědrost se pamatuje.“ Vztah se zlepšil (${attitudeWord(p)}).` }
}

/** Cena, za kterou soupeř surovinu koupí / prodá (zlato za tah). */
export function salePrice(p: Player): number { return p.attitude >= 30 ? 4 : 3 }
export function buyPrice(p: Player): number { return p.attitude >= 30 ? 3 : p.attitude <= -15 ? 6 : 4 }

/** Může hráč soupeři surovinu prodat? Vrací důvod, proč ne, nebo null. */
export function saleBlock(s: GameState, aiId: number, r: ResourceId): string | null {
  const p = s.players[aiId]
  if (atWar(s, 0, aiId)) return 'Jste ve válce.'
  if (!ownsResource(s, 0, r)) return `Nemáte vlastní zdroj (${RESOURCES[r].name.toLowerCase()} s vylepšením).`
  if (hasResource(s, aiId, r)) return 'Tuto surovinu už mají.'
  if (playerIncome(s, aiId).gold < salePrice(p) && p.gold < 40) return 'Nemají čím platit.'
  return null
}

export function buyBlock(s: GameState, aiId: number, r: ResourceId): string | null {
  const p = s.players[aiId]
  if (atWar(s, 0, aiId)) return 'Jste ve válce.'
  if (!ownsResource(s, aiId, r)) return 'Tuto surovinu nemají.'
  if (hasResource(s, 0, r)) return 'Tuto surovinu už máte.'
  if (p.attitude <= -40) return 'S vámi obchodovat nebudou.'
  return null
}

export function sellResource(s: GameState, aiId: number, r: ResourceId): Reply {
  const why = saleBlock(s, aiId, r)
  if (why) return { ok: false, text: why }
  const p = s.players[aiId]
  s.deals.push({ seller: 0, buyer: aiId, res: r, gpt: salePrice(p), until: s.turn + DEAL_TURNS })
  p.attitude = clamp(p.attitude + 6)
  note(s, 0, `Obchod uzavřen: ${name(p)} kupují ${RESOURCES[r].name.toLowerCase()} za ${salePrice(p)} zlata za tah na ${DEAL_TURNS} tahů.`, 'good')
  return { ok: true, text: 'Obchod uzavřen.' }
}

export function buyResource(s: GameState, aiId: number, r: ResourceId): Reply {
  const why = buyBlock(s, aiId, r)
  if (why) return { ok: false, text: why }
  const p = s.players[aiId]
  s.deals.push({ seller: aiId, buyer: 0, res: r, gpt: buyPrice(p), until: s.turn + DEAL_TURNS })
  p.attitude = clamp(p.attitude + 4)
  note(s, 0, `Obchod uzavřen: kupujete ${RESOURCES[r].name.toLowerCase()} od národa ${name(p)} za ${buyPrice(p)} zlata za tah na ${DEAL_TURNS} tahů.`, 'good')
  return { ok: true, text: 'Obchod uzavřen.' }
}

/** Žádost o spojenectví proti třetímu národu: soupeř mu vyhlásí válku a hráče po dobu paktu nenapadne. */
export function askAlliance(s: GameState, aiId: number, vs: number): Reply {
  const p = s.players[aiId], foe = s.players[vs]
  if (atWar(s, 0, aiId)) return { ok: false, text: 'Jste ve válce.' }
  if (!foe.alive || !p.met.includes(vs)) return { ok: false, text: 'Tento národ neznají.' }
  const already = atWar(s, aiId, vs)
  const strong = militaryPower(s, aiId) + militaryPower(s, 0) * 0.6 >= militaryPower(s, vs) * 0.9
  if (!already && (p.attitude < 20 || !strong || s.turn < (p.peaceUntil[vs] ?? 0))) {
    return { ok: false, text: p.attitude < 20 ? '„Tak blízcí si nejsme.“ Zlepšete vztahy darem nebo obchodem.' : !strong ? '„To by byla sebevražda.“ Soupeř je na ně příliš silný.' : '„Právě jsme s nimi uzavřeli mír.“' }
  }
  if (!already) declareWar(s, aiId, vs)
  if (!atWar(s, 0, vs)) declareWar(s, 0, vs)
  p.pactUntil = s.turn + 25
  p.attitude = clamp(p.attitude + 10)
  note(s, 0, `Spojenectví: ${name(p)} po vašem boku proti národu ${name(foe)}. Po 25 tahů vás nenapadnou.`, 'good')
  return { ok: true, text: 'Spojenectví uzavřeno.' }
}

/** Odpověď hráče na žádost soupeře o pomoc ve válce. */
export function answerAlly(s: GameState, from: number, vs: number, accept: boolean): void {
  const p = s.players[from]
  if (!accept) { p.attitude = clamp(p.attitude - 8); note(s, 0, `Odmítli jste pomoci národu ${name(p)}.`, 'info'); return }
  if (!atWar(s, 0, vs)) declareWar(s, 0, vs)
  p.pactUntil = s.turn + 25
  p.attitude = clamp(p.attitude + 25)
  note(s, 0, `Spojenectví: bojujete po boku národa ${name(p)}. Po 25 tahů vás nenapadnou.`, 'good')
}
