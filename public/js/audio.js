// Audio-Engine: Musik, Explosions-Samples (aus Hypersense übernommen) und synthetisierte Waffen-Sounds.
(function () {
  'use strict';

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.src = null;
      this.samples = {};
      this.sampleMeta = {};
      this._round = {};
      this._last = {};
    }

    ensure() {
      if (!this.ctx) {
        const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
        // Master mit Limiter: große Explosionen dürfen laut sein, aber nicht übersteuern
        this.master = ctx.createGain();
        this.master.gain.value = 0.9;
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -2;
        this.limiter.knee.value = 0;
        this.limiter.ratio.value = 20;
        this.limiter.attack.value = 0.001;
        this.limiter.release.value = 0.15;
        this.master.connect(this.limiter);
        this.limiter.connect(ctx.destination);

        // Musik: Gain -> Ducking -> Tiefpass (Pause, Tod) -> Master
        this.musicGain = ctx.createGain();
        this.musicGain.gain.value = 0.55;
        this.duckGain = ctx.createGain();
        this.lowpass = ctx.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 20000;
        this.musicGain.connect(this.duckGain);
        this.duckGain.connect(this.lowpass);
        this.lowpass.connect(this.master);

        // Effekte über einen Kompressor mit Aufholverstärkung: dicht und druckvoll
        this.sfxComp = ctx.createDynamicsCompressor();
        this.sfxComp.threshold.value = -18;
        this.sfxComp.knee.value = 6;
        this.sfxComp.ratio.value = 4;
        this.sfxComp.attack.value = 0.004;
        this.sfxComp.release.value = 0.2;
        this.sfxOut = ctx.createGain();
        this.sfxOut.gain.value = 1.5;
        this.sfxComp.connect(this.sfxOut);
        this.sfxOut.connect(this.master);
        this.bus = ctx.createGain();
        this.bus.gain.value = 0.5;
        this.bus.connect(this.sfxComp);
        this.noise = this._makeNoise();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    }

    async loadSamples(base = 'sfx/') {
      try {
        const meta = await fetch(base + 'sfx.json').then(r => r.json());
        await Promise.all(Object.entries(meta).map(async ([name, m]) => {
          const data = await fetch(base + m.file).then(r => r.arrayBuffer());
          this.samples[name] = await this.ensure().decodeAudioData(data);
          this.sampleMeta[name] = m;
        }));
      } catch (e) {
        console.warn('SFX samples not loaded', e);
      }
    }

    // ---------- Musik ----------

    playMusic(buffer, vol = 0.55) {
      this.stopMusic();
      const ctx = this.ensure();
      const src = this.src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(this.musicGain);
      this.musicGain.gain.cancelScheduledValues(ctx.currentTime);
      this.musicGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.musicGain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 1.2);
      src.start(ctx.currentTime + 0.05);
    }

    stopMusic() {
      if (this.src) {
        try { this.src.stop(); } catch (e) { /* schon gestoppt */ }
        this.src.disconnect();
        this.src = null;
      }
    }

    fadeMusic(sec, to = 0.0001) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime, g = this.musicGain.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(Math.max(0.0001, to), t + sec);
    }

    muffle(on, sec = 0.25) {
      if (this.ctx) this.lowpass.frequency.setTargetAtTime(on ? 450 : 20000, this.ctx.currentTime, sec);
    }

    // Zeitlupe: auch die Musik wird tiefer und langsamer
    slowmo(rate) {
      if (this.src) this.src.playbackRate.setTargetAtTime(rate, this.ctx.currentTime, 0.08);
    }

    pause() { if (this.ctx && this.ctx.state === 'running') return this.ctx.suspend(); }
    resume() { if (this.ctx && this.ctx.state === 'suspended') return this.ctx.resume(); }

    // ---------- Bausteine ----------

    _makeNoise() {
      const len = this.ctx.sampleRate;
      const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }

    _tone(freq, dur, type, vol, when, slideTo) {
      const ctx = this.ctx, t = when ?? ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + dur + 0.02);
    }

    _noise(dur, freq, vol, when, type = 'bandpass', q = 1.2, sweepTo) {
      const ctx = this.ctx, t = when ?? ctx.currentTime;
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = this.noise;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(freq, t);
      if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.bus);
      s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    }

    _sample(name, gain = 1, rate = 1, when) {
      const buf = this.samples[name];
      if (!buf) return false;
      const ctx = this.ctx, s = ctx.createBufferSource(), g = ctx.createGain();
      s.buffer = buf;
      s.playbackRate.value = rate;
      g.gain.value = gain;
      s.connect(g); g.connect(this.bus);
      s.start(when ?? ctx.currentTime);
      return true;
    }

    _variant(base, n, gain) {
      const i = this._round[base] = ((this._round[base] || 0) + 1) % n;
      return this._sample(base + (i + 1), gain, 0.9 + Math.random() * 0.2);
    }

    // Derselbe Klang höchstens alle "gap" Sekunden (Dauerfeuer, Treffer-Schwärme)
    _gate(key, gap) {
      const t = this.ctx.currentTime;
      if (t - (this._last[key] || 0) < gap) return false;
      this._last[key] = t;
      return true;
    }

    duck(depth, dur) {
      const g = this.duckGain.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setTargetAtTime(1 - depth, t, 0.01);
      g.setTargetAtTime(1, t + 0.05, dur / 3);
    }

    _punch(size) {
      this._noise(0.05 + 0.03 * size, 2400, 0.35 + 0.1 * size, undefined, 'highpass', 0.7);
      this._tone(95 + 20 / size, 0.18 + 0.12 * size, 'sine', 0.55 + 0.15 * size, undefined, 32);
    }

    // ---------- Spieler ----------

    shot(weapon) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      if (weapon === 'blaster') {
        this._noise(0.05, 4800, 0.12, t, 'highpass', 0.7);
        this._tone(420 + Math.random() * 60, 0.07, 'square', 0.06, t, 90);
        this._tone(1600, 0.04, 'sawtooth', 0.03, t, 400);
      } else if (weapon === 'spread') {
        this._noise(0.12, 1800, 0.3, t, 'bandpass', 0.8, 300);
        this._tone(160, 0.14, 'square', 0.12, t, 50);
      } else if (weapon === 'rocket') {
        this._noise(0.45, 600, 0.22, t, 'bandpass', 1.5, 3800);
        this._tone(90, 0.25, 'sawtooth', 0.1, t, 40);
      } else if (weapon === 'grenade') {
        this._noise(0.12, 900, 0.15, t, 'bandpass', 2, 2400);
        this._tone(300, 0.1, 'triangle', 0.08, t, 600);
      }
    }

    // Laser: ein Dauerton, der beim Feuern läuft (start/stop)
    laser(on) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      if (on && !this._laser) {
        const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
        o1.type = 'sawtooth'; o1.frequency.value = 110;
        o2.type = 'square'; o2.frequency.value = 223;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 18; lg.gain.value = 600;
        lfo.connect(lg); lg.connect(f.frequency);
        f.type = 'bandpass'; f.frequency.value = 1400; f.Q.value = 2;
        g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.05);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(this.bus);
        [o1, o2, lfo].forEach(o => o.start());
        this._laser = { g, nodes: [o1, o2, lfo] };
        this._noise(0.25, 6000, 0.2, undefined, 'highpass', 1, 1200);
      } else if (!on && this._laser) {
        const l = this._laser, t = ctx.currentTime;
        l.g.gain.cancelScheduledValues(t);
        l.g.gain.setValueAtTime(l.g.gain.value, t);
        l.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
        l.nodes.forEach(o => o.stop(t + 0.1));
        this._laser = null;
      }
    }

    jump(air) {
      if (!this.ctx) return;
      if (air) {                           // Jetpack-Stoß
        this._noise(0.35, 500, 0.35, undefined, 'lowpass', 1, 2500);
        this._tone(70, 0.2, 'sawtooth', 0.1, undefined, 140);
      } else {
        this._noise(0.08, 1200, 0.12, undefined, 'bandpass', 1);
        this._tone(180, 0.1, 'triangle', 0.08, undefined, 320);
      }
    }
    jet() {
      if (this.ctx && this._gate('jet', 0.09)) this._noise(0.14, 700, 0.1, undefined, 'lowpass', 0.8, 1600);
    }
    land(h) {
      if (!this.ctx) return;
      this._tone(110, 0.12, 'sine', 0.15 + 0.2 * h, undefined, 45);
      this._noise(0.1, 800, 0.1 + 0.15 * h, undefined, 'lowpass', 0.8);
    }
    step() {
      if (this.ctx) this._noise(0.05, 600 + Math.random() * 300, 0.08, undefined, 'bandpass', 2);
    }
    dash() {
      if (!this.ctx) return;
      this._noise(0.3, 400, 0.35, undefined, 'bandpass', 1.5, 5000);
      this._tone(200, 0.2, 'sawtooth', 0.06, undefined, 900);
    }
    hurt() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this._noise(0.22, 2200, 0.45, t, 'bandpass', 3, 500);
      this._tone(260, 0.25, 'sawtooth', 0.2, t, 60);
      this.duck(0.3, 0.3);
    }
    die() {
      if (!this.ctx) return;
      if (this._sample('big2', 1.3)) this._punch(3);
      this._tone(300, 0.9, 'sawtooth', 0.25, undefined, 40);
      this.duck(0.5, 1.2);
    }
    empty() {
      if (this.ctx && this._gate('empty', 0.2)) this._tone(900, 0.04, 'square', 0.06, undefined, 700);
    }
    weaponSwitch() {
      if (!this.ctx) return;
      this._tone(600, 0.05, 'square', 0.06);
      this._tone(1200, 0.06, 'square', 0.05, this.ctx.currentTime + 0.05);
    }

    pickup(type) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const own = { H: 'pickup_energy', G: 'pickup_missile', R: 'pickup_missile', A: 'pickup_shield',
        Q: 'pickup_shield' }[type];
      if (own && this._sample(own, 1)) return;
      [0, 4, 7, 12, 16].forEach((s, i) => this._tone(523 * Math.pow(2, s / 12), 0.12, 'triangle', 0.25, t + i * 0.05));
    }
    // Extras: aufsteigender Akkord beim Einsammeln, absteigend wenn sie auslaufen
    powerUp() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [0, 7, 12, 16, 19, 24].forEach((s, i) => this._tone(330 * Math.pow(2, s / 12), 0.16, 'sawtooth', 0.14, t + i * 0.045));
      this._noise(0.5, 900, 0.14, t, 'bandpass', 1.5, 6000);
    }
    powerDown() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [12, 7, 3, 0].forEach((s, i) => this._tone(440 * Math.pow(2, s / 12), 0.12, 'triangle', 0.16, t + i * 0.07));
    }
    shieldBlock() {
      if (!this.ctx || !this._gate('shield', 0.08)) return;
      const t = this.ctx.currentTime;
      this._tone(1400, 0.18, 'sine', 0.22, t, 500);
      this._noise(0.2, 3000, 0.16, t, 'highpass', 1, 800);
    }
    jetThrust() {
      if (this.ctx && this._gate('jet', 0.07)) this._noise(0.16, 500, 0.16, undefined, 'lowpass', 0.9, 1400);
    }
    checkpoint() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [0, 7, 12, 19, 24].forEach((s, i) => this._tone(440 * Math.pow(2, s / 12), 0.2, 'triangle', 0.22, t + i * 0.07));
      this._noise(0.6, 400, 0.18, t, 'bandpass', 2, 5000);
    }
    coin(n = 0) {
      if (!this.ctx || !this._gate('coin', 0.03)) return;
      const steps = [0, 2, 4, 7, 9, 12, 14, 16];
      const f = 1320 * Math.pow(2, steps[n % steps.length] / 12);
      this._tone(f, 0.07, 'sine', 0.1);
      this._tone(f * 2, 0.05, 'sine', 0.04);
    }
    menuMove() { if (this.ctx) this._tone(880, 0.04, 'triangle', 0.08); }
    confirm() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [0, 7, 12].forEach((s, i) => this._tone(440 * Math.pow(2, s / 12), 0.15, 'square', 0.1, t + i * 0.06));
    }

    // ---------- Welt ----------

    hit(kind) {
      if (!this.ctx) return;
      if (kind === 'metal') {
        if (this._gate('hm', 0.035)) this._tone(1400 + Math.random() * 800, 0.05, 'square', 0.035, undefined, 600);
      } else if (this._gate('hf', 0.035)) {        // Alien-Fleisch: nasses Klatschen
        this._noise(0.07, 900 + Math.random() * 500, 0.16, undefined, 'bandpass', 2.5, 300);
      }
    }
    enemyShot(big) {
      if (!this.ctx || !this._gate(big ? 'es2' : 'es', 0.05)) return;
      if (big) {
        this._tone(140, 0.3, 'sawtooth', 0.12, undefined, 50);
        this._noise(0.25, 800, 0.18, undefined, 'bandpass', 2, 200);
      } else {
        this._tone(760, 0.12, 'square', 0.05, undefined, 190);
      }
    }
    // size: 1 = klein, 2 = mittel, 3 = groß
    boom(size, rock = false) {
      if (!this.ctx) return;
      if (!this._gate('boom' + size, size > 2 ? 0.08 : 0.04)) return;
      let ok;
      if (size < 1.5) ok = this._variant('small', 3, 0.9);
      else if (size < 2.5) { ok = this._variant('medium', 3, 1); this.duck(0.25, 0.35); }
      else { ok = this._sample('big' + (1 + Math.floor(Math.random() * 2)), 1); this.duck(0.45, 0.8); }
      if (rock) this._sample('debris', 0.7, 0.9 + Math.random() * 0.2);
      if (ok) this._punch(Math.min(size, 3));
      else {
        this._noise(size > 1 ? 0.7 : 0.28, size > 1 ? 900 : 1600, size > 1 ? 0.55 : 0.32, undefined, 'lowpass', 0.7, 120);
        this._tone(size > 1 ? 120 : 190, size > 1 ? 0.5 : 0.18, 'sine', 0.4, undefined, 40);
      }
    }
    squish() {
      if (this.ctx) this._noise(0.25, 500, 0.3, undefined, 'bandpass', 3, 150);
    }
    // Treffer am Boss: harter Panzer-Schlag, am Kern heller und mit Ton
    // schwerer Schritt des Bosses
    thud() {
      if (!this.ctx || !this._gate('thud', 0.12)) return;
      const t = this.ctx.currentTime;
      this._tone(64, 0.26, 'sine', 0.42, t, 30);
      this._noise(0.16, 260, 0.22, t, 'lowpass', 0.9, 70);
      this.duck(0.12, 0.2);
    }

    bossHit(crit) {
      if (!this.ctx || !this._gate(crit ? 'bhc' : 'bh', crit ? 0.05 : 0.045)) return;
      const t = this.ctx.currentTime;
      this._noise(0.09, crit ? 3600 : 2200, crit ? 0.3 : 0.2, t, 'bandpass', crit ? 2 : 3, 700);
      this._tone(crit ? 320 : 180, 0.1, 'square', crit ? 0.09 : 0.06, t, 90);
      if (crit) this._tone(1400, 0.07, 'triangle', 0.07, t, 2400);
    }

    bossRoar() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this._tone(55, 1.8, 'sawtooth', 0.3, t, 38);
      this._tone(82, 1.6, 'square', 0.14, t, 45);
      this._noise(1.8, 300, 0.4, t, 'bandpass', 1.5, 90);
      this.duck(0.5, 1.5);
    }
    bossAlarm() {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      for (let k = 0; k < 6; k++) this._tone(k % 2 ? 440 : 330, 0.22, 'square', 0.12, t + k * 0.25);
    }
    // Lasertor schaltet ein: kurzes elektrisches Zischen
    gate() {
      if (!this.ctx || !this._gate('gate', 0.2)) return;
      this._noise(0.25, 3000, 0.12, undefined, 'bandpass', 4, 900);
      this._tone(220, 0.2, 'sawtooth', 0.05, undefined, 110);
    }
    charge(dur) {
      if (this.ctx) this._tone(80, dur, 'sawtooth', 0.12, undefined, 900);
    }
    slam() {
      if (!this.ctx) return;
      this._sample('medium2', 1.1, 0.6);
      this._punch(3);
      this.duck(0.4, 0.6);
    }
    bossDown() {
      if (!this.ctx) return;
      const pk = this.sampleMeta.whoosh ? this.sampleMeta.whoosh.peak : 0;
      const t = this.ctx.currentTime + pk;
      this._sample('whoosh', 0.9);
      if (this._sample('huge', 1.3, 1, t)) this._sample('big1', 0.8, 0.8, t + 0.5);
      this.duck(0.7, 2.5);
    }
  }

  window.AudioEngine = AudioEngine;
})();
