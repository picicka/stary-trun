// ---------------------------------------------------------------- leader portraits 48x48
// shared bust: head ellipse at (24, 21); skin keys passed as hex
const bust = (c, o) => {
  const { skin, shade, dark } = o
  c.rect(20, 28, 9, 9, shade); c.rect(20, 28, 5, 9, skin)                         // neck
  c.rect(20, 31, 9, 2, dark)
  c.ellipse(24, 21, 9, 11, skin)
  c.clip((x, y) => (x - 24) * 1.1 + (y - 21) * 0.5 > 6.5, () => c.ellipse(24, 21, 9, 11, shade))   // right/bottom shade
  c.rect(14, 20, 2, 5, skin); c.rect(33, 20, 2, 5, shade); c.px(33, 22, dark)       // ears
  // nose
  c.vline(25, 21, 5, shade); c.hline(23, 26, 3, shade); c.px(25, 26, dark); c.px(22, 25, shade)
}
const eyes = (c, iris, y = 20, lid = "k") => {
  for (const x of [18, 27]) { c.hline(x, y - 1, 4, lid); c.hline(x, y, 4, "w"); c.px(x + 1, y, iris); c.px(x + 2, y, "k") }
}

sprite("p_aur", { w: 48, h: 48 }, (c) => {
  c.grad(0, 0, 48, 48, ["#f6b44a", "#f08a2c", "#c85a2e"], "v", 0.6)
  // sun disc headdress behind the head
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; c.line(24, 16, Math.round(24 + Math.cos(a) * 22), Math.round(16 + Math.sin(a) * 22), k % 2 ? "y" : "x") }
  c.circ(24, 16, 16, "Y"); c.circ(24, 16, 15, "y"); c.circ(24, 16, 12, "x"); c.ring(24, 16, 13, "Y")
  // hair: black bob
  c.rect(12, 14, 25, 22, "#241a2e"); c.ellipse(24, 16, 12, 9, "#241a2e"); c.rect(12, 34, 6, 3, "#241a2e"); c.rect(31, 34, 6, 3, "#241a2e")
  for (const x of [13, 15, 33, 35]) c.vline(x, 18, 16, "#3a2c4a")
  for (const y of [33, 35]) { c.hline(12, y, 6, "y"); c.hline(31, y, 6, "y") }
  // shoulders + broad collar
  c.ellipse(24, 47, 20, 10, "#c98a5e"); c.ellipse(24, 46, 14, 9, "y")
  for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) / 9 * Math.PI; c.px(Math.round(24 + Math.cos(a) * 11), Math.round(46 + Math.sin(a) * 7), k % 2 ? "d" : "r") }
  c.ellipse(24, 45, 9, 5, "x"); c.ellipse(24, 43, 7, 4, "#d99a6c"); c.px(24, 46, "d"); c.rect(23, 47, 3, 1, "r")
  bust(c, { skin: "#d99a6c", shade: "#b0714a", dark: "#8a5038" })
  // fringe + gold band with cobra gem
  c.rect(15, 10, 19, 6, "#241a2e"); c.hline(16, 16, 17, "#241a2e"); c.px(15, 16, "#241a2e"); c.px(15, 17, "#241a2e"); c.px(33, 16, "#241a2e"); c.px(33, 17, "#241a2e")
  c.rect(14, 11, 21, 3, "y"); c.hline(14, 11, 21, "x"); c.hline(14, 13, 21, "Y"); c.rect(23, 9, 3, 5, "x"); c.px(24, 11, "r"); c.px(24, 8, "y")
  // kohl eyes, brows, lips
  eyes(c, "#6a4a20", 21)
  c.hline(17, 20, 2, "k"); c.hline(30, 20, 3, "k"); c.px(32, 21, "k"); c.px(17, 21, "k"); c.px(16, 20, "k")
  c.hline(18, 18, 4, "#241a2e"); c.hline(27, 18, 4, "#241a2e")
  c.hline(22, 29, 5, "r"); c.hline(23, 30, 3, "R"); c.px(21, 28, "#8a5038"); c.px(27, 28, "#8a5038")
  c.px(18, 25, "#e8b080"); c.px(19, 26, "#e8b080")
  c.px(14, 26, "x"); c.px(14, 27, "y"); c.px(34, 26, "y"); c.px(34, 27, "Y")       // earrings
})

