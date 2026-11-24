// ---------------------------------------------------------------- cities (tall 32x48), nation keys N/M
// house: (x, yb) = bottom-left of the wall, gabled roof in nation colour
const house = (c, x, yb, w, wh, rh) => {
  c.rect(x, yb - wh, w, wh, "z"); c.rect(x + w - 2, yb - wh, 2, wh, "s"); c.hline(x, yb - 1, w, "S")
  c.rect(x + 1 + ((w - 4) >> 1), yb - Math.min(3, wh - 1), 2, Math.min(3, wh - 1), "E")
  const ty = yb - wh, ax = x + w / 2
  c.poly([x - 1, ty, ax, ty - rh, x + w + 1, ty], "N")
  c.poly([ax, ty - rh, x + w + 1, ty, ax + 1, ty], "M")
  c.hline(x - 1, ty, w + 2, "M")
}
// flat-roofed block with a nation awning stripe
const block = (c, x, yb, w, h) => {
  c.rect(x, yb - h, w, h, "z"); c.rect(x + w - 2, yb - h, 2, h, "s"); c.hline(x, yb - h, w, "w")
  c.hline(x, yb - h + 2, w, "N"); c.px(x + w - 1, yb - h + 2, "M"); c.px(x + w - 2, yb - h + 2, "M")
  c.px(x + 1, yb - h + 4, "E"); if (w > 5) c.px(x + 3, yb - h + 4, "E")
}
const banner = (c, x, y, h) => { c.vline(x, y, h, "B"); c.rect(x + 1, y, 4, 3, "N"); c.hline(x + 1, y + 2, 4, "M"); c.px(x + 4, y + 1, "M") }
const wallSeg = (c, x, y, w, h) => {
  c.rect(x, y, w, h, "u"); c.hline(x, y, w, "W"); c.rect(x, y + h - 2, w, 2, "t")
  for (let i = x; i < x + w; i += 2) c.px(i, y - 1, "W")                         // crenels
  for (let i = x + 1; i < x + w; i += 4) c.px(i, y + 2, "t")                     // stone joints
  for (let i = x + 3; i < x + w; i += 4) c.px(i, y + 4, "t")
}
const tower = (c, x, y, w, h, roof) => {
  c.rect(x, y, w, h, "W"); c.vline(x, y, h, "w"); c.rect(x + w - 2, y, 2, h, "u"); c.hline(x, y + h - 1, w, "t")
  c.px(x + (w >> 1), y + 3, "E"); c.px(x + (w >> 1), y + 4, "E")
  if (roof) { c.poly([x - 1, y, x + w / 2, y - roof, x + w + 1, y], "N"); c.poly([x + w / 2, y - roof, x + w + 1, y, x + w / 2 + 1, y], "M"); c.hline(x - 1, y, w + 2, "M") }
  else for (let i = x; i < x + w; i += 2) c.px(i, y - 1, "w")
}

sprite("_o_city_1", { w: 30, h: 46, outline: "k" }, (c) => {
  house(c, 4, 34, 8, 5, 5)
  house(c, 17, 33, 9, 5, 5)
  banner(c, 14, 19, 14)
  house(c, 10, 41, 9, 6, 5)
  c.rect(22, 38, 3, 3, "l"); c.hline(22, 38, 3, "L"); c.px(24, 40, "b")           // crate
  c.rect(4, 38, 2, 3, "b"); c.px(4, 38, "l")                                    // jar
})
sprite("_o_city_2", { w: 30, h: 46, outline: "k" }, (c) => {
  block(c, 5, 33, 7, 9)
  house(c, 13, 31, 9, 7, 6)
  banner(c, 17, 12, 8)
  block(c, 22, 34, 6, 7)
  house(c, 2, 38, 8, 5, 5)
  house(c, 19, 40, 9, 6, 5)
  wallSeg(c, 1, 38, 11, 5); wallSeg(c, 17, 40, 12, 4)
  house(c, 9, 42, 9, 6, 5)
  tower(c, 0, 33, 5, 10, 0)
})
sprite("_o_city_3", { w: 30, h: 46, outline: "k" }, (c) => {
  // palace keep with dome
  c.rect(10, 16, 11, 20, "z"); c.rect(18, 16, 3, 20, "s"); c.vline(10, 16, 20, "w")
  c.hline(9, 16, 13, "w"); c.hline(9, 17, 13, "S")
  for (const x of [12, 15, 18]) c.vline(x, 20, 4, "E")
  c.clip((x, y) => y < 16, () => { c.ellipse(15, 16, 5, 6, "N"); c.clip((x, y) => x > 16, () => c.ellipse(15, 16, 5, 6, "M")); c.px(13, 12, "w") })
  banner(c, 15, 3, 7)
  // side quarters
  house(c, 2, 32, 7, 6, 5); house(c, 21, 31, 7, 6, 5)
  block(c, 6, 36, 6, 8); block(c, 19, 36, 6, 7)
  house(c, 11, 36, 8, 5, 4)
  // curtain wall with gate and towers
  wallSeg(c, 3, 36, 24, 7)
  c.rect(13, 38, 4, 5, "E"); c.px(13, 38, "t"); c.px(16, 38, "t"); c.rect(12, 37, 6, 1, "W")
  c.hline(13, 36, 4, "N")
  tower(c, 0, 31, 6, 13, 4); tower(c, 24, 31, 6, 13, 4)
})
// Jedna sada se zástupnými barvami; národní barvy dosadí hra za běhu.
for (let i = 1; i <= 3; i++)
  sprite(`city_${i}`, { w: 32, h: 48 }, ellipse(16, 43, 13 + (i > 1 ? 1 : 0), 3, SHADOW), stamp("_o_city_" + i, 0, 0))
