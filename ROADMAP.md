# Starý trůn – roadmapa

Co chceme ve hře udělat a v jakém pořadí. Hotové body odškrtáváme, nové připisujeme tam, kam patří podle priority.

Čísla u bodů pocházejí ze simulací počítač proti počítači (`scripts/balance.mjs`, 200 partií, střední obtížnost, 160 tahů), pokud není uvedeno jinak.

## 1. Ověřit, co už je venku

Věci, které jsou nasazené, ale nikdo je nevyzkoušel v podmínkách, pro které jsou určené.

- [ ] **Nová pravidla v rukou člověka.** Volba vylepšení, plenění, ruční výběr hranic, větve tradic, šik a voj i koupě ze seznamu prošly testy, simulací a krátkou kontrolou v prohlížeči, ale nikdo s nimi neodehrál partii. Zajímá nás hlavně, jestli je volba farma, nebo ves opravdu rozhodnutí a jestli strop obyvatel nepřekáží.
- [ ] **Síťová hra mezi skutečnými počítači.** Zatím běžela jen na jednom stroji. Vyzkoušet různé sítě a routery, největší mapu, panel na pozadí, výpadek a návrat.
- [ ] **Souběžné tahy přes internet.** Totéž pro souběžnou hru: dva až čtyři lidé, odezva při souběhu příkazů, přechod na střídání po setkání.
- [ ] **Nasazení na GitHub Pages.** Po posledních pushích zkontrolovat, že stránka běží s novou verzí.
- [ ] **Odehrát celou partii jako člověk.** Všechno ladění proběhlo počítač proti počítači. Zajímá nás hlavně 160 tahů, chrám za 800, obléhání se stroji a beranidlem a držení chrámu 15 tahů.
- [ ] **Nalodění strojů u počítače.** Šlo ven bez testu. Změřit ostrovní mapy před a po.

## 2. Vyváženost

- [ ] **Doladit čísla po velké přestavbě pravidel.** Pole, výzkum, kultura a šik šly ven najednou. Srovnání 200 partií před a po: chrám 137 → 124, dobytí 7 → 3, skóre 56 → 73, bez chyb za běhu. Na doladění:
  - Dobývání se nezlepšilo, i když počítač jednotky spojuje a plení. Zjistit proč; souvisí s body níže.
  - Národů, které dohrají s jediným městem, je dvakrát víc (43 z 920 proti 20). Města jsou dál od sebe a místa je méně; zvážit větší mapy nebo mírnější hodnocení míst.
  - Města jsou menší (po 160 tazích kolem 10 obyvatel místo 13) a věda pomalejší. Ceny technologií proto vyšly níž, než úvaha navrhovala, a chrám stojí 800 místo 900.
  - Strom počítač dokončí jen zčásti (průměrně 32 z 36 technologií). Rozhodnout, jestli je to v pořádku.
  - Tradic vychází kolem 7 za hru, cíl bylo 8.
  - Hranice po zdražení na 8 + 2 za pole: hlavní město má ve 40. tahu 6 polí navíc a na konci 22, ostatní města 16; dvanáct polí má město průměrně 78 tahů po založení. Výsledky 200 partií se tím skoro nepohnuly (chrám 120, dobytí 2, skóre 78). Ověřit v partii člověka, jestli je to už dost pomalé.
- [ ] **Dobytí jako cesta k vítězství.** Dnes jím končí 7 partií z 200, jen na pevnině. Válečná mašinerie počítače dozraje až kolem 100. tahu. Možnosti: dřívější a větší tažení, nebo mírnější podmínka pro hry šesti a osmi národů.
- [ ] **Dobyvatel je nejslabší povaha.** Vyhrává pětkrát méně, než by odpovídalo rovným šancím (poměr 0,2), učenec 1,8krát víc. Dobývá, ale nevyhrává.
- [ ] **Ostrovní mapy.** Chrám tam rozhoduje 71 partií z 80 a skoro se neválčí. Souvisí s naloděním strojů a s tím, kde počítač shromažďuje vojsko.
- [ ] **Sluneční chrám se špatně dobývá.** Soupeři ho seberou jen v malé části partií; proč po posílení strojů úspěšnost klesla, jsme nezjišťovali.
- [ ] **Beranidla umírají po stovkách.** Hradby je rozstřílejí dřív, než dojde na zteč. Zvážit, aby stála na jednom poli s pěchotou.
- [ ] **Nerovné starty na ručních mapách.** V Údolí vyhrávalo jedno startovní místo výrazně častěji než jiné. Měření je starší než úpravy stromu a obléhání, nejdřív ho zopakovat.
- [ ] **Kratší hry.** Při 80 a 120 tazích se chrám za 800 prakticky nedá postavit. Buď cenu chrámu odvodit od délky hry, nebo kratší volby zrušit.
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

