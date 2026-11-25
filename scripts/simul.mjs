// Ověření souběžných tahů po síti: hostitel a dva hráči (tři panely) táhnou zároveň, dokud se nepotkají.
// Běží přes náhradní spojení mezi panely (?net=local); potřebuje běžící `npm run dev`.
import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5173'
const dir = process.argv[3] || '/tmp/civ-mp/simul'
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const errors = []
const open = async (name, url) => {
  const page = await ctx.newPage()
  page.on('pageerror', e => errors.push(`${name}: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error') errors.push(`${name}: ${m.text()}`) })
  await page.goto(url)
  await page.waitForFunction(() => window.game?.isRunning)
  await page.waitForTimeout(300)
  return page
}
const st = page => page.evaluate(() => { const a = window.app, s = a.state; return { me: a.me, turn: s.turn, myTurn: a.myTurn, done: s.done, groups: s.groups, cities: s.cities.length, end: document.querySelector('#endturn')?.textContent, wait: document.querySelector('#waiting')?.textContent } })
const out = {}
try {
  const host = await open('host', base + '/?net=local')
  await host.evaluate(() => localStorage.clear()); await host.reload(); await host.waitForFunction(() => window.game?.isRunning); await host.waitForTimeout(300)
  await host.click('[data-a="m-net"]'); await host.fill('#netname', 'Jakub'); await host.click('[data-a="n-host"]')
  await host.click('[data-a="m-nations"][data-v="4"]')
  await host.screenshot({ path: `${dir}/1-setup.png` })
  await host.click('[data-a="n-open"]')
  await host.waitForSelector('.roomcode', { timeout: 20000 })
  const code = await host.textContent('.roomcode')
  const join = async name => { const p = await open(name, base + '/?net=local'); await p.click('[data-a="m-net"]'); await p.fill('#netname', name); await p.fill('#netcode', code); await p.click('[data-a="n-join"]'); await p.waitForSelector('.roomcode', { timeout: 30000 }); return p }
  const p1 = await join('Anna'), p2 = await join('Bob')
  await host.waitForTimeout(400)
  await host.screenshot({ path: `${dir}/2-lobby.png` })
  await host.click('[data-a="n-start"]')
  const pages = [host, p1, p2]
  for (const p of pages) await p.waitForFunction(() => window.app.inGame && window.app.state, null, { timeout: 20000 })
  await host.waitForTimeout(800)
  for (const p of pages) await p.click('[data-a="close"]')
  out.start = await Promise.all(pages.map(st))
  const hash = p => p.evaluate(() => { const s = window.app.state; return [s.turn, s.rng, s.units.length, s.cities.length, (s.done || []).join(), s.units.map(u => u.x * 100 + u.y).join()].join('|') })
  const same = async () => new Set(await Promise.all(pages.map(hash))).size === 1
  const settle = async (what, turn) => { for (let k = 0; k < 80; k++) { if (await same() && (turn === undefined || (await st(host)).turn === turn)) return true; await host.waitForTimeout(100) } out[`neshoda: ${what}`] = await Promise.all(pages.map(hash)); return false }
  // Všichni tři založí město ve stejné chvíli.
  await Promise.all(pages.map(p => p.keyboard.press('b')))
  await host.waitForTimeout(1200)
  for (const p of pages) await p.keyboard.press('Escape')
  out.foundedSame = await settle('založení měst')
  out.afterFound = await Promise.all(pages.map(st))
  await p1.screenshot({ path: `${dir}/3-anna-city.png` })
  // Anna a Bob ukončí tah, hostitel ještě hraje.
  const endTurn = p => p.evaluate(() => window.app.endTurn())
  await endTurn(p1); await endTurn(p2)
  await host.waitForTimeout(700)
  out.twoDone = await Promise.all(pages.map(st))
  await p1.screenshot({ path: `${dir}/4-anna-waits.png` })
  await host.screenshot({ path: `${dir}/5-host-plays.png` })
  await endTurn(host)
  out.round2 = await settle('nové kolo', 2)
  await host.waitForTimeout(1500)
  out.afterRound = await Promise.all(pages.map(st))
  // Ještě pár kol: každý pohne zvědem a všichni ukončí tah naráz.
  for (let r = 0; r < 4; r++) {
    await Promise.all(pages.map(p => p.evaluate(() => { const a = window.app, u = a.state.units.find(v => v.owner === a.me && v.type === 'scout'); if (u) for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) if (a.cmd({ t: 'move', unit: u.id, x: u.x + dx, y: u.y + dy }).ok) break; a.scene.syncUnits(); a.refresh() })))
    await Promise.all(pages.map(endTurn))
    out[`kolo${r + 3}`] = await settle(`kolo ${r + 3}`, r + 3)
    await host.waitForTimeout(1200)
  }
  // Anna a Bob se potkají: od dalšího kola se střídají, hostitel táhne dál zároveň.
  await Promise.all(pages.map(p => p.evaluate(() => { const s = window.app.state; if (!s.players[1].met.includes(2)) { s.players[1].met.push(2); s.players[2].met.push(1) } })))
  await Promise.all(pages.map(endTurn))
  out.metRound = await settle('kolo po setkání', 7)
  await host.waitForTimeout(1500)
  out.afterMeet = await Promise.all(pages.map(st))
  await p2.screenshot({ path: `${dir}/6-bob-waits-for-anna.png` })
  await endTurn(p1)
  await host.waitForTimeout(800)
  out.bobActive = await Promise.all(pages.map(st))
  await endTurn(p2); await endTurn(host)
  out.round8 = await settle('další kolo', 8)
  out.loads = await Promise.all(pages.map(p => p.evaluate(() => window.app.state.turn)))
} catch (e) { out.error = String(e && e.stack || e) }
out.errors = errors
console.log(JSON.stringify(out, null, 1))
await browser.close()
