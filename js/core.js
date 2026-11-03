/* Paizon – felles skall for alle spillene: skjermer, lagring, innstillinger og hjelpere. */
(function () {
  'use strict';

  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const Letters = window.PaizonLetters;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  // ---------- Lagring ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('paizon.' + key);
        return v === null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem('paizon.' + key, JSON.stringify(value)); } catch (e) { /* ignorer */ }
    },
  };

  /** Innstillinger for ett spill, lagret på enheten. Ukjente nøkler får standardverdien. */
  const settingsCache = {};
  function settings(game, defaults) {
    if (!settingsCache[game]) {
      settingsCache[game] = Object.assign({}, defaults, store.get('game.' + game, {}));
    }
    return settingsCache[game];
  }
  function saveSettings(game) {
    store.set('game.' + game, settingsCache[game]);
  }

  // ---------- Små hjelpere ----------
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function restartAnimation(el, cls) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth; // tving reflow slik at animasjonen starter på nytt
    el.classList.add(cls);
  }

  function renderProgress(el, index, total) {
    el.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i < index ? ' done' : i === index ? ' current' : '');
      el.appendChild(dot);
    }
    el.setAttribute('aria-label', `Oppgave ${index + 1} av ${total}`);
  }

  const PRAISE = ['Supert!', 'Kjempebra!', 'Så flink du er!', 'Fantastisk!', 'Strålende!', 'Du klarte det!', 'Wow!', 'Godt jobbet!'];
  const ENCOURAGE = ['Nesten! Prøv igjen 🙂', 'Prøv en gang til', 'Ikke helt – du klarer det!', 'Hmm, prøv igjen'];

  // ---------- Skjermer ----------
  const games = {};
  let currentScreen = 'home';

  function show(name) {
    const leaving = currentScreen;
    currentScreen = name;
    for (const [key, game] of Object.entries(games)) {
      if (leaving === game.screen && name !== game.screen && game.stop) game.stop();
    }
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    const screenEl = $('#screen-' + name);
    document.body.dataset.screen = name;
    document.body.classList.toggle('in-game', !!(screenEl && screenEl.classList.contains('game-screen')));
    for (const game of Object.values(games)) {
      if (game.setupScreen === name && game.onSetup) game.onSetup();
    }
    window.scrollTo(0, 0);
  }

  /** Registrer et spill: { screen, setupScreen, start(), stop(), onSetup() }. */
  function registerGame(key, game) {
    games[key] = game;
  }

  // ---------- Ferdig-skjerm ----------
  let doneAgain = null;
  let doneSetup = 'home';
  function showDone({ icon, title, summary, items, again, setup }) {
    $('#done-icon').textContent = icon || '🎉';
    $('#done-title').textContent = title || pick(PRAISE);
    $('#done-summary').textContent = summary || '';
    const list = $('#done-list');
    list.innerHTML = '';
    for (const text of items || []) {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    }
    list.hidden = !(items && items.length);
    doneAgain = again;
    doneSetup = setup || 'home';
    show('done');
    window.PaizonConfetti.burst(200);
    Sound.win();
  }
  $('#done-again').addEventListener('click', () => { Sound.tap(); if (doneAgain) doneAgain(); });
  $('#done-setup').addEventListener('click', () => { Sound.tap(); show(doneSetup); });

  // ---------- Navigasjon ----------
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (go) {
      Sound.unlock();
      Sound.tap();
      show(go.dataset.go);
      return;
    }
    const start = e.target.closest('[data-start]');
    if (start && games[start.dataset.start]) {
      Sound.unlock();
      games[start.dataset.start].start();
    }
  });

  // ---------- Lyd-knapp ----------
  const soundBtn = $('#sound-btn');
  function renderSoundBtn() {
    soundBtn.textContent = Sound.isMuted() ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-pressed', String(!Sound.isMuted()));
  }
  soundBtn.addEventListener('click', () => {
    Sound.setMuted(!Sound.isMuted());
    renderSoundBtn();
    if (!Sound.isMuted()) Sound.tap();
  });
  renderSoundBtn();

  // ---------- Valgknapper i oppsettene ----------
  // <div class="choice-row" data-game="count" data-key="max"><button data-value="5">…
  function bindChoices(root) {
    $$('.choice-row[data-game]', root).forEach((row) => {
      const game = row.dataset.game;
      const key = row.dataset.key;
      const render = () => {
        const value = String(settingsCache[game][key]);
        $$('button', row).forEach((b) => {
          b.type = 'button';
          b.classList.toggle('active', b.dataset.value === value);
          b.setAttribute('aria-pressed', String(b.dataset.value === value));
        });
      };
      row.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-value]');
        if (!b) return;
        const current = settingsCache[game][key];
        settingsCache[game][key] = typeof current === 'number' ? Number(b.dataset.value) : b.dataset.value;
        saveSettings(game);
        render();
        Sound.unlock();
        Sound.tap();
      });
      render();
    });
    $$('input[type="checkbox"][data-game]', root).forEach((input) => {
      const { game, key } = input.dataset;
      input.checked = !!settingsCache[game][key];
      input.addEventListener('change', () => {
        settingsCache[game][key] = input.checked;
        saveSettings(game);
      });
    });
  }

  // ---------- Hold inne 🏠 for å avslutte ----------
  // Så barnet ikke går ut av et spill ved et uhell.
  const HOLD_MS = 1000;
  $$('.hold-btn[data-exit]').forEach((btn) => {
    let timer = null;
    const exit = () => {
      Speech.stop();
      Letters.stop();
      show(btn.dataset.exit);
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('holding');
      timer = setTimeout(() => {
        btn.classList.remove('holding');
        timer = null;
        exit();
      }, HOLD_MS);
    });
    const release = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        toast('Hold inne 🏠 for å avslutte');
      }
      btn.classList.remove('holding');
    };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, release));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); exit(); }
    });
  });

  // ---------- Oppstart ----------
  function boot() {
    bindChoices(document);
    show('home');

    // Android-appen: maskinvarens tilbake-knapp går ett steg tilbake i stedet for å lukke appen.
    // I spillene må 🏠 holdes inne, så barnet ikke avslutter ved et uhell.
    const NativeApp = window.PaizonNativePlugin('App');
    const listen = (event, handler) => {
      try {
        Promise.resolve(NativeApp.addListener(event, handler)).catch(() => {});
      } catch (e) { /* tilbake-knappen virker da som vanlig */ }
    };
    if (NativeApp) {
      listen('backButton', () => {
        if (document.body.classList.contains('in-game')) {
          toast('Hold inne 🏠 for å avslutte');
        } else if (currentScreen === 'home') {
          NativeApp.exitApp();
        } else {
          show('home');
        }
      });
      listen('pause', () => { Speech.stop(); Letters.stop(); });
    }

    if (!NativeApp && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  window.Paizon = {
    $, $$, wait, pick, store, settings, saveSettings, toast, restartAnimation, renderProgress,
    PRAISE, ENCOURAGE, show, registerGame, showDone, boot,
    get screen() { return currentScreen; },
  };
})();