## Úvaha: vylepšení polí, dělníci a cesty

Podklad k bodu „Pole a cesty, nad kterými se přemýšlí“. Směr je rozhodnutý, čísla jsou výchozí odhady pro simulaci.

### Stav

Kroky 1–5 jsou hotové. Proti úvaze se liší:

- Trhová ves se odemyká Měnou, bonus za spojení Kupectvím, loviště Rybolovem, vymýcení lesa Bronzem.
- Po vymýcení si pole nechá svůj terén (louky, pláně, pahorkatina), nemění se na pláně.
- Města s přístavem se počítají jako spojená po moři, jinak by ostrovní města spojení neměla.
- Počítač se na loviště naloďuje jen z břehu hned vedle.

Zbývá: terasy (krok 6) a průjezdní bod pro rozkaz Cesta do….

### Jak je to dnes

- Čtyři vylepšení: farma 4 tahy, důl 5, ohrada 4, pila 4. Cesta 2 tahy. Stavitelské bratrstvo ubírá z každé práce jeden tah. Terén dobu stavby neovlivňuje.
- Druh vylepšení určuje pole samo (`impCandidate`): louky a pláně farma, pahorkatina důl, les pila, koně a zvěř ohrada. Hráč rozhoduje jen o pořadí. Poušť bez obilí nenabízí nic, na vodě se nestaví nic.
- Cesta dává pohyb za půl bodu a most přes řeku. Nic nestojí, nic nevynáší a slouží stejně i nepříteli.
- Vylepšení nejde zničit. Válka se polí dotkne jen tím, že pole s nepřátelskou jednotkou nikdo neobdělává.
- Rozpracovaná stavba je uložená v jednotce, takže přerušením propadne.

Důsledek: rozkaz Automaticky je vždy správná volba a dělníci jsou spíš čekání než rozhodování.

### Rozhodnuto

- **Vrstvení ne, volba ano.** Na poli stojí jedno vylepšení a cesta. Hráč vybírá z možností, které se vylučují; kdo smí postavit všechno, nic nevolí.
- **Zavlažování:** farma dává +1 jídlo všude, po objevu Zavlažování +2 jen u řeky. Žádný přenos na sousední pole.
- **Cesty bez údržby.**
- **Plenění vyřazuje:** vylepšení na poli zůstane, ale nedává bonus, dokud ho dělníci neopraví.
- **Loviště jen na poli s rybami.** Sousedit spolu smějí.

### Co se kde staví

| Pole | Dnes | Nově na výběr |
| --- | --- | --- |
| Louky, pláně | farma | farma (jídlo), nebo trhová ves (zlato) |
| Pahorkatina | důl | důl, později případně terasy (jídlo, až se Zavlažováním) |
| Les | pila | pila (trvalá výroba), nebo vymýcení (jednorázová výroba do nejbližšího města, z pole budou pláně) |
| Poušť | nic | farma, ale jen u řeky |
| Ryby | nic | loviště (+1 jídlo), staví nalodění dělníci |
| Pole se surovinou | dané | beze změny; kdo postaví něco jiného, suroviny se vzdává |

Přestavba stojícího vylepšení na jiné trvá o 2 tahy déle, aby změna názoru něco stála.

### Aby záleželo na tom, kam

- **Farma u řeky** dává po Zavlažování +2 jídlo, jinde +1. Řeka patří farmám.
- **Pila u řeky** dává +1 výrobu (plavení dřeva). Les u řeky se nevyplatí mýtit, les ve vnitrozemí ano.
- **Trhová ves** dává +1 zlato a další +1, pokud je její město spojené cestou s hlavním městem.

### Cesty

- **Spojení posiluje vsi** (viz výše). Vyplatí se tím víc, čím víc vsí město má, a nepřítel ho přeruší vypleněním jediného pole cesty. Počítač města propojuje už dnes (`aiRoad`), jen za to nic nemá.
- **Doba podle terénu.** Rovina 2 tahy, les a pahorkatina 3. Kratší trasa přes kopce proti delší po rovině.
- **Most až se Stavitelstvím.** S Kolem cesta řeku nepřeklene a brod dál stojí bod pohybu. Řeky tak zůstanou obrannou čarou déle a místo mostu je rozhodnutí.
- **Cesta slouží i útočníkovi.** Tak je to už dnes a zůstane to: cesta k hranici je zároveň pozvánka.
- **Bez údržby.** Cesty omezuje jen čas dělníků a riziko, že po nich přijde nepřítel.
- Rozkaz Cesta do… dnes volí trasu sám. Až na trase začne záležet, bude potřeba průjezdní bod (Shift a klik).

