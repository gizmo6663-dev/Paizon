/*
 * Himmelen – fly som en fugl over hav, by, skog og fjell, og opp gjennom skyene.
 * Lær: oppdrag og opplesning. Oppdag: fotobok og sjeldne ting. Rolig («Skykiker»): ligg i
 * gresset og se skyene drive forbi – av og til blir de til dyr.
 */
(function () {
  'use strict';

  const P = window.Paizon;
  const D = window.PaizonSkyData;
  const SA = window.PaizonSkyArt;
  const FA = window.PaizonForestArt;
  const C = window.PaizonCreatures;
  const X = window.PaizonExplore;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $, $$ } = P;
  const { clamp, lerp, shade, mixHex, lin, rad, seeded } = X;
  const TAU = Math.PI * 2;

  const settings = P.settings('sky', { bird: 'make', weather: 'sol', music: 1, sleep: 0 });
  const canvas = $('#sky-canvas');
  let ctx = canvas.getContext('2d');
  const wrap = $('#sky-world');
  const audio = X.makeAudio();
  const card = X.Card(wrap);
  const banner = X.Banner(wrap);
  const sleep = X.Sleep(wrap, audio);
  const album = X.Album(wrap, {
    title: '📖 Fotoboka', storeKey: 'sky.album', entries: D.SPECIES,
    drawThumb: (c, w, h, e, got) => drawPortrait(c, w, h, e, 1, true, !got),
    onPick: (e) => openCard(e, false),
  });

  const VIEW = 1.6;
  const BIRDS = {
    make: { art: 'make', name: 'måke', speed: 0.55, climb: 0.3, max: 1500, glide: true, size: 0.11 },
    orn: { art: 'kongeorn', name: 'ørn', speed: 0.45, climb: 0.14, max: 4500, glide: true, size: 0.14, thermal: 0.55 },
    spurv: { art: 'spurv', name: 'spurv', speed: 0.6, climb: 0.4, max: 600, glide: false, size: 0.07 },
  };
  const THERMALS = [10.5, 16.5, 21, 27.3, 33.2];

  let mode = 'lar';
  let running = false;
  let raf = 0;
  let W = 0;
  let H = 0;
  let S = 400;
  let dpr = 1;
  let time = 0;
  let last = 0;
  let weather = 'sol';
  let bird = BIRDS.make;
  const cam = { x: 0, u: 0 };
  const me = { x: 7, u: 0.4, vx: 0, vu: 0, dir: 1, tx: null, tu: null, flap: 0 };
  let flocks = [];
  let clouds = [];
  let things = [];
  let houses = [];
  let trees = [];
  let found = new Set();
  let missionIndex = 0;
  let missionDone = false;
  let throughCloud = false;
  let inCloud = 0;
  let maxAlt = 0;
  let warned = false;
  let pointer = null;
  let lastInput = 0;
  let nextCall = 0;
  let listen = null;
  let zoneKey = '';
  let zoneSince = 0;
  const rnd = seeded(5);
  const range = ([a, b]) => a + rnd() * (b - a);
  const sx = (x) => (x - cam.x) * S;
  const top = () => cam.u + VIEW / 2;
  const sy = (u) => (top() - u) * S;
  const gU = (x) => D.uAt(D.groundAt(x));

  // ---------- Verden ----------
  function buildWorld() {
    const r = seeded(21);
    houses = [];
    for (let x = 6.3; x < 13.8; x += 0.3 + r() * 0.2) houses.push({ x, s: 0.16 + r() * 0.08, v: Math.floor(r() * 10) });
    trees = [];
    for (let x = 6.2; x < 24; x += x < 14 ? 0.45 + r() * 0.5 : 0.09 + r() * 0.12) trees.push({ x, h: (x < 14 ? 0.18 : 0.22) + r() * 0.18, v: Math.floor(r() * 4), type: x < 14 && r() < 0.5 ? 'bjork' : 'gran' });
    clouds = [];
    const n = weather === 'skyer' ? 26 : weather === 'natt' ? 10 : 14;
    for (let i = 0; i < n; i++) {
      clouds.push({ x: r() * D.WORLD.width, u: D.uAt(1400 + r() * 1800), L: 0.6 + r() * 0.9, seed: 1 + Math.floor(r() * 50), tone: weather === 'skyer' ? 0.2 + r() * 0.5 : r() * 0.15, speed: 0.01 + r() * 0.02 });
    }
    for (let i = 0; i < 6; i++) clouds.push({ x: r() * D.WORLD.width, u: D.uAt(400 + r() * 700), L: 0.35 + r() * 0.4, seed: 60 + i, tone: weather === 'skyer' ? 0.3 : 0.05, speed: 0.02, low: true });
    things = [];
    const add = (key, o) => {
      const sp = D.SPECIES.find((s) => s.key === key);
      if (!D.present(sp, weather) || (sp.secret && mode !== 'oppdag')) return;
      things.push(Object.assign({ sp, glowUntil: 0 }, o));
    };
    for (let i = 0; i < 5; i++) add('fjaersky', { x: 3 + i * 8 + r() * 3, u: D.uAt(8000 + r() * 2000), L: 1.2 });
    add('bomullssky', { x: 12.5, u: D.uAt(1700), L: 1.2, seed: 9, tone: weather === 'skyer' ? 0.3 : 0 });
    add('tordensky', { x: 31, u: D.uAt(1100), L: 2.6 });
    add('regnbue', { x: 26.5, u: -0.5, L: 2.6 });
    add('luftballong', { x: 18, u: D.uAt(900), L: 0.22, drift: 0.04 });
    add('drage', { x: 9.2, u: D.uAt(45), L: 0.07, anchor: 8.7 });
    add('fly', { x: 5, u: D.uAt(10000), L: 0.5, drift: 0.35 });
    add('nordlys', { x: 0, u: 0, L: 1, screen: true });
    add('stjerneskudd', { x: 0, u: 0, L: 0.3, screen: true, next: 6 });
    placeFlocks();
  }

  function placeFlocks() {
    flocks = [];
    for (const sp of D.SPECIES) {
      if (sp.thing || !D.present(sp, weather) || (sp.secret && mode !== 'oppdag')) continue;
      for (let i = 0; i < (sp.count || 1); i++) {
        const f = { sp, x: range(sp.x), u: 0, dir: rnd() < 0.5 ? -1 : 1, face: 1, speed: 0.05 + rnd() * 0.08, phase: rnd() * 10, glowUntil: 0, members: [] };
        f.u = Math.max(gU(f.x) + 0.05, D.uAt(range(sp.alt)));
        f.tu = f.u;
        if (sp.pose === 'glide') f.speed *= 0.8;
        if (['svale', 'taarnseiler'].includes(sp.kind)) f.speed = 0.25 + rnd() * 0.1;
        if (sp.vee) f.speed = 0.12;
        if (sp.pose === 'perch') {
          const t = trees.filter((q) => q.x > sp.x[0] && q.x < sp.x[1])[0];
          f.x = t ? t.x : f.x;
          f.u = gU(f.x) + (t ? t.h * 0.75 : 0.1);
          f.speed = 0;
        }
        const m = sp.flock || 1;
        for (let k = 0; k < m; k++) {
          if (sp.vee) f.members.push({ ox: -Math.ceil(k / 2) * 0.09, ou: (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.05, ph: rnd() * 6 });
          else f.members.push({ ox: k ? (rnd() - 0.5) * 0.3 : 0, ou: k ? (rnd() - 0.5) * 0.12 : 0, ph: rnd() * 6 });
        }
        f.size = (sp.kind === 'make' ? 0.07 : sp.kind === 'havorn' || sp.kind === 'kongeorn' ? 0.12 : sp.kind === 'fjellvaak' ? 0.09 : sp.kind === 'gaas' || sp.kind === 'trane' ? 0.08 : sp.kind === 'ravn' ? 0.075 : sp.kind === 'ugle' ? 0.07 : 0.045) * (0.9 + rnd() * 0.2);
        flocks.push(f);
      }
    }
  }

  // ---------- Oppdatering ----------
  function inThermal(x, u) {
    return THERMALS.some((t) => Math.abs(x - t) < 0.35) && u < D.uAt(4500);
  }

  function updateMe(dt) {
    if (mode === 'rolig') return;
    // Så lenge fingeren holdes nede, flyr fuglen mot fingeren – også når kameraet følger etter.
    if (pointer && (pointer.moved || !pointer.hit)) {
      const p = toWorld({ clientX: pointer.cx, clientY: pointer.cy });
      me.tx = p.x;
      me.tu = p.u;
    }
    let ax = 0;
    let au = 0;
    if (me.tx != null) {
      const dx = me.tx - me.x;
      const du = me.tu - me.u;
      const d = Math.hypot(dx, du);
      if (d < 0.02 && !pointer) me.tx = null;
      else {
        const k = pointer ? 3.5 : 2;
        ax = (dx / (d || 1)) * Math.min(bird.speed, d * k);
        au = (du / (d || 1)) * Math.min(bird.speed, d * k);
      }
    }
    const alt = D.altAt(me.u);
    // Klatring: hver fugl har sin egen klatrefart. Ørna stiger raskt i varm luft.
    let climbMax = bird.climb * (alt > bird.max ? 0.35 : 1);
    const thermal = inThermal(me.x, me.u);
    if (thermal) climbMax += bird.thermal || 0.15;
    au = Math.min(au, climbMax);
    if (me.tx == null) au = bird.glide ? (thermal ? climbMax * 0.6 : -0.015) : -0.03;
    me.vx += (ax - me.vx) * Math.min(1, dt * 2.5);
    me.vu += (au - me.vu) * Math.min(1, dt * 2.5);
    me.x = clamp(me.x + me.vx * dt, 0.1, D.WORLD.width - 0.1);
    me.u = clamp(me.u + me.vu * dt, gU(me.x) + 0.04, D.WORLD.top);
    if (Math.abs(me.vx) > 0.02) me.dir = me.vx > 0 ? 1 : -1;
    me.flap = lerp(me.flap, (me.vu > 0.03 && !(thermal && bird.glide)) || !bird.glide ? 1 : 0, Math.min(1, dt * 4));
    maxAlt = Math.max(maxAlt, D.altAt(me.u));
    if (!warned && D.altAt(me.u) > bird.max * 1.2 && mode !== 'rolig') {
      warned = true;
      const msg = `Så høyt flyr ikke ${bird.name === 'ørn' ? 'ørna' : bird.name === 'måke' ? 'måken' : 'spurven'} vanligvis. Her oppe er lufta tynn og kald – men i en lek kan vi fly hvor vi vil!`;
      banner.show('Høyt oppe!');
      if (mode === 'lar') Speech.speak(msg);
    }
  }

  function updateWorld(dt) {
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x > D.WORLD.width + 1) c.x = -1;
    }
    inCloud = 0;
    for (const c of clouds) {
      const dx = Math.abs(me.x - c.x) / (c.L * 0.42);
      const du = (me.u - c.u) / (c.L * 0.45);
      if (dx < 1 && du > 0 && du < 1) inCloud = Math.max(inCloud, 1 - Math.max(dx, Math.abs(du - 0.5) * 2) * 0.6);
    }
    if (inCloud > 0.3) throughCloud = true;
    for (const t of things) {
      if (t.drift) {
        t.x += t.drift * dt;
        if (t.x > D.WORLD.width + 1) t.x = -1;
      }
    }
    for (const f of flocks) {
      f.face += (f.dir - f.face) * Math.min(1, dt * 3);
      if (!f.speed) continue;
      const sp = f.sp;
      if (['kongeorn', 'havorn', 'fjellvaak'].includes(sp.kind)) {
        // Rovfugler sirkler sakte.
        f.x += Math.cos(time * 0.25 + f.phase) * 0.12 * dt;
        f.dir = Math.cos(time * 0.25 + f.phase) > 0 ? 1 : -1;
        f.u += Math.sin(time * 0.1 + f.phase) * 0.02 * dt;
      } else {
        f.x += f.dir * f.speed * dt;
        if (f.x < sp.x[0]) f.dir = 1;
        if (f.x > sp.x[1]) f.dir = -1;
        if (rnd() < 0.003) f.tu = Math.max(gU(f.x) + 0.05, D.uAt(range(sp.alt)));
        f.u += (f.tu - f.u) * Math.min(1, dt * 0.4);
        if (['svale', 'taarnseiler'].includes(sp.kind)) f.u += Math.sin(time * 2 + f.phase) * 0.08 * dt;
      }
      f.u = Math.max(f.u, gU(f.x) + 0.04);
    }
  }

  function updateCamera(dt) {
    const vw = W / S;
    cam.x += (me.x - vw * 0.45 + me.vx * 0.5 - cam.x) * Math.min(1, dt * 2);
    cam.u += (me.u + 0.1 - cam.u) * Math.min(1, dt * 2);
    cam.x = clamp(cam.x, 0, D.WORLD.width - vw);
    cam.u = clamp(cam.u, VIEW / 2 - 0.12, D.WORLD.top);
  }

  // ---------- Tegning ----------
  function skyColors(alt) {
    const night = weather === 'natt';
    const lowTop = night ? '#0c1636' : '#6aaee8';
    const lowBottom = night ? '#1e2e58' : '#d8eef9';
    const k = clamp(alt / 14000, 0, 1);
    let topC = mixHex(lowTop, night ? '#02040e' : '#0c1a52', Math.pow(k, 0.8));
    let bottomC = mixHex(lowBottom, night ? '#0a1430' : '#5a8ee0', Math.pow(k, 0.9));
    if (weather === 'skyer') {
      topC = mixHex(topC, '#8a98aa', 0.35 * (1 - k));
      bottomC = mixHex(bottomC, '#c4ccd6', 0.4 * (1 - k));
    }
    return { topC, bottomC, stars: night ? 1 : clamp((alt - 8000) / 5000, 0, 1) };
  }

  function drawSky() {
    const alt = D.altAt(cam.u);
    const c = skyColors(alt);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.topC);
    g.addColorStop(1, c.bottomC);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (c.stars > 0.02) {
      const r = seeded(9);
      for (let i = 0; i < 180; i++) {
        const x = ((r() * W * 1.4 - cam.x * S * 0.03) % W + W) % W;
        const y = ((r() * H * 1.4 + cam.u * S * 0.03) % H + H) % H;
        ctx.fillStyle = `rgba(255,255,245,${c.stars * (0.3 + 0.6 * Math.abs(Math.sin(time * 0.7 + i)))})`;
        ctx.fillRect(x, y, 1.6, 1.6);
      }
    }
    // Sol eller måne.
    const x = W * 0.82;
    const y = H * 0.16;
    if (weather === 'natt') {
      ctx.fillStyle = '#eef0f8';
      ctx.beginPath();
      ctx.arc(x, y, S * 0.035, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = rad(ctx, x, y, 0, S * 0.3, [[0, `rgba(255,250,220,${weather === 'skyer' ? 0.3 : 0.6})`], [1, 'rgba(255,250,220,0)']]);
      ctx.fillRect(x - S * 0.3, y - S * 0.3, S * 0.6, S * 0.6);
      ctx.fillStyle = weather === 'skyer' ? 'rgba(255,252,235,0.7)' : '#fffbe6';
      ctx.beginPath();
      ctx.arc(x, y, S * 0.04, 0, TAU);
      ctx.fill();
    }
  }

  /** Fjell og hav langt borte (beveger seg sakte). */
  function drawFar() {
    const par = 0.3;
    const night = weather === 'natt';
    const col = night ? '#1a2440' : weather === 'skyer' ? '#9aa6b6' : '#a8c4dc';
    const baseY = sy(0) + S * 0.02;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let px = 0; px <= W + 10; px += 10) {
      const wx = cam.x * par + px / S;
      const h = (0.2 + 0.14 * Math.sin(wx * 0.9 + 1) + 0.06 * Math.sin(wx * 2.7)) * (0.7 + 0.3 * Math.sin(wx * 0.31));
      ctx.lineTo(px, baseY - h * S * 0.9);
    }
    ctx.lineTo(W, H);
    ctx.fill();
  }

  function groundPath() {
    const p = new Path2D();
    p.moveTo(-10, H + 10);
    for (let px = -10; px <= W + 10; px += 6) p.lineTo(px, sy(gU(cam.x + px / S)));
    p.lineTo(W + 10, H + 10);
    p.closePath();
    return p;
  }

  function drawLand() {
    const PP = window.PaizonPapir; // papirstilen lastes etter spillet
    const gy0 = sy(0);
    if (gy0 < -S * 6) return; // langt over bakken: ingenting å tegne
    const night = weather === 'natt';
    // Havet.
    const seaRight = sx(6);
    if (seaRight > 0) {
      // Havet: flatt papirlag med blekkant langs vannflata.
      ctx.fillStyle = night ? '#1a2e48' : '#3f86ae';
      ctx.fillRect(0, gy0, seaRight, H - gy0 + 10);
      ctx.strokeStyle = PP ? PP.INK : '#2b2219';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, gy0);
      ctx.lineTo(seaRight, gy0);
      ctx.stroke();
      ctx.strokeStyle = night ? 'rgba(180,200,255,0.25)' : 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.2;
      for (let k = 0; k < 6; k++) {
        ctx.beginPath();
        for (let px = 0; px < seaRight; px += 8) {
          const yy = gy0 + k * S * 0.03 + Math.sin(px * 0.05 + time * 1.5 + k) * 2;
          if (px) ctx.lineTo(px, yy);
          else ctx.moveTo(px, yy);
        }
        ctx.stroke();
      }
    }
    // Bakken: gress, skog og fjell.
    const p = groundPath();
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.max(0, seaRight), -10, W + 20, H + 20);
    ctx.clip();
    // Bakken er et flatt papirlag; over tregrensa er fjellet grått berg.
    if (PP) PP.paperPath(ctx, p, night ? '#2a3428' : '#6a7a4a', { sx: 2, sy: 3 });
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = night ? '#3a4050' : '#8c8a80';
    const rockY = sy(D.uAt(450));
    ctx.fillRect(Math.max(0, sx(23.5)), -10, W + 10, rockY + 10);
    ctx.restore();
    // Snø på fjelltoppene.
    ctx.save();
    ctx.clip(p);
    // Snøen har en ujevn nedre kant, som ekte snøflekker på fjellet.
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    for (let px = -10; px <= W + 10; px += 6) {
      const wx = cam.x + px / S;
      const m = wx < 24 ? 99999 : 1250 + 140 * Math.sin(wx * 3.7) + 90 * Math.sin(wx * 9.1 + 1) + 60 * Math.sin(wx * 17);
      ctx.lineTo(px, Math.max(-10, sy(D.uAt(m))));
    }
    ctx.lineTo(W + 10, -10);
    ctx.closePath();
    ctx.fillStyle = night ? '#b8c2d6' : '#f4f6f8';
    ctx.fill();
    ctx.strokeStyle = PP ? PP.INK : '#2b2219';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Skrå furer i fjellsida.
    const r = seeded(13);
    ctx.strokeStyle = night ? 'rgba(0,0,0,0.2)' : 'rgba(70,66,60,0.16)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 120; i++) {
      const wx = 24 + r() * 16;
      const x = sx(wx);
      if (x < -S || x > W + S) continue;
      const y = sy(gU(wx)) + r() * S * 2;
      const len = S * (0.03 + r() * 0.08);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len * (wx < 29 || (wx > 32 && wx < 35.5) ? -0.6 : 0.6), y + len);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
    // Blekkant rundt hele landet (over snøen og berget).
    ctx.strokeStyle = PP ? PP.INK : '#2b2219';
    ctx.lineWidth = 1.5;
    ctx.stroke(p);
    // Varm luft som stiger (svak, flimrende søyle).
    if (weather !== 'natt') {
      for (const t of THERMALS) {
        const x = sx(t);
        if (x < -S || x > W + S) continue;
        for (let i = 0; i < 10; i++) {
          const yy = ((time * 40 + i * 70) % (S * 3));
          const py = sy(gU(t)) - yy;
          ctx.fillStyle = 'rgba(255,240,210,0.18)';
          ctx.beginPath();
          ctx.arc(x + Math.sin(time + i) * S * 0.08, py, 2.5, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = lin(ctx, x - S * 0.3, 0, x + S * 0.3, 0, [[0, 'rgba(255,240,210,0)'], [0.5, 'rgba(255,240,210,0.06)'], [1, 'rgba(255,240,210,0)']]);
        ctx.fillRect(x - S * 0.3, sy(D.uAt(4500)), S * 0.6, sy(gU(t)) - sy(D.uAt(4500)));
      }
    }
    // Hus og trær.
    for (const t of trees) {
      const x = sx(t.x);
      const hpx = t.h * S;
      if (x < -hpx || x > W + hpx) continue;
      // Faste størrelser (skaleres ved tegning), så trærne tegnes ferdig bare noen få ganger.
      const bh = Math.max(16, Math.round(([0.2, 0.28, 0.36].reduce((b, v) => (Math.abs(v - t.h) < Math.abs(b - t.h) ? v : b))) * S / 4) * 4);
      const img = t.type === 'gran' ? FA.spruce(bh, 'sommer', t.v) : FA.birch(bh, 'sommer', t.v);
      const k = hpx / img.height;
      ctx.drawImage(img, x - img.width * k / 2, sy(gU(t.x)) - hpx + 2, img.width * k, hpx);
    }
    for (const h of houses) {
      const x = sx(h.x);
      const L = h.s * S;
      if (x < -L || x > W + L) continue;
      SA.drawHouse(ctx, x, sy(gU(h.x)) + 2, L, h.v, night);
    }
    // Snora til dragen.
    const kite = things.find((t) => t.sp.key === 'drage');
    if (kite) {
      ctx.strokeStyle = 'rgba(60,60,60,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx(kite.anchor), sy(gU(kite.anchor)) - 6);
      ctx.quadraticCurveTo(sx((kite.x + kite.anchor) / 2), sy(kite.u * 0.4), sx(kite.x), sy(kite.u));
      ctx.stroke();
    }
  }

  function drawClouds(back) {
    const night = weather === 'natt';
    for (const c of clouds) {
      if (!!c.low !== back) continue;
      const L = c.L * S;
      const x = sx(c.x);
      const y = sy(c.u);
      if (x < -L || x > W + L || y < -L || y > H + L) continue;
      ctx.save();
      ctx.translate(x, y);
      SA.ART.cumulus(ctx, L, time, { seed: c.seed, tone: c.tone, night });
      ctx.restore();
    }
  }

  function drawThings(screenPass) {
    const night = weather === 'natt';
    for (const t of things) {
      if (!!t.screen !== screenPass) continue;
      const k = t.sp.kind;
      if (k === 'aurora') {
        ctx.save();
        ctx.translate(W / 2, H * 0.2);
        SA.ART.aurora(ctx, S, time, { w: W, h: H * 0.5 });
        ctx.restore();
        continue;
      }
      if (k === 'meteor') {
        if (time > t.next) {
          t.next = time + 7 + rnd() * 10;
          t.start = time;
          t.px = W * (0.3 + rnd() * 0.6);
          t.py = H * (0.05 + rnd() * 0.25);
        }
        if (t.start && time - t.start < 1.4) {
          const f = (time - t.start) / 1.4;
          ctx.save();
          ctx.globalAlpha = 1 - f;
          ctx.translate(t.px + f * S * 0.6, t.py + f * S * 0.24);
          SA.ART.meteor(ctx, S * 0.25);
          ctx.restore();
        }
        continue;
      }
      const L = t.L * S;
      const x = sx(t.x);
      const y = sy(t.u);
      if (x < -L * 1.5 || x > W + L * 1.5 || y < -L * 1.5 || y > H + L * 1.5) continue;
      ctx.save();
      ctx.translate(x, y);
      if (k === 'plane') {
        SA.ART.contrail(ctx, L, S * 3);
        SA.ART.plane(ctx, L, time, { night });
      } else if (k === 'cumulus') SA.ART.cumulus(ctx, L, time, { seed: t.seed, tone: t.tone, night });
      else SA.ART[k](ctx, L, time, { night });
      ctx.restore();
      if (t.glowUntil > time) glowAt(x, y - (k === 'cumulus' || k === 'storm' ? L * 0.3 : 0), Math.max(40, L * 0.5), (t.glowUntil - time) / 1.5);
    }
  }

  function glowAt(x, y, r, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, `rgba(255,255,220,${0.35 * k})`], [1, 'rgba(255,255,220,0)']]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function drawFlocks() {
    for (const f of flocks) {
      const L = f.size * S;
      const x0 = sx(f.x);
      const y0 = sy(f.u);
      if (x0 < -S || x0 > W + S || y0 < -S || y0 > H + S) continue;
      const art = C.ART[f.sp.kind];
      const face = Math.sign(f.face || 1) * Math.max(0.15, Math.abs(f.face));
      for (const m of f.members) {
        const x = x0 + m.ox * face * S + Math.sin(time * 0.7 + m.ph) * L * 0.2;
        const y = y0 - m.ou * S + Math.cos(time * 0.9 + m.ph) * L * 0.15;
        ctx.save();
        ctx.translate(x, y);
        if (f.sp.kind !== 'flaggermus') ctx.scale(face, 1);
        art(ctx, L, time * (f.sp.kind === 'svale' ? 1.2 : 1) + m.ph, { pose: f.sp.pose });
        ctx.restore();
      }
      if (f.glowUntil > time) glowAt(x0, y0, Math.max(40, L * 2), (f.glowUntil - time) / 1.5);
    }
  }

  function drawMe() {
    const L = bird.size * S;
    ctx.save();
    ctx.translate(sx(me.x), sy(me.u));
    ctx.scale(me.dir, 1);
    ctx.rotate(clamp(-me.vu * 0.8, -0.4, 0.4));
    // En svak ring rundt fuglen vår, så den er lett å finne igjen.
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, L * 0.9, 0, TAU);
    ctx.stroke();
    C.ART[bird.art](ctx, L, time, { pose: me.flap > 0.5 ? 'fly' : 'glide' });
    ctx.restore();
  }

  function drawWeatherOverlay() {
    if (inCloud > 0.05) {
      ctx.fillStyle = weather === 'natt' ? `rgba(60,70,100,${inCloud * 0.75})` : `rgba(240,244,250,${inCloud * 0.85})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (weather === 'natt') {
      ctx.fillStyle = 'rgba(4,8,24,0.25)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Skykiker (Rolig) ----------
  const SHAPES = ['🐘', '🐇', '🐳', '🐢', '🦕', '🐟', '🐈', '🐕', '🦒', '🐌', '🦋', '🐑'];
  let lookClouds = [];
  const shapeCache = new Map();

  /** Lager en sky formet som et dyr: prøver punkter fra en emoji og legger skydotter der. */
  function shapePuffs(emoji) {
    if (shapeCache.has(emoji)) return shapeCache.get(emoji);
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const x = c.getContext('2d');
    x.font = '80px system-ui, sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(emoji, 48, 52);
    const data = x.getImageData(0, 0, 96, 96).data;
    const pts = [];
    for (let y = 0; y < 96; y += 7) {
      for (let xx = 0; xx < 96; xx += 7) {
        if (data[(y * 96 + xx) * 4 + 3] > 120) pts.push([(xx - 48) / 96, (y - 48) / 96]);
      }
    }
    shapeCache.set(emoji, pts);
    return pts;
  }

  function newLookCloud(x) {
    const r = Math.random;
    const puffs = Array.from({ length: 14 }, () => [(r() - 0.5) * 0.8, (r() - 0.5) * 0.25 - Math.abs(r() - 0.5) * 0.15, 0.08 + r() * 0.07]);
    return { x, y: 0.15 + r() * 0.4, L: 0.3 + r() * 0.2, speed: 0.012 + r() * 0.01, puffs, shape: null, morph: 0 };
  }

  function morph(c) {
    const pts = shapePuffs(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    if (pts.length < 6) return;
    c.shape = pts.map(([px, py]) => [px * 0.9, py * 0.9, 0.055]);
    c.morphStart = time;
  }

  function drawLookUp(dt) {
    const night = weather === 'natt';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, night ? '#050a20' : weather === 'skyer' ? '#7a8ca4' : '#3a86d8');
    g.addColorStop(1, night ? '#1a2a50' : weather === 'skyer' ? '#c4ccd8' : '#bfe0f6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (night) {
      const r = seeded(4);
      for (let i = 0; i < 220; i++) {
        ctx.fillStyle = `rgba(255,255,245,${0.3 + 0.6 * Math.abs(Math.sin(time * 0.5 + i))})`;
        ctx.fillRect(r() * W, r() * H * 0.85, 1.6, 1.6);
      }
      ctx.save();
      ctx.translate(W / 2, H * 0.25);
      SA.ART.aurora(ctx, S, time, { w: W, h: H * 0.6 });
      ctx.restore();
      drawThings(true);
    }
    if (!lookClouds.length) for (let i = 0; i < 6; i++) lookClouds.push(newLookCloud(Math.random() * 1.2));
    for (const c of lookClouds) {
      c.x += c.speed * dt;
      const Lpx = c.L * Math.min(W, H * 1.6);
      const cx = c.x * W - Lpx * 0.5;
      const cy = c.y * H;
      if (c.shape && time - c.morphStart > 40) c.shape = null; // skyen går i oppløsning igjen
      const m = c.shape ? clamp((time - c.morphStart) / 6, 0, 1) : 0;
      const light = night ? 'rgba(150,160,200,' : 'rgba(255,255,255,';
      // Vanlig sky som blekner, og dyreformen som kommer fram.
      for (const [px, py, pr] of c.puffs) {
        ctx.fillStyle = rad(ctx, cx + px * Lpx - pr * Lpx * 0.3, cy + py * Lpx - pr * Lpx * 0.3, 0, pr * Lpx * 1.2, [[0, light + (0.95 * (1 - m)) + ')'], [1, light + '0)']]);
        ctx.beginPath();
        ctx.arc(cx + px * Lpx, cy + py * Lpx, pr * Lpx * 1.2, 0, TAU);
        ctx.fill();
      }
      if (c.shape) {
        for (const [px, py, pr] of c.shape) {
          const wob = Math.sin(time * 0.3 + px * 9) * 0.004;
          ctx.fillStyle = rad(ctx, cx + px * Lpx, cy + (py + wob) * Lpx, 0, pr * Lpx * 1.6, [[0, light + (0.5 * m) + ')'], [0.55, light + (0.4 * m) + ')'], [1, light + '0)']]);
          ctx.beginPath();
          ctx.arc(cx + px * Lpx, cy + (py + wob) * Lpx, pr * Lpx * 1.6, 0, TAU);
          ctx.fill();
        }
      }
      if (c.x > 1.4) Object.assign(c, newLookCloud(-0.4));
    }
    // Av og til blir en sky til et dyr.
    if (!drawLookUp.next) drawLookUp.next = time + 8;
    if (time > drawLookUp.next) {
      drawLookUp.next = time + 18 + Math.random() * 12;
      const cands = lookClouds.filter((c) => !c.shape && c.x > 0.1 && c.x < 0.7);
      if (cands.length) morph(cands[Math.floor(Math.random() * cands.length)]);
    }
    // Fugler som flyr forbi høyt oppe.
    if (!night) {
      for (let i = 0; i < 3; i++) {
        const f = ((time * 0.03 + i * 0.37) % 1.4) - 0.2;
        ctx.save();
        ctx.translate(f * W, H * (0.2 + i * 0.12) + Math.sin(time + i) * 10);
        C.ART[['svale', 'make', 'kraake'][i]](ctx, S * 0.04, time + i, { pose: 'fly' });
        ctx.restore();
      }
    }
    // Gresstrå foran, sett nedenfra.
    ctx.fillStyle = night ? '#0a140c' : '#2a4a1e';
    for (let i = 0; i < 60; i++) {
      const x = (i / 60) * W + Math.sin(i * 3.1) * 20;
      const h = H * (0.08 + ((i * 37) % 10) / 60);
      const sw = Math.sin(time * 0.8 + i * 0.4) * 8;
      ctx.beginPath();
      ctx.moveTo(x - 4, H);
      ctx.quadraticCurveTo(x + sw * 0.5, H - h * 0.6, x + sw, H - h);
      ctx.quadraticCurveTo(x + sw * 0.4, H - h * 0.5, x + 4, H);
      ctx.fill();
    }
  }

  function render(dt) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (mode === 'rolig') {
      drawLookUp(dt);
    } else {
      drawSky();
      drawThings(true);
      drawFar();
      drawClouds(false);
      drawLand();
      drawClouds(true);
      drawThings(false);
      drawFlocks();
      drawMe();
      if (window.PaizonPapir) window.PaizonPapir.grainOverlay(ctx, W, H, 0.3);
      drawWeatherOverlay();
    }
    const dim = sleep.tick();
    if (dim) {
      ctx.fillStyle = `rgba(0,0,0,${dim})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------- Løkke, lyd og HUD ----------
  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    updateMe(dt);
    updateWorld(dt);
    updateCamera(dt);
    ambience();
    if (mode !== 'rolig') {
      checkZone();
      checkMission();
      updateHud();
    }
    render(dt);
    raf = requestAnimationFrame(loop);
  }

  function ambience() {
    const alt = mode === 'rolig' ? 0 : D.altAt(me.u);
    audio.set({
      wind: mode === 'rolig' ? 0.3 : clamp(0.25 + alt / 6000, 0, 1),
      leaves: mode === 'rolig' ? 0.5 : clamp(1 - alt / 150, 0, 0.6),
      rain: weather === 'skyer' ? clamp(1 - Math.abs(me.x - 31) / 4, 0, 1) * 0.8 : 0,
      crickets: weather === 'natt' && (mode === 'rolig' || alt < 100) ? 0.5 : 0,
      night: weather === 'natt',
      room: 0.15,
    });
    if (sleep.sleeping) return;
    if (!nextCall) nextCall = time + 4;
    if (time < nextCall) return;
    nextCall = time + 6 + rnd() * 8;
    const near = flocks.filter((f) => f.sp.sound && (mode === 'rolig' || Math.hypot(f.x - me.x, f.u - me.u) < 4));
    if (near.length) playCall(near[Math.floor(rnd() * near.length)]);
  }

  function playCall(f) {
    const dx = mode === 'rolig' ? (rnd() - 0.5) * 2 : f.x - me.x;
    const d = mode === 'rolig' ? 0.6 : Math.hypot(f.x - me.x, f.u - me.u);
    audio.call(f.sp.sound, { pan: clamp(dx / 2, -1, 1), distance: clamp(d / 5, 0, 0.85) });
  }

  function checkZone() {
    const z = D.zoneAt(D.altAt(me.u));
    if (z.key === zoneKey) {
      zoneSince = time;
      return;
    }
    if (time - zoneSince < 1.2) return;
    const first = !zoneKey;
    zoneKey = z.key;
    zoneSince = time;
    $('#sky-zone').textContent = z.name;
    if (first) return;
    banner.show(z.name);
    if (mode === 'lar' && !card.open) Speech.speak(z.intro);
  }

  function updateHud() {
    const alt = D.altAt(me.u);
    $('#sky-alt').textContent = alt < 1000 ? `${Math.round(alt)} m` : `${(alt / 1000).toFixed(1).replace('.', ',')} km`;
    $('#sky-meter-dot').style.top = `${(1 - clamp(me.u / D.WORLD.top, 0, 1)) * 100}%`;
  }

  function renderMission() {
    const chip = $('#sky-mission');
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
    const ok = m.alt ? maxAlt >= m.alt : m.cloud ? throughCloud : m.species.some((k) => found.has(k));
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

  // ---------- Trykk ----------
  function toWorld(e) {
    const r = canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    return { x: cam.x + px / S, u: top() - py / S, px, py };
  }

  function hitTest(p) {
    let best = null;
    let bd = Infinity;
    for (const f of flocks) {
      for (const m of f.members) {
        const x = f.x + m.ox * Math.sign(f.face || 1);
        const u = f.u + m.ou;
        const d = Math.hypot(p.x - x, p.u - u) / Math.max(0.07, f.size * 0.8);
        if (d < 1 && d < bd) {
          best = { f };
          bd = d;
        }
      }
    }
    if (best) return best;
    for (const t of things) {
      const k = t.sp.kind;
      if (k === 'aurora') {
        if (p.py < H * 0.35) best = best || { t };
        continue;
      }
      if (k === 'meteor') {
        if (t.start && time - t.start < 1.6 && Math.hypot(p.px - (t.px + S * 0.3), p.py - (t.py + S * 0.12)) < S * 0.4) return { t };
        continue;
      }
      let cx = t.x;
      let cu = t.u;
      let rr = t.L * 0.5;
      if (k === 'storm') { cu += t.L * 0.5; rr = t.L * 0.5; }
      if (k === 'cumulus') { cu += t.L * 0.25; }
      if (k === 'rainbow') {
        const d = Math.hypot(p.x - t.x, p.u - t.u);
        if (Math.abs(d - t.L * 0.92) < 0.15) return { t };
        continue;
      }
      if (k === 'cirrus') { rr = t.L * 0.5; }
      if (Math.hypot(p.x - cx, p.u - cu) < Math.max(0.07, rr)) return { t };
    }
    // Vanlige skyer teller som bomullssky.
    const sky = things.find((t) => t.sp.key === 'bomullssky');
    if (sky) {
      for (const c of clouds) {
        if (Math.abs(p.x - c.x) < c.L * 0.4 && p.u > c.u && p.u < c.u + c.L * 0.45) return { t: sky, cloud: c };
      }
    }
    return best;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    audio.start('sky');
    lastInput = time;
    if (sleep.sleeping) return;
    const p = toWorld(e);
    if (mode === 'rolig') {
      // Trykk på en sky i Skykiker: den blir til et dyr.
      for (const c of lookClouds) {
        const Lpx = c.L * Math.min(W, H * 1.6);
        if (Math.abs(p.px - c.x * W + Lpx * 0.5) < Lpx * 0.45 && Math.abs(p.py - c.y * H) < Lpx * 0.25) {
          morph(c);
          audio.chime(clamp((p.px / W) * 2 - 1, -1, 1));
          return;
        }
      }
      if (weather === 'natt') {
        const m = things.find((t) => t.sp.kind === 'meteor');
        if (m && m.start && time - m.start < 1.6) audio.chime(0);
      }
      return;
    }
    pointer = { id: e.pointerId, x0: e.clientX, y0: e.clientY, cx: e.clientX, cy: e.clientY, moved: false, hit: hitTest(p) };
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    if (!pointer.hit) {
      me.tx = p.x;
      me.tu = p.u;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    lastInput = time;
    pointer.cx = e.clientX;
    pointer.cy = e.clientY;
    if (Math.hypot(e.clientX - pointer.x0, e.clientY - pointer.y0) > 10) pointer.moved = true;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const { hit, moved } = pointer;
    pointer = null;
    if (!hit || moved) return;
    if (hit.f) tapFlock(hit.f);
    else tapThing(hit.t);
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });

  function register(sp) {
    found.add(sp.key);
    return album.add(sp.key);
  }
  function tapFlock(f) {
    f.glowUntil = time + 1.5;
    if (listen && listen.key === f.sp.key && time - listen.at < 25) {
      listen = null;
      Sound.win();
      Speech.speak(`Riktig! Det var ${f.sp.name.toLowerCase()}.`);
      register(f.sp);
      return;
    }
    if (f.sp.sound) playCall(f);
    openCard(f.sp, true);
  }
  function tapThing(t) {
    t.glowUntil = time + 1.5;
    openCard(t.sp, true);
  }
  function openCard(sp, live) {
    const isNew = register(sp);
    card.show(sp, {
      draw: (c, w, h, tt) => drawPortrait(c, w, h, sp, tt),
      newFind: live && isNew && mode === 'oppdag',
      mode,
      sound: sp.sound ? () => audio.call(sp.sound, { distance: 0.1 }) : null,
    });
  }

  function drawPortrait(c, w, h, sp, t, thumb, noBg) {
    const night = !thumb && weather === 'natt';
    const k = sp.kind;
    c.fillStyle = lin(c, 0, 0, 0, h, [[0, night ? '#0c1636' : '#5a9ee0'], [1, night ? '#1e2e58' : '#d8eef9']]);
    if (!noBg) c.fillRect(0, 0, w, h);
    c.save();
    if (k === 'aurora') {
      c.translate(w / 2, h * 0.3);
      c.fillStyle = '#05091c';
      if (!noBg) c.fillRect(-w, -h, w * 2, h * 2);
      SA.ART.aurora(c, w, t, { w, h: h * 0.8 });
    } else if (k === 'rainbow') {
      c.translate(w / 2, h * 1.05);
      SA.ART.rainbow(c, Math.min(w * 0.45, h * 0.9));
    } else if (k === 'cumulus' || k === 'storm') {
      c.translate(w / 2, k === 'storm' ? h * 0.75 : h * 0.8);
      SA.ART[k](c, k === 'storm' ? h * 0.55 : w * 0.7, t, { seed: 9, night });
    } else if (k === 'meteor') {
      c.fillStyle = '#05091c';
      if (!noBg) c.fillRect(0, 0, w, h);
      c.translate(w * 0.7, h * 0.6);
      SA.ART.meteor(c, w * 0.4);
    } else if (SA.ART[k]) {
      c.translate(w / 2, h * 0.5);
      SA.ART[k](c, k === 'plane' ? w * 0.7 : k === 'cirrus' ? w * 0.8 : k === 'kite' ? h * 0.5 : h * 0.6, t, { night });
    } else {
      c.restore();
      const pose = sp.pose === 'perch' ? 'perch' : 'fly';
      X.drawFitted(c, w, h, `sky-${k}-${pose}`, (cx, L) => C.ART[k](cx, L, t, { pose }), thumb ? 0.86 : 0.8);
      return;
    }
    c.restore();
  }

  // ---------- Knapper ----------
  const WEATHER = [['sol', '☀️', 'Sol'], ['skyer', '⛅', 'Skyer og regn'], ['natt', '🌌', 'Natt']];
  function setWeather(w) {
    weather = w;
    buildWorld();
    renderControls();
    if (mode !== 'rolig') banner.show(WEATHER.find((x) => x[0] === w)[2]);
  }
  function renderControls() {
    $('#sky-weather-btn').textContent = WEATHER.find((x) => x[0] === weather)[1];
    $('#sky-music-btn').textContent = settings.music !== 0 ? '🎵' : '🔇';
  }
  $('#sky-weather-btn').addEventListener('click', () => {
    Sound.tap();
    const i = WEATHER.findIndex((x) => x[0] === weather);
    setWeather(WEATHER[(i + 1) % WEATHER.length][0]);
  });
  $('#sky-music-btn').addEventListener('click', () => {
    settings.music = settings.music !== 0 ? 0 : 1;
    P.saveSettings('sky');
    audio.setMusic(settings.music !== 0);
    renderControls();
    Sound.tap();
  });
  $('#sky-album-btn').addEventListener('click', () => { Sound.tap(); album.open(); });
  $('#sky-listen-btn').addEventListener('click', () => {
    Sound.unlock();
    audio.start('sky');
    const near = flocks.filter((f) => f.sp.sound && Math.hypot(f.x - me.x, f.u - me.u) < 5);
    if (!near.length) {
      banner.show('Ingen fugler i nærheten');
      Speech.speak('Det er ingen fugler som synger her akkurat nå. Fly et annet sted.');
      return;
    }
    const f = near[Math.floor(rnd() * near.length)];
    listen = { key: f.sp.key, at: time };
    Speech.speak('Lytt! Hvem var det? Finn fuglen og trykk på den.').then(() => { if (running) playCall(f); });
  });

  // ---------- Start og stopp ----------
  function measure() {
    const r = wrap.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    S = H / VIEW;
  }

  function start(newMode) {
    mode = newMode || 'lar';
    P.show('sky');
    document.body.dataset.skyMode = mode;
    measure();
    weather = settings.weather || 'sol';
    bird = BIRDS[settings.bird] || BIRDS.make;
    found = new Set();
    missionIndex = 0;
    missionDone = false;
    throughCloud = false;
    maxAlt = 0;
    warned = false;
    listen = null;
    nextCall = 0;
    zoneKey = '';
    lookClouds = [];
    buildWorld();
    me.x = settings.bird === 'orn' ? 25 : settings.bird === 'make' ? 4 : 9;
    me.u = gU(me.x) + 0.35;
    me.vx = me.vu = 0;
    me.tx = null;
    me.dir = 1;
    cam.x = clamp(me.x - (W / S) * 0.45, 0, D.WORLD.width - W / S);
    cam.u = Math.max(VIEW / 2 - 0.12, me.u);
    card.close();
    album.close();
    renderMission();
    renderControls();
    $('#sky-album-btn').hidden = mode === 'rolig';
    wrap.querySelector('.ocean-hud').hidden = mode === 'rolig';
    sleep.start(mode === 'rolig' ? settings.sleep : 0);
    audio.resetMaster();
    audio.setMusic(settings.music !== 0);
    audio.start('sky');
    if (mode === 'lar') setTimeout(() => running && Speech.speak(`Nå er du en ${bird.name}! Dra med fingeren for å fly. Trykk på fuglene og skyene for å bli kjent med dem.`), 600);
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
  $$('[data-sky]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.sky);
  }));

  P.registerGame('sky', { screen: 'sky', setupScreen: 'sky-setup', start: () => start('lar'), stop });

  window.PaizonSky = {
    start,
    get me() { return me; },
    get flocks() { return flocks; },
    get things() { return things; },
    get found() { return found; },
    get missionIndex() { return missionIndex; },
    get card() { return card.open; },
    get audio() { return audio; },
    setWeather,
    morphAll() { lookClouds.forEach(morph); },
    teleport(x, m) { me.x = x; me.u = D.uAt(m); me.tx = null; cam.x = clamp(x - (W / S) * 0.45, 0, D.WORLD.width - W / S); cam.u = Math.max(VIEW / 2 - 0.12, me.u); },
    screenOf(x, u) { const r = canvas.getBoundingClientRect(); return { x: r.left + sx(x), y: r.top + sy(u) }; },
  };
})();
