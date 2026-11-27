// ---------------------------------------------------------------- features & improvements (tall 32x48)
// Object art is drawn on a 30x46 canvas (outline adds 1px). Footprint there: y 15..46, centre (15, 31).
// Strom a jeho podoba ve větru ("_w"): koruna o pixel vpravo, kmen a spodek koruny stojí.
const tree = (name, art) => {
  const rows = art.trim().split("\n").map((r) => r.trim())
  sprite(name, rows.map((r) => r + ".").join("\n"))
  sprite(name + "_w", rows.map((r, i) => (i < rows.length - 4 ? "." + r : r + ".")).join("\n"))
}
// Les a jeho snímek ve větru.
const forest = (name, shadow, trees) => {
  tall(name, shadow, ...trees.map(([t, x, y]) => stamp(t, x, y)))
  tall(name + "_w", shadow, ...trees.map(([t, x, y]) => stamp(t + "_w", x, y)))
}
tree("_tree_r", `
  ...hgg...
  ..hgGGG..
  .hgGGGGH.
  .gGGGGGH.
  hgGGGGHHJ
  gGGGGGHHJ
  .GGGHHHJ.
  ..HHHJJ..
  ....B....
  ....b....`)
tree("_tree_r2", `
  ..hmg..
  .hmgGG.
  hmgGGGH
  mgGGGHH
  gGGGHHJ
  .GHHHJ.
  ...B...
  ...b...`)
tree("_tree_p", `
  ...h...
  ..hGH..
  ..gGH..
  .hgGHJ.
  .gGGHJ.
  ..gGH..
  .hgGHJ.
  hgGGHHJ
  gGGGHHJ
  .GGHHJ.
  ...B...
  ...b...`)
tree("_tree_p2", `
  ..h..
  .hGH.
  .gGH.
  hgGHJ
  .gGH.
  hgGHJ
  gGGHJ
  ..B..
  ..b..`)
const shadowBlob = (x, y, rx, ry = 2) => ellipse(x, y, rx, ry, SHADOW)

forest("f_forest_1", [shadowBlob(17, 41, 12, 3), shadowBlob(10, 34, 7, 2)],
  [["_tree_p", 3, 13], ["_tree_r", 11, 12], ["_tree_p2", 22, 18], ["_tree_r2", 1, 24], ["_tree_r", 9, 26], ["_tree_p", 20, 25]])
forest("f_forest_2", [shadowBlob(16, 41, 12, 3), shadowBlob(20, 33, 7, 2)],
  [["_tree_p", 11, 9], ["_tree_r2", 2, 17], ["_tree_p", 20, 14], ["_tree_p2", 6, 27], ["_tree_p", 13, 26], ["_tree_r2", 21, 28]])

// column: lit left, fluted, optional capital; yb = base row
const column = (c, x, yb, h, cap) => {
  c.rect(x, yb - h, 4, h, "W"); c.vline(x, yb - h, h, "w"); c.vline(x + 3, yb - h, h, "u"); c.vline(x + 2, yb - h, h, "u")
  c.rect(x - 1, yb, 6, 1, "u"); c.px(x - 1, yb, "W")
  if (cap) { c.rect(x - 1, yb - h - 1, 6, 1, "w"); c.px(x + 4, yb - h - 1, "u") }
  else { c.px(x, yb - h, "."); c.px(x + 3, yb - h - 1, "u"); c.px(x + 2, yb - h - 1, "W") }
}
tall("f_ruins", [shadowBlob(16, 42, 13, 3)], (c) => {
  // cracked floor slab
  c.poly([3, 37, 27, 37, 29, 41, 1, 41], "u"); c.hline(3, 37, 24, "W"); c.hline(1, 40, 28, "t")
  c.line(8, 38, 11, 40, "T"); c.line(19, 37, 17, 39, "T")
  // back lintel across two columns
  column(c, 4, 36, 17, true); column(c, 12, 36, 17, true)
  c.rect(3, 15, 15, 3, "W"); c.hline(3, 15, 15, "w"); c.hline(3, 17, 15, "u"); c.rect(16, 16, 2, 2, "u")
  c.px(17, 15, "_"); c.px(17, 16, "_"); c.px(16, 15, "_")
  // broken columns
  column(c, 21, 36, 9, false)
  // fallen drum + rubble in front
  c.rect(17, 39, 7, 3, "W"); c.hline(17, 39, 7, "w"); c.hline(17, 41, 7, "u"); c.vline(19, 39, 3, "u"); c.vline(22, 39, 3, "u")
  c.rect(5, 40, 3, 2, "u"); c.px(5, 40, "W"); c.px(10, 41, "t"); c.px(26, 39, "u")
  // ivy
  c.px(5, 22, "G"); c.px(4, 23, "g"); c.px(5, 24, "G"); c.px(4, 26, "G"); c.px(13, 30, "g"); c.px(14, 31, "G"); c.px(22, 33, "g"); c.px(21, 34, "G")
})

