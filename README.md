# Spaceboss

Run-and-Gun-Jump'n'Run im Browser, im Stil von Hypersense: polierte 3D-Sprites aus dem lokalen ComfyUI,
Orbitron-HUD, viel Leuchten, Funken, Rauch und Explosionen. Ein **muskulöser Astronaut** im orange-weißen
Raumanzug ist auf einem Alien-Planeten abgestürzt und schießt sich durch sechs Level: von der Absturzstelle
über das Mutterschiff, die Wüste und den Sumpf bis in die Festung der Invasoren.

| Level | Schauplatz | Boss |
|---|---|---|
| 1 **CRASH SITE** | Planetenoberfläche: Säuregruben, Bunker, Felstürme | **Spaceboss** – wird zurückgeschlagen und zieht sich zurück |
| 2 **HIVE CAVERNS** | organische Alien-Höhlen mit Säureflüssen und Brutkammern | **Hive Queen** |
| 3 **MOTHERSHIP** | im Inneren des Mutterschiffs, Lasertore und Aufzugsschächte | **Spaceboss in der Endform** |
| 4 **THE OUTBACKS** | rote Wüste mit Treibsand, Wrackfeldern und Sandsturm, zwei Sonnen am Horizont | **The Devourer**, ein Sandleviathan (eine gepanzerte Riesenechse) |
| 5 **THE SWAMP** | Sumpf mit watbaren Tümpeln, Totholz, Giftschlamm und Sporennebel | **The Rotmother** mit zwei Tentakeln |
| 6 **ALIEN BASE** | die Festung der Invasoren: Förderhallen, Energiegruben, Wachturm, Kaserne mit Lasertoren | **The Warlord** mit Plasmalanze und Energieschwert |

Punkte, Leben, Waffen und Granaten wandern von Level zu Level mit.

Nach dem Titel kommt die **Levelauswahl**: eine Karte je Level mit dem Schauplatz als Bild, dem Namen des
Bosses und, sobald es geschafft ist, einem **CLEARED** und der besten Punktzahl. Damit lässt sich jedes Level
direkt starten. Gewählt wird mit ← →, D-Pad, linkem Stick oder Maus, gestartet mit Enter, A oder Klick auf
die Karte, zurück zum Titel mit Esc oder B. Die Bestwerte liegen im Browser (`localStorage`), nach dem
letzten Level und nach einem Game Over landet man wieder in der Auswahl.

## Starten mit Docker Compose

```bash
docker compose up -d --build
```

Dann <http://localhost:5190> öffnen. Die Songs liegen in `./music` und werden schreibgeschützt in den Container
gehängt. Weitere Songs (.mp3/.ogg/.wav/.m4a/.flac) einfach dort ablegen, sie erscheinen nach einem Neuladen der
Seite, ohne Neustart des Containers.

Port oder Musikordner ändern: `.env.example` nach `.env` kopieren und anpassen:

```dotenv
SPACEBOSS_PORT=8080
MUSIC_PATH=/pfad/zu/meiner/musik
```

Nützlich: `docker compose logs -f` (Log), `docker compose down` (stoppen). Der Container läuft als
unprivilegierter Nutzer, hat einen Healthcheck (`/healthz`) und startet automatisch neu.

## Starten ohne Docker

Node.js ≥ 18, keine Abhängigkeiten:

```bash
node server.js
```

Dann <http://localhost:5190> öffnen. Die Musik liegt in `music/`. Welcher Song wo läuft, steht in `LEVELS` in `public/js/level.js`: gesucht wird
jeweils ein Namensteil („metal man“, „king of steel“), sonst nimmt das Spiel den ersten Song im Ordner.
Level 1, 3 und 5 laufen auf *Metal man*, Level 2 und 4 auf *King of steel*, und zum Boss wird jeweils auf den
anderen Song gewechselt.

## Steuerung

| Tastatur + Maus | Gamepad | |
|---|---|---|
| A / D | linker Stick (analog) / D-Pad | laufen |
| Maus | rechter Stick | zielen (360°) |
| linke Maustaste / J | RT (R2) oder X (□) | feuern (halten) |
| Leertaste / W | A (✕) | springen, in der Luft **Jetpack-Doppelsprung**, halten = schweben |
| Shift / L | LT (L2) oder B (○) | Dash (kurz unverwundbar, auch einmal in der Luft) |
| rechte Maustaste / G | RB (R1) | Granate |
| E / Mausrad / 1–4 | Y (△) | nächste Waffe |
| Q | LB (L1) | vorige Waffe |
| S | Stick unten / D-Pad unten | ducken, mit Sprung durch Plattformen fallen |
| Esc / P | Start oder Back | Pause |
| Enter | A oder Start | Menüs: starten und weiter |
| ← → | D-Pad / linker Stick | Levelauswahl: Karte wählen |
| F | | Vollbild – **nur im Titel, in der Levelauswahl und in der Pause**, damit man es im Spiel nicht aus Versehen neben D erwischt. Im Spiel geht es per Doppelklick |

