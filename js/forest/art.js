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

  /*
   * Trærne er papirutklipp (stil 4a): flate farger, én kontur rundt hele treet og papirfiber.
   * Hvert tre tegnes én gang per størrelse og årstid. Lerretet har litt luft rundt, og foten av
   * treet står nederst på midten, så de kan settes rett på bakken.
   */
  function cutTree(key, w, h, box, draw) {
    return sprite(key, w * 1.25, h * 1.08, (c, W, H) => {
      const K = window.PaizonPapir;
      const L = H * 0.9;
      if (!K) {
        c.translate(W / 2, H * 0.97);
        draw(c, L);
        return;
      }
      const cut = K.makeCut(L, box, (x) => draw(x, L));
      c.drawImage(cut.img, W / 2 - cut.ox, H * 0.97 - cut.oy);
    });
  }

  /** Gran: sikksakk av greinlag, mørk på skyggesiden, snø på hvert lag om vinteren. */
  function spruce(h, season, variant) {
    return cutTree(`gran-${season}-${variant}`, h * 0.55, h, [-0.32, -1.0, 0.32, 0.02], (c, L) => {
      const r = seeded(variant * 31 + 7);
      const pal = PALETTE[season];
      c.fillStyle = '#4a3424';
      c.fillRect(-L * 0.025, -L * 0.16, L * 0.05, L * 0.17);
      const top = -L * 0.99;
      const base = -L * 0.1;
      const n = 7;
      const sz = base - top;
      const p = new Path2D();
      p.moveTo(0, top);
      const right = [];
      for (let k = 0; k < n; k++) {
        const yy = top + ((k + 1) * sz) / n;
        const hw = L * 0.29 * ((k + 1.2) / (n + 0.2)) * (0.9 + r() * 0.15);
        right.push([hw, yy], [hw * 0.42, yy - sz / n * 0.32]);
      }
      right.forEach(([x, y]) => p.lineTo(x, y));
      for (let i = right.length - 1; i >= 0; i--) p.lineTo(-right[i][0] * (0.95 + (i % 3) * 0.03), right[i][1]);
      p.closePath();
      c.fillStyle = shade(pal.spruce, 0.05);
      c.fill(p);
      // Skyggesiden (lyset kommer fra øvre høyre).
      c.save();
      c.clip(p);
      c.fillStyle = shade(pal.spruce, -0.22);
      c.fillRect(-L, top, L * 0.98, sz + 2);
      if (season === 'vinter') {
        c.fillStyle = '#f6f9fc';
        for (let k = 0; k < n; k++) {
          const yy = top + (k * sz) / n + sz / n * 0.55;
          const hw = L * 0.29 * ((k + 1.2) / (n + 0.2));
          c.beginPath();
          c.moveTo(-hw * 0.95, yy + sz / n * 0.35);
          c.quadraticCurveTo(0, yy - sz / n * 0.25, hw * 0.95, yy + sz / n * 0.35);
          c.lineTo(hw * 0.6, yy + sz / n * 0.18);
          c.quadraticCurveTo(0, yy - sz / n * 0.05, -hw * 0.6, yy + sz / n * 0.18);
          c.fill();
        }
      }
      c.restore();
    });
  }

  /** Furu: høy, rødbrun stamme og en krone av flate klaser i toppen. */
  function pine(h, season, variant) {
    return cutTree(`furu-${season}-${variant}`, h * 0.5, h, [-0.32, -1.0, 0.32, 0.02], (c, L) => {
      const r = seeded(variant * 17 + 3);
      const K = window.PaizonPapir;
      const trunk = K ? K.tube([[0, 0], [L * 0.01, -L * 0.5], [-L * 0.01, -L * 0.85]], [L * 0.032, L * 0.024, L * 0.016]) : null;
      if (trunk) {
        c.fillStyle = '#b06a3a';
        c.fill(trunk);
      }
      const green = season === 'vinter' ? '#2e4532' : '#3a5a32';
      for (let i = 0; i < 8; i++) {
        const x = (r() - 0.5) * L * 0.45;
        const y = -L * (0.66 + r() * 0.28);
        c.strokeStyle = '#7a4424';
        c.lineWidth = L * 0.012;
        c.beginPath();
        c.moveTo(0, y + L * 0.04);
        c.lineTo(x, y);
        c.stroke();
        c.fillStyle = i % 2 ? green : shade(green, 0.12);
        c.beginPath();
        c.ellipse(x, y, L * 0.11, L * 0.055, 0, 0, TAU);
        c.fill();
        if (season === 'vinter') {
          c.fillStyle = '#f6f9fc';
          c.beginPath();
          c.ellipse(x, y - L * 0.03, L * 0.09, L * 0.022, 0, 0, TAU);
          c.fill();
        }
      }
    });
  }

  /** Bjørk: hvit stamme med svarte flekker, og flate løvklaser (bare greiner om vinteren). */
  function birch(h, season, variant) {
    return cutTree(`bjork-${season}-${variant}`, h * 0.6, h, [-0.36, -1.0, 0.36, 0.02], (c, L) => {
      const r = seeded(variant * 13 + 11);
      const pal = PALETTE[season];
      const K = window.PaizonPapir;
      const tips = [];
      c.strokeStyle = '#4a3e36';
      c.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const y = -L * (0.4 + r() * 0.48);
        const sgn = i % 2 ? -1 : 1;
        const x1 = sgn * L * (0.12 + r() * 0.16);
        const y1 = y - L * (0.06 + r() * 0.1);
        c.lineWidth = L * 0.012;
        c.beginPath();
        c.moveTo(0, y);
        c.quadraticCurveTo(x1 * 0.5, y - L * 0.04, x1, y1);
        c.stroke();
        tips.push([x1, y1]);
      }
      if (pal.birch) {
        // Løvet i klaser: en mørk og en lys tone.
        tips.forEach(([x, y], i) => {
          c.fillStyle = shade(pal.birch, i % 2 ? -0.15 : 0.08);
          const b = K ? K.blob(x * 0.8, y, L * (0.09 + r() * 0.04), L * (0.07 + r() * 0.03), [[r() * TAU, 0.6, 0.25]]) : null;
          if (b) c.fill(b);
        });
        c.fillStyle = shade(pal.birch, 0.02);
        if (K) c.fill(K.blob(0, -L * 0.88, L * 0.12, L * 0.1));
      }
      const trunk = K ? K.tube([[0, 0], [L * 0.005, -L * 0.5], [0, -L * 0.93]], [L * 0.028, L * 0.022, L * 0.012]) : null;
      if (trunk) {
        c.fillStyle = '#f2efe6';
        c.fill(trunk);
        c.save();
        c.clip(trunk);
        c.fillStyle = '#2a2622';
        for (let i = 0; i < 12; i++) c.fillRect(-L * 0.03 + r() * L * 0.03, -L * r() * 0.9, L * (0.012 + r() * 0.02), L * 0.007);
        c.restore();
      }
      if (season === 'vinter') {
        c.fillStyle = '#f6f9fc';
        for (const [x, y] of tips) {
          c.beginPath();
          c.ellipse(x * 0.7, y + L * 0.025, L * 0.035, L * 0.009, 0.2, 0, TAU);
          c.fill();
        }
      }
    });
  }

  /** En rekke med grantopper langt borte: flat silhuett med blekkant langs toppen. */
  function treeLine(w, h, color, seed) {
    return sprite(`treeline-${color}-${seed}`, w, h, (c, W, H) => {
      const r = seeded(seed);
      const p = new Path2D();
      p.moveTo(0, H + 2);
      let x = 0;
      p.lineTo(0, H * 0.8);
      while (x < W) {
        const th = H * (0.45 + r() * 0.5);
        const tw = th * 0.32;
        p.lineTo(x, H - th * 0.15);
        p.lineTo(x + tw * 0.5, H - th);
        p.lineTo(x + tw, H - th * 0.15);
        x += tw * (0.55 + r() * 0.3);
      }
      p.lineTo(W, H + 2);
      p.closePath();
      c.fillStyle = color;
      c.fill(p);
      c.strokeStyle = '#2b2219';
      c.lineWidth = 1.5;
      c.lineJoin = 'round';
      c.stroke(p);
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
      const K = window.PaizonPapir;
      const water = new Path2D();
      water.ellipse(0, 0, L * 0.5, L * 0.1, 0, 0, TAU);
      if (K) K.paperPath(ctx, water, frozen ? '#c9dce8' : '#4f7f8f', { sx: 1.5, sy: 2 });
      if (!frozen) {
        ctx.save();
        ctx.clip(water);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 3; i++) {
          const rr = (t * 0.3 + i / 3) % 1;
          ctx.globalAlpha = 1 - rr;
          ctx.beginPath();
          ctx.ellipse(L * 0.15, L * 0.02, L * 0.2 * rr, L * 0.04 * rr, 0, 0, TAU);
          ctx.stroke();
        }
        ctx.restore();
        for (const [x, y] of [[-0.25, 0.02], [0.05, -0.03], [0.3, 0.03]]) {
          const pad = new Path2D();
          pad.ellipse(L * x, L * y, L * 0.06, L * 0.02, 0, 0.35, TAU);
          pad.lineTo(L * x, L * y);
          pad.closePath();
          if (K) K.paperPath(ctx, pad, '#5f8e34', { shadow: false, lw: 1.2 });
        }
      }
      // Siv langs kanten.
      for (let i = 0; i < 9; i++) {
        const x = -L * 0.5 + (i < 5 ? i * L * 0.03 : L * 0.88 + (i - 5) * L * 0.03);
        const pts = [[x, L * 0.02], [x + Math.sin(t + i) * L * 0.02, -L * 0.13], [x + Math.sin(t * 0.8 + i) * L * 0.04, -L * (0.25 + (i % 3) * 0.05)]];
        if (K) K.inkLine(ctx, pts, frozen ? '#a8946a' : '#6a7a32', Math.max(1.5, L * 0.008));
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
