import '@fontsource/pixelify-sans/400.css'
import '@fontsource/pixelify-sans/600.css'
import '@fontsource/pixelify-sans/700.css'
import '@fontsource/vt323/latin.css'
import '@fontsource/vt323/latin-ext.css'
import './style.css'
import Phaser from 'phaser'
import { MapScene } from './view/MapScene.ts'
import { App } from './app.ts'
import { loadNationArt } from './view/nationArt.ts'

// Ikony jednotek v barvách národů potřebuje už úvodní menu i mapa, proto se čeká před jejich vznikem.
await loadNationArt().catch(e => console.error('Nepodařilo se připravit barvy národů', e))

const scene = new MapScene()
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b1020',
  pixelArt: true,
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [scene],
})
const app = new App(scene)
Object.assign(window, { game, app })
