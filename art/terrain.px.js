// ---------------------------------------------------------------- flat terrain
sprite("_tuft_g1", "h.h\n.G.")
sprite("_tuft_g2", "h\nG")
sprite("_tuft_g3", ".h\nhG")
sprite("_tuft_g4", "m.\nGm")
sprite("_tuft_p1", "q.q\n.P.")
sprite("_tuft_p2", "q\nP")
sprite("_tuft_p3", ".q\nqQ")
sprite("_tuft_p4", "P.P\n.Q.")
sprite("_flower", "w")
sprite("_flower2", "x")

// irregular soft patches: a few overlapping ellipses of a close tone
const patches = (key, n, seed, oy = 0) => (c) => {
  const r = c.rng(seed)
  for (let i = 0; i < n; i++) {
    const x = 2 + r() * 28, y = oy + 3 + r() * 26, rx = 2 + r() * 4, ry = 1 + r() * 2
    c.ellipse(Math.round(x), Math.round(y), Math.round(rx), Math.round(ry), key)
    c.ellipse(Math.round(x + rx * 0.6), Math.round(y + 1), Math.round(rx * 0.7), Math.round(ry), key)
  }
}

for (let i = 1; i <= 3; i++) {
  sprite("t_grass_" + i, { w: 32, h: 32 }, clip(inHex,
    rect(0, 0, 32, 32, "g"),
    patches("n", 4, 10 + i), patches("m", 3, 20 + i),
    scatter("_tuft_g*", 0, 0, 32, 32, 9 + i, { seed: 30 + i }),
    i === 2 ? scatter("_flower*", 2, 4, 28, 24, 3, { seed: 5 }) : rect(0, 0, 0, 0, "g")))
  sprite("t_plains_" + i, { w: 32, h: 32 }, clip(inHex,
    rect(0, 0, 32, 32, "p"),
    patches("j", 4, 40 + i), patches("q", 2, 50 + i),
    (c) => { // dry grass strokes
      const r = c.rng(60 + i)
      for (let k = 0; k < 7; k++) { const x = 2 + Math.floor(r() * 26), y = 3 + Math.floor(r() * 26); c.hline(x, y, 2 + Math.floor(r() * 2), "P") }
    },
    scatter("_tuft_p*", 0, 0, 32, 32, 8 + i, { seed: 70 + i }),
    i === 3 ? scatter("_tuft_g2", 2, 4, 28, 24, 3, { seed: 9 }) : rect(0, 0, 0, 0, "p")))
}

// desert: dune crests = wavy light line with a shadow line beneath
for (let i = 1; i <= 2; i++) {
  sprite("t_desert_" + i, { w: 32, h: 32 }, clip(inHex,
    rect(0, 0, 32, 32, "s"),
    (c) => {
      const r = c.rng(80 + i)
      const dunes = i === 1 ? [[2, 6, 14], [14, 12, 16], [0, 19, 15], [17, 25, 12], [20, 4, 10]] : [[8, 5, 14], [0, 11, 12], [16, 17, 15], [3, 24, 16], [22, 10, 9]]
      for (const [x0, y0, len] of dunes) {
        const ph = r() * 6
        for (let k = 0; k < len; k++) {
          const t = k / (len - 1), y = Math.round(y0 - Math.sin(t * Math.PI) * 2 + Math.sin(k / 3 + ph) * 0.6)
          c.px(x0 + k, y, "z")
          if (k > 1 && k < len - 1) c.px(x0 + k, y + 1, "S")
          if (k > 3 && k < len - 4) c.px(x0 + k + 1, y + 2, "S")
        }
      }
      for (let k = 0; k < 7; k++) c.px(2 + Math.floor(r() * 28), 2 + Math.floor(r() * 28), r() < 0.5 ? "S" : "z")
    }))
}

// hills: lit mounds on an olive base
const mound = (c, cx, cy, rx, ry) => {
  c.ellipse(cx + 1, cy + 1, rx, ry, "K")
  c.clip((x, y) => y <= cy + 1, () => {
    c.ellipse(cx, cy, rx, ry, "A")
    c.ellipse(cx + 1, cy + 1, rx - 1, ry - 1, "e")
  })
  c.clip((x, y) => y > cy + 1, () => c.ellipse(cx, cy, rx, ry, "e"))
  // shadow foot on the lower right
  c.clip((x, y) => y >= cy && x > cx, () => c.ellipse(cx + 1, cy + 1, rx, Math.max(1, ry - 2), "K"))
  c.clip((x, y) => y >= cy, () => c.ellipse(cx - 1, cy, rx - 1, Math.max(1, ry - 3), "e"))
}
const HILLS = [
  [[9, 9, 7, 5], [22, 12, 8, 5], [12, 21, 9, 5], [25, 24, 5, 3]],
  [[21, 8, 7, 5], [8, 14, 7, 5], [20, 21, 9, 5], [6, 25, 4, 3]],
]
for (let i = 1; i <= 2; i++) {
  sprite("t_hills_" + i, { w: 32, h: 32 }, clip(inHex,
    rect(0, 0, 32, 32, "e"),
    (c) => { for (const m of HILLS[i - 1]) mound(c, ...m) },
    scatter("_tuft_g2", 0, 0, 32, 32, 5, { seed: 90 + i, on: "e" }),
    (c) => { const r = c.rng(95 + i); for (let k = 0; k < 4; k++) { const x = 3 + Math.floor(r() * 26), y = 4 + Math.floor(r() * 24); if (c.is(x, y, "e")) { c.px(x, y, "l"); c.px(x + 1, y, "b") } } }))
}