Ohne Maus (Tastatur allein): Pfeile laufen und zielen (hoch, schräg, in der Luft nach unten),
K springt, J feuert, L dasht. Das Spiel schaltet automatisch um, sobald die Maus bewegt wird.

### Gamepad

Pads im Standard-Layout (Xbox, DualShock, DualSense, die meisten USB-Pads) werden automatisch erkannt.
Der Browser meldet ein Pad erst nach dem ersten Tastendruck, also einmal kurz drücken.

- **Laufen ist analog:** leichter Stickausschlag heißt schleichen, voller Ausschlag volles Tempo.
  Beide Sticks haben eine radiale Totzone, damit ausgeleierte Sticks nicht von selbst driften.
- **Zielen mit dem rechten Stick** geht über alle 360°, die Richtung wird weich nachgezogen. Lässt du den
  Stick los, bleibt die Zielrichtung stehen und dreht sich beim Umdrehen mit. Ohne rechten Stick zielt der
  linke wie die Tastatur in acht Richtungen. Ein Fadenkreuz zeigt an, wohin geschossen wird.
- **Trigger werden analog gelesen** und notfalls aus den Achsen 4 und 5, falls das Pad sie nicht als
  Tasten meldet.
- Es zählt immer das Pad, an dem zuletzt etwas gedrückt oder bewegt wurde. Kommt eins dazu oder wird eins
  abgezogen, sagt das eine kurze Meldung; beim Abziehen pausiert das Spiel.
- Treffer, Sprünge, Explosionen und die Schritte der Bosse lassen den Controller vibrieren.
- **`?pad=1`** blendet eine Testanzeige ein: beide Sticks, beide Trigger und die gedrückten Tasten.
  Damit lässt sich prüfen, ob ein ungewöhnliches Pad richtig ankommt.

## Spielprinzip

- **Waffen:** Plasma-Blaster (unendlich), Spread Cannon (7er-Fächer), Ion Laser (Dauerstrahl, durchschlägt
  alles), Swarm Rockets (zielsuchend, Flächenschaden). Munition aus Kapseln **S / L / R**, leer geht es zurück
  zum Blaster. Dazu Granaten (**G**), die abprallen und auf Kontakt oder nach der Zündzeit hochgehen.
- **Warmlaufen:** Die erste Minute von Level 1 ist gnädiger. Gegner feuern seltener, ihre Geschosse sind
  langsamer und machen bis zu 35 % weniger Schaden, Krabbler springen noch nicht, und die Drohnenwellen
  setzen erst nach gut einer halben Minute ein. Das läuft linear aus (`this.ease` in `game.js`).
- **Kette:** Abschüsse innerhalb von 2,5 s bauen eine Kette auf, alle 5 Treffer steigt der Multiplikator (bis ×8).
- **Checkpoints:** Baken, die beim Vorbeilaufen grün werden, heilen etwas und sind der Wiedereinstieg.
- **Fässer** explodieren in Ketten und reißen Gegner (und den Helden) mit, **Kisten** geben Beute.
- **Sprungfelder** schießen den Helden hoch, **Säure** tut weh und schleudert ihn wieder heraus.
- **Förderbänder:** In der Alien Base laufen Bänder (`{` nach links, `}` nach rechts). Wer darauf steht, wird
  mitgenommen – gegen die Laufrichtung kommt man nur langsam voran, mit ihr fliegt man förmlich.
- **Waten:** Im Sumpf stehen Tümpel. Im Wasser läuft der Held nur noch mit 60 % Tempo, springt niedriger,
  fällt langsamer und kann nicht dashen. Das Wasser wird über ihm gezeichnet, er steckt also wirklich drin.

### Extras

Zeitlich begrenzte Verstärkungen. In jedem Level liegen drei an festen Stellen, dazu fallen sie selten aus
Kisten (10 %) und von Gegnern (2,5 %). Ein neues Extra derselben Sorte startet die Zeit neu. Links unter der
Waffe zeigt der HUD, was gerade läuft und wie lange noch; kurz vor Schluss blinkt der Balken. Beim Tod sind
alle Extras weg.

