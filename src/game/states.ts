// Městské státy: samostatná města, která vzniknou z barbarských táborů. Nerozpínají se a sama neútočí;
// hráčům zadávají úkoly a za dobrý vztah je odměňují. Město státu patří „barbarskému“ hráči (nový hráč
// by rozbil pole vztahů a uložené hry), ale všechna pravidla se řídí záznamem `city.state`.
import { BUILDINGS, NATIONS, PERSONAS, TECHS, type BuildingId, type PersonaId, type TechId } from './data.ts'
import { hexDist } from './hex.ts'
import { pick } from './rng.ts'
import { log } from './log.ts'
import {
  availableTechs, besieged, canBuildBuilding, citiesOf, cityMaxHp, cityShoot, claimTiles, emit, idx, isCivilian, killUnit, note, noteAll, updateVisibility,
} from './rules.ts'
import { barbId, type City, type CityState, type GameState, type Player, type StateKind, type StateQuest, type Unit } from './types.ts'

/** Od kterého tahu se první tábory mění v městské státy; každý tábor má svůj tah dozrání (viz campRipe). */
export const STATE_FROM = 60
/** Nejvýš tolik městských států vznikne za celou hru. */
export const STATE_MAX = 4
/** Tábor se usadí, jen když do této vzdálenosti nestojí žádné město. */
export const STATE_GAP = 4
/** Body vztahu potřebné k přátelství a ke spojenectví. */
export const FRIEND = 3
export const ALLY = 6
/** Výhoda přítele za tah; spojenec má dvojnásobek. */
export const STATE_BONUS = 2
/** Tolik tahů po posledním útoku trvá nepřátelství státu. */
export const FOE_TURNS = 10
/** Body vztahu za splněný úkol. */
export const QUEST_POINTS: Record<StateQuest['k'], number> = { camp: 2, gold: 1, unit: 2, tech: 1, building: 1 }

export const STATE_KINDS: Record<StateKind, { name: string; gives: string; icon: string }> = {
  prod: { name: 'řemeslný', gives: 'výroby v hlavním městě', icon: 'prod' },
  gold: { name: 'kupecký', gives: 'zlata za tah', icon: 'gold' },
  food: { name: 'rolnický', gives: 'jídla v hlavním městě', icon: 'food' },
  sci: { name: 'učený', gives: 'vědy za tah', icon: 'sci' },
  culture: { name: 'posvátný', gives: 'kultury za tah', icon: 'culture' },
}
const KINDS = Object.keys(STATE_KINDS) as StateKind[]

export type StateCity = City & { state: CityState }
export const isState = (c: City | null | undefined): c is StateCity => !!c?.state
export function stateCities(s: GameState): StateCity[] { return s.cities.filter(isState) }

/** Co stát dává na daném stupni vztahu (1 = přítel, 2 = spojenec), např. „+4 zlata za tah“. */
export function bonusText(kind: StateKind, level: number): string { return `+${STATE_BONUS * level} ${STATE_KINDS[kind].gives}` }

// ---------------------------------------------------------------- vznik z tábora

/** Tah, ve kterém tábor na poli `i` dozraje v městský stát (tábory nedozrávají všechny naráz). */
export function campRipe(i: number): number { return STATE_FROM + ((i * 7) % 5) * 6 }

/** Může se tábor usadit? Nesmí ležet na něčím území ani blízko města. */
function campFree(s: GameState, i: number): boolean {
  const t = s.tiles[i]
  if (t.special !== 'camp' || t.owner !== -1) return false
  const x = i % s.W, y = (i / s.W) | 0
  return !s.cities.some(c => hexDist(c.x, c.y, x, y) < STATE_GAP)
}

/** Za kolik tahů se z tábora stane městský stát; null = tady stát nevznikne (blízko města, na cizím území, nebo jich už je dost). */
export function campOutlook(s: GameState, i: number): number | null {
  if ((s.mission.states ?? 0) >= STATE_MAX || !campFree(s, i)) return null
  return Math.max(1, campRipe(i) - s.turn)
}