sprite("p_khar", { w: 48, h: 48 }, (c) => {
  c.grad(0, 0, 48, 30, ["#7a8fb8", "#a8b8d0", "#d8dce8"], "v", 0.6); c.rect(0, 30, 48, 18, "T")
  c.poly([0, 34, 8, 14, 13, 22, 18, 12, 24, 30], "t"); c.poly([8, 14, 11, 19, 8, 19, 6, 20], "w"); c.poly([18, 12, 21, 19, 18, 18, 16, 19], "w")
  c.poly([28, 34, 38, 10, 48, 28, 48, 34], "t"); c.poly([38, 10, 42, 18, 39, 17, 36, 18], "w"); c.poly([38, 10, 48, 28, 48, 34, 42, 34], "T")
  // fur mantle
  c.ellipse(24, 47, 23, 12, "b"); c.ellipse(20, 46, 18, 9, "l")
  for (let k = 0; k < 26; k++) { const x = 2 + (k * 7) % 44, y = 37 + (k * 5) % 10; c.vline(x, y, 2, k % 3 ? "L" : "B"); c.px(x + 1, y + 1, "B") }
  c.rect(19, 38, 11, 10, "R"); c.rect(21, 38, 7, 10, "r")
  bust(c, { skin: "#e8a888", shade: "#c07860", dark: "#8a4a3c" })
  // wild hair + iron-banded fur cap
  c.ellipse(24, 13, 12, 7, "B"); c.rect(12, 13, 4, 16, "B"); c.rect(33, 13, 4, 18, "E"); c.px(12, 29, "B"); c.px(13, 30, "B"); c.px(35, 31, "E")
  c.rect(13, 8, 23, 6, "l"); c.ellipse(24, 8, 11, 4, "l"); c.hline(15, 6, 14, "L"); c.rect(13, 12, 23, 3, "t"); c.hline(13, 12, 23, "u"); c.hline(13, 14, 23, "T")
  for (const x of [15, 20, 24, 28, 33]) c.px(x, 13, "W")
  for (let x = 14; x < 35; x += 3) c.vline(x, 7 + (x % 2), 3, "b")
  // beard: big, braided
  c.poly([15, 25, 18, 27, 31, 27, 34, 25, 34, 33, 29, 41, 24, 44, 19, 41, 14, 33], "b")
  c.poly([25, 27, 34, 25, 34, 33, 29, 41, 24, 44], "B")
  for (const x of [17, 20, 23, 27, 30]) c.vline(x, 31, 8, x > 24 ? "E" : "B")
  c.rect(23, 42, 3, 3, "y"); c.px(24, 45, "b"); c.px(24, 46, "b")
  c.hline(20, 27, 9, "b"); c.rect(21, 29, 7, 1, "#6a2a2a"); c.hline(19, 28, 3, "l"); c.hline(26, 28, 3, "b")       // moustache + grim mouth
  // warpaint: red band across the eyes + cheek stripes
  c.rect(16, 19, 17, 3, "r"); c.hline(16, 21, 17, "R")
  eyes(c, "#4a6a8a", 20)
  c.line(17, 16, 22, 18, "E", 2); c.line(26, 18, 31, 16, "E", 2)                 // heavy scowling brows
  c.vline(18, 23, 3, "r"); c.vline(20, 23, 2, "r"); c.vline(30, 23, 3, "R"); c.vline(28, 23, 2, "R")
  c.line(29, 14, 31, 19, "#8a4a3c")                                              // scar
})

