/* Paizon – skjermstyring, oppsett og «Stave ord»-spillet. */
(function () {
  'use strict';

  const L = window.PaizonLogic;
  const Sound = window.PaizonSound;
  const Speech = window.PaizonSpeech;
  const Confetti = window.PaizonConfetti;

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

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

  const DEFAULT_SETTINGS = {
    text: 'katt, hund, sol',
    difficulty: 'lett',
    hintAfter: 2,
    extraLetters: 'auto',
    letterCase: 'upper',
    childName: '',
    shuffleWords: false,
    speakWord: true,
    speakLetters: false,
    showPicture: true,
  };
  const settings = Object.assign({}, DEFAULT_SETTINGS, store.get('settings', {}));
  const saveSettings = () => store.set('settings', settings);

  const stats = Object.assign({ stars: 0, words: 0 }, store.get('stats', {}));

  // ---------- Hjelpere ----------
  function display(letter) {
    return settings.letterCase === 'lower' ? letter.toLocaleLowerCase('nb-NO') : letter;
  }
  function displayWord(word) {
    return word.split('').map(display).join('');
  }
  const pick = (list) => list[Math.floor(Math.random() * list.length)];

  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function restartAnimation(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth; // tving reflow slik at animasjonen starter på nytt
    el.classList.add(cls);
  }

  // ---------- Skjermer ----------
  function show(name) {
    $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    document.body.dataset.screen = name;
    if (name === 'home') renderStats();
    if (name === 'setup') renderWordPreview();
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]');
    if (!go) return;
    Sound.unlock();
    Sound.tap();
    show(go.dataset.go);
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

  // ---------- Forside ----------
  function renderStats() {
    $('#stats').textContent = stats.words
      ? `⭐ ${stats.stars} stjerner samlet · ${stats.words} ord stavet`
      : 'Samle stjerner ved å stave ord! ⭐';
  }

  // ---------- Oppsett ----------
  const wordInput = $('#word-input');
  const startBtn = $('#start-btn');

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
    startBtn.textContent = words.length
      ? `Start ▶  (${words.length} ord)`
      : 'Skriv minst ett ord';
  }

  wordInput.value = settings.text;
  wordInput.addEventListener('input', () => {
    settings.text = wordInput.value;
    saveSettings();
    renderWordPreview();
  });

  // Ferdige lister
  const presetBox = $('#preset-lists');
  for (const preset of L.PRESET_LISTS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.innerHTML = `<span class="preset-icon" aria-hidden="true">${preset.icon}</span><span>${preset.name}</span>`;
    b.title = preset.words.join(', ');
    b.addEventListener('click', () => {
      setWords(preset.words.join(', '));
      toast(`Ordlisten «${preset.name}» er valgt`);
    });
    presetBox.appendChild(b);
  }

  function setWords(text) {
    settings.text = text;
    wordInput.value = text;
    saveSettings();
    renderWordPreview();
  }

  // Egne lagrede lister
  const savedSelect = $('#saved-select');
  function savedLists() { return store.get('lists', []); }
  function renderSavedLists() {
    const lists = savedLists();
    savedSelect.innerHTML = lists.length
      ? lists.map((l, i) => `<option value="${i}"></option>`).join('')
      : '<option value="">Ingen lagrede lister ennå</option>';
    lists.forEach((l, i) => { savedSelect.options[i].textContent = `${l.name} (${l.words.length})`; });
    savedSelect.disabled = !lists.length;
    $('#saved-load').disabled = !lists.length;
    $('#saved-delete').disabled = !lists.length;
  }
  $('#saved-save').addEventListener('click', () => {
    const words = L.parseWords(settings.text);
    const name = $('#saved-name').value.trim();
    if (!words.length) return toast('Skriv inn noen ord først');
    if (!name) { $('#saved-name').focus(); return toast('Gi listen et navn'); }
    const lists = savedLists().filter((l) => l.name !== name);
    lists.unshift({ name, words: words.map((w) => w.toLocaleLowerCase('nb-NO')) });
    store.set('lists', lists.slice(0, 50));
    $('#saved-name').value = '';
    renderSavedLists();
    toast(`Lagret «${name}»`);
  });
  $('#saved-load').addEventListener('click', () => {
    const list = savedLists()[savedSelect.value];
    if (!list) return;
    setWords(list.words.join(', '));
    toast(`Bruker «${list.name}»`);
  });
  $('#saved-delete').addEventListener('click', () => {
    const lists = savedLists();
    const list = lists[savedSelect.value];
    if (!list || !window.confirm(`Slette listen «${list.name}»?`)) return;
    lists.splice(savedSelect.value, 1);
    store.set('lists', lists);
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
    saveSettings();
    renderDifficulty();
    Sound.unlock();
    Sound.tap();
  });
  renderDifficulty();

  // Avanserte innstillinger
  const OPTIONS = [
    ['#opt-hint-after', 'hintAfter', 'value'],
    ['#opt-extra', 'extraLetters', 'value'],
    ['#opt-case', 'letterCase', 'value'],
    ['#opt-name', 'childName', 'value'],
    ['#opt-shuffle', 'shuffleWords', 'checked'],
    ['#opt-speak-word', 'speakWord', 'checked'],
    ['#opt-speak-letter', 'speakLetters', 'checked'],
    ['#opt-picture', 'showPicture', 'checked'],
  ];
  for (const [sel, key, prop] of OPTIONS) {
    const el = $(sel);
    el[prop] = settings[key];
    el.addEventListener(prop === 'checked' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
      settings[key] = el[prop];
      saveSettings();
      renderWordPreview();
    });
  }
  if (!Speech.available) {
    ['#opt-speak-word', '#opt-speak-letter'].forEach((s) => {
      $(s).disabled = true;
      $(s).closest('label').title = 'Nettleseren støtter ikke opplesning';
    });
  }

  startBtn.addEventListener('click', () => {
    Sound.unlock();
    startGame(L.parseWords(settings.text));
  });

  // ---------- Spillet ----------
  let game = null;
  const slotsEl = $('#slots');
  const bankEl = $('#bank');
  const feedbackEl = $('#feedback');

  const PRAISE = ['Supert!', 'Kjempebra!', 'Så flink du er!', 'Fantastisk!', 'Strålende!', 'Du klarte det!', 'Wow!'];
  const ENCOURAGE = ['Nesten! Prøv igjen 🙂', 'Prøv en annen bokstav', 'Ikke helt – du klarer det!', 'Hmm, prøv igjen'];

  function startGame(words) {
    if (!words.length) return;
    const cfg = L.resolveSettings(settings);
    game = {
      words: settings.shuffleWords ? L.shuffle(words) : words.slice(),
      cfg,
      index: 0,
      results: [],
      cur: null,
    };
    show('game');
    loadWord();
  }

  function loadWord() {
    const word = game.words[game.index];
    game.cur = {
      word,
      slots: word.split('').map((letter) => ({ letter, filled: false, wrong: 0, ghost: game.cfg.ghost === 'always' })),
      bank: L.buildLetterBank(word, game.cfg.extraLetters),
      mistakes: 0,
      hints: 0,
      selected: 0,
      done: false,
    };
    $('#word-done').classList.add('hidden');
    $('#hint-btn').hidden = !game.cfg.hintButton;
    $('#speak-btn').hidden = !Speech.available;
    feedbackEl.textContent = '';

    renderProgress();
    renderPicture();
    renderSlots();
    renderBank();
    if (settings.speakWord) setTimeout(() => Speech.speak(word), 450);
  }

  function renderProgress() {
    const el = $('#progress');
    el.innerHTML = '';
    game.words.forEach((w, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i < game.index ? ' done' : i === game.index ? ' current' : '');
      el.appendChild(dot);
    });
    el.setAttribute('aria-label', `Ord ${game.index + 1} av ${game.words.length}`);
  }

  function renderPicture() {
    const emoji = settings.showPicture ? L.emojiFor(game.cur.word) : '';
    const el = $('#picture');
    el.textContent = emoji;
    el.hidden = !emoji;
  }

  function renderSlots() {
    const cur = game.cur;
    slotsEl.innerHTML = '';
    slotsEl.style.setProperty('--n', cur.slots.length);
    cur.slots.forEach((slot, i) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'slot';
      el.dataset.index = i;
      el.innerHTML = `<span class="ghost">${display(slot.letter)}</span><span class="letter"></span>`;
      el.addEventListener('click', () => selectSlot(i));
      slotsEl.appendChild(el);
      updateSlot(i);
    });
  }

  function updateSlot(i) {
    const slot = game.cur.slots[i];
    const el = slotsEl.children[i];
    el.classList.toggle('filled', slot.filled);
    el.classList.toggle('show-ghost', slot.ghost && !slot.filled);
    el.classList.toggle('selected', !slot.filled && game.cur.selected === i && !game.cur.done);
    $('.letter', el).textContent = slot.filled ? display(slot.letter) : '';
    el.setAttribute('aria-label', slot.filled
      ? `Boks ${i + 1}: ${display(slot.letter)}`
      : `Boks ${i + 1}: tom${slot.ghost ? ', hint ' + display(slot.letter) : ''}`);
  }

  function selectSlot(i) {
    const cur = game.cur;
    if (cur.done || cur.slots[i].filled) return;
    const prev = cur.selected;
    cur.selected = i;
    if (prev !== i && cur.slots[prev]) updateSlot(prev);
    updateSlot(i);
    Sound.tap();
  }

  function nextEmpty(from) {
    const slots = game.cur.slots;
    for (let k = 1; k <= slots.length; k++) {
      const j = (from + k) % slots.length;
      if (!slots[j].filled) return j;
    }
    return -1;
  }

  function renderBank() {
    bankEl.innerHTML = '';
    game.cur.bank.forEach((tile, n) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'tile';
      el.dataset.id = tile.id;
      el.style.setProperty('--hue', (n * 47 + 200) % 360);
      el.textContent = display(tile.letter);
      el.setAttribute('aria-label', 'Bokstav ' + display(tile.letter));
      el.addEventListener('pointerdown', onTilePointerDown);
      // Tastatur (Enter/mellomrom) – klikk fra mus/touch håndteres i pointer-logikken.
      el.addEventListener('click', (e) => { if (e.detail === 0) placeTile(tile.id, game.cur.selected); });
      bankEl.appendChild(el);
    });
  }

  function tileEl(id) {
    return bankEl.querySelector(`.tile[data-id="${id}"]`);
  }

  /** Forsøk å plassere en bokstav i en boks. tileId kan være null ved tastatur uten ledig brikke. */
  function placeTile(tileId, slotIndex, typedLetter) {
    const cur = game && game.cur;
    if (!cur || cur.done) return;
    let index = slotIndex;
    if (index == null || !cur.slots[index] || cur.slots[index].filled) index = nextEmpty(index == null ? -1 : index);
    if (index < 0) return;

    const slot = cur.slots[index];
    const tile = tileId == null ? null : cur.bank.find((t) => t.id === tileId && !t.used);
    const letter = tile ? tile.letter : typedLetter;
    if (!letter) return;
    const slotEl = slotsEl.children[index];

    if (letter === slot.letter) {
      slot.filled = true;
      if (tile) {
        tile.used = true;
        const te = tileEl(tile.id);
        if (te) te.classList.add('used');
      }
      Sound.correct();
      if (settings.speakLetters) Speech.speak(letter, 1);
      const prev = cur.selected;
      cur.selected = nextEmpty(index);
      updateSlot(index);
      if (prev !== index && cur.slots[prev]) updateSlot(prev);
      if (cur.selected >= 0) updateSlot(cur.selected);
      restartAnimation(slotEl, 'pop');
      feedbackEl.textContent = '';
      if (cur.slots.every((s) => s.filled)) wordComplete();
    } else {
      cur.mistakes++;
      slot.wrong++;
      Sound.wrong();
      restartAnimation(slotEl, 'shake');
      if (tile) {
        const te = tileEl(tile.id);
        if (te) restartAnimation(te, 'shake');
      }
      feedbackEl.textContent = pick(ENCOURAGE);
      if (game.cfg.ghost === 'after' && !slot.ghost && slot.wrong >= game.cfg.hintAfter) {
        slot.ghost = true;
        setTimeout(() => {
          updateSlot(index);
          feedbackEl.textContent = 'Se, et lite hint i boksen 👀';
        }, 350);
      }
      if (cur.selected !== index) {
        const prev = cur.selected;
        cur.selected = index;
        if (cur.slots[prev]) updateSlot(prev);
        updateSlot(index);
      }
    }
  }

  function useHint() {
    const cur = game && game.cur;
    if (!cur || cur.done) return;
    const i = cur.slots[cur.selected] && !cur.slots[cur.selected].filled ? cur.selected : nextEmpty(-1);
    if (i < 0) return;
    const slot = cur.slots[i];
    cur.hints++;
    Sound.hint();
    if (!slot.ghost) {
      slot.ghost = true;
      updateSlot(i);
    }
    // Få riktig brikke til å gløde litt.
    const tile = cur.bank.find((t) => !t.used && t.letter === slot.letter);
    const te = tile && tileEl(tile.id);
    if (te) restartAnimation(te, 'glow');
    restartAnimation(slotsEl.children[i], 'glow');
  }

  function wordComplete() {
    const cur = game.cur;
    cur.done = true;
    const stars = L.starsFor(cur.mistakes, cur.hints, cur.word.length);
    game.results.push({ word: cur.word, stars, mistakes: cur.mistakes, hints: cur.hints });
    stats.stars += stars;
    stats.words += 1;
    store.set('stats', stats);

    slotsEl.classList.add('celebrate');
    setTimeout(() => slotsEl.classList.remove('celebrate'), 900);
    Sound.win();
    Confetti.burst(stars === 3 ? 160 : 90);
    setTimeout(() => Speech.speak(cur.word), 300);

    const name = settings.childName.trim();
    const emoji = settings.showPicture ? L.emojiFor(cur.word) : '';
    $('#done-picture').textContent = emoji || '🎉';
    $('#done-word').textContent = displayWord(cur.word);
    const starsEl = $('#done-stars');
    starsEl.innerHTML = [1, 2, 3].map((n) =>
      `<span class="star ${n <= stars ? 'on' : ''}" style="--d:${n * 0.18}s">★</span>`).join('');
    starsEl.setAttribute('aria-label', `${stars} av 3 stjerner`);
    $('#done-praise').textContent = pick(PRAISE) + (name ? ` Godt jobbet, ${name}!` : '');
    const last = game.index >= game.words.length - 1;
    $('#next-btn').textContent = last ? 'Se resultat 🏆' : 'Neste ord ➜';

    setTimeout(() => {
      $('#word-done').classList.remove('hidden');
      $('#next-btn').focus();
    }, 900);
  }

  $('#next-btn').addEventListener('click', () => {
    Sound.tap();
    if (game.index >= game.words.length - 1) {
      showResult();
    } else {
      game.index++;
      loadWord();
    }
  });

  $('#hint-btn').addEventListener('click', useHint);
  $('#speak-btn').addEventListener('click', () => game && Speech.speak(game.cur.word));

  // Dra og slipp + trykk med pointer events (fungerer med mus, finger og penn).
  function onTilePointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.currentTarget;
    const id = Number(el.dataset.id);
    const tile = game.cur.bank.find((t) => t.id === id);
    if (!tile || tile.used || game.cur.done) return;
    e.preventDefault();
    Sound.unlock();
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignorer */ }

    const startX = e.clientX;
    const startY = e.clientY;
    const rect = el.getBoundingClientRect();
    let ghost = null;
    let hover = null;

    const slotAt = (x, y) => {
      const hit = document.elementFromPoint(x, y);
      const s = hit && hit.closest('.slot');
      return s ? Number(s.dataset.index) : null;
    };
    const setHover = (i) => {
      if (hover === i) return;
      if (hover != null) slotsEl.children[hover].classList.remove('drop-target');
      hover = i;
      if (hover != null) slotsEl.children[hover].classList.add('drop-target');
    };

    const move = (ev) => {
      if (!ghost && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
        ghost = el.cloneNode(true);
        ghost.classList.add('drag-ghost');
        ghost.style.width = rect.width + 'px';
        ghost.style.height = rect.height + 'px';
        document.body.appendChild(ghost);
        el.classList.add('dragging');
      }
      if (ghost) {
        ghost.style.transform = `translate(${ev.clientX - rect.width / 2}px, ${ev.clientY - rect.height / 2}px) scale(1.12) rotate(-4deg)`;
        setHover(slotAt(ev.clientX, ev.clientY));
      }
    };
    const end = (ev, cancelled) => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      setHover(null);
      if (ghost) {
        ghost.remove();
        el.classList.remove('dragging');
        if (cancelled) return;
        const target = slotAt(ev.clientX, ev.clientY);
        if (target != null) placeTile(id, target);
      } else if (!cancelled) {
        placeTile(id, game.cur.selected);
      }
    };
    const up = (ev) => end(ev, false);
    const cancel = (ev) => end(ev, true);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  }

  // Fysisk tastatur: skriv bokstaven direkte.
  document.addEventListener('keydown', (e) => {
    if (document.body.dataset.screen !== 'game' || !game || e.ctrlKey || e.metaKey || e.altKey) return;
    if (game.cur.done) {
      if (e.key === 'Enter' && !$('#word-done').classList.contains('hidden')) $('#next-btn').click();
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const n = game.cur.slots.length;
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      for (let k = 1, j = game.cur.selected; k <= n; k++) {
        j = (j + dir + n) % n;
        if (!game.cur.slots[j].filled) { selectSlot(j); break; }
      }
      e.preventDefault();
      return;
    }
    if (e.key.length !== 1) return;
    const letter = L.normalizeWord(e.key);
    if (letter.length !== 1) return;
    e.preventDefault();
    const tile = game.cur.bank.find((t) => !t.used && t.letter === letter);
    placeTile(tile ? tile.id : null, game.cur.selected, letter);
  });

  // Hjem-knapp i spillet må holdes inne, så barnet ikke avslutter ved et uhell.
  const exitBtn = $('#exit-btn');
  let holdTimer = null;
  const HOLD_MS = 1000;
  exitBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    exitBtn.classList.add('holding');
    holdTimer = setTimeout(() => {
      exitBtn.classList.remove('holding');
      holdTimer = null;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      show('setup');
    }, HOLD_MS);
  });
  const releaseHold = () => {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
      toast('Hold inne 🏠 for å avslutte');
    }
    exitBtn.classList.remove('holding');
  };
  ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => exitBtn.addEventListener(ev, releaseHold));
  exitBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show('setup'); }
  });

  // ---------- Resultat ----------
  function showResult() {
    const total = game.results.reduce((sum, r) => sum + r.stars, 0);
    const max = game.results.length * 3;
    const name = settings.childName.trim();
    $('#result-title').textContent = total === max ? `Perfekt${name ? ', ' + name : ''}! 🌟` : `Kjempebra${name ? ', ' + name : ''}!`;
    $('#result-summary').textContent = `Du stavet ${game.results.length} ord og fikk ${total} av ${max} stjerner.`;
    $('#result-list').innerHTML = '';
    for (const r of game.results) {
      const li = document.createElement('li');
      const emoji = settings.showPicture ? L.emojiFor(r.word) : '';
      li.innerHTML = `<span class="r-word"></span><span class="r-stars" aria-label="${r.stars} stjerner">${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(3 - r.stars)}</span></span>`;
      $('.r-word', li).textContent = (emoji ? emoji + ' ' : '') + displayWord(r.word);
      $('#result-list').appendChild(li);
    }
    show('result');
    Confetti.burst(200);
  }

  $('#again-btn').addEventListener('click', () => {
    if (game) startGame(game.words);
  });

  // ---------- Oppstart ----------
  show('home');

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
