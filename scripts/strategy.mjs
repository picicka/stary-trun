// Pokus s vyhraněnými strategiemi: jeden národ (hráč 0) dostane povahu dobyvatele s daným pořadím výzkumu a tradic,
// ostatní hrají podle svých povah. Každá varianta hraje tytéž partie (stejné mapy a národy), takže se dají srovnat.
//   node scripts/strategy.mjs [partií na variantu=24] [--jobs N] [--all] [--base] [--out soubor.json] [--log složka]
// --base: jen výchozí strategie. --log: do složky zapíše ladicí záznam každé partie.
// --all: variantu dostanou všichni dobyvatelé ve hře, ne jen hráč 0.
import { fork } from 'node:child_process'
import { cpus } from 'node:os'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d }

// Zbytek stromu se doplní za uvedené technologie v pořadí dobyvatele.
export const RESEARCH = {
  'výchozí': null,
  // Zbraně hned, hospodářství až potom.
  'nájezd': ['mining', 'bronze', 'archery', 'tactics', 'iron', 'armory', 'husbandry', 'wheel', 'riding', 'steel', 'agriculture', 'pottery', 'writing', 'currency', 'math', 'masonry', 'construction', 'engineering', 'siegecraft', 'chivalry'],
  // Nejkratší cesta ke katapultům, pak teprve pěchota.
  'katapulty': ['agriculture', 'writing', 'husbandry', 'wheel', 'currency', 'math', 'mining', 'bronze', 'archery', 'tactics', 'iron', 'armory', 'masonry', 'construction', 'engineering', 'steel', 'siegecraft', 'riding', 'chivalry'],
  // Nejkratší cesta ke zbrojnošům a trebuchetům.
  'ocel': ['mining', 'bronze', 'archery', 'iron', 'tactics', 'armory', 'steel', 'agriculture', 'writing', 'husbandry', 'wheel', 'currency', 'math', 'masonry', 'construction', 'engineering', 'siegecraft', 'riding', 'chivalry'],
  // Nejdřív hospodářství a věda, vojsko až s převahou.
  'hospodářství': ['agriculture', 'pottery', 'writing', 'husbandry', 'wheel', 'mining', 'currency', 'mysticism', 'masonry', 'math', 'construction', 'commerce', 'philosophy', 'bronze', 'archery', 'iron', 'tactics', 'armory', 'engineering', 'steel', 'siegecraft', 'riding', 'chivalry'],
  // Jízda: koně a rytíři.
  'jízda': ['husbandry', 'wheel', 'riding', 'mining', 'bronze', 'archery', 'agriculture', 'iron', 'tactics', 'armory', 'steel', 'chivalry', 'writing', 'currency', 'math', 'masonry', 'construction', 'engineering', 'siegecraft'],
}
const B = { war: ['militia', 'warrior', 'raiders', 'campaign'], land: ['stores', 'settlers', 'builders', 'craft'], lore: ['scribes', 'feasts', 'chroniclers', 'stargazers'], trade: ['trade', 'merchants', 'sea', 'fishers'] }
export const TRADS = {
  'výchozí': null,
  'válka': [...B.war, ...B.land, ...B.lore, ...B.trade],
  'země': [...B.land, ...B.war, ...B.lore, ...B.trade],
  'učenost': [...B.lore, ...B.war, ...B.land, ...B.trade],
  'obchod': [...B.trade, ...B.war, ...B.land, ...B.lore],
}

