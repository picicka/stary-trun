// ---------------------------------------------------------------- UI icons 10x10 + outline = 12x12
const ICONS = {
  ic_food: `
    .....B.gg.
    ....B.gG..
    ..rrBrr...
    .rarrrrr..
    rawrrrrrR.
    rarrrrrrR.
    rrrrrrrRR.
    rrrrrrRRR.
    .rrrrRRR..
    ..RR.RR...`,
  ic_prod: `
    ..tttttt..
    .uWWWWWut.
    .uuuuuutT.
    .tttlbtTT.
    ....lb....
    ....lb....
    ....lb....
    ....lb....
    ....lb....
    ....lB....`,
  ic_gold: `
    ...yyyy...
    .yyxxxxYy.
    .yxyyyyyY.
    yxyyYYyyyY
    yxyYyyyyyY
    yxyYyyyyyY
    yxyyYYyyyY
    .yyyyyyyY.
    .YyyyyyYY.
    ...YYYY...`,
  ic_sci: `
    ...wwww...
    ....WW....
    ....Wu....
    ....Wu....
    ...WWuu...
    ...Wddd...
    ..WdddDd..
    ..dIddDD..
    .ddIdddDD.
    .ddddddDD.`,
  ic_pop: `
    ...BBBB...
    ..BBBBBB..
    ..BffffB..
    ..fkffkf..
    ..ffffff..
    ...fFFf...
    ....ff....
    ..dddddd..
    .dIddddDD.
    .dIddddDD.`,
  ic_str: `
    ........ww
    .......wWu
    ......wWu.
    .....wWu..
    ....wWu...
    .y.wWu....
    ..yWu.....
    ..byy.....
    .b...y....
    B.........`,
  ic_rng: `
    ..bbb.....
    ....Wb....
    .....Wb...
    ......Wb..
    llllllWbuw
    ......Wb..
    .....Wb...
    ....Wb....
    ..bbb.....
    ..........`,
  ic_move: `
    ..llll....
    ..lLLb....
    ..lLLb....
    ..lLLb....
    ..lLLb....
    ..lLLbb...
    ..lLLLLbb.
    .llLLLLLLb
    .bbbbbbbbb
    .BBBBBBBBB`,
  ic_hp: `
    ..........
    .rr...rr..
    rawr.rrrr.
    rwrrrrrrR.
    rrrrrrrrR.
    rrrrrrrRR.
    .rrrrrRR..
    ..rrrRR...
    ...rRR....
    ....R.....`,
  ic_turn: `
    .YyyyyyyY.
    ..WwwwwW..
    ..WssssW..
    ...WssW...
    ....Ws....
    ....Ws....
    ...W.sW...
    ..W.ss.W..
    ..WssssW..
    .YyyyyyyY.`,
  ic_war: `
    w........w
    uw......wu
    .uw....wu.
    ..uw..wu..
    ...uwwu...
    ...wuuw...
    .y.w..w.y.
    ..yb..by..
    ..by..yb..
    .b......b.`,
  ic_peace: `
    ..........
    .....ww...
    ....wwW.G.
    ww.wwwWg..
    .wwwwwwwk.
    ..wwwwwwwa
    ..WwwwwW..
    ...WWWW...
    ....W.....
    ..........`,
  ic_tip: `
    ...yyyy...
    ..yxxxxy..
    .yxxwxxxy.
    .yxwxxxxy.
    .yxxxxxxY.
    ..yxxxxY..
    ...yxxY...
    ...tttt...
    ...tttt...
    ....tt....`,
  ic_star: `
    ....yy....
    ....yy....
    ...yxxy...
    yyyyxxyyyy
    .yxxxxxxY.
    ..yxxxxY..
    ..yxxyxY..
    .yxxYYyxY.
    .yYY..YYY.
    ..........`,
  ic_lock: `
    ...tttt...
    ..tu..ut..
    ..t....t..
    ..t....t..
    .yyyyyyyy.
    .yxyyyyyY.
    .yyykkyyY.
    .yyykkyyY.
    .yyyyyyYY.
    .YYYYYYYY.`,
  ic_check: `
    ..........
    ........hh
    .......hgg
    ......hgg.
    hh...hgg..
    hgh.hgg...
    .gghgg....
    ..ggg.....
    ...G......
    ..........`,
  ic_shield: `
    uuuuuuuuuu
    uIdddDDDDu
    uIdddDDDDu
    uIdddDDDDu
    uddddDDDDu
    uddddDDDDu
    .uddDDDDu.
    .uddDDDDu.
    ..udDDDu..
    ...uuuu...`,
  ic_skip: `
    ..........
    w...w...ww
    ww..ww..ww
    www.www.ww
    wwwwwwwwww
    WWWWWWWWWW
    WWW.WWW.WW
    WW..WW..WW
    W...W...WW
    ..........`,
  ic_flag: `
    .b........
    .brrrrr...
    .brrrrrrr.
    .brrarrrr.
    .brrrrrRR.
    .bRRRR....
    .b........
    .b........
    .b........
    BBB.......`,
  ic_work: `
    .......bbb
    ........lb
    .......lb.
    ......lb..
    .....lb...
    ..u.lb....
    .uWub.....
    uWWWu.....
    uWWu......
    .uu.......`,
  ic_help: `
    ..yyyyyy..
    .yyxxxxyy.
    .yy...xyy.
    ......xyy.
    .....xyy..
    ....xyy...
    ....yy....
    ..........
    ....xy....
    ....yy....`,
  ic_sound: `
    ....u.....
    ...uu...w.
    ..uWu.w..w
    uuWWu..w.w
    uWWWu..w.w
    uWWWu..w.w
    uuWWu..w.w
    ..uWu.w..w
    ...uu...w.
    ....u.....`,
  ic_mute: `
    ....u.....
    ...uu.....
    ..uWu.....
    uuWWu.r..r
    uWWWu..rr.
    uWWWu..rr.
    uuWWu.r..r
    ..uWu.....
    ...uu.....
    ....u.....`,
  ic_culture: `
    .VV....VV.
    V..V..X..X
    V.yyyyyy.X
    V..w.w.x.X
    V..w.w.x.X
    .V.w.w.xX.
    .V.w.w.xX.
    ..VVVVXX..
    ...VVXX...
    ..XXXXXX..`,
  ic_anchor: `
    ....WW....
    ...W..u...
    ....Wu....
    ..WWWuuu..
    ....Wu....
    ....Wu....
    W...Wu...u
    WW..Wu..uu
    .WWWWuuut.
    ..tWWutt..`,
  ic_road: `
    .ggggLlbg.
    ggggLlbggg
    gggLlbgggg
    gggLLlbggg
    ggggLLlbgg
    gggggLLlbG
    ggggLLwlbG
    gggLLwLlbG
    ggLLLwlbGG
    .GLLwLlbG.`,
  ic_xp: `
    ....xx....
    ...xyyy...
    ..xyyyyY..
    .xyy..yyY.
    xyy.xx.yyY
    YY.xyyy.YY
    ..xyyyyY..
    .xyy..yyY.
    xyy....yyY
    YY......YY`,
  ic_trade: `
    .WWWW.....
    WwWWWu....
    WwWuWu....
    WWWuWu....
    uWWWkyyyy.
    .uukyxxxyY
    ...kyxyYyY
    ....yxyYyY
    ....yyyyYY
    .....YYYY.`,
  ic_up: `
    ....hh....
    ...hggh...
    ..hggggG..
    .hggggggG.
    hggggggggG
    GGGhggGGGG
    ...hggG...
    ...hggG...
    ...hggG...
    ...GGGG...`,
}
for (const [n, g] of Object.entries(ICONS)) sprite(n, { w: 10, h: 10, outline: "k" }, g)

