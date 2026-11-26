// ---------------------------------------------------------------- shore, resources, map overlays, fx
for (let i = 0; i < 6; i++) {
  // sand + foam band hugging edge i (drawn over a water tile whose neighbour i is land)
  sprite("shore_" + i, { w: 32, h: 32 }, (c) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (!inHex(x, y)) continue
      const d = edgeDist(i, x, y), t = edgeAlong(i, x, y), wv = Math.sin(t * 0.9 + i) * 0.7 + Math.sin(t * 0.37 + i * 2) * 0.5
      if (d < 2.1 + wv) c.px(x, y, d < 1.2 + wv * 0.5 ? "s" : "z")
      else if (d < 3.4 + wv) c.px(x, y, "w")
      else if (d < 4.6 + wv && (Math.round(t) + 100) % 5 < 2) c.px(x, y, "v")
    }
  })
  sprite("border_" + i, { w: 32, h: 32 }, (c) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (inHex(x, y) && edgeDist(i, x, y) < 2) c.px(x, y, "#ffffff")
  })
}

// resources: small motif in the lower-left of the hex (around x 4..16, y 14..26)
const res = (name, ...items) => {
  sprite("_o_" + name, { w: 13, h: 12, outline: "k" }, ...items)
  sprite(name, { w: 32, h: 32 }, stamp("_o_" + name, 3, 13))
}
res("r_wheat", `
  ..x...x...x..
  .xyx.xyx.xyx.
  .xyY.xyY.xyY.
  .xyx.xyx.xyx.
  .xyY.xyY.xyY.
  ..y...y...y..
  ..G...G...G..
  ..G..GG...GG.
  .GG...G...G..
  ..G...G...G..`)
res("r_horses", `
  ..........BB.
  .........Bll.
  ........BlllE
  .B.llllllll..
  B.lllllllb...
  B.llllllbb...
  ..llbbblb....
  ..l.b..l.b...
  ..l.b..l.b...
  ..B.B..B.B...`)
res("r_iron", `
  .....UU......
  ....UTTU.....
  ...UTdTTU....
  ..UTTTTaTUU..
  .UTdTTTTUTTU.
  .UTTTaTTUTdU.
  UTTTTTTUTTTTU
  UTaTTdTUTTaTU
  UUUUUUUUUUUUU`)
res("r_gold", `
  .....xx......
  ....xyyY.....
  ...xyyyYY....
  ...yyxyYY.x..
  .xx.yyYY.xyY.
  xyyY....xyyYY
  yyxYY.xxyyxYY
  yyyYYxyyYyyYY
  .YYY.yyyYYYY.`)
res("r_stone", `
  .....ww......
  ....wWWu.....
  ...wWWWut....
  ..wWWWWuut...
  .wWWWuwwutt..
  .WWWuwWWWutt.
  wWWuuWWWWuutt
  WWuutWWWuuttT
  uutttuuuutttT`)
res("r_fish", `
  .............
  ..........v..
  .....aaa.....
  r...ayyyaa...
  rr.ayyyykya..
  rrayyyyyyyy..
  rr.axxxxxa...
  r...aaaa.....
  .............
  .vvv....vv...`)
res("r_deer", `
  .......l.l...
  .......ll.l..
  ........lL...
  ........lLlE.
  .w.....llll..
  .llllllllL...
  .llLLLlllL...
  .llLLLLll....
  .l.b...l.b...
  .l.b...l.b...
  .B.B...B.B...`)

// ---- hex overlays
sprite("hex_mask", { w: 32, h: 32 }, hexFill("#ffffff"))
anim("hex_cursor", { w: 32, h: 32, frames: 2, fps: 3 }, (c) => {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inHex(x, y)) continue
    const d = hexDist(x, y)
    if (c.frame === 0) { if (d < 2) c.px(x, y, d < 1 ? "#ffffff" : "x") }
    else if (d >= 1 && d < 3) c.px(x, y, d < 2 ? "#ffffff" : "y")
  }
})
sprite("hex_move", { w: 32, h: 32 }, (c) => {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inHex(x, y)) continue
    const d = hexDist(x, y)
    if ((d >= 1 && d < 2) || (d > 3.5 && y % 3 === 0 && (x + (y % 6 ? 3 : 0)) % 6 === 0)) c.px(x, y, "#ffffff")
  }
})
sprite("hex_attack", { w: 32, h: 32 }, (c) => {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inHex(x, y)) continue
    const d = hexDist(x, y)
    if (d < 1) c.px(x, y, "R"); else if (d < 2) c.px(x, y, "r")
  }
  // crosshair ticks at the 6 corners pointing in + centre gap
  for (const [x0, y0, dx, dy] of [[16, 3, 0, 1], [16, 28, 0, -1], [3, 16, 1, 0], [28, 16, -1, 0]]) {
    for (let k = 0; k < 4; k++) { c.px(x0 + dx * k, y0 + dy * k, "r"); c.px(x0 + dx * k - Math.abs(dy), y0 + dy * k - Math.abs(dx), "r") }
    c.px(x0 + dx * 4, y0 + dy * 4, "R"); c.px(x0 + dx * 4 - Math.abs(dy), y0 + dy * 4 - Math.abs(dx), "R")
  }
})

