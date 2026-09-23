// Prüft die Level auf Bau-Fehler:  node tools/check_levels.js
// Abschnitte mit mehr als 18 Zeilen, Bodengegner/Checkpoints ohne Boden, Lasertore ohne Decke, Arena/Boss fehlt.
global.window = {};
require('../public/js/level.js');
const L = window.Level;
let bad = 0;
L.LEVELS.forEach((def, i) => {
  def.chunks.forEach((rows, k) => { if (rows.length > L.ROWS) { console.log(`L${i + 1} Abschnitt ${k}: ${rows.length} Zeilen`); bad++; } });
  const lv = L.build(i), T = L.T;
  const at = (x, y) => (x < 0 || x >= lv.w || y < 0 || y >= lv.h) ? 2 : lv.tiles[y * lv.w + x];
  const floor = t => L.SOLID[t] || t === 3;
  for (const s of lv.spawns) {
    const tx = Math.floor(s.x / T), ty = Math.round(s.y / T) - 1;
    if ('tspXnBaq'.includes(s.ch) && !floor(at(tx, ty + 1))) { console.log(`L${i + 1} '${s.ch}' bei Spalte ${tx}, Zeile ${ty} schwebt`); bad++; }
    if (s.ch === 'T' && !L.SOLID[at(tx, ty - 1)]) { console.log(`L${i + 1} Deckenturm ohne Decke bei ${tx}`); bad++; }
    if (s.ch === '|') {
      let up = ty; while (up > 0 && !L.SOLID[at(tx, up - 1)]) up--;
      if (up === 0) { console.log(`L${i + 1} Lasertor ohne Decke bei ${tx}`); bad++; }
    }
  }
  // Löcher in der untersten Reihe (entstehen, wenn eine Zeile im Abschnitt zu kurz ist)
  for (let x = 0; x < lv.w; x++) {
    if (!L.SOLID[at(x, lv.h - 1)]) { console.log(`L${i + 1} Loch im Boden bei Spalte ${x}`); bad++; break; }
  }
  const sx = Math.floor(lv.start.x / T), sy = Math.round(lv.start.y / T);
  if (!L.SOLID[at(sx, sy)]) { console.log(`L${i + 1} Start ohne Boden`); bad++; }
  if (!lv.arena || !lv.boss) { console.log(`L${i + 1} ohne Arena oder Boss`); bad++; }
  console.log(`L${i + 1} ${def.name}: ${lv.w} Spalten, Arena ab ${lv.arena && lv.arena.x / T}, ${lv.spawns.length} Objekte`);
});
process.exit(bad ? 1 : 0);
