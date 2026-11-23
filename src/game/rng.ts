/** Deterministický generátor (mulberry32); stav žije v objektu, aby šel uložit. */
export interface RngHolder { rng: number }

export function rand(s: RngHolder): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function randInt(s: RngHolder, n: number): number {
  return Math.floor(rand(s) * n)
}

export function pick<T>(s: RngHolder, arr: readonly T[]): T {
  return arr[randInt(s, arr.length)]
}