sprite("p_thal", { w: 48, h: 48 }, (c) => {
  c.grad(0, 0, 48, 26, ["#8fd0f0", "#c8ecf8", "#f8f0d0"], "v", 0.6)
  c.rect(0, 26, 48, 22, "o"); c.hline(0, 26, 48, "I"); for (let k = 0; k < 14; k++) c.hline((k * 11) % 44, 28 + (k * 3) % 10, 3, k % 2 ? "i" : "I")
  // ship with sail on the horizon
  c.poly([36, 25, 46, 25, 44, 28, 38, 28], "b"); c.vline(41, 13, 12, "B"); c.poly([42, 14, 47, 18, 47, 22, 42, 23], "w"); c.poly([40, 15, 36, 23, 40, 23], "W"); c.hline(42, 18, 5, "d")
  c.ellipse(8, 8, 4, 2, "w"); c.ellipse(12, 9, 4, 1, "w")
  // cloak
  c.ellipse(24, 48, 22, 12, "D"); c.ellipse(20, 47, 17, 10, "d"); c.poly([20, 37, 24, 44, 29, 37], "w"); c.poly([24, 44, 29, 37, 27, 37], "W")
  c.line(8, 42, 14, 47, "I"); c.line(34, 40, 38, 47, "D"); c.line(13, 39, 19, 47, "D")
  c.circ(31, 40, 2, "y"); c.px(30, 39, "x"); c.px(32, 41, "Y")
  bust(c, { skin: "#d8a070", shade: "#b07850", dark: "#885838" })
  // short curly dark hair + gold circlet
  c.ellipse(24, 13, 11, 6, "#2a2030"); c.rect(13, 13, 3, 8, "#2a2030"); c.rect(33, 13, 3, 9, "#2a2030")
  for (let k = 0; k < 12; k++) c.px(14 + (k * 5) % 21, 8 + (k * 3) % 6, "#4a3a58")
  c.hline(14, 14, 21, "y"); c.hline(14, 15, 21, "Y"); c.px(24, 13, "x"); c.px(24, 14, "d")
  // trimmed pointed beard + moustache
  c.poly([16, 26, 19, 30, 30, 30, 33, 26, 32, 31, 27, 36, 24, 38, 21, 36, 17, 31], "#2a2030")
  c.rect(21, 29, 7, 2, "#d8a070"); c.hline(20, 27, 9, "#2a2030"); c.px(19, 28, "#2a2030"); c.px(29, 28, "#2a2030")
  // sly smirk: one corner up
  c.hline(22, 30, 5, "#8a3a3a"); c.px(27, 29, "#8a3a3a"); c.px(28, 28, "#8a3a3a"); c.px(22, 29, "#d8a070")
  eyes(c, "#2a6a5a", 21)
  c.hline(18, 21, 4, "#d8a070"); c.hline(18, 21, 1, "k"); c.px(19, 21, "#2a6a5a"); c.px(20, 21, "k"); c.px(21, 21, "w")   // narrowed left eye
  c.hline(17, 19, 5, "#2a2030"); c.line(26, 17, 31, 16, "#2a2030")                // one raised eyebrow
  c.px(14, 25, "y"); c.px(14, 26, "x")                                           // earring
})

sprite("p_sylv", { w: 48, h: 48 }, (c) => {
  c.grad(0, 0, 48, 48, ["#1c1840", "#2a2460", "#3a2a6a"], "v", 0.6)
  c.circ(38, 9, 6, "x"); c.circ(40, 7, 5, "#2a2460"); c.px(34, 6, "w")           // crescent moon
  for (const [x, y] of [[5, 5], [14, 3], [22, 8], [9, 14], [44, 20], [30, 3]]) c.px(x, y, "W")
  // pine silhouettes
  for (const [x, h] of [[4, 30], [12, 22], [42, 26], [35, 18]]) { for (let k = 0; k < h; k += 4) c.poly([x, 46 - h + k - 2, x + 2 + k / 3, 46 - h + k + 5, x - 2 - k / 3, 46 - h + k + 5], k % 8 ? "J" : "#16303a"); }
  c.rect(0, 44, 48, 4, "J")
  // cloak + hood
  c.ellipse(24, 48, 21, 12, "X"); c.ellipse(21, 47, 16, 10, "V")
  c.ellipse(24, 20, 15, 17, "X"); c.clip((x, y) => x < 26, () => c.ellipse(23, 20, 14, 16, "V")); c.poly([19, 3, 24, 0, 28, 4], "X"); c.px(23, 2, "V")
  c.rect(12, 30, 25, 8, "X"); c.rect(12, 30, 12, 8, "V")
  c.ellipse(24, 22, 10, 13, "#1a1030")                                          // hood interior
  bust(c, { skin: "#e8c0a8", shade: "#b88a80", dark: "#7a5060" })
  c.clip((x, y) => y < 14, () => c.ellipse(24, 21, 10, 12, "#1a1030"))           // hood shadow over the brow
  c.hline(16, 14, 17, "#7a5060"); c.hline(17, 15, 15, "#b88a80")
  // silver hair strands framing the face
  c.line(15, 14, 13, 34, "W", 2); c.line(34, 14, 35, 34, "u", 2); c.vline(16, 16, 12, "w"); c.px(17, 14, "w")
  // moon mark + cheek dots
  c.px(24, 16, "x"); c.px(23, 17, "x"); c.px(25, 17, "x"); c.px(24, 18, "x")
  c.px(18, 24, "V"); c.px(19, 25, "V"); c.px(30, 24, "X"); c.px(29, 25, "X")
  eyes(c, "g", 21)
  c.px(19, 21, "h"); c.px(28, 21, "h")
  c.line(18, 19, 21, 18, "#7a5060"); c.line(27, 18, 30, 19, "#7a5060")
  c.hline(22, 29, 5, "#a05a6a"); c.px(21, 29, "#b88a80"); c.hline(23, 30, 3, "#b88a80")
  // leaf brooch + cloak clasp cord
  c.circ(24, 39, 2, "g"); c.px(24, 38, "h"); c.px(25, 40, "G"); c.line(18, 36, 22, 38, "y"); c.line(30, 36, 26, 38, "Y")
  c.rect(20, 33, 9, 3, "#1a1030")
})

