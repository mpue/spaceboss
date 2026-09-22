# Spaceboss

Run-and-Gun-Jump'n'Run im Browser, im Stil von Hypersense: polierte 3D-Sprites aus dem lokalen ComfyUI,
Orbitron-HUD, viel Leuchten, Funken, Rauch und Explosionen. Ein **muskulöser Astronaut** im orange-weißen
Raumanzug ist auf einem Alien-Planeten abgestürzt und schießt sich durch drei Level bis ins Mutterschiff.

| Level | Schauplatz | Boss |
|---|---|---|
| 1 **CRASH SITE** | Planetenoberfläche: Säuregruben, Bunker, Felstürme | **Spaceboss** – wird zurückgeschlagen und zieht sich zurück |
| 2 **HIVE CAVERNS** | organische Alien-Höhlen mit Säureflüssen und Brutkammern | **Hive Queen** |
| 3 **MOTHERSHIP** | im Inneren des Mutterschiffs, Lasertore und Aufzugsschächte | **Spaceboss in der Endform** |

Punkte, Leben, Waffen und Granaten wandern von Level zu Level mit.

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
Level 1 und 3 laufen auf *Metal man*, Level 2 auf *King of steel*, und zum Boss wird jeweils auf den anderen
Song gewechselt.

## Steuerung

| Tastatur + Maus | Gamepad | |
|---|---|---|
| A / D | linker Stick / D-Pad | laufen |
| Maus | rechter Stick | zielen (360°) |
| linke Maustaste / J | RT / X | feuern (halten) |
| Leertaste / W | A | springen, in der Luft **Jetpack-Doppelsprung**, halten = schweben |
| Shift / L | LT / B | Dash (kurz unverwundbar, auch einmal in der Luft) |
| rechte Maustaste / G | RB | Granate |
| Q / E / Mausrad / 1–4 | LB / Y | Waffe wechseln |
| S | Stick unten | ducken, mit Sprung durch Plattformen fallen |
| Esc / P | Start | Pause |
| F | | Vollbild |

Ohne Maus (Tastatur allein): Pfeile laufen und zielen (hoch, schräg, in der Luft nach unten),
K springt, J feuert, L dasht. Das Spiel schaltet automatisch um, sobald die Maus bewegt wird.

## Spielprinzip

- **Waffen:** Plasma-Blaster (unendlich), Spread Cannon (7er-Fächer), Ion Laser (Dauerstrahl, durchschlägt
  alles), Swarm Rockets (zielsuchend, Flächenschaden). Munition aus Kapseln **S / L / R**, leer geht es zurück
  zum Blaster. Dazu Granaten (**G**), die abprallen und auf Kontakt oder nach der Zündzeit hochgehen.
- **Kette:** Abschüsse innerhalb von 2,5 s bauen eine Kette auf, alle 5 Treffer steigt der Multiplikator (bis ×8).
- **Checkpoints:** Baken, die beim Vorbeilaufen grün werden, heilen etwas und sind der Wiedereinstieg.
- **Fässer** explodieren in Ketten und reißen Gegner (und den Helden) mit, **Kisten** geben Beute.
- **Sprungfelder** schießen den Helden hoch, **Säure** tut weh und schleudert ihn wieder heraus.

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

Alle Bosse haben drei Phasen und einen Kern, der 60 % mehr Schaden nimmt:

| Boss | Angriffe |
|---|---|
| **Spaceboss** | Fächer aus der Armkanone, Augen-Salven, Bodenschockwellen (drüberspringen), Orbitalschläge mit Vorwarnung, Drohnen-Nachschub, Ringsalven |
| **Hive Queen** | Säureregen über die ganze Arena, Fächer, frisch gelegte Krabbler, Fledermausschwärme, Schockwellen, Ringsalven |
| **Endform** | alles davon, schneller, dazu ein waagrechter Laser: tief heißt drüberspringen, hoch heißt ducken (die Warnung sagt an, was) |

## Test-Schalter

`?play=1` (Titel überspringen), `?level=2` (Level wählen), `?god=1` (unverwundbar), `?weak=1` (Boss mit
400 Trefferpunkten), `?at=330` (ab dieser Spalte starten), `?zoom=3` (Kamera um den Helden vergrößern,
zum Prüfen der Figur), F3 zeigt die FPS. Die Arenen liegen bei Spalte 356, 231 und 235.
Zum Beispiel <http://localhost:5190/?play=1&god=1&level=3&at=232> für das Finale.

`node tools/check_levels.js` prüft die Level auf Bau-Fehler: Abschnitte mit zu vielen Zeilen, Gegner oder
Checkpoints ohne Boden unter sich, Deckentürme ohne Decke, Lasertore ohne Decke, fehlende Arena.

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

**Der Held** ist aus drei Renders zusammengesetzt und wird prozedural animiert: Oberkörper (mit Armstumpf),
Waffenarm (dreht sich um die Schulter zum Ziel) und ein Bein, das am Knie geteilt wird (Oberschenkel und
Unterschenkel mit Gelenk). Lauf-, Sprung-, Schwebe- und Duckposen, Rückstoß, Landestauchung und Dash-Nachbilder
entstehen im Code. Die Ansatzpunkte (Armstumpf, Hüfte, Schulter, Mündung, Knie) stehen in `HERO` in `render.js`.
Die Beine der Krabbler werden ebenfalls prozedural gezeichnet.

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
