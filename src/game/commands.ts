// Příkazy hráče: jediná cesta, kterou rozhraní mění stav hry.
// Příkaz jsou čistá data (jdou poslat po síti i zapsat do záznamu) a provádí se vždy stejně:
// stejný stav + stejné příkazy ve stejném pořadí = stejný výsledek.
import { NATIONS, type PromoId, type ResourceId, type TechId, type TraditionId } from './data.ts'
import { adviseBuild, aiAcceptsPeace } from './ai.ts'
import { answerAlly, askAlliance, buyResource, giveGold, sellResource } from './diplo.ts'
import {
  adoptTradition, atWar, attack, buy, captureNeedsWar, canFoundCity, canWork, cityAt, cityById, declareWar, dequeue, enqueue, foundCity, killUnit, makePeace, moveUnit, note, pathMap, pathTo,
  borderOptions, buyItem, growBorders, mergeBlock, mergeUnits, splitBlock, splitUnit, pillage, pillageBlock, planResearch, previewAttack, promote, promoteUnit, roadStep, startWork, stopUnit, unitById, unitsOf, updateVisibility, upgradeBlock, upgradeUnit,
  assignWorkers, cityShoot, cityTargets, escortBlock, follow, followAll,
} from './rules.ts'
import { canAct, comeBack, endTurn, resumeTurn, settle, takeOver } from './state.ts'
import { barbId, type BuildItem, type CityFocus, type GameState, type JobId } from './types.ts'

export type Command =
  /** Pohyb na pole (i na více tahů). `todo` = co udělat po příchodu: práce dělníků, nebo založení města. */
  | { t: 'move'; unit: number; x: number; y: number; todo?: JobId | 'found'; war?: boolean }
  /** Další průjezdní bod do fronty rozkazů. */
  | { t: 'waypoint'; unit: number; x: number; y: number }
  /** Útok; `war` = útočník tím vědomě vyhlašuje válku. */
  | { t: 'attack'; unit: number; x: number; y: number; war?: boolean }
  | { t: 'found'; unit: number }
  | { t: 'work'; unit: number; job: JobId }
  /** Spojení se sousední stejnou jednotkou v šik či voj a jejich rozdělení. */
  | { t: 'merge'; unit: number; into: number }
  | { t: 'split'; unit: number }
  /** Vyplenění cizího vylepšení či cesty na poli, kde bojová jednotka stojí. */
  | { t: 'pillage'; unit: number }
  | { t: 'roadTo'; unit: number; x: number; y: number }
  | { t: 'promo'; unit: number; id: PromoId }
  /** Přezbrojení; `all` = všechny jednotky téhož druhu, u kterých to jde. */
  | { t: 'upgrade'; unit: number; all?: boolean }
  | { t: 'order'; unit: number; o: 'auto' | 'fortify' | 'sleep' | 'skip' | 'wake' }
  | { t: 'disband'; unit: number }
  /** Doprovod: vojenská jednotka bude následovat a chránit vlastní civilní jednotku `ward`. */
  | { t: 'escort'; unit: number; ward: number }
  | { t: 'build'; city: number; item: BuildItem; front?: boolean }
  | { t: 'unqueue'; city: number; i: number }
  | { t: 'promote'; city: number; i: number }
  | { t: 'advise'; city: number }
  /** Střelba z hradeb na jednotku na daném poli; město střílí jednou za tah. */
  | { t: 'cityShoot'; city: number; x: number; y: number }
  /** Zaměření města na jídlo, výrobu, nebo zlato; null = vyváženě (automatika). */
  | { t: 'focus'; city: number; focus: CityFocus | null }
  /** Růst hranic města: přepnutí režimu (sám / vybírá hráč) a volba dalšího pole. */
  | { t: 'border'; city: number; mode?: 'auto' | 'manual'; tile?: number }
  /** Koupě za zlato: bez položky to, co město právě staví, s položkou kteroukoli z nabídky. */
  | { t: 'buy'; city: number; item?: BuildItem }
  | { t: 'tradition'; id: TraditionId }
  | { t: 'research'; tech: TechId; append?: boolean }
  | { t: 'war'; vs: number }
  | { t: 'peace'; vs: number }
  | { t: 'diplo'; kind: 'gift' | 'sell' | 'buy' | 'ally'; vs: number; arg?: string }
  /** Odpověď na nabídku (mír, spojenectví) od hráče `from`. */
  | { t: 'answer'; from: number; accept: boolean }
  /** Rada rádce přečtena. */
  | { t: 'tip'; id: string }
  | { t: 'endTurn' }
  /** Návrat k ukončenému tahu (souběžné tahy, dokud ostatní táhnou). */
  | { t: 'resume' }
  /** Síťová hra: za odešlého hráče dohraje tah počítač a hraje za něj dál; `back` = hráč se vrátil. */
  | { t: 'away' }
  | { t: 'back' }