async function runGame(spec) {
  const { createGame, aiRound } = await import('../src/game/state.ts')
  const R = await import('../src/game/rules.ts')
  const D = await import('../src/game/data.ts')
  const L = await import('../src/game/log.ts')
  if (spec.logDir) { L.logClear(); L.logOn(true) }
  const rnd = (() => { let x = spec.seed * 2654435761 >>> 0; return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  const first = D.PLAYABLE[Math.floor(rnd() * D.PLAYABLE.length)]
  const random = spec.scenario === 'random'
  const s = createGame(first, 'normal', spec.scenario, random ? 1 + Math.floor(rnd() * 999983) : undefined, Math.floor(rnd() * 8), [], {
    nations: spec.nations, maxTurns: 160, map: { barbarians: 2, ...(random ? { landform: spec.landform, size: 0 } : {}) },
  })
  s.rng = (s.rng ^ Math.floor(rnd() * 0x7fffffff)) | 0
  const barb = s.players.length - 1
  const majors = s.players.filter(p => p.id !== barb)
  const base = D.PERSONAS.aggressive
  const r = RESEARCH[spec.research], t = TRADS[spec.trads]
  D.PERSONAS.subject = { ...base, research: r ? [...r, ...base.research.filter(x => !r.includes(x))] : base.research, traditions: t ?? base.traditions }
  for (const p of majors) { p.human = false; p.personality = D.NATIONS[p.nation].persona }
  if (spec.all) { for (const p of majors) if (p.personality === 'aggressive') p.personality = 'subject' }
  majors[0].personality = 'subject'
  s.notes = []
  const owner = new Map()
  let took = 0, lost = 0, firstWar = 0, firstTake = 0, error = null
  const mil = {}
  // Průběh tažení hráče 0: kolik jich naplánoval, na kolik vyrazil, jak dopadla a kolik ho stála.
  const camp = { plans: 0, gos: 0, firstPlan: 0, firstGo: 0, taken: 0, dropped: 0, expired: 0, minHp: [], lostUnits: 0, wallsAtGo: 0, engAtGo: 0, sizeAtGo: 0, exp: [] }
  let cur = null
  let prev = null, low = 1, myIds = new Set()
  try {
    while (!s.over && s.turn <= s.maxTurns + 1) {
      aiRound(s); R.drainEvents()
      if (!firstWar && majors[0].war.some(w => w !== barb)) firstWar = s.turn
      for (const c of s.cities) {
        const o = owner.get(c.id)
        if (o !== undefined && o !== c.owner) { if (c.owner === 0) { took++; firstTake ||= s.turn } else if (o === 0) lost++ }
        owner.set(c.id, c.owner)
      }
      {
        const sg = majors[0].siege ?? null
        const key = sg ? `${sg.city}:${sg.go ? 1 : 0}` : ''
        const pk = prev ? `${prev.city}:${prev.go ? 1 : 0}` : ''
        const tc = sg ? s.cities.find(c => c.id === sg.city) : null
        if (sg && (!prev || prev.city !== sg.city)) { camp.plans++; camp.firstPlan ||= s.turn }
        if (sg?.go && !(prev?.go && prev.city === sg.city)) {
          camp.gos++; camp.firstGo ||= s.turn; low = 1
          const army = R.unitsOf(s, 0).filter(u => !R.isCivilian(u))
          camp.sizeAtGo += army.reduce((a, u) => a + (u.size ?? 1), 0); camp.engAtGo += army.filter(u => D.UNITS[u.type].siege).length
          if (tc?.buildings.includes('walls')) camp.wallsAtGo++
          cur = { t0: s.turn, size: army.reduce((a, u) => a + (u.size ?? 1), 0), dist0: tc ? Math.min(...R.citiesOf(s, 0).map(c => Math.max(Math.abs(c.x - tc.x), Math.abs(c.y - tc.y)))) : -1, near: 99, at: 0, low: 1, lost: 0, owner: tc?.owner ?? -1, sea: false }
        }
        if (cur && sg?.go && tc) {
          const army = R.unitsOf(s, 0).filter(u => !R.isCivilian(u))
          const ds = army.map(u => Math.max(Math.abs(u.x - tc.x), Math.abs(u.y - tc.y))).sort((a, b) => a - b)
          cur.near = Math.min(cur.near, ds[Math.min(2, ds.length - 1)] ?? 99)
          cur.at = Math.max(cur.at, ds.filter(d => d <= 2).length)
          cur.low = Math.min(cur.low, tc.hp / R.cityMaxHp(tc))
          if (army.some(u => R.isEmbarked(s, u))) cur.sea = true
        }
        if (sg?.go && tc) low = Math.min(low, tc.hp / R.cityMaxHp(tc))
        // Konec tažení, na které se vyrazilo: město padlo, nebo se od něj ustoupilo.
        if (prev?.go && key !== pk) {
          const pc = s.cities.find(c => c.id === prev.city)
          if (pc && pc.owner === 0) camp.taken++; else { camp.dropped++; camp.minHp.push(low) }
          if (cur) {
            cur.dur = s.turn - cur.t0
            cur.why = pc && pc.owner === 0 ? 'dobyto' : !pc ? 'město zaniklo' : pc.owner !== cur.owner ? 'město vzal jiný' : !majors[0].alive ? 'vyhuben' : !majors[0].war.includes(cur.owner) ? 'mír' : sg && sg.city === prev.city ? 'ústup' : sg ? 'jiný cíl' : 'bez cíle'
            cur.endSize = R.unitsOf(s, 0).filter(u => !R.isCivilian(u)).reduce((a, u) => a + (u.size ?? 1), 0)
            camp.exp.push(cur); cur = null
          }
        }
        if (prev && !prev.go && !sg) camp.expired++
        prev = sg ? { city: sg.city, go: sg.go } : null
        const now = new Set(R.unitsOf(s, 0).filter(u => !R.isCivilian(u)).map(u => u.id))
        for (const id of myIds) if (!now.has(id)) camp.lostUnits++
        myIds = now
      }
      if (s.turn === 60 || s.turn === 100) mil[s.turn] = { n: R.unitsOf(s, 0).filter(u => !R.isCivilian(u)).reduce((a, u) => a + (u.size ?? 1), 0), techs: majors[0].techs.length, cities: R.citiesOf(s, 0).length }
    }
  } catch (e) { error = String(e && e.stack || e).slice(0, 400) }
  // Záznam partie do souboru: celý, a zvlášť jen války, mír a tažení hráče 0.
  if (spec.logDir) {
    const name = `${spec.logDir}/${spec.research}-${spec.trads}-${spec.seed}`
    writeFileSync(`${name}.txt`, L.logText(s))
    writeFileSync(`${name}.tazeni.txt`, L.logText(s, { kinds: ['válka', 'mír', 'tažení', 'město'], pid: 0 }))
  }
  const sc = majors.map(p => R.score(s, p.id))
  const order = majors.map(p => p.id).sort((a, b) => (Number(s.players[b].alive) - Number(s.players[a].alive)) || sc[b] - sc[a])
  const kind = !s.over ? 'nedohráno' : s.over.how === 'wonder' ? 'chrám' : s.over.how === 'score' ? 'skóre' : 'dobytí'
  const winner = s.over ? (s.over.winner >= 0 ? s.over.winner : order[0]) : -1
  const p = majors[0]
  return { spec, error, camp, kind, winner, turn: s.turn, won: winner === 0, alive: p.alive, rank: order.indexOf(0) + 1, took, lost, firstWar, firstTake, mil,
    cities: R.citiesOf(s, 0).length, techs: p.techs.length, trad: p.traditions.length, score: sc[0] }
}

if (args.includes('--worker')) {
  process.on('message', async spec => { process.send(await runGame(spec)) })
} else {
  const per = Number(args.find(a => /^\d+$/.test(a)) ?? 24)
  const all = args.includes('--all')
  const setups = [{ scenario: 'valley', landform: '', nations: 4 }, { scenario: 'random', landform: 'continent', nations: 4 }, { scenario: 'random', landform: 'continents', nations: 6 }]
  const specs = []
  const one = args.includes('--base')
  for (const research of Object.keys(RESEARCH)) for (const trads of Object.keys(TRADS)) for (let k = 0; k < per; k++) if (!one || (research === 'výchozí' && trads === 'výchozí')) specs.push({ research, trads, all, logDir: flag('log', ''), seed: 1000 + k, ...setups[k % setups.length] })
  const jobs = Number(flag('jobs', Math.max(1, cpus().length - 2)))
  const results = []
  let next = 0
  await new Promise(done => {
    let live = 0
    for (let j = 0; j < jobs; j++) {
      const w = fork(fileURLToPath(import.meta.url), ['--worker'])
      live++
      const give = () => { if (next < specs.length) w.send(specs[next++]); else { w.kill(); if (--live === 0) done() } }
      w.on('message', r => { results.push(r); if (results.length % 50 === 0) process.stderr.write(`${results.length}/${specs.length}\n`); give() })
      give()
    }
  })
  if (flag('out', '')) writeFileSync(flag('out', ''), JSON.stringify(results))
  const avg = (a, f) => a.length ? a.reduce((x, r) => x + f(r), 0) / a.length : 0
  const row = (name, rs) => `${name.padEnd(28)} ${String(rs.length).padStart(4)} ${String(rs.filter(r => r.won && r.kind === 'dobytí').length).padStart(7)} ${String(rs.filter(r => r.won).length).padStart(6)} ${avg(rs, r => r.rank).toFixed(2).padStart(7)} ${avg(rs, r => r.took).toFixed(2).padStart(7)} ${avg(rs, r => r.lost).toFixed(2).padStart(7)} ${String(rs.filter(r => !r.alive).length).padStart(7)} ${avg(rs.filter(r => r.firstWar), r => r.firstWar).toFixed(0).padStart(7)} ${avg(rs.filter(r => r.firstTake), r => r.firstTake).toFixed(0).padStart(7)} ${avg(rs, r => r.cities).toFixed(1).padStart(6)} ${avg(rs, r => r.techs).toFixed(1).padStart(6)} ${avg(rs, r => r.mil[100]?.n ?? 0).toFixed(1).padStart(7)}`
  const head = `${'varianta'.padEnd(28)} ${'her'.padStart(4)} ${'dobytí'.padStart(7)} ${'výher'.padStart(6)} ${'pořadí'.padStart(7)} ${'dobyl'.padStart(7)} ${'ztratil'.padStart(7)} ${'vyhuben'.padStart(7)} ${'válka'.padStart(7)} ${'1.zisk'.padStart(7)} ${'měst'.padStart(6)} ${'techn.'.padStart(6)} ${'voj@100'.padStart(7)}`
  console.log(`Hráč 0 jako dobyvatel s danou strategií${all ? ' (stejně i ostatní dobyvatelé)' : ''}; ${per} partií na variantu.\n`)
  console.log(head)
  for (const research of Object.keys(RESEARCH)) for (const trads of Object.keys(TRADS)) console.log(row(`${research} / ${trads}`, results.filter(r => r.spec.research === research && r.spec.trads === trads)))
  console.log('\nPodle výzkumu:\n' + head)
  for (const research of Object.keys(RESEARCH)) console.log(row(research, results.filter(r => r.spec.research === research)))
  console.log('\nPodle tradic:\n' + head)
  for (const trads of Object.keys(TRADS)) console.log(row(trads, results.filter(r => r.spec.trads === trads)))
  const sum = f => results.reduce((a, r) => a + f(r.camp), 0)
  const lows = results.flatMap(r => r.camp.minHp)
  console.log(`\nTažení hráče 0 (průměr na partii): plánů ${(sum(c => c.plans) / results.length).toFixed(2)}, výprav ${(sum(c => c.gos) / results.length).toFixed(2)}, dobytých měst z výprav ${(sum(c => c.taken) / results.length).toFixed(2)}, vzdaných výprav ${(sum(c => c.dropped) / results.length).toFixed(2)}, plánů bez výpravy ${(sum(c => c.expired) / results.length).toFixed(2)}, ztracených jednotek ${(sum(c => c.lostUnits) / results.length).toFixed(1)}.`)
  console.log(`První plán v tahu ${avg(results.filter(r => r.camp.firstPlan), r => r.camp.firstPlan).toFixed(0)}, první výprava v tahu ${avg(results.filter(r => r.camp.firstGo), r => r.camp.firstGo).toFixed(0)} (aspoň jedna v ${results.filter(r => r.camp.firstGo).length} z ${results.length} partií).`)
  console.log(`Při výpravě: vojsko ${(sum(c => c.sizeAtGo) / Math.max(1, sum(c => c.gos))).toFixed(1)} jednotek, z toho strojů ${(sum(c => c.engAtGo) / Math.max(1, sum(c => c.gos))).toFixed(1)}; cíl s hradbami v ${Math.round(100 * sum(c => c.wallsAtGo) / Math.max(1, sum(c => c.gos)))} %.`)
  console.log(`Vzdané výpravy: hradby cíle klesly nejníž průměrně na ${Math.round(100 * (lows.reduce((a, b) => a + b, 0) / Math.max(1, lows.length)))} %; pod 25 % v ${lows.filter(x => x < 0.25).length} z ${lows.length}, vůbec nepoškozené (nad 90 %) v ${lows.filter(x => x > 0.9).length}.`)
  const ex = results.flatMap(r => r.camp.exp)
  const by = {}
  for (const e of ex) (by[e.why] ??= []).push(e)
  console.log('\nVýpravy podle konce (počet; trvání; vojsko na začátku → na konci; vzdálenost cíle od vlastního města; nejblíž se třetí jednotka dostala; nejvíc jednotek do 2 polí; nejnižší stav hradeb; po moři):')
  for (const [why, a] of Object.entries(by)) console.log(`  ${why.padEnd(16)} ${String(a.length).padStart(4)}  ${avg(a, e => e.dur).toFixed(1).padStart(5)} t.  ${avg(a, e => e.size).toFixed(1)} → ${avg(a, e => e.endSize).toFixed(1)}  vzdál. ${avg(a, e => e.dist0).toFixed(1)}  nejblíž ${avg(a, e => e.near).toFixed(1)}  u města ${avg(a, e => e.at).toFixed(1)}  hradby ${Math.round(100 * avg(a, e => e.low))} %  moře ${Math.round(100 * avg(a, e => e.sea ? 1 : 0))} %`)
  const kinds = {}
  for (const r of results) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1
  console.log('\nKonce partií:', JSON.stringify(kinds), ' chyby:', results.filter(r => r.error).length, results.find(r => r.error)?.error ?? '')
}
