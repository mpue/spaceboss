// Spaceboss – Spiellogik: Held, Waffen, Gegner, Boss, Effekte. Alle Akteure haben x/y in der Mitte.
(function () {
  'use strict';

  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const STEP = 1 / 120;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  // Winkel auf kürzestem Weg nachziehen (für das Zielen mit dem Stick)
  const turn = (a, b, t) => a + (((b - a + Math.PI * 3) % TAU) - Math.PI) * t;

  // Held: Maße und Bewegung
  const P = {
    w: 50, h: 150, hc: 100,               // Breite, Höhe stehend / geduckt
    run: 560, accG: 5200, accA: 2800,
    grav: 3300, jump: 1280, jet: 1080, fall: 1500,
    hover: 150, fuelUse: 1.1, fuelRegen: 1.6,
    dash: 1400, dashT: 0.17, dashCd: 0.55,
    hp: 100, inv: 1.45,
    shoulder: { x: 6, y: -24 },          // Schulter relativ zur Mitte (Blick nach rechts)
    arm: 124,                            // Schulter bis Mündung
  };

  const WEAPONS = {
    blaster: { name: 'PLASMA BLASTER', short: 'BLASTER', rate: 0.08, ammo: Infinity, color: '#5ae0ff' },
    spread: { name: 'SPREAD CANNON', short: 'SPREAD', rate: 0.15, ammo: 110, color: '#ffa640' },
    laser: { name: 'ION LASER', short: 'LASER', rate: 0, ammo: 100, color: '#ff4fd8', drain: 12 },
    rocket: { name: 'SWARM ROCKETS', short: 'ROCKETS', rate: 0.26, ammo: 36, color: '#ffe36a' },
  };
  const ORDER = ['blaster', 'spread', 'laser', 'rocket'];
  const PICK_WEAPON = { S: 'spread', L: 'laser', R: 'rocket' };

  const EN = {
    crawler: { w: 96, h: 58, hp: 30, score: 100, flesh: true, dmg: 15, coins: 1 },
    drone: { w: 84, h: 74, hp: 26, score: 150, dmg: 10, coins: 2 },
    jelly: { w: 96, h: 116, hp: 48, score: 200, flesh: true, dmg: 20, coins: 2 },
    turret: { w: 92, h: 84, hp: 80, score: 250, dmg: 10, coins: 3 },
    brute: { w: 200, h: 136, hp: 280, score: 700, dmg: 25, coins: 8 },
    pod: { w: 104, h: 104, hp: 100, score: 300, flesh: true, dmg: 10, coins: 4 },
    spitter: { w: 110, h: 90, hp: 60, score: 250, flesh: true, dmg: 15, coins: 3 },
    bat: { w: 110, h: 70, hp: 20, score: 150, flesh: true, dmg: 15, coins: 1 },
    saucer: { w: 130, h: 70, hp: 45, score: 300, dmg: 15, coins: 3 },
    sentinel: { w: 96, h: 120, hp: 110, score: 400, dmg: 20, coins: 4 },
    sandworm: { w: 120, h: 170, hp: 45, score: 250, flesh: true, dmg: 20, coins: 2 },
    skimmer: { w: 200, h: 90, hp: 55, score: 300, dmg: 20, coins: 3 },
    thorn: { w: 110, h: 150, hp: 55, score: 200, flesh: true, dmg: 15, coins: 2 },
    mortar: { w: 220, h: 150, hp: 180, score: 600, dmg: 20, coins: 6 },
    leech: { w: 110, h: 70, hp: 35, score: 150, flesh: true, dmg: 15, coins: 1 },
    stingfly: { w: 100, h: 90, hp: 20, score: 150, flesh: true, dmg: 12, coins: 1 },
    sporepod: { w: 120, h: 150, hp: 65, score: 250, flesh: true, dmg: 12, coins: 3 },
    mudhulk: { w: 210, h: 160, hp: 240, score: 700, flesh: true, dmg: 25, coins: 7 },
    boss: { w: 440, h: 600, hp: 4200, score: 25000, dmg: 30, coins: 60 },
  };

  // Gegner, die wirklich laufen: Rumpf und Beine sind getrennte Teile mit Zwei-Knochen-IK.
  // Anders als beim Boss schaut die Gegnerkunst nach links, vorn ist hier also -x.
  const WALKERS = {
    mortar: {
      parts: { torso: 'mortar_body', leg: 'mortar_leg' },
      torsoH: 165, stand: 112, thigh: 58, shin: 64, step: 104, lift: 26, bob: 6,
      // Vier Beine im Trab: je ein fernes und ein nahes vorn und hinten, diagonal versetzt.
      // Die Kunst schaut nach links, vorn ist also -x.
      legs: [
        { rest: 62, phase: 0.00, back: true },
        { rest: -58, phase: 0.50, back: true },
        { rest: 74, phase: 0.50, back: false },
        { rest: -70, phase: 0.00, back: false },
      ],
    },
    mudhulk: {
      parts: { torso: 'mudhulk_body', leg: 'mudhulk_leg' },
      torsoH: 210, stand: 106, thigh: 54, shin: 60, step: 96, lift: 22, bob: 8,
      legs: [
        { rest: 14, phase: 0.50, back: true },
        { rest: -8, phase: 0.00, back: false },
      ],
    },
  };

  // Der Spaceboss aus Einzelteilen: Maße in Weltpixeln, Blickrichtung nach rechts gerechnet
  // (im Spiel schaut er nach links, das Zeichnen spiegelt). Hüfte ist der Nullpunkt des Skeletts.
  const RIGS = {
    // Der Spaceboss: Kanonenarm zielt, Klauenarm schlägt zu
    boss: {
      parts: { torso: 'boss_torso', arm: 'boss_cannon', arm2: 'boss_claw', leg: 'boss_leg' },
      aim: 'arm',                        // die Mündung sitzt am gezielten Arm
      torsoH: 520,                       // Zeichenhöhe des Rumpfes
      stand: 330,                        // Hüfthöhe über dem Boden
      thigh: 161, shin: 197,             // Oberschenkel und Unterschenkel
      step: 240, lift: 75,               // Schrittlänge und Fußhebung
      shoulder: { x: -10, y: -258 },     // Kanonenschulter relativ zur Hüfte
      clawSh: { x: 10, y: -240 },        // Schulter des Klauenarms (zweite Hand, vor dem Rumpf)
      armLen: 430, clawLen: 370,
      core: { x: 100, y: -234, r: 95 },  // Reaktorkern (Kerntreffer)
      eye: { x: 147, y: -328 },
      body: { x0: -210, y0: -500, x1: 210, y1: 340 },
    },
    // Die Hive Queen: zwei Sichelklauen, Säure kommt aus dem Maul, dazu ein Schwanz
    queen: {
      parts: { torso: 'queen_torso', arm: 'queen_scythe', arm2: 'queen_scythe', leg: 'queen_leg', tail: 'queen_tail' },
      aim: 'head',                       // die Säure kommt aus dem Maul, nicht aus dem Arm
      torsoH: 560, stand: 300,
      thigh: 176, shin: 174,
      step: 250, lift: 80,
      shoulder: { x: -34, y: -291 },     // vordere Sichelklaue
      clawSh: { x: -73, y: -308 },       // hintere Sichelklaue
      armLen: 430, clawLen: 430,
      tail: { x: -70, y: -90, len: 430 },
      core: { x: 49, y: -196, r: 110 },
      eye: { x: 209, y: -386 },
      mouth: { x: 234, y: -291 },        // aus dem Maul kommt die Säure
      body: { x0: -230, y0: -510, x1: 230, y1: 300 },
    },
    // Die Rotmother: fetter Leib mit zwei Tentakeln, die als Seil gerechnet werden
    rot: {
      kind: 'tentacle',
      parts: { body: 'mom_body', seg: 'mom_seg', tip: 'mom_tip' },
      bodyH: 560, segs: 9, segLen: 96, segH: 120, tipH: 150,
      shoulder: [{ x: -40, y: -210 }, { x: 60, y: -120 }],   // Ansatz der Tentakel (Blick nach links)
      mouth: { x: -210, y: -170 },
      core: { x: 60, y: 60, r: 120 },                        // Eiersack: die Schwachstelle
      body: { x0: -250, y0: -330, x1: 250, y1: 240 },
      sink: 300,                                             // wie tief sie beim Abtauchen verschwindet
    },
    // Der Devourer: eine Kette aus Segmenten, die dem Kopf hinterherläuft
    worm: {
      kind: 'chain',
      parts: { head: 'dev_maw', seg: 'dev_seg', arm: 'dev_arm', tail: 'dev_tail' },
      headH: 360, segH: 330, segs: 14, spacing: 100, taper: 0.935,
      armLen: 330, armAt: 1,
      mouth: { x: -150, y: 10 },         // Maul relativ zum Kopf (Kopf zeigt nach -x)
      core: { x: -120, y: 0, r: 85 },    // glühender Schlund: die Schwachstelle
      headR: 130, segR: 92,
      body: { x0: -180, y0: -180, x1: 180, y1: 180 },
    },
  };
  const RIG = RIGS.boss;

  // Bosse: Lage der Trefferzone, des Kerns (mehr Schaden), der Kanone und des Auges relativ zur Mitte,
  // Zeichenhöhe des Sprites und die Angriffe je Phase.
  const BOSSES = {
    spaceboss: { name: 'SPACEBOSS', rig: 'boss', hp: 4200, score: 25000, color: '#9dff4a', minion: 'drone',
      pool: [['spread', 'volley', 'slam'], ['strikes', 'drones', 'strikes'], ['rings', 'rings', 'slam']],
      retreat: true, intro: 'THE SPACEBOSS APPROACHES', down: 'SPACEBOSS RETREATS' },
    queen: { name: 'HIVE QUEEN', rig: 'queen', hp: 5200, score: 30000, color: '#ff5ad2', minion: 'bat',
      pool: [['acid', 'spread', 'brood'], ['bats', 'slam', 'acid'], ['rings', 'brood', 'acid']],
      intro: 'THE HIVE QUEEN AWAKENS', down: 'HIVE QUEEN SLAIN' },
    final: { name: 'SPACEBOSS  -  FINAL FORM', rig: 'boss', hp: 7000, score: 50000, rage: true,
      color: '#ff4a6a', minion: 'saucer',
      pool: [['spread', 'volley', 'beam', 'slam'], ['strikes', 'drones', 'beam', 'rings'], ['rings', 'beam', 'strikes', 'volley']],
      intro: 'THE SPACEBOSS RETURNS', down: 'SPACEBOSS DESTROYED' },
    devourer: { name: 'THE DEVOURER', rig: 'worm', hp: 5200, score: 80000, color: '#ff9a3c', minion: 'sandworm',
      armor: 0.45, critMul: 2.4,                       // Panzerung: nur der Schlund nimmt vollen Schaden
      pool: [['spit', 'strikes'], ['brood', 'beam', 'spit'], ['rings', 'beam', 'strikes']],
      intro: 'THE SAND IS MOVING', down: 'THE DEVOURER FALLS' },
    rotmother: { name: 'THE ROTMOTHER', rig: 'rot', hp: 6400, score: 120000, color: '#c8ff5a', minion: 'stingfly',
      armor: 0.6, critMul: 2.2,
      pool: [['whip', 'spit'], ['sweep', 'spores', 'brood'], ['whip', 'spit', 'sweep', 'spores']],
      intro: 'SOMETHING STIRS IN THE WATER', down: 'THE ROTMOTHER ROTS' },
  };

  class Game {
    constructor(level, audio, opts = {}) {
      this.L = level;
      this.audio = audio;
      this.opts = opts;
      this.rumble = opts.rumble || (() => {});
      this.time = 0;
      this.score = 0;
      this.coins = 0;
      this.lives = 3;
      this.combo = 0; this.comboT = 0; this.bestCombo = 0;
      this.kills = 0;
      this.enemies = [];
      this.bullets = [];
      this.ebullets = [];
      this.parts = [];
      this.pickups = [];
      this.floaters = [];
      this.decals = [];
      this.clouds = [];             // Sporenwolken (Sumpf)
      this.waves = [];              // Boss-Schockwellen
      this.strikes = [];            // Boss-Orbitalschläge
      this.checks = [];
      this.pending = [];            // verzögerte Explosionen (Fass-Ketten, Boss-Tod)
      this.beam = null;             // Laserstrahl dieses Frames
      this.shake = 0; this.hitstop = 0; this.flash = 0; this.flashColor = '#fff';
      this.slow = 1; this.slowT = 0;
      this.banner = null;
      this.acc = 0;
      this.spawnIdx = 0;
      this.waveT = 26;
      this.lock = false;            // Kamera in der Boss-Arena festgesetzt
      this.boss = null;
      this.won = false; this.over = false; this.endT = 0;
      this.hurtFlash = 0;
      this.spawns = level.spawns.slice().sort((a, b) => a.x - b.x);
      for (const s of this.spawns) if (s.ch === 'X') this.checks.push({ x: s.x, y: s.y - 60, on: false, t: 0 });
      this.spawns = this.spawns.filter(s => s.ch !== 'X');
      this.gates = this.spawns.filter(s => s.ch === '|').map(s => this.makeGate(s));
      this.spawns = this.spawns.filter(s => s.ch !== '|');
      this.respawn = { x: level.start.x, y: level.start.y - P.h / 2 };
      this.player = this.makePlayer(this.respawn.x, this.respawn.y);
      // Übernahme aus dem vorigen Level
      const c = opts.carry;
      if (c) {
        Object.assign(this, { score: c.score, coins: c.coins, lives: c.lives, kills: c.kills, bestCombo: c.bestCombo,
          time: c.time });
        Object.assign(this.player, { weapon: c.weapon, ammo: c.ammo, grenades: c.grenades, hp: Math.max(c.hp, 60) });
      }
      this.startTime = this.time;
      this.ease = 0;                // 1 = ganz zu Beginn von Level 1, 0 = volle Härte
      this.say(level.def.name, '#ffb14a', 3, false, 'STAGE ' + (level.index + 1) + '  -  ' + level.def.sub);
      this.cam = { x: 0, y: level.ph - H };
      this.cam.x = clamp(this.player.x - W * 0.35, 0, level.pw - W);
      // Glutnester am Wrack der Absturzstelle
      this.wreck = level.theme.wreck ? { x: level.start.x + 90, y: level.start.y } : null;
      if (opts.at) this.skipTo(opts.at);
    }

    // Was ins nächste Level mitgenommen wird
    carry() {
      const p = this.player;
      return { score: this.score, coins: this.coins, lives: this.lives, kills: this.kills, bestCombo: this.bestCombo,
        time: this.time, weapon: p.weapon, ammo: Object.assign({}, p.ammo), grenades: p.grenades, hp: p.hp };
    }

    // Lasertor: Strahl von der Decke bis zum Boden, schaltet im Takt an und aus (mit Flackern vorher)
    makeGate(s) {
      const T = this.L.T, tx = Math.floor(s.x / T);
      let y0 = Math.round(s.y / T) - 1, y1 = y0;
      while (y0 > 0 && !this.L.SOLID[this.tileAt(tx, y0 - 1)]) y0--;
      while (y1 < this.L.h - 1 && !this.L.SOLID[this.tileAt(tx, y1 + 1)]) y1++;
      return { x: s.x, y0: y0 * T, y1: (y1 + 1) * T, t: (tx * 0.37) % 3, on: false, warn: false };
    }

    updateGates(dt) {
      const p = this.player;
      for (const g of this.gates) {
        g.t = (g.t + dt) % 3;
        const was = g.on;
        g.on = g.t < 1.4;
        g.warn = !g.on && g.t > 2.4;
        if (g.on && !was && Math.abs(g.x - this.cam.x - W / 2) < W) this.audio.gate && this.audio.gate();
        if (g.on && !p.dead && Math.abs(p.x - g.x) < p.w / 2 + 10 && p.y + p.h / 2 > g.y0 && p.y - p.h / 2 < g.y1) {
          this.hurtPlayer(20, Math.sign(p.x - g.x) || -1);
        }
        if (g.on && Math.random() < 0.15) this.part({ x: g.x + rnd(-6, 6), y: g.y1 - 4, vx: rnd(-200, 200), vy: rnd(-300, -100),
          g: 1200, life: rnd(0.2, 0.4), size: 2, color: '#ff6ae0', kind: 'spark' });
      }
    }

    makePlayer(x, y) {
      return { x, y, w: P.w, h: P.h, vx: 0, vy: 0, face: 1, onGround: false, coyote: 0, jumpBuf: 0,
        jets: 1, fuel: 1, hovering: false, dashT: 0, dashCd: 0, airDash: true, inv: 2, hp: P.hp,
        aim: 0, crouch: false, fireCd: 0, weapon: 'blaster', ammo: { blaster: Infinity }, grenades: 3,
        walk: 0, recoil: 0, dead: false, deadT: 0, spin: 0, spinV: 0, fell: false, bounced: false,
        land: 0, stepT: 0, drop: 0, fired: 0,
        muzzle: { x, y }, afterimages: [] };
    }

    // Test-Schalter ?at=<Spalte>: direkt weiter hinten starten
    skipTo(col) {
      const T = this.L.T, x = col * T + T / 2;
      let ty = this.L.h - 1;
      while (ty > 3 && (this.L.SOLID[this.tileAt(col, ty)] || this.L.SOLID[this.tileAt(col, ty - 1)] || this.L.SOLID[this.tileAt(col, ty - 2)])) ty--;
      const y = (ty + 1) * T - P.h / 2 - 1;
      this.player.x = x; this.player.y = y;
      this.respawn = { x, y };
      this.spawns = this.spawns.filter(s => s.x > x + 400 || s.ch === 'Z');
      this.cam.x = clamp(x - W * 0.35, 0, this.L.pw - W);
    }

    // ---------- Kacheln ----------

    tileAt(tx, ty) {
      const L = this.L;
      if (tx < 0 || tx >= L.w) return 2;
      if (ty < 0 || ty >= L.h) return 0;
      return L.tiles[ty * L.w + tx];
    }
    solidAt(px, py) {
      const t = this.tileAt(Math.floor(px / this.L.T), Math.floor(py / this.L.T));
      return this.L.SOLID[t];
    }

    // Bewegt einen Akteur achsenweise gegen die Kacheln. Liefert {wall, ground, ceil, acid}
    move(a, dt, opts = {}) {
      const L = this.L, T = L.T, res = { wall: 0, ground: false, ceil: false, acid: false };
      const hw = a.w / 2, hh = a.h / 2;
      a.x += a.vx * dt;
      if (this.lock && a === this.player) a.x = Math.max(a.x, L.arena.x + hw + 4);
      {
        const y0 = Math.floor((a.y - hh + 1) / T), y1 = Math.floor((a.y + hh - 1) / T);
        if (a.vx > 0) {
          const tx = Math.floor((a.x + hw) / T);
          for (let ty = y0; ty <= y1; ty++) if (L.SOLID[this.tileAt(tx, ty)]) { a.x = tx * T - hw - 0.01; res.wall = 1; break; }
        } else if (a.vx < 0) {
          const tx = Math.floor((a.x - hw) / T);
          for (let ty = y0; ty <= y1; ty++) if (L.SOLID[this.tileAt(tx, ty)]) { a.x = (tx + 1) * T + hw + 0.01; res.wall = -1; break; }
        }
      }
      const prevBottom = a.y + hh;
      a.y += a.vy * dt;
      {
        const x0 = Math.floor((a.x - hw + 1) / T), x1 = Math.floor((a.x + hw - 1) / T);
        if (a.vy > 0) {
          const ty = Math.floor((a.y + hh) / T);
          for (let tx = x0; tx <= x1; tx++) {
            const t = this.tileAt(tx, ty);
            const oneway = t === 3 && !opts.noOneway && prevBottom <= ty * T + 0.5 && !(a.drop > 0);
            if (L.SOLID[t] || oneway) { a.y = ty * T - hh - 0.01; res.ground = true; break; }
          }
        } else if (a.vy < 0) {
          const ty = Math.floor((a.y - hh) / T);
          for (let tx = x0; tx <= x1; tx++) if (L.SOLID[this.tileAt(tx, ty)]) { a.y = (ty + 1) * T + hh + 0.01; res.ceil = true; break; }
        }
        // Säure und Wasser: Kacheln unter den Füßen beziehungsweise auf Hüfthöhe
        const fy = Math.floor((a.y + hh - 6) / T);
        const my = Math.floor(a.y / T);
        for (let tx = x0; tx <= x1; tx++) {
          if (this.tileAt(tx, fy) === 4) res.acid = true;
          if (this.tileAt(tx, fy) === 7 || this.tileAt(tx, my) === 7) res.water = true;
        }
      }
      return res;
    }

    // Oberkante des Bodens unter x, ausgehend von y nach unten gesucht
    surfaceY(x, y) {
      const T = this.L.T, tx = Math.floor(x / T);
      let ty = Math.max(0, Math.floor(y / T));
      while (ty < this.L.h && !this.L.SOLID[this.tileAt(tx, ty)]) ty++;
      return ty * T;
    }

    groundAhead(a, dir) {
      const T = this.L.T;
      const fx = a.x + dir * (a.w / 2 + 4), fy = a.y + a.h / 2 + 4;
      const t = this.tileAt(Math.floor(fx / T), Math.floor(fy / T));
      return this.L.SOLID[t] || t === 3;
    }

    // ---------- Hauptschleife ----------

    update(dt, input) {
      dt = Math.min(dt, 0.05);
      this.time += dt;
      // Zeitlupe (Boss-Tod, letzter Treffer) läuft in Echtzeit ab
      if (this.slowT > 0) { this.slowT -= dt; if (this.slowT <= 0) this.slow = 1; }
      this.audio.slowmo && this.audio.src && this.audio.slowmo(this.slow < 1 ? 0.8 : 1);
      this.flash = Math.max(0, this.flash - dt * 3);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
      if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.dur) this.banner = null; }
      this.keep = Object.assign(this.keep || {}, input.pressed);
      if (this.hitstop > 0) { this.hitstop -= dt; this.shake = Math.max(0, this.shake - dt * 1.5); return; }
      this.acc += dt * this.slow;
      let n = 0;
      while (this.acc >= STEP && n < 12) {
        input.pressed = this.keep; this.keep = {};
        this.step(STEP, input); this.acc -= STEP; n++;
      }
      this.updateCamera(dt);
      this.shake = Math.max(0, this.shake - dt * 1.6);
      if (this.won || this.over) this.endT += dt;
    }

    step(dt, input) {
      this.beam = null;
      // Die erste Minute von Level 1 ist zum Warmwerden: Gegner feuern seltener und schwächer
      this.ease = this.L.index === 0 ? clamp(1 - this.time / 60, 0, 1) : 0;
      this.updatePlayer(dt, input);
      this.spawnAhead();
      this.updateWaves(dt);
      this.updateGates(dt);
      for (const e of this.enemies) this.updateEnemy(e, dt);
      this.enemies = this.enemies.filter(e => !e.dead && e.x > this.cam.x - 1400);
      this.updateBullets(dt);
      this.updateEnemyBullets(dt);
      this.updateClouds(dt);
      this.updateBossFx(dt);
      this.updatePickups(dt);
      this.updateParts(dt);
      for (let i = this.pending.length - 1; i >= 0; i--) {
        const p = this.pending[i];
        if ((p.t -= dt) <= 0) { this.pending.splice(i, 1); p.fn(); }
      }
      for (const c of this.checks) {
        c.t += dt;
        if (!c.on && this.player.x > c.x - 20 && !this.player.dead) {
          c.on = true;
          this.respawn = { x: c.x, y: c.y };
          this.audio.checkpoint();
          this.say('CHECKPOINT', '#6affc8');
          this.burst(c.x, c.y - 40, 40, { color: '#6affc8', speed: 500, life: 0.7, size: 3 });
          this.ring(c.x, c.y, 220, '#6affc8');
          if (this.player.hp < P.hp) this.player.hp = Math.min(P.hp, this.player.hp + 30);
        }
      }
      if (this.wreck && Math.abs(this.wreck.x - this.cam.x - W / 2) < W && Math.random() < 0.35) {
        const x = this.wreck.x + rnd(40, 520), y = this.wreck.y - rnd(60, 200);
        this.part({ x, y, vx: rnd(-20, 20), vy: rnd(-120, -60), life: rnd(0.3, 0.7), size: rnd(10, 22), color: '#ff8a2a', kind: 'fire' });
        if (Math.random() < 0.5) this.part({ x, y: y - 30, vx: rnd(10, 40), vy: rnd(-90, -40), drag: 0.3, life: rnd(1.5, 3),
          size: rnd(20, 40), color: '#2a2428', kind: 'smoke' });
        if (Math.random() < 0.3) this.part({ x, y, vx: rnd(-60, 60), vy: rnd(-260, -120), g: -20, life: rnd(1, 2), size: 2,
          color: '#ffb46a', kind: 'spark' });
      }
      if (this.comboT > 0 && (this.comboT -= dt) <= 0) this.combo = 0;
      for (const f of this.floaters) { f.t += dt; f.y -= 60 * dt; }
      this.floaters = this.floaters.filter(f => f.t < f.dur);
      for (const d of this.decals) d.t += dt;
      if (this.decals.length > 120) this.decals.splice(0, this.decals.length - 120);
    }

    updateCamera(dt) {
      const p = this.player, L = this.L;
      let tx, ty;
      if (this.lock) {
        tx = L.arena.x;
        ty = L.ph - H;
      } else {
        const look = Math.cos(p.aim) * 240;
        tx = clamp(p.x - W / 2 + look, 0, L.pw - W);
        ty = clamp(p.y - H * 0.58, 0, L.ph - H);
      }
      const k = 1 - Math.pow(0.0015, dt);
      this.cam.x = lerp(this.cam.x, tx, k);
      this.cam.y = lerp(this.cam.y, ty, k);
      if (!this.lock && L.arena && this.boss && !this.boss.dead) this.cam.x = Math.min(this.cam.x, L.arena.x);
    }

    // ---------- Held ----------

    updatePlayer(dt, input) {
      const p = this.player;
      if (p.dead) {
        // Sterben: taumeln, aufschlagen, in die Seitenlage kippen und liegen bleiben
        p.deadT += dt;
        p.vy = Math.min(P.fall, p.vy + P.grav * dt);
        const lie = -p.face * Math.PI * 0.46;          // Endlage: flach auf dem Rücken
        const r = this.move(p, dt);
        if (!p.fell) {
          p.spin += p.spinV * dt;
          p.spinV += (lie - p.spin) * 2 * dt;          // das Taumeln zieht schon zur Endlage
          p.spin = clamp(p.spin, Math.min(lie, 0) - 0.15, Math.max(lie, 0) + 0.15);   // nie über die Endlage hinaus
          if (r.ground) {
            if (p.vy > 700 && !p.bounced) {            // einmal aufprallen
              p.bounced = true;
              p.vy = -p.vy * 0.28; p.vx *= 0.6;
              this.dust(p.x, p.y + p.h / 2, 10);
              this.audio.land(0.4);
            } else {
              p.fell = true; p.spinV = 0; p.vy = 0;
              this.dust(p.x, p.y + p.h / 2, 16);
              this.audio.land(0.7);
              this.shake = Math.max(this.shake, 0.3);
              this.rumble(0.5, 0.4, 200);
              for (let i = 0; i < 10; i++) this.part({ x: p.x + rnd(-30, 30), y: p.y + p.h / 2 - 10, vx: rnd(-200, 200),
                vy: rnd(-260, -60), g: 1400, life: rnd(0.3, 0.7), size: rnd(2, 4), color: '#ffd27a', kind: 'spark' });
            }
          }
        } else {
          // liegt: rutscht aus und raucht
          p.spin += (lie - p.spin) * (1 - Math.pow(0.002, dt));
          p.vx *= Math.pow(0.02, dt);
          p.vy = 0;
          if (Math.random() < 0.25) this.part({ x: p.x + rnd(-24, 24), y: p.y + p.h / 2 - 20, vx: rnd(-20, 20),
            vy: rnd(-90, -40), drag: 0.6, life: rnd(0.8, 1.6), size: rnd(12, 24), color: '#3a3438', kind: 'smoke' });
          if (Math.random() < 0.06) this.part({ x: p.x + rnd(-20, 20), y: p.y + p.h / 2 - 24, vx: rnd(-60, 60),
            vy: rnd(-160, -60), g: 900, life: rnd(0.2, 0.5), size: 2, color: '#ffb46a', kind: 'spark' });
        }
        if (p.deadT > 2.2) {
          if (this.lives < 0) { this.over = true; return; }
          const np = this.makePlayer(this.respawn.x, this.respawn.y);
          np.weapon = p.weapon; np.ammo = p.ammo; np.grenades = Math.max(3, p.grenades);
          this.player = np;
          this.audio.muffle(false);
          this.burst(np.x, np.y, 50, { color: '#6ad8ff', speed: 600, life: 0.6, size: 3 });
          this.ring(np.x, np.y, 180, '#6ad8ff');
        }
        return;
      }
      p.inv = Math.max(0, p.inv - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.fireCd = Math.max(0, p.fireCd - dt);
      p.recoil = Math.max(0, p.recoil - dt * 8);
      p.drop = Math.max(0, p.drop - dt);
      p.land = Math.max(0, p.land - dt * 4);
      p.fired = Math.max(0, p.fired - dt);
      const pr = input.pressed || {};

      // Zielen: Maus/Stick als Richtung, sonst 8 Richtungen aus den Pfeiltasten
      const sx = p.x + P.shoulder.x * p.face, sy = p.y + P.shoulder.y + (p.crouch ? 26 : 0);
      const mv = clamp(input.moveX ?? ((input.right ? 1 : 0) - (input.left ? 1 : 0)), -1, 1);
      if (input.aimPoint) {
        p.aim = Math.atan2(input.aimPoint.y + this.cam.y - sy, input.aimPoint.x + this.cam.x - sx);
        p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
      } else if (input.aimVec) {
        // Stick: weich nachziehen, damit das Zielen nicht zappelt
        p.aim = turn(p.aim, Math.atan2(input.aimVec.y, input.aimVec.x), 1 - Math.pow(0.00002, dt));
        p.face = Math.cos(p.aim) >= 0 ? 1 : -1;
      } else if (input.aimHold) {
        // Stick losgelassen: die Richtung bleibt, beim Umdrehen wird sie gespiegelt
        if (mv > 0.25 && p.face < 0) { p.aim = Math.PI - p.aim; p.face = 1; }
        else if (mv < -0.25 && p.face > 0) { p.aim = Math.PI - p.aim; p.face = -1; }
      } else {
        if (input.left) p.face = -1; else if (input.right) p.face = 1;
        const moving = input.left || input.right;
        const ay = input.up ? -1 : (input.down && !p.onGround ? 1 : 0);
        if (!ay) p.aim = p.face > 0 ? 0 : Math.PI;
        else if (moving) p.aim = Math.atan2(ay, p.face);
        else p.aim = Math.atan2(ay, p.face * 0.001);          // senkrecht, Blickrichtung bleibt
      }

      // Ducken (nur am Boden), durch Plattformen fallen mit unten + Sprung
      const wantCrouch = input.down && p.onGround && !input.aimVec;
      if (wantCrouch && pr.jump && this.onOneway(p)) { p.drop = 0.25; p.onGround = false; p.y += 2; pr.jump = false; }
      if (wantCrouch !== p.crouch) {
        const nh = wantCrouch ? P.hc : P.h;
        if (!wantCrouch && this.blockedAbove(p, P.h)) { /* bleibt geduckt */ } else {
          p.y += (p.h - nh) / 2; p.h = nh; p.crouch = wantCrouch;
        }
      }

      // Dash
      if (pr.dash && p.dashCd <= 0 && !p.wet && (p.onGround || p.airDash)) {
        const dir = input.left ? -1 : input.right ? 1 : p.face;
        p.dashT = P.dashT; p.dashCd = P.dashCd; p.dashDir = dir;
        if (!p.onGround) p.airDash = false;
        p.inv = Math.max(p.inv, P.dashT + 0.08);
        this.audio.dash();
        this.shake = Math.max(this.shake, 0.15);
        for (let i = 0; i < 16; i++) this.part({ x: p.x, y: p.y + rnd(-50, 50), vx: -dir * rnd(200, 600), vy: rnd(-60, 60),
          life: rnd(0.2, 0.4), size: rnd(2, 4), color: '#8fe8ff', kind: 'spark' });
      }
      if (p.dashT > 0) {
        p.dashT -= dt;
        p.vx = p.dashDir * P.dash;
        p.vy = Math.min(p.vy, 0) * 0.5;
        p.afterimages.push({ x: p.x, y: p.y, face: p.face, aim: p.aim, walk: p.walk, crouch: p.crouch, t: 0 });
      } else {
        const target = (p.crouch ? 0 : mv * P.run) * (p.wet ? 0.6 : 1);
        const acc = p.onGround ? P.accG : P.accA;
        if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
        else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
      }
      for (const a of p.afterimages) a.t += dt;
      p.afterimages = p.afterimages.filter(a => a.t < 0.25);

      // Springen: Puffer, Coyote-Zeit, Jetpack-Doppelsprung, Schweben mit gehaltener Taste
      if (pr.jump) p.jumpBuf = 0.12;
      p.jumpBuf = Math.max(0, p.jumpBuf - dt);
      p.coyote = p.onGround ? 0.1 : Math.max(0, p.coyote - dt);
      if (p.jumpBuf > 0 && p.coyote > 0) {
        p.vy = -P.jump * (p.wet ? 0.85 : 1); p.jumpBuf = 0; p.coyote = 0; p.onGround = false;
        this.audio.jump(false);
        this.dust(p.x, p.y + p.h / 2, 10);
      } else if (p.jumpBuf > 0 && p.jets > 0 && !p.onGround) {
        p.vy = -P.jet; p.jets--; p.jumpBuf = 0;
        this.audio.jump(true);
        this.rumble(0.3, 0.2, 120);
        this.jetFx(p, 26, 1.3);
        this.ring(p.x - p.face * 20, p.y + 20, 90, '#ffb14a');
      }
      p.boostT = Math.max(0, (p.boostT || 0) - dt);
      if (!input.jump && p.vy < -500 && p.boostT <= 0) p.vy = Math.max(p.vy, -500);      // kurzer Sprung bei kurzem Druck
      p.hovering = input.jump && !p.onGround && p.vy > 0 && p.fuel > 0 && p.jets === 0;
      if (p.hovering) {
        p.vy = Math.min(p.vy, P.hover);
        p.fuel = Math.max(0, p.fuel - P.fuelUse * dt);
        if (Math.random() < 0.7) this.jetFx(p, 1, 0.8);
        this.audio.jet();
      }
      if (p.dashT <= 0) p.vy = Math.min(P.fall, p.vy + P.grav * dt);

      const wasGround = p.onGround, vyBefore = p.vy;
      const r = this.move(p, dt);
      // Waten: langsamer, träger Sprung, kein Dash, dafür sanfteres Fallen
      const wasWet = p.wet;
      p.wet = r.water;
      if (p.wet) {
        p.vx *= Math.pow(0.35, dt);
        if (p.vy > 420) p.vy = 420;
        if (Math.random() < 0.3) this.part({ x: p.x + rnd(-24, 24), y: p.y + p.h / 2 - rnd(0, 30), vx: rnd(-60, 60),
          vy: rnd(-120, -30), g: 900, life: rnd(0.2, 0.5), size: rnd(3, 7), color: '#9ee8c0', kind: 'goo' });
      }
      if (p.wet !== wasWet) {                       // Platschen beim Ein- und Austauchen
        this.audio.land(0.3);
        for (let i = 0; i < 16; i++) this.part({ x: p.x + rnd(-30, 30), y: p.y + p.h / 2 - 10, vx: rnd(-260, 260),
          vy: rnd(-420, -120), g: 1300, life: rnd(0.3, 0.7), size: rnd(3, 8), color: '#9ee8c0', kind: 'goo' });
      }
      if (r.ceil && p.vy < 0) p.vy = 0;
      p.onGround = r.ground;
      if (r.ground) {
        p.vy = 0; p.jets = 1; p.airDash = true;
        p.fuel = Math.min(1, p.fuel + P.fuelRegen * dt);
        if (!wasGround && vyBefore > 500) {
          const h = clamp((vyBefore - 500) / 1000, 0, 1);
          p.land = 0.4 + h * 0.6;
          this.audio.land(h);
          this.dust(p.x, p.y + p.h / 2, 8 + h * 16);
          if (h > 0.5) { this.shake = Math.max(this.shake, 0.25); this.rumble(0.4, 0.3, 100); }
        }
      }
      if (r.acid) {
        this.hurtPlayer((this.L.theme.acid && this.L.theme.acid.dmg) || 15, 0);
        if (!p.dead) { p.vy = -1300; p.jets = 1; p.boostT = 0.4; }
        for (let i = 0; i < 20; i++) this.part({ x: p.x + rnd(-30, 30), y: p.y + p.h / 2, vx: rnd(-200, 200), vy: rnd(-700, -200),
          g: 1800, life: rnd(0.4, 0.8), size: rnd(4, 9), color: '#8dff3a', kind: 'goo' });
      }
      if (p.y > this.L.ph + 200) { p.hp = 0; this.killPlayer(); }

      // Laufanimation
      if (p.onGround && Math.abs(p.vx) > 40) {
        p.walk += dt * Math.abs(p.vx) / 52 * (p.vx * p.face >= 0 ? 1 : -1);
        p.stepT -= dt * Math.abs(p.vx) / P.run;
        if (p.stepT <= 0) { p.stepT = 0.31; this.audio.step(); if (Math.random() < 0.6) this.dust(p.x - p.face * 10, p.y + p.h / 2, 2); }
      } else if (p.onGround) {
        p.walk = lerp(p.walk, Math.round(p.walk / Math.PI) * Math.PI, 1 - Math.pow(0.001, dt));
      }

      // Schulter und Mündung für Waffen und Darstellung
      const sx2 = p.x + P.shoulder.x * p.face, sy2 = p.y + P.shoulder.y + (p.crouch ? 26 : 0);
      const back = p.recoil * 10;
      p.muzzle = { x: sx2 + Math.cos(p.aim) * (P.arm - back), y: sy2 + Math.sin(p.aim) * (P.arm - back) };

      this.updateWeapon(p, dt, input, pr);
    }

    onOneway(p) {
      const T = this.L.T, ty = Math.floor((p.y + p.h / 2 + 2) / T);
      return this.tileAt(Math.floor(p.x / T), ty) === 3;
    }
    blockedAbove(p, nh) {
      const top = p.y + p.h / 2 - nh;
      return this.solidAt(p.x - p.w / 2 + 2, top) || this.solidAt(p.x + p.w / 2 - 2, top);
    }

    jetFx(p, n, power) {
      const bx = p.x - p.face * 30, by = p.y - 10;
      for (let i = 0; i < n; i++) {
        this.part({ x: bx + rnd(-6, 6), y: by, vx: rnd(-80, 80) - p.face * 60, vy: rnd(300, 700) * power,
          life: rnd(0.15, 0.35), size: rnd(8, 16), color: '#ffb14a', kind: 'fire' });
        if (Math.random() < 0.4) this.part({ x: bx, y: by + 20, vx: rnd(-60, 60), vy: rnd(100, 300), life: rnd(0.5, 1),
          size: rnd(10, 22), color: '#555', kind: 'smoke' });
      }
    }

    updateWeapon(p, dt, input, pr) {
      if (pr.next || pr.prev) {
        const have = ORDER.filter(w => p.ammo[w] > 0);
        const i = have.indexOf(p.weapon);
        p.weapon = have[(i + (pr.next ? 1 : have.length - 1)) % have.length];
        this.audio.weaponSwitch();
      }
      if (pr.slot && p.ammo[pr.slot] > 0 && p.weapon !== pr.slot) { p.weapon = pr.slot; this.audio.weaponSwitch(); }
      if (pr.grenade && p.grenades > 0) {
        p.grenades--;
        const a = p.aim - 0.35 * p.face * (Math.abs(Math.cos(p.aim)) > 0.3 ? 1 : 0);
        this.bullets.push({ kind: 'grenade', x: p.muzzle.x, y: p.muzzle.y, vx: Math.cos(a) * 950 + p.vx * 0.4,
          vy: Math.sin(a) * 950 - 150, r: 12, dmg: 0, life: 1.4, spin: 0 });
        this.audio.shot('grenade');
      } else if (pr.grenade) this.audio.empty();

      const wp = WEAPONS[p.weapon];
      if (p.weapon === 'laser') {
        if (input.fire && p.ammo.laser > 0) {
          p.ammo.laser -= wp.drain * dt;
          this.fireLaser(p, dt);
          this.audio.laser(true);
          p.recoil = Math.min(1, p.recoil + dt * 6);
          this.shake = Math.max(this.shake, 0.12);
          if (p.ammo.laser <= 0) this.outOfAmmo(p);
        } else this.audio.laser(false);
        return;
      }
      this.audio.laser(false);
      if (!input.fire || p.fireCd > 0) return;
      p.fireCd = wp.rate;
      p.fired = 0.06;
      const mx = p.muzzle.x, my = p.muzzle.y, a = p.aim;
      if (p.weapon === 'blaster') {
        const s = a + rnd(-0.03, 0.03);
        this.bullets.push({ kind: 'bolt', x: mx, y: my, vx: Math.cos(s) * 2100, vy: Math.sin(s) * 2100, r: 10, dmg: 11, life: 0.8 });
        p.recoil = 1;
        this.shake = Math.max(this.shake, 0.1);
      } else if (p.weapon === 'spread') {
        for (let k = -3; k <= 3; k++) {
          const s = a + k * 0.09 + rnd(-0.02, 0.02);
          this.bullets.push({ kind: 'spread', x: mx, y: my, vx: Math.cos(s) * 1700, vy: Math.sin(s) * 1700, r: 11, dmg: 9, life: 0.45 });
        }
        p.recoil = 1.6;
        p.vx -= Math.cos(a) * 60;
        this.shake = Math.max(this.shake, 0.22);
        this.rumble(0.3, 0.4, 70);
      } else if (p.weapon === 'rocket') {
        for (const k of [-1, 1]) {
          const s = a + k * 0.25;
          this.bullets.push({ kind: 'rocket', x: mx, y: my, vx: Math.cos(s) * 700, vy: Math.sin(s) * 700, r: 12, dmg: 30,
            life: 2.2, age: 0, ang: s });
        }
        p.recoil = 1.8;
        this.shake = Math.max(this.shake, 0.2);
        this.rumble(0.4, 0.3, 90);
      }
      this.audio.shot(p.weapon);
      // Mündungsfeuer und Hülsen
      this.part({ x: mx, y: my, vx: 0, vy: 0, life: 0.06, size: p.weapon === 'blaster' ? 60 : 90, color: wp.color, kind: 'flash' });
      for (let i = 0; i < 4; i++) {
        const s = a + rnd(-0.5, 0.5);
        this.part({ x: mx, y: my, vx: Math.cos(s) * rnd(300, 800) + p.vx, vy: Math.sin(s) * rnd(300, 800), life: rnd(0.08, 0.18),
          size: rnd(2, 3), color: wp.color, kind: 'spark' });
      }
      if (p.weapon !== 'rocket') {
        const sx = p.x + P.shoulder.x * p.face + Math.cos(a) * 60, sy = p.y + P.shoulder.y + Math.sin(a) * 60;
        this.part({ x: sx, y: sy, vx: -p.face * rnd(100, 250), vy: rnd(-500, -300), g: 2400, life: 1.2, size: 5,
          color: '#e8b94a', kind: 'casing', rot: rnd(0, TAU), vr: rnd(-20, 20), bounce: true });
      }
      if (p.ammo[p.weapon] !== Infinity && --p.ammo[p.weapon] <= 0) this.outOfAmmo(p);
    }

    outOfAmmo(p) {
      delete p.ammo[p.weapon];
      p.weapon = 'blaster';
      this.audio.laser(false);
      this.audio.weaponSwitch();
      this.float(p.x, p.y - 110, 'OUT OF AMMO', '#ff8a6a');
    }

    fireLaser(p, dt) {
      const a = p.aim, dx = Math.cos(a), dy = Math.sin(a);
      let len = 1500;
      for (let d = 0; d < 1500; d += 12) {
        const x = p.muzzle.x + dx * d, y = p.muzzle.y + dy * d;
        if (this.solidAt(x, y)) { len = d; this.damageTileAt(x, y, 120 * dt); break; }
      }
      const x0 = p.muzzle.x, y0 = p.muzzle.y, x1 = x0 + dx * len, y1 = y0 + dy * len;
      this.beam = { x0, y0, x1, y1, t: this.time };
      const dps = 190;
      for (const e of this.enemies) {
        if (e.dead || e.intro) continue;
        let hx, hy;
        if (e.hitCircles) {
          let best = null, bd = 1e9;
          for (const c of e.hitCircles) {
            const t = clamp((c.x - x0) * dx + (c.y - y0) * dy, 0, len);
            const d = Math.hypot(x0 + dx * t - c.x, y0 + dy * t - c.y);
            if (d < c.r && t < bd) { bd = t; best = { x: x0 + dx * t, y: y0 + dy * t }; }
          }
          if (!best) continue;
          hx = best.x; hy = best.y;
        } else {
          const hb = this.hitbox(e);
          if (!segBox(x0, y0, x1, y1, hb)) continue;
          const cx = clamp(e.x, hb.x0, hb.x1);
          const t = clamp(((cx - x0) * dx + (e.y - y0) * dy), 0, len);
          hx = x0 + dx * t; hy = y0 + dy * t;
        }
        {
          this.damageEnemy(e, dps * dt, hx, hy, dx, dy, true);
          if (Math.random() < 0.5) this.part({ x: hx, y: hy, vx: rnd(-400, 400) - dx * 300, vy: rnd(-400, 400) - dy * 300,
            life: rnd(0.1, 0.3), size: rnd(2, 4), color: '#ff9af0', kind: 'spark' });
        }
      }
      if (Math.random() < 0.8) this.part({ x: x1, y: y1, vx: rnd(-500, 500), vy: rnd(-500, 100), g: 1500, life: rnd(0.1, 0.3),
        size: rnd(2, 4), color: '#ffd0f8', kind: 'spark' });
    }

    hurtPlayer(dmg, dir) {
      const p = this.player;
      if (p.dead || p.inv > 0 || this.opts.god || this.won) return;
      p.hp -= dmg;
      p.inv = P.inv;
      this.hurtFlash = 1;
      this.shake = Math.max(this.shake, 0.45);
      this.hitstop = 0.05;
      this.rumble(0.7, 0.9, 200);
      this.combo = 0;
      if (dir) { p.vx = dir * 520; p.vy = -520; p.onGround = false; }
      this.burst(p.x, p.y, 16, { color: '#ffd27a', speed: 500, life: 0.4, size: 3 });
      if (p.hp <= 0) this.killPlayer();
      else this.audio.hurt();
    }

    killPlayer() {
      const p = this.player;
      if (p.dead) return;
      p.dead = true; p.deadT = 0; p.hp = 0;
      p.vy = -900; p.vx = -p.face * 420;
      p.spinV = -p.face * rnd(2.5, 4);              // Taumeln in Stoßrichtung
      p.crouch = false; p.h = P.h;
      this.lives--;
      this.audio.laser(false);
      this.audio.die();
      this.audio.muffle(true);
      this.explode(p.x, p.y, 120, 0, { fx: 2, noDamage: true });
      this.slow = 0.35; this.slowT = 0.8;
      this.rumble(1, 1, 500);
      this.combo = 0;
    }

    // ---------- Gegner ----------

    spawnAhead() {
      const edge = this.cam.x + W + 260;
      while (this.spawnIdx < this.spawns.length && this.spawns[this.spawnIdx].x < edge) {
        const s = this.spawns[this.spawnIdx++];
        this.spawnFrom(s);
      }
      // Boss sobald der Held die Arena betritt
      const A = this.L.arena;
      if (A && !this.boss && this.player.x > A.x + 5 * this.L.T) this.startBoss();
    }

    spawnFrom(s) {
      const T = this.L.T;
      switch (s.ch) {
        case 'c': this.addEnemy('crawler', s.x, s.y - 29); break;
        case 'd': this.addEnemy('drone', s.x, s.y - 40); break;
        case 'j': this.addEnemy('jelly', s.x, s.y - 60); break;
        case 't': this.addEnemy('turret', s.x, s.y - 42); break;
        case 'T': this.addEnemy('turret', s.x, s.y - T + 42, { ceil: true }); break;
        case 'b': this.addEnemy('brute', s.x, s.y - 110); break;
        case 'p': this.addEnemy('pod', s.x, s.y - 52); break;
        case 's': this.addEnemy('spitter', s.x, s.y - 45); break;
        case 'v': this.addEnemy('bat', s.x, s.y - 40); break;
        case 'u': this.addEnemy('saucer', s.x, s.y - 40); break;
        case 'n': this.addEnemy('sentinel', s.x, s.y - 90); break;
        case 'W': this.addEnemy('sandworm', s.x, s.y - 85, { hidden: true }); break;
        case 'k': this.addEnemy('skimmer', s.x, s.y - 250); break;
        case 'h': this.addEnemy('thorn', s.x, s.y - 75); break;
        case 'm': this.addEnemy('mortar', s.x, s.y - 75); break;
        case 'l': this.addEnemy('leech', s.x, s.y - 35); break;
        case 'f': this.addEnemy('stingfly', s.x, s.y - 260); break;
        case 'o': this.addEnemy('sporepod', s.x, s.y - 75); break;
        case 'U': this.addEnemy('mudhulk', s.x, s.y - 80); break;
        case '$': this.pickups.push({ type: 'coin', x: s.x, y: s.y - T / 2, vx: 0, vy: 0, fixed: true, t: rnd(0, 6) }); break;
        case 'H': case 'G': case 'S': case 'L': case 'R': case 'A':
          this.pickups.push({ type: s.ch, x: s.x, y: s.y - 40, vx: 0, vy: 0, fixed: true, t: 0 }); break;
        case '>': this.pads = this.pads || []; this.pads.push({ x: s.x, y: s.y, t: 0 }); break;
      }
    }

    addEnemy(type, x, y, extra = {}) {
      const d = EN[type];
      const e = Object.assign({ type, x, y, w: d.w, h: d.h, vx: 0, vy: 0, hp: d.hp, maxHp: d.hp, face: -1, t: rnd(0, 3),
        cd: rnd(0.8, 1.8), flash: 0, dead: false, home: { x, y }, state: 'idle', walk: 0 }, extra);
      this.enemies.push(e);
      return e;
    }

    // Trifft der Punkt den Gegner? Der Leviathan besteht aus Kreisen statt aus einem Rechteck.
    hitTest(e, x, y, r) {
      if (e.hitCircles) {
        for (const c of e.hitCircles) if (Math.hypot(x - c.x, y - c.y) < c.r + r) return true;
        return false;
      }
      return inBox(x, y, this.hitbox(e), r);
    }

    hitbox(e) {
      if (e.type === 'boss') {
        const b = e.body;
        return { x0: e.x + b.x0, y0: e.y + b.y0, x1: e.x + b.x1, y1: e.y + b.y1 };
      }
      return { x0: e.x - e.w / 2, y0: e.y - e.h / 2, x1: e.x + e.w / 2, y1: e.y + e.h / 2 };
    }

    // Schrittzyklus für Gegner mit echten Beinen: die Füße stehen auf dem Boden,
    // während der Rumpf darüber weiterläuft. Gleiche Rechnung wie beim Boss.
    walkerGait(e, dt) {
      const R = WALKERS[e.type];
      const gy = e.y + e.h / 2;                         // Höhe der Sohlen
      if (!e.gait) e.gait = { walk: rnd(0, 1), dir: 1, feet: R.legs.map(L => ({ x: L.rest, y: R.stand })) };
      const gt = e.gait, sp = e.vx;
      const moving = Math.abs(sp) > 20;
      if (moving) gt.dir = Math.sign(sp) * -e.face;     // Laufrichtung im Rumpfsystem
      const prev = gt.walk;
      gt.walk += moving ? Math.abs(sp) * dt / R.step : dt * 0.3;
      gt.bob = moving ? -Math.abs(Math.sin(gt.walk * TAU)) * R.bob : Math.sin(e.t * 1.8) * R.bob * 0.35;
      gt.hipY = gy - R.stand + gt.bob;
      for (let i = 0; i < R.legs.length; i++) {
        const L = R.legs[i], f = gt.feet[i];
        const ph = ((gt.walk + L.phase) % 1 + 1) % 1;
        const base = R.stand - gt.bob;                  // Boden von der Hüfte aus gesehen
        if (!moving) {
          f.x = lerp(f.x, L.rest, 1 - Math.pow(0.02, dt));
          f.y = base;
        } else if (ph < 0.6) {                          // Standbein: schiebt den Rumpf
          f.x = L.rest + (0.5 - ph / 0.6) * R.step * gt.dir;
          f.y = base;
        } else {                                        // Schwungbein: hebt ab und setzt vorn auf
          const u = (ph - 0.6) / 0.4;
          f.x = L.rest + (-0.5 + u) * R.step * gt.dir;
          f.y = base - Math.sin(u * Math.PI) * R.lift;
        }
      }
      // Tritte: je halbem Zyklus staubt es unter dem Fuß
      const half = Math.floor(gt.walk * 2) !== Math.floor(prev * 2);
      if (half && moving && Math.abs(e.x - this.cam.x - W / 2) < W * 0.6) {
        this.dust(e.x, gy, 3);
        if (Math.abs(e.x - this.player.x) < 900) this.audio.thud();
      }
    }

    updateEnemy(e, dt) {
      e.t += dt;
      const cool = 1 / (1 + 1.2 * this.ease);     // zu Beginn zählen die Feuerpausen langsamer herunter
      e.flash = Math.max(0, e.flash - dt * 6);
      const p = this.player, dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy);
      const alive = !p.dead;
      switch (e.type) {
        case 'crawler': {
          e.vy = Math.min(1600, e.vy + P.grav * dt);
          if (e.onGround) {
            e.leapCd = (e.leapCd || 0) - dt;
            if (alive && Math.abs(dx) < 900 && Math.abs(dy) < 300) e.face = Math.sign(dx) || e.face;
            else if (!this.groundAhead(e, e.face)) e.face = -e.face;
            e.vx = e.face * (alive && Math.abs(dx) < 900 ? 230 - 60 * this.ease : 110);
            if (!this.groundAhead(e, e.face) && Math.abs(dx) > 200) e.vx = 0;
            if (alive && Math.abs(dx) < 340 && Math.abs(dy) < 200 && e.leapCd <= 0 && this.ease < 0.5) {
              e.vy = -950; e.vx = e.face * 560; e.leapCd = rnd(1.2, 2); e.onGround = false;
              this.audio.squish();
            }
          }
          const r = this.move(e, dt);
          if (r.wall) { e.face = -r.wall; }
          e.onGround = r.ground;
          if (r.ground) e.vy = 0;
          e.walk += dt * Math.abs(e.vx) / 18;
          break;
        }
        case 'drone': {
          const side = dx > 0 ? -1 : 1;
          const tx = p.x + side * 440, ty = p.y - 260 + Math.sin(e.t * 1.7) * 50;
          e.vx += clamp(tx - e.x, -400, 400) * 3 * dt; e.vy += clamp(ty - e.y, -400, 400) * 3 * dt;
          e.vx *= Math.pow(0.25, dt); e.vy *= Math.pow(0.25, dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          e.face = dx > 0 ? 1 : -1;
          if (alive && dist < 1150 && (e.cd -= dt * cool) <= 0) {
            e.cd = rnd(1.3, 2.2);
            this.enemyShoot(e.x, e.y + 10, Math.atan2(dy, dx), 560, 'orb');
          }
          break;
        }
        case 'jelly': {
          const tx = p.x + Math.sin(e.t * 0.6) * 200, ty = p.y - 330;
          const pulse = Math.max(0, Math.sin(e.t * 3));
          e.vx += clamp(tx - e.x, -1, 1) * 160 * dt; e.vy += (clamp(ty - e.y, -1, 1) * 120 - pulse * 60) * dt;
          e.vx *= Math.pow(0.4, dt); e.vy *= Math.pow(0.4, dt);
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (alive && dist < 900 && (e.cd -= dt * cool) <= 0) {
            e.cd = rnd(1.8, 2.6);
            for (let k = 0; k < 3; k++) this.pending.push({ t: k * 0.15, fn: () => {
              if (!e.dead) this.ebullets.push({ kind: 'acid', x: e.x + rnd(-20, 20), y: e.y + 40, vx: rnd(-120, 120) + (p.x - e.x) * 0.4,
                vy: rnd(-100, 50), r: 12, dmg: 15, life: 3, g: 1400 });
            } });
            this.audio.squish();
          }
          break;
        }
        case 'turret': {
          e.face = dx > 0 ? 1 : -1;
          const my = e.ceil ? e.y + 20 : e.y - 20;
          e.aim = Math.atan2(p.y - 20 - my, p.x - e.x);
          if (alive && dist < 1150 && (e.cd -= dt * cool) <= 0) {
            e.cd = rnd(1.8, 2.6);
            for (let k = 0; k < 3; k++) this.pending.push({ t: k * 0.13, fn: () => {
              if (e.dead) return;
              const a = Math.atan2(this.player.y - my, this.player.x - e.x);
              const mx = e.x + Math.cos(a) * 50, m2 = my + Math.sin(a) * 50;
              this.enemyShoot(mx, m2, a, 640, 'orb', '#7dff6a');
              this.part({ x: mx, y: m2, life: 0.06, size: 50, color: '#7dff6a', kind: 'flash' });
            } });
          }
          break;
        }
        case 'brute': {
          const want = p.x - Math.sign(dx || 1) * 520;
          e.vx = clamp((want - e.x) * 1.5, -150, 150);
          e.face = dx > 0 ? 1 : -1;
          e.vy = (e.home.y + Math.sin(e.t * 2) * 14 - e.y) * 4;
          this.move(e, dt, { noOneway: true });
          if (alive && dist < 1300 && (e.cd -= dt * cool) <= 0) {
            e.shots = (e.shots || 0) + 1;
            e.cd = rnd(1.6, 2.2);
            const mx = e.x + e.face * 110, my = e.y - 10;
            const a = Math.atan2(p.y - my, p.x - mx);
            if (e.shots % 3 === 0) for (let k = -2; k <= 2; k++) this.enemyShoot(mx, my, a + k * 0.16, 520, 'orb', '#7dff6a');
            else this.enemyShoot(mx, my, a, 560, 'big', '#9dff4a');
            this.part({ x: mx, y: my, life: 0.1, size: 120, color: '#9dff4a', kind: 'flash' });
            e.vx -= e.face * 200;
          }
          if (Math.random() < 0.5) this.part({ x: e.x + rnd(-60, 60), y: e.y + 60, vx: rnd(-30, 30), vy: rnd(150, 300),
            life: rnd(0.15, 0.3), size: rnd(8, 14), color: '#7dff6a', kind: 'fire' });
          break;
        }
        case 'pod': {
          e.pulse = (e.pulse || 0) + dt;
          if (alive && dist < 1000 && (e.cd -= dt) <= 0) {
            const mine = this.enemies.filter(o => o.from === e && !o.dead).length;
            e.cd = rnd(2.8, 3.8);
            if (mine < 3) {
              const c = this.addEnemy('crawler', e.x, e.y - 40, { from: e });
              c.vy = -800; c.vx = Math.sign(dx || 1) * 200; c.face = Math.sign(dx || 1);
              e.pulse = 0;
              this.audio.squish();
              for (let i = 0; i < 14; i++) this.part({ x: e.x, y: e.y - 40, vx: rnd(-300, 300), vy: rnd(-600, -200), g: 1800,
                life: rnd(0.4, 0.8), size: rnd(4, 8), color: '#8dff3a', kind: 'goo' });
            }
          }
          break;
        }
        case 'spitter': {
          // hockt am Boden und bläst Säure im Bogen auf den Helden
          e.vy = Math.min(1600, e.vy + P.grav * dt); e.vx = 0;
          if (this.move(e, dt).ground) e.vy = 0;
          e.face = dx > 0 ? 1 : -1;
          e.charge = Math.max(0, (e.charge || 0) - dt);
          if (alive && dist < 1000 && (e.cd -= dt) <= 0) {
            e.cd = rnd(2, 2.8); e.charge = 0.35;
            const mx = e.x + e.face * 40, my = e.y - 30;
            for (let k = 0; k < 3; k++) {
              const t = 0.8 + k * 0.12, tx = p.x + rnd(-60, 60);
              this.ebullets.push({ kind: 'acid', x: mx, y: my, vx: (tx - mx) / t, vy: (p.y - my - 0.5 * 1400 * t * t) / t,
                r: 13, dmg: 15, life: 3, g: 1400, t: 0 });
            }
            this.audio.squish();
            for (let i = 0; i < 10; i++) this.part({ x: mx, y: my, vx: e.face * rnd(100, 400), vy: rnd(-400, -100), g: 1500,
              life: rnd(0.3, 0.6), size: rnd(3, 7), color: '#8dff3a', kind: 'goo' });
          }
          break;
        }
        case 'bat': {
          // flattert, stürzt sich auf den Helden und steigt wieder auf
          e.state = e.state === 'idle' ? 'fly' : e.state;
          if (e.state === 'fly') {
            const tx = (alive && dist < 1100 ? p.x : e.home.x) + Math.sin(e.t * 1.3) * 260, ty = (alive ? p.y : e.home.y) - 320 + Math.sin(e.t * 3) * 40;
            e.vx += clamp(tx - e.x, -300, 300) * 4 * dt; e.vy += clamp(ty - e.y, -300, 300) * 4 * dt;
            e.vx *= Math.pow(0.2, dt); e.vy *= Math.pow(0.2, dt);
            if (alive && dist < 750 && (e.cd -= dt) <= 0) {
              e.state = 'dive'; e.diveT = 0;
              const a = Math.atan2(p.y - e.y, p.x - e.x);
              e.vx = Math.cos(a) * 950; e.vy = Math.sin(a) * 950;
              this.audio.enemyShot(false);
            }
          } else if (e.state === 'dive') {
            e.diveT += dt;
            if (e.diveT > 0.7 || this.solidAt(e.x, e.y + 40)) { e.state = 'fly'; e.cd = rnd(1.6, 2.6); e.vy = -500; }
          }
          e.x += e.vx * dt; e.y += e.vy * dt;
          e.face = e.vx > 0 ? 1 : -1;
          break;
        }
        case 'saucer': {
          // zieht oben über den Helden und wirft Bomben
          const tx = p.x + Math.sin(e.t * 0.9) * 220, ty = this.cam.y + 190 + Math.sin(e.t * 2) * 30;
          e.vx += clamp(tx - e.x, -1, 1) * 900 * dt; e.vx *= Math.pow(0.3, dt);
          e.vy = (ty - e.y) * 2;
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (alive && Math.abs(dx) < 320 && (e.cd -= dt) <= 0) {
            e.cd = rnd(1.1, 1.7);
            this.ebullets.push({ kind: 'bomb', x: e.x, y: e.y + 30, vx: e.vx * 0.5, vy: 100, r: 14, dmg: 20, life: 4, g: 1600, t: 0 });
            this.audio.shot('grenade');
          }
          break;
        }
        case 'sentinel': {
          // Schild vorn, öffnet sich nur zum Feuern
          e.face = dx > 0 ? 1 : -1;
          const want = p.x - e.face * 420;
          e.vx = alive && dist < 1300 ? clamp((want - e.x) * 1.2, -140, 140) : 0;
          e.vy = (e.home.y + Math.sin(e.t * 2.2) * 12 - e.y) * 4;
          this.move(e, dt, { noOneway: true });
          e.cycle = ((e.cycle ?? rnd(0, 2)) + dt) % 3.2;
          const wasOpen = e.open;
          e.open = e.cycle > 2.3;
          if (e.open && !wasOpen && alive && dist < 1300) {
            const a = Math.atan2(p.y - e.y, p.x - e.x);
            for (let k = -2; k <= 2; k++) this.enemyShoot(e.x + e.face * 40, e.y - 10, a + k * 0.12, 600, 'orb', '#b98aff');
            this.part({ x: e.x + e.face * 40, y: e.y - 10, life: 0.1, size: 120, color: '#b98aff', kind: 'flash' });
          }
          break;
        }
        case 'sandworm': {
          // gräbt sich unter dem Sand heran und bricht unter dem Helden heraus
          e.timer = (e.timer || 0) - dt;
          const gy = this.surfaceY(e.x, e.home.y - 200);
          if (!e.state || e.state === 'idle') { e.state = 'under'; e.timer = rnd(0.4, 1.2); }
          if (e.state === 'under') {
            e.hidden = true;
            e.y = gy + 110;
            if (alive && Math.abs(dx) > 40) e.x += Math.sign(dx) * 240 * dt;
            if (Math.random() < 0.5) this.part({ x: e.x + rnd(-40, 40), y: gy - 4, vx: rnd(-60, 60), vy: rnd(-160, -40),
              g: 900, life: rnd(0.3, 0.6), size: rnd(4, 9), color: '#d8a24a', kind: 'goo' });
            if (alive && Math.abs(dx) < 90 && e.timer <= 0) { e.state = 'rise'; e.timer = 0; this.audio.squish(); }
          } else if (e.state === 'rise') {
            e.hidden = false;
            e.timer += dt;
            e.y = gy + 110 - easeOut(clamp(e.timer / 0.22, 0, 1)) * (e.h + 40);
            if (e.timer < 0.05) {
              this.dust(e.x, gy, 18);
              this.shake = Math.max(this.shake, 0.25);
              for (let i = 0; i < 16; i++) this.part({ x: e.x + rnd(-50, 50), y: gy, vx: rnd(-300, 300), vy: rnd(-700, -200),
                g: 1500, life: rnd(0.4, 0.9), size: rnd(4, 10), color: '#d8a24a', kind: 'goo' });
            }
            if (e.timer > 1.4) { e.state = 'dive'; e.timer = 0; }
          } else {
            e.timer += dt;
            e.y = gy + 110 - (1 - easeOut(clamp(e.timer / 0.3, 0, 1))) * (e.h + 40);
            if (e.timer > 0.4) { e.state = 'under'; e.timer = rnd(1, 2); e.hidden = true; }
          }
          break;
        }
        case 'skimmer': {
          // rast auf dem Gleiter vorbei und feuert im Vorbeiflug
          e.dirX = e.dirX || (dx > 0 ? 1 : -1);
          e.x += e.dirX * 430 * dt;
          const gy = this.surfaceY(e.x, this.cam.y + 100);
          e.y = lerp(e.y, gy - 250 + Math.sin(e.t * 2.4) * 26, 1 - Math.pow(0.02, dt));
          e.face = e.dirX;
          if (e.x < this.cam.x - 200 || e.x > this.cam.x + W + 200) e.dirX = -e.dirX;
          if (alive && Math.abs(dx) < 800 && (e.cd -= dt) <= 0) {
            e.cd = rnd(1.6, 2.4);
            for (let k = 0; k < 3; k++) this.pending.push({ t: k * 0.12, fn: () => {
              if (e.dead) return;
              const a = Math.atan2(this.player.y - e.y, this.player.x - e.x) + rnd(-0.05, 0.05);
              this.enemyShoot(e.x, e.y + 6, a, 640, 'orb', '#ffb14a');
            } });
          }
          if (Math.random() < 0.6) this.part({ x: e.x + e.dirX * 70, y: e.y + 16, vx: -e.dirX * rnd(100, 300), vy: rnd(-30, 60),
            life: rnd(0.15, 0.35), size: rnd(8, 16), color: '#ff8a2a', kind: 'fire' });
          break;
        }
        case 'thorn': {
          // Dornenpflanze: öffnet sich und schießt einen Fächer aus Stacheln
          e.vy = Math.min(1600, e.vy + P.grav * dt);
          if (this.move(e, dt).ground) e.vy = 0;
          e.face = dx > 0 ? 1 : -1;
          e.charge = Math.max(0, (e.charge || 0) - dt);
          if (alive && dist < 850 && (e.cd -= dt) <= 0) {
            e.cd = rnd(2.2, 3);
            e.charge = 0.5;
            this.pending.push({ t: 0.5, fn: () => {
              if (e.dead) return;
              const a = Math.atan2(this.player.y - (e.y - 40), this.player.x - e.x);
              for (let k = -2; k <= 2; k++) this.ebullets.push({ kind: 'thorn', x: e.x, y: e.y - 40,
                vx: Math.cos(a + k * 0.14) * 760, vy: Math.sin(a + k * 0.14) * 760, r: 9, dmg: 12, life: 3, t: 0,
                color: '#ffd27a' });
              this.audio.enemyShot(false);
            } });
          }
          break;
        }
        case 'mortar': {
          // vierbeiniger Läufer, wirft Granaten im hohen Bogen mit Zielmarkierung
          e.vy = Math.min(1600, e.vy + P.grav * dt);
          if (e.onGround) {
            const want = p.x - Math.sign(dx || 1) * 680;
            e.face = dx > 0 ? 1 : -1;
            e.vx = clamp((want - e.x) * 1.2, -120, 120);
            if (!this.groundAhead(e, Math.sign(e.vx) || 1)) e.vx = 0;
          }
          const r = this.move(e, dt);
          e.onGround = r.ground;
          if (r.ground) e.vy = 0;
          e.walk = (e.walk || 0) + dt * Math.abs(e.vx) / 30;
          if (alive && dist < 1500 && (e.cd -= dt) <= 0) {
            e.cd = rnd(2.4, 3.2);
            const T2 = 1.5, tx = p.x + p.vx * 0.5;
            const my = e.y - 60;
            this.ebullets.push({ kind: 'shell', x: e.x, y: my, vx: (tx - e.x) / T2, vy: (this.surfaceY(tx, my) - my - 0.5 * 1500 * T2 * T2) / T2,
              r: 16, dmg: 25, life: T2 + 1.5, g: 1500, t: 0, markX: tx, markY: this.surfaceY(tx, my), color: '#ffb14a' });
            this.part({ x: e.x, y: my, life: 0.1, size: 120, color: '#ffb14a', kind: 'flash' });
            this.audio.shot('grenade');
          }
          break;
        }
        case 'leech': {
          // kriecht und schwimmt auf den Helden zu, im Wasser schneller
          const r = this.move(e, dt);
          e.wet = r.water;
          e.vy = e.wet ? Math.sin(e.t * 3) * 40 : Math.min(1600, e.vy + P.grav * dt);
          if (r.ground) e.vy = 0;
          e.face = Math.sign(dx) || e.face;
          const sp = e.wet ? 260 : 150;
          if (alive && dist < 1000) e.vx = e.face * sp; else e.vx = 0;
          e.walk = (e.walk || 0) + dt * Math.abs(e.vx) / 20;
          if (alive && Math.abs(dx) < 260 && Math.abs(dy) < 160 && (e.cd -= dt) <= 0 && (r.ground || e.wet)) {
            e.cd = rnd(1.4, 2.2);
            e.vy = -760; e.vx = e.face * 520;
            this.audio.squish();
          }
          break;
        }
        case 'stingfly': {
          // schwirrt umher und sticht im Sturzflug zu
          if (e.state === 'idle') { e.state = 'fly'; e.diveT = 0; }
          if (e.state === 'fly') {
            const tx = p.x + Math.sin(e.t * 2.3) * 320, ty = p.y - 260 + Math.sin(e.t * 3.7) * 90;
            e.vx += clamp(tx - e.x, -400, 400) * 5 * dt; e.vy += clamp(ty - e.y, -400, 400) * 5 * dt;
            e.vx *= Math.pow(0.15, dt); e.vy *= Math.pow(0.15, dt);
            if (alive && dist < 620 && (e.cd -= dt) <= 0) {
              e.state = 'dive'; e.diveT = 0;
              const a = Math.atan2(p.y - e.y, p.x - e.x);
              e.vx = Math.cos(a) * 1050; e.vy = Math.sin(a) * 1050;
            }
          } else {
            e.diveT = (e.diveT || 0) + dt;
            if (e.diveT > 0.55 || this.solidAt(e.x, e.y + 30)) { e.state = 'fly'; e.cd = rnd(1.2, 2); e.vy = -400; }
          }
          e.x += e.vx * dt; e.y += e.vy * dt;
          e.face = e.vx > 0 ? 1 : -1;
          break;
        }
        case 'sporepod': {
          // Pilz: bläst Sporenwolken aus, die auf den Helden zutreiben
          e.vy = Math.min(1600, e.vy + P.grav * dt);
          if (this.move(e, dt).ground) e.vy = 0;
          e.charge = Math.max(0, (e.charge || 0) - dt);
          if (alive && dist < 1000 && (e.cd -= dt) <= 0) {
            e.cd = rnd(3.4, 4.6);
            e.charge = 0.6;
            this.pending.push({ t: 0.6, fn: () => {
              if (e.dead) return;
              this.spores(e.x, e.y - 60, 150, Math.sign(this.player.x - e.x) * rnd(20, 60));
              this.part({ x: e.x, y: e.y - 60, life: 0.2, size: 200, color: '#c8ff5a', kind: 'flash' });
            } });
          }
          break;
        }
        case 'mudhulk': {
          // Panzerrücken vorn, brüllt und stürmt los
          e.vy = Math.min(1600, e.vy + P.grav * dt);
          e.face = dx > 0 ? 1 : -1;
          e.charge = Math.max(0, (e.charge || 0) - dt);
          if (e.state === 'rush') {
            e.rushT -= dt;
            e.vx = e.rushDir * 620;
            if (e.rushT <= 0) { e.state = 'walk'; e.cd = rnd(2, 3); }
          } else {
            e.vx = alive && dist < 1200 ? e.face * 130 : 0;
            if (!this.groundAhead(e, Math.sign(e.vx) || 1)) e.vx = 0;
            if (alive && Math.abs(dx) < 720 && Math.abs(dy) < 220 && (e.cd -= dt) <= 0) {
              e.charge = 0.7;
              this.pending.push({ t: 0.7, fn: () => {
                if (e.dead) return;
                e.state = 'rush'; e.rushT = 1.1; e.rushDir = Math.sign(this.player.x - e.x) || 1;
                this.audio.bossRoar();
                this.dust(e.x, e.y + e.h / 2, 12);
              } });
              e.cd = 4;
            }
          }
          const r2 = this.move(e, dt);
          if (r2.ground) e.vy = 0;
          if (r2.wall && e.state === 'rush') { e.state = 'walk'; e.cd = rnd(2, 3); this.shake = Math.max(this.shake, 0.4); }
          e.walk = (e.walk || 0) + dt * Math.abs(e.vx) / 28;
          break;
        }
        case 'boss': this.updateBoss(e, dt); break;
      }
      if (WALKERS[e.type] && !e.dead) this.walkerGait(e, dt);
      // Berührung
      if (alive && !e.intro && e.type !== 'boss' && p.inv <= 0) {
        const hb = this.hitbox(e), m = 10;
        if (p.x + p.w / 2 > hb.x0 + m && p.x - p.w / 2 < hb.x1 - m && p.y + p.h / 2 > hb.y0 + m && p.y - p.h / 2 < hb.y1 - m)
          this.hurtPlayer(EN[e.type].dmg, Math.sign(p.x - e.x) || 1);
      }
    }

    enemyShoot(x, y, a, speed, kind = 'orb', color) {
      const big = kind === 'big';
      const s = speed * (1 - 0.25 * this.ease);
      this.ebullets.push({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, r: big ? 22 : 11,
        dmg: Math.round((big ? 25 : 12) * (1 - 0.35 * this.ease)),
        life: 4, color: color || '#ff4a5a', t: 0 });
      this.audio.enemyShot(big);
    }

    damageEnemy(e, dmg, hx, hy, dx, dy, quiet, aoe) {
      if (e.dead || e.intro || e.hidden) return;
      // Wächter: der geschlossene Schild vorn hält Schüsse ab, Explosionen gehen durch
      if (e.type === 'mudhulk' && !aoe && e.charge <= 0 && e.state !== 'rush' && dx * e.face < 0) {
        e.shieldHit = 1;
        if (!quiet || Math.random() < 0.3) {
          this.audio.hit('metal');
          for (let i = 0; i < 3; i++) this.part({ x: hx, y: hy, vx: -dx * rnd(200, 600), vy: rnd(-300, 200),
            life: rnd(0.1, 0.25), size: rnd(2, 3), color: '#a8c86a', kind: 'spark' });
        }
        return;
      }
      if (e.type === 'sentinel' && !e.open && !aoe && dx * e.face < 0) {
        e.shieldHit = 1;
        if (!quiet || Math.random() < 0.3) {
          this.audio.hit('metal');
          for (let i = 0; i < 3; i++) this.part({ x: hx, y: hy, vx: -dx * rnd(300, 700) + rnd(-200, 200), vy: rnd(-400, 200),
            life: rnd(0.1, 0.25), size: rnd(2, 3), color: '#c9a8ff', kind: 'spark' });
        }
        return;
      }
      if (e.type === 'boss') {
        // Kern beziehungsweise Schlund: voller Schaden und Kerntreffer, sonst hält die Panzerung
        const c = e.throat;
        if (c && Math.hypot(hx - c.x, hy - c.y) < c.r) { dmg *= e.cfg.critMul || 1.6; e.crit = 0.25; }
        else if (e.cfg.armor) dmg *= e.cfg.armor;
      }
      e.hp -= dmg;
      e.flash = 1;
      if (e.type === 'boss' && !e.dying) this.bossHit(e, dmg, hx, hy, dx, dy);
      if (!quiet) {
        this.audio.hit(EN[e.type].flesh ? 'flesh' : 'metal');
        const col = EN[e.type].flesh ? '#8dff3a' : '#ffd27a';
        for (let i = 0; i < 4; i++) this.part({ x: hx, y: hy, vx: -dx * rnd(100, 400) + rnd(-200, 200), vy: -dy * rnd(100, 400) + rnd(-250, 150),
          g: EN[e.type].flesh ? 1500 : 0, life: rnd(0.12, 0.3), size: rnd(2, 4), color: col, kind: EN[e.type].flesh ? 'goo' : 'spark' });
      }
      if (e.type === 'brute' || e.type === 'turret') e.vx += dx * 20;
      if (e.hp <= 0) this.killEnemy(e);
    }

    // Rückmeldung bei jedem Treffer auf den Boss: Aufblitzen, Rückstoß, Funken und Schadenszahlen
    bossHit(e, dmg, hx, hy, dx, dy) {
      const crit = e.crit > 0;
      e.hitFlash = Math.min(1, (e.hitFlash || 0) + (crit ? 0.9 : 0.55));
      e.kickX = clamp((e.kickX || 0) + dx * (crit ? 7 : 4), -26, 26);
      e.kickY = clamp((e.kickY || 0) + dy * (crit ? 5 : 3), -20, 20);
      e.barFlash = 1;
      e.dmgAcc = (e.dmgAcc || 0) + dmg;
      e.dmgCrit = e.dmgCrit || crit;
      e.dmgX = hx; e.dmgY = hy;
      this.audio.bossHit(crit);
      const col = crit ? '#ffe36a' : '#ffd27a';
      const n = crit ? 5 : 3;
      for (let i = 0; i < n; i++) this.part({ x: hx, y: hy, vx: -dx * rnd(200, 800) + rnd(-300, 300),
        vy: -dy * rnd(200, 800) + rnd(-300, 300), drag: 2, life: rnd(0.15, 0.4), size: rnd(2, 4), color: col, kind: 'spark' });
      this.part({ x: hx, y: hy, life: crit ? 0.12 : 0.07, size: crit ? 150 : 90, color: col, kind: 'flash' });
      if (crit) {
        this.ring(hx, hy, 130, '#ffe36a');
        this.shake = Math.max(this.shake, 0.12);
      }
    }

    // Aufgelaufenen Schaden als Zahl zeigen, Blitz und Rückstoß abklingen lassen
    updateBossHits(e, dt) {
      e.hitFlash = Math.max(0, (e.hitFlash || 0) - dt * 5);
      e.barFlash = Math.max(0, (e.barFlash || 0) - dt * 7);
      e.kickX = (e.kickX || 0) * Math.pow(0.002, dt);
      e.kickY = (e.kickY || 0) * Math.pow(0.002, dt);
      e.crit = Math.max(0, (e.crit || 0) - dt);
      // Trefferleiste läuft dem echten Wert hinterher (der weiße Rest zeigt den frischen Schaden)
      e.hpLag = e.hpLag === undefined ? e.hp : (e.hpLag > e.hp ? Math.max(e.hp, e.hpLag - Math.max(e.maxHp * 0.10, 400) * dt) : e.hp);
      if ((e.dmgAcc || 0) > 0) {
        e.dmgT = (e.dmgT || 0) + dt;
        if (e.dmgT > 0.3) {
          const crit = e.dmgCrit;
          this.float(e.dmgX + rnd(-20, 20), e.dmgY, (crit ? '' : '') + '-' + Math.round(e.dmgAcc) + (crit ? '  CRIT!' : ''),
            crit ? '#ffe36a' : '#ffffff');
          e.dmgAcc = 0; e.dmgT = 0; e.dmgCrit = false;
        }
      }
    }

    killEnemy(e) {
      if (e.dead) return;
      const d = EN[e.type];
      if (e.type === 'boss') { this.bossDeath(e); return; }
      e.dead = true;
      this.kills++;
      this.combo++; this.comboT = 2.5;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = this.mult();
      const pts = d.score * mult;
      this.score += pts;
      this.float(e.x, e.y - e.h / 2 - 10, '+' + pts, mult > 1 ? '#ffd24a' : '#ffffff');
      if (this.combo >= 5 && this.combo % 5 === 0) this.say(this.combo + ' HIT COMBO', '#ffd24a', 1.2, true);
      for (let i = 0; i < d.coins; i++) this.dropCoin(e.x, e.y);
      if (d.flesh) {
        this.audio.squish();
        this.audio.boom(e.type === 'pod' ? 2 : 1);
        this.gooBurst(e.x, e.y, e.type === 'pod' ? 60 : 36);
        this.explode(e.x, e.y, 60, 0, { fx: 0.6, noDamage: true, color: '#8dff3a' });
      } else {
        const big = e.type === 'brute';
        this.explode(e.x, e.y, big ? 200 : 110, big ? 60 : 0, { fx: big ? 2.5 : 1.2, noPlayer: true });
        this.debris(e.x, e.y, big ? 24 : 10, e.type);
        if (big) { this.hitstop = 0.08; this.shake = Math.max(this.shake, 0.7); this.flash = 0.35; this.flashColor = '#ffd9a0'; }
      }
      // Beute
      const r = Math.random();
      if (e.type === 'brute') this.dropPickup(e.x, e.y, pick(['S', 'L', 'R']));
      else if (r < 0.06) this.dropPickup(e.x, e.y, 'H');
      else if (r < 0.1) this.dropPickup(e.x, e.y, 'G');
      else if (r < 0.13) this.dropPickup(e.x, e.y, pick(['S', 'L', 'R']));
    }

    mult() { return Math.min(8, 1 + Math.floor(this.combo / 5)); }

    // Wellen von Drohnen, damit zwischen den Abschnitten immer etwas los ist
    updateWaves(dt) {
      if (this.lock || this.player.dead) return;
      if ((this.waveT -= dt) > 0) return;
      this.waveT = rnd(9, 14) + 8 * this.ease;
      if (this.enemies.length > 6 || this.ease > 0.55) return;
      const n = 2 + Math.floor(Math.random() * 2) - (this.ease > 0 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const e = this.addEnemy('drone', this.cam.x + W + 100 + i * 90, this.cam.y + 120 + i * 70);
        e.vx = -500;
      }
    }

    // ---------- Boss ----------

    startBoss() {
      const L = this.L, B = L.boss, cfg = BOSSES[L.def.boss], R = RIGS[cfg.rig];
      const chain = R.kind === 'chain';
      const biped = !R.kind;                       // nur die Zweibeiner haben Hüfte, Auge und Schulter
      const lift = biped ? R.stand : 0;
      const e = this.addEnemy('boss', B.x + 120, B.y - lift, { intro: true, introT: 0, phase: 1, atk: null, atkT: 0,
        step: 0, rear: 0, recoil: 0,
        cd: 3.5, baseY: B.y - lift, baseX: B.x + 120, cfg, R,
        hp: this.opts.weak || cfg.hp, maxHp: this.opts.weak || cfg.hp });
      // Trefferzone; bei den Zweibeinern zusätzlich Kern, Auge und Schulter relativ zur Hüfte (Blick nach links)
      e.body = R.body;
      if (biped) Object.assign(e, { core: { x: -R.core.x, y: R.core.y, r: R.core.r }, eye: { x: -R.eye.x, y: R.eye.y },
        cannon: { x: -R.shoulder.x, y: R.shoulder.y } });
      if (R.kind === 'tentacle') {
        // Rotmother: sitzt im Wasser, zwei Tentakel hängen an ihrem Leib
        const fy = this.L.ph - 3 * 64;
        e.y = fy - 120;
        e.baseY = e.y;
        e.rot = { x: e.x, y: e.y, sink: 1, mouth: 0, mode: 'intro', t: 0, breathe: 0,
          arms: R.shoulder.map((s, i) => ({ pts: Array.from({ length: R.segs }, () => ({ x: e.x, y: e.y })),
            target: { x: e.x - 200 - i * 120, y: fy - 40 }, state: 'idle', t: 0, side: i })) };
      } else if (chain) {
        // Leviathan: Kopf auf einer Bahn, die Segmente laufen hinterher
        const fy = this.L.ph - 3 * 64;
        e.worm = { x: B.x + 400, y: fy + 200, ang: -Math.PI / 2, speed: 0, mode: 'intro', t: 0,
          path: [], mouth: 0, targetX: B.x, arm: 0.6, atk: null, atkT: 0, side: -1 };
        e.baseY = fy;
      } else {
        // Skelett: Hüfte, Beine mit Schrittzyklus, Arme zum Zielen und Schlagen
        e.rig = { hipX: e.x, hipY: e.y, lean: 0, aim: 0, claw: 0.75, tail: 0, fall: 0, walk: 0, dir: 1,
          feet: [{ x: 90, y: R.stand }, { x: -90, y: R.stand }] };
      }
      this.boss = e;
      this.lock = true;
      this.audio.bossAlarm();
      this.opts.onBoss && this.opts.onBoss();
      this.say('WARNING', '#ff4a4a', 3, false, cfg.intro);
      this.pending.push({ t: 1.5, fn: () => { this.audio.bossRoar(); this.shake = 1; this.rumble(1, 1, 1200); } });
    }

    // Der zusammengesetzte Boss: gehen mit Schrittzyklus, zielen, ausholen, zusammenbrechen
    animateRig(e, dt) {
      const R = e.R, r = e.rig, p = this.player, A = this.L.arena;
      const fy = this.L.ph - 3 * 64, face = -1;
      e.rear = Math.max(0, e.rear - dt * 2.5);
      e.recoil *= Math.pow(0.0015, dt);
      if (e.dying) {                                    // bricht in die Knie und kippt nach vorn
        r.fall = Math.min(1, r.fall + dt * 0.8);
        r.hipY = lerp(r.hipY, fy - 90, 1 - Math.pow(0.25, dt));
        r.lean = lerp(r.lean, -0.5, 1 - Math.pow(0.3, dt));
        r.claw = lerp(r.claw, 1.5, 1 - Math.pow(0.4, dt));
        r.aim = lerp(r.aim, 1.2, 1 - Math.pow(0.4, dt));
        r.feet[0].x = lerp(r.feet[0].x, 210, 1 - Math.pow(0.4, dt));
        r.feet[1].x = lerp(r.feet[1].x, -180, 1 - Math.pow(0.4, dt));
        r.feet[0].y = r.feet[1].y = fy - r.hipY;
        r.tail = lerp(r.tail, -0.5, 1 - Math.pow(0.4, dt));
        e.x = r.hipX;
        e.y = r.hipY;
        return;
      }
      // Gehen: er hält Abstand zum Helden und bleibt in seiner Hälfte der Arena
      const want = clamp(p.x + 760, A.x + 980, e.baseX + 150);
      const busy = e.atk === 'slam' || e.atk === 'rings' || e.rear > 0.2;
      const speed = busy ? 0 : clamp((want - r.hipX) * 1.4, -190, 190);
      r.hipX += speed * dt;
      if (Math.abs(speed) > 20) r.dir = Math.sign(speed) * face;     // lokale Laufrichtung
      // Schrittzyklus läuft mit der zurückgelegten Strecke, im Stand wippt er nur
      const moving = Math.abs(speed) > 20;
      const prev = r.walk;
      r.walk += (moving ? Math.abs(speed) * dt / R.step : dt * 0.22);
      const half = Math.floor(r.walk * 2) !== Math.floor(prev * 2);
      for (let i = 0; i < 2; i++) {
        const ph = ((r.walk + i * 0.5) % 1 + 1) % 1;
        const foot = r.feet[i];
        if (!moving) {                                  // Stand: Füße bleiben stehen, leichtes Wippen
          foot.x = lerp(foot.x, i ? -100 : 110, 1 - Math.pow(0.02, dt));
          foot.y = fy - r.hipY;
        } else if (ph < 0.62) {                         // Standbein: schiebt den Körper
          foot.x = (0.5 - ph / 0.62) * R.step * r.dir;
          foot.y = fy - r.hipY;
        } else {                                        // Schwungbein: hebt ab und setzt vorn auf
          const u = (ph - 0.62) / 0.38;
          foot.x = (-0.5 + u) * R.step * r.dir;
          foot.y = fy - r.hipY - Math.sin(u * Math.PI) * R.lift;
        }
      }
      if (half && moving) this.bossFootfall(e, r.hipX + r.feet[Math.floor(r.walk * 2) % 2].x * face);
      // Hüfte: federt im Schritt, hebt sich beim Ausholen, sackt beim Stampfen
      const bob = moving ? -Math.abs(Math.sin(r.walk * TAU)) * 14 : Math.sin(this.time * 1.6) * 5;
      const target = fy - R.stand + bob - e.rear * 60 + (e.slamDrop || 0);
      r.hipY = lerp(r.hipY, target, 1 - Math.pow(0.0005, dt));
      e.slamDrop = (e.slamDrop || 0) * Math.pow(0.02, dt);
      r.lean = lerp(r.lean, -e.rear * 0.22 + e.recoil * 0.12 + (moving ? 0.05 : 0), 1 - Math.pow(0.01, dt));
      // Vorderer Arm: die Kanone zielt auf den Helden, die Sichelklaue holt aus und schlägt
      const sx = r.hipX + R.shoulder.x * face, sy = r.hipY + R.shoulder.y;
      let aimT;
      if (R.aim === 'arm') {
        aimT = clamp(Math.atan2(p.y - 40 - sy, (p.x - sx) * face), -1.1, 0.95);
      } else {
        aimT = 0.55 + Math.sin(this.time * 1.1) * 0.15;          // Klaue wiegt sich
        if (e.atk === 'spread' || e.atk === 'acid') aimT = -0.5;  // aufgerissen beim Speien
        if (e.atk === 'brood') aimT = 1.3;                        // gräbt am Boden
        if (e.atk === 'slam') aimT = e.atkT < 0.9 ? -1.3 : 1.4;   // Sichelschlag
      }
      const snap = (e.atk === 'slam' && e.atkT >= 0.9) ? 1e-9 : (R.aim === 'arm' ? 0.002 : 0.01);
      r.aim = lerp(r.aim, aimT, 1 - Math.pow(snap, dt));
      // Zweiter Arm: hängt, holt beim Schlag aus und drischt zu
      let clawT = 0.75 + Math.sin(this.time * 1.3 + 1) * 0.12;
      if (e.atk === 'slam') clawT = e.atkT < 0.9 ? -1.25 : 1.35;
      else if (e.atk === 'brood') clawT = 1.2;
      else if (e.rear > 0.2) clawT = -0.6;
      r.claw = lerp(r.claw, clawT, 1 - Math.pow(e.atk === 'slam' && e.atkT >= 0.9 ? 1e-9 : 0.004, dt));
      // Schwanz schwingt gegen die Laufrichtung aus
      if (R.tail) r.tail = lerp(r.tail, Math.sin(this.time * 1.5) * 0.18 - (moving ? 0.25 : 0) - e.rear * 0.3,
        1 - Math.pow(0.02, dt));
      e.x = r.hipX;
      e.y = r.hipY;
      e.throat = { x: r.hipX + R.core.x * face, y: r.hipY + R.core.y, r: R.core.r };
    }

    bossFootfall(e, at) {
      const fy = this.L.ph - 3 * 64;
      const x = at ?? e.x + rnd(-120, 120);
      this.dust(x, fy, 8);
      this.debris(x, fy, 2, 'rock');
      this.shake = Math.max(this.shake, 0.18);
      this.audio.thud();
      if (Math.abs(this.player.x - x) < 260) this.rumble(0.25, 0.15, 90);
    }

    updateBoss(e, dt) {
      const p = this.player, A = this.L.arena, cfg = e.cfg, col = cfg.color;
      this.updateBossHits(e, dt);
      if (e.R.kind === 'chain') return this.updateWorm(e, dt);
      if (e.R.kind === 'tentacle') return this.updateRot(e, dt);
      this.animateRig(e, dt);
      if (!e.dying) p.x = Math.min(p.x, e.baseX + e.body.x0 + 60 - p.w / 2);
      if (e.intro) {
        e.introT += dt;
        const k = clamp((e.introT - 0.8) / 2.4, 0, 1);
        e.y = e.baseY + (1 - easeOut(k)) * 760;
        if (e.rig) { e.rig.hipY = e.y; e.rig.hipX = e.x; e.rig.feet.forEach((f, i) => { f.y = e.R.stand; f.x = i ? -100 : 110; }); }
        if (e.introT > 0.8 && e.introT < 3.2) {
          this.shake = Math.max(this.shake, 0.4);
          if (Math.random() < 0.5) this.debris(e.x + rnd(-250, 250), this.L.ph - 3 * 64, 1, 'rock');
        }
        if (e.introT > 3.4) e.intro = false;
        return;
      }
      if (e.dying) {
        e.dieT += dt;
        e.x = e.baseX + rnd(-6, 6);
        e.y = e.baseY + e.dieT * e.dieT * 40;
        return;
      }
      const hpk = e.hp / e.maxHp;
      const phase = hpk > 0.66 ? 1 : hpk > 0.33 ? 2 : 3;
      if (phase !== e.phase) {
        e.phase = phase;
        this.audio.bossRoar();
        this.shake = 0.9;
        this.flash = 0.5; this.flashColor = col;
        this.say(phase === 2 ? 'PHASE 2' : 'FINAL PHASE', col, 1.6);
        e.rear = 1.4;
        e.cd = 1.2; e.atk = null;
        if (this.bossBeam) { this.bossBeam = null; this.audio.laser(false); }
        for (const o of this.ebullets) o.life = Math.min(o.life, 0.3);
      }
      e.face = -1;
      const m = this.bossMuzzle(e);                  // Mündung: Kanonenlauf oder Maul
      const cx = m.x, cy = m.y;
      const ex = e.x + e.eye.x, ey = e.y + e.eye.y;
      const kx = e.x + e.core.x, ky = e.y + e.core.y;
      const fy = this.L.ph - 3 * 64;
      const speedUp = (phase === 3 ? 0.7 : phase === 2 ? 0.85 : 1) * (cfg.rage ? 0.85 : 1);
      if (!e.atk) {
        if ((e.cd -= dt) > 0) return;
        const pool = cfg.pool.slice(0, phase).flat();
        let a;
        do a = pick(pool); while (a === e.last && pool.length > 1);
        const minions = this.enemies.filter(o => !o.dead && o.type !== 'boss').length;
        if ((a === 'drones' || a === 'bats' || a === 'brood') && minions > 4) a = pool.includes('spread') ? 'spread' : 'acid';
        e.atk = a; e.last = a; e.atkT = 0; e.n = 0;
        if (a === 'slam' || a === 'rings' || a === 'beam') this.audio.charge(0.8);
        if (a === 'slam' || a === 'drones' || a === 'bats' || a === 'brood') e.rear = 1;   // holt aus
      }
      e.atkT += dt;
      const t = e.atkT;
      switch (e.atk) {
        case 'spread':
          if (t > 0.4 + e.n * 0.5 * speedUp && e.n < 3 + phase) {
            e.n++;
            const a = Math.atan2(p.y - cy, p.x - cx);
            const k = phase === 3 ? 4 : 3;
            for (let i = -k; i <= k; i++) this.enemyShoot(cx, cy, a + i * 0.13, 480 + phase * 40, 'orb', col);
            this.part({ x: cx, y: cy, life: 0.12, size: 180, color: col, kind: 'flash' });
            e.recoil = 1;
            this.shake = Math.max(this.shake, 0.3);
          }
          if (t > 3.2) this.endAttack(e, 1.3 * speedUp);
          break;
        case 'volley':
          if (t > 0.5 && t < 2.6 && (e.vt = (e.vt || 0) - dt) <= 0) {
            e.vt = 0.22 * speedUp;
            const a = Math.atan2(p.y - ey, p.x - ex) + rnd(-0.08, 0.08);
            this.enemyShoot(ex, ey, a, 700, 'big', '#ff5a5a');
            this.part({ x: ex, y: ey, life: 0.08, size: 130, color: '#ff5a5a', kind: 'flash' });
            e.recoil = Math.min(1, e.recoil + 0.5);
          }
          if (t > 3) this.endAttack(e, 1.2 * speedUp);
          break;
        case 'slam':
          if (e.n === 0 && t > 0.9) {
            e.n = 1;
            e.rear = 0; e.slamDrop = 90;                       // stampft in den Boden
            this.audio.slam();
            this.shake = 1; this.rumble(1, 1, 400);
            this.waves.push({ x: e.x - 200, y: fy, dir: -1, speed: 760, h: 80, life: 3, color: col });
            if (phase === 3) this.pending.push({ t: 0.7, fn: () => this.waves.push({ x: e.x - 200, y: fy, dir: -1, speed: 900, h: 80, life: 3, color: col }) });
            for (let i = 0; i < 20; i++) this.debris(e.x - 200 + rnd(-100, 100), fy, 1, 'rock');
            this.ring(e.x - 200, fy, 400, col);
          }
          if (t > 2.2) this.endAttack(e, 1 * speedUp);
          break;
        case 'strikes':
          if (e.n === 0) {
            e.n = 1;
            const xs = [p.x];
            for (let i = 0; i < 2 + phase; i++) xs.push(A.x + rnd(200, 1350));
            for (const x of xs) this.strikes.push({ x, t: 0, warn: 1.0, dur: 0.4, hit: false, color: col });
            this.audio.charge(1);
          }
          if (t > 2) this.endAttack(e, 1 * speedUp);
          break;
        case 'drones': case 'bats':
          if (e.n === 0) {
            e.n = 1;
            const type = e.atk === 'bats' ? 'bat' : cfg.minion;
            for (let i = 0; i < 2 + (phase === 3 ? 1 : 0); i++) {
              const d = this.addEnemy(type, e.x - 100, e.y - 200 - i * 60);
              d.vx = -600 - i * 150; d.vy = rnd(-200, 200); d.cd = 1 + i * 0.4;
            }
            this.audio.bossRoar();
          }
          if (t > 1.5) this.endAttack(e, 0.8);
          break;
        case 'rings':
          if (t > 0.8 + e.n * 0.45 && e.n < 4) {
            e.n++;
            const k = cfg.rage ? 22 : 18, off = e.n * 0.17;
            for (let i = 0; i < k; i++) this.enemyShoot(kx, ky, off + i * TAU / k, 380, 'orb', col);
            this.ring(kx, ky, 160, col);
          }
          if (t > 3) this.endAttack(e, 1.2);
          break;
        case 'acid':
          // Säureregen: Tropfen in hohen Bögen über die ganze Arena, einer genau auf den Helden
          if (t > 0.5 && e.n < 3 + phase && (e.vt = (e.vt || 0) - dt) <= 0) {
            e.vt = 0.35 * speedUp;
            e.n++;
            for (let k = 0; k < 4; k++) {
              const tx = k === 0 ? p.x : A.x + rnd(100, 1300), T2 = rnd(1, 1.4);
              this.ebullets.push({ kind: 'acid', x: cx, y: cy, vx: (tx - cx) / T2, vy: (fy - cy - 0.5 * 1400 * T2 * T2) / T2,
                r: 15, dmg: 15, life: 4, g: 1400, t: 0 });
            }
            this.audio.squish();
            this.part({ x: cx, y: cy, life: 0.12, size: 160, color: '#8dff3a', kind: 'flash' });
          }
          if (t > 3.2) this.endAttack(e, 1.1 * speedUp);
          break;
        case 'brood':
          // die Königin legt Krabbler, die sofort losrennen
          if (t > 0.6 && e.n < 2 + (phase > 1 ? 1 : 0) && (e.vt = (e.vt || 0) - dt) <= 0) {
            e.vt = 0.4; e.n++;
            const c = this.addEnemy('crawler', e.x - 180, fy - 40);
            c.vy = -700; c.vx = -rnd(300, 500); c.face = -1;
            this.gooBurst(e.x - 180, fy - 60, 20);
            this.audio.squish();
          }
          if (t > 2) this.endAttack(e, 1 * speedUp);
          break;
        case 'beam': {
          // waagrechter Strahl: tief = drüberspringen, hoch = ducken. Vorher warnt eine flackernde Linie.
          if (e.n === 0) {
            e.n = 1;
            const low = Math.random() < 0.5;
            this.bossBeam = { y: low ? fy - 42 : fy - 142, low, t: 0, warn: 0.95, dur: 0.9, x0: A.x, x1: kx, color: col };
          }
          const b = this.bossBeam;
          if (b) {
            b.x1 = kx;
            b.t += dt;
            if (b.t > b.warn && !b.fired) { b.fired = true; this.audio.laser(true); this.shake = 0.6; this.flash = 0.25; this.flashColor = col; }
            if (b.fired && b.t < b.warn + b.dur) {
              this.shake = Math.max(this.shake, 0.35);
              if (!p.dead && p.y + p.h / 2 > b.y - 22 && p.y - p.h / 2 < b.y + 22) this.hurtPlayer(30, -1);
              if (Math.random() < 0.8) this.part({ x: rnd(A.x, kx), y: b.y, vx: rnd(-300, 300), vy: rnd(-300, 300), life: 0.25,
                size: 3, color: col, kind: 'spark' });
            }
            if (b.fired && !b.off && b.t > b.warn + b.dur) { b.off = true; this.audio.laser(false); }
          }
          if (t > 2.4) { this.bossBeam = null; this.endAttack(e, 1 * speedUp); }
          break;
        }
      }
      // Berührung mit dem Körper tut weh und stößt zurück
      const hb = this.hitbox(e);
      if (!p.dead && p.x + p.w / 2 > hb.x0 + 40 && p.y + p.h / 2 > hb.y0) {
        this.hurtPlayer(EN.boss.dmg, -1);
        if (!p.dead) p.vx = -900;
      }
    }

    // ---------- Die Rotmother: Leib im Wasser, zwei Tentakel als Seil ----------

    // Seil auf Basis und Ziel einpassen (FABRIK, zwei Durchläufe)
    solveRope(pts, base, target, len) {
      const pull = (a, b) => {
        const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
        a.x = b.x + dx / d * len; a.y = b.y + dy / d * len;
      };
      for (let k = 0; k < 2; k++) {
        const last = pts[pts.length - 1];
        last.x = target.x; last.y = target.y;
        for (let i = pts.length - 2; i >= 0; i--) pull(pts[i], pts[i + 1]);
        pts[0].x = base.x; pts[0].y = base.y;
        for (let i = 1; i < pts.length; i++) pull(pts[i], pts[i - 1]);
      }
    }

    updateRot(e, dt) {
      const R = e.R, r = e.rot, p = this.player, A = this.L.arena, cfg = e.cfg, col = cfg.color;
      const fy = this.L.ph - 3 * 64;
      r.t += dt;
      r.breathe += dt;
      const hpk = e.hp / e.maxHp;
      const phase = hpk > 0.66 ? 1 : hpk > 0.33 ? 2 : 3;
      if (!e.dying && phase !== e.phase) {
        e.phase = phase;
        this.audio.bossRoar();
        this.shake = 0.9; this.flash = 0.5; this.flashColor = col;
        this.say(phase === 2 ? 'PHASE 2' : 'FINAL PHASE', col, 1.6);
        r.mode = 'dive'; r.t = 0;
      }
      const fast = phase === 3 ? 1.3 : phase === 2 ? 1.15 : 1;

      if (e.dying) {
        r.sink = Math.min(1, r.sink + dt * 0.35);
        r.mouth = 1;
        for (const a of r.arms) { a.state = 'limp'; a.target.y += 260 * dt; a.target.x += (a.side ? 60 : -60) * dt; }
      } else if (r.mode === 'intro') {
        // taucht langsam aus dem Wasser auf
        r.sink = Math.max(0, 1 - r.t / 2.4);
        if (r.t > 1 && r.t < 1.1) { this.audio.bossRoar(); this.shake = 1; this.rotSplash(e, fy); }
        r.mouth = clamp(1.4 - Math.abs(r.t - 1.6), 0, 1);
        if (r.t > 3) { r.mode = 'idle'; r.t = 0; e.intro = false; e.cd = 1; }
      } else if (r.mode === 'dive') {
        // abtauchen, umsetzen, wieder auftauchen
        if (r.t < 0.9) r.sink = Math.min(1, r.t / 0.7);
        else if (r.t < 1.1) {
          if (!r.moved) {
            r.moved = true;
            r.x = clamp(p.x + (Math.random() < 0.5 ? -1 : 1) * rnd(500, 800), A.x + 420, A.x + 1650);
            this.rotSplash(e, fy);
          }
        } else {
          r.sink = Math.max(0, 1 - (r.t - 1.1) / 0.7);
          if (r.t > 2) { r.mode = 'idle'; r.t = 0; r.moved = false; e.cd = 0.7; this.rotSplash(e, fy); }
        }
        r.mouth = lerp(r.mouth, 0, 1 - Math.pow(0.02, dt));
      } else {
        // Angriffe wählen
        r.mouth = lerp(r.mouth, r.arms.some(a => a.state === 'spit') ? 1 : 0, 1 - Math.pow(0.02, dt));
        if ((e.cd -= dt) <= 0 && r.arms.every(a => a.state === 'idle')) {
          const pool = cfg.pool.slice(0, phase).flat();
          let a;
          do a = pick(pool); while (a === e.last && pool.length > 1);
          e.last = a;
          e.cd = (a === 'whip' || a === 'sweep' ? 2.4 : 2) / fast;
          this.rotAttack(e, a, phase);
          if (Math.random() < 0.3) { r.mode = 'dive'; r.t = 0; r.moved = false; e.cd += 2.4; }
        }
      }
      // Leib atmet und wiegt sich im Wasser
      e.x = r.x;
      e.y = r.y = e.baseY + Math.sin(r.breathe * 1.3) * 12 + r.sink * R.sink;
      const swell = 1 + Math.sin(r.breathe * 1.3) * 0.02;
      e.swell = swell;
      // Trefferkreise: der Leib, die Tentakel sind nicht zu treffen
      const hidden = r.sink > 0.75;
      e.hidden = hidden;
      e.hitCircles = hidden ? [] : [
        { x: e.x - 40, y: e.y - 120, r: 150 },
        { x: e.x + 40, y: e.y + 40, r: 170 },
        { x: e.x - 150, y: e.y - 60, r: 120 },
      ];
      e.throat = hidden ? null : { x: e.x + R.core.x, y: e.y + R.core.y, r: R.core.r };
      e.mouthPos = { x: e.x + R.mouth.x, y: e.y + R.mouth.y };
      // Tentakel bewegen und einpassen
      for (const a of r.arms) {
        const sh = R.shoulder[a.side];
        const base = { x: e.x + sh.x, y: e.y + sh.y };
        a.t += dt;
        if (a.state === 'idle') {
          const rest = { x: e.x - 260 - a.side * 90, y: fy - 40 - Math.sin(r.breathe * 1.1 + a.side) * 60 };
          a.target.x = lerp(a.target.x, rest.x, 1 - Math.pow(0.2, dt));
          a.target.y = lerp(a.target.y, rest.y, 1 - Math.pow(0.2, dt));
        } else if (a.state === 'raise') {
          a.target.x = lerp(a.target.x, p.x, 1 - Math.pow(0.02, dt));
          a.target.y = lerp(a.target.y, fy - 620, 1 - Math.pow(0.01, dt));
          if (a.t > 0.75) { a.state = 'slam'; a.t = 0; a.slamX = p.x; this.audio.charge(0.3); }
        } else if (a.state === 'slam') {
          a.target.x = lerp(a.target.x, a.slamX, 1 - Math.pow(0.2, dt));
          a.target.y += 3600 * dt;
          if (a.target.y > fy - 20) {
            a.target.y = fy - 20;
            if (!a.hit) {
              a.hit = true;
              this.audio.slam();
              this.shake = 1; this.rumble(1, 0.8, 300);
              this.dust(a.target.x, fy, 26);
              this.ring(a.target.x, fy, 380, col);
              this.waves.push({ x: a.target.x, y: fy, dir: -1, speed: 760, h: 70, life: 3, color: col });
              this.waves.push({ x: a.target.x, y: fy, dir: 1, speed: 760, h: 70, life: 3, color: col });
              if (!p.dead && Math.abs(p.x - a.target.x) < 120 && p.y > fy - 220) this.hurtPlayer(30, Math.sign(p.x - a.target.x) || 1);
            }
            if (a.t > 0.9) { a.state = 'idle'; a.t = 0; a.hit = false; }
          }
        } else if (a.state === 'sweep') {
          a.target.x -= a.dir * 1250 * dt;
          a.target.y = fy - 70 + Math.sin(a.t * 6) * 20;
          if (a.t > 1.5 || a.target.x < A.x + 80 || a.target.x > A.x + 1800) { a.state = 'idle'; a.t = 0; }
        } else if (a.state === 'spit') {
          a.target.x = lerp(a.target.x, e.x - 200, 1 - Math.pow(0.1, dt));
          a.target.y = lerp(a.target.y, e.y - 280, 1 - Math.pow(0.1, dt));
          if (a.t > 1.2) { a.state = 'idle'; a.t = 0; }
        } else if (a.state === 'limp') {
          a.target.y = Math.min(a.target.y, fy - 10);
        }
        this.solveRope(a.pts, base, a.target, R.segLen);
        // die schlagenden und fegenden Tentakel tun weh
        if (!p.dead && !e.dying && (a.state === 'sweep' || a.state === 'slam')) {
          for (const pt of a.pts) {
            if (Math.hypot(p.x - pt.x, p.y - pt.y) < 70) { this.hurtPlayer(22, Math.sign(p.x - pt.x) || 1); break; }
          }
        }
      }
      // Berührung mit dem Leib
      if (!p.dead && !e.dying && !hidden) {
        for (const c of e.hitCircles) {
          if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + 30) { this.hurtPlayer(25, Math.sign(p.x - c.x) || -1); break; }
        }
      }
    }

    rotSplash(e, fy) {
      const r = e.rot;
      this.audio.boom(2);
      this.shake = Math.max(this.shake, 0.6);
      this.ring(r.x, fy, 420, '#9ee8c0');
      for (let i = 0; i < 50; i++) this.part({ x: r.x + rnd(-200, 200), y: fy, vx: rnd(-600, 600), vy: rnd(-900, -200),
        g: 1500, life: rnd(0.4, 1), size: rnd(4, 12), color: pick(['#9ee8c0', '#6ab88a', '#c8ff5a']), kind: 'goo' });
    }

    rotAttack(e, a, phase) {
      const R = e.R, r = e.rot, p = this.player, A = this.L.arena, col = e.cfg.color;
      const fy = this.L.ph - 3 * 64;
      const arm = pick(r.arms.filter(x => x.state === 'idle')) || r.arms[0];
      if (a === 'whip') {
        arm.state = 'raise'; arm.t = 0; arm.hit = false;
        if (phase === 3) {                       // in der letzten Phase schlagen beide zu
          const other = r.arms.find(x => x !== arm);
          if (other) this.pending.push({ t: 0.5, fn: () => { if (!e.dead && other.state === 'idle') { other.state = 'raise'; other.t = 0; other.hit = false; } } });
        }
      } else if (a === 'sweep') {
        arm.state = 'sweep'; arm.t = 0;
        arm.dir = p.x < e.x ? 1 : -1;
        arm.target.x = e.x - arm.dir * 200;
        arm.target.y = fy - 70;
        this.audio.charge(0.4);
        this.say('SWEEP  -  JUMP!', col, 1, true);
      } else if (a === 'spit') {
        arm.state = 'spit'; arm.t = 0;
        r.mouth = 1;
        for (let k = 0; k < 4 + phase; k++) this.pending.push({ t: 0.3 + k * 0.14, fn: () => {
          if (e.dead) return;
          const m = e.mouthPos, T2 = rnd(0.9, 1.3);
          const tx = p.x + rnd(-160, 160);
          this.ebullets.push({ kind: 'acid', x: m.x, y: m.y, vx: (tx - m.x) / T2, vy: (fy - m.y - 0.5 * 1400 * T2 * T2) / T2,
            r: 15, dmg: 16, life: 4, g: 1400, t: 0, color: '#c8ff5a' });
          this.part({ x: m.x, y: m.y, life: 0.1, size: 120, color: col, kind: 'flash' });
        } });
        this.audio.squish();
      } else if (a === 'spores') {
        for (let k = 0; k < 2 + (phase > 2 ? 1 : 0); k++) this.pending.push({ t: k * 0.4, fn: () => {
          if (e.dead) return;
          const m = e.mouthPos;
          this.spores(m.x + rnd(-60, 60), m.y, 170, Math.sign(p.x - e.x) * rnd(40, 90));
        } });
      } else if (a === 'brood') {
        for (let i = 0; i < 2; i++) {
          const type = Math.random() < 0.5 ? 'stingfly' : 'leech';
          const s = this.addEnemy(type, e.x - 150 + rnd(-80, 80), e.y - 100);
          s.vy = -500; s.vx = rnd(-300, -100);
        }
        this.audio.squish();
      }
      this.audio.bossRoar();
    }

    // ---------- Der Devourer: Kette aus Segmenten, die aus dem Sand bricht ----------

    updateWorm(e, dt) {
      const R = e.R, w = e.worm, p = this.player, A = this.L.arena, cfg = e.cfg;
      const fy = e.baseY, col = cfg.color;
      w.t += dt;
      // Phasen
      const hpk = e.hp / e.maxHp;
      const phase = hpk > 0.66 ? 1 : hpk > 0.33 ? 2 : 3;
      if (!e.dying && phase !== e.phase) {
        e.phase = phase;
        this.audio.bossRoar();
        this.shake = 0.9; this.flash = 0.5; this.flashColor = col;
        this.say(phase === 2 ? 'PHASE 2' : 'FINAL PHASE', col, 1.6);
      }
      const fast = phase === 3 ? 1.25 : phase === 2 ? 1.12 : 1;

      if (e.dying) {
        // Todeskampf: bäumt sich auf und stürzt in den Sand
        w.speed = lerp(w.speed, 90, 1 - Math.pow(0.4, dt));
        w.ang = turn(w.ang, e.dieT < 2 ? -Math.PI / 2 : Math.PI / 2, 1 - Math.pow(0.3, dt));
        w.mouth = 1;
      } else if (w.mode === 'intro') {
        // Auftritt: bricht aus dem Sand, brüllt und taucht wieder ab
        if (w.t < 1.2) { w.y = fy + 200; w.x = lerp(w.x, p.x + 700, 1 - Math.pow(0.1, dt)); this.wormMound(e, fy); }
        else if (w.t < 1.35) { w.speed = 1000; w.ang = -Math.PI / 2; this.wormBurst(e, fy); }
        else { w.speed = 820; w.ang += 0.95 * dt; w.mouth = clamp(1.6 - Math.abs(w.t - 2.2), 0, 1); }
        if (w.t > 4.2) { w.mode = 'under'; w.t = 0; w.targetX = p.x; e.intro = false; }
        if (w.t > 1.3 && w.t < 1.45) { this.audio.bossRoar(); this.shake = 1; }
      } else if (w.mode === 'under') {
        // unter dem Sand auf den Helden zu
        w.speed = 0;
        w.y = fy + 190;
        w.ang = Math.sign(w.targetX - w.x) >= 0 ? 0 : Math.PI;
        w.x += clamp(w.targetX - w.x, -1, 1) * 430 * fast * dt;
        w.mouth = lerp(w.mouth, 0, 1 - Math.pow(0.01, dt));
        this.wormMound(e, fy);
        if (Math.abs(w.x - w.targetX) < 60 || w.t > 2.6) { w.mode = 'warn'; w.t = 0; this.audio.charge(0.6); }
      } else if (w.mode === 'warn') {
        // Vorwarnung: der Sand bebt an der Stelle
        this.wormMound(e, fy);
        this.shake = Math.max(this.shake, 0.3);
        if (w.t > 0.65) {
          w.mode = 'up'; w.t = 0;
          w.side = p.x > w.x ? 1 : -1;
          w.ang = -Math.PI / 2 + w.side * 0.4;
          w.speed = 900 * fast;
          e.atkDone = false;
          this.wormBurst(e, fy);
        }
      } else if (w.mode === 'up') {
        w.speed = 900 * fast;
        w.ang += w.side * 0.5 * dt;
        if (w.y < fy - 620) { w.mode = 'arc'; w.t = 0; }
      } else if (w.mode === 'arc') {
        // Bogen über die Arena, dabei greift er an
        w.speed = 820 * fast;
        w.ang += w.side * (0.95 + phase * 0.05) * dt;
        if (!e.atkDone && w.t > 0.25) { e.atkDone = true; this.wormAttack(e, phase); }
        if (w.y > fy + 60 && w.t > 0.6) {
          w.mode = 'under'; w.t = 0;
          w.targetX = clamp(p.x + rnd(-200, 200), A.x + 260, A.x + 1660);
          this.wormBurst(e, fy);
          this.audio.boom(2);
        }
      }
      // Bahn integrieren und aufzeichnen
      if (w.speed > 0) { w.x += Math.cos(w.ang) * w.speed * dt; w.y += Math.sin(w.ang) * w.speed * dt; }
      w.x = clamp(w.x, A.x + 200, A.x + 1720);
      const last = w.path[0];
      if (!last || Math.hypot(last.x - w.x, last.y - w.y) > 10) w.path.unshift({ x: w.x, y: w.y });
      if (w.path.length > 420) w.path.length = 420;
      // Segmente auf der Bahn verteilen, daraus die Trefferkreise
      const segs = this.wormSegments(e);
      e.x = w.x; e.y = w.y;
      e.hitCircles = [{ x: w.x, y: w.y, r: R.headR }].concat(segs.map(s => ({ x: s.x, y: s.y, r: R.segR })));
      const mx = w.x + Math.cos(w.ang) * R.mouth.x * -1, my = w.y + Math.sin(w.ang) * R.mouth.x * -1;
      e.mouthPos = { x: mx, y: my };
      e.throat = { x: mx, y: my, r: R.core.r * (0.55 + 0.45 * w.mouth) };
      e.armA = lerp(e.armA || 0.5, w.mouth > 0.5 ? -0.5 : 0.7, 1 - Math.pow(0.05, dt));
      // Berührung: Kopf und Körper tun weh, solange sie über dem Sand sind
      if (!p.dead && !e.dying) {
        for (const c of e.hitCircles) {
          if (c.y > fy + 40) continue;
          if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + 40) { this.hurtPlayer(25, Math.sign(p.x - c.x) || 1); break; }
        }
      }
      // Sandfontänen und Feuer aus dem Maul beim Sturm
      if (w.mouth > 0.6 && Math.random() < 0.5) this.part({ x: mx, y: my, vx: rnd(-80, 80), vy: rnd(-80, 80),
        life: rnd(0.15, 0.35), size: rnd(10, 22), color: '#ff8a2a', kind: 'fire' });
    }

    // Segmentpositionen entlang der aufgezeichneten Bahn
    wormSegments(e) {
      const R = e.R, w = e.worm, out = [];
      let want = R.spacing, acc = 0, i = 1;
      for (let k = 1; k < w.path.length && out.length < R.segs; k++) {
        const a = w.path[k - 1], b = w.path[k];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        while (acc + d >= want && out.length < R.segs) {
          const t = (want - acc) / (d || 1);
          const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
          const prev = out.length ? out[out.length - 1] : { x: w.x, y: w.y };
          out.push({ x, y, ang: Math.atan2(prev.y - y, prev.x - x), s: Math.pow(R.taper, out.length + 1) });
          want += R.spacing;
        }
        acc += d;
      }
      e.segs = out;
      return out;
    }

    // Sandhügel und Staubfahne, während er unter dem Sand wandert
    wormMound(e, fy) {
      const w = e.worm;
      e.mound = { x: w.x, y: fy };
      if (Math.random() < 0.8) this.part({ x: w.x + rnd(-70, 70), y: fy - 6, vx: rnd(-120, 120), vy: rnd(-260, -60),
        g: 1200, life: rnd(0.3, 0.7), size: rnd(5, 12), color: '#d8a24a', kind: 'goo' });
      this.shake = Math.max(this.shake, 0.12);
    }

    // Durchbruch durch die Oberfläche
    wormBurst(e, fy) {
      const w = e.worm;
      this.shake = Math.max(this.shake, 0.8);
      this.rumble(0.8, 0.6, 300);
      this.audio.slam();
      this.ring(w.x, fy, 420, '#ffd27a');
      this.dust(w.x, fy, 26);
      for (let i = 0; i < 40; i++) this.part({ x: w.x + rnd(-90, 90), y: fy, vx: rnd(-500, 500), vy: rnd(-1100, -300),
        g: 1600, life: rnd(0.5, 1.2), size: rnd(5, 14), color: pick(['#d8a24a', '#c08a3a', '#ffd27a']), kind: 'goo' });
      this.debris(w.x, fy, 8, 'rock');
    }

    // Angriff im Bogen über der Arena
    wormAttack(e, phase) {
      const R = e.R, w = e.worm, p = this.player, A = this.L.arena, col = e.cfg.color;
      const fy = e.baseY;
      const pool = e.cfg.pool.slice(0, phase).flat();
      let a;
      do a = pick(pool); while (a === e.last && pool.length > 1);
      e.last = a;
      const mouth = () => e.mouthPos || { x: w.x, y: w.y };
      if (a === 'spit') {
        w.mouth = 1;
        for (let k = 0; k < 5 + phase; k++) this.pending.push({ t: k * 0.12, fn: () => {
          if (e.dead) return;
          const m = mouth();
          const ang = Math.atan2(p.y - m.y, p.x - m.x) + rnd(-0.25, 0.25);
          this.enemyShoot(m.x, m.y, ang, 520 + phase * 40, 'orb', col);
          this.part({ x: m.x, y: m.y, life: 0.1, size: 130, color: col, kind: 'flash' });
        } });
      } else if (a === 'strikes') {
        const xs = [p.x];
        for (let i = 0; i < 2 + phase; i++) xs.push(A.x + rnd(260, 1600));
        for (const x of xs) this.strikes.push({ x, t: 0, warn: 1, dur: 0.4, hit: false, color: '#ffb14a' });
        this.audio.charge(1);
      } else if (a === 'brood') {
        w.mouth = 1;
        for (let i = 0; i < 2; i++) {
          const m = mouth();
          const s = this.addEnemy('sandworm', clamp(m.x + rnd(-200, 200), A.x + 200, A.x + 1700), fy - 85);
          s.home = { x: s.x, y: fy };
          s.state = 'under'; s.hidden = true; s.timer = rnd(0.3, 1);
        }
        this.audio.squish();
      } else if (a === 'sweep' || a === 'beam') {
        // Feuervorhang: er speit im Flug eine Kette von Brocken nach unten
        w.mouth = 1;
        for (let k = 0; k < 12; k++) this.pending.push({ t: k * 0.09, fn: () => {
          if (e.dead) return;
          const m = mouth();
          this.ebullets.push({ kind: 'acid', x: m.x, y: m.y, vx: rnd(-60, 60), vy: 120, r: 15, dmg: 18, life: 4,
            g: 1300, t: 0, color: '#ff8a2a' });
        } });
      } else if (a === 'rings') {
        w.mouth = 1;
        for (let n = 0; n < 2; n++) this.pending.push({ t: n * 0.5, fn: () => {
          if (e.dead) return;
          const m = mouth(), k = 16;
          for (let i = 0; i < k; i++) this.enemyShoot(m.x, m.y, n * 0.2 + i * TAU / k, 400, 'orb', col);
          this.ring(m.x, m.y, 180, col);
        } });
      }
      this.audio.bossRoar();
    }

    // Weltposition der Kanonenmündung am gezielten Arm
    bossMuzzle(e) {
      const R = e.R, r = e.rig, face = -1;
      if (R.aim === 'head') return { x: r.hipX + R.mouth.x * face, y: r.hipY + R.mouth.y };
      const sx = r.hipX + R.shoulder.x * face, sy = r.hipY + R.shoulder.y;
      const len = R.armLen - e.recoil * 40;
      return { x: sx + Math.cos(r.aim) * len * face, y: sy + Math.sin(r.aim) * len };
    }

    endAttack(e, cd) { e.atk = null; e.cd = cd; e.vt = 0; }

    updateBossFx(dt) {
      const p = this.player;
      for (const w of this.waves) {
        w.x += w.dir * w.speed * dt; w.life -= dt;
        if (Math.random() < 0.9) this.part({ x: w.x, y: w.y - rnd(0, w.h), vx: rnd(-100, 100), vy: rnd(-500, -150), g: 1600,
          life: rnd(0.3, 0.6), size: rnd(3, 6), color: w.color || '#9dff4a', kind: 'spark' });
        if (Math.random() < 0.3) this.debris(w.x, w.y, 1, 'rock');
        if (!p.dead && Math.abs(p.x - w.x) < 50 && p.y + p.h / 2 > w.y - w.h) this.hurtPlayer(25, w.dir);
        if (w.x < this.L.arena.x) w.life = 0;
      }
      this.waves = this.waves.filter(w => w.life > 0);
      for (const s of this.strikes) {
        s.t += dt;
        if (!s.hit && s.t > s.warn) {
          s.hit = true;
          const fy = this.L.ph - 3 * 64;
          this.explode(s.x, fy - 20, 90, 0, { fx: 1.4, noDamage: true, color: s.color || '#9dff4a' });
          this.shake = Math.max(this.shake, 0.5);
          this.audio.boom(2);
        }
        if (s.hit && s.t < s.warn + s.dur && !p.dead && Math.abs(p.x - s.x) < 70) this.hurtPlayer(30, Math.sign(p.x - s.x) || 1);
      }
      this.strikes = this.strikes.filter(s => s.t < s.warn + s.dur + 0.3);
    }

    bossDeath(e) {
      if (e.dying) return;
      const cfg = e.cfg, queen = cfg.sprite === 'queen';
      e.dying = true; e.dieT = 0; e.atk = null;
      this.bossBeam = null;
      this.score += cfg.score;
      this.float(e.x, e.y - 300, '+' + cfg.score, '#ffd24a');
      this.ebullets.length = 0;
      this.waves.length = 0; this.strikes.length = 0;
      for (const o of this.enemies) if (o !== e && !o.dead) this.killEnemy(o);
      this.audio.laser(false);
      this.audio.bossDown();
      this.audio.fadeMusic(3, 0.2);
      this.slow = 0.3; this.slowT = 2.5;
      this.hitstop = 0.25;
      this.flash = 1; this.flashColor = '#ffffff';
      this.rumble(1, 1, 2000);
      if (e.R.kind === 'chain') { e.worm.mode = 'death'; e.hitCircles = null; }
      if (e.R.kind === 'tentacle') e.hitCircles = null;
      const n = this.L.last ? 40 : 26;
      for (let i = 0; i < n; i++) {
        this.pending.push({ t: i * 0.12 + rnd(0, 0.08), fn: () => {
          let x, y;
          if (e.segs && e.segs.length) { const s = pick(e.segs.concat([{ x: e.x, y: e.y }])); x = s.x + rnd(-40, 40); y = s.y + rnd(-40, 40); }
          else { const hb = this.hitbox(e); x = rnd(hb.x0, hb.x1); y = rnd(hb.y0, hb.y1); }
          this.explode(x, y, rnd(90, 200), 0, { fx: rnd(1.2, 2.5), noDamage: true, color: queen && Math.random() < 0.5 ? '#8dff3a' : undefined });
          if (queen) this.gooBurst(x, y, 14);
          else this.debris(e.x, e.y, 3, 'boss');
          this.shake = Math.max(this.shake, 0.6);
        } });
      }
      this.pending.push({ t: n * 0.12 + 0.3, fn: () => {
        e.dead = true;
        this.flash = 1; this.flashColor = '#ffffff';
        this.explode(e.x, e.y, cfg.retreat ? 300 : 500, 0, { fx: cfg.retreat ? 3 : 5, noDamage: true });
        this.gooBurst(e.x, e.y, 120);
        this.debris(e.x, e.y, 40, 'boss');
        this.shake = 1.2;
        for (let i = 0; i < 60; i++) this.dropCoin(e.x + rnd(-200, 200), e.y + rnd(-200, 200));
        this.say(cfg.down, '#ffd24a', 4, false, cfg.retreat ? 'HE WILL BE BACK ...' : '');
        this.won = true; this.endT = 0;
        this.audio.boom(3);
      } });
    }

    // ---------- Geschosse ----------

    updateBullets(dt) {
      for (const b of this.bullets) {
        b.life -= dt;
        if (b.kind === 'grenade') {
          b.vy += 2200 * dt;
          b.spin += dt * 14;
          const ox = b.x, oy = b.y;
          b.x += b.vx * dt;
          if (this.solidAt(b.x, b.y)) { b.x = ox; b.vx *= -0.5; }
          b.y += b.vy * dt;
          if (this.solidAt(b.x, b.y) || (b.vy > 0 && this.tileAt(Math.floor(b.x / 64), Math.floor(b.y / 64)) === 3 && oy % 64 < 20)) {
            b.y = oy; b.vy *= -0.45; b.vx *= 0.7;
            if (Math.abs(b.vy) > 200) this.audio.hit('metal');
          }
          if (Math.random() < 0.5) this.part({ x: b.x, y: b.y, vx: 0, vy: -20, life: 0.4, size: 6, color: '#888', kind: 'smoke' });
          let boom = b.life <= 0;
          for (const e of this.enemies) if (!e.dead && !e.intro && this.hitTest(e, b.x, b.y, b.r)) boom = true;
          if (boom) { b.life = 0; this.explode(b.x, b.y, 230, 110, { fx: 2.4, noPlayer: true }); }
          continue;
        }
        if (b.kind === 'rocket') {
          b.age += dt;
          // Zielsuche: nächster Gegner vor der Rakete
          let best = null, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.intro) continue;
            // Bosse werden auf ihre Schwachstelle angepeilt (Kern, Schlund, Eiersack), sonst auf die Mitte
            const w = e.type === 'boss' && e.throat ? e.throat : e;
            const ex = w.x, ey = w.y;
            const d = Math.hypot(ex - b.x, ey - b.y);
            if (d < bd && d < 1200) { bd = d; best = { x: ex, y: ey }; }
          }
          const sp = Math.min(1500, 700 + b.age * 2200);
          if (best && b.age > 0.12) {
            const want = Math.atan2(best.y - b.y, best.x - b.x);
            let da = ((want - b.ang + Math.PI * 3) % TAU) - Math.PI;
            b.ang += clamp(da, -9 * dt, 9 * dt);
          }
          b.vx = Math.cos(b.ang) * sp; b.vy = Math.sin(b.ang) * sp;
          this.part({ x: b.x - b.vx * 0.01, y: b.y - b.vy * 0.01, vx: rnd(-30, 30), vy: rnd(-30, 30), life: rnd(0.4, 0.8),
            size: rnd(8, 14), color: '#777', kind: 'smoke' });
          this.part({ x: b.x, y: b.y, vx: -b.vx * 0.1, vy: -b.vy * 0.1, life: 0.1, size: 10, color: '#ffc84a', kind: 'fire' });
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (this.solidAt(b.x, b.y)) {
          b.life = 0;
          this.damageTileAt(b.x, b.y, b.dmg);
          if (b.kind === 'rocket') this.explode(b.x, b.y, 130, 45, { fx: 1.3, noPlayer: true });
          else this.impact(b.x - b.vx * dt, b.y - b.vy * dt, b.kind === 'spread' ? '#ffb45a' : '#7ae8ff');
          continue;
        }
        for (const e of this.enemies) {
          if (e.dead || e.intro) continue;
          if (this.hitTest(e, b.x, b.y, b.r)) {
            const sp = Math.hypot(b.vx, b.vy) || 1;
            if (b.kind === 'rocket') { this.explode(b.x, b.y, 130, 45, { fx: 1.3, noPlayer: true }); this.damageEnemy(e, b.dmg, b.x, b.y, b.vx / sp, b.vy / sp); }
            else {
              this.damageEnemy(e, b.dmg, b.x, b.y, b.vx / sp, b.vy / sp);
              this.impact(b.x, b.y, b.kind === 'spread' ? '#ffb45a' : '#aef4ff', true);
            }
            b.life = 0;
            break;
          }
        }
      }
      this.bullets = this.bullets.filter(b => b.life > 0 && b.x > this.cam.x - 300 && b.x < this.cam.x + W + 300 && b.y < this.L.ph + 100);
    }

    updateEnemyBullets(dt) {
      const p = this.player;
      for (const b of this.ebullets) {
        b.life -= dt; b.t += dt;
        if (b.g) b.vy += b.g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        const hitP = !p.dead && inBox(b.x, b.y, { x0: p.x - p.w / 2, y0: p.y - p.h / 2, x1: p.x + p.w / 2, y1: p.y + p.h / 2 }, b.r - 4);
        if (b.kind === 'bomb' && (hitP || this.solidAt(b.x, b.y) || b.life <= 0)) {
          // Untertassen-Bombe: kleine Explosion, trifft nur den Helden
          b.life = 0;
          this.explode(b.x, b.y - 10, 100, 0, { fx: 1.1, noDamage: true, color: '#ff8a4a' });
          if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 130) this.hurtPlayer(b.dmg, Math.sign(p.x - b.x) || 1);
          continue;
        }
        if (this.solidAt(b.x, b.y)) {
          b.life = 0;
          if (b.kind === 'acid') {
            for (let i = 0; i < 8; i++) this.part({ x: b.x, y: b.y - 6, vx: rnd(-200, 200), vy: rnd(-300, -50), g: 1500,
              life: rnd(0.3, 0.6), size: rnd(3, 6), color: '#8dff3a', kind: 'goo' });
            this.decal(b.x, Math.floor(b.y / 64) * 64, '#8dff3a', rnd(18, 30));
          } else this.impact(b.x, b.y, b.color || '#ff6a6a');
          continue;
        }
        if (!p.dead && inBox(b.x, b.y, { x0: p.x - p.w / 2, y0: p.y - p.h / 2, x1: p.x + p.w / 2, y1: p.y + p.h / 2 }, b.r - 4)) {
          if (p.inv <= 0) { this.hurtPlayer(b.dmg, Math.sign(b.vx) || 1); b.life = 0; }
        }
      }
      this.ebullets = this.ebullets.filter(b => b.life > 0 && Math.abs(b.x - this.cam.x - W / 2) < W && b.y < this.L.ph + 100 && b.y > -300);
    }

    // Kacheln beschädigen: Kisten brechen, Fässer explodieren
    damageTileAt(x, y, dmg) {
      const L = this.L, T = L.T, tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx < 0 || ty < 0 || tx >= L.w || ty >= L.h) return;
      const i = ty * L.w + tx;
      if (!L.hp.has(i)) return;
      const hp = L.hp.get(i) - dmg;
      if (hp > 0) { L.hp.set(i, hp); return; }
      const t = L.tiles[i];
      L.tiles[i] = 0;
      L.hp.delete(i);
      const cx = tx * T + T / 2, cy = ty * T + T / 2;
      if (t === 6) {
        this.pending.push({ t: 0.05, fn: () => this.explode(cx, cy, 190, 90, { fx: 2, barrel: true }) });
      } else {
        this.audio.boom(1, true);
        this.debris(cx, cy, 12, 'crate');
        this.burst(cx, cy, 12, { color: '#ffb45a', speed: 400, life: 0.4, size: 3 });
        const r = Math.random();
        if (r < 0.35) for (let k = 0; k < 5; k++) this.dropCoin(cx, cy);
        else if (r < 0.6) this.dropPickup(cx, cy, 'H');
        else if (r < 0.8) this.dropPickup(cx, cy, 'G');
        else this.dropPickup(cx, cy, pick(['S', 'L', 'R']));
      }
    }

    // Explosion: Schaden im Radius plus Effekte. fx skaliert die Optik.
    explode(x, y, radius, dmg, o = {}) {
      const fx = o.fx ?? 1;
      if (!o.silent) this.audio.boom(fx > 2 ? 3 : fx > 1.1 ? 2 : 1);
      this.shake = Math.max(this.shake, Math.min(1, 0.2 + fx * 0.2));
      if (fx >= 1.2) this.rumble(0.5, 0.6, 150);
      this.part({ x, y, life: 0.12, size: radius * 2.4, color: o.color || '#ffb45a', kind: 'flash' });
      this.part({ x, y, life: 0.5 + fx * 0.1, size: radius * 1.6, color: '#fff', kind: 'boom', rot: rnd(0, TAU),
        plasma: o.color === '#9dff4a' || o.color === '#8dff3a' });
      this.ring(x, y, radius * 1.3, o.color || '#ffd9a0');
      const n = Math.round(14 * fx);
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), s = rnd(200, 700) * Math.sqrt(fx);
        this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 900, drag: 2, life: rnd(0.3, 0.7), size: rnd(2, 4),
          color: o.color || '#ffd27a', kind: 'spark' });
        this.part({ x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: Math.cos(a) * s * 0.3, vy: Math.sin(a) * s * 0.3 - 80, drag: 3,
          life: rnd(0.3, 0.6), size: rnd(18, 34) * Math.sqrt(fx), color: o.color || '#ff8a2a', kind: 'fire' });
        if (i % 2 === 0) this.part({ x: x + rnd(-30, 30), y: y + rnd(-30, 30), vx: Math.cos(a) * s * 0.15, vy: -rnd(40, 120), drag: 1.5,
          life: rnd(0.8, 1.6), size: rnd(26, 50) * Math.sqrt(fx), color: '#3a3438', kind: 'smoke' });
      }
      if (this.solidAt(x, y + 40)) this.decal(x, Math.floor((y + 40) / 64) * 64, '#000', radius * 0.5);
      if (o.noDamage) return;
      for (const e of this.enemies) {
        if (e.dead || e.intro) continue;
        const hb = this.hitbox(e);
        const cx = clamp(x, hb.x0, hb.x1), cy = clamp(y, hb.y0, hb.y1);
        const d = Math.hypot(cx - x, cy - y);
        if (d < radius) this.damageEnemy(e, dmg * (1 - d / radius * 0.5), cx, cy, (cx - x) / (d || 1), (cy - y) / (d || 1), false, true);
      }
      // Kisten und Fässer im Radius
      const T = this.L.T, r = Math.ceil(radius / T);
      for (let ty = Math.floor(y / T) - r; ty <= Math.floor(y / T) + r; ty++)
        for (let tx = Math.floor(x / T) - r; tx <= Math.floor(x / T) + r; tx++)
          if (Math.hypot(tx * T + T / 2 - x, ty * T + T / 2 - y) < radius) this.damageTileAt(tx * T + T / 2, ty * T + T / 2, dmg);
      const p = this.player;
      if (!o.noPlayer && !p.dead) {
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < radius * 0.8) this.hurtPlayer(o.barrel ? 25 : 20, Math.sign(p.x - x) || 1);
      }
    }

    // Sporenwolken treiben, wachsen und vergiften, wer drinsteht
    updateClouds(dt) {
      const p = this.player;
      for (const c of this.clouds) {
        c.t += dt;
        c.x += c.vx * dt; c.y += c.vy * dt;
        c.vy *= Math.pow(0.5, dt);
        c.r = c.r0 * (0.4 + 0.6 * Math.min(1, c.t / 1.2)) * (c.t > c.life - 1 ? Math.max(0, (c.life - c.t)) : 1);
        if (Math.random() < 0.5) this.part({ x: c.x + rnd(-c.r, c.r) * 0.7, y: c.y + rnd(-c.r, c.r) * 0.7,
          vx: rnd(-20, 20), vy: rnd(-30, -5), life: rnd(0.6, 1.4), size: rnd(18, 40), color: '#7a9a3a', kind: 'smoke' });
        if (!p.dead && c.t > 0.3 && Math.hypot(p.x - c.x, p.y - c.y) < c.r) {
          c.dmgT = (c.dmgT || 0) - dt;
          if (c.dmgT <= 0) { c.dmgT = 0.6; this.hurtPlayer(8, 0); }
        }
      }
      this.clouds = this.clouds.filter(c => c.t < c.life);
    }

    spores(x, y, r0, vx) {
      this.clouds.push({ x, y, r: 10, r0, vx, vy: -40, t: 0, life: 7 });
      this.audio.squish();
    }

    // ---------- Beute ----------

    // Beute nie in einer Wand entstehen lassen, sonst fällt sie durch den Boden
    freeY(x, y) {
      while (y > 0 && this.solidAt(x, y + 14)) y -= 16;
      return y;
    }
    dropCoin(x, y) {
      y = this.freeY(x, y);
      this.pickups.push({ type: 'coin', x, y, vx: rnd(-300, 300), vy: rnd(-800, -350), t: rnd(0, 6), life: 12 });
    }
    dropPickup(x, y, type) {
      y = this.freeY(x, y);
      this.pickups.push({ type, x, y, vx: rnd(-120, 120), vy: -700, t: 0, life: 20 });
    }

    updatePickups(dt) {
      const p = this.player;
      for (const k of this.pickups) {
        k.t += dt;
        if (k.life !== undefined) k.life -= dt;
        const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
        if (k.type === 'coin' && !p.dead && d < 200 && (k.t > 0.4 || k.fixed)) {
          k.fixed = false;
          k.vx += dx / d * 5000 * dt; k.vy += dy / d * 5000 * dt;
          k.vx *= 0.9; k.vy *= 0.9;
          k.x += k.vx * dt; k.y += k.vy * dt;
        } else if (!k.fixed) {
          k.vy = Math.min(1200, k.vy + 2200 * dt);
          k.w = k.h = 28;
          const r = this.move(k, dt);
          if (r.ground) { k.vy = Math.abs(k.vy) > 300 ? -k.vy * 0.4 : 0; k.vx *= 0.8; }
          if (r.wall) k.vx = -k.vx * 0.5;
        }
        if (!p.dead && Math.abs(dx) < 50 && Math.abs(dy) < 90 && (k.t > 0.3 || k.fixed)) {
          k.got = true;
          this.collect(k);
        }
      }
      this.pickups = this.pickups.filter(k => !k.got && (k.life === undefined || k.life > 0));
      for (const pad of this.pads || []) {
        pad.t += dt;
        if (!p.dead && Math.abs(p.x - pad.x) < 44 && Math.abs(p.y + p.h / 2 - pad.y) < 12 && p.vy >= 0) {
          p.vy = -2050; p.onGround = false; p.jets = 1; pad.t = 0; p.boostT = 0.6;
          this.audio.jump(true);
          this.ring(pad.x, pad.y, 140, '#6affff');
          this.burst(pad.x, pad.y, 20, { color: '#6affff', speed: 500, life: 0.5, size: 3, up: true });
        }
      }
    }

    collect(k) {
      const p = this.player;
      if (k.type === 'coin') {
        this.coins++;
        this.score += 50;
        this.audio.coin(this.coins);
        this.part({ x: k.x, y: k.y, life: 0.15, size: 50, color: '#ffd24a', kind: 'flash' });
        return;
      }
      this.audio.pickup(k.type);
      this.burst(k.x, k.y, 20, { color: '#fff2a0', speed: 400, life: 0.5, size: 3 });
      this.ring(k.x, k.y, 120, '#fff2a0');
      if (k.type === 'H') { p.hp = Math.min(P.hp, p.hp + 50); this.float(p.x, p.y - 110, '+50 HP', '#6aff8a'); }
      else if (k.type === 'G') { p.grenades = Math.min(9, p.grenades + 3); this.float(p.x, p.y - 110, '+3 GRENADES', '#ffd24a'); }
      else {
        const w = PICK_WEAPON[k.type];
        p.ammo[w] = Math.min((p.ammo[w] || 0) + WEAPONS[w].ammo, WEAPONS[w].ammo * 2);
        p.weapon = w;
        this.say(WEAPONS[w].name, WEAPONS[w].color, 1.4, true);
      }
    }

    // ---------- Partikel und Texte ----------

    part(o) {
      if (this.parts.length > 2400) return;
      o.max = o.life;
      o.vx = o.vx || 0; o.vy = o.vy || 0;
      this.parts.push(o);
    }

    updateParts(dt) {
      for (const q of this.parts) {
        q.life -= dt;
        if (q.g) q.vy += q.g * dt;
        if (q.drag) { const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; }
        const ox = q.x, oy = q.y;
        q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.vr) q.rot += q.vr * dt;
        if ((q.kind === 'casing' || q.kind === 'debris' || q.kind === 'goo') && q.vy > 0 && this.solidAt(q.x, q.y)) {
          if (q.kind === 'goo') { q.life = 0; if (Math.random() < 0.3) this.decal(q.x, Math.floor(q.y / 64) * 64, q.color, rnd(6, 14)); continue; }
          q.y = oy; q.x = ox;
          q.vy = -q.vy * 0.4; q.vx *= 0.6; q.vr = (q.vr || 0) * 0.6;
          if (Math.abs(q.vy) < 60) { q.vy = 0; q.g = 0; q.vx *= 0.5; }
        }
      }
      this.parts = this.parts.filter(q => q.life > 0);
    }

    burst(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = o.up ? rnd(-Math.PI * 0.9, -Math.PI * 0.1) : rnd(0, TAU), s = rnd(0.3, 1) * o.speed;
        this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3, life: rnd(0.5, 1) * o.life, size: o.size * rnd(0.6, 1.3),
          color: o.color, kind: 'spark' });
      }
    }
    ring(x, y, r, color) { this.part({ x, y, life: 0.35, size: r, color, kind: 'ring' }); }
    impact(x, y, color, big) {
      this.part({ x, y, life: 0.07, size: big ? 70 : 44, color, kind: 'flash' });
      for (let i = 0; i < (big ? 6 : 4); i++) this.part({ x, y, vx: rnd(-500, 500), vy: rnd(-500, 300), g: 1200, life: rnd(0.1, 0.3),
        size: rnd(2, 3), color, kind: 'spark' });
    }
    dust(x, y, n) {
      for (let i = 0; i < n; i++) this.part({ x: x + rnd(-20, 20), y: y - 4, vx: rnd(-220, 220), vy: rnd(-120, -20), drag: 3,
        life: rnd(0.4, 0.8), size: rnd(8, 18), color: '#6a6470', kind: 'smoke' });
    }
    gooBurst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, TAU), s = rnd(150, 800);
        this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 300, g: 1800, life: rnd(0.5, 1.1), size: rnd(4, 11),
          color: pick(['#8dff3a', '#5adf2a', '#c4ff6a']), kind: 'goo' });
      }
      this.part({ x, y, life: 0.2, size: 160, color: '#8dff3a', kind: 'flash' });
    }
    debris(x, y, n, kind) {
      const col = { crate: '#8a8f99', rock: '#4a4450', boss: '#3a2a48', brute: '#3a2a48', turret: '#3a2a48', drone: '#2a2030' }[kind] || '#555';
      for (let i = 0; i < n; i++) {
        const a = rnd(-Math.PI, 0), s = rnd(300, 900);
        this.part({ x: x + rnd(-20, 20), y: y + rnd(-20, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 2200, life: rnd(1, 2),
          size: rnd(5, 13), color: col, kind: 'debris', rot: rnd(0, TAU), vr: rnd(-15, 15), hot: Math.random() < 0.5 });
      }
    }
    decal(x, y, color, r) { this.decals.push({ x, y, color, r, t: 0 }); }
    float(x, y, text, color) { this.floaters.push({ x, y, text, color, t: 0, dur: 1.1 }); }
    say(text, color, dur = 2, small = false, sub = '') { this.banner = { text, color, t: 0, dur, small, sub }; }
  }

  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function inBox(x, y, b, r) { return x + r > b.x0 && x - r < b.x1 && y + r > b.y0 && y - r < b.y1; }
  // Schneidet die Strecke das Rechteck? (Slab-Test)
  function segBox(x0, y0, x1, y1, b) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    for (const [p, q] of [[-dx, x0 - b.x0], [dx, b.x1 - x0], [-dy, y0 - b.y0], [dy, b.y1 - y0]]) {
      if (p === 0) { if (q < 0) return false; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }

  window.Game = Game;
  window.GameDefs = { P, WEAPONS, ORDER, EN, BOSSES, RIGS, WALKERS, W, H };
})();