// fog: hex grown by 2px, dark cloud texture
pal({ "3": "#0e1226", "4": "#161c3a", "5": "#1f2850", "6": "#2a3566" })
sprite("fog", { w: 36, h: 36 }, clip((x, y) => hexDist(x - 2, y - 2) > -2,
  rect(0, 0, 36, 36, "4"),
  (c) => {
    const r = c.rng(4)
    for (let k = 0; k < 9; k++) {
      const x = Math.round(3 + r() * 30), y = Math.round(4 + r() * 28), rx = Math.round(3 + r() * 4)
      c.ellipse(x, y + 1, rx, 2, "3")
      c.ellipse(x, y, rx, 2, "5"); c.ellipse(x - 1, y - 2, Math.max(1, rx - 2), 1, "5")
      c.hline(x - rx + 2, y - 2, Math.max(1, rx - 1), "6")
    }
  }))
sprite("path_dot", { w: 4, h: 4, outline: "k" }, ".ww.\nwwww\nwwww\n.ww.")

// ---- fx
anim("fx_hit", { w: 16, h: 16, fps: 14, loop: false, frames: 5 }, (c) => {
  const f = c.frame, R = [2, 4, 6, 7, 7][f]
  if (f < 3) { c.circ(8, 8, R, f === 0 ? "w" : "x"); if (f > 0) c.circ(8, 8, R - 2, "w") }
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2 + 0.3, r0 = [1, 3, 4, 6, 7][f], r1 = [3, 6, 7, 7, 7.6][f]
    const col = f < 2 ? "x" : f < 4 ? (k % 2 ? "y" : "a") : "r"
    if (f === 4 && k % 2) continue
    c.line(Math.round(7.5 + Math.cos(a) * r0), Math.round(7.5 + Math.sin(a) * r0), Math.round(7.5 + Math.cos(a) * r1), Math.round(7.5 + Math.sin(a) * r1), col)
  }
  if (f === 3) c.ring(8, 8, 3, "a")
})
anim("fx_smoke", { w: 16, h: 16, fps: 8, loop: false, frames: 4 }, (c) => {
  const f = c.frame
  const puffs = [[8, 11, 3], [5, 9, 2], [11, 9, 2], [8, 7, 3]]
  for (const [x, y, r] of puffs) {
    const rr = r + [0, 1, 1, 0][f] - (f === 3 ? 1 : 0), yy = y - f * 2
    if (rr < 1) { c.px(x, yy, "u"); continue }
    c.circ(x + (f > 1 ? (x - 8) / 2 : 0), yy + 1, rr, f < 2 ? "T" : "t")
    c.circ(x + (f > 1 ? (x - 8) / 2 : 0), yy, rr, f < 3 ? "u" : "t")
    if (f < 2) c.circ(x - 1, yy - 1, Math.max(0, rr - 2), "W")
  }
  if (f === 3) for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2) c.px(x, y, "_")
})
sprite("fx_arrow", `
  ......w..
  bbllllwww
  ......w..`)
sprite("fx_rock", `
  .uuu.
  uWutT
  uuttT
  uttTT
  .TTT.`)