### Plenění

Vojenská jednotka na cizím vylepšeném poli dostane rozkaz Vyplenit: stojí celý tah a přinese kolem 10 zlata. Vylepšení nebo cesta na poli zůstane, ale nefunguje, dokud ji dělníci neopraví; oprava trvá polovinu původní doby. Barbaři plení také.

- Vyřazený důl nebo ohrada nedodává železo ani koně. Soupeři tak jde odstřihnout surovinu bez dobývání města.
- Vyřazená cesta nezrychluje a přeruší spojení, takže vsi ztratí bonus.
- Vsi a doly u hranice jsou riziko, vnitrozemí je bezpečné. Raná válka získá cíl dřív, než má kdo sílu na hradby – souvisí s body Raná válka a Dobyvatel je nejslabší povaha.

### Moře

Dnes dávají pobřežní vody 1 jídlo a 1 zlato, ryby +2 jídlo a Přístav +1 jídlo z každého obdělávaného vodního pole.

- **Loviště:** +1 jídlo, 4 tahy, s Plavbou, jen na poli s rybami. Staví ho nalodění dělníci, žádná nová jednotka. Na vodě jsou zranitelní a hodí se jim doprovod galéry.
- Loviště jde vyplenit z lodi, takže námořní válka dostane cíl.
- Rozhodnutí o místě na moři není: hráč volí jen to, kdy dělníky pošle a jestli je ochrání.
- Ryby s lovištěm a Přístavem vyjdou na 5 jídel a 1 zlato, víc než farma u řeky. Ryb je málo, takže to možná nevadí; ověřit simulací, hlavně na ostrovních mapách.
- Naloďovat se dnes umí jen hráč, počítač vodu nechává lodím. Dokud se to dělníci počítače nenaučí, bylo by loviště výhodou jen pro člověka.

### Kolik tahů

| Práce | Tahy | Poznámka |
| --- | --- | --- |
| Cesta | 2, v lese a pahorkatině 3 | |
| Vymýcení lesa | 3 | jednorázově kolem 20 výroby |
| Farma, ohrada, pila, loviště | 4 | |
| Důl, trhová ves | 5 | |
| Terasy | 6 | |
| Oprava po vyplenění | polovina, zaokrouhleno nahoru | |
| Přestavba na jiné vylepšení | +2 | |

Rozpětí 2–6 tahů držet. Dělníci stojí 36 výroby a za hru o 160 tazích stihnou 20–25 prací; město má nejvýš 18 polí. Při kratších dobách je vše hotové dřív, než město doroste, a pořadí přestane být otázka; při delších dělník jen čeká. Stavitelské bratrstvo zůstává na −1 tahu.

Rozpracovanou stavbu uložit na pole místo do jednotky: útěk před nepřítelem pak nesmaže práci a pokračovat může jiný dělník.

### Počítač, automatika a rádce

Každá volba, kterou dostane hráč, potřebuje pravidlo pro počítač, pro rozkaz Automaticky i pro blikající značky. Jedno společné: podle potřeb města, kterému pole patří. Roste-li město pomalu, farma; jinak podle zaměření města (jídlo, výroba, zlato), které už ve hře je. Hráč tak automatiku řídí zaměřením a nemusí ji vypínat.

Riziko: člověk nová pravidla využije líp než počítač a hra bude lehčí. Proto po každém kroku 200 partií a srovnání s dneškem, a jeden přepínač v `TUNE` na krok.

### Na co si dát pozor

- **Města bez řeky ztrácejí jídlo.** Farma na loukách tam bude mít 3 jídla místo dnešních 4; u řeky zůstane na 4 a k tomu 1 zlato. Starty u řeky zesílí, což se dotýká bodu Nerovné starty.
- **Auřané** mají bonus k farmám a změnu zavlažování pocítí nejvíc; po kroku 2 přeměřit.

### Co nedělat

- Vrstvení víc vylepšení na jedno pole.
- Údržbu cest.
- Dělníky na omezený počet použití: mění cenu všeho a nepřidává rozhodnutí o poli.
- Vsi, které časem rostou: další stav na každém poli a skrytá čísla.
- Druhý stupeň cest: stačí, když první stupeň něco znamená.
- Strážní věž na pahorkatině: lákavá, ale chrám se už dnes dobývá špatně. Až po vyřešení toho bodu.

### Pořadí

