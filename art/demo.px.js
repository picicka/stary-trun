// contact sheets + demo map (parts: built only with --only)
const contact = (name, names, cw, ch, cols, bg = "#3a6a40") => {
  const rows = Math.ceil(names.length / cols)
  scene(name, { w: cols * (cw + 2) + 2, h: rows * (ch + 2) + 2, bg },
    ...names.map((n, i) => stamp(n, 2 + (i % cols) * (cw + 2), 2 + Math.floor(i / cols) * (ch + 2), { frame: 0 })))
}
contact("_cs_terrain", ["t_grass_1", "t_grass_2", "t_grass_3", "t_plains_1", "t_plains_2", "t_plains_3", "t_desert_1", "t_desert_2", "t_hills_1", "t_hills_2", "t_ocean", "t_coast", "t_mountain_1", "t_mountain_2"], 32, 48, 7, "#222")
contact("_cs_feat", ["f_forest_1", "f_forest_2", "f_ruins", "f_camp", "f_wonder", "i_farm", "i_mine", "i_pasture", "i_lumber", "t_mountain_1", "t_mountain_2"].map((n) => n), 32, 48, 6, "#62b846")
contact("_cs_city", CITY_NATIONS.flatMap((n) => [1, 2, 3].map((i) => `city_${i}_${n}`)), 32, 48, 6, "#62b846")
contact("_cs_over", ["shore_0", "shore_1", "shore_2", "shore_3", "shore_4", "shore_5", "border_0", "border_1", "border_2", "border_3", "border_4", "border_5", "r_wheat", "r_horses", "r_iron", "r_gold", "r_stone", "r_fish", "r_deer", "hex_mask", "hex_cursor", "hex_move", "hex_attack", "fog"], 36, 36, 6, "#3a7a44")
contact("_cs_units", Object.keys(UNITS).flatMap((t, i) => [`u_${t}_${["aur", "khar", "thal", "sylv", "barb"][i % 5]}`]), 22, 22, 7, "#62b846")
contact("_cs_icons", Object.keys(ICONS), 12, 12, 11, "#2a3352")
contact("_cs_bld", ["b_monument", "b_granary", "b_workshop", "b_market", "b_library", "b_walls", "b_barracks", "b_temple", "b_aqueduct", "b_academy", "b_court", "b_wonder", "em_aur", "em_khar", "em_thal", "em_sylv", "em_barb", "ui_panel", "ui_button", "ui_button_hover", "ui_button_down"], 24, 24, 7, "#2a3352")
contact("_cs_port", ["p_aur", "p_khar", "p_thal", "p_sylv"], 48, 48, 4, "#222")

// ---- demo map: 6x5 hexes, odd rows shifted right by 16
const DEMO = [
  "oocggm",
  "ocgfgM",
  "ccpPhg",
  "odDpgf",
  "oocpPg",
]
const DT = { o: "t_ocean", c: "t_coast", g: "t_grass_1", f: "t_grass_2", m: "t_grass_3", M: "t_grass_1", p: "t_plains_1", P: "t_plains_2", h: "t_hills_1", d: "t_desert_1", D: "t_desert_2" }
const isWater = (ch) => ch === "o" || ch === "c" || ch === undefined
const hx = (c, r) => [8 + c * 32 + (r % 2 ? 16 : 0), 20 + r * 24]
const nb = (c, r, d) => { const o = r % 2; return [[c + 1, r], [c + o, r + 1], [c - 1 + o, r + 1], [c - 1, r], [c - 1 + o, r - 1], [c + o, r - 1]][d] }
const onGrass = { swap: { [SHADOW]: "#3f9440" } }
scene("_demo_map", { w: 8 + 6 * 32 + 16 + 8, h: 20 + 5 * 24 + 8 + 8, bg: "#0e1226" }, (c) => {
  for (let r = 0; r < 5; r++) for (let q = 0; q < 6; q++) {
    const [x, y] = hx(q, r), ch = DEMO[r][q]
    c.stamp(DT[ch], x, y, { frame: 0 })
    if (isWater(ch)) for (let d = 0; d < 6; d++) { const [nq, nr] = nb(q, r, d); const n = DEMO[nr]?.[nq]; if (n !== undefined && !isWater(n)) c.stamp("shore_" + d, x, y) }
  }
  const put = (name, q, r, o) => { const [x, y] = hx(q, r); c.stamp(name, x, y - 16, o) }
  const flat = (name, q, r) => { const [x, y] = hx(q, r); c.stamp(name, x, y, { frame: 0 }) }
  const unit = (name, q, r) => { const [x, y] = hx(q, r); c.stamp(name, x + 5, y + 3) }
  put("t_mountain_1", 5, 0); put("t_mountain_2", 5, 1)
  put("f_forest_1", 4, 0, onGrass); put("f_forest_2", 3, 0, onGrass); put("f_forest_1", 5, 2, onGrass)
  put("city_3_aur", 3, 1, onGrass); for (const d of [0, 1, 2, 3, 4, 5]) flat("border_" + d, 3, 1)
  put("i_farm", 2, 1, onGrass); put("i_pasture", 4, 1, onGrass); put("i_mine", 4, 2, onGrass)
  put("city_1_khar", 3, 3, onGrass); put("i_lumber", 5, 3, onGrass)
  put("f_ruins", 2, 3, onGrass); put("f_camp", 4, 4, onGrass); put("f_wonder", 3, 4, onGrass); put("city_2_thal", 5, 4, onGrass)
  flat("r_wheat", 2, 2); flat("r_horses", 3, 2); flat("r_fish", 1, 1); flat("r_gold", 1, 3); flat("r_iron", 4, 2); flat("r_deer", 4, 3); flat("r_stone", 2, 3)
  unit("u_hoplite_aur", 2, 2); unit("u_horseman_khar", 3, 2); unit("u_archer_thal", 4, 3); unit("u_axeman_barb", 5, 3); unit("u_settler_sylv", 1, 3); unit("u_chariot_aur", 2, 4)
  flat("hex_cursor", 2, 2); flat("hex_move", 1, 2); flat("hex_attack", 3, 2)
  const [fx, fy] = hx(0, 4); c.stamp("fog", fx - 2, fy - 2); const [gx, gy] = hx(0, 3); c.stamp("fog", gx - 2, gy - 2)
})

