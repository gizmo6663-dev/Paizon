/*
 * Havet – tegninger. Alle dyr tegnes med origo i midten, vendt mot høyre (+x), med
 * lengde L i piksler. t er tid i sekunder (til halesving, tentakler osv.).
 * Stilen er «stemningsrealistisk»: myke fargeoverganger, mørk rygg og lys buk som hos
 * ekte fisk, og ingen tykke omriss.
 */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  function lin(ctx, x0, y0, x1, y1, stops) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function rad(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    return g;
  }

  function eye(ctx, x, y, r, iris) {
    ctx.fillStyle = iris || '#d8d2b0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0b0b10';
    ctx.beginPath();
    ctx.arc(x + r * 0.1, y, r * 0.62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
    ctx.fill();
  }

  // ---------- Fisk (felles mal) ----------
  /**
   * Generisk fisk. o: { h: høyde/lengde, top, side, belly, tail: 'fork'|'round'|'shark',
   * fins: fn(ctx, L, H) for ekstra finner, pattern: fn(ctx, L, H, t), eye: radius-faktor }
   */
  function fish(ctx, L, t, o) {
    const H = L * o.h;
    const sp = o.speed || 8;
    const tx = -L * 0.34; // halerot
    // Kroppen bølger: lite ved hodet, mest mot halen (slik ekte fisk svømmer).
    const N = 18;
    const amp = H * 0.16;
    const wave = (u) => amp * (1 - u) * (1 - u) * Math.sin(t * sp - u * 3.2);
    const xAt = (u) => tx + u * (L * 0.5 - tx);
    const thick = (u) => H * (0.05 + 0.45 * Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.pow(u, 0.8) * 0.93 + 0.035)), 0.9));
    const body = new Path2D();
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const y = wave(u) - thick(u) * 1.04 - H * 0.02 * Math.sin(Math.PI * u);
      if (i) body.lineTo(xAt(u), y);
      else body.moveTo(xAt(u), y);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N;
      body.lineTo(xAt(u), wave(u) + thick(u) * 0.96);
    }
    body.closePath();

    // Halefinne: følger bølgen i kroppen, gjennomskinnelig med finnestråler.
    const slope = (wave(0.04) - wave(0)) / (L * 0.04 * 0.84);
    ctx.save();
    ctx.translate(tx, wave(0));
    ctx.rotate(Math.atan(slope) * 1.6 + Math.sin(t * sp - 0.6) * 0.12);
    const tail = new Path2D();
    if (o.tail === 'round') {
      tail.moveTo(2, -H * 0.08);
      tail.quadraticCurveTo(-L * 0.2, -H * 0.58, -L * 0.18, 0);
      tail.quadraticCurveTo(-L * 0.2, H * 0.58, 2, H * 0.08);
    } else {
      tail.moveTo(2, -H * 0.06);
      tail.quadraticCurveTo(-L * 0.08, -H * 0.2, -L * 0.19, -H * 0.64);
      tail.quadraticCurveTo(-L * 0.11, 0, -L * 0.19, H * 0.64);
      tail.quadraticCurveTo(-L * 0.08, H * 0.2, 2, H * 0.06);
    }
    tail.closePath();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = lin(ctx, 0, 0, -L * 0.2, 0, [[0, o.finColor || o.top], [1, o.finEdge || o.side]]);
    ctx.fill(tail);
    if (L > 40) {
      ctx.save();
      ctx.clip(tail);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = Math.max(0.6, L * 0.004);
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-L * 0.2, i * H * 0.15);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (o.fins) {
      ctx.save();
      ctx.globalAlpha = 0.92;
      o.fins(ctx, L, H, t);
      ctx.restore();
    }

    // Kropp med mørk rygg og lys buk.
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, o.top], [0.42, o.side], [0.62, o.side], [1, o.belly]]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    if (o.pattern) o.pattern(ctx, L, H, t);
    // Skjell: et svakt mønster av små buer (bare når fisken er stor nok til å se det).
    if (L > 60) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      const st = Math.max(3, H * 0.09);
      for (let y = -H * 0.45; y < H * 0.4; y += st) {
        for (let x = -L * 0.3 + ((y / st) % 2) * st * 0.5; x < L * 0.3; x += st) {
          ctx.beginPath();
          ctx.arc(x, y, st * 0.55, -0.6, 0.6);
          ctx.stroke();
        }
      }
    }
    // Volum: lys ovenfra, skygge under, og en glinsende stripe langs siden.
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, 'rgba(255,255,255,0.2)'], [0.38, 'rgba(255,255,255,0)'], [0.8, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.3)']]);
    ctx.fillRect(-L, -H, L * 2, H * 2);
    ctx.fillStyle = rad(ctx, L * 0.05, -H * 0.12, 0, L * 0.32, [[0, `rgba(255,255,255,${o.sheen || 0.22})`], [1, 'rgba(255,255,255,0)']]);
    ctx.save();
    ctx.scale(1, 0.25);
    ctx.beginPath();
    ctx.arc(L * 0.05, -H * 0.48, L * 0.32, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Sidelinja.
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(0.7, H * 0.025);
    ctx.beginPath();
    for (let i = 2; i <= 15; i++) {
      const u = i / N;
      const y = wave(u) - thick(u) * 0.25;
      if (i === 2) ctx.moveTo(xAt(u), y);
      else ctx.lineTo(xAt(u), y);
    }
    ctx.stroke();
    ctx.restore();
    // Gjellelokk.
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = Math.max(1, L * 0.012);
    ctx.beginPath();
    ctx.arc(L * 0.26, H * 0.02, H * 0.36, -1.1, 1.1);
    ctx.stroke();
    // Brystfinne som vifter.
    ctx.fillStyle = o.pecColor || 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.moveTo(L * 0.2, H * 0.12);
    ctx.quadraticCurveTo(L * 0.05, H * (0.28 + Math.sin(t * 5) * 0.08), L * 0.01, H * (0.32 + Math.sin(t * 5 - 0.5) * 0.06));
    ctx.quadraticCurveTo(L * 0.12, H * 0.2, L * 0.2, H * 0.12);
    ctx.fill();
    eye(ctx, L * 0.36, -H * 0.08, Math.max(1.5, H * (o.eye || 0.1)), o.iris);
  }

  const SPECIES_ART = {};

  SPECIES_ART.cod = (ctx, L, t) => fish(ctx, L, t, {
    h: 0.26, top: '#6b6640', side: '#9a9268', belly: '#e9e4cf', speed: 5, tail: 'round', finColor: 'rgba(107,102,64,0.9)',
    fins: (c, L2, H) => {
      c.fillStyle = 'rgba(95,90,58,0.95)';
      // Tre ryggfinner og to gattfinner – typisk for torsk.
      for (const [x0, x1] of [[0.22, 0.06], [0.03, -0.12], [-0.14, -0.28]]) {
        c.beginPath();
        c.moveTo(L2 * x0, -H * 0.36);
        c.quadraticCurveTo(L2 * (x0 + x1) / 2, -H * 0.72, L2 * x1, -H * 0.34);
        c.fill();
      }
      for (const [x0, x1] of [[0.0, -0.12], [-0.14, -0.28]]) {
        c.beginPath();
        c.moveTo(L2 * x0, H * 0.4);
        c.quadraticCurveTo(L2 * (x0 + x1) / 2, H * 0.66, L2 * x1, H * 0.34);
        c.fill();
      }
      // Skjeggtråd.
      c.strokeStyle = '#8d8560';
      c.lineWidth = Math.max(1, L2 * 0.01);
      c.beginPath();
      c.moveTo(L2 * 0.44, H * 0.16);
      c.quadraticCurveTo(L2 * 0.45, H * 0.36, L2 * 0.41, H * 0.42);
      c.stroke();
    },
    pattern: (c, L2, H) => {
      c.fillStyle = 'rgba(60,55,30,0.35)';
      for (let i = 0; i < 26; i++) {
        const x = -L2 * 0.3 + ((i * 37) % 60) / 60 * L2 * 0.72;
        const y = -H * 0.4 + ((i * 53) % 40) / 40 * H * 0.45;
        c.beginPath();
        c.arc(x, y, H * 0.035, 0, TAU);
        c.fill();
      }
      c.strokeStyle = 'rgba(240,235,210,0.7)';
      c.lineWidth = Math.max(1, H * 0.03);
      c.beginPath();
      c.moveTo(L2 * 0.3, -H * 0.12);
      c.quadraticCurveTo(0, -H * 0.2, -L2 * 0.33, 0);
      c.stroke();
    },
  });

  SPECIES_ART.mackerel = (ctx, L, t) => fish(ctx, L, t, {
    h: 0.2, top: '#1f6b6a', side: '#5aa8a0', belly: '#f3f6f6', speed: 11, tail: 'fork', finColor: 'rgba(40,90,90,0.9)',
    pattern: (c, L2, H) => {
      c.strokeStyle = 'rgba(10,30,35,0.75)';
      c.lineWidth = Math.max(1, H * 0.06);
      for (let i = 0; i < 9; i++) {
        const x = L2 * 0.25 - i * L2 * 0.065;
        c.beginPath();
        c.moveTo(x, -H * 0.5);
        c.bezierCurveTo(x - L2 * 0.03, -H * 0.38, x + L2 * 0.02, -H * 0.24, x - L2 * 0.02, -H * 0.06);
        c.stroke();
      }
    },
  });

  SPECIES_ART.herring = (ctx, L, t) => fish(ctx, L, t, {
    h: 0.22, top: '#2f4f73', side: '#a9bccc', belly: '#f4f7fa', speed: 12, tail: 'fork', finColor: 'rgba(120,140,160,0.8)',
  });

  SPECIES_ART.wrasse = (ctx, L, t) => fish(ctx, L, t, {
    h: 0.34, top: '#7b4a1e', side: '#c8762e', belly: '#e9c27a', speed: 6, tail: 'round', finColor: 'rgba(170,90,40,0.9)', eye: 0.11, iris: '#e3b049',
    fins: (c, L2, H) => {
      c.fillStyle = 'rgba(150,80,35,0.9)';
      c.beginPath();
      c.moveTo(L2 * 0.28, -H * 0.38);
      for (let i = 0; i <= 10; i++) c.lineTo(L2 * (0.28 - i * 0.058), -H * (0.5 + (i % 2) * 0.1));
      c.lineTo(-L2 * 0.3, -H * 0.2);
      c.fill();
    },
    pattern: (c, L2, H) => {
      c.fillStyle = 'rgba(255,240,200,0.45)';
      for (let i = 0; i < 40; i++) {
        c.beginPath();
        c.arc(-L2 * 0.3 + ((i * 29) % 70) / 70 * L2 * 0.7, -H * 0.4 + ((i * 41) % 50) / 50 * H * 0.8, H * 0.03, 0, TAU);
        c.fill();
      }
      // Tykke lepper.
      c.fillStyle = '#e7a35c';
      c.beginPath();
      c.ellipse(L2 * 0.48, H * 0.03, L2 * 0.035, H * 0.09, 0, 0, TAU);
      c.fill();
    },
  });

  SPECIES_ART.lanternfish = (ctx, L, t) => fish(ctx, L, t, {
    h: 0.22, top: '#1c1f2b', side: '#3b4256', belly: '#5d6478', speed: 9, tail: 'fork', eye: 0.17, iris: '#9fb4c8',
  });

  /** Lyset til lysprikkfisken (tegnes i lyslaget over mørket). */
  function lanternGlow(ctx, L, t) {
    const H = L * 0.22;
    for (let i = 0; i < 7; i++) {
      const x = L * 0.3 - i * L * 0.09;
      const a = 0.6 + 0.4 * Math.sin(t * 3 + i);
      ctx.fillStyle = rad(ctx, x, H * 0.32, 0, H * 0.5, [[0, `rgba(140,220,255,${a})`], [1, 'rgba(140,220,255,0)']]);
      ctx.beginPath();
      ctx.arc(x, H * 0.32, H * 0.5, 0, TAU);
      ctx.fill();
    }
  }

  SPECIES_ART.chimaera = (ctx, L, t) => {
    const H = L * 0.22;
    const sway = Math.sin(t * 3) * 0.25;
    // Lang, tynn hale.
    ctx.strokeStyle = '#a99a8c';
    ctx.lineWidth = H * 0.12;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-L * 0.15, 0);
    ctx.quadraticCurveTo(-L * 0.35, Math.sin(t * 3) * H * 0.4, -L * 0.55, Math.sin(t * 3 + 1) * H * 0.5);
    ctx.stroke();
    // Store brystfinner som vinger.
    ctx.fillStyle = 'rgba(150,135,125,0.85)';
    ctx.beginPath();
    ctx.moveTo(L * 0.18, H * 0.1);
    ctx.quadraticCurveTo(L * 0.02, H * (0.9 + sway), -L * 0.16, H * 0.55);
    ctx.quadraticCurveTo(-L * 0.02, H * 0.3, L * 0.18, H * 0.1);
    ctx.fill();
    // Kropp.
    ctx.fillStyle = lin(ctx, 0, -H * 0.6, 0, H * 0.5, [[0, '#7a6a61'], [0.5, '#bba99a'], [1, '#e2d8cd']]);
    ctx.beginPath();
    ctx.moveTo(L * 0.42, 0);
    ctx.bezierCurveTo(L * 0.4, -H * 0.62, L * 0.05, -H * 0.62, -L * 0.18, -H * 0.12);
    ctx.lineTo(-L * 0.18, H * 0.1);
    ctx.bezierCurveTo(L * 0.05, H * 0.5, L * 0.38, H * 0.45, L * 0.42, 0);
    ctx.fill();
    // Giftpigg på ryggen.
    ctx.fillStyle = '#5e5049';
    ctx.beginPath();
    ctx.moveTo(L * 0.14, -H * 0.5);
    ctx.lineTo(L * 0.1, -H * 1.05);
    ctx.lineTo(L * 0.04, -H * 0.48);
    ctx.fill();
    // Store, grønne øyne.
    eye(ctx, L * 0.3, -H * 0.12, H * 0.2, '#3fbf6a');
  };

  SPECIES_ART.shark = (ctx, L, t) => {
    const H = L * 0.17;
    const sway = Math.sin(t * 1.6) * 0.12;
    ctx.save();
    ctx.translate(-L * 0.36, 0);
    ctx.rotate(sway);
    ctx.fillStyle = '#4f4b45';
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.12);
    ctx.lineTo(-L * 0.16, -H * 0.85);
    ctx.quadraticCurveTo(-L * 0.12, 0, -L * 0.12, H * 0.45);
    ctx.lineTo(0, H * 0.12);
    ctx.fill();
    ctx.restore();
    const body = new Path2D();
    body.moveTo(L * 0.5, H * 0.05);
    body.bezierCurveTo(L * 0.45, -H * 0.55, L * 0.1, -H * 0.6, -L * 0.2, -H * 0.38);
    body.lineTo(-L * 0.37, -H * 0.12);
    body.lineTo(-L * 0.37, H * 0.12);
    body.bezierCurveTo(-L * 0.1, H * 0.55, L * 0.35, H * 0.5, L * 0.5, H * 0.05);
    ctx.fillStyle = lin(ctx, 0, -H * 0.6, 0, H * 0.5, [[0, '#3e3a35'], [0.55, '#6c675f'], [1, '#9a958b']]);
    ctx.fill(body);
    // Små ryggfinner og brystfinne.
    ctx.fillStyle = '#4a463f';
    ctx.beginPath();
    ctx.moveTo(L * 0.05, -H * 0.55);
    ctx.lineTo(-L * 0.02, -H * 0.9);
    ctx.lineTo(-L * 0.08, -H * 0.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(L * 0.25, H * 0.3);
    ctx.quadraticCurveTo(L * 0.12, H * 0.95, L * 0.06, H * 0.8);
    ctx.lineTo(L * 0.15, H * 0.3);
    ctx.fill();
    // Gjellespalter.
    ctx.strokeStyle = 'rgba(30,28,25,0.6)';
    ctx.lineWidth = Math.max(1, L * 0.006);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(L * (0.3 - i * 0.025), -H * 0.15);
      ctx.lineTo(L * (0.29 - i * 0.025), H * 0.2);
      ctx.stroke();
    }
    eye(ctx, L * 0.42, -H * 0.12, H * 0.06, '#7fa3a0');
  };

  SPECIES_ART.angler = (ctx, L, t) => {
    const R = L * 0.38;
    // Hale.
    ctx.fillStyle = '#231c1c';
    ctx.beginPath();
    ctx.moveTo(-R * 0.8, 0);
    ctx.lineTo(-R * 1.45, -R * 0.45 + Math.sin(t * 4) * R * 0.1);
    ctx.lineTo(-R * 1.45, R * 0.45 + Math.sin(t * 4) * R * 0.1);
    ctx.fill();
    // Rund, mørk kropp.
    ctx.fillStyle = rad(ctx, -R * 0.2, -R * 0.3, R * 0.1, R * 1.1, [[0, '#4a3a38'], [1, '#140f10']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * 0.85, 0, 0, TAU);
    ctx.fill();
    // Stor munn med tenner.
    ctx.fillStyle = '#080506';
    ctx.beginPath();
    ctx.moveTo(R * 0.95, -R * 0.05);
    ctx.quadraticCurveTo(R * 0.4, R * 0.55, R * 0.05, R * 0.35);
    ctx.quadraticCurveTo(R * 0.5, R * 0.15, R * 0.95, -R * 0.05);
    ctx.fill();
    ctx.fillStyle = '#e9e2d4';
    for (let i = 0; i < 7; i++) {
      const x = R * (0.9 - i * 0.12);
      const y = R * (0.0 + i * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - R * 0.03, y + R * 0.16);
      ctx.lineTo(x - R * 0.07, y);
      ctx.fill();
    }
    // Fiskestanga med lykt.
    ctx.strokeStyle = '#3a2d2c';
    ctx.lineWidth = Math.max(1, R * 0.06);
    ctx.beginPath();
    ctx.moveTo(R * 0.3, -R * 0.75);
    ctx.quadraticCurveTo(R * 0.8, -R * 1.6, R * 1.25, -R * 1.05);
    ctx.stroke();
    eye(ctx, R * 0.45, -R * 0.35, R * 0.08, '#6a5f5a');
  };

  function anglerGlow(ctx, L, t) {
    const R = L * 0.38;
    const a = 0.75 + 0.25 * Math.sin(t * 2.4);
    ctx.fillStyle = rad(ctx, R * 1.25, -R * 1.05, 0, R * 0.9, [[0, `rgba(200,255,240,${a})`], [0.2, `rgba(120,240,220,${a * 0.6})`], [1, 'rgba(120,240,220,0)']]);
    ctx.beginPath();
    ctx.arc(R * 1.25, -R * 1.05, R * 0.9, 0, TAU);
    ctx.fill();
  }

  // ---------- Sjøpattedyr ----------
  /** Felles strømlinjeformet kropp for sel, nise, spekkhogger og knølhval. */
  function mammalBody(L, H) {
    const p = new Path2D();
    p.moveTo(L * 0.5, H * 0.08);
    p.bezierCurveTo(L * 0.48, -H * 0.45, L * 0.2, -H * 0.55, -L * 0.05, -H * 0.48);
    p.bezierCurveTo(-L * 0.25, -H * 0.4, -L * 0.36, -H * 0.15, -L * 0.42, -H * 0.06);
    p.lineTo(-L * 0.42, H * 0.06);
    p.bezierCurveTo(-L * 0.3, H * 0.25, -L * 0.1, H * 0.5, L * 0.1, H * 0.5);
    p.bezierCurveTo(L * 0.32, H * 0.5, L * 0.48, H * 0.35, L * 0.5, H * 0.08);
    return p;
  }

  function flukes(ctx, L, H, t, color, speed) {
    ctx.save();
    ctx.translate(-L * 0.41, 0);
    ctx.rotate(Math.sin(t * speed) * 0.25);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.05);
    ctx.quadraticCurveTo(-L * 0.06, -H * 0.2, -L * 0.1, -H * 0.55);
    ctx.quadraticCurveTo(-L * 0.06, -H * 0.08, -L * 0.075, 0);
    ctx.quadraticCurveTo(-L * 0.06, H * 0.08, -L * 0.1, H * 0.55);
    ctx.quadraticCurveTo(-L * 0.06, H * 0.2, 0, H * 0.05);
    ctx.fill();
    ctx.restore();
  }

  SPECIES_ART.seal = (ctx, L, t) => {
    const H = L * 0.26;
    // Bakluffer.
    ctx.save();
    ctx.translate(-L * 0.4, 0);
    ctx.rotate(Math.sin(t * 4) * 0.3);
    ctx.fillStyle = '#5d5a55';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L * 0.14, -H * 0.4);
    ctx.lineTo(-L * 0.12, 0);
    ctx.lineTo(-L * 0.14, H * 0.4);
    ctx.fill();
    ctx.restore();
    const body = mammalBody(L, H);
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, '#615d57'], [0.55, '#8e8a83'], [1, '#c2bdb3']]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = 'rgba(40,38,35,0.4)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.ellipse(-L * 0.38 + ((i * 31) % 80) / 80 * L * 0.85, -H * 0.45 + ((i * 47) % 60) / 60 * H * 0.75, H * 0.05, H * 0.035, i, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Forluffe.
    ctx.fillStyle = '#56524c';
    ctx.beginPath();
    ctx.ellipse(L * 0.18, H * 0.38, L * 0.07, H * 0.12, 0.6 + Math.sin(t * 3) * 0.2, 0, TAU);
    ctx.fill();
    // Nese, værhår og øye.
    ctx.fillStyle = '#2b2926';
    ctx.beginPath();
    ctx.arc(L * 0.49, H * 0.02, H * 0.06, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,225,215,0.7)';
    ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(L * 0.46, H * 0.08);
      ctx.lineTo(L * 0.58, H * (0.06 + i * 0.1));
      ctx.stroke();
    }
    eye(ctx, L * 0.4, -H * 0.15, H * 0.1, '#1a1715');
  };

  SPECIES_ART.porpoise = (ctx, L, t) => {
    const H = L * 0.22;
    flukes(ctx, L, H, t, '#3c4249', 4);
    const body = mammalBody(L, H);
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, '#30363d'], [0.5, '#5d6670'], [0.75, '#c9cdd0'], [1, '#eef0f1']]);
    ctx.fill(body);
    // Liten, trekantet ryggfinne.
    ctx.fillStyle = '#30363d';
    ctx.beginPath();
    ctx.moveTo(L * 0.05, -H * 0.45);
    ctx.lineTo(-L * 0.04, -H * 0.85);
    ctx.lineTo(-L * 0.1, -H * 0.42);
    ctx.fill();
    ctx.fillStyle = '#3c4249';
    ctx.beginPath();
    ctx.ellipse(L * 0.22, H * 0.32, L * 0.06, H * 0.1, 0.6, 0, TAU);
    ctx.fill();
    eye(ctx, L * 0.38, -H * 0.05, H * 0.06, '#111');
  };

  SPECIES_ART.orca = (ctx, L, t) => {
    const H = L * 0.24;
    flukes(ctx, L, H, t, '#111316', 2.6);
    const body = mammalBody(L, H);
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, '#0b0c0e'], [0.7, '#1b1d21'], [1, '#2a2d31']]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    // Hvit buk, øyeflekk og grå «sal» – spekkhoggerens kjennetegn.
    ctx.fillStyle = '#f2f3f1';
    ctx.beginPath();
    ctx.moveTo(L * 0.45, H * 0.2);
    ctx.bezierCurveTo(L * 0.2, H * 0.55, -L * 0.05, H * 0.3, -L * 0.12, H * 0.5);
    ctx.lineTo(-L * 0.2, H * 0.6);
    ctx.lineTo(L * 0.5, H * 0.6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-L * 0.12, H * 0.22, L * 0.1, H * 0.12, -0.2, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(L * 0.3, -H * 0.12, L * 0.07, H * 0.08, -0.15, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,165,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.12, -H * 0.42, L * 0.09, H * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    // Høy ryggfinne.
    ctx.fillStyle = '#0d0e10';
    ctx.beginPath();
    ctx.moveTo(L * 0.05, -H * 0.45);
    ctx.quadraticCurveTo(L * 0.0, -H * 1.0, -L * 0.04, -H * 1.35);
    ctx.quadraticCurveTo(-L * 0.06, -H * 0.8, -L * 0.12, -H * 0.42);
    ctx.fill();
    // Brystluffe.
    ctx.fillStyle = '#0d0e10';
    ctx.beginPath();
    ctx.ellipse(L * 0.2, H * 0.42, L * 0.08, H * 0.16, 0.5 + Math.sin(t * 2) * 0.1, 0, TAU);
    ctx.fill();
    eye(ctx, L * 0.36, -H * 0.04, H * 0.04, '#222');
  };

  SPECIES_ART.humpback = (ctx, L, t) => {
    const H = L * 0.2;
    flukes(ctx, L, H, t, '#2a2e33', 1.4);
    const body = mammalBody(L, H);
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, '#24282c'], [0.6, '#3a3f45'], [0.85, '#6f747a'], [1, '#b8bcbf']]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    // Strupefurer.
    ctx.strokeStyle = 'rgba(220,225,228,0.45)';
    ctx.lineWidth = Math.max(1, H * 0.02);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(L * 0.46, H * (0.18 + i * 0.045));
      ctx.quadraticCurveTo(L * 0.25, H * (0.3 + i * 0.03), L * 0.02, H * (0.3 + i * 0.03));
      ctx.stroke();
    }
    // Knøler på hodet.
    ctx.fillStyle = 'rgba(15,17,20,0.6)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(L * (0.47 - i * 0.022), -H * (0.15 + (i % 3) * 0.08), H * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Lange, lyse luffer – knølhvalens kjennetegn (nesten en tredjedel av kroppen).
    ctx.save();
    ctx.translate(L * 0.2, H * 0.28);
    ctx.rotate(-0.5 + Math.sin(t * 1.2) * 0.12);
    ctx.fillStyle = lin(ctx, 0, 0, -L * 0.3, 0, [[0, '#cfd3d4'], [1, '#9ea4a7']]);
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.1);
    ctx.quadraticCurveTo(-L * 0.15, -H * 0.16, -L * 0.3, -H * 0.03);
    ctx.quadraticCurveTo(-L * 0.15, H * 0.13, 0, H * 0.1);
    ctx.fill();
    // Knøler langs forkanten av luffa.
    ctx.fillStyle = 'rgba(120,125,130,0.7)';
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(-L * 0.045 * i, -H * (0.12 - i * 0.012), H * 0.025, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Liten ryggfinne på en pukkel.
    ctx.fillStyle = '#24282c';
    ctx.beginPath();
    ctx.moveTo(-L * 0.12, -H * 0.42);
    ctx.lineTo(-L * 0.17, -H * 0.7);
    ctx.lineTo(-L * 0.23, -H * 0.34);
    ctx.fill();
    eye(ctx, L * 0.3, H * 0.08, H * 0.04, '#222');
  };

  // ---------- Maneter ----------
  SPECIES_ART.lionsmane = (ctx, L, t) => {
    // L = klokkas bredde. Lange tråder henger ned (tegnes rotert så «opp» er opp).
    const R = L / 2;
    const pulse = 1 + Math.sin(t * 2.2) * 0.06;
    ctx.save();
    ctx.rotate(-Math.PI / 2); // maneter driver oppover, ikke mot høyre
    ctx.strokeStyle = 'rgba(230,140,90,0.45)';
    ctx.lineWidth = Math.max(1, R * 0.03);
    for (let i = 0; i < 26; i++) {
      const x0 = -R * 0.9 + (i / 25) * R * 1.8;
      ctx.beginPath();
      ctx.moveTo(-R * 0.1, x0 * 0.85);
      for (let k = 1; k <= 6; k++) {
        const s = k / 6;
        ctx.lineTo(-R * 0.1 - s * L * 3.2, x0 * (0.85 - s * 0.3) + Math.sin(t * 1.5 + i + s * 4) * R * 0.25 * s);
      }
      ctx.stroke();
    }
    // Munnarmer.
    ctx.fillStyle = 'rgba(200,80,60,0.6)';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(-R * 0.8, i * R * 0.25 + Math.sin(t + i) * R * 0.08, R * 0.75, R * 0.18, 0, 0, TAU);
      ctx.fill();
    }
    // Klokke.
    ctx.scale(1, pulse);
    ctx.fillStyle = rad(ctx, R * 0.2, 0, R * 0.1, R * 1.1, [[0, 'rgba(255,190,120,0.95)'], [0.6, 'rgba(205,85,45,0.9)'], [1, 'rgba(140,45,30,0.85)']]);
    ctx.beginPath();
    ctx.moveTo(-R * 0.15, -R);
    ctx.quadraticCurveTo(R * 0.7, -R * 0.95, R * 0.7, 0);
    ctx.quadraticCurveTo(R * 0.7, R * 0.95, -R * 0.15, R);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-R * (0.15 + (i % 2) * 0.12), R - i * R * 0.25);
    ctx.fill();
    ctx.restore();
  };

  SPECIES_ART.moonjelly = (ctx, L, t) => {
    const R = L / 2;
    const pulse = 1 + Math.sin(t * 2) * 0.08;
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    // Korte frynser.
    ctx.strokeStyle = 'rgba(220,235,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const y = -R + (i / 17) * R * 2;
      ctx.beginPath();
      ctx.moveTo(-R * 0.05, y);
      ctx.quadraticCurveTo(-R * 0.3, y + Math.sin(t * 2 + i) * R * 0.1, -R * 0.5, y * 0.9);
      ctx.stroke();
    }
    ctx.scale(1, pulse);
    ctx.fillStyle = rad(ctx, R * 0.2, 0, R * 0.1, R, [[0, 'rgba(235,245,255,0.55)'], [1, 'rgba(180,210,240,0.25)']]);
    ctx.beginPath();
    ctx.moveTo(0, -R);
    ctx.quadraticCurveTo(R * 0.75, -R * 0.9, R * 0.75, 0);
    ctx.quadraticCurveTo(R * 0.75, R * 0.9, 0, R);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(230,240,255,0.5)';
    ctx.stroke();
    // De fire ringene (kjønnskjertlene).
    ctx.strokeStyle = 'rgba(200,140,210,0.75)';
    ctx.lineWidth = Math.max(1.5, R * 0.08);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.6;
      ctx.beginPath();
      ctx.arc(R * 0.3 + Math.cos(a) * R * 0.12, Math.sin(a) * R * 0.35, R * 0.14, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  };

  SPECIES_ART.combjelly = (ctx, L, t) => {
    const R = L / 2;
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(210,230,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 0, R, R * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,240,255,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  /** Kammanetens regnbuerader – glitrer selv i mørket, så den tegnes i lyslaget. */
  function combGlow(ctx, L, t) {
    const R = L / 2;
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    for (let row = 0; row < 8; row++) {
      const yy = -R * 0.55 + (row / 7) * R * 1.1;
      const span = Math.sqrt(Math.max(0, 1 - (yy / (R * 0.62)) ** 2)) * R * 0.95;
      for (let k = 0; k < 9; k++) {
        const x = -span + (k / 8) * span * 2;
        const hue = (t * 120 + row * 40 + k * 25) % 360;
        ctx.fillStyle = `hsla(${hue}, 100%, 65%, 0.85)`;
        ctx.fillRect(x - 1.2, yy - 1.2, 2.4, 2.4);
      }
    }
    ctx.restore();
  }

  // ---------- Bunndyr ----------
  SPECIES_ART.crab = (ctx, L, t) => {
    const W = L / 2;
    const step = Math.sin(t * 8);
    // Bein.
    ctx.strokeStyle = '#8a4a2c';
    ctx.lineWidth = Math.max(1.5, L * 0.04);
    ctx.lineCap = 'round';
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 4; i++) {
        const bx = side * W * (0.35 + i * 0.12);
        const lift = (i % 2 ? step : -step) * L * 0.04;
        ctx.beginPath();
        ctx.moveTo(bx * 0.6, L * 0.05);
        ctx.lineTo(bx * 1.25, -L * 0.02 + lift);
        ctx.lineTo(bx * 1.45, L * 0.2);
        ctx.stroke();
      }
    }
    // Klør.
    for (let side = -1; side <= 1; side += 2) {
      ctx.fillStyle = '#9c5530';
      ctx.beginPath();
      ctx.ellipse(side * W * 0.95, -L * 0.18, L * 0.14, L * 0.09, side * 0.4, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1b1210';
      ctx.beginPath();
      ctx.ellipse(side * W * 1.12, -L * 0.24, L * 0.06, L * 0.035, side * 0.6, 0, TAU);
      ctx.fill();
    }
    // Skall med «paikant».
    ctx.fillStyle = rad(ctx, 0, -L * 0.15, L * 0.05, L * 0.55, [[0, '#d48a52'], [1, '#8b4a28']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.75, L * 0.25, 0, Math.PI, TAU);
    for (let i = 0; i <= 10; i++) ctx.lineTo(W * 0.75 - (i / 10) * W * 1.5, (i % 2) * L * 0.03);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(-L * 0.06, -L * 0.2, L * 0.025, 0, TAU);
    ctx.arc(L * 0.06, -L * 0.2, L * 0.025, 0, TAU);
    ctx.fill();
  };

  SPECIES_ART.lobster = (ctx, L, t) => {
    const H = L * 0.14;
    const wave = Math.sin(t * 2) * 0.1;
    // Antenner.
    ctx.strokeStyle = '#7a3b2a';
    ctx.lineWidth = 1.2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * 0.42, -H * 0.2);
      ctx.quadraticCurveTo(L * 0.7, -H * (1.5 + s * 0.5) + wave * H * 3, L * 0.9, -H * (0.5 + s * 1.2));
      ctx.stroke();
    }
    // Store klør foran.
    for (const s of [-1, 1]) {
      ctx.fillStyle = s < 0 ? '#1f3550' : '#24405f';
      ctx.beginPath();
      ctx.ellipse(L * 0.55, s * H * 0.9 + H * 0.2, L * 0.16, H * 0.55, s * 0.2, 0, TAU);
      ctx.fill();
    }
    // Hale og kropp i ledd.
    ctx.fillStyle = lin(ctx, 0, -H, 0, H, [[0, '#132338'], [0.5, '#2b4a6e'], [1, '#1a2e48']]);
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(-L * 0.05 - i * L * 0.075, 0, L * 0.045, H * (0.95 - i * 0.08), 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, 0);
    ctx.lineTo(-L * 0.55, -H * 0.8);
    ctx.lineTo(-L * 0.55, H * 0.8);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(L * 0.2, 0, L * 0.22, H, 0, 0, TAU);
    ctx.fill();
    // Bein.
    ctx.strokeStyle = '#2b4a6e';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(L * (0.25 - i * 0.07), H * 0.6);
      ctx.lineTo(L * (0.22 - i * 0.07), H * 1.6 + Math.sin(t * 5 + i) * 1.5);
      ctx.stroke();
    }
    eye(ctx, L * 0.4, -H * 0.4, H * 0.18, '#101010');
  };

  SPECIES_ART.starfish = (ctx, L, t) => {
    const R = L / 2;
    const bend = Math.sin(t * 0.8) * 0.05;
    ctx.fillStyle = rad(ctx, 0, 0, R * 0.1, R, [[0, '#f0a060'], [0.6, '#d9672e'], [1, '#a8461f']]);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU + bend;
      const r = i % 2 ? R * 0.32 : R;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.55);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,230,190,0.6)';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * k * 0.24, Math.sin(a) * R * k * 0.13, R * 0.04, 0, TAU);
        ctx.fill();
      }
    }
  };

  SPECIES_ART.urchin = (ctx, L, t) => {
    const R = L / 2;
    // Korte, tette pigger rundt den runde kroppen.
    ctx.strokeStyle = '#5f7334';
    ctx.lineWidth = Math.max(1.2, R * 0.07);
    ctx.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const a = Math.PI * 1.02 + (i / 45) * Math.PI * 0.96;
      const wob = Math.sin(t * 1.5 + i * 1.7) * 0.06;
      const len = R * (0.98 + ((i * 7) % 5) * 0.03);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.45);
      ctx.lineTo(Math.cos(a + wob) * len, Math.sin(a + wob) * len * 0.82);
      ctx.stroke();
    }
    ctx.fillStyle = rad(ctx, -R * 0.2, -R * 0.3, R * 0.1, R, [[0, '#9fb35a'], [1, '#55642b']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, R * 0.75, R * 0.6, 0, Math.PI, TAU);
    ctx.fill();
  };

  SPECIES_ART.gull = (ctx, L, t) => {
    const flap = Math.sin(t * 4); // 1 = vingene opp, -1 = ned
    const wing = (shade, dx) => {
      const tipY = -L * 0.42 * flap;
      ctx.fillStyle = shade;
      ctx.beginPath();
      ctx.moveTo(L * 0.1 + dx, -L * 0.02);
      ctx.quadraticCurveTo(L * 0.0 + dx, tipY * 0.55, -L * 0.18 + dx, tipY);
      ctx.lineTo(-L * 0.3 + dx, tipY * 0.92);
      ctx.quadraticCurveTo(-L * 0.12 + dx, tipY * 0.3, -L * 0.12 + dx, 0);
      ctx.fill();
      // Svarte vingespisser.
      ctx.fillStyle = '#26282b';
      ctx.beginPath();
      ctx.moveTo(-L * 0.18 + dx, tipY);
      ctx.lineTo(-L * 0.3 + dx, tipY * 0.92);
      ctx.lineTo(-L * 0.24 + dx, tipY * 0.75);
      ctx.fill();
    };
    wing('#9aa2aa', L * 0.06); // bakerste vinge
    ctx.fillStyle = '#f4f6f7';
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.4, L * 0.1, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(L * 0.34, -L * 0.04, L * 0.08, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2c14a';
    ctx.beginPath();
    ctx.moveTo(L * 0.4, -L * 0.04);
    ctx.lineTo(L * 0.54, -L * 0.02);
    ctx.lineTo(L * 0.4, 0);
    ctx.fill();
    wing('#bfc6cc', 0); // fremste vinge
    eye(ctx, L * 0.36, -L * 0.06, L * 0.02, '#111');
  };

  SPECIES_ART.giantsquid = (ctx, L, t) => {
    // Kappe til høyre, armer bakover mot venstre (den svømmer baklengs med kappa først).
    const H = L * 0.12;
    ctx.strokeStyle = '#b5513e';
    ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      ctx.lineWidth = Math.max(2, H * 0.22);
      ctx.beginPath();
      ctx.moveTo(-L * 0.02, (i - 3.5) * H * 0.12);
      for (let k = 1; k <= 8; k++) {
        const s = k / 8;
        ctx.lineTo(-L * 0.02 - s * L * 0.32, (i - 3.5) * H * (0.12 + s * 0.12) + Math.sin(t * 1.4 + i + s * 5) * H * 0.4 * s);
      }
      ctx.stroke();
    }
    // To lange fangarmer.
    ctx.lineWidth = Math.max(1.5, H * 0.1);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.02, s * H * 0.1);
      for (let k = 1; k <= 12; k++) {
        const u = k / 12;
        ctx.lineTo(-L * 0.02 - u * L * 0.52, s * H * (0.1 + u * 0.6) + Math.sin(t * 1.1 + u * 6 + s) * H * 0.6 * u);
      }
      ctx.stroke();
    }
    // Kappe med finner.
    ctx.fillStyle = lin(ctx, 0, -H, 0, H, [[0, '#a2402f'], [0.5, '#d07055'], [1, '#93392a']]);
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.quadraticCurveTo(L * 0.4, -H * 0.85, L * 0.05, -H * 0.6);
    ctx.lineTo(L * 0.05, H * 0.6);
    ctx.quadraticCurveTo(L * 0.4, H * 0.85, L * 0.5, 0);
    ctx.fill();
    ctx.fillStyle = '#b04a37';
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.lineTo(L * 0.4, -H * 1.0);
    ctx.lineTo(L * 0.34, 0);
    ctx.lineTo(L * 0.4, H * 1.0);
    ctx.fill();
    // Stort øye.
    eye(ctx, L * 0.04, -H * 0.1, H * 0.38, '#c9b98f');
  };

  // ---------- Ting ----------
  SPECIES_ART.bottle = (ctx, L) => {
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillStyle = 'rgba(120,170,120,0.55)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.1, 0, L * 0.32, L * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.fillRect(L * 0.18, -L * 0.05, L * 0.22, L * 0.1);
    ctx.fillStyle = '#8b5a2b';
    ctx.fillRect(L * 0.38, -L * 0.055, L * 0.08, L * 0.11);
    ctx.fillStyle = '#f2e6c4';
    ctx.fillRect(-L * 0.28, -L * 0.06, L * 0.32, L * 0.12);
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillRect(-L * 0.35, -L * 0.1, L * 0.45, L * 0.025);
    ctx.restore();
  };

  // Korallrev og vrak tegnes én gang til et eget lerret (de er store og står stille).
  const spriteCache = new Map();
  function sprite(key, w, h, draw) {
    const id = `${key}:${Math.round(w)}x${Math.round(h)}`;
    const hit = spriteCache.get(id);
    if (hit) {
      // Sist brukt havner bakerst, så det er de eldste som fjernes når lageret er fullt.
      spriteCache.delete(id);
      spriteCache.set(id, hit);
      return hit;
    }
    if (!spriteCache.has(id)) {
      if (spriteCache.size > 700) spriteCache.delete(spriteCache.keys().next().value);
      const c = document.createElement('canvas');
      c.width = Math.max(2, Math.round(w));
      c.height = Math.max(2, Math.round(h));
      draw(c.getContext('2d'), c.width, c.height);
      spriteCache.set(id, c);
    }
    return spriteCache.get(id);
  }

  /** Pseudo-tilfeldig tall fra et frø, så samme rev ser likt ut hver gang. */
  function seeded(seed) {
    let s = seed;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  SPECIES_ART.coral = (ctx, L) => {
    const W = L;
    const H = L * 0.6;
    const img = sprite('coral', W, H, (c, w, h) => {
      const rnd = seeded(7);
      const branch = (x, y, ang, len, depth) => {
        if (depth === 0 || len < 2) return;
        const x2 = x + Math.cos(ang) * len;
        const y2 = y + Math.sin(ang) * len;
        c.strokeStyle = depth > 3 ? '#e9e2d6' : depth > 1 ? '#f2d2b8' : '#f7a978';
        c.lineWidth = Math.max(1, depth * 1.1);
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x2, y2);
        c.stroke();
        // Polypper på tuppene.
        if (depth <= 2) {
          c.fillStyle = 'rgba(255,190,150,0.9)';
          c.beginPath();
          c.arc(x2, y2, 1.6, 0, TAU);
          c.fill();
        }
        branch(x2, y2, ang - 0.35 - rnd() * 0.3, len * (0.72 + rnd() * 0.12), depth - 1);
        branch(x2, y2, ang + 0.35 + rnd() * 0.3, len * (0.72 + rnd() * 0.12), depth - 1);
      };
      for (let i = 0; i < 9; i++) {
        branch(w * (0.08 + i * 0.105), h, -Math.PI / 2 + (rnd() - 0.5) * 0.6, h * (0.18 + rnd() * 0.12), 6);
      }
    });
    ctx.drawImage(img, -W / 2, -H);
  };

  SPECIES_ART.wreck = (ctx, L) => {
    const W = L;
    const H = L * 0.42;
    const img = sprite('wreck', W, H, (c, w, h) => {
      // Skroget ligger litt på skrå på bunnen.
      c.translate(w * 0.5, h * 0.62);
      c.rotate(-0.06);
      c.fillStyle = lin(c, 0, -h * 0.3, 0, h * 0.3, [[0, '#5b4632'], [1, '#2e2219']]);
      c.beginPath();
      c.moveTo(-w * 0.46, -h * 0.15);
      c.lineTo(w * 0.42, -h * 0.2);
      c.quadraticCurveTo(w * 0.5, -h * 0.05, w * 0.36, h * 0.3);
      c.lineTo(-w * 0.38, h * 0.3);
      c.quadraticCurveTo(-w * 0.5, h * 0.1, -w * 0.46, -h * 0.15);
      c.fill();
      // Plankelinjer og et stort hull.
      c.strokeStyle = 'rgba(20,14,10,0.5)';
      c.lineWidth = 1.5;
      for (let i = 1; i < 6; i++) {
        c.beginPath();
        c.moveTo(-w * 0.45, -h * 0.15 + i * h * 0.08);
        c.lineTo(w * 0.42, -h * 0.2 + i * h * 0.085);
        c.stroke();
      }
      c.fillStyle = '#120d0a';
      c.beginPath();
      c.ellipse(w * 0.08, h * 0.08, w * 0.08, h * 0.12, 0.3, 0, TAU);
      c.fill();
      // Koøyer.
      c.fillStyle = '#1d1610';
      c.strokeStyle = '#8a7a52';
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.arc(-w * 0.3 + i * w * 0.13, -h * 0.05, h * 0.035, 0, TAU);
        c.fill();
        c.stroke();
      }
      // Knekt mast.
      c.fillStyle = '#4a3828';
      c.save();
      c.translate(-w * 0.05, -h * 0.17);
      c.rotate(0.35);
      c.fillRect(-w * 0.012, -h * 0.75, w * 0.024, h * 0.75);
      c.fillRect(-w * 0.1, -h * 0.55, w * 0.2, h * 0.03);
      c.restore();
      // Begroing (sjøanemoner og tang).
      const rnd = seeded(11);
      for (let i = 0; i < 26; i++) {
        c.fillStyle = ['rgba(240,150,120,0.8)', 'rgba(230,230,210,0.75)', 'rgba(120,160,90,0.8)'][i % 3];
        c.beginPath();
        c.arc(-w * 0.45 + rnd() * w * 0.88, -h * 0.2 + rnd() * h * 0.06, h * (0.015 + rnd() * 0.02), 0, TAU);
        c.fill();
      }
      // Anker ved siden av.
      c.strokeStyle = '#6b6b66';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(w * 0.44, h * 0.32);
      c.lineTo(w * 0.44, h * 0.08);
      c.moveTo(w * 0.4, h * 0.12);
      c.lineTo(w * 0.48, h * 0.12);
      c.moveTo(w * 0.38, h * 0.26);
      c.quadraticCurveTo(w * 0.44, h * 0.38, w * 0.5, h * 0.26);
      c.stroke();
    });
    ctx.drawImage(img, -W / 2, -H * 0.92);
  };

  // ---------- Ubåten ----------
  function submarine(ctx, L, t, lightOn) {
    const H = L * 0.42;
    // Propell.
    ctx.fillStyle = '#5c5f63';
    const p = Math.abs(Math.sin(t * 18));
    ctx.beginPath();
    ctx.ellipse(-L * 0.53, 0, L * 0.03, H * 0.42 * p + 2, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e0a21a';
    ctx.beginPath();
    ctx.moveTo(-L * 0.45, -H * 0.05);
    ctx.lineTo(-L * 0.55, -H * 0.45);
    ctx.lineTo(-L * 0.5, 0);
    ctx.lineTo(-L * 0.55, H * 0.45);
    ctx.lineTo(-L * 0.45, H * 0.05);
    ctx.fill();
    // Skrog.
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, '#ffe066'], [0.5, '#f5b819'], [1, '#c98a06']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.47, H * 0.5, 0, 0, TAU);
    ctx.fill();
    // Blank lakk: høylys oppe og en mørk kant under.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.47, H * 0.5, 0, 0, TAU);
    ctx.clip();
    ctx.fillStyle = 'rgba(120,70,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, H * 0.42, L * 0.5, H * 0.25, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.55)';
    ctx.beginPath();
    ctx.ellipse(-L * 0.05, -H * 0.3, L * 0.3, H * 0.08, -0.04, 0, TAU);
    ctx.fill();
    // Sveisesømmer.
    ctx.strokeStyle = 'rgba(120,80,10,0.4)';
    ctx.lineWidth = Math.max(0.8, L * 0.008);
    for (const x of [-0.3, 0.33]) {
      ctx.beginPath();
      ctx.moveTo(L * x, -H * 0.5);
      ctx.quadraticCurveTo(L * (x + 0.04), 0, L * x, H * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    // Tårn.
    ctx.fillStyle = '#f0b015';
    ctx.beginPath();
    ctx.moveTo(-L * 0.12, -H * 0.42);
    ctx.lineTo(-L * 0.08, -H * 0.85);
    ctx.lineTo(L * 0.12, -H * 0.85);
    ctx.lineTo(L * 0.16, -H * 0.42);
    ctx.fill();
    ctx.strokeStyle = '#6a6d72';
    ctx.lineWidth = Math.max(1.5, L * 0.015);
    ctx.beginPath();
    ctx.moveTo(L * 0.02, -H * 0.85);
    ctx.lineTo(L * 0.02, -H * 1.1);
    ctx.lineTo(L * 0.1, -H * 1.1);
    ctx.stroke();
    // Koøyer.
    for (const [x, r] of [[L * 0.22, 0.24], [-L * 0.08, 0.16], [-L * 0.27, 0.13]]) {
      ctx.fillStyle = '#5d6168';
      ctx.beginPath();
      ctx.arc(x, -H * 0.02, H * r + 2, 0, TAU);
      ctx.fill();
      ctx.fillStyle = rad(ctx, x - H * r * 0.3, -H * 0.1, 1, H * r, [[0, '#d8f4ff'], [1, '#3d8fb5']]);
      ctx.beginPath();
      ctx.arc(x, -H * 0.02, H * r, 0, TAU);
      ctx.fill();
    }
    // Lykt foran.
    ctx.fillStyle = lightOn ? '#fff8d0' : '#9a9a8a';
    ctx.beginPath();
    ctx.ellipse(L * 0.46, H * 0.12, L * 0.03, H * 0.13, 0, 0, TAU);
    ctx.fill();
    if (lightOn) {
      ctx.fillStyle = rad(ctx, L * 0.47, H * 0.12, 0, L * 0.18, [[0, 'rgba(255,248,210,0.8)'], [1, 'rgba(255,248,210,0)']]);
      ctx.beginPath();
      ctx.arc(L * 0.47, H * 0.12, L * 0.18, 0, TAU);
      ctx.fill();
    }
  }

  // ---------- Omgivelser ----------
  /**
   * Tare. kind 'tare' (stortare): stiv stilk og et bredt, fingerdelt blad i toppen.
   * kind 'sukker' (sukkertare): kort stilk og ett langt, bølgete blad som flagrer i strømmen.
   */
  function kelp(ctx, x, yBottom, height, t, phase, color, kind) {
    const sway = (s) => Math.sin(t * 0.7 + phase + s * 1.6) * height * 0.1 * s * s + Math.sin(t * 1.9 + phase * 2 + s * 4) * height * 0.012 * s;
    if (kind === 'sukker') {
      const n = 14;
      const left = [];
      const right = [];
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const cx = x + sway(s) + s * height * 0.12;
        const cy = yBottom - s * height;
        const w = s < 0.12 ? height * 0.012 : height * (0.03 + 0.035 * Math.sin(Math.PI * s)) * (1 + 0.25 * Math.sin(s * 22 + t * 2 + phase));
        left.push([cx - w, cy]);
        right.push([cx + w, cy]);
      }
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (const [px, py] of left) ctx.lineTo(px, py);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fillStyle = lin(ctx, x - height * 0.1, 0, x + height * 0.15, 0, [[0, shadeHex(color, -0.25, 0.92)], [0.5, shadeHex(color, 0.18, 0.88)], [1, shadeHex(color, -0.3, 0.92)]]);
      ctx.fill();
      ctx.strokeStyle = shadeHex(color, 0.35, 0.35);
      ctx.lineWidth = 1;
      ctx.stroke();
      return;
    }
    // Stilk.
    const n = 10;
    const stem = 0.62;
    let px = x;
    let py = yBottom;
    ctx.lineCap = 'round';
    for (let i = 1; i <= n; i++) {
      const s = (i / n) * stem;
      const nx = x + sway(s);
      const ny = yBottom - s * height;
      ctx.strokeStyle = shadeHex(color, -0.35 + s * 0.3);
      ctx.lineWidth = Math.max(1.2, height * (0.034 - s * 0.022));
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      // Små rødalger som vokser på stilken.
      if (i % 3 === 1 && height > 60) {
        ctx.fillStyle = 'rgba(170,70,70,0.7)';
        ctx.beginPath();
        ctx.ellipse(nx + height * 0.012, ny, height * 0.014, height * 0.006, 0.6, 0, TAU);
        ctx.fill();
      }
      px = nx;
      py = ny;
    }
    // Det fingerdelte bladet.
    const fingers = 6;
    for (let f = 0; f < fingers; f++) {
      const spread = (f / (fingers - 1) - 0.5) * 0.9;
      const len = height * (0.34 + 0.08 * Math.sin(f * 2.3 + phase));
      const wob = Math.sin(t * 1.1 + phase + f * 0.9) * 0.18;
      const a = -Math.PI / 2 + spread + wob + Math.sin(t * 0.7 + phase) * 0.15;
      const ex = px + Math.cos(a) * len;
      const ey = py + Math.sin(a) * len;
      const mx = px + Math.cos(a - wob * 0.8) * len * 0.5;
      const my = py + Math.sin(a - wob * 0.8) * len * 0.5;
      const w = height * 0.032;
      const nxp = -Math.sin(a) * w;
      const nyp = Math.cos(a) * w;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(mx + nxp, my + nyp, ex, ey);
      ctx.quadraticCurveTo(mx - nxp, my - nyp, px, py);
      ctx.fillStyle = lin(ctx, px, py, ex, ey, [[0, shadeHex(color, -0.2, 0.95)], [0.6, shadeHex(color, 0.15, 0.85)], [1, shadeHex(color, 0.35, 0.7)]]);
      ctx.fill();
    }
  }

  /** Små tuer av tang og ålegras langs bunnen. */
  function weed(ctx, x, y, size, t, phase, color) {
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const bx = x + (i - 2) * size * 0.12;
      const h = size * (0.6 + ((i * 37) % 10) / 20);
      const sw = Math.sin(t * 1.2 + phase + i) * size * 0.15;
      ctx.lineWidth = Math.max(1, size * 0.06);
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.quadraticCurveTo(bx + sw * 0.4, y - h * 0.5, bx + sw, y - h);
      ctx.stroke();
    }
  }

  /** Sandbunn: rifler (små sandbølger) og korn. Lages én gang og brukes som mønster. */
  function sandTile(size) {
    return sprite('sand', size, size, (c, w, h) => {
      const rnd = seeded(77);
      for (let y = 0; y < h; y += 9) {
        c.strokeStyle = `rgba(0,0,0,${0.06 + rnd() * 0.05})`;
        c.lineWidth = 2;
        c.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const yy = y + Math.sin((x / w) * TAU * 2 + y * 0.3) * 2.5;
          if (x) c.lineTo(x, yy);
          else c.moveTo(x, yy);
        }
        c.stroke();
        c.strokeStyle = 'rgba(255,255,240,0.06)';
        c.beginPath();
        for (let x = 0; x <= w; x += 4) {
          const yy = y - 2 + Math.sin((x / w) * TAU * 2 + y * 0.3) * 2.5;
          if (x) c.lineTo(x, yy);
          else c.moveTo(x, yy);
        }
        c.stroke();
      }
      for (let i = 0; i < w * h * 0.03; i++) {
        c.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${rnd() * 0.15})` : `rgba(255,250,230,${rnd() * 0.18})`;
        c.fillRect(rnd() * w, rnd() * h, 1.3, 1.3);
      }
    });
  }

  /** En skjell- eller steinbit på bunnen. */
  function pebble(ctx, x, y, r, tone, kind) {
    if (kind === 'shell') {
      ctx.fillStyle = lin(ctx, x - r, y - r, x + r, y, [[0, '#f3e6d0'], [1, '#b39a78']]);
      ctx.beginPath();
      ctx.moveTo(x - r, y);
      ctx.quadraticCurveTo(x, y - r * 1.5, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,90,60,0.5)';
      ctx.lineWidth = 0.8;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + i * r * 0.4, y - r * 0.8 + Math.abs(i) * r * 0.2);
        ctx.stroke();
      }
      return;
    }
    ctx.fillStyle = rad(ctx, x - r * 0.3, y - r * 0.5, r * 0.1, r * 1.2, [[0, shadeHex(tone, 0.3)], [1, shadeHex(tone, -0.45)]]);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, 0, Math.PI, TAU);
    ctx.fill();
  }

  /** Ensfarget silhuett av en tegning (til dyr langt unna i tåka). */
  function silhouette(kind, L, color) {
    const art = SPECIES_ART[kind];
    return sprite(`sil-${kind}-${color}`, L * 1.4, L * 0.8, (c, w, h) => {
      c.translate(w / 2, h / 2);
      art(c, L, 0.4);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = color;
      c.fillRect(0, 0, w, h);
    });
  }

  /** Lysmønster på bunnen i grunt vann (kaustikk). Lages én gang som et mønster. */
  function causticTile(size) {
    return sprite('caustic', size, size, (c, w, h) => {
      const img = c.createImageData(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const u = (x / w) * TAU;
          const v = (y / h) * TAU;
          // Summen av noen bølger som går opp i hele flisa – gir lyse, buktende linjer.
          let s = 0;
          s += Math.sin(u * 3 + Math.sin(v * 2) * 1.5);
          s += Math.sin(v * 4 + Math.sin(u * 3) * 1.2);
          s += Math.sin((u + v) * 2 + Math.cos(u * 5) * 0.8);
          const line = Math.max(0, 1 - Math.abs(s) * 1.4);
          const a = Math.pow(line, 2.2) * 255;
          const i = (y * w + x) * 4;
          img.data[i] = 255;
          img.data[i + 1] = 255;
          img.data[i + 2] = 230;
          img.data[i + 3] = a;
        }
      }
      c.putImageData(img, 0, 0);
    });
  }

  // ---------- Dyr som bor inne i grotter og vrak ----------
  /** Kropp langs en bølgende midtlinje (ål, steinbit). w(s) gir halv tykkelse for s 0 (hale) – 1 (hode). */
  function tube(ctx, L, t, o) {
    const n = 26;
    const top = [];
    const bot = [];
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const x = -L / 2 + s * L;
      const y = Math.sin(t * o.speed - s * o.waves * TAU) * L * o.amp * (1 - s) ** 1.5;
      const dy = (Math.sin(t * o.speed - (s + 0.01) * o.waves * TAU) * L * o.amp * Math.max(0, 1 - s - 0.01) ** 1.5 - y) / (L * 0.01);
      const nx = -dy / Math.hypot(1, dy);
      const ny = 1 / Math.hypot(1, dy);
      const w = o.width(s) * L;
      top.push([x + nx * w, y - ny * w]);
      bot.push([x - nx * w, y + ny * w]);
    }
    const p = new Path2D();
    p.moveTo(top[0][0], top[0][1]);
    for (const [x, y] of top) p.lineTo(x, y);
    for (let i = bot.length - 1; i >= 0; i--) p.lineTo(bot[i][0], bot[i][1]);
    p.closePath();
    return { path: p, top, bot };
  }

  SPECIES_ART.wolffish = (ctx, L, t) => {
    const b = tube(ctx, L, t, { speed: 2.2, waves: 0.8, amp: 0.05, width: (s) => 0.025 + 0.1 * Math.sin(Math.min(1, s * 1.1) * Math.PI * 0.62) });
    // Lang ryggfinne langs hele ryggen.
    ctx.fillStyle = 'rgba(95,105,112,0.9)';
    ctx.beginPath();
    ctx.moveTo(b.top[0][0], b.top[0][1]);
    b.top.forEach(([x, y], i) => ctx.lineTo(x, y - (i > 2 && i < 22 ? L * 0.04 : 0)));
    ctx.lineTo(b.top[22][0], b.top[22][1]);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, -L * 0.12, 0, L * 0.12, [[0, '#56636c'], [0.55, '#8c979c'], [1, '#c7ccc6']]);
    ctx.fill(b.path);
    ctx.save();
    ctx.clip(b.path);
    // Mørke tverrbånd.
    ctx.fillStyle = 'rgba(30,38,45,0.35)';
    for (let i = 0; i < 9; i++) {
      const x = -L * 0.42 + i * L * 0.075;
      ctx.beginPath();
      ctx.ellipse(x, -L * 0.04, L * 0.018, L * 0.08, 0.15, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Stort, butt hode med tenner.
    const hx = L * 0.43;
    ctx.fillStyle = '#7a868c';
    ctx.beginPath();
    ctx.ellipse(hx, 0, L * 0.09, L * 0.1, 0, 0, TAU);
    ctx.fill();
    const open = 0.5 + 0.5 * Math.sin(t * 1.3);
    ctx.fillStyle = '#3a2a2a';
    ctx.beginPath();
    ctx.ellipse(hx + L * 0.06, L * 0.035, L * 0.04, L * 0.012 + open * L * 0.02, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2ead2';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(hx + L * (0.035 + i * 0.016), L * 0.02);
      ctx.lineTo(hx + L * (0.043 + i * 0.016), L * 0.038);
      ctx.lineTo(hx + L * (0.051 + i * 0.016), L * 0.02);
      ctx.fill();
    }
    eye(ctx, hx + L * 0.03, -L * 0.04, L * 0.022, '#c9b98a');
  };

  SPECIES_ART.anemone = (ctx, L, t) => {
    // Søyle.
    ctx.fillStyle = lin(ctx, -L * 0.15, 0, L * 0.15, 0, [[0, '#c9b49a'], [0.5, '#f4ece0'], [1, '#b49d84']]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.17, L * 0.5);
    ctx.bezierCurveTo(-L * 0.2, L * 0.2, -L * 0.1, L * 0.05, -L * 0.14, -L * 0.05);
    ctx.lineTo(L * 0.14, -L * 0.05);
    ctx.bezierCurveTo(L * 0.1, L * 0.05, L * 0.2, L * 0.2, L * 0.17, L * 0.5);
    ctx.closePath();
    ctx.fill();
    // Fjærlett krone av tentakler (lag på lag).
    for (let layer = 0; layer < 3; layer++) {
      const r = L * (0.36 - layer * 0.07);
      const n = 34 - layer * 8;
      ctx.strokeStyle = ['rgba(225,215,200,0.55)', 'rgba(245,238,226,0.75)', 'rgba(255,250,240,0.9)'][layer];
      ctx.lineWidth = Math.max(0.8, L * 0.008);
      for (let i = 0; i < n; i++) {
        const a = Math.PI + (i / (n - 1)) * Math.PI;
        const sway = Math.sin(t * 1.4 + i * 0.7 + layer) * 0.08;
        const x0 = Math.cos(a) * L * 0.1;
        const y0 = -L * 0.06;
        const x1 = Math.cos(a + sway) * r;
        const y1 = -L * 0.06 + Math.sin(a + sway) * r * 0.85;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2 + sway * L * 0.2, (y0 + y1) / 2 - L * 0.05, x1, y1);
        ctx.stroke();
      }
    }
    ctx.fillStyle = rad(ctx, 0, -L * 0.2, 0, L * 0.3, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    ctx.beginPath();
    ctx.arc(0, -L * 0.18, L * 0.3, 0, TAU);
    ctx.fill();
  };

  SPECIES_ART.conger = (ctx, L, t) => {
    const b = tube(ctx, L, t, { speed: 2.6, waves: 1.3, amp: 0.06, width: (s) => 0.008 + 0.042 * Math.min(1, s * 1.6) - 0.012 * Math.max(0, s - 0.9) * 10 });
    // Finnesøm langs rygg og buk.
    ctx.strokeStyle = 'rgba(70,80,86,0.7)';
    ctx.lineWidth = Math.max(1, L * 0.012);
    ctx.beginPath();
    b.top.slice(0, 18).forEach(([x, y], i) => (i ? ctx.lineTo(x, y - L * 0.006) : ctx.moveTo(x, y - L * 0.006)));
    ctx.stroke();
    ctx.fillStyle = lin(ctx, 0, -L * 0.05, 0, L * 0.05, [[0, '#3f4a50'], [0.55, '#6d777b'], [1, '#b9bdb6']]);
    ctx.fill(b.path);
    const hx = L * 0.47;
    ctx.fillStyle = '#4a555a';
    ctx.beginPath();
    ctx.ellipse(hx, 0, L * 0.05, L * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#1c2124';
    ctx.lineWidth = Math.max(1, L * 0.006);
    ctx.beginPath();
    ctx.moveTo(hx + L * 0.05, L * 0.008);
    ctx.lineTo(hx + L * 0.005, L * 0.02);
    ctx.stroke();
    eye(ctx, hx + L * 0.015, -L * 0.014, L * 0.012, '#9fb3b0');
  };

  SPECIES_ART.prawn = (ctx, L, t) => {
    const flick = Math.sin(t * 3) * 0.08;
    // Lange antenner.
    ctx.strokeStyle = 'rgba(230,120,100,0.7)';
    ctx.lineWidth = 1;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(L * 0.4, -L * 0.04);
      ctx.bezierCurveTo(L * 0.8, -L * (0.3 + s * 0.08), L * 1.0, L * (0.1 + flick), L * 1.15, L * (0.25 + s * 0.05));
      ctx.stroke();
    }
    // Bein.
    ctx.strokeStyle = 'rgba(220,110,90,0.85)';
    for (let i = 0; i < 6; i++) {
      const x = L * (0.25 - i * 0.07);
      const k = Math.sin(t * 9 + i) * L * 0.02;
      ctx.beginPath();
      ctx.moveTo(x, L * 0.06);
      ctx.lineTo(x + L * 0.03 + k, L * 0.2);
      ctx.stroke();
    }
    // Bøyd kropp av ledd.
    for (let i = 7; i >= 0; i--) {
      const a = -0.25 + i * 0.13;
      const x = L * 0.25 - i * L * 0.08;
      const y = Math.sin(a) * L * 0.08 + i * L * 0.012;
      const r = L * (0.12 - i * 0.009);
      ctx.fillStyle = lin(ctx, x, y - r, x, y + r, [[0, '#f29a7c'], [0.5, '#e46b52'], [1, '#c24a3a']]);
      ctx.globalAlpha = 0.92;
      ctx.beginPath();
      ctx.ellipse(x, y, r * (i ? 0.75 : 1.4), r, a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Halevifte.
    ctx.fillStyle = 'rgba(230,110,90,0.85)';
    ctx.beginPath();
    ctx.moveTo(-L * 0.36, L * 0.1);
    ctx.lineTo(-L * 0.5, L * 0.02);
    ctx.lineTo(-L * 0.5, L * 0.22);
    ctx.fill();
    // Spiss på hodet og øye.
    ctx.strokeStyle = '#e57a62';
    ctx.lineWidth = Math.max(1, L * 0.02);
    ctx.beginPath();
    ctx.moveTo(L * 0.4, -L * 0.05);
    ctx.lineTo(L * 0.62, -L * 0.1);
    ctx.stroke();
    eye(ctx, L * 0.38, -L * 0.06, L * 0.035, '#222');
  };

  SPECIES_ART.sponge = (ctx, L, t) => {
    // Vase av glassnåler: lys, gjennomsiktig og med gittermønster.
    const p = new Path2D();
    p.moveTo(-L * 0.08, L * 0.5);
    p.bezierCurveTo(-L * 0.3, L * 0.2, -L * 0.18, -L * 0.25, -L * 0.24, -L * 0.48);
    p.lineTo(L * 0.24, -L * 0.48);
    p.bezierCurveTo(L * 0.18, -L * 0.25, L * 0.3, L * 0.2, L * 0.08, L * 0.5);
    p.closePath();
    ctx.fillStyle = lin(ctx, -L * 0.3, 0, L * 0.3, 0, [[0, 'rgba(200,215,220,0.45)'], [0.5, 'rgba(245,250,250,0.8)'], [1, 'rgba(190,205,212,0.45)']]);
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(0.6, L * 0.006);
    for (let i = -8; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(i * L * 0.04 - L * 0.3, L * 0.5);
      ctx.lineTo(i * L * 0.04 + L * 0.3, -L * 0.5);
      ctx.moveTo(i * L * 0.04 + L * 0.3, L * 0.5);
      ctx.lineTo(i * L * 0.04 - L * 0.3, -L * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    // Åpningen øverst.
    ctx.fillStyle = 'rgba(40,60,70,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.48, L * 0.24, L * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.stroke();
    // Glinsende glassnåler som stikker ut.
    ctx.strokeStyle = `rgba(255,255,255,${0.4 + 0.2 * Math.sin(t * 2)})`;
    for (let i = 0; i < 10; i++) {
      const y = -L * 0.4 + i * L * 0.08;
      const s = i % 2 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(s * L * 0.2, y);
      ctx.lineTo(s * L * 0.28, y - L * 0.03);
      ctx.stroke();
    }
  };

  SPECIES_ART.brittlestar = (ctx, L, t) => {
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      ctx.strokeStyle = '#8f6a7d';
      ctx.lineCap = 'round';
      let x = Math.cos(a) * L * 0.07;
      let y = Math.sin(a) * L * 0.07 * 0.6;
      for (let k = 1; k <= 12; k++) {
        const s = k / 12;
        const bend = Math.sin(t * 1.5 + i * 1.3 + s * 4) * 0.5 * s;
        const nx = x + Math.cos(a + bend) * L * 0.036;
        const ny = y + Math.sin(a + bend) * L * 0.036 * 0.6;
        ctx.lineWidth = Math.max(1, L * 0.035 * (1 - s * 0.8));
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        x = nx;
        y = ny;
      }
    }
    ctx.fillStyle = rad(ctx, -L * 0.02, -L * 0.03, 0, L * 0.1, [[0, '#d1a9bb'], [1, '#7d5468']]);
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.09, L * 0.07, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * L * 0.045, Math.sin(a) * L * 0.035, L * 0.012, 0, TAU);
      ctx.fill();
    }
  };

  // ---------- Steder på havbunnen man kan gå inn i ----------
  /** Fjellknaus med en grotteåpning. Origo er midt på bunnen; L er bredden. */
  function caveMouth(ctx, L, t, pal) {
    const H = L * 0.75;
    const img = sprite(`cave-${pal.rock}`, L * 1.1, H * 1.1, (c, w, h) => {
      const rnd = seeded(21);
      c.translate(w / 2, h);
      const outline = new Path2D();
      outline.moveTo(-w * 0.5, 0);
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI;
        const r = 0.82 + rnd() * 0.18;
        outline.lineTo(Math.cos(a) * w * 0.5 * r, Math.sin(a) * h * 0.95 * r);
      }
      outline.lineTo(w * 0.5, 0);
      outline.closePath();
      c.fillStyle = lin(c, -w * 0.3, -h, w * 0.3, 0, [[0, shadeHex(pal.rock, 0.25)], [1, shadeHex(pal.rock, -0.5)]]);
      c.fill(outline);
      c.save();
      c.clip(outline);
      for (let i = 0; i < 70; i++) {
        const x = (rnd() - 0.5) * w;
        const y = -rnd() * h;
        const r = w * (0.03 + rnd() * 0.07);
        c.fillStyle = lin(c, x - r, y - r, x + r, y + r, [[0, shadeHex(pal.rock, 0.2 + (rnd() - 0.5) * 0.2)], [1, shadeHex(pal.rock, -0.45)]]);
        c.beginPath();
        c.ellipse(x, y, r, r * 0.7, rnd(), 0, TAU);
        c.fill();
      }
      for (let i = 0; i < 40; i++) {
        c.fillStyle = shadeHex(pal.moss, (rnd() - 0.5) * 0.3, 0.55);
        c.beginPath();
        c.arc((rnd() - 0.5) * w * 0.9, -h * (0.5 + rnd() * 0.45), w * (0.006 + rnd() * 0.014), 0, TAU);
        c.fill();
      }
      c.restore();
      // Åpningen: mørk bue med myk kant.
      const mouth = new Path2D();
      mouth.moveTo(-w * 0.17, 0);
      mouth.bezierCurveTo(-w * 0.2, -h * 0.4, -w * 0.08, -h * 0.52, w * 0.02, -h * 0.5);
      mouth.bezierCurveTo(w * 0.14, -h * 0.48, w * 0.2, -h * 0.3, w * 0.16, 0);
      mouth.closePath();
      c.fillStyle = rad(c, 0, -h * 0.1, 0, w * 0.22, [[0, '#000'], [0.7, '#05080a'], [1, shadeHex(pal.deep, 0)]]);
      c.fill(mouth);
      c.strokeStyle = 'rgba(0,0,0,0.5)';
      c.lineWidth = w * 0.015;
      c.stroke(mouth);
    });
    ctx.drawImage(img, -img.width / 2, -img.height);
  }

  /** Den gamle fiskebåten: et knekt treskrog som ligger på skrå. */
  function boatWreck(ctx, L) {
    const img = sprite('boatwreck', L * 1.1, L * 0.7, (c, w, h) => {
      const rnd = seeded(31);
      c.translate(w / 2, h * 0.92);
      c.rotate(-0.12);
      const hull = new Path2D();
      hull.moveTo(-w * 0.45, -h * 0.35);
      hull.quadraticCurveTo(-w * 0.4, h * 0.05, -w * 0.1, h * 0.06);
      hull.lineTo(w * 0.3, h * 0.04);
      hull.quadraticCurveTo(w * 0.45, -h * 0.05, w * 0.48, -h * 0.45);
      hull.lineTo(w * 0.32, -h * 0.3);
      hull.lineTo(w * 0.2, -h * 0.4);
      hull.lineTo(w * 0.05, -h * 0.28);
      hull.lineTo(-w * 0.15, -h * 0.38);
      hull.closePath();
      c.fillStyle = lin(c, 0, -h * 0.4, 0, h * 0.06, [[0, '#7d6040'], [1, '#2e2216']]);
      c.fill(hull);
      c.save();
      c.clip(hull);
      c.strokeStyle = 'rgba(20,12,6,0.6)';
      c.lineWidth = Math.max(1, h * 0.012);
      for (let y = -h * 0.36; y < h * 0.08; y += h * 0.07) {
        c.beginPath();
        c.moveTo(-w * 0.5, y);
        c.quadraticCurveTo(0, y + h * 0.05, w * 0.5, y - h * 0.02);
        c.stroke();
      }
      // Hull i skroget.
      c.fillStyle = '#0a0806';
      c.beginPath();
      c.ellipse(-w * 0.05, -h * 0.12, w * 0.09, h * 0.08, 0.2, 0, TAU);
      c.fill();
      for (let i = 0; i < 40; i++) {
        c.fillStyle = ['rgba(120,150,70,0.8)', 'rgba(230,150,120,0.7)', 'rgba(230,230,210,0.7)'][i % 3];
        c.beginPath();
        c.arc((rnd() - 0.5) * w * 0.9, -h * 0.4 + rnd() * h * 0.45, h * (0.008 + rnd() * 0.018), 0, TAU);
        c.fill();
      }
      c.restore();
      // Knekt mast og styrehus.
      c.fillStyle = '#4a3622';
      c.fillRect(w * 0.12, -h * 0.55, w * 0.18, h * 0.2);
      c.fillStyle = '#0d0a06';
      c.fillRect(w * 0.15, -h * 0.5, w * 0.05, h * 0.06);
      c.save();
      c.translate(-w * 0.12, -h * 0.34);
      c.rotate(-0.5);
      c.fillStyle = '#3e2e1c';
      c.fillRect(-w * 0.012, -h * 0.5, w * 0.024, h * 0.5);
      c.restore();
    });
    ctx.drawImage(img, -img.width / 2, -img.height);
  }

  function shadeHex(c, f, a) {
    const n = parseInt(c.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)));
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  const GLOWS = { lanternfish: lanternGlow, angler: anglerGlow, combjelly: combGlow };

  window.PaizonOceanArt = { SPECIES_ART, GLOWS, submarine, kelp, causticTile, seeded, eye, lin, rad, sprite, caveMouth, boatWreck, weed, sandTile, pebble, silhouette, shadeHex };
})();
