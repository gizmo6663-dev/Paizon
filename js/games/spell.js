/* Stave ord: dra bokstavene til riktig boks. */
(function () {
  'use strict';

  const P = window.Paizon;
  const L = window.PaizonLogic;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const Letters = window.PaizonLetters;
  const { $, $$ } = P;

  const DEFAULTS = {
    text: 'katt, hund, sol',
    difficulty: 'lett',
    hintAfter: 2,
    extraLetters: 'auto',
    letterCase: 'upper',
    childName: '',
    shuffleWords: false,
    speakWord: true,
    letterSound: true,
    spellOut: true,
    showPicture: true,
  };
  // Tidligere versjoner lagret innstillingene under «settings».
  const legacy = P.store.get('settings', null);
  if (legacy && !P.store.get('game.spell', null)) P.store.set('game.spell', legacy);
  const settings = P.settings('spell', DEFAULTS);
  const save = () => P.saveSettings('spell');

  function display(letter) {
    return settings.letterCase === 'lower' ? letter.toLocaleLowerCase('nb-NO') : letter;
  }
  function displayWord(word) {
    return word.split('').map(display).join('');
  }

  // ======================= OPPSETT =======================
  const wordInput = $('#word-input');
  const startBtn = $('#spell-start');

  function renderWordPreview() {
    const words = L.parseWords(settings.text);
    const box = $('#word-preview');
    box.innerHTML = '';
    for (const w of words) {
      const chip = document.createElement('span');
      chip.className = 'chip';
      const emoji = settings.showPicture ? L.emojiFor(w) : '';
      chip.textContent = (emoji ? emoji + ' ' : '') + displayWord(w);
      box.appendChild(chip);
    }
    startBtn.disabled = words.length === 0;
    startBtn.textContent = words.length ? `Start ▶  (${words.length} ord)` : 'Skriv minst ett ord';
  }

  function setWords(text) {
    settings.text = text;
    wordInput.value = text;
    save();
    renderWordPreview();
  }

  wordInput.value = settings.text;
  wordInput.addEventListener('input', () => {
    settings.text = wordInput.value;
    save();
    renderWordPreview();
  });

  // Ferdige lister
  for (const preset of L.PRESET_LISTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.innerHTML = `<span class="preset-icon" aria-hidden="true">${preset.icon}</span><span></span>`;
    b.lastChild.textContent = preset.name;
    b.title = preset.words.join(', ');
    b.addEventListener('click', () => {
      setWords(preset.words.join(', '));
      P.toast(`Ordlisten «${preset.name}» er valgt`);
    });
    $('#preset-lists').appendChild(b);
  }

  // Egne lagrede lister
  const savedSelect = $('#saved-select');
  const savedLists = () => P.store.get('lists', []);
  function renderSavedLists() {
    const lists = savedLists();
    savedSelect.innerHTML = '';
    if (!lists.length) savedSelect.add(new Option('Ingen lagrede lister ennå', ''));
    lists.forEach((l, i) => savedSelect.add(new Option(`${l.name} (${l.words.length})`, String(i))));
    savedSelect.disabled = !lists.length;
    $('#saved-load').disabled = !lists.length;
    $('#saved-delete').disabled = !lists.length;
  }
  $('#saved-save').addEventListener('click', () => {
    const words = L.parseWords(settings.text);
    const name = $('#saved-name').value.trim();
    if (!words.length) return P.toast('Skriv inn noen ord først');
    if (!name) { $('#saved-name').focus(); return P.toast('Gi listen et navn'); }
    const lists = savedLists().filter((l) => l.name !== name);
    lists.unshift({ name, words: words.map((w) => w.toLocaleLowerCase('nb-NO')) });
    P.store.set('lists', lists.slice(0, 50));
    $('#saved-name').value = '';
    renderSavedLists();
    P.toast(`Lagret «${name}»`);
  });
  $('#saved-load').addEventListener('click', () => {
    const list = savedLists()[savedSelect.value];
    if (!list) return;
    setWords(list.words.join(', '));
    P.toast(`Bruker «${list.name}»`);
  });
  $('#saved-delete').addEventListener('click', () => {
    const lists = savedLists();
    const list = lists[savedSelect.value];
    if (!list || !window.confirm(`Slette listen «${list.name}»?`)) return;
    lists.splice(savedSelect.value, 1);
    P.store.set('lists', lists);
    renderSavedLists();
  });
  renderSavedLists();

  // Vanskelighetsgrad
  const DIFF_ICONS = { lett: '🐣', middels: '🦊', vanskelig: '🦁' };
  const diffGrid = $('#diff-grid');
  for (const [key, d] of Object.entries(L.DIFFICULTIES)) {
    const label = document.createElement('label');
    label.className = 'diff-card diff-' + key;
    label.innerHTML = `
      <input type="radio" name="difficulty" value="${key}">
      <span class="diff-icon" aria-hidden="true">${DIFF_ICONS[key]}</span>
      <span class="diff-name">${d.label}</span>
      <span class="diff-desc">${d.description}</span>`;
    diffGrid.appendChild(label);
  }
  function renderDifficulty() {
    $$('input[name="difficulty"]').forEach((r) => { r.checked = r.value === settings.difficulty; });
    $('#hint-after-row').classList.toggle('dim', settings.difficulty !== 'middels');
  }
  diffGrid.addEventListener('change', (e) => {
    settings.difficulty = e.target.value;
    save();
    renderDifficulty();
    Sound.unlock();
    Sound.tap();
  });
  renderDifficulty();

  // Flere innstillinger
  const OPTIONS = [
    ['#opt-hint-after', 'hintAfter', 'value'],
    ['#opt-extra', 'extraLetters', 'value'],
    ['#opt-case', 'letterCase', 'value'],
    ['#opt-name', 'childName', 'value'],
    ['#opt-letter-sound', 'letterSound', 'checked'],
    ['#opt-spell-out', 'spellOut', 'checked'],
    ['#opt-speak-word', 'speakWord', 'checked'],
    ['#opt-shuffle', 'shuffleWords', 'checked'],
    ['#opt-picture', 'showPicture', 'checked'],
  ];
  for (const [sel, key, prop] of OPTIONS) {
    const el = $(sel);
    el[prop] = settings[key];
    el.addEventListener(prop === 'checked' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      settings[key] = el[prop];
      save();
      renderWordPreview();
      renderLetterGrid();
    });
  }
  if (!Speech.available) {
    $('#opt-speak-word').disabled = true;
    $('#opt-speak-word').closest('label').title = 'Enheten støtter ikke opplesning';
  }

  // Bokstavlyder: lytt, spill inn egen stemme, tilbakestill.
  const letterGrid = $('#letter-grid');
  if (!Letters.canRecord) $('.rec-help').hidden = true;
  function renderLetterGrid() {
    letterGrid.innerHTML = '';
    for (const letter of L.ALPHABET) {
      const cell = document.createElement('div');
      cell.className = 'letter-cell' + (Letters.hasCustom(letter) ? ' custom' : '');
      cell.innerHTML = `
        <button type="button" class="letter-play" aria-label="Hør lyden for ${letter}">${display(letter)}</button>
        ${Letters.canRecord ? `<button type="button" class="letter-rec" aria-label="Hold inne for å spille inn ${letter}">🎙️</button>` : ''}
        <button type="button" class="letter-reset" aria-label="Bruk standardlyd for ${letter}" ${Letters.hasCustom(letter) ? '' : 'hidden'}>↺</button>`;
      $('.letter-play', cell).addEventListener('click', () => { Sound.unlock(); Letters.play(letter); });
      $('.letter-reset', cell).addEventListener('click', () => {
        Letters.removeCustom(letter);
        renderLetterGrid();
        Letters.play(letter);
      });
      const rec = $('.letter-rec', cell);
      if (rec) bindRecordButton(rec, letter, cell);
      letterGrid.appendChild(cell);
    }
  }
  function bindRecordButton(btn, letter, cell) {
    let session = null;
    btn.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      Letters.stop();
      try {
        session = Letters.record();
        cell.classList.add('recording');
        session = await session;
      } catch (err) {
        session = null;
        cell.classList.remove('recording');
        P.toast('Fikk ikke tilgang til mikrofonen');
      }
    });
    const finish = async () => {
      if (!session) return;
      const s = await session;
      session = null;
      if (!s || !s.stop) return;
      const dataUrl = await s.stop();
      cell.classList.remove('recording');
      if (!Letters.saveCustom(letter, dataUrl)) return P.toast('Ikke plass til flere opptak');
      renderLetterGrid();
      Letters.play(letter);
    };
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, finish));
  }
  $('#letter-sounds').addEventListener('toggle', (e) => {
    if (e.target.open) { Sound.unlock(); Letters.preload(); }
  });
  renderLetterGrid();

  startBtn.addEventListener('click', () => {
    Sound.unlock();
    startGame(L.parseWords(settings.text));
  });

  // ======================= SPILLET =======================
  let game = null;
  let session = 0; // økes ved hver start/stopp så forsinkede handlinger fra et avsluttet spill ignoreres
  const slotsEl = $('#slots');
  const bankEl = $('#bank');
  const feedbackEl = $('#spell-feedback');

  function startGame(words) {
    if (!words.length) return;
    session++;
    game = {
      words: settings.shuffleWords ? L.shuffle(words) : words.slice(),
      cfg: L.resolveSettings(settings),
      index: 0,
      cur: null,
    };
    Letters.preload();
    P.show('spell');
    loadWord();
  }

  function loadWord() {
    const word = game.words[game.index];
    game.cur = {
      word,
      slots: word.split('').map((letter) => ({ letter, filled: false, wrong: 0, ghost: game.cfg.ghost === 'always' })),
      bank: L.buildLetterBank(word, game.cfg.extraLetters),
      done: false,
    };
    $('#word-done').classList.add('hidden');
    $('#spell-hint').hidden = !game.cfg.hintButton;
    $('#spell-speak').hidden = !Speech.available;
    feedbackEl.textContent = '';

    P.renderProgress($('#spell-progress'), game.index, game.words.length);
    const emoji = settings.showPicture ? L.emojiFor(word) : '';
    $('#spell-picture').textContent = emoji;
    $('#spell-picture').hidden = !emoji;
    renderSlots();
    renderBank();
    const s = session;
    if (settings.speakWord) setTimeout(() => s === session && Speech.speak(word), 450);
  }

  function renderSlots() {
    const cur = game.cur;
    slotsEl.innerHTML = '';
    slotsEl.style.setProperty('--n', cur.slots.length);
    cur.slots.forEach((slot, i) => {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.index = i;
      el.innerHTML = '<span class="ghost"></span><span class="letter"></span>';
      $('.ghost', el).textContent = display(slot.letter);
      slotsEl.appendChild(el);
      updateSlot(i);
    });
  }

  function updateSlot(i) {
    const slot = game.cur.slots[i];
    const el = slotsEl.children[i];
    el.classList.toggle('filled', slot.filled);
    el.classList.toggle('show-ghost', slot.ghost && !slot.filled);
    $('.letter', el).textContent = slot.filled ? display(slot.letter) : '';
    el.setAttribute('aria-label', slot.filled
      ? `Boks ${i + 1}: ${display(slot.letter)}`
      : `Boks ${i + 1}: tom${slot.ghost ? ', hint ' + display(slot.letter) : ''}`);
  }

  function renderBank() {
    bankEl.innerHTML = '';
    game.cur.bank.forEach((tile, n) => {
      const el = document.createElement('div');
      el.className = 'tile';
      el.dataset.id = tile.id;
      el.style.setProperty('--hue', (n * 47 + 200) % 360);
      el.textContent = display(tile.letter);
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Bokstav ' + display(tile.letter));
      el.addEventListener('pointerdown', onTilePointerDown);
      bankEl.appendChild(el);
    });
  }

  const tileEl = (id) => bankEl.querySelector(`.tile[data-id="${id}"]`);

  /** Finn boksen under fingeren, eller nærmeste boks innen rimelig avstand (små fingre bommer litt). */
  function slotAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    const direct = hit && hit.closest('.slot');
    if (direct) return Number(direct.dataset.index);
    let best = null;
    let bestDist = Infinity;
    for (const el of slotsEl.children) {
      const r = el.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < bestDist && d < Math.max(r.width, r.height) * 0.9) {
        best = Number(el.dataset.index);
        bestDist = d;
      }
    }
    return best;
  }

  let tapHints = 0;

  function onTilePointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.currentTarget;
    const id = Number(el.dataset.id);
    const cur = game && game.cur;
    const tile = cur && cur.bank.find((t) => t.id === id);
    if (!tile || tile.used || cur.done) return;
    e.preventDefault();
    Sound.unlock();
    if (settings.letterSound) Letters.play(tile.letter);
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }

    const rect = el.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const ghost = el.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    const place = (x, y, extra) => {
      ghost.style.transform = `translate(${x - rect.width / 2}px, ${y - rect.height / 2}px)${extra || ''}`;
    };
    place(rect.left + rect.width / 2, rect.top + rect.height / 2, ' scale(1.12) rotate(-4deg)');
    document.body.appendChild(ghost);
    el.classList.add('dragging');
    let moved = false;
    let hover = null;

    const setHover = (i) => {
      if (hover === i) return;
      if (hover != null && slotsEl.children[hover]) slotsEl.children[hover].classList.remove('drop-target');
      hover = i;
      if (hover != null) slotsEl.children[hover].classList.add('drop-target');
    };

    const move = (ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 6) moved = true;
      place(ev.clientX, ev.clientY, ' scale(1.12) rotate(-4deg)');
      const target = slotAt(ev.clientX, ev.clientY);
      setHover(target != null && !cur.slots[target].filled ? target : null);
    };

    // Brikken flyr tilbake til plassen sin (feil boks eller sluppet utenfor).
    const flyBack = () => {
      ghost.classList.add('returning');
      place(rect.left + rect.width / 2, rect.top + rect.height / 2);
      setTimeout(() => {
        ghost.remove();
        el.classList.remove('dragging');
      }, 220);
    };

    const end = (ev, cancelled) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      setHover(null);
      if (cancelled || !moved) {
        flyBack();
        if (!cancelled && tapHints < 3) {
          tapHints++;
          P.toast('Dra bokstaven til en boks 👆');
          P.restartAnimation(el, 'wiggle');
        }
        return;
      }
      const target = slotAt(ev.clientX, ev.clientY);
      if (target == null || cur.slots[target].filled) return flyBack();
      if (tryPlace(tile, target)) {
        const r = slotsEl.children[target].getBoundingClientRect();
        ghost.classList.add('returning');
        place(r.left + r.width / 2, r.top + r.height / 2);
        setTimeout(() => ghost.remove(), 160);
      } else {
        flyBack();
      }
    };
    const up = (ev) => end(ev, false);
    const cancel = (ev) => end(ev, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  }

  /** Prøv å legge bokstaven i en boks. Gir true når den passet. */
  function tryPlace(tile, index) {
    const cur = game.cur;
    const slot = cur.slots[index];
    const slotEl = slotsEl.children[index];
    if (tile.letter === slot.letter) {
      slot.filled = true;
      tile.used = true;
      const te = tileEl(tile.id);
      if (te) te.classList.add('used');
      Sound.correct();
      updateSlot(index);
      P.restartAnimation(slotEl, 'pop');
      feedbackEl.textContent = '';
      if (cur.slots.every((s) => s.filled)) wordComplete();
      return true;
    }
    slot.wrong++;
    Sound.wrong();
    P.restartAnimation(slotEl, 'shake');
    P.restartAnimation(tileEl(tile.id), 'shake');
    feedbackEl.textContent = P.pick(P.ENCOURAGE);
    if (game.cfg.ghost === 'after' && !slot.ghost && slot.wrong >= game.cfg.hintAfter) {
      slot.ghost = true;
      setTimeout(() => {
        updateSlot(index);
        feedbackEl.textContent = 'Se, et lite hint i boksen 👀';
      }, 350);
    }
    return false;
  }

  function useHint() {
    const cur = game && game.cur;
    if (!cur || cur.done) return;
    const i = cur.slots.findIndex((s) => !s.filled);
    if (i < 0) return;
    const slot = cur.slots[i];
    Sound.hint();
    if (!slot.ghost) {
      slot.ghost = true;
      updateSlot(i);
    }
    const tile = cur.bank.find((t) => !t.used && t.letter === slot.letter);
    P.restartAnimation(tile && tileEl(tile.id), 'glow');
    P.restartAnimation(slotsEl.children[i], 'glow');
  }

  /** Stav ordet høyt: «k – a – t – t», boks for boks, og si så hele ordet. */
  async function spellOut(word) {
    const s = session;
    if (settings.spellOut) {
      for (let i = 0; i < word.length; i++) {
        if (s !== session) return;
        const el = slotsEl.children[i];
        if (el) el.classList.add('speaking');
        await Letters.play(word[i]);
        await P.wait(180);
        if (el) el.classList.remove('speaking');
      }
      await P.wait(250);
    }
    if (s !== session) return;
    await Speech.speak(word);
  }

  async function wordComplete() {
    const cur = game.cur;
    cur.done = true;
    const s = session;
    Sound.win();
    window.PaizonConfetti.burst(120);
    await P.wait(700);
    if (s !== session) return;
    await spellOut(cur.word);
    if (s !== session) return;

    const name = settings.childName.trim();
    const emoji = settings.showPicture ? L.emojiFor(cur.word) : '';
    $('#done-picture').textContent = emoji || '🎉';
    $('#done-word').textContent = displayWord(cur.word);
    $('#done-praise').textContent = P.pick(P.PRAISE) + (name ? ` Godt jobbet, ${name}!` : '');
    $('#next-btn').textContent = game.index >= game.words.length - 1 ? 'Ferdig 🎉' : 'Neste ord ➜';
    $('#word-done').classList.remove('hidden');
    $('#next-btn').focus();
  }

  $('#done-replay').addEventListener('click', () => {
    if (game && game.cur) spellOut(game.cur.word);
  });

  $('#next-btn').addEventListener('click', () => {
    Sound.tap();
    Letters.stop();
    Speech.stop();
    if (game.index >= game.words.length - 1) {
      const words = game.words;
      const name = settings.childName.trim();
      P.showDone({
        icon: '🏆',
        title: `Kjempebra${name ? ', ' + name : ''}!`,
        summary: `Du stavet ${words.length} ord:`,
        items: words.map((w) => {
          const emoji = settings.showPicture ? L.emojiFor(w) : '';
          return (emoji ? emoji + '  ' : '') + displayWord(w);
        }),
        again: () => startGame(words),
        setup: 'spell-setup',
      });
    } else {
      game.index++;
      loadWord();
    }
  });

  $('#spell-hint').addEventListener('click', useHint);
  $('#spell-speak').addEventListener('click', () => game && Speech.speak(game.cur.word));

  P.registerGame('spell', {
    screen: 'spell',
    setupScreen: 'spell-setup',
    start: () => startGame(L.parseWords(settings.text)),
    stop() {
      session++;
      Letters.stop();
      Speech.stop();
      $('#word-done').classList.add('hidden');
      $$('.drag-ghost').forEach((g) => g.remove());
    },
    onSetup() {
      renderWordPreview();
      renderLetterGrid();
    },
  });
})();
