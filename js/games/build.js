/* Byggeklosser: fysikk med Matter.js – fri bygging, tårn- og bro-utfordringer. */
(function () {
  'use strict';

  const P = window.Paizon;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const M = window.Matter;
  const { $, $$ } = P;
  if (!M) return;
  const { Engine, Bodies, Body, Composite, Constraint, Query, Events, Sleeping } = M;

  // Klossene i verktøykassen. Størrelser er i «enheter» (u), som skaleres etter skjermen.
  const BLOCKS = [
    { key: 'kloss', label: 'Kloss', w: 1, h: 1, color: '#ff7675' },
    { key: 'planke', label: 'Planke', w: 3, h: 0.3, color: '#e1a14b' },
    { key: 'lang', label: 'Lang planke', w: 5, h: 0.3, color: '#c97f2e' },
    { key: 'soyle', label: 'Søyle', w: 0.6, h: 2.2, color: '#74b9ff' },
    { key: 'trekant', label: 'Trekant', sides: 3, r: 0.75, color: '#55efc4' },
    { key: 'ball', label: 'Ball', circle: 0.5, color: '#fdcb6e' },
  ];

  // Utfordringer: høyde i u for tårn, bredde på kløften i u for bro.
  const LEVELS = {
    tarn: [{ height: 4 }, { height: 6 }, { height: 8 }],
    bro: [{ gap: 2.2 }, { gap: 4 }, { gap: 7 }], // planke (3u) rekker over nivå 1, lang planke (5u) nivå 2, nivå 3 trenger søyler
  };

  const BALL_SPIN = 0.11; // radianer per steg ≈ 0,08 u per steg

  const canvas = $('#build-canvas');
  const ctx = canvas.getContext('2d');
  const wrap = $('#build-world');
  const goalEl = $('#build-goal');
  const overlay = $('#build-done');

  let engine = null;
  let world = null;
  let mode = 'fri';
  let level = 0;
  let u = 50; // pikselstørrelse på én enhet
  let W = 0;
  let H = 0;
  let statics = [];
  let blocks = [];
  let selected = null;
  let drag = null; // { body, constraint, pointerId }
  let raf = 0;
  let running = false;
  let shakeUntil = 0;
  let ball = null;
  let ballState = 'ready'; // ready | rolling
  let stillSince = 0;
  let solved = false;
  let terrain = null;

  // ---------- Oppsett av verden ----------
  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    u = Math.max(28, Math.min(64, Math.min(W / 16, H / 11)));
  }

  const groundTop = () => H - u * 0.9;

  function makeBlock(def, x, y) {
    const common = { friction: 0.8, frictionStatic: 1.2, restitution: 0.05, density: 0.002, slop: 0.02 };
    let body;
    if (def.circle) body = Bodies.circle(x, y, def.circle * u, Object.assign({}, common, { friction: 0.3, restitution: 0.3 }));
    else if (def.sides) body = Bodies.polygon(x, y, def.sides, def.r * u, Object.assign({ chamfer: { radius: u * 0.08 } }, common));
    else {
      // Avlange klosser får runde ender, så en kule kan trille opp på dem.
      const round = def.w / def.h > 2.5 ? 0.48 : 0.18;
      body = Bodies.rectangle(x, y, def.w * u, def.h * u, Object.assign({ chamfer: { radius: Math.min(def.w, def.h) * u * round } }, common));
    }
    body.paizon = { color: def.color, key: def.key };
    return body;
  }

  function addStatic(body, look) {
    Body.setStatic(body, true);
    body.paizon = look;
    statics.push(body);
    Composite.add(world, body);
    return body;
  }

  /** Bygg bakken (og eventuelt kløften) for valgt modus. */
  function buildTerrain() {
    for (const s of statics) Composite.remove(world, s);
    statics = [];
    terrain = null;
    const gt = groundTop();
    const thick = 400;
    // Usynlige vegger på sidene så klossene ikke forsvinner ut av skjermen.
    addStatic(Bodies.rectangle(-thick / 2, H / 2, thick, H * 4), { hidden: true });
    addStatic(Bodies.rectangle(W + thick / 2, H / 2, thick, H * 4), { hidden: true });
    addStatic(Bodies.rectangle(W / 2, -thick / 2, W * 2, thick), { hidden: true }); // tak

    if (mode === 'bro') {
      const gap = Math.min(LEVELS.bro[level].gap * u, W * 0.5);
      const cliffTop = gt - u * 4;
      const gapStart = W * 0.45 - gap / 2;
      const gapEnd = gapStart + gap;
      const rect = (x0, x1, top) => Bodies.rectangle((x0 + x1) / 2, (top + gt + thick) / 2, x1 - x0, gt + thick - top, { friction: 0.9 });
      addStatic(Bodies.rectangle(W / 2, gt + thick / 2, W * 2, thick, { friction: 1 }), { kind: 'ground' });
      addStatic(rect(0, gapStart, cliffTop), { kind: 'cliff' });
      addStatic(rect(gapEnd, W, cliffTop), { kind: 'cliff' });
      // Rampe på venstre side gir kula fart.
      const rampW = Math.min(gapStart * 0.6, u * 4);
      const ramp = Bodies.fromVertices(0, 0, [[
        { x: 0, y: -u * 2.4 }, { x: rampW, y: 0 }, { x: 0, y: 0 },
      ]], { friction: 0.05 });
      // Flytt rampen så den står på klippen helt til venstre.
      Body.setPosition(ramp, { x: ramp.position.x - ramp.bounds.min.x, y: ramp.position.y + (cliffTop - ramp.bounds.max.y) });
      addStatic(ramp, { kind: 'cliff' });
      terrain = {
        cliffTop, gapStart, gapEnd,
        flagX: gapEnd + (W - gapEnd) * 0.5,
        startX: u * 0.9,
        startY: cliffTop - u * 3.4,
      };
    } else {
      addStatic(Bodies.rectangle(W / 2, gt + thick / 2, W * 2, thick, { friction: 1 }), { kind: 'ground' });
      if (mode === 'tarn') terrain = { goalY: gt - LEVELS.tarn[level].height * u };
    }
  }

  function resetBall() {
    if (ball) Composite.remove(world, ball);
    ball = null;
    ballState = 'ready';
    if (mode !== 'bro') return;
    // Kula har en liten «motor» (se loop) og godt grep, så den triller jevnt og klatrer
    // over plankekanter. Mange sider gjør den rund nok til å rulle uten å hakke.
    ball = Bodies.circle(terrain.startX, terrain.startY, u * 0.7, { friction: 0.9, frictionStatic: 1, frictionAir: 0.002, restitution: 0.05, density: 0.004, sleepThreshold: Infinity }, 64);
    Body.setStatic(ball, true);
    ball.paizon = { color: '#e84393', kind: 'ball' };
    Composite.add(world, ball);
    $('#build-play').hidden = false;
  }

  function newWorld() {
    engine = Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
    engine.gravity.y = 1;
    world = engine.world;
    blocks = [];
    selected = null;
    statics = [];
    measure();
    buildTerrain();
    Events.on(engine, 'collisionStart', onCollision);
  }

  // ---------- Start / stopp ----------
  function start(newMode, newLevel) {
    mode = newMode || 'fri';
    level = newLevel || 0;
    solved = false;
    stillSince = 0;
    P.show('build');
    overlay.classList.add('hidden');
    $('#build-shake').hidden = mode !== 'fri';
    $('#build-play').hidden = mode !== 'bro';
    newWorld();
    resetBall();
    const goal = mode === 'tarn'
      ? 'Bygg et tårn opp til streken!'
      : mode === 'bro'
        ? 'Bygg en bro, og trykk ▶ så kula ruller over!'
        : 'Bygg det du vil!';
    goalEl.textContent = (mode === 'fri' ? '' : `Nivå ${level + 1}: `) + goal;
    if (mode !== 'fri') setTimeout(() => Speech.speak(goal.replace('▶', 'start')), 300);
    if (!running) {
      running = true;
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    endDrag();
  }

  // ---------- Hovedløkke ----------
  let last = 0;
  let lastKnock = 0;
  function loop(t) {
    if (!running) return;
    const dt = last ? Math.min(34, t - last) : 16.7;
    last = t;
    if (shakeUntil > t) shakeGround(t);
    // Faste, små steg gir stødige tårn.
    const steps = dt > 20 ? 2 : 1;
    for (let i = 0; i < steps; i++) Engine.update(engine, 1000 / 60);
    if (ball && ballState === 'rolling') {
      // Motoren: hold kula rullende mot høyre med jevn fart.
      Body.setAngularVelocity(ball, BALL_SPIN);
    }
    if (drag) {
      // Rolig mens man holder: hindrer at klossen spinner rundt fingeren.
      Body.setAngularVelocity(drag.body, drag.body.angularVelocity * 0.8);
    }
    // Sikkerhetsnett: ingen kloss skal kunne skytes ut av verden.
    const vmax = u * 0.6;
    for (const b of blocks) {
      if (b.speed > vmax) Body.setVelocity(b, { x: (b.velocity.x / b.speed) * vmax, y: (b.velocity.y / b.speed) * vmax });
    }
    const lost = blocks.filter((b) => b.position.y > H + u * 4 || b.position.y < -H);
    for (const b of lost) removeBlock(b);
    checkGoal(t);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function onCollision(e) {
    const now = performance.now();
    if (now - lastKnock < 70) return;
    for (const pair of e.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const speed = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (speed > 3) {
        Sound.knock(Math.min(1, speed / 12));
        lastKnock = now;
        return;
      }
    }
  }

  // ---------- Jordskjelv ----------
  let shakeStart = 0;
  function shakeGround(t) {
    const ground = statics.find((s) => s.paizon && s.paizon.kind === 'ground');
    if (!ground) return;
    const k = (t - shakeStart) / 1000;
    const amp = u * 0.25 * Math.min(1, (shakeUntil - t) / 600);
    const x = W / 2 + Math.sin(k * 28) * amp;
    Body.setVelocity(ground, { x: x - ground.position.x, y: 0 });
    Body.setPosition(ground, { x, y: ground.position.y });
    if (shakeUntil - t < 20) {
      Body.setPosition(ground, { x: W / 2, y: ground.position.y });
      Body.setVelocity(ground, { x: 0, y: 0 });
    }
  }
  $('#build-shake').addEventListener('click', () => {
    Sound.unlock();
    shakeStart = performance.now();
    shakeUntil = shakeStart + 2200;
    for (const b of blocks) Sleeping.set(b, false);
    Sound.rumble();
  });

  // ---------- Mål ----------
  function checkGoal(t) {
    if (solved) return;
    if (mode === 'tarn') {
      const above = blocks.some((b) => b.bounds.min.y < terrain.goalY && (!drag || drag.body !== b));
      const calm = blocks.every((b) => b.speed < 0.25 && Math.abs(b.angularSpeed) < 0.02);
      if (above && calm && !drag) {
        if (!stillSince) {
          stillSince = t;
          goalEl.textContent = 'Hold det stødig …';
        }
        if (t - stillSince > 2000) succeed('Tårnet står! 🗼');
      } else if (stillSince) {
        stillSince = 0;
        goalEl.textContent = `Nivå ${level + 1}: Bygg et tårn opp til streken!`;
      }
    } else if (mode === 'bro' && ball && ballState === 'rolling') {
      if (ball.position.x > terrain.flagX - u * 0.3 && ball.position.y < terrain.cliffTop + u * 0.2) {
        succeed('Kula kom over! 🌉');
      } else if (ball.position.y > terrain.cliffTop + u * 1.5 || stuck(t)) {
        ballState = 'failed';
        goalEl.textContent = 'Å nei! Bygg litt mer, og prøv igjen.';
        Sound.wrong();
        setTimeout(() => { if (!solved && running) resetBall(); }, 1200);
      }
    }
  }

  /** Kula har nesten ikke flyttet seg på 2 sekunder (f.eks. fast mot en kant). */
  function stuck(t) {
    const p = ball.paizon;
    if (!p.checkAt || t - p.checkAt > 2000) {
      const moved = p.checkX == null ? Infinity : Math.abs(ball.position.x - p.checkX);
      p.checkAt = t;
      p.checkX = ball.position.x;
      return moved < u * 0.3 && t - p.started > 2500;
    }
    return false;
  }

  function succeed(text) {
    solved = true;
    Sound.win();
    window.PaizonConfetti.burst(140);
    const praise = P.pick(P.PRAISE);
    Speech.speak(`${praise} ${text.replace(/[^\p{L}\p{N} !.,]/gu, '')}`);
    $('#build-done-title').textContent = praise;
    $('#build-done-text').textContent = text;
    const last = level >= LEVELS[mode].length - 1;
    $('#build-next').textContent = last ? 'Ferdig 🎉' : 'Neste nivå ➜';
    setTimeout(() => overlay.classList.remove('hidden'), 900);
  }

  $('#build-next').addEventListener('click', () => {
    Sound.tap();
    if (level >= LEVELS[mode].length - 1) {
      stop();
      P.showDone({
        icon: mode === 'tarn' ? '🗼' : '🌉',
        summary: mode === 'tarn' ? 'Du bygde alle tårnene!' : 'Du bygde alle broene!',
        again: () => start(mode, 0),
        setup: 'build-setup',
      });
    } else {
      start(mode, level + 1);
    }
  });
  $('#build-stay').addEventListener('click', () => {
    overlay.classList.add('hidden');
    Sound.tap();
  });

  $('#build-play').addEventListener('click', () => {
    if (!ball || ballState !== 'ready') return;
    Sound.unlock();
    Sound.tap();
    Body.setStatic(ball, false);
    Sleeping.set(ball, false);
    Body.setVelocity(ball, { x: u * 0.04, y: 0 });
    ball.paizon.started = performance.now();
    ballState = 'rolling';
    $('#build-play').hidden = true;
  });

  $('#build-reset').addEventListener('click', () => {
    Sound.tap();
    for (const b of blocks) Composite.remove(world, b);
    blocks = [];
    selected = null;
    solved = false;
    stillSince = 0;
    overlay.classList.add('hidden');
    resetBall();
  });

  // ---------- Verktøykasse: dra nye klosser inn ----------
  const palette = $('#build-palette');
  BLOCKS.forEach((def) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palette-item';
    b.setAttribute('aria-label', `Dra inn ${def.label.toLowerCase()}`);
    b.title = def.label;
    b.innerHTML = paletteIcon(def);
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      Sound.unlock();
      const p = toWorld(e);
      const body = makeBlock(def, Math.min(Math.max(p.x, u), W - u), Math.min(p.y, groundTop() - u));
      blocks.push(body);
      Composite.add(world, body);
      select(body);
      Sound.tap();
      beginDrag(body, e, true);
    });
    palette.appendChild(b);
  });

  function paletteIcon(def) {
    const fill = def.color;
    if (def.circle) return `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="14" fill="${fill}"/></svg>`;
    if (def.sides) return `<svg viewBox="0 0 40 40"><polygon points="20,6 35,32 5,32" fill="${fill}" stroke-linejoin="round"/></svg>`;
    const s = 30 / Math.max(def.w, def.h);
    const w = def.w * s;
    const h = def.h * s;
    return `<svg viewBox="0 0 40 40"><rect x="${20 - w / 2}" y="${20 - h / 2}" width="${w}" height="${h}" rx="3" fill="${fill}"/></svg>`;
  }

  // ---------- Dra og slipp i verden ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Er punktet inne i bakken eller en klippe? */
  function insideTerrain(p) {
    return Query.point(statics.filter((b) => !b.paizon.hidden), p).length > 0;
  }

  function beginDrag(body, e, fromPalette) {
    endDrag();
    let p = toWorld(e);
    if (fromPalette) {
      // Ny kloss holdes i midten, og starter alltid over bakken.
      const half = body.bounds.max.y - body.position.y;
      p = { x: Math.min(Math.max(p.x, u), W - u), y: Math.min(p.y, groundTop() - half - 4) };
      if (insideTerrain(p)) p.y = Math.min(p.y, (terrain && terrain.cliffTop ? terrain.cliffTop : groundTop()) - half - 4);
      Body.setPosition(body, p);
      Body.setVelocity(body, { x: 0, y: 0 });
    }
    Sleeping.set(body, false);
    // pointB er forskyvningen fra klossens sentrum i verdensretning; Matter roterer den selv.
    const constraint = Constraint.create({
      pointA: { x: p.x, y: p.y },
      bodyB: body,
      pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
      length: 0,
      stiffness: 0.25,
      damping: 0.1,
    });
    Composite.add(world, constraint);
    body.frictionAir = 0.15;
    // Hvor langt under grepet klossen rekker – så vi ikke drar den ned i bakken.
    drag = { body, constraint, pointerId: e.pointerId, below: Math.max(0, body.bounds.max.y - p.y) };
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  }

  function onDragMove(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = toWorld(e);
    const next = {
      x: Math.min(Math.max(p.x, 0), W),
      y: Math.min(p.y, groundTop() - drag.below - 2),
    };
    // Ikke dra klossen inn i en klippe – da skyter fysikkmotoren den ut igjen.
    if (!insideTerrain({ x: next.x, y: next.y + drag.below })) drag.constraint.pointA = next;
    Sleeping.set(drag.body, false);
    $('#build-trash').classList.toggle('over', overTrash(e));
  }

  function overTrash(e) {
    const r = $('#build-trash').getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function onDragEnd(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const body = drag.body;
    const trash = overTrash(e);
    endDrag();
    $('#build-trash').classList.remove('over');
    if (trash) removeBlock(body);
  }

  function endDrag() {
    if (!drag) return;
    Composite.remove(world, drag.constraint);
    const b = drag.body;
    b.frictionAir = 0.01;
    // Et lite kast er gøy, men klossen skal ikke fly ut av skjermen.
    const max = u * 0.25;
    if (b.speed > max) Body.setVelocity(b, { x: (b.velocity.x / b.speed) * max, y: (b.velocity.y / b.speed) * max });
    Body.setAngularVelocity(b, b.angularVelocity * 0.3);
    drag = null;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
  }

  function removeBlock(body) {
    Composite.remove(world, body);
    blocks = blocks.filter((b) => b !== body);
    if (selected === body) select(null);
    Sound.flip();
  }

  function select(body) {
    selected = body;
    $$('.build-rotate').forEach((b) => { b.disabled = !body; });
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = toWorld(e);
    const hit = Query.point(blocks, p)[0];
    if (hit) {
      select(hit);
      beginDrag(hit, e, false);
    } else {
      select(null);
    }
  });

  // Roter valgt kloss.
  $$('.build-rotate').forEach((b) => b.addEventListener('click', () => {
    if (!selected) return;
    Sound.tap();
    Sleeping.set(selected, false);
    Body.rotate(selected, (Number(b.dataset.deg) * Math.PI) / 180);
  }));
  $('#build-trash').addEventListener('click', () => {
    if (selected) removeBlock(selected);
  });

  // ---------- Tegning ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#bfe6ff');
    sky.addColorStop(1, '#eef9ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    if (mode === 'tarn' && terrain) {
      ctx.save();
      ctx.setLineDash([u * 0.3, u * 0.2]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = stillSince ? '#10ac84' : '#e17055';
      ctx.beginPath();
      ctx.moveTo(0, terrain.goalY);
      ctx.lineTo(W, terrain.goalY);
      ctx.stroke();
      ctx.restore();
      ctx.font = `${Math.round(u * 0.7)}px system-ui, sans-serif`;
      ctx.fillText('⭐', W - u * 1.1, terrain.goalY - u * 0.2);
    }

    for (const s of statics) {
      if (s.paizon && s.paizon.hidden) continue;
      fillBody(s, s.paizon.kind === 'ground' ? '#7bc96f' : '#a9805b', s.paizon.kind === 'ground' ? '#5aa64d' : '#7d5a3c');
    }
    if (mode === 'bro' && terrain) {
      // Flagg på målsiden.
      const fx = terrain.flagX;
      const fy = terrain.cliffTop;
      ctx.strokeStyle = '#2d3047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy - u * 1.8);
      ctx.stroke();
      ctx.fillStyle = '#e84393';
      ctx.beginPath();
      ctx.moveTo(fx, fy - u * 1.8);
      ctx.lineTo(fx + u * 0.9, fy - u * 1.5);
      ctx.lineTo(fx, fy - u * 1.2);
      ctx.fill();
    }

    for (const b of blocks) {
      fillBody(b, b.paizon.color, shade(b.paizon.color, -0.25));
      if (b === selected) outlineBody(b);
    }
    if (ball) {
      fillBody(ball, ball.paizon.color, shade(ball.paizon.color, -0.25));
      // Et lite fjes på kula.
      ctx.save();
      ctx.translate(ball.position.x, ball.position.y);
      ctx.rotate(ball.angle);
      ctx.fillStyle = '#2d3047';
      const r = ball.circleRadius;
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.arc(r * 0.3, -r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = r * 0.1;
      ctx.strokeStyle = '#2d3047';
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.4, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  function tracePath(body) {
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
  }

  function fillBody(body, fill, stroke) {
    tracePath(body);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }

  function outlineBody(body) {
    ctx.save();
    tracePath(body);
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2d3047';
    ctx.stroke();
    ctx.restore();
  }

  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + c * amount)));
    return `rgb(${f(n >> 16)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
  }

  // Skjermen endret størrelse (f.eks. snudd telefon): tilpass bakken, behold klossene.
  window.addEventListener('resize', () => {
    if (!running) return;
    measure();
    buildTerrain();
    if (mode === 'bro' && ballState !== 'rolling') resetBall();
  });

  // ---------- Oppsett-skjermen ----------
  $$('[data-build]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.build, 0);
  }));

  P.registerGame('build', {
    screen: 'build',
    setupScreen: 'build-setup',
    start: () => start('fri', 0),
    stop,
  });

  // For tester og feilsøking.
  window.PaizonBuild = {
    get blocks() { return blocks; },
    get terrain() { return terrain; },
    get ball() { return ball; },
    get u() { return u; },
    start,
    addBlock(key, x, y) {
      const body = makeBlock(BLOCKS.find((d) => d.key === key), x, y);
      blocks.push(body);
      Composite.add(world, body);
      return body;
    },
  };
})();
