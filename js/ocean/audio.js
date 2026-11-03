/*
 * Havet – lyd. Alt bygges med Web Audio:
 *  - havsus (filtrert støy) som blir dovere og mørkere jo dypere man er,
 *  - bølgeskvulp ved overflaten og en lav dur i dypet,
 *  - etterklang («rom») som er sterkest ved vraket og korallrevet,
 *  - bobler fra ubåten, og
 *  - ekte dyrelyder (sounds/ocean/) med retning og avstand, og fjern hvalsang.
 */
(function () {
  'use strict';

  const Sound = window.PaizonSound;
  let ctx = null;
  let nodes = null;
  const buffers = new Map();
  let master = 1;

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
  }

  function stop() {
    if (!nodes) return;
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

  window.PaizonOceanAudio = { start, stop, update, bubble, chime, animal, fadeTo, preload, resetMaster: () => { master = 1; } };
})();