sprite("p_tark", { w: 48, h: 48 }, (c) => {
  // steppe: dusty sky, golden grass, yurts and a horse-tail standard
  c.grad(0, 0, 48, 29, ["#5a9cc4", "#a4d0d4", "#ece6b4"], "v", 0.6)
  c.poly([0, 29, 0, 25, 9, 22, 20, 26, 30, 23, 40, 21, 48, 24, 48, 29], "#b8c08a")
  c.rect(0, 28, 48, 20, "p"); c.hline(0, 28, 48, "q")
  for (let k = 0; k < 12; k++) c.hline((k * 13) % 45, 30 + (k * 5) % 9, 3, k % 2 ? "j" : "P")
  c.poly([0, 23, 3, 19, 9, 19, 12, 23], "W"); c.hline(3, 19, 6, "w"); c.rect(0, 23, 12, 6, "w"); c.rect(9, 23, 3, 6, "W")
  c.hline(0, 23, 12, "a"); c.hline(0, 24, 12, "#a8551a"); c.rect(4, 25, 3, 4, "B"); c.px(6, 18, "T"); c.px(7, 17, "u")
  c.poly([37, 26, 39, 23, 44, 23, 46, 26], "W"); c.rect(37, 26, 10, 3, "w"); c.hline(37, 26, 10, "a"); c.rect(41, 27, 2, 2, "B")
  c.vline(43, 5, 18, "B"); c.rect(42, 4, 3, 2, "y"); c.rect(41, 6, 2, 5, "r"); c.rect(44, 6, 2, 6, "R"); c.px(41, 11, "r"); c.px(45, 12, "R")
  // deel with crossed collar
  c.ellipse(24, 48, 22, 12, "#a8551a"); c.ellipse(20, 47, 17, 10, "a")
  c.poly([19, 36, 29, 36, 26, 43, 22, 41], "z"); c.poly([24, 42, 29, 36, 27, 36], "s")
  c.line(18, 36, 29, 47, "E", 3); c.line(18, 36, 29, 47, "y"); c.line(30, 36, 25, 43, "E", 2)
  c.line(7, 42, 12, 47, "#f8b060"); c.line(36, 41, 40, 47, "#7a3a14")
  c.circ(14, 43, 2, "y"); c.px(13, 42, "x"); c.px(15, 44, "Y")
  bust(c, { skin: "#dca470", shade: "#b47a4c", dark: "#8a5234" })
  // braids
  c.rect(12, 15, 3, 20, "#241a2e"); c.rect(34, 15, 3, 21, "#241a2e")
  for (const y of [19, 23, 27]) { c.px(13, y, "#4a3a58"); c.px(35, y, "#4a3a58") }
  c.rect(12, 31, 3, 2, "y"); c.rect(34, 32, 3, 2, "Y"); c.px(13, 35, "#241a2e"); c.px(35, 36, "#241a2e")
  // pointed felt hat with fur brim
  c.poly([15, 10, 20, 3, 24, 0, 28, 3, 33, 10], "a"); c.poly([25, 1, 28, 3, 33, 10, 27, 10], "#a8551a")
  c.line(18, 9, 23, 2, "#f8b060"); c.rect(23, 0, 3, 2, "r"); c.px(24, 0, "y"); c.vline(21, 5, 5, "y"); c.vline(27, 5, 5, "Y")
  c.rect(12, 9, 25, 6, "b"); c.rect(13, 8, 23, 1, "b"); c.rect(13, 15, 23, 1, "B"); c.rect(30, 9, 7, 6, "B")
  for (let x = 13; x < 36; x += 2) { c.vline(x, 9 + (x % 3), 2, x < 29 ? "l" : "b"); c.px(x + 1, 13 + (x % 2), "E") }
  // narrow eyes, straight heavy brows
  eyes(c, "#3a2414", 21)
  c.hline(18, 20, 4, "#b47a4c"); c.hline(27, 20, 4, "#8a5234"); c.hline(17, 20, 1, "k"); c.px(22, 21, "k"); c.px(31, 21, "k"); c.px(26, 21, "k")
  c.hline(17, 18, 5, "#241a2e"); c.px(22, 19, "#241a2e"); c.hline(27, 18, 5, "#241a2e"); c.px(26, 19, "#241a2e")
  c.px(17, 25, "#c8805a"); c.px(18, 26, "#c8805a"); c.px(19, 25, "#c8805a"); c.px(30, 25, "#a06040")      // wind-burnt cheeks
  // long drooping moustache + chin tuft
  c.hline(20, 28, 9, "#241a2e"); c.px(24, 28, "#b47a4c"); c.vline(19, 28, 7, "#241a2e"); c.vline(29, 28, 7, "#241a2e"); c.px(20, 29, "#241a2e"); c.px(28, 29, "#241a2e")
  c.hline(22, 30, 5, "#8a3a3a"); c.rect(23, 32, 3, 4, "#241a2e"); c.px(24, 36, "#241a2e")
  c.line(31, 22, 32, 27, "#8a5234")                                              // old scar
})

