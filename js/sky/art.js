/*
 * Himmelen – tegninger av skyer, vær og ting i lufta, pluss husene i byen.
 * Skyer lages av mange runde «dotter» med lys ovenfra og grå underside, og tegnes én gang
 * per sky (sprite), så de kan være store uten å koste mye.
 */
(function () {
  'use strict';

  const X = window.PaizonExplore;
  const { TAU, lin, rad, shade, sprite, seeded } = X;
  const ART = {};

  /** Bomullssky. L = bredde. tone 0 (hvit) – 1 (mørk regnsky). Origo midt på bunnen. */
  function cloud(L, seed, tone, night) {
    const h = L * 0.6;
    return sprite(`cloud-${seed}-${Math.round(tone * 10)}-${night ? 1 : 0}`, L, h, (c, W, H) => {
      const r = seeded(seed);
      const puffs = [];
      for (let i = 0; i < 16; i++) {
        const u = r();
        const x = W * (0.12 + u * 0.76);
        const top = Math.sin(u * Math.PI);
        const rr = W * (0.08 + 0.1 * top * (0.6 + r() * 0.6));
        puffs.push([x, H * 0.9 - rr * (0.5 + top * 0.9), rr]);
      }
      const light = night ? '#8a96b8' : X.mixHex('#ffffff', '#8a909c', tone * 0.6);
      const dark = night ? '#3a4466' : X.mixHex('#c8d0dc', '#5a6270', tone * 0.7);
      // Skygge først, så lyse dotter oppå: gir volum.
      for (const [x, y, rr] of puffs) {
        c.fillStyle = dark;
        c.beginPath();
        c.arc(x + rr * 0.1, y + rr * 0.15, rr, 0, TAU);
        c.fill();
      }
      for (const [x, y, rr] of puffs) {
        c.fillStyle = rad(c, x - rr * 0.3, y - rr * 0.4, rr * 0.1, rr * 1.05, [[0, light], [0.7, shade(light, -0.05)], [1, dark]]);
        c.beginPath();
        c.arc(x, y, rr, 0, TAU);
        c.fill();
      }
      // Flat, grå underside.
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = lin(c, 0, H * 0.55, 0, H, [[0, 'rgba(0,0,0,0)'], [1, night ? 'rgba(10,14,30,0.4)' : `rgba(90,100,120,${0.25 + tone * 0.35})`]]);
      c.fillRect(0, 0, W, H);
    });
  }
  ART.cumulus = (ctx, L, t, o = {}) => {
    const img = cloud(Math.round(L / 8) * 8, o.seed || 3, o.tone || 0, o.night);
    ctx.drawImage(img, -img.width / 2, -img.height);
  };
  /** Tordensky: høy tårnsky med flat ambolt-topp, mørk underside, regn og lyn. */
  ART.storm = (ctx, L, t, o = {}) => {
    const img = sprite(`storm-${Math.round(L / 8)}-${o.night ? 1 : 0}`, L * 1.3, L * 1.4, (c, W, H) => {
      const r = seeded(17);
      const puffs = [];
      for (let i = 0; i < 40; i++) {
        const v = r();
        const y = H * (0.95 - v * 0.75);
        const spread = W * (0.18 + 0.12 * Math.sin(v * Math.PI));
        puffs.push([W / 2 + (r() - 0.5) * spread * 2, y, W * (0.06 + r() * 0.08)]);
      }
      // Amboltet øverst.
      for (let i = 0; i < 14; i++) puffs.push([W * (0.1 + r() * 0.8), H * (0.12 + r() * 0.08), W * (0.05 + r() * 0.05)]);
      for (const [x, y, rr] of puffs) {
        c.fillStyle = rad(c, x - rr * 0.3, y - rr * 0.4, rr * 0.1, rr, [[0, o.night ? '#7a84a4' : '#f2f2f4'], [1, o.night ? '#2a304a' : '#7a8296']]);
        c.beginPath();
        c.arc(x, y, rr, 0, TAU);
        c.fill();
      }
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = lin(c, 0, H * 0.4, 0, H, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(30,34,50,0.7)']]);
      c.fillRect(0, 0, W, H);
    });
    ctx.drawImage(img, -img.width / 2, -img.height);
    // Regn under skyen.
    ctx.strokeStyle = 'rgba(160,175,200,0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const x = (((i * 37) % 100) / 100 - 0.5) * L * 0.6;
      const y = (((i * 53 + t * 900) % 100) / 100) * L * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 12);
      ctx.stroke();
    }
    // Lyn av og til.
    const flash = (Math.sin(t * 0.9) > 0.985) || (Math.sin(t * 1.37 + 2) > 0.99);
    if (flash) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,255,230,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      let x = 0;
      let y = -L * 0.1;
      ctx.moveTo(x, y);
      const rr = seeded(Math.floor(t * 3));
      while (y < L * 0.9) {
        x += (rr() - 0.5) * L * 0.12;
        y += L * 0.08;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,240,0.15)';
      ctx.fillRect(-L, -L * 1.4, L * 2, L * 2.4);
      ctx.restore();
    }
  };
  /** Fjærsky: tynne, buede striper av is høyt oppe. */
  ART.cirrus = (ctx, L, t, o = {}) => {
    ctx.save();
    ctx.strokeStyle = o.night ? 'rgba(150,160,200,0.35)' : 'rgba(255,255,255,0.7)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      ctx.lineWidth = 2 + (i % 3) * 2;
      ctx.beginPath();
      const y = -L * 0.05 * i;
      ctx.moveTo(-L * 0.5 + i * L * 0.03, y);
      ctx.quadraticCurveTo(0, y - L * 0.12, L * 0.5 - i * L * 0.02, y - L * 0.02 + Math.sin(i) * L * 0.03);
      ctx.stroke();
    }
    ctx.restore();
  };
  /** Regnbue. L = radius. Origo i sentrum (under bakken). */
  ART.rainbow = (ctx, L) => {
    ctx.save();
    ctx.globalAlpha = 0.55;
    const cols = ['#e8473a', '#f39a32', '#f6d84a', '#5ec46a', '#4a8ae0', '#7a52c8'];
    cols.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = L * 0.035;
      ctx.beginPath();
      ctx.arc(0, 0, L * (1 - i * 0.035), Math.PI, TAU);
      ctx.stroke();
    });
    ctx.restore();
  };
  /** Luftballong. L = høyde. Origo midt på ballongen. */
  ART.balloon = (ctx, L, t) => {
    const sway = Math.sin(t * 0.6) * 0.03;
    ctx.save();
    ctx.rotate(sway);
    const stripes = ['#e84a3a', '#f6c83a', '#3a8ae0', '#f6f2e8', '#5ab85a', '#e84a3a'];
    const r = L * 0.38;
    for (let i = 0; i < stripes.length; i++) {
      ctx.fillStyle = stripes[i];
      ctx.beginPath();
      const a0 = -Math.PI / 2 - Math.PI / 2 + (i / stripes.length) * Math.PI;
      const a1 = a0 + Math.PI / stripes.length;
      ctx.moveTo(0, r * 1.3);
      ctx.bezierCurveTo(Math.cos(a0) * r * 1.4, r * 0.4, Math.cos(a0) * r * 1.2, -r * 1.1, 0, -r);
      ctx.bezierCurveTo(Math.cos(a1) * r * 1.2, -r * 1.1, Math.cos(a1) * r * 1.4, r * 0.4, 0, r * 1.3);
      ctx.fill();
    }
    ctx.fillStyle = lin(ctx, -r, 0, r, 0, [[0, 'rgba(0,0,0,0.25)'], [0.4, 'rgba(255,255,255,0.15)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.05, r * 1.02, r * 1.1, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-r * 0.25, r * 1.2);
    ctx.lineTo(-r * 0.15, r * 1.55);
    ctx.moveTo(r * 0.25, r * 1.2);
    ctx.lineTo(r * 0.15, r * 1.55);
    ctx.stroke();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-r * 0.18, r * 1.55, r * 0.36, r * 0.22);
    // Flamme av og til.
    if (Math.sin(t * 2) > 0.6) {
      ctx.fillStyle = 'rgba(255,190,80,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, r * 1.38, r * 0.05, r * 0.1, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };
  /** Drage med hale. Origo i dragen. */
  ART.kite = (ctx, L, t) => {
    const s = Math.sin(t * 2) * 0.12;
    ctx.save();
    ctx.rotate(0.3 + s);
    ctx.fillStyle = '#e84a6a';
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.4);
    ctx.lineTo(L * 0.25, 0);
    ctx.lineTo(0, L * 0.5);
    ctx.lineTo(-L * 0.25, 0);
    ctx.fill();
    ctx.fillStyle = '#f6c83a';
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.4);
    ctx.lineTo(L * 0.25, 0);
    ctx.lineTo(0, 0);
    ctx.moveTo(0, L * 0.5);
    ctx.lineTo(-L * 0.25, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, L * 0.5);
    for (let i = 1; i <= 12; i++) ctx.lineTo(Math.sin(t * 4 + i * 0.8) * L * 0.08, L * 0.5 + i * L * 0.08);
    ctx.stroke();
    for (let i = 3; i <= 12; i += 3) {
      ctx.fillStyle = i % 2 ? '#3a8ae0' : '#f6c83a';
      ctx.beginPath();
      ctx.ellipse(Math.sin(t * 4 + i * 0.8) * L * 0.08, L * 0.5 + i * L * 0.08, L * 0.05, L * 0.02, 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  };
  /** Passasjerfly sett fra siden. L = lengde. Vendt mot høyre. */
  ART.plane = (ctx, L, t, o = {}) => {
    ctx.fillStyle = lin(ctx, 0, -L * 0.06, 0, L * 0.06, [[0, '#ffffff'], [1, '#b8c0cc']]);
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.48, -L * 0.055, L * 0.35, -L * 0.055);
    ctx.lineTo(-L * 0.38, -L * 0.05);
    ctx.lineTo(-L * 0.5, -L * 0.2);
    ctx.lineTo(-L * 0.42, -L * 0.2);
    ctx.lineTo(-L * 0.3, -L * 0.05);
    ctx.lineTo(-L * 0.45, L * 0.03);
    ctx.lineTo(L * 0.35, L * 0.05);
    ctx.quadraticCurveTo(L * 0.48, L * 0.04, L * 0.5, 0);
    ctx.fill();
    ctx.fillStyle = '#3a6ac8';
    ctx.fillRect(-L * 0.38, -L * 0.012, L * 0.8, L * 0.012);
    ctx.fillStyle = '#9aa4b2';
    ctx.beginPath();
    ctx.moveTo(L * 0.05, L * 0.02);
    ctx.lineTo(-L * 0.12, L * 0.16);
    ctx.lineTo(-L * 0.05, L * 0.16);
    ctx.lineTo(L * 0.15, L * 0.02);
    ctx.fill();
    ctx.fillStyle = '#7a8492';
    ctx.beginPath();
    ctx.ellipse(-L * 0.02, L * 0.08, L * 0.06, L * 0.025, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#2a3a5a';
    for (let i = 0; i < 12; i++) ctx.fillRect(L * (0.3 - i * 0.05), -L * 0.03, L * 0.015, L * 0.015);
    if (o.night) {
      const blink = Math.sin(t * 6) > 0.7;
      ctx.fillStyle = blink ? '#ff4040' : '#601010';
      ctx.beginPath();
      ctx.arc(-L * 0.47, -L * 0.2, 3, 0, TAU);
      ctx.fill();
    }
  };
  /** Kondensstripe bak flyet (tegnes før flyet). */
  ART.contrail = (ctx, L, len) => {
    const g = ctx.createLinearGradient(-L * 0.4, 0, -L * 0.4 - len, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.8)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-L * 0.4 - len, -L * 0.04, len, L * 0.05);
  };
  /** Nordlys: grønne gardiner som bølger. Tegnes over hele bredden w, med topp y0 og høyde h. */
  ART.aurora = (ctx, L, t, o = {}) => {
    const w = o.w || L * 2;
    const h = o.h || L * 0.6;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let band = 0; band < 3; band++) {
      for (let x = -w / 2; x < w / 2; x += 6) {
        const wave = Math.sin(x * 0.01 + t * 0.4 + band * 1.7) * h * 0.25 + Math.sin(x * 0.027 - t * 0.3) * h * 0.1;
        const a = (0.1 + 0.08 * Math.sin(x * 0.03 + t * 1.3 + band)) * (0.6 + band * 0.2);
        const g = ctx.createLinearGradient(0, wave - h * 0.4, 0, wave + h * 0.5);
        g.addColorStop(0, 'rgba(180,90,220,0)');
        g.addColorStop(0.35, `rgba(150,110,230,${a * 0.4})`);
        g.addColorStop(0.75, `rgba(80,255,150,${a})`);
        g.addColorStop(1, 'rgba(80,255,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, wave - h * 0.4 + band * h * 0.1, 6, h * 0.9);
      }
    }
    ctx.restore();
  };
  ART.meteor = (ctx, L) => {
    const g = ctx.createLinearGradient(0, 0, -L, -L * 0.4);
    g.addColorStop(0, 'rgba(255,255,240,1)');
    g.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.strokeStyle = g;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L, -L * 0.4);
    ctx.stroke();
    ctx.fillStyle = '#fffbe6';
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, TAU);
    ctx.fill();
  };

  /** Hus med saltak. Origo ved foten. variant gir farge. */
  function house(L, variant, night) {
    return sprite(`house-${variant}-${night ? 1 : 0}`, L, L * 1.1, (c, W, H) => {
      const r = seeded(variant * 7 + 1);
      const wall = ['#c8402a', '#f2e6c8', '#e8c860', '#5a7a9a', '#f4f2ee'][variant % 5];
      const hW = W * 0.8;
      const hH = H * 0.45;
      const x0 = (W - hW) / 2;
      const y0 = H - hH;
      c.fillStyle = lin(c, x0, 0, x0 + hW, 0, [[0, shade(wall, 0.05)], [1, shade(wall, -0.25)]]);
      c.fillRect(x0, y0, hW, hH);
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      for (let x = x0 + 4; x < x0 + hW; x += 5) {
        c.beginPath();
        c.moveTo(x, y0);
        c.lineTo(x, H);
        c.stroke();
      }
      c.fillStyle = ['#3a3a3e', '#7a3a2a', '#2a4a3a'][variant % 3];
      c.beginPath();
      c.moveTo(x0 - W * 0.06, y0);
      c.lineTo(W / 2, y0 - H * 0.35);
      c.lineTo(x0 + hW + W * 0.06, y0);
      c.fill();
      c.fillStyle = '#5a4a40';
      c.fillRect(x0 + hW * 0.7, y0 - H * 0.3, W * 0.07, H * 0.18);
      for (let i = 0; i < 3; i++) {
        const lit = night && r() < 0.6;
        c.fillStyle = lit ? '#ffd880' : '#9ac0d8';
        c.fillRect(x0 + hW * (0.1 + i * 0.3), y0 + hH * 0.25, hW * 0.18, hH * 0.3);
        c.strokeStyle = '#f4f4f4';
        c.lineWidth = 1.5;
        c.strokeRect(x0 + hW * (0.1 + i * 0.3), y0 + hH * 0.25, hW * 0.18, hH * 0.3);
      }
      c.fillStyle = '#5a3a22';
      c.fillRect(x0 + hW * 0.42, y0 + hH * 0.55, hW * 0.14, hH * 0.45);
    });
  }

  /** Tegn et hus med foten på (x, yBase). L = bredden. */
  function drawHouse(ctx, x, yBase, L, variant, night) {
    const img = house(Math.max(12, Math.round(L / 4) * 4), variant, night);
    ctx.drawImage(img, x - img.width / 2, yBase - img.height);
  }

  window.PaizonSkyArt = { ART, cloud, house, drawHouse };
})();
