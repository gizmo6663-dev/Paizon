/* Væskelek: en ren væskesimulator – rør, hell, bland farger, kraner, skåler og sluk i bunnen. */
(function () {
  'use strict';

  const P = window.Paizon;
  const Sound = window.PaizonSound;
  const F = window.PaizonFluid;
  const { $, $$ } = P;

  const settings = P.settings('liquid', { tool: 'stir', paint: 'bla', liquid: 'vann', gravity: 'ned' });
  if (!F.LIQUIDS[settings.liquid]) settings.liquid = 'vann'; // honning finnes ikke lenger

  const canvas = $('#liquid-canvas'); // væsken (med «goo»-filter)
  const ctx = canvas.getContext('2d');
  const top = $('#liquid-objects'); // kraner, hindringer og sluket (skarpe kanter), tar imot fingeren
  const tctx = top.getContext('2d');
  const wrap = $('#liquid-world');
  const context = $('#liquid-context');
  const strengthInput = $('#liquid-strength');

  let sim = null;
  let running = false;
  let raf = 0;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let pointer = null; // fingeren når den brukes som verktøy i væsken
  let drag = null; // { kind, item, dx, dy, moved, id }
  let selected = null; // { kind: 'kran' | 'ting', item }
  let tilt = { x: 0, y: 1 };
  let tiltListening = false;
  let stepsPerFrame = 2;
  const G = 0.2;
  const LIMITS = { kran: 4, ting: 12 };

  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, Math.floor(r.width));
    H = Math.max(200, Math.floor(r.height));
    // Lav oppløsning holder for væsken: «goo»-filteret myker uansett opp kantene.
    canvas.width = W;
    canvas.height = H;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    top.width = Math.round(W * dpr);
    top.height = Math.round(H * dpr);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
    const old = sim;
    const h = particleSize();
    sim = new F.FluidSim({ width: W, height: H, max: MAX_PARTICLES, h, drain: true });
    sim.fillRect(0, H * 0.6, W, H, F.PAINTS.bla.ryb, START_PARTICLES, 0);
    if (old) {
      // Behold kraner, sluket og ting når vannet fylles på nytt.
      sim.obstacles = old.obstacles;
      sim.faucets = old.faucets;
      sim.floorDrain = old.floorDrain;
    }
    // «Goo»-filteret må myke opp i forhold til partikkelstørrelsen.
    $('#goo feGaussianBlur').setAttribute('stdDeviation', (h * 0.32).toFixed(1));
    applyPour();
    applyGravity();
  }

  function start() {
    P.show('liquid');
    measure();
    sim = null;
    selected = null;
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
    drag = null;
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
    drawFluid();
    drawObjects();
    raf = requestAnimationFrame(loop);
  }

  function drawFluid() {
    ctx.clearRect(0, 0, W, H);
    const full = sim.h * 0.62;
    // Partikler med få naboer (en stråle eller en dråpe) tegnes mindre, så strålen blir tynn.
    const radius = (i) => full * Math.min(1, 0.45 + Math.max(0, sim.neighbors(i) - 2) * 0.09);
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
        const r = radius(i);
        ctx.moveTo(sim.x[i] + r, sim.y[i]);
        ctx.arc(sim.x[i], sim.y[i], r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // ---------- Tegning av ting ----------
  const THING_COLORS = { kloss: '#ff7675', planke: '#e1a14b', halvmane: '#74b9ff', skal: '#a29bfe' };

  function drawObjects() {
    tctx.clearRect(0, 0, W, H);
    drawFloorDrain();
    for (const o of sim.obstacles) drawObstacle(o);
    for (const f of sim.faucets) drawFaucet(f);
    if (selected && selected.kind === 'ting') drawRotateHandle(selected.item);
  }

  function isSelected(item) {
    return selected && selected.item === item;
  }

  function drawObstacle(o) {
    tctx.save();
    tctx.translate(o.x, o.y);
    tctx.rotate(o.angle);
    tctx.fillStyle = THING_COLORS[o.type];
    tctx.strokeStyle = 'rgba(45, 48, 71, 0.45)';
    tctx.lineWidth = 2.5;
    tctx.beginPath();
    if (o.shape === 'box') {
      roundRect(tctx, -o.hw, -o.hh, o.hw * 2, o.hh * 2, o.round);
    } else {
      const a0 = Math.PI / 2 - o.span / 2;
      const a1 = Math.PI / 2 + o.span / 2;
      tctx.arc(0, 0, o.r + o.thick / 2, a0, a1);
      tctx.arc(o.r * Math.cos(a1), o.r * Math.sin(a1), o.thick / 2, a1, a1 + Math.PI);
      tctx.arc(0, 0, o.r - o.thick / 2, a1, a0, true);
      tctx.arc(o.r * Math.cos(a0), o.r * Math.sin(a0), o.thick / 2, a0 + Math.PI, a0);
    }
    tctx.closePath();
    tctx.fill();
    tctx.stroke();
    if (isSelected(o)) {
      tctx.setLineDash([6, 5]);
      tctx.strokeStyle = '#2d3047';
      tctx.lineWidth = 2.5;
      tctx.stroke();
    }
    tctx.restore();
  }

  function rotateHandlePos(o) {
    const d = o.reach + 22;
    return { x: o.x + Math.cos(o.angle) * d, y: o.y + Math.sin(o.angle) * d };
  }

  function drawRotateHandle(o) {
    const p = rotateHandlePos(o);
    tctx.save();
    tctx.strokeStyle = 'rgba(45, 48, 71, 0.4)';
    tctx.setLineDash([4, 4]);
    tctx.beginPath();
    tctx.moveTo(o.x, o.y);
    tctx.lineTo(p.x, p.y);
    tctx.stroke();
    tctx.setLineDash([]);
    tctx.fillStyle = '#6c5ce7';
    tctx.beginPath();
    tctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    tctx.fill();
    tctx.fillStyle = '#fff';
    tctx.font = 'bold 18px system-ui, sans-serif';
    tctx.textAlign = 'center';
    tctx.textBaseline = 'middle';
    tctx.fillText('↻', p.x, p.y + 1);
    tctx.restore();
  }

  /** Sluket: en svart strek i bunnen. Med propp i er den grå. */
  function drawFloorDrain() {
    const { x0, x1 } = sim.drainSpan();
    tctx.save();
    tctx.lineCap = 'round';
    tctx.lineWidth = 7;
    tctx.strokeStyle = sim.floorDrain.open ? '#1e1e24' : '#9aa0a6';
    tctx.beginPath();
    tctx.moveTo(x0, H - 4);
    tctx.lineTo(x1, H - 4);
    tctx.stroke();
    tctx.restore();
  }

  /** Kranen tegnes som et rør fra veggen med tut som peker innover. */
  function drawFaucet(f) {
    const s = faucetSize();
    tctx.save();
    tctx.translate(f.x, f.y);
    tctx.rotate(Math.atan2(f.dy, f.dx) - Math.PI / 2); // tegnet med tuten nedover
    // Rør bakover til veggen.
    tctx.fillStyle = '#b2bec3';
    tctx.strokeStyle = '#636e72';
    tctx.lineWidth = 2;
    roundRect(tctx, -s * 0.28, -s * 1.15, s * 0.56, s * 1.0, s * 0.12);
    tctx.fill();
    tctx.stroke();
    // Tut.
    tctx.fillStyle = '#dfe6e9';
    roundRect(tctx, -s * 0.22, -s * 0.25, s * 0.44, s * 0.3, s * 0.08);
    tctx.fill();
    tctx.stroke();
    // Håndtak: blått når kranen er på, rødt når den er av.
    tctx.fillStyle = f.on ? '#0984e3' : '#d63031';
    tctx.beginPath();
    tctx.arc(0, -s * 0.75, s * 0.32, 0, Math.PI * 2);
    tctx.fill();
    tctx.stroke();
    tctx.fillStyle = '#fff';
    tctx.fillRect(-s * 0.22, -s * 0.79, s * 0.44, s * 0.08);
    if (isSelected(f)) {
      tctx.setLineDash([6, 5]);
      tctx.strokeStyle = '#2d3047';
      tctx.lineWidth = 2.5;
      tctx.strokeRect(-s * 0.5, -s * 1.2, s, s * 1.3);
    }
    tctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ---------- Kraner: sitter på en vegg eller i taket ----------
  const faucetSize = () => Math.max(36, Math.min(60, sim.h * 2));

  /** Plasser kranen på nærmeste vegg (venstre, høyre eller tak) ved punktet p. */
  function placeFaucet(f, p) {
    const s = faucetSize();
    const dl = p.x;
    const dr = W - p.x;
    const dt = p.y;
    const along = (v, max) => Math.min(Math.max(v, s), max - s);
    if (dt <= dl && dt <= dr) {
      f.wall = 'tak';
      f.x = along(p.x, W);
      f.y = s * 1.15;
      f.dx = 0;
      f.dy = 1;
    } else if (dl < dr) {
      f.wall = 'venstre';
      f.x = s * 1.15;
      f.y = along(p.y, H * 0.85);
      f.dx = 1;
      f.dy = 0.15;
    } else {
      f.wall = 'hoyre';
      f.x = W - s * 1.15;
      f.y = along(p.y, H * 0.85);
      f.dx = -1;
      f.dy = 0.15;
    }
  }

  function faucetHit(f, p) {
    // Treffområdet dekker både tut og rør.
    const s = faucetSize();
    const back = { x: f.x - f.dx * s * 0.6, y: f.y - f.dy * s * 0.6 };
    return Math.hypot(p.x - back.x, p.y - back.y) < s * 0.85;
  }

  // ---------- Finger / mus ----------
  function toSim(e) {
    const rect = top.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
  }

  function hitTest(p) {
    if (selected && selected.kind === 'ting') {
      const h = rotateHandlePos(selected.item);
      if (Math.hypot(p.x - h.x, p.y - h.y) < 24) return { kind: 'roter', item: selected.item };
    }
    for (let i = sim.faucets.length - 1; i >= 0; i--) {
      if (faucetHit(sim.faucets[i], p)) return { kind: 'kran', item: sim.faucets[i] };
    }
    const span = sim.drainSpan();
    if (p.y > H - 30 && p.x > span.x0 - 10 && p.x < span.x1 + 10) return { kind: 'sluk', item: sim.floorDrain };
    const o = sim.obstacleAt(p.x, p.y, 10);
    if (o) return { kind: 'ting', item: o };
    return null;
  }

  top.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = toSim(e);
    try { top.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    const hit = hitTest(p);
    if (hit && hit.kind === 'sluk') {
      sim.floorDrain.open = !sim.floorDrain.open;
      Sound.flip();
      P.toast(sim.floorDrain.open ? 'Sluket er åpent' : 'Proppen er i sluket');
      return;
    }
    if (hit) {
      if (hit.kind !== 'roter') select(hit.kind, hit.item);
      drag = { kind: hit.kind, item: hit.item, dx: p.x - hit.item.x, dy: p.y - hit.item.y, moved: false, id: e.pointerId, sx: p.x, sy: p.y };
      return;
    }
    select(null);
    pointer = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, id: e.pointerId };
    if (settings.tool === 'pour') Sound.tap();
  });

  top.addEventListener('pointermove', (e) => {
    const p = toSim(e);
    if (drag && e.pointerId === drag.id) {
      if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
      if (!drag.moved) return;
      const it = drag.item;
      if (drag.kind === 'roter') {
        it.angle = Math.atan2(p.y - it.y, p.x - it.x);
      } else if (drag.kind === 'kran') {
        placeFaucet(it, p);
      } else {
        it.x = Math.min(Math.max(p.x - drag.dx, 0), W);
        it.y = Math.min(Math.max(p.y - drag.dy, 0), H);
      }
      return;
    }
    if (pointer && e.pointerId === pointer.id) {
      pointer.x = p.x;
      pointer.y = p.y;
    }
  });

  const release = (e) => {
    if (drag && e.pointerId === drag.id) {
      // Et kort trykk på kranen skrur den av eller på.
      if (!drag.moved && drag.kind === 'kran') {
        drag.item.on = !drag.item.on;
        Sound.flip();
        renderContext();
      }
      drag = null;
    }
    if (pointer && e.pointerId === pointer.id) pointer = null;
  };
  top.addEventListener('pointerup', release);
  top.addEventListener('pointercancel', release);

  function usePointer() {
    const dx = pointer.x - pointer.lastX;
    const dy = pointer.y - pointer.lastY;
    if (settings.tool === 'stir') {
      sim.stir(pointer.x, pointer.y, dx / stepsPerFrame, dy / stepsPerFrame, sim.h * 3.5);
    } else if (settings.tool === 'pour') {
      for (let k = 0; k < 3; k++) {
        sim.add(pointer.x + (Math.random() - 0.5) * sim.h, pointer.y + (Math.random() - 0.5) * sim.h, sim.pourRyb, dx * 0.3, dy * 0.3 + 1);
      }
      if (sim.count >= sim.max && !pointer.full) {
        pointer.full = true;
        P.toast('Nå er det fullt – bruk svampen 🧽 eller åpne sluket');
      }
    } else if (settings.tool === 'sponge') {
      sim.removeNear(pointer.x, pointer.y, sim.h * 2.2);
    }
    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  }

  // ---------- Valgt ting ----------
  function select(kind, item) {
    selected = kind ? { kind, item } : null;
    renderContext();
  }

  function renderContext() {
    context.hidden = !selected;
    if (!selected) return;
    const isFaucet = selected.kind === 'kran';
    $('#liquid-strength-row').hidden = !isFaucet;
    $('#liquid-toggle').hidden = !isFaucet;
    if (isFaucet) {
      strengthInput.value = Math.round(selected.item.strength * 100);
      $('#liquid-toggle').textContent = selected.item.on ? '⏸️ Skru av' : '▶️ Skru på';
    }
    const names = { kran: 'Kran', ting: 'Ting' };
    $('#liquid-context-name').textContent = selected.kind === 'ting' ? THING_NAMES[selected.item.type] : names[selected.kind];
  }

  const THING_NAMES = { kloss: 'Kloss', planke: 'Planke', halvmane: 'Halvmåne', skal: 'Skål' };

  strengthInput.addEventListener('input', () => {
    if (selected && selected.kind === 'kran') {
      selected.item.strength = Number(strengthInput.value) / 100;
      selected.item.on = selected.item.strength > 0;
      $('#liquid-toggle').textContent = selected.item.on ? '⏸️ Skru av' : '▶️ Skru på';
    }
  });
  $('#liquid-toggle').addEventListener('click', () => {
    if (!selected || selected.kind !== 'kran') return;
    const f = selected.item;
    f.on = !f.on;
    if (f.on && f.strength === 0) f.strength = 0.5;
    Sound.flip();
    renderContext();
  });
  $('#liquid-remove').addEventListener('click', () => {
    if (!selected) return;
    const { kind, item } = selected;
    if (kind === 'kran') sim.faucets = sim.faucets.filter((f) => f !== item);
    else sim.removeObstacle(item);
    Sound.flip();
    select(null);
  });

  /** Legg til en ny kran eller en ting, og velg den. */
  function addThing(type) {
    const count = { kran: sim.faucets.length, ting: sim.obstacles.length };
    const kind = type === 'kran' ? type : 'ting';
    if (count[kind] >= LIMITS[kind]) {
      P.toast(`Det er plass til ${LIMITS[kind]} – fjern en først`);
      return;
    }
    let item;
    if (type === 'kran') {
      item = sim.addFaucet(0, 0, 0, 1, 0.5);
      placeFaucet(item, { x: W * 0.3 + Math.random() * W * 0.4, y: 0 });
      P.toast('Dra kranen langs veggen eller taket. Trykk for av/på.');
    } else {
      const y = H * 0.4;
      item = sim.addObstacle(type, freeSpot(y), y, 0, sim.h * 2);
    }
    select(kind, item);
  }

  /** Finn en x-posisjon langs høyden y som ligger lengst unna tingene som allerede finnes. */
  function freeSpot(y) {
    const others = sim.obstacles.map((o) => ({ x: o.x, y: o.y }));
    let best = W / 2;
    let bestDist = -1;
    for (let k = 1; k <= 7; k++) {
      const x = (W * k) / 8;
      const d = others.length ? Math.min(...others.map((o) => Math.hypot(o.x - x, o.y - y))) : W - Math.abs(x - W / 2);
      if (d > bestDist) {
        bestDist = d;
        best = x;
      }
    }
    return best;
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

  function applyPour() {
    sim.setLiquid(settings.liquid);
    sim.pourRyb = F.PAINTS[settings.paint].ryb;
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
    // Olje har sin egen farge, så malingen gjelder bare vann.
    $('#liquid-paints').classList.toggle('dim', settings.liquid !== 'vann');
  }

  $('#liquid-toolbar').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sound.unlock();
    Sound.tap();
    if (b.dataset.set) {
      const [key, value] = b.dataset.set.split(':');
      settings[key] = value;
      if (key === 'paint') {
        // Å velge farge betyr at man vil helle vann i den fargen.
        settings.tool = 'pour';
        settings.liquid = 'vann';
      }
      if (key === 'liquid' && value !== 'vann') settings.tool = 'pour';
      P.saveSettings('liquid');
      applyPour();
      if (key === 'gravity') applyGravity();
      renderToolbar();
    } else if (b.dataset.add) {
      addThing(b.dataset.add);
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
    for (const f of sim.faucets) placeFaucet(f, { x: f.x, y: f.y });
  });

  P.registerGame('liquid', { screen: 'liquid', start, stop });

  // For tester og feilsøking.
  window.PaizonLiquid = {
    get sim() { return sim; },
    get selected() { return selected; },
    addThing,
  };
})();
