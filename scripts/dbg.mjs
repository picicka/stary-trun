import { createGame, endTurn } from '../src/game/state.ts'
import { aiTurn, siteScore } from '../src/game/ai.ts'
import { citiesOf, unitsOf, drainEvents, cityYields, growthNeed, tilesWithin } from '../src/game/rules.ts'
const s = createGame('aur', 'normal')
s.players[0].personality = 'builder'
while (s.turn <= 40) {
  aiTurn(s, 0); endTurn(s); drainEvents()
  for (const pid of [0, 1]) for (const c of citiesOf(s, pid)) {
    const y = cityYields(s, c)
    let best = 0; for (const [x, y2] of tilesWithin(s, c.x, c.y, 7)) best = Math.max(best, siteScore(s, pid, x, y2))
    console.log(`T${s.turn} p${pid} ${c.name} pop${c.pop} f${c.food}/${growthNeed(s, c)}(+${y.foodNet}) prod${y.prod} build=${c.build ? c.build.id : '-'} ${c.prod} units=${unitsOf(s, pid).map(u => u.type).join(',')} site=${best.toFixed(0)}`)
  }
}
