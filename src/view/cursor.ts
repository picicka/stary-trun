// Kurzor myši nad mapou: pixelová šipka a u ní ikona toho, co vybraná jednotka kliknutím udělá.

/** Záměr pod myší; prázdný řetězec = jen šipka. */
export type CursorKind = '' | 'select' | 'move' | 'attack' | 'shoot' | 'embark' | 'found' | 'work' | 'road' | 'no'

const ICON: Partial<Record<CursorKind, string>> = { move: 'move', attack: 'str', shoot: 'rng', embark: 'anchor', found: 'flag', work: 'work', road: 'road' }
const ARROW = ['X', 'XX', 'XWX', 'XWWX', 'XWWWX', 'XWWWWX', 'XWWWWWX', 'XWWWWWWX', 'XWWWWXXXX', 'XWWXWWX', 'XWX.XWWX', 'XX..XWWX', '.....XX']
const CROSS = ['RR....RR', 'RRR..RRR', '.RRRRRR.', '..RRRR..', '..RRRR..', '.RRRRRR.', 'RRR..RRR', 'RR....RR']
const SCALE = 2
const cache = new Map<CursorKind, string>()

function grid(ctx: CanvasRenderingContext2D, rows: string[], ox: number, oy: number, colors: Record<string, string>): void {
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (colors[ch]) { ctx.fillStyle = colors[ch]; ctx.fillRect((ox + x) * SCALE, (oy + y) * SCALE, SCALE, SCALE) } }))
}

function draw(kind: CursorKind, icon?: HTMLImageElement): string {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 24 * SCALE
  const ctx = cv.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  if (icon) ctx.drawImage(icon, 11 * SCALE, 11 * SCALE, icon.width * SCALE, icon.height * SCALE)
  if (kind === 'no') {
    // červený křížek s tmavým obrysem
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) grid(ctx, CROSS, 13 + dx, 13 + dy, { R: '#1a1426' })
    grid(ctx, CROSS, 13, 13, { R: '#e0453d' })
  }
  grid(ctx, ARROW, 0, 0, { X: '#1a1426', W: kind === 'select' ? '#f2c230' : '#ffffff' })
  return `url(${cv.toDataURL()}) 1 1, ${kind === 'select' ? 'pointer' : 'default'}`
}

/** Hodnota CSS `cursor` pro daný záměr; `ready` se zavolá, až se dočte ikona (pak se hodnota změní). */
export function cursorCss(kind: CursorKind, ready: () => void): string {
  const hit = cache.get(kind)
  if (hit) return hit
  const name = ICON[kind]
  if (!name) { const css = draw(kind); cache.set(kind, css); return css }
  const img = new Image()
  img.onload = () => { cache.set(kind, draw(kind, img)); ready() }
  img.src = `${import.meta.env.BASE_URL}assets/ui/ic_${name}.png`
  // Než se ikona načte, platí obyčejná šipka (do paměti se neukládá).
  return cursorCss('', ready)
}
