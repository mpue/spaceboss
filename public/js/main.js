// Spaceboss – Laden, Eingabe (Tastatur, Maus, Gamepad), Ablauf.
(function () {
  'use strict';

  const W = 1920, H = 1080;
  const params = new URLSearchParams(location.search);
  const canvas = document.getElementById('game');
  const audio = new AudioEngine();

  const IMAGES = ['hero_torso', 'hero_arm', 'hero_leg', 'hero_full', 'crawler', 'drone', 'jelly', 'turret', 'brute', 'pod',
    'crate', 'barrel', 'capsule', 'medkit', 'platform', 'colony', 'spires', 'wreck',
    'spitter', 'bat', 'saucer', 'sentinel', 'fungi', 'machinery',
    'boss_torso', 'boss_cannon', 'boss_claw', 'boss_leg',
    'queen_torso', 'queen_scythe', 'queen_leg', 'queen_tail',
    'sandworm', 'skimmer', 'thorn', 'mortar', 'dev_maw', 'dev_seg', 'dev_arm', 'dunes', 'debris',
    'leech', 'stingfly', 'sporepod', 'mudhulk', 'mom_body', 'mom_seg', 'mom_tip', 'trees', 'reeds'];
  const JPGS = ['ground', 'metal', 'sky', 'title', 'explosion', 'plasma', 'cave', 'hull', 'cave_bg', 'ship_bg', 'sand', 'rust', 'desert_bg', 'mud', 'bark', 'swamp_bg'];

  // ---------- Eingabe ----------

  const keys = new Set();
  const pressed = {};
  const mouse = { x: W / 2, y: H / 2, down: false, right: false, moved: -99 };
  let device = 'keyboard';
  let lastMouseUse = -99;

  const KEYMAP = {
    jump: ['Space', 'KeyK', 'KeyW', 'ArrowUp'],
    fire: ['KeyJ', 'KeyZ'],
    dash: ['ShiftLeft', 'ShiftRight', 'KeyL'],
    grenade: ['KeyG', 'KeyX'],
    prev: ['KeyQ'], next: ['KeyE'],
  };
  const held = a => KEYMAP[a].some(k => keys.has(k));

  addEventListener('keydown', e => {
    if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
    keys.add(e.code);
    device = 'keyboard';
    for (const [a, list] of Object.entries(KEYMAP)) if (list.includes(e.code)) pressed[a] = true;
    const slot = { Digit1: 'blaster', Digit2: 'spread', Digit3: 'laser', Digit4: 'rocket' }[e.code];
    if (slot) pressed.slot = slot;
    if (e.code === 'Enter') pressed.ok = true;
    if (['ArrowLeft', 'KeyA'].includes(e.code)) pressed.menuLeft = true;
    if (['ArrowRight', 'KeyD'].includes(e.code)) pressed.menuRight = true;
    if (e.code === 'Escape') pressed.back = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pressed.pause = true;
    // Vollbild nur in den Menüs: im Spiel liegt F direkt neben D und wurde dauernd aus Versehen getroffen
    if (e.code === 'KeyF' && mode !== 'play') toggleFullscreen();
    if (e.code === 'F3') { showFps = !showFps; e.preventDefault(); }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    unlock();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.down = mouse.right = false; });

  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = r.left + (r.width - W * s) / 2, oy = r.top + (r.height - H * s) / 2;
    return { x: (e.clientX - ox) / s, y: (e.clientY - oy) / s };
  }
  canvas.addEventListener('mousemove', e => {
    Object.assign(mouse, toCanvas(e));
    lastMouseUse = performance.now() / 1000;
    if (device !== 'gamepad' || Math.abs(e.movementX) + Math.abs(e.movementY) > 4) device = 'keyboard';
  });
  canvas.addEventListener('mousedown', e => {
    Object.assign(mouse, toCanvas(e));
    lastMouseUse = performance.now() / 1000;
    device = 'keyboard';
    if (e.button === 0) { mouse.down = true; pressed.click = true; }
    if (e.button === 2) { mouse.right = true; pressed.grenade = true; }
    unlock();
  });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
  canvas.addEventListener('dblclick', () => toggleFullscreen());   // im Spiel geht Vollbild per Doppelklick
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { if (e.deltaY > 0) pressed.next = true; else if (e.deltaY < 0) pressed.prev = true; e.preventDefault(); }, { passive: false });

  // ---------- Gamepad ----------
  //
  // Layout (XInput / DualShock):
  //   linker Stick, D-Pad   laufen (analog)        rechter Stick   zielen (360°)
  //   A (✕)                 springen, bestätigen   B (○)           Dash, zurück
  //   X (□)                 feuern                 Y (△)           nächste Waffe
  //   RT (R2)               feuern                 LT (L2)         Dash
  //   RB (R1)               Granate                LB (L1)         vorige Waffe
  //   Start / Back          Pause
  //
  // Pads ohne "standard"-Mapping werden nach denselben Indizes gelesen; melden sie keine
  // Trigger-Tasten, kommen LT/RT aus den Achsen 4 und 5.
  const DEAD = 0.22, TRIG = 0.3;
  const PAD = { index: null, id: '', prev: {}, note: null, noteT: 0, connected: false };

  // Radiale Totzone: kleine Auslenkungen fallen weg, der Rest wird wieder auf 0..1 gestreckt
  function stick(x, y) {
    const m2 = Math.hypot(x, y);
    if (m2 < DEAD) return { x: 0, y: 0, m: 0 };
    const k = (m2 - DEAD) / (1 - DEAD) / m2;
    return { x: x * k, y: y * k, m: Math.min(1, (m2 - DEAD) / (1 - DEAD)) };
  }

  function allPads() {
    return navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
  }

  addEventListener('gamepadconnected', e => {
    PAD.index = e.gamepad.index; PAD.id = e.gamepad.id; PAD.connected = true;
    note('GAMEPAD CONNECTED', short(e.gamepad.id));
  });
  addEventListener('gamepaddisconnected', e => {
    if (e.gamepad.index !== PAD.index) return;
    PAD.index = null; PAD.connected = false;
    note('GAMEPAD DISCONNECTED', 'PAUSED');
    if (mode === 'play') { mode = 'pause'; audio.muffle(true); audio.laser(false); }
  });
  const short = id => String(id).replace(/\s*\([^)]*\)\s*/g, ' ').trim().slice(0, 28).toUpperCase();
  function note(text, sub) { PAD.note = { text, sub }; PAD.noteT = 3; }

  function readPad() {
    const list = allPads();
    if (!list.length) { PAD.index = null; PAD.connected = false; return null; }
    PAD.connected = true;
    // Aktiv ist das Pad, an dem zuletzt etwas bewegt oder gedrückt wurde
    for (const p of list) {
      const busy = p.buttons.some(b => b.pressed || b.value > TRIG) ||
        p.axes.some((v, i) => i < 4 && Math.abs(v) > 0.5);
      if (busy) { PAD.index = p.index; PAD.id = p.id; }
    }
    const p = list.find(x => x.index === PAD.index) || list[0];
    PAD.index = p.index;
    const bt = i => p.buttons[i] || { pressed: false, value: 0 };
    const ax = i => p.axes[i] || 0;
    // Trigger: bevorzugt als Taste mit Analogwert, sonst aus den Achsen (nur wenn es die Tasten nicht gibt)
    const trig = (i, axis) => {
      if (p.buttons.length > i) { const b = bt(i); return b.pressed ? Math.max(b.value, 1) : b.value; }
      return p.axes.length > axis ? (ax(axis) + 1) / 2 : 0;
    };
    const s = {
      ls: stick(ax(0), ax(1)), rs: stick(ax(2), ax(3)),
      lt: trig(6, 4), rt: trig(7, 5),
      a: bt(0).pressed, b: bt(1).pressed, x: bt(2).pressed, y: bt(3).pressed,
      lb: bt(4).pressed, rb: bt(5).pressed, back: bt(8).pressed, start: bt(9).pressed,
      up: bt(12).pressed, down: bt(13).pressed, left: bt(14).pressed, right: bt(15).pressed,
    };
    // Aktionen unabhängig davon, ob Taste oder Trigger benutzt wird
    s.fire = s.rt > TRIG || s.x;
    s.dash = s.lt > TRIG || s.b;
    s.jump = s.a;
    s.grenade = s.rb;
    s.nextW = s.y;
    s.prevW = s.lb;
    s.menu = s.start || s.back;
    if (Object.entries(s).some(([k, v]) => v === true && k !== 'menu') || s.ls.m > 0.4 || s.rs.m > 0.4 ||
        s.lt > TRIG || s.rt > TRIG) device = 'gamepad';
    // Flanke: gegen den Zustand des vorigen Frames prüfen, erst danach merken
    const prev = PAD.prev;
    const now = {};
    for (const k of Object.keys(s)) now[k] = s[k] === true;
    PAD.prev = now;
    const edge = k => now[k] && !prev[k];
    return { s, edge, id: p.id, raw: p };
  }

  function rumble(strong, weak, ms) {
    if (device !== 'gamepad' || PAD.index === null) return;
    const p = allPads().find(x => x.index === PAD.index);
    const va = p && (p.vibrationActuator || (p.hapticActuators && p.hapticActuators[0]));
    if (!va) return;
    if (va.playEffect) va.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
    else if (va.pulse) va.pulse(Math.max(strong, weak), ms);
  }

  function buildInput(dt) {
    const pad = readPad();
    const ps = pad && pad.s;
    const now = performance.now() / 1000;
    if (PAD.noteT > 0) PAD.noteT -= dt;
    // Laufen: Tastatur digital, Stick und D-Pad analog
    let moveX = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    if (ps) {
      moveX += ps.ls.x + (ps.right ? 1 : 0) - (ps.left ? 1 : 0);
      moveX = Math.max(-1, Math.min(1, moveX));
    }
    const stickAim = ps && ps.rs.m > 0.35;
    const inp = {
      moveX,
      left: moveX < -0.25, right: moveX > 0.25,
      up: keys.has('ArrowUp') || (ps && !stickAim && (ps.ls.y < -0.55 || ps.up)),
      down: keys.has('KeyS') || keys.has('ArrowDown') || (ps && (ps.ls.y > 0.6 || ps.down)),
      jump: held('jump') || (ps && ps.jump),
      fire: held('fire') || mouse.down || (ps && ps.fire),
      pressed: Object.assign({}, pressed),
    };
    if (ps) {
      if (pad.edge('jump')) inp.pressed.jump = true;
      if (pad.edge('dash')) inp.pressed.dash = true;
      if (pad.edge('grenade')) inp.pressed.grenade = true;
      if (pad.edge('nextW')) inp.pressed.next = true;
      if (pad.edge('prevW')) inp.pressed.prev = true;
      if (pad.edge('start') || pad.edge('back')) inp.pressed.pause = true;
      if (pad.edge('left') || (ps.ls.x < -0.5 && !PAD.menuL)) inp.pressed.menuLeft = true;
      if (pad.edge('right') || (ps.ls.x > 0.5 && !PAD.menuR)) inp.pressed.menuRight = true;
      if (pad.edge('b')) inp.pressed.back = true;
      PAD.menuL = ps.ls.x < -0.5; PAD.menuR = ps.ls.x > 0.5;
      if (pad.edge('jump') || pad.edge('start')) inp.pressed.ok = true;
      if (stickAim) inp.aimVec = { x: ps.rs.x, y: ps.rs.y };
      // rechter Stick losgelassen: die zuletzt gezielte Richtung bleibt stehen
      else if (device === 'gamepad' && !inp.up && !(inp.down && !inp.left && !inp.right)) inp.aimHold = true;
    }
    const mouseAim = device === 'keyboard' && now - lastMouseUse < 4;
    if (mouseAim && !inp.aimVec) inp.aimPoint = { x: mouse.x, y: mouse.y };
    if (mouseAim) { inp.up = false; inp.aimHold = false; }
    if (!mouseAim && device === 'keyboard' && (keys.has('KeyW') || keys.has('ArrowUp')) && !keys.has('Space') && !keys.has('KeyK')) {
      // Tastatur ohne Maus: hoch zielt, gesprungen wird mit Leertaste/K
      inp.jump = keys.has('Space') || keys.has('KeyK');
      if (pressed.jump && !(keys.has('Space') || keys.has('KeyK'))) inp.pressed.jump = false;
    }
    if (pressed.click) inp.pressed.ok = true;
    for (const k of Object.keys(pressed)) delete pressed[k];
    inp.mouseAim = mouseAim;
    inp.pad = ps || null;
    return inp;
  }

  // ---------- Laden ----------

  const images = {};
  let loaded = 0;
  const total = IMAGES.length + JPGS.length;
  function loadImage(name, ext) {
    return new Promise(res => {
      const im = new Image();
      im.onload = () => { images[name] = im; loaded++; res(); };
      im.onerror = () => { console.warn('missing asset', name); loaded++; res(); };
      im.src = 'assets/' + name + '.' + ext;
    });
  }

  let renderer = null;
  let game = null;
  let mode = 'title';          // title | select | play | pause | over | won
  let showFps = false, fps = 0;
  let unlocked = false;

  // Musik aus music/: jedes Level nennt seine Songs über einen Namensteil (siehe Level.LEVELS[].music)
  let songs = [];
  const musicBuf = new Map();           // url -> Promise<AudioBuffer|null>
  let musicReq = 0;
  const songsReady = fetch('api/songs').then(r => r.json()).then(s => { songs = s; }).catch(e => console.warn('no music', e));
  function songFor(name) {
    return songs.find(s => s.name.toLowerCase().includes(name)) || songs[0];
  }
  function loadSong(s) {
    if (!musicBuf.has(s.url)) {
      musicBuf.set(s.url, fetch(s.url).then(r => r.arrayBuffer()).then(d => audio.ensure().decodeAudioData(d))
        .catch(e => { console.warn('song not loaded', s.url, e); return null; }));
    }
    return musicBuf.get(s.url);
  }
  async function playMusic(name, vol) {
    const req = ++musicReq;               // nur die zuletzt angeforderte Musik spielt
    await songsReady;
    const s = songFor(name);
    if (!s) return;
    const b = await loadSong(s);
    if (b && req === musicReq) audio.playMusic(b, vol);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    audio.ensure();
    audio.loadSamples();
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen().catch(() => {});
  }

  // index: Level (0..2), carry: Punkte, Leben und Waffen aus dem vorigen Level
  function startGame(index = 0, carry = null) {
    const level = Level.build(index);
    const music = level.def.music;
    game = new Game(level, audio, {
      rumble, carry,
      god: params.get('god') === '1',
      weak: Number(params.get('weak')) ? 400 : 0,
      at: params.get('at') && !carry ? Number(params.get('at')) : 0,
      onBoss: () => { audio.fadeMusic(1.5); setTimeout(() => playMusic(music.boss, 0.6), 1600); },
    });
    window.SB = game;
    window.SBR = renderer;                     // zum Nachschauen und Justieren in der Konsole (window.game ist das Canvas)
    mode = 'play';
    audio.confirm();
    audio.muffle(false);
    audio.stopMusic();
    playMusic(music.level, 0.5);
    // Songs des nächsten Levels schon vorladen
    songsReady.then(() => {
      const nx = Level.LEVELS[index + 1];
      if (nx) { loadSong(songFor(nx.music.level)); loadSong(songFor(nx.music.boss)); }
    });
  }

  // ---------- Schleife ----------

  // Fadenkreuz: bei Maus dort, wo die Maus ist, mit Stick in Zielrichtung vor dem Helden
  function crosshair(inp, g) {
    const p = g.player;
    if (p.dead) return null;
    if (inp.mouseAim) return { x: mouse.x, y: mouse.y };
    if (device !== 'gamepad') return null;
    const d = 260;
    return { x: p.x + Math.cos(p.aim) * d - g.cam.x, y: p.y + Math.sin(p.aim) * d - g.cam.y, soft: true };
  }

  // Bestwerte je Level im Browser merken (für die Levelkarten)
  const BEST_KEY = 'spaceboss.best';
  function loadBest() {
    try { return JSON.parse(localStorage.getItem(BEST_KEY)) || []; } catch (e) { return []; }
  }
  function saveCleared(index, score, time) {
    try {
      const b = loadBest();
      const old = b[index] || {};
      b[index] = { cleared: true, score: Math.max(old.score || 0, score), time: old.time ? Math.min(old.time, time) : time };
      localStorage.setItem(BEST_KEY, JSON.stringify(b));
      best = b;
    } catch (e) { /* privater Modus: dann eben ohne */ }
  }
  let best = loadBest();

  // Levelkarten: Lage der Karten für Maus und Zeichnung
  function cardRects() {
    const n = Level.LEVELS.length, cw = 300, gap = 28;
    const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
    return Level.LEVELS.map((def, i) => ({ x: x0 + i * (cw + gap), y: 380, w: cw, h: 220, def, i }));
  }

  const padDebug = params.get('pad') === '1';
  let last = performance.now(), titleT = 0, fpsAcc = 0, fpsN = 0, sel = 0;
  const startLevel = Math.max(0, Math.min(Level.LEVELS.length - 1, (Number(params.get('level')) || 1) - 1));
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const inp = buildInput(dt);
    const loading = loaded < total ? loaded / total : 0;
    if (mode === 'title' || mode === 'select') {
      titleT += dt;
      const common = { time: titleT, loading, device, note: PAD.noteT > 0 ? PAD.note : null,
        pad: padDebug ? inp.pad : null };
      if (mode === 'title') {
        if (renderer) renderer.draw(null, common);
        if (!loading && (inp.pressed.ok || inp.pressed.jump)) { mode = 'select'; audio.confirm(); unlock(); }
      } else {
        // Levelauswahl
        const cards = cardRects();
        if (inp.pressed.menuLeft) { sel = (sel + cards.length - 1) % cards.length; audio.menuMove(); }
        if (inp.pressed.menuRight) { sel = (sel + 1) % cards.length; audio.menuMove(); }
        if (inp.mouseAim) {
          const hit = cards.findIndex(c => mouse.x > c.x && mouse.x < c.x + c.w && mouse.y > c.y && mouse.y < c.y + c.h);
          if (hit >= 0 && hit !== sel) { sel = hit; audio.menuMove(); }
        }
        const overCard = inp.mouseAim && cards.some(c => mouse.x > c.x && mouse.x < c.x + c.w && mouse.y > c.y && mouse.y < c.y + c.h);
        if (inp.pressed.back) { mode = 'title'; audio.menuMove(); }
        // mit der Maus startet nur ein Klick auf eine Karte, sonst jede Bestätigungstaste
        else if (inp.pressed.jump || (inp.pressed.ok && (!inp.pressed.click || overCard))) startGame(sel);
        if (renderer) renderer.draw(null, Object.assign(common, { select: { sel, cards, best },
          cross: inp.mouseAim ? { x: mouse.x, y: mouse.y } : null }));
      }
    } else {
      if (inp.pressed.pause && (mode === 'play' || mode === 'pause')) {
        mode = mode === 'play' ? 'pause' : 'play';
        audio.muffle(mode === 'pause');
        audio.laser(false);
      }
      if (mode === 'play' || mode === 'over' || mode === 'won') game.update(dt, mode === 'play' ? inp : { pressed: {} });
      if (mode === 'play' && game.over) { mode = 'over'; game.endT = 0; audio.fadeMusic(2, 0.15); }
      if (mode === 'play' && game.won && !game.saved) {
        game.saved = true;                       // Level geschafft: Bestwert merken
        saveCleared(game.L.index, game.score, Math.floor(game.time));
      }
      if (mode === 'play' && game.won && game.endT > 3.5) { mode = 'won'; game.endT = 0; }
      if ((mode === 'over' || mode === 'won') && game.endT > 2 && (inp.pressed.ok || inp.pressed.jump)) {
        if (mode === 'won' && !game.L.last) startGame(game.L.index + 1, game.carry());
        else { mode = 'select'; sel = game.L.index; game = null; titleT = 0; audio.stopMusic(); audio.muffle(false); }
      }
      if (game) renderer.draw(game, {
        mode, fps: showFps ? fps : 0, device, zoom: Number(params.get('zoom')) || 0, zoomOn: params.get('on'),
        cross: mode === 'play' ? crosshair(inp, game) : null,
        note: PAD.noteT > 0 ? PAD.note : null,
        pad: padDebug ? inp.pad : null,
      });
    }
    requestAnimationFrame(frame);
  }

  (async function boot() {
    renderer = new Renderer(canvas, images);        // Titel mit Ladebalken, Bilder kommen nach
    requestAnimationFrame(frame);
    songsReady.then(() => { const d = Level.LEVELS[0].music; loadSong(songFor(d.level)); });
    await Promise.all([...IMAGES.map(n => loadImage(n, 'png')), ...JPGS.map(n => loadImage(n, 'jpg'))]);
    await document.fonts.ready;
    renderer = new Renderer(canvas, images);
    if (params.get('play') === '1') startGame(startLevel);
    else if (params.get('select') === '1') { mode = 'select'; sel = startLevel; }
  })();
})();
