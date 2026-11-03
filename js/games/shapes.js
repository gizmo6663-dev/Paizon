/* Farger og former: «Finn den røde sirkelen». */
(function () {
  'use strict';

  const P = window.Paizon;
  const L = window.PaizonLogic;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $ } = P;

  const settings = P.settings('shapes', { mode: 'farger', choices: 3, rounds: 5 });

  // Figurene tegnes i en 100×100-boks.
  const SVG = {
    sirkel: '<circle cx="50" cy="50" r="42"/>',
    firkant: '<rect x="10" y="10" width="80" height="80" rx="6"/>',
    trekant: '<polygon points="50,8 94,88 6,88" stroke-linejoin="round"/>',
    stjerne: '<polygon points="50,5 61,38 96,38 68,59 78,93 50,73 22,93 32,59 4,38 39,38" stroke-linejoin="round"/>',
    hjerte: '<path d="M50 90 C 20 68 4 50 4 31 C 4 16 16 6 29 6 C 39 6 46 12 50 20 C 54 12 61 6 71 6 C 84 6 96 16 96 31 C 96 50 80 68 50 90 Z"/>',
    oval: '<ellipse cx="50" cy="50" rx="46" ry="30"/>',
  };

  const itemsEl = $('#shapes-items');
  const promptEl = $('#shapes-prompt');
  const feedbackEl = $('#shapes-feedback');
  let game = null;
  let session = 0;

  function start() {
    session++;
    game = { index: 0, round: null };
    P.show('shapes');
    loadRound();
  }

  function loadRound() {
    const round = L.buildShapeRound(settings.mode, settings.choices);
    game.round = round;
    game.done = false;
    P.renderProgress($('#shapes-progress'), game.index, settings.rounds);
    promptEl.textContent = round.prompt;
    feedbackEl.textContent = '';
    itemsEl.innerHTML = '';
    itemsEl.style.setProperty('--cols', round.items.length === 4 ? 2 : Math.min(3, round.items.length));
    for (const item of round.items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'shape-btn';
      b.style.setProperty('--delay', `${item.id * 0.06}s`);
      b.setAttribute('aria-label', L.shapeDescription(item, 'begge').replace(/^Det er /, ''));
      b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true" fill="${item.color.hex}" stroke="rgba(0,0,0,.15)" stroke-width="3">${SVG[item.shape.key]}</svg>`;
      b.addEventListener('click', () => choose(item, b));
      itemsEl.appendChild(b);
    }
    const s = session;
    setTimeout(() => s === session && Speech.speak(round.prompt), 350);
  }

  async function choose(item, el) {
    if (game.done) return;
    Sound.unlock();
    const s = session;
    if (item.id !== game.round.targetId) {
      Sound.wrong();
      P.restartAnimation(el, 'shake');
      // Fortell hva barnet faktisk trykket på – det lærer også bort noe.
      const said = L.shapeDescription(item, settings.mode);
      feedbackEl.textContent = `${said}. Prøv igjen!`;
      Speech.speak(`${said}. ${game.round.prompt}`);
      return;
    }
    game.done = true;
    el.classList.add('right');
    Sound.correct();
    window.PaizonConfetti.burst(50);
    feedbackEl.textContent = P.pick(P.PRAISE);
    await Speech.speak(feedbackEl.textContent);
    await P.wait(500);
    if (s !== session) return;
    if (game.index >= settings.rounds - 1) {
      P.showDone({
        icon: '🎨',
        summary: 'Du fant alle sammen!',
        again: start,
        setup: 'shapes-setup',
      });
    } else {
      game.index++;
      loadRound();
    }
  }

  $('#shapes-speak').addEventListener('click', () => game && Speech.speak(game.round.prompt));

  P.registerGame('shapes', {
    screen: 'shapes',
    setupScreen: 'shapes-setup',
    start,
    stop() {
      session++;
      Speech.stop();
    },
  });
})();