// ---------------------------------------------------------------- building icons 18x18 + outline = 20x20
const bicon = (name, ...items) => sprite(name, { w: 18, h: 18, outline: "k" }, ...items)
bicon("b_monument", (c) => {
  c.poly([7, 3, 11, 3, 12, 14, 6, 14], "W"); c.poly([9, 3, 11, 3, 12, 14, 10, 14], "u"); c.vline(7, 4, 10, "w")
  c.poly([9, 0, 11, 3, 7, 3], "y"); c.px(9, 1, "x"); c.px(10, 2, "Y")
  c.px(8, 6, "t"); c.px(9, 8, "t"); c.px(8, 10, "t"); c.px(9, 11, "T")
  c.rect(4, 14, 10, 2, "u"); c.hline(4, 14, 10, "W"); c.rect(2, 16, 14, 2, "t"); c.hline(2, 16, 14, "u")
})
bicon("b_granary", (c) => {
  for (const [x, w, top] of [[1, 9, 5], [9, 8, 8]]) {
    c.rect(x, top + 3, w, 18 - top - 3, "L"); c.rect(x + w - 2, top + 3, 2, 18 - top - 3, "l")
    c.clip((px, py) => py < top + 4, () => { c.ellipse(x + (w >> 1), top + 4, w >> 1, 4, "s"); c.clip((px) => px > x + w / 2, () => c.ellipse(x + (w >> 1), top + 4, w >> 1, 4, "S")) })
    c.hline(x, top + 4, w, "Z"); c.hline(x, top + 8, w, "l")
  }
  c.rect(4, 13, 3, 5, "E"); c.px(13, 12, "E"); c.px(13, 13, "E")
  c.px(5, 2, "y"); c.px(5, 1, "x")
  c.px(15, 16, "y"); c.px(16, 15, "y"); c.px(16, 17, "Y"); c.px(15, 17, "y"); c.px(14, 17, "x")
})
bicon("b_workshop", (c) => {
  c.rect(6, 13, 6, 5, "b"); c.vline(6, 13, 5, "l"); c.vline(11, 13, 5, "B"); c.hline(6, 13, 6, "L")       // stump
  c.rect(3, 8, 12, 3, "t"); c.hline(3, 8, 12, "u"); c.rect(0, 8, 3, 2, "t"); c.px(0, 8, "u"); c.hline(3, 10, 12, "T")
  c.rect(6, 11, 6, 2, "T"); c.rect(5, 12, 8, 1, "U")
  c.line(10, 6, 15, 1, "l"); c.rect(7, 3, 5, 3, "u"); c.hline(7, 3, 5, "W"); c.hline(7, 5, 5, "t")              // hammer
  c.px(13, 7, "x"); c.px(15, 6, "y"); c.px(4, 6, "a"); c.px(2, 5, "y")                                         // sparks
})
bicon("b_market", (c) => {
  for (let x = 0; x < 18; x++) { const k = Math.floor(x / 3) % 2 ? "w" : "r"; c.vline(x, 3, 5, k); c.px(x, 7, k === "w" ? "W" : "R") }
  c.hline(1, 2, 16, "R"); c.px(0, 3, "."); c.px(17, 3, ".")
  for (let x = 1; x < 18; x += 3) c.px(x, 8, Math.floor(x / 3) % 2 ? "W" : "r")
  c.vline(1, 8, 10, "b"); c.vline(16, 8, 10, "b")
  c.rect(2, 12, 14, 6, "l"); c.hline(2, 12, 14, "L"); c.rect(2, 16, 14, 2, "b")
  c.rect(3, 10, 3, 2, "a"); c.px(4, 9, "a"); c.rect(7, 10, 4, 2, "g"); c.px(8, 9, "h"); c.rect(12, 10, 3, 2, "y"); c.px(13, 9, "x")
  c.px(5, 14, "B"); c.px(9, 14, "B"); c.px(13, 14, "B")
})
bicon("b_library", (c) => {
  c.rect(1, 1, 16, 17, "b"); c.box(1, 1, 16, 17, "B"); c.hline(1, 1, 16, "l")
  for (const y of [3, 8, 13]) {
    c.rect(2, y, 14, 4, "E")
    for (let x = 2; x < 15; x += 3) { c.rect(x, y + 1, 2, 3, "L"); c.px(x, y + 1, "w"); c.px(x + 1, y + 3, "l"); c.px(x, y + 2, (x + y) % 2 ? "r" : "d") }
    c.hline(1, y + 4, 16, "l")
  }
})
bicon("b_walls", (c) => {
  c.rect(0, 7, 18, 11, "u"); c.rect(0, 15, 18, 3, "t")
  for (let x = 0; x < 18; x += 4) c.rect(x, 5, 2, 2, "W")
  c.hline(0, 7, 18, "W")
  for (let y = 9; y < 18; y += 3) for (let x = (y % 2) * 2; x < 18; x += 5) c.hline(x, y, 3, "t")
  c.rect(11, 1, 7, 17, "W"); c.rect(16, 1, 2, 17, "u"); c.vline(11, 1, 17, "w")
  c.px(11, 0, "w"); c.px(13, 0, "w"); c.px(15, 0, "W"); c.px(17, 0, "u"); c.rect(14, 5, 1, 3, "E"); c.hline(11, 17, 7, "t")
  c.rect(3, 12, 4, 6, "E"); c.px(3, 12, "t"); c.px(6, 12, "t")
})
bicon("b_barracks", (c) => {
  c.rect(1, 8, 16, 10, "L"); c.rect(13, 8, 4, 10, "l"); c.hline(1, 17, 16, "b")
  c.poly([0, 8, 9, 1, 18, 8], "r"); c.poly([9, 1, 18, 8, 10, 8], "R"); c.hline(0, 8, 18, "R")
  c.rect(7, 12, 4, 6, "E")
  c.circ(9, 5, 2, "u"); c.px(9, 5, "y"); c.px(8, 4, "w")
  c.line(2, 16, 5, 9, "b"); c.px(5, 8, "w"); c.line(16, 16, 13, 9, "b"); c.px(13, 8, "w")
})
bicon("b_temple", (c) => {
  c.poly([0, 6, 9, 0, 18, 6], "W"); c.poly([9, 0, 18, 6, 10, 6], "u"); c.poly([5, 5, 9, 2, 13, 5], "y"); c.px(9, 3, "x")
  c.rect(0, 6, 18, 2, "w"); c.hline(0, 7, 18, "u")
  for (const x of [1, 5, 10, 14]) { c.rect(x, 8, 3, 7, "W"); c.vline(x, 8, 7, "w"); c.vline(x + 2, 8, 7, "u") }
  c.rect(4, 8, 1, 7, "E"); c.rect(8, 8, 2, 7, "E"); c.rect(13, 8, 1, 7, "E")
  c.rect(0, 15, 18, 1, "w"); c.rect(0, 16, 18, 2, "u"); c.hline(0, 17, 18, "t")
})
bicon("b_aqueduct", (c) => {
  c.rect(0, 2, 18, 3, "c"); c.hline(0, 2, 18, "v"); c.px(4, 3, "w"); c.px(11, 3, "w"); c.px(15, 4, "C"); c.px(7, 4, "C")
  c.rect(0, 5, 18, 13, "u"); c.hline(0, 5, 18, "W"); c.hline(0, 6, 18, "t")
  for (const x of [1, 7, 13]) { c.rect(x, 10, 4, 8, "_"); c.hline(x + 1, 9, 2, "_"); c.px(x, 10, "T"); c.px(x + 3, 10, "T"); c.vline(x + 4, 10, 8, "t") }
  for (const x of [0, 6, 12]) c.vline(x, 7, 11, "W")
})
bicon("b_academy", (c) => {
  c.clip((x, y) => y < 7, () => { c.ellipse(9, 7, 6, 6, "d"); c.clip((x) => x > 10, () => c.ellipse(9, 7, 6, 6, "D")); c.px(6, 3, "I"); c.px(7, 2, "I") })
  c.px(9, 0, "y")
  c.rect(1, 7, 16, 2, "w"); c.hline(1, 8, 16, "u")
  c.rect(2, 9, 14, 7, "z"); c.rect(13, 9, 3, 7, "s")
  for (const x of [3, 7, 10, 14]) { c.vline(x, 9, 7, "w"); }
  c.rect(8, 11, 2, 5, "E")
  c.rect(0, 16, 18, 2, "u"); c.hline(0, 16, 18, "W")
})
bicon("b_court", (c) => {
  c.vline(9, 2, 13, "y"); c.vline(8, 2, 13, "x"); c.px(8, 1, "x"); c.px(9, 1, "y"); c.rect(8, 0, 2, 1, "y")
  c.hline(2, 3, 14, "y"); c.hline(2, 4, 14, "Y")
  c.line(2, 5, 0, 10, "Y"); c.line(3, 5, 5, 10, "Y"); c.line(14, 5, 12, 10, "Y"); c.line(15, 5, 17, 10, "Y")
  c.rect(0, 10, 6, 2, "y"); c.hline(1, 12, 4, "Y"); c.hline(0, 10, 6, "x")
  c.rect(12, 10, 6, 2, "y"); c.hline(13, 12, 4, "Y"); c.hline(12, 10, 6, "x")
  c.rect(5, 15, 8, 1, "y"); c.rect(3, 16, 12, 2, "Y"); c.hline(3, 16, 12, "y")
})
bicon("b_wonder", (c) => {
  for (const [x, y, w] of [[0, 14, 18], [2, 11, 14], [4, 8, 10]]) { c.rect(x, y, w, 4, "y"); c.hline(x, y, w, "x"); c.rect(x + w - 2, y + 1, 2, 3, "Y") }
  c.rect(7, 8, 4, 10, "z"); for (let y = 9; y < 18; y += 2) c.hline(7, y, 4, "S")
  c.circ(9, 3, 3, "y"); c.circ(9, 3, 2, "x"); c.px(8, 2, "w")
  c.px(4, 3, "a"); c.px(14, 3, "a"); c.px(5, 0, "a"); c.px(13, 0, "a"); c.px(5, 6, "a"); c.px(13, 6, "a")
})
bicon("b_harbor", (c) => {
  c.rect(0, 14, 18, 4, "i"); c.rect(7, 11, 11, 3, "i"); c.hline(0, 16, 18, "o"); c.hline(0, 17, 18, "O")       // water
  c.rect(9, 8, 9, 3, "B"); c.hline(9, 8, 9, "l"); c.hline(10, 10, 7, "E"); c.px(9, 10, "i"); c.px(17, 10, "i"); c.px(9, 9, "b") // moored boat
  c.hline(8, 11, 10, "v"); c.px(11, 11, "w"); c.px(15, 11, "w")
  c.vline(12, 0, 8, "b"); c.poly([13, 1, 13, 6, 17, 6], "w"); c.hline(13, 6, 5, "W"); c.px(13, 1, "y")         // mast + sail
  c.rect(7, 12, 11, 2, "l"); c.hline(7, 12, 11, "L")                                                           // pier
  for (const x of [9, 13, 17]) c.vline(x, 14, 3, "b")
  c.hline(10, 15, 2, "v"); c.hline(14, 15, 2, "v"); c.px(11, 14, "o"); c.px(15, 14, "o")
  c.rect(2, 4, 5, 10, "w"); c.vline(6, 4, 10, "W"); c.vline(5, 4, 10, "W")                                      // lighthouse
  for (const y of [6, 10]) { c.rect(2, y, 5, 2, "r"); c.rect(5, y, 2, 2, "R") }
  c.hline(1, 4, 7, "T"); c.rect(2, 1, 5, 3, "y"); c.rect(3, 2, 2, 1, "x"); c.vline(6, 1, 3, "Y"); c.hline(2, 0, 5, "R"); c.px(4, 0, "r")
  c.rect(0, 14, 9, 4, "t"); c.hline(0, 14, 9, "u"); c.px(8, 14, "i"); c.px(8, 15, "i"); c.px(2, 16, "T"); c.px(5, 15, "T"); c.px(6, 17, "T"); c.rect(3, 12, 2, 2, "E")
})

