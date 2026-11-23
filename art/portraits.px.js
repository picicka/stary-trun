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
