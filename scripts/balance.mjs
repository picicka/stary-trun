// Hromadná simulace: počítač proti počítači v mnoha partiích napříč mapami, počty národů a povahami.
// Ukáže, jak si vedou národy, povahy a startovní místa, čím hry končí a jak se soupeři chovají.
//   node scripts/balance.mjs [her na kombinaci=3] [--jobs N] [--out soubor.json] [--only valley|islands|random] [--quick]
import { fork } from 'node:child_process'
import { cpus } from 'node:os'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d }
const WORKER = args.includes('--worker')

// ---------------------------------------------------------------- jedna partie

async function runGame(spec) {
  const { createGame, aiRound } = await import('../src/game/state.ts')
  const R = await import('../src/game/rules.ts')
  const { NATIONS, PERSONA_IDS, PLAYABLE } = await import('../src/game/data.ts')
  const t0 = Date.now()
  const rnd = (() => { let x = spec.id * 2654435761 >>> 0; return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  const first = PLAYABLE[Math.floor(rnd() * PLAYABLE.length)]
  const random = spec.scenario === 'random'
  const s = createGame(first, spec.difficulty, spec.scenario, random ? 1 + Math.floor(rnd() * 999983) : undefined, Math.floor(rnd() * 8), [], {
    nations: spec.nations, maxTurns: spec.maxTurns, map: { barbarians: spec.barbarians, ...(random ? { landform: spec.landform, size: 0 } : {}) },
  })
  // Na pevných mapách ať se partie liší aspoň průběhem.
  s.rng = (s.rng ^ Math.floor(rnd() * 0x7fffffff)) | 0
  const barb = s.players.length - 1
  const majors = s.players.filter(p => p.id !== barb)
  // Místo hráče převezme počítač; povaha podle národa, nebo vylosovaná nezávisle na něm.
  for (const p of majors) {
    p.human = false
    p.personality = spec.persona === 'random' ? PERSONA_IDS[Math.floor(rnd() * PERSONA_IDS.length)] : NATIONS[p.nation].persona
  }
  s.notes = []
  const startOf = majors.map(p => { const u = s.units.find(v => v.owner === p.id && v.type === 'settler'); return u ? [u.x, u.y] : [0, 0] })
  const wars = [], captures = []
  let peace = 0
  const cityOwner = new Map()
  const firstCity = majors.map(() => 0)
  const snap = {}
  let prevWar = majors.map(p => p.war.slice())
  let error = null
  try {
    while (!s.over && s.turn <= s.maxTurns + 1) {
      aiRound(s)
      R.drainEvents()
      for (const p of majors) {
        if (!firstCity[p.id] && R.citiesOf(s, p.id).length) firstCity[p.id] = s.turn
        for (const w of p.war) if (w !== barb && w > p.id && !prevWar[p.id].includes(w)) wars.push({ t: s.turn, a: p.id, b: w })
        for (const w of prevWar[p.id]) if (w !== barb && w > p.id && !p.war.includes(w) && s.players[w].alive && p.alive) peace++
      }
      prevWar = majors.map(p => p.war.slice())
      for (const c of s.cities) {
        const o = cityOwner.get(c.id)
        if (o !== undefined && o !== c.owner) captures.push({ t: s.turn, from: o, to: c.owner })
        cityOwner.set(c.id, c.owner)
      }
      if (s.turn === 30 || s.turn === 60 || s.turn === 90) snap[s.turn] = majors.map(p => ({ c: R.citiesOf(s, p.id).length, sc: R.score(s, p.id), mil: R.unitsOf(s, p.id).filter(u => !R.isCivilian(u)).length }))
    }
  } catch (e) { error = String(e && e.stack || e).slice(0, 600) }
  const sc = majors.map(p => R.score(s, p.id))
  const order = majors.map(p => p.id).sort((a, b) => (Number(s.players[b].alive) - Number(s.players[a].alive)) || sc[b] - sc[a])
  let kind = 'nedohráno'
  if (s.over) kind = s.over.how === 'wonder' ? 'chrám' : s.over.how === 'score' ? 'skóre' : 'dobytí'
  const winner = s.over ? (s.over.winner >= 0 ? s.over.winner : order[0]) : -1
  return {
    spec, error, ms: Date.now() - t0, turn: s.turn, kind, winner, W: s.W, H: s.H,
    wars, captures, peace, camps: s.mission.campsDestroyed, snap,
    barbCities: s.cities.filter(c => c.owner === barb).length,
    players: majors.map(p => {
      const cs = R.citiesOf(s, p.id)
      return {
        nation: p.nation, persona: p.personality, alive: p.alive, score: sc[p.id], rank: order.indexOf(p.id) + 1, slot: startOf[p.id].join(','),
        cities: cs.length, pop: cs.reduce((a, c) => a + c.pop, 0), techs: p.techs.length, trad: p.traditions.length, gold: p.gold,
        mil: R.unitsOf(s, p.id).filter(u => !R.isCivilian(u)).length, firstCity: firstCity[p.id], wonder: cs.some(c => c.buildings.includes('wonder')),
        took: captures.filter(c => c.to === p.id).length, lost: captures.filter(c => c.from === p.id).length,
        declared: wars.filter(w => w.a === p.id || w.b === p.id).length,
      }
    }),
  }
}

if (WORKER) {
  process.on('message', async spec => { process.send(await runGame(spec)) })
} else {
  // ---------------------------------------------------------------- zadání a rozdělení práce
  globalThis.__data = await import('../src/game/data.ts')
  const per = Number(args.find(a => /^\d+$/.test(a)) ?? 3)
  const only = flag('only', '')
  const quick = args.includes('--quick')
  const maps = [
    { scenario: 'valley', landform: '' }, { scenario: 'islands', landform: '' },
    { scenario: 'random', landform: 'continent' }, { scenario: 'random', landform: 'continents' }, { scenario: 'random', landform: 'islands' },
  ].filter(m => !only || m.scenario === only)
  const counts = quick ? [3, 5] : [2, 3, 4, 6, 8]
  const specs = []
  let id = 1
  for (const persona of ['nation', 'random']) for (const m of maps) for (const n of counts) for (let k = 0; k < per; k++) {
    specs.push({ id: id++, ...m, nations: n, persona, difficulty: flag('difficulty', 'normal'), maxTurns: Number(flag('turns', 160)), barbarians: 2 })
  }
  const jobs = Math.min(specs.length, Number(flag('jobs', Math.max(1, cpus().length - 3))))
  console.error(`${specs.length} partií, ${jobs} procesů…`)
  const t0 = Date.now()
  const results = []
  // Největší partie napřed, ať se práce rozloží rovnoměrně.
  const queue = specs.slice().sort((a, b) => b.nations - a.nations)
  await Promise.all(Array.from({ length: jobs }, () => new Promise(done => {
    const w = fork(fileURLToPath(import.meta.url), ['--worker'])
    const next = () => { const sp = queue.shift(); if (!sp) { w.kill(); done(); return } w.send(sp) }
    w.on('message', r => { results.push(r); if (results.length % 20 === 0) console.error(`  ${results.length}/${specs.length}`); next() })
    w.on('exit', code => { if (code) console.error('proces skončil s kódem', code); done() })
    next()
  })))
  results.sort((a, b) => a.spec.id - b.spec.id)
  const out = flag('out', '')
  if (out) writeFileSync(out, JSON.stringify(results))
  report(results, (Date.now() - t0) / 1000)
}

// ---------------------------------------------------------------- vyhodnocení

function report(res, secs) {
  const { NATIONS, PERSONAS } = globalThis.__data
  const pct = (a, b) => (b ? `${Math.round(100 * a / b)} %` : '–').padStart(5)
  const f1 = v => (Number.isFinite(v) ? v.toFixed(1) : '–').padStart(6)
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN)
  const pad = (s, n) => String(s).padEnd(n)
  const ok = res.filter(r => !r.error)
  const mapName = r => (r.spec.scenario === 'random' ? `náhodná/${r.spec.landform}` : r.spec.scenario)
  console.log(`\n=== SIMULACE: ${res.length} partií za ${secs.toFixed(0)} s (průměr ${f1(avg(res.map(r => r.ms / 1000))).trim()} s na partii) ===`)
  const bad = res.filter(r => r.error)
  console.log(`Chyby za běhu: ${bad.length}${bad.length ? '\n' + bad.slice(0, 5).map(r => `  #${r.spec.id} ${mapName(r)} ${r.spec.nations}: ${r.error}`).join('\n') : ''}`)
  console.log(`Nedohrané partie: ${ok.filter(r => r.kind === 'nedohráno').length}`)

  const table = (title, groups, extra = '') => {
    console.log(`\n--- ${title} ---${extra}`)
    console.log(`${pad('', 22)} partií  výher  čekáno  poměr  ø pořadí*  ø skóre  ø měst  ø tech  vyhlazen  ø válek  dobyl  ztratil  chrám`)
    for (const [name, rows] of groups) {
      const n = rows.length
      if (!n) continue
      const wins = rows.filter(x => x.win).length
      const exp = rows.reduce((a, x) => a + 1 / x.n, 0)
      console.log(`${pad(name, 22)} ${String(n).padStart(5)}  ${String(wins).padStart(5)}  ${f1(exp)}  ${f1(wins / exp)}  ${f1(avg(rows.map(x => x.relRank)))}    ${f1(avg(rows.map(x => x.p.score)))}  ${f1(avg(rows.map(x => x.p.cities)))}  ${f1(avg(rows.map(x => x.p.techs)))}     ${pct(rows.filter(x => !x.p.alive).length, n)}   ${f1(avg(rows.map(x => x.p.declared)))} ${f1(avg(rows.map(x => x.p.took)))}   ${f1(avg(rows.map(x => x.p.lost)))}  ${pct(rows.filter(x => x.p.wonder).length, n)}`)
    }
  }
  // Řádek za každého hráče v každé partii; relRank: 0 = první, 1 = poslední.
  const rows = ok.flatMap(r => r.players.map((p, i) => ({ r, p, i, n: r.players.length, win: r.winner === i, relRank: r.players.length > 1 ? (p.rank - 1) / (r.players.length - 1) : 0 })))
  const by = (list, key) => { const m = new Map(); for (const x of list) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x) } return [...m].sort((a, b) => String(a[0]).localeCompare(String(b[0]))) }
  const note = '\n(poměr = výhry / očekávané výhry při rovných šancích; 1,0 je vyvážené. *pořadí 0 = první, 1 = poslední)'

  table('NÁRODY s vlastní povahou', by(rows.filter(x => x.r.spec.persona === 'nation'), x => `${NATIONS[x.p.nation].name} (${PERSONAS[x.p.persona].name})`), note)
  table('NÁRODY s vylosovanou povahou (čistý vliv národa)', by(rows.filter(x => x.r.spec.persona === 'random'), x => NATIONS[x.p.nation].name))
  table('POVAHY vylosované nezávisle na národu (čistý vliv povahy)', by(rows.filter(x => x.r.spec.persona === 'random'), x => PERSONAS[x.p.persona].name))
  table('POVAHY podle typu mapy (vylosované)', by(rows.filter(x => x.r.spec.persona === 'random'), x => `${mapName(x.r).slice(0, 12)} ${PERSONAS[x.p.persona].name}`))
  table('POŘADÍ NA TAHU (místo v seznamu hráčů)', by(rows, x => `${x.i + 1}. hráč`))

  console.log('\n--- STARTOVNÍ MÍSTA na pevných mapách (souřadnice startu) ---')
  for (const [k, list] of by(rows.filter(x => x.r.spec.scenario !== 'random'), x => `${x.r.spec.scenario} ${x.r.W}×${x.r.H}`)) {
    console.log(`${k}:`)
    for (const [slot, l] of by(list, x => x.p.slot)) {
      const exp = l.reduce((a, x) => a + 1 / x.n, 0), wins = l.filter(x => x.win).length
      console.log(`   start ${pad(slot, 6)} her ${String(l.length).padStart(3)}  výher ${String(wins).padStart(2)} (čekáno ${f1(exp).trim()})  ø pořadí ${f1(avg(l.map(x => x.relRank))).trim()}  ø skóre ${f1(avg(l.map(x => x.p.score))).trim()}  ø měst ${f1(avg(l.map(x => x.p.cities))).trim()}  vyhlazen ${pct(l.filter(x => !x.p.alive).length, l.length).trim()}  1. město v tahu ${f1(avg(l.map(x => x.p.firstCity || 99))).trim()}`)
    }
  }

  console.log('\n--- PRŮBĚH HER podle mapy a počtu národů ---')
  console.log(`${pad('', 26)} her  chrám  dobytí  skóre   ø konec  ø válek  ø mírů  ø dobytých měst  ø vyhlazených  ø táborů  měst barbarů`)
  for (const [k, l] of by(ok, r => `${pad(mapName(r), 19)} ${r.spec.nations} nár.`)) {
    const c = kind => String(l.filter(r => r.kind === kind).length).padStart(5)
    console.log(`${pad(k, 26)} ${String(l.length).padStart(3)}  ${c('chrám')}  ${c('dobytí')}  ${c('skóre')}   ${f1(avg(l.map(r => r.turn)))}   ${f1(avg(l.map(r => r.wars.length)))}  ${f1(avg(l.map(r => r.peace)))}         ${f1(avg(l.map(r => r.captures.length)))}         ${f1(avg(l.map(r => r.players.filter(p => !p.alive).length)))}    ${f1(avg(l.map(r => r.camps)))}        ${f1(avg(l.map(r => r.barbCities)))}`)
  }
  const kinds = by(ok, r => r.kind).map(([k, l]) => `${k} ${l.length}`).join(', ')
  console.log(`Celkem: ${kinds}. První válka průměrně v tahu ${f1(avg(ok.filter(r => r.wars.length).map(r => r.wars[0].t))).trim()}; bez jediné války ${ok.filter(r => !r.wars.length).length} partií.`)

  console.log('\n--- PODEZŘELÉ CHOVÁNÍ ---')
  const noCity = rows.filter(x => !x.p.firstCity)
  console.log(`Národ, který nikdy nezaložil město: ${noCity.length}${noCity.length ? ' – ' + noCity.slice(0, 8).map(x => `#${x.r.spec.id} ${NATIONS[x.p.nation].name}`).join(', ') : ''}`)
  const late = rows.filter(x => x.p.firstCity > 6)
  console.log(`První město až po 6. tahu: ${late.length}${late.length ? ' – ' + late.slice(0, 8).map(x => `#${x.r.spec.id} ${NATIONS[x.p.nation].name} (tah ${x.p.firstCity}, ${mapName(x.r)})`).join(', ') : ''}`)
  const one = rows.filter(x => x.p.alive && x.p.cities <= 1 && x.r.turn > 100)
  console.log(`Živý národ s nejvýš jedním městem na konci dlouhé hry: ${one.length} z ${rows.length}`)
  const runaway = ok.filter(r => { const v = r.players.map(p => p.score).sort((a, b) => b - a); return v.length > 1 && v[0] > v[1] * 1.8 })
  console.log(`Partie s drtivým náskokem vítěze (skóre aspoň 1,8× druhého): ${runaway.length} z ${ok.length}`)
  const early = ok.filter(r => r.turn < 60)
  console.log(`Partie rozhodnuté před 60. tahem: ${early.length}${early.length ? ' – ' + early.slice(0, 8).map(r => `#${r.spec.id} ${mapName(r)} ${r.spec.nations} nár. tah ${r.turn} ${r.kind}`).join(', ') : ''}`)
}
