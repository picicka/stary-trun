// ---------------------------------------------------------------- title screen 320x180
pal({ "$": "#fff8d0" })
const ridgeLine = (seed, y0, amp, step, jit = 1.5) => {
  const r = rng(seed), pts = []
  for (let x = -step, i = 0; x <= 320 + step; x += step * (0.6 + r() * 0.8), i++) pts.push([x, y0 - (i % 2 ? amp * (0.45 + r() * 0.55) : amp * r() * 0.3)])
  const h = []
  for (let x = 0, k = 0; x < 320; x++) {
    while (pts[k + 1][0] < x) k++
    const [x0, a] = pts[k], [x1, b] = pts[k + 1], t = (x - x0) / (x1 - x0)
    h.push(Math.round(a + (b - a) * t + (r() - 0.5) * jit))
  }
  return h
}
const ridge = (seed, y0, amp, step, col, cap, capCol, yEnd, lit) => (c) => {
  const h = ridgeLine(seed, y0, amp, step)
  for (let x = 0; x < 320; x++) {
    c.vline(x, h[x], yEnd - h[x], col)
    const rising = h[Math.min(319, x + 2)] > h[x]                 // slope faces right (towards the sun)
    const d = y0 - h[x]
    if (d > cap) c.vline(x, h[x], Math.min(d - cap, rising ? 7 : 3), capCol)
    else if (lit && rising) c.px(x, h[x], lit)
  }
}
const cypress = (c, x, yb, h, col, rim) => {
  for (let i = 0; i < h; i++) { const t = i / h, w = Math.max(0, Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * h / 7 + 0.4)); c.hline(x - w, yb - h + i, w * 2 + 1, col); if (rim && w > 0) c.px(x + w, yb - h + i, rim) }
  c.vline(x, yb - 1, 2, col)
}
const tbuild = (c, x, yb, w, h, roof) => {           // backlit house: lit right edge, warm window
  c.rect(x, yb - h, w, h, "#b07a6a"); c.rect(x + w - 2, yb - h, 2, h, "#f6cf96"); c.hline(x, yb - h, w, "#e8b088")
  if (roof) { c.poly([x - 1, yb - h, x + w / 2, yb - h - 3, x + w + 1, yb - h], "#a84a48"); c.poly([x + w / 2, yb - h - 3, x + w + 1, yb - h, x + w / 2 + 1, yb - h], "#e8785a") }
  if (h > 4) c.px(x + 1 + (x % 3), yb - h + 2, "#ffd870")
}