1. Trhová ves a vymýcení lesa, pravidlo volby pro počítač, automatiku a rádce.
2. Zavlažování u řeky, pila u řeky, farma na poušti u řeky.
3. Cesty: spojení posiluje vsi, doba podle terénu, most až se Stavitelstvím.
4. Plenění, oprava a rozpracovanost uložená na poli.
5. Loviště, včetně naloďování dělníků počítače a plenění z lodí.
6. Terasy, jen pokud předchozí kroky hru zlepšily.

Moře je až za pleněním, protože bez něj je loviště jídlo bez rizika. Každý krok mění uložené hry (nová vylepšení, stav pole), takže s sebou nese převod ve `state.ts`, heslo v encyklopedii a obrázky.

## Úvaha: výzkum

Podklad k bodu „Delší a dražší strom technologií“. Směr je rozhodnutý, ceny a načasování jsou odhady pro simulaci.

### Stav

Všechny kroky jsou hotové. Proti úvaze se liší:

- Ceny podle stupně jsou 20, 45, 80, 125, 190, 280, vrcholová 380, Správa říše 500 a s každým dokončením o 150 víc. Vyšší ceny z úvahy posouvaly Sluneční kalendář až za 130. tah, protože věda po změnách u polí a měst roste pomaleji.
- Sluneční chrám stojí 800 místo 900.
- Písmo vyžaduje Zemědělství místo Hrnčířství; obě byly ve stejném stupni.
- Karavanseraj je ve hře (+3 zlato ve spojeném městě), Kanalizaci odemyká Inženýrství.
- Opakovatelná technologie stojí ve stromu pod Slunečním kalendářem, aby se strom vešel na obrazovku.

### Jak je to dnes

Měření: 12 partií počítač proti počítači, náhodná mapa s kontinenty, 4 národy, střední obtížnost, 160 tahů.

| Objeveno technologií | Průměrný tah |
| --- | --- |
| 6 | 33 |
| 12 | 69 |
| 18 | 101 |
| 24 | 115 |
| všech 28 | 125 |

- Strom je hotový kolem 125. tahu, nejrychlejší národ ho měl ve 110. Posledních 35 tahů se nezkoumá nic.
- Konec stromu proletí: prvních 6 technologií trvá 33 tahů, posledních 10 jen 24. Zbrojnoš, rytíř a trebuchet přijdou tak rychle po sobě, že se nestihnou uplatnit.
- Věda roste rychleji než ceny: ve 20. tahu kolem 5 bodů za tah, ve 40. tahu 8, v 80. tahu 24, ve 120. tahu 63. Nejdražší technologie stojí 270.
- Strom je uprostřed tenký: stupně mají 5, 6, 7, 4, 2 a 4 technologie.
- Stupně jdou přeskakovat: Navigace (3. stupeň) vyžaduje jen Plavbu (1.), Matematika (4.) jen 2. stupeň, Ocel (5.) jen 3. stupeň, Bankovnictví (6.) jen 4. stupeň.
- Chrám odemyká Astronomie, aniž by bylo zřejmé proč.
- Ve 160. tahu vyšla věda v průměru na 173 bodů za tah, což je podezřele moc. Příčinu zjistit.

### Rozhodnuto

- **Chrám odemyká nová vrcholová technologie Sluneční kalendář** v sedmém stupni. Astronomie zůstává běžnou technologií pod ní.
- **Vrcholová technologie nevyžaduje celý strom**, jen učeneckou a stavitelskou větev. Závod o chrám je rozhodnutí, co ve stromu vynechat.
- **Stupně nejdou přeskakovat:** každá technologie vyžaduje aspoň jednu ze stupně těsně pod sebou.
- **36 technologií**, nové přinášejí i stavby.
- **Technologie budou dražší**, hlavně v pozdních stupních.
- **Po Slunečním kalendáři opakovatelná technologie**, která přináší zlato.

### Nové technologie

| Technologie | Stupeň | Vyžaduje | Odemyká |
| --- | --- | --- | --- |
| Rybolov | 2 | Plavba | loviště |
| Kupectví | 4 | Měna | bonus vsí za spojení cestou, případně stavba Karavanseraj |
| Zbrojířství | 4 | Železo, Válečnictví | Zbrojnice (nové jednotky začínají se zkušenostmi), kušník jako povýšení lučištníka |
| Loďařství | 4 | Navigace | Loděnice (rychlejší stavba lodí) |
| Cechy | 5 | Kupectví, Zákoník | Cechovní dům (výroba) |
| Vzdělanost | 5 | Filosofie, Matematika | Univerzita (věda) |
| Architektura | 6 | Inženýrství, Vzdělanost | Amfiteátr (kultura) |
| Sluneční kalendář | 7 | Astronomie, Architektura | Sluneční chrám |

Úpravy stávajících, aby nešlo přeskakovat:

