/*
 * Rommet (prøveversjon) – felles for 2D og 3D:
 *  - lydmotoren: oppskytingsdrønn som tynnes ut til stillhet, lyd inne i romskipet, radio fra
 *    bakkekontrollen, store musikkøyeblikk, landing og pust i romdrakten,
 *  - kart over jorda og Månen (tegnes i kode, ingen bildefiler),
 *  - papirutklipp av rakett, utskytningstårn, romstasjon, astronaut og flagg,
 *  - flammen fra motoren (lys, ikke papir).
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (x) => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  // =====================================================================
  // Lyd
  // =====================================================================
  function createAudio() {
    const Sound = window.PaizonSound;
    let ctx = null;
    let n = null;
    let radioChain = Promise.resolve();
    let radioQueued = 0;
    let nextBreath = 0;

    function noise(sec, brown) {
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        if (brown) {
          last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995;
          d[i] = last * 3.5;
        } else d[i] = Math.random() * 2 - 1;
      }
      return b;
    }
    /** Knitring: tilfeldige smell som dør raskt ut (lyden av en rakettmotor på nært hold). */
    function crackle(sec) {
      const sr = ctx.sampleRate;
      const b = ctx.createBuffer(1, Math.floor(sr * sec), sr);
      const d = b.getChannelData(0);
      for (let k = 0; k < sec * 320; k++) {
        const pos = Math.floor(Math.random() * d.length);
        const amp = Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? -1 : 1);
        const dec = 20 + Math.random() * 300;
        for (let i = 0; i < dec * 5 && pos + i < d.length; i++) d[pos + i] += amp * Math.exp(-i / dec) * (i % 2 ? -1 : 1);
      }
      return b;
    }
    function impulse(sec, decay) {
      const len = Math.floor(ctx.sampleRate * sec);
      const b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return b;
    }
    function loop(buf) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    }
    function filt(type, f, q) {
      const x = ctx.createBiquadFilter();
      x.type = type;
      x.frequency.value = f;
      if (q != null) x.Q.value = q;
      return x;
    }
    function gain(v) {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    }
    const env = (g, t, a, peak, d) => {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    };

    function start() {
      ctx = Sound.unlock();
      if (!ctx || n) return;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.01;
      comp.release.value = 0.3;
      comp.connect(ctx.destination);
      const out = gain(0);
      out.connect(comp);
      out.gain.setTargetAtTime(Sound.isMuted() ? 0 : 1, ctx.currentTime, 0.3);
      const rev = ctx.createConvolver();
      rev.buffer = impulse(4.5, 2.2);
      const wet = gain(0.45);
      rev.connect(wet).connect(out);
      const brown = noise(4, true);
      const white = noise(3, false);
      // Drønnet fra motorene: dyp støy, en basstone man nesten kjenner, og knitring.
      const rumbleF = filt('lowpass', 200);
      const rumble = gain(0);
      loop(brown).connect(rumbleF).connect(rumble).connect(out);
      const subF = filt('lowpass', 140);
      const sub = gain(0);
      const o1 = ctx.createOscillator();
      o1.frequency.value = 34;
      const o2 = ctx.createOscillator();
      o2.type = 'sawtooth';
      o2.frequency.value = 51;
      const o2g = gain(0.4);
      o1.connect(subF);
      o2.connect(o2g).connect(subF);
      subF.connect(sub).connect(out);
      o1.start();
      o2.start();
      const crackF = filt('highpass', 900);
      const crack = gain(0);
      loop(crackle(2.5)).connect(crackF).connect(crack).connect(out);
      // Vind ved utskytningsrampa.
      const windF = filt('bandpass', 500, 0.6);
      const wind = gain(0);
      loop(white).connect(windF).connect(wind).connect(out);
      // Inne i romskipet: summing fra maskinene og en vifte.
      const hum = gain(0);
      const h1 = ctx.createOscillator();
      h1.frequency.value = 92;
      const h2 = ctx.createOscillator();
      h2.type = 'triangle';
      h2.frequency.value = 184.6;
      const h2g = gain(0.25);
      h1.connect(hum);
      h2.connect(h2g).connect(hum);
      h1.start();
      h2.start();
      loop(brown).connect(filt('lowpass', 380)).connect(gain(0.6)).connect(hum);
      hum.connect(out);
      // Pusten i romdrakten.
      const breathF = filt('bandpass', 900, 1.1);
      const breath = gain(0);
      loop(white).connect(breathF).connect(breath).connect(out);
      n = { out, rev, rumble, rumbleF, sub, crack, wind, hum, breath, breathF, osc: [o1, o2, h1, h2], bed: null };
    }

    function stop() {
      if (!n) return;
      const old = n;
      n = null;
      bed(false, old);
      old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => {
        try {
          old.osc.forEach((o) => o.stop());
          old.out.disconnect();
        } catch (e) { /* ferdig */ }
      }, 1500);
      Speech().stop();
    }

    const Speech = () => window.PaizonSpeech;

    /** Kalles hvert bilde. thrust 0–1, air 0–1 (lufta som bærer lyden), wind, hum 0–1, breath av/på. */
    function update(s) {
      if (!n) return;
      const now = ctx.currentTime;
      const tc = 0.06;
      n.out.gain.setTargetAtTime(Sound.isMuted() ? 0 : 1, now, 0.2);
      const th = s.thrust || 0;
      const air = s.air == null ? 1 : s.air;
      // I tomt rom finnes det ingen luft som bærer lyden: drønnet forsvinner nesten helt.
      n.rumble.gain.setTargetAtTime(th * (0.95 * air + 0.03), now, tc);
      n.rumbleF.frequency.setTargetAtTime(110 + 1500 * air * th, now, tc);
      n.sub.gain.setTargetAtTime(th * (0.55 * air + 0.05), now, tc);
      n.crack.gain.setTargetAtTime(th * air * 0.6, now, tc);
      n.wind.gain.setTargetAtTime((s.wind || 0) * 0.16, now, 0.4);
      n.hum.gain.setTargetAtTime((s.hum || 0) * 0.09, now, 0.8);
      if (s.breath && now > nextBreath) {
        // Inn (stigende sus) og ut (synkende), i rolig takt.
        const t0 = now + 0.05;
        n.breath.gain.cancelScheduledValues(t0);
        n.breath.gain.setValueAtTime(0.0001, t0);
        n.breath.gain.linearRampToValueAtTime(0.05, t0 + 0.8);
        n.breath.gain.linearRampToValueAtTime(0.0001, t0 + 1.6);
        n.breath.gain.linearRampToValueAtTime(0.035, t0 + 2.3);
        n.breath.gain.linearRampToValueAtTime(0.0001, t0 + 3.6);
        n.breathF.frequency.setValueAtTime(800, t0);
        n.breathF.frequency.linearRampToValueAtTime(1500, t0 + 1.6);
        n.breathF.frequency.linearRampToValueAtTime(700, t0 + 3.6);
        nextBreath = now + 4.4;
      }
      if (!s.breath) nextBreath = 0;
    }

    /** Dyp dunk (rakettrinn som slippes, landing, fotsteg). */
    function thud(strength, f0) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = gain(0);
      o.frequency.setValueAtTime(f0 || 90, t);
      o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
      env(g, t, 0.005, 0.7 * strength, 0.55);
      o.connect(g).connect(n.out);
      o.start(t);
      o.stop(t + 0.7);
      const s = ctx.createBufferSource();
      s.buffer = noise(0.4, true);
      const ng = gain(0);
      env(ng, t, 0.003, 0.5 * strength, 0.3);
      s.connect(filt('lowpass', 500)).connect(ng).connect(n.out);
      s.start(t);
    }
    /** Metallisk klang når trinnet slippes. */
    function clunk() {
      if (!n || Sound.isMuted()) return;
      thud(1, 110);
      const t = ctx.currentTime;
      [311, 467, 739, 1123].forEach((f, i) => {
        const o = ctx.createOscillator();
        const g = gain(0);
        o.frequency.value = f;
        env(g, t + 0.01, 0.004, 0.06 / (i + 1), 1.2);
        o.connect(g).connect(n.out);
        g.connect(n.rev);
        o.start(t);
        o.stop(t + 1.5);
      });
    }
    function beep(f) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = gain(0);
      o.frequency.value = f || 1250;
      env(g, t, 0.005, 0.06, 0.09);
      o.connect(g).connect(n.out);
      o.start(t);
      o.stop(t + 0.15);
    }
    /** Radiostøy før bakkekontrollen snakker. */
    function staticBurst(len) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = noise(len || 0.35, false);
      const g = gain(0);
      env(g, t, 0.01, 0.09, (len || 0.35) - 0.02);
      s.connect(filt('bandpass', 1900, 1.2)).connect(g).connect(n.out);
      s.start(t);
    }
    /** Sus fra styredysene (dempet, som man hører det inne i skipet). */
    function hiss(level) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime;
      const s = ctx.createBufferSource();
      s.buffer = noise(0.5, false);
      const g = gain(0);
      env(g, t, 0.02, 0.12 * level, 0.4);
      s.connect(filt('lowpass', 1400)).connect(g).connect(n.out);
      s.start(t);
    }

    /**
     * Bakkekontrollen snakker over radio: støy og pip, så stemmen, så pip.
     * onText(text) viser teksten på skjermen. Meldinger står i kø, så de ikke snakker i munnen på hverandre.
     */
    function radio(text, onText) {
      if (radioQueued > 2) return Promise.resolve();
      radioQueued++;
      radioChain = radioChain.then(async () => {
        if (!n) {
          radioQueued--;
          return;
        }
        if (onText) onText(text);
        staticBurst(0.3);
        await new Promise((r) => setTimeout(r, 300));
        beep(1250);
        await Speech().speak(text);
        beep(950);
        radioQueued--;
        if (onText) setTimeout(() => onText(null, text), 1200);
      });
      return radioChain;
    }

    /**
     * Store musikkøyeblikk: en kraftig, svulmende akkord med et dypt «bom» og klokker på toppen.
     * kind: 'earth' (jorda sett fra rommet) eller 'moon' (jorda stiger opp over Månen).
     */
    const SWELLS = {
      earth: { notes: [38, 45, 50, 57, 62, 66, 69, 74, 81], bells: [86, 81, 78, 74, 69, 86] },
      moon: { notes: [43, 50, 55, 59, 62, 66, 69, 74, 78], bells: [83, 78, 74, 71, 66, 83] },
      launch: { notes: [36, 43, 48, 55, 60, 64, 67], bells: [] },
    };
    function swell(kind, level) {
      if (!n || Sound.isMuted()) return;
      const S = SWELLS[kind] || SWELLS.earth;
      const t = ctx.currentTime + 0.05;
      const lv = level || 1;
      const bus = gain(0);
      const lp = filt('lowpass', 250, 0.7);
      lp.frequency.setValueAtTime(250, t);
      lp.frequency.exponentialRampToValueAtTime(3200, t + 5);
      lp.frequency.exponentialRampToValueAtTime(700, t + 15);
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.32 * lv, t + 4);
      bus.gain.setValueAtTime(0.32 * lv, t + 9);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 17);
      bus.connect(lp);
      lp.connect(n.out);
      lp.connect(n.rev);
      S.notes.forEach((m, i) => {
        for (const det of [-7, 6]) {
          const o = ctx.createOscillator();
          o.type = i < 2 ? 'triangle' : 'sawtooth';
          o.frequency.value = midi(m);
          o.detune.value = det;
          const g = gain(i < 2 ? 0.16 : 0.05);
          o.connect(g).connect(bus);
          o.start(t);
          o.stop(t + 17.5);
        }
      });
      // Bom.
      const b = ctx.createOscillator();
      const bg = gain(0);
      b.frequency.setValueAtTime(58, t);
      b.frequency.exponentialRampToValueAtTime(32, t + 3);
      env(bg, t, 0.02, 0.6 * lv, 3.2);
      b.connect(bg).connect(n.out);
      bg.connect(n.rev);
      b.start(t);
      b.stop(t + 3.5);
      // Glassklare klokker som kommer inn etter hvert.
      S.bells.forEach((m, i) => {
        const tt = t + 3 + i * 0.55;
        [[1, 0.06], [2.76, 0.015]].forEach(([r, l]) => {
          const o = ctx.createOscillator();
          const g = gain(0);
          o.frequency.value = midi(m) * r;
          env(g, tt, 0.01, l * lv, 3.5 / r);
          o.connect(g).connect(n.out);
          g.connect(n.rev);
          o.start(tt);
          o.stop(tt + 4);
        });
      });
    }

    /** Rolig musikkteppe under reisen (lange akkorder som glir over i hverandre). */
    const BED = [[38, 57, 62, 66, 69], [35, 54, 59, 62, 66], [43, 55, 59, 62, 67], [40, 52, 57, 61, 64]];
    function bed(on, nn) {
      const N = nn || n;
      if (!N) return;
      if (!on) {
        if (N.bed) {
          clearTimeout(N.bed.timer);
          N.bed.g.gain.setTargetAtTime(0, ctx.currentTime, 1.2);
          const old = N.bed.g;
          setTimeout(() => { try { old.disconnect(); } catch (e) { /* ferdig */ } }, 6000);
          N.bed = null;
        }
        return;
      }
      if (N.bed) return;
      const g = gain(0);
      g.connect(N.out);
      g.connect(N.rev);
      g.gain.setTargetAtTime(0.9, ctx.currentTime, 2);
      const b = { g, i: 0, timer: 0 };
      N.bed = b;
      const chord = () => {
        if (N.bed !== b || Sound.isMuted()) {
          if (N.bed === b) b.timer = setTimeout(chord, 9000);
          return;
        }
        const t = ctx.currentTime;
        BED[b.i++ % BED.length].forEach((m, i) => {
          const o = ctx.createOscillator();
          o.type = i ? 'triangle' : 'sine';
          o.frequency.value = midi(m);
          const v = gain(0);
          v.gain.setValueAtTime(0.0001, t);
          v.gain.exponentialRampToValueAtTime(i ? 0.022 : 0.06, t + 4);
          v.gain.setValueAtTime(i ? 0.022 : 0.06, t + 9);
          v.gain.exponentialRampToValueAtTime(0.0001, t + 14);
          o.connect(v).connect(g);
          o.start(t);
          o.stop(t + 14.2);
        });
        b.timer = setTimeout(chord, 9000);
      };
      chord();
    }

    return { start, stop, update, thud, clunk, beep, staticBurst, hiss, radio, swell, bed: (on) => bed(on), get ready() { return !!n; } };
  }

  // =====================================================================
  // Kart over jorda og Månen (ekvirektangulære, til kuler i 2D og 3D)
  // =====================================================================
  let earthCache = null;
  /** Gir { map, clouds } som lerreter (bredde × bredde/2). Kontinenter og skyer tegnes i kode. */
  function earthMaps(w) {
    w = w || 1024;
    if (earthCache && earthCache.w === w) return earthCache;
    const h = w / 2;
    const r = seeded(42);
    const map = document.createElement('canvas');
    map.width = w;
    map.height = h;
    const c = map.getContext('2d');
    const sea = c.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#1c4f7c');
    sea.addColorStop(0.5, '#1f6a9a');
    sea.addColorStop(1, '#1c4f7c');
    c.fillStyle = sea;
    c.fillRect(0, 0, w, h);
    // Grunt vann langs kysten og kontinenter som bulete flater (tegnes to ganger for sømløs overgang).
    const blobs = [];
    const K = window.PaizonPapir;
    for (let i = 0; i < 9; i++) {
      blobs.push({ x: r() * w, y: h * (0.22 + r() * 0.56), rx: w * (0.04 + r() * 0.08), ry: h * (0.07 + r() * 0.14), b: Array.from({ length: 4 }, () => [r() * TAU, 0.4 + r() * 0.5, (r() - 0.4) * 0.8]) });
    }
    const drawBlobs = (scale, color, blur) => {
      c.save();
      c.filter = blur ? `blur(${blur}px)` : 'none';
      c.fillStyle = color;
      for (const b of blobs) {
        for (const dx of [-w, 0, w]) {
          c.fill(K.blob(b.x + dx, b.y, b.rx * scale, b.ry * scale, b.b));
        }
      }
      c.restore();
    };
    drawBlobs(1.18, '#3a8fb4', 6);
    drawBlobs(1.0, '#5f8a3e', 0);
    // Ørken og fjell som flekker på land, mørkere skog.
    c.save();
    c.globalCompositeOperation = 'source-atop';
    for (let i = 0; i < 160; i++) {
      const y = h * (0.25 + r() * 0.5);
      const desert = Math.abs(y / h - 0.5) < 0.13 && r() < 0.6;
      c.fillStyle = desert ? 'rgba(214,180,110,0.75)' : r() < 0.5 ? 'rgba(46,92,40,0.55)' : 'rgba(140,120,80,0.35)';
      c.beginPath();
      c.ellipse(r() * w, y, w * (0.01 + r() * 0.03), h * (0.01 + r() * 0.03), r() * 3, 0, TAU);
      c.fill();
    }
    c.restore();
    // Isen ved polene.
    const ice = (y0, y1) => {
      const g = c.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(245,250,255,1)');
      g.addColorStop(1, 'rgba(245,250,255,0)');
      c.fillStyle = g;
      c.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0));
    };
    ice(0, h * 0.11);
    ice(h, h * 0.89);
    // Skyer: myke, buede bånd og virvler.
    const clouds = document.createElement('canvas');
    clouds.width = w;
    clouds.height = h;
    const cc = clouds.getContext('2d');
    cc.filter = 'blur(3px)';
    cc.strokeStyle = 'rgba(255,255,255,0.8)';
    cc.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const y = h * (0.12 + r() * 0.76);
      const x = r() * w;
      const len = w * (0.04 + r() * 0.14);
      cc.lineWidth = h * (0.006 + r() * 0.02);
      for (const dx of [-w, 0, w]) {
        cc.beginPath();
        cc.moveTo(x + dx, y);
        cc.bezierCurveTo(x + dx + len * 0.3, y - h * 0.03 * r(), x + dx + len * 0.6, y + h * 0.03, x + dx + len, y + (r() - 0.5) * h * 0.04);
        cc.stroke();
      }
    }
    for (let i = 0; i < 6; i++) {
      // Lavtrykk: spiraler av skyer.
      const x = r() * w;
      const y = h * (0.25 + r() * 0.5);
      const R0 = h * (0.03 + r() * 0.04);
      cc.lineWidth = h * 0.012;
      for (const dx of [-w, 0, w]) {
        cc.beginPath();
        for (let a = 0; a < 9; a += 0.2) cc.lineTo(x + dx + Math.cos(a) * R0 * (a / 9), y + Math.sin(a) * R0 * (a / 9) * 0.7);
        cc.stroke();
      }
    }
    earthCache = { w, map, clouds };
    return earthCache;
  }

  let moonCache = null;
  function moonMap(w) {
    w = w || 1024;
    if (moonCache && moonCache.width === w) return moonCache;
    const h = w / 2;
    const r = seeded(7);
    const c0 = document.createElement('canvas');
    c0.width = w;
    c0.height = h;
    const c = c0.getContext('2d');
    c.fillStyle = '#a9a8a2';
    c.fillRect(0, 0, w, h);
    // «Havene» på Månen: store, mørke sletter.
    c.save();
    c.filter = 'blur(10px)';
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `rgba(80,80,82,${0.35 + r() * 0.3})`;
      const x = w * (0.1 + r() * 0.45);
      const y = h * (0.25 + r() * 0.5);
      c.beginPath();
      c.ellipse(x, y, w * (0.03 + r() * 0.06), h * (0.05 + r() * 0.1), r() * 3, 0, TAU);
      c.fill();
    }
    c.restore();
    // Kratere i mange størrelser: mørk bunn, lys kant mot sola.
    for (let i = 0; i < 260; i++) {
      const R = Math.pow(r(), 2.6) * h * 0.09 + 1.5;
      const x = r() * w;
      const y = h * (0.06 + r() * 0.88);
      c.fillStyle = 'rgba(70,70,72,0.35)';
      c.beginPath();
      c.ellipse(x, y, R, R, 0, 0, TAU);
      c.fill();
      c.strokeStyle = 'rgba(225,224,218,0.55)';
      c.lineWidth = Math.max(1, R * 0.18);
      c.beginPath();
      c.arc(x, y, R, -2.4, 0.4);
      c.stroke();
      if (R > 12 && r() < 0.3) {
        // Lyse stråler fra nye kratere.
        c.strokeStyle = 'rgba(230,230,224,0.18)';
        c.lineWidth = 2;
        for (let k = 0; k < 10; k++) {
          const a = r() * TAU;
          c.beginPath();
          c.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
          c.lineTo(x + Math.cos(a) * R * (3 + r() * 4), y + Math.sin(a) * R * (3 + r() * 4));
          c.stroke();
        }
      }
    }
    moonCache = c0;
    return c0;
  }

  /**
   * Gjør et kart om til en opplyst kule (2D). sun = [x, y, z] (lysretning, z mot oss).
   * night: farge på nattsida. Gir et lerret D × D.
   */
  function sphereImage(mapCanvas, cloudCanvas, D, sun, opts) {
    opts = opts || {};
    const mw = mapCanvas.width;
    const mh = mapCanvas.height;
    const md = mapCanvas.getContext('2d').getImageData(0, 0, mw, mh).data;
    const cd = cloudCanvas ? cloudCanvas.getContext('2d').getImageData(0, 0, mw, mh).data : null;
    const out = document.createElement('canvas');
    out.width = out.height = D;
    const oc = out.getContext('2d');
    const img = oc.createImageData(D, D);
    const d = img.data;
    const R = D / 2;
    const sl = Math.hypot(sun[0], sun[1], sun[2]);
    const sx = sun[0] / sl;
    const sy = sun[1] / sl;
    const sz = sun[2] / sl;
    const rot = opts.rot == null ? Math.PI : opts.rot; // sømmen i kartet havner på baksida
    for (let py = 0; py < D; py++) {
      const y = (py + 0.5 - R) / R;
      for (let px = 0; px < D; px++) {
        const x = (px + 0.5 - R) / R;
        const rr = x * x + y * y;
        if (rr > 1) continue;
        const z = Math.sqrt(1 - rr);
        const lon = Math.atan2(x, z) + rot;
        const lat = Math.asin(-y);
        const u = Math.floor((((lon / TAU) % 1) + 1) % 1 * mw);
        const v = Math.floor((0.5 - lat / Math.PI) * (mh - 1));
        const mi = (v * mw + u) * 4;
        let cr = md[mi];
        let cg = md[mi + 1];
        let cb = md[mi + 2];
        if (cd) {
          const a = cd[mi + 3] / 255;
          cr += (255 - cr) * a;
          cg += (255 - cg) * a;
          cb += (255 - cb) * a;
        }
        const lit = x * sx - y * sy + z * sz;
        const day = clamp(lit * 1.4 + 0.15, 0, 1);
        const amb = opts.ambient ?? 0.05;
        const k = amb + (1 - amb) * day;
        // Litt blått lys i kanten (atmosfæren) på jorda.
        const rim = opts.rim ? Math.pow(1 - z, 3) * day : 0;
        const i = (py * D + px) * 4;
        d[i] = Math.min(255, cr * k + rim * 90);
        d[i + 1] = Math.min(255, cg * k + rim * 150);
        d[i + 2] = Math.min(255, cb * k + rim * 255);
        d[i + 3] = 255 * clamp((1 - Math.sqrt(rr)) * R * 1.5, 0, 1);
      }
    }
    oc.putImageData(img, 0, 0);
    return out;
  }

  // =====================================================================
  // Papirutklipp
  // =====================================================================
  const K = window.PaizonPapir;
  const C = { white: '#f4f1ea', cream: '#e8e2d2', red: '#d8432e', dark: '#2b2219', grey: '#8e8a82', blue: '#6fb4d8', gold: '#e8b93a' };

  /** Raketten. L = hele raketten. Origo midt under motoren. o.stage: 'full' | 'top' | 'bottom', o.legs. */
  function rocket(ctx, L, o) {
    const stage = o.stage || 'full';
    const w = L * 0.06; // halv bredde
    const u = (v) => v * L;
    const part = (y0, y1, col, nar) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-w * (nar || 1), y1);
      ctx.lineTo(w * (nar || 1), y1);
      ctx.lineTo(w, y0);
      ctx.lineTo(-w, y0);
      ctx.closePath();
      ctx.fill();
    };
    const nozzle = (y, s) => {
      ctx.fillStyle = '#4a4540';
      ctx.beginPath();
      ctx.moveTo(-w * 0.45 * s, y);
      ctx.lineTo(w * 0.45 * s, y);
      ctx.lineTo(w * 0.75 * s, y + u(0.05) * s);
      ctx.lineTo(-w * 0.75 * s, y + u(0.05) * s);
      ctx.closePath();
      ctx.fill();
    };
    if (stage === 'full' || stage === 'bottom') {
      // Første trinn med finner og sjakkmønster.
      ctx.fillStyle = C.red;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * w, -u(0.2));
        ctx.lineTo(s * (w + u(0.075)), -u(0.02));
        ctx.lineTo(s * (w + u(0.075)), u(0.015));
        ctx.lineTo(s * w, -u(0.02));
        ctx.closePath();
        ctx.fill();
      }
      nozzle(0, 1.25);
      part(0, -u(0.52), C.white);
      ctx.fillStyle = C.dark;
      for (let i = 0; i < 4; i++) ctx.fillRect(i % 2 ? 0 : -w, -u(0.42) + (i > 1 ? u(0.06) : 0), w, u(0.06));
      ctx.fillStyle = C.red;
      ctx.fillRect(-w, -u(0.08), w * 2, u(0.03));
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-w, -u(0.52), w * 0.6, u(0.52));
    }
    if (stage === 'full' || stage === 'top') {
      const y0 = stage === 'top' ? 0 : -u(0.52);
      const yy = (v) => y0 - u(v);
      if (stage === 'top') nozzle(0, 0.9);
      if (o.legs) {
        ctx.strokeStyle = '#6a655c';
        ctx.lineWidth = Math.max(1.5, u(0.012));
        ctx.lineCap = 'round';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * w * 0.9, yy(0.08));
          ctx.lineTo(s * (w + u(0.09)), u(0.06));
          ctx.stroke();
          ctx.fillStyle = '#6a655c';
          ctx.fillRect(s * (w + u(0.09)) - u(0.025), u(0.055), u(0.05), u(0.012));
        }
      }
      part(yy(0), yy(0.3), C.white);
      ctx.fillStyle = C.red;
      ctx.fillRect(-w, yy(0.06), w * 2, u(0.035));
      // Vindu.
      ctx.fillStyle = C.dark;
      ctx.beginPath();
      ctx.arc(0, yy(0.2), w * 0.55, 0, TAU);
      ctx.fill();
      ctx.fillStyle = C.blue;
      ctx.beginPath();
      ctx.arc(0, yy(0.2), w * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(w * 0.12, yy(0.215), w * 0.12, 0, TAU);
      ctx.fill();
      // Nesekjegle.
      ctx.fillStyle = C.red;
      ctx.beginPath();
      ctx.moveTo(-w, yy(0.3));
      ctx.quadraticCurveTo(-w * 0.9, yy(0.42), 0, yy(0.48));
      ctx.quadraticCurveTo(w * 0.9, yy(0.42), w, yy(0.3));
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(-w, yy(0.3), w * 0.6, u(0.3));
    }
  }

  /** Utskytningstårnet: gitter av stål med en arm inn mot raketten. o.arm 0 (inne) – 1 (svingt ut). */
  function tower(ctx, L, o) {
    const u = (v) => v * L;
    ctx.strokeStyle = '#c8553a';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, u(0.012));
    for (const x of [-0.06, 0.06]) {
      ctx.beginPath();
      ctx.moveTo(u(x), 0);
      ctx.lineTo(u(x), -u(1));
      ctx.stroke();
    }
    ctx.lineWidth = Math.max(1.2, u(0.006));
    for (let i = 0; i < 12; i++) {
      const y0 = -u(i / 12);
      const y1 = -u((i + 1) / 12);
      ctx.beginPath();
      ctx.moveTo(-u(0.06), y0);
      ctx.lineTo(u(0.06), y1);
      ctx.moveTo(u(0.06), y0);
      ctx.lineTo(-u(0.06), y1);
      ctx.moveTo(-u(0.06), y1);
      ctx.lineTo(u(0.06), y1);
      ctx.stroke();
    }
    const a = (o.arm || 0) * 1.2;
    ctx.save();
    ctx.translate(u(0.06), -u(0.72));
    ctx.rotate(-a);
    ctx.fillStyle = '#c8553a';
    ctx.fillRect(0, -u(0.015), u(0.22), u(0.03));
    ctx.restore();
    ctx.fillStyle = '#8a8178';
    ctx.fillRect(-u(0.12), -u(0.02), u(0.24), u(0.03));
  }

  /** Romstasjonen: et langt stag, moduler og store solcellepaneler. L = bredden. */
  function station(ctx, L) {
    const u = (v) => v * L;
    ctx.fillStyle = '#b9b5ac';
    ctx.fillRect(-u(0.5), -u(0.012), u(1), u(0.024));
    for (const x of [-0.42, -0.3, 0.3, 0.42]) {
      for (const s of [-1, 1]) {
        ctx.fillStyle = '#2e4a8a';
        ctx.fillRect(u(x) - u(0.045), s > 0 ? u(0.02) : -u(0.2), u(0.09), u(0.18));
        ctx.strokeStyle = '#e8b93a';
        ctx.lineWidth = Math.max(1, u(0.004));
        for (let k = 1; k < 6; k++) {
          const y = (s > 0 ? u(0.02) : -u(0.2)) + (k * u(0.18)) / 6;
          ctx.beginPath();
          ctx.moveTo(u(x) - u(0.045), y);
          ctx.lineTo(u(x) + u(0.045), y);
          ctx.stroke();
        }
      }
    }
    for (const [x, w, h] of [[-0.12, 0.12, 0.06], [0, 0.1, 0.07], [0.12, 0.12, 0.055], [0.04, 0.05, 0.13]]) {
      ctx.fillStyle = '#ece8de';
      ctx.fillRect(u(x - w / 2), -u(h / 2), u(w), u(h));
    }
  }

  /** Astronauten. o.pose: 'stand' | 'walk' | 'jump'; t: tid (gange). Origo ved føttene. */
  function astronaut(ctx, L, t, o) {
    const u = (v) => v * L;
    const pose = o.pose || 'stand';
    const ph = Math.sin(t * TAU * 1.2);
    const legA = pose === 'walk' ? ph * 0.45 : pose === 'jump' ? 0.5 : 0;
    const K2 = window.PaizonPapir;
    const leg = (a, col, knee) => {
      const hx = 0;
      const hy = -u(0.36);
      const kx = hx + Math.sin(a) * u(0.18);
      const ky = hy + Math.cos(a) * u(0.18);
      const fx = kx + Math.sin(a - (knee || 0)) * u(0.17);
      const fy = ky + Math.cos(a - (knee || 0)) * u(0.17);
      ctx.fillStyle = col;
      ctx.fill(K2.tube([[hx, hy], [kx, ky], [fx, fy]], [u(0.06), u(0.055), u(0.05)]));
      ctx.fillStyle = '#6a655c';
      ctx.beginPath();
      ctx.ellipse(fx + u(0.02), fy + u(0.01), u(0.065), u(0.035), 0, 0, TAU);
      ctx.fill();
    };
    leg(-legA, '#d9d4c8', pose === 'jump' ? -0.9 : 0);
    // Ryggsekk.
    ctx.fillStyle = '#c9c3b5';
    ctx.fillRect(-u(0.2), -u(0.74), u(0.14), u(0.32));
    // Kropp.
    ctx.fillStyle = C.white;
    ctx.fill(K2.blob(0, -u(0.55), u(0.13), u(0.2)));
    ctx.fillStyle = C.red;
    ctx.fillRect(u(0.02), -u(0.62), u(0.07), u(0.05));
    ctx.fillStyle = '#8e8a82';
    ctx.fillRect(-u(0.11), -u(0.4), u(0.24), u(0.04));
    leg(legA, C.white, pose === 'jump' ? -0.9 : 0);
    // Arm.
    const arm = pose === 'jump' ? -2.2 : pose === 'walk' ? -ph * 0.4 : 0.1;
    ctx.fillStyle = C.white;
    ctx.fill(K2.tube([[u(0.02), -u(0.68)], [u(0.02) + Math.sin(arm) * u(0.15), -u(0.68) + Math.cos(arm) * u(0.15)], [u(0.04) + Math.sin(arm + 0.4) * u(0.27), -u(0.68) + Math.cos(arm + 0.4) * u(0.27)]], [u(0.05), u(0.045), u(0.045)]));
    // Hjelm med gyllent visir.
    ctx.fillStyle = C.white;
    ctx.beginPath();
    ctx.arc(u(0.02), -u(0.86), u(0.13), 0, TAU);
    ctx.fill();
    ctx.fillStyle = C.gold;
    ctx.beginPath();
    ctx.ellipse(u(0.06), -u(0.86), u(0.085), u(0.075), 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(u(0.09), -u(0.89), u(0.025), u(0.015), -0.5, 0, TAU);
    ctx.fill();
  }

  /** Et flagg med en stjerne (Paizon-flagget). */
  function flag(ctx, L, t) {
    const u = (v) => v * L;
    ctx.strokeStyle = '#8e8a82';
    ctx.lineWidth = Math.max(1.5, u(0.02));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -u(1));
    ctx.stroke();
    ctx.fillStyle = '#6c5ce7';
    ctx.fillRect(0, -u(0.98), u(0.55), u(0.34));
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? u(0.05) : u(0.12);
      ctx.lineTo(u(0.27) + Math.cos(a) * r, -u(0.81) + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (K) {
    K.define('rakett', { box: [-0.3, -1.05, 0.3, 0.12], variant: (o) => `${o.stage || 'full'}${o.legs ? 'l' : ''}`, draw: (c, L, t, o) => rocket(c, L, o) });
    K.define('tarn', { box: [-0.2, -1.05, 0.35, 0.05], variant: (o) => String(Math.round((o.arm || 0) * 8)), draw: (c, L, t, o) => tower(c, L, { arm: Math.round((o.arm || 0) * 8) / 8 }) });
    K.define('romstasjon', { box: [-0.55, -0.25, 0.55, 0.25], draw: (c, L) => station(c, L) });
    K.define('astronaut', { box: [-0.35, -1.05, 0.4, 0.08], variant: (o) => o.pose || 'stand', period: 1 / 1.2, frames: 12, draw: (c, L, t, o) => astronaut(c, L, t, o) });
    K.define('flagg', { box: [-0.1, -1.05, 0.65, 0.05], draw: (c, L) => flag(c, L) });
  }

  /**
   * Flammen fra motoren (lys, tegnes oppå med 'lighter'). Peker nedover fra origo.
   * len, w: lengde og bredde i px. air: 1 = tykk luft (smal, lys flamme), 0 = tomt rom (bred og blek).
   */
  function flame(ctx, len, w, t, air) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const spread = 1 + (1 - air) * 1.4;
    const fl = 1 + Math.sin(t * 47) * 0.06 + Math.sin(t * 31) * 0.05;
    const layers = [
      [1.0 * spread, 1.0, 'rgba(255,120,40,', 0.55],
      [0.7 * spread, 0.75, 'rgba(255,190,80,', 0.7],
      [0.38, 0.45, 'rgba(255,250,220,', 0.95],
    ];
    for (const [ws, ls, col, a] of layers) {
      const L = len * ls * fl;
      const W = w * ws;
      const g = ctx.createLinearGradient(0, 0, 0, L);
      g.addColorStop(0, col + a + ')');
      g.addColorStop(1, col + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-W * 0.5, 0);
      ctx.bezierCurveTo(-W * 0.9, L * 0.3, -W * 0.25, L * 0.8, 0, L);
      ctx.bezierCurveTo(W * 0.25, L * 0.8, W * 0.9, L * 0.3, W * 0.5, 0);
      ctx.closePath();
      ctx.fill();
    }
    // Lysskjær rundt dysa.
    const R = w * 3.2 * (0.6 + air * 0.4);
    const g = ctx.createRadialGradient(0, len * 0.15, 0, 0, len * 0.15, R);
    g.addColorStop(0, 'rgba(255,200,120,0.45)');
    g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-R, len * 0.15 - R, R * 2, R * 2);
    ctx.restore();
  }

  /** Vibrer telefonen (når den kan). */
  function vibrate(p) {
    try {
      if (navigator.vibrate) navigator.vibrate(p);
    } catch (e) { /* ignorer */ }
  }

  window.PaizonSpace = Object.assign(window.PaizonSpace || {}, {
    TAU, clamp, lerp, smooth, seeded, createAudio, earthMaps, moonMap, sphereImage, flame, vibrate, rocket, astronaut, COLORS: C,
  });
})();
