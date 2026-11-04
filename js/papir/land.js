/*
 * Papirdyr – firbeinte og fugler.
 * Gangeriggen (rør-bein, pukkelkropp, hopp), vingeriggen og hubroen er portert fra designet
 * (nature-mammals.js, nature-birds.js). Rådyr, grevling, pinnsvin, kattugle, sangfugler som
 * sitter, spett og flaggermus er laget i samme rigg og stil.
 */
(function () {
  'use strict';

  const K = window.PaizonPapir;
  const { TAU, blob, tube, poly, circ, piece } = K;

  // ---------- Firbeinte ----------
  const HK = [
    [0.0, 0, -0.05, 0.92, 0.9, -2.1, -0.1, 0.1],
    [0.18, 0.35, -0.2, 1.05, -0.4, -0.6, 0.6, -0.2],
    [0.38, 1, 0.0, 1.12, -0.9, -0.2, 0.9, 0.2],
    [0.58, 0.35, 0.22, 1.0, 0.0, -1.0, 0.3, 0.0],
    [0.76, 0.1, 0.12, 0.9, 1.2, -1.6, -0.25, 0.2],
    [1.0, 0, -0.05, 0.92, 0.9, -2.1, -0.1, 0.1],
  ];
  function hopPose(p) {
    p = ((p % 1) + 1) % 1;
    let i = 0;
    while (HK[i + 1][0] < p) i++;
    const a = HK[i];
    const b = HK[i + 1];
    const q = (p - a[0]) / (b[0] - a[0]);
    const e = q * q * (3 - 2 * q);
    const v = a.map((x, k) => x + (b[k] - x) * e);
    return { y: v[1], pitch: v[2], st: v[3], h1: v[4], h2: v[5], f1: v[6], f2: v[7] };
  }
  function hopPhase(s, t) {
    const P = t * (s.gs ?? 1);
    const n = Math.floor(P);
    const g = s.pauseEvery || 0;
    const fr = P - n;
    const paused = !!g && n % g === g - 1;
    return { p: paused ? 0 : fr, paused, fr };
  }

  function leg(ctx, L, s, lg, ph, col, hind, pose, sx, still) {
    const [hx0, hy, l1, l2, w, a1, a2] = lg.map((v, i) => (i < 5 ? v * L : v));
    const hx = hx0 * (sx || 1);
    const sn = Math.sin(TAU * ph);
    const c = Math.cos(TAU * ph);
    let t1;
    let t2;
    if (pose) {
      t1 = hind ? pose.h1 : pose.f1;
      t2 = t1 + (hind ? pose.h2 : pose.f2);
    } else {
      const A = still ? 0 : s.stride ?? 0.35;
      const B = still ? 0 : s.lift ?? 0.8;
      t1 = a1 + A * sn;
      t2 = t1 + a2 - B * Math.max(0, c);
    }
    const kx = hx + Math.sin(t1) * l1;
    const ky = hy + Math.cos(t1) * l1;
    const fx = kx + Math.sin(t2) * l2;
    const fy = ky + Math.cos(t2) * l2;
    piece(ctx, tube([[hx, hy], [kx, ky], [fx, fy]], [w * 1.5, w * 0.8, w * 0.55]), col);
    if (s.pal.hoof) {
      ctx.fillStyle = s.pal.hoof;
      ctx.beginPath();
      ctx.ellipse(fx + w * 0.25, fy + w * 0.2, w * 0.75, w * 0.42, 0, 0, TAU);
      ctx.fill();
    }
  }

  function tail(ctx, L, s, t, off, sx) {
    const [bx0, by, len, r, ang0, type] = s.tail;
    const C = s.pal;
    const bx = bx0 * (sx || 1);
    const ang = ang0 + (off || 0);
    if (type === 'stub' || type === 'puff') {
      piece(ctx, blob(bx * L, by * L, r * L, r * L * (type === 'puff' ? 1 : 0.7)), type === 'puff' ? C.light : C.tipC || C.body);
      return;
    }
    const n = 9;
    const curl = type === 'curl' ? -0.32 : 0.06;
    const pts = [];
    const rs = [];
    let x = bx * L;
    let y = by * L;
    let a = ang;
    for (let i = 0; i < n; i++) {
      pts.push([x, y]);
      const q = i / (n - 1);
      rs.push(r * L * (type === 'curl' ? 0.5 + 0.7 * Math.sin(Math.PI * Math.min(1, q * 1.1)) : 0.4 + 0.75 * Math.sin(Math.PI * (0.15 + q * 0.7))));
      a += curl * (type === 'curl' ? q * 2 : 1) + Math.sin(t * (s.wag ?? 3) - i * 0.5) * 0.05;
      x += (Math.cos(a) * (len * L)) / (n - 1);
      y += (Math.sin(a) * (len * L)) / (n - 1);
    }
    const p = tube(pts, rs);
    piece(ctx, p, C.body);
    if (C.tip) {
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = C.tip;
      const [tx, ty] = pts[n - 1];
      circ(ctx, tx, ty, r * L * 1.3);
      ctx.restore();
    }
  }

  function head(ctx, L, s, hb, earOff, dx) {
    const h = s.head;
    const C = s.pal;
    const u = (v) => v * L;
    ctx.save();
    ctx.translate(u(h.x) + (dx || 0), u(h.y));
    ctx.rotate(hb);
    if (h.antler === 'palm') {
      for (const [ox, col] of [[0.012, C.antlerFar], [0, C.antler]]) {
        const P = [[0, -0.035], [-0.02, -0.07], [-0.06, -0.09], [-0.13, -0.1], [-0.155, -0.145], [-0.13, -0.12], [-0.115, -0.16], [-0.095, -0.125], [-0.078, -0.165], [-0.06, -0.13], [-0.042, -0.155], [-0.03, -0.11], [-0.008, -0.08], [0.012, -0.045]];
        piece(ctx, poly(P.map(([x, y]) => [u(x + ox), u(y)])), col);
      }
    } else if (h.antler === 'branch' || h.antler === 'spike') {
      for (const [ox, col] of [[0.015, C.antlerFar], [0, C.antler]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = u(h.antler === 'spike' ? 0.01 : 0.012);
        const pl = (pts) => {
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(u(x + ox), u(y)) : ctx.moveTo(u(x + ox), u(y))));
          ctx.stroke();
        };
        if (h.antler === 'spike') {
          // Rådyrbukk: korte gevir med tre tagger.
          pl([[-0.005, -0.03], [-0.02, -0.08], [-0.015, -0.12]]);
          pl([[-0.018, -0.07], [0.008, -0.085]]);
          pl([[-0.017, -0.1], [-0.04, -0.115]]);
        } else {
          pl([[0, -0.03], [-0.045, -0.1], [-0.06, -0.18], [-0.035, -0.25], [0.01, -0.28]]);
          pl([[-0.045, -0.1], [0.0, -0.12], [0.03, -0.11]]);
          pl([[-0.058, -0.17], [-0.02, -0.19]]);
          pl([[-0.04, -0.24], [-0.07, -0.29]]);
        }
      }
    }
    const [snx, sny] = h.sn;
    const snout = tube([[0, 0], [u(snx), u(sny)]], [u(h.ry * 0.85), u(h.sr)]);
    const hp = blob(0, 0, u(h.rx), u(h.ry), h.ruff ? [[1.9, 0.5, 0.35]] : null);
    if (h.ruff) piece(ctx, blob(-u(h.rx * 0.2), u(h.ry * 0.45), u(h.rx * 0.95), u(h.ry * 0.75), [[2.2, 0.5, 0.35], [1.2, 0.4, 0.2]]), C.light);
    piece(ctx, hp, C.headC || C.body);
    piece(ctx, snout, C.headC || C.body);
    if (h.mask) {
      ctx.save();
      ctx.clip(snout);
      ctx.fillStyle = C.light;
      ctx.fillRect(-u(0.02), u(sny * 0.5 + h.sr * 0.15), u(snx + 0.05), u(0.1));
      ctx.restore();
    }
    if (h.stripes) {
      // Grevlingen: hvitt ansikt med to svarte striper over øynene.
      for (const p of [hp, snout]) {
        ctx.save();
        ctx.clip(p);
        ctx.fillStyle = C.light;
        ctx.fillRect(-u(0.1), -u(0.1), u(0.3), u(0.2));
        ctx.fillStyle = C.dark;
        ctx.save();
        ctx.rotate(0.12);
        ctx.fillRect(-u(0.12), -u(h.ry * 0.55), u(0.28), u(h.ry * 0.5));
        ctx.restore();
        ctx.restore();
      }
    }
    ctx.fillStyle = C.nose || '#2b211b';
    circ(ctx, u(snx + h.sr * 0.25), u(sny - h.sr * 0.2), u(h.sr * 0.5));
    for (const [ex0, ey0, len, w, a0] of h.ears || []) {
      const a = a0 + (earOff || 0);
      const bx = u(ex0);
      const by = u(ey0);
      const tx = bx + Math.cos(a) * u(len);
      const ty = by + Math.sin(a) * u(len);
      const nx = -Math.sin(a) * u(w);
      const ny = Math.cos(a) * u(w);
      const p = new Path2D();
      if (h.roundEars) p.ellipse((bx + tx) / 2, (by + ty) / 2, u(len * 0.6), u(w * 1.1), a, 0, TAU);
      else {
        p.moveTo(bx + nx, by + ny);
        p.quadraticCurveTo(tx + nx * 0.5, ty + ny * 0.5, tx, ty);
        p.quadraticCurveTo(tx - nx * 0.5, ty - ny * 0.5, bx - nx, by - ny);
        p.closePath();
      }
      piece(ctx, p, C.headC || C.body);
      ctx.save();
      ctx.clip(p);
      if (C.earTip) {
        ctx.fillStyle = C.earTip;
        circ(ctx, tx, ty, u(len * 0.3));
      } else if (!h.roundEars) {
        ctx.fillStyle = C.inner || C.light;
        ctx.beginPath();
        ctx.moveTo(bx + nx * 0.4, by + ny * 0.4);
        ctx.lineTo(tx - Math.cos(a) * u(len * 0.25), ty - Math.sin(a) * u(len * 0.25));
        ctx.lineTo(bx - nx * 0.2, by - ny * 0.2);
        ctx.fill();
      }
      ctx.restore();
      if (h.tufts) {
        ctx.strokeStyle = '#2b211b';
        ctx.lineWidth = Math.max(1, u(0.005));
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + Math.cos(a) * u(0.025), ty + Math.sin(a) * u(0.025));
        ctx.stroke();
      }
    }
    if (h.bell) piece(ctx, tube([[u(0.01), u(h.ry * 0.7)], [u(0.0), u(h.ry * 0.7 + 0.06)]], [u(0.014), u(0.01)]), C.body);
    const [ex, ey, er] = h.eye;
    K.eye(ctx, u(ex), u(ey), u(er));
    ctx.restore();
  }

  /** Tegn et firbeint dyr flatt. still: står i ro (beina hviler, men hale og hode lever). */
  function mammal(ctx, L, s, t, still) {
    const C = s.pal;
    const u = (v) => v * L;
    const hop = s.gait === 'hop';
    let p = t * (s.gs ?? 1);
    let bob;
    let pitch = 0;
    let sx = 1;
    let P0 = null;
    let P1 = null;
    let hb;
    let earOff = 0;
    let tailOff = 0;
    if (hop) {
      const hp = still ? { p: 0, paused: true, fr: (t * 0.4) % 1 } : hopPhase(s, t);
      P0 = hopPose(hp.p);
      P1 = hopPose(hp.p + 0.04);
      p = hp.p;
      bob = -u(s.hopH ?? 0.08) * P0.y + (hp.paused ? -u(0.003) * Math.sin(hp.fr * TAU * 2) : 0);
      pitch = P0.pitch;
      sx = P0.st;
      hb = -pitch * 0.7 + (hp.paused ? Math.sin(hp.fr * TAU) * 0.06 : 0);
      earOff = -0.55 * P0.y + (hp.paused ? Math.sin(hp.fr * TAU * 3) * 0.06 : 0);
      tailOff = -0.6 * P0.y + 0.3 * Math.max(0, P0.pitch) + (hp.paused ? Math.sin(hp.fr * TAU * 2) * 0.25 : 0);
    } else {
      bob = still ? 0 : -u(0.006) * Math.cos(2 * TAU * p);
      hb = Math.sin(TAU * p * 2) * (still ? 0.05 : 0.035);
    }
    const ph = [0, 0.5, 0.25, 0.75];
    const dx = (sx - 1) * u(s.body[0]);
    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(pitch);
    leg(ctx, L, s, s.hind, p + ph[1], C.far, true, P1, sx, still);
    leg(ctx, L, s, s.front, p + ph[3], C.far, false, P1, sx, still);
    if (s.tail) tail(ctx, L, s, t, tailOff, sx);
    const bp = blob(0, 0, u(s.body[0]) * sx, u(s.body[1]) / Math.sqrt(sx), s.bumps);
    piece(ctx, bp, C.body);
    ctx.save();
    ctx.clip(bp);
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    ctx.ellipse(0, u(s.body[1] * 1.05), u(s.body[0] * 0.8) * sx, u(s.body[1] * 0.55), 0, 0, TAU);
    ctx.fill();
    if (s.pattern === 'saddle') {
      ctx.fillStyle = C.dark;
      ctx.beginPath();
      ctx.ellipse(-u(s.body[0] * 0.1), -u(s.body[1] * 0.95), u(s.body[0] * 0.75), u(s.body[1] * 0.5), 0, 0, TAU);
      ctx.fill();
    }
    if (s.pattern === 'spots') {
      ctx.fillStyle = C.spot;
      for (let i = 0; i < 22; i++) {
        const a = ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
        const b = ((Math.sin(i * 37.1) * 12543.1) % 1 + 1) % 1;
        circ(ctx, u(s.body[0] * (a * 1.8 - 0.9)), u(s.body[1] * (b * 1.3 - 0.85)), u(0.008 + b * 0.004));
      }
    }
    if (s.pattern === 'rump') {
      // Rådyret: lys flekk bak.
      ctx.fillStyle = C.light;
      ctx.beginPath();
      ctx.ellipse(-u(s.body[0] * 0.95), -u(s.body[1] * 0.1), u(s.body[0] * 0.22), u(s.body[1] * 0.6), 0, 0, TAU);
      ctx.fill();
    }
    if (s.pattern === 'spines') {
      // Pinnsvinet: piggete pels over hele ryggen.
      ctx.fillStyle = C.dark;
      for (let i = 0; i < 40; i++) {
        const a = Math.PI + 0.1 + ((i * 0.618) % 1) * (Math.PI - 0.2);
        const rr = 0.55 + ((i * 0.37) % 1) * 0.45;
        const x = Math.cos(a) * u(s.body[0]) * rr;
        const y = Math.sin(a) * u(s.body[1]) * rr;
        ctx.beginPath();
        ctx.moveTo(x - u(0.008), y + u(0.006));
        ctx.lineTo(x - u(0.03), y - u(0.018));
        ctx.lineTo(x + u(0.008), y + u(0.002));
        ctx.fill();
      }
    }
    ctx.restore();
    if (s.spineRim) {
      // Pigger som stikker ut langs ryggkanten.
      for (let i = 0; i < 18; i++) {
        const a = Math.PI + 0.25 + (i / 17) * (Math.PI - 0.5);
        const x = Math.cos(a) * u(s.body[0]);
        const y = Math.sin(a) * u(s.body[1]);
        piece(ctx, poly([[x - u(0.012), y + u(0.006)], [x + Math.cos(a - 0.5) * u(0.035), y + Math.sin(a - 0.5) * u(0.035)], [x + u(0.012), y + u(0.006)]]), C.dark);
      }
    }
    if (s.neck) {
      const [x0, y0, x1, y1, r0, r1] = s.neck.map(u);
      piece(ctx, tube([[x0, y0], [x1, y1]], [r0, r1]), C.neckC || C.body);
    }
    leg(ctx, L, s, s.hind, p + ph[0], C.leg, true, P0, sx, still);
    leg(ctx, L, s, s.front, p + ph[2], C.leg, false, P0, sx, still);
    head(ctx, L, s, hb, earOff, dx);
    ctx.restore();
  }

  const MAMMALS = {
    elg: { box: [-0.38, -0.28, 0.49, 0.44], gs: 0.9, body: [0.25, 0.12], bumps: [[-1.25, 0.4, 0.3]], hind: [-0.17, 0.04, 0.17, 0.19, 0.035, 0.1, -0.2], front: [0.15, 0.04, 0.17, 0.2, 0.032, -0.03, 0.04], neck: [0.17, -0.04, 0.33, -0.1, 0.075, 0.05], tail: [-0.25, -0.06, 0, 0.02, 0, 'stub'],
      head: { x: 0.34, y: -0.1, rx: 0.065, ry: 0.05, sn: [0.1, 0.05], sr: 0.04, ears: [[-0.03, -0.035, 0.07, 0.022, -2.3]], eye: [0.012, -0.014, 0.009], antler: 'palm', bell: true },
      pal: { body: '#5b4331', belly: '#4a3628', far: '#8f7d62', leg: '#b9a585', hoof: '#2b211b', light: '#8a7356', antler: '#dccaa0', antlerFar: '#b9a87f', inner: '#8a7356' } },
    raadyr: { box: [-0.25, -0.3, 0.36, 0.33], gs: 1.2, body: [0.19, 0.085], hind: [-0.13, 0.03, 0.13, 0.15, 0.024, 0.1, -0.2], front: [0.12, 0.03, 0.13, 0.15, 0.021, -0.03, 0.04], neck: [0.13, -0.03, 0.26, -0.14, 0.05, 0.035], tail: [-0.19, -0.04, 0, 0.02, 0, 'stub'], pattern: 'rump',
      head: { x: 0.27, y: -0.15, rx: 0.045, ry: 0.036, sn: [0.055, 0.03], sr: 0.022, ears: [[-0.015, -0.03, 0.05, 0.02, -2.2]], eye: [0.006, -0.01, 0.008], antler: 'spike', mask: true },
      pal: { body: '#a85b2c', belly: '#c98a5c', far: '#7a4321', leg: '#94512a', hoof: '#2b211b', light: '#f3ead8', antler: '#c8b28a', antlerFar: '#a08a62', inner: '#6e3c1c', tipC: '#a85b2c' },
      winter: { body: '#7d7266', belly: '#9a8f82', far: '#5b524a', leg: '#6e655b', tipC: '#7d7266', inner: '#4a423a' } },
    rev: { box: [-0.42, -0.17, 0.3, 0.21], gs: 1.6, stride: 0.45, body: [0.18, 0.075], hind: [-0.12, 0.02, 0.09, 0.1, 0.022, 0.1, -0.2], front: [0.12, 0.02, 0.09, 0.1, 0.02, -0.03, 0.03], neck: [0.13, -0.02, 0.21, -0.05, 0.05, 0.04], tail: [-0.16, -0.02, 0.26, 0.045, 2.6, 'bushy'],
      head: { x: 0.22, y: -0.06, rx: 0.05, ry: 0.042, sn: [0.07, 0.012], sr: 0.016, ears: [[0.0, -0.032, 0.06, 0.022, -1.9]], eye: [0.02, -0.012, 0.008], mask: true },
      pal: { body: '#c8642a', belly: '#f3e6d2', far: '#2b211b', leg: '#2b211b', light: '#f3e6d2', tip: '#f6efe2', inner: '#2b211b' } },
    gaupe: { box: [-0.27, -0.18, 0.3, 0.25], gs: 1.2, body: [0.2, 0.09], hind: [-0.13, 0.02, 0.11, 0.12, 0.03, 0.1, -0.2], front: [0.13, 0.02, 0.11, 0.12, 0.028, -0.03, 0.03], neck: [0.14, -0.02, 0.22, -0.06, 0.06, 0.05], tail: [-0.19, -0.04, 0.07, 0.025, 2.4, 'bushy'], pattern: 'spots',
      head: { x: 0.23, y: -0.07, rx: 0.055, ry: 0.05, sn: [0.045, 0.012], sr: 0.028, ears: [[-0.005, -0.04, 0.05, 0.018, -1.75]], tufts: true, ruff: true, eye: [0.02, -0.012, 0.009], mask: true },
      pal: { body: '#b88a55', belly: '#efe2c8', far: '#8a6640', leg: '#b07f4d', light: '#efe2c8', spot: '#6e4e2e', tip: '#2b211b', inner: '#efe2c8' } },
    bjorn: { box: [-0.28, -0.19, 0.42, 0.27], gs: 0.8, stride: 0.3, lift: 0.5, body: [0.25, 0.14], bumps: [[-1.3, 0.45, 0.25]], hind: [-0.15, 0.05, 0.1, 0.11, 0.05, 0.05, -0.08], front: [0.14, 0.05, 0.1, 0.11, 0.046, -0.02, 0.02], neck: [0.17, -0.02, 0.27, -0.02, 0.1, 0.08], tail: [-0.24, -0.05, 0, 0.025, 0, 'stub'],
      head: { x: 0.29, y: -0.02, rx: 0.085, ry: 0.075, sn: [0.08, 0.025], sr: 0.04, ears: [[-0.035, -0.06, 0.035, 0.022, -2.0]], roundEars: true, eye: [0.03, -0.02, 0.009] },
      pal: { body: '#6b4a2e', belly: '#5c3f27', far: '#4a321e', leg: '#5a3d24', hoof: '#2b211b', light: '#8a6440', tipC: '#5a3d24' } },
    hare: { box: [-0.3, -0.38, 0.3, 0.17], gait: 'hop', gs: 1.25, hopH: 0.1, pauseEvery: 4, body: [0.16, 0.11], hind: [-0.1, 0.05, 0.1, 0.13, 0.035, 0.9, -2.1], front: [0.1, 0.06, 0.06, 0.07, 0.018, -0.1, 0.1], tail: [-0.16, -0.02, 0, 0.035, 0, 'puff'],
      head: { x: 0.15, y: -0.07, rx: 0.06, ry: 0.05, sn: [0.04, 0.01], sr: 0.03, ears: [[-0.02, -0.035, 0.16, 0.022, -2.05]], eye: [0.02, -0.015, 0.011] },
      pal: { body: '#8a7458', belly: '#d9cbb3', far: '#6a5844', leg: '#7d6850', light: '#f4efe4', earTip: '#2b2620', nose: '#b9837a' },
      winter: { body: '#f1eee6', belly: '#ffffff', far: '#d8d3c6', leg: '#ebe7dd', light: '#ffffff' } },
    ekorn: { box: [-0.45, -0.42, 0.22, 0.12], gait: 'hop', gs: 1.8, hopH: 0.08, pauseEvery: 3, wag: 4, body: [0.12, 0.08], hind: [-0.07, 0.03, 0.07, 0.08, 0.028, 0.9, -2.0], front: [0.08, 0.04, 0.045, 0.05, 0.014, -0.1, 0.1], tail: [-0.1, -0.02, 0.36, 0.06, -2.3, 'curl'],
      head: { x: 0.12, y: -0.06, rx: 0.05, ry: 0.045, sn: [0.03, 0.012], sr: 0.025, ears: [[-0.015, -0.035, 0.045, 0.016, -1.9]], tufts: true, eye: [0.018, -0.012, 0.01], mask: true },
      pal: { body: '#b5562a', belly: '#f3e6d2', far: '#8a3f1e', leg: '#a94e25', light: '#f3e6d2', inner: '#8a3f1e' } },
    grevling: { box: [-0.3, -0.16, 0.36, 0.14], gs: 1.4, stride: 0.4, lift: 0.6, body: [0.22, 0.09], hind: [-0.14, 0.04, 0.05, 0.06, 0.035, 0.05, -0.1], front: [0.14, 0.04, 0.05, 0.06, 0.032, -0.02, 0.02], neck: [0.16, -0.01, 0.23, 0.0, 0.06, 0.05], tail: [-0.22, -0.03, 0, 0.025, 0, 'stub'],
      head: { x: 0.25, y: 0.0, rx: 0.05, ry: 0.042, sn: [0.07, 0.02], sr: 0.018, ears: [[-0.02, -0.035, 0.02, 0.016, -2.0]], roundEars: true, stripes: true, eye: [0.02, -0.012, 0.007] },
      pal: { body: '#8c8a85', belly: '#2a2826', far: '#1e1c1a', leg: '#2a2826', light: '#f2f0ea', dark: '#151412', tipC: '#a8a59e' } },
    pinnsvin: { box: [-0.24, -0.2, 0.3, 0.1], gs: 2.6, stride: 0.5, body: [0.18, 0.12], bumps: [[-1.57, 0.9, 0.1]], hind: [-0.08, 0.06, 0.03, 0.03, 0.016, 0.1, -0.2], front: [0.08, 0.06, 0.03, 0.03, 0.015, -0.03, 0.03], pattern: 'spines', spineRim: true,
      head: { x: 0.18, y: 0.03, rx: 0.045, ry: 0.04, sn: [0.07, 0.02], sr: 0.015, ears: [[-0.01, -0.03, 0.015, 0.012, -2.0]], roundEars: true, eye: [0.018, -0.01, 0.008] },
      pal: { body: '#6a5644', belly: '#c9b49a', far: '#4a3a2c', leg: '#4a3a2c', light: '#d9c6aa', dark: '#3a2e24', headC: '#c4ad8f', nose: '#1d1712' } },
  };

  for (const [key, s] of Object.entries(MAMMALS)) {
    const bw = s.box[2] - s.box[0];
    const palFor = (o) => (o.winter && s.winter ? Object.assign({}, s.pal, s.winter) : s.pal);
    K.define(key, {
      box: (o) => [s.box[0] - (o.sit ? 0 : 0.02), s.box[1] - 0.05, s.box[2] + 0.02, s.box[3] + 0.04],
      scale: 1 / bw,
      anchor: [(s.box[0] + s.box[2]) / 2, s.box[3]],
      variant: (o) => `${o.winter && s.winter ? 'v' : 's'}${o.gait > 0.5 && !o.sit ? 'w' : 'r'}`,
      period: s.gait === 'hop' ? (s.pauseEvery || 1) / (s.gs || 1) : 1 / (s.gs || 1),
      frames: 24,
      draw: (ctx, L, t, o) => {
        const still = !(o.gait > 0.5) || o.sit;
        mammal(ctx, L, Object.assign({}, s, { pal: palFor(o) }), t, still);
      },
    });
  }

  // ---------- Fugler ----------
  /** Vinge sett fra siden; spennet skaleres med sinus, så den slår opp og ned i perspektiv. */
  function wing(ctx, L, s, k, k2, col, far) {
    const u = (v) => v * L * (far ? 0.85 : 1);
    const W = s.wing;
    const sx = u(W.sx) + (far ? u(0.02) : 0);
    const sy = u(W.sy) - (far ? u(0.01) : 0);
    const wx = sx - u(0.02);
    const wy = sy - u(W.la) * k;
    const tx = wx - u(W.lh * 0.35);
    const ty = wy - u(W.lh) * k2;
    const pts = [[sx + u(W.c0 * 0.4), sy], [wx + u(0.01), wy], [tx, ty]];
    const n = W.fingers || 0;
    const cw = u(W.cw);
    if (n) {
      for (let i = 1; i <= n; i++) {
        const q = i / n;
        const bx = tx + (wx - cw - tx) * q;
        const by = ty + (wy - ty) * q;
        pts.push([bx - u(0.012), by + (q < 1 ? u(0.012) * Math.sign(k2 || 1) : 0)], [bx, by]);
      }
    } else pts.push([(tx + wx - cw) / 2 - u(0.01), (ty + wy) / 2]);
    pts.push([wx - cw, wy + (sy - wy) * 0.15], [sx - u(W.c0), sy + u(0.01)]);
    const p = poly(pts);
    piece(ctx, p, col);
    if (s.pal.tipW && !far) {
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = s.pal.tipW;
      circ(ctx, tx, ty, u(W.lh * 0.45));
      ctx.restore();
    }
  }

  const beaks = {
    pointed: (col, len) => (ctx, L, x, y, r) => piece(ctx, poly([[x - r * 0.1, y - r * 0.32], [x + r * len, y + r * 0.05], [x - r * 0.1, y + r * 0.3]]), col),
    puffin: (ctx, L, x, y, r) => {
      const p = poly([[x - r * 0.1, y - r * 0.55], [x + r * 0.95, y + r * 0.05], [x - r * 0.1, y + r * 0.6]]);
      piece(ctx, p, '#e2552f');
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = '#6e7178';
      ctx.fillRect(x - r * 0.2, y - r, r * 0.32, r * 2);
      ctx.fillStyle = '#f2c24a';
      ctx.fillRect(x + r * 0.45, y - r, r * 0.12, r * 2);
      ctx.restore();
    },
    eagle: (col, cere) => (ctx, L, x, y, r) => {
      piece(ctx, poly([[x - r * 0.15, y - r * 0.35], [x + r * 0.5, y - r * 0.3], [x + r * 0.75, y + r * 0.1], [x + r * 0.55, y + r * 0.35], [x + r * 0.5, y + r * 0.1], [x - r * 0.15, y + r * 0.3]]), col);
      ctx.fillStyle = cere;
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.02, r * 0.22, r * 0.3, 0, 0, TAU);
      ctx.fill();
    },
    gull: (ctx, L, x, y, r) => {
      piece(ctx, poly([[x - r * 0.1, y - r * 0.28], [x + r * 0.95, y - r * 0.05], [x + r * 1.0, y + r * 0.15], [x - r * 0.1, y + r * 0.28]]), '#e8c030');
      ctx.fillStyle = '#d0402a';
      circ(ctx, x + r * 0.75, y + r * 0.12, r * 0.08);
    },
  };

  /** Flygende fugl (designets rigg, med valgfri hals og lange bein for gås og trane). */
  function flyer(ctx, L, s, t, glide) {
    const C = s.pal;
    const u = (v) => v * L;
    const ph = TAU * t * s.flap;
    const amp = glide ? s.amp * 0.18 : s.amp;
    const dih = glide ? (s.dihedral ?? 0) + 0.25 : s.dihedral ?? 0;
    const k = dih + amp * Math.sin(ph);
    const k2 = dih + amp * Math.sin(ph - 0.7);
    ctx.save();
    ctx.translate(0, -u(0.012) * Math.cos(ph) * (glide ? 0.3 : 1));
    ctx.rotate(s.tilt ?? 0);
    wing(ctx, L, s, k, k2, C.far, true);
    if (s.feet) piece(ctx, tube([[-u(0.05), u(s.body[1] * 0.6)], [-u(0.13), u(s.body[1] * 0.75)]], [u(0.012), u(0.016)]), C.feet);
    if (s.legsBack) piece(ctx, tube([[-u(s.body[0] * 0.6), u(s.body[1] * 0.5)], [-u(s.body[0] + s.tailL + 0.12), u(0.02)]], [u(0.008), u(0.006)]), C.feet);
    if (s.fork) {
      piece(ctx, poly([[-u(s.body[0] * 0.8), -u(0.015)], [-u(s.body[0] + s.tailL), -u(0.045)], [-u(s.body[0] + s.tailL * 0.45), u(0.0)], [-u(s.body[0] + s.tailL), u(0.03)], [-u(s.body[0] * 0.8), u(0.02)]]), C.tail || C.back);
    } else {
      piece(ctx, poly([[-u(s.body[0] * 0.8), -u(0.015)], [-u(s.body[0] + s.tailL), -u(0.03)], [-u(s.body[0] + s.tailL * 0.9), u(0.03)], [-u(s.body[0] * 0.8), u(0.02)]]), C.tail || C.back);
    }
    const bp = blob(0, 0, u(s.body[0]), u(s.body[1]), [[0, 0.6, -0.1]]);
    piece(ctx, bp, C.back);
    ctx.save();
    ctx.clip(bp);
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    ctx.ellipse(u(0.02), u(s.body[1] * 0.9), u(s.body[0] * 0.95), u(s.body[1] * 0.6), 0, 0, TAU);
    ctx.fill();
    if (s.bars) {
      ctx.strokeStyle = C.bar;
      ctx.lineWidth = u(0.006);
      for (let i = 0; i < 8; i++) {
        const x = -u(s.body[0] * 0.6) + i * u(s.body[0] * 0.18);
        ctx.beginPath();
        ctx.moveTo(x, u(s.body[1] * 0.2));
        ctx.lineTo(x + u(0.01), u(s.body[1] * 0.9));
        ctx.stroke();
      }
    }
    ctx.restore();
    const [hx, hy, hr] = s.headP.map(u);
    if (s.neckLen) piece(ctx, tube([[u(s.body[0] * 0.7), -u(0.005)], [hx, hy]], [u(s.body[1] * 0.45), hr * 0.6]), C.neck || C.back);
    const hp = blob(hx, hy, hr, hr * 0.92);
    piece(ctx, hp, C.head || C.back);
    ctx.save();
    ctx.clip(hp);
    if (s.face) {
      ctx.fillStyle = s.face;
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.25, hy + hr * 0.1, hr * 0.7, hr * 0.62, 0, 0, TAU);
      ctx.fill();
    }
    if (C.nape) {
      ctx.fillStyle = C.nape;
      ctx.beginPath();
      ctx.ellipse(hx - hr * 0.5, hy - hr * 0.4, hr * 0.8, hr * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    if (C.cap) {
      ctx.fillStyle = C.cap;
      ctx.fillRect(hx - hr, hy - hr, hr * 2, hr * 0.7);
    }
    if (C.cheek) {
      ctx.fillStyle = C.cheek;
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.1, hy + hr * 0.3, hr * 0.55, hr * 0.35, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    s.beak(ctx, L, hx + hr * 0.75, hy + hr * 0.05, hr);
    K.eye(ctx, hx + hr * 0.35, hy - hr * 0.15, hr * 0.16);
    wing(ctx, L, s, k, k2, C.wing || C.back, false);
    ctx.restore();
  }

  /**
   * Sangfugl som sitter: kropp på skrå, sammenfoldet vinge, hale og to tynne bein. Origo ved føttene.
   * Samme proporsjoner og farger som når den flyr.
   */
  function percher(ctx, L, s, t) {
    const C = s.pal;
    const u = (v) => v * L;
    const breathe = Math.sin(t * 1.57) * 0.012;
    const look = Math.sin(t * 0.785) > 0.6 ? 0.25 : 0;
    ctx.strokeStyle = C.feet || '#6a5a4a';
    ctx.lineWidth = Math.max(1, u(0.01));
    for (const dx of [-0.01, 0.025]) {
      ctx.beginPath();
      ctx.moveTo(u(dx), 0);
      ctx.lineTo(u(dx - 0.01), -u(0.06));
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(0, -u(0.105));
    ctx.rotate(-0.55);
    // Hale som peker ned bak.
    const tl = s.tailL + 0.03;
    piece(ctx, poly([[-u(s.body[0] * 0.7), -u(0.01)], [-u(s.body[0] + tl), -u(0.022)], [-u(s.body[0] + tl * 0.92), u(0.022)], [-u(s.body[0] * 0.7), u(0.02)]]), C.tail || C.back);
    const bp = blob(0, 0, u(s.body[0]) * (1 + breathe), u(s.body[1] * 1.25) * (1 + breathe));
    piece(ctx, bp, C.back);
    ctx.save();
    ctx.clip(bp);
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    ctx.ellipse(u(0.03), u(s.body[1] * 1.0), u(s.body[0] * 0.95), u(s.body[1] * 0.85), 0, 0, TAU);
    ctx.fill();
    if (C.bib) {
      ctx.fillStyle = C.bib;
      ctx.fillRect(u(s.body[0] * 0.55), -u(0.1), u(0.022), u(0.2));
    }
    if (s.bars) {
      ctx.strokeStyle = C.bar;
      ctx.lineWidth = u(0.006);
      for (let i = 0; i < 6; i++) {
        const y = u(s.body[1] * (0.2 + i * 0.14));
        ctx.beginPath();
        ctx.moveTo(-u(s.body[0] * 0.5), y);
        ctx.lineTo(u(s.body[0]), y + u(0.01));
        ctx.stroke();
      }
    }
    ctx.restore();
    // Sammenfoldet vinge.
    const wp = blob(-u(s.body[0] * 0.15), -u(s.body[1] * 0.15), u(s.body[0] * 0.75), u(s.body[1] * 0.75), [[Math.PI, 0.5, 0.35]]);
    piece(ctx, wp, C.wing || C.back);
    if (C.wingBar) {
      ctx.save();
      ctx.clip(wp);
      ctx.fillStyle = C.wingBar;
      ctx.fillRect(-u(0.2), -u(s.body[1] * 0.1), u(0.4), u(0.012));
      ctx.restore();
    }
    ctx.restore();
    // Hodet sitter rett (ikke på skrå), og snur seg av og til.
    const [hx0, hy0, hr0] = s.headP;
    const hx = u(0.06 + hx0 * 0.15);
    const hy = -u(0.105 + s.body[1] * 1.5 + 0.02 - hy0 * 0.2);
    const hr = u(hr0 * 1.05);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(look - 0.05);
    const hp = blob(0, 0, hr, hr * 0.92);
    piece(ctx, hp, C.head || C.back);
    ctx.save();
    ctx.clip(hp);
    if (s.face) {
      ctx.fillStyle = s.face;
      ctx.beginPath();
      ctx.ellipse(hr * 0.25, hr * 0.1, hr * 0.7, hr * 0.62, 0, 0, TAU);
      ctx.fill();
    }
    if (C.cap) {
      ctx.fillStyle = C.cap;
      ctx.fillRect(-hr, -hr, hr * 2, hr * 0.7);
    }
    if (C.cheek) {
      ctx.fillStyle = C.cheek;
      ctx.beginPath();
      ctx.ellipse(hr * 0.1, hr * 0.3, hr * 0.55, hr * 0.35, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    s.beak(ctx, L, hr * 0.75, hr * 0.05, hr);
    K.eye(ctx, hr * 0.35, -hr * 0.15, hr * 0.16);
    ctx.restore();
  }

  /** Ugle på grein (designets hubro; kattugla har ingen øredusker). Origo ved greina. */
  function owl(ctx, L, s, t) {
    const u = (v) => v * L;
    const C = s.pal;
    const turn = Math.sin(t * 0.6) * 0.5;
    const blink = t % 3.4 < 0.14 ? 0.1 : 1;
    if (s.branch !== false) piece(ctx, tube([[-u(0.3), u(0.2)], [u(0.3), u(0.17)]], [u(0.028), u(0.022)]), '#6b5236');
    for (const dx of [-0.035, 0.035]) piece(ctx, tube([[u(dx), u(0.14)], [u(dx + 0.005), u(0.18)]], [u(0.016), u(0.013)]), C.feet);
    piece(ctx, poly([[-u(0.05), u(0.1)], [-u(0.1), u(0.21)], [u(0.0), u(0.2)], [u(0.03), u(0.12)]]), C.far);
    const bp = blob(0, u(0.02), u(0.1), u(0.14), [[-1.57, 0.6, -0.08]]);
    piece(ctx, bp, C.back);
    ctx.save();
    ctx.clip(bp);
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    ctx.ellipse(u(0.03), u(0.06), u(0.07), u(0.11), 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = C.far;
    ctx.lineWidth = Math.max(1, u(0.004));
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 3; j++) {
        const x = u(0.0 + j * 0.03);
        const y = u(-0.02 + i * 0.025);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + u(0.012));
        ctx.stroke();
      }
    }
    ctx.restore();
    piece(ctx, poly([[-u(0.1), -u(0.02)], [-u(0.02), u(0.0)], [u(0.02), u(0.12)], [-u(0.06), u(0.15)], [-u(0.11), u(0.08)]]), C.wing);
    const hx = u(0.01 + turn * 0.015);
    const hy = -u(0.13);
    const hr = u(0.075);
    if (s.tufts !== false) {
      for (const sx of [-1, 1]) piece(ctx, poly([[hx + sx * hr * 0.35 + turn * hr * 0.2, hy - hr * 0.7], [hx + sx * hr * 0.95 + turn * hr * 0.3, hy - hr * 1.45], [hx + sx * hr * 0.75 + turn * hr * 0.2, hy - hr * 0.5]]), C.back);
    }
    piece(ctx, blob(hx, hy, hr * 1.05, hr * 0.92), C.back);
    const fx = hx + turn * hr * 0.35;
    ctx.fillStyle = C.face;
    ctx.beginPath();
    ctx.ellipse(fx, hy + hr * 0.05, hr * 0.78, hr * 0.62, 0, 0, TAU);
    ctx.fill();
    for (const ex of [-0.36, 0.36]) {
      const x = fx + ex * hr;
      const y = hy - hr * 0.05;
      ctx.fillStyle = s.eyeCol || '#f08a1c';
      ctx.beginPath();
      ctx.ellipse(x, y, hr * 0.22, hr * 0.22 * blink, 0, 0, TAU);
      ctx.fill();
      if (blink > 0.5) {
        ctx.fillStyle = '#1d1712';
        circ(ctx, x + turn * hr * 0.05, y, hr * 0.11);
        ctx.fillStyle = '#ffffff';
        circ(ctx, x + hr * 0.06, y - hr * 0.06, hr * 0.04);
      }
    }
    piece(ctx, poly([[fx - hr * 0.1, hy + hr * 0.15], [fx + hr * 0.1, hy + hr * 0.15], [fx, hy + hr * 0.45]]), '#3a3230');
  }

  /** Flaggermus: hudvinger mellom lange fingre, slår raskt. */
  function bat(ctx, L, t) {
    const u = (v) => v * L;
    const f = Math.sin(t * TAU * 6);
    for (const [s, col] of [[-1, '#2a221e'], [1, '#3a302a']]) {
      const tipY = -u(0.25) * f;
      const p = poly([[0, -u(0.02)], [s * u(0.18), tipY - u(0.05)], [s * u(0.42), tipY + u(0.02)], [s * u(0.33), u(0.05)], [s * u(0.22), u(0.02)], [s * u(0.14), u(0.07)], [0, u(0.04)]]);
      piece(ctx, p, col);
    }
    piece(ctx, blob(0, 0, u(0.07), u(0.1)), '#5a4434');
    piece(ctx, poly([[-u(0.05), -u(0.08)], [-u(0.06), -u(0.17)], [-u(0.01), -u(0.1)], [u(0.01), -u(0.1)], [u(0.06), -u(0.17)], [u(0.05), -u(0.08)]]), '#5a4434');
    ctx.fillStyle = '#1d1712';
    circ(ctx, -u(0.02), -u(0.06), u(0.01));
    circ(ctx, u(0.02), -u(0.06), u(0.01));
  }

  const P = (o) => o;
  const song = { sx: 0, sy: -0.03, la: 0.06, lh: 0.09, c0: 0.05, cw: 0.035 };
  const BIRDS = {
    spurv: P({ body: [0.1, 0.055], tailL: 0.06, headP: [0.1, -0.03, 0.045], flap: 9, amp: 1, beak: beaks.pointed('#3a3430', 0.55), wing: song, pal: { back: '#8a6a44', belly: '#cdc6b6', far: '#5e4630', wing: '#7a5530', wingBar: '#f0ece2', head: '#7a7a7c', cheek: '#e2ddd2', bib: '#2a2622', feet: '#8a6a50' } }),
    kjottmeis: P({ body: [0.095, 0.055], tailL: 0.06, headP: [0.1, -0.03, 0.045], flap: 10, amp: 1, beak: beaks.pointed('#2a2420', 0.5), wing: song, pal: { back: '#6f8a3a', belly: '#f0d23c', far: '#3e4c5e', wing: '#5c7088', wingBar: '#e8ecf0', tail: '#4a5a70', head: '#151515', cheek: '#f4f4f0', bib: '#151515', feet: '#6a7280' } }),
    trost: P({ body: [0.11, 0.055], tailL: 0.09, headP: [0.11, -0.03, 0.045], flap: 8, amp: 1, beak: beaks.pointed('#e9a21c', 0.75), wing: song, pal: { back: '#1f1d1c', belly: '#2a2725', far: '#141312', wing: '#262321', feet: '#4a4038' } }),
    gjok: P({ body: [0.12, 0.05], tailL: 0.14, headP: [0.12, -0.025, 0.04], flap: 6, amp: 1, beak: beaks.pointed('#3a3430', 0.6), bars: true, wing: { sx: 0, sy: -0.03, la: 0.08, lh: 0.12, c0: 0.06, cw: 0.04 }, pal: { back: '#7a8088', belly: '#ecebe4', far: '#525860', wing: '#646a72', tail: '#5d636b', bar: '#4a4f56', feet: '#e2b23a' } }),
    skjaere: P({ body: [0.1, 0.055], tailL: 0.22, headP: [0.1, -0.03, 0.045], flap: 6, amp: 1, beak: beaks.pointed('#121418', 0.7), wing: { sx: 0, sy: -0.03, la: 0.08, lh: 0.11, c0: 0.06, cw: 0.04 }, pal: { back: '#141619', belly: '#f4f4f2', far: '#101214', wing: '#1c2a46', tipW: '#f2f2ee', tail: '#1d3a3a', feet: '#2a2a2a' } }),
    kraake: P({ body: [0.12, 0.06], tailL: 0.1, headP: [0.12, -0.03, 0.048], flap: 4.5, amp: 0.9, beak: beaks.pointed('#141414', 0.85), wing: { sx: 0, sy: -0.03, la: 0.1, lh: 0.14, c0: 0.07, cw: 0.05, fingers: 4 }, pal: { back: '#7a7d80', belly: '#888b8e', far: '#141416', wing: '#1c1c1e', tail: '#1c1c1e', head: '#1c1c1e', feet: '#1c1c1e' } }),
    ravn: P({ body: [0.13, 0.06], tailL: 0.12, headP: [0.13, -0.03, 0.05], flap: 3.5, amp: 0.85, beak: beaks.pointed('#0e0e10', 1.0), wing: { sx: 0, sy: -0.03, la: 0.12, lh: 0.17, c0: 0.08, cw: 0.06, fingers: 5 }, pal: { back: '#141418', belly: '#1c1c22', far: '#0c0c0e', wing: '#18181c', tail: '#141418', feet: '#141418' } }),
    svale: P({ body: [0.09, 0.045], tailL: 0.16, fork: true, headP: [0.09, -0.025, 0.04], flap: 8, amp: 1, beak: beaks.pointed('#141414', 0.35), wing: { sx: 0, sy: -0.03, la: 0.08, lh: 0.15, c0: 0.04, cw: 0.025 }, pal: { back: '#1e2a52', belly: '#f2e8da', far: '#141c38', wing: '#1a2240', tail: '#1a2240', cheek: '#b4462c', feet: '#3a3030' } }),
    taarnseiler: P({ body: [0.09, 0.04], tailL: 0.08, fork: true, headP: [0.09, -0.02, 0.038], flap: 10, amp: 0.9, beak: beaks.pointed('#141414', 0.3), wing: { sx: 0, sy: -0.03, la: 0.09, lh: 0.2, c0: 0.035, cw: 0.02 }, pal: { back: '#2a2622', belly: '#34302c', far: '#1c1916', wing: '#24201c', tail: '#2a2622', cheek: '#c8c0b0', feet: '#2a2622' } }),
    lerke: P({ body: [0.1, 0.05], tailL: 0.08, headP: [0.1, -0.03, 0.044], flap: 11, amp: 1, beak: beaks.pointed('#5a4a3a', 0.6), bars: true, wing: song, pal: { back: '#8a744e', belly: '#e6dac0', far: '#5e4e34', wing: '#7a6440', tail: '#6a5638', cap: '#6a5638', bar: '#8a7450', feet: '#c8a888' } }),
    make: P({ body: [0.13, 0.055], tailL: 0.06, headP: [0.13, -0.025, 0.045], flap: 2.4, amp: 0.8, dihedral: 0.05, beak: beaks.gull, wing: { sx: 0, sy: -0.03, la: 0.14, lh: 0.2, c0: 0.06, cw: 0.04 }, pal: { back: '#f6f4ee', belly: '#ffffff', far: '#8e98a2', wing: '#aab4be', tipW: '#1c1c1c', tail: '#f6f4ee', feet: '#e7a46a' } }),
    havorn: P({ body: [0.14, 0.06], tailL: 0.08, headP: [0.14, -0.025, 0.05], flap: 0.7, amp: 0.85, dihedral: 0.12, beak: beaks.eagle('#e8c040', '#e8c040'), wing: { sx: 0.01, sy: -0.03, la: 0.13, lh: 0.18, c0: 0.11, cw: 0.09, fingers: 5 }, pal: { back: '#5a4230', belly: '#4a3626', far: '#33261b', wing: '#5c4532', tail: '#f4f0e6', head: '#c9b89a', feet: '#e8c040' } }),
    kongeorn: P({ body: [0.13, 0.055], tailL: 0.09, headP: [0.13, -0.025, 0.045], flap: 0.7, amp: 0.85, dihedral: 0.15, tilt: 0.02, beak: beaks.eagle('#5b5550', '#e8b93a'), wing: { sx: 0.01, sy: -0.03, la: 0.12, lh: 0.17, c0: 0.1, cw: 0.08, fingers: 5 }, pal: { back: '#4a3524', belly: '#3d2b1d', far: '#2f2217', wing: '#55402c', tail: '#3d2b1d', nape: '#c8a060', feet: '#e8b93a' } }),
    fjellvaak: P({ body: [0.12, 0.055], tailL: 0.08, headP: [0.12, -0.025, 0.045], flap: 1.2, amp: 0.8, dihedral: 0.12, beak: beaks.eagle('#2a2420', '#e8c040'), wing: { sx: 0.01, sy: -0.03, la: 0.11, lh: 0.15, c0: 0.09, cw: 0.07, fingers: 4 }, pal: { back: '#7a6450', belly: '#efe6d6', far: '#4a3a2c', wing: '#8a7460', tipW: '#2a221a', tail: '#f4f0e6', head: '#c9b8a0', feet: '#e8c040' } }),
    gaas: P({ body: [0.13, 0.05], tailL: 0.05, neckLen: true, headP: [0.25, -0.03, 0.038], flap: 3, amp: 0.85, beak: beaks.pointed('#e8964a', 0.85), wing: { sx: 0, sy: -0.03, la: 0.12, lh: 0.16, c0: 0.08, cw: 0.05 }, pal: { back: '#7d7466', belly: '#c9c0b0', far: '#4e483e', wing: '#6a6256', tipW: '#3a3630', tail: '#4a4640', neck: '#6a6256', head: '#5a544c', feet: '#e8964a' } }),
    trane: P({ body: [0.13, 0.045], tailL: 0.05, neckLen: true, legsBack: true, headP: [0.3, -0.03, 0.032], flap: 2.4, amp: 0.85, beak: beaks.pointed('#3a3a3a', 1.4), wing: { sx: 0, sy: -0.03, la: 0.14, lh: 0.18, c0: 0.09, cw: 0.06, fingers: 5 }, pal: { back: '#9aa0a6', belly: '#b0b6bc', far: '#6a7076', wing: '#8a9096', tipW: '#1a1a1a', tail: '#5a5e62', neck: '#1e1e1e', head: '#1e1e1e', cheek: '#f4f4f2', cap: '#c0302a', feet: '#2a2a2a' } }),
  };

  const FLY_BOX = [-0.5, -0.42, 0.5, 0.42];
  const PERCH_BOX = [-0.36, -0.42, 0.3, 0.04];
  for (const [key, s] of Object.entries(BIRDS)) {
    const len = 0.13 + s.body[0] + s.tailL + (s.neckLen ? s.headP[0] - s.body[0] : 0) + 0.05;
    K.define(key, {
      box: (o) => (o.pose === 'perch' ? PERCH_BOX : FLY_BOX),
      scale: 1 / len,
      anchor: [0, 0],
      variant: (o) => o.pose || 'fly',
      period: (o) => (o.pose === 'perch' ? 4 : 1 / s.flap),
      frames: 16,
      draw: (ctx, L, t, o) => {
        if (o.pose === 'perch') percher(ctx, L, s, t);
        else flyer(ctx, L, s, t, o.pose === 'glide');
      },
    });
  }

  K.define('ugle', {
    box: [-0.32, -0.27, 0.32, 0.25],
    scale: 1 / 0.3,
    anchor: [0, 0.18],
    period: 6.8,
    frames: 68,
    draw: (ctx, L, t) => owl(ctx, L, { tufts: false, branch: false, eyeCol: '#2a1c12', pal: { back: '#7a5a3c', belly: '#b89670', far: '#4f3a26', wing: '#6a4e34', face: '#a98a62', feet: '#b89670' } }, t),
  });
  K.define('hubro', {
    box: [-0.32, -0.27, 0.32, 0.25],
    scale: 1 / 0.3,
    anchor: [0, 0.18],
    period: 6.8,
    frames: 68,
    draw: (ctx, L, t) => owl(ctx, L, { branch: false, pal: { back: '#8a6a45', belly: '#c9a87a', far: '#5a4330', wing: '#7a5c3c', face: '#b48c5e', feet: '#c9a87a' } }, t),
  });
  K.define('flaggermus', { box: [-0.48, -0.32, 0.48, 0.15], scale: 1, period: 1 / 6, frames: 8, draw: bat });
  // Flaggspett som klatrer på en trestamme: sittende fugl dreid opp, med rød flekk under halen.
  const spett = { body: [0.11, 0.05], tailL: 0.09, headP: [0.11, -0.03, 0.045], beak: beaks.pointed('#2a2622', 0.9), wing: song, pal: { back: '#16161a', belly: '#efe8dc', wing: '#16161a', wingBar: '#f4f0e8', tail: '#16161a', head: '#16161a', cheek: '#f4f0e8', feet: '#5a5550' } };
  K.define('spett', {
    box: [-0.45, -0.45, 0.45, 0.45],
    scale: 1 / 0.33,
    period: 1.5,
    frames: 18,
    draw: (ctx, L, t) => {
      const peck = Math.max(0, Math.sin(t * TAU * 2)) * (Math.sin(t * TAU / 1.5) > 0 ? 1 : 0);
      ctx.save();
      // Klatrer oppover stammen: kroppen står rett opp, med stammen på høyre side.
      ctx.translate(peck * L * 0.02, L * 0.14);
      ctx.rotate(-0.85);
      percher(ctx, L, spett, t);
      ctx.fillStyle = '#d02a2a';
      ctx.beginPath();
      ctx.ellipse(-L * 0.12, -L * 0.07, L * 0.03, L * 0.02, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  });

  window.PaizonPapirLand = { mammal, flyer, percher, owl, MAMMALS, BIRDS };
})();