- Navigace vyžaduje Rybolov místo Plavby.
- Matematika vyžaduje Měnu a Kolo místo Písma a Kola.
- Ocel vyžaduje Zbrojířství.
- Bankovnictví vyžaduje Cechy a Matematiku.
- Astronomie vyžaduje Vzdělanost a Inženýrství a dostane vlastní stavbu, Observatoř.

Stupně pak mají 5, 7, 7, 7, 4, 5 a 1 technologii. Cesta ke Slunečnímu kalendáři vede zhruba přes 20 z nich; vynechat jde celá vojenská větev, moře a většina kupecké.

**Observatoř** je silnější ve městě na pahorkatině nebo u hor. Dává důvod zakládat města i jinde než na rovině.

**Trhová ves** z úvahy o polích patří už k Měně (3. stupeň); ve 4. stupni by přišla až kolem 85. tahu. Kupectví k ní přidává bonus za spojení cestou.

### Ceny a opakovatelná technologie

- Ceny podle stupně zhruba 20, 45, 85, 150, 250, 400, vrcholová 550–600. Dnes 20, 42, 78, 125, 190, 270.
- Opakovatelná technologie (pracovně Správa říše) jde zkoumat až po Slunečním kalendáři. Každé dokončení dá trvale +1 zlato za tah v každém městě, cena s každým opakováním roste. Tím se z velké části řeší i bod Další využití zlata a vědy na konci hry.

### Na co si dát pozor

- **Načasování chrámu.** Chrám stojí 900 výroby a drží se 15 tahů, takže Sluneční kalendář musí padnout kolem 115.–120. tahu, jinak se do 160 tahů nestihne. Ověřit simulací; možná bude třeba chrám zlevnit.
- **Matematika po Měně** oddálí katapult. Jde to proti bodu Raná válka, přeměřit.
- **Kratší hry.** Větší a dražší strom se při 80 a 120 tazích nedohraje; souvisí s bodem Kratší hry.

### Co to znamená pro práci

- Sedm nových staveb (Zbrojnice, Loděnice, Cechovní dům, Univerzita, Amfiteátr, Observatoř, případně Karavanseraj) a kušník: obrázky, údržba, hesla v encyklopedii, místo v prioritách počítače.
- Pořadí výzkumu všech povah počítače přepsat, jinak budou zkoumat neplatné cesty.
- Strom na obrazovce bude mít sedm sloupců.
- Převod uložených her ze starého stromu.

### Co nedělat

- Slevu na technologie, které už zná potkaný národ.
- Odměnu prvnímu objeviteli technologie.
- Ceny technologií podle délky hry.
- Šestý věk.

### Pořadí

1. Nové požadavky a ceny u stávajících technologií, Sluneční kalendář a opakovatelná technologie; přeměřit, kdy padá chrám.
2. Vzdělanost, Architektura a Astronomie s Univerzitou, Amfiteátrem a Observatoří (cesta k chrámu).
3. Zbrojířství se Zbrojnicí a kušníkem, Cechy s Cechovním domem.
4. Rybolov, Loďařství a Kupectví – až s lovištěm a trhovou vsí z úvahy o polích.

## Úvaha: kultura, hranice a růst měst

Podklad k bodu „Kultura, která něco rozhoduje“. Směr je rozhodnutý, čísla jsou odhady pro simulaci.

### Stav

Všechny kroky jsou hotové. Proti úvaze se liší:

- Strop obyvatel je 6 bez akvaduktu a 12 bez kanalizace, ne 8 a 16; vyšší čísla by přišla pozdě, jak úvaha varovala.
- Další pole stojí 8 bodů kultury a s každým zabraným o 2 víc (8, 10, 12 …); všech 30 polí vyjde na 1 110 bodů. Původní cena 4 + 1 byla moc levná: hlavní město mělo ve 40. tahu 10 polí navíc a kolem 140. tahu už nebylo co zabírat.
- Tradice stojí 30, 72, 138 a dál strměji (30 + 30n + 12n²).
- Pořadí ve větvích: Válka – Domobrana, Válečnický kodex, Kořistníci, Tažení. Země – Společné sýpky, Osadnický duch, Stavitelské bratrstvo, Řemeslné cechy. Učenost – Písařské školy, Slavnosti, Kronikáři, Hvězdáři. Obchod a moře – Kupecké stezky, Trhovci, Námořní tradice, Rybáři.
- Dobyté město si nechá jen pole, která už mělo.

Zbývá rozhodnout koupi pole za zlato a sílu zlatého věku.

### Jak je to dnes