scene("title_bg", { w: 320, h: 180 },
  layer("sky",
    grad(0, 0, 320, 104, ["#1f2556", "#2e2f6c", "#4a3a82", "#7a4a90", "#b8588c", "#e8786e", "#f6a25a", "#fcd078", "#fff0b0"], "v", 0.5),
    (c) => { const r = c.rng(5); for (let i = 0; i < 46; i++) { const x = Math.floor(r() * 320), y = Math.floor(r() * 34); c.px(x, y, r() < 0.3 ? "#ffffff" : "#a8a8e0") } },
    // sun
    circ(226, 88, 21, "#fcd078"), circ(226, 88, 17, "#fff0b0"), circ(226, 88, 13, "$"),
    // thin clouds lit from below, kept to the sides
    (c) => {
      const cloud = (x, y, w, a, b) => { c.hline(x, y, w, a); c.hline(x + 4, y - 1, w - 10, a); c.hline(x + 3, y + 1, w - 5, b); c.hline(x + 9, y + 2, w - 20, b) }
      cloud(6, 40, 52, "#9a5a96", "#e88a80"); cloud(30, 52, 40, "#b8608c", "#f6a070"); cloud(252, 34, 60, "#9a5a96", "#e88a80")
      cloud(270, 50, 44, "#c86a84", "#f8b070"); cloud(150, 70, 46, "#e8887a", "#fcc878"); cloud(60, 74, 36, "#d87a80", "#f8b070"); cloud(262, 72, 50, "#e8887a", "#fcd078")
    }),
  layer("far", ridge(11, 100, 34, 26, "#9a6a9c", 20, "#f0a898", 106), ridge(23, 102, 24, 18, "#6a5290", 15, "#d890a0", 106, "#a878a8")),
  layer("sea",
    grad(0, 102, 320, 34, ["#fcd487", "#f0a070", "#b8708e", "#6a5a98", "#3e4a88"], "v", 0.7),
    (c) => { // sun glitter path
      const r = c.rng(9)
      for (let y = 102; y < 134; y++) { const w = 5 + (y - 102) * 0.5; for (let k = 0; k < 4; k++) { const x = Math.round(226 + (r() - 0.5) * 2 * w), len = 1 + Math.floor(r() * (3 + (y - 102) / 6)); c.hline(x - (len >> 1), y, len, y < 110 ? "$" : y < 120 ? "#fff0b0" : "#fcd078") } }
      for (let k = 0; k < 40; k++) { const x = Math.floor(r() * 320), y = 106 + Math.floor(r() * 26); c.hline(x, y, 2 + Math.floor(r() * 4), y < 116 ? "#fde0a0" : "#8a70a8") }
      // far headland + tiny ships
      c.poly([268, 102, 284, 96, 300, 98, 320, 93, 320, 104, 262, 104], "#4e4780"); c.hline(284, 96, 10, "#b080a0")
      c.poly([170, 109, 178, 109, 176, 111, 171, 111], "#3a2a50"); c.poly([174, 102, 177, 108, 172, 108], "#fff0d0")
      c.poly([262, 114, 272, 114, 270, 117, 264, 117], "#3a2a50"); c.poly([267, 105, 271, 113, 264, 113], "#ffe8c0")
    }),
  layer("land",
    // right-hand plain and shore
    poly([150, 132, 190, 126, 240, 128, 290, 122, 320, 120, 320, 180, 120, 180], "#3f7250"),
    poly([196, 130, 240, 129, 290, 123, 320, 121, 320, 126, 280, 130, 230, 134], "#8ab058"),
    poly([200, 134, 320, 128, 320, 150, 190, 150], "#55894e"),
    // city hill on the left
    poly([0, 108, 22, 98, 50, 86, 74, 78, 96, 80, 118, 92, 140, 108, 164, 126, 180, 140, 0, 150], "#2f5a4a"),
    poly([74, 78, 96, 80, 118, 92, 140, 108, 164, 126, 150, 128, 122, 108, 100, 92], "#6f9c4c"),
    poly([74, 78, 96, 80, 118, 92, 140, 108, 138, 110, 116, 94, 96, 82, 76, 80], "#c8d870"),
    poly([0, 132, 60, 124, 130, 130, 200, 146, 320, 150, 320, 180, 0, 180], "#2a5248"),
    // river winding from the bay to the foreground
    poly([176, 130, 200, 128, 186, 138, 150, 150, 120, 164, 110, 180, 60, 180, 84, 160, 124, 146, 160, 136], "#e89a78"),
    poly([180, 130, 198, 129, 184, 136, 160, 143, 166, 137], "#fcd487"),
    poly([120, 164, 110, 180, 60, 180, 84, 160, 106, 152, 132, 152], "#8a6aa0"),
    poly([104, 156, 128, 150, 150, 150, 124, 160, 100, 166], "#c07a90"),
    (c) => { // fields on the plain, lit rows
      for (const [x, y, w, col] of [[214, 138, 26, "#c8c860"], [246, 135, 30, "#7aa850"], [282, 133, 34, "#d8b858"], [228, 144, 34, "#6a9a4c"], [270, 142, 40, "#b8b858"]]) {
        c.poly([x, y, x + w, y - 2, x + w + 4, y + 3, x + 4, y + 5], col)
        for (let k = 3; k < w; k += 4) c.line(x + k, y, x + k + 3, y + 4, "#3f7250")
      }
      for (const [x, y] of [[206, 133], [262, 131], [300, 128], [312, 139], [196, 142]]) cypress(c, x, y, 8, "#234a40", "#8ab058")
    },
    // the city: terraces climbing to a temple
    (c) => {
      // curtain wall
      c.poly([24, 104, 60, 96, 110, 97, 136, 110, 136, 116, 110, 103, 60, 102, 24, 110], "#b89080")
      c.poly([110, 97, 136, 110, 136, 116, 110, 103], "#f6d8a0")
      for (let x = 26; x < 110; x += 4) c.px(x, 103 - Math.round((Math.min(x, 60) - 24) / 36 * 8) + (x > 60 ? Math.round((x - 60) / 50) : 0), "#f6d8a0")
      for (const [x, y] of [[22, 96], [58, 88], [108, 89], [134, 102]]) { c.rect(x, y, 6, 16, "#a88078"); c.rect(x + 4, y, 2, 16, "#f6d8a0"); c.rect(x - 1, y - 2, 8, 2, "#c8a088"); c.px(x + 6, y - 2, "#fff0c0"); c.px(x + 2, y + 5, "#ffd870") }
      // houses in rows
      const r = c.rng(31)
      for (let x = 30; x < 106; x += 7) { const y = 100 - Math.round(Math.sin((x - 24) / 90 * Math.PI) * 5); tbuild(c, x, y, 5 + Math.floor(r() * 2), 5 + Math.floor(r() * 4), r() < 0.6) }
      for (let x = 42; x < 100; x += 8) { const y = 92 - Math.round(Math.sin((x - 36) / 70 * Math.PI) * 4); tbuild(c, x, y, 6, 5 + Math.floor(r() * 4), r() < 0.5) }
      for (let x = 56; x < 94; x += 9) tbuild(c, x, 85, 7, 6 + Math.floor(r() * 3), r() < 0.5)
      for (const x of [38, 51, 97]) cypress(c, x, 96, 9, "#234a40", "#8ab058")
      // temple on the summit
      c.rect(62, 74, 30, 3, "#c8a088"); c.hline(62, 74, 30, "#fff0c0"); c.rect(88, 74, 4, 3, "#fff0c0")
      c.rect(65, 62, 24, 12, "#7a5a70")
      for (let x = 65; x < 89; x += 4) { c.rect(x, 62, 2, 12, "#e8c0a0"); c.vline(x + 1, 62, 12, "#fff6d8") }
      c.rect(63, 59, 28, 3, "#e8c0a0"); c.hline(63, 59, 28, "#fff6d8")
      c.poly([63, 59, 77, 51, 91, 59], "#d8a890"); c.poly([77, 51, 91, 59, 79, 59], "#fbe0a8"); c.circ(77, 56, 1, "$"); c.px(77, 49, "#ffd870"); c.px(77, 50, "#ffd870")
      // palace tower with banner
      c.rect(96, 66, 7, 18, "#a88078"); c.rect(101, 66, 2, 18, "#f6d8a0"); c.poly([95, 66, 99, 60, 104, 66], "#a84a48"); c.poly([99, 60, 104, 66, 100, 66], "#e8785a")
      c.vline(99, 53, 7, "#3a2a50"); c.rect(100, 53, 5, 3, "#d6453d"); c.px(99, 70, "#ffd870")
      // harbour: quay and boats at the river mouth
      c.rect(150, 127, 16, 2, "#b89080"); c.hline(150, 127, 16, "#f6d8a0"); c.poly([168, 131, 176, 131, 174, 133, 169, 133], "#3a2a50"); c.poly([171, 124, 174, 130, 169, 130], "#fff0d0")
    }),
  layer("fore",
    poly([0, 150, 30, 144, 62, 150, 84, 162, 96, 180, 0, 180], "#17223a"),
    poly([320, 146, 290, 142, 256, 148, 226, 160, 204, 172, 196, 180, 320, 180], "#17223a"),
    (c) => {
      for (const [x, y, h] of [[10, 150, 44], [24, 147, 30], [40, 149, 20], [300, 146, 46], [284, 145, 28], [312, 147, 24]]) cypress(c, x, y, h, "#17223a", "#3c4f5c")
      // broken columns on the right knoll, rim-lit
      for (const [x, y, h] of [[246, 152, 16], [258, 148, 10]]) { c.rect(x, y - h, 5, h, "#232f4c"); c.vline(x + 4, y - h, h, "#f0b888"); c.rect(x - 1, y - h - 1, 7, 1, "#3c4f5c"); c.px(x + 5, y - h - 1, "#f0b888") }
      c.rect(266, 147, 8, 3, "#232f4c"); c.hline(266, 147, 8, "#f0b888")
      // grass rim light along the silhouettes
      const r = c.rng(12)
      for (let x = 0; x < 320; x++) for (let y = 138; y < 180; y++) if (c.get(x, y) !== 0 && c.get(x, y - 1) === 0 && r() < 0.5) { c.px(x, y, "#3c5a50"); if (r() < 0.3) c.px(x, y - 1, "#17223a") }
      // birds
      for (const [x, y] of [[132, 44], [140, 40], [147, 46], [196, 62], [203, 59]]) { c.px(x, y, "#3a2a50"); c.px(x - 1, y - 1, "#3a2a50"); c.px(x + 1, y - 1, "#3a2a50") }
    }),
  glow("$", { r: 34, strength: 0.35, color: "#ffd890" }))