// ---- dev-only: roads + rivers joining across neighbouring tiles
const RT = ["ggpdh", "gpgdh", "ghgpg", "dgpgg"]
const RTT = { g: "t_grass_1", p: "t_plains_1", d: "t_desert_1", h: "t_hills_1" }
scene("_demo_roads", { w: 8 + 5 * 32 + 16 + 8, h: 8 + 4 * 24 + 8 + 8, bg: "#0e1226" }, (c) => {
  const at = (q, r) => [8 + q * 32 + (r % 2 ? 16 : 0), 8 + r * 24]
  for (let r = 0; r < 4; r++) for (let q = 0; q < 5; q++) { const [x, y] = at(q, r); c.stamp(RTT[RT[r][q]], x, y, { frame: 0 }) }
  // roads: list of [q, r, dirs]; neighbours get the opposite segment
  const roads = {}
  const add = (q, r, d) => { (roads[q + "," + r] ??= new Set()).add(d) }
  const link = (q, r, d) => { add(q, r, d); const [nq, nr] = nb(q, r, d); add(nq, nr, (d + 3) % 6) }
  link(0, 0, 0); link(1, 0, 0); link(2, 0, 1); link(2, 1, 1); link(3, 2, 2); link(2, 1, 3); link(1, 1, 2); link(1, 2, 1); link(3, 2, 0); link(2, 1, 0); link(3, 1, 5)
  roads["0,3"] = new Set()
  for (const [k, ds] of Object.entries(roads)) {
    const [q, r] = k.split(",").map(Number), [x, y] = at(q, r)
    c.stamp("road_c", x, y); for (const d of ds) c.stamp("road_" + d, x, y)
  }
  // rivers: each edge drawn from both sides
  const riv = (q, r, d) => { const [x, y] = at(q, r); c.stamp("river_" + d, x, y); const [nq, nr] = nb(q, r, d); if (RT[nr]?.[nq]) { const [x2, y2] = at(nq, nr); c.stamp("river_" + ((d + 3) % 6), x2, y2) } }
  riv(0, 1, 5); riv(0, 1, 0); riv(0, 1, 1); riv(1, 2, 3); riv(1, 2, 2); riv(1, 3, 3); riv(3, 0, 0); riv(3, 0, 1); riv(4, 1, 3); riv(4, 1, 2); riv(4, 2, 4); riv(4, 2, 3); riv(4, 2, 2)
  const [bx, by] = at(4, 3); for (let d = 0; d < 6; d++) c.stamp("border_" + d, bx, by, { swap: { "#ffffff": "#d6453d" } })
  riv(4, 3, 3)
  const [wx, wy] = at(2, 3); c.stamp("hex_worked", wx, wy, { swap: { "#ffffff": "#f2c230" } }); c.stamp("mark_worked", wx, wy)
  const [mx2, my2] = at(3, 3); c.stamp("hex_move", mx2, my2)
})
contact("_cs_new", ["road_0", "road_1", "road_2", "road_3", "road_4", "road_5", "road_c", "river_0", "river_1", "river_2", "river_3", "river_4", "river_5", "hex_worked", "mark_worked", "hex_move"], 32, 32, 7, "#62b846")