- Kultura města posouvá hranice: při 18 bodech druhý okruh (12 polí), při 90 třetí (18 polí). Obdělávat jdou jen první dva okruhy, třetí přidá jen území.
- Kultura národa kupuje tradice: deset trvalých bonusů, každá další je dražší.
- Zdroje: město 1, hlavní město +1, Monument +2, Chrám +3, Slavnosti +2, Sluneční chrám +4. Na obyvatelích ani na polích nezáleží.
- Růst měst omezuje jen jídlo. Akvadukt ponechá po růstu 40 % zásob.
- Mezi městy stačí vzdálenost 4 pole a hodnocení místa (`siteScore`) se dívá jen do dvou polí od města.
- Zlatý věk dostane jen první národ, který vstoupí do věku: +1 výroba, zlato a kultura ve městě na 10 tahů.

Měření: 12 partií počítač proti počítači, náhodná mapa s kontinenty, 4 národy, střední obtížnost, 160 tahů.

| Tah | Měst | Průměr obyvatel | Největší město | Kultura za tah | Tradic |
| --- | --- | --- | --- | --- | --- |
| 40 | 2,0 | 3,2 | 3,9 | 3,4 | 2,0 |
| 80 | 3,9 | 4,6 | 6,9 | 10,7 | 4,0 |
| 120 | 4,6 | 8,1 | 10,8 | 21,1 | 6,5 |
| 160 | 6,4 | 13,0 | 17,7 | 47,3 | 9,3 |

- Tradice nejsou volba: národ jich získá průměrně 9 z 10 a rozhoduje jen o pořadí.
- Města rostou pomalu a pak vystřelí: prvních 80 tahů pod 5 obyvatel, za druhou polovinu hry se skoro ztrojnásobí.
- Největší města narážejí na strop 18 obdělávaných polí.
- Žádné město nikdy nestagnuje, hráč neřeší, jestli ho ještě krmit.
- Kultura přeje širokým říším: roste s počtem měst krát stavby, velké město nedává víc než malé.

### Rozhodnuto

- **Hranice rostou po jednom poli**, ne po celých okruzích.
- **Režim růstu se přepíná ve městě:** automaticky (výchozí), nebo si pole vybírá hráč.
- **Obdělávat jde každé zabrané pole**, tedy i třetí okruh.
- **Města dál od sebe:** hodnocení míst, tipy pro osadníky i počítač se tomu přizpůsobí.
- **Tradice ve větvích.** Všechny se nestihnou a větev se nemusí dokončit.
- **Zlatý věk za dokončenou větev.** Zlatý věk za první vstup do věku zůstává.
- **Strop růstu bez Akvaduktu**, další strop bez Kanalizace.
- **Kultura podle velikosti města:** +1 za každé 4 obyvatele, aby se vyplatila větší města, ne hodně malých.

### Hranice po polích

- Město při založení dostane první okruh, 6 polí. Dalších 30 získává po jednom až do vzdálenosti 3.
- Každé další pole stojí víc kultury, například 5, 6, 7 a dál. Na všech 30 polí je pak potřeba kolem 600 bodů, tedy zhruba celá hra.
- Proti dnešku se rané zabírání zpomalí: druhý okruh dnes přijde skoro hned, nově potrvá desítky tahů. Monument tím získá na ceně.
- Pole připadne tomu, kdo ho zabere první, jako dnes. Mezi sousedy tak vzniká závod, který vyhrává město s vyšší kulturou.

Automatický výběr, od nejdůležitějšího:

1. strategická surovina, kterou národ zná
2. jiná surovina
3. pole u řeky a pole s vysokým výnosem
4. bližší pole před vzdálenějším
5. hory až nakonec, protože se neobdělávají

V okně města je vidět, které pole přijde příště a za kolik tahů. V ručním režimu hráč pole vybírá sám; dokud nevybere, kultura se střádá a město na to upozorní.

### Obdělávání všech zabraných polí

- Strop města se zvedne z 18 polí na 36, největší města dostanou kam růst.
- Kultura získá přímý hospodářský užitek: víc kultury znamená dřív lepší pole.
- Víc polí je víc práce pro dělníky; navazuje na úvahu o polích.

### Zakládání měst a tipy pro osadníky

- Hodnocení místa počítat do vzdálenosti 3, třetí okruh s nižší vahou, protože přijde pozdě.
- Odečítat pole, na která si dělá nárok jiné vlastní město, i když je ještě nezabralo.
- Nejmenší vzdálenost měst zvednout ze 4 na 5.
- Tipy pro osadníky a počítač používají stejné hodnocení, takže se opraví zároveň.

### Velikost měst

