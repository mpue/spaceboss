// Spaceboss – Darstellung auf einem 1920×1080-Canvas.
(function () {
  'use strict';

  const W = 1920, H = 1080, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const FONT = '"Orbitron", "Segoe UI", sans-serif';

  // Der Held aus Teilen. Punkte in Bruchteilen des jeweils freigestellten Bildes (siehe tools/key_assets.py).
  const HERO = {
    torsoH: 104,                          // Zeichenhöhe des Oberkörpers
    stump: { x: 0.38, y: 0.60 },          // Armansatz im Torso-Bild
    hip: { x: 0.58, y: 0.90 },            // Hüfte im Torso-Bild
    hipBack: -10,                         // hinteres Bein etwas versetzt
    shoulder: { x: 0.10, y: 0.45 },       // Schultergelenk im Arm-Bild
    muzzle: { x: 1.0, y: 0.33 },          // Mündung im Arm-Bild
    knee: 0.55,                           // Kniehöhe im Bein-Bild
    legTop: 0.02,
  };

  // Bosse aus Einzelteilen. Punkte in Bruchteilen des jeweils freigestellten Bildes.
  const BOSS = {
    boss: {
      torso: { hip: { x: 0.52, y: 0.93 } },
      leg: { hip: { x: 0.35, y: 0.08 }, knee: { x: 0.68, y: 0.40 }, ankle: { x: 0.32, y: 0.80 }, cut: 0.40 },
      arm: { a: { x: 0.10, y: 0.45 }, b: { x: 1.0, y: 0.45 } },
      arm2: { a: { x: 0.08, y: 0.50 }, b: { x: 0.97, y: 0.50 } },
      arm2Front: true,
    },
    rot: {
      body: { mid: { x: 0.5, y: 0.5 } },
      seg: { a: { x: 0.5, y: 0.08 }, b: { x: 0.5, y: 0.92 } },
      tip: { a: { x: 0.05, y: 0.5 }, b: { x: 0.95, y: 0.5 } },
    },
    worm: {
      head: { a: { x: 0.85, y: 0.5 }, b: { x: 0.05, y: 0.5 } },   // Nacken -> Maul (Kopf zeigt nach links)
      arm: { a: { x: 0.08, y: 0.50 }, b: { x: 0.97, y: 0.50 } },
      tail: { a: { x: 0.02, y: 0.45 }, b: { x: 0.98, y: 0.5 } },  // Ansatz -> Spitze
    },
    queen: {
      torso: { hip: { x: 0.45, y: 0.97 } },
      leg: { hip: { x: 0.45, y: 0.06 }, knee: { x: 0.85, y: 0.40 }, ankle: { x: 0.20, y: 0.68 }, cut: 0.42 },
      arm: { a: { x: 0.08, y: 0.50 }, b: { x: 0.99, y: 0.68 } },
      arm2: { a: { x: 0.08, y: 0.50 }, b: { x: 0.99, y: 0.68 } },
      tail: { a: { x: 0.03, y: 0.50 }, b: { x: 0.98, y: 0.45 } },
      arm2Front: false,
    },
  };

  // Ansatzpunkte der Laufgegner, als Bruchteile ihrer Teilbilder (die Kunst schaut nach links)
  const WALK = {
    mortar: {
      torso: { hip: { x: 0.50, y: 0.88 } },
      leg: { hip: { x: 0.45, y: 0.07 }, knee: { x: 0.72, y: 0.49 }, ankle: { x: 0.36, y: 0.83 }, cut: 0.49 },
    },
    mudhulk: {
      torso: { hip: { x: 0.62, y: 0.64 } },
      leg: { hip: { x: 0.42, y: 0.06 }, knee: { x: 0.72, y: 0.50 }, ankle: { x: 0.42, y: 0.84 }, cut: 0.50 },
    },
  };

  function glow(color, r, core = 0.25) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(core, color);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function tinted(img, color, alpha = 1) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Teilbild (für Oberschenkel / Unterschenkel)
  function slice(img, y0, y1) {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = Math.round((y1 - y0) * img.height);
    c.getContext('2d').drawImage(img, 0, -Math.round(y0 * img.height));
    return c;
  }

  class Renderer {
    constructor(canvas, images) {
      this.cv = canvas;
      canvas.width = W; canvas.height = H;
      this.c = canvas.getContext('2d', { alpha: false });
      this.img = images;
      this.textCache = new Map();
      this.white = {};
      for (const [k, im] of Object.entries(images)) if (im && k !== 'sky' && k !== 'title') this.white[k] = tinted(im, '#ffffff', 0.6);
      this.glows = {
        cyan: glow('#5ae0ff', 48), orange: glow('#ff9a3c', 48), pink: glow('#ff5ad2', 48), green: glow('#7dff6a', 48),
        red: glow('#ff4a5a', 48), white: glow('#ffffff', 48, 0.5), fire: glow('#ff8a2a', 64, 0.15), gold: glow('#ffd24a', 48),
      };
      this.glowCache = new Map();
      // weicher Rauch
      this.smoke = document.createElement('canvas');
      this.smoke.width = this.smoke.height = 64;
      {
        const g = this.smoke.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      }
      this.smokeTint = new Map();
      // Vignette
      this.vig = document.createElement('canvas');
      this.vig.width = W / 4; this.vig.height = H / 4;
      {
        const g = this.vig.getContext('2d'), gr = g.createRadialGradient(W / 8, H / 8, H / 10, W / 8, H / 8, W / 7);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.7)');
        g.fillStyle = gr; g.fillRect(0, 0, W / 4, H / 4);
      }
      this.hurtVig = document.createElement('canvas');
      this.hurtVig.width = W / 4; this.hurtVig.height = H / 4;
      {
        const g = this.hurtVig.getContext('2d'), gr = g.createRadialGradient(W / 8, H / 8, H / 12, W / 8, H / 8, W / 7);
        gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, 'rgba(255,20,30,0.85)');
        g.fillStyle = gr; g.fillRect(0, 0, W / 4, H / 4);
      }
      // Kulissen einmal eingefärbt (Dunst)
      this.layers = {};
      this.tintCache = new Map();
      if (images.wreck) this.layers.wreck = images.wreck;
      // Held: Beine am Knie geteilt, hinteres Bein und Arm abgedunkelt
      if (images.hero_leg) {
        this.thigh = slice(images.hero_leg, HERO.legTop, HERO.knee + 0.04);
        this.shin = slice(images.hero_leg, HERO.knee - 0.02, 1);
        this.thighD = tinted(this.thigh, '#0a0612', 0.45);
        this.shinD = tinted(this.shin, '#0a0612', 0.45);
      }
      if (images.hero_torso) this.torsoW = tinted(images.hero_torso, '#ffffff', 0.7);
      this.rigCache = new Map();          // geteilte Beine und abgedunkelte Gliedmaßen je Boss
      this.dust = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: 0.3 + Math.random() * 1.2,
        s: Math.random() * TAU }));
      this.levelCache = null;
    }

    glowOf(color) {
      let g = this.glowCache.get(color);
      if (!g) { g = glow(color, 48); this.glowCache.set(color, g); }
      return g;
    }
    smokeOf(color) {
      let g = this.smokeTint.get(color);
      if (!g) {
        g = document.createElement('canvas'); g.width = g.height = 64;
        const x = g.getContext('2d');
        x.drawImage(this.smoke, 0, 0);
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = color; x.fillRect(0, 0, 64, 64);
        this.smokeTint.set(color, g);
      }
      return g;
    }

    spr(name, x, y, h, o = {}) {
      const im = o.img || this.img[name];
      if (!im) return false;
      const w = h * im.width / im.height, c = this.c;
      c.save();
      c.translate(x, y);
      if (o.rot) c.rotate(o.rot);
      if (o.flip || o.flipY || o.sx) c.scale((o.flip ? -1 : 1) * (o.sx || 1), (o.flipY ? -1 : 1) * (o.sy || 1));
      if (o.alpha !== undefined) c.globalAlpha = o.alpha;
      if (o.add) c.globalCompositeOperation = 'lighter';
      const ax = o.ax ?? 0.5, ay = o.ay ?? 0.5;
      c.drawImage(im, -w * ax, -h * ay, w, h);
      if (o.flash && this.white[name]) {
        c.globalAlpha = 0.7 * o.flash * (o.alpha ?? 1);
        c.drawImage(this.white[name], -w * ax, -h * ay, w, h);
      }
      c.restore();
      return true;
    }

    gl(img, x, y, size, alpha = 1) {
      const c = this.c;
      c.globalAlpha = alpha;
      c.drawImage(img, x - size / 2, y - size / 2, size, size);
    }

    glowText(text, font, color, glowCol, blur, x, y, align = 'center') {
      const key = text + '|' + font + '|' + color + '|' + glowCol + '|' + blur;
      let e = this.textCache.get(key);
      if (!e) {
        if (this.textCache.size > 300) this.textCache.clear();
        const m = document.createElement('canvas').getContext('2d');
        m.font = font;
        const w = Math.ceil(m.measureText(text).width) + blur * 4, size = parseInt(font.match(/(\d+)px/)[1], 10);
        const h = Math.ceil(size * 1.4) + blur * 4;
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, w); cv.height = h;
        const g = cv.getContext('2d');
        g.font = font;
        g.textBaseline = 'alphabetic';
        g.fillStyle = color;
        if (blur) { g.shadowColor = glowCol; g.shadowBlur = blur; }
        g.fillText(text, blur * 2, blur * 2 + size);
        if (blur) g.fillText(text, blur * 2, blur * 2 + size);
        e = { cv, w, h, off: blur * 2 + size };
        this.textCache.set(key, e);
      }
      const dx = align === 'center' ? x - e.w / 2 : align === 'right' ? x - e.w : x;
      this.c.drawImage(e.cv, dx, y - e.off);
      return e.w;
    }

    // ---------- Frame ----------

    draw(g, screen) {
      const c = this.c;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      if (!g) { if (screen.select) this.drawSelect(screen); else this.drawTitle(screen); return; }
      if (!this.levelCache || this.levelCache.L !== g.L) this.prepLevel(g.L);
      const sh = g.shake * g.shake;
      const ox = (Math.random() * 2 - 1) * 26 * sh, oy = (Math.random() * 2 - 1) * 20 * sh;
      const cx = Math.round(g.cam.x - ox), cy = Math.round(g.cam.y - oy);
      this.drawBackground(g, cx, cy);
      c.save();
      if (screen.zoom) {                  // Debug: ?zoom=3 vergrößert um den Helden (mit &on=boss um den Boss)
        const t = screen.zoomOn === 'boss' && g.boss ? g.boss : g.player;
        c.translate(W / 2, H / 2); c.scale(screen.zoom, screen.zoom); c.translate(-t.x, -t.y);
      } else c.translate(-cx, -cy);
      this.drawWorldBack(g);
      for (const e of g.enemies) if (e.type === 'boss') this.drawBoss(g, e);
      this.drawTiles(g, cx, cy);
      this.drawDecals(g);
      this.drawProps(g);
      this.drawPickups(g);
      for (const e of g.enemies) if (e.type !== 'boss') this.drawEnemy(g, e);
      this.drawStrikes(g);
      this.drawPlayer(g);
      this.drawWater(g, cx, cy);
      this.drawBullets(g);
      this.drawParts(g);
      this.drawClouds(g);
      this.drawFloaters(g);
      c.restore();
      this.drawForeground(g);
      this.drawHud(g, screen);
    }

    // ---------- Hintergrund ----------

    // Kulisse aus dem Level-Theme: [Bild, Dunstfarbe, Dunst, Parallaxe, Unterkante, Höhe]
    layer(spec) {
      if (!spec || !this.img[spec[0]]) return null;
      const key = spec.slice(0, 3).join('|');
      let im = this.tintCache.get(key);
      if (!im) { im = tinted(this.img[spec[0]], spec[1], spec[2]); this.tintCache.set(key, im); }
      return im;
    }

    drawBackground(g, cx, cy) {
      const th = g.L.theme, c = this.c, sky = this.img[th.sky];
      if (sky) {
        const h = H * 1.12, w = h * sky.width / sky.height;
        let x = -((cx * 0.04) % (w * 2));
        for (let i = 0; x < W; i++, x += w) {
          c.save();
          if (i % 2) { c.translate(x + w, 0); c.scale(-1, 1); c.drawImage(sky, 0, -cy * 0.03 - 40, w, h); }
          else c.drawImage(sky, x, -cy * 0.03 - 40, w, h);
          c.restore();
        }
      } else { c.fillStyle = '#081018'; c.fillRect(0, 0, W, H); }
      for (const spec of [th.far, th.near]) if (spec) this.parallax(this.layer(spec), cx, cy, spec[3], spec[4], spec[5]);
      // Bodennebel
      const gr = c.createLinearGradient(0, 600, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, th.fog);
      c.fillStyle = gr; c.fillRect(0, 600, W, H - 600);
    }

    parallax(img, cx, cy, k, baseY, h) {
      if (!img) return;
      const c = this.c, w = h * img.width / img.height;
      const y = baseY - h - (cy - (this.levelCache.L.ph - H)) * k;
      let x = -((cx * k) % (w * 2));
      for (let i = 0; x < W; i++, x += w) {
        if (i % 2) { c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(img, 0, 0, w, h); c.restore(); }
        else c.drawImage(img, x, y, w, h);
      }
    }

    drawWorldBack(g) {
      const c = this.c, wr = this.layers.wreck;
      if (wr && g.wreck) {
        const h = 330, w = h * wr.width / wr.height;
        c.drawImage(wr, g.wreck.x - 60, g.wreck.y - h + 60, w, h);
        c.globalCompositeOperation = 'lighter';
        const f = 0.6 + 0.4 * Math.sin(g.time * 13) * Math.sin(g.time * 7);
        this.gl(this.glows.fire, g.wreck.x + w * 0.35, g.wreck.y - 120, 300, 0.35 * f);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
      }
    }

    // ---------- Kacheln ----------

    prepLevel(L) {
      // Tiefe unter der Oberfläche (für die Schattierung) und Plattform-Läufe
      const depth = new Uint8Array(L.w * L.h);
      for (let x = 0; x < L.w; x++) {
        let d = 0;
        for (let y = 0; y < L.h; y++) {
          const t = L.tiles[y * L.w + x];
          d = (t === 1 || t === 2) ? d + 1 : 0;
          depth[y * L.w + x] = Math.min(d, 6);
        }
      }
      // Rückwand in Innenräumen: Spalten mit Metalldecke und Metallboden
      const back = new Array(L.w).fill(null);
      for (let x = 0; x < L.w; x++) {
        let top = -1;
        for (let y = 0; y < 8; y++) if (L.tiles[y * L.w + x] === 2) top = y;
        if (top < 0) continue;
        let bot = -1;
        for (let y = top + 1; y < L.h; y++) {
          const t = L.tiles[y * L.w + x];
          if (t === 2 && (y + 1 >= L.h || L.tiles[(y + 1) * L.w + x] === 2)) { bot = y; break; }
        }
        if (bot > top + 1) back[x] = [top + 1, bot];
      }
      this.levelCache = { L, depth, back };
    }

    drawTiles(g, cx, cy) {
      const c = this.c, L = g.L, T = L.T, D = this.levelCache.depth;
      const x0 = Math.max(0, Math.floor(cx / T) - 1), x1 = Math.min(L.w - 1, Math.floor((cx + W) / T) + 1);
      const y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(L.h - 1, Math.floor((cy + H) / T));
      const th = L.theme, tex = { 1: this.img[th.ground], 2: this.img[th.metal] };
      const back = this.levelCache.back;
      for (let tx = x0; tx <= x1 && th.backwall; tx++) {
        const b = back[tx];
        if (!b) continue;
        for (let ty = b[0]; ty < b[1]; ty++) {
          const px = tx * T, py = ty * T, im = this.img.metal;
          if (im) { const s = im.width / 8; c.drawImage(im, ((tx + 3) % 8) * s, (ty % 8) * s, s, s, px, py, T + 0.5, T + 0.5); }
        }
        c.fillStyle = 'rgba(6,4,14,0.72)';
        c.fillRect(tx * T, b[0] * T, T + 0.5, (b[1] - b[0]) * T);
        // Leuchtstreifen in der Rückwand
        if (tx % 6 === 0) {
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = `rgba(255,150,60,${0.25 + 0.1 * Math.sin(g.time * 2 + tx)})`;
          c.fillRect(tx * T + 30, b[0] * T + 40, 4, (b[1] - b[0]) * T - 80);
          c.globalCompositeOperation = 'source-over';
        }
      }
      const solid = t => t === 1 || t === 2;
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = L.tiles[ty * L.w + tx];
          if (!solid(t)) continue;
          const px = tx * T, py = ty * T, im = tex[t];
          if (im) {
            const s = im.width / 8;          // 8 Kacheln pro Textur
            c.drawImage(im, (tx % 8) * s, (ty % 8) * s, s, s, px, py, T + 0.5, T + 0.5);
          } else { c.fillStyle = t === 1 ? '#2a2430' : '#2c3038'; c.fillRect(px, py, T, T); }
          const d = D[ty * L.w + tx];
          if (d > 0) { c.fillStyle = `rgba(4,2,10,${Math.min(0.8, 0.18 + (d - 1) * 0.16)})`; c.fillRect(px, py, T + 0.5, T + 0.5); }
        }
      }
      // Kanten: Oberkante hell, Seiten dunkel
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = L.tiles[ty * L.w + tx];
          if (!solid(t)) continue;
          const px = tx * T, py = ty * T;
          const up = ty > 0 ? L.tiles[(ty - 1) * L.w + tx] : 0;
          if (!solid(up)) {
            if (t === 1) {
              c.fillStyle = '#1a1420'; c.fillRect(px, py, T, 8);
              c.fillStyle = '#6a5a78'; c.fillRect(px, py, T, 3);
              c.fillStyle = th.rim; c.fillRect(px, py + 3, T, 2);
            } else {
              c.fillStyle = '#9aa4b4'; c.fillRect(px, py, T, 4);
              c.fillStyle = '#20242c'; c.fillRect(px, py + 4, T, 5);
              if (tx % 3 === 0) { c.fillStyle = 'rgba(255,170,60,0.9)'; c.fillRect(px + 26, py + 5, 12, 3); }
            }
          }
          const dn = ty < L.h - 1 ? L.tiles[(ty + 1) * L.w + tx] : 1;
          if (!solid(dn)) { c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(px, py + T - 6, T, 6); }
          const lf = tx > 0 ? L.tiles[ty * L.w + tx - 1] : 1, rt = tx < L.w - 1 ? L.tiles[ty * L.w + tx + 1] : 1;
          if (!solid(lf)) { c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(px, py, 3, T); }
          if (!solid(rt)) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(px + T - 5, py, 5, T); }
        }
      }
      // Plattformen, Säure, Kisten, Fässer
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          const t = L.tiles[ty * L.w + tx];
          const px = tx * T, py = ty * T;
          if (t === 3) {
            const lf = L.tiles[ty * L.w + tx - 1] === 3;
            if (!lf) {
              let n = 1;
              while (L.tiles[ty * L.w + tx + n] === 3) n++;
              if (this.img.platform) c.drawImage(this.img.platform, px - 6, py - 4, n * T + 12, 46);
              else { c.fillStyle = '#556'; c.fillRect(px, py, n * T, 20); }
              c.globalCompositeOperation = 'lighter';
              c.globalAlpha = 0.3 + 0.1 * Math.sin(g.time * 3 + tx);
              c.fillStyle = '#3ad0ff'; c.fillRect(px + 8, py + 38, n * T - 16, 3);
              c.globalAlpha = 1;
              c.globalCompositeOperation = 'source-over';
            }
          } else if (t === 4) {
            const ac = th.acid || { top: '#9dff4a', bottom: '#1d5a14', glow: '#7dff6a' };
            const top = ty > 0 && L.tiles[(ty - 1) * L.w + tx] !== 4;
            const gr = c.createLinearGradient(0, py, 0, py + T);
            gr.addColorStop(0, top ? ac.top : ac.bottom); gr.addColorStop(1, ac.bottom);
            c.fillStyle = gr;
            if (top) {
              c.beginPath();
              c.moveTo(px, py + T);
              for (let k = 0; k <= 8; k++) c.lineTo(px + k * 8, py + 10 + Math.sin(g.time * 3 + (px + k * 8) * 0.05) * 5);
              c.lineTo(px + T, py + T);
              c.fill();
              c.globalCompositeOperation = 'lighter';
              this.gl(this.glowOf(ac.glow), px + T / 2, py + 8, 140, 0.25);
              if (Math.sin(g.time * 2.3 + tx * 7.1) > 0.97) this.gl(this.glowOf(ac.glow), px + T / 2, py + 12, 40, 0.8);
              c.globalAlpha = 1;
              c.globalCompositeOperation = 'source-over';
            } else c.fillRect(px, py, T, T);
          } else if (t === 7) {
            // Wasser kommt erst nach den Figuren, hier nur der dunkle Grund
            c.fillStyle = 'rgba(8,24,18,0.55)';
            c.fillRect(px, py, T + 0.5, T + 0.5);
          } else if (t === 5) {
            this.spr('crate', px + T / 2, py + T / 2 + 2, T + 6, { flash: L.hp.get(ty * L.w + tx) < 20 ? 0.3 : 0 });
          } else if (t === 6) {
            this.spr('barrel', px + T / 2, py + T / 2, T + 4);
            c.globalCompositeOperation = 'lighter';
            this.gl(this.glows.red, px + T / 2, py + 14, 50, 0.5 + 0.5 * Math.sin(g.time * 6 + tx));
            c.globalAlpha = 1;
            c.globalCompositeOperation = 'source-over';
          }
        }
      }
    }

    // Wasser: liegt über den Figuren, damit der Held wirklich darin watet
    drawWater(g, cx, cy) {
      const c = this.c, L = g.L, T = L.T, th = L.theme;
      const wa = th.water;
      if (!wa) return;
      const x0 = Math.max(0, Math.floor(cx / T) - 1), x1 = Math.min(L.w - 1, Math.floor((cx + W) / T) + 1);
      const y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(L.h - 1, Math.floor((cy + H) / T));
      for (let ty = y0; ty <= y1; ty++) {
        for (let tx = x0; tx <= x1; tx++) {
          if (L.tiles[ty * L.w + tx] !== 7) continue;
          const px = tx * T, py = ty * T;
          const top = ty === 0 || L.tiles[(ty - 1) * L.w + tx] !== 7;
          c.fillStyle = top ? wa.top : wa.deep;
          if (top) {
            // Wellenlinie an der Oberfläche
            c.beginPath();
            c.moveTo(px, py + T);
            for (let k = 0; k <= 8; k++) {
              const wx = px + k * 8;
              c.lineTo(wx, py + 10 + Math.sin(g.time * 2.2 + wx * 0.03) * 6);
            }
            c.lineTo(px + T, py + T);
            c.fill();
            c.globalCompositeOperation = 'lighter';
            c.globalAlpha = 0.25 + 0.1 * Math.sin(g.time * 3 + tx);
            c.fillStyle = wa.glow;
            c.fillRect(px, py + 10 + Math.sin(g.time * 2.2 + px * 0.03) * 6, T, 3);
            c.globalAlpha = 1;
            c.globalCompositeOperation = 'source-over';
          } else {
            c.fillRect(px, py, T + 0.5, T + 0.5);
          }
        }
      }
    }

    drawDecals(g) {
      const c = this.c;
      for (const d of g.decals) {
        const a = clamp(1 - (d.t - 8) / 4, 0, 1) * (d.color === '#000' ? 0.5 : 0.8);
        if (a <= 0) continue;
        c.globalAlpha = a;
        c.fillStyle = d.color;
        c.beginPath();
        c.ellipse(d.x, d.y + 2, d.r, d.r * 0.22, 0, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
    }

    drawProps(g) {
      const c = this.c;
      // Sprungfelder
      for (const p of g.pads || []) {
        c.fillStyle = '#2a3440'; c.fillRect(p.x - 40, p.y - 14, 80, 14);
        c.fillStyle = '#8a9ab0'; c.fillRect(p.x - 40, p.y - 14, 80, 3);
        c.globalCompositeOperation = 'lighter';
        const k = clamp(1 - p.t * 2, 0, 1);
        for (let i = 0; i < 3; i++) {
          const y = p.y - 26 - i * 22 - ((g.time * 60) % 22);
          c.globalAlpha = 0.5 - i * 0.14 + k * 0.4;
          c.strokeStyle = '#6affff'; c.lineWidth = 4;
          c.beginPath(); c.moveTo(p.x - 22, y + 10); c.lineTo(p.x, y); c.lineTo(p.x + 22, y + 10); c.stroke();
        }
        this.gl(this.glows.cyan, p.x, p.y - 10, 120 + k * 120, 0.5 + k * 0.5);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      // Energiebarriere hinter dem Helden in der Boss-Arena
      if (g.lock && g.boss && !g.won) {
        const x = g.L.arena.x;
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          c.globalAlpha = 0.25 + 0.15 * Math.sin(g.time * 8 + i * 2);
          c.fillStyle = i === 1 ? '#ff5a4a' : '#ff2a6a';
          c.fillRect(x + 4 + i * 6 + Math.sin(g.time * 20 + i) * 2, 0, 4, g.L.ph);
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      // Lasertore: Emitter oben und unten, Strahl nur wenn an, vorher Flackern
      for (const gt of g.gates) {
        if (Math.abs(gt.x - g.cam.x - W / 2) > W) continue;
        c.fillStyle = '#2a2436';
        c.fillRect(gt.x - 18, gt.y0, 36, 18); c.fillRect(gt.x - 18, gt.y1 - 18, 36, 18);
        c.fillStyle = gt.on ? '#ff6ae0' : gt.warn ? '#ffd24a' : '#5a4a6a';
        c.fillRect(gt.x - 10, gt.y0 + 14, 20, 6); c.fillRect(gt.x - 10, gt.y1 - 20, 20, 6);
        c.globalCompositeOperation = 'lighter';
        if (gt.on) {
          for (const [w, col, a] of [[34, '#ff2fc8', 0.3], [14, '#ff8ae8', 0.7], [5, '#ffffff', 1]]) {
            c.globalAlpha = a; c.fillStyle = col;
            c.fillRect(gt.x - w / 2 + (Math.random() - 0.5) * 3, gt.y0 + 18, w, gt.y1 - gt.y0 - 36);
          }
          this.gl(this.glows.pink, gt.x, gt.y0 + 18, 120, 0.9); this.gl(this.glows.pink, gt.x, gt.y1 - 18, 120, 0.9);
        } else if (gt.warn && Math.sin(g.time * 40) > 0) {
          c.globalAlpha = 0.35; c.fillStyle = '#ffd24a';
          c.fillRect(gt.x - 1, gt.y0 + 18, 2, gt.y1 - gt.y0 - 36);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      // Checkpoints: Bake mit Licht
      for (const k of g.checks) {
        const col = k.on ? '#6affc8' : '#ff5a4a';
        c.fillStyle = '#3a3f48'; c.fillRect(k.x - 5, k.y - 40, 10, 100);
        c.fillStyle = '#20242a'; c.fillRect(k.x - 22, k.y + 52, 44, 8);
        c.fillStyle = col; c.fillRect(k.x - 10, k.y - 56, 20, 18);
        c.globalCompositeOperation = 'lighter';
        this.gl(this.glowOf(col), k.x, k.y - 47, 110 + 20 * Math.sin(k.t * 6), 0.8);
        if (k.on) {
          const gr = c.createLinearGradient(0, k.y - 900, 0, k.y - 50);
          gr.addColorStop(0, 'rgba(106,255,200,0)'); gr.addColorStop(1, 'rgba(106,255,200,0.35)');
          c.fillStyle = gr; c.fillRect(k.x - 12, k.y - 900, 24, 850);
        }
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }

    drawPickups(g) {
      const c = this.c;
      for (const k of g.pickups) {
        const bob = Math.sin(k.t * 4) * 6;
        const blink = k.life !== undefined && k.life < 3 && Math.sin(k.t * 30) > 0;
        if (blink) continue;
        if (k.type === 'coin') {
          const sw = Math.abs(Math.cos(k.t * 5));
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.gold, k.x, k.y + bob, 60, 0.45);
          c.globalAlpha = 1;
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#b87a10';
          c.beginPath(); c.ellipse(k.x, k.y + bob, 15 * sw + 3, 15, 0, 0, TAU); c.fill();
          c.fillStyle = '#ffd24a';
          c.beginPath(); c.ellipse(k.x, k.y + bob, 12 * sw + 1, 12, 0, 0, TAU); c.fill();
          c.fillStyle = '#fff6c0'; c.fillRect(k.x - 3 * sw, k.y + bob - 7, 3 * sw + 1, 8);
          continue;
        }
        const col = { H: '#6aff8a', G: '#ffd24a', S: '#ffa640', L: '#ff4fd8', R: '#ffe36a' }[k.type] || '#fff';
        c.globalCompositeOperation = 'lighter';
        this.gl(this.glowOf(col), k.x, k.y + bob, 130 + 16 * Math.sin(k.t * 6), 0.6);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
        if (k.type === 'H') this.spr('medkit', k.x, k.y + bob, 64);
        else this.spr('capsule', k.x, k.y + bob, 70);
        if (k.type !== 'H') this.glowText(k.type, `900 26px ${FONT}`, '#ffffff', col, 10, k.x, k.y + bob + 10);
      }
    }

    // ---------- Held ----------

    drawPlayer(g) {
      const p = g.player, c = this.c;
      if (!p.dead && p.inv > 0 && p.dashT <= 0 && Math.sin(g.time * 40) > 0.2) return;
      for (const a of p.afterimages) this.drawHero(g, Object.assign({}, p, a, { ghost: 1 - a.t / 0.25 }));
      this.drawHero(g, p);
      // Mündungsfeuer
      if (p.fired > 0 && !p.dead) {
        const wp = GameDefs.WEAPONS[p.weapon];
        c.globalCompositeOperation = 'lighter';
        this.gl(this.glowOf(wp.color), p.muzzle.x, p.muzzle.y, 110, 0.9);
        c.save();
        c.translate(p.muzzle.x, p.muzzle.y); c.rotate(p.aim);
        c.globalAlpha = 0.9;
        c.fillStyle = '#ffffff';
        c.beginPath(); c.moveTo(0, -8); c.lineTo(46 + Math.random() * 20, 0); c.lineTo(0, 8); c.fill();
        c.restore();
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      if (p.weapon === 'laser' && g.beam) this.drawBeam(g, g.beam);
      // Jetpack-Flamme beim Schweben
      if (p.hovering && !p.dead) {
        c.globalCompositeOperation = 'lighter';
        this.gl(this.glows.fire, p.x - p.face * 30, p.y + 10, 120, 0.7);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }

    drawHero(g, p) {
      const c = this.c, I = this.img;
      if (!I.hero_torso || !I.hero_arm || !this.thigh) return this.drawHeroFallback(p);
      const f = p.face;
      const feet = p.y + p.h / 2;
      c.save();
      if (p.ghost !== undefined) { c.globalAlpha = 0.35 * p.ghost; c.globalCompositeOperation = 'lighter'; }
      if (p.dead) {                       // kippt um den Fußpunkt, nicht um die Mitte
        const fx = p.x, fy = p.y + p.h / 2 - 16;
        c.translate(fx, fy); c.rotate(p.spin); c.translate(-fx, -fy);
      }
      c.translate(p.x, 0);
      c.scale(f, 1);
      // lokale Werte (Blick nach rechts)
      const la = p.dead ? 1.15 : (f > 0 ? p.aim : Math.PI - p.aim);   // tot: Arm hängt herab
      const speed = Math.abs(p.vx) / GameDefs.P.run;
      const run = p.onGround && speed > 0.08;
      const ph = p.walk;
      const tS = I.hero_torso, TH = HERO.torsoH, TW = TH * tS.width / tS.height;
      // Schulterpunkt wie in game.js, daraus Lage des Torsos
      const sx = GameDefs.P.shoulder.x, sy = p.y + GameDefs.P.shoulder.y + (p.crouch ? 26 : 0);
      let bob = 0;
      if (run) bob = -Math.abs(Math.sin(ph)) * 7 + 3;
      else if (p.onGround) bob = Math.sin(g.time * 2.4) * 1.5;
      bob += p.land * 12;
      const lean = (run ? 0.1 * speed : 0) + clamp(la, -1.2, 1.2) * 0.06 + (p.dashT > 0 ? 0.25 : 0);
      const tx = sx - HERO.stump.x * TW, ty = sy + bob - HERO.stump.y * TH;
      const hipX = tx + HERO.hip.x * TW, hipY = ty + HERO.hip.y * TH;
      // Beinlänge ergibt sich aus Hüfte und Boden
      const legLen = Math.max(40, feet - hipY + (p.crouch ? 30 : 0) + 4);
      const lw = this.thigh.width / this.thigh.height;
      const thighH = legLen * (HERO.knee - HERO.legTop + 0.04) / (1 - HERO.legTop);
      const shinH = legLen * (1 - HERO.knee + 0.02) / (1 - HERO.legTop);
      const legW = thighH * lw * 1.25;
      let fa, fb, ba, bb;       // Oberschenkel- und Kniewinkel vorn/hinten
      if (p.dead) {                      // Beine sacken zusammen, eins angewinkelt
        const s = p.fell ? 1 : 0.5;
        fa = -0.25 - 0.35 * s; fb = 0.35 + 0.75 * s; ba = 0.2 + 0.3 * s; bb = 0.25 + 0.5 * s;
      }
      else if (p.crouch) { fa = -1.25; fb = 2.1; ba = -0.5; bb = 1.9; }
      else if (!p.onGround) {
        if (p.vy < 0) { fa = -0.75; fb = 1.3; ba = 0.25; bb = 0.8; }
        else { fa = -0.3; fb = 0.5; ba = 0.3; bb = 0.35; }
        if (p.hovering) { fa = -0.2; fb = 0.3; ba = 0.15; bb = 0.5; }
      } else if (run) {
        const amp = 0.35 + 0.35 * speed;
        fa = -Math.sin(ph) * amp; ba = Math.sin(ph) * amp;
        fb = 0.1 + Math.max(0, Math.cos(ph)) * 1.1 * speed; bb = 0.1 + Math.max(0, -Math.cos(ph)) * 1.1 * speed;
      } else { fa = -0.08; fb = 0.12 + p.land * 0.8; ba = 0.12; bb = 0.1 + p.land * 0.8; }
      if (p.crouch || p.land > 0) { /* Knie gebeugt: schon oben berücksichtigt */ }
      const leg = (x, y, a, b, dark) => {
        c.save();
        c.translate(x, y); c.rotate(a);
        c.drawImage(dark ? this.thighD : this.thigh, -legW / 2, 0, legW, thighH);
        c.translate(0, thighH * 0.92); c.rotate(b);
        c.drawImage(dark ? this.shinD : this.shin, -legW / 2, -shinH * 0.04, legW, shinH);
        c.restore();
      };
      c.save();
      c.translate(hipX, hipY); c.rotate(lean * 0.4); c.translate(-hipX, -hipY);
      leg(hipX + HERO.hipBack, hipY - 2, ba, bb, true);
      // Waffenarm, dreht sich um die Schulter zum Ziel
      const arm = I.hero_arm, AH = GameDefs.P.arm / ((HERO.muzzle.x - HERO.shoulder.x) * arm.width / arm.height);
      const AW = AH * arm.width / arm.height;
      const recoil = p.recoil * 10;
      const drawArm = (img, dx, dy, alpha) => {
        c.save();
        c.translate(sx + dx, sy + bob + dy);
        c.rotate(clamp(la, -1.75, 1.55));
        c.translate(-recoil, 0);
        if (alpha !== undefined) c.globalAlpha *= alpha;
        c.drawImage(img, -HERO.shoulder.x * AW, -HERO.shoulder.y * AH, AW, AH);
        c.restore();
      };
      // Torso
      c.save();
      c.translate(sx, sy + bob); c.rotate(lean); c.translate(-sx, -(sy + bob));
      c.drawImage(tS, tx, ty, TW, TH);
      if (p.ghost === undefined && (p.dashT > 0 || p.hurtT > 0)) { c.globalAlpha = 0.4; c.drawImage(this.torsoW, tx, ty, TW, TH); c.globalAlpha = 1; }
      // Visier-Glanz
      c.globalCompositeOperation = 'lighter';
      this.gl(this.glows.gold, tx + TW * 0.74, ty + TH * 0.2, 44, 0.35 + 0.1 * Math.sin(g.time * 3));
      if (p.hovering || (!p.onGround && p.vy < -600)) this.gl(this.glows.fire, tx + TW * 0.08, ty + TH * 0.62, 90, 0.8);
      c.globalCompositeOperation = p.ghost !== undefined ? 'lighter' : 'source-over';
      c.globalAlpha = p.ghost !== undefined ? 0.35 * p.ghost : 1;
      c.restore();
      leg(hipX + 6, hipY, fa, fb, false);
      c.restore();
      drawArm(arm, 0, 0);
      c.restore();
    }

    drawHeroFallback(p) {
      const c = this.c;
      c.fillStyle = '#e8e8e8';
      c.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
      c.fillStyle = '#ffb14a';
      c.fillRect(p.x + p.face * 5, p.y - p.h / 2 + 10, p.face * 20, 20);
    }

    drawBeam(g, b) {
      const c = this.c;
      const len = Math.hypot(b.x1 - b.x0, b.y1 - b.y0), a = Math.atan2(b.y1 - b.y0, b.x1 - b.x0);
      c.save();
      c.translate(b.x0, b.y0); c.rotate(a);
      c.globalCompositeOperation = 'lighter';
      const t = g.time;
      for (const [w, col, al] of [[46, '#ff2fc8', 0.25], [24, '#ff6ae0', 0.5], [10, '#ffd0f8', 0.9], [4, '#ffffff', 1]]) {
        c.globalAlpha = al;
        c.strokeStyle = col; c.lineWidth = w * (0.85 + 0.3 * Math.random());
        c.beginPath(); c.moveTo(0, 0);
        for (let x = 40; x < len; x += 40) c.lineTo(x, Math.sin(x * 0.05 - t * 40) * (w > 20 ? 5 : 2));
        c.lineTo(len, 0);
        c.stroke();
      }
      c.restore();
      this.gl(this.glows.pink, b.x0, b.y0, 110, 0.9);
      this.gl(this.glows.pink, b.x1, b.y1, 150 + Math.random() * 40, 0.9);
      this.gl(this.glows.white, b.x1, b.y1, 60, 0.9);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // ---------- Gegner ----------

    // Laufgegner aus Rumpf und Beinen. Liefert false, wenn die Teile fehlen,
    // dann zeichnet drawEnemy das alte Einzelsprite.
    drawWalker(g, e, extra) {
      const R = GameDefs.WALKERS[e.type], F = WALK[e.type], gt = e.gait;
      const tS = this.img[R.parts.torso];
      if (!gt || !tS || !this.rigParts(e.type)) return false;
      const c = this.c, flash = e.flash;
      c.save();
      c.translate(e.x, gt.hipY);
      if (e.face > 0) c.scale(-1, 1);                    // die Kunst schaut nach links
      // Die Beinbilder zeigen nach rechts, die Rümpfe nach links: Beine gespiegelt zeichnen
      const leg = (i, dark) => {
        c.save();
        if (dark) c.translate(14, -5);                   // die fernen Beine stehen etwas dahinter
        c.scale(-1, 1);
        this.bossLeg(e.type, { x: -gt.feet[i].x, y: gt.feet[i].y }, dark);
        c.restore();
      };
      for (let i = 0; i < R.legs.length; i++) if (R.legs[i].back) leg(i, true);
      const TH = R.torsoH, TW = TH * tS.width / tS.height;
      const tx = -F.torso.hip.x * TW, ty = -F.torso.hip.y * TH;
      c.drawImage(tS, tx, ty, TW, TH);
      if (flash > 0 && this.white[R.parts.torso]) {
        c.globalAlpha = 0.7 * flash;
        c.drawImage(this.white[R.parts.torso], tx, ty, TW, TH);
        c.globalAlpha = 1;
      }
      for (let i = 0; i < R.legs.length; i++) if (!R.legs[i].back) leg(i, false);
      c.restore();
      if (extra) extra();
      return true;
    }

    drawEnemy(g, e) {
      const c = this.c, fl = e.flash;
      switch (e.type) {
        case 'crawler': {
          const legs = (near) => {
            c.lineCap = 'round';
            for (let i = 0; i < 3; i++) {
              const off = (i - 1) * e.w * 0.28 + (near ? 4 : -6);
              const ph = e.walk + i * 2.1 + (near ? Math.PI : 0);
              const rx = e.x + off, ry = e.y + e.h * 0.1;
              const fx = rx + Math.sin(ph) * 16 - e.face * 6, fy = e.y + e.h / 2 - Math.max(0, Math.cos(ph)) * 10 * (e.onGround ? 1 : 0);
              const kx = (rx + fx) / 2 + (i - 1) * 10 + (near ? 0 : -4), ky = ry - 22;
              c.strokeStyle = near ? '#2a1838' : '#140a1c'; c.lineWidth = near ? 8 : 7;
              c.beginPath(); c.moveTo(rx, ry); c.lineTo(kx, ky); c.lineTo(fx, fy); c.stroke();
              if (near) {
                c.strokeStyle = '#7a4a9a'; c.lineWidth = 2;
                c.beginPath(); c.moveTo(rx, ry - 2); c.lineTo(kx, ky - 2); c.lineTo(fx, fy); c.stroke();
              }
            }
          };
          legs(false);
          const tilt = e.onGround ? Math.sin(e.walk * 2) * 0.03 : clamp(e.vy / 2000, -0.3, 0.3) * -e.face;
          this.spr('crawler', e.x, e.y - 6, e.h * 1.35, { flip: e.face > 0, rot: tilt, flash: fl });
          legs(true);
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, e.x + e.face * e.w * 0.38, e.y - 10, 50, 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'drone':
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.red, e.x - 26, e.y + 36, 40, 0.6); this.gl(this.glows.red, e.x + 26, e.y + 36, 40, 0.6);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('drone', e.x, e.y, e.h * 1.35, { rot: clamp(e.vx / 1500, -0.35, 0.35), flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.red, e.x, e.y, 70 + (e.cd < 0.4 ? 60 * (1 - e.cd / 0.4) : 0), 0.6);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        case 'jelly': {
          const s = Math.sin(e.t * 3);
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.pink, e.x, e.y - 10, 200, 0.35 + 0.15 * s);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('jelly', e.x, e.y, e.h * 1.3, { sx: 1 + 0.08 * s, sy: 1 - 0.08 * s, flash: fl, alpha: 0.92 });
          break;
        }
        case 'turret':
          this.spr('turret', e.x, e.y, e.h * 1.3, { flip: e.face > 0, flipY: e.ceil, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, e.x, e.y + (e.ceil ? 10 : -10), 60 + (e.cd < 0.5 ? 80 * (1 - e.cd / 0.5) : 0), 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        case 'brute':
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, e.x, e.y + e.h / 2 + 10, 200, 0.4 + 0.1 * Math.sin(g.time * 20));
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('brute', e.x, e.y, e.h * 1.45, { flip: e.face > 0, flash: fl });
          if (e.cd < 0.5) {
            c.globalCompositeOperation = 'lighter';
            this.gl(this.glows.green, e.x + e.face * 110, e.y - 10, 160 * (1 - e.cd / 0.5), 0.8);
            c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          }
          this.hpBar(e, e.y - e.h * 0.75);
          break;
        case 'spitter': {
          const k = e.charge > 0 ? e.charge / 0.35 : 0;
          this.spr('spitter', e.x, e.y + e.h / 2 + 4, e.h * 1.35, { ay: 1, flip: e.face > 0, sx: 1 + 0.12 * k, sy: 1 - 0.1 * k, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, e.x - e.face * 20, e.y - 20, 120 + 40 * Math.sin(e.t * 5), 0.35 + 0.4 * k);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'bat': {
          const flap = Math.sin(e.t * (e.state === 'dive' ? 30 : 16));
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.pink, e.x, e.y, 120, 0.3);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('bat', e.x, e.y, e.h * 1.5, { sy: 0.75 + 0.35 * flap, flip: e.face > 0, flash: fl,
            rot: e.state === 'dive' ? clamp(e.vx / 3000, -0.4, 0.4) : 0 });
          break;
        }
        case 'saucer':
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, e.x, e.y + 30, 120 + 20 * Math.sin(g.time * 12), 0.4);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('saucer', e.x, e.y, e.h * 1.9, { rot: clamp(e.vx / 2000, -0.25, 0.25), flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.red, e.x, e.y - 20, 70 + (e.cd < 0.3 ? 70 : 0), 0.6);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        case 'sentinel': {
          this.spr('sentinel', e.x, e.y, e.h * 1.25, { flip: e.face > 0, flash: fl });
          e.shieldHit = Math.max(0, (e.shieldHit || 0) - 0.08);
          // Energieschild (im Sprite vorn) leuchtet geschlossen auf, offen glüht das Auge
          const sx = e.x + e.face * 34;
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glowOf('#b98aff'), sx, e.y, 190, e.open ? 0.1 : 0.3 + 0.5 * e.shieldHit);
          if (e.open) this.gl(this.glows.cyan, e.x + e.face * 10, e.y - 22, 110, 0.9 + 0.1 * Math.sin(g.time * 40));
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.hpBar(e, e.y - e.h * 0.7);
          break;
        }
        case 'leech': {
          const wig = Math.sin((e.walk || 0) * 2 + e.t * 6) * 0.12;
          this.spr('leech', e.x, e.y, e.h * 1.5, { flip: e.face > 0, rot: wig, flash: fl,
            sy: 1 + Math.sin(e.t * 8) * 0.06 });
          break;
        }
        case 'stingfly': {
          const flap = Math.sin(e.t * 40);
          this.spr('stingfly', e.x, e.y, e.h * 1.4, { flip: e.face > 0, flash: fl,
            sx: 1 - 0.25 * Math.abs(flap), rot: e.state === 'dive' ? clamp(e.vx / 3000, -0.4, 0.4) : 0 });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glowOf('#c8ff5a'), e.x, e.y, 60, 0.35);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'sporepod': {
          const k = e.charge > 0 ? 1 - e.charge / 0.6 : 0;
          this.spr('sporepod', e.x, e.y + e.h / 2, e.h * 1.35, { ay: 1, flip: e.face > 0,
            sx: 1 + 0.12 * k, sy: 1 - 0.08 * k, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glowOf('#c8ff5a'), e.x, e.y - 30, 70 + 120 * k, 0.3 + 0.4 * k);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'mudhulk': {
          const k = e.charge > 0 ? 1 - e.charge / 0.7 : 0;
          if (!this.drawWalker(g, e)) {
            this.spr('mudhulk', e.x, e.y + Math.sin(e.walk || 0) * 6, e.h * 1.35, { flip: e.face > 0,
              flash: Math.max(fl, k * 0.4), sx: 1 + 0.06 * k, sy: 1 - 0.04 * k });
          }
          e.shieldHit = Math.max(0, (e.shieldHit || 0) - 0.08);
          if (e.shieldHit > 0) {
            c.globalCompositeOperation = 'lighter';
            this.gl(this.glowOf('#a8c86a'), e.x + e.face * 60, e.y, 160, 0.4 * e.shieldHit);
            c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          }
          this.hpBar(e, e.y - e.h * 0.7);
          break;
        }
        case 'sandworm': {
          if (e.hidden) {            // unter dem Sand: nur ein Hügel und Staub
            const gy = e.y - 110;
            c.fillStyle = '#c99a4a';
            c.beginPath();
            c.moveTo(e.x - 70, gy + 2);
            c.quadraticCurveTo(e.x, gy - 34 - Math.sin(g.time * 9) * 5, e.x + 70, gy + 2);
            c.fill();
            break;
          }
          this.spr('sandworm', e.x, e.y, e.h * 1.25, { flip: e.face > 0, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, e.x, e.y - e.h * 0.3, 90, 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
        case 'skimmer':
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, e.x + e.face * 60, e.y + 14, 130, 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.spr('skimmer', e.x, e.y, e.h * 1.5, { flip: e.face > 0, rot: clamp(-e.vy / 2000, -0.2, 0.2), flash: fl });
          break;
        case 'thorn': {
          const k = e.charge > 0 ? 1 - e.charge / 0.5 : 0;
          this.spr('thorn', e.x, e.y + e.h / 2, e.h * 1.3, { ay: 1, flip: e.face > 0,
            sx: 1 + 0.15 * k, sy: 1 - 0.1 * k, flash: fl });
          if (e.charge > 0) {
            c.globalCompositeOperation = 'lighter';
            this.gl(this.glows.orange, e.x, e.y - 40, 60 + 120 * k, 0.6);
            c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          }
          break;
        }
        case 'mortar': {
          if (!this.drawWalker(g, e)) this.spr('mortar', e.x, e.y + Math.sin(e.walk || 0) * 5, e.h * 1.35,
            { flip: e.face > 0, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, e.x, e.y - 50, 70 + (e.cd < 0.5 ? 90 * (1 - e.cd / 0.5) : 0), 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.hpBar(e, e.y - e.h * 0.7);
          break;
        }
        case 'pod': {
          const k = Math.min(1, (e.pulse || 0) * 3), s = Math.sin(e.t * 4) * 0.04 + (1 - k) * 0.15;
          this.spr('pod', e.x, e.y + e.h / 2, e.h * 1.3, { ay: 1, sx: 1 + s, sy: 1 - s * 0.6, flash: fl });
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, e.x, e.y - 20, 150, 0.25 + 0.15 * Math.sin(e.t * 4));
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          break;
        }
      }
    }

    hpBar(e, y) {
      if (e.hp >= e.maxHp) return;
      const c = this.c, w = 120;
      c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(e.x - w / 2 - 2, y - 2, w + 4, 10);
      c.fillStyle = '#9dff4a'; c.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 6);
    }

    // Ein Teil so drehen und skalieren, dass "pivot" auf (x,y) liegt und pivot->other in Richtung a zeigt
    piece(img, piv, oth, x, y, a, len, dark) {
      if (!img) return;
      const c = this.c;
      const vx = (oth.x - piv.x) * img.width, vy = (oth.y - piv.y) * img.height;
      const nat = Math.atan2(vy, vx), s = len / Math.hypot(vx, vy);
      c.save();
      c.translate(x, y);
      c.rotate(a - nat);
      c.scale(s, s);
      c.drawImage(img, -piv.x * img.width, -piv.y * img.height, img.width, img.height);
      c.restore();
    }

    // Geteiltes Bein und dunkle Kopien, einmal je Boss vorbereitet
    rigParts(kind) {
      let p = this.rigCache.get(kind);
      if (!p) {
        const R = GameDefs.RIGS[kind] || GameDefs.WALKERS[kind], F = BOSS[kind] || WALK[kind];
        const leg = this.img[R.parts.leg];
        if (!leg) return null;
        p = {
          legTop: slice(leg, 0, F.leg.cut + 0.05),
          legBot: slice(leg, F.leg.cut - 0.03, 1),
          arm2D: this.img[R.parts.arm2] ? tinted(this.img[R.parts.arm2], '#0c0616', 0.32) : null,
          tailD: R.parts.tail && this.img[R.parts.tail] ? tinted(this.img[R.parts.tail], '#0c0616', 0.3) : null,
        };
        p.legTopD = tinted(p.legTop, '#08040e', 0.5);
        p.legBotD = tinted(p.legBot, '#08040e', 0.5);
        this.rigCache.set(kind, p);
      }
      return p;
    }

    // Bein aus Oberschenkel und Unterschenkel, Kniewinkel aus Zwei-Knochen-IK
    bossLeg(kind, foot, dark) {
      const R = GameDefs.RIGS[kind] || GameDefs.WALKERS[kind], B = BOSS[kind] || WALK[kind];
      const P = this.rigParts(kind);
      if (!P) return;
      const l1 = R.thigh, l2 = R.shin;
      const d = clamp(Math.hypot(foot.x, foot.y), Math.abs(l1 - l2) + 4, l1 + l2 - 4);
      const a = Math.atan2(foot.y, foot.x);
      const A = Math.acos(clamp((d * d + l1 * l1 - l2 * l2) / (2 * d * l1), -1, 1));
      const t1 = a - A;                                  // Knie zeigt nach vorn (umgekehrtes Knie)
      const kx = Math.cos(t1) * l1, ky = Math.sin(t1) * l1;
      const t2 = Math.atan2(foot.y - ky, foot.x - kx);
      const top = { x: B.leg.hip.x, y: B.leg.hip.y / (B.leg.cut + 0.05) };
      const topKnee = { x: B.leg.knee.x, y: B.leg.cut / (B.leg.cut + 0.05) };
      const botSpan = 1 - (B.leg.cut - 0.03);
      const botKnee = { x: B.leg.knee.x, y: 0.03 / botSpan };
      const botAnkle = { x: B.leg.ankle.x, y: (B.leg.ankle.y - B.leg.cut + 0.03) / botSpan };
      this.piece(dark ? P.legTopD : P.legTop, top, topKnee, 0, 0, t1, l1);
      this.piece(dark ? P.legBotD : P.legBot, botKnee, botAnkle, kx, ky, t2, l2);
    }

    // Der zusammengesetzte Boss: Schwanz, Beine, beide Arme, Rumpf
    drawBossRig(g, e) {
      const c = this.c, cfg = e.cfg, kind = cfg.rig, R = e.R, F = BOSS[kind], rg = e.rig, face = -1;
      const I = this.img, P = this.rigParts(kind);
      if (!P || !I[R.parts.torso] || !I[R.parts.arm]) return false;
      const flash = Math.max(e.hitFlash || 0, e.dying ? 0.25 + 0.25 * Math.sin(g.time * 30) : 0);
      const kx = e.kickX || 0, ky = e.kickY || 0;
      const arm2 = () => this.piece(P.arm2D, F.arm2.a, F.arm2.b, R.clawSh.x, R.clawSh.y, rg.claw, R.clawLen);
      c.save();
      c.translate(rg.hipX + kx, rg.hipY + ky);
      c.scale(face, 1);
      // Schwanz und hinteres Bein liegen hinter dem Körper
      if (R.tail && P.tailD) this.piece(P.tailD, F.tail.a, F.tail.b, R.tail.x, R.tail.y, Math.PI - 0.32 - rg.tail, R.tail.len);
      c.save(); c.translate(-22, -6); this.bossLeg(kind, rg.feet[1], true); c.restore();
      if (!F.arm2Front) arm2();
      // Rumpf
      const tS = I[R.parts.torso], TH = R.torsoH, TW = TH * tS.width / tS.height;
      c.save();
      c.rotate(rg.lean);
      c.drawImage(tS, -F.torso.hip.x * TW, -F.torso.hip.y * TH, TW, TH);
      if (flash > 0 && this.white[R.parts.torso]) {
        c.globalAlpha = 0.75 * flash;
        c.drawImage(this.white[R.parts.torso], -F.torso.hip.x * TW, -F.torso.hip.y * TH, TW, TH);
        c.globalAlpha = 1;
      }
      c.restore();
      // vorderes Bein, vorderer Arm (Kanone oder Sichel)
      this.bossLeg(kind, rg.feet[0], false);
      if (F.arm2Front) arm2();
      this.piece(I[R.parts.arm], F.arm.a, F.arm.b, R.shoulder.x, R.shoulder.y, rg.aim,
        R.armLen - (e.recoil || 0) * 40);
      if (flash > 0 && this.white[R.parts.arm]) {          // Treffer blitzen über den ganzen Körper
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.5 * flash;
        this.piece(this.white[R.parts.arm], F.arm.a, F.arm.b, R.shoulder.x, R.shoulder.y, rg.aim, R.armLen);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
      c.restore();
      return true;
    }

    drawBoss(g, e) {
      const c = this.c, cfg = e.cfg;
      const rage = e.phase === 3 || cfg.rage ? 0.5 + 0.5 * Math.sin(g.time * 10) : 0;
      if (e.rig || e.worm || e.rot) return this.drawBossParts(g, e, rage);
      c.fillStyle = '#402050';
      const b = g.hitbox(e);
      c.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);   // Notbehelf, falls Teile fehlen
    }

    // Zusammengesetzter Boss mit Leuchtpunkten, Zorn-Färbung und Schockwellen
    drawBossParts(g, e, rage) {
      const c = this.c, cfg = e.cfg, R = e.R, rg = e.rig, face = -1;
      if (R.kind === 'chain') return this.drawWorm(g, e, rage);
      if (R.kind === 'tentacle') return this.drawRot(g, e, rage);
      const col = this.glowOf(cfg.color);
      const at = (o) => ({ x: rg.hipX + o.x * face + (e.kickX || 0), y: rg.hipY + o.y + (e.kickY || 0) });
      const core = at(R.core), eye = at(R.eye);
      c.globalCompositeOperation = 'lighter';
      this.gl(col, core.x, core.y, 380 + 60 * Math.sin(g.time * 4), 0.3 + rage * 0.3);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if (!this.drawBossRig(g, e)) return;
      if (cfg.rage) {                         // Endform glüht rot
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.1 + 0.1 * rage;
        this.gl(this.glowOf('#ff2a4a'), core.x, core.y - 60, 620, 1);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      const muz = R.aim === 'head' ? at(R.mouth)
        : { x: rg.hipX + (R.shoulder.x + Math.cos(rg.aim) * R.armLen) * face, y: rg.hipY + R.shoulder.y + Math.sin(rg.aim) * R.armLen };
      c.globalCompositeOperation = 'lighter';
      const eyeGlow = e.atk === 'volley' ? 1 : 0.5;
      this.gl(this.glows.red, eye.x, eye.y, 90 + 50 * eyeGlow, 0.55 + 0.35 * eyeGlow);
      this.gl(col, core.x, core.y, 150 + 30 * Math.sin(g.time * 6), 0.8);
      if (e.atk === 'spread' || e.atk === 'volley' || e.atk === 'acid') this.gl(col, muz.x, muz.y, 150, 0.6);
      if ((e.atk === 'slam' || e.atk === 'rings' || e.atk === 'beam') && e.atkT < 0.9) this.gl(this.glows.white, core.x, core.y, 220 * e.atkT / 0.9, 0.8);
      if (e.crit > 0) this.gl(this.glows.gold, core.x, core.y, 240 * Math.min(1, e.crit * 4), Math.min(1, e.crit * 4));
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      this.bossWaves(g);
    }

    bossWaves(g) {
      const c = this.c;
      for (const w of g.waves) {
        c.globalCompositeOperation = 'lighter';
        const gr = c.createLinearGradient(w.x, 0, w.x - w.dir * 160, 0);
        const rgb = hexRgb(w.color || '#9dff4a');
        gr.addColorStop(0, `rgba(${rgb},0.9)`); gr.addColorStop(1, `rgba(${rgb},0)`);
        c.fillStyle = gr;
        c.beginPath(); c.moveTo(w.x, w.y); c.quadraticCurveTo(w.x - w.dir * 20, w.y - w.h * 1.4, w.x - w.dir * 160, w.y); c.fill();
        this.gl(this.glowOf(w.color || '#9dff4a'), w.x, w.y - 30, 180, 0.7);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    }

    // Der Devourer: Segmentkette auf der Bahn des Kopfes, Kopf zeigt in Fahrtrichtung
    drawWorm(g, e, rage) {
      const c = this.c, R = e.R, w = e.worm, I = this.img, F = BOSS.worm;
      const col = this.glowOf(e.cfg.color);
      const fy = e.baseY;
      const flash = Math.max(e.hitFlash || 0, e.dying ? 0.25 + 0.25 * Math.sin(g.time * 30) : 0);
      // unter dem Sand: nur ein wandernder Hügel
      if (w.y > fy + 120 && e.mound && !e.dying) {
        const m = e.mound;
        c.fillStyle = '#c99a4a';
        c.beginPath();
        c.moveTo(m.x - 150, m.y + 4);
        c.quadraticCurveTo(m.x, m.y - 74 - Math.sin(g.time * 8) * 8, m.x + 150, m.y + 4);
        c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)';
        c.beginPath();
        c.moveTo(m.x - 150, m.y + 4); c.quadraticCurveTo(m.x + 20, m.y - 30, m.x + 150, m.y + 4); c.fill();
      }
      const segs = e.segs || [];
      const segIm = I[R.parts.seg], headIm = I[R.parts.head], armIm = I[R.parts.arm], tailIm = I[R.parts.tail];
      if (!segIm || !headIm) return;
      // Schwanzspitze ganz hinten
      if (tailIm && segs.length > 1) {
        const last = segs[segs.length - 1], prev = segs[segs.length - 2];
        const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
        const h = R.segH * last.s * 0.9, wdt = h * tailIm.width / tailIm.height;
        c.save();
        c.translate(last.x, last.y);
        c.rotate(ang);
        if (Math.cos(ang) < 0) c.scale(1, -1);     // Rückenkamm zeigt immer nach oben
        c.drawImage(tailIm, -wdt * 0.1, -h / 2, wdt, h);
        c.restore();
      }
      // Körper: ein Schuppenstück je Abschnitt, von hinten nach vorn übereinander
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        const nx = i === 0 ? { x: w.x, y: w.y } : segs[i - 1];      // Richtung zum Kopf
        const ang = Math.atan2(nx.y - s.y, nx.x - s.x);
        const len = Math.hypot(nx.x - s.x, nx.y - s.y) * 1.45 + 20;
        const h = R.segH * s.s;
        c.save();
        c.translate(s.x, s.y);
        c.rotate(ang);
        if (Math.cos(ang) < 0) c.scale(1, -1);
        c.drawImage(segIm, -len * 0.25, -h / 2, len, h);
        if (flash > 0 && this.white[R.parts.seg]) {
          c.globalAlpha = 0.7 * flash;
          c.drawImage(this.white[R.parts.seg], -len * 0.25, -h / 2, len, h);
          c.globalAlpha = 1;
        }
        c.restore();
      }
      // Arme am vordersten Segment
      if (armIm && segs.length) {
        const s = segs[0];
        for (const side of [1, -1]) {
          c.save();
          c.translate(s.x, s.y);
          this.piece(armIm, F.arm.a, F.arm.b, 0, 0, w.ang + side * (0.8 + (e.armA || 0)) , R.armLen * (side > 0 ? 1 : 0.92));
          c.restore();
        }
      }
      // Kopf in Fahrtrichtung, das Sprite zeigt nach links
      const h = R.headH, wd = h * headIm.width / headIm.height;
      c.save();
      c.translate(w.x, w.y);
      c.rotate(w.ang - Math.PI);
      if (Math.cos(w.ang) > 0) c.scale(1, -1);
      const open = 0.9 + 0.25 * (w.mouth || 0);
      c.scale(open, 1 + 0.12 * (w.mouth || 0));
      c.drawImage(headIm, -wd / 2, -h / 2, wd, h);
      if (flash > 0 && this.white[R.parts.head]) {
        c.globalAlpha = 0.75 * flash;
        c.drawImage(this.white[R.parts.head], -wd / 2, -h / 2, wd, h);
        c.globalAlpha = 1;
      }
      c.restore();
      // Schlund: die Schwachstelle glüht, beim Speien besonders hell
      const m = e.mouthPos || { x: w.x, y: w.y };
      c.globalCompositeOperation = 'lighter';
      this.gl(col, m.x, m.y, 150 + 220 * (w.mouth || 0) + 30 * Math.sin(g.time * 8), 0.5 + 0.4 * (w.mouth || 0));
      if (e.crit > 0) this.gl(this.glows.gold, m.x, m.y, 240 * Math.min(1, e.crit * 4), Math.min(1, e.crit * 4));
      for (const s of segs) this.gl(col, s.x, s.y, 70 * s.s, 0.08 + 0.08 * rage);
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      this.bossWaves(g);
    }

    // Die Rotmother: Leib im Wasser, zwei Tentakel aus aneinandergereihten Segmenten
    drawRot(g, e, rage) {
      const c = this.c, R = e.R, rt = e.rot, I = this.img, F = BOSS.rot;
      const col = this.glowOf(e.cfg.color);
      const flash = Math.max(e.hitFlash || 0, e.dying ? 0.25 + 0.25 * Math.sin(g.time * 30) : 0);
      const segIm = I[R.parts.seg], tipIm = I[R.parts.tip], bodyIm = I[R.parts.body];
      if (!bodyIm) return;
      // Tentakel: Segment für Segment entlang des Seils
      for (const a of rt.arms) {
        for (let i = 0; i < a.pts.length - 1; i++) {
          const p0 = a.pts[i], p1 = a.pts[i + 1];
          const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
          const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
          const taper = 1 - i / a.pts.length * 0.45;
          if (segIm) {
            c.save();
            c.translate(p0.x, p0.y);
            c.rotate(ang - Math.PI / 2);
            const h = len * 1.25, wd = R.segH * taper;
            c.drawImage(segIm, -wd / 2, -h * 0.12, wd, h);
            c.restore();
          }
        }
        const last = a.pts[a.pts.length - 1], prev = a.pts[a.pts.length - 2];
        if (tipIm && prev) {
          const ang = Math.atan2(last.y - prev.y, last.x - prev.x);
          this.piece(tipIm, F.tip.a, F.tip.b, prev.x, prev.y, ang, R.tipH);
        }
        if (a.state === 'slam' || a.state === 'sweep') {
          c.globalCompositeOperation = 'lighter';
          this.gl(col, last.x, last.y, 160, 0.5);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        }
      }
      // Leib
      const BH = R.bodyH * (e.swell || 1);
      this.spr(R.parts.body, e.x, e.y, BH, { flip: true, flash, sy: (e.swell || 1) });
      // Eiersack und Maul leuchten
      c.globalCompositeOperation = 'lighter';
      this.gl(col, e.x + R.core.x, e.y + R.core.y, 280 + 40 * Math.sin(g.time * 3), 0.35 + 0.2 * rage);
      const m = e.mouthPos || { x: e.x, y: e.y };
      this.gl(col, m.x, m.y, 120 + 180 * (rt.mouth || 0), 0.4 + 0.4 * (rt.mouth || 0));
      if (e.crit > 0) this.gl(this.glows.gold, e.x + R.core.x, e.y + R.core.y, 260 * Math.min(1, e.crit * 4), Math.min(1, e.crit * 4));
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      this.bossWaves(g);
    }

    drawStrikes(g) {
      const c = this.c, fy = g.L.ph - 3 * 64;
      for (const s of g.strikes) {
        c.globalCompositeOperation = 'lighter';
        if (!s.hit) {
          const k = s.t / s.warn;
          c.globalAlpha = 0.25 + 0.35 * (Math.sin(g.time * 30) > 0 ? 1 : 0.3);
          c.fillStyle = '#ff3a3a';
          c.fillRect(s.x - 4 - k * 60, -2000, 8 + k * 120, fy + 2000);
          c.globalAlpha = 0.9;
          c.strokeStyle = '#ff5a5a'; c.lineWidth = 4;
          c.beginPath(); c.ellipse(s.x, fy - 4, 70 * (1.4 - k * 0.4), 16, 0, 0, TAU); c.stroke();
        } else {
          const k = clamp(1 - (s.t - s.warn) / s.dur, 0, 1);
          const rgb = hexRgb(s.color || '#9dff4a');
          const gr = c.createLinearGradient(s.x - 70, 0, s.x + 70, 0);
          gr.addColorStop(0, `rgba(${rgb},0)`); gr.addColorStop(0.5, `rgba(255,255,240,${k})`); gr.addColorStop(1, `rgba(${rgb},0)`);
          c.globalAlpha = 1;
          c.fillStyle = gr; c.fillRect(s.x - 80, -2000, 160, fy + 2000);
          this.gl(this.glowOf(s.color || '#9dff4a'), s.x, fy, 400 * k, k);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
      const b = g.bossBeam;
      if (b) {
        c.globalCompositeOperation = 'lighter';
        if (b.t < b.warn) {
          // Warnlinie mit Hinweis, was zu tun ist
          c.globalAlpha = Math.sin(g.time * 36) > 0 ? 0.8 : 0.3;
          c.fillStyle = '#ff3a4a'; c.fillRect(b.x0, b.y - 2, b.x1 - b.x0, 4);
          c.globalAlpha = 0.15; c.fillRect(b.x0, b.y - 22, b.x1 - b.x0, 44);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
          this.glowText(b.low ? 'JUMP!' : 'DUCK!', `900 40px ${FONT}`, '#ffffff', '#ff3a4a', 14, g.player.x, b.low ? b.y - 170 : b.y - 60);
          c.globalCompositeOperation = 'lighter';
        } else if (b.t < b.warn + b.dur) {
          const k = 1 - (b.t - b.warn) / b.dur, rgb = hexRgb(b.color);
          for (const [w, a] of [[70, 0.25], [40, 0.5], [16, 0.9], [6, 1]]) {
            c.globalAlpha = a * (0.6 + 0.4 * k);
            c.fillStyle = w > 20 ? `rgb(${rgb})` : '#ffffff';
            const j = (Math.random() - 0.5) * 6;
            c.fillRect(b.x0, b.y - w / 2 + j, b.x1 - b.x0, w);
          }
          this.gl(this.glowOf(b.color), b.x1, b.y, 260, 1);
          this.gl(this.glowOf(b.color), b.x0 + 20, b.y, 200, 0.8);
        }
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    }

    // ---------- Geschosse und Partikel ----------

    drawBullets(g) {
      const c = this.c;
      c.globalCompositeOperation = 'lighter';
      for (const b of g.bullets) {
        if (b.kind === 'bolt' || b.kind === 'spread') {
          const col = b.kind === 'bolt' ? '#5ae0ff' : '#ffa640';
          const sp = Math.hypot(b.vx, b.vy), dx = b.vx / sp, dy = b.vy / sp, L = b.kind === 'bolt' ? 64 : 36;
          c.globalAlpha = 0.9;
          c.strokeStyle = col; c.lineWidth = b.kind === 'bolt' ? 10 : 12; c.lineCap = 'round';
          c.beginPath(); c.moveTo(b.x - dx * L, b.y - dy * L); c.lineTo(b.x, b.y); c.stroke();
          c.strokeStyle = '#ffffff'; c.lineWidth = 4;
          c.beginPath(); c.moveTo(b.x - dx * L * 0.7, b.y - dy * L * 0.7); c.lineTo(b.x, b.y); c.stroke();
          this.gl(this.glowOf(col), b.x, b.y, 60, 0.7);
        } else if (b.kind === 'rocket') {
          c.globalCompositeOperation = 'source-over';
          c.save(); c.translate(b.x, b.y); c.rotate(b.ang);
          c.globalAlpha = 1;
          c.fillStyle = '#3a3a42'; c.fillRect(-14, -5, 26, 10);
          c.fillStyle = '#ffe36a'; c.fillRect(8, -5, 6, 10);
          c.restore();
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.fire, b.x - Math.cos(b.ang) * 18, b.y - Math.sin(b.ang) * 18, 70, 0.9);
        } else if (b.kind === 'grenade') {
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          c.fillStyle = '#2a3020'; c.beginPath(); c.arc(b.x, b.y, 11, 0, TAU); c.fill();
          c.fillStyle = '#5a6a40'; c.beginPath(); c.arc(b.x - 3, b.y - 3, 5, 0, TAU); c.fill();
          c.globalCompositeOperation = 'lighter';
          if (Math.sin(b.life * (b.life < 0.5 ? 60 : 20)) > 0) this.gl(this.glows.red, b.x, b.y, 50, 1);
        }
      }
      for (const b of g.ebullets) {
        const col = b.color || '#ff4a5a';
        if (b.kind === 'thorn') {           // Stachel
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
          c.fillStyle = '#ffe6b0';
          c.beginPath(); c.moveTo(16, 0); c.lineTo(-10, 5); c.lineTo(-10, -5); c.fill();
          c.restore();
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, b.x, b.y, 36, 0.5);
          continue;
        }
        if (b.kind === 'shell') {            // Mörsergranate mit Zielmarkierung am Boden
          c.globalCompositeOperation = 'lighter';
          const k = 0.4 + 0.3 * Math.sin(g.time * 16);
          c.globalAlpha = k;
          c.strokeStyle = '#ff6a3a'; c.lineWidth = 4;
          c.beginPath(); c.ellipse(b.markX, b.markY - 6, 80, 22, 0, 0, TAU); c.stroke();
          c.beginPath(); c.ellipse(b.markX, b.markY - 6, 40, 11, 0, 0, TAU); c.stroke();
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          c.save(); c.translate(b.x, b.y); c.rotate(Math.atan2(b.vy, b.vx));
          c.fillStyle = '#3a3026'; c.fillRect(-16, -8, 32, 16);
          c.fillStyle = '#ffb14a'; c.fillRect(-20, -5, 6, 10);
          c.restore();
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, b.x, b.y, 50, 0.6);
          continue;
        }
        if (b.kind === 'bomb') {
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          c.fillStyle = '#2a2230'; c.beginPath(); c.arc(b.x, b.y, 13, 0, TAU); c.fill();
          c.fillStyle = '#6a5a78'; c.fillRect(b.x - 4, b.y - 18, 8, 7);
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.orange, b.x, b.y, 60, Math.sin(b.t * 30) > 0 ? 1 : 0.4);
          continue;
        }
        if (b.kind === 'acid') {
          c.globalCompositeOperation = 'source-over';
          c.globalAlpha = 1;
          c.fillStyle = '#6adf2a'; c.beginPath(); c.ellipse(b.x, b.y, 10, 13, Math.atan2(b.vy, b.vx) + Math.PI / 2, 0, TAU); c.fill();
          c.globalCompositeOperation = 'lighter';
          this.gl(this.glows.green, b.x, b.y, 50, 0.6);
          continue;
        }
        const s = b.r * (b.kind === 'big' ? 5.5 : 5) * (1 + 0.15 * Math.sin(b.t * 30));
        this.gl(this.glowOf(col), b.x, b.y, s, 0.95);
        this.gl(this.glows.white, b.x, b.y, b.r * 2.4, 1);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    drawParts(g) {
      const c = this.c;
      // erst Rauch und Schutt (normal), dann alles Leuchtende (additiv)
      for (const q of g.parts) {
        const k = q.life / q.max;
        if (q.kind === 'smoke') {
          const s = q.size * (2.2 - k * 1.2);
          c.globalAlpha = 0.5 * k;
          c.drawImage(this.smokeOf(q.color), q.x - s, q.y - s, s * 2, s * 2);
        } else if (q.kind === 'debris' || q.kind === 'casing') {
          c.globalAlpha = Math.min(1, k * 3);
          c.save(); c.translate(q.x, q.y); c.rotate(q.rot || 0);
          c.fillStyle = q.color;
          if (q.kind === 'casing') c.fillRect(-q.size, -q.size / 2.5, q.size * 2, q.size / 1.25);
          else { c.fillRect(-q.size / 2, -q.size / 2, q.size, q.size * 0.7); c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(-q.size / 2, -q.size / 2, q.size, 2); }
          c.restore();
        } else if (q.kind === 'goo') {
          c.globalAlpha = Math.min(1, k * 2);
          c.fillStyle = q.color;
          c.beginPath(); c.arc(q.x, q.y, q.size * (0.6 + 0.4 * k), 0, TAU); c.fill();
        }
      }
      c.globalCompositeOperation = 'lighter';
      for (const q of g.parts) {
        const k = q.life / q.max;
        switch (q.kind) {
          case 'spark':
            c.globalAlpha = Math.min(1, k * 1.5);
            c.strokeStyle = q.color; c.lineWidth = q.size; c.lineCap = 'round';
            c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.025, q.y - q.vy * 0.025); c.stroke();
            break;
          case 'fire':
            this.gl(this.glows.fire, q.x, q.y, q.size * (1 + (1 - k)) * 2, k * 0.9);
            break;
          case 'flash':
            this.gl(this.glowOf(q.color), q.x, q.y, q.size, k);
            break;
          case 'boom': {
            const im = q.plasma ? this.img.plasma : this.img.explosion;
            if (im) {
              const s = q.size * (0.5 + 0.7 * easeOut(1 - k));
              c.save(); c.translate(q.x, q.y); c.rotate(q.rot);
              c.globalAlpha = Math.min(1, k * 1.6);
              c.drawImage(im, -s / 2, -s / 2, s, s);
              c.restore();
            }
            break;
          }
          case 'ring': {
            const r = q.size * (0.15 + 0.85 * easeOut(1 - k));
            c.globalAlpha = k * 0.8;
            c.strokeStyle = q.color; c.lineWidth = 3 + 12 * k;
            c.beginPath(); c.arc(q.x, q.y, r, 0, TAU); c.stroke();
            break;
          }
          case 'debris':
            if (q.hot && k > 0.4) this.gl(this.glows.fire, q.x, q.y, q.size * 3, (k - 0.4));
            break;
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // Sporenwolken: weiche, giftig grüne Schwaden
    drawClouds(g) {
      const c = this.c;
      for (const cl of g.clouds) {
        const a = Math.min(1, cl.t * 2) * Math.min(1, (cl.life - cl.t) / 1.5);
        c.globalAlpha = 0.35 * a;
        c.drawImage(this.smokeOf('#8ab83a'), cl.x - cl.r, cl.y - cl.r, cl.r * 2, cl.r * 2);
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 0.12 * a;
        this.gl(this.glowOf('#c8ff5a'), cl.x, cl.y, cl.r * 2.2, 1);
        c.globalAlpha = 1;
        c.globalCompositeOperation = 'source-over';
      }
    }

    drawFloaters(g) {
      for (const f of g.floaters) {
        this.c.globalAlpha = clamp(1 - (f.t - 0.7) / 0.4, 0, 1);
        this.glowText(f.text, `700 26px ${FONT}`, f.color, '#000', 6, f.x, f.y);
      }
      this.c.globalAlpha = 1;
    }

    drawForeground(g) {
      const c = this.c;
      // treibender Staub und Glut
      c.globalCompositeOperation = 'lighter';
      for (const d of this.dust) {
        const x = ((d.x - g.cam.x * d.z * 0.6) % W + W) % W;
        const y = ((d.y + g.time * 30 * d.z - g.cam.y * d.z * 0.6) % H + H) % H;
        c.globalAlpha = 0.25 * d.z * (0.6 + 0.4 * Math.sin(g.time * 2 + d.s));
        c.fillStyle = d.z > 1 ? '#ffb46a' : '#9ad8ff';
        c.fillRect(x, y, 2 * d.z, 2 * d.z);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.drawImage(this.vig, 0, 0, W, H);
      const p = g.player;
      const low = !p.dead && p.hp < 30 ? 0.35 + 0.25 * Math.sin(g.time * 6) : 0;
      if (g.hurtFlash > 0 || low > 0) { c.globalAlpha = Math.max(g.hurtFlash, low); c.drawImage(this.hurtVig, 0, 0, W, H); c.globalAlpha = 1; }
      if (g.flash > 0) {
        c.globalAlpha = g.flash * 0.8;
        c.fillStyle = g.flashColor; c.fillRect(0, 0, W, H);
        c.globalAlpha = 1;
      }
    }

    // ---------- HUD ----------

    drawHud(g, screen) {
      const c = this.c, p = g.player, D = GameDefs;
      // Lebensenergie
      c.fillStyle = 'rgba(4,8,16,0.55)';
      roundRect(c, 30, 26, 520, 150, 14); c.fill();
      if (this.img.hero_full) this.spr('hero_full', 90, 100, 120);
      this.glowText('ARMOR', `700 20px ${FONT}`, '#bfe8ff', '#3fb4ff', 8, 150, 60, 'left');
      const segs = 20, hp = Math.max(0, p.hp) / D.P.hp;
      for (let i = 0; i < segs; i++) {
        const on = i < Math.ceil(hp * segs);
        const col = hp > 0.5 ? '#6aff8a' : hp > 0.25 ? '#ffd24a' : '#ff4a4a';
        c.fillStyle = on ? col : 'rgba(255,255,255,0.08)';
        c.fillRect(150 + i * 18, 72, 14, 26);
      }
      // Jetpack
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(150, 106, 356, 6);
      c.fillStyle = '#ffb14a'; c.fillRect(150, 106, 356 * p.fuel, 6);
      // Leben und Granaten
      this.glowText('x' + Math.max(0, g.lives), `900 26px ${FONT}`, '#ffffff', '#3fb4ff', 8, 150, 150, 'left');
      for (let i = 0; i < p.grenades; i++) {
        c.fillStyle = '#5a6a40'; c.beginPath(); c.arc(236 + i * 26, 141, 9, 0, TAU); c.fill();
        c.fillStyle = '#ff5a4a'; c.fillRect(233 + i * 26, 129, 6, 4);
      }
      // Waffe
      const wp = D.WEAPONS[p.weapon];
      c.fillStyle = 'rgba(4,8,16,0.55)';
      roundRect(c, 30, 186, 520, 64, 14); c.fill();
      this.glowText(wp.name, `900 24px ${FONT}`, '#ffffff', wp.color, 12, 50, 228, 'left');
      const am = p.ammo[p.weapon];
      this.glowText(am === Infinity ? '∞' : String(Math.ceil(am)), `900 28px ${FONT}`, wp.color, wp.color, 8, 530, 230, 'right');
      let ix = 50;
      for (const w of D.ORDER) {
        if (!(p.ammo[w] > 0)) continue;
        c.fillStyle = w === p.weapon ? D.WEAPONS[w].color : 'rgba(255,255,255,0.25)';
        c.fillRect(ix, 240, 40, 4);
        ix += 48;
      }
      // Punkte, Münzen, Kette
      this.glowText(String(g.score).padStart(8, '0'), `900 46px ${FONT}`, '#ffffff', '#3fb4ff', 14, W - 40, 76, 'right');
      c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(W - 200, 110, 12, 0, TAU); c.fill();
      this.glowText(String(g.coins), `700 26px ${FONT}`, '#ffd24a', '#ff9a00', 8, W - 40, 120, 'right');
      if (g.combo > 1) {
        const m = g.mult();
        this.glowText(g.combo + ' HITS' + (m > 1 ? '  x' + m : ''), `900 30px ${FONT}`, '#ffd24a', '#ff7a00', 12, W - 40, 170, 'right');
        c.fillStyle = 'rgba(255,210,74,0.8)'; c.fillRect(W - 40 - 240 * (g.comboT / 2.5), 182, 240 * (g.comboT / 2.5), 4);
      }
      // Boss
      const b = g.boss;
      if (b && !b.dead && !b.intro) {
        const w = 1100, jit = (b.barFlash || 0) * 5, x = W / 2 - w / 2 + rnd2(jit), y = H - 70 + rnd2(jit);
        c.fillStyle = 'rgba(4,8,16,0.7)'; roundRect(c, x - 16, y - 46, w + 32, 80, 12); c.fill();
        this.glowText(b.cfg.name, `900 24px ${FONT}`, '#ff6a6a', '#ff0000', 12, W / 2, y - 14);
        c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x, y, w, 18);
        const k = Math.max(0, b.hp / b.maxHp), lag = Math.max(k, (b.hpLag ?? b.hp) / b.maxHp);
        // weißer Rest: der Schaden der letzten Sekunde läuft sichtbar nach
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.fillRect(x + w * k, y, w * (lag - k), 18);
        const gr = c.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, '#ff2a4a'); gr.addColorStop(1, '#9dff4a');
        c.fillStyle = gr; c.fillRect(x, y, w * k, 18);
        if (b.barFlash > 0) {
          c.globalCompositeOperation = 'lighter';
          c.globalAlpha = b.barFlash * 0.3;
          c.fillStyle = '#ffffff'; c.fillRect(x, y, w * k, 18);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        }
        c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x + w * 0.33, y, 3, 18); c.fillRect(x + w * 0.66, y, 3, 18);
      }
      // Banner
      const bn = g.banner;
      if (bn) {
        const a = clamp(Math.min(bn.t * 5, (bn.dur - bn.t) * 3), 0, 1);
        const s = 1 + 0.4 * (1 - easeOut(bn.t * 4));
        c.save();
        c.globalAlpha = a;
        c.translate(W / 2, bn.small ? 330 : 440); c.scale(s, s);
        if (!bn.small) {
          c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(-W, -90, W * 2, bn.sub ? 160 : 130);
        }
        if (bn.text === 'WARNING' && Math.sin(g.time * 14) < -0.3) c.globalAlpha = a * 0.3;
        this.glowText(bn.text, `900 ${bn.small ? 44 : 90}px ${FONT}`, '#ffffff', bn.color, 24, 0, bn.small ? 0 : 20);
        if (bn.sub) this.glowText(bn.sub, `700 30px ${FONT}`, bn.color, bn.color, 8, 0, 60);
        c.restore();
      }
      // Fadenkreuz: mit der Maus hart am Zeiger, mit dem Stick weicher vor dem Helden
      if (screen.cross && !p.dead) {
        const { x, y, soft } = screen.cross;
        c.strokeStyle = wp.color; c.lineWidth = soft ? 2 : 3;
        c.globalAlpha = soft ? 0.55 : 0.9;
        c.beginPath(); c.arc(x, y, soft ? 14 : 18, 0, TAU); c.stroke();
        c.beginPath();
        c.moveTo(x - 30, y); c.lineTo(x - 10, y); c.moveTo(x + 10, y); c.lineTo(x + 30, y);
        c.moveTo(x, y - 30); c.lineTo(x, y - 10); c.moveTo(x, y + 10); c.lineTo(x, y + 30);
        c.stroke();
        c.fillStyle = '#fff'; c.fillRect(x - 2, y - 2, 4, 4);
        c.globalAlpha = 1;
      }
      if (screen.note) this.toast(screen.note);
      if (screen.pad) this.padDebug(screen.pad);
      if (screen.mode === 'pause') this.overlay('PAUSE', 'PRESS ESC / START TO CONTINUE');
      if (screen.mode === 'over') this.endScreen(g, false);
      if (screen.mode === 'won') this.endScreen(g, true);
      if (screen.fps) this.glowText(screen.fps + ' FPS', `700 18px ${FONT}`, '#9ad8ff', '#000', 0, W - 40, H - 20, 'right');
    }

    // Kurze Meldung oben, etwa wenn ein Gamepad kommt oder geht
    toast(n) {
      const c = this.c, w = 520, x = W / 2 - w / 2, y = 24;
      c.fillStyle = 'rgba(4,8,16,0.72)';
      roundRect(c, x, y, w, n.sub ? 84 : 56, 12); c.fill();
      this.glowText(n.text, `900 28px ${FONT}`, '#ffffff', '#3fb4ff', 12, W / 2, y + 40);
      if (n.sub) this.glowText(n.sub, `700 20px ${FONT}`, '#9ad8ff', '#000', 0, W / 2, y + 70);
    }

    // Test-Anzeige für Gamepads (?pad=1): Sticks, Trigger und gedrückte Tasten
    padDebug(s) {
      const c = this.c, x = 40, y = H - 230;
      c.fillStyle = 'rgba(4,8,16,0.72)';
      roundRect(c, x - 16, y - 40, 560, 230, 12); c.fill();
      this.glowText('GAMEPAD', `900 22px ${FONT}`, '#bfe8ff', '#3fb4ff', 8, x, y - 10, 'left');
      const pad2 = (label, st, ox) => {
        const cx = x + ox + 60, cy = y + 70;
        c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
        c.beginPath(); c.arc(cx, cy, 52, 0, TAU); c.stroke();
        c.fillStyle = '#6affff';
        c.beginPath(); c.arc(cx + st.x * 46, cy + st.y * 46, 9, 0, TAU); c.fill();
        this.glowText(label, `700 16px ${FONT}`, '#9ad8ff', '#000', 0, cx, cy + 82);
      };
      pad2('L-STICK', s.ls, 0);
      pad2('R-STICK', s.rs, 150);
      // Trigger als Balken
      [['LT', s.lt, 0], ['RT', s.rt, 60]].forEach(([n, v, ox]) => {
        const bx = x + 330 + ox, by = y + 20;
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(bx, by, 26, 100);
        c.fillStyle = '#ffb14a'; c.fillRect(bx, by + 100 * (1 - v), 26, 100 * v);
        this.glowText(n, `700 16px ${FONT}`, '#9ad8ff', '#000', 0, bx + 13, by + 124);
      });
      const on = ['a', 'b', 'x', 'y', 'lb', 'rb', 'start', 'back', 'up', 'down', 'left', 'right']
        .filter(k => s[k]).join(' ').toUpperCase();
      this.glowText(on || '-', `700 20px ${FONT}`, '#ffd24a', '#000', 0, x + 330, y + 170, 'left');
    }

    overlay(title, sub) {
      const c = this.c;
      c.fillStyle = 'rgba(2,4,10,0.6)'; c.fillRect(0, 0, W, H);
      this.glowText(title, `900 100px ${FONT}`, '#ffffff', '#3fb4ff', 30, W / 2, H / 2);
      this.glowText(sub, `700 28px ${FONT}`, '#bfe8ff', '#3fb4ff', 8, W / 2, H / 2 + 70);
    }

    endScreen(g, won) {
      const c = this.c, k = clamp(g.endT / 1.5, 0, 1);
      c.fillStyle = `rgba(2,4,10,${0.7 * k})`; c.fillRect(0, 0, W, H);
      c.globalAlpha = k;
      const done = won && g.L.last;
      this.glowText(!won ? 'GAME OVER' : done ? 'MISSION COMPLETE' : 'STAGE ' + (g.L.index + 1) + ' CLEAR', `900 110px ${FONT}`,
        '#ffffff', won ? '#ffb14a' : '#ff3a3a', 34, W / 2, 330);
      if (won && !done) {
        const nx = Level.LEVELS[g.L.index + 1];
        this.glowText('NEXT:  ' + nx.name, `700 32px ${FONT}`, '#ffd9a0', '#ff7a00', 10, W / 2, 400);
      }
      const t = Math.floor(g.time);
      const rows = [['SCORE', String(g.score)], ['KILLS', String(g.kills)], ['BEST COMBO', String(g.bestCombo)],
        ['COINS', String(g.coins)], ['TIME', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')]];
      rows.forEach(([a, b], i) => {
        this.glowText(a, `700 34px ${FONT}`, '#9ad8ff', '#000', 0, W / 2 - 40, 460 + i * 60, 'right');
        this.glowText(b, `900 34px ${FONT}`, '#ffffff', '#3fb4ff', 10, W / 2 + 40, 460 + i * 60, 'left');
      });
      if (g.endT > 2 && Math.sin(g.time * 5) > -0.3) this.glowText('PRESS ENTER / START', `700 30px ${FONT}`, '#ffd24a', '#ff7a00', 10, W / 2, 820);
      c.globalAlpha = 1;
    }

    // ---------- Levelauswahl ----------

    // Bild passend in ein Rechteck einpassen (Ausschnitt, kein Verzerren)
    cover(img, x, y, w, h) {
      const s = Math.max(w / img.width, h / img.height);
      const iw = img.width * s, ih = img.height * s;
      this.c.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    }

    drawSelect(s) {
      const c = this.c, t = s.time, cards = s.select.cards, sel = s.select.sel, best = s.select.best || [];
      const cur = cards[sel];
      // Hintergrund: der Schauplatz des gewählten Levels
      const bg = this.img[cur.def.theme.sky];
      c.fillStyle = '#05070c'; c.fillRect(0, 0, W, H);
      if (bg) {
        c.globalAlpha = 0.55;
        this.cover(bg, -30 + Math.sin(t * 0.2) * 20, -20, W + 60, H + 40);
        c.globalAlpha = 1;
      }
      const gr = c.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(2,4,10,0.85)'); gr.addColorStop(0.45, 'rgba(2,4,10,0.55)'); gr.addColorStop(1, 'rgba(2,4,10,0.95)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.drawImage(this.vig, 0, 0, W, H);

      this.glowText('SELECT STAGE', `900 74px ${FONT}`, '#fff4e0', '#ff8a2a', 24, W / 2, 200);
      this.glowText(cur.def.sub, `700 26px ${FONT}`, '#ffd9a0', '#ff7a00', 8, W / 2, 250);

      for (const card of cards) {
        const on = card.i === sel;
        const k = on ? 1.1 : 1;
        const w = card.w * k, h = card.h * k;
        const x = card.x + (card.w - w) / 2, y = card.y + (card.h - h) / 2 - (on ? 14 : 0);
        const b = best[card.i] || {};
        c.save();
        // Bild des Levels als Kartenmotiv
        c.beginPath();
        roundRect(c, x, y, w, h, 14);
        c.clip();
        const im = this.img[card.def.theme.sky];
        c.globalAlpha = on ? 1 : 0.5;
        if (im) this.cover(im, x, y, w, h);
        else { c.fillStyle = '#1a2230'; c.fillRect(x, y, w, h); }
        const g2 = c.createLinearGradient(0, y + h * 0.35, 0, y + h);
        g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.9)');
        c.fillStyle = g2; c.fillRect(x, y + h * 0.35, w, h * 0.65);
        c.globalAlpha = 1;
        c.restore();
        // Rahmen
        c.save();
        roundRect(c, x, y, w, h, 14);
        c.strokeStyle = on ? '#ffd24a' : 'rgba(255,255,255,0.25)';
        c.lineWidth = on ? 4 : 2;
        if (on) { c.shadowColor = '#ff8a2a'; c.shadowBlur = 24; }
        c.stroke();
        c.restore();
        // Beschriftung
        this.glowText('STAGE ' + (card.i + 1), `700 20px ${FONT}`, on ? '#ffd24a' : '#9ad8ff', '#000', 0, x + 16, y + 34, 'left');
        this.glowText(card.def.name, `900 ${on ? 30 : 26}px ${FONT}`, '#ffffff', on ? '#ff8a2a' : '#000', on ? 12 : 0,
          x + 16, y + h - 46, 'left');
        this.glowText(card.def.boss ? GameDefs.BOSSES[card.def.boss].name : '', `600 16px ${FONT}`,
          on ? '#ffd9a0' : '#8aa0b0', '#000', 0, x + 16, y + h - 20, 'left');
        if (b.cleared) {
          this.glowText('CLEARED', `700 16px ${FONT}`, '#6aff8a', '#0a2a10', 8, x + w - 16, y + 34, 'right');
          this.glowText(String(b.score || 0), `700 18px ${FONT}`, '#ffd24a', '#000', 0, x + w - 16, y + h - 20, 'right');
        }
      }

      const hint = s.device === 'gamepad'
        ? 'D-PAD / L-STICK  SELECT      A  START      B  BACK'
        : '← →  SELECT      ENTER / CLICK  START      ESC  BACK';
      this.glowText(hint, `700 24px ${FONT}`, '#bfe8ff', '#3fb4ff', 10, W / 2, 720);
      if (Math.sin(t * 4) > -0.4) this.glowText('PRESS START TO DROP IN', `900 34px ${FONT}`, '#ffffff', '#ff8a2a', 16, W / 2, 800);
      if (s.note) this.toast(s.note);
      if (s.pad) this.padDebug(s.pad);
      // Mauszeiger
      if (s.cross) {
        const { x, y } = s.cross;
        c.strokeStyle = '#ffd24a'; c.lineWidth = 2; c.globalAlpha = 0.9;
        c.beginPath(); c.arc(x, y, 10, 0, TAU); c.stroke();
        c.globalAlpha = 1;
      }
    }

    // ---------- Titel ----------

    drawTitle(s) {
      const c = this.c, t = s.time, im = this.img.title;
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      if (im) {
        const z = 1.08 + 0.05 * Math.sin(t * 0.15);
        const w = W * z, h = w * im.height / im.width;
        c.drawImage(im, W / 2 - w / 2 + Math.sin(t * 0.1) * 30, H / 2 - h / 2, w, h);
      }
      const gr = c.createLinearGradient(0, H * 0.4, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.92)');
      c.fillStyle = gr; c.fillRect(0, 0, W, H);
      c.drawImage(this.vig, 0, 0, W, H);
      // Logo mit Farbversatz
      const y = 760;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5;
      this.glowText('SPACEBOSS', `900 170px ${FONT}`, '#ff3a3a', '#ff3a3a', 0, W / 2 - 6 + Math.sin(t * 13) * 2, y);
      this.glowText('SPACEBOSS', `900 170px ${FONT}`, '#3ad8ff', '#3ad8ff', 0, W / 2 + 6, y);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      this.glowText('SPACEBOSS', `900 170px ${FONT}`, '#fff4e0', '#ff8a2a', 40, W / 2, y);
      this.glowText('ONE MAN.  ONE SUIT.  A PLANET FULL OF ALIENS.', `700 30px ${FONT}`, '#ffd9a0', '#ff7a00', 10, W / 2, y + 80);
      if (s.loading) this.glowText('LOADING  ' + Math.round(s.loading * 100) + '%', `700 32px ${FONT}`, '#bfe8ff', '#3fb4ff', 10, W / 2, 930);
      else if (Math.sin(t * 4) > -0.4) this.glowText(s.touch ? 'TAP TO START' : 'PRESS ENTER / START / CLICK', `900 40px ${FONT}`, '#ffffff', '#ff8a2a', 18, W / 2, 935);
      const help = s.device === 'gamepad'
        ? 'L-STICK MOVE   R-STICK AIM   A JUMP (x2 JETPACK, HOLD = HOVER)   RT/X FIRE   LT/B DASH   RB GRENADE   LB/Y WEAPON   START PAUSE'
        : 'A/D MOVE   MOUSE AIM   LMB FIRE   SPACE JUMP (x2 JETPACK, HOLD = HOVER)   SHIFT DASH   RMB/G GRENADE   Q/E/WHEEL WEAPON   S DUCK   F FULLSCREEN';
      this.glowText(help, `600 20px ${FONT}`, '#9ad8ff', '#000', 0, W / 2, 1010);
      if (s.device !== 'gamepad')
        this.glowText('NO MOUSE?  ARROWS AIM + J FIRE + K JUMP + L DASH', `600 18px ${FONT}`, '#6a8aa0', '#000', 0, W / 2, 1045);
      if (s.note) this.toast(s.note);
      if (s.pad) this.padDebug(s.pad);
    }
  }

  function rnd2(a) { return a ? (Math.random() * 2 - 1) * a : 0; }

  function hexRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  window.Renderer = Renderer;
  window.HERO = HERO;
})();
