/*
 * Felles verktøy for utforskingsspillene (Skogen og Himmelen):
 *  - små tegnehjelpere (farger, fargeoverganger, frø-tilfeldighet),
 *  - faktakort, fotobok, banner og sovetimer (lager sine egne HTML-elementer),
 *  - et lydbilde laget i appen: vind, løv, bekk, regn, sirisser, fuglesang og
 *    rolig bakgrunnsmusikk. Ingen lydfiler, så alt kan brukes fritt.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  // ---------- Farger og tegning ----------
  function hexRgb(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  /** Lysere (f > 0) eller mørkere (f < 0) utgave av en hex-farge, eventuelt med alfa. */
  function shade(c, f, a) {
    const [r, g, b] = hexRgb(c).map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }
  /** Bland to hex-farger (t = 0 gir den første). Gir en hex-farge tilbake. */
  function mixHex(c1, c2, t) {
    const a = hexRgb(c1);
    const b = hexRgb(c2);
    return '#' + a.map((v, i) => Math.round(lerp(v, b[i], t)).toString(16).padStart(2, '0')).join('');
  }
  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }
  function seeded(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  const sprites = new Map();
  /** Tegn noe én gang til et eget lerret og gjenbruk det. */
  function sprite(key, w, h, draw) {
    const id = `${key}:${Math.round(w)}x${Math.round(h)}`;
    if (!sprites.has(id)) {
      if (sprites.size > 500) sprites.clear();
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(w));
      c.height = Math.max(2, Math.round(h));
      draw(c.getContext('2d'), c.width, c.height);
      sprites.set(id, c);
    }
    return sprites.get(id);
  }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------- Faktakort ----------
  /**
   * Faktakort nederst i bildet med en levende tegning av dyret.
   * open(entry, { draw(ctx, w, h, t), newFind, mode, sound, credit })
   */
  function Card(root) {
    const box = el('div', 'ocean-card ex-card');
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.innerHTML = `
      <canvas class="ocean-card-art" aria-hidden="true"></canvas>
      <div class="ocean-card-body">
        <p class="ocean-new" hidden>📸 Ny i fotoboka!</p>
        <h3></h3>
        <p class="ocean-sci"></p>
        <p class="ocean-facts"></p>
        <div class="ocean-card-actions">
          <button class="btn small ex-read">🗣️ Les opp</button>
          <button class="btn small primary ex-sound">🔊 Hør</button>
          <button class="btn small ghost ex-close">✕ Lukk</button>
        </div>
      </div>`;
    root.appendChild(box);
    const art = box.querySelector('canvas');
    let current = null;
    let raf = 0;
    const api = {
      el: box,
      get open() { return current; },
      show(entry, o) {
        current = entry;
        box.querySelector('h3').textContent = entry.name;
        box.querySelector('.ocean-sci').textContent = entry.sci || '';
        box.querySelector('.ocean-facts').textContent = entry.facts;
        box.querySelector('.ocean-new').hidden = !o.newFind;
        box.querySelector('.ex-sound').hidden = !o.sound;
        box.hidden = false;
        window.PaizonSound.flip();
        const r = art.getBoundingClientRect();
        const sc = Math.min(2, window.devicePixelRatio || 1);
        art.width = Math.max(10, r.width * sc);
        art.height = Math.max(10, r.height * sc);
        const c = art.getContext('2d');
        const t0 = performance.now();
        cancelAnimationFrame(raf);
        const step = () => {
          if (current !== entry) return;
          c.setTransform(sc, 0, 0, sc, 0, 0);
          c.clearRect(0, 0, r.width, r.height);
          o.draw(c, r.width, r.height, (performance.now() - t0) / 1000);
          raf = requestAnimationFrame(step);
        };
        step();
        api.onSound = o.sound || null;
        if (o.mode === 'lar') {
          setTimeout(() => {
            if (current !== entry) return;
            window.PaizonSpeech.speak(`${entry.name}. ${entry.facts}`).then(() => {
              if (current === entry && o.sound) o.sound();
            });
          }, 250);
        } else if (o.newFind) {
          window.PaizonSpeech.speak(`Ny i fotoboka: ${entry.name}!`);
        }
      },
      close() {
        current = null;
        box.hidden = true;
        cancelAnimationFrame(raf);
        window.PaizonSpeech.stop();
      },
    };
    box.querySelector('.ex-close').addEventListener('click', () => { window.PaizonSound.tap(); api.close(); });
    box.querySelector('.ex-read').addEventListener('click', () => {
      if (current) window.PaizonSpeech.speak(`${current.name}. ${current.facts}`);
    });
    box.querySelector('.ex-sound').addEventListener('click', () => { if (api.onSound) api.onSound(); });
    return api;
  }

  // ---------- Fotobok ----------
  /** entries: alle oppføringer; drawThumb(ctx, w, h, entry); onPick(entry). */
  function Album(root, { title, storeKey, entries, drawThumb, onPick }) {
    const P = window.Paizon;
    const have = new Set(P.store.get(storeKey, []));
    const box = el('div', 'ocean-album');
    box.hidden = true;
    box.innerHTML = `<div class="ocean-album-head"><h3>${title}</h3><button class="btn small ghost">✕ Lukk</button></div><div class="ocean-album-grid"></div>`;
    root.appendChild(box);
    box.querySelector('button').addEventListener('click', () => { window.PaizonSound.tap(); box.hidden = true; });
    return {
      el: box,
      has: (k) => have.has(k),
      /** Legg til; gir true hvis det var nytt. */
      add(k) {
        if (have.has(k)) return false;
        have.add(k);
        P.store.set(storeKey, [...have]);
        return true;
      },
      open() {
        const grid = box.querySelector('.ocean-album-grid');
        grid.innerHTML = '';
        for (const e of entries) {
          const got = have.has(e.key);
          if (e.secret && !got) continue;
          const cell = el('button', 'album-cell' + (got ? '' : ' unknown'));
          cell.type = 'button';
          const c = document.createElement('canvas');
          c.width = 160;
          c.height = 110;
          cell.appendChild(c);
          cell.appendChild(el('span', '', got ? e.name : '?'));
          const cx = c.getContext('2d');
          drawThumb(cx, c.width, c.height, e, got);
          if (!got) {
            cx.globalCompositeOperation = 'source-in';
            cx.fillStyle = 'rgba(30,50,70,0.85)';
            cx.fillRect(0, 0, c.width, c.height);
          } else {
            cell.addEventListener('click', () => { box.hidden = true; onPick(e); });
          }
          grid.appendChild(cell);
        }
        box.hidden = false;
        window.PaizonSound.flip();
      },
      close() { box.hidden = true; },
    };
  }

  function Banner(root) {
    const b = el('div', 'ocean-banner');
    b.setAttribute('aria-live', 'polite');
    root.appendChild(b);
    let timer = 0;
    return {
      show(text) {
        b.textContent = text;
        b.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => b.classList.remove('show'), 2600);
      },
    };
  }

  /** Sovetimer for Rolig: demper lyd og lys til slutt, og viser «God natt». */
  function Sleep(root, audio) {
    const box = el('div', 'ocean-goodnight', '<p>🌙 God natt</p><button class="btn small ghost">Fortsett å se</button>');
    box.hidden = true;
    root.appendChild(box);
    let endsAt = 0;
    let sleeping = false;
    let since = 0;
    box.querySelector('button').addEventListener('click', () => {
      sleeping = false;
      endsAt = 0;
      audio.fadeTo(1, 2);
      box.hidden = true;
    });
    return {
      start(minutes) {
        endsAt = minutes > 0 ? Date.now() + minutes * 60000 : 0;
        sleeping = false;
        box.hidden = true;
      },
      /** Kall hver frame. Gir hvor mørkt bildet skal være (0–0,92). */
      tick() {
        if (endsAt && !sleeping && Date.now() > endsAt) {
          sleeping = true;
          since = performance.now();
          audio.fadeTo(0, 40);
          box.hidden = false;
        }
        return sleeping ? clamp((performance.now() - since) / 40000, 0, 0.92) : 0;
      },
      get sleeping() { return sleeping; },
    };
  }

  // ---------- Lyd ----------
  /*
   * Lydbildet bygges av støy og oscillatorer i Web Audio. set({ wind, leaves, stream, rain,
   * crickets }) styrer nivåene (0–1). call(kind) spiller en fugle- eller dyrelyd.
   */
  const Sound = window.PaizonSound;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const PRESETS = {
    // Skogen: lyst og varmt, med «kalimba»-toner.
    forest: { chords: [[43, 59, 62, 66, 69], [40, 55, 59, 62, 67], [36, 55, 59, 64, 67], [38, 57, 62, 64, 69]], bells: [67, 69, 71, 74, 76, 79, 81, 83], pluck: true, level: 1.1 },
    // Himmelen: luftig og svevende, høye klokker.
    sky: { chords: [[41, 57, 60, 64, 69], [45, 57, 60, 64, 67], [46, 58, 62, 65, 69], [48, 55, 60, 62, 67]], bells: [72, 74, 76, 79, 81, 84, 86, 88], pluck: false, level: 1.0 },
  };

  function makeAudio() {
    let ctx = null;
    let n = null;
    let music = null;
    let musicOn = true;
    let master = 1;
    let preset = PRESETS.forest;
    let night = false;
    let lastCricket = 0;

    function noise(seconds, brown) {
      const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
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
    function loopSrc(buf) {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    }
    function impulse(seconds, decay) {
      const len = ctx.sampleRate * seconds;
      const b = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return b;
    }

    function start(name) {
      preset = PRESETS[name] || PRESETS.forest;
      ctx = Sound.unlock();
      if (!ctx || n) return;
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(ctx.destination);
      const reverb = ctx.createConvolver();
      reverb.buffer = impulse(2.6, 2.4);
      const wet = ctx.createGain();
      wet.gain.value = 0.3;
      reverb.connect(wet).connect(out);
      const brown = noise(4, true);
      const white = noise(3, false);
      // Vind: lavfrekvent sus som kommer i kast.
      const windF = ctx.createBiquadFilter();
      windF.type = 'lowpass';
      windF.frequency.value = 500;
      const wind = ctx.createGain();
      wind.gain.value = 0;
      loopSrc(brown).connect(windF).connect(wind).connect(out);
      // Løv som rasler (lys støy som følger vindkastene).
      const leafF = ctx.createBiquadFilter();
      leafF.type = 'highpass';
      leafF.frequency.value = 2500;
      const leaves = ctx.createGain();
      leaves.gain.value = 0;
      loopSrc(white).connect(leafF).connect(leaves).connect(out);
      // Bekk.
      const streamF = ctx.createBiquadFilter();
      streamF.type = 'bandpass';
      streamF.frequency.value = 1400;
      streamF.Q.value = 0.6;
      const stream = ctx.createGain();
      stream.gain.value = 0;
      loopSrc(white).connect(streamF).connect(stream).connect(out);
      // Regn.
      const rainF = ctx.createBiquadFilter();
      rainF.type = 'highpass';
      rainF.frequency.value = 1200;
      const rain = ctx.createGain();
      rain.gain.value = 0;
      loopSrc(white).connect(rainF).connect(rain).connect(out);
      // Vindkast: en langsom LFO som løfter vind og løv sammen.
      const gust = ctx.createOscillator();
      gust.frequency.value = 0.07;
      const gustAmt = ctx.createGain();
      gustAmt.gain.value = 0;
      gust.connect(gustAmt);
      gustAmt.connect(wind.gain);
      gustAmt.connect(leaves.gain);
      gust.start();
      n = { out, reverb, wet, wind, windF, leaves, stream, rain, gust, gustAmt, levels: {} };
      out.gain.setTargetAtTime(Sound.isMuted() ? 0 : master, ctx.currentTime, 1);
      if (musicOn) startMusic();
    }

    function stop() {
      if (!n) return;
      stopMusic();
      const old = n;
      n = null;
      old.out.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { try { old.gust.stop(); old.out.disconnect(); } catch (e) { /* ferdig */ } }, 1500);
    }

    /** Nivåer 0–1: wind, leaves, stream, rain, crickets, room (etterklang). */
    function set(levels) {
      if (!n) return;
      const now = ctx.currentTime;
      const L = Object.assign(n.levels, levels);
      n.out.gain.setTargetAtTime(Sound.isMuted() ? 0 : master, now, 0.4);
      n.wind.gain.setTargetAtTime((L.wind || 0) * 0.35, now, 0.8);
      n.windF.frequency.setTargetAtTime(300 + (L.wind || 0) * 900, now, 0.8);
      n.leaves.gain.setTargetAtTime((L.leaves || 0) * 0.05, now, 0.8);
      n.gustAmt.gain.setTargetAtTime(((L.wind || 0) + (L.leaves || 0)) * 0.08, now, 1);
      n.stream.gain.setTargetAtTime((L.stream || 0) * 0.12, now, 0.6);
      n.rain.gain.setTargetAtTime((L.rain || 0) * 0.16, now, 0.8);
      n.wet.gain.setTargetAtTime(0.2 + (L.room || 0) * 0.5, now, 0.6);
      night = !!L.night;
      // Sirisser om sommerkvelden: korte, høye pulser.
      if ((L.crickets || 0) > 0.05 && !Sound.isMuted() && now - lastCricket > 0.9 + Math.random() * 0.8) {
        lastCricket = now;
        cricket(L.crickets);
      }
    }

    function env(g, t, a, peak, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    function cricket(level) {
      const t = ctx.currentTime;
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 1.6 - 0.8;
      p.connect(n.out);
      for (let i = 0; i < 4; i++) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 4400 + Math.random() * 200;
        env(g, t + i * 0.06, 0.005, 0.012 * level, 0.03);
        o.connect(g).connect(p);
        o.start(t + i * 0.06);
        o.stop(t + i * 0.06 + 0.05);
      }
    }

    /**
     * Fugle- og dyrelyder laget i appen. kind: meis, trost, gjok, ugle, spett, kraake, ravn,
     * make, gaas, lerke, orn, spurv, svale, rev, frosk, trane. pan: −1–1, distance: 0–1.
     */
    function call(kind, { pan = 0, distance = 0.2, volume = 1 } = {}) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime + 0.02;
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 12000 - distance * 9000;
      const g = ctx.createGain();
      g.gain.value = volume * (1 - distance * 0.75);
      const send = ctx.createGain();
      send.gain.value = 0.25 + distance * 0.6;
      lp.connect(g).connect(p).connect(n.out);
      p.connect(send).connect(n.reverb);
      const tone = (f0, f1, start, dur, peak, type, vib) => {
        const o = ctx.createOscillator();
        const e = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(f0, t + start);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + start + dur);
        if (vib) {
          const l = ctx.createOscillator();
          const lg = ctx.createGain();
          l.frequency.value = vib[0];
          lg.gain.value = vib[1];
          l.connect(lg).connect(o.frequency);
          l.start(t + start);
          l.stop(t + start + dur + 0.05);
        }
        e.gain.setValueAtTime(0.0001, t + start);
        e.gain.exponentialRampToValueAtTime(peak, t + start + Math.min(0.02, dur * 0.2));
        e.gain.setValueAtTime(peak, t + start + dur * 0.7);
        e.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
        o.connect(e).connect(lp);
        o.start(t + start);
        o.stop(t + start + dur + 0.05);
      };
      const burst = (start, dur, freq, q, peak) => {
        const s = ctx.createBufferSource();
        s.buffer = noise(0.3, false);
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = q;
        const e = ctx.createGain();
        env(e, t + start, 0.003, peak, dur);
        s.connect(f).connect(e).connect(lp);
        s.start(t + start);
        s.stop(t + start + dur + 0.05);
      };
      const R = Math.random;
      switch (kind) {
        case 'meis': // «ti-tyy, ti-tyy, ti-tyy»
          for (let i = 0; i < 3; i++) {
            tone(6400, 6200, i * 0.42, 0.1, 0.05);
            tone(4700, 4500, i * 0.42 + 0.14, 0.18, 0.05);
          }
          break;
        case 'trost': { // svarttrost: fløytende, varierende strofe
          let s = 0;
          for (let i = 0; i < 7; i++) {
            const f = 1700 + R() * 1300;
            const d = 0.08 + R() * 0.16;
            tone(f, f * (0.85 + R() * 0.35), s, d, 0.045, 'sine', [28, 40]);
            s += d + 0.03;
          }
          break;
        }
        case 'gjok': // «ko-ko»
          for (let i = 0; i < 3; i++) {
            tone(720, 700, i * 0.9, 0.22, 0.07);
            tone(590, 570, i * 0.9 + 0.32, 0.3, 0.07);
          }
          break;
        case 'ugle': // kattugle: «huu ... hu-hu-huuuu»
          tone(430, 420, 0, 0.6, 0.08, 'sine', [5, 6]);
          [0, 1, 2].forEach((i) => tone(420, 410, 1.2 + i * 0.22, 0.14, 0.06));
          tone(410, 360, 1.9, 1.1, 0.08, 'sine', [6, 10]);
          break;
        case 'spett': // tromming mot en trestamme
          for (let i = 0; i < 18; i++) burst(i * 0.045, 0.03, 1100, 3, 0.25 * (1 - i / 22));
          break;
        case 'kraake':
        case 'ravn': {
          const f = kind === 'ravn' ? 330 : 560;
          for (let i = 0; i < 3; i++) {
            tone(f, f * 0.85, i * 0.45, 0.28, 0.05, 'sawtooth');
            burst(i * 0.45, 0.25, f * 2.2, 2, 0.08);
          }
          break;
        }
        case 'make': // «kliu, kliu-kliu»
          for (let i = 0; i < 4; i++) {
            tone(1500, 900, i * 0.35 + (i ? 0.3 : 0), 0.3, 0.05, 'sawtooth');
            tone(3000, 1800, i * 0.35 + (i ? 0.3 : 0), 0.3, 0.015);
          }
          break;
        case 'gaas':
          for (let i = 0; i < 5; i++) tone(320 + R() * 60, 300, i * 0.32 + R() * 0.1, 0.18, 0.04, 'square');
          break;
        case 'trane': // kraftig «krruu»
          for (let i = 0; i < 2; i++) tone(820, 760, i * 0.55, 0.42, 0.05, 'sawtooth', [30, 60]);
          break;
        case 'lerke': {
          let s = 0;
          for (let i = 0; i < 28; i++) {
            const f = 3000 + R() * 2200;
            tone(f, f * (0.9 + R() * 0.2), s, 0.05 + R() * 0.05, 0.03);
            s += 0.07 + R() * 0.05;
          }
          break;
        }
        case 'orn': // skrik
          tone(2600, 1800, 0, 0.7, 0.05, 'sawtooth', [12, 120]);
          break;
        case 'spurv':
          for (let i = 0; i < 5; i++) tone(3600, 3200, i * 0.22 + R() * 0.05, 0.08, 0.04);
          break;
        case 'svale':
          for (let i = 0; i < 12; i++) tone(4000 + R() * 2000, 3500 + R() * 2000, i * 0.09, 0.05, 0.025);
          break;
        case 'rev': // kort, hes bjeff
          for (let i = 0; i < 2; i++) {
            tone(700, 500, i * 0.5, 0.16, 0.06, 'sawtooth');
            burst(i * 0.5, 0.15, 1600, 1.5, 0.1);
          }
          break;
        case 'skjaere': // skrattende «tsjak-tsjak-tsjak»
          for (let i = 0; i < 7; i++) {
            burst(i * 0.11, 0.07, 2600, 2, 0.16);
            tone(1500, 1300, i * 0.11, 0.06, 0.02, 'sawtooth');
          }
          break;
        case 'frosk': // knurrende kvekk: raske pulser
          for (let i = 0; i < 14; i++) burst(i * 0.035, 0.025, 500, 4, 0.18);
          break;
        default:
          tone(2000, 2400, 0, 0.15, 0.04);
      }
    }

    function chime(pan) {
      if (!n || Sound.isMuted()) return;
      const t = ctx.currentTime;
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -1, 1);
      p.connect(n.out);
      p.connect(n.reverb);
      [72, 79, 84].forEach((m, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = midi(m);
        env(g, t + i * 0.12, 0.02, 0.05, 1.5);
        o.connect(g).connect(p);
        o.start(t + i * 0.12);
        o.stop(t + i * 0.12 + 1.7);
      });
    }

    // ---------- Musikk ----------
    function startMusic() {
      if (!n || music) return;
      const bus = ctx.createGain();
      bus.gain.value = 0;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 2600;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 4;
      const send = ctx.createGain();
      send.gain.value = 0.8;
      bus.connect(tone).connect(comp).connect(n.out);
      comp.connect(send).connect(n.reverb);
      bus.gain.setTargetAtTime(preset.level, ctx.currentTime, 3);
      music = { bus, tone, i: 0, timers: [] };
      chord();
      note(2);
    }
    function pad(f, t, dur, lvl) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lvl, t + 4);
      g.gain.setValueAtTime(lvl, t + dur - 5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const p = ctx.createStereoPanner();
      p.pan.value = Math.random() * 0.8 - 0.4;
      g.connect(p).connect(music.bus);
      [['sine', 0], ['triangle', -6], ['sine', 7]].forEach(([type, det]) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(g);
        o.start(t);
        o.stop(t + dur + 0.1);
      });
    }
    function chord() {
      if (!music) return;
      const t = ctx.currentTime;
      const c = preset.chords[music.i++ % preset.chords.length];
      const shift = night ? -2 : 0;
      c.forEach((m, i) => pad(midi(m + shift), t, 18, i === 0 ? 0.08 : 0.035));
      music.timers.push(setTimeout(chord, 13000));
    }
    function note(delay) {
      if (!music) return;
      music.timers.push(setTimeout(() => {
        if (!music) return;
        if (!Sound.isMuted()) {
          const t = ctx.currentTime;
          const m = preset.bells[Math.floor(Math.random() * preset.bells.length)] - (night ? 2 : 0);
          const p = ctx.createStereoPanner();
          p.pan.value = Math.random() * 1.4 - 0.7;
          p.connect(music.bus);
          const parts = preset.pluck ? [[1, 0.12, 1.4], [2, 0.03, 0.5], [3.01, 0.015, 0.3]] : [[1, 0.1, 4], [2.76, 0.02, 1.6]];
          parts.forEach(([r, lvl, d]) => {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.frequency.value = midi(m) * r;
            env(g, t, 0.01, lvl, d);
            o.connect(g).connect(p);
            o.start(t);
            o.stop(t + d + 0.1);
          });
        }
        note(2.5 + Math.random() * 5);
      }, delay * 1000));
    }
    function stopMusic() {
      if (!music) return;
      const m = music;
      music = null;
      m.timers.forEach(clearTimeout);
      m.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.8);
      setTimeout(() => { try { m.bus.disconnect(); } catch (e) { /* ferdig */ } }, 5000);
    }

    return {
      start,
      stop,
      set,
      call,
      chime,
      setMusic(on) {
        musicOn = !!on;
        if (musicOn) startMusic();
        else stopMusic();
      },
      get musicPlaying() { return !!music; },
      fadeTo(level, seconds) {
        master = level;
        if (n) n.out.gain.setTargetAtTime(Sound.isMuted() ? 0 : level, ctx.currentTime, Math.max(0.1, seconds / 4));
      },
      resetMaster() { master = 1; },
    };
  }

  window.PaizonExplore = { TAU, clamp, lerp, hexRgb, shade, mixHex, lin, rad, seeded, sprite, el, Card, Album, Banner, Sleep, makeAudio };
})();