sprite("p_zahi", { w: 48, h: 48 }, (c) => {
  // desert dusk: stars, dunes, an oasis palm
  c.grad(0, 0, 48, 34, ["#1e2a5a", "#5a4a8a", "#e8946c"], "v", 0.6)
  for (const [x, y] of [[4, 4], [12, 9], [20, 2], [33, 5], [45, 11], [2, 16], [29, 12]]) c.px(x, y, "w")
  c.vline(7, 6, 7, "x"); c.hline(4, 9, 7, "x"); c.px(7, 9, "w"); c.px(6, 8, "y"); c.px(8, 8, "y"); c.px(6, 10, "y"); c.px(8, 10, "y")
  c.poly([0, 32, 10, 26, 22, 33, 36, 27, 48, 31, 48, 48, 0, 48], "S"); c.poly([0, 32, 10, 26, 16, 30, 8, 31, 2, 36], "s"); c.poly([36, 27, 48, 31, 48, 34, 40, 30], "Z")
  c.line(41, 15, 43, 30, "B", 2); c.line(40, 15, 42, 29, "b")
  for (const [x, y, k] of [[35, 13, "H"], [36, 18, "H"], [47, 13, "G"], [47, 18, "H"], [40, 9, "G"], [44, 9, "G"]]) c.line(41, 14, x, y, k, 2)
  // robe
  c.ellipse(24, 48, 22, 12, "#1a7f74"); c.ellipse(20, 47, 17, 10, "#2fc7a8")
  c.line(8, 42, 13, 47, "#8eecd6"); c.line(35, 40, 39, 47, "#125a54")
  // headscarf behind the head, falling on the shoulders
  c.ellipse(24, 19, 14, 15, "#1a7f74"); c.clip((x) => x < 25, () => c.ellipse(23, 19, 13, 14, "#2fc7a8"))
  c.poly([10, 22, 38, 22, 40, 40, 30, 44, 18, 44, 8, 40], "#1a7f74"); c.poly([10, 22, 29, 22, 32, 44, 18, 44, 8, 40], "#2fc7a8")
  c.line(11, 26, 10, 38, "#8eecd6"); c.line(15, 30, 14, 41, "#1a7f74"); c.line(36, 28, 37, 40, "#125a54")
  bust(c, { skin: "#b97a50", shade: "#8f5638", dark: "#6a3a28" })
  // scarf wrapped under the chin + coin necklace
  c.poly([17, 33, 24, 36, 31, 33, 33, 40, 24, 44, 15, 40], "#2fc7a8"); c.poly([28, 35, 31, 33, 33, 40, 28, 43], "#1a7f74"); c.line(17, 35, 23, 38, "#8eecd6"); c.line(24, 37, 29, 35, "#1a7f74")
  for (let k = 0; k < 7; k++) { const x = 15 + k * 3, y = 42 + Math.round(2 - Math.abs(k - 3) * 0.8); c.rect(x, y, 2, 2, "y"); c.px(x, y, "x") }
  // dark hair parted under the scarf, scarf edge with gold coins
  c.clip((x, y) => y < 15, () => c.ellipse(24, 21, 10, 12, "#241a2e"))
  c.poly([19, 14, 24, 13, 29, 14], "#b97a50"); c.hline(27, 14, 3, "#8f5638")
  c.clip((x, y) => y < 13, () => { c.ellipse(24, 21, 11, 13, "#2fc7a8"); c.clip((x) => x > 26, () => c.ellipse(24, 21, 11, 13, "#1a7f74")) })
  c.hline(15, 12, 19, "Y"); for (let x = 15; x < 34; x += 2) c.px(x, 12, "x")
  for (const x of [17, 20, 28, 31]) c.px(x, 13, "y")
  c.vline(24, 13, 2, "y"); c.rect(23, 15, 3, 2, "x"); c.px(24, 17, "y"); c.px(24, 15, "w")           // star pendant on the brow
  // kohl eyes, arched brows, lips
  eyes(c, "#2a8a7a", 21)
  c.px(17, 20, "k"); c.px(16, 19, "k"); c.px(31, 20, "k"); c.px(32, 19, "k"); c.hline(18, 22, 3, "#8f5638")
  c.line(17, 18, 21, 17, "#241a2e"); c.px(22, 18, "#241a2e"); c.line(27, 17, 31, 18, "#241a2e"); c.px(26, 18, "#241a2e")
  c.hline(22, 29, 5, "#a8324a"); c.hline(23, 30, 3, "#7a2238"); c.px(23, 28, "#a8324a"); c.px(25, 28, "#a8324a")
  c.px(18, 25, "#cf8e60"); c.px(19, 26, "#cf8e60"); c.px(24, 32, "#2a8a7a")
  c.rect(13, 25, 2, 3, "y"); c.px(13, 25, "x"); c.px(13, 28, "x"); c.rect(34, 25, 2, 3, "Y"); c.px(34, 28, "y")   // earrings
})

