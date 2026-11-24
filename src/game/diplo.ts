// Diplomacie hráče se soupeři: dary, obchod se surovinami a spojenectví.
import { NATIONS, RESOURCES, type ResourceId } from './data.ts'
import { atWar, declareWar, militaryPower, note, ownsResource, playerIncome, resourceFree, UNITS_PER_SOURCE } from './rules.ts'
import type { GameState, Player } from './types.ts'

export const TRADABLE: ResourceId[] = ['horses', 'iron']
export const DEAL_TURNS = 20
export const GIFT = 40

/** Slovní vyjádření vztahu soupeře `p` k hráči `to`. */
export function attitudeWord(p: Player, to = 0): string {
  const a = p.attitude[to]
  return a >= 40 ? 'přátelský' : a >= 15 ? 'vstřícný' : a > -15 ? 'neutrální' : a > -40 ? 'chladný' : 'nepřátelský'
}

const clamp = (v: number) => Math.max(-100, Math.min(100, v))
const name = (p: Player) => NATIONS[p.nation].name
const warm = (p: Player, to: number, by: number) => { p.attitude[to] = clamp(p.attitude[to] + by) }

export interface Reply { ok: boolean; text: string }

/** Dar zlata od hráče `me`: soupeři zlepší vztah, lidskému hráči prostě přibude zlato. */
export function giveGold(s: GameState, aiId: number, me = 0): Reply {
  const my = s.players[me], p = s.players[aiId]
  if (my.gold < GIFT) return { ok: false, text: 'Na dar nemáte dost zlata.' }
  my.gold -= GIFT; p.gold += GIFT
  if (p.human) {
    note(s, aiId, `${name(my)} vám poslali dar: ${GIFT} zlata.`, 'good')
    return { ok: true, text: `Dar odeslán: ${GIFT} zlata.` }
  }
  warm(p, me, 12)
  return { ok: true, text: `„Štědrost se pamatuje.“ Vztah se zlepšil (${attitudeWord(p, me)}).` }
}

/** Cena, za kterou soupeř surovinu koupí / prodá (zlato za tah). */
/** `my` = hráč, který obchoduje (Zahirové mají o 1 zlato za tah výhodnější ceny). */
export function salePrice(p: Player, me = 0, my?: Player): number { return (p.attitude[me] >= 30 ? 4 : 3) + (my?.nation === 'zahi' ? 1 : 0) }
export function buyPrice(p: Player, me = 0, my?: Player): number { return (p.attitude[me] >= 30 ? 3 : p.attitude[me] <= -15 ? 6 : 4) - (my?.nation === 'zahi' ? 1 : 0) }

/** Může hráč soupeři surovinu prodat? Vrací důvod, proč ne, nebo null. */
export function saleBlock(s: GameState, aiId: number, r: ResourceId, me = 0): string | null {
  const p = s.players[aiId]
  if (atWar(s, me, aiId)) return 'Jste ve válce.'
  if (!ownsResource(s, me, r)) return `Nemáte vlastní zdroj (${RESOURCES[r].name.toLowerCase()} s vylepšením).`
  if (resourceFree(s, me, r) < UNITS_PER_SOURCE) return 'Nemáte volný zdroj – všechny živí vaše vlastní jednotky.'
  if (resourceFree(s, aiId, r) > 0) return 'Vlastní zdroje jim zatím stačí.'
  if (playerIncome(s, aiId).gold < salePrice(p, me, s.players[me]) && p.gold < 40) return 'Nemají čím platit.'
  return null
}

export function buyBlock(s: GameState, aiId: number, r: ResourceId, me = 0): string | null {
  const p = s.players[aiId]
  if (atWar(s, me, aiId)) return 'Jste ve válce.'
  if (!ownsResource(s, aiId, r)) return 'Tuto surovinu nemají.'
  if (resourceFree(s, aiId, r) < UNITS_PER_SOURCE) return 'Nemají volný zdroj – potřebují ho pro vlastní vojsko.'
  if (p.attitude[me] <= -40) return 'S vámi obchodovat nebudou.'
  return null
}

