/*
 * Skogen – kulisser: trær som skifter med årstidene, fjell og trerekker i det fjerne,
 * skogbunn og sti, gjemmesteder og den lille oppdageren som går langs stien.
 * Trær og fjerne trerekker tegnes én gang per årstid og gjenbrukes (sprite).
 */
(function () {
  'use strict';

  const X = window.PaizonExplore;
  const { TAU, lin, rad, shade, mixHex, sprite, seeded } = X;

  // Farger per årstid.
  const PALETTE = {
    var: { spruce: '#2e4a2c', birch: '#9ccf5a', ground: '#5e7a34', moss: '#7a9a40', path: '#8a7350', grass: '#8cbf4a' },
    sommer: { spruce: '#2a4428', birch: '#5f9a32', ground: '#4f6e2c', moss: '#6a8a34', path: '#86704c', grass: '#6aa23a' },
    host: { spruce: '#2c4228', birch: '#e0a628', ground: '#6a5a30', moss: '#7a6a34', path: '#7a6444', grass: '#a08a42' },
    vinter: { spruce: '#23382a', birch: null, ground: '#e8eef4', moss: '#dfe8f0', path: '#c8d2dc', grass: '#cfd8e0' },
  };

  /** Gran: hengende greiner med fillete kanter, tettest nederst. Origo ved foten av stammen. */
  function spruce(h, season, variant) {
    const w = h * 0.55;
    return sprite(`gran-${season}-${variant}`, w, h, (c, W, H) => {
      const r = seeded(variant * 31 + 7);
      const pal = PALETTE[season];
      c.translate(W / 2, H);
      c.fillStyle = '#3e2c1e';
      c.fillRect(-W * 0.022, -H * 0.97, W * 0.044, H * 0.97);
      const tiers = 24;
      for (let i = 0; i < tiers; i++) {
        const u = i / tiers;
        const y = -H * (0.08 + u * 0.9);
        const reach = W * 0.5 * Math.pow(1 - u, 0.95) * (0.8 + r() * 0.3);
        const droop = H * (0.035 + 0.03 * (1 - u));
        for (const side of [-1, 1]) {
          const len = reach * (0.85 + r() * 0.25);
          const tone = -0.25 + r() * 0.15 + u * 0.12;
          // Greina: en hengende bue med takkete underkant av barnåler.
          c.beginPath();
          c.moveTo(0, y - H * 0.012);
          c.quadraticCurveTo(side * len * 0.55, y - droop * 0.3, side * len, y + droop);
          const n = 9;
          for (let k = n; k >= 0; k--) {
            const s2 = k / n;
            const px = side * len * s2;
            const py = y + droop * s2 * s2 + H * (0.018 + r() * 0.02) * (k % 2 ? 1 : 0.4);
            c.lineTo(px, py);
          }
          c.closePath();
          c.fillStyle = lin(c, 0, y - droop, 0, y + droop * 1.6, [[0, shade(pal.spruce, tone + 0.22)], [1, shade(pal.spruce, tone - 0.1)]]);
          c.fill();
          if (season === 'vinter' && r() < 0.85) {
            c.fillStyle = 'rgba(248,251,255,0.95)';
            c.beginPath();
            c.moveTo(side * len * 0.1, y - H * 0.008);
            c.quadraticCurveTo(side * len * 0.55, y - droop * 0.3 - H * 0.012, side * len * 0.92, y + droop * 0.8);
            c.quadraticCurveTo(side * len * 0.55, y - droop * 0.2 + H * 0.004, side * len * 0.1, y);
            c.fill();
          }
        }
      }
      // Lys kant fra sola på venstre side.
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = lin(c, -W * 0.5, 0, W * 0.5, 0, [[0, 'rgba(255,250,220,0.12)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.2)']]);
      c.fillRect(-W / 2, -H, W, H);
      c.globalCompositeOperation = 'source-over';
      if (season !== 'vinter') {
        c.fillStyle = '#6a4a2a';
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.ellipse((r() - 0.5) * W * 0.35, -H * (0.62 + r() * 0.3), W * 0.012, W * 0.032, 0, 0, TAU);
          c.fill();
        }
      }
    });
  }

  /** Furu: høy, rødbrun stamme og en krone av klaser i toppen. */
  function pine(h, season, variant) {
    const w = h * 0.5;
    return sprite(`furu-${season}-${variant}`, w, h, (c, W, H) => {
      const r = seeded(variant * 17 + 3);
      c.translate(W / 2, H);
      c.fillStyle = lin(c, -W * 0.04, 0, W * 0.04, 0, [[0, '#7a4a2a'], [0.5, '#c07a44'], [1, '#6a3a20']]);
      c.beginPath();
      c.moveTo(-W * 0.04, 0);
      c.lineTo(-W * 0.02, -H * 0.85);
      c.lineTo(W * 0.02, -H * 0.85);
      c.lineTo(W * 0.04, 0);
      c.fill();
      const green = season === 'vinter' ? '#2a4030' : '#35502e';
      for (let i = 0; i < 9; i++) {
        const x = (r() - 0.5) * W * 0.8;
        const y = -H * (0.68 + r() * 0.28);
        c.strokeStyle = '#6a3a20';
        c.lineWidth = W * 0.012;
        c.beginPath();
        c.moveTo(0, y + H * 0.04);
        c.lineTo(x, y);
        c.stroke();
        c.fillStyle = rad(c, x - W * 0.03, y - W * 0.03, 0, W * 0.16, [[0, shade(green, 0.2)], [1, shade(green, -0.2)]]);
        c.beginPath();
        c.ellipse(x, y, W * 0.16, W * 0.08, 0, 0, TAU);
        c.fill();
        if (season === 'vinter') {
          c.fillStyle = 'rgba(250,252,255,0.9)';
          c.beginPath();
          c.ellipse(x, y - W * 0.04, W * 0.13, W * 0.035, 0, 0, TAU);
          c.fill();
        }
      }
    });
  }

  /** Bjørk: hvit stamme med svarte flekker, og bladverk som skifter farge (bare greiner om vinteren). */
  function birch(h, season, variant) {
    const w = h * 0.6;
    return sprite(`bjork-${season}-${variant}`, w, h, (c, W, H) => {
      const r = seeded(variant * 13 + 11);
      const pal = PALETTE[season];
      c.translate(W / 2, H);
      c.fillStyle = lin(c, -W * 0.03, 0, W * 0.03, 0, [[0, '#cfcac0'], [0.4, '#f6f4ee'], [1, '#a8a296']]);
      c.beginPath();
      c.moveTo(-W * 0.035, 0);
      c.quadraticCurveTo(-W * 0.02, -H * 0.5, -W * 0.01, -H * 0.92);
      c.lineTo(W * 0.012, -H * 0.92);
      c.quadraticCurveTo(W * 0.025, -H * 0.5, W * 0.035, 0);
      c.fill();
      c.fillStyle = '#2a2622';
      for (let i = 0; i < 16; i++) {
        c.fillRect(-W * 0.03 + r() * W * 0.04, -H * r() * 0.9, W * (0.01 + r() * 0.02), H * 0.006);
      }
      c.strokeStyle = '#5a4a40';
      c.lineWidth = Math.max(1, W * 0.008);
      const tips = [];
      for (let i = 0; i < 14; i++) {
        const y = -H * (0.35 + r() * 0.55);
        const s = r() < 0.5 ? -1 : 1;
        const x1 = s * W * (0.15 + r() * 0.3);
        const y1 = y - H * (0.05 + r() * 0.1);
        c.beginPath();
        c.moveTo(0, y);
        c.quadraticCurveTo(x1 * 0.5, y - H * 0.05, x1, y1 + H * 0.06);
        c.stroke();
        tips.push([x1, y1]);
      }
      if (pal.birch) {
        // Mange små blader i klaser langs greinene, mørkest innerst.
        for (let i = 0; i < 260; i++) {
          const [tx, ty] = tips[i % tips.length];
          const f = 0.3 + r() * 0.8;
          const x = tx * f + (r() - 0.5) * W * 0.08;
          const y = ty + H * 0.06 * (1 - f) + (r() - 0.4) * H * 0.08;
          c.fillStyle = shade(pal.birch, -0.3 + r() * 0.45 + (y < -H * 0.7 ? 0.1 : 0), 0.92);
          c.beginPath();
          c.ellipse(x, y, W * (0.018 + r() * 0.016), W * (0.011 + r() * 0.01), r() * 3, 0, TAU);
          c.fill();
        }
      } else {
        c.fillStyle = 'rgba(250,252,255,0.85)';
        for (const [tx, ty] of tips) {
          c.beginPath();
          c.ellipse(tx * 0.7, ty + H * 0.04, W * 0.04, W * 0.01, 0.2, 0, TAU);
          c.fill();
        }
      }
    });
  }

  /** En rekke med grantopper langt borte. Lages som en flis som gjentas sidelengs. */
  function treeLine(w, h, color, seed) {
    return sprite(`treeline-${color}-${seed}`, w, h, (c, W, H) => {
      const r = seeded(seed);
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(0, H);
      let x = 0;
      while (x < W) {
        const th = H * (0.45 + r() * 0.5);
        const tw = th * 0.32;
        c.lineTo(x, H - th * 0.15);
        c.lineTo(x + tw * 0.5, H - th);
        c.lineTo(x + tw, H - th * 0.15);
        x += tw * (0.55 + r() * 0.3);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fill();
    });
  }

  // ---------- Gjemmesteder ----------
  const HIDEOUT_ART = {
    stone(ctx, L, t, o) {
      const lift = o.open || 0;
      if (lift > 0) {
        // Mørk, fuktig jord under steinen.
        ctx.fillStyle = '#2e2418';
        ctx.beginPath();
        ctx.ellipse(0, 0, L * 0.42, L * 0.08, 0, 0, TAU);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(-L * 0.35, 0);
      ctx.rotate(-lift * 0.5);
      ctx.translate(L * 0.35, -lift * L * 0.1);
      ctx.fillStyle = rad(ctx, -L * 0.1, -L * 0.25, L * 0.05, L * 0.55, [[0, '#9a968c'], [1, '#4a4842']]);
      ctx.beginPath();
      ctx.moveTo(-L * 0.45, 0);
      ctx.quadraticCurveTo(-L * 0.45, -L * 0.3, -L * 0.1, -L * 0.36);
      ctx.quadraticCurveTo(L * 0.4, -L * 0.38, L * 0.46, 0);
      ctx.fill();
      ctx.fillStyle = o.snow ? 'rgba(250,252,255,0.95)' : 'rgba(110,140,60,0.7)';
      ctx.beginPath();
      ctx.ellipse(-L * 0.05, -L * 0.33, L * 0.25, L * 0.05, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
    anthill(ctx, L, t, o) {
      window.PaizonCreatures.ART.maurtue(ctx, L, o.snow ? 0 : t);
      if (o.snow) {
        ctx.fillStyle = 'rgba(250,252,255,0.95)';
        ctx.beginPath();
        ctx.moveTo(-L * 0.45, -L * 0.05);
        ctx.quadraticCurveTo(0, -L * 0.75, L * 0.45, -L * 0.05);
        ctx.quadraticCurveTo(0, -L * 0.45, -L * 0.45, -L * 0.05);
        ctx.fill();
      }
    },
    pond(ctx, L, t, o) {
      const frozen = o.snow;
      ctx.fillStyle = frozen ? lin(ctx, 0, -L * 0.1, 0, L * 0.1, [[0, '#cfe2ee'], [1, '#9cbccf']]) : lin(ctx, 0, -L * 0.1, 0, L * 0.1, [[0, o.sky || '#6a9ab8'], [1, '#1e3a40']]);
      ctx.beginPath();
      ctx.ellipse(0, 0, L * 0.5, L * 0.1, 0, 0, TAU);
      ctx.fill();
      if (!frozen) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          const rr = ((t * 0.3 + i / 3) % 1);
          ctx.globalAlpha = 1 - rr;
          ctx.beginPath();
          ctx.ellipse(L * 0.15, L * 0.02, L * 0.2 * rr, L * 0.04 * rr, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#4a7a30';
        for (const [x, y] of [[-0.25, 0.02], [0.05, -0.03], [0.3, 0.03]]) {
          ctx.beginPath();
          ctx.ellipse(L * x, L * y, L * 0.06, L * 0.02, 0, 0.3, TAU);
          ctx.fill();
        }
      }
      // Siv langs kanten.
      ctx.strokeStyle = frozen ? '#9a8a6a' : '#6a7a32';
      ctx.lineWidth = Math.max(1, L * 0.008);
      for (let i = 0; i < 9; i++) {
        const x = -L * 0.5 + (i < 5 ? i * L * 0.03 : L * 0.88 + (i - 5) * L * 0.03);
        ctx.beginPath();
        ctx.moveTo(x, L * 0.02);
        ctx.quadraticCurveTo(x + Math.sin(t + i) * L * 0.02, -L * 0.15, x + Math.sin(t * 0.8 + i) * L * 0.04, -L * (0.25 + (i % 3) * 0.05));
        ctx.stroke();
      }
    },
    hollow(ctx, L, t, o) {
      // Gammel, død furu med knekt topp og et hull der ugla eller ekornet bor.
      const p = new Path2D();
      p.moveTo(-L * 0.14, 0);
      p.quadraticCurveTo(-L * 0.08, -L * 0.4, -L * 0.075, -L * 1.05);
      p.lineTo(-L * 0.04, -L * 1.12);
      p.lineTo(-L * 0.01, -L * 1.04);
      p.lineTo(L * 0.03, -L * 1.16);
      p.lineTo(L * 0.075, -L * 1.0);
      p.quadraticCurveTo(L * 0.08, -L * 0.4, L * 0.15, 0);
      p.closePath();
      ctx.fillStyle = lin(ctx, -L * 0.12, 0, L * 0.12, 0, [[0, '#4a3a2c'], [0.4, '#8a7660'], [1, '#3a2c20']]);
      ctx.fill(p);
      ctx.save();
      ctx.clip(p);
      ctx.strokeStyle = 'rgba(30,20,12,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * L * 0.04, 0);
        ctx.quadraticCurveTo(i * L * 0.03 + L * 0.01, -L * 0.6, i * L * 0.025, -L * 1.2);
        ctx.stroke();
      }
      ctx.fillStyle = o.snow ? 'rgba(250,252,255,0.9)' : 'rgba(110,140,60,0.6)';
      ctx.beginPath();
      ctx.ellipse(-L * 0.1, -L * 0.15, L * 0.06, L * 0.12, 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#100a06';
      ctx.beginPath();
      ctx.ellipse(0, -L * 0.55, L * 0.045, L * 0.07, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a08a6a';
      ctx.lineWidth = 2;
      ctx.stroke();
      // En avbrukket grein.
      ctx.strokeStyle = '#5a4a38';
      ctx.lineWidth = L * 0.025;
      ctx.beginPath();
      ctx.moveTo(L * 0.07, -L * 0.8);
      ctx.lineTo(L * 0.22, -L * 0.9);
      ctx.stroke();
    },
    stump(ctx, L, t, o) {
      ctx.fillStyle = lin(ctx, -L * 0.3, 0, L * 0.3, 0, [[0, '#4a3624'], [0.5, '#7a5a3a'], [1, '#3a2a1a']]);
      ctx.beginPath();
      ctx.moveTo(-L * 0.32, 0);
      ctx.lineTo(-L * 0.25, -L * 0.35);
      ctx.lineTo(L * 0.25, -L * 0.38);
      ctx.lineTo(L * 0.34, 0);
      ctx.fill();
      ctx.fillStyle = o.snow ? '#f4f8fb' : '#c9a476';
      ctx.beginPath();
      ctx.ellipse(0, -L * 0.365, L * 0.25, L * 0.06, -0.05, 0, TAU);
      ctx.fill();
      if (!o.snow) {
        ctx.strokeStyle = 'rgba(120,80,40,0.6)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(0, -L * 0.365, L * 0.25 * i / 4, L * 0.06 * i / 4, -0.05, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.fillStyle = 'rgba(120,150,60,0.8)';
      ctx.beginPath();
      ctx.ellipse(-L * 0.2, -L * 0.08, L * 0.1, L * 0.05, 0.4, 0, TAU);
      ctx.fill();
    },
  };

  /** Den lille oppdageren: lue, ryggsekk og støvler. Går når walking > 0. Origo ved føttene. */
  function walker(ctx, L, t, o) {
    const w = o.walking || 0;
    const ph = t * 7;
    const leg = (side) => {
      const a = Math.sin(ph + side * Math.PI) * 0.5 * w;
      ctx.save();
      ctx.translate(0, -L * 0.42);
      ctx.rotate(a);
      ctx.fillStyle = side ? '#2a3a5a' : '#34466a';
      ctx.fillRect(-L * 0.045, 0, L * 0.09, L * 0.36);
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(-L * 0.05, L * 0.34, L * 0.14, L * 0.07);
      ctx.restore();
    };
    leg(1);
    const bob = Math.abs(Math.sin(ph)) * L * 0.02 * w;
    ctx.save();
    ctx.translate(0, -bob);
    // Ryggsekk.
    ctx.fillStyle = lin(ctx, -L * 0.25, 0, -L * 0.05, 0, [[0, '#a4402a'], [1, '#d0603a']]);
    ctx.beginPath();
    ctx.roundRect(-L * 0.24, -L * 0.82, L * 0.16, L * 0.32, L * 0.05);
    ctx.fill();
    // Jakke.
    ctx.fillStyle = lin(ctx, 0, -L * 0.85, 0, -L * 0.4, [[0, '#f0b030'], [1, '#c8861a']]);
    ctx.beginPath();
    ctx.roundRect(-L * 0.12, -L * 0.85, L * 0.24, L * 0.46, L * 0.08);
    ctx.fill();
    // Arm som svinger.
    ctx.save();
    ctx.translate(0, -L * 0.78);
    ctx.rotate(-Math.sin(ph) * 0.5 * w + 0.15);
    ctx.fillStyle = '#d89a22';
    ctx.fillRect(-L * 0.04, 0, L * 0.08, L * 0.3);
    ctx.fillStyle = '#f2c8a0';
    ctx.beginPath();
    ctx.arc(0, L * 0.32, L * 0.045, 0, TAU);
    ctx.fill();
    if (o.lantern) {
      ctx.fillStyle = '#3a3a36';
      ctx.fillRect(-L * 0.04, L * 0.35, L * 0.08, L * 0.12);
      ctx.fillStyle = '#ffe9a0';
      ctx.fillRect(-L * 0.03, L * 0.37, L * 0.06, L * 0.08);
    }
    ctx.restore();
    // Hode med lue.
    ctx.fillStyle = '#f2c8a0';
    ctx.beginPath();
    ctx.arc(L * 0.02, -L * 0.95, L * 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a7a6a';
    ctx.beginPath();
    ctx.arc(L * 0.02, -L * 0.98, L * 0.125, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4f0e6';
    ctx.beginPath();
    ctx.arc(-L * 0.04, -L * 1.12, L * 0.045, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a1e16';
    ctx.beginPath();
    ctx.arc(L * 0.08, -L * 0.95, L * 0.018, 0, TAU);
    ctx.fill();
    ctx.restore();
    leg(0);
  }

  window.PaizonForestArt = { PALETTE, spruce, pine, birch, treeLine, HIDEOUT_ART, walker, mixHex };
})();