| Extra | Kennung | Dauer | Wirkung |
|---|---|---|---|
| **Jetpack** | `J` | 12 s | Sprungtaste in der Luft halten = Dauerschub nach oben, ohne Tankanzeige |
| **Shield** | `Q` | 15 s | Schildblase fängt drei Treffer komplett ab und wird dabei sichtbar dünner |
| **Overdrive** | `O` | 10 s | doppelte Feuerrate und 1,5-facher Schaden für alle Waffen, auch den Laser |
| **Magnet** | `Y` | 20 s | zieht Münzen aus fast einer Bildschirmbreite heran |

Die Fundorte stehen nicht in den ASCII-Karten, sondern als Spaltenliste in `LEVELS[].extras`
(`level.js`); `build()` setzt jedes Extra auf den Boden seiner Spalte und weicht Gruben, Säure und Wasser aus.

### Gegner

| Gegner | Verhalten |
|---|---|
| Krabbler | läuft auf prozeduralen Beinen, springt den Helden an |
| Drohne | kreist über dem Helden, feuert rote Plasmakugeln, kommt auch in Wellen von rechts |
| Qualle | schwebt über dem Helden und lässt Säuretropfen fallen |
| Geschützturm | am Boden oder an der Decke, Dreier-Salven |
| Schwebepanzer | hält Abstand, schwere Plasmakugel und Fächer, lässt immer eine Waffe fallen |
| Brutsack | spuckt Krabbler aus, bis er platzt |
| Säurespucker | hockt am Boden und spuckt drei Säurebatzen im Bogen |
| Fledermaus | flattert über dem Helden und stürzt sich auf ihn |
| Bomben-Untertasse | zieht oben mit und wirft Bomben |
| Schild-Wächter | sein Frontschild hält Schüsse ab, nur beim Feuern ist er offen – Granaten und Raketen treffen ihn trotzdem |
| Lasertor | Falle im Mutterschiff: schaltet im Takt an und aus |
| Sandwurm | gräbt sich unter dem Sand heran (nur ein Hügel ist zu sehen) und bricht unter dem Helden heraus |
| Gleiterreiter | rast auf dem Hover-Bike vorbei und feuert im Vorbeiflug |
| Dornenpflanze | reißt ihren Schlund auf und spuckt einen Fächer aus Stacheln |
| Mörserläufer | vierbeiniger Walker auf echten Beinen, wirft Granaten im hohen Bogen; ein Ring am Boden zeigt den Einschlag an |
| Blutegel | kriecht an Land, schwimmt im Wasser deutlich schneller und schnellt auf den Helden zu |
| Stechfliege | schwirrt über dem Helden und sticht im Sturzflug zu |
| Sporenpilz | bläst Sporenwolken aus, die auf den Helden zutreiben und langsam vergiften |
| Schlammkoloss | stapft auf zwei Beinen heran, sein Panzerrücken hält Schüsse von vorn ab; wenn er brüllt, ist er offen und stürmt los |
| Alien-Soldat | läuft auf echten Beinen, hält Abstand und feuert Dreier-Salven aus dem Plasmagewehr |
| Schwebemine | treibt auf den Helden zu, blinkt scharf und explodiert; zerschossen reißt sie andere Gegner mit |
| Warper | verschwindet in einem violetten Blitz, taucht hinter dem Helden auf, holt kurz aus und schlitzt nach vorn |

Alle Bosse haben drei Phasen und einen Kern beziehungsweise Schlund, der deutlich mehr Schaden nimmt:

| Boss | Angriffe |
|---|---|
| **Spaceboss** | Fächer aus der Armkanone, Augen-Salven, Bodenschockwellen (drüberspringen), Orbitalschläge mit Vorwarnung, Drohnen-Nachschub, Ringsalven |
| **Hive Queen** | Säureregen über die ganze Arena, Fächer, frisch gelegte Krabbler, Fledermausschwärme, Schockwellen, Ringsalven |
| **Endform** | alles davon, schneller, dazu ein waagrechter Laser: tief heißt drüberspringen, hoch heißt ducken (die Warnung sagt an, was) |
| **The Warlord** | Plasmalanze (Salven, Fächer), Energieklingen im Bumerangbogen – tief heißt drüberspringen, hoch heißt ducken –, Stampfer mit Schockwellen, Orbitalschläge, Schwebeminen als Nachschub, waagrechter Strahl und Ringsalven aus dem Energieherz |
| **The Rotmother** | sitzt im Tümpel und schlägt mit zwei Tentakeln zu: einer hebt sich hoch und knallt herunter (Schockwellen nach beiden Seiten), einer fegt flach über den Boden (drüberspringen). Dazu speit sie Säure im Bogen, bläst Sporenwolken, ruft Brut und taucht ab, um woanders wieder aufzutauchen. Ihr Eiersack ist die Schwachstelle |
| **The Devourer** | wandert als Hügel unter dem Sand heran, bricht mit Vorwarnung heraus und fliegt im Bogen über die Arena. Dabei speit er Feuerbrocken, lässt Sandfontänen aufsteigen, spuckt Sandwürmer aus und feuert Ringsalven. Sein Panzer schluckt 55 % des Schadens, voll trifft nur der glühende Schlund (dann 2,4-facher Schaden) |

