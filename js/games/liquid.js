/* Væskelek: en ren væskesimulator – rør, hell, bland farger og vipp telefonen. */
(function () {
  'use strict';

  const P = window.Paizon;
  const Sound = window.PaizonSound;
  const F = window.PaizonFluid;
  const { $, $$ } = P;

  const settings = P.settings('liquid', { tool: 'stir', paint: 'bla', liquid: 'vann', gravity: 'ned' });

  const canvas = $('#liquid-canvas');
  const ctx = canvas.getContext('2d');
  const wrap = $('#liquid-world');
  let sim = null;
  let running = false;
  let raf = 0;
  let W = 0;
  let H = 0;
  let pointer = null; // { x, y, lastX, lastY, id }
  let tilt = { x: 0, y: 1 };
  let tiltListening = false;
  let stepsPerFrame = 2;
  const G = 0.2;

  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, Math.floor(r.width));
    H = Math.max(200, Math.floor(r.height));
    // Lav oppløsning holder: «goo»-filteret myker uansett opp kantene.
    canvas.width = W;
    canvas.height = H;
  }

  // Partikkelstørrelsen følger skjermen, så vannet fyller like mye på mobil og nettbrett
  // uten flere partikler enn enheten klarer.
  const START_PARTICLES = 750;
  const MAX_PARTICLES = 1250;
  function particleSize() {
    const spacing = Math.sqrt((W * H * 0.3) / START_PARTICLES);
    return Math.max(12, Math.min(32, spacing / 0.45));
  }

  function newSim() {
    const h = particleSize();
    sim = new F.FluidSim({ width: W, height: H, max: MAX_PARTICLES, h, liquid: settings.liquid });
    sim.fillRect(0, H * 0.6, W, H, F.PAINTS.bla.ryb, START_PARTICLES);
    // «Goo»-filteret må myke opp i forhold til partikkelstørrelsen.
    $('#goo feGaussianBlur').setAttribute('stdDeviation', (h * 0.32).toFixed(1));
    applyGravity();
  }

  function start() {
    P.show('liquid');
    measure();
    newSim();
    renderToolbar();
    if (!running) {
      running = true;
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    pointer = null;
  }

  // ---------- Hovedløkke ----------
  function loop() {
    if (!running) return;
    if (pointer) usePointer();
    const t0 = performance.now();
    for (let i = 0; i < stepsPerFrame; i++) sim.step();
    // Juster antall steg per bilde etter hvor rask enheten er.
    const cost = performance.now() - t0;
    if (cost > 12 && stepsPerFrame > 1) stepsPerFrame--;
    else if (cost < 5 && stepsPerFrame < 2) stepsPerFrame++;
    draw();
    raf = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    const r = sim.h * 0.62;
    // Grupper etter farge (avrundet) så vi tegner med få fargebytter.
    const groups = new Map();
    for (let i = 0; i < sim.count; i++) {
      const c = sim.color(i);
      const key = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3);
      let g = groups.get(key);
      if (!g) groups.set(key, (g = { color: `rgb(${c[0]},${c[1]},${c[2]})`, list: [] }));
      g.list.push(i);
    }
    for (const g of groups.values()) {
      ctx.fillStyle = g.color;
      ctx.beginPath();
      for (const i of g.list) {
        ctx.moveTo(sim.x[i] + r, sim.y[i]);
        ctx.arc(sim.x[i], sim.y[i], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // ---------- Finger / mus ----------
  function toSim(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = toSim(e);
    pointer = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, id: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (settings.tool === 'pour') Sound.tap();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const p = toSim(e);
    pointer.x = p.x;
    pointer.y = p.y;
  });
  const release = (e) => { if (pointer && e.pointerId === pointer.id) pointer = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function usePointer() {
    const dx = pointer.x - pointer.lastX;
    const dy = pointer.y - pointer.lastY;
    if (settings.tool === 'stir') {
      sim.stir(pointer.x, pointer.y, dx / stepsPerFrame, dy / stepsPerFrame, sim.h * 3.5);
    } else if (settings.tool === 'pour') {
      const ryb = F.PAINTS[settings.paint].ryb;
      for (let k = 0; k < 3; k++) {
        sim.add(pointer.x + (Math.random() - 0.5) * sim.h, pointer.y + (Math.random() - 0.5) * sim.h, ryb, dx * 0.3, dy * 0.3 + 1);
      }
      if (sim.count >= sim.max && !pointer.full) {
        pointer.full = true;
        P.toast('Nå er det fullt – bruk svampen 🧽 for å fjerne litt');
      }
    } else if (settings.tool === 'sponge') {
      sim.removeNear(pointer.x, pointer.y, sim.h * 2.2);
    }
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  }

  // ---------- Tyngdekraft ----------
  function applyGravity() {
    if (settings.gravity === 'av') {
      sim.gx = 0;
      sim.gy = 0;
    } else if (settings.gravity === 'vipp') {
      sim.gx = tilt.x * G;
      sim.gy = tilt.y * G;
      listenTilt();
    } else {
      sim.gx = 0;
      sim.gy = G;
    }
  }

  function onOrientation(e) {
    if (e.beta == null || e.gamma == null) return;
    const rad = Math.PI / 180;
    // Tyngdekraften i telefonens skjermplan.
    let gx = Math.sin(e.gamma * rad) * Math.cos(e.beta * rad);
    let gy = Math.sin(e.beta * rad);
    // Liggende skjerm: roter vektoren slik at «ned» blir riktig.
    const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const a = -angle * rad;
    const rx = gx * Math.cos(a) - gy * Math.sin(a);
    const ry = gx * Math.sin(a) + gy * Math.cos(a);
    gx = rx;
    gy = ry;
    const len = Math.hypot(gx, gy);
    tilt = len > 0.05 ? { x: gx / Math.max(1, len), y: gy / Math.max(1, len) } : { x: 0, y: 0 };
    if (sim && settings.gravity === 'vipp') {
      sim.gx = tilt.x * G;
      sim.gy = tilt.y * G;
    }
  }

  async function listenTilt() {
    if (tiltListening) return;
    // iOS krever at man spør om lov først.
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        if (await DeviceOrientationEvent.requestPermission() !== 'granted') throw new Error('nei');
      } catch (e) {
        P.toast('Fikk ikke lov til å bruke vippesensoren');
        return;
      }
    }
    if (!('DeviceOrientationEvent' in window)) {
      P.toast('Denne enheten har ikke vippesensor');
      return;
    }
    window.addEventListener('deviceorientation', onOrientation);
    tiltListening = true;
    P.toast('Vipp telefonen! 📱');
  }

  // ---------- Verktøylinje ----------
  function renderToolbar() {
    $$('#liquid-toolbar [data-set]').forEach((b) => {
      const [key, value] = b.dataset.set.split(':');
      const on = settings[key] === value;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('#liquid-paints').classList.toggle('dim', settings.tool !== 'pour');
  }

  $('#liquid-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sound.unlock();
    Sound.tap();
    if (b.dataset.set) {
      const [key, value] = b.dataset.set.split(':');
      settings[key] = value;
      if (key === 'paint') settings.tool = 'pour'; // å velge farge betyr at man vil helle
      P.saveSettings('liquid');
      if (key === 'liquid') sim.setLiquid(value);
      if (key === 'gravity') applyGravity();
      renderToolbar();
    } else if (b.id === 'liquid-clear') {
      newSim();
    } else if (b.id === 'liquid-empty') {
      sim.clear();
    }
  });

  window.addEventListener('resize', () => {
    if (!running) return;
    measure();
    sim.resize(W, H);
  });

  P.registerGame('liquid', { screen: 'liquid', start, stop });
})();
