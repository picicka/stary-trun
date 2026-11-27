// Zvuky a hudba syntetizované přes Web Audio – žádné zvukové soubory.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicGain: GainNode | null = null
let sfxGain: GainNode | null = null
let musicTimer: number | null = null
let muted = false
let musicOn = true
/** Hlasitost hudby a zvuků, 0 až 1. */
let musicVol = 0.6
let sfxVol = 0.6
/** Kolik odpovídá plné hlasitosti na sběrnici. */
const MUSIC_FULL = 0.5, SFX_FULL = 0.85

try {
  muted = localStorage.getItem('hex4x-muted') === '1'
  musicOn = localStorage.getItem('hex4x-music') !== '0'
  const mv = Number(localStorage.getItem('hex4x-music-vol') ?? NaN), sv = Number(localStorage.getItem('hex4x-sfx-vol') ?? NaN)
  if (mv >= 0 && mv <= 1) musicVol = mv
  if (sv >= 0 && sv <= 1) sfxVol = sv
} catch { /* bez úložiště */ }

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination)
  sfxGain = ctx.createGain(); sfxGain.gain.value = sfxVol * SFX_FULL; sfxGain.connect(master)
  musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? musicVol * MUSIC_FULL : 0; musicGain.connect(master)
  return ctx
}

/** Volat při prvním gestu uživatele (prohlížeče jinak zvuk nepustí). */
export function unlockAudio(): void {
  const c = ensure()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  if (musicTimer === null) startMusic()
}

export function isMuted(): boolean { return muted }
export function setMuted(m: boolean): void {
  muted = m
  try { localStorage.setItem('hex4x-muted', m ? '1' : '0') } catch { /* nic */ }
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.03)
}
export function isMusicOn(): boolean { return musicOn }
export function setMusic(on: boolean): void {
  musicOn = on
  try { localStorage.setItem('hex4x-music', on ? '1' : '0') } catch { /* nic */ }
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(on ? musicVol * MUSIC_FULL : 0, ctx.currentTime, 0.2)
}
export function musicVolume(): number { return musicVol }
export function sfxVolume(): number { return sfxVol }
export function setMusicVolume(v: number): void {
  musicVol = Math.max(0, Math.min(1, v))
  try { localStorage.setItem('hex4x-music-vol', String(musicVol)) } catch { /* nic */ }
  if (musicGain && ctx && musicOn) musicGain.gain.setTargetAtTime(musicVol * MUSIC_FULL, ctx.currentTime, 0.05)
}
export function setSfxVolume(v: number): void {
  sfxVol = Math.max(0, Math.min(1, v))
  try { localStorage.setItem('hex4x-sfx-vol', String(sfxVol)) } catch { /* nic */ }
  if (sfxGain && ctx) sfxGain.gain.setTargetAtTime(sfxVol * SFX_FULL, ctx.currentTime, 0.05)
}

interface Tone { f: number; t?: number; d: number; type?: OscillatorType; v?: number; slide?: number }

function tone(dest: AudioNode, when: number, n: Tone): void {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = n.type ?? 'square'
  const t0 = when + (n.t ?? 0)
  o.frequency.setValueAtTime(n.f, t0)
  if (n.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, n.f * n.slide), t0 + n.d)
  const v = n.v ?? 0.3
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d)
  o.connect(g); g.connect(dest)
  o.start(t0); o.stop(t0 + n.d + 0.02)
}

function noise(dest: AudioNode, when: number, d: number, v: number, freq: number): void {
  if (!ctx) return
  const len = Math.floor(ctx.sampleRate * d)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  const src = ctx.createBufferSource(); src.buffer = buf
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq
  const g = ctx.createGain(); g.gain.value = v
  src.connect(f); f.connect(g); g.connect(dest)
  src.start(when)
}

const N = (semi: number) => 220 * Math.pow(2, semi / 12)

