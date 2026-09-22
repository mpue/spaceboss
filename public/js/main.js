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
    'queen_torso', 'queen_scythe', 'queen_leg', 'queen_tail'];
  const JPGS = ['ground', 'metal', 'sky', 'title', 'explosion', 'plasma', 'cave', 'hull', 'cave_bg', 'ship_bg'];

  // ---------- Eingabe ----------

  const keys = new Set();
  const pressed = {};
  const mouse = { x: W / 2, y: H / 2, down: false, right: false, moved: -99 };
  let device = 'keyboard';
  let lastMouseUse = -99;
  let padIndex = null;
  const padPrev = {};

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
    if (e.code === 'Escape' || e.code === 'KeyP') pressed.pause = true;
    if (e.code === 'KeyF') toggleFullscreen();
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
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('wheel', e => { if (e.deltaY > 0) pressed.next = true; else if (e.deltaY < 0) pressed.prev = true; e.preventDefault(); }, { passive: false });

  addEventListener('gamepadconnected', e => { if (padIndex === null) padIndex = e.gamepad.index; });
  addEventListener('gamepaddisconnected', e => { if (e.gamepad.index === padIndex) padIndex = null; });

  function readPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    // aktiv ist das Pad, auf dem zuletzt gedrückt wurde
    for (const p of pads) if (p && p.buttons.some(b => b.pressed)) padIndex = p.index;
    const p = padIndex !== null ? pads[padIndex] : null;
    if (!p) return null;
    const bt = i => !!(p.buttons[i] && p.buttons[i].pressed);
    const dz = v => Math.abs(v) < 0.25 ? 0 : v;
    const s = {
      lx: dz(p.axes[0] || 0), ly: dz(p.axes[1] || 0), rx: dz(p.axes[2] || 0), ry: dz(p.axes[3] || 0),
      a: bt(0), b: bt(1), x: bt(2), y: bt(3), lb: bt(4), rb: bt(5), lt: bt(6), rt: bt(7), start: bt(9), back: bt(8),
      up: bt(12), down: bt(13), left: bt(14), right: bt(15),
    };
    const edge = k => s[k] && !padPrev[k];
    const out = { s, edge };
    if (Object.values(s).some(v => v === true) || Math.hypot(s.lx, s.ly, s.rx, s.ry) > 0.4) device = 'gamepad';
    for (const k of Object.keys(s)) padPrev[k] = s[k];
    return out;
  }

  function rumble(strong, weak, ms) {
    if (device !== 'gamepad' || padIndex === null) return;
    const p = navigator.getGamepads()[padIndex];
    const va = p && p.vibrationActuator;
    if (va && va.playEffect) va.playEffect('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak }).catch(() => {});
  }

  function buildInput() {
    const pad = readPad();
    const ps = pad && pad.s;
    const now = performance.now() / 1000;
    const inp = {
      left: keys.has('KeyA') || keys.has('ArrowLeft') || (ps && (ps.lx < -0.3 || ps.left)),
      right: keys.has('KeyD') || keys.has('ArrowRight') || (ps && (ps.lx > 0.3 || ps.right)),
      up: keys.has('ArrowUp') || (ps && (ps.ly < -0.5 || ps.up)),
      down: keys.has('KeyS') || keys.has('ArrowDown') || (ps && (ps.ly > 0.6 || ps.down)),
      jump: held('jump') || (ps && ps.a),
      fire: held('fire') || mouse.down || (ps && (ps.rt || ps.x)),
      pressed: Object.assign({}, pressed),
    };
    // W springt nur, wenn mit der Maus gezielt wird; sonst zielt Pfeil-hoch nach oben
    if (ps) {
      if (pad.edge('a')) inp.pressed.jump = true;
      if (pad.edge('lt') || pad.edge('b')) inp.pressed.dash = true;
      if (pad.edge('rb')) inp.pressed.grenade = true;
      if (pad.edge('lb') || pad.edge('y')) inp.pressed.next = true;
      if (pad.edge('start') || pad.edge('back')) inp.pressed.pause = true;
      if (pad.edge('a') || pad.edge('start')) inp.pressed.ok = true;
      if (Math.hypot(ps.rx, ps.ry) > 0.35) inp.aimVec = { x: ps.rx, y: ps.ry };
    }
    const mouseAim = device === 'keyboard' && now - lastMouseUse < 4;
    if (mouseAim && !inp.aimVec) inp.aimPoint = { x: mouse.x, y: mouse.y };
    if (mouseAim) inp.up = false;                 // mit Maus: W = springen, nicht zielen
    if (!mouseAim && (keys.has('KeyW') || keys.has('ArrowUp')) && !keys.has('Space') && !keys.has('KeyK')) {
      // Tastatur ohne Maus: hoch zielt, gesprungen wird mit Leertaste/K
      inp.jump = keys.has('Space') || keys.has('KeyK') || (ps && ps.a);
      if (pressed.jump && !(keys.has('Space') || keys.has('KeyK'))) inp.pressed.jump = false;
    }
    if (pressed.click) inp.pressed.ok = true;
    for (const k of Object.keys(pressed)) delete pressed[k];
    inp.mouseAim = mouseAim;
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
  let mode = 'title';          // title | play | pause | over | won
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

  let last = performance.now(), titleT = 0, fpsAcc = 0, fpsN = 0;
  const startLevel = Math.max(0, Math.min(Level.LEVELS.length - 1, (Number(params.get('level')) || 1) - 1));
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
    const inp = buildInput();
    const loading = loaded < total ? loaded / total : 0;
    if (mode === 'title') {
      titleT += dt;
      if (renderer) renderer.draw(null, { time: titleT, loading, device });
      if (!loading && (inp.pressed.ok || inp.pressed.jump)) startGame(startLevel);
    } else {
      if (inp.pressed.pause && (mode === 'play' || mode === 'pause')) {
        mode = mode === 'play' ? 'pause' : 'play';
        audio.muffle(mode === 'pause');
        audio.laser(false);
      }
      if (mode === 'play' || mode === 'over' || mode === 'won') game.update(dt, mode === 'play' ? inp : { pressed: {} });
      if (mode === 'play' && game.over) { mode = 'over'; game.endT = 0; audio.fadeMusic(2, 0.15); }
      if (mode === 'play' && game.won && game.endT > 3.5) { mode = 'won'; game.endT = 0; }
      if ((mode === 'over' || mode === 'won') && game.endT > 2 && (inp.pressed.ok || inp.pressed.jump)) {
        if (mode === 'won' && !game.L.last) startGame(game.L.index + 1, game.carry());
        else { mode = 'title'; game = null; titleT = 0; audio.stopMusic(); audio.muffle(false); }
      }
      if (game) renderer.draw(game, {
        mode, fps: showFps ? fps : 0, device, zoom: Number(params.get('zoom')) || 0, zoomOn: params.get('on'),
        cross: inp.mouseAim && mode === 'play' ? { x: mouse.x, y: mouse.y } : null,
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
  })();
})();
