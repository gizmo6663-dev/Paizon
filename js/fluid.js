/*
 * Paizon – 2D væskesimulator uten DOM-avhengigheter.
 *
 * Partikkelbasert væske etter Clavet, Beaudoin og Poulin (2005), «Particle-based
 * Viscoelastic Fluid Simulation»: dobbel tetthetsavslapning gir trykk og overflatespenning,
 * og viskositet dempes parvis. Naboer finnes med et rutenett med cellestørrelse h.
 *
 * Flere væsker i samme kar: hver partikkel har et materiale (vann, olje, honning).
 * - Ulike materialer frastøter hverandre bare (ingen «klistring» over grenseflaten), og
 *   blander verken farge eller fart – derfor legger olje og vann seg i lag.
 * - Lettere materialer flyttes mer enn tunge når de dytter hverandre, så olje flyter opp.
 * - Honning har i tillegg indre demping, så den siger langsomt.
 *
 * Hindringer (kloss, planke, halvmåne, skål) er former med signert avstand (SDF) som
 * partiklene skyves ut av. Kraner lager nye partikler, og sluk fjerner dem.
 *
 * Farger på vann lagres som RYB (rød, gul, blå – som maling) og blandes mellom naboer,
 * så blå + gul blir grønn slik barn kjenner det fra maling.
 *
 * Lastes som <script> (window.PaizonFluid) og med require() i testene.
 */