const SFX: Record<string, (t: number, d: AudioNode) => void> = {
  click: (t, d) => tone(d, t, { f: 880, d: 0.04, v: 0.12 }),
  select: (t, d) => { tone(d, t, { f: 660, d: 0.05, v: 0.14 }); tone(d, t, { f: 990, t: 0.05, d: 0.06, v: 0.12 }) },
  move: (t, d) => { noise(d, t, 0.06, 0.18, 900); noise(d, t + 0.09, 0.06, 0.14, 700) },
  shoot: (t, d) => { noise(d, t, 0.12, 0.18, 3200); tone(d, t, { f: 900, d: 0.12, slide: 0.4, type: 'triangle', v: 0.12 }) },
  hit: (t, d) => { noise(d, t, 0.14, 0.4, 1400); tone(d, t, { f: 160, d: 0.14, slide: 0.5, type: 'sawtooth', v: 0.22 }) },
  die: (t, d) => { tone(d, t, { f: 300, d: 0.3, slide: 0.3, type: 'sawtooth', v: 0.2 }); noise(d, t, 0.25, 0.2, 800) },
  found: (t, d) => { [0, 4, 7, 12].forEach((s, i) => tone(d, t, { f: N(s + 3), t: i * 0.09, d: 0.18, v: 0.2 })) },
  build: (t, d) => { tone(d, t, { f: N(7), d: 0.08, v: 0.16 }); tone(d, t, { f: N(12), t: 0.08, d: 0.14, v: 0.16 }) },
  tech: (t, d) => { [0, 7, 12, 16, 19].forEach((s, i) => tone(d, t, { f: N(s + 5), t: i * 0.07, d: 0.2, type: 'triangle', v: 0.26 })) },
  bell: (t, d) => { [0, 1, 2].forEach(i => { tone(d, t, { f: N(19), t: i * 0.22, d: 0.2, type: 'triangle', v: 0.3 }); tone(d, t, { f: N(26), t: i * 0.22, d: 0.16, v: 0.14 }) }) },
  chat: (t, d) => { tone(d, t, { f: N(12), d: 0.07, type: 'triangle', v: 0.16 }); tone(d, t, { f: N(17), t: 0.07, d: 0.1, type: 'triangle', v: 0.16 }) },
  turn: (t, d) => { tone(d, t, { f: N(0), d: 0.12, type: 'triangle', v: 0.22 }); tone(d, t, { f: N(7), t: 0.1, d: 0.2, type: 'triangle', v: 0.22 }) },
  quest: (t, d) => { [0, 4, 7, 12, 16].forEach((s, i) => tone(d, t, { f: N(s + 7), t: i * 0.08, d: 0.22, v: 0.18 })) },
  war: (t, d) => { [0, 0, -2, -5].forEach((s, i) => tone(d, t, { f: N(s - 5), t: i * 0.16, d: 0.22, type: 'sawtooth', v: 0.22 })); noise(d, t, 0.5, 0.2, 500) },
  camp: (t, d) => { noise(d, t, 0.4, 0.3, 1200); tone(d, t, { f: N(5), t: 0.1, d: 0.2, v: 0.18 }); tone(d, t, { f: N(12), t: 0.22, d: 0.25, v: 0.18 }) },
  fanfare: (t, d) => { [0, 4, 7, 12, 7, 12, 16].forEach((s, i) => tone(d, t, { f: N(s + 3), t: i * 0.12, d: 0.26, v: 0.22 })) },
  wonder: (t, d) => { [0, 7, 12, 16, 19, 24].forEach((s, i) => tone(d, t, { f: N(s + 3), t: i * 0.14, d: 0.5, type: 'triangle', v: 0.28 })) },
  error: (t, d) => { tone(d, t, { f: 180, d: 0.12, type: 'sawtooth', v: 0.16 }); tone(d, t, { f: 140, t: 0.1, d: 0.14, type: 'sawtooth', v: 0.16 }) },
  defeat: (t, d) => { [12, 8, 5, 0].forEach((s, i) => tone(d, t, { f: N(s - 5), t: i * 0.25, d: 0.45, type: 'triangle', v: 0.26 })) },
}

export function sfx(id: string): void {
  const c = ensure()
  if (!c || !sfxGain || c.state !== 'running') return
  SFX[id]?.(c.currentTime, sfxGain)
}

// ---------------------------------------------------------------- hudba
// Hudba se skládá za běhu: každá skladba má stupnici, tempo, sled akordů a obsazení; melodii jí vymyslí generátor
// z jejího semínka, takže zní pokaždé stejně, ale skladby se od sebe liší. Mezi skladbami je chvíle ticha.
// Co hraje, určuje nálada hry: menu, mír (podle věku) nebo válka.

export type Mood = 'menu' | 'peace' | 'war'

interface Piece {
  name: string
  mood: Mood
  /** Pro mír: od kterého a do kterého věku se skladba hraje. */
  era?: [number, number]
  scale: number[]
  /** Kmitočet prvního stupně v základní oktávě. */
  base: number
  /** Délka osminy ve vteřinách. */
  beat: number
  prog: number[]
  /** Kolikrát se sled akordů přehraje. */
  rounds: number
  seed: number
  lead: 'flute' | 'horn' | 'pluck'
  drums?: 'march' | 'siege'
  arp?: boolean
}