**Alle Bosse sind wie der Held aus Einzelteilen zusammengesetzt.** Die beiden Zweibeiner haben ein Skelett: Die Hüfte
ist der Nullpunkt, beide Beine werden am Knie geteilt und über Zwei-Knochen-IK auf ihre Fußpunkte gerechnet
(umgekehrtes Knie), die Arme drehen sich um die Schulter. Sie **laufen** dem Helden mit einem Schrittzyklus
entgegen: Standbein schiebt, Schwungbein hebt ab, bei jedem Aufsetzen staubt es, die Kamera wackelt und ein
tiefer Tritt dröhnt. Dazu federt die Hüfte, sie bäumen sich vor Schlägen und beim Phasenwechsel auf, zucken
beim Feuern zurück und brechen im Tod in die Knie.

| Boss | Teile | Besonderheit |
|---|---|---|
| **Spaceboss** (auch die Endform) | `boss_torso`, `boss_cannon`, `boss_claw`, `boss_leg` | der Kanonenarm zielt auf den Helden, die Mündung sitzt am Ende des Laufs; der Klauenarm holt aus und drischt beim Schlag zu |
| **Hive Queen** | `queen_torso`, `queen_scythe`, `queen_leg`, `queen_tail` | zwei Sichelklauen (eine hinter, eine vor dem Körper), die Säure kommt aus dem Maul, der Schwanz schwingt gegen die Laufrichtung aus |
| **The Warlord** | `war_torso`, `war_cannon`, `war_blade`, `war_leg` | Skelett wie beim Spaceboss: Zwei-Knochen-IK für die Beine, die Lanze zielt, das Schwert holt beim Klingenwurf aus und schlägt durch |
| **The Rotmother** | `mom_body`, `mom_seg`, `mom_tip` | die Tentakel sind Seile: neun Glieder, die mit FABRIK (zwei Durchläufe) zwischen Schulter und Zielpunkt eingepasst werden. Bewegt wird nur der Zielpunkt, der Rest ergibt sich |
| **The Devourer** | `dev_maw`, `dev_seg`, `dev_arm`, `dev_tail` | kein Skelett, sondern eine Kette: der gehörnte Echsenschädel fliegt eine Bahn, vierzehn Schuppenstücke werden zwischen den Punkten dieser Bahn aufgespannt und nach hinten immer schmaler, am Ende sitzt die Schwanzspitze. Getroffen wird er über Kreise statt über ein Rechteck |

Nicht nur die Bosse laufen so: **Mörserläufer** und **Schlammkoloss** bestehen ebenfalls aus Rumpf (`mortar_body`, `mudhulk_body`) und einem einzelnen Bein (`mortar_leg`, `mudhulk_leg`), das für jedes Bein neu gebeugt wird. Der Mörserläufer setzt vier Beine im Trab, der Koloss zwei. Die Füße bleiben auf dem Boden stehen, während der Rumpf darüber weiterzieht – rutschende Sprites gibt es keine mehr. Fehlen die Teile, fällt beides auf das alte Einzelsprite zurück.

Die Maße der Skelette stehen in `RIGS` in `game.js`, die Ansatzpunkte in den Bildern (Hüfte, Knie, Knöchel,
Schulter, Mündung) in `BOSS` in `render.js`. Ein neuer Boss braucht nur einen Eintrag in beiden.

Jeder Treffer auf einen Boss zeigt sich deutlich: Der Körper blitzt weiß auf und zuckt in Schussrichtung
zurück, am Einschlag sprühen Funken, der aufgelaufene Schaden erscheint als Zahl, und die Bossleiste blitzt,
zittert und lässt den frischen Schaden als weißen Rest nachlaufen. Treffer in den Kern machen 60 % mehr
Schaden, werden golden dargestellt und mit „CRIT!“ beschriftet.

## Test-Schalter