// ---------------------------------------------------------------- nation emblems 22x22 + outline = 24x24
const shieldHW = (y) => y < 11 ? 11 : Math.max(1, Math.round(11 * (1 - Math.pow((y - 10) / 11.5, 1.8))))
const inShield = (x, y) => y >= 0 && y < 22 && Math.abs(x + 0.5 - 11) < shieldHW(y) && !(y === 0 && (x === 0 || x === 21))
const inShieldIn = (x, y) => inShield(x - 2, y) && inShield(x + 2, y) && inShield(x, y - 2) && inShield(x, y + 2) && inShield(x - 1, y + 1) && inShield(x + 1, y + 1)
const emblem = (name, lite, dark, hi, ...items) => sprite(name, { w: 22, h: 22, outline: "k" },
  hexFill(dark, inShield), hexFill(lite, inShieldIn),
  clip(inShieldIn, vline(2, 2, 12, hi), hline(2, 2, 8, hi), ...items),
  (c) => { for (let y = 0; y < 22; y++) for (let x = 0; x < 22; x++) if (inShield(x, y) && !inShield(x - 1, y - 1) ) c.px(x, y, lite) })
emblem("em_aur", "y", "Y", "x",
  circ(11, 7, 3, "a"), circ(11, 7, 2, "w"),
  (c) => { for (const [x, y] of [[11, 2], [6, 7], [16, 7], [7, 3], [15, 3], [7, 11], [15, 11]]) c.px(x, y, "a") },
  (c) => { for (let x = 0; x < 22; x++) { const y = 14 + Math.round(Math.sin(x / 2.2) * 1); c.vline(x, y, 3, "d"); c.px(x, y, "I"); c.px(x, y + 2, "D") } })
