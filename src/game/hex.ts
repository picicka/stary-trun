// Hexová mřížka: pointy-top, offset souřadnice „odd-r“ (liché řady posunuté doprava).
// Směry: 0=V, 1=JV, 2=JZ, 3=Z, 4=SZ, 5=SV.

export const TILE_W = 32
export const ROW_H = 24
export const TILE_H = 32

const EVEN: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1]]
const ODD: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 0], [0, -1], [1, -1]]

export function neighborXY(x: number, y: number, dir: number): [number, number] {
  const d = (y & 1 ? ODD : EVEN)[dir]
  return [x + d[0], y + d[1]]
}

export function hexDist(ax: number, ay: number, bx: number, by: number): number {
  const aq = ax - ((ay - (ay & 1)) >> 1)
  const bq = bx - ((by - (by & 1)) >> 1)
  const dq = aq - bq
  const dr = ay - by
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2
}

/** Střed hexu v pixelech světa. */
export function hexCenter(x: number, y: number): [number, number] {
  return [x * TILE_W + (y & 1) * (TILE_W / 2) + TILE_W / 2, y * ROW_H + TILE_H / 2]
}

/** Pixel světa → hex (nejbližší střed v metrice zohledňující zploštění hexu). */
export function pixelToHex(px: number, py: number): [number, number] {
  const ry = Math.floor((py - 4) / ROW_H)
  let best: [number, number] = [0, 0]
  let bestD = Infinity
  for (let y = ry - 1; y <= ry + 1; y++) {
    const rx = Math.floor((px - (y & 1) * 16) / TILE_W)
    for (let x = rx - 1; x <= rx + 1; x++) {
      const [cx, cy] = hexCenter(x, y)
      const dx = px - cx
      const dy = (py - cy) * 1.1547
      const d = dx * dx + dy * dy
      if (d < bestD) { bestD = d; best = [x, y] }
    }
  }
  return best
}
