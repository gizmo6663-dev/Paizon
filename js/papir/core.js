/*
 * Papirdyr (stil 4a) – kjernen.
 *
 * Hvert dyr tegnes først flatt (rene farger) til et eget lerret. Så får hele silhuetten én
 * sammenhengende mørk kontur, papirfiber legges oppå, og når utklippet settes inn i scenen,
 * får det én skygge (lys fra øvre høyre). Riggene i fish.js, critters.js og land.js tegner
 * bare flatt; alt papirarbeidet skjer her, ett sted.
 *
 * Ytelse: et ferdig utklipp lagres for hver art, størrelse og bilde i bevegelsessyklusen, og
 * gjenbrukes (også av alle fiskene i en stim). Lageret er begrenset og fjerner de eldste.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const INK = '#2b2219';
  const SHADOW = 'rgba(40,30,15,0.34)';

  // ---------- Former ----------
  function blob(cx, cy, rx, ry, bumps) {
    const p = new Path2D();
    const M = 48;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * TAU;
      let k = 1;
      for (const [b, w, m] of bumps || []) {
        const d = Math.atan2(Math.sin(a - b), Math.cos(a - b));
        k += m * Math.exp(-(d * d) / (w * w));
      }
      const x = cx + Math.cos(a) * rx * k;
      const y = cy + Math.sin(a) * ry * k;
      if (i) p.lineTo(x, y);
      else p.moveTo(x, y);
    }
    p.closePath();
    return p;
  }

  /** Rør med runde ender langs en senterlinje (bein, hals, hale) – ledd viser aldri skjøt. */
  function tube(pts, rs) {
    const p = new Path2D();
    const n = pts.length;
    const A = [];
    const B = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const d = Math.hypot(dx, dy) || 1;
      A.push([pts[i][0] - (dy / d) * rs[i], pts[i][1] + (dx / d) * rs[i]]);
      B.push([pts[i][0] + (dy / d) * rs[i], pts[i][1] - (dx / d) * rs[i]]);
    }
    const ang = (i, j) => Math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0]);
    const ae = ang(n - 2, n - 1);
    const a0 = ang(0, 1);
    p.moveTo(A[0][0], A[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(A[i][0], A[i][1]);
    p.arc(pts[n - 1][0], pts[n - 1][1], rs[n - 1], ae + Math.PI / 2, ae - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) p.lineTo(B[i][0], B[i][1]);
    p.arc(pts[0][0], pts[0][1], rs[0], a0 - Math.PI / 2, a0 + Math.PI / 2, true);
    p.closePath();
    return p;
  }

  function poly(pts) {
    const p = new Path2D();
    pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
  }
  const circ = (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  };
  const line = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  };
  /** Fyll en form med en flat farge (stil 4a har ingen skygge eller kant per del). */
  function piece(ctx, p, col) {
    ctx.fillStyle = col;
    ctx.fill(p);
  }
  /** Mørkt øye med hvitt glimt. */
  function eye(ctx, x, y, r) {
    ctx.fillStyle = '#1d1712';
    circ(ctx, x, y, r);
    ctx.fillStyle = '#ffffff';
    circ(ctx, x + r * 0.35, y - r * 0.35, r * 0.35);
  }

  // ---------- Papirfiber ----------
  let grainSrc = null;
  function grain() {
    if (grainSrc) return grainSrc;
    const g = document.createElement('canvas');
    g.width = g.height = 192;
    const x = g.getContext('2d');
    let s = 17;
    const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    x.lineCap = 'round';
    for (let i = 0; i < 1100; i++) {
      const px = R() * 192;
      const py = R() * 192;
      const an = R() * Math.PI;
      const l = 2 + R() * 8;
      x.strokeStyle = R() < 0.6 ? 'rgba(255,250,235,0.18)' : 'rgba(60,40,20,0.09)';
      x.lineWidth = 0.6 + R() * 0.9;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + Math.cos(an) * l, py + Math.sin(an) * l);
      x.stroke();
    }
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = R() < 0.5 ? 'rgba(255,250,235,0.12)' : 'rgba(60,40,20,0.07)';
      x.fillRect(R() * 192, R() * 192, 1, 1);
    }
    grainSrc = g;
    return g;
  }

  // ---------- Utklipp ----------
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  /**
   * Lag et utklipp: draw(ctx) tegner dyret flatt rundt origo i målestokk der L = Lpx.
   * box = [x0, y0, x1, y1] i L-enheter. Gir { img, ox, oy } der (ox, oy) er origo i bildet.
   */
  function makeCut(Lpx, box, draw, edge) {
    const m = 0.08;
    const ox = Math.ceil((m - box[0]) * Lpx) + 8;
    const oy = Math.ceil((m - box[1]) * Lpx) + 8;
    const W = ox + Math.ceil((box[2] + m) * Lpx) + 8;
    const H = oy + Math.ceil((box[3] + m) * Lpx) + 8;
    if (off.width < W || off.height < H) {
      off.width = Math.max(off.width, W);
      off.height = Math.max(off.height, H);
    }
    offCtx.setTransform(1, 0, 0, 1, 0, 0);
    offCtx.clearRect(0, 0, Math.min(off.width, W + 24), Math.min(off.height, H + 24));
    offCtx.setTransform(1, 0, 0, 1, ox, oy);
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    draw(offCtx);
    const cut = document.createElement('canvas');
    cut.width = W;
    cut.height = H;
    const b = cut.getContext('2d');
    const r = edge === 'ingen' ? 0 : Math.max(1.2, Lpx * 0.009);
    if (r) {
      for (let k = 0; k < 8; k++) {
        const an = (k / 8) * TAU;
        b.drawImage(off, 0, 0, W, H, Math.cos(an) * r, Math.sin(an) * r, W, H);
      }
      b.globalCompositeOperation = 'source-in';
      b.fillStyle = INK;
      b.fillRect(0, 0, W, H);
      b.globalCompositeOperation = 'source-over';
    }
    b.drawImage(off, 0, 0, W, H, 0, 0, W, H);
    b.globalCompositeOperation = 'source-atop';
    b.fillStyle = b.createPattern(grain(), 'repeat');
    b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'source-over';
    return { img: cut, ox, oy };
  }

  // Lager av ferdige utklipp: nøkkel → { img, ox, oy }. Begrenset i antall piksler.
  const cache = new Map();
  let cachePx = 0;
  const CACHE_MAX = 14e6;
  function cached(key, make) {
    const hit = cache.get(key);
    if (hit) {
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const v = make();
    cache.set(key, v);
    cachePx += v.img.width * v.img.height;
    while (cachePx > CACHE_MAX && cache.size > 1) {
      const k = cache.keys().next().value;
      const old = cache.get(k);
      cachePx -= old.img.width * old.img.height;
      cache.delete(k);
    }
    return v;
  }
  /** Størrelser i trinn på ca. 6 %, så dyr som er nesten like store, deler utklipp. */
  function sizeStep(px) {
    return Math.max(4, Math.round(Math.pow(2, Math.round(Math.log2(px) * 12) / 12)));
  }

  /**
   * Registrer en tegning. def: {
   *   box: [x0, y0, x1, y1] (L-enheter rundt origo), draw(ctx, L, t, o),
   *   period: lengden på bevegelsessyklusen i sekunder (null = stillestående), frames,
   *   anchor: [x, y] i L-enheter som skal ligge i origo når dyret tegnes (f.eks. føttene),
   *   scale: hvor mye av L tegningen skal fylle (gjør om fra appens L til riggens L),
   *   variants(o): tekst som skiller utseender (vinterpels, flyvende/sittende …)
   * }
   */
  const REG = {};
  function define(key, def) {
    REG[key] = def;
    return def;
  }

  /**
   * Tegn et papirdyr i gjeldende transformasjon, med origo der appen forventer det.
   * L: lengden appen bruker (CSS-piksler). t: tid i sekunder. o: valg fra spillet.
   */
  function drawAnimal(ctx, key, L, t, o) {
    const def = REG[key];
    if (!def || !(L > 0)) return;
    o = o || {};
    const m = ctx.getTransform();
    const s = Math.hypot(m.a, m.b) || 1;
    const sc = typeof def.scale === 'function' ? def.scale(o) : def.scale || 1;
    const Lr = L * sc;
    const Lpx = sizeStep(Lr * s);
    const variant = def.variant ? def.variant(o) : '';
    let tt = t || 0;
    let frame = 0;
    if (def.period) {
      const N = def.frames || 24;
      const P = typeof def.period === 'function' ? def.period(o) : def.period;
      frame = Math.floor((((tt % P) + P) % P) / P * N);
      tt = (frame / N) * P;
    } else frame = -1;
    const key2 = `${key}|${variant}|${Lpx}|${frame}`;
    const box = typeof def.box === 'function' ? def.box(o) : def.box;
    const c = cached(key2, () => makeCut(Lpx, box, (x) => def.draw(x, Lpx, tt, o), o.edge));
    const k = (Lr * s) / Lpx; // liten skalering fra størrelsestrinnet til eksakt størrelse
    const an = (typeof def.anchor === 'function' ? def.anchor(o) : def.anchor) || [0, 0];
    ctx.save();
    // Skyggen påvirkes ikke av transformasjonen, så den faller alltid samme vei.
    ctx.shadowColor = o.noShadow ? 'transparent' : SHADOW;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = -Math.max(1, Lpx * 0.007);
    ctx.shadowOffsetY = Math.max(1.2, Lpx * 0.012);
    ctx.scale(k / s, k / s);
    ctx.translate(-an[0] * Lpx, -an[1] * Lpx);
    ctx.drawImage(c.img, -c.ox, -c.oy);
    ctx.restore();
  }

  /** Lag en funksjon med samme form som appens gamle tegninger: art(ctx, L, t, o). */
  function art(key) {
    return (ctx, L, t, o) => drawAnimal(ctx, key, L, t, o);
  }

  // ---------- Terreng i samme stil ----------
  /**
   * Fyll en form flatt med papirskygge, og tegn en tynn blekkontur rundt (terreng, fjell, bakke).
   * o.edge = false: uten kontur. o.shadow = false: uten skygge.
   */
  function paperPath(ctx, path, fill, o) {
    o = o || {};
    ctx.save();
    if (o.shadow !== false) {
      const m = ctx.getTransform();
      const s = Math.hypot(m.a, m.b) || 1;
      ctx.shadowColor = SHADOW;
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = -(o.sx || 2) * s;
      ctx.shadowOffsetY = (o.sy || 3) * s;
    }
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
    if (o.edge !== false) {
      ctx.strokeStyle = o.ink || INK;
      ctx.lineWidth = o.lw || 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke(path);
    }
  }
  /** En strek med blekkontur rundt (stilker, kvister): blekk under, farge oppå. */
  function inkLine(ctx, pts, col, w) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = INK;
    ctx.lineWidth = w + 3;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  /** Papirfiber over hele bildet, svakt, så også bakgrunnen ser ut som papir. */
  let grainPat = null;
  let grainCtx = null;
  function grainOverlay(ctx, w, h, alpha) {
    if (!grainPat || grainCtx !== ctx) {
      grainPat = ctx.createPattern(grain(), 'repeat');
      grainCtx = ctx;
    }
    ctx.save();
    ctx.globalAlpha = alpha == null ? 0.6 : alpha;
    ctx.fillStyle = grainPat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  window.PaizonPapir = { paperPath, inkLine, grainOverlay, TAU, INK, SHADOW, blob, tube, poly, circ, line, piece, eye, grain, makeCut, define, drawAnimal, art, REG, get cacheSize() { return cache.size; } };
})();
