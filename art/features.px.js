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
sprite("_o_i_farm", { w: 30, h: 46, outline: "k" }, (c) => {
  hut(c, 17, 20, "s", "Z")
  c.rect(4, 27, 3, 4, "y"); c.rect(4, 27, 3, 1, "x"); c.px(6, 29, "Y"); c.px(6, 30, "Y")      // hay stack
  c.px(5, 26, "y")
})
sprite("i_farm", { w: 32, h: 48 },
  clip((x, y) => inHexT(x, y) && hexDist(x, y - 16) > 2.5,
    field(3, 21, 13, 11, "h", "G", true),
    field(17, 30, 13, 7, "y", "S", false),
    field(3, 33, 13, 12, "y", "S", false),
    field(17, 38, 13, 8, "l", "B", true),
    field(17, 22, 13, 7, "h", "G", false)),
  stamp("_o_i_farm", 0, 0))

tall("i_mine", [shadowBlob(16, 42, 13, 3)], (c) => {
  // rock mound
  c.poly([2, 40, 5, 28, 10, 21, 17, 18, 23, 22, 27, 30, 28, 40], "t")
  c.poly([5, 28, 10, 21, 17, 18, 15, 23, 9, 27, 6, 34], "u")
  c.poly([23, 22, 27, 30, 28, 40, 23, 40, 24, 30], "T")
  c.line(10, 21, 12, 23, "W"); c.px(16, 19, "W"); c.line(6, 32, 4, 38, "T"); c.line(21, 25, 22, 28, "T")
  // entrance
  c.rect(10, 29, 9, 11, "k"); c.rect(11, 31, 7, 9, "E")
  c.rect(9, 28, 11, 2, "l"); c.hline(9, 28, 11, "L"); c.rect(9, 30, 2, 10, "l"); c.vline(9, 30, 10, "L"); c.rect(18, 30, 2, 10, "b")
  // rails + ore cart
  c.hline(12, 41, 14, "B"); c.hline(13, 43, 15, "B"); for (let x = 14; x < 27; x += 3) c.vline(x, 41, 3, "b")
  c.rect(17, 37, 7, 4, "b"); c.hline(17, 37, 7, "l"); c.vline(23, 37, 4, "B"); c.px(18, 41, "U"); c.px(22, 41, "U")
  c.rect(18, 35, 5, 2, "T"); c.px(19, 35, "y"); c.px(21, 36, "y"); c.px(20, 34, "T"); c.px(18, 36, "U")
  c.px(3, 39, "u"); c.px(4, 40, "T")
})

tall("i_pasture", [ellipse(16, 34, 12, 8, "m"), ellipse(13, 32, 5, 2, "h"), px(20, 36, "G"), px(11, 37, "G"), px(21, 31, "G")], (c) => {
  // fence: back rail, posts, front rail
  const pts = []
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; pts.push([Math.round(15 + Math.cos(a) * 12.5), Math.round(33 + Math.sin(a) * 8)]) }
  for (let i = 0; i < 12; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % 12]
    if (i === 2) continue                              // gate gap at the front
    c.line(x0, y0 - 1, x1, y1 - 1, "l"); c.line(x0, y0 - 3, x1, y1 - 3, "L")
  }
  for (const [x, y] of pts) { c.vline(x, y - 4, 5, "b"); c.px(x, y - 4, "L") }
  // water trough + a sheep
  c.rect(8, 29, 5, 2, "b"); c.hline(9, 29, 3, "c")
  c.rect(16, 33, 5, 3, "w"); c.hline(16, 35, 5, "W"); c.px(21, 33, "E"); c.px(21, 34, "E"); c.px(16, 36, "E"); c.px(19, 36, "E")
})

tall("i_lumber", [shadowBlob(16, 42, 13, 3)], (c) => {
  // saw hut (lean-to) at the back
  c.rect(15, 24, 11, 9, "l"); c.rect(23, 24, 3, 9, "b"); c.rect(18, 27, 4, 6, "E")
  c.poly([13, 24, 20, 18, 28, 18, 28, 20, 27, 24], "H"); c.poly([13, 24, 20, 18, 22, 18, 15, 24], "G"); c.hline(13, 24, 15, "J")
  for (let x = 15; x < 26; x += 3) c.vline(x, 26, 7, "b")
  c.rect(18, 27, 4, 6, "E")
  // log pile (ends facing us): 3 + 2 + 1
  const log = (x, y) => { c.rect(x, y, 4, 4, "l"); c.px(x, y, "b"); c.px(x + 3, y, "b"); c.px(x, y + 3, "b"); c.px(x + 3, y + 3, "B"); c.px(x + 1, y + 1, "L"); c.px(x + 2, y + 2, "b") }
  log(2, 37); log(6, 37); log(10, 37); log(4, 33); log(8, 33); log(6, 29)
  c.rect(14, 38, 3, 3, "b"); c.hline(14, 38, 3, "B")                    // long log side seen behind
  // stump with axe
  c.rect(20, 37, 5, 4, "b"); c.hline(20, 37, 5, "L"); c.vline(24, 38, 3, "B")
  c.line(23, 32, 25, 36, "B"); c.rect(21, 31, 3, 2, "u"); c.px(21, 33, "W")
  c.px(18, 41, "L"); c.px(27, 40, "L"); c.px(16, 42, "l")               // chips
})
