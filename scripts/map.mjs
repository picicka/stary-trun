// Textový náhled mapy: node scripts/map.mjs [valley|islands|random] [seed]
import { generateScenario, asciiMap, MISSION_SEED, ISLANDS_SEED } from '../src/game/mapgen.ts'
const kind = process.argv[2] || 'valley'
const seed = process.argv[3] ? +process.argv[3] : kind === 'valley' ? MISSION_SEED : kind === 'islands' ? ISLANDS_SEED : 4242
const s = generateScenario(seed, kind)
console.log(asciiMap(s))
const n = {}
for (const t of s.tiles) { n[t.t] = (n[t.t] || 0) + 1 }
console.log(JSON.stringify(n), 'starts', JSON.stringify(s.starts), 'ruins', JSON.stringify(s.ruins), 'camps', s.camps.length, 'river tiles', s.tiles.filter(t => t.river).length)