// hide tent: apex (x, y), half-width hw, height h
const tent = (c, x, y, hw, h) => {
  c.poly([x, y, x + hw + 1, y + h, x - hw, y + h], "L")
  c.poly([x, y, x + 1, y, x + hw + 1, y + h, x + 2, y + h], "l")       // shaded right flank
  c.line(x, y + 1, x - hw + 1, y + h - 1, "z")
  c.poly([x, y + h - 5, x + 2, y + h, x - 1, y + h], "E")                // door
  c.px(x - 1, y - 1, "B"); c.px(x + 1, y - 1, "B"); c.px(x, y, "B")      // crossed poles
  c.px(x - Math.round(hw / 2), y + h - 3, "l"); c.px(x - Math.round(hw / 2) - 1, y + h - 2, "l"); c.hline(x - hw, y + h, 2 * hw + 2, "b")   // hide patch stitches
}
// Tábor ve dvou snímcích: oheň plápolá.
const camp = (name, flick) => tall(name, [shadowBlob(15, 42, 13, 3)], (c) => {
  // palisade arc behind
  for (let i = 0; i < 9; i++) {
    const x = 2 + i * 3, top = 22 - Math.round(Math.sin(i / 8 * Math.PI) * 4) + (i % 2)
    c.rect(x, top, 2, 34 - top, "B"); c.vline(x, top, 34 - top, "b"); c.px(x, top - 1, "b")
  }
  c.hline(2, 29, 26, "E")
  tent(c, 9, 22, 6, 13)
  tent(c, 21, 26, 5, 11)
  // skull banner pole
  c.vline(15, 12, 16, "B"); c.rect(16, 13, 5, 4, "r"); c.hline(16, 16, 5, "R"); c.px(20, 15, "."); c.px(18, 14, "w"); c.px(18, 15, "w")
  // campfire
  c.hline(12, 41, 6, "B"); c.px(11, 41, "t"); c.px(18, 41, "t"); c.px(14, 42, "T")
  if (!flick) { c.rect(13, 38, 4, 3, "a"); c.px(14, 37, "a"); c.px(15, 36, "y"); c.rect(14, 39, 2, 2, "y"); c.px(15, 38, "x"); c.px(13, 38, "r"); c.px(16, 38, "r") }
  else { c.rect(13, 38, 4, 3, "a"); c.px(15, 37, "a"); c.px(14, 36, "a"); c.px(14, 35, "y"); c.rect(14, 39, 2, 2, "y"); c.px(14, 38, "x"); c.px(13, 39, "r"); c.px(16, 38, "r"); c.px(17, 36, "y") }
})
camp("f_camp", false)
camp("f_camp_w", true)

