/* Memory: snu to kort om gangen og finn like par. */
(function () {
  'use strict';

  const P = window.Paizon;
  const L = window.PaizonLogic;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $ } = P;

  const settings = P.settings('memory', { pairs: 6, theme: 'dyr', showWord: true, speak: true });

  // Temaknapper bygges fra logikken, så nye temaer bare trenger å legges til der.
  const themeRow = $('#memory-themes');
  for (const [key, theme] of Object.entries(L.MEMORY_THEMES)) {
    const b = document.createElement('button');
    b.dataset.value = key;
    b.textContent = `${theme.icon} ${theme.name}`;
    themeRow.appendChild(b);
  }
  const mixed = document.createElement('button');
  mixed.dataset.value = 'blandet';
  mixed.textContent = '🎲 Blandet';
  themeRow.appendChild(mixed);

  const board = $('#memory-board');
  const statusEl = $('#memory-status');
  let game = null;
  let session = 0;

  /** Velg antall kolonner som gir størst mulige kort på denne skjermen (stående eller liggende). */
  function layoutBoard() {
    if (!game) return;
    const n = game.cards.length;
    const gap = Math.max(8, Math.min(14, window.innerWidth * 0.02));
    const width = window.innerWidth - 32;
    const height = window.innerHeight - 120;
    let best = { cols: 4, size: 0 };
    for (let cols = 2; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      const size = Math.min(150, (width - (cols - 1) * gap) / cols, (height - (rows - 1) * gap) / rows / 1.2);
      if (size > best.size) best = { cols, size };
    }
    board.style.setProperty('--cols', best.cols);
    board.style.setProperty('--rows', Math.ceil(n / best.cols));
  }
  window.addEventListener('resize', layoutBoard);

  function start() {
    session++;
    const cards = L.buildMemoryDeck(settings.pairs, settings.theme);
    game = { cards, open: [], found: 0, locked: false };
    P.show('memory');
    statusEl.textContent = 'Finn to like kort';
    board.innerHTML = '';
    layoutBoard();
    for (const card of cards) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'memory-card';
      b.style.setProperty('--delay', `${card.id * 0.03}s`);
      b.setAttribute('aria-label', 'Skjult kort');
      b.innerHTML = `
        <span class="card-inner">
          <span class="card-back" aria-hidden="true">🦉</span>
          <span class="card-front"><span class="card-emoji"></span><span class="card-word"></span></span>
        </span>`;
      b.querySelector('.card-emoji').textContent = card.emoji;
      b.querySelector('.card-word').textContent = settings.showWord ? card.word.toLocaleUpperCase('nb-NO') : '';
      b.addEventListener('click', () => flip(card, b));
      card.el = b;
      board.appendChild(b);
    }
  }

  async function flip(card, el) {
    if (game.locked || card.matched || game.open.includes(card)) return;
    Sound.unlock();
    Sound.flip();
    el.classList.add('flipped');
    el.setAttribute('aria-label', card.word);
    game.open.push(card);
    if (settings.speak) Speech.speak(card.word);
    if (game.open.length < 2) return;

    const [a, b] = game.open;
    const s = session;
    game.locked = true;
    if (a.pair === b.pair) {
      await P.wait(500);
      if (s !== session) return;
      a.matched = b.matched = true;
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      Sound.correct();
      game.found++;
      game.open = [];
      game.locked = false;
      statusEl.textContent = `${P.pick(P.PRAISE)} Du fant to like!`;
      if (game.found === settings.pairs) finish();
    } else {
      await P.wait(1100);
      if (s !== session) return;
      a.el.classList.remove('flipped');
      b.el.classList.remove('flipped');
      a.el.setAttribute('aria-label', 'Skjult kort');
      b.el.setAttribute('aria-label', 'Skjult kort');
      game.open = [];
      game.locked = false;
      statusEl.textContent = 'Ikke like – prøv igjen!';
    }
  }

  async function finish() {
    const s = session;
    await P.wait(700);
    if (s !== session) return;
    const words = [];
    for (const c of game.cards) if (!words.some((w) => w.pair === c.pair)) words.push(c);
    P.showDone({
      icon: '🧩',
      summary: 'Du fant alle parene:',
      items: words.map((c) => `${c.emoji}  ${c.word.toLocaleUpperCase('nb-NO')}`),
      again: start,
      setup: 'memory-setup',
    });
  }

  P.registerGame('memory', {
    screen: 'memory',
    setupScreen: 'memory-setup',
    start,
    stop() {
      session++;
      Speech.stop();
    },
  });
})();
