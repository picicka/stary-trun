// Art for the hex 4X game. Split by family; shared palette + helpers live here.
pal({
  k: "#1a1426",
  // greens
  h: "#8ed65a", m: "#6cc24c", g: "#62b846", n: "#57ad43", G: "#3f9440", H: "#2a6f3c", J: "#1c4a34",
  // plains
  q: "#e6dc78", p: "#c9c458", j: "#bcb84e", P: "#9fa644", Q: "#7c8a3a",
  // sand
  z: "#f8e6a4", s: "#ecca78", S: "#d9ad5c", Z: "#b07f42",
  // hills
  A: "#b4c95a", e: "#93ad48", K: "#6f8a40",
  // wood / earth
  L: "#e2b77c", l: "#bd8752", b: "#8c5a36", B: "#5f3a26", E: "#3e2520",
  // stone / metal / snow
  w: "#f7f5ee", W: "#cdd6e6", u: "#b3bac9", t: "#8a90a2", T: "#5c6278", U: "#3c4058",
  // water
  I: "#6aa8e8", i: "#3d7bd0", o: "#2c5fb4", O: "#214896",
  v: "#9aeae2", c: "#4cc0cc", C: "#339fbe",
  // warm
  x: "#fff0a0", y: "#f2c230", Y: "#b8791e", a: "#f08a2c", r: "#d6453d", R: "#8a2433",
  // skin
  f: "#eeb184", F: "#bd7a54",
  // blue / purple / barbarian grey
  d: "#3aa0d8", D: "#235a94", V: "#a05ad6", X: "#5f2f94",
  "1": "#5a5a66", "2": "#2c2c36",
  // nation placeholders (always swapped)
  N: "#ff00ff", M: "#a000a0",
})
ramps("kJHGngmh", "kQPjpq", "kZSsz", "kKeA", "kEBblL", "kUTtuWw", "kOoiI", "kCcv", "kRra", "kYyx",
  "kFf", "kDd", "kXV", "k21", "kMN")

// Jednotky a města se kreslí JEN JEDNOU se zástupnými barvami N/M; barvy národů dosazuje až hra
// (src/view/nationArt.ts podle NATIONS v src/game/data.ts). Tahle tabulka slouží jen náhledům v demo.px.js.
const PREVIEW_NATIONS = {
  aur: { N: "#f2c230", M: "#b8791e" },
  khar: { N: "#d6453d", M: "#8a2433" },
  thal: { N: "#3aa0d8", M: "#235a94" },
  sylv: { N: "#a05ad6", M: "#5f2f94" },
  barb: { N: "#5a5a66", M: "#2c2c36" },
}

// ---- hex geometry
const inHex = (x, y) => { const h = y < 8 ? 1 + 2 * y : y > 23 ? 1 + 2 * (31 - y) : 16; return x >= 16 - h && x < 16 + h }
const inHexT = (x, y) => inHex(x, y - 16)            // footprint of a 32x48 tall tile
const SQ5 = Math.sqrt(5)
// outward normals + apothems of the 6 edges: 0=E 1=SE 2=SW 3=W 4=NW 5=NE
const EDGES = [[1, 0, 16], [1 / SQ5, 2 / SQ5, 32 / SQ5], [-1 / SQ5, 2 / SQ5, 32 / SQ5],
  [-1, 0, 16], [-1 / SQ5, -2 / SQ5, 32 / SQ5], [1 / SQ5, -2 / SQ5, 32 / SQ5]]
// distance of pixel centre from edge i (positive inside)
const edgeDist = (i, x, y) => EDGES[i][2] - ((x + 0.5 - 16) * EDGES[i][0] + (y + 0.5 - 16) * EDGES[i][1])
const hexDist = (x, y) => Math.min(...EDGES.map((_, i) => edgeDist(i, x, y)))
// coordinate along edge i (for wavy bands)
const edgeAlong = (i, x, y) => (x - 16) * -EDGES[i][1] + (y - 16) * EDGES[i][0]
const hexFill = (key, pred = inHex) => (c) => { for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (pred(x, y)) c.px(x, y, key) }

const SHADOW = "#1a142650"
// Tall 32x48 overlay: outlined object (drawn on a 30x46 canvas) over an optional soft ground shadow.
const tall = (name, shadow, ...items) => {
  sprite("_o_" + name, { w: 30, h: 46, outline: "k" }, ...items)
  sprite(name, { w: 32, h: 48 }, ...(shadow || []), stamp("_o_" + name, 0, 0))
}

include("terrain.px.js")
include("features.px.js")
include("cities.px.js")
include("overlays.px.js")
include("units.px.js")
include("ui.px.js")
include("portraits.px.js")
include("title.px.js")
include("demo.px.js")

sheet("atlas", ["t_*", "f_*", "i_*", "city_*", "shore_*", "r_*", "hex_*", "border_*", "road_*", "river_*", "mark_worked", "ic_tip", "tool_*", "fog", "path_dot", "u_*", "fx_*"], { pad: 2 })