// Sun Temple: golden stepped pyramid, stair, shrine and sun disc
tall("f_wonder", [shadowBlob(16, 43, 14, 3)], (c) => {
  const tiers = [[1, 36, 28, 6], [4, 30, 22, 6], [7, 24, 16, 6], [10, 19, 10, 5]]
  for (const [x, y, w, h] of tiers) {
    c.rect(x, y, w, h, "y"); c.hline(x, y, w, "x"); c.rect(x + w - 3, y + 1, 3, h - 1, "Y"); c.hline(x, y + h - 1, w, "Y")
    c.vline(x, y, h, "x")
    for (let k = x + 3; k < x + w - 4; k += 4) c.vline(k, y + 2, h - 3, "Y")     // pilasters
  }
  // central stair
  c.rect(12, 24, 6, 18, "z"); for (let y = 25; y < 42; y += 2) c.hline(12, y, 6, "S")
  c.vline(11, 24, 18, "Y"); c.vline(18, 24, 18, "Y")
  // shrine
  c.rect(11, 13, 8, 6, "w"); c.vline(11, 13, 6, "W"); c.vline(18, 13, 6, "u"); c.rect(14, 15, 2, 4, "E")
  c.rect(10, 12, 10, 1, "r"); c.hline(10, 12, 10, "r"); c.px(19, 12, "R")
  // sun disc with rays
  c.circ(15, 6, 3, "y"); c.circ(15, 6, 2, "x"); c.px(14, 5, "w")
  c.px(15, 1, "y"); c.px(15, 11, "y"); c.px(10, 6, "y"); c.px(20, 6, "y"); c.px(11, 2, "y"); c.px(19, 2, "y"); c.px(11, 10, "a"); c.px(19, 10, "a")
  // braziers
  c.px(2, 34, "a"); c.px(2, 35, "B"); c.px(27, 34, "a"); c.px(27, 35, "B"); c.px(2, 33, "y"); c.px(27, 33, "y")
})

// ---- improvements
// flat field patch (no outline): parallelogram with crop rows
const field = (x, y, w, h, a, b, vert) => (c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) c.px(x + i, y + j, (vert ? i : j) % 2 ? b : a)
}
const hut = (c, x, y, roof = "l", roofD = "b") => {       // 9x8 hut, (x, y) = top-left
  c.rect(x + 1, y + 4, 7, 4, "L"); c.rect(x + 6, y + 4, 2, 4, "l"); c.rect(x + 3, y + 5, 2, 3, "E")
  c.poly([x + 4, y, x + 5, y, x + 9, y + 4, x, y + 4], roof); c.poly([x + 5, y, x + 9, y + 4, x + 6, y + 4], roofD)
  c.hline(x, y + 4, 9, roofD)
}
// Farma: malý dvorek uprostřed pole – chalupa, kupka sena a tři záhony v tlumených barvách, ať nepřebije krajinu.
sprite("_o_i_farm", { w: 30, h: 46, outline: "k" }, (c) => {
  hut(c, 15, 22, "s", "Z")
  c.rect(8, 29, 3, 3, "y"); c.rect(8, 29, 3, 1, "x"); c.px(10, 31, "Y")      // hay stack
})
sprite("i_farm", { w: 32, h: 48 },
  clip((x, y) => inHexT(x, y),
    field(7, 33, 9, 6, "q", "p", false),
    field(17, 32, 9, 5, "m", "G", true),
    field(12, 40, 10, 4, "p", "P", false)),
  stamp("_o_i_farm", 0, 0))

// Vylepšení jsou schválně drobná (zhruba polovina pole kolem středu), ať krajina pod nimi zůstane čitelná.
// Důl: skalka se vstupem do štoly a hromádkou rudy.
tall("i_mine", [shadowBlob(16, 39, 8, 2)], (c) => {
  c.poly([8, 37, 10, 30, 14, 26, 18, 27, 21, 31, 22, 37], "t")
  c.poly([10, 30, 14, 26, 15, 29, 11, 33], "u")
  c.poly([18, 27, 21, 31, 22, 37, 19, 37, 19, 31], "T")
  c.px(13, 27, "W")
  c.rect(12, 31, 5, 7, "E")
  c.hline(11, 30, 7, "L"); c.vline(11, 31, 7, "l"); c.vline(17, 31, 7, "b")
  c.rect(20, 37, 3, 1, "T"); c.px(21, 36, "T"); c.px(21, 37, "y"); c.px(20, 36, "y")
})