emblem("em_khar", "r", "R", "a",
  poly([4, 17, 11, 7, 14, 12, 16, 10, 19, 17], "t"), poly([11, 7, 14, 12, 12, 17, 4, 17], "u"),
  poly([11, 7, 13, 10, 11, 10, 10, 11, 9, 10], "w"), px(16, 10, "w"), px(15, 11, "w"), px(16, 11, "W"),
  vline(6, 3, 11, "B"), vline(5, 3, 11, "l"), rect(7, 3, 3, 4, "W"), vline(10, 2, 6, "w"), px(11, 3, "w"), px(11, 6, "w"), hline(7, 6, 3, "u"), rect(3, 4, 2, 2, "u"))
emblem("em_thal", "d", "D", "I",
  vline(11, 3, 15, "w"), vline(10, 3, 15, "W"), rect(5, 8, 12, 2, "w"), vline(5, 3, 6, "w"), vline(16, 3, 6, "w"),
  px(5, 2, "w"), px(16, 2, "w"), px(10, 2, "w"), px(11, 2, "w"), px(4, 4, "w"), px(17, 4, "w"), px(6, 4, "W"), px(15, 4, "W"), hline(5, 9, 12, "W"),
  (c) => { for (let x = 3; x < 19; x++) { if (x === 10 || x === 11) continue; c.px(x, 15 + ((x >> 1) % 2), "I") } })