- **Kultura z obyvatel:** +1 za každé 4 obyvatele města.
- **Strop růstu:** bez Akvaduktu město neroste přes zhruba 8 obyvatel, bez Kanalizace přes zhruba 16. Akvadukt si ponechá i dnešní účinek.
- **Kanalizace** je nová stavba; návrh je odemknout ji Inženýrstvím nebo Architekturou z úvahy o výzkumu.
- Počítač musí Akvadukt a Kanalizaci stavět včas, jinak mu města uvíznou pod stropem.

### Tradice ve větvích

Čtyři větve po čtyřech tradicích. V každé se postupuje odshora, mezi větvemi lze volně přecházet. Za hru se stihne zhruba osm tradic, tedy dvě větve celé, nebo všechny napůl. Dokončená větev spustí zlatý věk.

Náčrt (stávajících deset tradic a šest nových, k doladění):

| Větev | Stávající | Nové |
| --- | --- | --- |
| Válka | Válečnický kodex, Domobrana | Kořistníci (víc zlata z plenění), Tažení (rychlejší léčení na cizím území) |
| Země | Společné sýpky, Řemeslné cechy, Stavitelské bratrstvo, Osadnický duch | – |
| Učenost | Písařské školy, Slavnosti | Hvězdáři (silnější Observatoř), Kronikáři (levnější zabírání polí) |
| Obchod a moře | Kupecké stezky, Námořní tradice | Trhovci (silnější vsi a spojení cestou), Rybáři (silnější loviště a Přístav) |

Kultura města (hranice) a kultura národa (tradice) se dál sčítají souběžně ze stejného zdroje; hráč ji mezi ně nedělí.

### Na co si dát pozor

- **Méně měst na národ.** Dnes jich je na konci průměrně 6,4. Řidší zakládání se dotkne vědy, vítězství dobytím i velikosti map.
- **Husté zakládání má zůstat možné** jako volba: víc menších měst proti méně velkým.
- **Zlatý věk je dnes slabý.** Má-li být odměnou za dokončenou větev, možná ho bude třeba posílit.
- **Ceny tradic.** Kultura z obyvatel přidá body; ceny nastavit tak, aby vyšlo zhruba osm tradic za hru.
- **Strop 8 přijde pozdě.** Průměrné město má 8 obyvatel až kolem 120. tahu a Akvadukt je dostupný dávno předtím. Možná bude potřeba nižší číslo, aby strop něco znamenal.

### Nápady k rozhodnutí

- **Koupě pole za zlato:** hráč si pole koupí hned, cena roste se vzdáleností. Zlato tím dostane další využití.

### Co nedělat

- Kulturní tlak, který přebírá cizí pole: nahrazuje ho závod o volná pole.
- Zlatý věk kupovaný za kulturu.
- Plný strom tradic s požadavky jako u výzkumu.

### Pořadí

1. Hranice po polích s automatickým výběrem a přepínačem režimu ve městě; obdělávání všech zabraných polí.
2. Hodnocení míst, nejmenší vzdálenost měst a tipy pro osadníky.
3. Kultura z obyvatel, strop růstu s Akvaduktem a Kanalizací.
4. Větve tradic, šest nových tradic a zlatý věk za dokončenou větev.

Po každém kroku 200 partií a srovnání s dneškem, hlavně počet měst, velikost měst a počet tradic.

## Úvaha: spojování jednotek

Podklad k bodu „Spojování jednotek do šiku a voje“. Směr je rozhodnutý, čísla jsou odhady pro simulaci.

### Stav

Hotovo včetně voje. Počítač spojuje zdravé stejné jednotky, když chystá nebo vede tažení a má jich víc než šest. Šik a voj se na mapě kreslí jako dvě a tři postavy na jednom poli.

### Jak je to dnes

- Na poli smí stát jedna vojenská a jedna civilní jednotka.
- Každá jednotka má 100 životů; síla klesá se zraněním až na polovinu.
- Zranění roste o něco rychleji než poměr sil, takže silnější jednotka slabší nejen porazí, ale sama skoro nic neztratí.
- Kolem města je jen 6 polí. Útočník tam víc jednotek nedostane a část zaberou stroje a beranidlo.

### Rozhodnuto

- **Spojují se jen stejné jednotky.**
- **Dvě jednotky tvoří šik, tři voj.** Slovo falanga zůstává hoplítům Thalů.
- **Spojenou jednotku jde zase rozdělit**, ale jen na vlastním území.
- **Hoplíté mají ve spojení bonus navíc.**
- **Bonus za sousední jednotky se nedělá**, jen spojování.

### Pravidla