// Ohrada: malý plot dokola a ovce.
tall("i_pasture", [ellipse(16, 34, 7, 4, "m"), px(13, 33, "h"), px(19, 35, "G")], (c) => {
  const pts = []
  for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * Math.PI * 2; pts.push([Math.round(15 + Math.cos(a) * 7.5), Math.round(33 + Math.sin(a) * 4.5)]) }
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 8]
    if (i === 1) continue                              // branka vepředu
    c.line(x0, y0 - 1, x1, y1 - 1, "L")
  }
  for (const [x, y] of pts) { c.vline(x, y - 2, 3, "b"); c.px(x, y - 2, "L") }
  c.rect(13, 32, 3, 2, "w"); c.hline(13, 33, 3, "W"); c.px(16, 32, "E"); c.px(13, 34, "E"); c.px(15, 34, "E")
})

// Pila: hranice klád a pařez se sekerou.
tall("i_lumber", [shadowBlob(16, 39, 8, 2)], (c) => {
  const log = (x, y) => { c.rect(x, y, 4, 4, "l"); c.px(x, y, "b"); c.px(x + 3, y, "b"); c.px(x, y + 3, "b"); c.px(x + 3, y + 3, "B"); c.px(x + 1, y + 1, "L"); c.px(x + 2, y + 2, "b") }
  log(8, 34); log(12, 34); log(10, 30)
  c.rect(19, 35, 3, 3, "b"); c.hline(19, 35, 3, "L"); c.vline(21, 36, 2, "B")
  c.line(22, 30, 20, 34, "B"); c.rect(21, 29, 3, 2, "u"); c.px(21, 29, "W")
  c.px(17, 38, "L"); c.px(23, 38, "l")
})

// Trhová ves: jeden domek a krám s pruhovanou plachtou.
tall("i_village", [shadowBlob(16, 39, 8, 2)], (c) => {
  hut(c, 14, 26, "r", "R")
  c.rect(7, 31, 6, 2, "r"); c.px(8, 31, "w"); c.px(10, 31, "w"); c.px(12, 31, "w"); c.px(8, 32, "w"); c.px(10, 32, "w"); c.px(12, 32, "w")
  c.vline(7, 33, 4, "b"); c.vline(12, 33, 4, "b"); c.rect(8, 35, 4, 2, "y"); c.hline(8, 35, 4, "x")
  c.rect(19, 36, 2, 2, "l"); c.px(19, 36, "L")
})

// Loviště: malý rybářský člun a dva plováky.
tall("i_fishery", [], (c) => {
  c.poly([10, 34, 20, 34, 18, 37, 12, 37], "b"); c.hline(10, 34, 11, "L"); c.hline(12, 37, 7, "B")
  c.vline(15, 27, 7, "B"); c.poly([16, 28, 20, 33, 16, 33], "w"); c.vline(16, 29, 5, "W")
  c.px(7, 38, "r"); c.px(7, 39, "w"); c.px(23, 39, "r"); c.px(23, 40, "w")
})

// Vymýcení lesa (značka práce): pařez se zaseknutou sekerou.
tall("i_clear", [shadowBlob(16, 42, 10, 3)], (c) => {
  c.rect(10, 32, 9, 8, "b"); c.hline(10, 32, 9, "L"); c.hline(11, 33, 7, "l"); c.vline(18, 33, 7, "B"); c.px(13, 34, "B"); c.px(15, 33, "B")
  c.line(21, 21, 16, 31, "B"); c.line(22, 21, 17, 31, "b"); c.rect(20, 19, 5, 3, "u"); c.hline(20, 19, 5, "W"); c.px(24, 22, "t")
  c.px(6, 40, "L"); c.px(23, 39, "L"); c.px(8, 38, "l"); c.px(21, 41, "l")
})

// Vypleněné vylepšení: dým a doutnající trosky přes obrázek vylepšení.
sprite("i_ruin", { w: 32, h: 48 }, (c) => {
  for (const [x, y, r] of [[15, 24, 3], [18, 19, 3], [14, 15, 2], [20, 13, 2]]) c.circ(x, y, r, "#3c4058b0")
  for (const [x, y] of [[16, 21], [19, 16], [13, 25]]) c.px(x, y, "#5c6278c0")
  c.px(14, 34, "a"); c.px(15, 35, "r"); c.px(13, 35, "y"); c.px(17, 34, "a"); c.px(18, 35, "R"); c.px(16, 33, "y")
})
