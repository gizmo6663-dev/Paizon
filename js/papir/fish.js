/*
 * Papirdyr – fiskeriggen (og hvaler og sel, som svømmer med samme bølge).
 * Portert fra designet (sea-fish.js): fisken peker mot høyre, origo midt på kroppen, lengde L.
 * Hele kroppen bølger i én kurve, så finner, mønster og øye følger med av seg selv.
 */
(function () {
  'use strict';

  const K = window.PaizonPapir;
  const { TAU, circ } = K;

  function geo(L, s, t) {
    const H = L * s.h;
    const tx = -L * 0.36;
    const hx = L * 0.5;
    const p = Math.log(0.5) / Math.log(s.peak || 0.62);
    const st = s.stalk ?? 0.06;
    const bl = s.blunt ?? 0.04;
    const thick = (u) => {
      u = Math.max(0, Math.min(1, u));
      return H * (st + (0.5 - st) * Math.pow(Math.sin(Math.PI * (Math.pow(u, p) * (1 - bl) + bl * 0.25)), 0.85));
    };
    const amp = H * (s.amp ?? 0.16);
    const k = s.k ?? 3.2;
    const sp = s.sp ?? 5;
    const pw = s.pw ?? 2;
    const wave = (u) => amp * Math.pow(1 - u, pw) * Math.sin(t * sp - u * k);
    return { H, tx, hx, thick, wave, xAt: (u) => tx + u * (hx - tx) };
  }
  const N = 28;
  function bodyP(g) {
    const p = new Path2D();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const y = g.wave(u) - g.thick(u) * 1.04;
      if (i) p.lineTo(g.xAt(u), y);
      else p.moveTo(g.xAt(u), y);
    }
    const ny = g.wave(1);
    const nt = g.thick(1);
    const r = nt * 1.3 + g.H * 0.05;
    p.bezierCurveTo(g.hx + r * 0.75, ny - nt * 1.04, g.hx + r, ny - nt * 0.3, g.hx + r, ny);
    p.bezierCurveTo(g.hx + r, ny + nt * 0.3, g.hx + r * 0.75, ny + nt * 0.96, g.hx, ny + nt * 0.96);
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      p.lineTo(g.xAt(u), g.wave(u) + g.thick(u) * 0.96);
    }
    p.closePath();
    return p;
  }
  function band(g, f0, f1) {
    const p = new Path2D();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const y = g.wave(u) + g.thick(u) * f0;
      if (i) p.lineTo(g.xAt(u), y);
      else p.moveTo(g.xAt(u), y);
    }
    p.lineTo(g.hx + g.H, g.wave(1) + g.thick(1) * f0);
    p.lineTo(g.hx + g.H, g.wave(1) + g.thick(1) * f1);
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      p.lineTo(g.xAt(u), g.wave(u) + g.thick(u) * f1);
    }
    p.closePath();
    return p;
  }
  function finP(g, f, dn) {
    const [u0, u1, h, shape] = f;
    const s = dn ? 1 : -1;
    const p = new Path2D();
    const M = 14;
    for (let i = 0; i <= M; i++) {
      const q = i / M;
      const u = u0 + (u1 - u0) * q;
      const prof = shape === 'tri' ? (q < 0.55 ? q / 0.55 : Math.max(0, (1 - q) / 0.45) * 0.5) : Math.pow(Math.sin(Math.PI * q), 0.6);
      const y = g.wave(u) + s * (g.thick(u) * 0.85 + g.H * h * prof);
      if (i) p.lineTo(g.xAt(u), y);
      else p.moveTo(g.xAt(u), y);
    }
    for (let i = M; i >= 0; i--) {
      const u = u0 + ((u1 - u0) * i) / M;
      p.lineTo(g.xAt(u), g.wave(u) + s * g.thick(u) * 0.6);
    }
    p.closePath();
    return p;
  }
  function tailP(L, H, type) {
    const p = new Path2D();
    const w = L * 0.16;
    if (type === 'round') {
      p.moveTo(2, -H * 0.08);
      p.bezierCurveTo(-w * 0.5, -H * 0.5, -w * 1.1, -H * 0.32, -w * 1.05, 0);
      p.bezierCurveTo(-w * 1.1, H * 0.32, -w * 0.5, H * 0.5, 2, H * 0.08);
    } else if (type === 'lunate') {
      p.moveTo(2, -H * 0.06);
      p.quadraticCurveTo(-w * 0.6, -H * 0.3, -w * 1.05, -H * 0.66);
      p.quadraticCurveTo(-w * 0.45, 0, -w * 1.05, H * 0.66);
      p.quadraticCurveTo(-w * 0.6, H * 0.3, 2, H * 0.06);
    } else if (type === 'shark') {
      p.moveTo(4, -H * 0.07);
      p.quadraticCurveTo(-w * 0.5, -H * 0.3, -w * 1.3, -H * 0.8);
      p.quadraticCurveTo(-w * 0.75, -H * 0.1, -w * 0.6, H * 0.05);
      p.quadraticCurveTo(-w * 0.45, H * 0.3, -w * 0.55, H * 0.42);
      p.quadraticCurveTo(-w * 0.2, H * 0.15, 4, H * 0.07);
    } else if (type === 'fluke') {
      p.moveTo(4, -H * 0.05);
      p.quadraticCurveTo(-w * 0.4, -H * 0.1, -w * 0.95, -H * 0.26);
      p.quadraticCurveTo(-w * 0.7, 0, -w * 0.95, H * 0.2);
      p.quadraticCurveTo(-w * 0.4, H * 0.1, 4, H * 0.05);
    } else if (type === 'whip') {
      // Havmusa har en lang, tynn piskehale.
      p.moveTo(2, -H * 0.05);
      p.quadraticCurveTo(-w * 1.2, -H * 0.05, -w * 2.2, -H * 0.01);
      p.lineTo(-w * 2.2, H * 0.01);
      p.quadraticCurveTo(-w * 1.2, H * 0.06, 2, H * 0.05);
    } else if (type === 'flipper') {
      // Selens bakluffer: to brede, avrundede luffer.
      p.moveTo(4, -H * 0.12);
      p.bezierCurveTo(-w * 0.5, -H * 0.4, -w * 1.1, -H * 0.36, -w * 1.0, -H * 0.05);
      p.bezierCurveTo(-w * 1.1, H * 0.3, -w * 0.5, H * 0.38, 4, H * 0.12);
    } else {
      p.moveTo(2, -H * 0.08);
      p.quadraticCurveTo(-w * 0.6, -H * 0.3, -w, -H * 0.56);
      p.quadraticCurveTo(-w * 0.6, 0, -w, H * 0.56);
      p.quadraticCurveTo(-w * 0.6, H * 0.3, 2, H * 0.08);
    }
    p.closePath();
    return p;
  }
  const R = (i, m) => ((Math.sin(i * 127.1 + m * 311.7) * 43758.5453) % 1 + 1) % 1;

  function pattern(ctx, g, s, C, L) {
    const H = g.H;
    const at = (u, f) => [g.xAt(u), g.wave(u) + g.thick(u) * f];
    ctx.fillStyle = C.spot;
    ctx.strokeStyle = C.spot;
    ctx.lineCap = 'round';
    switch (s.pattern) {
      case 'spots':
        for (let i = 0; i < 16; i++) {
          const [x, y] = at(0.1 + R(i, 1) * 0.72, -0.2 - R(i, 2) * 0.6);
          circ(ctx, x, y, H * 0.045);
        }
        break;
      case 'xspots':
        ctx.lineWidth = H * 0.035;
        for (let i = 0; i < 14; i++) {
          const [x, y] = at(0.2 + R(i, 1) * 0.65, -0.15 - R(i, 2) * 0.6);
          const r = H * 0.04;
          ctx.beginPath();
          ctx.moveTo(x - r, y - r);
          ctx.lineTo(x + r, y + r);
          ctx.moveTo(x + r, y - r);
          ctx.lineTo(x - r, y + r);
          ctx.stroke();
        }
        break;
      case 'bars':
        ctx.lineWidth = H * 0.055;
        for (let i = 0; i < 15; i++) {
          const u = 0.1 + i * 0.045;
          ctx.beginPath();
          for (let j = 0; j <= 4; j++) {
            const [x, y] = at(u, -1.1 + j * 0.22);
            ctx[j ? 'lineTo' : 'moveTo'](x + (j % 2 ? L * 0.012 : -L * 0.006), y);
          }
          ctx.stroke();
        }
        break;
      case 'bands':
        ctx.lineWidth = L * 0.014;
        for (let u = 0.08; u < 0.8; u += 0.075) {
          const [x0, y0] = at(u, -1.1);
          const [x1, y1] = at(u - 0.02, 0.25);
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        break;
      case 'mottle':
        for (let i = 0; i < 22; i++) {
          const [x, y] = at(0.05 + R(i, 3) * 0.9, -0.9 + R(i, 4) * 1.3);
          ctx.fillStyle = i % 3 ? C.spot : C.belly;
          ctx.globalAlpha = i % 3 ? 0.7 : 0.35;
          circ(ctx, x, y, H * (0.05 + R(i, 5) * 0.06));
        }
        ctx.globalAlpha = 1;
        break;
      case 'bumps':
        ctx.fillStyle = C.line;
        for (const f of [-0.65, -0.15, 0.35]) {
          for (let u = 0.15; u < 0.85; u += 0.09) {
            const [x, y] = at(u, f);
            circ(ctx, x, y, H * 0.035);
          }
        }
        break;
      case 'glow':
        ctx.fillStyle = '#8ff7ff';
        for (const f of [0.45, 0.75]) {
          for (let u = 0.12; u < 0.86; u += 0.06) {
            const [x, y] = at(u, f);
            circ(ctx, x, y, H * 0.04);
          }
        }
        break;
      case 'orca': {
        ctx.fillStyle = '#f4f4f1';
        const [ex, ey] = at(0.8, -0.3);
        ctx.beginPath();
        ctx.ellipse(ex - L * 0.03, ey, L * 0.07, H * 0.09, -0.12, 0, TAU);
        ctx.fill();
        const [fx, fy] = at(0.28, 0.35);
        ctx.beginPath();
        ctx.ellipse(fx, fy, L * 0.11, H * 0.17, -0.35, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#8b929c';
        const [sx, sy] = at(0.4, -0.95);
        ctx.beginPath();
        ctx.ellipse(sx, sy, L * 0.07, H * 0.08, 0, 0, TAU);
        ctx.fill();
        break;
      }
      case 'humpback': {
        // Furer under strupen og knøler på hodet.
        ctx.strokeStyle = C.spot;
        ctx.lineWidth = H * 0.03;
        for (let i = 0; i < 6; i++) {
          const f = 0.45 + i * 0.09;
          ctx.beginPath();
          for (let u = 0.55; u <= 0.98; u += 0.03) {
            const [x, y] = at(u, f);
            if (u === 0.55) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.fillStyle = C.spot;
        for (let i = 0; i < 7; i++) {
          const [x, y] = at(0.84 + i * 0.022, -0.85 + (i % 2) * 0.12);
          circ(ctx, x, y, H * 0.035);
        }
        break;
      }
    }
  }

  /** Tegn en fisk flatt. s: artsbeskrivelse, t: tid. */
  function fish(ctx, L, s, t) {
    const g = geo(L, s, t);
    const H = g.H;
    const C = s.pal;
    const slope = (g.wave(0.04) - g.wave(0)) / (0.04 * (g.hx - g.tx));
    ctx.save();
    ctx.translate(g.tx, g.wave(0));
    ctx.rotate(Math.atan(slope) * 1.6);
    ctx.fillStyle = C.fin;
    ctx.fill(tailP(L, H, s.tail));
    ctx.restore();
    ctx.fillStyle = C.fin;
    (s.dors || []).forEach((f) => ctx.fill(finP(g, f, false)));
    (s.anal || []).forEach((f) => ctx.fill(finP(g, f, true)));
    (s.dors || []).forEach((f) => {
      if (f[4] !== 'spiny') return;
      ctx.strokeStyle = C.spot;
      ctx.lineWidth = Math.max(1, H * 0.025);
      for (let q = 0.1; q < 0.95; q += 0.12) {
        const u = f[0] + (f[1] - f[0]) * q;
        ctx.beginPath();
        ctx.moveTo(g.xAt(u), g.wave(u) - g.thick(u) * 0.8);
        ctx.lineTo(g.xAt(u) - L * 0.01, g.wave(u) - g.thick(u) * 0.85 - H * f[2] * Math.pow(Math.sin(Math.PI * q), 0.6) * 1.05);
        ctx.stroke();
      }
    });
    const bp = bodyP(g);
    ctx.fillStyle = C.side;
    ctx.fill(bp);
    ctx.save();
    ctx.clip(bp);
    ctx.fillStyle = C.back;
    ctx.fill(band(g, -1.3, s.backTo ?? -0.3));
    ctx.fillStyle = C.belly;
    ctx.fill(band(g, s.bellyFrom ?? 0.3, 1.3));
    pattern(ctx, g, s, C, L);
    if (C.line && s.lateral !== false) {
      ctx.strokeStyle = C.line;
      ctx.lineWidth = H * 0.045;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 2; i <= 22; i++) {
        const u = i / 28;
        const y = g.wave(u) - g.thick(u) * 0.15;
        if (i === 2) ctx.moveTo(g.xAt(u), y);
        else ctx.lineTo(g.xAt(u), y);
      }
      ctx.stroke();
    }
    const gu = s.gillU ?? 0.73;
    if (s.gill !== false) {
      ctx.strokeStyle = C.back;
      ctx.lineWidth = H * 0.05;
      ctx.beginPath();
      ctx.arc(g.xAt(gu), g.wave(gu), g.thick(gu) * 0.68, -1.1, 1.1);
      ctx.stroke();
    }
    if (s.slits) {
      ctx.strokeStyle = C.spot;
      ctx.lineWidth = H * 0.03;
      for (let i = 0; i < 5; i++) {
        const u = 0.74 + i * 0.018;
        ctx.beginPath();
        ctx.moveTo(g.xAt(u), g.wave(u) - g.thick(u) * 0.1);
        ctx.lineTo(g.xAt(u) - L * 0.006, g.wave(u) + g.thick(u) * 0.35);
        ctx.stroke();
      }
    }
    if (s.mouth) {
      const mx = g.xAt(1) + g.thick(1) * 0.9;
      const my = g.wave(1) + g.thick(1) * 0.1;
      const mw = L * (s.mouth === 'big' ? 0.14 : 0.06);
      ctx.fillStyle = '#2a1d16';
      ctx.beginPath();
      ctx.moveTo(mx + 2, my - H * 0.05);
      ctx.lineTo(mx - mw, my + H * 0.02);
      ctx.lineTo(mx + 2, my + H * 0.08);
      ctx.fill();
      if (s.teeth) {
        ctx.fillStyle = '#f6f1e4';
        for (let i = 0; i < 4; i++) {
          const x = mx - (i * mw) / 4;
          ctx.beginPath();
          ctx.moveTo(x, my - H * 0.03);
          ctx.lineTo(x - mw * 0.08, my - H * 0.03);
          ctx.lineTo(x - mw * 0.04, my + H * 0.03);
          ctx.fill();
        }
      }
    }
    ctx.restore();
    if (s.barbel) {
      ctx.strokeStyle = C.fin;
      ctx.lineWidth = Math.max(1, H * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(L * 0.44, g.wave(0.98) + H * 0.16);
      ctx.quadraticCurveTo(L * 0.45, H * 0.34, L * 0.41, g.wave(0.98) + H * 0.42);
      ctx.stroke();
    }
    if (s.whiskers) {
      ctx.strokeStyle = C.spot;
      ctx.lineWidth = Math.max(1, H * 0.022);
      const wx = g.xAt(0.99) + g.thick(1) * 0.8;
      const wy = g.wave(1) + g.thick(1) * 0.2;
      for (const a of [-0.25, 0, 0.25]) {
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * L * 0.07, wy + Math.sin(a) * L * 0.07);
        ctx.stroke();
      }
    }
    if (s.lure) {
      const bx = g.xAt(0.9);
      const by = g.wave(0.9) - g.thick(0.9);
      const ex = bx + L * 0.1 + Math.sin(t * 2) * L * 0.015;
      const ey = by - H * 0.55 + Math.cos(t * 2) * H * 0.05;
      ctx.strokeStyle = C.fin;
      ctx.lineWidth = Math.max(1, H * 0.035);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx, ey, ex, ey);
      ctx.stroke();
      ctx.fillStyle = s.lureCol || '#f2e27a';
      circ(ctx, ex, ey + H * 0.03, H * 0.07);
    }
    const pu = 0.76;
    const pf = s.pec ?? 1;
    const ph = Math.sin(t * (s.sp ?? 5));
    ctx.fillStyle = s.pecCol || C.fin;
    ctx.beginPath();
    const px = g.xAt(pu);
    const py = g.wave(pu) + H * 0.12;
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(px - L * 0.12 * pf, py + H * (0.22 + ph * 0.07) * pf, px - L * 0.16 * pf, py + H * (0.28 + ph * 0.06) * pf);
    ctx.quadraticCurveTo(px - L * 0.07 * pf, py + H * (pf > 1.2 ? 0.34 : 0.08) * pf, px, py);
    ctx.fill();
    const eu = s.eyeU ?? 0.86;
    const ex = g.xAt(eu);
    const ey = g.wave(eu) - g.thick(eu) * (s.eyeF ?? 0.3);
    const er = H * (s.eye ?? 0.12);
    const eyeAt = (x, y) => {
      if (s.eyeDark) {
        ctx.fillStyle = '#101114';
        circ(ctx, x, y, er);
        ctx.fillStyle = '#ffffff';
        circ(ctx, x + er * 0.35, y - er * 0.35, er * 0.3);
        return;
      }
      ctx.fillStyle = s.eyeCol || '#ffffff';
      circ(ctx, x, y, er);
      ctx.fillStyle = '#1d1b14';
      circ(ctx, x + er * 0.15, y, er * 0.58);
      ctx.fillStyle = '#ffffff';
      circ(ctx, x + er * 0.35, y - er * 0.3, er * 0.2);
    };
    eyeAt(ex, ey);
    if (s.eyes2) eyeAt(ex - er * 1.3, ey - er * 1.4);
  }

  const P = (back, side, belly, fin, spot, line) => ({ back, side, belly, fin, spot, line });
  // Artene fra designet …
  const SPECIES = {
    torsk: { h: 0.27, pal: P('#6f7a3c', '#b5a865', '#f3ecd2', '#8a7f45', '#4e5627', '#f6f0da'), pattern: 'spots', barbel: true, dors: [[0.78, 0.6, 0.34], [0.56, 0.38, 0.34], [0.33, 0.16, 0.34]], anal: [[0.56, 0.4, 0.24], [0.33, 0.16, 0.24]] },
    sild: { h: 0.21, peak: 0.6, stalk: 0.05, sp: 7, eye: 0.15, pal: P('#2e5f80', '#9fbdcc', '#eef3f4', '#8aa3b0', '#264c66'), dors: [[0.58, 0.44, 0.32]], anal: [[0.22, 0.12, 0.16]] },
    makrell: { h: 0.2, peak: 0.58, stalk: 0.035, sp: 7, backTo: -0.2, tail: 'lunate', pattern: 'bars', pal: P('#1d6b6e', '#7fb8b0', '#f1f4f0', '#5d8e8a', '#123c42'), dors: [[0.7, 0.56, 0.3], [0.36, 0.27, 0.18]], anal: [[0.34, 0.25, 0.16]] },
    steinbit: { h: 0.19, peak: 0.78, stalk: 0.04, blunt: 0.18, amp: 0.26, k: 6, pw: 1, sp: 4, tail: 'round', pattern: 'bands', mouth: 'small', teeth: true, pal: P('#4b5560', '#7c8790', '#cfd3d2', '#5b6670', '#2c333b'), dors: [[0.82, 0.06, 0.14]], anal: [[0.5, 0.06, 0.12]] },
    hakjerring: { h: 0.2, peak: 0.62, stalk: 0.07, blunt: 0.14, sp: 2.2, amp: 0.12, tail: 'shark', gill: false, slits: true, eye: 0.06, eyeDark: true, pal: P('#4a4640', '#6b665d', '#8c877c', '#4a4640', '#3a3631'), dors: [[0.52, 0.44, 0.18, 'tri'], [0.3, 0.24, 0.14, 'tri']] },
    lysprikk: { h: 0.26, peak: 0.65, sp: 8, eye: 0.2, pattern: 'glow', pal: P('#3a4a5e', '#b9c6d3', '#e9eef3', '#8ea0b2', '#2a3646'), dors: [[0.5, 0.4, 0.24]], anal: [[0.3, 0.18, 0.16]] },
    spekkhogger: { h: 0.26, peak: 0.6, stalk: 0.06, blunt: 0.3, sp: 2.5, amp: 0.14, tail: 'fluke', pattern: 'orca', gill: false, lateral: false, eye: 0.05, eyeDark: true, eyeF: 0.1, pec: 1.6, bellyFrom: 0.35, pal: P('#17191e', '#17191e', '#f4f4f1', '#17191e', '#17191e'), dors: [[0.56, 0.42, 1.0, 'tri']] },
    // … og artene appen trenger i tillegg, i samme rigg.
    berggylt: { h: 0.34, peak: 0.55, sp: 4.5, tail: 'round', pattern: 'spots', mouth: 'small', eye: 0.11, pal: P('#8a4a1e', '#c8762e', '#ecc27a', '#a4572a', '#f3d9a0', '#e9b06a'), dors: [[0.8, 0.28, 0.3, '', 'spiny']], anal: [[0.32, 0.16, 0.22]] },
    marulk: { h: 0.42, peak: 0.8, stalk: 0.07, blunt: 0.22, sp: 3, amp: 0.1, tail: 'round', pattern: 'mottle', mouth: 'big', teeth: true, lure: true, lureCol: '#bff7ff', gill: false, eyeU: 0.82, eyeF: 0.55, eye: 0.07, pec: 1.1, pal: P('#24222b', '#36333f', '#4a4655', '#2d2a35', '#17161c'), dors: [[0.42, 0.3, 0.2]], anal: [[0.3, 0.18, 0.14]] },
    knolhval: { h: 0.2, peak: 0.5, stalk: 0.05, blunt: 0.26, sp: 1.6, amp: 0.12, tail: 'fluke', pattern: 'humpback', gill: false, lateral: false, eye: 0.05, eyeDark: true, eyeF: 0.05, eyeU: 0.84, pec: 2.6, pecCol: '#dfe2e2', bellyFrom: 0.38, pal: P('#2f3640', '#3a424d', '#dfe2e2', '#2f3640', '#5d6670'), dors: [[0.36, 0.31, 0.28, 'tri']] },
    nise: { h: 0.24, peak: 0.55, stalk: 0.06, blunt: 0.32, sp: 3, amp: 0.14, tail: 'fluke', gill: false, lateral: false, eye: 0.06, eyeDark: true, eyeF: 0.15, pec: 1.2, bellyFrom: 0.25, pal: P('#3d4652', '#77828e', '#e8ecee', '#3d4652', '#3d4652'), dors: [[0.54, 0.44, 0.5, 'tri']] },
    steinkobbe: { h: 0.28, peak: 0.62, stalk: 0.08, blunt: 0.4, sp: 2.4, amp: 0.14, tail: 'flipper', pattern: 'spots', whiskers: true, gill: false, lateral: false, eye: 0.1, eyeDark: true, eyeF: 0.25, pec: 1.3, bellyFrom: 0.4, pal: P('#5e5c55', '#8d897c', '#c9c2b0', '#55534c', '#3f3d38') },
    havmus: { h: 0.24, peak: 0.78, stalk: 0.02, blunt: 0.22, pw: 1.3, k: 4, sp: 3.5, tail: 'whip', pattern: 'mottle', eye: 0.2, eyeCol: '#bfe6b8', eyeU: 0.84, pec: 1.6, lateral: true, pal: P('#7f746c', '#b2a69b', '#e3dcd2', '#958a80', '#6d635c', '#e9e2d8'), dors: [[0.8, 0.7, 0.65, 'tri'], [0.62, 0.1, 0.14]], anal: [[0.4, 0.06, 0.08]] },
    havaal: { h: 0.12, peak: 0.85, stalk: 0.02, blunt: 0.16, amp: 0.32, k: 7, pw: 1, sp: 3.5, tail: 'round', mouth: 'small', eye: 0.13, pal: P('#3f4a50', '#6d777b', '#bdc1ba', '#4b555a', '#2c333b', '#9aa3a3'), dors: [[0.84, 0.02, 0.12]], anal: [[0.52, 0.02, 0.1]] },
  };

  const BOX = [-0.72, -0.72, 0.72, 0.72];
  // Lengden på én svømmesyklus (sekunder): 2π / sp. Utklippene lages for 24 bilder per syklus.
  for (const [key, s] of Object.entries(SPECIES)) {
    s.key = key;
    K.define(`fisk-${key}`, {
      box: BOX,
      period: (Math.PI * 2) / (s.sp ?? 5),
      frames: 24,
      draw: (ctx, L, t) => fish(ctx, L, s, t),
    });
  }

  /** Lysende prikker (tegnes over mørket), plassert med samme geometri som fisken. */
  function glow(key) {
    const s = SPECIES[key];
    return (ctx, L, t) => {
      const g = geo(L, s, t);
      ctx.save();
      if (s.pattern === 'glow') {
        for (const f of [0.45, 0.75]) {
          for (let u = 0.12; u < 0.86; u += 0.06) {
            const x = g.xAt(u);
            const y = g.wave(u) + g.thick(u) * f;
            const r = g.H * 0.18;
            const a = 0.5 + 0.4 * Math.sin(t * 3 + u * 9);
            const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
            gr.addColorStop(0, `rgba(140,240,255,${a})`);
            gr.addColorStop(1, 'rgba(140,240,255,0)');
            ctx.fillStyle = gr;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
          }
        }
      }
      if (s.lure) {
        const bx = g.xAt(0.9);
        const by = g.wave(0.9) - g.thick(0.9);
        const ex = bx + L * 0.1 + Math.sin(t * 2) * L * 0.015;
        const ey = by - g.H * 0.55 + Math.cos(t * 2) * g.H * 0.05 + g.H * 0.03;
        const r = g.H * 0.7;
        const a = 0.6 + 0.3 * Math.sin(t * 2.5);
        const gr = ctx.createRadialGradient(ex, ey, 0, ex, ey, r);
        gr.addColorStop(0, `rgba(190,250,255,${a})`);
        gr.addColorStop(1, 'rgba(190,250,255,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(ex - r, ey - r, r * 2, r * 2);
      }
      ctx.restore();
    };
  }

  window.PaizonPapirFish = { fish, geo, SPECIES, glow };
})();