emblem("em_sylv", "V", "X", "#c58cf0",
  circ(10, 8, 5, "G"), circ(9, 7, 4, "g"), circ(8, 6, 2, "h"), px(13, 11, "H"), px(12, 12, "H"), px(14, 9, "H"), px(7, 12, "H"),
  rect(10, 12, 2, 6, "b"), vline(11, 12, 6, "B"), px(9, 17, "b"), px(12, 17, "B"),
  circ(17, 4, 2, "x"), circ(18, 3, 2, "V"))
emblem("em_barb", "1", "2", "t",
  rect(6, 4, 10, 8, "w"), rect(7, 3, 8, 1, "w"), rect(8, 12, 6, 3, "w"), px(6, 4, "1"), px(15, 4, "1"),
  rect(13, 4, 3, 8, "W"), rect(12, 12, 2, 3, "W"),
  rect(7, 7, 3, 3, "k"), rect(12, 7, 3, 3, "k"), px(10, 11, "k"), px(11, 11, "k"), px(9, 14, "k"), px(11, 14, "k"), px(13, 14, "k"),
  px(8, 8, "r"), px(13, 8, "r"))
emblem("em_tark", "a", "#a8551a", "#f8b060",
  grid(6, 3, `
    ....w.w...
    ...wwww...
    ..Wwwwww..
    .WWwwkwww.
    WWwwwwwwww
    WWwwwwwwWW
    WWwwww.WW.
    Wwwwww....
    WWwwwww...
    .Wwwwwww..
    .WWwwwwww.
    ..WWwwwww.`))