const DORIAN = [0, 2, 3, 5, 7, 9, 10], AEOLIAN = [0, 2, 3, 5, 7, 8, 10], PHRYGIAN = [0, 1, 3, 5, 7, 8, 10]
const MIXO = [0, 2, 4, 5, 7, 9, 10], MAJOR = [0, 2, 4, 5, 7, 9, 11], LYDIAN = [0, 2, 4, 6, 7, 9, 11]

const PIECES: Piece[] = [
  { name: 'Úsvit nad údolím', mood: 'menu', scale: DORIAN, base: 110, beat: 0.5, prog: [0, 0, 3, 4, 0, 5, 3, 0], rounds: 2, seed: 11, lead: 'flute', arp: true },
  { name: 'Staré příběhy', mood: 'menu', scale: AEOLIAN, base: 98, beat: 0.56, prog: [0, 5, 3, 4, 0, 2, 3, 0], rounds: 2, seed: 12, lead: 'pluck' },
  { name: 'První ohně', mood: 'peace', era: [0, 1], scale: DORIAN, base: 98, beat: 0.48, prog: [0, 0, 3, 0, 4, 3, 0, 0], rounds: 2, seed: 21, lead: 'flute' },
  { name: 'Pastviny', mood: 'peace', era: [0, 2], scale: MIXO, base: 110, beat: 0.44, prog: [0, 3, 0, 4, 0, 3, 6, 0], rounds: 2, seed: 22, lead: 'pluck', arp: true },
  { name: 'Řeka', mood: 'peace', era: [0, 3], scale: MAJOR, base: 123.47, beat: 0.46, prog: [0, 4, 5, 3, 0, 4, 3, 0], rounds: 2, seed: 23, lead: 'flute', arp: true },
  { name: 'Trhy a cesty', mood: 'peace', era: [2, 9], scale: MAJOR, base: 110, beat: 0.38, prog: [0, 3, 4, 0, 5, 3, 4, 0], rounds: 3, seed: 31, lead: 'pluck', arp: true },
  { name: 'Kamenná města', mood: 'peace', era: [2, 9], scale: MIXO, base: 98, beat: 0.42, prog: [0, 6, 3, 0, 4, 3, 6, 0], rounds: 2, seed: 32, lead: 'horn', arp: true },
  { name: 'Sluneční chrám', mood: 'peace', era: [3, 9], scale: LYDIAN, base: 87.31, beat: 0.54, prog: [0, 1, 0, 4, 5, 1, 4, 0], rounds: 2, seed: 33, lead: 'horn' },
  { name: 'Hvězdy nad věžemi', mood: 'peace', era: [1, 9], scale: DORIAN, base: 82.41, beat: 0.52, prog: [0, 3, 6, 3, 0, 4, 3, 0], rounds: 2, seed: 34, lead: 'flute' },
  { name: 'Pochod', mood: 'war', scale: AEOLIAN, base: 98, beat: 0.33, prog: [0, 0, 5, 6, 0, 3, 4, 0], rounds: 3, seed: 41, lead: 'horn', drums: 'march' },
  { name: 'Obléhání', mood: 'war', scale: PHRYGIAN, base: 82.41, beat: 0.4, prog: [0, 1, 0, 3, 0, 1, 6, 0], rounds: 3, seed: 42, lead: 'horn', drums: 'siege' },
  { name: 'Železo a oheň', mood: 'war', scale: AEOLIAN, base: 110, beat: 0.3, prog: [0, 5, 3, 4, 0, 5, 6, 0], rounds: 3, seed: 43, lead: 'pluck', drums: 'march', arp: true },
]

let mood: Mood = 'menu'
let era = 0
let piece: Piece | null = null
let lastPiece = ''
let melody: (number | null)[][] = []
let bar = 0
let nextBar = 0
/** Sběrnice právě hrané skladby – při změně nálady se ztiší jen ona. */
let pieceBus: GainNode | null = null

/** Název právě hrané skladby (prázdný v pauze mezi skladbami). */
export function nowPlaying(): string { return piece?.name ?? '' }

/** Hra hlásí náladu: menu, mír (s věkem hráče) nebo válka. Změna nálady přejde do nové skladby během pár vteřin. */
export function setMusicMood(m: Mood, e = 0): void {
  era = e
  if (m === mood) return
  mood = m
  if (!ctx) return
  // Rozehraná skladba doznívá, nová začne po krátké odmlce.
  if (pieceBus) { pieceBus.gain.setTargetAtTime(0, ctx.currentTime, 0.5); pieceBus = null }
  piece = null
  nextBar = ctx.currentTime + 2.2
}

