/*
 * Rommet (prøveversjon): oppskytingen og turen til Månen, i 2D eller 3D.
 * Denne fila styrer forløpet, lyden, radioen og knappene. Tegningen gjøres av
 * space/proto2d.js eller space/proto3d.js, som får den samme tilstanden hvert bilde.
 *
 * Faser: pad → ignition → ascent → orbit → burn → transfer → landing → landed → moon
 */
(function () {
  'use strict';

  const P = window.Paizon;
  const S = window.PaizonSpace;
  const Sound = window.PaizonSound;
  const { $, $$ } = P;
  const { clamp, smooth } = S;

  const wrap = $('#space-world');
  const ui = {
    readout: $('#space-readout'),
    radio: $('#space-radio'),
    radioText: $('#space-radio-text'),
    action: $('#space-action'),
    ff: $('#space-ff'),
    count: $('#space-count'),
    loading: $('#space-loading'),
  };
  const audio = S.createAudio();
  let mode = '2d';
  let renderer = null;
  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let st = null;
  let lastVib = 0;
  let actionFn = null;
  let token = 0;

  const fmt = (n) => Math.round(n).toLocaleString('nb-NO');

  function fresh() {
    return {
      phase: 'pad', pt: 0, t: 0, alt: 0, speed: 0, charge: 0, thrust: 0, air: 1, shake: 0,
      sepAt: -1, stage: 'full', prog: 0, dist: 384400, ff: false, land: 0, holding: false,
      astro: { x: 2, y: 0, vy: 0, vx: 0, tx: null, onGround: true, dir: 1, pose: 'stand', walkT: 0 },
      prints: [], said: {},
    };
  }

  // ---------- Radio ----------
  let radioHide = 0;
  function say(key, text) {
    if (st.said[key]) return;
    st.said[key] = true;
    audio.radio(text, (shown, done) => {
      clearTimeout(radioHide);
      if (shown) {
        ui.radioText.textContent = shown;
        ui.radio.hidden = false;
      } else if (done && ui.radioText.textContent === done) {
        radioHide = setTimeout(() => { ui.radio.hidden = true; }, 600);
      }
    });
  }

  // ---------- Knapper ----------
  function showAction(label, fn, hold) {
    actionFn = fn;
    ui.action.textContent = label;
    ui.action.classList.toggle('hold', !!hold);
    ui.action.hidden = false;
    ui.action.style.setProperty('--p', '0');
  }
  function hideAction() {
    actionFn = null;
    ui.action.hidden = true;
  }
  ui.action.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    Sound.unlock();
    audio.start();
    if (st && st.phase === 'pad') st.holding = true;
  });
  const release = () => { if (st) st.holding = false; };
  ui.action.addEventListener('pointerup', release);
  ui.action.addEventListener('pointerleave', release);
  ui.action.addEventListener('pointercancel', release);
  ui.action.addEventListener('click', () => {
    if (st && st.phase !== 'pad' && actionFn) {
      Sound.tap();
      const f = actionFn;
      hideAction();
      f();
    }
  });
  ui.ff.addEventListener('pointerdown', (e) => { e.preventDefault(); if (st) st.ff = true; });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) ui.ff.addEventListener(ev, () => { if (st) st.ff = false; });

  // Trykk i bildet på Månen: kort trykk = hopp, dra = gå dit.
  let press = null;
  wrap.addEventListener('pointerdown', (e) => {
    if (e.target !== wrap && !e.target.matches('canvas')) return;
    Sound.unlock();
    audio.start();
    if (!st || st.phase !== 'moon') return;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
  });
  wrap.addEventListener('pointermove', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 12) press.moved = true;
    if (press.moved) st.astro.tx = worldX(e.clientX);
  });
  wrap.addEventListener('pointerup', (e) => {
    if (!press || e.pointerId !== press.id) return;
    if (!press.moved && performance.now() - press.t < 350) jump();
    else if (!press.moved) st.astro.tx = worldX(e.clientX);
    press = null;
  });
  function worldX(clientX) {
    const r = wrap.getBoundingClientRect();
    return st.astro.x + ((clientX - r.left) / r.width - 0.5) * 9;
  }
  function jump() {
    const a = st.astro;
    if (!a.onGround) return;
    a.vy = 2.6; // ca. 2 meter høyt på Månen – seks ganger så høyt som hjemme
    a.onGround = false;
    audio.hiss(0.3);
  }

  // ---------- Faser ----------
  function go(phase) {
    st.phase = phase;
    st.pt = 0;
    hideAction();
    ui.ff.hidden = phase !== 'transfer';
    if (renderer && renderer.onPhase) renderer.onPhase(phase, st);
    if (phase === 'ignition') {
      say('ign', 'Tenning! Motorene starter.');
      audio.swell('launch', 0.5);
    }
    if (phase === 'ascent') say('lift', 'Vi har løftet! Motorene er sterkere enn tusenvis av biler til sammen.');
    if (phase === 'orbit') {
      audio.swell('earth', 1);
      setTimeout(() => st && st.phase === 'orbit' && say('orb', 'Se på jorda! Vi suser rundt hele kloden på halvannen time.'), 2500);
    }
    if (phase === 'burn') say('burn', 'Motorene på igjen! Kurs mot Månen.');
    if (phase === 'transfer') {
      audio.bed(true);
      setTimeout(() => st && st.phase === 'transfer' && say('far', 'Månen er tre hundre og åttifire tusen kilometer unna. Alle de andre planetene får plass mellom jorda og Månen!'), 1500);
    }
    if (phase === 'landing') {
      audio.bed(false);
      say('land', 'Vi lander. Motorene bremser oss forsiktig ned.');
    }
    if (phase === 'landed') say('down', 'Vi har landet på Månen!');
    if (phase === 'moon') {
      setTimeout(() => st && st.phase === 'moon' && audio.swell('moon', 0.9), 2500);
      say('walk', 'Trykk for å hoppe, og dra for å gå. På Månen hopper du seks ganger så høyt som hjemme!');
    }
  }

  function restart() {
    audio.bed(false);
    st = fresh();
    go('pad');
    showAction('🚀 Hold inne for å skyte opp', null, true);
    say('pad', 'Paizon kontroll her. Raketten er klar. Hold inne den store knappen for å starte motorene!');
  }

  function update(dt) {
    st.pt += dt;
    st.t += dt;
    const a = st.astro;
    switch (st.phase) {
      case 'pad':
        st.charge = clamp(st.charge + (st.holding ? dt / 2.4 : -dt * 1.5), 0, 1);
        st.thrust = st.charge * 0.22;
        st.shake = st.charge * 0.25;
        ui.action.style.setProperty('--p', String(st.charge));
        if (st.charge >= 1) go('ignition');
        break;
      case 'ignition':
        st.thrust = 0.22 + 0.78 * smooth(st.pt / 2.2);
        st.shake = st.thrust;
        if (st.pt >= 2.2) go('ascent');
        break;
      case 'ascent': {
        const p = Math.min(1, st.pt / 24);
        st.alt = 400 * Math.pow(p, 2.6);
        st.air = Math.exp(-st.alt / 18);
        st.speed = 28000 * Math.pow(smooth(p), 1.3);
        if (st.alt >= 60 && st.sepAt < 0) {
          st.sepAt = st.t;
          st.stage = 'top';
          audio.clunk();
          S.vibrate(120);
          say('sep', 'Første trinn er tomt for drivstoff. Vi slipper det!');
        }
        st.thrust = st.alt < 60 ? 1 : st.alt < 370 ? 0.8 : 0;
        st.shake = st.thrust * (0.15 + 0.85 * st.air);
        if (st.alt > 10) say('10', 'Ti kilometer. Her oppe flyr flyene.');
        if (st.alt > 100) say('100', 'Hundre kilometer. Velkommen til verdensrommet! Hører du hvor stille det er? Her er det ingen luft som kan bære lyd.');
        if (p >= 1) go('orbit');
        break;
      }
      case 'orbit':
        st.thrust = 0;
        st.shake = 0;
        st.alt = 400;
        if (st.pt > 6 && !actionFn) showAction('🌕 Fly til Månen', () => go('burn'));
        break;
      case 'burn':
        st.thrust = 0.85 * (1 - smooth((st.pt - 1.8) / 0.5));
        st.shake = st.thrust * 0.2;
        if (st.pt >= 2.3) go('transfer');
        break;
      case 'transfer':
        st.thrust = 0;
        st.shake = 0;
        st.prog = Math.min(1, st.prog + (dt / 26) * (st.ff ? 5 : 1));
        st.dist = 384400 * (1 - st.prog);
        if (st.prog > 0.5) say('half', 'Halvveis! Se så liten jorda har blitt bak oss.');
        if (st.prog >= 1) go('landing');
        break;
      case 'landing':
        st.land = Math.min(1, st.pt / 7);
        st.thrust = st.land < 1 ? 0.6 + 0.25 * Math.sin(st.pt * 5) : 0;
        st.shake = st.thrust * 0.15 * (0.3 + st.land);
        if (Math.random() < dt * 3) audio.hiss(0.6 + st.land);
        if (st.pt >= 7) {
          audio.thud(1, 70);
          S.vibrate(220);
          go('landed');
        }
        break;
      case 'landed':
        st.thrust = 0;
        st.shake = 0;
        if (st.pt > 2 && !actionFn) showAction('👩‍🚀 Gå ut på Månen', () => go('moon'));
        break;
      case 'moon': {
        // Tyngdekraften på Månen er 1,62 m/s² – en sjettedel av jordas.
        const g = 1.62;
        if (a.tx != null) {
          const dx = a.tx - a.x;
          if (Math.abs(dx) < 0.15) a.tx = null;
          else {
            a.dir = Math.sign(dx);
            a.vx = a.dir * 1.6;
            if (a.onGround) {
              // Små kengurusprett, slik astronautene på Månen faktisk gikk.
              a.vy = 1.0;
              a.onGround = false;
            }
          }
        }
        if (a.tx == null && a.onGround) a.vx *= Math.pow(0.02, dt);
        a.x += a.vx * dt;
        if (!a.onGround) {
          a.vy -= g * dt;
          a.y += a.vy * dt;
          if (a.y <= 0) {
            a.y = 0;
            a.onGround = true;
            const hard = Math.min(1, Math.abs(a.vy) / 2.6);
            a.vy = 0;
            st.prints.push({ x: a.x, dir: a.dir });
            if (st.prints.length > 60) st.prints.shift();
            audio.thud(0.25 + hard * 0.4, 60);
          }
        }
        a.pose = !a.onGround ? 'jump' : Math.abs(a.vx) > 0.2 ? 'walk' : 'stand';
        if (st.pt > 6 && !actionFn) showAction('🏠 Fly hjem igjen', restart);
        break;
      }
    }
    // Lyd.
    const launch = st.phase === 'pad' || st.phase === 'ignition' || st.phase === 'ascent';
    const space = !launch && st.phase !== 'moon';
    audio.update({
      thrust: launch ? st.thrust : st.phase === 'burn' ? st.thrust * 0.5 : st.phase === 'landing' ? st.thrust * 0.4 : 0,
      air: launch ? st.air : 0.03,
      wind: st.phase === 'pad' ? 1 : st.phase === 'ignition' ? 0.6 : 0,
      hum: space || (st.phase === 'ascent' && st.alt > 60) ? 1 : 0,
      breath: st.phase === 'moon',
    });
    // Telefonen rister når motorene drønner.
    if ((st.phase === 'ignition' || st.phase === 'ascent' || st.phase === 'landing') && st.thrust * st.air > 0.3 && time - lastVib > 0.28) {
      lastVib = time;
      S.vibrate(Math.round(120 + 160 * st.thrust * st.air));
    }
    renderHud();
  }

  function renderHud() {
    let txt = '';
    switch (st.phase) {
      case 'pad':
      case 'ignition':
        txt = 'Utskytningsrampa';
        break;
      case 'ascent':
        txt = `Høyde ${fmt(st.alt)} km · ${fmt(st.speed)} km/t`;
        break;
      case 'orbit':
        txt = 'I bane rundt jorda · 400 km · 28 000 km/t';
        break;
      case 'burn':
      case 'transfer':
        txt = `Til Månen: ${fmt(st.dist)} km`;
        break;
      case 'landing':
        txt = `Over Månen: ${fmt(2000 * Math.pow(1 - st.land, 2))} m`;
        break;
      default:
        txt = 'På Månen · tyngdekraft 1/6';
    }
    if (ui.readout.textContent !== txt) ui.readout.textContent = txt;
    const c = st.phase === 'pad' && st.charge > 0.02 ? String(3 - Math.min(2, Math.floor(st.charge * 3))) : st.phase === 'ignition' ? '🔥' : '';
    if (ui.count.textContent !== c) {
      ui.count.textContent = c;
      ui.count.classList.remove('pop');
      void ui.count.offsetWidth;
      if (c) ui.count.classList.add('pop');
    }
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    time += dt;
    update(dt);
    if (renderer) renderer.frame(st, dt);
    raf = requestAnimationFrame(loop);
  }

  async function start(m) {
    const my = ++token;
    mode = m === '3d' ? '3d' : '2d';
    P.show('space');
    document.body.dataset.spaceMode = mode;
    if (renderer) renderer.destroy();
    renderer = null;
    st = fresh();
    ui.radio.hidden = true;
    ui.ff.hidden = true;
    hideAction();
    ui.loading.hidden = false;
    ui.loading.textContent = mode === '3d' ? 'Bygger 3D-verdenen …' : 'Klargjør raketten …';
    await new Promise((r) => setTimeout(r, 50));
    let r = null;
    try {
      r = mode === '3d' ? await S.create3D(wrap) : S.create2D(wrap);
    } catch (e) {
      console.error(e);
      ui.loading.textContent = '3D virker ikke på denne enheten. Prøv 2D.';
      return;
    }
    if (my !== token) {
      r.destroy();
      return;
    }
    renderer = r;
    ui.loading.hidden = true;
    audio.start();
    restart();
    if (!running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  }

  function stop() {
    token++;
    running = false;
    cancelAnimationFrame(raf);
    audio.bed(false);
    audio.stop();
    if (renderer) renderer.destroy();
    renderer = null;
  }

  window.addEventListener('resize', () => { if (renderer && renderer.resize) renderer.resize(); });
  $$('[data-space]').forEach((b) => b.addEventListener('click', () => {
    Sound.unlock();
    start(b.dataset.space);
  }));

  P.registerGame('space', { screen: 'space', setupScreen: 'space-setup', start: () => start('2d'), stop });

  // For tester og feilsøking.
  window.PaizonSpaceGame = {
    start,
    get state() { return st; },
    get renderer() { return renderer; },
    go: (p) => go(p),
    set(o) { Object.assign(st, o); },
    jump,
  };
})();
