# Starý trůn – roadmapa

Co chceme ve hře udělat a v jakém pořadí. Hotové body odškrtáváme, nové připisujeme tam, kam patří podle priority.

Čísla u bodů pocházejí ze simulací počítač proti počítači (`scripts/balance.mjs`, 200 partií, střední obtížnost, 160 tahů), pokud není uvedeno jinak.

## 1. Ověřit, co už je venku

Věci, které jsou nasazené, ale nikdo je nevyzkoušel v podmínkách, pro které jsou určené.

- [ ] **Síťová hra mezi skutečnými počítači.** Zatím běžela jen na jednom stroji. Vyzkoušet různé sítě a routery, největší mapu, panel na pozadí, výpadek a návrat.
- [ ] **Souběžné tahy přes internet.** Totéž pro souběžnou hru: dva až čtyři lidé, odezva při souběhu příkazů, přechod na střídání po setkání.
- [ ] **Nasazení na GitHub Pages.** Po posledních pushích zkontrolovat, že stránka běží s novou verzí.
- [ ] **Odehrát celou partii jako člověk.** Všechno ladění proběhlo počítač proti počítači. Zajímá nás hlavně 160 tahů, chrám za 900, obléhání se stroji a beranidlem a držení chrámu 15 tahů.
- [ ] **Nalodění strojů u počítače.** Šlo ven bez testu. Změřit ostrovní mapy před a po.

## 2. Vyváženost

- [ ] **Dobytí jako cesta k vítězství.** Dnes jím končí 7 partií z 200, jen na pevnině. Válečná mašinerie počítače dozraje až kolem 100. tahu. Možnosti: dřívější a větší tažení, nebo mírnější podmínka pro hry šesti a osmi národů.
- [ ] **Dobyvatel je nejslabší povaha.** Vyhrává pětkrát méně, než by odpovídalo rovným šancím (poměr 0,2), učenec 1,8krát víc. Dobývá, ale nevyhrává.
- [ ] **Ostrovní mapy.** Chrám tam rozhoduje 71 partií z 80 a skoro se neválčí. Souvisí s naloděním strojů a s tím, kde počítač shromažďuje vojsko.
- [ ] **Sluneční chrám se špatně dobývá.** Soupeři ho seberou jen v malé části partií; proč po posílení strojů úspěšnost klesla, jsme nezjišťovali.
- [ ] **Beranidla umírají po stovkách.** Hradby je rozstřílejí dřív, než dojde na zteč. Zvážit, aby stála na jednom poli s pěchotou.
- [ ] **Nerovné starty na ručních mapách.** V Údolí vyhrávalo jedno startovní místo výrazně častěji než jiné. Měření je starší než úpravy stromu a obléhání, nejdřív ho zopakovat.
- [ ] **Kratší hry.** Při 80 a 120 tazích se chrám za 900 prakticky nedá postavit. Buď cenu chrámu odvodit od délky hry, nebo kratší volby zrušit.
- [ ] **Raná válka.** Před 60. tahem nepadne skoro žádné město, i když beranidlo je dostupné od Bronzu.

## 3. Hratelnost

- [ ] **Obtížnost, která hraje chytřeji.** Dnes je to jen násobič výroby a vědy. Těžká obtížnost by mohla dřív stavět stroje, líp bránit chrám a líp volit cíle.
- [ ] **Setkání při souběžných tazích.** V kole, kdy se dva hráči potkají, ještě oba dotáhnou zároveň a mohou si ve stejnou chvíli vyhlásit válku. Rozhodnout, jestli to vadí.
- [ ] **Průzkum mapy počítačem.** V některých partiích se národy nepotkají do konce hry.
- [ ] **Animace cizích tahů při souběžné hře.** Teď se jednotky jen přesunou; zvážit krátkou animaci toho, co hráč vidí.
- [ ] **Překryv názvu a ceny ve stromu technologií** u dlouhých názvů.

## 4. Obsah

- [ ] **Oddělené životy hradeb a města** podle vzoru Civilizace VI: hradby chrání před pěchotou a střelci, stroje je boří. Větší zásah do pravidel.
- [ ] **Obléhací věž** jako pozdější obdoba beranidla.
- [ ] **Další využití zlata a vědy na konci hry**, až je strom vyzkoumaný.

## 5. Úklid

- [ ] **Přepínače pro simulace (`TUNE`).** Po rozhodnutí o podmínce dobytí vyházet ty, které se nepoužily.
- [ ] **Staré pomocné skripty** `scripts/shot*.mjs` a `scripts/dbg*.mjs`: projít a smazat, co už neslouží.
- [ ] **Složka `.claude/worktrees/`** na disku: smazat, nebo přidat do `.gitignore`.

## Hotovo

- [x] Hra více hráčů u jednoho počítače a vrstva příkazů.
- [x] Hra pro 2–8 národů, čtyři nové národy, mapy podle počtu národů, dobytí většinou sídel.
- [x] Hra po síti bez herního serveru (WebRTC), návrat po výpadku, pokračování hostitele v uložené hře.
- [x] Šest povah soupeřů vedených počítačem.
- [x] Hromadná simulace počítač proti počítači.
- [x] Šestý stupeň technologií: Ocel, Inženýrství, Rytířství, Obléhání, Bankovnictví; nové jednotky a budovy.
- [x] Sluneční chrám za 900, je třeba ho udržet 15 tahů; výchozí délka hry 160 tahů.
- [x] Obléhání: stroje silnější proti městům a slabší proti jednotkám, beranidlo, obklíčené město se neopravuje.
- [x] Počítač chystá tažení před vyhlášením války, čeká na stroje a táhne pohromadě.
- [x] Souběžné tahy v síťové hře, dokud se hráči nepotkají.
- [x] Soupeři vedení počítačem v síťové hře: hostitel je přidá v místnosti a vybere jim národ.
- [x] Encyklopedie ve hře (klávesa K, i z hlavního menu): jednotky, stavby, výzkum, národy, pole a suroviny, pravidla a klávesové zkratky, s odkazy mezi hesly.
- [x] Přepínání jednotek čekajících na rozkaz: Tab další, Shift + Tab předchozí.
- [x] Obrázky na pozadí technologií ve stromu výzkumu a oživená mapa: vítr v lesích, ohně táborů, kouř nad městy, ptáci, stíny mraků a přešlapující vybraná jednotka.
- [x] Kurzor myši podle záměru vybrané jednotky; levé tlačítko vlastní jednotku vždy vybírá, pravé k ní posílá.
- [x] Doprovod: vojenská jednotka se sváže s civilní a chodí s ní (klávesa G).
- [x] Návrhy pro dělníky a osadníky jako šedobílé blikající značky.
- [x] Zaměření města na jídlo, výrobu, nebo zlato: obyvatelé se sami přeskupí.
- [x] Střelba z hradeb na cíl, který si hráč vybere v otevřeném městě.
