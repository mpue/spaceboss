// Spaceboss – Autopilot für den Demo-Modus. Liest den Spielzustand und baut daraus jedes Frame dieselbe
// Eingabe, die sonst Tastatur oder Gamepad liefern: laufen, springen, zielen, feuern, ausweichen.
// Er spielt ordentlich, aber nicht perfekt – es soll nach einem Menschen aussehen, nicht nach einem Bot.
(function () {
  'use strict';

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  class Autopilot {
    constructor() {
      this.t = 0;
      this.jumpHold = 0;          // wie lange die Sprungtaste noch gehalten wird
      this.lastX = 0;             // Fortschritt, um Hängenbleiben zu erkennen
      this.stuckT = 0;
      this.backT = 0;             // kurz zurücksetzen, wenn er festhängt
      this.dashT = 0;             // Abstand zwischen zwei Dashes
      this.nadeT = 3;             // Abstand zwischen zwei Granaten
      this.crouchT = 0;
      this.strafe = Math.random() * 6;
      this.ledge = null;          // Zwischenziel, um über eine zu hohe Wand zu kommen
      this.ledgeT = 0;
    }

    // Hilfen für den Boden vor dem Helden
    tile(g, x, y) { const T = g.L.T; return g.tileAt(Math.floor(x / T), Math.floor(y / T)); }
    standable(g, x, y) { const t = this.tile(g, x, y); return g.L.SOLID[t] || t === 3; }
    hazard(g, x, y) { return this.tile(g, x, y) === 4; }

    // Grube oder Säure zwischen 40 und 130 Pixel vor den Füßen?
    gapAhead(g, p, dir) {
      const feet = p.y + p.h / 2 + 8;
      for (const la of [40, 90, 130]) {
        const x = p.x + dir * (p.w / 2 + la);
        if (this.hazard(g, x, feet)) return true;
        if (!this.standable(g, x, feet) && !this.standable(g, x, feet + 64) && !this.standable(g, x, feet + 128)) return true;
      }
      return false;
    }
    wallAhead(g, p, dir) {
      const x = p.x + dir * (p.w / 2 + 34);
      return g.solidAt(x, p.y + p.h / 2 - 20) || g.solidAt(x, p.y - 10);
    }
    // Wand vor dem Helden höher als ein Doppelsprung (gut 6 Kacheln)?
    tallWall(g, p, dir) {
      const T = g.L.T, x = p.x + dir * (p.w / 2 + 34), feet = p.y + p.h / 2;
      return g.solidAt(x, feet - 6.2 * T);
    }
    // Plattform vor der Wand, von der aus es weitergeht: 2 bis 6 Kacheln über den Füßen, oben frei
    findLedge(g, p, dir) {
      const T = g.L.T, L = g.L;
      const fr = Math.floor((p.y + p.h / 2 + 2) / T), wc = Math.floor((p.x + dir * (p.w / 2 + 34)) / T);
      const free = (x, y) => { const t = g.tileAt(x, y); return !L.SOLID[t] && t !== 4; };
      let best = null;
      for (let k = 1; k <= 9; k++) {
        const tx = wc - dir * k;
        for (let ty = fr - 6; ty <= fr - 2; ty++) {
          const t = g.tileAt(tx, ty);
          if (!(L.SOLID[t] || t === 3) || !free(tx, ty - 1) || !free(tx, ty - 2)) continue;
          if (!best || ty < best.ty || (ty === best.ty && k < best.k)) best = { tx, ty, k };
        }
      }
      return best ? { x: best.tx * T + T / 2, y: best.ty * T } : null;
    }

    groundBelow(g, p) {
      const feet = p.y + p.h / 2;
      for (let d = 8; d < 400; d += 32) {
        if (this.hazard(g, p.x, feet + d)) return false;
        if (this.standable(g, p.x, feet + d)) return true;
      }
      return false;
    }

    // Ziel: nächster sichtbarer Gegner, der Boss zählt immer; vorn liegende bevorzugt
    target(g, p) {
      let best = null, bestD = 1e9;
      for (const e of g.enemies) {
        if (e.dead || e.hidden || e.intro) continue;
        const onScreen = e.x > g.cam.x - 40 && e.x < g.cam.x + 1960 && e.y > g.cam.y - 100 && e.y < g.cam.y + 1180;
        if (!onScreen && e.type !== 'boss') continue;
        let tx = e.x, ty = e.y;
        if (e.type === 'boss' && e.throat) { tx = e.throat.x; ty = e.throat.y; }
        const d = Math.hypot(tx - p.x, ty - p.y) * (tx < p.x - 60 ? 1.4 : 1) * (e.type === 'hmine' ? 0.6 : 1);
        if (d < bestD && d < 1300) { bestD = d; best = { e, x: tx, y: ty, d: Math.hypot(tx - p.x, ty - p.y) }; }
      }
      return best;
    }

    input(g, dt) {
      this.t += dt;
      const p = g.player;
      const inp = { moveX: 0, left: false, right: false, up: false, down: false, jump: false, fire: false,
        pressed: {}, aimVec: null };
      if (p.dead) return inp;
      const press = k => { inp.pressed[k] = true; };
      const jumpNow = hold => { if (p.onGround || p.coyote > 0) { press('jump'); this.jumpHold = hold; } };

      // ---------- Laufen: nach rechts, im Bosskampf hin und her in der linken Arenahälfte
      let dir = 1;
      if (g.lock && g.L.arena) {
        const A = g.L.arena;
        const want = A.x + 380 + Math.sin(this.t * 0.7 + this.strafe) * 220;
        dir = Math.abs(want - p.x) < 30 ? 0 : Math.sign(want - p.x);
      }
      const tg = this.target(g, p);
      // gefährlicher Bodengegner direkt vorn: stehen bleiben und ihn wegschießen
      if (!g.lock && tg && tg.e.type !== 'boss' && tg.x > p.x && tg.x - p.x < 330 && Math.abs(tg.y - p.y) < 160
        && !['drone', 'bat', 'saucer', 'stingfly', 'jelly', 'skimmer'].includes(tg.e.type)) dir = 0;

      // Lasertore: warten, bis das Tor aus ist und lange genug aus bleibt
      for (const gate of g.gates || []) {
        const ahead = gate.x - p.x;
        if (ahead > 0 && ahead < 190 && p.y + p.h / 2 > gate.y0 && p.y - p.h / 2 < gate.y1 && (gate.on || gate.t > 2.2)) dir = Math.min(dir, 0);
      }
      // Orbitalschläge: aus der Zielzone heraus
      for (const s of g.strikes || []) {
        if (s.t < s.warn + s.dur && Math.abs(s.x - p.x) < 130) dir = p.x >= s.x ? 1 : -1;
      }

      // festhängen erkennen und mit Anlauf neu versuchen
      if (dir > 0 && !g.lock && !this.ledge) {
        if (p.x > this.lastX + 30) { this.lastX = p.x; this.stuckT = 0; }
        else this.stuckT += dt;
        if (this.stuckT > 2.2) { this.backT = 0.45; this.stuckT = 0; this.lastX = p.x; }
      } else { this.lastX = p.x; this.stuckT = 0; }
      if (this.backT > 0) { this.backT -= dt; dir = -1; if (this.backT <= 0) jumpNow(0.5); }

      // Zu hohe Wand: erst auf eine Plattform davor, von dort weiter
      if (!g.lock && p.onGround && !this.ledge && dir > 0 && this.wallAhead(g, p, 1) && this.tallWall(g, p, 1)) {
        this.ledge = this.findLedge(g, p, 1);
        this.ledgeT = 0;
      }
      let climbing = false;
      if (this.ledge) {
        const L = this.ledge, dx = L.x - p.x;
        this.ledgeT += dt;
        if ((p.onGround && Math.abs(p.y + p.h / 2 - L.y) < 12) || this.ledgeT > 6) this.ledge = null;   // oben oder aufgegeben
        else {
          climbing = true;
          dir = Math.abs(dx) < 24 ? 0 : Math.sign(dx);
          if (p.onGround && Math.abs(dx) < 120) jumpNow(0.7);
          if (!p.onGround) {
            if (p.jets > 0 && p.vy > -150) press('jump');
            if (p.y + p.h / 2 > L.y - 20) this.jumpHold = Math.max(this.jumpHold, 0.1);
          }
        }
      }

      inp.moveX = dir;
      inp.left = dir < 0; inp.right = dir > 0;

      // ---------- Springen: Wände, Gruben, Säure
      const look = dir || 1;
      if (!climbing && p.onGround && dir !== 0 && (this.wallAhead(g, p, look) || this.gapAhead(g, p, look))) jumpNow(0.5);
      if (!p.onGround && !climbing) {
        // in der Luft über einer Grube: Doppelsprung am Scheitel, dann schweben
        const overGap = !this.groundBelow(g, p);
        if ((overGap || this.wallAhead(g, p, look)) && p.jets > 0 && p.vy > -120) press('jump');
        if (overGap || this.wallAhead(g, p, look)) this.jumpHold = Math.max(this.jumpHold, 0.1);
        if (overGap && inp.moveX === 0) { inp.moveX = 1; inp.right = true; }
      }

      // ---------- Ausweichen: Schockwellen, Klingen, Strahl, Geschosse
      for (const w of g.waves || []) {
        const d = (p.x - w.x) * w.dir;
        if (d > 0 && d < 230) jumpNow(0.35);
      }
      for (const b of g.ebullets) {
        const rx = b.x - p.x, ry = b.y - p.y;
        const toward = b.vx * rx < 0;
        if (b.kind === 'blade') {
          if (toward && Math.abs(rx) < 300) { if (b.low) jumpNow(0.3); else this.crouchT = 0.25; }
          continue;
        }
        if (toward && Math.abs(rx) < 240 && Math.abs(ry) < 110 && Math.abs(rx / (Math.abs(b.vx) + 1)) < 0.3) {
          if (p.dashCd <= 0 && this.dashT <= 0 && !p.wet) {
            press('dash'); this.dashT = 1.1;
            inp.moveX = rx > 0 ? 1 : -1; inp.left = inp.moveX < 0; inp.right = inp.moveX > 0;
          } else if (ry > -20) jumpNow(0.25);
        }
      }
      const beam = g.bossBeam;
      if (beam && beam.t > beam.warn - 0.25 && beam.t < beam.warn + beam.dur) {
        if (beam.low) jumpNow(0.35); else this.crouchT = 0.2;
      }
      this.dashT -= dt;

      // ---------- Zielen und Feuern
      this.crouchT -= dt;
      if (this.crouchT > 0 && p.onGround) {
        inp.down = true;                       // ducken geht nur ohne Zielrichtung
        inp.moveX = 0; inp.left = inp.right = false;
      } else if (tg) {
        const sx = p.x, sy = p.y - 24;
        let ax = tg.x - sx, ay = tg.y - 20 - sy;
        // Vorhalt bei schnellen Zielen, etwas Streuung wie bei einem Menschen
        ax += (tg.e.vx || 0) * 0.12; ay += (tg.e.vy || 0) * 0.12 + Math.sin(this.t * 3.1) * 14;
        const m = Math.hypot(ax, ay) || 1;
        inp.aimVec = { x: ax / m, y: ay / m };
        inp.fire = tg.d < 1250;
      } else {
        inp.aimVec = { x: 1, y: -0.05 };
      }
      // Granaten auf dicke Brocken
      this.nadeT -= dt;
      if (tg && this.nadeT <= 0 && p.grenades > 0 && tg.d < 700 && (tg.e.type === 'boss' || tg.e.type === 'brute'
        || tg.e.type === 'mudhulk' || tg.e.type === 'mortar')) { press('grenade'); this.nadeT = 7; }

      // Sprungtaste halten (für die volle Höhe, Doppelsprung und Schweben)
      if (this.jumpHold > 0) { this.jumpHold -= dt; inp.jump = true; }
      if (inp.pressed.jump) inp.jump = true;
      return inp;
    }
  }

  window.Autopilot = Autopilot;
})();
