/*
 * Havet – lyd. Alt bygges med Web Audio:
 *  - havsus (filtrert støy) som blir dovere og mørkere jo dypere man er,
 *  - bølgeskvulp ved overflaten og en lav dur i dypet,
 *  - etterklang («rom») som er sterkest ved vraket og korallrevet,
 *  - bobler fra ubåten, og
 *  - ekte dyrelyder (sounds/ocean/) med retning og avstand, og fjern hvalsang, og
 *  - rolig bakgrunnsmusikk som lages mens den spilles: lange, myke akkorder og
 *    glassklare toner her og der (ingen lydfiler, så den blir aldri lik to ganger).
 */
(function () {
  'use strict';

  const Sound = window.PaizonSound;
  let ctx = null;
  let nodes = null;
  const buffers = new Map();
  let master = 1;
  let musicOn = true;
  let music = null;
  let musicDepth = 0;

  function noiseBuffer(c, seconds) {
    const b = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      // Litt «brun» støy: mykere enn hvit støy, mer som hav.
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.995;
      d[i] = last * 3.5;
    }
    return b;
  }

  /** Kunstig etterklang: støy som dør ut, litt ulik i hvert øre. */
  function impulse(c, seconds, decay) {
    const len = c.sampleRate * seconds;
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function start() {
    ctx = Sound.unlock();
    if (!ctx || nodes) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);

    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 3.2, 2.6);
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    reverb.connect(wet).connect(out);

    // Havsus.
    const sea = ctx.createBufferSource();
    sea.buffer = noiseBuffer(ctx, 4);
    sea.loop = true;
    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 1200;
    const seaGain = ctx.createGain();
    seaGain.gain.value = 0.35;
    sea.connect(seaFilter).connect(seaGain).connect(out);
    seaGain.connect(reverb);

    // Bølgeskvulp ved overflaten: båndpass-støy som sveller opp og ned.
    const waves = ctx.createBufferSource();
    waves.buffer = noiseBuffer(ctx, 3);
    waves.loop = true;
    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = 'bandpass';
    waveFilter.frequency.value = 700;
    waveFilter.Q.value = 0.7;
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0.2; // svinger mellom 0,02 og 0,38 med LFO-en under
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.18;
    const waveLevel = ctx.createGain();
    waveLevel.gain.value = 0;
    lfo.connect(lfoGain).connect(waveGain.gain);
    waves.connect(waveFilter).connect(waveGain).connect(waveLevel).connect(out);

    // Lav dur i dypet.
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    const drones = [55, 82.4, 110.6].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = [0.5, 0.25, 0.12][i];
      o.connect(g).connect(droneGain);
      o.start();
      return o;
    });
    droneGain.connect(out);
    droneGain.connect(reverb);

    sea.start();
    waves.start();
    lfo.start();
    nodes = { out, reverb, wet, sea, seaFilter, seaGain, waves, waveLevel, lfo, droneGain, drones };
    out.gain.setTargetAtTime(Sound.isMuted() ? 0 : master, ctx.currentTime, 0.8);
    if (musicOn) startMusic();
  }

  // ---------- Musikk ----------
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // D-moll-aktige akkorder som glir over i hverandre: Dm9, B♭maj7, Fmaj9, C(add9).
  const CHORDS = [
    [38, 57, 62, 65, 69, 76],
    [34, 53, 58, 62, 65, 69],
    [41, 57, 60, 64, 67, 72],
    [36, 55, 60, 62, 67, 74],
  ];
  const BELLS = [62, 65, 67, 69, 72, 74, 77, 79, 81]; // D-moll pentaton

  function startMusic() {
    if (!nodes || music) return;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    const send = ctx.createGain();
    send.gain.value = 0.9;
    bus.connect(tone).connect(nodes.out);
    tone.connect(send).connect(nodes.reverb);
    bus.gain.setTargetAtTime(0.5, ctx.currentTime, 3);
    music = { bus, tone, chord: 0, timers: [], voices: [] };
    nextChord();
    scheduleBell(3);
  }

  function pad(freq, start, dur, level) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + 5);
    g.gain.setValueAtTime(level, start + dur - 6);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 0.8 - 0.4;
    g.connect(p).connect(music.bus);
    const oscs = [['sine', 0], ['triangle', -7], ['sine', 6]].map(([type, cents]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = cents;
      o.connect(g);
      o.start(start);
      o.stop(start + dur + 0.1);
      return o;
    });
    return oscs;
  }

  function nextChord() {
    if (!music) return;
    const now = ctx.currentTime;
    const chord = CHORDS[music.chord % CHORDS.length];
    music.chord++;
    const dur = 20;
    chord.forEach((n, i) => {
      // Dypere i havet: musikken legger seg lavere.
      const shift = musicDepth > 400 ? -12 : 0;
      pad(midi(n + (i ? shift : 0)), now, dur, i === 0 ? 0.05 : 0.022);
    });
    music.timers.push(setTimeout(nextChord, (dur - 6) * 1000));
  }

  function scheduleBell(delay) {
    if (!music) return;
    music.timers.push(setTimeout(() => {
      if (!music) return;
      if (!Sound.isMuted()) bell();
      const deep = musicDepth > 400;
      scheduleBell((deep ? 5 : 3) + Math.random() * (deep ? 9 : 6));
    }, delay * 1000));
  }

  function bell() {
    const now = ctx.currentTime;
    const n = BELLS[Math.floor(Math.random() * BELLS.length)] - (musicDepth > 400 ? 12 : 0);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.random() * 1.4 - 0.7;
    p.connect(music.bus);
    // Grunntone og en «glass»-overtone.
    [[1, 0.05], [2.76, 0.012], [5.4, 0.004]].forEach(([ratio, level]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = midi(n) * ratio;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(level, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 4.5 / ratio + 1);
      o.connect(g).connect(p);
      o.start(now);
      o.stop(now + 6);
    });
    // Av og til et ekko av samme tone litt senere.
    if (Math.random() < 0.35) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = midi(n + 12);
      g.gain.setValueAtTime(0.0001, now + 0.6);
      g.gain.exponentialRampToValueAtTime(0.015, now + 0.62);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
      o.connect(g).connect(p);
      o.start(now + 0.6);
      o.stop(now + 4);
    }
  }

  function stopMusic() {
    if (!music) return;
    const m = music;
    music = null;
    m.timers.forEach(clearTimeout);
    m.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
    setTimeout(() => { try { m.bus.disconnect(); } catch (e) { /* ferdig */ } }, 5000);
  }

  function setMusic(on) {
    musicOn = !!on;
    if (musicOn) startMusic();
    else stopMusic();
  }

  function stop() {
    if (!nodes) return;
    stopMusic();
    const n = nodes;
    nodes = null;
    n.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    setTimeout(() => {
      try {
        n.sea.stop();
        n.waves.stop();
        n.lfo.stop();
        n.drones.forEach((o) => o.stop());
        n.out.disconnect();
      } catch (e) { /* allerede stoppet */ }
    }, 1500);
  }

  /**
   * Oppdater lydbildet etter hvor ubåten er.
   * depth: meter, room: 0–1 (hvor mye etterklang), moving: 0–1.
   */
  function update(depth, room) {
    if (!nodes) return;
    const now = ctx.currentTime;
    musicDepth = depth;
    if (music) music.tone.frequency.setTargetAtTime(700 + 2200 * Math.exp(-depth / 250), now, 2);
    const muted = Sound.isMuted();
    nodes.out.gain.setTargetAtTime(muted ? 0 : master, now, 0.4);
    // Jo dypere, jo mørkere og dovere sus.
    const cutoff = 220 + 1500 * Math.exp(-depth / 60);
    nodes.seaFilter.frequency.setTargetAtTime(cutoff, now, 0.5);
    nodes.seaGain.gain.setTargetAtTime(0.22 + 0.13 * Math.exp(-depth / 200), now, 0.5);
    nodes.waveLevel.gain.setTargetAtTime(Math.max(0, 1 - depth / 15) * 0.9, now, 0.4);
    nodes.droneGain.gain.setTargetAtTime(Math.min(0.09, Math.max(0, (depth - 150) / 2000)), now, 1.5);
    nodes.wet.gain.setTargetAtTime(0.18 + room * 0.6, now, 0.6);
  }

  /** Lyden av en boble (kort tone som stiger). */
  function bubble(volume) {
    if (!nodes || Sound.isMuted()) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = 280 + Math.random() * 500;
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 2.4, now + 0.09);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.05 * (volume || 1), now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g).connect(nodes.out);
    g.connect(nodes.reverb);
    o.start(now);
    o.stop(now + 0.15);
  }

  /** En myk klokketone (brukes i Rolig-modus når man trykker på et dyr uten egen lyd). */
  function chime(pan) {
    if (!nodes || Sound.isMuted()) return;
    const now = ctx.currentTime;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan || 0));
    p.connect(nodes.out);
    p.connect(nodes.reverb);
    [523.3, 784, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + i * 0.12);
      g.gain.exponentialRampToValueAtTime(0.05, now + i * 0.12 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.12 + 1.6);
      o.connect(g).connect(p);
      o.start(now + i * 0.12);
      o.stop(now + i * 0.12 + 1.7);
    });
  }

  async function load(file) {
    if (buffers.has(file)) return buffers.get(file);
    const res = await fetch(`sounds/ocean/${file}`);
    const data = await res.arrayBuffer();
    const buf = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
    buffers.set(file, buf);
    return buf;
  }

  /**
   * Spill et ekte dyreopptak. pan: −1 (venstre) til 1 (høyre), distance: 0 (nært) – 1 (langt
   * unna; svakere og dovere), wet: hvor mye etterklang.
   */
  async function animal(file, { pan = 0, distance = 0, wet = 0.3, volume = 1 } = {}) {
    if (!nodes || Sound.isMuted()) return null;
    try {
      const buf = await load(file);
      if (!nodes) return null;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 12000 - distance * 10500;
      const g = ctx.createGain();
      g.gain.value = volume * (1 - distance * 0.8);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      const send = ctx.createGain();
      send.gain.value = wet + distance * 0.5;
      src.connect(filter).connect(g).connect(p).connect(nodes.out);
      p.connect(send).connect(nodes.reverb);
      src.start(now);
      return { stop: () => { try { src.stop(); } catch (e) { /* ferdig */ } } };
    } catch (e) {
      // Reserve når fetch/Web Audio ikke virker (f.eks. fil åpnet direkte fra disk).
      const el = new Audio(`sounds/ocean/${file}`);
      el.volume = Math.max(0.05, volume * (1 - distance * 0.8));
      el.play().catch(() => {});
      return { stop: () => el.pause() };
    }
  }

  /** Demp alt gradvis (sovetimer). level 0–1 over seconds. */
  function fadeTo(level, seconds) {
    master = level;
    if (!nodes) return;
    nodes.out.gain.setTargetAtTime(Sound.isMuted() ? 0 : level, ctx.currentTime, Math.max(0.1, seconds / 4));
  }

  function preload() {
    if (!ctx) return;
    ['knolhval.mp3', 'spekkhogger.mp3'].forEach((f) => load(f).catch(() => {}));
  }

  window.PaizonOceanAudio = { start, stop, update, bubble, chime, animal, fadeTo, preload, setMusic, get musicPlaying() { return !!music; }, resetMaster: () => { master = 1; } };
})();
