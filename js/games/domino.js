/* Domino: sett opp brikker, dytt den første og se dem velte – helt fram til bjella. */
(function () {
  'use strict';

  const P = window.Paizon;
  const K = window.PaizonPhysics;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const M = window.Matter;
  const { $, $$ } = P;
  if (!M || !K) return;
  const { Bodies, Body, Composite, Constraint, Query, Events, Sleeping } = M;

  // Brikkene er 1 × 0,15 enheter, med halv høyde mellom seg. Hjørnene er nesten skarpe:
  // med runde hjørner blir bunnen på en så tynn brikke nesten rund, og den velter av seg selv.
  const DOMINO = { w: 0.15, h: 1, spacing: 0.5 };
  // Litt sterkere tyngdekraft enn i de andre spillene, så kjeden går i et fornøyelig tempo.
  const GRAVITY = 2.2;
  const COLORS = ['#ff7675', '#fdcb6e', '#55efc4', '#74b9ff', '#a29bfe', '#fd79a8'];

  // Utfordringer: bjella står til høyre og skal ringes.
  const LEVELS = [
    { name: 'Ring bjella', terrain: 'flat' },
    { name: 'Ned trappa', terrain: 'trapp' },
    { name: 'Over hullet', terrain: 'hull' },
  ];

  const scene = K.createScene({ canvas: $('#domino-canvas'), wrap: $('#domino-world'), unitsW: 10, unitsH: 6.5, minU: 30, maxU: 90 });
  const ctx = scene.ctx;

  let mode = 'fri';
  let level = 0;
  let tool = 'domino';
  let terrain = [];
  let planks = []; // planker barnet har lagt ut (faste)
  let pieces = []; // dominobrikker og baller (bevegelige)
  let bell = null;
  let rung = false;
  let selected = null;
  let drag = null;
  let placing = null; // { lastX }
  let colorIndex = 0;

  const groundTop = () => scene.H - scene.u * 0.45;

  // ---------- Verden ----------
  function addStatic(body, look) {
    Body.setStatic(body, true);
    body.paizon = Object.assign({ kind: 'terrain' }, look);
    Composite.add(scene.world, body);
    terrain.push(body);
    return body;
  }

  function buildTerrain() {
    const { W, H, u } = scene;
    const gt = groundTop();
    const thick = 400;
    terrain = [];
    // Usynlige vegger, så ingenting forsvinner ut av skjermen.
    addStatic(Bodies.rectangle(-thick / 2, H / 2, thick, H * 4), { hidden: true });
    addStatic(Bodies.rectangle(W + thick / 2, H / 2, thick, H * 4), { hidden: true });
    const kind = mode === 'fri' ? 'flat' : LEVELS[level].terrain;
    const block = (x0, x1, top) => addStatic(Bodies.rectangle((x0 + x1) / 2, (top + gt + thick) / 2, x1 - x0, gt + thick - top, { friction: 0.8 }), { color: '#7bc96f' });
    if (kind === 'trapp') {
      // Hylle til venstre, lavere bakke til høyre: siste brikke på hylla må velte ned på de nederste.
      block(-10, W * 0.48, gt - u * 0.8);
      block(W * 0.48, W + 10, gt);
    } else if (kind === 'hull') {
      // Et hull i bakken som må dekkes med en planke.
      const g0 = W * 0.4;
      const g1 = W * 0.4 + u * 2.4;
      block(-10, g0, gt - u * 1.2);
      block(g1, W + 10, gt - u * 1.2);
      addStatic(Bodies.rectangle(W / 2, gt + thick / 2, W * 2, thick), { color: '#5aa64d' });
    } else {
      block(-10, W + 10, gt);
    }
    bell = null;
    rung = false;
    if (mode !== 'fri') {
      // Bjella står på bakken helt til høyre.
      const surf = scene.surfaceBelow(W - u * 0.9, 0, terrain.filter((b) => !b.paizon.hidden));
      const by = (surf ? surf.y : gt) - u * 0.75;
      bell = Bodies.circle(W - u * 0.9, by, u * 0.45, { isStatic: true, isSensor: true });
      bell.paizon = { kind: 'bell' };
      Composite.add(scene.world, bell);
    }
  }

  function start(newMode, newLevel) {
    mode = newMode || 'fri';
    level = newLevel || 0;
    P.show('domino');
    K.hideLevelDone();
    scene.measure();
    scene.newEngine();
    planks = [];
    pieces = [];
    selected = null;
    buildTerrain();
    scene.engine.gravity.scale *= GRAVITY;
    Events.on(scene.engine, 'collisionStart', onCollision);
    Events.on(scene.engine, 'collisionActive', onCollision);
    setTool('domino');
    const goal = mode === 'fri'
      ? 'Sett opp brikker og trykk 👉 for å dytte!'
      : `Nivå ${level + 1}: ${LEVELS[level].name} – sett opp brikker helt bort til bjella 🔔`;
    $('#domino-goal').textContent = goal;
    if (mode !== 'fri') setTimeout(() => Speech.speak(`${LEVELS[level].name}! Sett opp brikker helt bort til bjella.`), 300);
    scene.run(frame);
  }

  function stop() {
    scene.stop();
    endDrag();
    K.hideLevelDone();
  }

  function onCollision(e) {
    if (!bell || rung) return;
    for (const pair of e.pairs) {
      if (pair.bodyA === bell || pair.bodyB === bell) {
        // Bare noe som faktisk beveger seg ringer bjella – ikke en brikke som bare står inntil den.
        const other = pair.bodyA === bell ? pair.bodyB : pair.bodyA;
        if (other.speed < 0.3 && Math.abs(other.angularVelocity) < 0.01) continue;
        rung = true;
        Sound.bell();
        const last = level >= LEVELS.length - 1;
        K.levelDone({
          title: 'Ding dong! 🔔',
          text: P.pick(P.PRAISE),
          last,
          next: () => {
            if (last) {
              stop();
              P.showDone({ icon: '🔔', summary: 'Du ringte bjella på alle nivåene!', again: () => start('utfordring', 0), setup: 'domino-setup' });
            } else start('utfordring', level + 1);
          },
        });
        return;
      }
    }
  }

  // ---------- Brikker, planker og baller ----------
  function surfaces() {
    return [...terrain.filter((b) => !b.paizon.hidden), ...planks];
  }

  function placeDomino(x, y) {
    const { u } = scene;
    const surf = scene.surfaceBelow(x, y, surfaces());
    if (!surf) return null;
    // Ikke oppå bjella.
    if (bell && Math.abs(x - bell.position.x) < u * 0.6) return null;
    // Ikke for tett på en annen brikke.
    for (const d of pieces) {
      if (d.paizon.kind === 'domino' && Math.abs(d.position.x - x) < u * DOMINO.spacing * 0.75 && Math.abs(d.position.y - (surf.y - u * DOMINO.h / 2)) < u * 0.6) return null;
    }
    // Brikkene får aldri «sove»: et sakte lent dytt fra naboen er ikke nok til å vekke en
    // sovende brikke i Matter.js, og da stopper kjeden. Lav friksjon hindrer at brikkene låser
    // seg fast i hverandre mens de lener seg.
    const body = Bodies.rectangle(x, surf.y - (u * DOMINO.h) / 2, u * DOMINO.w, u * DOMINO.h, {
      friction: 0.1, frictionStatic: 0.2, restitution: 0, density: 0.0015, chamfer: { radius: u * 0.01 },
      sleepThreshold: Infinity,
    });
    body.paizon = { kind: 'domino', color: COLORS[colorIndex++ % COLORS.length] };
    savePose(body);
    Composite.add(scene.world, body);
    pieces.push(body);
    Sound.tap();
    return body;
  }

  function addBall(x, y) {
    const body = Bodies.circle(x, y, scene.u * 0.3, { friction: 0.05, restitution: 0.2, density: 0.003, sleepThreshold: Infinity }, 40);
    body.paizon = { kind: 'ball', color: '#e84393' };
    savePose(body);
    Composite.add(scene.world, body);
    pieces.push(body);
    Sound.tap();
    return body;
  }

  function addPlank(x, y) {
    const { u } = scene;
    // Tynn planke: en tykk kant stopper brikken som velter mot den.
    const body = Bodies.rectangle(x, y, u * 3, u * 0.12, { isStatic: true, friction: 0.8, chamfer: { radius: u * 0.05 } });
    body.paizon = { kind: 'plank', color: '#e1a14b', half: u * 1.5 };
    Composite.add(scene.world, body);
    planks.push(body);
    select(body);
    Sound.tap();
    return body;
  }

  function savePose(body) {
    body.paizon.start = { x: body.position.x, y: body.position.y, angle: body.angle };
  }

  /** Sett alle brikker og baller tilbake der de ble satt opp. */
  function resetPoses() {
    for (const d of pieces) {
      const p = d.paizon.start;
      Body.setPosition(d, { x: p.x, y: p.y });
      Body.setAngle(d, p.angle);
      Body.setVelocity(d, { x: 0, y: 0 });
      Body.setAngularVelocity(d, 0);
    }
  }

  function push(body) {
    Sleeping.set(body, false);
    // En liten dytt øverst mot høyre.
    Body.setAngularVelocity(body, 0.06);
    Body.setVelocity(body, { x: scene.u * 0.02, y: 0 });
    Sound.flip();
  }

  function remove(body) {
    Composite.remove(scene.world, body);
    pieces = pieces.filter((b) => b !== body);
    planks = planks.filter((b) => b !== body);
    if (selected === body) select(null);
    Sound.flip();
  }

  function select(body) {
    selected = body;
  }

  // ---------- Verktøy ----------
  function setTool(t) {
    tool = t;
    $$('#domino-tools [data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === t);
      b.setAttribute('aria-pressed', String(b.dataset.tool === t));
    });
  }

  $('#domino-tools').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    Sound.unlock();
    if (b.dataset.tool) {
      setTool(b.dataset.tool);
      Sound.tap();
    } else if (b.id === 'domino-push') {
      // Dytt den brikken som står lengst til venstre (og fortsatt står).
      const standing = pieces.filter((d) => d.paizon.kind === 'domino' && Math.abs(d.angle) < 0.3);
      if (!standing.length) return P.toast('Sett opp noen brikker først');
      standing.sort((a, c) => a.position.x - c.position.x);
      push(standing[0]);
    } else if (b.id === 'domino-reset') {
      resetPoses();
      rung = false;
      Sound.tap();
    } else if (b.id === 'domino-clear') {
      for (const d of [...pieces, ...planks]) Composite.remove(scene.world, d);
      pieces = [];
      planks = [];
      select(null);
      rung = false;
      Sound.flip();
    }
  });

  // ---------- Finger ----------
  const canvas = scene.canvas;

  /** Brikkene er tynne – sjekk også litt til sidene for fingeren. */
  function pieceAt(p) {
    const r = scene.u * 0.2;
    for (const dx of [0, -r, r]) {
      const hit = Query.point(pieces, { x: p.x + dx, y: p.y })[0];
      if (hit) return hit;
    }
    return null;
  }
  function plankAt(p) {
    return Query.point(planks, p)[0] || null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    const p = scene.toWorld(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }

    // Vri-håndtaket på en valgt planke virker uansett verktøy.
    if (selected && scene.onHandle(selected, p)) {
      drag = { kind: 'rotate', body: selected, id: e.pointerId };
      return;
    }
    if (tool === 'fjern') {
      const hit = pieceAt(p) || plankAt(p);
      if (hit) remove(hit);
      return;
    }
    const plank = plankAt(p);
    if (plank && (tool === 'planke' || tool === 'flytt' || tool === 'domino')) {
      // Trykk på en planke med dominoverktøyet setter en brikke oppå den – unntatt når
      // man treffer selve planken med planke- eller flytteverktøyet.
      if (tool !== 'domino') {
        select(plank);
        drag = { kind: 'static', body: plank, dx: p.x - plank.position.x, dy: p.y - plank.position.y, id: e.pointerId };
        return;
      }
    }
    const piece = pieceAt(p);
    if (tool === 'flytt' && piece) {
      beginDynamicDrag(piece, p, e.pointerId);
      return;
    }
    if (tool === 'domino') {
      if (piece && piece.paizon.kind === 'domino') {
        push(piece);
        return;
      }
      select(null);
      const d = placeDomino(p.x, p.y);
      placing = { lastX: d ? d.position.x : p.x, id: e.pointerId };
    } else if (tool === 'planke') {
      addPlank(p.x, p.y);
    } else if (tool === 'ball') {
      addBall(p.x, p.y);
    } else {
      select(null);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = scene.toWorld(e);
    if (placing && e.pointerId === placing.id) {
      // Dra for å sette opp en hel rad med jevn avstand.
      const step = scene.u * DOMINO.spacing;
      while (Math.abs(p.x - placing.lastX) >= step) {
        const x = placing.lastX + Math.sign(p.x - placing.lastX) * step;
        placeDomino(x, p.y);
        placing.lastX = x;
      }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.kind === 'rotate') {
      Body.setAngle(drag.body, Math.atan2(p.y - drag.body.position.y, p.x - drag.body.position.x));
    } else if (drag.kind === 'static') {
      Body.setPosition(drag.body, { x: p.x - drag.dx, y: Math.min(p.y - drag.dy, groundTop() - scene.u * 0.2) });
      for (const d of pieces) Sleeping.set(d, false);
    } else if (drag.kind === 'dynamic') {
      drag.constraint.pointA = { x: p.x, y: Math.min(p.y, groundTop() - scene.u * 0.1) };
    }
  });

  const release = (e) => {
    if (placing && e.pointerId === placing.id) placing = null;
    if (drag && e.pointerId === drag.id) endDrag();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  function beginDynamicDrag(body, p, id) {
    Sleeping.set(body, false);
    const constraint = Constraint.create({
      pointA: { x: p.x, y: p.y },
      bodyB: body,
      pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
      length: 0,
      stiffness: 0.2,
      damping: 0.1,
    });
    Composite.add(scene.world, constraint);
    body.frictionAir = 0.15;
    drag = { kind: 'dynamic', body, constraint, id };
  }

  function endDrag() {
    if (!drag) return;
    if (drag.kind === 'dynamic') {
      Composite.remove(scene.world, drag.constraint);
      drag.body.frictionAir = 0.01;
      savePose(drag.body); // ny startplass når man flytter en brikke
    }
    drag = null;
  }

  // ---------- Tegning ----------
  function frame() {
    const { W, H, u } = scene;
    // Sikkerhetsnett: ting som faller ut av verden fjernes.
    for (const d of pieces.filter((b) => b.position.y > H + u * 3)) remove(d);
    scene.drawSky('#ffe9c7', '#fff8ee');
    for (const b of terrain) if (!b.paizon.hidden) scene.fillBody(b, b.paizon.color || '#7bc96f', '#5aa64d');
    for (const b of planks) {
      scene.fillBody(b, b.paizon.color);
      if (b === selected) scene.outline(b);
    }
    if (bell) drawBell();
    for (const b of pieces) scene.fillBody(b, b.paizon.color);
    if (selected) scene.drawHandle(selected);
  }

  function drawBell() {
    const { u } = scene;
    const { x, y } = bell.position;
    ctx.save();
    ctx.strokeStyle = '#636e72';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, y + u * 0.3);
    ctx.lineTo(x, y + u * 0.75);
    ctx.stroke();
    ctx.font = `${Math.round(u * 0.9)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const wobble = rung ? Math.sin(performance.now() / 60) * 0.3 : 0;
    ctx.translate(x, y);
    ctx.rotate(wobble);
    ctx.fillText('🔔', 0, 0);
    ctx.restore();
  }

  window.addEventListener('resize', () => {
    if (!scene.running) return;
    // Start nivået på nytt bare ved stor endring (f.eks. snudd telefon) – ikke når
    // adresselinjen i nettleseren glir inn og ut.
    const r = $('#domino-world').getBoundingClientRect();
    if (Math.abs(r.width - scene.W) / scene.W > 0.15 || Math.abs(r.height - scene.H) / scene.H > 0.15) start(mode, level);
  });

  // ---------- Oppsett ----------
  $$('[data-domino]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.domino, 0);
  }));

  P.registerGame('domino', { screen: 'domino', setupScreen: 'domino-setup', start: () => start('fri', 0), stop });

  // For tester og feilsøking.
  window.PaizonDomino = {
    start,
    placeDomino,
    addPlank,
    push,
    get pieces() { return pieces; },
    get scene() { return scene; },
    get rung() { return rung; },
  };
})();