(function (root) {
  'use strict';

  // Væsketyper. mass: tyngre væske synker. sigma/beta: viskositet mellom naboer.
  // drag: luftmotstand per steg. smooth: hvor sterkt naboer i samme væske tvinges til lik fart
  // (0–1, gjør honning seig). bulk: demping der væsken ligger samlet (mange naboer) – en tynn
  // stråle renner, men en haug siger bare sakte ut. stick: fart som mistes langs vegger.
  // spring: stivhet i elastiske fjærer mellom naboer (Clavet m.fl. avsnitt 5) – fjærene gir
  // sakte etter (plastisitet), så honning holder formen en stund og siger langsomt.
  // color: fast farge (null = malingsfarge).
  const MATERIALS = [
    { key: 'vann', label: 'Vann', mass: 1, sigma: 0.1, beta: 0.02, drag: 0, mix: 0.02, color: null },
    { key: 'olje', label: 'Olje', mass: 0.7, sigma: 0.35, beta: 0.08, drag: 0.01, mix: 0, color: [236, 190, 52] },
    { key: 'honning', label: 'Honning', mass: 1.4, sigma: 3, beta: 1, drag: 0.01, smooth: 0.9, bulk: 0.6, stick: 0.85, spring: 3, yield: 0.35, plastic: 0.005, mix: 0, color: [214, 132, 20] },
  ];
  const LIQUIDS = {};
  MATERIALS.forEach((m, i) => { LIQUIDS[m.key] = Object.assign({ index: i }, m); });

  // Stivhet og hviletetthet er felles; de ble justert for jevn, rolig væske.
  const K = 0.04;
  const K_NEAR = 0.3;
  const RHO0 = 2;

  // Hjørnene i RYB-kuben (Gossett og Chen, 2004): [r, y, b] → rgb.
  const RYB_CORNERS = [
    [1, 1, 1], // 000 hvit
    [0.163, 0.373, 0.6], // 001 blå
    [1, 1, 0], // 010 gul
    [0, 0.66, 0.2], // 011 grønn
    [1, 0, 0], // 100 rød
    [0.5, 0, 0.5], // 101 lilla
    [1, 0.5, 0], // 110 oransje
    [0.2, 0.094, 0], // 111 nesten svart
  ];

  function ryb2rgb(r, y, b) {
    const out = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const k = (i) => RYB_CORNERS[i][c];
      const x0 = k(0) * (1 - b) + k(1) * b;
      const x1 = k(2) * (1 - b) + k(3) * b;
      const x2 = k(4) * (1 - b) + k(5) * b;
      const x3 = k(6) * (1 - b) + k(7) * b;
      const y0 = x0 * (1 - y) + x1 * y;
      const y1 = x2 * (1 - y) + x3 * y;
      out[c] = Math.round(255 * (y0 * (1 - r) + y1 * r));
    }
    return out;
  }

  // Malingsfarger barnet kan helle i (RYB).
  const PAINTS = {
    bla: { label: 'Blå', ryb: [0, 0, 1] },
    rod: { label: 'Rød', ryb: [1, 0, 0] },
    gul: { label: 'Gul', ryb: [0, 1, 0] },
    hvit: { label: 'Hvit', ryb: [0, 0, 0] },
  };

  // ---------- Hindringer (signert avstand: negativ inne i formen) ----------
  /**
   * Lag en hindring. type: 'kloss' | 'planke' | 'halvmane' | 'skal'.
   * size er en grunnstørrelse i piksler (typisk et par ganger h).
   */
  function makeObstacle(type, x, y, size, angle) {
    const o = { type, x, y, angle: angle || 0 };
    if (type === 'planke') Object.assign(o, { shape: 'box', hw: size * 2.2, hh: size * 0.28, round: size * 0.2 });
    else if (type === 'kloss') Object.assign(o, { shape: 'box', hw: size * 0.75, hh: size * 0.75, round: size * 0.15 });
    // Halvmåne: en halv ring som åpner seg opp. Skål: bredere og grunnere.
    else if (type === 'halvmane') Object.assign(o, { shape: 'arc', r: size * 1.3, thick: size * 0.42, span: Math.PI });
    else if (type === 'skal') Object.assign(o, { shape: 'arc', r: size * 1.9, thick: size * 0.42, span: Math.PI * 0.8 });
    else throw new Error('Ukjent hindring: ' + type);
    o.reach = o.shape === 'box' ? Math.hypot(o.hw, o.hh) : o.r + o.thick;
    return o;
  }

  function obstacleDistance(o, px, py) {
    const c = Math.cos(-o.angle);
    const s = Math.sin(-o.angle);
    const dx = px - o.x;
    const dy = py - o.y;
    const lx = dx * c - dy * s;
    const ly = dx * s + dy * c;
    if (o.shape === 'box') {
      const qx = Math.abs(lx) - (o.hw - o.round);
      const qy = Math.abs(ly) - (o.hh - o.round);
      const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const inside = Math.min(Math.max(qx, qy), 0);
      return outside + inside - o.round;
    }
    // Bue: sentrert om «ned» (+y i skjermkoordinater), slik at den åpner seg oppover.
    const a0 = Math.PI / 2 - o.span / 2;
    const a1 = Math.PI / 2 + o.span / 2;
    let ang = Math.atan2(ly, lx);
    if (ang < -Math.PI / 2) ang += Math.PI * 2;
    if (ang >= a0 && ang <= a1) return Math.abs(Math.hypot(lx, ly) - o.r) - o.thick / 2;
    const e0 = Math.hypot(lx - o.r * Math.cos(a0), ly - o.r * Math.sin(a0));
    const e1 = Math.hypot(lx - o.r * Math.cos(a1), ly - o.r * Math.sin(a1));
    return Math.min(e0, e1) - o.thick / 2;
  }

  class FluidSim {
    constructor(opts) {
      const o = opts || {};
      this.h = o.h || 16; // vekselvirkningsradius i piksler
      this.max = o.max || 900;
      this.width = o.width || 400;
      this.height = o.height || 400;
      this.gx = 0;
      this.gy = o.gravity == null ? 0.2 : o.gravity;
      this.count = 0;
      const n = this.max;
      this.x = new Float32Array(n);
      this.y = new Float32Array(n);
      this.px = new Float32Array(n);
      this.py = new Float32Array(n);
      this.vx = new Float32Array(n);
      this.vy = new Float32Array(n);
      this.cr = new Float32Array(n);
      this.cy = new Float32Array(n);
      this.cb = new Float32Array(n);
      this.mat = new Uint8Array(n);
      this.uid = new Int32Array(n); // fast ID per partikkel – indeksene byttes når noen fjernes
      this.nextUid = 1;
      this.springs = new Map(); // nøkkel «a,b» (uid) → hvilelengde
      this.next = new Int32Array(n);
      this.stirs = [];
      this.obstacles = [];
      this.faucets = [];
      this.drains = [];
      this.pourRyb = PAINTS.bla.ryb;
      this.setLiquid(o.liquid || 'vann');
      this.resize(this.width, this.height);
    }

    /** Velg hvilken væske som helles og renner fra kranene. */
    setLiquid(name) {
      this.liquid = LIQUIDS[name] ? name : 'vann';
      this.pourMat = LIQUIDS[this.liquid].index;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.cols = Math.max(1, Math.ceil(width / this.h));
      this.rows = Math.max(1, Math.ceil(height / this.h));
      this.head = new Int32Array(this.cols * this.rows);
      for (let i = 0; i < this.count; i++) this.keepInside(i);
    }

    /** Legg til en partikkel. mat: 0 vann, 1 olje, 2 honning. Gir false når simulatoren er full. */
    add(x, y, ryb, vx, vy, mat) {
      if (this.count >= this.max) return false;
      const i = this.count++;
      this.x[i] = this.px[i] = x;
      this.y[i] = this.py[i] = y;
      this.vx[i] = vx || 0;
      this.vy[i] = vy || 0;
      this.cr[i] = ryb[0];
      this.cy[i] = ryb[1];
      this.cb[i] = ryb[2];
      this.mat[i] = mat == null ? this.pourMat : mat;
      this.uid[i] = this.nextUid++;
      this.keepInside(i);
      return true;
    }

    /** Fyll en firkant nedenfra med væske (høyst `limit` partikler). */
    fillRect(x0, y0, x1, y1, ryb, limit, mat) {
      const s = this.h * 0.4;
      const stopAt = Math.min(this.max, this.count + (limit || Infinity));
      for (let y = y1 - s / 2; y > y0; y -= s) {
        for (let x = x0 + s / 2; x < x1; x += s) {
          if (this.count >= stopAt || !this.add(x + (Math.random() - 0.5), y, ryb, 0, 0, mat == null ? 0 : mat)) return;
        }
      }
    }

    /** Fjern partikler innenfor radius r (svamp). */
    removeNear(x, y, r) {
      const r2 = r * r;
      let i = 0;
      let removed = 0;
      while (i < this.count) {
        const dx = this.x[i] - x;
        const dy = this.y[i] - y;
        if (dx * dx + dy * dy < r2) {
          this.removeAt(i);
          removed++;
        } else i++;
      }
      return removed;
    }

    removeAt(i) {
      const last = --this.count;
      if (i === last) return;
      for (const a of [this.x, this.y, this.px, this.py, this.vx, this.vy, this.cr, this.cy, this.cb, this.mat, this.uid]) a[i] = a[last];
    }

    clear() {
      this.count = 0;
      this.springs.clear();
    }

    /** Rør i væsken: partikler nær (x, y) dras med bevegelsen (dx, dy) til neste steg. */
    stir(x, y, dx, dy, r) {
      this.stirs.push({ x, y, dx, dy, r: r || this.h * 3 });
    }

    // ---------- Kraner og sluk ----------
    /** Kran i (x, y) som spruter i retning (dx, dy). strength 0–1. */
    addFaucet(x, y, dx, dy, strength) {
      const f = { x, y, dx, dy, strength: strength == null ? 0.5 : strength, acc: 0, on: true };
      this.faucets.push(f);
      return f;
    }

    addDrain(x, y, r) {
      const d = { x, y, r: r || this.h * 1.6 };
      this.drains.push(d);
      return d;
    }

    emit() {
      const { h } = this;
      for (const f of this.faucets) {
        if (!f.on || f.strength <= 0) continue;
        // Sterkere stråle: flere partikler, og de kommer fortere ut.
        f.acc += 0.25 + f.strength * 1.6;
        const speed = h * (0.12 + 0.4 * f.strength);
        const len = Math.hypot(f.dx, f.dy) || 1;
        const nx = f.dx / len;
        const ny = f.dy / len;
        while (f.acc >= 1) {
          f.acc -= 1;
          const side = (Math.random() - 0.5) * h * 0.5;
          if (!this.add(f.x - ny * side, f.y + nx * side, this.pourRyb, nx * speed, ny * speed)) {
            f.acc = 0;
            break;
          }
        }
      }
    }

    drain() {
      for (const d of this.drains) this.removeNear(d.x, d.y, d.r);
    }

    // ---------- Hindringer ----------
    addObstacle(type, x, y, angle, size) {
      const o = makeObstacle(type, x, y, size || this.h * 2, angle);
      this.obstacles.push(o);
      return o;
    }

    /** Skyv partikler ut av hindringene. */
    collide() {
      if (!this.obstacles.length) return;
      const pr = this.h * 0.25;
      const e = 0.5;
      const { x, y } = this;
      for (const o of this.obstacles) {
        const reach2 = (o.reach + pr + 2) * (o.reach + pr + 2);
        for (let i = 0; i < this.count; i++) {
          const ddx = x[i] - o.x;
          const ddy = y[i] - o.y;
          if (ddx * ddx + ddy * ddy > reach2) continue;
          const d = obstacleDistance(o, x[i], y[i]);
          if (d >= pr) continue;
          // Retning ut av formen (numerisk gradient av avstanden).
          let gx = obstacleDistance(o, x[i] + e, y[i]) - obstacleDistance(o, x[i] - e, y[i]);
          let gy = obstacleDistance(o, x[i], y[i] + e) - obstacleDistance(o, x[i], y[i] - e);
          const gl = Math.hypot(gx, gy);
          if (gl < 1e-6) { gx = 0; gy = -1; } else { gx /= gl; gy /= gl; }
          const push = pr - d;
          x[i] += gx * push;
          y[i] += gy * push;
        }
      }
    }

    /** Er punktet inne i (eller helt inntil) en hindring? Gir hindringen, eller null. */
    obstacleAt(px, py, margin) {
      for (let k = this.obstacles.length - 1; k >= 0; k--) {
        const o = this.obstacles[k];
        if (obstacleDistance(o, px, py) < (margin || 0)) return o;
      }
      return null;
    }

    removeObstacle(o) {
      this.obstacles = this.obstacles.filter((x) => x !== o);
    }

    /**
     * Hold partikkelen innenfor kassen. En liten forskyvning per partikkel hindrer at partikler
     * som presses mot en vegg får helt like koordinater (da kan de aldri skyves fra hverandre).
     */
    keepInside(i) {
      const m = 2;
      const j = (i % 13) * 0.04; // fast, liten forskyvning per partikkel – ingen ny støy hvert steg
      if (this.x[i] < m) this.x[i] = m + j;
      else if (this.x[i] > this.width - m) this.x[i] = this.width - m - j;
      if (this.y[i] < m) this.y[i] = m + j;
      else if (this.y[i] > this.height - m) this.y[i] = this.height - m - j;
    }

    buildGrid() {
      const { h, cols, rows, head, next } = this;
      head.fill(-1);
      for (let i = 0; i < this.count; i++) {
        const cx = Math.min(cols - 1, Math.max(0, (this.x[i] / h) | 0));
        const cy = Math.min(rows - 1, Math.max(0, (this.y[i] / h) | 0));
        const c = cy * cols + cx;
        next[i] = head[c];
        head[c] = i;
      }
    }

    /** Kaller fn(i, j, q, nx, ny) for hvert nabopar i < j innenfor h. */
    forPairs(fn) {
      const { h, cols, rows, head, next, x, y } = this;
      const h2 = h * h;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < cols; cx++) {
          for (let i = head[cy * cols + cx]; i !== -1; i = next[i]) {
            for (let oy = 0; oy <= 1; oy++) {
              for (let ox = -1; ox <= 1; ox++) {
                if (oy === 0 && ox < 0) continue; // hver cellepar én gang
                const nx = cx + ox;
                const ny = cy + oy;
                if (nx < 0 || nx >= cols || ny >= rows) continue;
                let j = oy === 0 && ox === 0 ? next[i] : head[ny * cols + nx];
                for (; j !== -1; j = next[j]) {
                  const dx = x[j] - x[i];
                  const dy = y[j] - y[i];
                  const d2 = dx * dx + dy * dy;
                  if (d2 >= h2 || d2 < 1e-6) continue;
                  const r = Math.sqrt(d2);
                  fn(i, j, r / h, dx / r, dy / r);
                }
              }
            }
          }
        }
      }
    }

    step() {
      this.emit();
      const n = this.count;
      const { x, y, px, py, vx, vy, mat } = this;

      // 1. Tyngdekraft, demping (honning) og røring.
      for (let i = 0; i < n; i++) {
        vx[i] += this.gx;
        vy[i] += this.gy;
        const drag = MATERIALS[mat[i]].drag;
        if (drag) {
          vx[i] *= 1 - drag;
          vy[i] *= 1 - drag;
        }
      }
      for (const s of this.stirs) {
        const r2 = s.r * s.r;
        for (let i = 0; i < n; i++) {
          const dx = x[i] - s.x;
          const dy = y[i] - s.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          // Seig væske er tyngre å røre i.
          const w = (1 - Math.sqrt(d2) / s.r) * (mat[i] === 2 ? 0.12 : 0.35);
          vx[i] += (s.dx - vx[i]) * w;
          vy[i] += (s.dy - vy[i]) * w;
        }
      }
      this.stirs.length = 0;

      // 2. Viskositet: demp forskjellen i fart mellom naboer av samme væske.
      //    Mellom ulike væsker er det nesten ingen friksjon, så lagene glir forbi hverandre.
      this.buildGrid();
      this.forPairs((i, j, q, nx, ny) => {
        const same = mat[i] === mat[j];
        const mi = MATERIALS[mat[i]];
        const sigma = same ? mi.sigma : 0.02;
        const beta = same ? mi.beta : 0;
        const u = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
        if (u <= 0) return;
        // Aldri mer enn halve fartsforskjellen – ellers overskyter seig væske og blir ustabil.
        const imp = Math.min(0.5 * (1 - q) * (sigma * u + beta * u * u), 0.5 * u);
        vx[i] -= imp * nx;
        vy[i] -= imp * ny;
        vx[j] += imp * nx;
        vy[j] += imp * ny;
      });

      // 2b. Seighet (XSPH-utjevning): honningpartikler tvinges mot naboenes snittfart, så
      //     klumpen beveger seg nesten samlet og flyter bare langsomt ut.
      this.smoothVelocities();

      // 3. Flytt partiklene, men begrens farten så ingenting «eksploderer».
      const vmax = this.h * 0.6;
      for (let i = 0; i < n; i++) {
        const v2 = vx[i] * vx[i] + vy[i] * vy[i];
        if (v2 > vmax * vmax) {
          const f = vmax / Math.sqrt(v2);
          vx[i] *= f;
          vy[i] *= f;
        }
        px[i] = x[i];
        py[i] = y[i];
        x[i] += vx[i];
        y[i] += vy[i];
      }
      this.applySprings();
      this.collide();

      // 4. Dobbel tetthetsavslapning (trykk + overflatespenning) og fargeblanding.
      //    Partikkel for partikkel med oppdaterte posisjoner (Gauss–Seidel), slik
      //    Clavet m.fl. gjør det – det er det som gjør metoden stabil.
      this.buildGrid();
      const { h, cols, rows, head, next, cr, cy, cb } = this;
      const h2 = h * h;
      const nb = this.nbBuf || (this.nbBuf = new Int32Array(256));
      const nq = this.nqBuf || (this.nqBuf = new Float32Array(256));
      const nbCount = this.nbCount && this.nbCount.length === this.max ? this.nbCount : (this.nbCount = new Uint16Array(this.max));
      for (let i = 0; i < n; i++) {
        const mi = mat[i];
        const massI = MATERIALS[mi].mass;
        // Finn naboene og tettheten rundt i.
        const ccx = Math.min(cols - 1, Math.max(0, (x[i] / h) | 0));
        const ccy = Math.min(rows - 1, Math.max(0, (y[i] / h) | 0));
        let m = 0;
        let rho = 0;
        let rhoNear = 0;
        for (let oy = -1; oy <= 1; oy++) {
          const gy = ccy + oy;
          if (gy < 0 || gy >= rows) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const gx = ccx + ox;
            if (gx < 0 || gx >= cols) continue;
            for (let j = head[gy * cols + gx]; j !== -1 && m < 256; j = next[j]) {
              if (j === i) continue;
              const dx = x[j] - x[i];
              const dy = y[j] - y[i];
              const d2 = dx * dx + dy * dy;
              if (d2 >= h2) continue;
              const q = Math.sqrt(d2) / h;
              const a = 1 - q;
              rho += a * a;
              rhoNear += a * a * a;
              nb[m] = j;
              nq[m] = q;
              m++;
            }
          }
        }
        const P = K * (rho - RHO0);
        const Pn = K_NEAR * rhoNear;
        let ddx = 0;
        let ddy = 0;
        for (let t = 0; t < m; t++) {
          const j = nb[t];
          const a = 1 - nq[t];
          const same = mat[j] === mi;
          let dx = x[j] - x[i];
          let dy = y[j] - y[i];
          let r = Math.sqrt(dx * dx + dy * dy);
          if (r < 1e-4) {
            // Helt oppå hverandre: velg en tilfeldig retning så de kan skilles.
            const ang = Math.random() * Math.PI * 2;
            dx = Math.cos(ang);
            dy = Math.sin(ang);
            r = 1;
          }
          // Samme væske: trykk og «lim» (negativt trykk gir overflatespenning).
          // Ulike væsker: bare frastøtning – da blander de seg ikke.
          const p = same ? P : Math.max(P, 0) + K * 1.5;
          const d = 0.5 * (p * a + Pn * a * a) * h / r;
          // Lette partikler flyttes mest, så den lette væsken presses opp.
          const massJ = MATERIALS[mat[j]].mass;
          const wj = (2 * massI) / (massI + massJ);
          const wi = (2 * massJ) / (massI + massJ);
          x[j] += d * dx * wj;
          y[j] += d * dy * wj;
          ddx -= d * dx * wi;
          ddy -= d * dy * wi;
          if (same) {
            const mix = MATERIALS[mi].mix;
            if (mix > 0) {
              const w = mix * a;
              const dr = (cr[j] - cr[i]) * w;
              const dyy = (cy[j] - cy[i]) * w;
              const db = (cb[j] - cb[i]) * w;
              cr[i] += dr; cr[j] -= dr;
              cy[i] += dyy; cy[j] -= dyy;
              cb[i] += db; cb[j] -= db;
            }
          }
        }
        x[i] += ddx;
        y[i] += ddy;
        nbCount[i] = m;
      }
      this.collide();

      // 5. Vegger, sluk, og ny fart ut fra hvor langt partikkelen faktisk flyttet seg.
      for (let i = 0; i < n; i++) {
        if (!(Number.isFinite(x[i]) && Number.isFinite(y[i]))) {
          // Sikkerhetsnett: en partikkel med ugyldig posisjon settes tilbake der den var.
          x[i] = Number.isFinite(px[i]) ? px[i] : this.width / 2;
          y[i] = Number.isFinite(py[i]) ? py[i] : this.height / 2;
        }
        this.keepInside(i);
        vx[i] = x[i] - px[i];
        vy[i] = y[i] - py[i];
        const bulk = MATERIALS[mat[i]].bulk;
        if (bulk) {
          // Demp utflyting (sideveis) og bevegelse oppover, men la honningen falle fritt –
          // ellers ser en fallende klump ut til å sveve.
          const damp = bulk * Math.min(1, Math.max(0, (nbCount[i] - 3) / 6));
          vx[i] *= 1 - damp;
          if (vy[i] * this.gy < 0 || this.gy === 0) vy[i] *= 1 - damp;
        }
        const stick = MATERIALS[mat[i]].stick;
        if (stick) {
          // Seig væske som berører en vegg eller gulvet, mister mesteparten av farten (ikke i taket).
          const m = 3;
          if (x[i] < m || x[i] > this.width - m || y[i] > this.height - m) {
            vx[i] *= 1 - stick;
            vy[i] *= 1 - stick;
          }
        }
      }
      this.drain();
    }

    /**
     * Elastiske fjærer mellom naboer i seig væske (Clavet m.fl., avsnitt 5.1–5.2).
     * Nye naboer får en fjær med dagens avstand som hvilelengde. Strekkes eller trykkes
     * fjæren mer enn «flytegrensen», gir hvilelengden sakte etter – da siger væsken.
     */
    applySprings() {
      const n = this.count;
      const { x, y, mat, uid, h } = this;
      let any = false;
      for (let i = 0; i < n; i++) if (MATERIALS[mat[i]].spring) { any = true; break; }
      if (!any) {
        if (this.springs.size) this.springs.clear();
        return;
      }
      const index = new Map();
      for (let i = 0; i < n; i++) if (MATERIALS[mat[i]].spring) index.set(uid[i], i);
      const springs = this.springs;
      const MAX_SPRINGS = 12000;
      // Nye fjærer mellom naboer av samme seige væske.
      this.buildGrid();
      this.forPairs((i, j, q) => {
        if (mat[i] !== mat[j] || !MATERIALS[mat[i]].spring || springs.size >= MAX_SPRINGS) return;
        const a = Math.min(uid[i], uid[j]);
        const b = Math.max(uid[i], uid[j]);
        const key = a * 4194304 + b;
        if (!springs.has(key)) springs.set(key, q * h);
      });
      for (const [key, L0] of springs) {
        const a = Math.floor(key / 4194304);
        const b = key - a * 4194304;
        const i = index.get(a);
        const j = index.get(b);
        if (i === undefined || j === undefined) { springs.delete(key); continue; }
        const dx = x[j] - x[i];
        const dy = y[j] - y[i];
        const r = Math.hypot(dx, dy);
        const m = MATERIALS[mat[i]];
        const gamma = m.yield; // flytegrense (andel av hvilelengden)
        const alpha = m.plastic; // hvor fort fjæren gir etter
        let L = L0;
        const d = gamma * L;
        if (r > L + d) L += alpha * (r - L - d);
        else if (r < L - d) L -= alpha * (L - d - r);
        if (L > h || r > h * 1.5 || r < 1e-4) { springs.delete(key); continue; }
        springs.set(key, L);
        // Korriger aldri mer enn knapt halve avviket per side – da kan fjæren ikke overskyte.
        const D = Math.min(0.5 * m.spring * (1 - L / h), 0.45) * (L - r);
        const ux = dx / r;
        const uy = dy / r;
        x[i] -= D * ux;
        y[i] -= D * uy;
        x[j] += D * ux;
        y[j] += D * uy;
      }
    }

    smoothVelocities() {
      const n = this.count;
      const { vx, vy, mat } = this;
      let any = false;
      for (let i = 0; i < n; i++) if (MATERIALS[mat[i]].smooth) { any = true; break; }
      if (!any) return;
      const sx = this.sxBuf && this.sxBuf.length === this.max ? this.sxBuf : (this.sxBuf = new Float32Array(this.max));
      const sy = this.syBuf && this.syBuf.length === this.max ? this.syBuf : (this.syBuf = new Float32Array(this.max));
      const sw = this.swBuf && this.swBuf.length === this.max ? this.swBuf : (this.swBuf = new Float32Array(this.max));
      sx.fill(0, 0, n);
      sy.fill(0, 0, n);
      sw.fill(0, 0, n);
      this.forPairs((i, j, q) => {
        if (mat[i] !== mat[j] || !MATERIALS[mat[i]].smooth) return;
        const w = 1 - q;
        sx[i] += vx[j] * w; sy[i] += vy[j] * w; sw[i] += w;
        sx[j] += vx[i] * w; sy[j] += vy[i] * w; sw[j] += w;
      });
      for (let i = 0; i < n; i++) {
        const c = MATERIALS[mat[i]].smooth;
        if (!c || sw[i] === 0) continue;
        vx[i] += (sx[i] / sw[i] - vx[i]) * c;
        vy[i] += (sy[i] / sw[i] - vy[i]) * c;
      }
    }

    color(i) {
      const fixed = MATERIALS[this.mat[i]].color;
      return fixed || ryb2rgb(this.cr[i], this.cy[i], this.cb[i]);
    }
  }

  const api = { FluidSim, LIQUIDS, MATERIALS, PAINTS, ryb2rgb, makeObstacle, obstacleDistance };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PaizonFluid = api;
})(typeof window !== 'undefined' ? window : globalThis);
