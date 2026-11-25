// Ověření hry po síti: hostitel a dva hráči (tři panely), místnost, střídání tahů, výpadek a návrat.
// Bez parametru běží přes náhradní spojení mezi panely (?net=local); s parametrem "peer" přes skutečné WebRTC.
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5173'
const dir = process.argv[3] || '/tmp/civ-mp/net'
const real = process.argv[4] === 'peer'
const q = real ? '' : '?net=local'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const errors = []
const open = async (name, url) => {
  // Skutečné spojení: každý hráč má vlastní prohlížečový profil, jako na jiném počítači.
  const page = await (real ? await browser.newContext({ viewport: { width: 1440, height: 900 } }) : ctx).newPage()
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`) })
  await page.goto(url)
  await page.waitForFunction(() => window.game?.isRunning)
  await page.waitForTimeout(300)
  return page
}
const st = page => page.evaluate(() => { const a = window.app, s = a.state; return { me: a.me, cur: s.cur, turn: s.turn, myTurn: a.myTurn, ready: a.net?.ready, end: document.querySelector('#endturn')?.textContent, wait: document.querySelector('#waiting')?.classList.contains('hidden') ? '' : document.querySelector('#waiting')?.textContent, nation: document.querySelector('#topbar .nation')?.textContent, cities: s.cities.length, units: s.units.length, rng: s.rng } })
const out = {}
let pages = []
try {
const host = await open('host', base + '/' + q)
await host.evaluate(() => localStorage.clear()); await host.reload(); await host.waitForFunction(() => window.game?.isRunning); await host.waitForTimeout(300)
await host.click('[data-a="m-net"]')
await host.fill('#netname', 'Jakub')
await host.screenshot({ path: `${dir}/1-net.png` })
await host.click('[data-a="n-host"]')
await host.click('[data-a="m-nations"][data-v="4"]')
// Tenhle průchod ověřuje střídání tahů; souběžné tahy má scripts/simul.mjs.
await host.click('[data-a="m-simul"][data-v="0"]')
await host.screenshot({ path: `${dir}/2-setup.png` })
await host.click('[data-a="n-open"]')
await host.waitForSelector('.roomcode', { timeout: 20000 })
const code = await host.textContent('.roomcode')
out.code = code
out.url = await host.inputValue('#neturl')
// První hráč přijde odkazem, druhý zadá kód ručně.
const p1 = await open('anna', out.url)
await p1.fill('#netname', 'Anna')
out.prefilled = await p1.inputValue('#netcode')
await p1.click('[data-a="n-join"]')
await p1.waitForSelector('.roomcode', { timeout: 30000 })
const p2 = await open('bob', base + '/' + q)
await p2.click('[data-a="m-net"]')
await p2.fill('#netname', 'Bob')
await p2.fill('#netcode', code.toLowerCase())
await p2.click('[data-a="n-join"]')
await p2.waitForSelector('.roomcode', { timeout: 30000 })
await p1.click('[data-a="n-pick"][data-v="khar"]')
await p2.click('[data-a="n-pick"][data-v="lume"]')
await host.click('[data-a="n-pick"][data-v="thal"]')
await host.waitForTimeout(500)
out.members = await host.evaluate(() => [...document.querySelectorAll('.member')].map(m => m.textContent))
out.takenForBob = await p2.evaluate(() => [...document.querySelectorAll('.ntile.taken')].map(m => m.dataset.v))
await host.screenshot({ path: `${dir}/3-lobby-host.png` })
await p2.screenshot({ path: `${dir}/4-lobby-bob.png` })
await host.click('[data-a="n-start"]')
for (const p of [host, p1, p2]) await p.waitForFunction(() => window.app.inGame && window.app.state, null, { timeout: 20000 })
await host.waitForTimeout(800)
out.start = [await st(host), await st(p1), await st(p2)]
await host.screenshot({ path: `${dir}/5-host-brief.png` })
await p1.screenshot({ path: `${dir}/6-anna-brief.png` })
for (const p of [host, p1, p2]) await p.click('[data-a="close"]')
pages = [host, p1, p2]
const hashes = () => Promise.all(pages.map(p => p.evaluate(() => { const s = window.app.state; return [s.turn, s.cur, s.rng, s.units.length, s.cities.length, s.units.map(u => u.x * 100 + u.y).join()].join('|') })))
const same = async () => new Set(await hashes()).size === 1
// Hráč mimo tah nic nezmění.
await p1.keyboard.press('b'); await p1.waitForTimeout(300)
out.offTurnFound = (await st(p1)).cities
for (let k = 0; k < 9; k++) {
  const cur = (await st(host)).cur
  const p = pages[cur]
  await p.bringToFront()
  await p.waitForFunction(() => window.app.myTurn && !window.app.busy, null, { timeout: 15000 })
  if (k < 3) { await p.keyboard.press('b'); await p.waitForTimeout(900); await p.keyboard.press('Escape') }
  else {
    // Pohyb jednotkou a výroba ve městě.
    await p.evaluate(() => { const a = window.app, s = a.state; const u = s.units.find(v => v.owner === a.me && v.type === 'warrior'); if (u) { a.select(u); const t = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(d => [u.x + d[0], u.y + d[1]]); for (const [x, y] of t) { if (a.busy) break; a.onTileClick(x, y, true) } } })
    await p.waitForFunction(() => !window.app.busy)
  }
  if (k === 1) await pages[2].screenshot({ path: `${dir}/7-bob-waits.png` })
  await p.keyboard.press('Shift+Enter')
  await host.waitForFunction(c => window.app.state.cur !== c || window.app.state.over, cur, { timeout: 20000 })
  for (const q of pages) await q.waitForFunction(() => !window.app.busy, null, { timeout: 20000 })
  await host.waitForTimeout(400)
  if (!(await same())) { out.diverged = { k, h: await hashes() }; break }
}
out.afterTurns = [await st(host), await st(p1), await st(p2)]
out.loads = await Promise.all(pages.map(p => p.evaluate(() => window.app.hud ? 1 : 0)))
await p1.screenshot({ path: `${dir}/8-anna-turn.png` })
// Výpadek: Anna zavře panel, když je na tahu hostitel; hostitel dohraje, pak ukončí tah za ni.
const seat = await p1.evaluate(() => sessionStorage.getItem('hex4x-join') ?? localStorage.getItem('hex4x-join'))
await p1.close()
await host.bringToFront()
await host.waitForFunction(() => !window.app.net.online(1), null, { timeout: 30000 })
await host.keyboard.press('Shift+Enter')
await host.waitForFunction(() => window.app.state.cur === 1 && !window.app.busy, null, { timeout: 15000 })
await host.waitForTimeout(500)
out.offline = await st(host)
await host.screenshot({ path: `${dir}/9-host-offline.png` })
await host.click('#endturn'); await host.waitForTimeout(300)
await host.screenshot({ path: `${dir}/10-host-confirm.png` })
await host.click('#confirm-yes')
await host.waitForFunction(() => window.app.state.cur === 2 && !window.app.busy, null, { timeout: 15000 })
// Anna se vrací odkazem na totéž místo.
const p1b = await open('anna2', out.url)
await p1b.evaluate(([v, r]) => (r ? localStorage : sessionStorage).setItem('hex4x-join', v), [seat, real])
out.rejoinButton = await p1b.evaluate(() => !!document.querySelector('[data-a="n-rejoin"]') || document.querySelector('#netcode')?.value)
await p1b.click('[data-a="n-join"]')
await p1b.waitForFunction(() => window.app.inGame && window.app.net?.ready, null, { timeout: 30000 })
await p1b.waitForTimeout(600)
pages[1] = p1b
out.back = await st(p1b)
await p2.bringToFront()
await p2.waitForFunction(() => window.app.myTurn && !window.app.busy)
await p2.keyboard.press('Shift+Enter')
await host.waitForFunction(() => window.app.state.cur === 0 && !window.app.busy, null, { timeout: 20000 })
await host.waitForTimeout(600)
out.sameAfterRejoin = await same()
out.final = [await st(host), await st(p1b), await st(p2)]
await p1b.screenshot({ path: `${dir}/11-anna-back.png` })
// Hostitel obnoví stránku a pokračuje v uložené hře; hráči se sami připojí zpět.
await host.reload(); await host.waitForFunction(() => window.game?.isRunning); await host.waitForTimeout(400)
await host.click('[data-a="m-continue"]')
await host.waitForFunction(() => window.app.inGame && window.app.net?.started, null, { timeout: 30000 })
await host.waitForFunction(() => window.app.net.online(1) && window.app.net.online(2), null, { timeout: 40000 })
for (const p of [p1b, p2]) await p.waitForFunction(() => window.app.net?.ready, null, { timeout: 40000 })
await host.waitForTimeout(800)
out.afterHostReload = { same: await same(), st: [await st(host), await st(p1b), await st(p2)] }
await host.keyboard.press('Shift+Enter')
await p1b.waitForFunction(() => window.app.myTurn && !window.app.busy, null, { timeout: 20000 })
out.sameAtEnd = await same()
await host.screenshot({ path: `${dir}/12-host-resumed.png` })
} catch (e) { out.failed = String(e).slice(0, 300); out.states = await Promise.all(pages.map(p => st(p).catch(() => 'zavřeno'))) }
out.errors = errors
console.log(JSON.stringify(out, null, 1))
await browser.close()