function foundState(s: GameState, i: number): StateCity {
  const x = i % s.W, y = (i / s.W) | 0, barb = barbId(s)
  // Barbaři z tábora se usadí: stráž i nájezdníci mizí z mapy.
  for (const u of [...s.units]) if (u.owner === barb && (u.home === i || (u.x === x && u.y === y))) killUnit(s, u)
  const t = s.tiles[i]
  t.special = null; t.forest = false; t.imp = null
  const names = NATIONS.free.cities, taken = new Set(s.cities.map(c => c.name))
  const born = s.mission.states ?? 0
  const name = names.find(n => !taken.has(n)) ?? `${names[born % names.length]} II`
  const used = stateCities(s).map(c => c.state.kind)
  const fresh = KINDS.filter(k => !used.includes(k))
  const n = s.players.length
  const state: CityState = { kind: pick(s, fresh.length ? fresh : KINDS), born: s.turn, rel: new Array<number>(n).fill(0), quest: new Array<StateQuest | null>(n).fill(null), last: new Array<string>(n).fill(''), foe: new Array<number>(n).fill(0), met: [], ally: -1 }
  const c: StateCity = {
    id: s.nextId++, owner: barb, founder: barb, name, x, y, pop: 4, food: 0, prod: 0, culture: 0, radius: 1, grown: 0,
    build: null, queue: [], buildings: ['walls'], hp: 0, capital: false, seat: -1, worked: [], state,
  }
  c.hp = cityMaxHp(c)
  t.owner = barb; t.city = c.id
  s.cities.push(c)
  claimTiles(s, c)
  s.mission.states = born + 1
  log(s, barb, 'město', () => `městský stát ${c.name} (${STATE_KINDS[state.kind].name}) vznikl z tábora na ${x},${y}`)
  emit({ e: 'found', city: c.id, x, y })
  noteAll(s, `Barbaři se usadili: z tábora vznikl ${STATE_KINDS[state.kind].name} městský stát ${c.name}.`, 'info', x, y, {}, h => !!h.explored[i])
  for (const p of s.players) if (p.id !== barb && p.alive) updateVisibility(s, p.id)
  return c
}

/** Dozrálé tábory se mění v městské státy. */
export function settleCamps(s: GameState): void {
  if (s.turn < STATE_FROM) return
  for (let i = 0; i < s.tiles.length; i++) {
    if ((s.mission.states ?? 0) >= STATE_MAX) return
    if (s.tiles[i].special === 'camp' && s.turn >= campRipe(i) && campFree(s, i)) foundState(s, i)
  }
}

// ---------------------------------------------------------------- vztahy

/** Je stát s hráčem v nepřátelství (hráč na něj nedávno zaútočil)? */
export function stateHostile(s: GameState, c: City, pid: number): boolean { return !!c.state && s.turn < (c.state.foe[pid] ?? 0) }

/** Stupeň vztahu: 0 = nic, 1 = přítel, 2 = spojenec. */
export function stateLevel(s: GameState, c: City, pid: number): 0 | 1 | 2 {
  const st = c.state
  if (!st || stateHostile(s, c, pid)) return 0
  return st.ally === pid ? 2 : (st.rel[pid] ?? 0) >= FRIEND ? 1 : 0
}

/** Co hráč za tah dostává od všech městských států dohromady. */
export function stateBonus(s: GameState, pid: number): Record<StateKind, number> {
  const out: Record<StateKind, number> = { prod: 0, gold: 0, food: 0, sci: 0, culture: 0 }
  for (const c of s.cities) if (c.state) out[c.state.kind] += STATE_BONUS * stateLevel(s, c, pid)
  return out
}

