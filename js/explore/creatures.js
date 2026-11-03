/*
 * Dyr til Skogen og Himmelen. Alle tegnes vendt mot høyre, med lengde L i piksler og tid t.
 * Firbeinte dyr har origo på bakken mellom beina. Fugler: sittende fugler har origo ved føttene,
 * flygende fugler midt på kroppen. Stilen er den samme som i Havet: myke fargeoverganger,
 * lys ovenfra og ingen tykke omriss.
 */
(function () {
  'use strict';

  const X = window.PaizonExplore;
  const { TAU, lin, rad, shade } = X;
  const ART = {};

  function eye(ctx, x, y, r, iris) {
    ctx.fillStyle = iris || '#1a120c';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.35, r * 0.32, 0, TAU);
    ctx.fill();
  }

  // ---------- Firbeinte ----------
  /**
   * o: { coat, belly, dark (bein/ører), legs (beinlengde i L), bodyH, neck, head, ear, tail, antlers,
   *      gait (0 = står), low (kroppen nærmere bakken), muzzle, markings(ctx, L, bodyY, H) }
   */
  function mammal(ctx, L, t, o) {
    const legH = L * o.legs;
    const H = L * o.bodyH;
    const by = -legH - H * 0.45; // midten av kroppen
    const g = o.gait || 0;
    const ph = t * (o.stride || 6);
    const graze = o.graze ? (0.5 + 0.5 * Math.sin(t * 0.6)) : 0;
    // Bein: to på andre siden (mørkere), to på denne siden.
    const leg = (x, phase, far) => {
      const swing = g ? Math.sin(ph + phase) * 0.45 * g : 0;
      const lift = g ? Math.max(0, Math.cos(ph + phase)) * legH * 0.12 * g : 0;
      ctx.strokeStyle = far ? shade(o.dark, -0.35) : o.dark;
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1.5, L * (o.legW || 0.045));
      const kx = x + Math.sin(swing) * legH * 0.5;
      const ky = by + H * 0.3 + legH * 0.5 - lift * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, by + H * 0.25);
      ctx.lineTo(kx, ky);
      ctx.lineTo(kx + Math.sin(swing * 0.6) * legH * 0.45, -lift);
      ctx.stroke();
    };
    leg(L * 0.26, Math.PI, true);
    leg(-L * 0.26, 0, true);
    // Hale.
    ctx.save();
    ctx.translate(-L * 0.42, by - H * 0.1);
    const wag = Math.sin(t * 2.2) * 0.15;
    if (o.tail === 'bushy') {
      ctx.rotate(0.5 + wag);
      ctx.fillStyle = lin(ctx, 0, -H * 0.3, -L * 0.45, 0, [[0, o.coat], [0.75, shade(o.coat, -0.1)], [0.85, '#f3efe6'], [1, '#ffffff']]);
      ctx.beginPath();
      ctx.ellipse(-L * 0.22, 0, L * 0.25, H * 0.32, 0, 0, TAU);
      ctx.fill();
    } else if (o.tail === 'short') {
      ctx.rotate(-0.4 + wag);
      ctx.fillStyle = o.tailColor || o.coat;
      ctx.beginPath();
      ctx.ellipse(-L * 0.04, -H * 0.1, L * 0.06, H * 0.2, 0, 0, TAU);
      ctx.fill();
    } else if (o.tail === 'puff') {
      ctx.fillStyle = '#f7f5ef';
      ctx.beginPath();
      ctx.arc(0, 0, H * 0.22, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Kropp.
    const body = new Path2D();
    body.ellipse(0, by, L * 0.45, H * 0.5, 0, 0, TAU);
    if (o.hump) body.ellipse(L * 0.2, by - H * 0.35, L * 0.2, H * 0.3, 0.2, 0, TAU);
    ctx.fillStyle = lin(ctx, 0, by - H * 0.6, 0, by + H * 0.5, [[0, shade(o.coat, 0.18)], [0.55, o.coat], [1, o.belly || shade(o.coat, -0.3)]]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    // Pelsstrøk.
    if (L > 50) {
      ctx.strokeStyle = shade(o.coat, -0.25, 0.25);
      ctx.lineWidth = 1;
      for (let i = 0; i < 26; i++) {
        const x = -L * 0.42 + (i / 26) * L * 0.84;
        ctx.beginPath();
        ctx.moveTo(x, by - H * 0.4 + (i % 3) * 3);
        ctx.lineTo(x - L * 0.03, by - H * 0.2 + (i % 4) * 4);
        ctx.stroke();
      }
    }
    if (o.markings) o.markings(ctx, L, by, H);
    ctx.fillStyle = lin(ctx, 0, by - H * 0.5, 0, by + H * 0.5, [[0, 'rgba(255,255,240,0.18)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.25)']]);
    ctx.fillRect(-L, by - H, L * 2, H * 2);
    ctx.restore();
    leg(L * 0.3, 0, false);
    leg(-L * 0.22, Math.PI, false);
    // Lår og skulder gir beina volum der de går inn i kroppen.
    ctx.fillStyle = lin(ctx, 0, by - H * 0.6, 0, by + H * 0.5, [[0, shade(o.coat, 0.18)], [0.55, o.coat], [1, o.belly || shade(o.coat, -0.3)]]);
    for (const [x, r] of [[-L * 0.28, 0.26], [L * 0.29, 0.18]]) {
      ctx.beginPath();
      ctx.ellipse(x, by + H * 0.12, L * r * 0.42, H * 0.42, x < 0 ? 0.15 : -0.1, 0, TAU);
      ctx.fill();
    }
    // Hals og hode (hodet senkes når dyret beiter).
    const nx = L * 0.38;
    const ny = by - H * 0.2;
    const hx = nx + L * (o.neck || 0.15) * (1 - graze * 0.3);
    const hy = ny - L * (o.neck || 0.15) * (0.9 - graze * 1.9) + Math.sin(t * 1.2) * L * 0.005;
    ctx.strokeStyle = o.coat;
    ctx.lineCap = 'round';
    ctx.lineWidth = H * (o.neckW || 0.6);
    ctx.beginPath();
    ctx.moveTo(nx - L * 0.05, ny);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    if (o.dewlap) {
      ctx.fillStyle = shade(o.coat, -0.2);
      ctx.beginPath();
      ctx.ellipse(hx - L * 0.02, hy + H * 0.45, L * 0.02, H * 0.2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(graze * 0.9 + (o.headTilt || 0));
    const hs = L * (o.head || 0.12);
    // Ører.
    ctx.fillStyle = o.earColor || shade(o.coat, -0.15);
    if (o.ear === 'long') {
      for (const [dx, a] of [[-0.1, -0.35], [0.05, -0.15]]) {
        ctx.save();
        ctx.translate(hs * dx, -hs * 0.4);
        ctx.rotate(a + Math.sin(t * 1.5 + dx * 9) * 0.05);
        ctx.beginPath();
        ctx.ellipse(-hs * 0.1, -hs * 0.9, hs * 0.18, hs * 0.85, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    } else if (o.ear) {
      const big = o.ear === 'pointy' ? 0.55 : o.ear === 'round' ? 0.35 : 0.3;
      ctx.beginPath();
      ctx.moveTo(-hs * 0.35, -hs * 0.3);
      ctx.lineTo(-hs * 0.45 + (o.ear === 'pointy' ? 0 : -hs * 0.1), -hs * (0.4 + big * 1.4));
      ctx.lineTo(-hs * 0.05, -hs * 0.4);
      ctx.fill();
    }
    // Gevir.
    if (o.antlers === 'elg') {
      ctx.fillStyle = '#c9b48a';
      ctx.beginPath();
      ctx.moveTo(-hs * 0.3, -hs * 0.4);
      ctx.quadraticCurveTo(-hs * 1.4, -hs * 0.8, -hs * 1.6, -hs * 1.6);
      for (let i = 0; i < 6; i++) ctx.lineTo(-hs * (1.5 - i * 0.22), -hs * (1.7 + (i % 2) * 0.35));
      ctx.quadraticCurveTo(-hs * 0.4, -hs * 1.0, -hs * 0.1, -hs * 0.45);
      ctx.fill();
    } else if (o.antlers === 'raa') {
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = Math.max(1, hs * 0.1);
      ctx.beginPath();
      ctx.moveTo(-hs * 0.2, -hs * 0.4);
      ctx.lineTo(-hs * 0.3, -hs * 1.3);
      ctx.moveTo(-hs * 0.26, -hs * 0.9);
      ctx.lineTo(-hs * 0.05, -hs * 1.1);
      ctx.stroke();
    }
    // Hodet med snute.
    const muz = o.muzzle || 0.7;
    ctx.fillStyle = lin(ctx, 0, -hs * 0.5, 0, hs * 0.5, [[0, shade(o.coat, 0.15)], [1, shade(o.coat, -0.15)]]);
    ctx.beginPath();
    ctx.ellipse(0, 0, hs * 0.55, hs * 0.45, 0, 0, TAU);
    ctx.ellipse(hs * 0.55, hs * 0.1, hs * muz * 0.75, hs * 0.28, 0.15, 0, TAU);
    ctx.fill();
    if (o.face) o.face(ctx, hs);
    ctx.fillStyle = '#1a1410';
    ctx.beginPath();
    ctx.arc(hs * (0.5 + muz * 0.7), hs * 0.06, hs * 0.08, 0, TAU);
    ctx.fill();
    eye(ctx, hs * 0.15, -hs * 0.12, Math.max(1.2, hs * 0.1));
    ctx.restore();
  }

  ART.elg = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: '#4a3424', belly: '#2e2016', dark: '#6e5a48', legs: 0.55, legW: 0.04, bodyH: 0.36, neck: 0.12, neckW: 0.7,
    head: 0.2, muzzle: 0.95, ear: 'round', tail: 'short', hump: true, dewlap: true, antlers: o.female ? null : 'elg', gait: o.gait, graze: o.graze, stride: 3.5,
  });
  ART.raadyr = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: o.winter ? '#7d7266' : '#a2552c', belly: o.winter ? '#5d544a' : '#c98a5c', dark: o.winter ? '#5b524a' : '#7a4a2c', legs: 0.55, legW: 0.035, bodyH: 0.32,
    neck: 0.2, neckW: 0.45, head: 0.16, muzzle: 0.55, ear: 'round', tail: 'puff', antlers: o.female ? null : 'raa', gait: o.gait, graze: o.graze, stride: 5,
    face: (c, hs) => { c.fillStyle = '#f2ece2'; c.beginPath(); c.ellipse(hs * 0.75, hs * 0.22, hs * 0.18, hs * 0.08, 0, 0, TAU); c.fill(); },
  });
  ART.rev = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: '#d0642a', belly: '#f1e3cf', dark: '#2a1a12', legs: 0.26, legW: 0.035, bodyH: 0.24, neck: 0.1, neckW: 0.55, head: 0.15,
    muzzle: 0.75, ear: 'pointy', earColor: '#3a2014', tail: 'bushy', gait: o.gait, stride: 8,
    face: (c, hs) => { c.fillStyle = '#f7efe4'; c.beginPath(); c.ellipse(hs * 0.55, hs * 0.25, hs * 0.5, hs * 0.16, 0.1, 0, TAU); c.fill(); },
  });
  ART.hare = (ctx, L, t, o = {}) => {
    // Haren hopper: hele kroppen løftes i buer.
    const hop = o.gait ? Math.max(0, Math.sin(t * 5)) * L * 0.18 * o.gait : 0;
    ctx.save();
    ctx.translate(0, -hop);
    mammal(ctx, L, t, {
      coat: o.winter ? '#f2f2ee' : '#8a7458', belly: o.winter ? '#e2e2dc' : '#d9cbb3', dark: o.winter ? '#cfcfc8' : '#6a5844', legs: 0.2,
      legW: 0.05, bodyH: 0.4, neck: 0.06, head: 0.2, muzzle: 0.45, ear: 'long', earColor: o.winter ? '#f5f5f0' : '#7a6650', tail: 'puff', gait: 0,
    });
    ctx.restore();
  };
  ART.grevling = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: '#8b8a86', belly: '#2a2826', dark: '#1e1c1a', legs: 0.14, legW: 0.06, bodyH: 0.3, neck: 0.04, neckW: 0.8, head: 0.17,
    muzzle: 0.8, ear: 'small', earColor: '#e8e6e0', tail: 'short', gait: o.gait, stride: 7,
    face: (c, hs) => {
      c.fillStyle = '#f4f2ec';
      c.beginPath();
      c.ellipse(hs * 0.3, hs * 0.05, hs * 0.9, hs * 0.35, 0.1, 0, TAU);
      c.fill();
      c.fillStyle = '#141210';
      c.beginPath();
      c.ellipse(hs * 0.3, -hs * 0.05, hs * 0.85, hs * 0.11, 0.12, 0, TAU);
      c.fill();
    },
  });

  ART.ekorn = (ctx, L, t, o = {}) => {
    // Sitter oppreist med halen i en S-bue, og gnager på en kongle.
    const nib = Math.sin(t * 9) * L * 0.01;
    ctx.fillStyle = lin(ctx, -L * 0.5, -L * 0.9, -L * 0.1, 0, [[0, '#b2532a'], [1, '#7a3416']]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.12, -L * 0.05);
    ctx.bezierCurveTo(-L * 0.6, -L * 0.1, -L * 0.55, -L * 0.75, -L * 0.25, -L * 0.85);
    ctx.bezierCurveTo(-L * 0.05, -L * 0.9, -L * 0.05, -L * 0.7, -L * 0.2, -L * 0.65);
    ctx.bezierCurveTo(-L * 0.35, -L * 0.55, -L * 0.3, -L * 0.25, -L * 0.05, -L * 0.2);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, -L * 0.6, 0, 0, [[0, '#c4612e'], [1, '#93421c']]);
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.28, L * 0.17, L * 0.27, -0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f3e7d2';
    ctx.beginPath();
    ctx.ellipse(L * 0.06, -L * 0.26, L * 0.08, L * 0.18, -0.2, 0, TAU);
    ctx.fill();
    // Hode med dusker på ørene.
    ctx.fillStyle = '#c4612e';
    ctx.beginPath();
    ctx.ellipse(L * 0.1, -L * 0.6, L * 0.13, L * 0.11, 0.2, 0, TAU);
    ctx.ellipse(L * 0.2, -L * 0.56, L * 0.07, L * 0.06, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#7a3416';
    ctx.beginPath();
    ctx.moveTo(L * 0.02, -L * 0.68);
    ctx.lineTo(-L * 0.02, -L * 0.85);
    ctx.lineTo(L * 0.08, -L * 0.7);
    ctx.fill();
    eye(ctx, L * 0.14, -L * 0.63, Math.max(1.2, L * 0.03));
    // Kongle mellom potene.
    ctx.fillStyle = '#7a5530';
    ctx.beginPath();
    ctx.ellipse(L * 0.2, -L * 0.36 + nib, L * 0.05, L * 0.09, 0.3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#b2532a';
    ctx.beginPath();
    ctx.ellipse(L * 0.15, -L * 0.36, L * 0.05, L * 0.03, 0.4, 0, TAU);
    ctx.fill();
  };

  ART.pinnsvin = (ctx, L, t, o = {}) => {
    const step = o.gait ? Math.sin(t * 10) * L * 0.02 : 0;
    ctx.fillStyle = '#4a3a2c';
    for (const x of [-0.25, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(L * x + step, -L * 0.04, L * 0.05, L * 0.05, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = lin(ctx, 0, -L * 0.5, 0, 0, [[0, '#6b5a48'], [1, '#3e3226']]);
    ctx.beginPath();
    ctx.ellipse(-L * 0.05, -L * 0.18, L * 0.42, L * 0.24, 0, Math.PI, TAU);
    ctx.lineTo(L * 0.37, -L * 0.1);
    ctx.lineTo(-L * 0.47, -L * 0.1);
    ctx.fill();
    // Pigger.
    ctx.strokeStyle = '#d8cbb5';
    ctx.lineWidth = Math.max(0.8, L * 0.012);
    for (let i = 0; i < 40; i++) {
      const a = Math.PI + (i / 39) * Math.PI;
      const x = -L * 0.05 + Math.cos(a) * L * 0.38;
      const y = -L * 0.18 + Math.sin(a) * L * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a - 0.4) * L * 0.08, y + Math.sin(a - 0.4) * L * 0.08);
      ctx.stroke();
    }
    ctx.fillStyle = '#c9b49a';
    ctx.beginPath();
    ctx.ellipse(L * 0.36, -L * 0.12, L * 0.14, L * 0.08, 0.2, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(L * 0.49, -L * 0.1, L * 0.025, 0, TAU);
    ctx.fill();
    eye(ctx, L * 0.36, -L * 0.15, Math.max(1, L * 0.018));
  };

  // ---------- Fugler ----------
  /**
   * o: { back, belly, head, wing, tail, beak, beakLen, legs, cap, cheek, bib, wingTip, tailLen, span,
   *      pose: 'perch' | 'fly' | 'glide', flap (slag per sekund), plump }
   */
  function bird(ctx, L, t, o) {
    const pose = o.pose || 'perch';
    const H = L * (o.plump || 0.42);
    if (pose === 'perch') {
      // Bein.
      ctx.strokeStyle = o.legs || '#6a5a4a';
      ctx.lineWidth = Math.max(1, L * 0.025);
      ctx.beginPath();
      ctx.moveTo(-L * 0.04, 0);
      ctx.lineTo(-L * 0.02, -H * 0.4);
      ctx.moveTo(L * 0.06, 0);
      ctx.lineTo(L * 0.06, -H * 0.4);
      ctx.stroke();
      const bob = Math.sin(t * 1.3) * 0.04;
      ctx.save();
      ctx.translate(0, -H * 0.62);
      ctx.rotate(-0.4 + bob);
      drawBody(ctx, L, H, t, o, 'perch');
      ctx.restore();
      return;
    }
    drawBody(ctx, L, H, t, o, pose);
  }

  function drawBody(ctx, L, H, t, o, pose) {
    const flapA = pose === 'fly' ? Math.sin(t * (o.flap || 8) * TAU / 2) : 0;
    const tailLen = L * (o.tailLen || 0.3);
    // Hale.
    ctx.fillStyle = lin(ctx, -L * 0.3, 0, -L * 0.3 - tailLen, 0, [[0, o.tail || o.back], [1, shade(o.tail || o.back, -0.2)]]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.25, -H * 0.12);
    ctx.lineTo(-L * 0.25 - tailLen, -H * (o.fork ? 0.32 : 0.2));
    if (o.fork) ctx.lineTo(-L * 0.25 - tailLen * 0.6, 0);
    ctx.lineTo(-L * 0.25 - tailLen, H * (o.fork ? 0.32 : 0.2));
    ctx.lineTo(-L * 0.25, H * 0.12);
    ctx.fill();
    // Vingene sett fra siden: de peker opp (a > 0) eller ned (a < 0) og bakover, og blir
    // kortere når de står rett mot oss. Vingen på andre siden er mørkere og litt forskjøvet.
    const span = L * (o.span || 0.8) * 0.55;
    const wing = (a, far) => {
      const tipX = -L * (0.18 + 0.12 * (1 - Math.abs(a)));
      const tipY = -span * a;
      ctx.save();
      if (far) ctx.translate(L * 0.03, -H * 0.12);
      ctx.fillStyle = far ? shade(o.wing || o.back, -0.35) : lin(ctx, 0, 0, tipX, tipY, [[0, o.wing || o.back], [1, o.wingTip || shade(o.wing || o.back, -0.35)]]);
      ctx.beginPath();
      ctx.moveTo(L * 0.14, -H * 0.15);
      ctx.quadraticCurveTo(L * 0.05, tipY * 0.6, tipX + L * 0.06, tipY);
      ctx.lineTo(tipX - L * 0.02, tipY * 0.92);
      ctx.quadraticCurveTo(-L * 0.12, tipY * 0.4, -L * 0.14, -H * 0.05);
      ctx.closePath();
      ctx.fill();
      if (o.wingTip && span > 20 && Math.abs(a) > 0.3) {
        ctx.strokeStyle = shade(o.wingTip, -0.25, 0.5);
        ctx.lineWidth = 1;
        for (let i = 0; i < 4; i++) {
          const f = 0.55 + i * 0.12;
          ctx.beginPath();
          ctx.moveTo(tipX * f, tipY * f);
          ctx.lineTo(tipX * f - L * 0.05, tipY * f * 0.9);
          ctx.stroke();
        }
      }
      ctx.restore();
    };
    const aFar = pose === 'glide' ? 0.42 + Math.sin(t * 0.8) * 0.05 : flapA;
    const aNear = pose === 'glide' ? 0.3 + Math.sin(t * 0.8) * 0.05 : flapA * 0.9;
    if (pose !== 'perch') wing(aFar, true);
    // Kropp.
    const body = new Path2D();
    body.ellipse(0, 0, L * 0.3, H * 0.5, 0, 0, TAU);
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, o.back], [0.5, shade(o.back, 0.05)], [0.62, o.belly], [1, shade(o.belly, -0.15)]]);
    ctx.fill(body);
    ctx.save();
    ctx.clip(body);
    if (o.bib) {
      ctx.fillStyle = o.bib;
      ctx.fillRect(L * 0.05, -H * 0.2, L * 0.05, H * 0.8);
    }
    ctx.fillStyle = lin(ctx, 0, -H * 0.5, 0, H * 0.5, [[0, 'rgba(255,255,240,0.2)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.2)']]);
    ctx.fillRect(-L, -H, L * 2, H * 2);
    ctx.restore();
    // Sammenfoldet vinge (sittende) eller nær vinge (flygende).
    if (pose === 'perch') {
      ctx.fillStyle = lin(ctx, 0, -H * 0.4, 0, H * 0.3, [[0, o.wing || o.back], [1, o.wingTip || shade(o.wing || o.back, -0.3)]]);
      ctx.beginPath();
      ctx.ellipse(-L * 0.08, -H * 0.05, L * 0.24, H * 0.32, 0.12, 0, TAU);
      ctx.fill();
      if (o.wingBar) {
        ctx.strokeStyle = o.wingBar;
        ctx.lineWidth = Math.max(1, H * 0.06);
        ctx.beginPath();
        ctx.moveTo(-L * 0.18, -H * 0.06);
        ctx.lineTo(L * 0.05, -H * 0.1);
        ctx.stroke();
      }
    } else wing(aNear, false);
    // Hode.
    const hx = L * 0.3;
    const hy = -H * 0.25;
    const hr = H * (o.headSize || 0.36);
    ctx.fillStyle = lin(ctx, 0, hy - hr, 0, hy + hr, [[0, o.head || o.back], [1, shade(o.head || o.back, -0.2)]]);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, TAU);
    ctx.fill();
    if (o.cheek) {
      ctx.fillStyle = o.cheek;
      ctx.beginPath();
      ctx.ellipse(hx + hr * 0.1, hy + hr * 0.25, hr * 0.55, hr * 0.38, 0, 0, TAU);
      ctx.fill();
    }
    if (o.cap) {
      ctx.fillStyle = o.cap;
      ctx.beginPath();
      ctx.arc(hx, hy, hr, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
    }
    // Nebb.
    const bl = L * (o.beakLen || 0.14);
    ctx.fillStyle = o.beak || '#2a2420';
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.8, hy - hr * 0.22);
    if (o.hook) ctx.quadraticCurveTo(hx + hr + bl, hy - hr * 0.2, hx + hr + bl * 0.8, hy + hr * 0.3);
    else ctx.lineTo(hx + hr + bl, hy + hr * 0.05);
    ctx.lineTo(hx + hr * 0.8, hy + hr * 0.25);
    ctx.fill();
    eye(ctx, hx + hr * 0.25, hy - hr * 0.15, Math.max(1, hr * 0.2), o.iris);
  }

  const B = (o) => (ctx, L, t, p = {}) => bird(ctx, L, t, Object.assign({}, o, p));
  ART.kjottmeis = B({ back: '#6f8a3a', belly: '#f0d23c', head: '#151515', cheek: '#f4f4f0', wing: '#5c7088', wingBar: '#e8ecf0', tail: '#4a5a70', bib: '#151515', beakLen: 0.08, flap: 14, tailLen: 0.3 });
  ART.trost = B({ back: '#1c1a19', belly: '#24211f', head: '#1c1a19', beak: '#e9a21c', iris: '#1a120c', beakLen: 0.12, tailLen: 0.38, flap: 10 });
  ART.gjok = B({ back: '#7a8088', belly: '#e9e8e2', head: '#7a8088', wing: '#5d636b', tail: '#5d636b', beak: '#3a3430', iris: '#e2b23a', tailLen: 0.5, plump: 0.32, flap: 7,
    markings: null });
  ART.kraake = B({ back: '#6b6e72', belly: '#7a7d80', head: '#1c1c1e', wing: '#1c1c1e', tail: '#1c1c1e', beak: '#1a1a1a', beakLen: 0.2, tailLen: 0.35, flap: 5, span: 1 });
  ART.ravn = B({ back: '#121214', belly: '#18181c', head: '#121214', wing: '#16161a', beak: '#0e0e10', beakLen: 0.24, tailLen: 0.4, flap: 4, span: 1.1 });
  ART.skjaere = B({ back: '#121418', belly: '#f4f4f2', head: '#121418', wing: '#1a2a4a', wingTip: '#f4f4f2', tail: '#1d3a3a', beakLen: 0.14, tailLen: 0.9, plump: 0.36, flap: 6 });
  ART.spurv = B({ back: '#8a6a44', belly: '#c9c2b4', head: '#7a7a7c', cap: '#6a6a6c', cheek: '#e2ddd2', wing: '#7a5530', wingBar: '#f0ece2', bib: '#2a2622', beak: '#3a3430', beakLen: 0.09, tailLen: 0.28, flap: 16 });
  ART.svale = B({ back: '#1e2a52', belly: '#f2e8da', head: '#1e2a52', cheek: '#a4402a', wing: '#1a2240', tail: '#1a2240', fork: true, beakLen: 0.05, tailLen: 0.55, plump: 0.3, flap: 9, span: 1.1 });
  ART.taarnseiler = B({ back: '#2a2622', belly: '#34302c', head: '#2a2622', wing: '#24201c', fork: true, beakLen: 0.04, tailLen: 0.3, plump: 0.3, flap: 12, span: 1.4 });
  ART.lerke = B({ back: '#8a744e', belly: '#e2d6bc', head: '#8a744e', cap: '#7a6440', wing: '#7a6440', wingTip: '#5a4a32', beakLen: 0.1, tailLen: 0.32, flap: 12 });
  ART.make = B({ back: '#b8c0c8', belly: '#ffffff', head: '#ffffff', wing: '#a8b2bc', wingTip: '#1a1a1a', tail: '#ffffff', beak: '#e8c030', iris: '#d8c060', beakLen: 0.16, tailLen: 0.25, plump: 0.34, flap: 3, span: 1.5 });
  ART.havorn = B({ back: '#5a4230', belly: '#4a3626', head: '#c9b89a', wing: '#4a3626', wingTip: '#241a12', tail: '#f4f0e6', beak: '#e8c040', iris: '#e8c040', hook: true, beakLen: 0.18, tailLen: 0.28, plump: 0.36, flap: 2, span: 2 });
  ART.kongeorn = B({ back: '#4a3220', belly: '#3e2a1a', head: '#b0803a', wing: '#3e2a1a', wingTip: '#1e140c', tail: '#3a2a1c', beak: '#2a2420', iris: '#c08030', hook: true, beakLen: 0.15, tailLen: 0.3, plump: 0.36, flap: 2, span: 1.9 });
  ART.fjellvaak = B({ back: '#7a6450', belly: '#efe6d6', head: '#c9b8a0', wing: '#8a7460', wingTip: '#2a221a', tail: '#f4f0e6', beak: '#2a2420', hook: true, beakLen: 0.12, tailLen: 0.28, plump: 0.36, flap: 3, span: 1.6 });
  ART.gaas = B({ back: '#7d7466', belly: '#c9c0b0', head: '#5a544c', wing: '#6a6256', wingTip: '#3a3630', tail: '#4a4640', beak: '#e8964a', beakLen: 0.18, tailLen: 0.2, plump: 0.32, flap: 3, span: 1.5 });
  ART.trane = B({ back: '#9aa0a6', belly: '#b0b6bc', head: '#1a1a1a', cheek: '#f4f4f2', cap: '#c0302a', wing: '#8a9096', wingTip: '#1a1a1a', tail: '#5a5e62', beak: '#3a3a3a', beakLen: 0.3, tailLen: 0.2, plump: 0.26, flap: 2.5, span: 1.8 });

  /** Kattugla: sitter rett opp med store, mørke øyne, og blunker av og til. */
  ART.ugle = (ctx, L, t) => {
    const blink = Math.sin(t * 0.7) > 0.97;
    const turn = Math.sin(t * 0.3) * L * 0.03;
    ctx.fillStyle = lin(ctx, 0, -L, 0, 0, [[0, '#8a6a4a'], [1, '#5a4430']]);
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.42, L * 0.28, L * 0.42, 0, 0, TAU);
    ctx.fill();
    // Fjærmønster.
    ctx.strokeStyle = 'rgba(40,28,18,0.45)';
    ctx.lineWidth = Math.max(1, L * 0.012);
    for (let i = 0; i < 14; i++) {
      const x = -L * 0.15 + (i % 4) * L * 0.1;
      const y = -L * 0.5 + Math.floor(i / 4) * L * 0.12;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + L * 0.06);
      ctx.stroke();
    }
    // Hode og ansiktsskive.
    ctx.fillStyle = '#7a5a3c';
    ctx.beginPath();
    ctx.arc(turn, -L * 0.85, L * 0.24, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#c9a77c';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(turn + s * L * 0.1, -L * 0.85, L * 0.12, 0, TAU);
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      if (blink) {
        ctx.strokeStyle = '#2a1c10';
        ctx.lineWidth = Math.max(1, L * 0.015);
        ctx.beginPath();
        ctx.moveTo(turn + s * L * 0.1 - L * 0.05, -L * 0.85);
        ctx.lineTo(turn + s * L * 0.1 + L * 0.05, -L * 0.85);
        ctx.stroke();
      } else eye(ctx, turn + s * L * 0.1, -L * 0.85, L * 0.055, '#110a06');
    }
    ctx.fillStyle = '#d8c060';
    ctx.beginPath();
    ctx.moveTo(turn - L * 0.025, -L * 0.8);
    ctx.lineTo(turn + L * 0.025, -L * 0.8);
    ctx.lineTo(turn, -L * 0.73);
    ctx.fill();
    // Klør på greina.
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-L * 0.12, -L * 0.03, L * 0.08, L * 0.04);
    ctx.fillRect(L * 0.04, -L * 0.03, L * 0.08, L * 0.04);
  };

  /** Flaggspett som klatrer på en trestamme (origo der den holder seg fast) og hakker. */
  ART.spett = (ctx, L, t) => {
    const peck = Math.max(0, Math.sin(t * 14)) * (Math.sin(t * 0.8) > 0.3 ? 1 : 0);
    ctx.save();
    ctx.rotate(-Math.PI / 2 + 0.25);
    ctx.translate(-L * 0.1 + peck * L * 0.04, 0);
    drawBody(ctx, L, L * 0.42, t, { back: '#16161a', belly: '#efe8dc', head: '#16161a', cheek: '#f4f0e8', cap: '#16161a', wing: '#16161a', wingTip: '#f4f0e8', tail: '#16161a', beak: '#2a2622', beakLen: 0.2, tailLen: 0.3, wingBar: '#f4f0e8' }, 'perch');
    ctx.fillStyle = '#d02a2a';
    ctx.beginPath();
    ctx.ellipse(-L * 0.25, L * 0.08, L * 0.08, L * 0.05, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  };

  ART.flaggermus = (ctx, L, t) => {
    const f = Math.sin(t * 22);
    ctx.fillStyle = '#2a2420';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(s * L * 0.3, -L * 0.4 * f - L * 0.1, s * L * 0.55, -L * 0.25 * f);
      ctx.lineTo(s * L * 0.4, L * 0.05);
      ctx.lineTo(s * L * 0.28, -L * 0.02);
      ctx.lineTo(s * L * 0.15, L * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#4a3a30';
    ctx.beginPath();
    ctx.ellipse(0, 0, L * 0.08, L * 0.12, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-L * 0.05, -L * 0.1);
    ctx.lineTo(-L * 0.06, -L * 0.2);
    ctx.lineTo(0, -L * 0.12);
    ctx.lineTo(L * 0.06, -L * 0.2);
    ctx.lineTo(L * 0.05, -L * 0.1);
    ctx.fill();
  };

  ART.frosk = (ctx, L, t) => {
    const throat = 0.5 + 0.5 * Math.sin(t * 6);
    ctx.fillStyle = '#4e6a2a';
    ctx.beginPath();
    ctx.ellipse(-L * 0.18, -L * 0.1, L * 0.22, L * 0.1, 0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, -L * 0.45, 0, 0, [[0, '#7a8a3a'], [1, '#4a5a22']]);
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.2, L * 0.35, L * 0.2, -0.25, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(40,40,20,0.5)';
    for (const [x, y] of [[-0.1, -0.3], [0.05, -0.25], [-0.2, -0.18]]) {
      ctx.beginPath();
      ctx.arc(L * x, L * y, L * 0.035, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(230,220,170,${0.6 + throat * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(L * 0.25, -L * 0.1, L * 0.08 + throat * L * 0.04, L * 0.06 + throat * L * 0.03, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#6a7a32';
    ctx.beginPath();
    ctx.arc(L * 0.2, -L * 0.36, L * 0.07, 0, TAU);
    ctx.fill();
    eye(ctx, L * 0.21, -L * 0.37, L * 0.045, '#2a1a08');
    ctx.strokeStyle = '#4e6a2a';
    ctx.lineWidth = Math.max(1.2, L * 0.05);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(L * 0.18, -L * 0.1);
    ctx.lineTo(L * 0.28, 0);
    ctx.stroke();
  };

  ART.maur = (ctx, L, t) => {
    const s = Math.sin(t * 20) * L * 0.04;
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = Math.max(0.8, L * 0.04);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(L * (0.05 - i * 0.08), -L * 0.12);
      ctx.lineTo(L * (0.0 - i * 0.1) + (i % 2 ? s : -s), 0);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a2214';
    for (const [x, r] of [[-0.3, 0.16], [0, 0.09], [0.22, 0.11]]) {
      ctx.beginPath();
      ctx.ellipse(L * x, -L * 0.15, L * r, L * r * 0.8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(L * 0.28, -L * 0.22);
    ctx.quadraticCurveTo(L * 0.4, -L * 0.4, L * 0.48, -L * 0.3);
    ctx.stroke();
  };

  ART.sommerfugl = (ctx, L, t) => {
    const f = Math.abs(Math.sin(t * 9));
    ctx.save();
    ctx.scale(0.25 + 0.75 * f, 1);
    ctx.fillStyle = lin(ctx, -L * 0.5, 0, L * 0.5, 0, [[0, '#f2e04a'], [0.5, '#f8ec8a'], [1, '#f2e04a']]);
    ctx.beginPath();
    ctx.ellipse(-L * 0.22, -L * 0.15, L * 0.25, L * 0.2, -0.4, 0, TAU);
    ctx.ellipse(L * 0.22, -L * 0.15, L * 0.25, L * 0.2, 0.4, 0, TAU);
    ctx.ellipse(-L * 0.16, L * 0.12, L * 0.15, L * 0.14, 0.4, 0, TAU);
    ctx.ellipse(L * 0.16, L * 0.12, L * 0.15, L * 0.14, -0.4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#e07a20';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * L * 0.22, -L * 0.15, L * 0.03, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#2a2a20';
    ctx.fillRect(-L * 0.02, -L * 0.25, L * 0.04, L * 0.45);
  };

  // ---------- Sopp, bær og maurtue ----------
  ART.kantarell = (ctx, L) => {
    ctx.fillStyle = lin(ctx, -L * 0.3, -L * 0.5, L * 0.3, 0, [[0, '#f5c044'], [1, '#d8941a']]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.08, 0);
    ctx.quadraticCurveTo(-L * 0.1, -L * 0.3, -L * 0.4, -L * 0.55);
    ctx.quadraticCurveTo(0, -L * 0.72, L * 0.4, -L * 0.55);
    ctx.quadraticCurveTo(L * 0.1, -L * 0.3, L * 0.08, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,100,10,0.5)';
    ctx.lineWidth = 1;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * L * 0.02, -L * 0.15);
      ctx.lineTo(i * L * 0.1, -L * 0.52);
      ctx.stroke();
    }
  };
  ART.fluesopp = (ctx, L) => {
    ctx.fillStyle = lin(ctx, -L * 0.1, 0, L * 0.1, 0, [[0, '#d8d2c2'], [0.5, '#fbf8f0'], [1, '#cfc8b6']]);
    ctx.fillRect(-L * 0.08, -L * 0.6, L * 0.16, L * 0.6);
    ctx.fillStyle = '#f0ebe0';
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.38, L * 0.13, L * 0.04, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rad(ctx, -L * 0.1, -L * 0.8, L * 0.05, L * 0.5, [[0, '#f04a30'], [1, '#a81e12']]);
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.62, L * 0.45, L * 0.32, 0, Math.PI, TAU);
    ctx.fill();
    ctx.fillStyle = '#fbf6ea';
    for (const [x, y, r] of [[-0.25, -0.7, 0.05], [0, -0.85, 0.06], [0.22, -0.72, 0.045], [-0.1, -0.68, 0.035], [0.32, -0.64, 0.03], [0.1, -0.7, 0.03]]) {
      ctx.beginPath();
      ctx.arc(L * x, L * y, L * r, 0, TAU);
      ctx.fill();
    }
  };
  ART.blabaer = (ctx, L, t) => {
    ctx.strokeStyle = '#4a6a2a';
    ctx.lineWidth = Math.max(1, L * 0.03);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * L * 0.05, 0);
      ctx.quadraticCurveTo(i * L * 0.12, -L * 0.4, i * L * 0.2, -L * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = '#5a8a32';
    for (let i = 0; i < 16; i++) {
      const a = i * 2.4;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * L * 0.25, -L * 0.3 - (i % 5) * L * 0.08, L * 0.06, L * 0.03, a + Math.sin(t + i) * 0.1, 0, TAU);
      ctx.fill();
    }
    for (const [x, y] of [[-0.12, -0.25], [0.1, -0.4], [0.2, -0.2], [-0.2, -0.45], [0.02, -0.3]]) {
      ctx.fillStyle = rad(ctx, L * x - L * 0.015, L * y - L * 0.015, 0, L * 0.05, [[0, '#6a7ab8'], [1, '#1e2450']]);
      ctx.beginPath();
      ctx.arc(L * x, L * y, L * 0.045, 0, TAU);
      ctx.fill();
    }
  };
  ART.maurtue = (ctx, L, t) => {
    ctx.fillStyle = lin(ctx, 0, -L * 0.6, 0, 0, [[0, '#8a6a42'], [1, '#4a3820']]);
    ctx.beginPath();
    ctx.moveTo(-L * 0.5, 0);
    ctx.quadraticCurveTo(-L * 0.3, -L * 0.6, 0, -L * 0.62);
    ctx.quadraticCurveTo(L * 0.3, -L * 0.6, L * 0.5, 0);
    ctx.fill();
    // Barnåler.
    const r = X.seeded(4);
    ctx.strokeStyle = 'rgba(200,170,110,0.6)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 120; i++) {
      const x = (r() - 0.5) * L * 0.9;
      const y = -r() * L * 0.55 * (1 - Math.abs(x) / (L * 0.5));
      const a = r() * TAU;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * L * 0.03, y + Math.sin(a) * L * 0.03);
      ctx.stroke();
    }
    // Maur som travler.
    ctx.fillStyle = '#2a120a';
    for (let i = 0; i < 14; i++) {
      const p = (t * 0.08 + i / 14) % 1;
      const a = Math.PI + p * Math.PI;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * L * 0.4 * (0.5 + (i % 3) * 0.2), -Math.abs(Math.sin(a)) * L * 0.5 * (0.5 + (i % 3) * 0.2), Math.max(0.8, L * 0.008), 0, TAU);
      ctx.fill();
    }
  };

  ART.gaupe = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: '#b39a74', belly: '#e8dcc6', dark: '#8a7458', legs: 0.36, legW: 0.05, bodyH: 0.3, neck: 0.08, neckW: 0.7, head: 0.17,
    muzzle: 0.45, ear: 'pointy', earColor: '#3a2e22', tail: 'short', tailColor: '#2a2018', gait: o.gait, stride: 5,
    markings: (c, L2, by, H) => {
      c.fillStyle = 'rgba(70,50,30,0.45)';
      for (let i = 0; i < 24; i++) {
        c.beginPath();
        c.arc(-L2 * 0.4 + ((i * 37) % 80) / 80 * L2 * 0.8, by - H * 0.4 + ((i * 53) % 50) / 50 * H * 0.7, H * 0.06, 0, TAU);
        c.fill();
      }
    },
    face: (c, hs) => {
      c.fillStyle = '#e9dfcc';
      c.beginPath();
      c.ellipse(hs * 0.1, hs * 0.35, hs * 0.55, hs * 0.25, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#2a2018';
      c.lineWidth = Math.max(1, hs * 0.06);
      c.beginPath();
      c.moveTo(-hs * 0.3, -hs * 0.95);
      c.lineTo(-hs * 0.32, -hs * 1.2);
      c.stroke();
    },
  });
  ART.bjorn = (ctx, L, t, o = {}) => mammal(ctx, L, t, {
    coat: '#5a3e26', belly: '#3a2716', dark: '#3a2716', legs: 0.22, legW: 0.1, bodyH: 0.5, neck: 0.1, neckW: 0.9, head: 0.22,
    muzzle: 0.6, ear: 'round', tail: 'none', hump: true, gait: o.gait, graze: o.graze, stride: 3,
    face: (c, hs) => { c.fillStyle = '#8a6a48'; c.beginPath(); c.ellipse(hs * 0.65, hs * 0.12, hs * 0.38, hs * 0.22, 0.1, 0, TAU); c.fill(); },
  });
  ART.skrukketroll = (ctx, L, t) => {
    const s = Math.sin(t * 16) * L * 0.02;
    ctx.strokeStyle = '#3a3634';
    ctx.lineWidth = Math.max(0.6, L * 0.02);
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.3 + i * L * 0.1, -L * 0.05);
      ctx.lineTo(-L * 0.32 + i * L * 0.1 + (i % 2 ? s : -s), L * 0.02);
      ctx.stroke();
    }
    ctx.fillStyle = lin(ctx, 0, -L * 0.3, 0, 0, [[0, '#8a8682'], [1, '#4a4644']]);
    ctx.beginPath();
    ctx.ellipse(0, -L * 0.08, L * 0.42, L * 0.18, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,28,26,0.5)';
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo(-L * 0.42 + i * L * 0.105, -L * 0.08);
      ctx.lineTo(-L * 0.42 + i * L * 0.105, -L * 0.08 - Math.sin((i / 8) * Math.PI) * L * 0.18);
      ctx.stroke();
    }
  };
  ART.meitemark = (ctx, L, t) => {
    ctx.strokeStyle = '#c2726a';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.5, L * 0.08);
    ctx.beginPath();
    for (let i = 0; i <= 20; i++) {
      const u = i / 20;
      const x = -L * 0.5 + u * L;
      const y = -L * 0.06 - Math.sin(u * 7 - t * 3) * L * 0.06;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,210,0.4)';
    ctx.lineWidth = Math.max(0.6, L * 0.02);
    ctx.stroke();
  };
  ART.rumpetroll = (ctx, L, t) => {
    ctx.fillStyle = '#2a2a22';
    ctx.beginPath();
    ctx.ellipse(L * 0.15, 0, L * 0.2, L * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -L * 0.05);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-i * L * 0.05, Math.sin(t * 12 - i * 0.8) * L * 0.06 * (i / 10));
    ctx.lineTo(0, L * 0.05);
    ctx.fill();
  };

  window.PaizonCreatures = { ART, mammal, bird, eye };
})();
