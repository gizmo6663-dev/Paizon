/*
 * Papirdyr – dyr uten fast rigg: maneter, sjøstjerner, krepsdyr, blekksprut og småkryp, sopp og
 * bær. Brennmanet, korstroll, taskekrabbe, dypvannsreke og stortare er portert fra designet
 * (sea-life.js, tegnet som «blend»: tykke streker, full oppløsning). Resten er laget i samme stil.
 * Bevegelsene bruker frekvenser som går opp i én syklus, så utklippene kan gjenbrukes i løkke.
 */
(function () {
  'use strict';

  const K = window.PaizonPapir;
  const { TAU, circ, line, tube, blob, poly, piece } = K;
  const lw = (ctx, w) => { ctx.lineWidth = Math.max(1, w); };

  // ---------- Maneter ----------
  /** Brennmanet (designet). pal: [tråder, armer, klokke, lys midt, striper]. */
  function jelly(ctx, L, t, o) {
    const C = o.pal;
    const pl = Math.sin(t * 2.4);
    const w = L * 0.3 * (1 + pl * 0.08);
    const h = L * 0.19 * (1 - pl * 0.1);
    const y0 = -L * 0.16 + Math.sin(t * 2.4 - 0.8) * L * 0.02;
    ctx.strokeStyle = C[0];
    lw(ctx, L * 0.012);
    const n = o.threads ?? 10;
    for (let i = 0; i <= n; i++) {
      const pts = [];
      const x = -w * 0.85 + (i * w * 1.7) / n;
      for (let j = 0; j <= 8; j++) pts.push([x + Math.sin(t * 1.6 + i + j * 0.6) * L * 0.025 * j / 8, y0 + h * 0.2 + j * L * 0.06 * (o.len ?? 1)]);
      line(ctx, pts);
    }
    ctx.fillStyle = C[1];
    for (let a = -1; a <= 1; a++) {
      ctx.beginPath();
      const x0 = a * w * 0.3;
      const al = o.arms ?? 1;
      for (let j = 0; j <= 8; j++) {
        const y = y0 + h * 0.2 + j * L * 0.038 * al;
        const x = x0 + Math.sin(t * 2.4 + a + j * 0.8) * L * 0.02 + L * 0.03 * (1 - j / 10);
        if (j) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      for (let j = 8; j >= 0; j--) {
        const y = y0 + h * 0.2 + j * L * 0.038 * al;
        const x = x0 + Math.sin(t * 2.4 + a + j * 0.8) * L * 0.02 - L * 0.03 * (1 - j / 10) + (j % 2 ? -L * 0.012 : 0);
        ctx.lineTo(x, y);
      }
      ctx.fill();
    }
    const bell = new Path2D();
    bell.moveTo(-w, y0 + h * 0.25);
    bell.bezierCurveTo(-w * 1.05, y0 - h * 1.1, w * 1.05, y0 - h * 1.1, w, y0 + h * 0.25);
    for (let i = 7; i >= 0; i--) {
      const x = -w + (i * w * 2) / 8;
      bell.quadraticCurveTo(x + w / 8, y0 + h * 0.5, x, y0 + h * 0.25);
    }
    ctx.fillStyle = C[2];
    ctx.fill(bell);
    ctx.save();
    ctx.clip(bell);
    ctx.fillStyle = C[3];
    ctx.beginPath();
    ctx.ellipse(0, y0 + h * 0.1, w * 0.55, h * 0.45, 0, 0, TAU);
    ctx.fill();
    if (o.rings) {
      // Glassmaneten: fire lilla ringer (kjønnskjertlene) i klokka.
      ctx.strokeStyle = C[4];
      lw(ctx, L * 0.018);
      for (const dx of [-0.36, -0.12, 0.12, 0.36]) {
        ctx.beginPath();
        ctx.ellipse(dx * w, y0 + h * 0.05, w * 0.1, h * 0.22, 0, 0, TAU);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = C[4];
      lw(ctx, L * 0.008);
      for (let i = -3; i <= 3; i++) line(ctx, [[i * w * 0.08, y0 - h * 0.3], [i * w * 0.28, y0 + h * 0.4]]);
    }
    ctx.restore();
  }

  /** Kammanet: en gjennomsiktig «pære» med åtte rader av små, skimrende kammer. */
  function combjelly(ctx, L, t) {
    const pl = Math.sin(t * 1.6) * 0.04;
    const body = blob(0, 0, L * 0.2 * (1 + pl), L * 0.3 * (1 - pl), [[-1.57, 0.6, 0.12]]);
    piece(ctx, body, '#dfeaee');
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = '#c7dbe2';
    ctx.beginPath();
    ctx.ellipse(0, L * 0.05, L * 0.1, L * 0.18, 0, 0, TAU);
    ctx.fill();
    const cols = ['#f2738a', '#f6c24a', '#6fd38a', '#5ab4f0', '#a57ce8'];
    for (let r = 0; r < 4; r++) {
      const x = (-0.14 + r * 0.093) * L;
      for (let j = 0; j < 9; j++) {
        const y = (-0.24 + j * 0.055) * L;
        ctx.fillStyle = cols[(j + r + Math.floor(t * 4.8)) % cols.length];
        circ(ctx, x * Math.cos((y / L) * 1.8), y, L * 0.016);
      }
    }
    ctx.restore();
    ctx.strokeStyle = '#b7cbd2';
    lw(ctx, L * 0.01);
    line(ctx, [[0, L * 0.3], [Math.sin(t * 1.6) * L * 0.05, L * 0.42], [Math.sin(t * 1.6 + 1) * L * 0.08, L * 0.5]]);
  }

  // ---------- Sjøstjerner ----------
  function star(ctx, L, t, o) {
    const rot = Math.sin(t * 0.4) * 0.15 - 0.3;
    const p = new Path2D();
    const M = 160;
    for (let i = 0; i <= M; i++) {
      const th = (i / M) * TAU;
      const arm = Math.round(((th - rot) / TAU) * 5 + 5) % 5;
      const k = Math.pow((Math.cos(5 * (th - rot)) + 1) / 2, o.thin ? 6 : 2.2);
      const r = L * ((o.thin ? 0.07 : 0.1) + (o.thin ? 0.36 : 0.24) * k * (1 + 0.07 * Math.sin(t * 1.2 + arm * 1.7)));
      const x = Math.cos(th) * r;
      const y = Math.sin(th) * r * 0.9;
      if (i) p.lineTo(x, y);
      else p.moveTo(x, y);
    }
    ctx.fillStyle = o.col;
    ctx.fill(p);
    ctx.fillStyle = o.dot;
    for (let a = 0; a < 5; a++) {
      for (let j = 1; j <= (o.thin ? 6 : 4); j++) {
        const th = rot + (a * TAU) / 5;
        const r = L * j * (o.thin ? 0.05 : 0.065);
        circ(ctx, Math.cos(th) * r, Math.sin(th) * r * 0.9, L * (o.thin ? 0.008 : 0.014));
      }
    }
    circ(ctx, 0, 0, L * 0.02);
  }
  /** Slangestjerne: liten skive og fem lange, smidige armer som kryper. */
  function brittle(ctx, L, t) {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      const pts = [];
      const rs = [];
      let x = Math.cos(a) * L * 0.06;
      let y = Math.sin(a) * L * 0.06;
      for (let k = 0; k <= 10; k++) {
        const s = k / 10;
        pts.push([x, y]);
        rs.push(L * 0.022 * (1 - s * 0.75));
        const bend = Math.sin(t * 1.2 + i * 1.3 + s * 4) * 0.55 * s;
        x += Math.cos(a + bend) * L * 0.042;
        y += Math.sin(a + bend) * L * 0.042;
      }
      piece(ctx, tube(pts, rs), '#8f5a74');
    }
    piece(ctx, blob(0, 0, L * 0.09, L * 0.08), '#b87a96');
    ctx.fillStyle = '#e2b8cb';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      circ(ctx, Math.cos(a) * L * 0.045, Math.sin(a) * L * 0.04, L * 0.014);
    }
  }

  // ---------- Krepsdyr ----------
  function crab(ctx, L, t) {
    const bob = Math.abs(Math.sin(t * 3)) * L * 0.01;
    const cy = -bob;
    ctx.strokeStyle = '#9c4a26';
    lw(ctx, L * 0.03);
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const ph = Math.sin(t * 6 + i * 1.6 + (s > 0 ? Math.PI : 0)) * 0.18;
        const x0 = s * L * 0.15;
        const y0 = cy + L * (0.0 + i * 0.03);
        const ang = s > 0 ? -0.2 + i * 0.25 + ph : Math.PI + 0.2 - i * 0.25 - ph;
        const kx = x0 + Math.cos(ang) * L * 0.14;
        const ky = y0 + Math.sin(ang) * L * 0.08 - L * 0.04;
        line(ctx, [[x0, y0], [kx, ky], [kx + s * L * 0.05, ky + L * 0.12 + bob]]);
      }
    }
    for (const s of [-1, 1]) {
      const op = (Math.sin(t * 3 + (s > 0 ? 1 : 0)) + 1) * 0.15;
      const bx = s * L * 0.25;
      const by = cy - L * 0.11;
      line(ctx, [[s * L * 0.12, cy - L * 0.04], [bx, by]]);
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(s * -0.5);
      ctx.scale(s, 1);
      ctx.fillStyle = '#1d1712';
      for (const d of [-1, 1]) {
        ctx.save();
        ctx.translate(L * 0.07, d * L * 0.012);
        ctx.rotate(d * op);
        ctx.beginPath();
        ctx.moveTo(-L * 0.012, -L * 0.018);
        ctx.lineTo(L * 0.075, d * L * 0.004);
        ctx.lineTo(-L * 0.012, L * 0.018);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#c46a3c';
      ctx.beginPath();
      ctx.ellipse(L * 0.03, 0, L * 0.075, L * 0.048, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    const cp = new Path2D();
    const M = 40;
    for (let i = 0; i <= M; i++) {
      const a = Math.PI + (i / M) * Math.PI;
      const r = 1 + (i % 4 === 2 ? 0.04 : 0);
      const x = Math.cos(a) * L * 0.21 * r;
      const y = cy + Math.sin(a) * L * 0.13 * r;
      if (i) cp.lineTo(x, y);
      else cp.moveTo(x, y);
    }
    cp.quadraticCurveTo(L * 0.18, cy + L * 0.08, 0, cy + L * 0.08);
    cp.quadraticCurveTo(-L * 0.18, cy + L * 0.08, -L * 0.21, cy);
    cp.closePath();
    ctx.fillStyle = '#c46a3c';
    ctx.fill(cp);
    ctx.fillStyle = '#e09a62';
    ctx.beginPath();
    ctx.ellipse(0, cy - L * 0.03, L * 0.12, L * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#1d1712';
    circ(ctx, -L * 0.035, cy - L * 0.13, L * 0.016);
    circ(ctx, L * 0.035, cy - L * 0.13, L * 0.016);
  }

  function prawn(ctx, L, t) {
    const fl = Math.sin(t * 1.5) * 0.04;
    const D = '#c94f45';
    const C = '#ec8573';
    const M = '#e4705f';
    ctx.strokeStyle = D;
    lw(ctx, L * 0.008);
    for (const k of [0, 1]) line(ctx, [[L * 0.25, -L * 0.04], [L * 0.04, -L * (0.17 + k * 0.05) + Math.sin(t * 3 + k) * L * 0.02], [-L * 0.32, -L * (0.08 + k * 0.08) + Math.sin(t * 3 + k) * L * 0.03]]);
    const seg = [];
    let x = 0;
    let y = 0;
    let ang = Math.PI + 0.06;
    for (let i = 0; i < 6; i++) {
      const r = L * 0.072 * (1 - i * 0.09);
      seg.push([x, y, r, ang]);
      ang -= 0.24 + fl;
      x += Math.cos(ang) * r * 1.15;
      y += Math.sin(ang) * r * 1.15;
    }
    lw(ctx, L * 0.013);
    seg.forEach(([sx, sy, r, a], i) => {
      const px = Math.sin(a);
      const py = -Math.cos(a);
      const ph = Math.sin(t * 7.5 - i * 0.9) * r * 0.35;
      line(ctx, [[sx + px * r * 0.5, sy + py * r * 0.5], [sx + px * r * 1.35 + Math.cos(a) * ph, sy + py * r * 1.35 + Math.sin(a) * ph]]);
    });
    for (let k = 0; k < 3; k++) line(ctx, [[L * (0.08 + k * 0.05), L * 0.04], [L * (0.07 + k * 0.05) + Math.sin(t * 4.5 + k) * L * 0.01, L * 0.13]]);
    const [lx, ly, lr, la] = seg[5];
    ctx.save();
    ctx.translate(lx + Math.cos(la) * lr * 0.6, ly + Math.sin(la) * lr * 0.6);
    ctx.rotate(la);
    ctx.fillStyle = D;
    ctx.beginPath();
    ctx.moveTo(-L * 0.01, 0);
    ctx.lineTo(L * 0.11, -L * 0.055);
    ctx.quadraticCurveTo(L * 0.09, 0, L * 0.11, L * 0.055);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (let i = 5; i >= 0; i--) {
      const [sx, sy, r, a] = seg[i];
      ctx.fillStyle = i % 2 ? C : M;
      ctx.beginPath();
      ctx.ellipse(sx, sy, r * 1.05, r * 0.85, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = C;
    ctx.beginPath();
    ctx.ellipse(L * 0.12, -L * 0.01, L * 0.145, L * 0.075, -0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = D;
    ctx.beginPath();
    ctx.moveTo(L * 0.2, -L * 0.06);
    ctx.lineTo(L * 0.37, -L * 0.1);
    ctx.lineTo(L * 0.24, -L * 0.03);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#1d1712';
    circ(ctx, L * 0.22, -L * 0.03, L * 0.022);
  }

  /** Hummer sett fra siden: blå, med store klør, haleledd og lange antenner. Origo ved føttene. */
  function lobster(ctx, L, t) {
    const B = '#2f4470';
    const B2 = '#23345a';
    const Lt = '#4c6596';
    const wave = Math.sin(t * 2) * 0.06;
    ctx.strokeStyle = '#8a3a2a';
    lw(ctx, L * 0.008);
    for (const k of [0, 1]) line(ctx, [[L * 0.3, -L * 0.1], [L * 0.55, -L * (0.3 + k * 0.08) + wave * L], [L * 0.75, -L * (0.2 + k * 0.12) + wave * L * 1.5]]);
    // Bein.
    ctx.strokeStyle = B2;
    lw(ctx, L * 0.016);
    for (let i = 0; i < 4; i++) {
      const x = L * (0.18 - i * 0.07);
      const k = Math.sin(t * 6 + i * 1.5) * L * 0.012;
      line(ctx, [[x, -L * 0.06], [x - L * 0.02 + k, -L * 0.02], [x - L * 0.03 + k, 0]]);
    }
    // Klo (to ledd og en stor saks).
    const clawUp = Math.sin(t * 1.5) * 0.08;
    piece(ctx, tube([[L * 0.22, -L * 0.07], [L * 0.33, -L * 0.04], [L * 0.42, -L * 0.1 + clawUp * L]], [L * 0.022, L * 0.025, L * 0.03]), B);
    ctx.save();
    ctx.translate(L * 0.42, -L * 0.1 + clawUp * L);
    ctx.rotate(-0.15);
    piece(ctx, blob(L * 0.08, 0, L * 0.1, L * 0.045), B);
    piece(ctx, poly([[L * 0.15, -L * 0.03], [L * 0.27, -L * 0.035], [L * 0.17, -L * 0.005]]), B);
    piece(ctx, poly([[L * 0.15, L * 0.02], [L * 0.25, L * 0.03 + Math.abs(clawUp) * L * 0.2], [L * 0.16, L * 0.035]]), B2);
    ctx.restore();
    // Hale av ledd som bøyer seg litt.
    const segs = 6;
    let x = -L * 0.02;
    for (let i = 0; i < segs; i++) {
      const r = L * (0.06 - i * 0.005);
      const y = -L * 0.08 + Math.sin(t * 2 + i * 0.5) * L * 0.004 * i;
      piece(ctx, blob(x, y, r * 0.9, r * 0.75), i % 2 ? B : Lt);
      x -= r * 1.3;
    }
    piece(ctx, poly([[x + L * 0.02, -L * 0.08], [x - L * 0.08, -L * 0.13], [x - L * 0.08, -L * 0.03]]), B2);
    // Ryggskjold og hode.
    const cara = blob(L * 0.14, -L * 0.09, L * 0.15, L * 0.065, [[0, 0.5, 0.15]]);
    piece(ctx, cara, B);
    ctx.save();
    ctx.clip(cara);
    ctx.fillStyle = Lt;
    ctx.fillRect(0, -L * 0.2, L * 0.4, L * 0.07);
    ctx.restore();
    piece(ctx, poly([[L * 0.27, -L * 0.11], [L * 0.36, -L * 0.13], [L * 0.28, -L * 0.08]]), B2);
    ctx.fillStyle = '#1d1712';
    circ(ctx, L * 0.26, -L * 0.12, L * 0.012);
  }

  // ---------- Bunnen ----------
  /** Kråkebolle: lilla kuppel med tette pigger. Origo midt på bunnen. */
  function urchin(ctx, L, t) {
    ctx.strokeStyle = '#5a2e5e';
    lw(ctx, L * 0.025);
    for (let i = 0; i <= 26; i++) {
      const a = Math.PI + (i / 26) * Math.PI;
      const sway = Math.sin(t * 1.2 + i) * 0.04;
      const r0 = L * 0.28;
      const r1 = L * (0.46 + (i % 3) * 0.04);
      line(ctx, [[Math.cos(a) * r0, Math.sin(a) * r0 * 0.8], [Math.cos(a + sway) * r1, Math.sin(a + sway) * r1 * 0.85]]);
    }
    const dome = new Path2D();
    dome.ellipse(0, 0, L * 0.32, L * 0.26, 0, Math.PI, TAU);
    dome.closePath();
    piece(ctx, dome, '#7a4280');
    ctx.save();
    ctx.clip(dome);
    ctx.fillStyle = '#93589a';
    ctx.beginPath();
    ctx.ellipse(-L * 0.06, -L * 0.14, L * 0.16, L * 0.08, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /** Sjønellik: hvit søyle med fjærlett krone. Origo ved foten. */
  function anemone(ctx, L, t) {
    const col = tube([[0, 0], [0, -L * 0.25], [0, -L * 0.45]], [L * 0.14, L * 0.11, L * 0.12]);
    piece(ctx, col, '#efe5d4');
    ctx.save();
    ctx.clip(col);
    ctx.fillStyle = '#e0d2bc';
    ctx.fillRect(L * 0.03, -L * 0.6, L * 0.2, L * 0.7);
    ctx.restore();
    ctx.strokeStyle = '#f8f2e6';
    lw(ctx, L * 0.018);
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + 0.15 + (i / 25) * (Math.PI - 0.3);
      const sway = Math.sin(t * 1.4 + i * 0.7) * 0.1;
      const r = L * (0.3 + (i % 3) * 0.05);
      const x1 = Math.cos(a + sway) * r;
      const y1 = -L * 0.48 + Math.sin(a + sway) * r * 0.8;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * L * 0.08, -L * 0.48);
      ctx.quadraticCurveTo((x1 + Math.cos(a) * L * 0.08) / 2 + sway * L * 0.2, (y1 - L * 0.48) / 2 - L * 0.06, x1, y1);
      ctx.stroke();
    }
    ctx.fillStyle = '#f3c9a4';
    circ(ctx, 0, -L * 0.5, L * 0.07);
  }

  /** Glassvamp: blek vase med gittermønster av glassnåler. Origo ved foten. */
  function sponge(ctx, L, t) {
    const p = new Path2D();
    p.moveTo(-L * 0.08, 0);
    p.bezierCurveTo(-L * 0.3, -L * 0.3, -L * 0.18, -L * 0.75, -L * 0.24, -L * 0.98);
    p.lineTo(L * 0.24, -L * 0.98);
    p.bezierCurveTo(L * 0.18, -L * 0.75, L * 0.3, -L * 0.3, L * 0.08, 0);
    p.closePath();
    piece(ctx, p, '#e6eceb');
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = '#d3dddc';
    ctx.fillRect(L * 0.04, -L, L * 0.3, L);
    ctx.strokeStyle = '#b9c6c4';
    lw(ctx, L * 0.008);
    for (let i = -8; i <= 8; i++) {
      line(ctx, [[i * L * 0.05 - L * 0.3, 0], [i * L * 0.05 + L * 0.3, -L]]);
      line(ctx, [[i * L * 0.05 + L * 0.3, 0], [i * L * 0.05 - L * 0.3, -L]]);
    }
    ctx.restore();
    piece(ctx, blob(0, -L * 0.98, L * 0.24, L * 0.045), '#5c6e72');
    ctx.strokeStyle = '#f4f8f8';
    lw(ctx, L * 0.01);
    for (let i = 0; i < 10; i++) {
      const y = -L * 0.85 + i * L * 0.08;
      const s = i % 2 ? 1 : -1;
      line(ctx, [[s * L * 0.2, y], [s * L * (0.28 + 0.02 * Math.sin(t * 2 + i)), y - L * 0.03]]);
    }
  }

  /** Kjempeblekksprut: kappe med finner bakover, store øyne, åtte armer og to lange fangarmer. */
  function squid(ctx, L, t) {
    const R = '#b8452f';
    const R2 = '#8e2f20';
    const Lt = '#d9745a';
    // Fangarmene først (bakerst).
    for (const k of [0, 1]) {
      const pts = [];
      const rs = [];
      for (let i = 0; i <= 12; i++) {
        const s = i / 12;
        pts.push([L * (0.08 + s * 0.42), L * ((k ? 0.04 : -0.02) + Math.sin(t * 1.5 + s * 4 + k) * 0.05 * s)]);
        rs.push(L * (0.012 + (s > 0.85 ? 0.012 : 0)));
      }
      piece(ctx, tube(pts, rs), R2);
    }
    // Åtte armer.
    for (let i = 0; i < 6; i++) {
      const pts = [];
      const rs = [];
      for (let j = 0; j <= 8; j++) {
        const s = j / 8;
        pts.push([L * (0.08 + s * 0.24), L * ((i - 2.5) * 0.012 * (1 + s * 1.5) + Math.sin(t * 2 + i + s * 3) * 0.025 * s)]);
        rs.push(L * 0.022 * (1 - s * 0.8));
      }
      piece(ctx, tube(pts, rs), i % 2 ? R : R2);
    }
    // Kappe (peker bakover) med finner.
    piece(ctx, poly([[-L * 0.42, 0], [-L * 0.5, -L * 0.1], [-L * 0.3, -L * 0.02], [-L * 0.5, L * 0.1]]), R2);
    const mantle = blob(-L * 0.14, 0, L * 0.3, L * 0.075, [[Math.PI, 0.5, -0.45]]);
    piece(ctx, mantle, R);
    ctx.save();
    ctx.clip(mantle);
    ctx.fillStyle = Lt;
    for (let i = 0; i < 18; i++) circ(ctx, -L * 0.4 + ((i * 37) % 30) / 30 * L * 0.5, -L * 0.04 + ((i * 53) % 10) / 10 * L * 0.08, L * 0.008);
    ctx.restore();
    piece(ctx, blob(L * 0.1, 0, L * 0.07, L * 0.06), R);
    ctx.fillStyle = '#f4ecd8';
    circ(ctx, L * 0.11, -L * 0.01, L * 0.032);
    ctx.fillStyle = '#1d1712';
    circ(ctx, L * 0.115, -L * 0.01, L * 0.02);
    ctx.fillStyle = '#ffffff';
    circ(ctx, L * 0.122, -L * 0.018, L * 0.007);
  }

  /** Stortare (designet): stilk i ledd og fem blad som svaier. Origo ved festet i bunnen. */
  function kelp(ctx, L, t, o) {
    ctx.strokeStyle = o && o.stem ? o.stem : '#5a6a28';
    lw(ctx, L * 0.03);
    const pts = [];
    for (let j = 0; j <= 10; j++) {
      const q = j / 10;
      pts.push([Math.sin(t * 0.8 + q * 2.5) * L * 0.08 * q, -q * L * 0.75]);
    }
    line(ctx, pts);
    const [x, y] = pts[10];
    ctx.fillStyle = o && o.leaf ? o.leaf : '#7d8a34';
    for (let k = -2; k <= 2; k++) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * 0.25 + Math.sin(t * 1.2 + k) * 0.1);
      ctx.beginPath();
      ctx.ellipse(0, -L * 0.15, L * 0.03, L * 0.17, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- Skogbunnen ----------
  function frog(ctx, L, t) {
    const th = 0.5 + 0.5 * Math.sin(t * 4);
    piece(ctx, tube([[-L * 0.12, -L * 0.08], [-L * 0.3, -L * 0.02], [-L * 0.12, 0]], [L * 0.07, L * 0.05, L * 0.035]), '#56702c');
    const body = blob(0, -L * 0.17, L * 0.3, L * 0.16, [[-2.4, 0.5, 0.15], [-0.6, 0.4, 0.1]]);
    piece(ctx, body, '#7a9238');
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = '#e6dca4';
    ctx.beginPath();
    ctx.ellipse(L * 0.05, -L * 0.04, L * 0.25, L * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#4e6424';
    for (const [x, y] of [[-0.12, -0.24], [0.02, -0.27], [-0.18, -0.15], [0.1, -0.2]]) circ(ctx, L * x, L * y, L * 0.03);
    ctx.restore();
    ctx.fillStyle = '#efe6b8';
    ctx.beginPath();
    ctx.ellipse(L * 0.24, -L * 0.08, L * (0.06 + th * 0.03), L * (0.05 + th * 0.025), 0, 0, TAU);
    ctx.fill();
    piece(ctx, blob(L * 0.18, -L * 0.3, L * 0.07, L * 0.065), '#7a9238');
    K.eye(ctx, L * 0.2, -L * 0.31, L * 0.035);
    piece(ctx, tube([[L * 0.15, -L * 0.1], [L * 0.22, -L * 0.03], [L * 0.27, 0]], [L * 0.03, L * 0.025, L * 0.02]), '#56702c');
  }
  function ant(ctx, L, t) {
    const s = Math.sin(t * 20) * L * 0.04;
    ctx.strokeStyle = '#2a1410';
    lw(ctx, L * 0.04);
    for (let i = 0; i < 3; i++) line(ctx, [[L * (0.05 - i * 0.08), -L * 0.12], [L * (0.0 - i * 0.1) + (i % 2 ? s : -s), 0]]);
    for (const [x, r] of [[-0.3, 0.16], [0, 0.09], [0.22, 0.11]]) piece(ctx, blob(L * x, -L * 0.15, L * r, L * r * 0.8), '#5a2214');
    line(ctx, [[L * 0.28, -L * 0.22], [L * 0.4, -L * 0.36], [L * 0.48, -L * 0.3]]);
  }
  function butterfly(ctx, L, t) {
    const f = 0.25 + 0.75 * Math.abs(Math.sin(t * 9.42));
    ctx.save();
    ctx.scale(f, 1);
    ctx.fillStyle = '#f2e04a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * L * 0.22, -L * 0.15, L * 0.25, L * 0.2, s * 0.4, 0, TAU);
      ctx.ellipse(s * L * 0.16, L * 0.12, L * 0.15, L * 0.14, -s * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#e07a20';
    for (const s of [-1, 1]) circ(ctx, s * L * 0.22, -L * 0.15, L * 0.035);
    ctx.restore();
    ctx.fillStyle = '#2a2a20';
    ctx.fillRect(-L * 0.025, -L * 0.25, L * 0.05, L * 0.45);
  }
  function woodlouse(ctx, L, t) {
    const s = Math.sin(t * 15.7) * L * 0.02;
    ctx.strokeStyle = '#3a3634';
    lw(ctx, L * 0.025);
    for (let i = 0; i < 7; i++) line(ctx, [[-L * 0.3 + i * L * 0.1, -L * 0.05], [-L * 0.32 + i * L * 0.1 + (i % 2 ? s : -s), 0]]);
    const d = new Path2D();
    d.ellipse(0, -L * 0.04, L * 0.42, L * 0.2, 0, Math.PI, TAU);
    d.closePath();
    piece(ctx, d, '#7e7a76');
    ctx.save();
    ctx.clip(d);
    ctx.strokeStyle = '#5a5652';
    lw(ctx, L * 0.02);
    for (let i = 1; i < 8; i++) line(ctx, [[-L * 0.42 + i * L * 0.105, -L * 0.04], [-L * 0.42 + i * L * 0.105, -L * 0.3]]);
    ctx.restore();
  }
  function worm(ctx, L, t) {
    const pts = [];
    const rs = [];
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      pts.push([-L * 0.45 + u * L * 0.9, -L * 0.06 - Math.sin(u * 7 - t * 3.14) * L * 0.06]);
      rs.push(L * 0.04 * (u > 0.7 ? 1.15 : 1));
    }
    piece(ctx, tube(pts, rs), '#c2726a');
    ctx.strokeStyle = '#a85a54';
    lw(ctx, L * 0.012);
    for (let i = 2; i < 13; i += 2) line(ctx, [[pts[i][0], pts[i][1] - L * 0.03], [pts[i][0], pts[i][1] + L * 0.03]]);
  }
  function tadpole(ctx, L, t) {
    const pts = [];
    const rs = [];
    for (let i = 0; i <= 10; i++) {
      pts.push([L * 0.15 - i * L * 0.06, Math.sin(t * 12.57 - i * 0.8) * L * 0.06 * (i / 10)]);
      rs.push(i === 0 ? L * 0.16 : L * 0.05 * (1 - i / 12));
    }
    piece(ctx, tube(pts, rs), '#2f2f26');
    ctx.fillStyle = '#f2ecd8';
    circ(ctx, L * 0.24, -L * 0.04, L * 0.025);
  }
  function chanterelle(ctx, L) {
    const p = new Path2D();
    p.moveTo(-L * 0.08, 0);
    p.quadraticCurveTo(-L * 0.1, -L * 0.3, -L * 0.4, -L * 0.55);
    p.quadraticCurveTo(0, -L * 0.72, L * 0.4, -L * 0.55);
    p.quadraticCurveTo(L * 0.1, -L * 0.3, L * 0.08, 0);
    p.closePath();
    piece(ctx, p, '#eeb238');
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = '#c98c1c';
    lw(ctx, L * 0.012);
    for (let i = -3; i <= 3; i++) line(ctx, [[i * L * 0.02, -L * 0.15], [i * L * 0.1, -L * 0.52]]);
    ctx.restore();
  }
  function amanita(ctx, L) {
    piece(ctx, tube([[0, 0], [0, -L * 0.55]], [L * 0.08, L * 0.07]), '#f2eee2');
    piece(ctx, blob(0, -L * 0.38, L * 0.12, L * 0.035), '#e6e0d0');
    const cap = new Path2D();
    cap.ellipse(0, -L * 0.6, L * 0.45, L * 0.32, 0, Math.PI, TAU);
    cap.closePath();
    piece(ctx, cap, '#d23a26');
    ctx.fillStyle = '#fbf6ea';
    for (const [x, y, r] of [[-0.25, -0.7, 0.05], [0, -0.85, 0.06], [0.22, -0.72, 0.045], [-0.1, -0.68, 0.035], [0.32, -0.64, 0.03], [0.1, -0.7, 0.03]]) circ(ctx, L * x, L * y, L * r);
  }
  function blueberry(ctx, L, t) {
    ctx.strokeStyle = '#4a6a2a';
    lw(ctx, L * 0.03);
    for (let i = -2; i <= 2; i++) line(ctx, [[i * L * 0.05, 0], [i * L * 0.12, -L * 0.4], [i * L * 0.2, -L * 0.7]]);
    ctx.fillStyle = '#5f8e34';
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * L * 0.25, -L * 0.3 - (i % 5) * L * 0.08, L * 0.065, L * 0.032, a + Math.sin(t * 1.57 + i) * 0.1, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#32407a';
    for (const [x, y] of [[-0.12, -0.25], [0.1, -0.4], [0.2, -0.2], [-0.2, -0.45], [0.02, -0.3]]) circ(ctx, L * x, L * y, L * 0.05);
  }
  function anthill(ctx, L, t) {
    const p = new Path2D();
    p.moveTo(-L * 0.5, 0);
    p.quadraticCurveTo(-L * 0.3, -L * 0.6, 0, -L * 0.62);
    p.quadraticCurveTo(L * 0.3, -L * 0.6, L * 0.5, 0);
    p.closePath();
    piece(ctx, p, '#8a6a42');
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = '#c4a26e';
    lw(ctx, L * 0.01);
    let s = 4;
    const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 90; i++) {
      const x = (r() - 0.5) * L;
      const y = -r() * L * 0.6;
      const a = r() * TAU;
      line(ctx, [[x, y], [x + Math.cos(a) * L * 0.04, y + Math.sin(a) * L * 0.04]]);
    }
    ctx.restore();
    ctx.fillStyle = '#2a120a';
    for (let i = 0; i < 12; i++) {
      const pp = (t * 0.1 + i / 12) % 1;
      const a = Math.PI + pp * Math.PI;
      circ(ctx, Math.cos(a) * L * 0.4 * (0.5 + (i % 3) * 0.2), -Math.abs(Math.sin(a)) * L * 0.5 * (0.5 + (i % 3) * 0.2), Math.max(0.8, L * 0.012));
    }
  }

  // ---------- Registrering ----------
  const def = (key, box, period, frames, draw, extra) => K.define(key, Object.assign({ box, period, frames, draw }, extra || {}));
  const W = 2 * Math.PI / 0.8; // felles syklus for maneter (frekvenser er multipler av 0,8)
  def('brennmanet', [-0.45, -0.45, 0.45, 0.6], W, 48, (c, L, t) => jelly(c, L, t, { pal: ['#efb07a', '#c2452d', '#d9643a', '#f0a464', '#a8341f'] }));
  def('glassmanet', [-0.45, -0.45, 0.45, 0.45], W, 48, (c, L, t) => jelly(c, L, t, { pal: ['#d6e2e6', '#c9d8e4', '#e3edf0', '#f1f6f7', '#a77cc2'], rings: true, threads: 16, len: 0.35, arms: 0.8 }));
  def('kammanet', [-0.3, -0.4, 0.3, 0.55], (2 * Math.PI) / 1.6, 24, combjelly);
  def('sjostjerne', [-0.4, -0.3, 0.4, 0.05], (2 * Math.PI) / 0.4, 48, (c, L, t) => {
    c.translate(0, -L * 0.13);
    c.scale(1, 0.45);
    star(c, L, t, { col: '#d9663a', dot: '#f6c08c' });
  });
  def('slangestjerne', [-0.5, -0.25, 0.5, 0.08], (2 * Math.PI) / 1.2, 36, (c, L, t) => {
    c.translate(0, -L * 0.1);
    c.scale(1, 0.5);
    brittle(c, L, t);
  });
  def('krabbe', [-0.42, -0.3, 0.42, 0.22], (2 * Math.PI) / 3, 18, (c, L, t) => {
    c.translate(0, -L * 0.17);
    crab(c, L, t);
  });
  def('reke', [-0.45, -0.3, 0.45, 0.2], (2 * Math.PI) / 1.5, 36, prawn);
  def('hummer', [-0.5, -0.45, 0.8, 0.06], Math.PI, 24, lobster);
  def('krakebolle', [-0.55, -0.55, 0.55, 0.05], (2 * Math.PI) / 1.2, 24, urchin);
  def('sjonellik', [-0.45, -0.85, 0.45, 0.05], (2 * Math.PI) / 1.4, 30, anemone);
  def('glassvamp', [-0.35, -1.05, 0.35, 0.05], Math.PI, 16, sponge);
  def('kjempeblekksprut', [-0.55, -0.25, 0.6, 0.25], (2 * Math.PI) / 0.5, 48, squid);
  def('tare', [-0.3, -1.0, 0.3, 0.05], (2 * Math.PI) / 0.4, 48, kelp);
  def('frosk', [-0.35, -0.42, 0.35, 0.05], Math.PI / 2, 12, frog);
  def('maur', [-0.5, -0.45, 0.55, 0.05], Math.PI / 10, 6, ant);
  def('sommerfugl', [-0.5, -0.4, 0.5, 0.3], (2 * Math.PI) / 9.42, 8, butterfly);
  def('skrukketroll', [-0.45, -0.3, 0.45, 0.05], (2 * Math.PI) / 15.7, 6, woodlouse);
  def('meitemark', [-0.55, -0.2, 0.55, 0.08], 2, 16, worm);
  def('rumpetroll', [-0.5, -0.2, 0.42, 0.2], 0.5, 8, tadpole);
  def('kantarell', [-0.45, -0.7, 0.45, 0.05], null, 1, chanterelle);
  def('fluesopp', [-0.5, -0.95, 0.5, 0.05], null, 1, amanita);
  def('blabaer', [-0.5, -0.8, 0.5, 0.05], 4, 8, blueberry);
  def('maurtue', [-0.55, -0.7, 0.55, 0.05], 10, 20, anthill);

  window.PaizonPapirCritters = { jelly, star, crab, prawn, kelp };
})();
