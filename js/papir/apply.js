/*
 * Papirdyr – kobler stil 4a inn i spillene. Alle dyr i Havet, Skogen og Himmelen tegnes nå som
 * papirutklipp med kontur, papirfiber og én skygge. Ting (vrak, korall, flaskepost, ballong,
 * skyer …) og oppdageren i skogen får samme behandling, så alt henger sammen.
 * Lastes etter spillene; spillene slår opp tegningene først når de tegner.
 */
(function () {
  'use strict';

  const K = window.PaizonPapir;
  const FISH = window.PaizonPapirFish;
  const shade = (c, f) => window.PaizonExplore.shade(c, f);

  /** Pakk en eksisterende tegning inn i et papirutklipp (kontur, fiber og skygge). */
  function wrap(key, draw, box, period, frames, extra) {
    K.define(key, Object.assign({ box, period, frames: frames || 1, draw }, extra || {}));
    return K.art(key);
  }

  // ---------- Havet ----------
  const A = window.PaizonOceanArt;
  if (A) {
    const old = Object.assign({}, A.SPECIES_ART);
    const map = {
      cod: 'fisk-torsk', mackerel: 'fisk-makrell', herring: 'fisk-sild', wrasse: 'fisk-berggylt', lanternfish: 'fisk-lysprikk',
      chimaera: 'fisk-havmus', shark: 'fisk-hakjerring', angler: 'fisk-marulk', seal: 'fisk-steinkobbe', porpoise: 'fisk-nise',
      orca: 'fisk-spekkhogger', humpback: 'fisk-knolhval', wolffish: 'fisk-steinbit', conger: 'fisk-havaal',
      lionsmane: 'brennmanet', moonjelly: 'glassmanet', combjelly: 'kammanet', crab: 'krabbe', lobster: 'hummer',
      starfish: 'sjostjerne', urchin: 'krakebolle', prawn: 'reke', anemone: 'sjonellik', sponge: 'glassvamp',
      brittlestar: 'slangestjerne', giantsquid: 'kjempeblekksprut', gull: 'make',
    };
    for (const [kind, key] of Object.entries(map)) A.SPECIES_ART[kind] = K.art(key);
    // Sjønellik og glassvamp finnes bare inne i grottene, der de plasseres etter midtpunktet sitt.
    for (const [kind, key, dy] of [['anemone', 'sjonellik', 0.42], ['sponge', 'glassvamp', 0.5]]) {
      A.SPECIES_ART[kind] = (ctx, L, t, o) => {
        ctx.save();
        ctx.translate(0, L * dy);
        K.drawAnimal(ctx, key, L, t, o);
        ctx.restore();
      };
    }
    // Ting på havbunnen: samme tegning som før, men klippet ut i papir.
    A.SPECIES_ART.coral = wrap('korallrev', (c, L) => old.coral(c, L), [-0.55, -1.0, 0.55, 0.06]);
    A.SPECIES_ART.wreck = wrap('skipsvrak', (c, L) => old.wreck(c, L), [-0.55, -0.62, 0.55, 0.1]);
    A.SPECIES_ART.bottle = wrap('flaskepost', (c, L, t) => old.bottle(c, L, t), [-0.6, -0.4, 0.6, 0.4]);
    A.GLOWS.lanternfish = FISH.glow('lysprikk');
    A.GLOWS.angler = FISH.glow('marulk');
    A.GLOWS.combjelly = (ctx, L, t) => {
      const r = L * 0.45;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(150,220,255,${0.18 + 0.08 * Math.sin(t * 3)})`);
      g.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);
    };
    // Tare, tangtuer og småstein i samme papirstil: flate farger med blekkontur.
    A.kelp = (ctx, x, yB, h, t, phase, color, kind) => {
      const sway = (q) => Math.sin(t * 0.7 + phase + q * 1.6) * h * 0.09 * q * q;
      if (kind === 'sukker') {
        const left = [];
        const right = [];
        for (let i = 0; i <= 12; i++) {
          const q = i / 12;
          const cx = x + sway(q) + q * h * 0.1;
          const cy = yB - q * h;
          const w = q < 0.12 ? h * 0.014 : h * (0.03 + 0.03 * Math.sin(Math.PI * q)) * (1 + 0.2 * Math.sin(q * 20 + t * 2 + phase));
          left.push([cx - w, cy]);
          right.push([cx + w, cy]);
        }
        const p = K.poly(left.concat(right.reverse()));
        K.paperPath(ctx, p, color, { shadow: false, lw: 1.3 });
        return;
      }
      const pts = [];
      for (let j = 0; j <= 8; j++) {
        const q = (j / 8) * 0.62;
        pts.push([x + sway(q), yB - q * h]);
      }
      K.inkLine(ctx, pts, shade(color, -0.25), Math.max(1.5, h * 0.03));
      const [tx, ty] = pts[8];
      for (let k = -2; k <= 2; k++) {
        const a = -Math.PI / 2 + k * 0.28 + Math.sin(t * 1.1 + phase + k) * 0.12;
        const len = h * (0.2 + 0.04 * Math.sin(k * 2.3 + phase));
        const leaf = new Path2D();
        leaf.ellipse(tx + Math.cos(a) * len * 0.55, ty + Math.sin(a) * len * 0.55, len * 0.55, h * 0.035, a, 0, Math.PI * 2);
        K.paperPath(ctx, leaf, k % 2 ? color : shade(color, 0.12), { shadow: false, lw: 1.2 });
      }
    };
    A.weed = (ctx, x, y, size, t, phase, color) => {
      for (let i = 0; i < 4; i++) {
        const bx = x + (i - 1.5) * size * 0.14;
        const sw = Math.sin(t * 1.2 + phase + i) * size * 0.15;
        K.inkLine(ctx, [[bx, y], [bx + sw * 0.4, y - size * 0.5], [bx + sw, y - size * (0.7 + (i % 2) * 0.3)]], color.indexOf('rgba') === 0 ? '#6f7f3c' : color, Math.max(1.2, size * 0.07));
      }
    };
    A.pebble = (ctx, x, y, r, tone, kind) => {
      const p = new Path2D();
      if (kind === 'shell') {
        p.moveTo(x - r, y);
        p.quadraticCurveTo(x, y - r * 1.5, x + r, y);
        p.closePath();
        K.paperPath(ctx, p, '#efe2c8', { shadow: false, lw: 1 });
        return;
      }
      p.ellipse(x, y, r, r * 0.6, 0, Math.PI, Math.PI * 2);
      p.closePath();
      K.paperPath(ctx, p, tone || '#7a756a', { shadow: false, lw: 1 });
    };
    // Grotteåpningen, fiskebåten og ubåten klippes ut i papir.
    const cave = A.caveMouth;
    A.caveMouth = (ctx, L, t, pal) => {
      const key = `grotte-${pal.rock}`;
      if (!K.REG[key]) K.define(key, { box: [-0.6, -0.86, 0.6, 0.04], draw: (c, L2) => cave(c, L2, 0, pal) });
      K.drawAnimal(ctx, key, L, 0, {});
    };
    const boat = A.boatWreck;
    K.define('fiskebaat', { box: [-0.6, -0.72, 0.6, 0.04], draw: (c, L2) => boat(c, L2) });
    A.boatWreck = (ctx, L) => K.drawAnimal(ctx, 'fiskebaat', L, 0, {});
    const sub = A.submarine;
    K.define('ubaat', { box: [-0.62, -0.4, 0.55, 0.28], period: (2 * Math.PI) / 18, frames: 6, variant: (o) => (o.light ? 'l' : ''), draw: (c, L2, t, o) => sub(c, L2, t, o.light) });
    A.submarine = (ctx, L, t, lightOn) => K.drawAnimal(ctx, 'ubaat', L, t, { light: lightOn });
    // Bunndyrene står med føttene i origo, så spillet trenger ikke løfte dem.
    A.PAPIR = true;
    // Steder i grottene: sjønellik og glassvamp er tegnet med foten i origo, men står midt på punktet sitt der inne.
    const IN = window.PaizonOceanInside;
    if (IN && IN.OBJECT_ART) {
      for (const k of Object.keys(IN.OBJECT_ART)) {
        const f = IN.OBJECT_ART[k];
        IN.OBJECT_ART[k] = wrap(`ting-${k}`, (c, L, t) => f(c, L, t, { light: 0.5 }), [-0.75, -0.75, 0.75, 0.75], k === 'lantern' || k === 'bell' || k === 'net' ? 2 * Math.PI / 0.7 : null, 16);
      }
    }
  }

  // ---------- Skogen og Himmelen ----------
  const C = window.PaizonCreatures;
  if (C) {
    for (const k of ['elg', 'raadyr', 'rev', 'hare', 'grevling', 'ekorn', 'pinnsvin', 'gaupe', 'bjorn', 'ugle', 'spett', 'flaggermus',
      'frosk', 'maur', 'sommerfugl', 'kantarell', 'fluesopp', 'blabaer', 'maurtue', 'skrukketroll', 'meitemark', 'rumpetroll',
      'kjottmeis', 'trost', 'gjok', 'spurv', 'skjaere', 'kraake', 'ravn', 'svale', 'taarnseiler', 'lerke', 'make', 'havorn',
      'kongeorn', 'fjellvaak', 'gaas', 'trane']) {
      if (K.REG[k]) C.ART[k] = K.art(k);
    }
  }
  const FA = window.PaizonForestArt;
  if (FA) {
    const walker = FA.walker;
    K.define('oppdager', {
      box: [-0.45, -1.3, 0.45, 0.1],
      variant: (o) => `${o.walking > 0.5 ? 'g' : 's'}${o.lantern ? 'l' : ''}`,
      period: (2 * Math.PI) / 7,
      frames: 12,
      draw: (c, L, t, o) => walker(c, L, t, { walking: o.walking > 0.5 ? 1 : 0, lantern: o.lantern }),
    });
    FA.walker = K.art('oppdager');
  }
  if (FA && FA.HIDEOUT_ART) {
    // Steinen, det hule treet og stubben klippes ut i papir (steinen i noen trinn mens den løftes).
    const H = FA.HIDEOUT_ART;
    for (const [k, box] of [['stone', [-0.75, -0.75, 0.7, 0.12]], ['hollow', [-0.3, -1.25, 0.32, 0.04]], ['stump', [-0.4, -0.5, 0.4, 0.04]]]) {
      const f = H[k];
      K.define(`gjem-${k}`, { box, variant: (o) => `${o.snow ? 's' : ''}${Math.round((o.open || 0) * 4)}`, draw: (c, L, t, o) => f(c, L, 0, { snow: o.snow, open: Math.round((o.open || 0) * 4) / 4 }) });
      H[k] = (ctx, L, t, o) => K.drawAnimal(ctx, `gjem-${k}`, L, 0, o);
    }
  }
  const SA = window.PaizonSkyArt;
  if (SA) {
    const o = Object.assign({}, SA.ART);
    // Hver sky får sitt eget utklipp (form, farge og natt), laget første gang den trengs.
    SA.ART.cumulus = (ctx, L, t, opt = {}) => {
      const key = `sky-${opt.seed || 3}-${Math.round((opt.tone || 0) * 10)}-${opt.night ? 1 : 0}`;
      if (!K.REG[key]) K.define(key, { box: [-0.6, -0.65, 0.6, 0.06], draw: (c, L2) => o.cumulus(c, L2, 0, opt) });
      K.drawAnimal(ctx, key, L, 0, {});
    };
    // Husene klippes ut i papir (én gang per hustype og natt/dag).
    SA.drawHouse = (ctx, x, yBase, L, v, night) => {
      const key = `hus-${v}-${night ? 1 : 0}`;
      if (!K.REG[key]) {
        K.define(key, {
          box: [-0.55, -1.15, 0.55, 0.04],
          draw: (c, L2) => {
            const img = SA.house(Math.max(12, Math.round(L2 / 4) * 4), v, night);
            c.drawImage(img, -img.width / 2, -img.height);
          },
        });
      }
      ctx.save();
      ctx.translate(x, yBase);
      K.drawAnimal(ctx, key, L, 0, {});
      ctx.restore();
    };
    SA.ART.plane = wrap('fly', (c, L, t, opt) => o.plane(c, L, t, opt), [-0.55, -0.25, 0.55, 0.2], null, 1);
    SA.ART.balloon = wrap('luftballong', (c, L, t) => o.balloon(c, L, t), [-0.6, -0.6, 0.6, 1.0], (2 * Math.PI) / 0.6, 24);
    SA.ART.kite = wrap('drage', (c, L, t) => o.kite(c, L, t), [-0.5, -0.6, 0.6, 1.6], Math.PI, 16);
  }
})();
