/* Kulebane: legg ut planker, buer, trakter og trampoliner – og led kula ned i koppen. */
(function () {
  'use strict';

  const P = window.Paizon;
  const K = window.PaizonPhysics;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const M = window.Matter;
  const { $, $$ } = P;
  if (!M || !K) return;
  const { Bodies, Body, Composite, Query, Events } = M;

  // Nivåer i andeler av skjermen. start: hvor kula slippes og hvilken vei den triller.
  // cup: midten av koppen og bunnen (y). walls: faste hindringer (x0, y0, x1, y1).
  const LEVELS = [
    { name: 'Første bane', start: { x: 0.08, y: 0.12, dir: 1 }, cup: { x: 0.85 }, walls: [] },
    { name: 'Andre veien', start: { x: 0.92, y: 0.12, dir: -1 }, cup: { x: 0.15 }, walls: [] },
    { name: 'Under hylla', start: { x: 0.08, y: 0.12, dir: 1 }, cup: { x: 0.12 }, walls: [{ x0: 0, y0: 0.5, x1: 0.34, y1: 0.54 }] },
    {
      name: 'Over muren',
      start: { x: 0.08, y: 0.12, dir: 1 },
      cup: { x: 0.87, y: 0.62 },
      walls: [{ x0: 0.46, y0: 0.4, x1: 0.51, y1: 1 }, { x0: 0.74, y0: 0.62, x1: 1, y1: 1 }],
    },
  ];
  const FREE = { start: { x: 0.08, y: 0.12, dir: 1 }, walls: [] };

  // Delene barnet kan legge ut (alle står fast der de legges).
  const PARTS = {
    planke: { label: 'Planke', color: '#e1a14b' },
    kort: { label: 'Kort planke', color: '#f0b46a' },
    bue: { label: 'Bue', color: '#74b9ff' },
    trakt: { label: 'Trakt', color: '#a29bfe' },
    sprett: { label: 'Trampoline', color: '#ff7675' },
  };

  const scene = K.createScene({ canvas: $('#marble-canvas'), wrap: $('#marble-world'), unitsW: 10, unitsH: 8, minU: 28, maxU: 80 });
  const ctx = scene.ctx;

  let mode = 'fri';
  let level = 0;
  let tool = 'flytt';
  let def = FREE;
  let fixed = []; // gulv, vegger, kopp
  let parts = []; // delene barnet har lagt ut
  let marbles = [];
  let selected = null;
  let drag = null;
  let cup = null; // { x0, x1, top, bottom }
  let inCupSince = 0;
  let solved = false;
  const MAX_MARBLES = 25;

  // ---------- Verden ----------
  function addFixed(body, look) {
    Body.setStatic(body, true);
    body.paizon = Object.assign({ kind: 'fixed' }, look);
    Composite.add(scene.world, body);
    fixed.push(body);
    return body;
  }

  function rect(x0, y0, x1, y1, opts) {
    return Bodies.rectangle((x0 + x1) / 2, (y0 + y1) / 2, Math.max(1, x1 - x0), Math.max(1, y1 - y0), opts);
  }

  function floorY() {
    return scene.H - scene.u * 0.3;
  }

  function buildWorld() {
    const { W, H, u } = scene;
    fixed = [];
    const thick = 400;
    addFixed(rect(-thick, -H, 0, H * 2), { hidden: true });
    addFixed(rect(W, -H, W + thick, H * 2), { hidden: true });
    addFixed(rect(-W, floorY(), W * 2, floorY() + thick, { friction: 0.3 }), { color: '#7bc96f' });
    for (const w of def.walls) {
      addFixed(rect(w.x0 * W, w.y0 * H, w.x1 * W, Math.min(w.y1 * H, floorY() + 2), { friction: 0.2 }), { color: '#b2bec3' });
    }
    cup = null;
    if (def.cup) {
      // Koppen: en åpen boks. Kula må lande inni.
      const cx = def.cup.x * W;
      const bottom = def.cup.y ? def.cup.y * H : floorY();
      const w = u * 2.2;
      const h = u * 1.3;
      const t = u * 0.16;
      const look = { color: '#fdcb6e', cup: true };
      addFixed(rect(cx - w / 2, bottom - t, cx + w / 2, bottom, { friction: 0.6 }), look);
      addFixed(rect(cx - w / 2, bottom - h, cx - w / 2 + t, bottom, { friction: 0.6 }), look);
      addFixed(rect(cx + w / 2 - t, bottom - h, cx + w / 2, bottom, { friction: 0.6 }), look);
      cup = { x0: cx - w / 2 + t, x1: cx + w / 2 - t, top: bottom - h, bottom: bottom - t };
    }
  }

  function start(newMode, newLevel) {
    mode = newMode || 'fri';
    level = newLevel || 0;
    def = mode === 'fri' ? FREE : LEVELS[level];
    P.show('marble');
    K.hideLevelDone();
    scene.measure();
    scene.newEngine();
    parts = [];
    marbles = [];
    selected = null;
    solved = false;
    inCupSince = 0;
    buildWorld();
    Events.on(scene.engine, 'collisionStart', onCollision);
    setTool('planke');
    const goal = mode === 'fri'
      ? 'Bygg en kulebane, og trykk ▶ for å slippe kuler!'
      : `Nivå ${level + 1}: ${def.name} – få kula ned i koppen!`;
    $('#marble-goal').textContent = goal;
    if (mode !== 'fri') setTimeout(() => Speech.speak(`${def.name}! Bygg en bane så kula havner i koppen.`), 300);
    scene.run(frame);
  }

  function stop() {
    scene.stop();
    drag = null;
    K.hideLevelDone();
  }

  // ---------- Deler ----------
  /** Lag en del sentrert i (x, y). Buer og trakter er sammensatt av flere biter. */
  function makePart(type, x, y) {
    const { u } = scene;
    const opts = { isStatic: true, friction: 0.02, restitution: 0.2 };
    let body;
    if (type === 'planke' || type === 'kort') {
      const len = type === 'planke' ? 3 : 1.6;
      body = Bodies.rectangle(x, y, u * len, u * 0.2, Object.assign({ chamfer: { radius: u * 0.08 } }, opts));
      body.paizon = { half: (u * len) / 2 };
    } else if (type === 'sprett') {
      body = Bodies.rectangle(x, y, u * 1.5, u * 0.26, Object.assign({}, opts, { restitution: 1, chamfer: { radius: u * 0.1 } }));
      body.paizon = { half: u * 0.75 };
    } else if (type === 'bue') {
      // Kvart sirkel (som en skateboardrampe): fra bunnen og opp på høyre side.
      const r = u * 1.7;
      const n = 8;
      const segs = [];
      for (let k = 0; k < n; k++) {
        const a = Math.PI / 2 - ((k + 0.5) / n) * (Math.PI / 2); // 90° → 0°
        const cx = x + Math.cos(a) * r - r / 2;
        const cy = y + Math.sin(a) * r - r / 2;
        const seg = Bodies.rectangle(cx, cy, ((Math.PI / 2) * r) / n + 2, u * 0.2, opts);
        Body.setAngle(seg, a + Math.PI / 2);
        segs.push(seg);
      }
      body = Body.create({ parts: segs, isStatic: true, friction: 0.02 });
      body.paizon = { half: r };
    } else if (type === 'trakt') {
      // To skrå planker med en åpning i bunnen.
      const len = u * 1.5;
      const gap = u * 0.8;
      const ang = 0.75;
      const dx = gap / 2 + (Math.cos(ang) * len) / 2;
      const left = Bodies.rectangle(x - dx, y, len, u * 0.18, opts);
      const right = Bodies.rectangle(x + dx, y, len, u * 0.18, opts);
      Body.setAngle(left, ang);
      Body.setAngle(right, -ang);
      body = Body.create({ parts: [left, right], isStatic: true, friction: 0.02 });
      body.paizon = { half: dx + len / 2 };
    }
    body.paizon = Object.assign(body.paizon || {}, { kind: 'part', type, color: PARTS[type].color });
    Composite.add(scene.world, body);
    parts.push(body);
    return body;
  }

  function addMarble() {
    if (marbles.length >= MAX_MARBLES) {
      Composite.remove(scene.world, marbles.shift());
    }
    const { W, H, u } = scene;
    const s = def.start;
    const body = Bodies.circle(s.x * W + s.dir * u * 0.4, s.y * H, u * 0.28, {
      friction: 0.01, frictionAir: 0.0005, restitution: 0.3, density: 0.004, sleepThreshold: Infinity,
    }, 48);
    Body.setVelocity(body, { x: s.dir * u * 0.05, y: 0 });
    body.paizon = { kind: 'marble', color: ['#e84393', '#0984e3', '#00b894', '#fdcb6e', '#6c5ce7'][marbles.length % 5] };
    Composite.add(scene.world, body);
    marbles.push(body);
    Sound.tap();
    return body;
  }

  /**
   * Trampolinen: Matter.js mister mye energi i støt, så trampolinen speiler selv kulas
   * innkommende fart (lagret før steget) langs sin egen «opp»-retning.
   */
  const BOUNCE = 0.95;
  function onCollision(e) {
    for (const pair of e.pairs) {
      const a = pair.bodyA.parent;
      const b = pair.bodyB.parent;
      const tramp = a.paizon && a.paizon.type === 'sprett' ? a : b.paizon && b.paizon.type === 'sprett' ? b : null;
      const marble = a.paizon && a.paizon.kind === 'marble' ? a : b.paizon && b.paizon.kind === 'marble' ? b : null;
      if (!tramp || !marble || !marble.paizon.lastVel) continue;
      const nx = Math.sin(tramp.angle);
      const ny = -Math.cos(tramp.angle);
      const v = marble.paizon.lastVel;
      const vn = v.x * nx + v.y * ny;
      if (vn >= 0) continue; // på vei bort fra trampolinen allerede
      Body.setVelocity(marble, { x: v.x - (1 + BOUNCE) * vn * nx, y: v.y - (1 + BOUNCE) * vn * ny });
      Sound.hint();
    }
  }

  function select(body) {
    selected = body;
    $('#marble-remove').disabled = !body;
  }

  // ---------- Verktøy ----------
  function setTool(t) {
    tool = t;
    $$('#marble-tools [data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === t);
      b.setAttribute('aria-pressed', String(b.dataset.tool === t));
    });
  }

  $('#marble-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sound.unlock();
    if (b.dataset.tool) {
      setTool(b.dataset.tool);
      Sound.tap();
    } else if (b.id === 'marble-go') {
      addMarble();
    } else if (b.id === 'marble-clear') {
      for (const m of marbles) Composite.remove(scene.world, m);
      marbles = [];
      Sound.flip();
    } else if (b.id === 'marble-remove' && selected) {
      Composite.remove(scene.world, selected);
      parts = parts.filter((x) => x !== selected);
      select(null);
      Sound.flip();
    }
  });

  // ---------- Finger ----------
  const canvas = scene.canvas;

  /** Tynne deler er vanskelige å treffe – sjekk også litt rundt fingeren. */
  function partAt(p) {
    const r = scene.u * 0.3;
    for (const [dx, dy] of [[0, 0], [0, -r], [0, r], [-r, 0], [r, 0]]) {
      const hit = Query.point(parts, { x: p.x + dx, y: p.y + dy })[0];
      if (hit) return hit;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = scene.toWorld(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (selected && scene.onHandle(selected, p)) {
      drag = { kind: 'rotate', body: selected, id: e.pointerId };
      return;
    }
    const hit = partAt(p);
    if (hit) {
      select(hit);
      drag = { kind: 'move', body: hit, dx: p.x - hit.position.x, dy: p.y - hit.position.y, id: e.pointerId };
      return;
    }
    if (PARTS[tool]) {
      select(makePart(tool, p.x, p.y));
      Sound.tap();
      drag = { kind: 'move', body: selected, dx: 0, dy: 0, id: e.pointerId };
    } else {
      select(null);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = scene.toWorld(e);
    if (drag.kind === 'rotate') {
      Body.setAngle(drag.body, Math.atan2(p.y - drag.body.position.y, p.x - drag.body.position.x));
    } else {
      Body.setPosition(drag.body, {
        x: Math.min(Math.max(p.x - drag.dx, 0), scene.W),
        y: Math.min(Math.max(p.y - drag.dy, 0), floorY() - scene.u * 0.2),
      });
    }
  });

  const release = (e) => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  // ---------- Mål ----------
  function checkGoal(t) {
    if (!cup || solved) return;
    const inside = marbles.some((m) => m.position.x > cup.x0 && m.position.x < cup.x1 && m.position.y > cup.top && m.position.y < cup.bottom + 2);
    if (!inside) {
      inCupSince = 0;
      return;
    }
    if (!inCupSince) inCupSince = t;
    if (t - inCupSince > 300) {
      solved = true;
      const last = level >= LEVELS.length - 1;
      K.levelDone({
        title: P.pick(P.PRAISE),
        text: 'Kula havnet i koppen! 🎯',
        last,
        next: () => {
          if (last) {
            stop();
            P.showDone({ icon: '🎯', summary: 'Du klarte alle kulebanene!', again: () => start('utfordring', 0), setup: 'marble-setup' });
          } else start('utfordring', level + 1);
        },
      });
    }
  }

  // ---------- Tegning ----------
  function frame(t) {
    const { W, H, u } = scene;
    for (const m of marbles.filter((b) => b.position.y > H + u * 3 || b.position.x < -u * 3 || b.position.x > W + u * 3)) {
      Composite.remove(scene.world, m);
      marbles = marbles.filter((x) => x !== m);
    }
    // Husk farten før neste steg (brukes av trampolinen).
    for (const m of marbles) m.paizon.lastVel = { x: m.velocity.x, y: m.velocity.y };
    checkGoal(t);
    scene.drawSky('#d6f0ff', '#f4fbff');
    drawStart();
    for (const b of fixed) if (!b.paizon.hidden) scene.fillBody(b, b.paizon.color);
    if (cup) {
      ctx.font = `${Math.round(u * 0.6)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('🎯', (cup.x0 + cup.x1) / 2, cup.top - u * 0.25);
    }
    for (const b of parts) {
      scene.fillBody(b, b.paizon.color);
      if (b.paizon.type === 'sprett') drawSpring(b);
      if (b === selected) scene.outline(b);
    }
    for (const m of marbles) drawMarble(m);
    if (selected) scene.drawHandle(selected);
  }

  function drawStart() {
    const { W, H, u } = scene;
    const s = def.start;
    const x = s.x * W;
    const y = s.y * H;
    // Startrøret går fra toppen av skjermen og ned til der kula slippes.
    ctx.save();
    ctx.fillStyle = '#636e72';
    ctx.fillRect(x - u * 0.45, 0, u * 0.9, Math.max(u * 0.5, y - u * 0.4));
    ctx.fillStyle = '#b2bec3';
    ctx.fillRect(x - u * 0.35, y - u * 0.45, u * 0.7, u * 0.2);
    ctx.font = `${Math.round(u * 0.45)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(s.dir > 0 ? '➡' : '⬅', x, Math.max(u * 0.3, y - u * 0.75));
    ctx.restore();
  }

  function drawSpring(b) {
    // Hvite striper så trampolinen ser sprettende ut.
    ctx.save();
    ctx.translate(b.position.x, b.position.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    const w = scene.u * 1.5;
    for (let k = -2; k <= 2; k++) ctx.fillRect(k * w * 0.18 - 3, -scene.u * 0.13, 6, scene.u * 0.26);
    ctx.restore();
  }

  function drawMarble(m) {
    const r = m.circleRadius;
    ctx.save();
    ctx.fillStyle = m.paizon.color;
    ctx.beginPath();
    ctx.arc(m.position.x, m.position.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(m.position.x - r * 0.35, m.position.y - r * 0.35, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  window.addEventListener('resize', () => {
    if (!scene.running) return;
    const r = $('#marble-world').getBoundingClientRect();
    if (Math.abs(r.width - scene.W) / scene.W > 0.15 || Math.abs(r.height - scene.H) / scene.H > 0.15) start(mode, level);
  });

  // ---------- Oppsett ----------
  $$('[data-marble]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.marble, 0);
  }));

  P.registerGame('marble', { screen: 'marble', setupScreen: 'marble-setup', start: () => start('fri', 0), stop });

  // For tester og feilsøking.
  window.PaizonMarble = {
    start,
    makePart,
    addMarble,
    get marbles() { return marbles; },
    get parts() { return parts; },
    get cup() { return cup; },
    get scene() { return scene; },
    get solved() { return solved; },
    LEVELS,
  };
})();
