# Starý trůn

Hexová tahová 4X strategie v pixel artu, která běží v prohlížeči. Originální hra s vlastními pravidly, národy i grafikou.

## Co ve hře je

- Tři scénáře: ručně navržené Údolí Starého trůnu a Souostroví Sedmi větrů (každé ve třech velikostech podle počtu národů) a náhodná Neznámá země s volbou krajiny, velikosti a kódu mapy.
- Osm národů, každý s vlastností a unikátní jednotkou; ve hře 2–8 národů, které vedou lidé nebo počítač, a barbaři včetně pirátů.
- Soupeři vedení počítačem mají šest povah (dobyvatel, stavitel, osadník, učenec, vypočítavý, obránce); každý národ má svou.
- Hra až pro 8 hráčů u jednoho počítače: táhne se po řadě, mezi tahy mapu zakryje opona; volná místa vede počítač.
- Hra po síti bez herního serveru: jeden hráč otevře místnost, ostatní se připojí kódem nebo odkazem a prohlížeče se spojí napřímo (WebRTC). Hráč, kterému vypadne spojení, se vrátí na své místo; hostitel může pokračovat i v uložené hře. Hráči, kteří se ve hře ještě nepotkali, táhnou zároveň; kdo se potká, od dalšího tahu se s tím druhým střídá (dá se vypnout).
- Města s frontou výroby, dělníci, cesty a řeky, 28 technologií, lodě a nalodění, povyšování jednotek.
- Diplomacie: válka a mír, obchod se surovinami, spojenectví.
- Tři cesty k vítězství: dobytí (většina cizích sídel držená 5 tahů), div světa (Sluneční chrám dostavěný a udržený 15 tahů), nebo nejvyšší skóre po posledním tahu.
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
| `node scripts/balance.mjs 8` | hromadná simulace počítač proti počítači (zde 400 partií): jak si vedou národy, povahy soupeřů a startovní místa, čím hry končí |
| `node scripts/map.mjs islands` | textový náhled mapy |
| `node scripts/net.mjs http://localhost:5173 /tmp/net` | odehraje síťovou hru ve třech panelech prohlížeče (potřebuje běžící `npm run dev`; s dalším parametrem `peer` přes skutečné WebRTC) |
| `node scripts/simul.mjs http://localhost:5173 /tmp/simul` | odehraje síťovou hru se souběžnými tahy ve třech panelech prohlížeče (potřebuje běžící `npm run dev`) |

## Stavba

- `src/game/` – pravidla hry bez závislosti na vykreslování; jdou spustit i v Node.
- `src/net/` – hra po síti: `session.ts` je protokol (místnost, přeposílání příkazů, kontrola shody stavu, návrat po výpadku), `transport.ts` spojení přes PeerJS. Všichni hráči provádějí stejné příkazy nad stejným stavem v pořadí, které určuje hostitel; táhne-li víc hráčů zároveň a příkazy se sejdou, hráč si stav přepočítá v hostitelově pořadí. Při neshodě pošle hostitel svůj stav. Seznámení prohlížečů jde přes veřejný server PeerJS, hra sama už teče napřímo. Adresa s `?net=local` nahradí síť spojením mezi panely jednoho prohlížeče (na zkoušení).
- `src/view/MapScene.ts` – mapa v Phaseru 4.
- `src/ui/hud.ts` – rozhraní v HTML nad plátnem.
- `art/` – zdroje pixel artu, výstup je v `public/assets/`.

Složka `.claude/skills/` obsahuje pomocné návody z kolekce [awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) pod licencí Apache-2.0 (viz `LICENSE` a `NOTICE` tamtéž).
