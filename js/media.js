/* Lydeffekter (Web Audio), opplesning (talesyntese) og konfetti. */
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
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.11, 0.35, 'triangle', 0.13)); },
    isMuted: () => muted,
    setMuted(value) {
      muted = !!value;
      try { localStorage.setItem('paizon.muted', String(muted)); } catch (e) { /* ignorer */ }
      if (muted) window.PaizonSpeech.stop();
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
    speak(text, rate) {
      if (muted || !text) return;
      if (nativeTts) {
        nativeTts.stop()
          .catch(() => {})
          .then(() => nativeTts.speak({
            text: String(text).toLocaleLowerCase('nb-NO'),
            lang: 'nb-NO',
            rate: rate || 0.85,
            pitch: 1.1,
            volume: 1,
          }))
          .catch(() => {});
        return;
      }
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(String(text).toLocaleLowerCase('nb-NO'));
      u.lang = voice ? voice.lang : 'nb-NO';
      if (voice) u.voice = voice;
      u.rate = rate || 0.85;
      u.pitch = 1.1;
      synth.speak(u);
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