function rng(seed: number): () => number {
  let x = seed >>> 0
  return () => { x = (x + 0x6d2b79f5) | 0; let t = Math.imul(x ^ (x >>> 15), x | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

/** Melodie na osm taktů ve tvaru A A' B A: na těžkých dobách tóny akordu, mezi nimi kroky po stupnici, dost pomlk. */
function compose(p: Piece): (number | null)[][] {
  const r = rng(p.seed)
  const dense = p.mood === 'war' ? 0.7 : 0.55
  const motif = (root: number, from: number): (number | null)[] => {
    const out: (number | null)[] = []
    let cur = from
    for (let i = 0; i < 8; i++) {
      const strong = i % 4 === 0
      if (!strong && r() > dense) { out.push(null); continue }
      if (strong) {
        // Nejbližší tón akordu k dosavadní výšce.
        const tones = [root, root + 2, root + 4, root + 7, root + 9]
        cur = tones.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a))
      } else cur += [-2, -1, -1, 1, 1, 2][Math.floor(r() * 6)]
      cur = Math.max(root - 1, Math.min(root + 9, cur))
      out.push(cur)
    }
    // Konec fráze nechá doznít.
    out[7] = null
    return out
  }
  const bars: (number | null)[][] = []
  let from = 4
  const shapes: (number | null)[][] = []
  for (let b = 0; b < 8; b++) {
    const root = p.prog[b % p.prog.length]
    // Takty 0, 1, 4, 5 jsou téma (A), 2 a 3 jeho obměna, 6 a 7 závěr.
    const m = b === 4 || b === 5 ? shapes[b - 4].map(n => (n === null ? null : n - p.prog[b - 4] + root)) : motif(root, from)
    shapes.push(m)
    bars.push(m)
    const last = [...m].reverse().find(n => n !== null)
    if (last !== undefined && last !== null) from = last
  }
  // Poslední takt končí na základním tónu.
  bars[7] = bars[7].map((n, i) => (i === 4 ? p.prog[7] + 7 : i > 4 ? null : n))
  return bars
}

/** Sběrnice hudby: mírný dolní propust a jednoduchý dozvuk ze dvou zpožďovacích smyček. */
let musicIn: GainNode | null = null
function musicBus(): GainNode | null {
  if (!ctx || !musicGain) return null
  if (musicIn) return musicIn
  musicIn = ctx.createGain()
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.3
  musicIn.connect(lp); lp.connect(musicGain)
  for (const [time, fb] of [[0.23, 0.38], [0.37, 0.3]] as const) {
    const d = ctx.createDelay(1); d.delayTime.value = time
    const g = ctx.createGain(); g.gain.value = fb
    const wet = ctx.createGain(); wet.gain.value = 0.22
    const damp = ctx.createBiquadFilter(); damp.type = 'lowpass'; damp.frequency.value = 1500
    lp.connect(d); d.connect(damp); damp.connect(g); g.connect(d); damp.connect(wet); wet.connect(musicGain)
  }
  return musicIn
}

/** Tón s měkkým nástupem a dozníváním. */
function voice(dest: AudioNode, t0: number, f: number, d: number, o: { type: OscillatorType; v: number; attack: number; release: number; detune?: number; vibrato?: number; cutoff?: number }): void {
  if (!ctx) return
  const osc = ctx.createOscillator()
  osc.type = o.type
  osc.frequency.setValueAtTime(f, t0)
  if (o.detune) osc.detune.value = o.detune
  if (o.vibrato) {
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2
    const depth = ctx.createGain(); depth.gain.setValueAtTime(0, t0); depth.gain.linearRampToValueAtTime(o.vibrato, t0 + Math.min(d, 0.5))
    lfo.connect(depth); depth.connect(osc.frequency); lfo.start(t0); lfo.stop(t0 + d + o.release + 0.05)
  }
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.linearRampToValueAtTime(o.v, t0 + o.attack)
  g.gain.setValueAtTime(o.v, t0 + Math.max(o.attack, d))
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(o.attack, d) + o.release)
  if (o.cutoff) { const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = o.cutoff; osc.connect(f2); f2.connect(g) } else osc.connect(g)
  g.connect(dest)
  osc.start(t0); osc.stop(t0 + Math.max(o.attack, d) + o.release + 0.05)
}

