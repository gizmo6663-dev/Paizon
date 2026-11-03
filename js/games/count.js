/* Telle: trykk på tingene for å telle høyt, og velg riktig tall. */
(function () {
  'use strict';

  const P = window.Paizon;
  const L = window.PaizonLogic;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const { $ } = P;

  const settings = P.settings('count', { max: 10, rounds: 5 });

  const itemsEl = $('#count-items');
  const optionsEl = $('#count-options');
  const feedbackEl = $('#count-feedback');
  let game = null;
  let session = 0;

  function start() {
    session++;
    game = { index: 0, round: null, previous: null };
    P.show('count');
    loadRound();
  }

  function loadRound() {
    const round = L.buildCountRound(settings.max, null, game.previous);
    game.previous = round.count;
    game.round = round;
    game.counted = 0;
    game.done = false;
    P.renderProgress($('#count-progress'), game.index, settings.rounds);
    feedbackEl.textContent = '';

    itemsEl.innerHTML = '';
    itemsEl.classList.toggle('many', round.count > 10);
    for (let i = 0; i < round.count; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'count-item';
      b.style.setProperty('--delay', `${i * 0.04}s`);
      b.innerHTML = '<span class="count-emoji"></span><span class="count-badge" aria-hidden="true"></span>';
      b.firstChild.textContent = round.emoji;
      b.setAttribute('aria-label', 'Trykk for å telle');
      b.addEventListener('click', () => countItem(b));
      itemsEl.appendChild(b);
    }

    optionsEl.innerHTML = '';
    for (const n of round.options) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'number-btn';
      b.textContent = n;
      b.addEventListener('click', () => answer(n, b));
      optionsEl.appendChild(b);
    }
  }

  function countItem(el) {
    if (game.done) return;
    Sound.unlock();
    if (el.classList.contains('counted')) {
      Speech.speak(el.dataset.number);
      return;
    }
    game.counted++;
    el.dataset.number = game.counted;
    el.classList.add('counted');
    el.lastChild.textContent = game.counted;
    el.setAttribute('aria-label', `Nummer ${game.counted}`);
    P.restartAnimation(el, 'pop');
    Speech.speak(String(game.counted), 1);
  }

  /** «Tell sammen med meg»: teller alle tingene høyt, én etter én. */
  async function countTogether() {
    if (game.done) return;
    const s = session;
    for (const el of itemsEl.children) {
      el.classList.remove('counted');
      el.lastChild.textContent = '';
    }
    game.counted = 0;
    Sound.hint();
    for (const el of Array.from(itemsEl.children)) {
      if (s !== session || game.done) return;
      countItem(el);
      await P.wait(800);
    }
  }

  async function answer(n, btn) {
    if (game.done) return;
    Sound.unlock();
    const s = session;
    if (n !== game.round.count) {
      Sound.wrong();
      P.restartAnimation(btn, 'shake');
      feedbackEl.textContent = 'Prøv å telle en gang til 🙂';
      return;
    }
    game.done = true;
    btn.classList.add('right');
    Sound.correct();
    feedbackEl.textContent = `${P.pick(P.PRAISE)} Det er ${n}!`;
    window.PaizonConfetti.burst(60);
    await Speech.speak(`${n}! ${P.pick(P.PRAISE)}`);
    await P.wait(600);
    if (s !== session) return;
    if (game.index >= settings.rounds - 1) {
      P.showDone({
        icon: '🔢',
        summary: `Du har telt ${settings.rounds} ganger!`,
        again: start,
        setup: 'count-setup',
      });
    } else {
      game.index++;
      loadRound();
    }
  }

  $('#count-help').addEventListener('click', countTogether);

  P.registerGame('count', {
    screen: 'count',
    setupScreen: 'count-setup',
    start,
    stop() {
      session++;
      Speech.stop();
    },
  });
})();
