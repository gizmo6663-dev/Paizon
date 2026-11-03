/*
 * Skogen – gå langs en sti gjennom norsk skog, til ulike tider på døgnet og i alle årstider.
 * Trykk på dyr og planter, kikk under steiner og inn i hule trær, følg spor i snøen og lytt
 * etter hvem som synger. Moduser: Lær (oppdrag og opplesning), Oppdag (fotobok og
 * hemmeligheter) og Rolig (oppdageren går av seg selv, ingen tekst).
 */
(function () {
  'use strict';

  const P = window.Paizon;
  const D = window.PaizonForestData;
  const FA = window.PaizonForestArt;
  const C = window.PaizonCreatures;
  const X = window.PaizonExplore;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $, $$ } = P;
  const { clamp, lerp, shade, mixHex, lin, rad, seeded } = X;
  const TAU = Math.PI * 2;

  const month = new Date().getMonth();
  const seasonNow = month <= 1 || month === 11 ? 'vinter' : month <= 4 ? 'var' : month <= 7 ? 'sommer' : 'host';
  const settings = P.settings('forest', { season: 'na', time: 'dag', music: 1, sleep: 0 });

  const canvas = $('#forest-canvas');
  let ctx = canvas.getContext('2d');
  const wrap = $('#forest-world');
  const dark = document.createElement('canvas');
  const dctx = dark.getContext('2d');
  const audio = X.makeAudio();
  const card = X.Card(wrap);
  const banner = X.Banner(wrap);
  const sleep = X.Sleep(wrap, audio);
  const album = X.Album(wrap, {
    title: '📖 Fotoboka', storeKey: 'forest.album', entries: D.SPECIES,
    drawThumb: (c, w, h, e, got) => drawPortrait(c, w, h, e, 1, true, !got),
    onPick: (e) => openCard(e, false),
  });

  let mode = 'lar';
  let running = false;
  let raf = 0;
  let W = 0;
  let H = 0;
  let S = 600;
  let dpr = 1;
  let time = 0;
  let last = 0;
  let tod = 'dag';
  let season = 'sommer';
  let skyBlend = null; // jevn overgang mellom tider på døgnet
  const cam = { x: 0 };
  const walker = { x: 1.2, tx: null, dir: 1, walking: 0, idle: 0 };
  let trees = [];
  let midTrees = [];
  const mid = document.createElement('canvas');
  const mctx = mid.getContext('2d');
  let animals = [];
  let details = [];
  let particles = [];
  let hideouts = [];
  let found = new Set();
  let opened = new Set();
  let missionIndex = 0;
  let missionDone = false;
  let pointer = null;
  let lastInput = 0;
  let nextCall = 0;
  let listen = null;
  const rnd = seeded(7);
  const range = ([a, b]) => a + rnd() * (b - a);
  const sx = (x) => (x - cam.x) * S;
  const gy = (x) => D.groundAt(x) * S;

  // ---------- Himmel og lys ----------
  const SKY = {
    morgen: { top: '#7fa6d6', bottom: '#f6c8a8', haze: '#d8c4c0', light: 0.85, tint: 'rgba(255,170,120,0.10)', dark: 0.05 },
    dag: { top: '#5f9fdc', bottom: '#cfe6f4', haze: '#b8d0de', light: 1, tint: 'rgba(255,255,255,0)', dark: 0 },
    kveld: { top: '#3a4a8a', bottom: '#f39a5a', haze: '#b07a7a', light: 0.6, tint: 'rgba(255,120,60,0.12)', dark: 0.25 },
    natt: { top: '#070d24', bottom: '#1c2c52', haze: '#24324e', light: 0.2, tint: 'rgba(20,30,80,0.15)', dark: 0.62 },
  };
  function skyNow() {
    const to = SKY[tod];
    if (!skyBlend) return to;
    const f = clamp((time - skyBlend.t0) / 2.5, 0, 1);
    if (f >= 1) {
      skyBlend = null;
      return to;
    }
    const from = skyBlend.from;
    return {
      top: mixHex(from.top, to.top, f), bottom: mixHex(from.bottom, to.bottom, f), haze: mixHex(from.haze, to.haze, f),
      light: lerp(from.light, to.light, f), tint: f < 0.5 ? from.tint : to.tint, dark: lerp(from.dark, to.dark, f),
    };
  }

  // ---------- Verden ----------
  function buildWorld() {
    const r = seeded(11);
    trees = [];
    for (let x = -0.3; x < D.WORLD.width + 0.5; x += 0.22 + r() * 0.4) {
      if (D.HIDEOUTS.some((h) => Math.abs(h.x - x) < 0.4)) continue;
      const t = r();
      const type = t < 0.55 ? 'gran' : t < 0.8 ? 'bjork' : 'furu';
      const young = r() < 0.3;
      trees.push({ x, type, h: young ? 0.35 + r() * 0.25 : 0.85 + r() * 0.5, variant: Math.floor(r() * 4), back: r() < 0.45 });
    }
    // Store stammer helt foran (de glir forbi raskere enn alt annet).
    trees.front = [];
    for (let x = 4; x < D.WORLD.width; x += 6 + r() * 5) trees.front.push({ x, w: 0.035 + r() * 0.025, type: r() < 0.6 ? 'gran' : 'bjork' });
    // Et lag med trær litt lenger inne i skogen (blasse i lufta mellom oss og dem).
    midTrees = [];
    for (let x = -1; x < D.WORLD.width * 0.75 + 2; x += 0.12 + r() * 0.2) midTrees.push({ x, h: 0.45 + r() * 0.35, variant: Math.floor(r() * 4), type: r() < 0.8 ? 'gran' : 'bjork' });
    hideouts = D.HIDEOUTS.map((h) => ({ ...h, open: 0, openUntil: 0 }));
    details = [];
    for (let x = 0; x < D.WORLD.width; x += 0.04 + r() * 0.08) {
      const k = r();
      details.push({ x, kind: k < 0.45 ? 'grass' : k < 0.6 ? 'stone' : k < 0.75 ? 'fern' : 'flower', s: 0.02 + r() * 0.03, ph: r() * 6, hue: r() });
    }
    particles = Array.from({ length: 70 }, () => ({ x: r(), y: r(), s: 0.5 + r(), ph: r() * 6, z: 0.6 + r() * 0.8 }));
  }

  /** Lag dyrene som er ute nå (kalles når tid eller årstid endres). */
  function placeAnimals() {
    animals = [];
    for (const sp of D.SPECIES) {
      if (['hidden', 'thing'].includes(sp.place)) continue;
      if (sp.secret && mode !== 'oppdag') continue;
      if (!D.present(sp, tod, season)) continue;
      for (let i = 0; i < (sp.count || 1); i++) animals.push(makeAnimal(sp, i));
    }
    // Om vinteren: haren har gått et langt stykke – sporene leder fram til den.
    if (season === 'vinter') {
      for (const a of animals) {
        if (a.sp.place !== 'ground' || !a.sp.move) continue;
        a.tracks = [];
        const from = a.x - 3 - rnd() * 2;
        for (let x = from; x < a.x; x += 0.09) a.tracks.push({ x, side: a.tracks.length % 2 });
      }
    }
  }

  function makeAnimal(sp, i) {
    const a = { sp, id: `${sp.key}-${i}`, phase: rnd() * 10, dir: rnd() < 0.5 ? -1 : 1, face: 1, glowUntil: 0, state: 'walk', stateUntil: 0, flee: 0, tracks: null, lastTrack: 0 };
    a.size = sp.size * (0.85 + rnd() * 0.3);
    a.x = range(sp.x);
    if (sp.place === 'tree' || sp.place === 'trunk') {
      const options = trees.filter((t) => t.x > sp.x[0] && t.x < sp.x[1] && t.h > 0.5);
      const t = options[Math.floor(rnd() * options.length)] || trees[0];
      a.tree = t;
      a.x = t.x + (sp.place === 'trunk' ? (rnd() < 0.5 ? -1 : 1) * 0.012 : (rnd() - 0.5) * 0.2);
      a.h = sp.place === 'trunk' ? 0.12 + rnd() * 0.25 : 0.25 + rnd() * 0.3; // høyde over bakken
      a.dir = sp.place === 'trunk' ? (a.x < t.x ? -1 : 1) : a.dir;
    } else if (sp.place === 'air') {
      a.h = sp.kind === 'sommerfugl' ? 0.08 + rnd() * 0.15 : 0.35 + rnd() * 0.25;
      a.cx = a.x;
    } else if (sp.place === 'pond') {
      const pond = D.HIDEOUTS.find((h) => h.kind === 'pond');
      a.x = pond.x + (i ? 0.18 : -0.12);
      a.h = 0;
    } else {
      a.h = 0;
    }
    a.face = a.dir;
    return a;
  }

  // ---------- Oppdatering ----------
  function updateWalker(dt) {
    if (mode === 'rolig' && !pointer && time - lastInput > 5 && walker.tx == null) {
      walker.tx = clamp(walker.x + (walker.x > D.WORLD.width - 3 ? -1 : walker.x < 3 ? 1 : walker.dir) * (2 + rnd() * 3), 0.4, D.WORLD.width - 0.4);
    }
    if (walker.tx != null) {
      const dx = walker.tx - walker.x;
      if (Math.abs(dx) < 0.02) {
        walker.tx = null;
      } else {
        walker.dir = Math.sign(dx);
        walker.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * (mode === 'rolig' ? 0.18 : 0.32));
      }
    }
    walker.walking += ((walker.tx != null ? 1 : 0) - walker.walking) * Math.min(1, dt * 6);
    walker.x = clamp(walker.x, 0.3, D.WORLD.width - 0.3);
  }

  function updateAnimals(dt) {
    for (const a of animals) {
      const sp = a.sp;
      a.face += (a.dir - a.face) * Math.min(1, dt * 4);
      if (sp.place === 'ground' && sp.move) {
        const d = Math.abs(a.x - walker.x);
        if (sp.shy && d < 0.55 && !a.flee) {
          a.flee = 1;
          a.dir = a.x < walker.x ? -1 : 1;
        }
        if (a.flee && d > 1.6) a.flee = 0;
        if (time > a.stateUntil && !a.flee) {
          a.state = rnd() < 0.45 ? 'graze' : 'walk';
          a.stateUntil = time + 3 + rnd() * 6;
          if (a.state === 'walk' && rnd() < 0.4) a.dir *= -1;
        }
        const moving = a.flee || a.state === 'walk';
        a.gait = lerp(a.gait || 0, moving ? 1 : 0, Math.min(1, dt * 4));
        a.x += a.dir * sp.move * (a.flee ? 4 : 1) * a.gait * dt;
        if (a.x < sp.x[0]) a.dir = 1;
        if (a.x > sp.x[1]) a.dir = -1;
        a.x = clamp(a.x, 0.1, D.WORLD.width - 0.1);
        // Spor i snøen.
        if (a.tracks && Math.abs(a.x - a.lastTrack) > 0.09) {
          a.lastTrack = a.x;
          a.tracks.push({ x: a.x, side: a.tracks.length % 2 });
          if (a.tracks.length > 80) a.tracks.shift();
        }
      } else if (sp.place === 'trunk' && sp.kind === 'ekorn') {
        a.h += Math.sin(time * 0.6 + a.phase) * 0.04 * dt;
        a.h = clamp(a.h, 0.05, 0.45);
      } else if (sp.place === 'air') {
        const r = sp.kind === 'sommerfugl' ? 0.3 : 0.9;
        const sp2 = sp.kind === 'sommerfugl' ? 0.5 : 0.8;
        const nx = a.cx + Math.sin(time * sp2 * 0.5 + a.phase) * r;
        a.dir = nx > a.x ? 1 : -1;
        a.x = nx;
        a.hy = Math.sin(time * sp2 * 1.3 + a.phase) * 0.05;
      }
    }
  }

  function updateCamera(dt) {
    const vw = W / S;
    const tx = walker.x - vw * 0.42 + walker.dir * 0.1;
    cam.x += (tx - cam.x) * Math.min(1, dt * 2);
    cam.x = clamp(cam.x, 0, Math.max(0, D.WORLD.width - vw));
  }

  // ---------- Tegning ----------
  function drawSky(sky) {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.75);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Stjerner og nordlys om natta.
    if (tod === 'natt' || tod === 'kveld') {
      const a = tod === 'natt' ? 1 : 0.3;
      const r = seeded(3);
      for (let i = 0; i < 120; i++) {
        const x = ((r() * W * 1.5 - cam.x * S * 0.02) % W + W) % W;
        const y = r() * H * 0.55;
        ctx.fillStyle = `rgba(255,255,240,${a * (0.3 + 0.5 * Math.abs(Math.sin(time * 0.8 + i)))})`;
        ctx.fillRect(x, y, 1.5, 1.5);
      }
      if (tod === 'natt' && season === 'vinter') drawAurora();
    }
    // Sol eller måne.
    const pos = { morgen: [0.15, 0.4], dag: [0.7, 0.12], kveld: [0.85, 0.42], natt: [0.75, 0.15] }[tod];
    const x = W * pos[0];
    const y = H * pos[1];
    if (tod === 'natt') {
      ctx.fillStyle = rad(ctx, x, y, 0, S * 0.12, [[0, 'rgba(230,236,255,0.25)'], [1, 'rgba(230,236,255,0)']]);
      ctx.fillRect(x - S * 0.12, y - S * 0.12, S * 0.24, S * 0.24);
      ctx.fillStyle = '#eef0f6';
      ctx.beginPath();
      ctx.arc(x, y, S * 0.035, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(180,186,200,0.5)';
      ctx.beginPath();
      ctx.arc(x - S * 0.01, y - S * 0.008, S * 0.008, 0, TAU);
      ctx.arc(x + S * 0.012, y + S * 0.01, S * 0.006, 0, TAU);
      ctx.fill();
    } else {
      const col = tod === 'dag' ? '255,250,225' : '255,200,140';
      ctx.fillStyle = rad(ctx, x, y, 0, S * 0.25, [[0, `rgba(${col},0.55)`], [1, `rgba(${col},0)`]]);
      ctx.fillRect(x - S * 0.25, y - S * 0.25, S * 0.5, S * 0.5);
      ctx.fillStyle = `rgb(${col})`;
      ctx.beginPath();
      ctx.arc(x, y, S * 0.045, 0, TAU);
      ctx.fill();
    }
    // Skyer.
    if (tod !== 'natt') {
      ctx.fillStyle = tod === 'kveld' ? 'rgba(255,200,170,0.6)' : 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 5; i++) {
        const cx = (((i * 0.31 + time * 0.003) % 1.4) - 0.2) * W - cam.x * S * 0.03;
        const cy = H * (0.08 + (i % 3) * 0.07);
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(cx + k * S * 0.045, cy + Math.sin(k * 1.7) * S * 0.01, S * 0.06, S * 0.025, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawAurora() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      ctx.beginPath();
      for (let px = 0; px <= W; px += 12) {
        const y = H * (0.12 + band * 0.06) + Math.sin(px * 0.006 + time * 0.25 + band) * H * 0.05;
        if (px) ctx.lineTo(px, y);
        else ctx.moveTo(px, y);
      }
      for (let px = W; px >= 0; px -= 12) {
        const y = H * (0.3 + band * 0.06) + Math.sin(px * 0.005 + time * 0.2 + band * 2) * H * 0.04;
        ctx.lineTo(px, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.4);
      g.addColorStop(0, 'rgba(120,255,170,0)');
      g.addColorStop(0.6, `rgba(90,240,150,${0.12 + 0.05 * Math.sin(time * 0.5 + band)})`);
      g.addColorStop(1, 'rgba(120,120,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDistance(sky) {
    // Fjell langt borte.
    const mcol = mixHex(sky.haze, '#4a5a6a', 0.35);
    ctx.fillStyle = mcol;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = 0; px <= W + 10; px += 10) {
      const wx = cam.x * 0.06 + px / S;
      ctx.lineTo(px, H * (0.5 - 0.12 * (0.6 + 0.3 * Math.sin(wx * 1.7 + 1) + 0.1 * Math.sin(wx * 5.3))));
    }
    ctx.lineTo(W, H);
    ctx.fill();
    if (season === 'vinter' || season === 'var') {
      // Snø på fjelltoppene.
      ctx.fillStyle = 'rgba(245,248,252,0.7)';
      ctx.beginPath();
      for (let px = 0; px <= W + 10; px += 10) {
        const wx = cam.x * 0.06 + px / S;
        const y = H * (0.5 - 0.12 * (0.6 + 0.3 * Math.sin(wx * 1.7 + 1) + 0.1 * Math.sin(wx * 5.3)));
        if (px) ctx.lineTo(px, y);
        else ctx.moveTo(px, y);
      }
      for (let px = W + 10; px >= 0; px -= 10) {
        const wx = cam.x * 0.06 + px / S;
        const y = H * (0.5 - 0.12 * (0.6 + 0.3 * Math.sin(wx * 1.7 + 1) + 0.1 * Math.sin(wx * 5.3)));
        ctx.lineTo(px, Math.min(y + H * 0.04, H * 0.44));
      }
      ctx.fill();
    }
    // To rekker med skog langt borte: blassere jo lenger unna.
    const green = FA.PALETTE[season].spruce;
    [[0.18, 0.62, 0.55, 0.12, 5], [0.4, 0.7, 0.35, 0.16, 9]].forEach(([par, base, haze, hgt, seed]) => {
      const col = mixHex(green, sky.haze, haze);
      const tileW = Math.round(S * 2.2);
      const tile = FA.treeLine(tileW, Math.round(S * hgt), col, seed);
      const off = ((cam.x * par * S) % tileW + tileW) % tileW;
      for (let x = -off; x < W; x += tileW) ctx.drawImage(tile, x, H * base - tile.height);
      ctx.fillStyle = col;
      ctx.fillRect(0, H * base - 1, W, H * (1 - base) + 1);
    });
    // Morgentåke.
    if (tod === 'morgen') {
      const g = ctx.createLinearGradient(0, H * 0.5, 0, H * 0.75);
      g.addColorStop(0, 'rgba(240,235,235,0)');
      g.addColorStop(0.5, `rgba(240,235,235,${0.45 + 0.08 * Math.sin(time * 0.3)})`);
      g.addColorStop(1, 'rgba(240,235,235,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.5, W, H * 0.25);
    }
  }

  function drawTree(t) {
    const x = sx(t.x);
    const hpx = t.h * S;
    if (x < -hpx || x > W + hpx) return;
    const img = t.type === 'gran' ? FA.spruce(Math.round(hpx / 8) * 8, season, t.variant)
      : t.type === 'bjork' ? FA.birch(Math.round(hpx / 8) * 8, season, t.variant)
        : FA.pine(Math.round(hpx / 8) * 8, season, t.variant);
    const sway = Math.sin(time * 0.5 + t.x) * 0.006;
    ctx.save();
    ctx.translate(x, gy(t.x) + 2);
    ctx.transform(1, 0, sway, 1, 0, 0);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }

  function drawMidLayer(sky) {
    if (mid.width !== canvas.width || mid.height !== canvas.height) {
      mid.width = canvas.width;
      mid.height = canvas.height;
    }
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, mid.width, mid.height);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const par = 0.72;
    for (const t of midTrees) {
      const x = (t.x - cam.x * par) * S;
      const hpx = t.h * S;
      if (x < -hpx || x > W + hpx) continue;
      const img = t.type === 'gran' ? FA.spruce(Math.round(hpx / 8) * 8, season, t.variant) : FA.birch(Math.round(hpx / 8) * 8, season, t.variant);
      mctx.drawImage(img, x - img.width / 2, H * 0.74 - img.height);
    }
    mctx.globalCompositeOperation = 'source-atop';
    mctx.fillStyle = mixHex(sky.haze, '#000000', 0.05);
    mctx.globalAlpha = 0.45;
    mctx.fillRect(0, 0, W, H);
    mctx.globalAlpha = 1;
    mctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(mid, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Bakken mellom laget og stien.
    ctx.fillStyle = mixHex(FA.PALETTE[season].moss, sky.haze, 0.35);
    ctx.fillRect(0, H * 0.735, W, H * 0.3);
  }

  function groundPath() {
    const p = new Path2D();
    p.moveTo(-10, H + 10);
    for (let px = -10; px <= W + 10; px += 8) p.lineTo(px, gy(cam.x + px / S));
    p.lineTo(W + 10, H + 10);
    p.closePath();
    return p;
  }

  function drawGround(sky) {
    const pal = FA.PALETTE[season];
    const p = groundPath();
    const g = ctx.createLinearGradient(0, H * 0.75, 0, H);
    g.addColorStop(0, shade(pal.moss, 0.05));
    g.addColorStop(1, shade(pal.ground, -0.3));
    ctx.fillStyle = g;
    ctx.fill(p);
    drawPond(sky);
    // Stien.
    ctx.beginPath();
    for (let px = -10; px <= W + 10; px += 8) ctx.lineTo(px, gy(cam.x + px / S) + S * 0.045);
    for (let px = W + 10; px >= -10; px -= 8) ctx.lineTo(px, gy(cam.x + px / S) + S * 0.1);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, H * 0.82, 0, H * 0.92, [[0, shade(pal.path, 0.1)], [1, shade(pal.path, -0.15)]]);
    ctx.fill();
    // Detaljer: gress, steiner, bregner og blomster.
    for (const d of details) {
      const x = sx(d.x);
      if (x < -20 || x > W + 20) continue;
      const y = gy(d.x) + 2;
      const s = d.s * S;
      if (d.kind === 'grass') {
        ctx.strokeStyle = shade(pal.grass, -0.2 + d.hue * 0.3);
        ctx.lineWidth = 1.2;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(x + k * 2, y);
          ctx.quadraticCurveTo(x + k * 2 + Math.sin(time + d.ph + k) * s * 0.2, y - s * 0.5, x + k * 3 - 3, y - s);
          ctx.stroke();
        }
      } else if (d.kind === 'stone') {
        ctx.fillStyle = rad(ctx, x - s * 0.2, y - s * 0.3, 0, s, [[0, '#9a968c'], [1, '#55524a']]);
        ctx.beginPath();
        ctx.ellipse(x, y, s * 0.6, s * 0.35, 0, Math.PI, TAU);
        ctx.fill();
        if (season === 'vinter') {
          ctx.fillStyle = '#f4f8fb';
          ctx.beginPath();
          ctx.ellipse(x, y - s * 0.3, s * 0.45, s * 0.1, 0, 0, TAU);
          ctx.fill();
        }
      } else if (d.kind === 'fern' && season !== 'vinter') {
        ctx.strokeStyle = season === 'host' ? '#b07a30' : '#4e7a2a';
        ctx.lineWidth = 1.4;
        for (let k = -2; k <= 2; k++) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(x + k * s * 0.3, y - s * 1.2, x + k * s * 0.7 + Math.sin(time * 0.8 + d.ph) * s * 0.1, y - s * 0.7);
          ctx.stroke();
        }
      } else if (d.kind === 'flower' && (season === 'var' || season === 'sommer')) {
        ctx.strokeStyle = '#4e7a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - s * 0.8);
        ctx.stroke();
        ctx.fillStyle = season === 'var' ? '#f6f4f0' : ['#e84a6a', '#f0d040', '#9a6ad0', '#f6f4f0'][Math.floor(d.hue * 4)];
        ctx.beginPath();
        ctx.arc(x, y - s * 0.8, s * 0.15, 0, TAU);
        ctx.fill();
      } else if (season === 'host' && d.kind === 'flower') {
        ctx.fillStyle = ['#d8822a', '#c0502a', '#e0b030'][Math.floor(d.hue * 3)];
        ctx.beginPath();
        ctx.ellipse(x, y - 1, s * 0.15, s * 0.07, d.ph, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawPond(sky) {
    const h = hideouts.find((o) => o.kind === 'pond');
    const x = sx(h.x);
    const L = hideSize(h) * S;
    if (x < -L || x > W + L) return;
    h.open += ((time < h.openUntil ? 1 : 0) - h.open) * 0.08;
    ctx.save();
    ctx.translate(x, gy(h.x) + S * 0.02);
    FA.HIDEOUT_ART.pond(ctx, L, time, { open: h.open, snow: season === 'vinter', sky: sky.top });
    if (h.open > 0.2 && h.peek) {
      const sp = D.SPECIES.find((o) => o.key === h.peek);
      ctx.globalAlpha = Math.min(1, (h.open - 0.2) * 2);
      ctx.translate(L * 0.1, 0);
      C.ART[sp.kind](ctx, sp.size * S * 1.4, time);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHideouts() {
    const snow = season === 'vinter';
    const sky = skyNow();
    for (const h of hideouts) {
      const x = sx(h.x);
      if (h.kind === 'pond') continue; // dammen tegnes sammen med bakken (bak stien)
      const L = hideSize(h) * S;
      if (x < -L || x > W + L) continue;
      h.open += ((time < h.openUntil ? 1 : 0) - h.open) * 0.08;
      ctx.save();
      ctx.translate(x, gy(h.x) + 3);
      FA.HIDEOUT_ART[h.kind](ctx, L, time, { open: h.open, snow, sky: sky.top });
      // Det som gjemte seg, kikker fram.
      if (h.open > 0.2 && h.peek) {
        const sp = D.SPECIES.find((s) => s.key === h.peek);
        const art = C.ART[sp.kind];
        const peekY = h.kind === 'hollow' ? -L * 0.55 : h.kind === 'pond' ? 0 : -L * 0.05;
        ctx.globalAlpha = Math.min(1, (h.open - 0.2) * 2);
        ctx.translate(h.kind === 'hollow' ? 0 : L * 0.1, peekY + (h.kind === 'hollow' ? L * 0.1 : 0));
        art(ctx, sp.size * S * (h.kind === 'hollow' ? 0.8 : 1.4), time);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
      // Et lite glimt viser at det går an å kikke her.
      if (mode !== 'rolig' && !opened.has(h.key) && Math.sin(time * 1.5 + h.x * 3) > 0.92) {
        ctx.fillStyle = 'rgba(255,255,220,0.9)';
        star(x + L * 0.25, gy(h.x) - L * (h.kind === 'hollow' ? 0.6 : 0.35), 7);
      }
    }
  }

  const hideSize = (h) => (h.kind === 'pond' ? 0.6 : h.kind === 'hollow' ? 0.62 : 0.3);

  function star(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r * 0.25, y - r * 0.25);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x + r * 0.25, y + r * 0.25);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r * 0.25, y + r * 0.25);
    ctx.lineTo(x - r, y);
    ctx.lineTo(x - r * 0.25, y - r * 0.25);
    ctx.fill();
  }

  function animalPos(a) {
    const g = D.groundAt(a.tree ? a.tree.x : a.x);
    return { x: a.x, y: g - a.h + (a.hy || 0) };
  }

  function drawTracks() {
    if (season !== 'vinter') return;
    ctx.fillStyle = 'rgba(120,140,170,0.45)';
    for (const a of animals) {
      if (!a.tracks) continue;
      for (const tr of a.tracks) {
        const x = sx(tr.x);
        if (x < -10 || x > W + 10) continue;
        const y = gy(tr.x) + S * (0.055 + tr.side * 0.02);
        ctx.beginPath();
        ctx.ellipse(x, y, S * 0.008, S * 0.004, 0, 0, TAU);
        ctx.ellipse(x + S * 0.012, y + S * 0.002, S * 0.005, S * 0.003, 0, 0, TAU);
        ctx.fill();
      }
    }
  }

  function drawAnimals(layerFilter) {
    for (const a of animals) {
      if (!layerFilter(a)) continue;
      const p = animalPos(a);
      const L = a.size * S;
      const x = sx(p.x);
      const y = p.y * S;
      if (x < -L * 2 || x > W + L * 2) continue;
      const art = C.ART[a.sp.kind];
      ctx.save();
      ctx.translate(x, y);
      if (a.sp.place === 'ground' && a.sp.move) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(0, 1, L * 0.4, L * 0.05, 0, 0, TAU);
        ctx.fill();
      }
      const f = Math.sign(a.face || 1) * Math.max(0.15, Math.abs(a.face));
      if (a.sp.kind !== 'sommerfugl' && a.sp.kind !== 'flaggermus') ctx.scale(f, 1);
      const pose = a.sp.place === 'air' ? 'fly' : 'perch';
      art(ctx, L, time + a.phase, { gait: a.gait || 0, graze: a.state === 'graze' && !a.flee ? 1 : 0, winter: season === 'vinter', pose });
      ctx.restore();
      if (a.glowUntil > time) {
        const k = (a.glowUntil - time) / 1.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = rad(ctx, x, y - L * 0.3, 0, Math.max(30, L * 0.8), [[0, `rgba(255,255,220,${0.3 * k})`], [1, 'rgba(255,255,220,0)']]);
        ctx.fillRect(x - L, y - L * 1.3, L * 2, L * 2);
        ctx.restore();
      }
    }
  }

  function drawFrontTrunks() {
    for (const t of trees.front) {
      const x = (t.x - cam.x * 1.35) * S + W * 0.35 * 0.35;
      const w = t.w * S;
      if (x < -w * 2 || x > W + w * 2) continue;
      const col = t.type === 'bjork' ? ['#6a6660', '#c8c4bc'] : ['#2a2018', '#5a4632'];
      ctx.fillStyle = lin(ctx, x - w / 2, 0, x + w / 2, 0, [[0, col[0]], [0.35, col[1]], [1, col[0]]]);
      ctx.fillRect(x - w / 2, 0, w, H);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.3 + (k % 3) * w * 0.25, (k / 8) * H);
        ctx.lineTo(x - w * 0.3 + (k % 3) * w * 0.25, (k / 8) * H + H * 0.06);
        ctx.stroke();
      }
    }
    // Bregner (eller snøhauger) helt foran, mørke og store.
    const pal = FA.PALETTE[season];
    for (let i = 0; i < 7; i++) {
      const x = (((i * 0.41) * W * 1.6 - cam.x * S * 1.35) % (W * 1.6) + W * 1.6) % (W * 1.6) - W * 0.3;
      const y = H + S * 0.03;
      const s2 = S * (0.16 + (i % 3) * 0.05);
      if (season === 'vinter') {
        ctx.fillStyle = lin(ctx, 0, y - s2 * 0.4, 0, y, [[0, '#e8eef6'], [1, '#aab8c8']]);
        ctx.beginPath();
        ctx.ellipse(x, y, s2 * 0.9, s2 * 0.35, 0, Math.PI, TAU);
        ctx.fill();
        continue;
      }
      const col = season === 'host' ? '#6a4a1e' : shade(pal.ground, -0.55);
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      for (let k = -3; k <= 3; k++) {
        const a = -Math.PI / 2 + k * 0.32 + Math.sin(time * 0.6 + i + k) * 0.03;
        const len = s2 * (1 - Math.abs(k) * 0.12);
        const ex = x + Math.cos(a) * len;
        const ey = y + Math.sin(a) * len;
        const mx = x + Math.cos(a + 0.25 * Math.sign(k || 1)) * len * 0.55;
        const my = y + Math.sin(a + 0.25 * Math.sign(k || 1)) * len * 0.55;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(mx, my, ex, ey);
        ctx.stroke();
        // Småblader langs stilken.
        for (let j = 1; j < 9; j++) {
          const u = j / 9;
          const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * mx + u * u * ex;
          const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * my + u * u * ey;
          const lw = len * 0.14 * (1 - u * 0.7);
          ctx.beginPath();
          ctx.ellipse(px, py, lw, lw * 0.3, a + 1.2, 0, TAU);
          ctx.ellipse(px, py, lw, lw * 0.3, a - 1.2, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  function drawParticles(dt) {
    const kind = season === 'vinter' ? 'snow' : season === 'host' ? 'leaf' : tod === 'dag' || tod === 'morgen' ? 'pollen' : tod === 'natt' && season === 'sommer' ? 'glow' : null;
    if (!kind) return;
    for (const p of particles) {
      p.y += dt * (kind === 'snow' ? 0.05 : kind === 'leaf' ? 0.06 : 0.004) * p.z;
      p.x += dt * Math.sin(time * 0.6 + p.ph) * 0.01;
      if (p.y > 1) p.y -= 1;
      const x = ((p.x * W * 1.5 - cam.x * S * p.z) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
      const y = p.y * H;
      if (kind === 'snow') {
        ctx.fillStyle = `rgba(255,255,255,${0.5 + p.z * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.2 + p.s * p.z * 1.5, 0, TAU);
        ctx.fill();
      } else if (kind === 'leaf') {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * 2 + p.ph);
        ctx.scale(1, Math.sin(time * 3 + p.ph));
        ctx.fillStyle = ['#d8822a', '#c0502a', '#e0b030'][Math.floor(p.ph) % 3];
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 * p.z, 2.4 * p.z, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (kind === 'pollen') {
        ctx.fillStyle = `rgba(255,250,220,${0.35 * p.z})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
  }

  /** Lys og mørke: farget skjær etter tiden på døgnet, og lykta lyser rundt oppdageren i mørket. */
  function drawLight(sky) {
    ctx.fillStyle = sky.tint;
    ctx.fillRect(0, 0, W, H);
    if (sky.dark < 0.03) return;
    const w = Math.ceil(W / 2);
    const h = Math.ceil(H / 2);
    if (dark.width !== w || dark.height !== h) {
      dark.width = w;
      dark.height = h;
    }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, w, h);
    dctx.fillStyle = `rgba(4,8,22,${sky.dark})`;
    dctx.fillRect(0, 0, w, h);
    if (sky.dark > 0.2) {
      dctx.globalCompositeOperation = 'destination-out';
      const lx = sx(walker.x + walker.dir * 0.04) / 2;
      const ly = (D.groundAt(walker.x) - 0.08) * S / 2;
      const R = S * 0.42 / 2;
      dctx.fillStyle = rad(dctx, lx, ly, 0, R, [[0, 'rgba(0,0,0,0.95)'], [0.5, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
      dctx.beginPath();
      dctx.arc(lx, ly, R, 0, TAU);
      dctx.fill();
    }
    ctx.drawImage(dark, 0, 0, W, H);
    if (sky.dark > 0.2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const lx = sx(walker.x + walker.dir * 0.04);
      const ly = (D.groundAt(walker.x) - 0.08) * S;
      ctx.fillStyle = rad(ctx, lx, ly, 0, S * 0.3, [[0, 'rgba(255,220,150,0.18)'], [1, 'rgba(255,220,150,0)']]);
      ctx.fillRect(lx - S * 0.3, ly - S * 0.3, S * 0.6, S * 0.6);
      // Øyne som lyser i mørket når lykta treffer (eller måneskinn).
      for (const a of animals) {
        if (!['rev', 'hare', 'raadyr', 'elg', 'grevling', 'ugle', 'gaupe', 'pinnsvin'].includes(a.sp.kind)) continue;
        const p = animalPos(a);
        const ex = sx(p.x) + Math.sign(a.face || 1) * a.size * S * 0.42;
        const ey = (p.y - a.size * (a.sp.kind === 'ugle' ? 0.85 : 0.45)) * S;
        if (ex < 0 || ex > W) continue;
        const k = 0.4 + 0.4 * Math.sin(time * 0.7 + a.phase);
        ctx.fillStyle = `rgba(200,255,200,${k * 0.6})`;
        ctx.beginPath();
        ctx.arc(ex, ey, 2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // Lysmark om sommernatta.
    if (tod === 'natt' && season === 'sommer') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const x = ((i * 0.173 * W * 2 - cam.x * S) % (W * 1.2) + W * 1.2) % (W * 1.2) - W * 0.1;
        const y = H * (0.6 + Math.sin(time * 0.4 + i) * 0.1);
        const a = Math.max(0, Math.sin(time * 1.3 + i * 2));
        ctx.fillStyle = rad(ctx, x, y, 0, 8, [[0, `rgba(200,255,140,${a * 0.8})`], [1, 'rgba(200,255,140,0)']]);
        ctx.fillRect(x - 8, y - 8, 16, 16);
      }
      ctx.restore();
    }
  }

  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sky = skyNow();
    drawSky(sky);
    drawDistance(sky);
    drawMidLayer(sky);
    for (const t of trees) if (t.back) drawTree(t);
    drawGround(sky);
    drawTracks();
    drawHideouts();
    for (const t of trees) if (!t.back) drawTree(t);
    drawAnimals((a) => a.sp.place === 'trunk' || a.sp.place === 'tree');
    drawAnimals((a) => a.sp.place === 'ground' || a.sp.place === 'pond');
    ctx.save();
    ctx.translate(sx(walker.x), gy(walker.x) + S * 0.075);
    ctx.scale(walker.dir, 1);
    FA.walker(ctx, S * 0.16, time, { walking: walker.walking, lantern: sky.dark > 0.2 });
    ctx.restore();
    drawAnimals((a) => a.sp.place === 'air');
    drawParticles(dt);
    drawFrontTrunks();
    drawLight(sky);
    const dim = sleep.tick();
    if (dim) {
      ctx.fillStyle = `rgba(0,0,0,${dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Løkke ----------
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    updateWalker(dt);
    updateAnimals(dt);
    updateCamera(dt);
    ambience();
    checkMission();
    render(dt);
    raf = requestAnimationFrame(loop);
  }

  /** Lydbildet: vind etter årstid, bekk ved dammen, sirisser og fuglesang fra dyrene som er ute. */
  function ambience() {
    const pond = D.HIDEOUTS.find((h) => h.kind === 'pond');
    audio.set({
      wind: season === 'vinter' ? 0.8 : season === 'host' ? 0.6 : 0.35,
      leaves: season === 'vinter' ? 0 : 0.6,
      stream: season === 'vinter' ? 0 : clamp(1 - Math.abs(walker.x - pond.x) / 3, 0, 1),
      crickets: tod !== 'dag' && season === 'sommer' ? (tod === 'natt' ? 1 : 0.6) : 0,
      night: tod === 'natt',
      room: 0.3,
    });
    if (sleep.sleeping) return;
    if (!nextCall) nextCall = time + 3;
    if (time < nextCall) return;
    nextCall = time + 5 + rnd() * 8;
    const singers = animals.filter((a) => a.sp.sound);
    if (!singers.length) return;
    const a = singers[Math.floor(rnd() * singers.length)];
    playCall(a, 1);
  }

  function playCall(a, volume) {
    const dx = a.x - (cam.x + W / S / 2);
    audio.call(a.sp.sound, { pan: clamp(dx / 2, -1, 1), distance: clamp(Math.abs(dx) / 6, 0, 0.85), volume });
  }

  // ---------- Oppdrag ----------
  function renderMission() {
    const chip = $('#forest-mission');
    if (mode !== 'lar') {
      chip.hidden = true;
      return;
    }
    chip.hidden = false;
    const m = D.MISSIONS[missionIndex];
    chip.textContent = m ? `${m.icon} ${m.text}` : '🌟 Du har gjort alle oppdragene!';
  }
  function checkMission() {
    if (mode !== 'lar' || missionDone) return;
    const m = D.MISSIONS[missionIndex];
    if (!m) return;
    const ok = m.hideouts ? m.hideouts.some((k) => opened.has(k)) : m.species.some((k) => found.has(k) && (!m.season || foundIn.get(k) === m.season));
    if (!ok) return;
    missionDone = true;
    Sound.win();
    window.PaizonConfetti.burst(80);
    setTimeout(() => {
      if (!running) return;
      Speech.speak(`Bra jobba! ${m.text} – klart!`).then(() => {
        const next = D.MISSIONS[missionIndex];
        if (next && next.hint && running) Speech.speak(`${next.text}. ${next.hint}`);
      });
      missionIndex++;
      missionDone = false;
      renderMission();
    }, card.open ? 300 : 1200);
  }
  const foundIn = new Map();

  // ---------- Trykk ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    return { x: cam.x + (e.clientX - r.left) / S, y: (e.clientY - r.top) / S };
  }

  function hitTest(p) {
    let best = null;
    let bd = Infinity;
    for (const a of animals) {
      const q = animalPos(a);
      const cy = q.y - a.size * (a.sp.place === 'ground' ? 0.35 : a.sp.place === 'trunk' || a.sp.place === 'tree' ? 0.3 : 0);
      const reach = Math.max(0.06, a.size * 0.6);
      const d = Math.hypot(p.x - q.x, p.y - cy) / reach;
      if (d < 1 && d < bd) {
        best = { type: 'animal', a };
        bd = d;
      }
    }
    if (best) return best;
    for (const h of hideouts) {
      const L = hideSize(h);
      const g = D.groundAt(h.x);
      const top = h.kind === 'hollow' ? g - 0.65 : g - L * 0.5;
      if (Math.abs(p.x - h.x) < L * 0.5 && p.y > top && p.y < g + 0.08) return { type: 'hideout', h };
    }
    for (const t of trees) {
      if (t.h < 0.5 || t.type === 'furu') continue;
      const g = D.groundAt(t.x);
      if (Math.abs(p.x - t.x) < 0.035 && p.y < g && p.y > g - t.h * 0.5) return { type: 'tree', t };
    }
    return null;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    audio.start('forest');
    lastInput = time;
    if (sleep.sleeping) return;
    const p = toWorld(e);
    pointer = { id: e.pointerId, x0: e.clientX, moved: false, hit: hitTest(p) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (!pointer.hit) walker.tx = clamp(p.x, 0.3, D.WORLD.width - 0.3);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    lastInput = time;
    if (Math.abs(e.clientX - pointer.x0) > 10) pointer.moved = true;
    if (pointer.moved) walker.tx = clamp(toWorld(e).x, 0.3, D.WORLD.width - 0.3);
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const { hit, moved } = pointer;
    pointer = null;
    if (!hit || moved) return;
    if (hit.type === 'animal') tapAnimal(hit.a);
    else if (hit.type === 'hideout') peek(hit.h);
    else if (hit.type === 'tree') openCard(D.SPECIES.find((s) => s.key === hit.t.type), true);
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });

  function register(sp) {
    const first = !found.has(sp.key);
    found.add(sp.key);
    foundIn.set(sp.key, season);
    const isNew = album.add(sp.key);
    return { first, isNew };
  }

  function tapAnimal(a) {
    a.glowUntil = time + 1.5;
    if (listen && a.sp.key === listen.key && time - listen.at < 25) {
      listen = null;
      Sound.win();
      if (mode !== 'rolig') Speech.speak(`Riktig! Det var ${a.sp.name.toLowerCase()}.`);
      register(a.sp);
      return;
    }
    if (a.sp.sound) playCall(a, 1);
    if (mode === 'rolig') {
      if (!a.sp.sound) audio.chime(clamp((sx(a.x) / W) * 2 - 1, -1, 1));
      register(a.sp);
      return;
    }
    openCard(a.sp, true);
  }

  function openCard(sp, live) {
    const { isNew } = register(sp);
    if (mode === 'rolig') return;
    card.show(sp, {
      draw: (c, w, h, t) => drawPortrait(c, w, h, sp, t),
      newFind: live && isNew && mode === 'oppdag',
      mode,
      sound: sp.sound ? () => audio.call(sp.sound, { pan: 0, distance: 0.1 }) : null,
    });
  }

  function peek(h) {
    const key = D.hiddenIn(h, tod, season);
    h.peek = key;
    h.openUntil = time + 6;
    opened.add(h.key);
    Sound.flip();
    if (h.species) register(D.SPECIES.find((s) => s.key === h.species));
    if (mode === 'rolig') {
      audio.chime(0);
      if (key) register(D.SPECIES.find((s) => s.key === key));
      return;
    }
    if (!key) {
      banner.show(h.kind === 'pond' && season === 'vinter' ? 'Dammen er frosset' : 'Ingen hjemme nå');
      Speech.speak(h.kind === 'pond' && season === 'vinter'
        ? 'Dammen er frosset. Froskene sover i mudderet på bunnen til det blir vår.'
        : 'Det er ingen hjemme akkurat nå. Prøv en annen tid på døgnet eller en annen årstid.');
      return;
    }
    setTimeout(() => { if (running) openCard(D.SPECIES.find((s) => s.key === key), true); }, 700);
  }

  /** Dyret eller planten på kortet, med bakgrunn som passer. */
  function drawPortrait(c, w, h, sp, t, thumb, noBg) {
    const sky = SKY[thumb ? 'dag' : tod];
    c.fillStyle = lin(c, 0, 0, 0, h, [[0, thumb ? '#9cc8e0' : sky.top], [0.7, thumb ? '#d8ecd0' : sky.bottom], [0.7, shade(FA.PALETTE[thumb ? 'sommer' : season].moss, 0)], [1, shade(FA.PALETTE[thumb ? 'sommer' : season].ground, -0.3)]]);
    if (!noBg) c.fillRect(0, 0, w, h);
    c.save();
    if (sp.place === 'thing') {
      const ss = thumb ? 'sommer' : season;
      const img = sp.kind === 'gran' ? FA.spruce(Math.round(h * 0.9), ss, 1) : sp.kind === 'bjork' ? FA.birch(Math.round(h * 0.9), ss, 1) : null;
      if (img) c.drawImage(img, w / 2 - img.width / 2, h * 0.95 - img.height);
      else {
        c.translate(w / 2, h * 0.85);
        C.ART[sp.kind](c, Math.min(w * 0.7, h * 1.1), t);
      }
      c.restore();
      return;
    }
    const big = ['elg', 'raadyr', 'rev', 'grevling', 'gaupe', 'bjorn', 'hare'].includes(sp.kind);
    const air = sp.place === 'air';
    const L = big ? Math.min(w * 0.62, h * 1.15) : air ? Math.min(w, h) * 0.55 : Math.min(w * 0.5, h * 0.75);
    c.translate(w / 2 - (big ? L * 0.08 : 0), air ? h * 0.45 : h * 0.86);
    if (sp.kind === 'spett') c.translate(-L * 0.2, -h * 0.3);
    C.ART[sp.kind](c, L, t, { winter: !thumb && season === 'vinter', pose: air ? 'fly' : 'perch', gait: big && !thumb ? 0.6 : 0 });
    c.restore();
  }

  // ---------- Knapper ----------
  function setTime(k) {
    if (k === tod) return;
    skyBlend = { from: skyNow(), t0: time };
    tod = k;
    placeAnimals();
    renderControls();
    if (mode !== 'rolig') banner.show(D.TIMES.find((t) => t.key === k).name);
  }
  function setSeason(k) {
    if (k === season) return;
    season = k;
    placeAnimals();
    renderControls();
    if (mode !== 'rolig') banner.show(D.SEASONS.find((s) => s.key === k).name);
  }
  function renderControls() {
    $('#forest-time-btn').textContent = D.TIMES.find((t) => t.key === tod).icon;
    $('#forest-season-btn').textContent = D.SEASONS.find((s) => s.key === season).icon;
    const on = settings.music !== 0;
    $('#forest-music-btn').textContent = on ? '🎵' : '🔇';
  }
  $('#forest-time-btn').addEventListener('click', () => {
    Sound.tap();
    const i = D.TIMES.findIndex((t) => t.key === tod);
    setTime(D.TIMES[(i + 1) % D.TIMES.length].key);
  });
  $('#forest-season-btn').addEventListener('click', () => {
    Sound.tap();
    const i = D.SEASONS.findIndex((s) => s.key === season);
    setSeason(D.SEASONS[(i + 1) % D.SEASONS.length].key);
  });
  $('#forest-music-btn').addEventListener('click', () => {
    settings.music = settings.music !== 0 ? 0 : 1;
    P.saveSettings('forest');
    audio.setMusic(settings.music !== 0);
    renderControls();
    Sound.tap();
  });
  $('#forest-album-btn').addEventListener('click', () => { Sound.tap(); album.open(); });
  $('#forest-listen-btn').addEventListener('click', () => {
    Sound.unlock();
    audio.start('forest');
    const singers = animals.filter((a) => a.sp.sound);
    if (!singers.length) {
      banner.show('Det er stille nå');
      if (mode !== 'rolig') Speech.speak('Det er stille i skogen akkurat nå. Prøv en annen tid på døgnet.');
      return;
    }
    const a = singers[Math.floor(rnd() * singers.length)];
    listen = { key: a.sp.key, at: time };
    if (mode === 'rolig') {
      playCall(a, 1);
      return;
    }
    Speech.speak('Lytt! Hvem var det? Finn dyret og trykk på det.').then(() => { if (running) playCall(a, 1); });
  });

  // ---------- Start og stopp ----------
  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    S = H;
  }

  function start(newMode) {
    mode = newMode || 'lar';
    P.show('forest');
    document.body.dataset.forestMode = mode;
    measure();
    season = settings.season === 'na' ? seasonNow : settings.season;
    tod = settings.time || 'dag';
    skyBlend = null;
    found = new Set();
    opened = new Set();
    foundIn.clear();
    buildWorld();
    placeAnimals();
    walker.x = 1.2;
    walker.tx = null;
    walker.dir = 1;
    cam.x = 0;
    missionIndex = 0;
    missionDone = false;
    listen = null;
    nextCall = 0;
    card.close();
    album.close();
    renderMission();
    renderControls();
    $('#forest-album-btn').hidden = mode === 'rolig';
    sleep.start(mode === 'rolig' ? settings.sleep : 0);
    audio.resetMaster();
    audio.setMusic(settings.music !== 0);
    audio.start('forest');
    if (mode === 'lar') setTimeout(() => running && Speech.speak('Velkommen til skogen! Trykk der du vil gå. Trykk på dyrene, og kikk under steinen. Klokka og årstidknappen forandrer skogen.'), 600);
    if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    card.close();
    audio.stop();
    Speech.stop();
  }

  window.addEventListener('resize', () => { if (running) measure(); });
  $$('[data-forest]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.forest);
  }));

  P.registerGame('forest', { screen: 'forest', setupScreen: 'forest-setup', start: () => start('lar'), stop });

  window.PaizonForest = {
    start,
    get animals() { return animals; },
    get walker() { return walker; },
    get cam() { return cam; },
    get found() { return found; },
    get missionIndex() { return missionIndex; },
    get card() { return card.open; },
    get hideouts() { return hideouts; },
    get audio() { return audio; },
    setTime,
    setSeason,
    tapAnimal,
    peek: (key) => peek(hideouts.find((h) => h.key === key)),
    teleport(x) { walker.x = x; walker.tx = null; cam.x = clamp(x - (W / S) * 0.42, 0, D.WORLD.width - W / S); },
    screenOf(a) {
      const r = canvas.getBoundingClientRect();
      const p = animalPos(a);
      return { x: r.left + sx(p.x), y: r.top + (p.y - a.size * 0.3) * S };
    },
  };
})();