- **Spojení:** dvě stejné jednotky na sousedních polích dostanou rozkaz Spojit, jedna vejde do druhé. Voj vznikne připojením třetí jednotky k šiku.
- **Síla:** šik +50 %, voj kolem +90 %.
- **Co se smí spojit:** pěchota, jízda a střelci. Stroje, beranidlo, zvěd, lodě a civilisté ne.
- **Životy:** šik i voj mají stejně jako každá jednotka nejvýš 100 životů; sílu jim dává bonus, ne životy navíc. Při spojení dostanou průměr spojovaných jednotek: jednotka se 100 a jednotka se 60 životy dají šik s 80. Připojuje-li se třetí jednotka k šiku, počítá se šik dvakrát. Spojení tak nikoho neléčí.
- **Zkušenosti a povýšení:** od nejzkušenější ze spojovaných.
- **Údržba a suroviny:** šik se počítá jako dvě jednotky, voj jako tři. Jinak by spojování živilo dvojnásobnou armádu.
- **Přezbrojení:** stojí tolikrát víc, kolik jednotek ve spojení je.
- **Rozdělení:** jen na vlastním území. Jednotky se rozestoupí na volná sousední pole a každá má tolik životů a zkušeností, kolik měla spojená jednotka: šik s 80 životy se rozdělí na dvě jednotky po 80.
- **Hoplíté:** šik a voj hoplítů mají navíc +25 % k obraně, aby jejich popis „odolná falanga“ dostal smysl.
- **Stavba:** šik ani voj nejde postavit rovnou, jen spojit.
- **Technologie:** šik s Válečnictvím (3. stupeň), voj se Zbrojířstvím z úvahy o výzkumu.

### Proč zrovna +50 %

Dvě samostatné jednotky mají dva útoky a 200 životů. Šik má jeden útok, ale při +50 % rozdává asi o 60 % víc a dostává asi o 37 % méně. V součtu je to zhruba vyrovnané, takže spojení není vždy lepší, jen jiné:

- **Získá se** síla na jednom poli: u města, v průsmyku, proti opevněnému obránci, na kterého dvě slabší jednotky nestačí.
- **Ztratí se** druhý útok, pokrytí území a jistota. Když šik padne, padnou obě jednotky.

### Co to udělá se hrou

- **Pomůže dobývání.** Víc síly na šesti polích kolem města je to, co chybí v bodech Dobytí jako cesta k vítězství, Dobyvatel je nejslabší povaha a Raná válka.
- **Pomůže i obránci.** Spojená posádka ve městě nebo v průsmyku bude tvrdší. Jestli z toho vyjde líp útok, nebo obrana, ukáže simulace.
- **Riziko neporazitelné jednotky.** Spojený, opevněný a povýšený voj na pahorkatině může být skoro nezničitelný. Proto šik nejvýš +50 % a voj až pozdě.

### Počítač a rozhraní

- Počítač spojuje před tažením, když má víc jednotek stejného druhu, než kolik se jich vejde k cílovému městu. Odhad síly před tažením musí se spojenými jednotkami počítat.
- Obrázky šiku a voje (dvě a tři postavy na poli), náhled útoku, heslo v encyklopedii, převod uložených her.

### Pořadí

1. Šik: spojení a rozdělení dvou jednotek, pravidla pro životy, zkušenosti, údržbu a suroviny.
2. Počítač: kdy spojovat a jak počítat sílu; 200 partií a srovnání podílu vítězství dobytím.
3. Voj se Zbrojířstvím, až bude nový strom technologií.

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
- [x] Koupě za zlato přímo ze seznamu staveb a z fronty; rozestavěná výroba a fronta zůstávají.
- [x] Pole s volbou: farma, nebo trhová ves; pila, nebo vymýcení lesa; farma na poušti u řeky; loviště na rybách. Zavlažování jen u řeky, pila u řeky silnější, přestavba o 2 tahy déle, rozpracovaná práce zůstává na poli.
- [x] Cesty: delší stavba v lese a pahorkatině, most až se Stavitelstvím, spojení s hlavním městem posiluje trhové vsi.
- [x] Plenění vylepšení a cest, oprava dělníky; plení i počítač a barbaři.
- [x] Strom o 36 technologiích v sedmi stupních bez přeskakování, Sluneční kalendář jako vrchol, opakovatelná Správa říše; osm nových staveb a kušník.
- [x] Hranice měst po polích s automatickým i ručním výběrem, obdělávání všech zabraných polí, města nejméně 5 polí od sebe, strop obyvatel bez akvaduktu a kanalizace, kultura za obyvatele.
- [x] Šestnáct tradic ve čtyřech větvích, zlatý věk za dokončenou větev.
- [x] Spojování stejných jednotek v šik a voj, rozdělení na vlastním území, bonus pro hoplíty.