/** Spojencem je hráč s nejvíce body (aspoň ALLY); při shodě zůstává ten dosavadní. */
function updateAlly(s: GameState, c: StateCity): void {
  const st = c.state
  const ok = (pid: number) => pid >= 0 && pid !== barbId(s) && !!s.players[pid]?.alive && (st.rel[pid] ?? 0) >= ALLY && !stateHostile(s, c, pid)
  let best = ok(st.ally) ? st.ally : -1
  for (const p of s.players) if (ok(p.id) && (best < 0 || st.rel[p.id] > st.rel[best])) best = p.id
  if (best === st.ally) return
  const old = st.ally
  st.ally = best
  if (old >= 0) note(s, old, `${c.name} už není váš spojenec${best >= 0 ? ` – přetáhli ho ${NATIONS[s.players[best].nation].name}` : ''}. ${(st.rel[old] ?? 0) >= FRIEND && !stateHostile(s, c, old) ? `Zůstáváte přáteli (${bonusText(st.kind, 1)}).` : 'Výhody končí.'}`, 'bad', c.x, c.y)
  if (best >= 0) {
    note(s, best, `${c.name} je teď váš spojenec: ${bonusText(st.kind, 2)}.`, 'good', c.x, c.y)
    log(s, best, 'stát', () => `spojenec ${c.name} (${st.rel[best]} bodů)`)
  }
}

function addRel(s: GameState, c: StateCity, pid: number, n: number): void {
  const st = c.state, before = st.rel[pid] ?? 0
  st.rel[pid] = Math.max(0, before + n)
  const friendNow = st.rel[pid] >= FRIEND
  updateAlly(s, c)
  if (before < FRIEND && friendNow && st.ally !== pid) note(s, pid, `${c.name} vás má za přítele: ${bonusText(st.kind, 1)}. Spojenectví přinese dvojnásobek (${ALLY} bodů a nejvíc ze všech).`, 'good', c.x, c.y)
  if (before >= FRIEND && !friendNow) note(s, pid, `${c.name}: přátelství ochladlo, výhody končí.`, 'bad', c.x, c.y)
}

/** Hráč stát poprvé spatřil. První objevitel dostane bod. */
function meetState(s: GameState, c: StateCity, pid: number): void {
  const st = c.state
  if (st.met.includes(pid)) return
  const first = st.met.length === 0
  st.met.push(pid)
  if (first) st.rel[pid] = (st.rel[pid] ?? 0) + 1
  note(s, pid, `Objevili jste ${STATE_KINDS[st.kind].name} městský stát ${c.name}.${first ? ' Dorazili jste první: vztah +1.' : ''} Plňte jeho úkoly – přátelům dává ${bonusText(st.kind, 1)}, spojenci dvojnásobek.`, 'good', c.x, c.y)
}

/** Voláno po přepočtu viditelnosti: hráč objeví státy, které právě vidí. */
export function discoverStates(s: GameState, pid: number): void {
  const p = s.players[pid]
  for (const c of s.cities) if (isState(c) && !c.state.met.includes(pid) && p.visible[idx(s, c.x, c.y)]) meetState(s, c, pid)
}

/** Útok na stát: vztah padá na nulu a stát se brání, dokud útoky neustanou. */
export function stateAttacked(s: GameState, c: City, pid: number): void {
  if (!isState(c)) return
  const st = c.state, was = stateHostile(s, c, pid)
  st.foe[pid] = s.turn + FOE_TURNS
  st.quest[pid] = null
  if (!st.met.includes(pid)) st.met.push(pid)
  if (st.rel[pid]) st.rel[pid] = 0
  updateAlly(s, c)
  if (was) return
  const who = NATIONS[s.players[pid].nation].name
  log(s, pid, 'stát', () => `útok na městský stát ${c.name}`)
  note(s, pid, `Napadli jste městský stát ${c.name}. O jeho přízeň jste přišli a hradby po vás střílejí; uklidní se ${FOE_TURNS} tahů po posledním útoku.`, 'war', c.x, c.y)
  noteAll(s, `${who} napadli městský stát ${c.name}.`, 'war', c.x, c.y, { [pid]: null }, h => st.met.includes(h.id))
}

