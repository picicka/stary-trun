// Vykreslení mapy v Phaseru: terén, města, jednotky, mlha války, zvýraznění a animace událostí.
import Phaser from 'phaser'
import { NATIONS, TERRAIN, UNITS } from '../game/data.ts'
import { ROW_H, TILE_W, hexCenter, neighborXY, pixelToHex } from '../game/hex.ts'
import { atWar, hasRoad, idx, inMap, isCivilian, resourceVisible, isEmbarked } from '../game/rules.ts'
import type { GameEvent, GameState, Unit } from '../game/types.ts'
import { sfx } from '../audio.ts'
import { addNationFrames } from './nationArt.ts'
import { cursorCss, type CursorKind } from './cursor.ts'

export interface MapHost {
  state: GameState
  /** Hráč, z jehož pohledu se mapa kreslí. */
  me: number
  onTileClick(x: number, y: number, right: boolean, shift: boolean): void
  onHover(x: number, y: number): void
  onCameraMove(): void
}

interface UnitView { c: Phaser.GameObjects.Container; spr: Phaser.GameObjects.Image; bar: Phaser.GameObjects.Rectangle; barBg: Phaser.GameObjects.Rectangle; key: string; work?: Phaser.Tweens.Tween; tool?: Phaser.GameObjects.Image; job?: string }

const A = 'atlas'
const D_FOG = 100000

export class MapScene extends Phaser.Scene {
  host!: MapHost
  private tileStatic: (Phaser.GameObjects.GameObject[] | null)[] = []
  private tileDyn: Phaser.GameObjects.GameObject[][] = []
  private tileSig: string[] = []
  private fog: (Phaser.GameObjects.Image | null)[] = []
  private dim: (Phaser.GameObjects.Image | null)[] = []
  private borders: Phaser.GameObjects.Image[] = []
  private borderSig = ''
  private units = new Map<number, UnitView>()
  private marks: Phaser.GameObjects.Image[] = []
  private pathDots: Phaser.GameObjects.Image[] = []
  private cursor!: Phaser.GameObjects.Sprite
  private selRing!: Phaser.GameObjects.Sprite
  private dragging = false
  private dragStart = { x: 0, y: 0, sx: 0, sy: 0 }
  private zoomAcc = 0
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private playing = false
  /** Obrázky, které se hýbou samy: lesy a tábory (snímek „_w“), stíny mraků, čas a krok oživení mapy. */
  private swaying = new Map<number, { img: Phaser.GameObjects.Image; frame: string; on: boolean }>()
  private clouds: Phaser.GameObjects.Image[] = []
  private ambientAcc = 0
  private tick = 0
  private flockAt = 40
  private selId = -1
  private calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  private ready = false
  lastHover: [number, number] = [-1, -1]

  constructor() { super('map') }

  preload(): void {
    this.load.atlas(A, 'assets/atlas.png', 'assets/atlas.json')
  }

