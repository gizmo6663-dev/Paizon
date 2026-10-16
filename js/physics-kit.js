/* Felles hjelpere for fysikkspillene med Matter.js (domino og kulebane). */
(function () {
  'use strict';

  const M = window.Matter;
  const P = window.Paizon;
  const Sound = window.PaizonSound;
  if (!M) return;
  const { Engine, Events, Body } = M;

  /**
   * Lag en fysikkscene på et lerret. Skjermen er ca. unitsW × unitsH «enheter» (u),
   * og alle størrelser i spillene oppgis i u, så de passer på både mobil og nettbrett.
   */
  function createScene({ canvas, wrap, unitsW, unitsH, minU, maxU }) {
    const ctx = canvas.getContext('2d');
    const scene = {
      canvas,
      ctx,
      W: 0,
      H: 0,
      u: 50,
      engine: null,
      world: null,
      running: false,
      raf: 0,
      onFrame: null,
      lastKnock: 0,
    };

    scene.measure = function () {
      const r = wrap.getBoundingClientRect();
      scene.W = Math.max(200, r.width);
      scene.H = Math.max(200, r.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(scene.W * dpr);
      canvas.height = Math.round(scene.H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.u = Math.max(minU || 30, Math.min(maxU || 110, Math.min(scene.W / unitsW, scene.H / unitsH)));
    };

    scene.newEngine = function () {
      scene.engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
      scene.engine.gravity.y = 1;
      // Tyngdekraften skaleres med størrelsen, så store ting ikke ser ut til å sveve.
      scene.engine.gravity.scale = 0.001 * (scene.u / 50);
      scene.world = scene.engine.world;
      Events.on(scene.engine, 'collisionStart', (e) => {
        const now = performance.now();
        if (now - scene.lastKnock < 60) return;
        for (const pair of e.pairs) {
          const a = pair.bodyA;
          const b = pair.bodyB;
          if (a.isSensor || b.isSensor) continue;
          const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
          if (speed > 2.5) {
            Sound.knock(Math.min(1, speed / 12));
            scene.lastKnock = now;
            return;
          }
        }
      });
      return scene.engine;
    };

    /** Start løkka. onFrame(t) kalles hvert bilde etter fysikksteget. */
    scene.run = function (onFrame) {
      scene.onFrame = onFrame;
      if (scene.running) return;
      scene.running = true;
      let last = 0;
      const loop = (t) => {
        if (!scene.running) return;
        const dt = last ? Math.min(34, t - last) : 16.7;
        last = t;
        const steps = dt > 20 ? 2 : 1;
        for (let i = 0; i < steps; i++) Engine.update(scene.engine, 1000 / 60);
        if (scene.onFrame) scene.onFrame(t);
        scene.raf = requestAnimationFrame(loop);
      };
      scene.raf = requestAnimationFrame(loop);
    };

    scene.stop = function () {
      scene.running = false;
      cancelAnimationFrame(scene.raf);
    };

    scene.toWorld = function (e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    // ---------- Tegning ----------
    scene.drawSky = function (top, bottom) {
      const g = ctx.createLinearGradient(0, 0, 0, scene.H);
      g.addColorStop(0, top || '#bfe6ff');
      g.addColorStop(1, bottom || '#eef9ff');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scene.W, scene.H);
    };

    scene.tracePath = function (body) {
      ctx.beginPath();
      if (body.circleRadius) {
        ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
        return;
      }
      const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
      for (const part of parts) {
        const v = part.vertices;
        ctx.moveTo(v[0].x, v[0].y);
        for (let i = 1; i < v.length; i++) ctx.lineTo(v[i].x, v[i].y);
        ctx.closePath();
      }
    };

    scene.fillBody = function (body, fill, stroke) {
      scene.tracePath(body);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = stroke || shade(fill, -0.25);
      ctx.stroke();
    };

    scene.outline = function (body) {
      ctx.save();
      scene.tracePath(body);
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#2d3047';
      ctx.stroke();
      ctx.restore();
    };

    /** Vri-håndtaket for en valgt ting ligger litt utenfor enden av den. */
    scene.handlePos = function (body) {
      const reach = Math.hypot(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2;
      const d = Math.max(reach, body.paizon && body.paizon.half ? body.paizon.half : 0) + scene.u * 0.45;
      return { x: body.position.x + Math.cos(body.angle) * d, y: body.position.y + Math.sin(body.angle) * d };
    };

    scene.drawHandle = function (body) {
      const p = scene.handlePos(body);
      ctx.save();
      ctx.strokeStyle = 'rgba(45, 48, 71, 0.4)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(body.position.x, body.position.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#6c5ce7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↻', p.x, p.y + 1);
      ctx.restore();
    };

    scene.onHandle = function (body, p) {
      const h = scene.handlePos(body);
      return Math.hypot(p.x - h.x, p.y - h.y) < 26;
    };

    /**
     * Øverste flate rett under (x, y) blant de gitte legemene – brukes for å sette
     * dominobrikker rett på bakken eller en planke. Gir { y, body } eller null.
     */
    scene.surfaceBelow = function (x, y, bodies) {
      let best = null;
      for (const body of bodies) {
        const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
        for (const part of parts) {
          const v = part.vertices;
          for (let i = 0; i < v.length; i++) {
            const a = v[i];
            const b = v[(i + 1) % v.length];
            if ((a.x - x) * (b.x - x) > 0 || a.x === b.x) continue;
            const t = (x - a.x) / (b.x - a.x);
            const sy = a.y + t * (b.y - a.y);
            if (sy >= y - scene.u * 0.3 && (!best || sy < best.y)) best = { y: sy, body };
          }
        }
      }
      return best;
    };

    return scene;
  }

  function shade(hex, amount) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + c * amount)));
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  // ---------- Felles «nivå klart»-vindu ----------
  const overlay = document.getElementById('phys-done');
  let onNext = null;
  let showTimer = 0;
  function levelDone({ title, text, last, next }) {
    Sound.win();
    window.PaizonConfetti.burst(140);
    window.PaizonSpeech.speak(`${title} ${text.replace(/[^\p{L}\p{N} !.,]/gu, '')}`);
    document.getElementById('phys-done-title').textContent = title;
    document.getElementById('phys-done-text').textContent = text;
    document.getElementById('phys-next').textContent = last ? 'Ferdig 🎉' : 'Neste nivå ➜';
    onNext = next;
    clearTimeout(showTimer);
    showTimer = setTimeout(() => overlay.classList.remove('hidden'), 700);
  }
  function hideLevelDone() {
    clearTimeout(showTimer); // ikke vis vinduet hvis spilleren allerede har gått videre
    overlay.classList.add('hidden');
  }
  document.getElementById('phys-next').addEventListener('click', () => {
    Sound.tap();
    hideLevelDone();
    if (onNext) onNext();
  });
  document.getElementById('phys-stay').addEventListener('click', () => {
    Sound.tap();
    hideLevelDone();
  });

  window.PaizonPhysics = { createScene, shade, levelDone, hideLevelDone, Body, P };
})();
