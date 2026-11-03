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
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $, $$ } = P;
  if (!D || !A || !AU) return;

  const settings = P.settings('ocean', { sleep: 0 });

  const canvas = $('#ocean-canvas');
  const ctx = canvas.getContext('2d');
  const wrap = $('#ocean-world');
  const dark = document.createElement('canvas'); // mørket i dypet, med lykt-kjegla skåret ut
  const dctx = dark.getContext('2d');

  let mode = 'lar';
  let running = false;
  let raf = 0;
  let W = 0; // lerretets bredde (CSS-piksler)
  let H = 0;
  let S = 600; // piksler per vh
  let dpr = 1;
  let time = 0;
  let last = 0;
  const cam = { x: 0, y: 0 };
  const sub = { x: 0.9, y: 0.12, vx: 0, vy: 0, dir: 1, tx: null, ty: null };
  let animals = [];
  let kelpList = [];
  let rocks = [];
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
      for (let i = 0; i < sp.count; i++) animals.push(makeAnimal(sp, i));
    }
    // Tare langs kysten der det er 5–35 meter dypt.
    kelpList = [];
    for (let x = 0.3; x < 1.7; x += 0.035 + rnd() * 0.03) {
      const d = D.depthAt(D.seabedAt(x));
      // Taren blir aldri høyere enn vannet er dypt (den skal ikke stikke opp i lufta).
      const maxH = (D.seabedAt(x) - 0.04) * 0.85;
      if (d > 4 && d < 36 && maxH > 0.06) kelpList.push({ x, h: Math.min(maxH, 0.25 + rnd() * 0.4), phase: rnd() * 6, shade: rnd() });
    }
    // Steiner langs bunnen.
    rocks = [];
    for (let x = 0.1; x < D.WORLD.width; x += 0.08 + rnd() * 0.25) {
      rocks.push({ x, r: 0.02 + rnd() * 0.07, flat: 0.45 + rnd() * 0.3, tone: rnd() });
    }
    snow = Array.from({ length: 140 }, () => ({ x: rnd(), y: rnd(), z: 0.3 + rnd() * 0.9, r: 0.5 + rnd() * 1.3 }));
  }

  function makeAnimal(sp, i) {
    const p = sp.place;
    const a = { sp, phase: rnd() * 10, scale: 0.85 + rnd() * 0.3, dir: rnd() < 0.5 ? -1 : 1, glowUntil: 0, flash: 0 };
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
        if (a.size < 0.12 && Math.hypot(a.x - sub.x, a.y - sub.y) < 0.18) {
          a.dir = a.x < sub.x ? -1 : 1;
          a.y += (a.y < sub.y ? -1 : 1) * 0.08 * dt;
        }
      }
      // Hold dyret i vannet: under overflaten og over bunnen.
      const floor = D.seabedAt(a.x) - a.size * (isJelly(k) ? 0.9 : 0.3) - 0.02;
      const top = k === 'seal' || k === 'porpoise' ? 0.03 : 0.04 + a.size * 0.25;
      a.y = clamp(a.y, top, Math.max(top, floor));
      a.x = clamp(a.x, 0.05, D.WORLD.width - 0.05);
    }
  }

  // ---------- Ubåten ----------
  function updateSub(dt) {
    const maxSpeed = mode === 'rolig' ? 0.22 : 0.42;
    // Rolig-modus: autopilot glir rolig rundt når ingen har rørt skjermen på en stund.
    if (mode === 'rolig' && !pointer && time - lastInput > 6 && (sub.tx == null || Math.hypot(sub.tx - sub.x, sub.ty - sub.y) < 0.05)) {
      const zx = clamp(sub.x + (rnd() - 0.5) * 1.6, 0.4, D.WORLD.width - 0.4);
      sub.tx = zx;
      sub.ty = clamp(sub.y + (rnd() - 0.45) * 0.6, 0.08, D.seabedAt(zx) - 0.15);
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
    sub.x = clamp(sub.x, 0.15, D.WORLD.width - 0.15);
    sub.y = clamp(sub.y, 0.04, D.seabedAt(sub.x) - 0.07);
    if (Math.abs(sub.vx) > 0.02) sub.dir = sub.vx > 0 ? 1 : -1;
    // Bobler fra propellen.
    const speed = Math.hypot(sub.vx, sub.vy);
    if (speed > 0.05 && time - lastBubble > 0.12 / Math.min(3, speed * 6)) {
      lastBubble = time;
      bubbles.push({ x: sub.x - sub.dir * 0.07, y: sub.y + 0.005, r: 0.004 + rnd() * 0.006, vy: -0.05 - rnd() * 0.05, life: 3 });
      if (rnd() < 0.35) AU.bubble(0.6);
      // Lysende plankton glitrer der ubåten kjører i det mørke dypet.
      if (D.depthAt(sub.y) > 250 && rnd() < 0.6) sparks.push({ x: sub.x - sub.dir * 0.06 + (rnd() - 0.5) * 0.08, y: sub.y + (rnd() - 0.5) * 0.08, life: 1.2 + rnd() });
    }
  }

  function updateCamera(dt) {
    const vw = W / S;
    const tx = sub.x - vw / 2 + sub.vx * 0.6;
    const ty = sub.y - 0.45 + sub.vy * 0.4;
    cam.x += (tx - cam.x) * Math.min(1, dt * 2.5);
    cam.y += (ty - cam.y) * Math.min(1, dt * 2.5);
    cam.x = clamp(cam.x, 0, Math.max(0, D.WORLD.width - vw));
    cam.y = clamp(cam.y, -D.WORLD.sky, D.WORLD.height + 0.05 - 1);
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
    // Lysmønster (kaustikk) på grunn bunn.
    if (d < 60) {
      const tile = A.causticTile(160);
      const pat = ctx.createPattern(tile, 'repeat');
      if (pat) {
        ctx.save();
        ctx.clip(path);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.35 * D.lightAt(d);
        for (const [sp, ox] of [[0.05, 0], [-0.04, 60]]) {
          pat.setTransform(new DOMMatrix().translate(-cam.x * S + time * S * sp + ox, -cam.y * S + time * S * sp * 0.6).scale(S / 260));
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
      const color = rgb(mix(hex('#6f6a24'), hex('#4b5a22'), k.shade));
      A.kelp(ctx, x, sy(D.seabedAt(k.x)) + 2, k.h * S, time, k.phase, color);
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
    const draw = (x, y, scale, ph) => {
      ctx.save();
      ctx.translate(x, y);
      if (!isJelly(k) && k !== 'coral' && k !== 'wreck' && k !== 'bottle') ctx.scale(a.dir, 1);
      if (a.sp.place.type === 'bottom' && k !== 'coral' && k !== 'wreck') ctx.translate(0, -L * (k === 'crab' ? 0.2 : k === 'urchin' ? 0 : 0.08));
      art(ctx, L * scale, time + ph);
      ctx.restore();
    };
    const x = sx(a.x);
    const y = sy(a.y);
    if (a.members) {
      for (const m of a.members) {
        draw(x + (m.ox + Math.sin(time * 0.8 + m.ph) * a.size * 0.4) * S, y + (m.oy + Math.cos(time * 0.6 + m.ph) * a.size * 0.3) * S, m.s, m.ph);
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
    for (const a of vis) if (a.sp.place.type !== 'sky') drawAnimal(a, false);
    return vis;
  }

  function drawSub() {
    const L = 0.13 * S;
    ctx.save();
    ctx.translate(sx(sub.x), sy(sub.y) + Math.sin(time * 1.5) * S * 0.004);
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
      const lx = sx(sub.x + sub.dir * 0.06) / 2;
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
      const lx = sx(sub.x + sub.dir * 0.06);
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
    drawGodRays();
    drawKelp();
    drawSeabed();
    const vis = drawWorldObjects();
    drawSub();
    drawSnow(dt);
    drawSurface();
    drawDarkness();
    drawGlows(vis);
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
    last = now;
    time += dt;
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
    raf = requestAnimationFrame(loop);
  }

  /** Etterklang: mer «rom» ved vraket, revet og nær bunnen i dypet. */
  function roomAt(x, y) {
    let room = 0;
    for (const a of animals) {
      if (a.sp.kind !== 'wreck' && a.sp.kind !== 'coral') continue;
      const d = Math.hypot(a.x - x, a.y - y);
      room = Math.max(room, clamp(1 - d / 0.8, 0, 1));
    }
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
    const ok = m.depth ? depth >= m.depth : m.species.some((k) => found.has(k));
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
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    AU.start();
    lastInput = time;
    if (sleeping) return;
    const p = toWorld(e);
    pointer = { id: e.pointerId, x0: p.px, y0: p.py, moved: false, hit: animalAt(p) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (!pointer.hit) {
      sub.tx = p.x;
      sub.ty = p.y;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
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
    if (!pointer || e.pointerId !== pointer.id) return;
    if (!pointer.moved && pointer.hit) tapAnimal(pointer.hit);
    pointer = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { pointer = null; });

  function tapAnimal(a) {
    const sp = a.sp;
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
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    S = H;
  }

  function start(newMode) {
    mode = newMode || 'lar';
    P.show('ocean');
    document.body.dataset.oceanMode = mode;
    measure();
    found = new Set();
    buildWorld();
    sub.x = 0.9;
    sub.y = 0.1;
    sub.vx = sub.vy = 0;
    sub.tx = sub.ty = null;
    sub.dir = 1;
    cam.x = clamp(sub.x - W / S / 2, 0, D.WORLD.width - W / S);
    cam.y = sub.y - 0.45;
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
    teleport(x, y) { sub.x = x; sub.y = y; sub.tx = null; cam.x = clamp(x - W / S / 2, 0, D.WORLD.width - W / S); cam.y = y - 0.45; },
  };
})();