const pad = (dest: AudioNode, t: number, f: number, d: number, v: number) => {
  voice(dest, t, f, d, { type: 'sine', v, attack: 0.5, release: 0.9 })
  voice(dest, t, f, d, { type: 'triangle', v: v * 0.45, attack: 0.6, release: 0.9, detune: 7 })
}
const pluck = (dest: AudioNode, t: number, f: number, v: number) => voice(dest, t, f, 0.02, { type: 'triangle', v, attack: 0.006, release: 0.75 })
const flute = (dest: AudioNode, t: number, f: number, d: number, v: number) => {
  voice(dest, t, f, d, { type: 'sine', v, attack: 0.07, release: 0.22, vibrato: f * 0.006 })
  voice(dest, t, f * 2, d, { type: 'sine', v: v * 0.16, attack: 0.09, release: 0.18 })
}
const horn = (dest: AudioNode, t: number, f: number, d: number, v: number) => voice(dest, t, f, d, { type: 'sawtooth', v, attack: 0.09, release: 0.3, cutoff: 900 })
function drum(dest: AudioNode, t: number, v: number, low = 48): void {
  if (!ctx) return
  const o = ctx.createOscillator(); o.type = 'sine'
  o.frequency.setValueAtTime(low * 2.4, t); o.frequency.exponentialRampToValueAtTime(low, t + 0.16)
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32)
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + 0.35)
  noise(dest, t, 0.07, v * 0.35, 500)
}

function pickPiece(): Piece {
  let pool = PIECES.filter(p => p.mood === mood && (mood !== 'peace' || !p.era || (era >= p.era[0] && era <= p.era[1])))
  if (!pool.length) pool = PIECES.filter(p => p.mood === mood)
  const fresh = pool.filter(p => p.name !== lastPiece)
  const from = fresh.length ? fresh : pool
  return from[Math.floor(Math.random() * from.length)]
}

function scheduleBar(): void {
  if (!ctx) return
  const bus = musicBus()
  if (!bus) return
  while (nextBar < ctx.currentTime + 1.2) {
    if (!piece) {
      piece = pickPiece(); lastPiece = piece.name; melody = compose(piece); bar = 0
      pieceBus = ctx.createGain(); pieceBus.gain.value = 1; pieceBus.connect(bus)
    }
    const p = piece, out = pieceBus!
    const total = p.prog.length * p.rounds
    const deg = (d: number, oct = 0) => p.base * Math.pow(2, (p.scale[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct)) / 12)
    const root = p.prog[bar % p.prog.length]
    const t = Math.max(nextBar, ctx.currentTime + 0.05)
    const beat = p.beat, len = beat * 8
    const round = Math.floor(bar / p.prog.length)
    const last = bar === total - 1
    // Podklad: bordun a kvinta, v dalších kolech i tercie.
    pad(out, t, deg(root, 0), len * 0.96, 0.26)
    pad(out, t, deg(root + 4, 0), len * 0.96, 0.12)
    if (round >= 1) pad(out, t, deg(root + 2, 1), len * 0.96, 0.07)
    // Rozklad akordu.
    if (p.arp && !last) for (let i = 0; i < 8; i++) {
      if (round === 0 && bar < 2 && i % 2) continue
      pluck(out, t + i * beat, deg(root + [0, 4, 2, 4, 7, 4, 2, 4][i], 1), 0.085)
    }
    // Melodie nastoupí po dvou taktech; poslední takt jen doznívá.
    const m = melody[bar % melody.length]
    if (bar >= 2 || p.mood === 'war') for (let i = 0; i < 8; i++) {
      const n = m[i]
      if (n === null) continue
      let hold = 1
      while (i + hold < 8 && m[i + hold] === null && hold < 3) hold++
      const f = deg(n, p.lead === 'horn' ? 1 : 2), tt = t + i * beat, d = beat * hold * 0.92
      if (p.lead === 'flute') flute(out, tt, f, d, 0.11)
      else if (p.lead === 'horn') horn(out, tt, f, d, 0.1)
      else { pluck(out, tt, f, 0.15); if (round >= 1) pluck(out, tt, f * 2, 0.04) }
    }
    // Bubny ve válce.
    if (p.drums === 'march') for (const i of [0, 3, 4, 6]) drum(out, t + i * beat, i === 0 ? 0.5 : 0.3)
    if (p.drums === 'siege') { drum(out, t, 0.6, 40); drum(out, t + beat * 4, 0.4, 40); if (bar % 2) drum(out, t + beat * 7, 0.28, 55) }
    bar++
    nextBar = t + len
    if (bar >= total) {
      // Skladba dohrála: chvíle ticha a pak další.
      piece = null; pieceBus = null
      nextBar += 5 + Math.random() * 5
    }
  }
}

function startMusic(): void {
  if (!ctx) return
  nextBar = ctx.currentTime + 0.4
  scheduleBar()
  musicTimer = window.setInterval(scheduleBar, 300)
}