// water: base + drifting glints
const water = (name, base, dark, lite, glint, seed) =>
  anim(name, { w: 32, h: 32, frames: 4, fps: 3 }, clip(inHex,
    rect(0, 0, 32, 32, base),
    (c) => {
      const r = c.rng(seed)
      for (let k = 0; k < 11; k++) {
        const x = 1 + Math.floor(r() * 27), y = 2 + Math.floor(r() * 28), ph = Math.floor(r() * 4), kind = r()
        const f = (c.frame + ph) % 4
        if (kind < 0.4) { // dark trough
          c.hline(x + (f >> 1), y, 3 + (f % 2), dark)
        } else { // glint: grows, peaks, fades while drifting right
          if (f === 0) c.hline(x, y, 2, lite)
          else if (f === 1) { c.hline(x, y, 4, lite); c.hline(x + 1, y, 2, glint) }
          else if (f === 2) { c.hline(x + 1, y, 3, lite); c.px(x + 2, y, glint) }
          else c.px(x + 2, y, lite)
        }
      }
    }))
water("t_ocean", "o", "O", "i", "I", 3)
water("t_coast", "c", "C", "v", "w", 7)

// ---------------------------------------------------------------- mountains (tall, opaque footprint)
const mtnBase = (seed) => [
  clip(inHexT, rect(0, 16, 32, 32, "g"), patches("n", 4, seed, 16), patches("K", 3, seed + 1, 16),
    scatter("_tuft_g*", 0, 16, 32, 32, 6, { seed })),
]
// a peak: apex (ax, ay), base from xl to xr at yb; lit left face, shaded right face, snow cap
const peak = (c, ax, ay, xl, xr, yb, snow) => {
  const ridge = ax + 3                                     // foot of the ridge line
  const H = yb - ay
  const edge = (x1, y) => Math.round(ax + (x1 - ax) * (y - ay) / H)
  const rid = (y) => edge(ridge, y) + ((y >> 2) % 2)       // slightly zig-zag ridge
  for (let y = ay; y <= yb; y++) {
    const lx = edge(xl, y), rx = edge(xr, y), m = rid(y)
    c.px(lx - 1, y, "U"); c.px(rx + 1, y, "U")
    for (let x = lx; x <= rx; x++) {
      let k = x < m ? "u" : "t"
      if (x >= m && x > rx - 1 - (y - ay) / 6) k = "T"       // far right in deeper shade
      if (x < m && x <= lx + (y - ay) / 10) k = "W"          // rim light on the left
      if (y - ay < snow - ((x + ax) % 3 === 0 ? 3 : (x + ax) % 3 === 1 ? 1 : 0) - (x >= m ? 1 : 0)) k = x < m ? "w" : "W"
      c.px(x, y, k)
    }
  }
  // rock strata
  const r = c.rng(ax * 7 + ay)
  for (let k = 0; k < 6; k++) {
    const y = ay + snow + 2 + Math.floor(r() * Math.max(1, H - snow - 5)), lx = edge(xl, y), rx = edge(xr, y), m = rid(y)
    if (k % 2) { const x = m + 1 + Math.floor(r() * Math.max(1, rx - m - 4)); c.line(x, y, x + 2, y + 2, "U") }
    else { const x = lx + 2 + Math.floor(r() * Math.max(1, m - lx - 5)); c.line(x, y, x + 2, y - 2, "t") }
  }
}
sprite("_mtn_1", { w: 30, h: 44, outline: "k" }, (c) => {
  peak(c, 21, 15, 14, 29, 40, 6)
  peak(c, 11, 3, 0, 24, 42, 12)
  c.rect(3, 41, 3, 2, "t"); c.px(3, 41, "u"); c.rect(23, 41, 4, 2, "T"); c.px(23, 41, "t")
})
sprite("_mtn_2", { w: 30, h: 44, outline: "k" }, (c) => {
  peak(c, 6, 16, 0, 13, 39, 6)
  peak(c, 19, 2, 6, 29, 41, 12)
  peak(c, 9, 26, 3, 17, 43, 4)
})
sprite("t_mountain_1", { w: 32, h: 48 }, ...mtnBase(11), clip((x, y) => y < 40 || inHexT(x, y), stamp("_mtn_1", 0, 1)))
sprite("t_mountain_2", { w: 32, h: 48 }, ...mtnBase(14), clip((x, y) => y < 40 || inHexT(x, y), stamp("_mtn_2", 0, 1)))