emblem("em_zahi", "#2fc7a8", "#1a7f74", "#8eecd6",
  vline(11, 2, 9, "x"), hline(7, 6, 9, "x"), rect(10, 5, 3, 3, "w"), px(9, 4, "y"), px(13, 4, "y"), px(9, 8, "y"), px(13, 8, "y"),
  px(5, 3, "w"), px(17, 10, "w"), px(16, 3, "x"),
  poly([0, 16, 6, 12, 12, 15, 17, 12, 22, 14, 22, 22, 0, 22], "S"), poly([0, 16, 6, 12, 10, 14, 5, 15, 2, 18], "z"), poly([12, 15, 17, 12, 19, 13, 16, 14], "s"))
emblem("em_morv", "#e8e6d8", "#9a9788", "w",
  rect(7, 6, 8, 11, "t"), rect(6, 3, 10, 3, "t"), rect(8, 3, 2, 1, "_"), rect(12, 3, 2, 1, "_"),
  rect(8, 3, 2, 1, "#e8e6d8"), rect(12, 3, 2, 1, "#e8e6d8"),
  vline(6, 3, 3, "u"), vline(7, 6, 11, "u"), vline(10, 3, 1, "u"), vline(14, 3, 1, "u"), rect(13, 6, 2, 11, "T"), vline(15, 4, 2, "T"), hline(6, 5, 10, "T"),
  rect(10, 13, 2, 4, "k"), px(10, 12, "U"), px(11, 12, "U"), rect(10, 8, 2, 2, "U"),
  hline(4, 17, 14, "T"), hline(5, 16, 2, "t"), hline(15, 16, 2, "T"))