`?play=1` (Titel überspringen), `?level=2` (Level wählen), `?zoom=1.1&on=boss` (Kamera auf den Boss), `?god=1` (unverwundbar), `?weak=1` (Boss mit
400 Trefferpunkten), `?at=330` (ab dieser Spalte starten), `?select=1` (direkt in die Levelauswahl), `?pad=1` (Gamepad-Testanzeige), `?zoom=3` (Kamera um den Helden vergrößern,
zum Prüfen der Figur), F3 zeigt die FPS. Die Arenen liegen bei Spalte 354, 231, 235, 286 und 286.
Zum Beispiel <http://localhost:5190/?play=1&god=1&level=4&at=283> für das Finale.

Im laufenden Spiel liegt der Spielzustand als `window.SB` in der Konsole (`SB.player.hp`, `SB.boss.hp`,
`SB.ease` …), praktisch zum Nachjustieren. `window.game` ist dagegen das Canvas-Element.

`node tools/check_levels.js` prüft die Level auf Bau-Fehler: Abschnitte mit zu vielen Zeilen, Gegner oder
Checkpoints ohne Boden unter sich, Deckentürme ohne Decke, Lasertore ohne Decke, Löcher in der untersten
Bodenreihe (entstehen, wenn eine Zeile im Abschnitt zu kurz ist) und fehlende Arena.

## Grafiken

Alle Sprites, Texturen und Hintergründe kommen aus dem lokalen ComfyUI (Krea-2 Turbo), genau wie bei Hypersense:

```bash
python tools/gen_assets.py                   # rendert alle Motive in 2–4 Varianten nach art/raw/
python tools/gen_assets.py boss              # nur einzelne
python tools/gen_assets.py --seeds 5,7 boss  # mit eigenen Seeds
python tools/contact.py art/contact.png hero_   # Kontaktbogen zum Auswählen
python tools/key_assets.py                   # gewählte Varianten -> public/assets/
```

Welche Variante genommen wird, steht oben in `tools/key_assets.py`. Sprites werden auf Greenscreen gerendert
und freigestellt, Explosionen auf Schwarz (additiv gezeichnet), Boden- und Metalltextur werden gespiegelt zu
nahtlosen Kacheln.

**Held und Spaceboss** sind aus einzeln gerenderten Teilen zusammengesetzt und werden prozedural animiert,
nicht als fertige Animation gerendert.

**Der Held** ist aus drei Renders zusammengesetzt: Oberkörper (mit Armstumpf),
Waffenarm (dreht sich um die Schulter zum Ziel) und ein Bein, das am Knie geteilt wird (Oberschenkel und
Unterschenkel mit Gelenk). Lauf-, Sprung-, Schwebe- und Duckposen, Rückstoß, Landestauchung und Dash-Nachbilder
entstehen im Code. **Beim Sterben** fällt er richtig um: Er wird zurückgeschleudert, taumelt, prallt einmal auf,
kippt um den Fußpunkt in die Seitenlage, rutscht aus und bleibt rauchend und funkend liegen — der Arm hängt
herab, die Beine sacken zusammen. Die Ansatzpunkte (Armstumpf, Hüfte, Schulter, Mündung, Knie) stehen in `HERO` in `render.js`.
Die Beine der Krabbler werden ebenfalls prozedural gezeichnet.

Der Hintergrund von **The Outbacks** hatte die Rauchfahne des abgestürzten Mutterschiffs eingebacken, sie
stand still. `tools/desmoke.py` entfernt sie aus dem Render (der Himmel wird aus der Umgebung geschätzt),
im Spiel steigt der Rauch dann animiert auf: Wolkenballen quellen aus dem Wrack, wachsen, treiben mit dem
Wind ab und verblassen, am Fuß flackert Glut (`plumes` im Level-Thema, `plume()` in `render.js`).

## Sounds

Die Explosions-Samples in `public/sfx/` stammen aus Hypersense (Bluezone-Library, lizenziert: vor einer
Weitergabe die Lizenz prüfen). Waffen, Jetpack, Laser, Treffer und Boss-Gebrüll werden mit WebAudio
synthetisiert (`public/js/audio.js`).

## Projektstruktur

```
server.js              statischer Server + /api/songs + /healthz (Port 5190)
public/js/level.js     die drei Level aus ASCII-Abschnitten plus Aussehen, Musik und Boss (Legende oben)
public/js/game.js      Spiellogik: Held, Waffen, Gegner, Boss, Partikel
public/js/render.js    Darstellung, zusammengesetzter Held, HUD, Titel
public/js/audio.js     Musik, Samples, synthetisierte Effekte
public/js/main.js      Laden, Eingabe (Tastatur, Maus, Gamepad), Ablauf
public/assets/         Sprites und Texturen (aus tools/key_assets.py)
tools/                 Asset-Pipeline (ComfyUI)
music/                 Songs
```