sprite("p_morv", { w: 48, h: 48 }, (c) => {
  // the White Wall under a cold clear sky
  c.grad(0, 0, 48, 37, ["#4474b0", "#6f9ccc", "#a8c8e4"], "v", 0.6)
  c.poly([0, 36, 0, 22, 5, 16, 9, 21, 13, 18, 22, 36], "#8fb0d4"); c.poly([5, 16, 8, 20, 6, 19, 4, 21, 2, 19], "w"); c.poly([13, 18, 15, 22, 13, 21, 11, 22], "w")
  c.rect(0, 36, 48, 12, "W"); for (let x = 1; x < 48; x += 8) { c.rect(x, 32, 5, 4, "W"); c.hline(x, 32, 5, "w"); c.vline(x + 4, 33, 3, "u") }
  c.hline(0, 36, 48, "w")
  for (let y = 41; y < 48; y += 5) { c.hline(0, y, 48, "u"); for (let x = (y % 2) * 4 + 2; x < 48; x += 8) c.vline(x, y - 4, 4, "u") }
  c.rect(38, 8, 10, 40, "w"); c.rect(45, 8, 3, 40, "W"); for (const x of [38, 42, 46]) { c.rect(x, 5, 2, 3, "w"); c.px(x + 1, 6, "W"); c.px(x + 1, 7, "W") }
  c.hline(38, 11, 10, "u"); c.rect(42, 15, 2, 5, "T"); c.px(42, 14, "T"); c.hline(38, 24, 10, "u"); c.hline(38, 34, 10, "u"); c.vline(38, 8, 40, "W")
  // ivory mantle over a slate tunic, chain of office with a key
  c.ellipse(24, 48, 22, 12, "#9a9788"); c.ellipse(20, 47, 17, 10, "#e8e6d8")
  c.poly([19, 36, 30, 36, 24, 46], "T"); c.poly([24, 46, 30, 36, 27, 36], "U")
  c.line(7, 42, 12, 47, "w"); c.line(36, 41, 40, 47, "#7a7868"); c.line(12, 40, 16, 47, "#9a9788")
  c.line(16, 38, 23, 45, "t"); c.line(32, 38, 25, 45, "T"); for (const [x, y] of [[17, 39], [19, 41], [21, 43], [31, 39], [29, 41], [27, 43]]) c.px(x, y, "y")
  c.rect(23, 44, 3, 3, "y"); c.px(24, 45, "T"); c.px(24, 47, "y")
  bust(c, { skin: "#e8b898", shade: "#c08a70", dark: "#8f5f50" })
  // white hair at the temples under a mural crown
  c.rect(13, 13, 3, 12, "w"); c.rect(33, 13, 3, 13, "W"); c.px(13, 25, "W"); c.px(35, 26, "u"); c.vline(14, 15, 9, "W")
  c.rect(13, 9, 23, 6, "u"); c.rect(13, 9, 23, 1, "W"); c.rect(13, 14, 23, 1, "T"); c.rect(31, 9, 5, 6, "t")
  for (const x of [13, 18, 23, 28, 33]) { c.rect(x, 5, 3, 4, "u"); c.hline(x, 5, 3, "W"); c.vline(x + 2, 6, 3, "t") }
  for (const x of [17, 22, 27, 32]) c.vline(x, 10, 4, "t"); c.hline(13, 12, 23, "t"); c.px(24, 11, "y")
  // close-cropped white beard and heavy moustache
  c.poly([15, 24, 18, 27, 31, 27, 34, 24, 33, 31, 29, 35, 24, 36, 19, 35, 16, 31], "w")
  c.poly([26, 27, 34, 24, 33, 31, 29, 35, 24, 36], "W"); for (const x of [18, 21, 27, 30]) c.vline(x, 31, 3, x > 24 ? "u" : "W")
  c.rect(20, 27, 9, 2, "w"); c.rect(25, 27, 4, 2, "W"); c.px(19, 28, "w"); c.px(29, 28, "W"); c.px(19, 29, "W"); c.px(29, 29, "u")
  c.hline(22, 30, 5, "#8a4a4a")
  // deep-set eyes, bushy brows, lines of age
  eyes(c, "#5a7a9a", 21)
  c.hline(17, 18, 5, "w"); c.hline(19, 17, 3, "w"); c.px(22, 19, "w"); c.hline(27, 18, 5, "W"); c.hline(27, 17, 3, "W"); c.px(26, 19, "W")
  c.hline(19, 15, 4, "#c08a70"); c.hline(25, 15, 5, "#8f5f50"); c.hline(18, 23, 3, "#c08a70"); c.hline(27, 23, 3, "#8f5f50"); c.px(16, 22, "#c08a70"); c.px(21, 25, "#c08a70")
})

