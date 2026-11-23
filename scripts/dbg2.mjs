import { createGame, endTurn } from '../src/game/state.ts'
import { aiTurn, siteScore } from '../src/game/ai.ts'
import { citiesOf, unitsOf, drainEvents, tilesWithin, isCivilian, atWar, pathMap, idx } from '../src/game/rules.ts'
import { hexDist } from '../src/game/hex.ts'
const s = createGame('aur', 'normal')
s.players[0].personality = 'builder'
while (s.turn <= +process.argv[2]) { aiTurn(s, 0); endTurn(s); drainEvents() }
const c = citiesOf(s, 0)[0]
console.log('pop', c.pop, 'build', c.build, 'units', unitsOf(s, 0).map(u => u.type))
console.log('threat2', s.units.filter(u => !isCivilian(u) && atWar(s, 0, u.owner) && hexDist(u.x, u.y, c.x, c.y) <= 2).length)
let n = 0; for (const [x, y] of tilesWithin(s, c.x, c.y, 7)) if (siteScore(s, 0, x, y) > 16) n++
console.log('sites', n)