export function sellResource(s: GameState, aiId: number, r: ResourceId, me = 0): Reply {
  const why = saleBlock(s, aiId, r, me)
  if (why) return { ok: false, text: why }
  const p = s.players[aiId]
  s.deals.push({ seller: me, buyer: aiId, res: r, gpt: salePrice(p, me, s.players[me]), until: s.turn + DEAL_TURNS })
  warm(p, me, 6)
  note(s, me, `Obchod uzavřen: ${name(p)} kupují ${RESOURCES[r].name.toLowerCase()} za ${salePrice(p, me, s.players[me])} zlata za tah na ${DEAL_TURNS} tahů.`, 'good')
  return { ok: true, text: 'Obchod uzavřen.' }
}

export function buyResource(s: GameState, aiId: number, r: ResourceId, me = 0): Reply {
  const why = buyBlock(s, aiId, r, me)
  if (why) return { ok: false, text: why }
  const p = s.players[aiId]
  s.deals.push({ seller: aiId, buyer: me, res: r, gpt: buyPrice(p, me, s.players[me]), until: s.turn + DEAL_TURNS })
  warm(p, me, 4)
  note(s, me, `Obchod uzavřen: kupujete ${RESOURCES[r].name.toLowerCase()} od národa ${name(p)} za ${buyPrice(p, me, s.players[me])} zlata za tah na ${DEAL_TURNS} tahů.`, 'good')
  return { ok: true, text: 'Obchod uzavřen.' }
}

/** Žádost o spojenectví proti třetímu národu: soupeř mu vyhlásí válku a hráče po dobu paktu nenapadne. */
export function askAlliance(s: GameState, aiId: number, vs: number, me = 0): Reply {
  const p = s.players[aiId], foe = s.players[vs]
  if (atWar(s, me, aiId)) return { ok: false, text: 'Jste ve válce.' }
  if (!foe.alive || !p.met.includes(vs)) return { ok: false, text: 'Tento národ neznají.' }
  const already = atWar(s, aiId, vs)
  const strong = militaryPower(s, aiId) + militaryPower(s, me) * 0.6 >= militaryPower(s, vs) * 0.9
  if (!already && (p.attitude[me] < 20 || !strong || s.turn < (p.peaceUntil[vs] ?? 0))) {
    return { ok: false, text: p.attitude[me] < 20 ? '„Tak blízcí si nejsme.“ Zlepšete vztahy darem nebo obchodem.' : !strong ? '„To by byla sebevražda.“ Soupeř je na ně příliš silný.' : '„Právě jsme s nimi uzavřeli mír.“' }
  }
  if (!already) declareWar(s, aiId, vs)
  if (!atWar(s, me, vs)) declareWar(s, me, vs)
  p.pactUntil[me] = s.turn + 25
  warm(p, me, 10)
  note(s, me, `Spojenectví: ${name(p)} po vašem boku proti národu ${name(foe)}. Po 25 tahů vás nenapadnou.`, 'good')
  return { ok: true, text: 'Spojenectví uzavřeno.' }
}

/** Odpověď hráče na žádost soupeře o pomoc ve válce. */
export function answerAlly(s: GameState, from: number, vs: number, accept: boolean, me = 0): void {
  const p = s.players[from]
  if (!accept) { warm(p, me, -8); note(s, me, `Odmítli jste pomoci národu ${name(p)}.`, 'info'); return }
  if (!atWar(s, me, vs)) declareWar(s, me, vs)
  p.pactUntil[me] = s.turn + 25
  warm(p, me, 25)
  note(s, me, `Spojenectví: bojujete po boku národa ${name(p)}. Po 25 tahů vás nenapadnou.`, 'good')
}
