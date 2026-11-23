// Simulace: hráče 0 hraje také AI. Slouží k ladění vyváženosti a hledání chyb.
import { createGame, endTurn, serialize, deserialize } from '../src/game/state.ts'
import { aiTurn } from '../src/game/ai.ts'
import { citiesOf, unitsOf, score, drainEvents, militaryPower, playerIncome, isCoastal } from '../src/game/rules.ts'
import { NATIONS } from '../src/game/data.ts'

const nation = process.argv[2] || 'aur'
const diff = process.argv[3] || 'normal'
const persona = process.argv[4] || 'builder'
const s0 = createGame(nation, diff, process.argv[5] || 'valley', process.argv[6] ? +process.argv[6] : undefined)
let s = s0
s.players[0].personality = persona
const t0 = Date.now()
while (!s.over && s.turn <= s.maxTurns + 1) {
  aiTurn(s, 0)
  endTurn(s)
  drainEvents()
  if (s.turn % 15 === 0 || s.over) {
    const row = s.players.slice(0, 3).map(p => `${NATIONS[p.nation].name.slice(0, 5)}${p.alive ? '' : '†'} c${citiesOf(s, p.id).length} pop${citiesOf(s, p.id).reduce((a, c) => a + c.pop, 0)} u${unitsOf(s, p.id).length} t${p.techs.length} g${p.gold}(${playerIncome(s, p.id).gold}) sci${playerIncome(s, p.id).sci} mp${Math.round(militaryPower(s, p.id))} sc${score(s, p.id)} war[${p.war}]`).join(' | ')
    console.log(`T${s.turn} ${row} | barb ${unitsOf(s, 3).length}`)
  }
  if (s.turn === 40) { const j = serialize(s); const r = deserialize(j); if (!r) throw new Error('save roundtrip failed'); r.players[0].personality = persona; s = r }
}
console.log('navy', s.units.filter(u => u.type === 'galley' || u.type === 'trireme').map(u => u.owner).join(''), 'coastal cities', s.cities.filter(c => isCoastal(s, c.x, c.y)).map(c => c.owner).join(''), 'of', s.cities.map(c => c.owner).join(''))
console.log('OVER', JSON.stringify(s.over), 'wonderBy', s.mission.wonderBy, 'camps', s.mission.campsDestroyed, 'ruins', s.mission.ruinsBy, `${Date.now() - t0}ms`)