emblem("em_lume", "#f06aa8", "#a83a70", "#f8a8cc",
  rect(6, 10, 10, 6, "w"), rect(5, 9, 12, 2, "z"), hline(5, 10, 12, "S"), rect(5, 15, 12, 2, "z"), hline(5, 16, 12, "S"),
  px(4, 9, "S"), px(17, 9, "S"), px(4, 16, "S"), px(17, 16, "S"), px(4, 10, "Z"), px(17, 10, "Z"), px(4, 15, "Z"), px(17, 15, "Z"),
  hline(8, 12, 6, "t"), hline(8, 13, 4, "t"),
  poly([11, 1, 14, 5, 13, 8, 9, 8, 8, 5], "a"), rect(10, 5, 3, 3, "y"), px(11, 4, "y"), px(11, 3, "y"), rect(10, 6, 2, 2, "x"), px(11, 1, "a"), px(11, 2, "a"))

// ---------------------------------------------------------------- 9-slice frames 24x24 (8px borders)
pal({ "7": "#2a3352", "8": "#1e2540", "9": "#3a4670", "0": "#c9902e", "@": "#7a4a16", "%": "#dba842", "&": "#a86e20" })
sprite("ui_panel", { w: 24, h: 24 },
  rect(0, 0, 24, 24, "k"), rect(1, 1, 22, 22, "y"), rect(2, 2, 21, 21, "Y"), rect(2, 2, 20, 20, "0"),
  rect(3, 3, 18, 18, "@"), rect(4, 4, 16, 16, "k"), rect(5, 5, 14, 14, "8"), rect(5, 5, 14, 1, "8"), rect(6, 6, 13, 13, "7"),
  hline(1, 1, 22, "x"), vline(1, 1, 22, "x"),
  // corner studs
  ...[[1, 1], [19, 1], [1, 19], [19, 19]].flatMap(([x, y]) => [rect(x, y, 4, 4, "y"), rect(x + 1, y + 1, 3, 3, "Y"), rect(x + 1, y + 1, 2, 2, "x"), px(x + 3, y + 3, "@")]),
  px(6, 6, "9"), px(17, 6, "9"), px(6, 17, "9"), px(17, 17, "9"))
const button = (name, face, hi, lo, edge, down) => sprite(name, { w: 24, h: 24 },
  rect(1, 0, 22, 24, "k"), rect(0, 1, 24, 22, "k"),
  rect(1, 1, 22, 22, down ? lo : hi), rect(down ? 1 : 3, down ? 1 : 3, 20, 20, down ? hi : lo), rect(3, 3, 18, 18, face),
  down ? rect(3, 3, 18, 2, edge) : rect(3, 19, 18, 2, edge),
  down ? rect(1, 1, 22, 2, "@") : px(2, 2, "x"), px(1, 1, "k"), px(22, 1, "k"), px(1, 22, "k"), px(22, 22, "k"))
button("ui_button", "0", "%", "@", "&", false)
button("ui_button_hover", "%", "x", "&", "0", false)
button("ui_button_down", "&", "0", "@", "@", true)