// ---------------------------------------------------------------- roads, rivers, worked-tile markers
// Edge midpoints (0=E 1=SE 2=SW 3=W 4=NW 5=NE). A road segment runs centre -> midpoint; the line
// continues into the neighbour's centre, and both tiles rasterise the same infinite line clipped to
// their own hex, so the halves meet without a seam.
const EDGE_MID = [[32, 16], [24, 28], [8, 28], [0, 16], [8, 4], [24, 4]]
const ROAD_CORE = 1.15, ROAD_EDGE = 2.2
const ROAD_U = EDGE_MID.map(([mx, my]) => { const len = Math.hypot(mx - 16, my - 16); return [(mx - 16) / len, (my - 16) / len] })
// distance of a point (relative to the centre) from the ray of segment i
const roadDist = (i, px, py) => { const [ux, uy] = ROAD_U[i], t = px * ux + py * uy; return t < 0 ? Math.hypot(px, py) : Math.abs(px * -uy + py * ux) }
for (let i = 0; i < 6; i++) {
  const [ux, uy] = ROAD_U[i], sgn = uy < 0 || (uy === 0 && ux < 0) ? -1 : 1
  sprite("road_" + i, { w: 32, h: 32 }, (c) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (!inHex(x, y)) continue
      const px = x + 0.5 - 16, py = y + 0.5 - 16, d = roadDist(i, px, py)
      if (d < ROAD_CORE) c.px(x, y, (px * -uy + py * ux) * sgn < 0 ? "L" : "l")
      // dark kerb, but never where another segment's surface could be: any mix of segments can be
      // drawn in any order without a kerb cutting across a neighbouring segment
      else if (d < ROAD_EDGE && px * ux + py * uy > 0 && ![0, 1, 2, 3, 4, 5].some((j) => j !== i && roadDist(j, px, py) < ROAD_CORE)) c.px(x, y, "b")
    }
  })
}
// junction cap / lone road tile: draw it UNDER the segments (closes the kerb around the hub)
sprite("road_c", { w: 32, h: 32 }, (c) => {
  for (let y = 12; y < 20; y++) for (let x = 12; x < 20; x++) {
    const px = x + 0.5 - 16, py = y + 0.5 - 16, r = Math.hypot(px, py)
    if (r < 1.6) c.px(x, y, py < 0 ? "L" : "l")
    else if (r < 2.9) c.px(x, y, "b")
  }
})

// river along edge i: half of the stream lives in this tile, the other half in the neighbour
for (let i = 0; i < 6; i++) {
  sprite("river_" + i, { w: 32, h: 32 }, (c) => {
    const a = (i + 1) % 6, b = (i + 5) % 6
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      if (!inHex(x, y)) continue
      const d = edgeDist(i, x, y), t = edgeAlong(i, x, y)
      const wv = Math.sin(t * 0.8 + i * 1.7) * 0.55
      const bank = 2.35 + wv
      if (d < bank) {
        const glint = Math.abs(d - (0.9 + wv * 0.9)) < 0.55 && ((Math.round(t) + 64) % 7) < 4
        c.px(x, y, glint ? ((Math.round(t) + 64) % 7 === 1 ? "v" : "I") : d < 0.9 ? "o" : "i")
      } else if (d < bank + 1 && Math.min(edgeDist(a, x, y), edgeDist(b, x, y)) > 3.4) c.px(x, y, "O")
    }
  })
}

// worked tile: bold 2px outline with heavier corners (white, tinted by the game)
sprite("hex_worked", { w: 32, h: 32 }, (c) => {
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (!inHex(x, y)) continue
    const ds = EDGES.map((_, i) => edgeDist(i, x, y)).sort((p, q) => p - q)
    if (ds[0] < 2 || (ds[0] < 3 && ds[1] < 5.5)) c.px(x, y, "#ffffff")
  }
})
sprite("_o_mark_worked", { w: 7, h: 7, outline: "k" }, `
  .BBBBB.
  BBBBBBB
  BfffffB
  ffkfkff
  fffffff
  .fFFFf.
  ..fff..`)
sprite("mark_worked", { w: 32, h: 32 }, stamp("_o_mark_worked", 11, 3))

// značky u jednotek: hodnost (počet povýšení), čekající povýšení, možnost přezbrojit
sprite("mk_rank1", { w: 5, h: 3, outline: "k" }, `
  ..x..
  .xyx.
  xy.yx`)
sprite("mk_rank2", { w: 5, h: 6, outline: "k" }, `
  ..x..
  .xyx.
  xy.yx
  ..x..
  .xyx.
  xy.yx`)
sprite("mk_rank3", { w: 5, h: 9, outline: "k" }, `
  ..x..
  .xyx.
  xy.yx
  ..x..
  .xyx.
  xy.yx
  ..x..
  .xyx.
  xy.yx`)
sprite("mk_promo", { w: 7, h: 7, outline: "k" }, `
  ...x...
  ..xyx..
  xxyyyxx
  .yyyyy.
  ..yyy..
  .yyYyy.
  .yY.Yy.`)
sprite("mk_up", { w: 7, h: 7, outline: "k" }, `
  ...w...
  ..www..
  .wwwww.
  wwwwwww
  ..whw..
  ..whw..
  ..hmh..`)
