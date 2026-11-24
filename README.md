# Starý trůn

Hexová tahová 4X strategie v pixel artu, která běží v prohlížeči. Originální hra s vlastními pravidly, národy i grafikou.

## Co ve hře je

- Tři scénáře: ručně navržené Údolí Starého trůnu a Souostroví Sedmi větrů (každé ve třech velikostech podle počtu národů) a náhodná Neznámá země s volbou krajiny, velikosti a kódu mapy.
- Osm národů, každý s vlastností a unikátní jednotkou; ve hře 2–8 národů, které vedou lidé nebo počítač, a barbaři včetně pirátů.
- Hra až pro 8 hráčů u jednoho počítače: táhne se po řadě, mezi tahy mapu zakryje opona; volná místa vede počítač.
- Města s frontou výroby, dělníci, cesty a řeky, 23 technologií, lodě a nalodění, povyšování jednotek.
- Diplomacie: válka a mír, obchod se surovinami, spojenectví.
- Tři cesty k vítězství: dobytí (většina cizích sídel držená 5 tahů), div světa, nebo nejvyšší skóre po posledním tahu.
- Česky, s návodem, bublinovou nápovědou, automatickým ukládáním, zvuky a hudbou.

## Spuštění

Je potřeba Node.js 24 nebo novější.

```bash
npm install
npm run dev
```

Pak otevřete adresu, kterou Vite vypíše.

## Další příkazy

| Příkaz | Co dělá |
| --- | --- |
| `npm test` | testy pravidel hry |
| `npm run build` | kontrola typů a produkční build do `dist/` |
| `npm run art` | přegeneruje grafiku z `art/*.px.js` (vyžaduje nástroj pxl) |
| `node scripts/sim.mjs aur normal builder islands` | odehraje celou partii počítač proti počítači |
| `node scripts/map.mjs islands` | textový náhled mapy |

## Stavba

- `src/game/` – pravidla hry bez závislosti na vykreslování; jdou spustit i v Node.
- `src/view/MapScene.ts` – mapa v Phaseru 4.
- `src/ui/hud.ts` – rozhraní v HTML nad plátnem.
- `art/` – zdroje pixel artu, výstup je v `public/assets/`.

Složka `.claude/skills/` obsahuje pomocné návody z kolekce [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) pod licencí Apache-2.0 (viz `LICENSE` a `NOTICE` tamtéž).
