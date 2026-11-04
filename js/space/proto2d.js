/*
 * Rommet – 2D-prototypen («papirteater»). Raketten, tårnet, trærne, romstasjonen og
 * astronauten er papirutklipp. Himmelen, jorda, Månen, sola og flammen er lys.
 * Kameraet zoomer i ett strekk fra utskytningsrampa til hele jorda, og ut til et bilde der
 * jorda og Månen er bitte små prikker – avstandene vises i riktig målestokk.
 */
(function () {
  'use strict';

  const S = window.PaizonSpace;
  const { TAU, clamp, lerp, smooth, seeded } = S;

  function create2D(wrap) {
    const K = window.PaizonPapir;
    const X = window.PaizonExplore;
    const FA = window.PaizonForestArt;
    const SA = window.PaizonSkyArt;
    const canvas = document.createElement('canvas');
    canvas.className = 'space-canvas';
    wrap.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let W = 0;
    let H = 0;
    let D = 0;
    let dpr = 1;
    function resize() {
      const r = wrap.getBoundingClientRect();
      W = Math.max(200, r.width);
      H = Math.max(200, r.height);
      D = Math.max(W, H);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    resize();

    // Planetene tegnes én gang som opplyste kuler.
    const em = S.earthMaps(1024);
    const earthImg = S.sphereImage(em.map, em.clouds, 720, [0.7, 0.45, 0.55], { rim: true, ambient: 0.04 });
    const earthMoonSky = S.sphereImage(em.map, em.clouds, 320, [1, 0.3, 0.05], { rim: true, ambient: 0.03, rot: 1.4 });
    const moonImg = S.sphereImage(S.moonMap(1024), null, 600, [0.75, 0.35, 0.55], { ambient: 0.02 });
    const landPat = ctx.createPattern(em.map, 'repeat');
    const cloudPat = ctx.createPattern(em.clouds, 'repeat');

    const rnd = seeded(5);
    const stars = Array.from({ length: 280 }, () => ({ x: rnd(), y: rnd(), z: 0.15 + rnd() * 0.85, r: 0.5 + rnd() * 1.4, tw: rnd() * 6 }));
    // Skyene foran raketten holder seg ut mot kantene, så raketten ikke forsvinner bak dem.
    const clouds = Array.from({ length: 10 }, (_, i) => {
      const front = i % 3 === 0;
      return { alt: 1.6 + rnd() * 6.5, x: front ? (rnd() < 0.5 ? rnd() * 0.22 : 0.78 + rnd() * 0.22) : rnd(), s: 0.35 + rnd() * 0.45, seed: 3 + i * 7, front };
    });
    const craters = Array.from({ length: 40 }, () => ({ x: (rnd() - 0.5) * 120, d: rnd(), r: 0.4 + rnd() * 2.2 }));
    let smoke = [];
    let dust = [];
    let time = 0;
    let phaseT = {};
    let prevCam = null;

    const F = (a) => Math.log(1 + Math.max(0, a) / 0.015);
    const mix = (a, b, k) => X.mixHex(a, b, clamp(k, 0, 1));

    function onPhase(phase) {
      phaseT[phase] = time;
      if (phase === 'pad') {
        smoke = [];
        dust = [];
        phaseT = { pad: time };
      }
    }

    // ---------- Hjelpere ----------
    /** Papirdotter (røyk, støv): først blekkonturer, så fyll – da smelter de sammen til én form. */
    function puffs(list, Y, fill) {
      ctx.fillStyle = K.INK;
      for (const p of list) {
        const y = Y(p);
        ctx.beginPath();
        ctx.arc(p.x, y, p.r + 1.8, 0, TAU);
        ctx.fill();
      }
      for (const p of list) {
        const y = Y(p);
        ctx.fillStyle = fill(p);
        ctx.beginPath();
        ctx.arc(p.x, y, p.r, 0, TAU);
        ctx.fill();
      }
    }
    function drawStars(alpha, camX, camY, streak) {
      if (alpha < 0.02) return;
      for (const s of stars) {
        const x = ((((s.x * W * 1.3 - camX * s.z * 0.15) % (W * 1.3)) + W * 1.3) % (W * 1.3)) - W * 0.15;
        const y = ((((s.y * H * 1.3 - camY * s.z * 0.15) % (H * 1.3)) + H * 1.3) % (H * 1.3)) - H * 0.15;
        const a = alpha * (0.45 + 0.55 * Math.abs(Math.sin(time * 0.7 + s.tw))) * s.z;
        if (streak && (Math.abs(streak[0]) + Math.abs(streak[1]) > 2)) {
          ctx.strokeStyle = `rgba(220,235,255,${a})`;
          ctx.lineWidth = s.r * s.z;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - streak[0] * s.z, y - streak[1] * s.z);
          ctx.stroke();
        } else {
          ctx.fillStyle = `rgba(255,255,248,${a})`;
          ctx.fillRect(x, y, s.r * s.z * 1.6, s.r * s.z * 1.6);
        }
      }
    }
    /** Sola med lysskjær og «linsereflekser» mot midten av bildet. */
    function drawSun(x, y, strength) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const R = D * 0.45;
      let g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, `rgba(255,250,230,${0.7 * strength})`);
      g.addColorStop(0.08, `rgba(255,236,190,${0.35 * strength})`);
      g.addColorStop(1, 'rgba(255,220,170,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      ctx.fillStyle = `rgba(255,255,250,${strength})`;
      ctx.beginPath();
      ctx.arc(x, y, D * 0.02, 0, TAU);
      ctx.fill();
      const dx = W / 2 - x;
      const dy = H / 2 - y;
      [[0.35, 0.03, '255,200,120', 0.12], [0.6, 0.015, '160,220,255', 0.16], [0.85, 0.05, '200,160,255', 0.07], [1.25, 0.025, '255,230,160', 0.12]].forEach(([k, r, col, a]) => {
        const fx = x + dx * k;
        const fy = y + dy * k;
        g = ctx.createRadialGradient(fx, fy, 0, fx, fy, D * r);
        g.addColorStop(0, `rgba(${col},${a * strength})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, D * r, 0, TAU);
        ctx.fill();
      });
      ctx.restore();
    }
    /** Lysende atmosfære rundt en planet (tegnes med 'lighter'). */
    function glowRing(cx, cy, R, thick, col, a) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, cy, Math.max(0, R - thick * 0.6), cx, cy, R + thick);
      g.addColorStop(0, `rgba(${col},0)`);
      g.addColorStop(0.35, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, R + thick, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    /** Jorda, nær (stor bue med kontinenter og skyer) eller langt unna (ferdig kule). */
    function drawEarth(cx, cy, R, alpha) {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (R > 520) {
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.save();
        ctx.clip();
        const g = ctx.createRadialGradient(cx + R * 0.3, cy - R * 0.7, 0, cx, cy, R);
        g.addColorStop(0, '#2f86bf');
        g.addColorStop(1, '#0d2f52');
        ctx.fillStyle = g;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        const sc = R / 520;
        for (const [pat, a, sp] of [[landPat, 0.95, 4], [cloudPat, 0.9, 9]]) {
          pat.setTransform(new DOMMatrix().translate(cx - R + time * sp, cy - R * 1.02).scale(sc));
          ctx.globalAlpha = alpha * a;
          ctx.fillStyle = pat;
          ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        }
        ctx.globalAlpha = alpha;
        // Mørkere mot kanten (kula krummer bort fra oss) og natt nede til venstre.
        const sh = ctx.createRadialGradient(cx + R * 0.25, cy - R * 0.4, R * 0.5, cx, cy, R * 1.02);
        sh.addColorStop(0, 'rgba(0,10,30,0)');
        sh.addColorStop(1, 'rgba(0,10,30,0.55)');
        ctx.fillStyle = sh;
        ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        ctx.restore();
      } else {
        ctx.drawImage(earthImg, cx - R, cy - R, R * 2, R * 2);
      }
      ctx.restore();
      glowRing(cx, cy, R, Math.max(4, Math.min(R * 0.08, H * 0.03)), '120,190,255', 0.55 * alpha);
    }

    // =====================================================================
    // Oppskytingen
    // =====================================================================
    function drawLaunch(st) {
      const alt = st.alt;
      const k = H * 0.3;
      const rocketY = lerp(H * 0.8, H * 0.6, smooth(alt / 0.35));
      const Y = (a) => rocketY - (F(a) - F(alt)) * k;
      const L = Math.min(H * 0.3, W * 0.55);
      const cx = W / 2;

      // Himmel: blå → mørkeblå → svart.
      const sk = smooth(alt / 15);
      const sk2 = smooth((alt - 15) / 70);
      const top = mix(mix('#5fa6e6', '#1d3b86', sk), '#000006', sk2);
      const bot = mix(mix('#cfe7f6', '#6a92d4', sk), '#060a1c', sk2);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(-20, -20, W + 40, H + 40);
      drawStars(smooth((alt - 25) / 45), 0, -F(alt) * 40, null);
      drawSun(W * 0.82, H * 0.14, 0.55 + 0.45 * smooth(alt / 80));

      // Jordas krumning kommer til syne.
      if (alt > 14) {
        const a1 = smooth((alt - 15) / 85);
        const a2 = smooth((alt - 100) / 300);
        const R = D * lerp(lerp(7, 2.4, a1), 1.4, a2);
        const topY = lerp(lerp(H + 40, H * 0.8, a1), H * 0.74, a2);
        drawEarth(cx, topY + R, R, smooth((alt - 14) / 18));
      }

      // Bakken i tre lag (fjell, åser med skog, rampa) – forsvinner raskt nedover.
      const f = F(alt);
      if (f < 4.5) {
        const far = H * 0.62 + f * k * 0.3;
        const mp = new Path2D();
        mp.moveTo(-20, H + 40);
        for (let x = -20; x <= W + 20; x += 16) mp.lineTo(x, far - H * (0.1 + 0.07 * Math.sin(x * 0.013 + 1) + 0.04 * Math.sin(x * 0.041)));
        mp.lineTo(W + 20, H + 40);
        mp.closePath();
        K.paperPath(ctx, mp, '#8fa3b2', { sx: 1.5, sy: 2 });
        ctx.fillStyle = '#4f8fb8';
        ctx.fillRect(-20, far - 2, W + 40, H);
        ctx.strokeStyle = K.INK;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-20, far);
        ctx.lineTo(W + 20, far);
        ctx.stroke();
        const mid = H * 0.7 + f * k * 0.6;
        const hp = new Path2D();
        hp.moveTo(-20, H + 40);
        for (let x = -20; x <= W + 20; x += 14) hp.lineTo(x, mid - H * (0.03 + 0.025 * Math.sin(x * 0.02 + 2)));
        hp.lineTo(W + 20, H + 40);
        hp.closePath();
        K.paperPath(ctx, hp, '#5e8a3c', { sx: 1.5, sy: 2 });
        if (FA) {
          for (let i = 0; i < 16; i++) {
            const x = ((i * 0.137 + 0.03) % 1) * W;
            if (Math.abs(x - cx) < W * 0.14) continue;
            const hh = H * (0.08 + (i % 4) * 0.02);
            const img = FA.spruce(Math.round(hh / 8) * 8 + 16, 'sommer', i % 4);
            ctx.drawImage(img, x - img.width / 2, mid - H * 0.02 - img.height + 4);
          }
        }
        const gy = Y(0);
        const gp = new Path2D();
        gp.rect(-20, gy, W + 40, H + 60);
        K.paperPath(ctx, gp, '#7a9a4a', { sx: 1.5, sy: 2 });
        const pad = new Path2D();
        pad.rect(cx - L * 0.45, gy - 2, L * 0.9, L * 0.07);
        K.paperPath(ctx, pad, '#b9b2a6', { sx: 1, sy: 1.5 });
        const arm = st.phase === 'pad' ? 0 : st.phase === 'ignition' ? smooth(st.pt / 1.5) : 1;
        ctx.save();
        ctx.translate(cx - L * 0.2, gy);
        K.drawAnimal(ctx, 'tarn', L * 1.12, 0, { arm });
        ctx.restore();
      }

      // Skyer bak raketten.
      const cloudAt = (c) => {
        const y = Y(c.alt);
        if (y < -H * 0.4 || y > H * 1.4) return;
        ctx.save();
        ctx.translate(((c.x * 1.4 - 0.2) * W), y);
        SA.ART.cumulus(ctx, W * 0.55 * c.s + H * 0.2 * c.s, time, { seed: c.seed, tone: 0 });
        ctx.restore();
      };
      clouds.filter((c) => !c.front).forEach(cloudAt);

      // Fly ved 10 km, med kondensstripe.
      const py = Y(10.5);
      if (py > -50 && py < H + 50) {
        ctx.save();
        const px = W * 1.2 - ((time * 0.06) % 1.6) * W;
        ctx.translate(px, py);
        SA.ART.contrail(ctx, W * 0.12, W * 0.5);
        SA.ART.plane(ctx, W * 0.12, time, {});
        ctx.restore();
      }

      // Merker for høyden.
      for (const [a, txt] of [[10, '10 km – her flyr flyene'], [100, '100 km – verdensrommet begynner']]) {
        const y = Y(a);
        if (y < 0 || y > H) continue;
        ctx.save();
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `800 ${Math.round(Math.max(13, H * 0.022))}px system-ui, sans-serif`;
        ctx.fillText(txt, 12, y - 8);
        ctx.restore();
      }

      // Røyk og raketten.
      const nozzle = rocketY;
      updateSmoke(st, cx, nozzle, L);
      const SY = (p) => Y(p.alt) + p.dy;
      puffs(smoke.filter((p) => !p.front), SY, (p) => mix('#f4f1ea', '#b9b4aa', p.age / p.life));
      const sepT = st.sepAt >= 0 ? st.t - st.sepAt : -1;
      if (sepT >= 0 && sepT < 4) {
        // Første trinn faller bakover og snurrer (tegnes bak flammen).
        ctx.save();
        ctx.globalAlpha = clamp(1 - (sepT - 2.5) / 1.5, 0, 1);
        ctx.translate(cx + sepT * W * 0.05, nozzle + (sepT * sepT * 0.14 + sepT * 0.1) * H);
        ctx.rotate(sepT * 0.5);
        ctx.scale(1 - sepT * 0.12, 1 - sepT * 0.12);
        K.drawAnimal(ctx, 'rakett', L, 0, { stage: 'bottom' });
        ctx.restore();
      }
      const topShift = sepT >= 0 ? -L * 0.52 * (1 - smooth(sepT / 1.6)) : 0;
      const stage = st.stage;
      if (st.thrust > 0.02) {
        ctx.save();
        ctx.translate(cx, nozzle + topShift + L * 0.04);
        const len = L * (0.25 + 0.55 * st.thrust) * (1 + (1 - st.air) * 0.7);
        S.flame(ctx, len, L * (stage === 'full' ? 0.12 : 0.09), time, st.air);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(cx, nozzle + topShift);
      K.drawAnimal(ctx, 'rakett', L, 0, { stage });
      ctx.restore();
      puffs(smoke.filter((p) => p.front), SY, (p) => mix('#f4f1ea', '#c9c4ba', p.age / p.life));
      clouds.filter((c) => c.front).forEach(cloudAt);

      // Romstasjonen suser forbi når vi nærmer oss 400 km.
      if (alt > 360) {
        const k2 = (alt - 360) / 40;
        ctx.save();
        ctx.translate(W * 1.25 - k2 * W * 1.5, H * 0.3);
        ctx.rotate(-0.08);
        K.drawAnimal(ctx, 'romstasjon', Math.min(W * 0.45, H * 0.35), 0, {});
        ctx.restore();
      }
    }

    function updateSmoke(st, cx, nozzleY, L) {
      const dt = 1 / 60;
      const onPad = st.alt < 0.05;
      const rate = st.phase === 'pad' ? st.charge * 20 : st.thrust * st.air * (onPad ? 60 : 30);
      const n = Math.floor(rate * dt + Math.random());
      for (let i = 0; i < n; i++) {
        if (onPad) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          smoke.push({ x: cx + dir * L * 0.05, alt: 0, dy: -L * 0.01, vx: dir * (W * 0.12 + Math.random() * W * 0.25), vy: -Math.random() * H * 0.04, r: L * 0.03, grow: L * (0.05 + Math.random() * 0.05), age: 0, life: 3 + Math.random() * 3, front: Math.random() < 0.6 });
        } else {
          smoke.push({ x: cx + (Math.random() - 0.5) * L * 0.08, alt: Math.max(0, st.alt - 0.003), dy: L * (0.5 + 0.5 * st.thrust), vx: (Math.random() - 0.5) * W * 0.04, vy: 0, r: L * 0.035, grow: L * 0.06, age: 0, life: 2.2 + Math.random() * 1.6, front: false });
        }
      }
      for (const p of smoke) {
        p.age += dt;
        p.x += p.vx * dt;
        p.vx *= 0.985;
        p.dy += p.vy * dt;
        p.r += p.grow * dt * (1.4 - p.age / p.life);
        if (p.age > p.life * 0.7) p.r *= 0.985;
      }
      smoke = smoke.filter((p) => p.age < p.life && p.r > 1);
      if (smoke.length > 260) smoke.splice(0, smoke.length - 260);
    }

    // =====================================================================
    // Rommet: bane rundt jorda og reisen til Månen
    // =====================================================================
    const MOON = [60, -9];
    const ORB0 = { R: () => D * 1.4, ex: () => W * 0.5, ey: () => H * 0.74 + D * 1.4 };
    let orbitAng = -Math.PI / 2;
    let path = null;

    function bez(p0, p1, p2, p3, u) {
      const v = 1 - u;
      return [
        v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
        v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
      ];
    }
    function orbitView(st) {
      // Fra den store buen ved slutten av oppskytingen til hele jorda – i ett jevnt strekk.
      const u = st.phase === 'orbit' ? smooth(st.pt / 5.5) : 1;
      const R1 = Math.min(W, H) * 0.27;
      const R = Math.exp(lerp(Math.log(ORB0.R()), Math.log(R1), u));
      const ex = lerp(ORB0.ex(), W * 0.42, u);
      const ey = lerp(ORB0.ey(), H * 0.56, u);
      return { z: R, cx: (W / 2 - ex) / R, cy: (H / 2 - ey) / R, u };
    }
    function camAt(st, rocket) {
      const o = orbitView(st);
      if (st.phase !== 'transfer') return o;
      const zSys = Math.min((W * 0.84) / 62, (H * 0.5) / 14);
      const zMoon = (Math.min(W, H) * 0.44) / 0.273;
      const keys = [
        [0, o.cx, o.cy, Math.log(o.z)],
        [0.12, 30, -4.5, Math.log(zSys)],
        [0.3, 30, -4.5, Math.log(zSys)],
        [0.62, rocket[0], rocket[1], Math.log(zSys * 4)],
        [0.86, lerp(rocket[0], MOON[0], 0.5), lerp(rocket[1], MOON[1], 0.5), Math.log(zSys * 14)],
        [1, MOON[0], MOON[1] + 0.02, Math.log(zMoon)],
      ];
      const p = st.prog;
      let i = 0;
      while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const q = smooth((p - a[0]) / (b[0] - a[0]));
      return { cx: lerp(a[1], b[1], q), cy: lerp(a[2], b[2], q), z: Math.exp(lerp(a[3], b[3], q)) };
    }

    const PLANETS = [
      ['Merkur', 0.383, '#9c948a'], ['Venus', 0.949, '#e2c98c'], ['Mars', 0.532, '#c4643a'], ['Jupiter', 11.21, '#d8b48a', 'bands'],
      ['Saturn', 9.45, '#e6cf96', 'rings'], ['Uranus', 4.01, '#9fd8e0'], ['Neptun', 3.88, '#4f72d8'],
    ];
    function drawPlanetRow(toS, z, alpha) {
      if (alpha <= 0.01) return;
      let x = 1.0;
      ctx.save();
      ctx.globalAlpha = alpha;
      for (const [name, r, col, deco] of PLANETS) {
        x += r;
        const wy = -9 * (x / 60);
        const [sx, sy] = toS(x, wy);
        const R = r * z;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, R), 0, TAU);
        ctx.fill();
        if (deco === 'bands' && R > 6) {
          ctx.save();
          ctx.clip();
          ctx.fillStyle = 'rgba(150,90,50,0.45)';
          for (const f of [-0.5, -0.15, 0.25, 0.55]) ctx.fillRect(sx - R, sy + f * R, R * 2, R * 0.12);
          ctx.restore();
        }
        if (deco === 'rings' && R > 4) {
          ctx.strokeStyle = 'rgba(230,210,160,0.8)';
          ctx.lineWidth = Math.max(1, R * 0.12);
          ctx.beginPath();
          ctx.ellipse(sx, sy, R * 1.9, R * 0.45, -0.3, 0, TAU);
          ctx.stroke();
        }
        // Skygge på nattsida.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.8, R), Math.PI * 0.6, Math.PI * 1.6);
        ctx.fill();
        if (R > 10) {
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = `700 ${Math.round(Math.max(10, Math.min(14, R * 0.5)))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(name, sx, sy + R * (deco === 'rings' ? 1.1 : 1) + 14);
        }
        x += r;
      }
      ctx.restore();
    }

    function drawSpace(st, dt) {
      if (st.phase === 'orbit' || st.phase === 'burn') orbitAng -= dt * 0.08;
      // Rakettens posisjon (i jordradier).
      const o = orbitView(st);
      const rOrb = 1 + lerp((H * 0.12) / ORB0.R(), 0.16, o.u);
      const orbPos = [Math.cos(orbitAng) * rOrb, Math.sin(orbitAng) * rOrb];
      if (st.phase !== 'transfer') path = null;
      else if (!path) {
        const p0 = orbPos;
        path = [p0, [p0[0] + 10, p0[1] - 8], [MOON[0] - 14, MOON[1] + 6], [MOON[0] - 0.42, MOON[1] + 0.02]];
      }
      const u = path ? smooth((st.prog - 0.06) / 0.9) : 0;
      const rocket = path ? bez(path[0], path[1], path[2], path[3], u) : orbPos;
      const ahead = path ? bez(path[0], path[1], path[2], path[3], Math.min(1, u + 0.01)) : [Math.cos(orbitAng - 0.05) * rOrb, Math.sin(orbitAng - 0.05) * rOrb];
      const cam = camAt(st, rocket);
      const toS = (x, y) => [W / 2 + (x - cam.cx) * cam.z, H / 2 + (y - cam.cy) * cam.z];
      const camPx = [cam.cx * cam.z, cam.cy * cam.z];
      const vel = prevCam ? [(camPx[0] - prevCam[0]) / Math.max(dt, 0.001), (camPx[1] - prevCam[1]) / Math.max(dt, 0.001)] : [0, 0];
      prevCam = camPx;

      ctx.fillStyle = '#01020a';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      // Melkeveien som et svakt bånd.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const mw = ctx.createLinearGradient(0, H * 0.1, W, H * 0.9);
      mw.addColorStop(0, 'rgba(90,80,140,0)');
      mw.addColorStop(0.5, 'rgba(110,100,170,0.12)');
      mw.addColorStop(1, 'rgba(90,80,140,0)');
      ctx.fillStyle = mw;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      const streak = st.phase === 'transfer' ? [clamp(vel[0] * 0.03, -W * 0.2, W * 0.2), clamp(vel[1] * 0.03, -H * 0.2, H * 0.2)] : null;
      drawStars(1, camPx[0] * 0.02, camPx[1] * 0.02, streak);
      drawSun(W * 0.9, H * 0.1, 1);

      const [ex, ey] = toS(0, 0);
      drawEarth(ex, ey, cam.z, 1);
      const [mx, my] = toS(MOON[0], MOON[1]);
      const mR = 0.273 * cam.z;
      ctx.drawImage(moonImg, mx - Math.max(1, mR), my - Math.max(1, mR), Math.max(2, mR * 2), Math.max(2, mR * 2));
      glowRing(mx, my, Math.max(1.5, mR), Math.max(3, mR * 0.05), '230,230,220', 0.25);
      if (cam.z < 30) {
        // Så små at de trenger et lysende punkt og et navn.
        for (const [x, y, name, r] of [[ex, ey, 'Jorda', cam.z], [mx, my, 'Månen', mR]]) {
          glowRing(x, y, Math.max(2, r), 10, name === 'Jorda' ? '120,190,255' : '230,230,220', 0.6);
          ctx.fillStyle = '#ffffff';
          ctx.font = `800 ${Math.round(Math.max(13, H * 0.022))}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(name, x, y + Math.max(r, 3) + 22);
        }
        // Stiplet linje med avstanden.
        ctx.save();
        ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(mx, my);
        ctx.stroke();
        ctx.restore();
      }
      const rowA = st.phase === 'transfer' ? smooth((st.prog - 0.05) / 0.06) * (1 - smooth((st.prog - 0.26) / 0.06)) : 0;
      drawPlanetRow(toS, cam.z, rowA);
      if (rowA > 0.05) {
        ctx.save();
        ctx.globalAlpha = rowA;
        ctx.fillStyle = '#fff6d8';
        ctx.textAlign = 'center';
        ctx.font = `900 ${Math.round(Math.max(16, H * 0.032))}px system-ui, sans-serif`;
        ctx.fillText('Alle planetene får plass mellom jorda og Månen!', W / 2, H - 100);
        ctx.restore();
      }

      // Raketten (alltid stor nok til å se, uansett hvor langt ut vi zoomer).
      const [rx, ry] = toS(rocket[0], rocket[1]);
      const [ax, ay] = toS(ahead[0], ahead[1]);
      let ang = Math.atan2(ax - rx, -(ay - ry));
      if (st.phase === 'orbit') ang = lerp(0, ang, smooth(st.pt / 3));
      const L = clamp(lerp(Math.min(H * 0.3, W * 0.55), H * 0.11, o.u), H * 0.08, H * 0.3) * (st.phase === 'transfer' ? lerp(1, 0.7, smooth((st.prog - 0.05) / 0.1)) : 1);
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(ang);
      if (st.thrust > 0.02) {
        ctx.save();
        ctx.translate(0, L * 0.03);
        S.flame(ctx, L * 0.5 * st.thrust, L * 0.09, time, 0);
        ctx.restore();
      }
      K.drawAnimal(ctx, 'rakett', L, 0, { stage: 'top' });
      ctx.restore();
    }

    // =====================================================================
    // Landing og tur på Månen
    // =====================================================================
    function drawMoon(st) {
      const m = Math.min(H * 0.08, W * 0.11); // piksler per meter (smalere på stående telefon, så flagget får plass)
      const y0 = H * 0.8;
      const a = st.astro;
      if (st.phase !== 'moon') camX = 0;
      else camX += ((a.x - 1) - camX) * 0.05;
      const sx = (x) => W / 2 + (x - camX) * m;
      ctx.fillStyle = '#000004';
      ctx.fillRect(-20, -20, W + 40, H + 40);
      drawStars(0.9, camX * m * 0.02, 0, null);
      drawSun(W * 0.12, H * 0.1, 1);
      // Jorda stiger opp over horisonten.
      const t0 = phaseT.landing != null ? time - phaseT.landing : 0;
      const er = Math.min(W, H) * 0.09;
      const ex = W * 0.72 - camX * m * 0.03;
      const ey = lerp(H * 0.64, H * 0.24, smooth(t0 / 40));
      ctx.drawImage(earthMoonSky, ex - er, ey - er, er * 2, er * 2);
      glowRing(ex, ey, er, er * 0.12, '120,190,255', 0.5);
      // Fjell langt borte, nærmere åser og bakken.
      const layer = (base, par, amp, col, f) => {
        const p = new Path2D();
        p.moveTo(-20, H + 40);
        for (let x = -20; x <= W + 20; x += 12) {
          const wx = x / m + camX * par;
          p.lineTo(x, base - H * amp * (0.5 + 0.35 * Math.sin(wx * f) + 0.15 * Math.sin(wx * f * 3.1 + 1)));
        }
        p.lineTo(W + 20, H + 40);
        p.closePath();
        K.paperPath(ctx, p, col, { sx: 1.5, sy: 2 });
      };
      layer(H * 0.68, 0.15, 0.12, '#7c7a76', 0.08);
      layer(H * 0.74, 0.45, 0.05, '#94918b', 0.25);
      const gp = new Path2D();
      gp.rect(-20, y0, W + 40, H);
      K.paperPath(ctx, gp, '#b4b1aa', { sx: 1.5, sy: 2 });
      for (const c of craters) {
        const x = sx(c.x);
        if (x < -100 || x > W + 100) continue;
        const y = y0 + (H - y0) * (0.15 + c.d * 0.75);
        const r = c.r * m * (0.6 + c.d * 0.6);
        ctx.fillStyle = '#8e8b84';
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.22, 0, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = '#d6d3cc';
        ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * 0.22, 0, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
      }
      // Fotspor.
      ctx.fillStyle = '#8a877f';
      for (const p of st.prints) {
        const x = sx(p.x);
        ctx.beginPath();
        ctx.ellipse(x - m * 0.12, y0 + 4, m * 0.1, m * 0.035, 0, 0, TAU);
        ctx.ellipse(x + m * 0.12, y0 + 7, m * 0.1, m * 0.035, 0, 0, TAU);
        ctx.fill();
      }
      // Landingsfartøyet.
      const L = Math.min(H * 0.55, W * 0.8);
      const land = st.phase === 'landing' ? st.land : 1;
      const ly = lerp(-H * 0.35, y0, 1 - Math.pow(1 - land, 2.2));
      const lx = sx(0);
      if (st.phase === 'landing' && land > 0.4) updateDust(lx, y0, L, 1 - (y0 - ly) / (H * 0.6));
      else if (st.phase !== 'landing') updateDust(lx, y0, L, 0);
      if (st.thrust > 0.02) {
        ctx.save();
        ctx.translate(lx, ly + L * 0.02);
        S.flame(ctx, Math.min(L * 0.5 * st.thrust, Math.max(10, y0 - ly + L * 0.05)), L * 0.09, time, 0);
        ctx.restore();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(lx, y0 + 3, L * 0.16 * (0.4 + 0.6 * land), L * 0.02, 0, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.translate(lx, ly - L * 0.06);
      K.drawAnimal(ctx, 'rakett', L, 0, { stage: 'top', legs: true });
      ctx.restore();
      puffs(dust, (p) => p.y, () => '#a9a59d');
      if (st.phase === 'moon') {
        ctx.save();
        ctx.translate(sx(-2.4), y0 + 2);
        K.drawAnimal(ctx, 'flagg', H * 0.17, 0, {});
        ctx.restore();
        const ax = sx(a.x);
        const ay = y0 - a.y * m;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ax, y0 + 3, m * 0.5 / (1 + a.y), m * 0.08, 0, 0, TAU);
        ctx.fill();
        ctx.save();
        ctx.translate(ax, ay);
        ctx.scale(a.dir, 1);
        K.drawAnimal(ctx, 'astronaut', H * 0.17, st.t, { pose: a.pose });
        ctx.restore();
      }
    }
    let camX = 0;
    function updateDust(x, y0, L, k) {
      const dt = 1 / 60;
      if (k > 0) {
        // På Månen finnes ingen luft: støvet flyr i rette buer og faller ned igjen, i stedet for å virvle.
        const n = Math.floor(k * 4 + Math.random());
        for (let i = 0; i < n; i++) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          dust.push({ x: x + dir * L * 0.03, y: y0 - 2, vx: dir * (W * 0.3 + Math.random() * W * 0.6), vy: -(H * 0.05 + Math.random() * H * 0.15), r: 2 + Math.random() * 4, age: 0 });
        }
      }
      for (const p of dust) {
        p.age += dt;
        p.x += p.vx * dt;
        p.vy += H * 0.25 * dt;
        p.y += p.vy * dt;
        if (p.y > y0 + 6) {
          p.y = y0 + 6;
          p.vy = 0;
          p.vx *= 0.8;
          p.r *= 0.96; // støv som har landet, legger seg og blir borte
        }
      }
      dust = dust.filter((p) => p.age < 3 && p.r > 0.6 && p.x > -50 && p.x < W + 50);
    }

    // =====================================================================
    function frame(st, dt) {
      time += dt;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      const sh = st.shake * Math.min(W, H) * 0.012;
      if (sh > 0.1) ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
      const ph = st.phase;
      if (ph === 'pad' || ph === 'ignition' || ph === 'ascent') drawLaunch(st);
      else if (ph === 'orbit' || ph === 'burn' || ph === 'transfer') drawSpace(st, dt);
      else drawMoon(st);
      ctx.restore();
      K.grainOverlay(ctx, W, H, 0.3);
      // Overgang: svart inn når vi kommer ned mot Månen.
      if (phaseT.landing != null && (ph === 'landing')) {
        const f = 1 - smooth((time - phaseT.landing) / 0.9);
        if (f > 0) {
          ctx.fillStyle = `rgba(0,0,0,${f})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    }

    function destroy() {
      canvas.remove();
    }

    return { frame, resize, destroy, onPhase, kind: '2d' };
  }

  window.PaizonSpace = Object.assign(window.PaizonSpace || {}, { create2D });
})();