sprite("p_lume", { w: 48, h: 48 }, (c) => {
  // scriptorium: shelves of scrolls, a window with first light, a candle
  c.rect(0, 0, 48, 48, "#35203a")
  for (const y of [9, 20, 31]) { c.rect(0, y, 30, 2, "B"); c.hline(0, y, 30, "b") }
  c.vline(0, 0, 48, "E"); c.vline(30, 0, 33, "E"); c.vline(31, 0, 33, "B")
  for (const [x, y, k] of [[2, 6, "z"], [6, 6, "s"], [10, 6, "z"], [3, 3, "s"], [8, 3, "z"], [2, 17, "s"], [6, 17, "z"], [4, 14, "z"], [9, 16, "#f06aa8"], [2, 28, "z"], [6, 28, "z"], [4, 25, "s"]]) { c.rect(x, y, 3, 3, k); c.px(x + 1, y + 1, "Z"); c.px(x + 2, y + 2, "S") }
  for (const [x, h, k] of [[14, 6, "R"], [16, 5, "D"], [18, 7, "H"], [21, 6, "X"], [23, 5, "R"], [26, 7, "Y"]]) { c.rect(x, 9 - h, 2, h, k); c.px(x, 10 - h, "y") }
  c.rect(35, 4, 10, 22, "#f8c8a0"); c.ellipse(40, 5, 5, 4, "#f8c8a0"); c.grad(35, 8, 10, 18, ["#f8e8c8", "#f8b8c0", "#d880b0"], "v", 0.6)
  c.vline(40, 1, 25, "E"); c.hline(35, 14, 10, "E"); c.px(37, 6, "w"); c.rect(34, 26, 12, 2, "B"); c.hline(34, 26, 12, "b")
  c.rect(4, 33, 3, 9, "z"); c.vline(6, 33, 9, "S"); c.px(5, 32, "E"); c.poly([5, 26, 7, 30, 5, 32, 3, 30], "a"); c.rect(4, 29, 2, 3, "y"); c.px(5, 30, "x")
  for (const [x, y] of [[2, 27], [8, 27], [1, 30], [9, 31], [5, 24], [3, 25], [7, 25]]) c.px(x, y, "#6a3a4a")
  // robe with a pale stole
  c.ellipse(24, 48, 22, 12, "#a83a70"); c.ellipse(20, 47, 17, 10, "#f06aa8")
  c.line(8, 42, 13, 47, "#f8a8cc"); c.line(35, 40, 39, 47, "#7a2850")
  c.poly([16, 37, 21, 36, 25, 47, 18, 47], "w"); c.poly([32, 37, 28, 36, 25, 47, 31, 47], "W"); c.line(17, 38, 20, 47, "y"); c.line(31, 38, 29, 47, "Y")
  c.poly([20, 36, 29, 36, 25, 43], "#f4c8a8"); c.poly([25, 43, 29, 36, 27, 36], "#cc9480")
  c.circ(25, 44, 2, "y"); c.px(25, 44, "w"); c.px(24, 43, "x")
  // copper hair gathered in a high knot
  c.hline(16, 3, 17, "y"); c.px(16, 3, "x"); c.px(15, 3, "x"); c.px(32, 3, "Y"); c.px(15, 2, "x"); c.px(15, 4, "y")
  c.circ(24, 4, 4, "#a8482a"); c.clip((x) => x > 25, () => c.circ(24, 4, 4, "#6a2a22")); c.px(22, 2, "#d8783a"); c.px(21, 3, "#d8783a"); c.px(22, 1, "#d8783a")
  c.ellipse(24, 17, 11, 8, "#a8482a"); c.rect(13, 15, 3, 14, "#a8482a"); c.rect(33, 15, 3, 15, "#6a2a22"); c.px(13, 29, "#a8482a"); c.px(35, 30, "#6a2a22")
  bust(c, { skin: "#f4c8a8", shade: "#cc9480", dark: "#96606a" })
  c.clip((x, y) => ((x - 24) / 11) ** 2 + ((y - 21.5) / 12.5) ** 2 <= 1, () => { c.poly([13, 9, 24, 9, 24, 12, 19, 16, 16, 20, 13, 21], "#a8482a"); c.poly([24, 9, 35, 9, 35, 21, 32, 20, 29, 16, 24, 12], "#6a2a22") })
  c.ellipse(24, 11, 9, 2, "#a8482a"); c.clip((x) => x > 25, () => c.ellipse(24, 11, 9, 2, "#6a2a22")); c.hline(21, 8, 7, "#f06aa8"); c.hline(25, 8, 3, "#a83a70")
  c.line(16, 12, 21, 10, "#d8783a"); c.line(15, 16, 17, 13, "#d8783a")
  // thin circlet with a light-stone
  c.px(20, 15, "y"); c.px(22, 14, "y"); c.px(26, 14, "Y"); c.px(28, 15, "Y"); c.rect(23, 14, 3, 3, "x"); c.px(24, 15, "w"); c.px(24, 17, "y")
  eyes(c, "#8a4ac0", 21)
  c.px(19, 21, "#b88ae8"); c.px(28, 21, "#b88ae8")
  c.line(18, 19, 21, 18, "#6a2a22"); c.line(27, 18, 30, 19, "#6a2a22")
  c.hline(22, 29, 5, "#c85a70"); c.hline(23, 30, 3, "#e8a090"); c.px(21, 28, "#cc9480"); c.px(27, 28, "#cc9480")       // faint smile
  c.px(18, 25, "#f8a8a8"); c.px(19, 25, "#f8a8a8"); c.px(30, 25, "#d88888"); c.px(20, 24, "#e0a890"); c.px(29, 24, "#b88070")
})
