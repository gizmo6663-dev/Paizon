/*
 * Havet – inne i grotter og vrak, sett med egne øyne (førsteperson).
 *
 * Stedet tegnes som et panorama i flere lag. Når man drar sidelengs, ser man seg rundt,
 * og lagene flytter seg ulikt (parallakse), så det føles som et rom med dybde.
 * I mørke steder lyser man med fingeren som en lommelykt.
 */
(function () {
  'use strict';

  const A = window.PaizonOceanArt;
  const TAU = Math.PI * 2;
  const PARALLAX = [0.55, 0.8, 1];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function hex(c) {
    const n = parseInt(c.slice(1), 16);
    return [n >> 16, (n >> 8) & 255, n & 255];
  }
  function shade(c, f, a) {
    const [r, g, b] = hex(c).map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  // ---------- Ting (ikke dyr) ----------
  const OBJECT_ART = {
    coralline(ctx, L) {
      const rnd = A.seeded(5);
      ctx.fillStyle = A.rad(ctx, 0, -L * 0.1, 0, L * 0.5, [[0, '#7c7a72'], [1, '#3e3d38']]);
      ctx.beginPath();
      ctx.ellipse(0, L * 0.05, L * 0.5, L * 0.22, 0, Math.PI, TAU);
      ctx.fill();
      for (let i = 0; i < 40; i++) {
        const a = Math.PI + rnd() * Math.PI;
        const r = rnd() * 0.85;
        ctx.fillStyle = ['#e48aa6', '#d06f93', '#f2a9bd', '#c9668a'][i % 4];
        ctx.beginPath();
        ctx.arc(Math.cos(a) * L * 0.45 * r, L * 0.05 + Math.sin(a) * L * 0.2 * r, L * (0.02 + rnd() * 0.035), 0, TAU);
        ctx.fill();
      }
    },
    wheel(ctx, L, t) {
      ctx.save();
      ctx.rotate(0.25 + Math.sin(t * 0.3) * 0.02);
      ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.strokeStyle = '#4a3420';
        ctx.lineWidth = L * 0.07;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * L * 0.08, Math.sin(a) * L * 0.08);
        ctx.lineTo(Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5);
        ctx.stroke();
        ctx.strokeStyle = '#7a5a36';
        ctx.lineWidth = L * 0.035;
        ctx.stroke();
      }
      ctx.strokeStyle = '#5a4128';
      ctx.lineWidth = L * 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.34, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = '#8a6a42';
      ctx.lineWidth = L * 0.03;
      ctx.beginPath();
      ctx.arc(0, -L * 0.01, L * 0.34, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      ctx.fillStyle = A.rad(ctx, -L * 0.03, -L * 0.03, 0, L * 0.1, [[0, '#b08a52'], [1, '#4a3420']]);
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.1, 0, TAU);
      ctx.fill();
      // Begroing.
      const rnd = A.seeded(9);
      for (let i = 0; i < 16; i++) {
        const a = rnd() * TAU;
        ctx.fillStyle = ['rgba(120,150,70,0.85)', 'rgba(230,140,120,0.8)', 'rgba(240,235,220,0.8)'][i % 3];
        ctx.beginPath();
        ctx.arc(Math.cos(a) * L * 0.34, Math.sin(a) * L * 0.34, L * (0.015 + rnd() * 0.02), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
    net(ctx, L, t) {
      ctx.strokeStyle = 'rgba(190,200,170,0.55)';
      ctx.lineWidth = Math.max(1, L * 0.006);
      const cols = 14;
      const rows = 10;
      const pt = (i, j) => {
        const u = i / cols;
        const v = j / rows;
        const sag = Math.sin(u * Math.PI) * L * 0.18 * v;
        return [(u - 0.5) * L, (v - 0.5) * L * 0.8 + sag + Math.sin(t * 0.8 + u * 5 + v * 3) * L * 0.012 * v];
      };
      for (let j = 0; j <= rows; j++) {
        ctx.beginPath();
        for (let i = 0; i <= cols; i++) {
          const [x, y] = pt(i, j);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i <= cols; i++) {
        ctx.beginPath();
        for (let j = 0; j <= rows; j++) {
          const [x, y] = pt(i, j);
          if (j) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      // Garnkuler (flottører).
      for (let i = 0; i <= cols; i += 3) {
        const [x, y] = pt(i, 0);
        ctx.fillStyle = A.rad(ctx, x - L * 0.01, y - L * 0.01, 0, L * 0.035, [[0, '#f2b26a'], [1, '#b0601e']]);
        ctx.beginPath();
        ctx.arc(x, y, L * 0.03, 0, TAU);
        ctx.fill();
      }
    },
    lantern(ctx, L, t) {
      const swing = Math.sin(t * 0.9) * 0.08;
      ctx.save();
      ctx.translate(0, -L * 0.5);
      ctx.rotate(swing);
      ctx.strokeStyle = '#3a3a36';
      ctx.lineWidth = Math.max(1, L * 0.02);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, L * 0.25);
      ctx.stroke();
      ctx.translate(0, L * 0.55);
      ctx.fillStyle = A.lin(ctx, -L * 0.2, 0, L * 0.2, 0, [[0, '#5a4a2a'], [0.5, '#a08a52'], [1, '#4a3a20']]);
      ctx.beginPath();
      ctx.moveTo(-L * 0.12, -L * 0.3);
      ctx.lineTo(L * 0.12, -L * 0.3);
      ctx.lineTo(L * 0.06, -L * 0.38);
      ctx.lineTo(-L * 0.06, -L * 0.38);
      ctx.fill();
      ctx.fillRect(-L * 0.18, L * 0.25, L * 0.36, L * 0.06);
      // Glass.
      ctx.fillStyle = A.lin(ctx, -L * 0.16, 0, L * 0.16, 0, [[0, 'rgba(120,160,150,0.5)'], [0.4, 'rgba(220,240,230,0.55)'], [1, 'rgba(90,120,110,0.5)']]);
      ctx.beginPath();
      ctx.moveTo(-L * 0.12, -L * 0.3);
      ctx.quadraticCurveTo(-L * 0.2, 0, -L * 0.14, L * 0.25);
      ctx.lineTo(L * 0.14, L * 0.25);
      ctx.quadraticCurveTo(L * 0.2, 0, L * 0.12, -L * 0.3);
      ctx.fill();
      ctx.strokeStyle = '#5a4a2a';
      ctx.lineWidth = Math.max(1, L * 0.02);
      for (const x of [-0.07, 0.07]) {
        ctx.beginPath();
        ctx.moveTo(x * L, -L * 0.3);
        ctx.lineTo(x * L * 1.4, L * 0.25);
        ctx.stroke();
      }
      ctx.restore();
    },
    bell(ctx, L, t) {
      const swing = Math.sin(t * 0.7) * 0.04;
      // Brakett.
      ctx.fillStyle = '#4a3a30';
      ctx.fillRect(-L * 0.4, -L * 0.52, L * 0.8, L * 0.07);
      ctx.save();
      ctx.translate(0, -L * 0.45);
      ctx.rotate(swing);
      const p = new Path2D();
      p.moveTo(-L * 0.1, 0);
      p.bezierCurveTo(-L * 0.2, L * 0.05, -L * 0.2, L * 0.5, -L * 0.36, L * 0.72);
      p.lineTo(L * 0.36, L * 0.72);
      p.bezierCurveTo(L * 0.2, L * 0.5, L * 0.2, L * 0.05, L * 0.1, 0);
      p.closePath();
      ctx.fillStyle = A.lin(ctx, -L * 0.36, 0, L * 0.36, 0, [[0, '#5a4220'], [0.35, '#c89a4a'], [0.5, '#e8c070'], [1, '#4a3418']]);
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      // Irr (grønn patina).
      const rnd = A.seeded(3);
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = `rgba(90,170,140,${0.25 + rnd() * 0.35})`;
        ctx.beginPath();
        ctx.arc((rnd() - 0.5) * L * 0.7, rnd() * L * 0.72, L * (0.02 + rnd() * 0.05), 0, TAU);
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#3a2810';
      ctx.fillRect(-L * 0.36, L * 0.66, L * 0.72, L * 0.06);
      ctx.fillStyle = '#2a1e10';
      ctx.beginPath();
      ctx.arc(0, L * 0.78, L * 0.06, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
    chest(ctx, L) {
      ctx.fillStyle = A.lin(ctx, 0, -L * 0.2, 0, L * 0.25, [[0, '#7a5a34'], [1, '#3a2814']]);
      ctx.fillRect(-L * 0.45, -L * 0.1, L * 0.9, L * 0.35);
      // Lokket står litt åpent.
      ctx.save();
      ctx.translate(-L * 0.45, -L * 0.1);
      ctx.rotate(-0.22);
      ctx.fillStyle = A.lin(ctx, 0, -L * 0.2, 0, 0, [[0, '#8a6a40'], [1, '#5a4024']]);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -L * 0.1);
      ctx.quadraticCurveTo(L * 0.45, -L * 0.28, L * 0.9, -L * 0.1);
      ctx.lineTo(L * 0.9, 0);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#120c06';
      ctx.beginPath();
      ctx.moveTo(-L * 0.45, -L * 0.1);
      ctx.lineTo(L * 0.42, -L * 0.1);
      ctx.lineTo(L * 0.4, -L * 0.25);
      ctx.fill();
      // Jernbeslag med rust.
      ctx.fillStyle = '#6a4a3a';
      for (const x of [-0.32, 0, 0.3]) ctx.fillRect(x * L - L * 0.03, -L * 0.1, L * 0.06, L * 0.35);
      ctx.fillStyle = '#b06a3a';
      ctx.fillRect(-L * 0.04, L * 0.0, L * 0.08, L * 0.07);
      // Sand som har lagt seg foran.
      ctx.fillStyle = 'rgba(160,140,100,0.85)';
      ctx.beginPath();
      ctx.ellipse(0, L * 0.26, L * 0.55, L * 0.07, 0, 0, TAU);
      ctx.fill();
    },
    porthole(ctx, L, t, env) {
      ctx.fillStyle = A.rad(ctx, -L * 0.1, -L * 0.1, L * 0.2, L * 0.55, [[0, '#d8b070'], [1, '#5a3e1e']]);
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = A.rad(ctx, L * 0.05, L * 0.05, 0, L * 0.4, [[0, env && env.light > 0.3 ? '#4fb0c0' : '#0f3550'], [1, '#04121c']]);
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.38, 0, TAU);
      ctx.fill();
      // Noe svømmer forbi utenfor.
      const fx = ((t * 0.08) % 1.6 - 0.8) * L;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, L * 0.38, 0, TAU);
      ctx.clip();
      ctx.fillStyle = 'rgba(120,170,190,0.4)';
      ctx.beginPath();
      ctx.ellipse(fx, L * 0.08, L * 0.09, L * 0.03, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(-L * 0.12, -L * 0.14, L * 0.16, L * 0.06, -0.6, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#3a2a14';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * L * 0.44, Math.sin(a) * L * 0.44, L * 0.025, 0, TAU);
        ctx.fill();
      }
    },
  };

  // ---------- Kulisser (tegnes én gang per lag) ----------
  function rockFacets(c, w, h, base, rnd, opt) {
    const n = Math.round((w * h) / (opt.facet * opt.facet));
    for (let i = 0; i < n; i++) {
      const x = rnd() * w;
      const y = opt.y0 * h + rnd() * (opt.y1 - opt.y0) * h;
      const r = opt.facet * (0.5 + rnd() * 0.9);
      const tone = (rnd() - 0.5) * 0.22;
      const g = c.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, shade(base, tone + 0.06));
      g.addColorStop(0.5, shade(base, tone - 0.12));
      g.addColorStop(1, shade(base, tone - 0.45));
      c.fillStyle = g;
      c.beginPath();
      const k = 6 + Math.floor(rnd() * 3);
      for (let j = 0; j < k; j++) {
        const a = (j / k) * TAU;
        const rr = r * (0.7 + rnd() * 0.4);
        c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
      }
      c.closePath();
      c.fill();
    }
  }

  function jaggedBand(c, w, h, top, depth, base, rnd, dir) {
    // dir 1: fra toppen og ned (tak), -1: fra bunnen og opp (gulv).
    c.beginPath();
    const y0 = dir > 0 ? 0 : h;
    c.moveTo(0, y0);
    for (let x = 0; x <= w + 20; x += 18 + rnd() * 30) {
      const spike = rnd() < 0.18 ? depth * (0.8 + rnd() * 1.4) : depth * (0.2 + rnd() * 0.6);
      c.lineTo(x, dir > 0 ? top + spike : h - top - spike);
    }
    c.lineTo(w + 20, y0);
    c.closePath();
    const g = c.createLinearGradient(0, dir > 0 ? 0 : h, 0, dir > 0 ? top + depth * 2 : h - top - depth * 2);
    g.addColorStop(0, shade(base, -0.65));
    g.addColorStop(1, shade(base, -0.15));
    c.fillStyle = g;
    c.fill();
  }

  function sandFloor(c, w, h, y, color, rnd) {
    c.beginPath();
    c.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) c.lineTo(x, h * y + Math.sin(x * 0.01) * h * 0.02 + Math.sin(x * 0.037) * h * 0.008);
    c.lineTo(w, h);
    c.closePath();
    const g = c.createLinearGradient(0, h * y, 0, h);
    g.addColorStop(0, color);
    g.addColorStop(1, shade('#000000', 0, 0.9));
    c.fillStyle = g;
    c.fill();
    for (let i = 0; i < w / 6; i++) {
      c.fillStyle = `rgba(255,255,240,${rnd() * 0.12})`;
      c.fillRect(rnd() * w, h * (y + 0.02) + rnd() * h * (1 - y), 2, 1.5);
    }
  }

  function buildLayers(place, w, h) {
    const rnd = A.seeded(place.key.length * 97 + 13);
    const pal = place.palette;
    return PARALLAX.map((par, li) => {
      const lw = Math.ceil(w + (place.panoW - w) * par);
      const cv = document.createElement('canvas');
      cv.width = lw;
      cv.height = h;
      const c = cv.getContext('2d');
      if (place.kind === 'cave') caveLayer(c, lw, h, li, place, pal, rnd);
      else if (place.kind === 'boat') boatLayer(c, lw, h, li, place, pal, rnd);
      else shipLayer(c, lw, h, li, place, pal, rnd);
      // Vann mellom oss og det som er langt unna gjør det blekere (gir dybde i rommet).
      const fog = [0.5, 0.22, 0][li];
      if (fog) {
        c.globalCompositeOperation = 'source-atop';
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, shade(pal.water, -0.1, fog));
        g.addColorStop(1, shade(pal.deep, 0, fog * 0.8));
        c.fillStyle = g;
        c.fillRect(0, 0, lw, h);
        c.globalCompositeOperation = 'source-over';
      }
      return { canvas: cv, par };
    });
  }

  function caveLayer(c, w, h, li, place, pal, rnd) {
    if (li === 0) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(pal.water, -0.2));
      g.addColorStop(1, shade(pal.deep, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // Bakveggen av fjell, med en åpning ut mot havet (til venstre) og en mørk gang innover.
      c.save();
      c.beginPath();
      c.rect(0, 0, w, h);
      c.ellipse(w * 0.06, h * 0.45, w * 0.06, h * 0.32, 0, 0, TAU);
      c.ellipse(w * 0.6, h * 0.55, w * 0.05, h * 0.2, 0, 0, TAU);
      c.clip('evenodd');
      c.fillStyle = shade(pal.rock, -0.3);
      c.fillRect(0, 0, w, h);
      rockFacets(c, w, h, pal.rock, rnd, { facet: h * 0.065, y0: -0.05, y1: 1.05 });
      c.restore();
      // Den mørke gangen innover.
      const tg = c.createRadialGradient(w * 0.6, h * 0.55, 0, w * 0.6, h * 0.55, h * 0.22);
      tg.addColorStop(0, '#000');
      tg.addColorStop(1, shade(pal.deep, -0.2, 0.6));
      c.fillStyle = tg;
      c.beginPath();
      c.ellipse(w * 0.6, h * 0.55, w * 0.05, h * 0.2, 0, 0, TAU);
      c.fill();
      // Mose og alger på bakveggen.
      for (let i = 0; i < w / 14; i++) {
        c.fillStyle = shade(pal.moss, (rnd() - 0.5) * 0.4, 0.3);
        c.beginPath();
        c.arc(rnd() * w, h * (0.15 + rnd() * 0.75), h * (0.003 + rnd() * 0.008), 0, TAU);
        c.fill();
      }
    } else if (li === 1) {
      // Fjellpilarer og hyller.
      for (let i = 0; i < 4; i++) {
        const x = w * (0.12 + i * 0.27 + (rnd() - 0.5) * 0.05);
        const pw = h * (0.12 + rnd() * 0.1);
        c.save();
        c.beginPath();
        c.moveTo(x - pw, 0);
        c.quadraticCurveTo(x - pw * 0.3, h * 0.5, x - pw * 1.2, h);
        c.lineTo(x + pw * 1.1, h);
        c.quadraticCurveTo(x + pw * 0.4, h * 0.5, x + pw * 0.9, 0);
        c.closePath();
        c.clip();
        c.fillStyle = shade(pal.rock, -0.2);
        c.fillRect(x - pw * 2, 0, pw * 4, h);
        rockFacets(c, w, h, pal.rock, rnd, { facet: h * 0.045, y0: 0, y1: 1 });
        // Lys fra venstre.
        const lg = c.createLinearGradient(x - pw, 0, x + pw, 0);
        lg.addColorStop(0, 'rgba(255,255,255,0.12)');
        lg.addColorStop(1, 'rgba(0,0,0,0.35)');
        c.fillStyle = lg;
        c.fillRect(x - pw * 2, 0, pw * 4, h);
        c.restore();
      }
      sandFloor(c, w, h, 0.8, shade(pal.rock, 0.25), rnd);
    } else {
      jaggedBand(c, w, h, 0, h * 0.09, pal.rock, rnd, 1);
      jaggedBand(c, w, h, 0, h * 0.05, pal.rock, rnd, -1);
      // Tuster med tang langs gulvet foran.
      for (let i = 0; i < w / 60; i++) {
        const x = rnd() * w;
        c.strokeStyle = shade(pal.moss, -0.2 + rnd() * 0.2, 0.8);
        c.lineWidth = 2;
        for (let k = 0; k < 5; k++) {
          c.beginPath();
          c.moveTo(x + k * 3, h);
          c.quadraticCurveTo(x + k * 3 + 6, h - h * 0.05, x + k * 4 - 4, h - h * (0.06 + rnd() * 0.05));
          c.stroke();
        }
      }
    }
  }

  function boatLayer(c, w, h, li, place, pal, rnd) {
    if (li === 0) {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(pal.water, 0.1));
      g.addColorStop(1, shade(pal.deep, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
      // Bordganger (planker) i skroget, med noen hull ut til havet.
      const ph = h * 0.075;
      for (let y = h * 0.05; y < h; y += ph) {
        for (let x = -rnd() * 200; x < w; x += 160 + rnd() * 200) {
          const len = 140 + rnd() * 220;
          if (rnd() < 0.08) continue; // hull i skroget
          const tone = (rnd() - 0.5) * 0.3;
          const pg = c.createLinearGradient(0, y, 0, y + ph);
          pg.addColorStop(0, shade(pal.wood, tone + 0.1));
          pg.addColorStop(1, shade(pal.wood, tone - 0.35));
          c.fillStyle = pg;
          c.fillRect(x, y, len, ph - 2);
        }
      }
      // Grønske og rur.
      for (let i = 0; i < w / 6; i++) {
        c.fillStyle = shade(pal.moss, (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.3);
        c.beginPath();
        c.arc(rnd() * w, rnd() * h, h * (0.004 + rnd() * 0.012), 0, TAU);
        c.fill();
      }
    } else if (li === 1) {
      // Spant (ribbeina i båten).
      for (let x = w * 0.04; x < w; x += h * 0.45) {
        const bw = h * 0.05;
        const g = c.createLinearGradient(x - bw, 0, x + bw, 0);
        g.addColorStop(0, shade(pal.wood, -0.1));
        g.addColorStop(0.4, shade(pal.wood, 0.15));
        g.addColorStop(1, shade(pal.wood, -0.5));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - bw, 0);
        c.quadraticCurveTo(x - bw - h * 0.08, h * 0.6, x + h * 0.1, h);
        c.lineTo(x + h * 0.1 + bw * 2, h);
        c.quadraticCurveTo(x + bw - h * 0.06, h * 0.6, x + bw, 0);
        c.fill();
      }
      sandFloor(c, w, h, 0.82, '#8a7a58', rnd);
    } else {
      // Ødelagt dekk øverst med plankestumper, og tang som henger ned.
      c.fillStyle = shade(pal.wood, -0.45);
      c.fillRect(0, 0, w, h * 0.05);
      for (let x = 0; x < w; x += 40 + rnd() * 80) {
        c.fillStyle = shade(pal.wood, -0.3 + rnd() * 0.2);
        c.fillRect(x, 0, 30 + rnd() * 50, h * (0.05 + rnd() * 0.06));
      }
      for (let i = 0; i < w / 90; i++) {
        const x = rnd() * w;
        c.strokeStyle = shade(pal.moss, rnd() * 0.2 - 0.1, 0.75);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(x, h * 0.05);
        c.bezierCurveTo(x + 10, h * 0.12, x - 10, h * 0.18, x + 4, h * (0.2 + rnd() * 0.12));
        c.stroke();
      }
      jaggedBand(c, w, h, 0, h * 0.04, '#6a5a40', rnd, -1);
    }
  }

  function shipLayer(c, w, h, li, place, pal, rnd) {
    if (li === 0) {
      c.fillStyle = shade(pal.steel, -0.55);
      c.fillRect(0, 0, w, h);
      // Stålplater med nagler og rustrenner.
      const pw = h * 0.5;
      const phh = h * 0.33;
      for (let x = 0; x < w; x += pw) {
        for (let y = 0; y < h; y += phh) {
          const tone = (rnd() - 0.5) * 0.2;
          const g = c.createLinearGradient(x, y, x + pw * 0.3, y + phh);
          g.addColorStop(0, shade(pal.steel, tone - 0.1));
          g.addColorStop(1, shade(pal.steel, tone - 0.45));
          c.fillStyle = g;
          c.fillRect(x + 2, y + 2, pw - 4, phh - 4);
          c.fillStyle = 'rgba(20,12,8,0.6)';
          for (let k = 0; k < 6; k++) {
            c.beginPath();
            c.arc(x + 8 + (k * (pw - 16)) / 5, y + 8, 2.2, 0, TAU);
            c.fill();
          }
          for (let k = 0; k < 3; k++) {
            const rx = x + rnd() * pw;
            const rg = c.createLinearGradient(0, y, 0, y + phh);
            rg.addColorStop(0, 'rgba(150,70,30,0.55)');
            rg.addColorStop(1, 'rgba(150,70,30,0)');
            c.fillStyle = rg;
            c.fillRect(rx, y + 6, 3 + rnd() * 6, phh * (0.4 + rnd() * 0.6));
          }
        }
      }
      // En mørk døråpning videre inn i skipet.
      c.fillStyle = '#020405';
      c.beginPath();
      c.roundRect(w * 0.47, h * 0.3, h * 0.24, h * 0.5, h * 0.06);
      c.fill();
      c.strokeStyle = shade(pal.steel, -0.2);
      c.lineWidth = 6;
      c.stroke();
    } else if (li === 1) {
      // Rør langs veggen og bjelker.
      for (const y of [0.18, 0.24]) {
        const g = c.createLinearGradient(0, h * y - 8, 0, h * y + 8);
        g.addColorStop(0, shade(pal.steel, 0.1));
        g.addColorStop(1, shade(pal.steel, -0.5));
        c.fillStyle = g;
        c.fillRect(0, h * y - 7, w, 14);
      }
      for (let x = w * 0.08; x < w; x += h * 0.7) {
        const g = c.createLinearGradient(x - 14, 0, x + 14, 0);
        g.addColorStop(0, shade(pal.steel, -0.2));
        g.addColorStop(0.4, shade(pal.steel, 0.05));
        g.addColorStop(1, shade(pal.steel, -0.6));
        c.fillStyle = g;
        c.fillRect(x - 14, 0, 28, h);
      }
      sandFloor(c, w, h, 0.8, '#5a5040', rnd);
    } else {
      const g = c.createLinearGradient(0, 0, 0, h * 0.08);
      g.addColorStop(0, shade(pal.steel, -0.7));
      g.addColorStop(1, shade(pal.steel, -0.3));
      c.fillStyle = g;
      c.fillRect(0, 0, w, h * 0.07);
      // Rusk og sedimenter på gulvet.
      jaggedBand(c, w, h, 0, h * 0.035, '#4a4034', rnd, -1);
      for (let i = 0; i < w / 40; i++) {
        c.fillStyle = shade(pal.moss, (rnd() - 0.5) * 0.4, 0.5);
        c.beginPath();
        c.ellipse(rnd() * w, h * (0.93 + rnd() * 0.06), h * (0.01 + rnd() * 0.03), h * 0.01, 0, 0, TAU);
        c.fill();
      }
    }
  }

  // ---------- Selve visningen ----------
  let el = null;
  let cv = null;
  let ctx = null;
  let darkCv = null;
  let dctx = null;
  let place = null;
  let opts = null;
  let layers = null;
  let W = 0;
  let H = 0;
  let dpr = 1;
  let look = 0;
  let lookV = 0;
  let raf = 0;
  let last = 0;
  let time = 0;
  let pointer = null;
  const torch = { x: 0.5, y: 0.5, on: false };
  let found = new Set();
  let glow = new Map();
  let particles = [];
  let swimmers = [];
  let selected = null;

  function setup() {
    if (el) return;
    el = document.getElementById('ocean-inside');
    cv = document.getElementById('ocean-inside-canvas');
    ctx = cv.getContext('2d');
    darkCv = document.createElement('canvas');
    dctx = darkCv.getContext('2d');
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', () => { pointer = null; });
    window.addEventListener('resize', () => { if (place) measure(); });
  }

  function measure() {
    const r = el.getBoundingClientRect();
    W = Math.max(200, r.width);
    H = Math.max(200, r.height);
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    place.panoW = Math.max(W * 1.9, H * 2.6);
    layers = buildLayers(place, Math.round(W), Math.round(H));
    look = clamp(look, 0, place.panoW - W);
  }

  const maxLook = () => place.panoW - W;

  /** Hvor et lag og en ting havner på skjermen nå. */
  function layerOffset(par) {
    return look * par;
  }
  function itemPos(it) {
    const par = PARALLAX[it.layer];
    const lw = W + (place.panoW - W) * par;
    return { x: it.x * lw - layerOffset(par), y: it.y * H, L: it.size * H };
  }

  /** Vrakene ligger litt på skrå: samme vridning brukes til tegning og til å treffe ting. */
  function tilt() {
    return place.kind === 'boat' ? -0.05 : place.kind === 'ship' ? 0.035 : 0;
  }
  function viewTransform(c) {
    c.translate(0, Math.sin(time * 0.6) * H * 0.006);
    if (!tilt()) return;
    c.translate(W / 2, H / 2);
    c.rotate(tilt());
    c.scale(1.08, 1.08);
    c.translate(-W / 2, -H / 2);
  }
  function toScreen(x, y) {
    const bob = Math.sin(time * 0.6) * H * 0.006;
    const a = tilt();
    if (!a) return { x, y: y + bob };
    const dx = (x - W / 2) * 1.08;
    const dy = (y - H / 2) * 1.08;
    return { x: W / 2 + dx * Math.cos(a) - dy * Math.sin(a), y: H / 2 + dx * Math.sin(a) + dy * Math.cos(a) + bob };
  }

  function open(p, o) {
    setup();
    place = p;
    opts = o;
    found = new Set(o.found || []);
    glow = new Map();
    selected = null;
    el.hidden = false;
    el.dataset.light = p.light < 0.3 ? 'dark' : 'light';
    measure();
    look = maxLook() * 0.12;
    lookV = 0;
    torch.x = W * 0.5;
    torch.y = H * 0.55;
    // Småfisk som svømmer forbi (og maneter som driver i dypet) – gir liv i rommet.
    const kinds = p.light > 0.3 ? ['wrasse', 'herring', 'cod'] : p.light > 0.08 ? ['herring', 'cod'] : ['combjelly', 'lanternfish'];
    swimmers = Array.from({ length: p.light > 0.3 ? 6 : 4 }, (_, i) => ({
      art: kinds[i % kinds.length], x: Math.random(), y: 0.25 + Math.random() * 0.5, dir: Math.random() < 0.5 ? -1 : 1,
      speed: 0.012 + Math.random() * 0.02, size: 0.05 + Math.random() * 0.05, layer: i % 2, ph: Math.random() * 10, face: 1,
    }));
    particles = Array.from({ length: 70 }, (_, i) => ({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random(), r: 0.6 + Math.random() * 1.6, ph: i }));
    document.getElementById('ocean-inside-name').textContent = p.name;
    hideInfo();
    updateCount();
    time = 0;
    last = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function close() {
    if (!place) return;
    place = null;
    el.hidden = true;
    cancelAnimationFrame(raf);
    layers = null; // frigjør minne
  }

  function updateCount() {
    const c = document.getElementById('ocean-inside-count');
    const n = place.items.filter((it) => found.has(it.key)).length;
    c.textContent = `Funnet ${n} av ${place.items.length}`;
    c.hidden = opts.mode === 'rolig';
  }

  function itemAt(px, py) {
    let best = null;
    let bd = Infinity;
    for (const it of place.items) {
      const p = itemPos(it);
      const q = toScreen(p.x, p.y);
      const d = Math.hypot(px - q.x, py - q.y) / Math.max(34, p.L * 0.6);
      if (d < 1 && d < bd) {
        best = it;
        bd = d;
      }
    }
    return best;
  }

  function local(e) {
    const r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e) {
    e.preventDefault();
    const p = local(e);
    pointer = { id: e.pointerId, x0: p.x, y0: p.y, lx: p.x, moved: false, t0: performance.now() };
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }
    torch.on = true;
    torch.x = p.x;
    torch.y = p.y;
    lookV = 0;
  }

  function move(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const p = local(e);
    if (Math.hypot(p.x - pointer.x0, p.y - pointer.y0) > 10) pointer.moved = true;
    torch.x = p.x;
    torch.y = p.y;
    // Dra for å se seg rundt (motsatt vei av fingeren, som å skyve bildet).
    const dx = p.x - pointer.lx;
    pointer.lx = p.x;
    look = clamp(look - dx, 0, maxLook());
    lookV = -dx * 30;
  }

  function up(e) {
    if (!pointer || e.pointerId !== pointer.id) return;
    const p = local(e);
    if (!pointer.moved) {
      const it = itemAt(p.x, p.y);
      if (it) tap(it, p.x);
      else hideInfo();
    }
    pointer = null;
    torch.on = false;
  }

  function tap(it, px) {
    glow.set(it.key, time + 1.8);
    const first = !found.has(it.key);
    found.add(it.key);
    updateCount();
    const res = opts.onFind ? opts.onFind(it, first) : null;
    const pan = clamp((px / W) * 2 - 1, -1, 1);
    if (opts.mode === 'rolig') {
      if (opts.chime) opts.chime(pan);
      return;
    }
    showInfo(it, res || {});
    if (place.items.every((x) => found.has(x.key)) && first && opts.onAllFound) opts.onAllFound(place);
  }

  function showInfo(it, res) {
    selected = it;
    const box = document.getElementById('ocean-inside-info');
    document.getElementById('ocean-inside-info-name').textContent = res.name || it.name;
    document.getElementById('ocean-inside-info-text').textContent = res.text || it.text;
    document.getElementById('ocean-inside-info-new').hidden = !res.isNew;
    // Boksen legger seg på motsatt side av tingen, så den ikke skjuler det man ser på.
    box.classList.toggle('at-top', it.y == null || it.y > 0.5);
    box.hidden = false;
  }

  function hideInfo() {
    selected = null;
    document.getElementById('ocean-inside-info').hidden = true;
    if (opts && opts.onHide) opts.onHide();
  }

  // ---------- Tegning ----------
  function drawArt(it, x, y, L) {
    const art = A.SPECIES_ART[it.art] || OBJECT_ART[it.art];
    if (!art) return;
    ctx.save();
    ctx.translate(x, y);
    // Dyrene vender seg litt mot midten av bildet.
    if (A.SPECIES_ART[it.art] && x > W * 0.6 && !['anemone', 'sponge', 'brittlestar', 'combjelly', 'crab'].includes(it.art)) ctx.scale(-1, 1);
    art(ctx, L, time + it.x * 10, place);
    ctx.restore();
  }

  function drawItems(layer) {
    for (const it of place.items) {
      if (it.layer !== layer) continue;
      const p = itemPos(it);
      if (p.x < -p.L || p.x > W + p.L) continue;
      // Myk skygge under ting som ligger på bunnen.
      if (p.y > H * 0.7) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(p.x, p.y + p.L * 0.22, p.L * 0.45, p.L * 0.07, 0, 0, TAU);
        ctx.fill();
      }
      drawArt(it, p.x, p.y, p.L);
      // Et lite glimt som viser at her er det noe (bare det man ikke har funnet).
      if (opts.mode !== 'rolig' && !found.has(it.key)) {
        const tw = Math.max(0, Math.sin(time * 1.6 + it.x * 20));
        if (tw > 0.85) {
          const a = (tw - 0.85) / 0.15;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,255,220,${a * 0.8})`;
          const sx = p.x + p.L * 0.25;
          const sy = p.y - p.L * 0.25;
          ctx.beginPath();
          ctx.moveTo(sx, sy - 9);
          ctx.lineTo(sx + 2, sy - 2);
          ctx.lineTo(sx + 9, sy);
          ctx.lineTo(sx + 2, sy + 2);
          ctx.lineTo(sx, sy + 9);
          ctx.lineTo(sx - 2, sy + 2);
          ctx.lineTo(sx - 9, sy);
          ctx.lineTo(sx - 2, sy - 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  function drawLightShafts() {
    if (place.light < 0.3) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const par = PARALLAX[0];
    const lw = W + (place.panoW - W) * par;
    const sources = place.kind === 'cave' ? [0.06] : [0.15, 0.4, 0.7];
    for (const sxf of sources) {
      const x = sxf * lw - layerOffset(par);
      for (let i = 0; i < 3; i++) {
        const a = 0.03 + 0.02 * Math.sin(time * 0.6 + i * 2 + sxf * 9);
        const g = ctx.createLinearGradient(x, 0, x + H * 0.45, H * 0.9);
        g.addColorStop(0, `rgba(220,255,240,${a * place.light * 2})`);
        g.addColorStop(0.6, `rgba(220,255,240,${a * place.light * 0.6})`);
        g.addColorStop(1, 'rgba(220,255,240,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        const off = (i - 1) * H * 0.07;
        ctx.moveTo(x + off - H * 0.03, 0);
        ctx.lineTo(x + off + H * 0.04, 0);
        ctx.lineTo(x + off + H * 0.55, H);
        ctx.lineTo(x + off + H * 0.3, H);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawSwimmers(layer, dt) {
    for (const f of swimmers) {
      if (f.layer !== layer) continue;
      f.x += f.dir * f.speed * dt;
      if (f.x < -0.05 || f.x > 1.05) {
        f.dir *= -1;
        f.y = 0.25 + Math.random() * 0.5;
      }
      f.face += (f.dir - f.face) * Math.min(1, dt * 3);
      const par = PARALLAX[layer];
      const lw = W + (place.panoW - W) * par;
      const x = f.x * lw - layerOffset(par);
      const y = (f.y + Math.sin(time * 0.5 + f.ph) * 0.02) * H;
      const L = f.size * H * (layer ? 1 : 0.7);
      if (x < -L || x > W + L) continue;
      const art = A.SPECIES_ART[f.art];
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = layer ? 0.95 : 0.7;
      if (f.art !== 'combjelly') ctx.scale(Math.sign(f.face || 1) * Math.max(0.12, Math.abs(f.face)), 1);
      art(ctx, L, time * 1.3 + f.ph);
      ctx.restore();
      const glow = A.GLOWS[f.art];
      if (glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, y);
        glow(ctx, L, time * 1.3 + f.ph);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Lysmønster som bølger over bunnen der dagslyset når inn. */
  function drawCaustics() {
    if (place.light < 0.3) return;
    const pat = ctx.createPattern(A.causticTile(160), 'repeat');
    if (!pat) return;
    pat.setTransform(new DOMMatrix().translate(-look * 0.8 + time * 12, time * 6).scale(H / 500));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18 * place.light;
    ctx.fillStyle = pat;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.restore();
  }

  function drawParticles(dt) {
    for (const p of particles) {
      p.y -= dt * 0.006 * p.z;
      if (p.y < 0) p.y += 1;
      const x = ((p.x * place.panoW - look * p.z) % W + W) % W;
      const y = (p.y + Math.sin(time * 0.4 + p.ph) * 0.005) * H;
      ctx.fillStyle = `rgba(230,240,230,${0.25 * p.z})`;
      ctx.fillRect(x, y, p.r * p.z, p.r * p.z);
    }
  }

  function drawDarkness() {
    const darkness = clamp(1 - place.light, 0, 0.97);
    if (darkness < 0.05) return;
    const w = Math.ceil(W / 2);
    const h = Math.ceil(H / 2);
    if (darkCv.width !== w || darkCv.height !== h) {
      darkCv.width = w;
      darkCv.height = h;
    }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, w, h);
    dctx.fillStyle = `rgba(0,3,8,${darkness})`;
    dctx.fillRect(0, 0, w, h);
    dctx.globalCompositeOperation = 'destination-out';
    const R = H * 0.34 / 2;
    const g = dctx.createRadialGradient(torch.x / 2, torch.y / 2, 0, torch.x / 2, torch.y / 2, R);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.85)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    dctx.fillStyle = g;
    dctx.beginPath();
    dctx.arc(torch.x / 2, torch.y / 2, R, 0, TAU);
    dctx.fill();
    ctx.drawImage(darkCv, 0, 0, W, H);
    // Varmt lysskjær der lykta treffer.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(torch.x, torch.y, 0, torch.x, torch.y, H * 0.3);
    lg.addColorStop(0, 'rgba(255,240,200,0.12)');
    lg.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawGlows() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const it of place.items) {
      const ip = itemPos(it);
      const p = { ...toScreen(ip.x, ip.y), L: ip.L };
      const glowArt = A.GLOWS[it.art];
      if (glowArt) {
        ctx.save();
        ctx.translate(p.x, p.y);
        glowArt(ctx, p.L, time + it.x * 10);
        ctx.restore();
      }
      const until = glow.get(it.key) || 0;
      if (until > time) {
        const f = (until - time) / 1.8;
        const r = Math.max(40, p.L * 0.8);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(255,255,220,${0.35 * f})`);
        g.addColorStop(1, 'rgba(255,255,220,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      }
    }
    // Selvlysende prikker på veggene i dypet.
    if (place.light < 0.1) {
      for (let i = 0; i < 26; i++) {
        const lw = W + (place.panoW - W) * PARALLAX[0];
        const x = ((i * 0.137 + 0.05) % 1) * lw - layerOffset(PARALLAX[0]);
        const y = H * (0.15 + ((i * 0.311) % 0.7));
        const a = 0.25 + 0.25 * Math.sin(time * 0.8 + i * 1.7);
        ctx.fillStyle = `rgba(110,220,255,${a})`;
        ctx.beginPath();
        ctx.arc(x, y, 1.6 + (i % 3), 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function loop(now) {
    if (!place) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    // Litt gli etter at man slipper.
    if (!pointer && Math.abs(lookV) > 1) {
      look = clamp(look + lookV * dt, 0, maxLook());
      lookV *= Math.pow(0.05, dt);
    }
    // Uten finger vandrer lykta rolig rundt av seg selv.
    if (!torch.on) {
      const tx = W * (0.5 + Math.sin(time * 0.23) * 0.25);
      const ty = H * (0.55 + Math.sin(time * 0.31) * 0.18);
      torch.x += (tx - torch.x) * Math.min(1, dt * 0.8);
      torch.y += (ty - torch.y) * Math.min(1, dt * 0.8);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Rolig «pust» i bildet, som om man flyter.
    ctx.save();
    viewTransform(ctx);
    layers.forEach((l, i) => {
      ctx.drawImage(l.canvas, -layerOffset(l.par), 0);
      if (i === 0) drawLightShafts();
      if (i === 1) drawCaustics();
      if (i < 2) drawSwimmers(i, dt);
      drawItems(i);
    });
    ctx.restore();
    drawParticles(dt);
    // Mørkere i kantene, som når man ser ut gjennom dykkermasken.
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    drawDarkness();
    drawGlows();
    raf = requestAnimationFrame(loop);
  }

  window.PaizonOceanInside = {
    open,
    close,
    get isOpen() { return !!place; },
    get place() { return place; },
    get found() { return found; },
    get selected() { return selected; },
    hideInfo,
    /** Vis en tekst i infoboksen (f.eks. en introduksjon til stedet). */
    message(name, text) { showInfo({}, { name, text }); },
    OBJECT_ART,
    // For tester: hvor en ting er på skjermen akkurat nå.
    itemScreenPos(key) {
      const it = place && place.items.find((x) => x.key === key);
      if (!it) return null;
      const r = cv.getBoundingClientRect();
      const p = itemPos(it);
      const q = toScreen(p.x, p.y);
      return { x: r.left + q.x, y: r.top + q.y };
    },
    lookTo(f) { look = clamp(f, 0, 1) * maxLook(); },
  };
})();
