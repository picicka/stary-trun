// Zvuky a hudba syntetizované přes Web Audio – žádné zvukové soubory.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicGain: GainNode | null = null
let sfxGain: GainNode | null = null
let musicTimer: number | null = null
let muted = false
let musicOn = true

try {
  muted = localStorage.getItem('hex4x-muted') === '1'
  musicOn = localStorage.getItem('hex4x-music') !== '0'
} catch { /* bez úložiště */ }

function ensure(): AudioContext | null {
  if (ctx) return ctx
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(ctx.destination)
  sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master)
  musicGain = ctx.createGain(); musicGain.gain.value = musicOn ? 0.16 : 0; musicGain.connect(master)
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
  if (musicGain && ctx) musicGain.gain.setTargetAtTime(on ? 0.16 : 0, ctx.currentTime, 0.2)
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
// Pomalá modální smyčka (dórská stupnice): basový bordun, arpeggio a řídká melodie.

const SCALE = [0, 2, 3, 5, 7, 9, 10]
const deg = (d: number, oct = 0) => 110 * Math.pow(2, (SCALE[((d % 7) + 7) % 7] + 12 * (Math.floor(d / 7) + oct)) / 12)
const PROG = [0, 0, 3, 4, 0, 5, 3, 4]
const MELODY: (number | null)[][] = [
  [4, null, 5, 4, 2, null, 0, null], [2, null, 4, null, 5, 7, 5, null], [3, 5, 7, null, 5, null, 3, null], [4, null, 2, null, 1, null, 0, null],
  [7, null, 9, 7, 5, null, 4, null], [5, null, null, 7, 9, null, 7, 5], [3, null, 5, null, 7, 5, 3, null], [4, 2, 1, null, 0, null, null, null],
]
let bar = 0
let nextBar = 0

function scheduleBar(): void {
  if (!ctx || !musicGain) return
  const beat = 0.42
  while (nextBar < ctx.currentTime + 1.2) {
    const root = PROG[bar % PROG.length]
    const t = Math.max(nextBar, ctx.currentTime + 0.05)
    tone(musicGain, t, { f: deg(root, 0), d: beat * 7.6, type: 'triangle', v: 0.5 })
    tone(musicGain, t, { f: deg(root + 4, 0), d: beat * 7.6, type: 'sine', v: 0.22 })
    for (let i = 0; i < 8; i++) {
      const a = [0, 2, 4, 2, 0, 4, 2, 4][i]
      tone(musicGain, t, { f: deg(root + a, 1), t: i * beat, d: beat * 0.9, type: 'triangle', v: 0.16 })
      const m = MELODY[bar % MELODY.length][i]
      if (m !== null && bar >= 2) tone(musicGain, t, { f: deg(m, 2), t: i * beat, d: beat * 1.6, type: 'square', v: 0.085 })
    }
    if (bar % 2 === 0) noise(musicGain, t, 0.18, 0.12, 300)
    bar++
    nextBar = t + beat * 8
  }
}

function startMusic(): void {
  if (!ctx) return
  nextBar = ctx.currentTime + 0.3
  scheduleBar()
  musicTimer = window.setInterval(scheduleBar, 400)
}