export interface Result {
  ok: boolean
  /** Hláška pro hráče: důvod odmítnutí, nebo odpověď soupeře. */
  text?: string
  /** Id nově založeného města. */
  city?: number
}

const OK: Result = { ok: true }
const no = (text?: string): Result => ({ ok: false, text })

/** Klíč přečtené rady: hráč 0 má holé id (kvůli starším uloženým hrám), ostatní s předponou. */
export const tipKey = (pid: number, id: string): string => (pid ? `${pid}:${id}` : id)

/** Provede příkaz hráče `pid`. Příkaz mimo pořadí, s cizí jednotkou či městem nebo proti pravidlům odmítne a stav nezmění. */
export function exec(s: GameState, pid: number, c: Command): Result {
  const r = run(s, pid, c)
  // Souběžné tahy: po příkazu mohl někdo přijít na řadu (nebo vypadnout ze hry).
  if (s.simul && r.ok) settle(s)
  return r
}

function run(s: GameState, pid: number, c: Command): Result {
  if (s.over) return no('Hra skončila.')
  const me = s.players[pid]
  if (c.t === 'back') return me && comeBack(s, pid) ? OK : no()
  if (!me || !me.human || !me.alive) return no('Tento hráč nehraje.')
  if (c.t === 'away') return takeOver(s, pid) ? OK : no('Nejste na tahu.')
  if (c.t === 'resume') return resumeTurn(s, pid) ? OK : no('K tahu se už vrátit nejde.')
  if (!canAct(s, pid)) return no('Nejste na tahu.')

  if ('unit' in c) {
    const u = unitById(s, c.unit)
    if (!u || u.owner !== pid) return no('Tato jednotka vám nepatří.')
    // Vlastní rozkaz doprovod ruší; povýšení a přezbrojení ne.
    if (c.t !== 'promo' && c.t !== 'upgrade') delete u.escort
    switch (c.t) {
      case 'escort': {
        const ward = unitById(s, c.ward)
        const err = escortBlock(s, u, ward)
        if (err || !ward) return no(err ?? undefined)
        for (const o of unitsOf(s, pid)) if (o.escort === ward.id) delete o.escort
        stopUnit(u); u.auto = false; u.sleep = false; u.fortified = false
        u.escort = ward.id
        follow(s, u)
        return OK
      }
      case 'move': {
        if (c.war) {
          // Zajetí civilistů národa, se kterým je mír: hráč tím vědomě vyhlašuje válku.
          const foe = captureNeedsWar(s, u, c.x, c.y)
          if (foe < 0) return no()
          declareWar(s, pid, foe)
        }
        stopUnit(u); u.auto = false
        if (!pathTo(s, pathMap(s, u, undefined, me), c.x, c.y)) return no(c.todo ? 'Tam dělníci cestu nedovedou.' : 'Tam se jednotka nedostane.')
        if (c.todo) u.todo = c.todo
        moveUnit(s, u, c.x, c.y)
        followAll(s, pid)
        const city = cityAt(s, c.x, c.y)
        return { ok: true, city: c.todo === 'found' && city?.owner === pid && !s.units.includes(u) ? city.id : undefined }
      }
      case 'waypoint':
        if (!u.goto) return no()
        if (u.way.length >= 6) return no('Fronta rozkazů je plná (nejvýš 6 bodů).')
        u.way.push([c.x, c.y]); u.auto = false
        return OK
      case 'attack': {
        const pv = previewAttack(s, u, c.x, c.y)
        if (!pv) return no()
        if (pv.needWar >= 0) { if (!c.war) return no('Útok by znamenal válku.'); declareWar(s, pid, pv.needWar) }
        return { ok: attack(s, u, c.x, c.y) }
      }
      case 'found': {
        const err = canFoundCity(s, u)
        if (err) return no(err)
        const city = foundCity(s, u)
        return city ? { ok: true, city: city.id } : no()
      }
      case 'work':
        return canWork(s, u, c.job) && startWork(s, u, c.job) ? OK : no()
      case 'merge': {
        const to = unitById(s, c.into)
        if (!to) return no()
        const err = mergeBlock(s, u, to)
        if (err) return no(err)
        mergeUnits(s, u, to); updateVisibility(s, pid)
        return OK
      }
      case 'split': {
        const err = splitBlock(s, u)
        return err ? no(err) : splitUnit(s, u) ? OK : no()
      }
      case 'pillage': {
        const err = pillageBlock(s, u)
        return err ? no(err) : pillage(s, u) ? OK : no()
      }
      case 'roadTo':
        if (u.type !== 'worker') return no()
        if (!pathTo(s, pathMap(s, u, undefined, me), c.x, c.y)) return no('Tam dělníci cestu nedovedou.')
        stopUnit(u); u.auto = false; u.roadTo = [c.x, c.y]
        roadStep(s, u)
        followAll(s, pid)
        return OK
      case 'promo':
        return promoteUnit(s, u, c.id) ? OK : no()
      case 'upgrade': {
        if (c.all) {
          let n = 0
          for (const o of unitsOf(s, pid)) if (o.type === u.type && o !== u && !upgradeBlock(s, o) && upgradeUnit(s, o)) n++
          if (!upgradeBlock(s, u) && upgradeUnit(s, u)) n++
          note(s, pid, `Přezbrojeno jednotek: ${n}.`, 'good')
          return OK
        }
        const err = upgradeBlock(s, u)
        if (err) return no(err)
        return upgradeUnit(s, u) ? OK : no()
      }
      case 'order':
        if (c.o === 'auto') { stopUnit(u); u.auto = true; u.sleep = false; u.fortified = false }
        else if (c.o === 'fortify') { u.fortified = true; stopUnit(u); u.sleep = false }
        else if (c.o === 'sleep') { u.sleep = true; stopUnit(u) }
        else if (c.o === 'skip') u.skip = true
        else if (c.o === 'wake') { u.sleep = false; u.fortified = false; u.work = null; stopUnit(u); u.auto = false; u.skip = false }
        else return no()
        return OK
      case 'disband':
        killUnit(s, u); updateVisibility(s, pid)
        return OK
    }
  }

  if ('city' in c) {
    const city = cityById(s, c.city)
    if (!city || city.owner !== pid) return no('Toto město vám nepatří.')
    switch (c.t) {
      case 'build': { const err = enqueue(s, city, c.item, !!c.front); return err ? no(err) : OK }
      case 'unqueue': if (c.i >= city.queue.length) return no(); dequeue(s, city, c.i); return OK
      case 'promote': if (c.i < 0 || c.i >= city.queue.length) return no(); promote(s, city, c.i); return OK
      case 'advise': adviseBuild(s, city); return OK
      case 'border':
        if (c.mode === 'manual') city.border = 'manual'
        else if (c.mode === 'auto') { delete city.border; delete city.nextTile }
        if (c.tile !== undefined) {
          if (!borderOptions(s, city).includes(c.tile)) return no('Toto pole město zabrat nemůže.')
          city.nextTile = c.tile
        }
        // Je-li kultury dost, pole připadne městu hned.
        growBorders(s, city); assignWorkers(s, city)
        return OK
      case 'cityShoot': {
        if (city.fired) return no('Město už v tomto tahu střílelo.')
        const target = cityTargets(s, city).find(u => u.x === c.x && u.y === c.y && me.visible[c.y * s.W + c.x])
        if (!target) return no('Na tento cíl hradby nedostřelí.')
        cityShoot(s, city, target)
        city.fired = true
        updateVisibility(s, pid)
        return OK
      }
      case 'focus':
        if (c.focus) city.focus = c.focus; else delete city.focus
        assignWorkers(s, city)
        return OK
      case 'buy': return (c.item ? buyItem(s, city, c.item) : buy(s, city)) ? OK : no()
    }
  }

  switch (c.t) {
    case 'tradition': return adoptTradition(s, me, c.id) ? OK : no()
    case 'research': return planResearch(me, c.tech, !!c.append) ? OK : no()
    case 'tip': { const k = tipKey(pid, c.id); if (!s.tutorial.includes(k)) s.tutorial.push(k); return OK }
    case 'endTurn': endTurn(s, pid); return OK
    case 'war': case 'peace': case 'diplo': {
      const they = s.players[c.vs]
      if (!they || c.vs === pid || c.vs === barbId(s) || !they.alive) return no()
      if (c.t === 'war') { if (atWar(s, pid, c.vs)) return no(); declareWar(s, pid, c.vs); return OK }
      if (c.t === 'peace') {
        if (!atWar(s, pid, c.vs)) return no()
        if (they.human) {
          // Lidský soupeř odpoví, až bude na tahu.
          if (s.offers.some(o => o.from === pid && o.to === c.vs && o.kind !== 'ally')) return no('Nabídka míru už čeká na odpověď.')
          s.offers.push({ from: pid, to: c.vs })
          return { ok: true, text: `Nabídka míru odeslána. ${NATIONS[they.nation].name} odpovědí, až budou na tahu.` }
        }
        if (!aiAcceptsPeace(s, c.vs, pid)) return no('Odmítnuto. „Ještě jsme neskončili.“')
        makePeace(s, pid, c.vs)
        return { ok: true, text: 'Mír uzavřen.' }
      }
      if (c.kind === 'gift') return giveGold(s, c.vs, pid)
      // Obchod a spojenectví se zatím sjednávají jen se soupeři řízenými počítačem.
      if (they.human) return no('S lidským hráčem se domluvte osobně.')
      if (c.kind === 'sell') return sellResource(s, c.vs, c.arg as ResourceId, pid)
      if (c.kind === 'buy') return buyResource(s, c.vs, c.arg as ResourceId, pid)
      const foe = Number(c.arg)
      if (!s.players[foe] || foe === pid || foe === c.vs || foe === barbId(s)) return no()
      return askAlliance(s, c.vs, foe, pid)
    }
    case 'answer': {
      const o = s.offers.find(x => x.from === c.from && x.to === pid)
      if (!o) return no()
      s.offers = s.offers.filter(x => x !== o)
      const from = s.players[c.from]
      if (o.kind === 'ally') {
        // Nabídka mohla mezitím zastarat.
        if (!s.players[o.vs!].alive || !atWar(s, c.from, o.vs!) || atWar(s, pid, c.from) || atWar(s, pid, o.vs!)) return no()
        answerAlly(s, c.from, o.vs!, c.accept, pid)
        return OK
      }
      if (!atWar(s, pid, c.from)) return no()
      if (c.accept) makePeace(s, pid, c.from)
      else {
        note(s, pid, `Odmítli jste mír s národem ${NATIONS[from.nation].name}.`, 'info')
        note(s, c.from, `${NATIONS[me.nation].name} odmítli váš mír.`, 'bad')
      }
      return OK
    }
  }
  return no()
}