  create(): void {
    addNationFrames(this.textures, A) // u_<typ>_<národ>, city_<n>_<národ> přebarvené za běhu
    const mk = (key: string, prefix: string, n: number, rate: number, repeat = -1) => {
      if (this.anims.exists(key)) return
      this.anims.create({ key, frames: this.anims.generateFrameNames(A, { prefix, start: 0, end: n - 1 }), frameRate: rate, repeat })
    }
    mk('ocean', 't_ocean_', 4, 2.5)
    mk('coast', 't_coast_', 4, 2.5)
    mk('cursor', 'hex_cursor_', 2, 3)
    mk('hit', 'fx_hit_', 5, 18, 0)
    mk('smoke', 'fx_smoke_', 4, 10, 0)

    this.cursor = this.add.sprite(0, 0, A, 'hex_cursor_0').setOrigin(0, 0).setDepth(D_FOG + 5).setAlpha(0.55).setVisible(false)
    this.selRing = this.add.sprite(0, 0, A, 'hex_cursor_0').setOrigin(0, 0).setDepth(D_FOG - 10).setVisible(false)
    this.selRing.play('cursor')
    this.makeAmbientTextures()
    this.makeGhosts()

    const cam = this.cameras.main
    cam.setRoundPixels(true)
    cam.setZoom(this.defaultZoom())
    this.input.mouse?.disableContextMenu()
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false) as Record<string, Phaser.Input.Keyboard.Key>

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.dragging = false
      this.dragStart = { x: p.x, y: p.y, sx: cam.scrollX, sy: cam.scrollY }
    })
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && !p.rightButtonDown()) {
        const dx = p.x - this.dragStart.x, dy = p.y - this.dragStart.y
        if (!this.dragging && Math.hypot(dx, dy) > 6) this.dragging = true
        if (this.dragging) {
          cam.setScroll(this.dragStart.sx - dx / cam.zoom, this.dragStart.sy - dy / cam.zoom)
          this.clampCamera()
          this.host.onCameraMove()
        }
      }
      this.updateHover(p)
    })
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.dragging) { this.dragging = false; return }
      if (!this.host?.state) return
      const [x, y] = pixelToHex(p.worldX, p.worldY)
      if (inMap(this.host.state, x, y)) this.host.onTileClick(x, y, p.button === 2, !!(p.event as MouseEvent | undefined)?.shiftKey)
    })
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAcc += dy
      if (Math.abs(this.zoomAcc) < 60) return
      const dir = this.zoomAcc > 0 ? -1 : 1
      this.zoomAcc = 0
      this.zoomBy(dir, p)
    })
    this.scale.on('resize', () => { this.clampCamera(); this.host?.onCameraMove() })
    this.ready = true
    this.events.emit('ready')
  }

  private defaultZoom(): number { return window.innerWidth >= 1200 && window.innerHeight >= 700 ? 3 : 2 }

  zoomBy(dir: number, p?: Phaser.Input.Pointer): void {
    const cam = this.cameras.main
    const z = Phaser.Math.Clamp(Math.round(cam.zoom) + dir, 1, 5)
    if (z === cam.zoom) return
    const wx = p ? p.worldX : cam.midPoint.x, wy = p ? p.worldY : cam.midPoint.y
    const px = p ? p.x : cam.width / 2, py = p ? p.y : cam.height / 2
    cam.setZoom(z)
    // Bod pod kurzorem zůstane na místě.
    cam.centerOn(wx - (px - cam.width / 2) / z, wy - (py - cam.height / 2) / z)
    this.clampCamera()
    this.host.onCameraMove()
  }

  private clampCamera(): void {
    const s = this.host?.state
    if (!s) return
    const cam = this.cameras.main
    const w = s.W * TILE_W + 16, h = s.H * ROW_H + 8
    const vw = cam.width / cam.zoom, vh = cam.height / cam.zoom
    // Střed se počítá ze scrollu: cam.midPoint se obnovuje až při vykreslení a po setScroll by vracel starou polohu.
    const mx = cam.scrollX + cam.width / 2, my = cam.scrollY + cam.height / 2
    // Střed záběru smí kamkoli na mapu (kousek od kraje), aby šlo vycentrovat i pole u okraje
    // a při oddálení, kdy se mapa skoro vejde do okna. Za okrajem mapy je pak vidět prázdno.
    const mxm = Math.min(w / 2, 48), mym = Math.min(h / 2, 36)
    void vw; void vh
    const cx = Phaser.Math.Clamp(mx, mxm, w - mxm)
    const cy = Phaser.Math.Clamp(my, mym, h - mym)
    cam.centerOn(cx, cy)
  }

  update(_t: number, dt: number): void {
    if (!this.host?.state) return
    this.ambient(dt)
    const k = this.keys
    const cam = this.cameras.main
    let dx = 0, dy = 0
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)
    if (!typing) {
      if (k.A.isDown || k.LEFT.isDown) dx -= 1
      if (k.D.isDown || k.RIGHT.isDown) dx += 1
      if (k.W.isDown || k.UP.isDown) dy -= 1
      if (k.S.isDown || k.DOWN.isDown) dy += 1
    }
    if (dx || dy) {
      const sp = (520 / cam.zoom) * (dt / 1000)
      cam.setScroll(cam.scrollX + dx * sp, cam.scrollY + dy * sp)
      this.clampCamera()
      this.host.onCameraMove()
    }
  }

  private updateHover(p: Phaser.Input.Pointer): void {
    const s = this.host?.state
    if (!s) return
    const [x, y] = pixelToHex(p.worldX, p.worldY)
    if (x === this.lastHover[0] && y === this.lastHover[1]) return
    this.lastHover = [x, y]
    if (inMap(s, x, y)) {
      this.cursor.setVisible(true).setPosition(x * TILE_W + (y & 1) * 16, y * ROW_H)
      this.host.onHover(x, y)
    } else {
      this.cursor.setVisible(false)
      this.host.onHover(-1, -1)
    }
  }

  private cursorKind: CursorKind = ''
  /** Kurzor myši nad mapou podle toho, co kliknutí udělá. */
  setCursor(kind: CursorKind): void {
    this.cursorKind = kind
    this.game.canvas.style.cursor = cursorCss(kind, () => this.setCursor(this.cursorKind))
  }

  // ------------------------------------------------------------ kamera

  centerOn(x: number, y: number, smooth = true): void {
    const [cx, cy] = hexCenter(x, y)
    const cam = this.cameras.main
    if (smooth) cam.pan(cx, cy, 260, 'Sine.easeInOut', true, (_c, prog) => { this.host.onCameraMove(); if (prog === 1) { this.clampCamera(); this.host.onCameraMove() } })
    else { cam.centerOn(cx, cy); this.clampCamera(); this.host.onCameraMove() }
  }

  /** Krátké zablikání rámu na poli, aby bylo vidět, kam mapa skočila. */
  ping(x: number, y: number): void {
    const ring = this.add.image(x * TILE_W + (y & 1) * 16 + 16, y * ROW_H + 16, A, 'hex_worked').setTint(0xffffff).setDepth(D_FOG + 6).setScale(1.9).setAlpha(0)
    this.tweens.add({ targets: ring, scale: 1, alpha: 1, duration: 320, ease: 'Quad.easeOut', onComplete: () => { this.tweens.add({ targets: ring, alpha: 0.15, duration: 260, yoyo: true, repeat: 2, onComplete: () => ring.destroy() }) } })
  }

  /** Je pole pohodlně v záběru? */
  inView(x: number, y: number, margin = 48): boolean {
    const [cx, cy] = hexCenter(x, y)
    const v = this.viewRect
    const m = margin / this.cameras.main.zoom
    return cx > v.x + m && cx < v.right - m && cy > v.y + m * 1.6 && cy < v.bottom - m * 2.4
  }

  worldToScreen(wx: number, wy: number): [number, number] {
    const cam = this.cameras.main
    const v = this.viewRect
    return [(wx - v.x) * cam.zoom, (wy - v.y) * cam.zoom]
  }

  get zoom(): number { return this.cameras.main.zoom }
  /** Viditelný výřez světa spočítaný přímo ze scrollu a zoomu (cam.worldView se obnovuje až při vykreslení a hned po posunu či zoomu je zastaralý). */
  get viewRect(): Phaser.Geom.Rectangle {
    const cam = this.cameras.main
    const w = cam.width / cam.zoom, h = cam.height / cam.zoom
    return new Phaser.Geom.Rectangle(cam.scrollX + cam.width / 2 - w / 2, cam.scrollY + cam.height / 2 - h / 2, w, h)
  }

  // ------------------------------------------------------------ stavba mapy

  /** Zahodí vše a připraví scénu na novou hru. */
  reset(): void {
    if (!this.ready) return
    for (const a of this.tileStatic) a?.forEach(o => o.destroy())
    for (const a of this.tileDyn) a?.forEach(o => o.destroy())
    for (const f of this.fog) f?.destroy()
    for (const f of this.dim) f?.destroy()
    for (const b of this.borders) b.destroy()
    for (const u of this.units.values()) { u.work?.stop(); u.c.destroy() }
    this.clearMarks()
    const n = this.host.state.W * this.host.state.H
    this.tileStatic = new Array(n).fill(null)
    this.tileDyn = Array.from({ length: n }, () => [])
    this.tileSig = new Array(n).fill('')
    this.fog = new Array(n).fill(null)
    this.dim = new Array(n).fill(null)
    this.borders = []
    this.borderSig = ''
    this.units.clear()
    this.swaying.clear()
    this.placeClouds()
    this.selRing.setVisible(false)
    this.cameras.main.setZoom(this.defaultZoom())
    this.syncAll()
  }

  private tilePos(i: number): [number, number, number, number] {
    const s = this.host.state
    const x = i % s.W, y = (i / s.W) | 0
    return [x, y, x * TILE_W + (y & 1) * 16, y * ROW_H]
  }

  private buildStatic(i: number): void {
    const s = this.host.state
    const t = s.tiles[i]
    const [x, y, px, py] = this.tilePos(i)
    const objs: Phaser.GameObjects.GameObject[] = []
    const d = y * 10
    const v = (n: number) => 1 + ((t.variant + x * 7 + y * 13) % n)
    if (t.t === 'ocean' || t.t === 'coast') {
      const sp = this.add.sprite(px, py, A, `t_${t.t}_0`).setOrigin(0, 0).setDepth(d)
      sp.play({ key: t.t, startFrame: (x + y * 2) % 4 })
      objs.push(sp)
      for (let dir = 0; dir < 6; dir++) {
        const [nx, ny] = neighborXY(x, y, dir)
        if (!inMap(s, nx, ny)) continue
        if (TERRAIN[s.tiles[idx(s, nx, ny)].t].land) objs.push(this.add.image(px, py, A, `shore_${dir}`).setOrigin(0, 0).setDepth(d + 1))
      }
    } else if (t.t === 'mountain') {
      objs.push(this.add.image(px, py, A, `t_grass_${v(3)}`).setOrigin(0, 0).setDepth(d))
      objs.push(this.add.image(px, py - 16, A, `t_mountain_${v(2)}`).setOrigin(0, 0).setDepth(d + 3))
    } else {
      const n = t.t === 'desert' || t.t === 'hills' ? 2 : 3
      objs.push(this.add.image(px, py, A, `t_${t.t}_${v(n)}`).setOrigin(0, 0).setDepth(d))
    }
    // Řeky vedou po hranách pole; kreslí se nad hranicemi národů.
    if (t.river) for (let dir = 0; dir < 6; dir++) if (t.river & (1 << dir)) objs.push(this.add.image(px, py, A, `river_${dir}`).setOrigin(0, 0).setDepth(d + 2.5))
    this.tileStatic[i] = objs
  }

  private syncTile(i: number): void {
    const s = this.host.state
    const me = s.players[this.host.me]
    const t = s.tiles[i]
    const [x, y, px, py] = this.tilePos(i)
    const city = s.cities.find(c => c.x === x && c.y === y)
    const size = city ? (city.pop < 4 ? 1 : city.pop < 8 ? 2 : 3) : 0
    const res = t.res && resourceVisible(me, t.res) ? t.res : ''
    const wonder = this.wonderTile === i
    let roads = 0
    if (t.road || city) {
      roads = 64
      for (let dir = 0; dir < 6; dir++) { const [nx, ny] = neighborXY(x, y, dir); if (inMap(s, nx, ny) && hasRoad(s, idx(s, nx, ny)) && (t.road || s.tiles[idx(s, nx, ny)].road)) roads |= 1 << dir }
    }
    const sig = `${roads}|${t.forest ? 1 : 0}|${t.imp ?? ''}|${t.special ?? ''}|${res}|${city ? `${size}:${city.owner}` : ''}|${wonder ? 1 : 0}`
    if (sig === this.tileSig[i]) return
    this.tileSig[i] = sig
    for (const o of this.tileDyn[i]) o.destroy()
    this.swaying.delete(i)
    const objs: Phaser.GameObjects.GameObject[] = []
    const d = y * 10
    const tall = (frame: string, dd = 3) => { const img = this.add.image(px, py - 16, A, frame).setOrigin(0, 0).setDepth(d + dd); objs.push(img); return img }
    const sway = (frame: string, dd = 3) => this.swaying.set(i, { img: tall(frame, dd), frame, on: false })
    if (roads) {
      if (t.road) objs.push(this.add.image(px, py, A, 'road_c').setOrigin(0, 0).setDepth(d + 1.4))
      for (let dir = 0; dir < 6; dir++) if (roads & (1 << dir)) objs.push(this.add.image(px, py, A, `road_${dir}`).setOrigin(0, 0).setDepth(d + 1.5))
    }
    if (city) {
      tall(`city_${size}_${s.players[city.owner].nation}`, 4)
    } else {
      if (t.imp === 'farm') tall('i_farm', 2)
      if (t.forest) sway(`f_forest_${1 + ((x * 3 + y * 5 + t.variant) % 2)}`)
      if (res) objs.push(this.add.image(px, py, A, `r_${res}`).setOrigin(0, 0).setDepth(d + 4))
      if (t.imp && t.imp !== 'farm') tall(`i_${t.imp}`, 4)
      if (t.special === 'ruins') tall('f_ruins', 4)
      if (t.special === 'camp') sway('f_camp', 4)
      if (wonder) tall('f_wonder', 5)
    }
    this.tileDyn[i] = objs
  }

  private wonderTile = -1
  /** Div se kreslí na sousední pole města, které jej postavilo. */
  private findWonderTile(): number {
    const s = this.host.state
    const c = s.cities.find(ct => ct.buildings.includes('wonder'))
    if (!c) return -1
    let best = -1, bv = -1
    for (let dir = 0; dir < 6; dir++) {
      const [nx, ny] = neighborXY(c.x, c.y, dir)
      if (!inMap(s, nx, ny)) continue
      const t = s.tiles[idx(s, nx, ny)]
      if (!TERRAIN[t.t].passable || t.special) continue
      const v = (t.imp ? 0 : 2) + (t.forest ? 0 : 2) + (t.res ? 0 : 1) + (dir === 5 || dir === 4 ? 0 : 1)
      if (v > bv) { bv = v; best = idx(s, nx, ny) }
    }
    return best
  }

  /** Srovná celé zobrazení se stavem hry. */
  syncAll(): void {
    if (!this.ready || !this.host?.state) return
    const s = this.host.state
    const me = s.players[this.host.me]
    this.wonderTile = this.findWonderTile()
    for (let i = 0; i < s.tiles.length; i++) {
      const [x, y, px, py] = this.tilePos(i)
      if (!me.explored[i]) {
        if (!this.fog[i]) this.fog[i] = this.add.image(px + 16, py + 16, A, 'fog').setDepth(D_FOG + 1).setFlipX(((x * 5 + y * 3) & 1) === 1)
        continue
      }
      if (this.fog[i]) {
        const f = this.fog[i]!
        this.fog[i] = null
        this.tweens.add({ targets: f, alpha: 0, duration: 350, onComplete: () => f.destroy() })
      }
      if (!this.tileStatic[i]) this.buildStatic(i)
      if (me.visible[i]) {
        this.syncTile(i)
        if (this.dim[i]) this.dim[i]!.setVisible(false)
      } else {
        if (this.tileSig[i] === '') this.syncTile(i)
        if (!this.dim[i]) this.dim[i] = this.add.image(px, py, A, 'hex_mask').setOrigin(0, 0).setTint(0x0a1024).setAlpha(0.5).setDepth(D_FOG)
        this.dim[i]!.setVisible(true)
      }
    }
    this.syncBorders()
    this.syncUnits()
  }

  private syncBorders(): void {
    const s = this.host.state
    const me = s.players[this.host.me]
    let sig = ''
    for (let i = 0; i < s.tiles.length; i++) sig += me.explored[i] ? s.tiles[i].owner + 1 : 'x'
    if (sig === this.borderSig) return
    this.borderSig = sig
    for (const b of this.borders) b.destroy()
    this.borders = []
    for (let i = 0; i < s.tiles.length; i++) {
      const t = s.tiles[i]
      if (t.owner < 0 || !me.explored[i]) continue
      const [x, y, px, py] = this.tilePos(i)
      const col = NATIONS[s.players[t.owner].nation].color
      for (let dir = 0; dir < 6; dir++) {
        const [nx, ny] = neighborXY(x, y, dir)
        const o = inMap(s, nx, ny) ? s.tiles[idx(s, nx, ny)].owner : -1
        if (o === t.owner) continue
        this.borders.push(this.add.image(px, py, A, `border_${dir}`).setOrigin(0, 0).setTint(col).setAlpha(0.9).setDepth(y * 10 + 2))
      }
    }
  }

  // ------------------------------------------------------------ život na mapě

  /** Drobné textury pro oživení mapy: pták ve dvou snímcích a stín mraku. */
  private makeAmbientTextures(): void {
    if (this.textures.exists('bird')) return
    const bird = this.textures.createCanvas('bird', 10, 3)!
    const b = bird.getContext()
    b.fillStyle = '#1a1426'
    // křídla nahoře, křídla dole
    for (const [x, y] of [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [5, 1], [6, 1], [7, 0], [8, 1], [9, 1]]) b.fillRect(x, y, 1, 1)
    bird.add('up', 0, 0, 0, 5, 3); bird.add('down', 0, 5, 0, 5, 3)
    bird.refresh()
    const cloud = this.textures.createCanvas('cloud', 40, 18)!
    const c = cloud.getContext()
    c.fillStyle = '#0a1024'
    for (const [cx, cy, rx, ry] of [[14, 10, 12, 6], [25, 8, 11, 6], [22, 12, 14, 5], [8, 12, 7, 4]]) {
      for (let y = 0; y < 18; y++) for (let x = 0; x < 40; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) c.fillRect(x, y, 1, 1)
    }
    cloud.refresh()
    if (!this.anims.exists('bird')) this.anims.create({ key: 'bird', frames: [{ key: 'bird', frame: 'up' }, { key: 'bird', frame: 'down' }], frameRate: 5, repeat: -1 })
  }

  /** Stíny mraků rozmístí po nové mapě; dál už jen plují po větru. */
  private placeClouds(): void {
    for (const c of this.clouds) c.destroy()
    this.clouds = []
    if (this.calm) return
    const s = this.host.state
    const w = s.W * TILE_W, h = s.H * ROW_H
    const n = Math.max(2, Math.round((s.W * s.H) / 260))
    for (let i = 0; i < n; i++) {
      const sc = 3 + (i % 3)
      this.clouds.push(this.add.image(((i * 0.618 + 0.2) % 1) * w, ((i * 0.381 + 0.15) % 1) * h, 'cloud').setScale(sc).setAlpha(0.1).setDepth(D_FOG - 30).setData('v', 5 + (i % 3) * 1.5))
    }
  }

  /** Mapa žije i mezi tahy: vítr v lesích, ohně táborů, kouř nad městy, ptáci, stíny mraků a přešlapující vybraná jednotka. */
  private ambient(dt: number): void {
    if (this.calm) return
    const s = this.host.state
    const mapW = s.W * TILE_W
    for (const c of this.clouds) {
      c.x += (c.getData('v') as number) * (dt / 1000)
      if (c.x - c.displayWidth / 2 > mapW + 40) c.x = -c.displayWidth / 2 - 40
    }
    this.ambientAcc += dt
    if (this.ambientAcc < 170) return
    this.ambientAcc = Math.min(this.ambientAcc - 170, 170)
    const tick = ++this.tick
    const view = this.cameras.main.worldView
    const me = s.players[this.host.me]
    // Poryvy větru běží přes mapu zleva doprava; oheň v táboře plápolá nahodile.
    for (const [i, f] of this.swaying) {
      const x = i % s.W, y = (i / s.W) | 0
      const on = f.frame === 'f_camp' ? Math.random() < 0.5 : Math.sin(x * 0.5 + y * 0.28 - tick * 0.22) + Math.sin(x * 1.7 - y * 1.3 + tick * 0.6) * 0.35 > 0.72
      if (on !== f.on) { f.on = on; f.img.setFrame(on ? `${f.frame}_w` : f.frame) }
    }
    // Přešlapuje jen vybraná jednotka.
    for (const [id, v] of this.units) v.spr.y = id === this.selId && !v.work && tick % 6 < 2 ? -1 : 0
    // Kouř z komínů viditelných měst a jiskření Slunečního chrámu.
    for (const c of s.cities) {
      if (!me.visible[idx(s, c.x, c.y)] || Math.random() > 0.22) continue
      const [cx, cy] = hexCenter(c.x, c.y)
      if (!view.contains(cx, cy)) continue
      const size = c.pop < 4 ? 1 : c.pop < 8 ? 2 : 3
      const puff = this.add.rectangle(cx - 5 + Math.floor(Math.random() * 3) * 5, cy - 9 - size * 3, 2, 2, 0xdfe2ee, 0.75).setDepth(c.y * 10 + 5)
      this.tweens.add({ targets: puff, x: puff.x + 5 + Math.random() * 4, y: puff.y - 11, alpha: 0, duration: 1900, onComplete: () => puff.destroy() })
    }
    if (this.wonderTile >= 0 && me.visible[this.wonderTile] && Math.random() < 0.5) {
      const [, wy, px, py] = this.tilePos(this.wonderTile)
      const sp = this.add.rectangle(px + 7 + Math.random() * 18, py - 10 + Math.random() * 22, 1, 1, Math.random() < 0.5 ? 0xfff6c8 : 0xf2c230).setDepth(wy * 10 + 6)
      this.tweens.add({ targets: sp, alpha: 0, y: sp.y - 3, duration: 650, onComplete: () => sp.destroy() })
    }
    // Čas od času přeletí přes výřez hejno ptáků.
    if (--this.flockAt <= 0) {
      this.flockAt = 110 + Math.floor(Math.random() * 140)
      const n = 3 + Math.floor(Math.random() * 3)
      const y0 = view.y + view.height * (0.15 + Math.random() * 0.6)
      const dur = (view.width + 120) / 26 * 1000
      for (let k = 0; k < n; k++) {
        const b = this.add.sprite(view.x - 20 - k * 9 - Math.random() * 4, y0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 6, 'bird', 'up').setDepth(D_FOG + 3).setAlpha(0.85)
        b.play({ key: 'bird', startFrame: k % 2 })
        this.tweens.add({ targets: b, x: b.x + view.width + 120, y: b.y - 18, duration: dur, onComplete: () => b.destroy() })
      }
    }
  }

  // ------------------------------------------------------------ jednotky

  private unitXY(u: Unit): [number, number] {
    const [cx, cy] = hexCenter(u.x, u.y)
    const s = this.host.state
    // Civilista sdílející pole s vojákem stojí kousek stranou.
    if (isCivilian(u) && s.units.some(o => o !== u && o.x === u.x && o.y === u.y && !isCivilian(o))) return [cx - 7, cy + 1]
    if (!isCivilian(u) && s.units.some(o => o !== u && o.x === u.x && o.y === u.y && isCivilian(o))) return [cx + 4, cy - 3]
    return [cx, cy - 2]
  }

  /** Naloděná pozemní jednotka se kreslí jako člun. */
  private frameOf(u: Unit): string {
    const s = this.host.state
    // Při práci drží dělník nářadí zvlášť (animuje se), proto tělo bez něj.
    return `u_${isEmbarked(s, u) ? 'boat' : u.type === 'worker' && u.work ? 'workerb' : u.type}_${s.players[u.owner].nation}`
  }

  /**
   * Animace práce dělníků podle toho, co stavějí: krumpáč (důl), motyka (farma), kladivo (ohrada),
   * pila (pila v lese) a lopata (cesta). Nářadí je samostatný obrázek, který se otáčí kolem ruky.
   */
  private animateWork(v: UnitView, job: string | null): void {
    if (job === (v.job ?? null)) return
    v.work?.stop(); v.tool?.destroy()
    v.work = undefined; v.tool = undefined; v.job = job ?? undefined
    v.spr.setY(0)
    if (!job) return
    const kind = job === 'mine' ? 'pick' : job === 'farm' ? 'hoe' : job === 'pasture' ? 'hammer' : job === 'lumber' ? 'saw' : 'shovel'
    const tool = this.add.image(0, 0, A, `tool_${kind}`)
    v.c.addAt(tool, 2)
    v.tool = tool
    const dur = { pick: 950, hoe: 850, hammer: 1100, saw: 560, shovel: 1300 }[kind]
    const chip = { pick: [0xcdd6e6, 0x8a90a2], hoe: [0x8c5a36, 0x5f3a26], hammer: [0xe2b77c, 0xbd8752], saw: [0xe2b77c, 0xf8e6a4], shovel: [0x8c5a36, 0xb07f42] }[kind]
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t
    const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)))
    const ease = (t: number) => t * t * (3 - 2 * t)
    let last = 0
    v.work = this.tweens.addCounter({
      from: 0, to: 1, duration: dur, repeat: -1,
      onUpdate: tw => {
        const t = tw.getValue() ?? 0
        const dir = v.spr.flipX ? -1 : 1
        let ang = 0, ox = 0, oy = 0, body = 0
        let hits: number[] = []
        if (kind === 'pick' || kind === 'hoe') {
          // Pomalý nápřah za hlavu, rychlý úder před sebe.
          const hi = kind === 'pick' ? -55 : -25, lo = kind === 'pick' ? 105 : 98
          ang = t < 0.5 ? lerp(lo, hi, ease(seg(t, 0.08, 0.5))) : t < 0.62 ? lerp(hi, lo, seg(t, 0.5, 0.62) ** 2) : lo
          body = t >= 0.58 && t < 0.78 ? 1 : 0
          hits = [0.62]
        } else if (kind === 'hammer') {
          // Tři rychlé údery a krátká pauza.
          const k = t < 0.75 ? (t / 0.25) % 1 : 0
          ang = t < 0.75 ? (k < 0.55 ? lerp(88, 30, ease(k / 0.55)) : lerp(30, 88, ((k - 0.55) / 0.45) ** 2)) : 60
          hits = [0.24, 0.49, 0.74]
        } else if (kind === 'saw') {
          // Tah pilou tam a zpět, tělo se pohupuje s ní.
          ang = 14
          ox = 3 * Math.sin(t * Math.PI * 2)
          body = ox > 1.5 ? 1 : 0
          hits = [0.2, 0.7]
        } else {
          // Lopata: zarazit do země, nabrat, odhodit hlínu, vrátit.
          if (t < 0.25) { ang = lerp(150, 172, ease(t / 0.25)); oy = lerp(0, 3, ease(t / 0.25)); body = 1 }
          else if (t < 0.5) { ang = lerp(172, 95, ease(seg(t, 0.25, 0.5))); oy = lerp(3, 0, seg(t, 0.25, 0.5)) }
          else if (t < 0.64) ang = lerp(95, 35, seg(t, 0.5, 0.64) ** 2)
          else ang = lerp(35, 150, ease(seg(t, 0.64, 1)))
          hits = [0.57]
        }
        if (kind === 'saw') tool.setOrigin(dir < 0 ? 0.88 : 0.12, 0.45)
        else tool.setOrigin(0.5, 0.92)
        tool.setFlipX(dir < 0).setAngle(ang * dir).setPosition((3.5 + ox) * dir, -0.5 + oy + body)
        v.spr.setY(body)
        // Odletující úlomky, hlína či piliny v okamžiku úderu.
        for (const h of hits) {
          if (!(last < h && t >= h) || !v.c.visible || this.playing) continue
          const far = kind === 'shovel' ? -9 : kind === 'saw' ? 7 : 10
          this.chips(v.c.x + far * dir * v.c.scaleX, v.c.y + (kind === 'shovel' ? -6 : 6), chip, kind === 'shovel' ? 5 : 3, kind === 'shovel' ? -dir : dir)
        }
        last = t
      },
    })
  }

  private chips(x: number, y: number, colors: number[], n: number, dir: number): void {
    for (let k = 0; k < n; k++) {
      const r = this.add.rectangle(x, y, 1, 1, colors[k % colors.length]).setDepth(D_FOG - 6)
      const dx = dir * (1 + Math.random() * 5) + (Math.random() - 0.5) * 3, up = 2 + Math.random() * 4
      this.tweens.add({ targets: r, x: x + dx, duration: 420, ease: 'Linear' })
      this.tweens.add({ targets: r, y: y - up, duration: 160, ease: 'Quad.easeOut', onComplete: () => { this.tweens.add({ targets: r, y: y + 3, alpha: 0.2, duration: 260, ease: 'Quad.easeIn', onComplete: () => r.destroy() }) } })
    }
  }

  private unitVisible(u: Unit): boolean {
    const s = this.host.state
    return u.owner === this.host.me || !!s.players[this.host.me].visible[idx(s, u.x, u.y)]
  }

  private makeUnitView(u: Unit): UnitView {
    const s = this.host.state
    const shadow = this.add.ellipse(0, 9, 14, 5, 0x000000, 0.28)
    const spr = this.add.image(0, 0, A, this.frameOf(u))
    const barBg = this.add.rectangle(0, 12, 16, 4, 0x10131f).setVisible(false)
    const bar = this.add.rectangle(-7, 12, 14, 2, 0x5fd35f).setOrigin(0, 0.5).setVisible(false)
    const c = this.add.container(0, 0, [shadow, spr, barBg, bar])
    const v: UnitView = { c, spr, bar, barBg, key: '' }
    this.units.set(u.id, v)
    return v
  }

  private placeUnit(u: Unit, v: UnitView): void {
    const s = this.host.state
    const [px, py] = this.unitXY(u)
    v.c.setPosition(px, py).setDepth(u.y * 10 + (isCivilian(u) ? 6 : 7)).setVisible(this.unitVisible(u))
    const inCity = s.cities.some(c => c.x === u.x && c.y === u.y)
    v.c.setScale(inCity ? 0.82 : 1)
    if (inCity) v.c.setPosition(px + 6, py + 5)
    const hurt = u.hp < 100
    v.bar.setVisible(hurt); v.barBg.setVisible(hurt)
    if (hurt) {
      v.bar.width = Math.max(1, Math.round(14 * u.hp / 100))
      v.bar.fillColor = u.hp > 60 ? 0x5fd35f : u.hp > 30 ? 0xf2c230 : 0xe0453d
    }
    const spent = u.owner === this.host.me && u.moves <= 0
    v.spr.setTint(spent ? 0xa9adbd : 0xffffff)
    v.spr.setAlpha(u.owner === this.host.me && (u.sleep || u.fortified) ? 0.88 : 1)
    this.animateWork(v, u.work && v.c.visible ? u.work : null)
  }

  syncUnits(): void {
    const s = this.host.state
    const alive = new Set<number>()
    for (const u of s.units) {
      alive.add(u.id)
      const v = this.units.get(u.id) ?? this.makeUnitView(u)
      const frame = this.frameOf(u)
      if (v.key !== frame) { v.spr.setFrame(frame); v.key = frame }
      this.placeUnit(u, v)
    }
    for (const [id, v] of this.units) if (!alive.has(id)) { v.work?.stop(); v.c.destroy(); this.units.delete(id) }
  }

  // ------------------------------------------------------------ zvýraznění

  private routeDots: Phaser.GameObjects.Image[] = []

  /** Naplánovaná cesta vybrané jednotky: tečky po trase a značky v cíli a průjezdních bodech. */
  showRoute(path: [number, number][], stops: [number, number][]): void {
    for (const [x, y] of path) {
      const [cx, cy] = hexCenter(x, y)
      this.routeDots.push(this.add.image(cx, cy, A, 'path_dot').setDepth(D_FOG + 3).setAlpha(0.7).setTint(0x8dffb0).setScale(0.75))
    }
    for (const [x, y] of stops) {
      this.routeDots.push(this.add.image(x * TILE_W + (y & 1) * 16, y * ROW_H, A, 'hex_move').setOrigin(0, 0).setTint(0x8dffb0).setDepth(D_FOG + 3))
    }
  }

  clearMarks(): void {
    for (const m of this.marks) m.destroy()
    this.marks = []
    for (const m of this.routeDots) m.destroy()
    this.routeDots = []
    for (const t of this.markTweens) t.stop()
    this.markTweens = []
    this.clearPath()
  }

  clearPath(): void {
    for (const m of this.pathDots) m.destroy()
    this.pathDots = []
  }

  showSelection(u: Unit | null, reach: number[], targets: number[]): void {
    this.selId = u?.id ?? -1
    this.clearMarks()
    if (!u) { this.selRing.setVisible(false); return }
    this.selRing.setVisible(true).setPosition(u.x * TILE_W + (u.y & 1) * 16, u.y * ROW_H)
    for (const i of reach) {
      const [, y, px, py] = this.tilePos(i)
      this.marks.push(this.add.image(px, py, A, 'hex_move').setOrigin(0, 0).setTint(0xbfe8ff).setAlpha(0.75).setDepth(y * 10 + 5))
    }
    for (const i of targets) {
      const [, y, px, py] = this.tilePos(i)
      this.marks.push(this.add.image(px, py, A, 'hex_attack').setOrigin(0, 0).setDepth(y * 10 + 9))
    }
  }

  /** Červené rámy cílů (střelba z hradeb otevřeného města); dosavadní značky nechává. */
  showTargets(targets: number[]): void {
    for (const i of targets) {
      const [, y, px, py] = this.tilePos(i)
      this.marks.push(this.add.image(px, py, A, 'hex_attack').setOrigin(0, 0).setDepth(y * 10 + 9))
    }
  }

  showCityRing(x: number, y: number): void {
    this.clearMarks()
    this.selRing.setVisible(true).setPosition(x * TILE_W + (y & 1) * 16, y * ROW_H)
  }

  showPath(path: [number, number][], reachNow: (i: number) => boolean): void {
    this.clearPath()
    const s = this.host.state
    for (const [x, y] of path) {
      const [cx, cy] = hexCenter(x, y)
      const now = reachNow(idx(s, x, y))
      this.pathDots.push(this.add.image(cx, cy, A, 'path_dot').setDepth(D_FOG + 4).setAlpha(now ? 1 : 0.55).setTint(now ? 0xffffff : 0xffd98a))
    }
  }

  /** Zvýrazní pole, která město obdělává. */
  showWorked(tiles: number[], owned: number[]): void {
    this.clearMarks()
    for (const i of owned) {
      const [, y, px, py] = this.tilePos(i)
      if (tiles.includes(i)) {
        // Obdělávané pole: výrazný zlatý rám a hlava obyvatele.
        this.marks.push(this.add.image(px, py, A, 'hex_worked').setOrigin(0, 0).setTint(0xffd23a).setDepth(D_FOG - 12))
        this.marks.push(this.add.image(px, py, A, 'mark_worked').setOrigin(0, 0).setDepth(D_FOG - 11))
      } else {
        this.marks.push(this.add.image(px, py, A, 'hex_mask').setOrigin(0, 0).setTint(0x0a1024).setAlpha(0.38).setDepth(y * 10 + 5))
      }
    }
  }

  /** Pole, kde mohou vybraní dělníci něco postavit: zelený rám a zmenšená ikona vylepšení. */
  private markTweens: Phaser.Tweens.Tween[] = []

  /** Žárovka na poli, které rádce doporučuje. */
  private tipIcon(i: number): void {
    const [, , px, py] = this.tilePos(i)
    this.marks.push(this.add.image(px + 25, py + 7, A, 'ic_tip').setDepth(D_FOG - 9))
  }

  /** Šedobílé obrázky vylepšení a města pro návrhy na mapě (textura „ghost“). */
  private makeGhosts(): void {
    if (this.textures.exists('ghost')) return
    const names = ['i_farm', 'i_mine', 'i_pasture', 'i_lumber', 'city_1'].filter(n => this.textures.get(A).has(n))
    const frames = names.map(n => this.textures.getFrame(A, n))
    const tex = this.textures.createCanvas('ghost', frames.reduce((a, f) => a + f.cutWidth + 2, 0), Math.max(...frames.map(f => f.cutHeight)))!
    const ctx = tex.getContext()
    let x = 0
    frames.forEach((f, k) => {
      ctx.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, f.cutWidth, f.cutHeight, x, 0, f.cutWidth, f.cutHeight)
      const img = ctx.getImageData(x, 0, f.cutWidth, f.cutHeight)
      const d = img.data
      for (let q = 0; q < d.length; q += 4) {
        // stín pod obrázkem (poloprůhledný) pryč, zbytek do světlé šedi
        if (d[q + 3] < 255) { d[q + 3] = 0; continue }
        const l = Math.round(105 + (0.3 * d[q] + 0.59 * d[q + 1] + 0.11 * d[q + 2]) * 0.59)
        d[q] = l; d[q + 1] = l; d[q + 2] = Math.min(255, l + 8)
      }
      ctx.putImageData(img, x, 0)
      tex.add(names[k], 0, x, 0, f.cutWidth, f.cutHeight)
      x += f.cutWidth + 2
    })
    tex.refresh()
  }

  /** Návrh na mapě: šedobílý obrázek, který pomalu bliká, aby nešel splést s hotovou stavbou. */
  private ghost(frame: string, x: number, y: number, scale: number): void {
    const has = this.textures.get('ghost').has(frame)
    const img = this.add.image(x, y, has ? 'ghost' : A, frame).setScale(scale).setAlpha(0.95).setDepth(D_FOG - 11)
    this.marks.push(img)
    this.markTweens.push(this.tweens.add({ targets: img, alpha: 0.3, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }))
  }

  /** Návrhy pro dělníky: světlý rám a blikající šedobílé vylepšení. */
  showJobs(jobs: { i: number; job: string }[], best = -1): void {
    if (best >= 0) this.tipIcon(best)
    for (const { i, job } of jobs) {
      const [, y, px, py] = this.tilePos(i)
      this.marks.push(this.add.image(px, py, A, 'hex_move').setOrigin(0, 0).setTint(0xe8ecf5).setAlpha(0.7).setDepth(y * 10 + 5))
      this.ghost(`i_${job}`, px + 16, py + 12, 0.5)
    }
  }

  /** Doporučená místa pro město: světlý rám a blikající šedobílé město, nejlepší místo větší. */
  showSites(sites: { i: number; best: boolean }[], _nation: string): void {
    for (const { i, best } of sites) {
      if (best) this.tipIcon(i)
      const [, , px, py] = this.tilePos(i)
      this.marks.push(this.add.image(px, py, A, 'hex_worked').setOrigin(0, 0).setTint(best ? 0xffffff : 0xcfd5e2).setAlpha(best ? 1 : 0.7).setDepth(D_FOG - 12))
      this.ghost('city_1', px + 16, py + 8, best ? 0.6 : 0.45)
    }
  }

  // ------------------------------------------------------------ animace událostí

  private wait(ms: number): Promise<void> { return new Promise(r => this.time.delayedCall(ms, () => r())) }
  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(r => this.tweens.add({ ...cfg, onComplete: () => r() }))
  }

  private seen(x: number, y: number): boolean {
    const s = this.host.state
    return !!s.players[this.host.me].visible[idx(s, x, y)]
  }

  private fx(key: string, frame: string, x: number, y: number, scale = 1): void {
    const sp = this.add.sprite(x, y, A, frame).setDepth(D_FOG - 5).setScale(scale).setAlpha(scale < 1 ? 0.7 : 1)
    sp.play(key)
    sp.once('animationcomplete', () => sp.destroy())
  }

  floater?: (wx: number, wy: number, text: string, color: string) => void

  get busy(): boolean { return this.playing }

  /** Přehraje události z pravidel. Stav hry už je změněný – po skončení se zobrazení srovná. */
  async play(events: GameEvent[], fast = false): Promise<void> {
    if (!this.ready) return
    this.playing = true
    const sp = fast ? 0.55 : 1
    try {
      for (const ev of events) {
        if (ev.e === 'sound') { sfx(ev.id); continue }
        if (ev.e === 'move') {
          const v = this.units.get(ev.unit)
          const vis = ev.owner === this.host.me || ev.path.some(p => this.seen(p[0], p[1]))
          if (!v || !vis) continue
          if (ev.owner === this.host.me) sfx('move')
          v.c.setVisible(true)
          for (let k = 1; k < ev.path.length; k++) {
            const [cx, cy] = hexCenter(ev.path[k][0], ev.path[k][1])
            if (cx < v.c.x - 1) v.spr.setFlipX(true); else if (cx > v.c.x + 1) v.spr.setFlipX(false)
            v.c.setDepth(Math.max(ev.path[k][1], ev.path[k - 1][1]) * 10 + 8)
            await this.tween({ targets: v.c, x: cx, y: cy - 2, duration: 95 * sp, ease: 'Sine.easeInOut' })
          }
        } else if (ev.e === 'attack') {
          const vis = this.seen(ev.to[0], ev.to[1]) || this.seen(ev.from[0], ev.from[1]) || ev.owner === this.host.me
          if (!vis) continue
          const v = this.units.get(ev.unit)
          const [fx, fy] = hexCenter(ev.from[0], ev.from[1])
          const [tx, ty] = hexCenter(ev.to[0], ev.to[1])
          if (ev.owner !== this.host.me && !this.inView(ev.to[0], ev.to[1], 10)) { this.centerOn(ev.to[0], ev.to[1]); await this.wait(280) }
          if (v) v.spr.setFlipX(tx < fx)
          if (ev.ranged) {
            sfx('shoot')
            const pr = this.add.image(fx, fy - 4, A, ev.city ? 'fx_rock' : 'fx_arrow').setDepth(D_FOG - 4)
            pr.setRotation(Math.atan2(ty - fy, tx - fx))
            await this.tween({ targets: pr, x: tx, y: ty - 4, duration: 170 * sp })
            pr.destroy()
          } else if (v) {
            const ox = v.c.x, oy = v.c.y
            await this.tween({ targets: v.c, x: ox + (tx - fx) * 0.55, y: oy + (ty - fy) * 0.55, duration: 90 * sp, ease: 'Quad.easeIn' })
            this.tweens.add({ targets: v.c, x: ox, y: oy, duration: 130 * sp, ease: 'Quad.easeOut' })
          }
          sfx('hit')
          this.fx('hit', 'fx_hit_0', tx, ty - 3)
          this.cameras.main.shake(90, 0.0025)
          if (ev.dmgDef) this.floater?.(tx, ty - 10, `−${ev.dmgDef}`, '#ff6b5e')
          if (ev.dmgAtt) this.floater?.(fx, fy - 10, `−${ev.dmgAtt}`, '#ffb35e')
          await this.wait(230 * sp)
        } else if (ev.e === 'cityShot') {
          if (!this.seen(ev.to[0], ev.to[1])) continue
          const [fx, fy] = hexCenter(ev.from[0], ev.from[1])
          const [tx, ty] = hexCenter(ev.to[0], ev.to[1])
          sfx('shoot')
          const pr = this.add.image(fx, fy - 10, A, 'fx_arrow').setDepth(D_FOG - 4).setRotation(Math.atan2(ty - fy + 6, tx - fx))
          await this.tween({ targets: pr, x: tx, y: ty - 4, duration: 180 * sp })
          pr.destroy()
          this.fx('hit', 'fx_hit_0', tx, ty - 3)
          this.floater?.(tx, ty - 10, `−${ev.dmg}`, '#ff6b5e')
          await this.wait(160 * sp)
        } else if (ev.e === 'die') {
          const v = this.units.get(ev.unit)
          if (!v) continue
          this.units.delete(ev.unit)
          v.work?.stop()
          if (v.c.visible && this.seen(ev.x, ev.y)) {
            sfx('die')
            this.fx('smoke', 'fx_smoke_0', v.c.x, v.c.y)
            await this.tween({ targets: v.c, alpha: 0, y: v.c.y + 3, duration: 220 * sp })
          }
          v.c.destroy()
        } else if (ev.e === 'found') {
          if (!this.seen(ev.x, ev.y)) continue
          const [cx, cy] = hexCenter(ev.x, ev.y)
          sfx('found')
          this.fx('smoke', 'fx_smoke_0', cx, cy - 4)
          this.syncAll()
          await this.wait(200 * sp)
        } else if (ev.e === 'capture') {
          if (!this.seen(ev.x, ev.y)) continue
          const [cx, cy] = hexCenter(ev.x, ev.y)
          sfx(ev.by === this.host.me ? 'fanfare' : 'war')
          this.fx('smoke', 'fx_smoke_0', cx, cy - 6)
          this.cameras.main.shake(200, 0.004)
          await this.wait(300 * sp)
        } else if (ev.e === 'spawn') {
          const s = this.host.state
          const u = s.units.find(o => o.id === ev.unit)
          if (!u || this.units.has(u.id)) continue
          const v = this.makeUnitView(u)
          v.key = this.frameOf(u)
          this.placeUnit(u, v)
        }
      }
    } finally {
      this.playing = false
      this.syncAll()
    }
  }

  /** Jednotky, které se mají objevit ještě před animací (aby šly rozpohybovat). */
  ensureUnitViews(): void {
    const s = this.host.state
    for (const u of s.units) if (!this.units.has(u.id)) { const v = this.makeUnitView(u); v.key = this.frameOf(u); this.placeUnit(u, v); v.c.setVisible(false) }
  }

  hostile(u: Unit): boolean { return atWar(this.host.state, this.host.me, u.owner) }
  unitName(u: Unit): string { return UNITS[u.type].name }
}