/** Stát padl: stává se obyčejným městem dobyvatele a ostatní státy to dobyvateli zazlívají. */
export function stateCaptured(s: GameState, c: City, by: number): void {
  if (!isState(c)) return
  for (const p of s.players) if (p.id !== by && stateLevel(s, c, p.id) > 0) note(s, p.id, `Městský stát ${c.name} padl, jeho výhody končí.`, 'bad', c.x, c.y)
  delete (c as City).state
  let cooled = false
  for (const o of stateCities(s)) if ((o.state.rel[by] ?? 0) > 0) { addRel(s, o, by, -2); cooled = true }
  if (cooled) note(s, by, `Ostatní městské státy vám pád města ${c.name} zazlívají: vztah −2.`, 'bad')
}

// ---------------------------------------------------------------- úkoly

/** Znění úkolu pro hráče. */
export function questText(q: StateQuest): string {
  switch (q.k) {
    case 'camp': return 'Vypalte barbarský tábor, který nás ohrožuje.'
    case 'gold': return `Pošlete nám dar ${q.n} zlata.`
    case 'unit': return 'Darujte nám bojovou jednotku: přiveďte ji hned k městu a předejte ji.'
    case 'tech': return `Objevte technologii ${TECHS[q.id].name}.`
    case 'building': return `Postavte v některém svém městě stavbu ${BUILDINGS[q.id].name}.`
  }
}

function questValid(s: GameState, p: Player, q: StateQuest): boolean {
  if (q.k === 'camp') return s.tiles[q.tile]?.special === 'camp'
  if (q.k === 'tech') return !p.techs.includes(q.id)
  if (q.k === 'building') return citiesOf(s, p.id).some(c => canBuildBuilding(s, c, q.id))
  return true
}

function newQuest(s: GameState, c: StateCity, p: Player): StateQuest | null {
  const st = c.state
  const opts: StateQuest[] = [{ k: 'gold', n: 30 + 10 * Math.min(6, st.rel[p.id] ?? 0) }]
  // Bojovou jednotku umí předat jen člověk.
  if (p.human) opts.push({ k: 'unit' })
  let camp = -1, cd = 11
  for (let i = 0; i < s.tiles.length; i++) {
    if (s.tiles[i].special !== 'camp') continue
    const d = hexDist(c.x, c.y, i % s.W, (i / s.W) | 0)
    if (d < cd) { cd = d; camp = i }
  }
  if (camp >= 0) opts.push({ k: 'camp', tile: camp })
  const techs = availableTechs(p).filter(t => !TECHS[t].repeat && t !== p.research)
  if (techs.length) opts.push({ k: 'tech', id: pick(s, techs) })
  const mine = citiesOf(s, p.id)
  const builds = (Object.keys(BUILDINGS) as BuildingId[]).filter(b => b !== 'wonder' && mine.some(o => canBuildBuilding(s, o, b) && !(o.build?.kind === 'building' && o.build.id === b)))
  if (builds.length) opts.push({ k: 'building', id: pick(s, builds) })
  const other = opts.filter(o => o.k !== st.last[p.id])
  const q = pick(s, other.length ? other : opts)
  st.last[p.id] = q.k
  return q
}

function done(s: GameState, c: StateCity, pid: number, q: StateQuest): void {
  const pts = QUEST_POINTS[q.k]
  c.state.quest[pid] = null
  log(s, pid, 'stát', () => `úkol pro ${c.name} splněn (${q.k}), vztah ${(c.state.rel[pid] ?? 0) + pts}`)
  note(s, pid, `Úkol pro městský stát ${c.name} splněn: vztah +${pts} (nyní ${(c.state.rel[pid] ?? 0) + pts}).`, 'good', c.x, c.y)
  if (s.players[pid].human) emit({ e: 'sound', id: 'quest' })
  addRel(s, c, pid, pts)
}

function check(s: GameState, pid: number, hit: (q: StateQuest) => boolean): void {
  for (const c of stateCities(s)) {
    const q = c.state.quest[pid]
    if (q && !stateHostile(s, c, pid) && hit(q)) done(s, c, pid, q)
  }
}
/** Hráč vypálil tábor na poli `tile`. */
export function questCamp(s: GameState, pid: number, tile: number): void { check(s, pid, q => q.k === 'camp' && q.tile === tile) }
export function questTech(s: GameState, pid: number, id: TechId): void { check(s, pid, q => q.k === 'tech' && q.id === id) }
export function questBuilding(s: GameState, pid: number, id: BuildingId): void { check(s, pid, q => q.k === 'building' && q.id === id) }

