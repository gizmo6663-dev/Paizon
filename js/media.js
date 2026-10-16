/* Lydeffekter (Web Audio), bokstavlyder, opplesning (talesyntese) og konfetti. */
(function () {
  'use strict';

  /**
   * Henter en Capacitor-plugin når appen kjører som Android-app, ellers null.
   * Feiler aldri: mangler Capacitor-runtime eller plugin, brukes nettleserens funksjoner.
   */
  window.PaizonNativePlugin = function (name) {
    try {
      const Cap = window.Capacitor;
      if (!Cap || typeof Cap.isNativePlatform !== 'function' || !Cap.isNativePlatform()) return null;
      if (typeof Cap.registerPlugin === 'function') return Cap.registerPlugin(name);
      return (Cap.Plugins && Cap.Plugins[name]) || null;
    } catch (e) {
      return null;
    }
  };

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ---------- Lydeffekter ----------
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('paizon.muted') === 'true'; } catch (e) { /* privat modus */ }

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type, vol) {
    if (muted) return;
    const c = audio();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime + start;
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  window.PaizonSound = {
    unlock: audio,
    tap() { tone(520, 0, 0.07, 'sine', 0.06); },
    correct() { tone(660, 0, 0.12, 'sine'); tone(880, 0.09, 0.2, 'sine'); },
    wrong() { tone(260, 0, 0.18, 'triangle', 0.1); tone(200, 0.12, 0.22, 'triangle', 0.08); },
    hint() { tone(988, 0, 0.1, 'sine', 0.08); tone(1318, 0.08, 0.15, 'sine', 0.06); },
    flip() { tone(700, 0, 0.06, 'sine', 0.05); },
    /** Kloss som treffer noe; styrke 0–1. */
    knock(strength) { tone(140 + Math.random() * 60, 0, 0.09, 'triangle', 0.04 + 0.12 * (strength || 0.5)); },
    bell() { [1568, 2093, 1568, 2093].forEach((f, i) => tone(f, i * 0.18, 0.6, 'sine', 0.1)); },
    rumble() { for (let i = 0; i < 8; i++) tone(55 + Math.random() * 25, i * 0.25, 0.4, 'sawtooth', 0.05); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.13)); },
    isMuted: () => muted,
    setMuted(value) {
      muted = !!value;
      try { localStorage.setItem('paizon.muted', String(muted)); } catch (e) { /* ignorer */ }
      if (muted) {
        window.PaizonSpeech.stop();
        window.PaizonLetters.stop();
      }
    },
  };

  // ---------- Bokstavlyder ----------
  // Ferdige lydfiler i sounds/letters/, eller egne opptak lagret lokalt på enheten.
  const L = window.PaizonLogic;
  const RECORD_KEY = 'paizon.lettersound.';
  const buffers = new Map(); // navn → AudioBuffer
  let current = null;

  function customRecording(name) {
    try { return localStorage.getItem(RECORD_KEY + name); } catch (e) { return null; }
  }

  async function loadBuffer(name) {
    const custom = customRecording(name);
    const key = (custom ? 'custom:' : 'file:') + name;
    if (buffers.has(key)) return buffers.get(key);
    const c = audio();
    if (!c) throw new Error('Ingen Web Audio');
    const res = await fetch(custom || `sounds/letters/${name}.mp3`);
    const data = await res.arrayBuffer();
    const buffer = await new Promise((resolve, reject) => c.decodeAudioData(data, resolve, reject));
    buffers.set(key, buffer);
    return buffer;
  }

  // Reserve når fetch/Web Audio ikke virker (f.eks. når index.html åpnes direkte fra disk).
  function playElement(src) {
    return new Promise((resolve) => {
      const el = new Audio(src);
      current = { stop() { el.pause(); resolve(); } };
      el.onended = resolve;
      el.onerror = resolve;
      el.play().catch(resolve);
      setTimeout(resolve, 2500);
    });
  }

  window.PaizonLetters = {
    /** Spiller lyden til en bokstav. Løses når lyden er ferdig. */
    async play(letter) {
      const name = L.letterSoundName(letter);
      if (muted || !name) return;
      this.stop();
      try {
        const buffer = await loadBuffer(name);
        const c = audio();
        const src = c.createBufferSource();
        src.buffer = buffer;
        src.connect(c.destination);
        await new Promise((resolve) => {
          current = { stop() { try { src.stop(); } catch (e) { /* allerede stoppet */ } resolve(); } };
          src.onended = resolve;
          src.start();
          setTimeout(resolve, buffer.duration * 1000 + 300);
        });
      } catch (e) {
        await playElement(customRecording(name) || `sounds/letters/${name}.mp3`);
      }
    },
    stop() {
      if (current) {
        const c = current;
        current = null;
        c.stop();
      }
    },
    /** Henter alle lydene på forhånd, så første bokstav ikke kommer for sent. */
    preload() {
      L.ALPHABET.forEach((l) => loadBuffer(L.letterSoundName(l)).catch(() => {}));
    },
    hasCustom: (letter) => !!customRecording(L.letterSoundName(letter)),
    saveCustom(letter, dataUrl) {
      const name = L.letterSoundName(letter);
      try {
        localStorage.setItem(RECORD_KEY + name, dataUrl);
        buffers.delete('custom:' + name);
        return true;
      } catch (e) {
        return false; // lagringen er full
      }
    },
    removeCustom(letter) {
      const name = L.letterSoundName(letter);
      try { localStorage.removeItem(RECORD_KEY + name); } catch (e) { /* ignorer */ }
      buffers.delete('custom:' + name);
    },
    canRecord: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
    /** Tar opp fra mikrofonen til stop() kalles (maks 2,5 s). Gir en data-URL. */
    async record() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        };
      });
      recorder.start();
      const timer = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 2500);
      return {
        stop() {
          clearTimeout(timer);
          if (recorder.state === 'recording') recorder.stop();
          return done;
        },
        done,
      };
    },
  };

  // ---------- Opplesning ----------
  // I Android-appen brukes enhetens talemotor via Capacitor-plugin,
  // siden Android WebView ikke har window.speechSynthesis.
  const nativeTts = window.PaizonNativePlugin('TextToSpeech');
  const synth = nativeTts ? null : window.speechSynthesis;
  let voice = null;

  function pickVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    voice = voices.find((v) => /^(nb|no|nn)([-_]|$)/i.test(v.lang))
      || voices.find((v) => /norsk|norwegian/i.test(v.name))
      || null;
  }
  if (synth) {
    pickVoice();
    if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
  }

  window.PaizonSpeech = {
    available: !!(synth || nativeTts),
    /** Leser opp tekst. Løses når opplesningen er ferdig (eller etter en sikkerhetsgrense). */
    speak(text, rate) {
      if (muted || !text) return Promise.resolve();
      const spoken = String(text).toLocaleLowerCase('nb-NO');
      const limit = wait(1500 + spoken.length * 150);
      if (nativeTts) {
        const done = nativeTts.stop()
          .catch(() => {})
          .then(() => nativeTts.speak({ text: spoken, lang: 'nb-NO', rate: rate || 0.85, pitch: 1.1, volume: 1 }))
          .catch(() => {});
        return Promise.race([done, limit]);
      }
      if (!synth) return Promise.resolve();
      synth.cancel();
      const u = new SpeechSynthesisUtterance(spoken);
      u.lang = voice ? voice.lang : 'nb-NO';
      if (voice) u.voice = voice;
      u.rate = rate || 0.85;
      u.pitch = 1.1;
      const done = new Promise((resolve) => { u.onend = resolve; u.onerror = resolve; });
      synth.speak(u);
      return Promise.race([done, limit]);
    },
    stop() {
      if (nativeTts) nativeTts.stop().catch(() => {});
      else if (synth) synth.cancel();
    },
  };

  // ---------- Konfetti ----------
  const COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#1dd1a1', '#5f27cd', '#ff9ff3', '#54a0ff'];
  let canvas = null;
  let pieces = [];
  let running = false;

  function frame() {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, canvas.width, canvas.height);
    pieces = pieces.filter((p) => p.y < canvas.height + 20 && p.life > 0);
    for (const p of pieces) {
      p.vy += 0.25;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      p.life -= 1;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = p.color;
      g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      g.restore();
    }
    if (pieces.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      g.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  window.PaizonConfetti = {
    burst(count) {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      canvas = canvas || document.getElementById('confetti');
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      const n = count || 140;
      for (let i = 0; i < n; i++) {
        const fromLeft = i % 2 === 0;
        pieces.push({
          x: fromLeft ? 0 : canvas.width,
          y: canvas.height * 0.7,
          vx: (fromLeft ? 1 : -1) * (6 + Math.random() * 12) * dpr,
          vy: -(10 + Math.random() * 14) * dpr,
          vr: (Math.random() - 0.5) * 0.4,
          rot: Math.random() * Math.PI,
          size: (8 + Math.random() * 8) * dpr,
          color: COLORS[i % COLORS.length],
          life: 260,
        });
      }
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
    },
  };
})();
