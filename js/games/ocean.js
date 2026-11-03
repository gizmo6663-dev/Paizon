/*
 * Havet: dykk med en liten ubåt fra overflaten ned til dyphavet i Norskehavet.
 * Tre moduser: Lær (faktakort leses opp, oppdrag), Oppdag (fotobok, hemmeligheter) og
 * Rolig (ingen tekst, myk lyd, autopilot og sovetimer).
 */
(function () {
  'use strict';

  const P = window.Paizon;
  const D = window.PaizonOceanData;
  const A = window.PaizonOceanArt;
  const AU = window.PaizonOceanAudio;
  const IN = window.PaizonOceanInside;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $, $$ } = P;
  if (!D || !A || !AU) return;

  const settings = P.settings('ocean', { sleep: 0, music: 1 });

  const canvas = $('#ocean-canvas');
  let ctx = canvas.getContext('2d'); // byttes midlertidig til dyrelaget i drawWorldObjects
  const wrap = $('#ocean-world');
  const dark = document.createElement('canvas'); // mørket i dypet, med lykt-kjegla skåret ut
  const dctx = dark.getContext('2d');
  // Dyrene tegnes først i et eget lag, så de kan få lys på ryggen og skygge under (se shadeCreatures).
  const fx = document.createElement('canvas');
  const fxc = fx.getContext('2d');
  const edge = document.createElement('canvas');
  const ec = edge.getContext('2d');
  const mini = $('#ocean-mini');
  const mctx = mini.getContext('2d');

  let mode = 'lar';
  let running = false;
  let raf = 0;
  let W = 0; // lerretets bredde (CSS-piksler)
  let H = 0;
  let S = 600; // piksler per vh
  // Hvor mange vh kameraet viser i høyden. Større tall = mer oversikt (knip for å zoome).
  const VIEW_MIN = 1.1;
  const VIEW_MAX = 3.4;
  let view = 1.5;
  const SUB_LEN = 0.075; // ubåtens lengde i vh
  let dpr = 1;
  let time = 0;
  let last = 0;
  const cam = { x: 0, y: 0 };
  const sub = { x: 0.9, y: 0.12, vx: 0, vy: 0, dir: 1, tx: null, ty: null };
  let animals = [];
  let kelpList = [];
  let rocks = [];
  let details = [];
  let bokeh = [];
  let farLife = [];
  let snow = [];
  let bubbles = [];
  let sparks = [];
  let pointer = null;
  let lastInput = 0;
  let zoneKey = '';
  let zoneSince = 0;
  let missionIndex = 0;
  let missionDone = false;
  let found = new Set();
  let cardOpen = null;
  let sleepEndsAt = 0;
  let sleeping = false;
  let nextWhale = 0;
  let lastBubble = 0;
  // Kvaliteten tilpasser seg: går bildeflyten tregt, tegnes det med færre piksler, og til slutt
  // uten lyskantene på dyrene. Slik blir det jevnt også på eldre nettbrett.
  const quality = { maxDpr: 2, shade: true, slow: 0, ema: 16 };
  let visited = new Set(); // steder man har vært inne i
  let inside = null; // stedet man er inne i nå
  let pinch = null;
  const pointers = new Map();

  const album = new Set(P.store.get('ocean.album', []));

  // ---------- Hjelpere ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rnd = A.seeded(42);
  const range = ([a, b]) => a + rnd() * (b - a);

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function mix(c1, c2, t) {
    return c1.map((v, i) => Math.round(lerp(v, c2[i], t)));
  }
  const rgb = (c, a) => (a == null ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

  // Vannfarge etter dybde: grønnblått ved overflaten (som i Norskehavet), svart i dypet.
  const WATER = [[0, '#2f8f9b'], [15, '#24808f'], [50, '#176178'], [150, '#0d3b57'], [400, '#072034'], [1000, '#03111e'], [3000, '#010810']].map(([d, c]) => [d, hex(c)]);
  function waterColor(depth) {
    for (let i = 1; i < WATER.length; i++) {
      if (depth <= WATER[i][0]) {
        const [d0, c0] = WATER[i - 1];
        const [d1, c1] = WATER[i];
        return mix(c0, c1, (depth - d0) / (d1 - d0));
      }
    }
    return WATER[WATER.length - 1][1];
  }

  /** Hvor mørkt det er (0 = fullt dagslys, nær 1 = svart). Litt lys beholdes så barna ser omrisset. */
  function darkness(depth) {
    const l = D.lightAt(depth);
    return clamp(1 - (0.1 + 0.9 * Math.sqrt(l)), 0, mode === 'rolig' ? 0.82 : 0.88);
  }

  const sx = (x) => (x - cam.x) * S;
  const sy = (y) => (y - cam.y) * S;

  // ---------- Verden ----------
  function buildWorld() {
    animals = [];
    for (const sp of D.SPECIES) {
      if (sp.secret && mode !== 'oppdag') continue;
      if (sp.place.type === 'inside') continue;
      for (let i = 0; i < sp.count; i++) animals.push(makeAnimal(sp, i));
    }
    // Tare langs kysten der det er 5–35 meter dypt.
    kelpList = [];
    for (let x = 0.5; x < 6.2; x += 0.035 + rnd() * 0.035) {
      const d = D.depthAt(D.seabedAt(x));
      // Taren blir aldri høyere enn vannet er dypt (den skal ikke stikke opp i lufta).
      const maxH = (D.seabedAt(x) - 0.04) * 0.85;
      const nearPlace = D.PLACES.some((pl) => pl.kind !== 'ship' && Math.abs(pl.x - x) < pl.size * 0.45);
      if (d > 4 && d < 36 && maxH > 0.06 && !nearPlace) {
        const sugar = rnd() < 0.3;
        kelpList.push({ x, h: Math.min(maxH, sugar ? 0.12 + rnd() * 0.2 : 0.2 + rnd() * 0.35), phase: rnd() * 6, shade: rnd(), kind: sugar ? 'sukker' : 'tare', color: sugar ? (rnd() < 0.5 ? '#8a7a2c' : '#7d6a26') : ['#6b5a22', '#5e5520', '#76642a'][Math.floor(rnd() * 3)] });
      }
    }
    // Steiner langs bunnen.
    rocks = [];
    for (let x = 0.1; x < D.WORLD.width; x += 0.06 + rnd() * 0.2) {
      rocks.push({ x, r: 0.015 + rnd() * 0.05, flat: 0.45 + rnd() * 0.3, tone: rnd() });
    }
    snow = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.9, r: 0.5 + rnd() * 1.3 }));
    // Småtang, skjell og småstein langs bunnen.
    details = [];
    for (let x = 0.3; x < D.WORLD.width; x += 0.02 + rnd() * 0.06) {
      const d = D.depthAt(D.seabedAt(x));
      const r = rnd();
      if (d < 60 && r < 0.35) details.push({ x, kind: 'weed', s: 0.015 + rnd() * 0.025, phase: rnd() * 6, color: rnd() < 0.5 ? 'rgba(90,110,40,0.85)' : 'rgba(120,60,50,0.8)' });
      else if (d < 400 && r < 0.5) details.push({ x, kind: 'shell', s: 0.004 + rnd() * 0.005 });
      else details.push({ x, kind: 'stone', s: 0.004 + rnd() * 0.008, tone: ['#7a756a', '#5d5a52', '#8a8070'][Math.floor(rnd() * 3)] });
    }
    // Store, uskarpe partikler helt foran (gir dybde: de er nærmere enn ubåten).
    bokeh = Array.from({ length: 14 }, () => ({ x: rnd(), y: rnd(), r: 8 + rnd() * 26, a: 0.03 + rnd() * 0.05, ph: rnd() * 6 }));
    // Dyr langt borte i tåka bak (bare pynt – de kan ikke trykkes på).
    farLife = [];
    for (const sp of D.SPECIES) {
      if (sp.place.type !== 'water' || sp.secret) continue;
      const n = sp.school ? 3 : sp.size > 0.2 ? 1 : 2;
      for (let i = 0; i < n; i++) {
        farLife.push({
          kind: sp.kind, x: range(sp.place.x), y: D.yAtDepth(range(sp.place.depth)), dir: rnd() < 0.5 ? -1 : 1,
          size: Math.max(0.02, sp.size * 0.45), speed: 0.02 + rnd() * 0.03, school: sp.school ? 8 : 0, ph: rnd() * 6,
        });
      }
    }
  }

  function makeAnimal(sp, i) {
    const p = sp.place;
    const a = { sp, phase: rnd() * 10, scale: 0.85 + rnd() * 0.3, dir: rnd() < 0.5 ? -1 : 1, glowUntil: 0, flash: 0, swim: rnd() * 10, pitch: 0, vy: 0 };
    a.size = sp.size * a.scale;
    if (p.type === 'bottom') {
      a.x = range(p.x);
      a.y = D.seabedAt(a.x);
      a.homeX = p.x;
      a.speed = sp.kind === 'crab' ? 0.012 : sp.kind === 'lobster' ? 0.006 : 0;
      if (sp.kind === 'coral' || sp.kind === 'wreck' || sp.kind === 'bottle') a.dir = 1;
    } else if (p.type === 'sky') {
      a.x = range(p.x);
      a.y = -0.18 - rnd() * 0.18;
      a.homeX = p.x;
      a.speed = 0.08;
    } else {
      a.x = range(p.x);
      a.homeX = p.x;
      a.d0 = p.depth[0];
      a.d1 = p.depth[1];
      a.y = D.yAtDepth(range(p.depth));
      a.ty = a.y;
      a.speed = { humpback: 0.05, orca: 0.1, porpoise: 0.13, seal: 0.11, shark: 0.025, angler: 0.015, giantsquid: 0.03, chimaera: 0.04, lionsmane: 0.008, moonjelly: 0.008, combjelly: 0.01 }[sp.kind] || 0.07;
      a.speed *= 0.8 + rnd() * 0.4;
    }
    if (sp.school) {
      a.members = Array.from({ length: sp.school }, (_, k) => ({
        ox: (rnd() - 0.5) * sp.size * 7, oy: (rnd() - 0.5) * sp.size * 3.5, ph: rnd() * 6, s: 0.8 + rnd() * 0.35,
      }));
    }
    a.id = `${sp.key}-${i}`;
    return a;
  }

  const isJelly = (k) => k === 'lionsmane' || k === 'moonjelly' || k === 'combjelly';

  function updateAnimals(dt) {
    for (const a of animals) {
      const k = a.sp.kind;
      const y0 = a.y;
      animateBody(a, dt);
      if (a.sp.place.type === 'bottom') {
        if (a.speed) {
          a.x += a.dir * a.speed * dt;
          if (a.x < a.homeX[0] || a.x > a.homeX[1]) a.dir *= -1;
          a.y = D.seabedAt(a.x);
        }
        continue;
      }
      if (a.sp.place.type === 'sky') {
        a.x += a.dir * a.speed * dt;
        if (a.x < a.homeX[0] || a.x > a.homeX[1]) a.dir *= -1;
        a.y = -0.25 + Math.sin(time * 0.5 + a.phase) * 0.06;
        continue;
      }
      if (isJelly(k)) {
        // Maneter driver: pulserer sakte opp, synker sakte ned.
        a.x += Math.sin(time * 0.1 + a.phase) * a.speed * dt;
        a.y += (Math.sin(time * 0.35 + a.phase) * 0.012 - 0.002) * dt;
      } else {
        a.x += a.dir * a.speed * dt;
        if (a.x < a.homeX[0]) a.dir = 1;
        if (a.x > a.homeX[1]) a.dir = -1;
        // Velg av og til en ny dybde innenfor der arten hører hjemme.
        if (Math.abs(a.y - a.ty) < 0.01 || rnd() < 0.002) a.ty = D.yAtDepth(lerp(a.d0, a.d1, rnd()));
        a.y += clamp(a.ty - a.y, -1, 1) * 0.15 * dt;
        // Små fisk svinger unna ubåten.
        if (a.size < 0.12 && Math.hypot(a.x - sub.x, a.y - sub.y) < 0.12) {
          a.dir = a.x < sub.x ? -1 : 1;
          a.y += (a.y < sub.y ? -1 : 1) * 0.08 * dt;
        }
      }
      // Hold dyret i vannet: under overflaten og over bunnen.
      const floor = D.seabedAt(a.x) - a.size * (isJelly(k) ? 0.9 : 0.3) - 0.02;
      const top = k === 'seal' || k === 'porpoise' ? 0.03 : 0.04 + a.size * 0.25;
      a.y = clamp(a.y, top, Math.max(top, floor));
      a.x = clamp(a.x, 0.05, D.WORLD.width - 0.05);
      // Hold styr på fart opp/ned, så dyret kan vippe nesa dit det svømmer.
      a.vy += ((a.y - y0) / Math.max(dt, 0.001) - a.vy) * Math.min(1, dt * 3);
    }
  }

  /**
   * Jevne bevegelser: dyret snur seg gradvis (som om det roterer rundt seg selv) i stedet for å
   * speilvende, vipper med nesa opp og ned, og svømmetakten følger farten.
   */
  function animateBody(a, dt) {
    if (a.face == null) a.face = a.dir;
    a.face += (a.dir - a.face) * Math.min(1, dt * (a.size > 0.2 ? 1.6 : 4));
    const v = Math.abs(a.speed || 0);
    a.swim += dt * (0.6 + Math.min(1.6, v * 12) + Math.abs(a.dir - a.face) * 1.5);
    const lim = a.size > 0.2 ? 0.18 : 0.35; // store dyr vipper mindre
    const want = clamp(Math.atan2(a.vy || 0, Math.max(0.04, v)) * 0.5, -lim, lim);
    a.pitch += (want - a.pitch) * Math.min(1, dt * 2);
  }

  // ---------- Ubåten ----------
  function updateSub(dt) {
    const maxSpeed = (mode === 'rolig' ? 0.3 : 0.6) * Math.sqrt(view / 1.5);
    // Rolig-modus: autopilot glir rolig rundt når ingen har rørt skjermen på en stund.
    if (mode === 'rolig' && !pointer && time - lastInput > 6 && (sub.tx == null || Math.hypot(sub.tx - sub.x, sub.ty - sub.y) < 0.05)) {
      const zx = clamp(sub.x + (rnd() - 0.5) * 3, 0.4, D.WORLD.width - 0.4);
      sub.tx = zx;
      sub.ty = clamp(sub.y + (rnd() - 0.45) * 1, 0.08, D.seabedAt(zx) - 0.12);
    }
    if (sub.tx != null) {
      const dx = sub.tx - sub.x;
      const dy = sub.ty - sub.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.01 && !pointer) {
        sub.tx = null;
      } else {
        const want = Math.min(maxSpeed, dist * 2.2);
        sub.vx += ((dx / (dist || 1)) * want - sub.vx) * Math.min(1, dt * 3);
        sub.vy += ((dy / (dist || 1)) * want - sub.vy) * Math.min(1, dt * 3);
      }
    }
    if (sub.tx == null) {
      sub.vx *= Math.pow(0.15, dt);
      sub.vy *= Math.pow(0.15, dt);
    }
    sub.x += sub.vx * dt;
    sub.y += sub.vy * dt;
    sub.x = clamp(sub.x, 0.1, D.WORLD.width - 0.1);
    sub.y = clamp(sub.y, 0.025, D.seabedAt(sub.x) - 0.04);
    if (Math.abs(sub.vx) > 0.02) sub.dir = sub.vx > 0 ? 1 : -1;
    // Bobler fra propellen.
    const speed = Math.hypot(sub.vx, sub.vy);
    if (speed > 0.05 && time - lastBubble > 0.12 / Math.min(3, speed * 6)) {
      lastBubble = time;
      bubbles.push({ x: sub.x - sub.dir * SUB_LEN * 0.55, y: sub.y + 0.003, r: 0.003 + rnd() * 0.004, vy: -0.05 - rnd() * 0.05, life: 3 });
      if (rnd() < 0.35) AU.bubble(0.6);
      // Lysende plankton glitrer der ubåten kjører i det mørke dypet.
      if (D.depthAt(sub.y) > 250 && rnd() < 0.6) sparks.push({ x: sub.x - sub.dir * 0.05 + (rnd() - 0.5) * 0.08, y: sub.y + (rnd() - 0.5) * 0.08, life: 1.2 + rnd() });
    }
  }

  function updateCamera(dt) {
    const vw = W / S;
    const tx = sub.x - vw / 2 + sub.vx * 0.6;
    const ty = sub.y - (H / S) * 0.45 + sub.vy * 0.4;
    cam.x += (tx - cam.x) * Math.min(1, dt * 2.5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 2.5);
    cam.x = clamp(cam.x, 0, Math.max(0, D.WORLD.width - vw));
    cam.y = clamp(cam.y, -D.WORLD.sky, D.WORLD.height + 0.05 - H / S);
  }

  // ---------- Tegning ----------
  function drawBackground() {
    const top = cam.y;
    const bottom = cam.y + H / S;
    // Himmel.
    if (top < 0) {
      const sky = ctx.createLinearGradient(0, 0, 0, sy(0));
      sky.addColorStop(0, '#8fc3e6');
      sky.addColorStop(1, '#d9eef7');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, sy(0) + 1);
      // Sol og skyer.
      const sunX = W * 0.78;
      const sunY = sy(-0.4);
      ctx.fillStyle = 'rgba(255,248,215,0.9)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, S * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 4; i++) {
        const cxp = ((i * 0.37 + time * 0.004) % 1.3) * W * 1.1 - W * 0.1;
        const cyp = sy(-0.42 + (i % 2) * 0.08);
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(cxp + k * S * 0.05, cyp + Math.sin(k) * S * 0.01, S * 0.06, S * 0.028, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Fjell langt borte på land – som en fjord. De beveger seg saktere enn resten.
    if (top < 0) {
      const base = sy(0);
      for (const [par, color, height, seed] of [[0.15, '#9bb7c7', 0.2, 1.3], [0.3, '#7d9db0', 0.13, 2.9]]) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, base);
        for (let px = 0; px <= W + 10; px += 10) {
          const wx = cam.x * par + px / S;
          const h = height * (0.55 + 0.25 * Math.sin(wx * 2.1 + seed) + 0.15 * Math.sin(wx * 5.3 + seed * 2) + 0.05 * Math.sin(wx * 13 + seed));
          ctx.lineTo(px, base - h * S);
        }
        ctx.lineTo(W, base);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Vannet: fargeovergang etter dybde.
    const wy = Math.max(0, sy(0));
    const g = ctx.createLinearGradient(0, wy, 0, H);
    const y0 = Math.max(0, top);
    for (let i = 0; i <= 8; i++) {
      const yy = lerp(y0, bottom, i / 8);
      g.addColorStop(i / 8, rgb(waterColor(D.depthAt(yy))));
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, wy, W, H - wy);
  }

  /** Fjern havbunn i tåka bak – gir dybde i bildet (beveger seg saktere enn forgrunnen). */
  function drawFarRidge() {
    const par = 0.6;
    const offX = cam.x * (1 - par);
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = 0; px <= W + 8; px += 8) {
      const wx = cam.x + px / S;
      const y = D.seabedAt(wx * 0.92 + offX * 0.15) - 0.32 + Math.sin(wx * 3.1) * 0.05 + Math.sin(wx * 7.3) * 0.02;
      ctx.lineTo(px, sy(Math.max(0.01, y)));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    const d = D.depthAt(cam.y + 0.5);
    ctx.fillStyle = rgb(mix(waterColor(d), [0, 0, 0], 0.18), 0.55);
    ctx.fill();
  }

  /** Dyr langt borte: små, blasse silhuetter som beveger seg saktere enn alt foran (parallakse). */
  function drawFarLife(dt) {
    const par = 0.55;
    const d = D.depthAt(cam.y + (H / S) * 0.5);
    const c = mix(waterColor(d), [0, 0, 0], 0.25);
    const q = (v) => Math.round(v / 8) * 8; // færre ulike farger = færre ferdigtegnede bilder
    const color = rgb([q(c[0]), q(c[1]), q(c[2])]);
    for (const f of farLife) {
      f.x += f.dir * f.speed * dt;
      if (f.x < 0 || f.x > D.WORLD.width) f.dir *= -1;
      // Tegnes som om de var lenger unna: forskjøvet mot midten av skjermen.
      const px = (f.x - cam.x * par - (W / S) * (1 - par) * 0.5) * S;
      const py = (f.y - cam.y * par - (H / S) * (1 - par) * 0.4) * S;
      const L = f.size * S;
      if (px < -L * 3 || px > W + L * 3 || py < -L * 2 || py > H + L * 2) continue;
      const img = A.silhouette(f.kind, Math.max(6, Math.round(L / 4) * 4), color);
      ctx.globalAlpha = 0.55;
      const n = f.school || 1;
      for (let i = 0; i < n; i++) {
        const ox = n > 1 ? Math.sin(i * 2.4 + f.ph) * L * 2.2 : 0;
        const oy = n > 1 ? Math.cos(i * 1.7 + f.ph + time * 0.4) * L * 0.9 : Math.sin(time * 0.3 + f.ph) * L * 0.1;
        ctx.save();
        ctx.translate(px + ox, py + oy);
        ctx.scale(f.dir, 1);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawGodRays() {
    const depthTop = D.depthAt(Math.max(0, cam.y));
    if (depthTop > 120) return;
    const strength = 0.22 * D.lightAt(depthTop);
    const surfaceY = sy(0);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      const baseX = ((i * 0.17 + 0.05) * W * 1.4 - (cam.x * S * 0.15) % (W * 0.3)) + Math.sin(time * 0.3 + i) * S * 0.04;
      const w = S * (0.04 + (i % 3) * 0.025);
      const len = S * (1.4 + (i % 2) * 0.6);
      const slant = S * 0.35;
      const grad = ctx.createLinearGradient(0, surfaceY, 0, surfaceY + len);
      grad.addColorStop(0, `rgba(210,250,240,${strength * (0.6 + 0.4 * Math.sin(time * 0.7 + i * 2))})`);
      grad.addColorStop(1, 'rgba(210,250,240,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(baseX, surfaceY);
      ctx.lineTo(baseX + w, surfaceY);
      ctx.lineTo(baseX + w * 2.2 + slant, surfaceY + len);
      ctx.lineTo(baseX - w * 0.4 + slant, surfaceY + len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSnow(dt) {
    const d = D.depthAt(cam.y + 0.5);
    const glint = d > 150 ? 0.55 : 0.3;
    for (const p of snow) {
      p.y += dt * 0.004 * p.z;
      const x = ((p.x - (cam.x * p.z) / (W / S)) % 1 + 1) % 1;
      const y = ((p.y - (cam.y * p.z) / (H / S)) % 1 + 1) % 1;
      ctx.fillStyle = `rgba(220,235,225,${glint * p.z * 0.6})`;
      ctx.fillRect(x * W, y * H, p.r * p.z, p.r * p.z);
    }
  }

  function seabedPath() {
    const path = new Path2D();
    path.moveTo(-10, H + 10);
    for (let px = -10; px <= W + 10; px += 6) path.lineTo(px, sy(D.seabedAt(cam.x + px / S)));
    path.lineTo(W + 10, H + 10);
    path.closePath();
    return path;
  }

  function drawSeabed() {
    const path = seabedPath();
    const yTop = sy(D.seabedAt(cam.x + W / (2 * S)) - 0.3);
    const g = ctx.createLinearGradient(0, yTop, 0, H + S * 0.3);
    const d = D.depthAt(cam.y + 0.6);
    const sand = mix(hex('#c9b98a'), hex('#3b3a33'), clamp(d / 300, 0, 1));
    g.addColorStop(0, rgb(sand));
    g.addColorStop(1, rgb(mix(sand, [10, 10, 10], 0.6)));
    ctx.fillStyle = g;
    ctx.fill(path);
    // Sandrifler og korn.
    const sandPat = ctx.createPattern(A.sandTile(128), 'repeat');
    if (sandPat) {
      sandPat.setTransform(new DOMMatrix().translate(-cam.x * S, -cam.y * S).scale(Math.max(0.5, S / 500)));
      ctx.fillStyle = sandPat;
      ctx.fill(path);
    }
    // Mørkere jo lenger ned i bunnen (bunnen er en skråning bort fra oss, ikke en vegg).
    const ao = ctx.createLinearGradient(0, 0, 0, H);
    ao.addColorStop(0, 'rgba(0,0,0,0)');
    ao.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = ao;
    ctx.fill(path);
    // Lys kant der sola treffer bunnen.
    ctx.beginPath();
    for (let px = -10; px <= W + 10; px += 6) {
      const yy = sy(D.seabedAt(cam.x + px / S));
      if (px === -10) ctx.moveTo(px, yy);
      else ctx.lineTo(px, yy);
    }
    ctx.strokeStyle = `rgba(255,248,220,${0.08 + 0.3 * D.lightAt(d)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Steiner.
    for (const r of rocks) {
      const x = sx(r.x);
      if (x < -S * 0.2 || x > W + S * 0.2) continue;
      const y = sy(D.seabedAt(r.x));
      const R = r.r * S;
      const tone = mix(hex('#6d6a62'), hex('#3a3934'), r.tone);
      ctx.fillStyle = (() => {
        const rg = ctx.createRadialGradient(x - R * 0.3, y - R * 0.5, R * 0.1, x, y, R * 1.1);
        rg.addColorStop(0, rgb(mix(tone, [255, 255, 255], 0.25)));
        rg.addColorStop(1, rgb(mix(tone, [0, 0, 0], 0.4)));
        return rg;
      })();
      ctx.beginPath();
      ctx.ellipse(x, y, R, R * r.flat, 0, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    // Skjell, småstein og tangtuer.
    for (const det of details) {
      const x = sx(det.x);
      if (x < -20 || x > W + 20) continue;
      const y = sy(D.seabedAt(det.x)) + 1;
      if (det.kind === 'weed') A.weed(ctx, x, y, det.s * S, time, det.phase, det.color);
      else A.pebble(ctx, x, y, Math.max(1.2, det.s * S), det.tone, det.kind);
    }
    // Lysmønster (kaustikk) på grunn bunn.
    if (d < 60) {
      const tile = A.causticTile(160);
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        ctx.save();
        ctx.clip(path);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.11 * D.lightAt(d);
        for (const [sp, ox] of [[0.05, 0], [-0.04, 60]]) {
          pat.setTransform(new DOMMatrix().translate(-cam.x * S + time * S * sp + ox, -cam.y * S + time * S * sp * 0.6).scale(S / 520));
          ctx.fillStyle = pat;
          ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
      }
    }
  }

  function drawKelp() {
    for (const k of kelpList) {
      const x = sx(k.x);
      if (x < -S * 0.3 || x > W + S * 0.3) continue;
      A.kelp(ctx, x, sy(D.seabedAt(k.x)) + 2, k.h * S, time, k.phase, k.color, k.kind);
    }
  }

  function visible(a, pad) {
    const x = sx(a.x);
    const y = sy(a.y);
    const r = (a.size * (a.members ? 4 : 1) + (pad || 0.1)) * S;
    return x > -r && x < W + r && y > -r * 2 && y < H + r * 3;
  }

  function drawAnimal(a, glowOnly) {
    const k = a.sp.kind;
    const art = glowOnly ? A.GLOWS[k] : A.SPECIES_ART[k];
    if (!art) return;
    const L = a.size * S;
    const turns = !isJelly(k) && k !== 'coral' && k !== 'wreck' && k !== 'bottle';
    const face = a.face == null ? a.dir : a.face;
    const draw = (x, y, scale, ph) => {
      ctx.save();
      ctx.translate(x, y);
      if (turns) {
        // Snur gradvis: smal midt i svingen, som når en fisk vender seg mot oss.
        const f = Math.sign(face || 1) * Math.max(0.12, Math.abs(face));
        if (a.sp.place.type === 'water') ctx.rotate(a.pitch * Math.sign(f));
        ctx.scale(f, 1);
      }
      if (a.sp.place.type === 'bottom' && k !== 'coral' && k !== 'wreck') ctx.translate(0, -L * (k === 'crab' ? 0.2 : k === 'urchin' ? 0 : 0.08));
      art(ctx, L * scale, a.swim + ph);
      ctx.restore();
    };
    const x = sx(a.x);
    const y = sy(a.y);
    if (!glowOnly && a.sp.place.type === 'bottom' && k !== 'wreck' && k !== 'coral') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, L * 0.45, L * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (a.members) {
      // Stimen speiles når den snur, så fiskene bytter plass i en myk bue.
      for (const m of a.members) {
        const ox = m.ox * face + Math.sin(time * 0.8 + m.ph) * a.size * 0.4;
        const oy = m.oy + Math.cos(time * 0.6 + m.ph) * a.size * 0.3 + (1 - Math.abs(face)) * m.ox * 0.15;
        draw(x + ox * S, y + oy * S, m.s, m.ph);
      }
    } else {
      draw(x, y, 1, a.phase);
    }
    // Trykket på: et mykt lys rundt dyret en liten stund.
    if (!glowOnly && a.glowUntil > time) {
      const r = Math.max(L * 0.7, S * 0.08);
      const f = (a.glowUntil - time) / 1.5;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, `rgba(255,255,220,${0.25 * f})`);
      rg.addColorStop(1, 'rgba(255,255,220,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWorldObjects() {
    const order = (a) => (a.sp.kind === 'wreck' ? 0 : a.sp.kind === 'coral' ? 1 : a.sp.place.type === 'bottom' ? 2 : 3 + (1 - Math.min(1, a.size)));
    const vis = animals.filter((a) => visible(a)).sort((p, q) => order(p) - order(q));
    // Tegn dyrene i et eget lag, gi dem volum, og legg laget over havet.
    const main = ctx;
    if (fx.width !== canvas.width || fx.height !== canvas.height) {
      fx.width = edge.width = canvas.width;
      fx.height = edge.height = canvas.height;
    }
    fxc.setTransform(1, 0, 0, 1, 0, 0);
    fxc.globalCompositeOperation = 'source-over';
    fxc.clearRect(0, 0, fx.width, fx.height);
    fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx = fxc;
    try {
      for (const a of vis) if (a.sp.place.type !== 'sky') drawAnimal(a, false);
    } finally {
      ctx = main;
    }
    if (quality.shade) shadeCreatures();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(fx, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return vis;
  }

  /**
   * Gir dyrene et «3D»-preg: en lys kant på ryggen der lyset ovenfra treffer, og en mørk
   * kant under. Kantene finnes ved å trekke laget fra en forskjøvet kopi av seg selv.
   */
  function shadeCreatures() {
    const depth = D.depthAt(cam.y + (H / S) * 0.5);
    const light = D.lightAt(depth);
    const k = Math.max(2, Math.round(2.2 * dpr));
    const pass = (dy, color) => {
      ec.setTransform(1, 0, 0, 1, 0, 0);
      ec.globalCompositeOperation = 'source-over';
      ec.clearRect(0, 0, edge.width, edge.height);
      ec.drawImage(fx, 0, 0);
      ec.globalCompositeOperation = 'destination-out';
      ec.drawImage(fx, 0, dy);
      ec.globalCompositeOperation = 'source-in';
      ec.fillStyle = color;
      ec.fillRect(0, 0, edge.width, edge.height);
      fxc.setTransform(1, 0, 0, 1, 0, 0);
      fxc.globalCompositeOperation = 'source-atop';
      fxc.drawImage(edge, 0, 0);
      fxc.globalCompositeOperation = 'source-over';
    };
    pass(k, `rgba(235,250,255,${0.18 + 0.4 * light})`);
    pass(-k * 1.5, `rgba(0,8,16,${0.28 + 0.12 * (1 - light)})`);
  }

  // ---------- Steder (grotter og vrak) ----------
  function placeAnchor(pl) {
    return { x: pl.x, y: D.seabedAt(pl.x) + 0.02 };
  }

  function drawPlaces() {
    for (const pl of D.PLACES) {
      if (pl.kind === 'ship') continue; // skipsvraket tegnes som et dyr/ting (wreck)
      const a = placeAnchor(pl);
      const L = pl.size * S;
      const x = sx(a.x);
      const y = sy(a.y);
      if (x < -L || x > W + L || y < -L || y > H + L) continue;
      ctx.save();
      // Litt nedsunket, så sanden foran dekker foten (den står ikke og svever på skråningen).
      ctx.translate(x, y + L * 0.1);
      if (pl.kind === 'cave') A.caveMouth(ctx, L, time, pl.palette);
      else A.boatWreck(ctx, L);
      ctx.restore();
      drawPlaceHint(pl, x, y - L * (pl.kind === 'cave' ? 0.18 : 0.25), L);
    }
    const wreck = D.PLACES.find((pl) => pl.kind === 'ship');
    const wa = animals.find((a) => a.sp.enter === wreck.key);
    if (wa) drawPlaceHint(wreck, sx(wa.x), sy(wa.y) - wa.size * S * 0.18, wa.size * S);
  }

  /** Et rolig, pulserende lys og bobler som viser at man kan svømme inn. */
  function drawPlaceHint(pl, x, y, L) {
    const near = Math.hypot(sub.x - pl.x, sub.y - D.seabedAt(pl.x)) < 1.4;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2 + pl.x);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const r = L * 0.18 * (1 + pulse * 0.15);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = (near ? 0.35 : 0.15) * (0.6 + 0.4 * pulse) * (visited.has(pl.key) ? 0.5 : 1);
    g.addColorStop(0, `rgba(255,240,190,${a})`);
    g.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (near && mode !== 'rolig') {
      ctx.font = `${Math.round(Math.max(18, L * 0.12))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.fillText('🔦', x, y - L * 0.1);
      ctx.globalAlpha = 1;
    }
    if (rnd() < 0.03) bubbles.push({ x: pl.x + (rnd() - 0.5) * 0.05, y: cam.y + y / S, r: 0.002 + rnd() * 0.003, vy: -0.04, life: 2.5 });
  }

  function placeAt(p) {
    for (const pl of D.PLACES) {
      if (pl.kind === 'ship') continue;
      const a = placeAnchor(pl);
      const cy = a.y - pl.size * 0.25;
      if (Math.abs(p.x - a.x) < pl.size * 0.45 && Math.abs(p.y - cy) < pl.size * 0.3) return pl;
    }
    return null;
  }

  function enterPlace(pl) {
    if (inside) return;
    inside = pl;
    const first = !visited.has(pl.key);
    visited.add(pl.key);
    sub.tx = null;
    sub.vx = sub.vy = 0;
    pointers.clear();
    pointer = null;
    pinch = null;
    Sound.flip();
    closeCard();
    closeMap();
    IN.open(pl, {
      mode,
      found: [],
      chime: (pan) => AU.chime(pan),
      onFind: (it, firstTap) => {
        let res = { name: it.name, text: it.text };
        let snd = null;
        if (it.species) {
          const sp = D.SPECIES.find((x) => x.key === it.species);
          found.add(sp.key);
          const isNew = !album.has(sp.key);
          if (isNew) {
            album.add(sp.key);
            P.store.set('ocean.album', [...album]);
          }
          res = { name: sp.name, text: sp.facts, isNew: isNew && mode !== 'rolig' };
          snd = sp.sound ? sp : null;
          if (mode === 'rolig' && snd) AU.animal(snd.sound, { distance: 0.3, wet: 0.7, volume: 0.7 });
        }
        if (mode === 'lar') {
          Speech.speak(`${res.name}. ${res.text}`).then(() => { if (snd && inside) playSound(snd, 0); });
        } else if (mode === 'oppdag') {
          if (res.isNew) Speech.speak(`Ny i fotoboka: ${res.name}!`);
          else Sound.flip();
        }
        return res;
      },
      onAllFound: (place) => {
        Sound.win();
        if (mode === 'lar') setTimeout(() => inside && Speech.speak(`Du har funnet alt i ${place.name}!`), 2500);
      },
    });
    if (mode !== 'rolig') {
      IN.message(pl.name, pl.intro);
      if (mode === 'lar') Speech.speak(pl.intro);
      else if (first) Sound.hint();
    }
  }

  function exitPlace() {
    if (!inside) return;
    const pl = inside;
    inside = null;
    IN.close();
    Speech.stop();
    if (playing) playing.stop();
    Sound.tap();
    // Ubåten dukker opp rett utenfor inngangen.
    sub.x = clamp(pl.x + 0.15, 0.2, D.WORLD.width - 0.2);
    sub.y = Math.max(0.05, D.seabedAt(sub.x) - pl.size * 0.6);
    sub.tx = null;
    sub.vx = sub.vy = 0;
    last = 0;
  }
  $('#ocean-inside-exit').addEventListener('click', exitPlace);
  $('#ocean-inside-read').addEventListener('click', () => {
    const n = $('#ocean-inside-info-name').textContent;
    const t = $('#ocean-inside-info-text').textContent;
    Speech.speak(`${n}. ${t}`);
  });
  $('#ocean-inside-info-close').addEventListener('click', () => { Sound.tap(); IN.hideInfo(); });

  function drawSub() {
    const L = SUB_LEN * S;
    ctx.save();
    ctx.translate(sx(sub.x), sy(sub.y) + Math.sin(time * 1.5) * S * 0.002);
    ctx.scale(sub.dir, 1);
    ctx.rotate(clamp(sub.vy * 0.8, -0.25, 0.25) * sub.dir);
    A.submarine(ctx, L, time, D.depthAt(sub.y) > 120);
    ctx.restore();
    for (const b of bubbles) {
      ctx.strokeStyle = `rgba(230,250,255,${Math.min(0.7, b.life * 0.3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.y), b.r * S, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /** Uskarpe partikler helt foran kameraet. */
  function drawBokeh() {
    const d = D.depthAt(cam.y + (H / S) * 0.5);
    const deep = d > 250;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of bokeh) {
      const x = ((b.x * W * 1.6 - cam.x * S * 1.4) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
      const y = ((b.y * H * 1.6 - cam.y * S * 1.4 + Math.sin(time * 0.2 + b.ph) * 20) % (H * 1.6) + H * 1.6) % (H * 1.6) - H * 0.3;
      const g = ctx.createRadialGradient(x, y, 0, x, y, b.r);
      const c = deep ? '120,200,255' : '230,250,240';
      g.addColorStop(0, `rgba(${c},${b.a * (deep ? 0.6 : 1)})`);
      g.addColorStop(0.7, `rgba(${c},${b.a * 0.4})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Vannflata sett nedenfra: et glitrende speil med lys som bølger. */
  function drawSurfaceUnderside() {
    const y = sy(0);
    if (y < -20 || y > H) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y, 0, y + S * 0.12);
    g.addColorStop(0, 'rgba(200,250,250,0.35)');
    g.addColorStop(1, 'rgba(200,250,250,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, W, S * 0.12);
    ctx.strokeStyle = 'rgba(230,255,255,0.35)';
    ctx.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let px = 0; px <= W; px += 8) {
        const wx = cam.x + px / S;
        const yy = y + S * (0.012 + k * 0.014) + Math.sin(wx * (22 + k * 9) + time * (1.4 + k * 0.5)) * S * 0.004 * (k + 1);
        if (px) ctx.lineTo(px, yy);
        else ctx.moveTo(px, yy);
      }
      ctx.globalAlpha = 0.6 - k * 0.18;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSurface() {
    const y = sy(0);
    if (y < -20 || y > H + 20) return;
    // Bølgende vannflate, sett fra siden.
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let px = 0; px <= W; px += 6) {
      const wx = cam.x + px / S;
      ctx.lineTo(px, y + Math.sin(wx * 18 + time * 1.6) * S * 0.006 + Math.sin(wx * 41 - time * 2.3) * S * 0.003);
    }
    ctx.lineTo(W, y + S * 0.03);
    ctx.lineTo(0, y + S * 0.03);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y - S * 0.01, 0, y + S * 0.03);
    g.addColorStop(0, 'rgba(240,255,255,0.85)');
    g.addColorStop(1, 'rgba(120,200,210,0)');
    ctx.fillStyle = g;
    ctx.fill();
    // Måker i lufta.
    for (const a of animals) if (a.sp.place.type === 'sky' && visible(a)) drawAnimal(a, false);
  }

  function drawDarkness() {
    const top = cam.y;
    const bottom = cam.y + H / S;
    const maxDark = darkness(D.depthAt(bottom));
    if (maxDark < 0.03) return;
    const w = Math.ceil(W / 2);
    const h = Math.ceil(H / 2);
    if (dark.width !== w || dark.height !== h) {
      dark.width = w;
      dark.height = h;
    }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, w, h);
    const g = dctx.createLinearGradient(0, 0, 0, h);
    for (let i = 0; i <= 6; i++) {
      const yy = lerp(Math.max(0, top), bottom, i / 6);
      g.addColorStop(i / 6, `rgba(1,6,12,${darkness(D.depthAt(yy))})`);
    }
    dctx.fillStyle = g;
    dctx.fillRect(0, 0, w, h);
    // Lykta på ubåten skjærer et lyst felt ut av mørket.
    const subDepth = D.depthAt(sub.y);
    if (subDepth > 120) {
      dctx.globalCompositeOperation = 'destination-out';
      const lx = sx(sub.x + sub.dir * SUB_LEN * 0.5) / 2;
      const ly = sy(sub.y) / 2;
      const reach = S * 0.75 / 2;
      const ang = sub.dir > 0 ? 0 : Math.PI;
      const cone = dctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
      cone.addColorStop(0, 'rgba(0,0,0,0.95)');
      cone.addColorStop(0.6, 'rgba(0,0,0,0.6)');
      cone.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = cone;
      dctx.beginPath();
      dctx.moveTo(lx, ly);
      dctx.arc(lx, ly, reach, ang - 0.45, ang + 0.45);
      dctx.closePath();
      dctx.fill();
      // Litt lys rundt hele ubåten også.
      const halo = dctx.createRadialGradient(lx, ly, 0, lx, ly, S * 0.18 / 2);
      halo.addColorStop(0, 'rgba(0,0,0,0.7)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = halo;
      dctx.beginPath();
      dctx.arc(lx, ly, S * 0.18 / 2, 0, Math.PI * 2);
      dctx.fill();
    }
    ctx.drawImage(dark, 0, 0, W, H);
    // Synlig lysstråle i vannet.
    if (subDepth > 120) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lx = sx(sub.x + sub.dir * SUB_LEN * 0.5);
      const ly = sy(sub.y);
      const reach = S * 0.75;
      const ang = sub.dir > 0 ? 0 : Math.PI;
      const beam = ctx.createRadialGradient(lx, ly, 0, lx, ly, reach);
      beam.addColorStop(0, 'rgba(255,245,200,0.18)');
      beam.addColorStop(1, 'rgba(255,245,200,0)');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.arc(lx, ly, reach, ang - 0.4, ang + 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGlows(vis) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const a of vis) if (A.GLOWS[a.sp.kind]) drawAnimal(a, true);
    for (const p of sparks) {
      const al = Math.min(1, p.life) * 0.8;
      const r = S * 0.012;
      const rg = ctx.createRadialGradient(sx(p.x), sy(p.y), 0, sx(p.x), sy(p.y), r);
      rg.addColorStop(0, `rgba(140,230,255,${al})`);
      rg.addColorStop(1, 'rgba(140,230,255,0)');
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    drawFarRidge();
    drawFarLife(dt);
    drawGodRays();
    drawSurfaceUnderside();
    drawKelp();
    drawPlaces();
    drawSeabed();
    const vis = drawWorldObjects();
    drawSub();
    drawSnow(dt);
    drawSurface();
    drawDarkness();
    drawGlows(vis);
    drawBokeh();
    if (sleeping) {
      ctx.fillStyle = `rgba(0,0,0,${clamp((time - sleepStartedAt) / 40, 0, 0.92)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Løkke ----------
  let sleepStartedAt = 0;

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    if (last && !inside && !document.hidden) adaptQuality(now - last);
    last = now;
    time += dt;
    if (inside) {
      // Inne i en grotte eller et vrak: verden står stille, men lyden får mer «rom».
      AU.update(D.depthAt(D.seabedAt(inside.x)), 1);
      checkMission(D.depthAt(sub.y));
      checkSleep();
      raf = requestAnimationFrame(loop);
      return;
    }
    updateSub(dt);
    updateAnimals(dt);
    for (const b of bubbles) { b.y += b.vy * dt; b.x += Math.sin(time * 3 + b.r * 900) * 0.01 * dt; b.life -= dt; }
    bubbles = bubbles.filter((b) => b.life > 0 && b.y > 0.01);
    for (const p of sparks) p.life -= dt;
    sparks = sparks.filter((p) => p.life > 0);
    updateCamera(dt);
    const depth = D.depthAt(sub.y);
    AU.update(depth, roomAt(sub.x, sub.y));
    checkZone(depth);
    checkMission(depth);
    distantWhale(depth);
    checkSleep();
    updateHud(depth);
    render(dt);
    drawMini();
    raf = requestAnimationFrame(loop);
  }

  function adaptQuality(ms) {
    quality.ema += (Math.min(100, ms) - quality.ema) * 0.05;
    quality.slow = quality.ema > 24 ? quality.slow + 1 : 0;
    if (quality.slow < 120) return; // omtrent to sekunder med tregt bilde
    quality.slow = 0;
    quality.ema = 16;
    if (quality.maxDpr > 1 && dpr > 1) {
      quality.maxDpr = Math.max(1, Math.min(quality.maxDpr, dpr) - 0.5);
      measure();
    } else if (quality.shade) {
      quality.shade = false;
    }
  }

  /** Etterklang: mer «rom» ved vraket, revet og nær bunnen i dypet. */
  function roomAt(x, y) {
    let room = 0;
    for (const a of animals) {
      if (a.sp.kind !== 'wreck' && a.sp.kind !== 'coral') continue;
      const d = Math.hypot(a.x - x, a.y - y);
      room = Math.max(room, clamp(1 - d / 0.8, 0, 1));
    }
    for (const pl of D.PLACES) room = Math.max(room, clamp(1 - Math.hypot(pl.x - x, D.seabedAt(pl.x) - y) / 1.2, 0, 1) * 0.6);
    const depth = D.depthAt(y);
    return clamp(room + (depth > 500 ? 0.3 : depth / 1700), 0, 1);
  }

  /** Fjern hvalsang i det åpne havet – av og til, svakt og med mye etterklang. */
  function distantWhale(depth) {
    if (depth < 15 || depth > 900 || sleeping) return;
    if (!nextWhale) nextWhale = time + 20 + rnd() * 20;
    if (time < nextWhale) return;
    nextWhale = time + (mode === 'rolig' ? 45 : 75) + rnd() * 60;
    AU.animal('knolhval.mp3', { pan: rnd() * 1.6 - 0.8, distance: 0.75, wet: 0.7, volume: mode === 'rolig' ? 0.8 : 0.6 });
  }

  // ---------- Soner, oppdrag og HUD ----------
  function checkZone(depth) {
    const z = D.zoneAt(depth);
    if (z.key === zoneKey) {
      zoneSince = time;
      return;
    }
    // Litt tålmodighet så sona ikke blafrer når man ligger på grensen.
    if (time - zoneSince < 1.2) return;
    const first = !zoneKey;
    zoneKey = z.key;
    zoneSince = time;
    $('#ocean-zone').textContent = z.name;
    if (mode === 'rolig') return;
    showBanner(z.name);
    if (mode === 'lar' && !cardOpen) Speech.speak(z.intro);
    else if (!first && mode === 'oppdag') Sound.hint();
  }

  let bannerTimer = 0;
  function showBanner(text) {
    const el = $('#ocean-banner');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function renderMission() {
    const chip = $('#ocean-mission');
    if (mode !== 'lar') {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    const m = D.MISSIONS[missionIndex];
    chip.textContent = m ? `${m.icon} ${m.text}` : '🌟 Du har gjort alle oppdragene!';
  }

  function checkMission(depth) {
    if (mode !== 'lar' || missionDone) return;
    const m = D.MISSIONS[missionIndex];
    if (!m) return;
    const ok = m.depth ? depth >= m.depth : m.places ? m.places.some((k) => visited.has(k)) : m.species.some((k) => found.has(k));
    if (!ok) return;
    missionDone = true;
    Sound.win();
    window.PaizonConfetti.burst(80);
    setTimeout(() => {
      if (!running) return;
      Speech.speak(`Bra jobba! ${m.text} – klart!`);
      missionIndex++;
      missionDone = false;
      renderMission();
    }, cardOpen ? 300 : 1200);
  }

  function updateHud(depth) {
    $('#ocean-depth').textContent = `${Math.round(depth)} m`;
    const frac = clamp(D.depthAt(sub.y) / 3000, 0, 1);
    // Måleren er ikke lineær: de grunne sonene får mer plass (samme skala som verden).
    const pos = clamp(sub.y / D.WORLD.height, 0, 1);
    $('#ocean-meter-dot').style.top = `${pos * 100}%`;
    $('#ocean-meter').setAttribute('aria-valuenow', String(Math.round(frac * 3000)));
  }

  // ---------- Trykk og dra ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: cam.x + (e.clientX - r.left) / S, y: cam.y + (e.clientY - r.top) / S, px: e.clientX, py: e.clientY };
  }

  let lastHitDist = 1;
  function animalAt(p) {
    let best = null;
    let bestD = Infinity;
    for (const a of animals) {
      if (!visible(a)) continue;
      const reach = Math.max(0.05, a.size * (a.members ? 2.2 : a.sp.kind === 'humpback' || a.sp.kind === 'giantsquid' ? 0.45 : 0.6));
      let cx = a.x;
      let cy = a.y;
      if (a.sp.place.type === 'bottom') cy -= a.size * (a.sp.kind === 'wreck' ? 0.2 : a.sp.kind === 'coral' ? 0.3 : 0.1);
      if (isJelly(a.sp.kind)) cy += a.size * 0.6;
      const d = Math.hypot(p.x - cx, p.y - cy) / reach;
      if (d < 1 && d < bestD) {
        best = a;
        bestD = d;
      }
    }
    lastHitDist = bestD;
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    AU.start();
    lastInput = time;
    if (sleeping) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (pointers.size === 2) {
      // To fingre: knip for å zoome inn og ut.
      const [a, b] = [...pointers.values()];
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y), view0: view };
      pointer = null;
      sub.tx = null;
      return;
    }
    if (pointers.size > 2 || pinch) return;
    const p = toWorld(e);
    let hit = animalAt(p);
    const place = placeAt(p);
    // En fisk som tilfeldigvis svømmer forbi inngangen, skal ikke ta trykket fra grotta.
    if (hit && place && lastHitDist > 0.45) hit = null;
    pointer = { id: e.pointerId, x0: p.px, y0: p.py, moved: false, hit, place: hit ? null : place };
    if (!pointer.hit && !pointer.place) {
      sub.tx = p.x;
      sub.ty = p.y;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
      setView(pinch.view0 * (pinch.d0 / d));
      return;
    }
    if (!pointer || e.pointerId !== pointer.id) return;
    lastInput = time;
    const p = toWorld(e);
    if (Math.hypot(p.px - pointer.x0, p.py - pointer.y0) > 10) pointer.moved = true;
    if (pointer.moved) {
      sub.tx = p.x;
      sub.ty = p.y;
    }
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pinch) {
      if (pointers.size === 0) pinch = null;
      return;
    }
    if (!pointer || e.pointerId !== pointer.id) return;
    if (!pointer.moved && pointer.hit) tapAnimal(pointer.hit);
    else if (!pointer.moved && pointer.place) enterPlace(pointer.place);
    pointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) pinch = null;
    pointer = null;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    setView(view * Math.exp(e.deltaY * 0.0015));
  }, { passive: false });

  function setView(v) {
    view = clamp(v, VIEW_MIN, VIEW_MAX);
    S = H / view;
  }

  function tapAnimal(a) {
    const sp = a.sp;
    if (sp.enter) {
      // Skipsvraket: svøm inn i det.
      found.add(sp.key);
      if (!album.has(sp.key)) {
        album.add(sp.key);
        P.store.set('ocean.album', [...album]);
      }
      enterPlace(D.PLACES.find((pl) => pl.key === sp.enter));
      return;
    }
    a.glowUntil = time + 1.5;
    const first = !found.has(sp.key);
    found.add(sp.key);
    const pan = clamp((sx(a.x) / W) * 2 - 1, -1, 1);
    if (mode === 'rolig') {
      // Ingen tekst – bare et mykt lys, og dyrets egen lyd hvis vi har den.
      if (sp.sound) AU.animal(sp.sound, { pan, distance: 0.2, wet: 0.5, volume: 0.8 });
      else AU.chime(pan);
      return;
    }
    if (!album.has(sp.key)) {
      album.add(sp.key);
      P.store.set('ocean.album', [...album]);
    }
    openCard(sp, { pan, newFind: first && mode === 'oppdag' });
  }

  // ---------- Faktakort ----------
  let cardRaf = 0;
  let playing = null;

  function openCard(sp, { pan, newFind }) {
    cardOpen = sp;
    $('#ocean-card-name').textContent = sp.name;
    $('#ocean-card-sci').textContent = sp.sci || '';
    $('#ocean-card-facts').textContent = sp.facts;
    $('#ocean-card-new').hidden = !newFind;
    $('#ocean-card-sound').hidden = !sp.sound;
    $('#ocean-card-credit').hidden = !sp.sound;
    $('#ocean-card').hidden = false;
    Sound.flip();
    drawCardArt(sp);
    if (mode === 'lar') {
      setTimeout(() => {
        if (cardOpen !== sp) return;
        Speech.speak(`${sp.name}. ${sp.facts}`).then(() => {
          if (cardOpen === sp && sp.sound) playSound(sp, pan);
        });
      }, 250);
    } else if (newFind) {
      Speech.speak(`Ny i fotoboka: ${sp.name}!`);
    }
  }

  function playSound(sp, pan) {
    if (playing) playing.stop();
    AU.animal(sp.sound, { pan: pan || 0, distance: 0.05, wet: 0.25, volume: 1 }).then((h) => { playing = h; });
  }

  function closeCard() {
    cardOpen = null;
    $('#ocean-card').hidden = true;
    cancelAnimationFrame(cardRaf);
    Speech.stop();
    if (playing) playing.stop();
  }

  function drawCardArt(sp) {
    const c = $('#ocean-card-art');
    const cx = c.getContext('2d');
    const r = c.getBoundingClientRect();
    const scale = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.max(10, r.width * scale);
    c.height = Math.max(10, r.height * scale);
    const art = A.SPECIES_ART[sp.kind];
    const glow = A.GLOWS[sp.kind];
    const t0 = performance.now();
    const step = () => {
      if (cardOpen !== sp) return;
      const t = (performance.now() - t0) / 1000;
      cx.setTransform(scale, 0, 0, scale, 0, 0);
      const w = r.width;
      const h = r.height;
      const bg = cx.createLinearGradient(0, 0, 0, h);
      const zc = waterColor({ overflaten: 5, tareskogen: 25, apenthav: 90, skumring: 400, dypet: 1500 }[sp.zone] || 30);
      bg.addColorStop(0, rgb(mix(zc, [255, 255, 255], 0.15)));
      bg.addColorStop(1, rgb(mix(zc, [0, 0, 0], 0.35)));
      cx.fillStyle = bg;
      cx.fillRect(0, 0, w, h);
      cx.save();
      const jelly = isJelly(sp.kind);
      const big = sp.kind === 'lionsmane';
      const L = jelly ? h * (big ? 0.28 : 0.45) : sp.kind === 'coral' || sp.kind === 'wreck' ? w * 0.75 : sp.kind === 'crab' || sp.kind === 'starfish' || sp.kind === 'urchin' ? Math.min(w, h) * 0.6 : w * 0.72;
      cx.translate(w / 2, jelly ? h * (big ? 0.2 : 0.45) : sp.kind === 'coral' || sp.kind === 'wreck' ? h * 0.92 : h * 0.55);
      art(cx, L, t);
      if (glow) {
        cx.globalCompositeOperation = 'lighter';
        glow(cx, L, t);
      }
      cx.restore();
      cardRaf = requestAnimationFrame(step);
    };
    step();
  }

  $('#ocean-card-close').addEventListener('click', () => { Sound.tap(); closeCard(); });
  $('#ocean-card-read').addEventListener('click', () => {
    if (cardOpen) Speech.speak(`${cardOpen.name}. ${cardOpen.facts}`);
  });
  $('#ocean-card-sound').addEventListener('click', () => {
    if (cardOpen && cardOpen.sound) playSound(cardOpen, 0);
  });

  // ---------- Fotobok ----------
  function openAlbum() {
    const grid = $('#ocean-album-grid');
    grid.innerHTML = '';
    for (const sp of D.SPECIES) {
      const have = album.has(sp.key);
      if (sp.secret && !have) continue; // hemmeligheter vises ikke før de er funnet
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'album-cell' + (have ? '' : ' unknown');
      const c = document.createElement('canvas');
      c.width = 160;
      c.height = 110;
      cell.appendChild(c);
      const label = document.createElement('span');
      label.textContent = have ? sp.name : '?';
      cell.appendChild(label);
      drawThumb(c, sp, have);
      if (have) cell.addEventListener('click', () => { closeAlbum(); openCard(sp, { pan: 0, newFind: false }); });
      grid.appendChild(cell);
    }
    $('#ocean-album').hidden = false;
    Sound.flip();
  }

  function drawThumb(c, sp, have) {
    const cx = c.getContext('2d');
    const w = c.width;
    const h = c.height;
    const jelly = isJelly(sp.kind);
    const L = jelly ? h * (sp.kind === 'lionsmane' ? 0.25 : 0.42) : sp.kind === 'coral' || sp.kind === 'wreck' ? w * 0.8 : w * 0.62;
    cx.save();
    cx.translate(w / 2, jelly ? h * (sp.kind === 'lionsmane' ? 0.22 : 0.5) : sp.kind === 'coral' || sp.kind === 'wreck' ? h * 0.92 : h * 0.55);
    A.SPECIES_ART[sp.kind](cx, L, 1);
    cx.restore();
    if (!have) {
      // Ikke funnet ennå: bare silhuetten.
      cx.globalCompositeOperation = 'source-in';
      cx.fillStyle = 'rgba(30,50,70,0.85)';
      cx.fillRect(0, 0, w, h);
      cx.globalCompositeOperation = 'source-over';
    }
  }

  function closeAlbum() {
    $('#ocean-album').hidden = true;
  }
  $('#ocean-album-btn').addEventListener('click', () => { Sound.tap(); openAlbum(); });
  $('#ocean-album-close').addEventListener('click', () => { Sound.tap(); closeAlbum(); });

  // ---------- Kart (oversikt) ----------
  const ZONE_COLORS = ['#7fd0de', '#2f9aa8', '#1a6a84', '#0d3550', '#04121f'];
  let mapStatic = null;
  let mapTarget = null;

  /** Tegner hele havet i et rektangel (w x h). Brukes både av minikartet og det store kartet. */
  function drawMapBase(c, w, h, big) {
    const wy = (y) => ((y + 0.4) / (D.WORLD.height + 0.4)) * h;
    const wx = (x) => (x / D.WORLD.width) * w;
    c.fillStyle = '#bfe3f2';
    c.fillRect(0, 0, w, wy(0));
    D.ZONES.forEach((z, i) => {
      const y0 = wy(D.yAtDepth(z.from));
      const y1 = wy(D.yAtDepth(Math.min(3000, z.to)));
      c.fillStyle = ZONE_COLORS[i];
      c.fillRect(0, y0, w, (i === D.ZONES.length - 1 ? h : y1) - y0);
      const fs = Math.round(h * 0.035);
      const bottom = i === D.ZONES.length - 1 ? h : y1;
      if (big && bottom - y0 > fs * 1.3) {
        c.fillStyle = i < 2 ? 'rgba(5,30,45,0.75)' : 'rgba(230,245,250,0.8)';
        c.font = `800 ${fs}px system-ui, sans-serif`;
        c.textAlign = 'right';
        c.fillText(z.name, w - 10, Math.min(h - 8, y0 + fs * 1.15));
      }
    });
    c.beginPath();
    c.moveTo(0, h);
    for (let x = 0; x <= D.WORLD.width; x += 0.1) c.lineTo(wx(x), wy(D.seabedAt(x)));
    c.lineTo(w, h);
    c.closePath();
    c.fillStyle = '#8a7c5c';
    c.fill();
    c.strokeStyle = '#c9b98a';
    c.lineWidth = big ? 3 : 1.5;
    c.stroke();
  }

  function mapCoords(w, h) {
    return {
      x: (x) => (x / D.WORLD.width) * w,
      y: (y) => ((y + 0.4) / (D.WORLD.height + 0.4)) * h,
      toWorld: (px, py) => ({ x: (px / w) * D.WORLD.width, y: (py / h) * (D.WORLD.height + 0.4) - 0.4 }),
    };
  }

  function drawMapMarkers(c, w, h, big) {
    const m = mapCoords(w, h);
    D.PLACES.forEach((pl, i) => {
      const x = m.x(pl.x);
      const y = m.y(D.seabedAt(pl.x)) - (big ? 12 : 4);
      if (big) {
        c.font = `${Math.round(h * 0.05)}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.fillText(pl.kind === 'cave' ? '🕳️' : '⚓', x, y);
        c.font = `800 ${Math.round(h * 0.028)}px system-ui, sans-serif`;
        c.fillStyle = '#fff';
        c.shadowColor = 'rgba(0,0,0,0.6)';
        c.shadowBlur = 4;
        // Annenhver merkelapp under, så navn som ligger tett ikke går i hverandre.
        c.fillText(pl.name + (visited.has(pl.key) ? ' ✓' : ''), x, i % 2 ? y + h * 0.06 : y - h * 0.055);
        c.shadowBlur = 0;
      } else {
        c.fillStyle = visited.has(pl.key) ? '#9be39b' : '#ffe08a';
        c.beginPath();
        c.arc(x, y, 2.5 * dpr, 0, Math.PI * 2);
        c.fill();
      }
    });
    if (mapTarget) {
      c.strokeStyle = '#ffe066';
      c.lineWidth = big ? 3 : 1.5 * dpr;
      c.beginPath();
      c.arc(m.x(mapTarget.x), m.y(mapTarget.y), big ? 12 : 4 * dpr, 0, Math.PI * 2);
      c.stroke();
    }
    // Det kameraet ser nå.
    if (!big) {
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1 * dpr;
      c.strokeRect(m.x(cam.x), m.y(cam.y), (W / S / D.WORLD.width) * w, ((H / S) / (D.WORLD.height + 0.4)) * h);
    }
    const sxm = m.x(sub.x);
    const sym = m.y(sub.y);
    c.fillStyle = '#ffd21a';
    c.strokeStyle = '#3a2a00';
    c.lineWidth = big ? 2 : 1 * dpr;
    c.beginPath();
    c.ellipse(sxm, sym, big ? 11 : 4 * dpr, big ? 6 : 2.4 * dpr, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }

  function drawMini() {
    if (mini.width < 20) return;
    if (!mapStatic || mapStatic.width !== mini.width || mapStatic.height !== mini.height) {
      mapStatic = document.createElement('canvas');
      mapStatic.width = mini.width;
      mapStatic.height = mini.height;
      drawMapBase(mapStatic.getContext('2d'), mini.width, mini.height, false);
    }
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.drawImage(mapStatic, 0, 0);
    drawMapMarkers(mctx, mini.width, mini.height, false);
    if (mapTarget && Math.hypot(sub.x - mapTarget.x, sub.y - mapTarget.y) < 0.15) mapTarget = null;
  }

  function openMap() {
    const box = $('#ocean-map');
    box.hidden = false;
    const c = $('#ocean-map-canvas');
    const r = c.getBoundingClientRect();
    const scale = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(r.width * scale);
    c.height = Math.round(r.height * scale);
    const cx = c.getContext('2d');
    cx.setTransform(scale, 0, 0, scale, 0, 0);
    drawMapBase(cx, r.width, r.height, true);
    drawMapMarkers(cx, r.width, r.height, true);
    Sound.flip();
  }
  function closeMap() {
    $('#ocean-map').hidden = true;
  }
  mini.addEventListener('click', () => { Sound.unlock(); openMap(); });
  $('#ocean-map-close').addEventListener('click', () => { Sound.tap(); closeMap(); });
  $('#ocean-map-canvas').addEventListener('click', (e) => {
    // Trykk på kartet: ubåten kjører dit av seg selv.
    const c = e.currentTarget;
    const r = c.getBoundingClientRect();
    const p = mapCoords(r.width, r.height).toWorld(e.clientX - r.left, e.clientY - r.top);
    const x = clamp(p.x, 0.2, D.WORLD.width - 0.2);
    const y = clamp(p.y, 0.05, D.seabedAt(x) - 0.08);
    sub.tx = x;
    sub.ty = y;
    mapTarget = { x, y };
    lastInput = time;
    Sound.tap();
    closeMap();
  });

  // ---------- Musikk ----------
  function renderMusicBtn() {
    const b = $('#ocean-music-btn');
    const on = settings.music !== 0;
    b.textContent = on ? '🎵' : '🔇';
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Musikk på' : 'Musikk av';
  }
  $('#ocean-music-btn').addEventListener('click', () => {
    settings.music = settings.music !== 0 ? 0 : 1;
    P.saveSettings('ocean');
    AU.setMusic(settings.music !== 0);
    renderMusicBtn();
    Sound.tap();
  });

  // ---------- Sovetimer (Rolig) ----------
  function checkSleep() {
    if (!sleepEndsAt || sleeping || Date.now() < sleepEndsAt) return;
    sleeping = true;
    sleepStartedAt = time;
    AU.fadeTo(0, 40);
    $('#ocean-goodnight').hidden = false;
  }

  // ---------- Start og stopp ----------
  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(quality.maxDpr, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    S = H / view;
    const mr = mini.getBoundingClientRect();
    mini.width = Math.round(Math.max(10, mr.width) * dpr);
    mini.height = Math.round(Math.max(10, mr.height) * dpr);
  }

  function start(newMode) {
    mode = newMode || 'lar';
    P.show('ocean');
    document.body.dataset.oceanMode = mode;
    view = 1.5;
    measure();
    found = new Set();
    visited = new Set();
    inside = null;
    IN.close();
    closeMap();
    buildWorld();
    sub.x = 1.1;
    sub.y = 0.1;
    sub.vx = sub.vy = 0;
    sub.tx = sub.ty = null;
    sub.dir = 1;
    cam.x = clamp(sub.x - W / S / 2, 0, D.WORLD.width - W / S);
    cam.y = sub.y - view * 0.45;
    zoneKey = '';
    zoneSince = 0;
    missionIndex = 0;
    missionDone = false;
    nextWhale = 0;
    sleeping = false;
    $('#ocean-goodnight').hidden = true;
    sleepEndsAt = mode === 'rolig' && settings.sleep > 0 ? Date.now() + settings.sleep * 60000 : 0;
    closeCard();
    closeAlbum();
    renderMission();
    $('#ocean-album-btn').hidden = mode === 'rolig';
    AU.resetMaster();
    AU.setMusic(settings.music !== 0);
    renderMusicBtn();
    AU.start();
    AU.preload();
    if (mode === 'lar') setTimeout(() => running && Speech.speak('Velkommen til havet! Dra med fingeren for å kjøre ubåten. Trykk på dyrene for å bli kjent med dem.'), 600);
    if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    inside = null;
    IN.close();
    closeMap();
    closeCard();
    AU.stop();
    Speech.stop();
  }

  window.addEventListener('resize', () => {
    if (running) measure();
  });

  $$('[data-ocean]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.ocean);
  }));
  $('#ocean-wake').addEventListener('click', () => {
    // Våkn opp etter sovetimeren.
    sleeping = false;
    sleepEndsAt = 0;
    AU.fadeTo(1, 2);
    $('#ocean-goodnight').hidden = true;
  });

  P.registerGame('ocean', { screen: 'ocean', setupScreen: 'ocean-setup', start: () => start('lar'), stop });

  // For tester og feilsøking.
  window.PaizonOcean = {
    start,
    get sub() { return sub; },
    get animals() { return animals; },
    get cam() { return cam; },
    get found() { return found; },
    get missionIndex() { return missionIndex; },
    get card() { return cardOpen; },
    get zone() { return zoneKey; },
    tapAnimal,
    get visited() { return visited; },
    get inside() { return inside; },
    get view() { return view; },
    setView,
    enter(key) { enterPlace(D.PLACES.find((pl) => pl.key === key)); },
    exit: exitPlace,
    teleport(x, y) { sub.x = x; sub.y = y; sub.tx = null; cam.x = clamp(x - W / S / 2, 0, D.WORLD.width - W / S); cam.y = y - (H / S) * 0.45; },
  };
})();