/** Dar ve zlatě podle úkolu. Vrací důvod, proč to nejde, nebo null. */
export function giftGold(s: GameState, pid: number, c: City | undefined): string | null {
  if (!isState(c)) return 'To není městský stát.'
  const q = c.state.quest[pid], p = s.players[pid]
  if (stateHostile(s, c, pid)) return 'Městský stát s vámi teď nejedná.'
  if (!q || q.k !== 'gold') return 'O dar ve zlatě teď městský stát nestojí.'
  if (p.gold < q.n) return `Na dar potřebujete ${q.n} zlata.`
  p.gold -= q.n
  done(s, c, pid, q)
  return null
}

/** Proč jednotku státu darovat nejde, nebo null. */
export function giftUnitBlock(s: GameState, u: Unit, c: City | undefined): string | null {
  if (!isState(c)) return 'To není městský stát.'
  const q = c.state.quest[u.owner]
  if (stateHostile(s, c, u.owner)) return 'Městský stát s vámi teď nejedná.'
  if (!q || q.k !== 'unit') return 'O jednotku teď městský stát nestojí.'
  if (isCivilian(u)) return 'Městský stát chce bojovou jednotku.'
  if (hexDist(u.x, u.y, c.x, c.y) !== 1) return 'Jednotka musí stát hned u města.'
  return null
}
/** Stát, kterému lze jednotku právě teď darovat (stojí u něj a stát o ni stojí). */
export function giftUnitTarget(s: GameState, u: Unit): StateCity | null {
  return stateCities(s).find(c => !giftUnitBlock(s, u, c)) ?? null
}
export function giftUnit(s: GameState, u: Unit, c: City | undefined): string | null {
  const err = giftUnitBlock(s, u, c)
  if (err || !isState(c)) return err
  const q = c.state.quest[u.owner]!
  const pid = u.owner
  killUnit(s, u)
  updateVisibility(s, pid)
  done(s, c, pid, q)
  return null
}

// ---------------------------------------------------------------- kolo

/** Jednou za kolo: vznik nových států, opravy a obrana, nové úkoly, dary soupeřů vedených počítačem. */
export function tickStates(s: GameState): void {
  settleCamps(s)
  const barb = barbId(s)
  for (const c of stateCities(s)) {
    const st = c.state
    c.pop = Math.min(8, 4 + Math.floor((s.turn - st.born) / 30))
    if (!besieged(s, c)) {
      c.hp = Math.min(cityMaxHp(c), c.hp + 10)
      if (c.wallDmg) c.wallDmg = Math.max(0, c.wallDmg - 10)
    }
    cityShoot(s, c)
    for (const p of s.players) {
      if (p.id === barb || !st.met.includes(p.id)) continue
      if (!p.alive || stateHostile(s, c, p.id)) { st.quest[p.id] = null; continue }
      let q = st.quest[p.id]
      if (q && !questValid(s, p, q)) q = st.quest[p.id] = null
      if (!q) {
        q = st.quest[p.id] = newQuest(s, c, p)
        if (q) {
          const [x, y] = q.k === 'camp' ? [q.tile % s.W, (q.tile / s.W) | 0] : [c.x, c.y]
          note(s, p.id, `${c.name} má pro vás úkol: ${questText(q)} Odměna: vztah +${QUEST_POINTS[q.k]}.`, 'info', x, y)
        }
      }
      // Mírumilovní soupeři si přízeň kupují, když mají zlata nazbyt.
      if (q && q.k === 'gold' && !p.human && !PERSONAS[p.personality as PersonaId]?.martial && p.gold >= q.n + 80) giftGold(s, p.id, c)
    }
    updateAlly(s, c)
  }
}
